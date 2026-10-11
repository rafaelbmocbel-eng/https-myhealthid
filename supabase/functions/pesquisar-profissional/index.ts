// Pesquisa automática de um profissional na internet, para ajudar o administrador a verificá-lo
// (decisão do Rafael, 11/10/2026; docs/triagem-planos.md, seção "Pesquisa automática de profissionais").
//
// POST { user_id } -> { ok: true, pesquisa } | { ok: false, codigo, mensagem, pesquisa? }
//
// A pesquisa NUNCA verifica ninguém: devolve só um INDÍCIO sobre informação profissional pública, e
// verificar continua sendo um clique do administrador (verificar_profissional).
//
// Segurança:
//  - fail-closed: só o super-admin (eh_super_admin conferido no banco com o JWT dele) pesquisa; qualquer
//    falha nessa checagem é 403;
//  - a consulta usa só nome completo, profissão, registro e cidade/UF da clínica; nunca e-mail nem telefone;
//  - o conteúdo das páginas é dado não confiável: o servidor baixa as páginas que a busca aterrou, descarta
//    todo achado cujo trecho não conste literalmente nelas e recalcula nível e resumo (veja
//    _shared/pesquisa-profissional.ts). Nada do que o modelo disser sobre nível ou resumo é usado;
//  - o limite de custo é reservado ANTES da busca (uma linha provisória que já conta nos limites, com lock no banco):
//    cliques simultâneos não passam juntos, e a pesquisa que cair no meio fica registrada como falha;
//  - toda pesquisa (inclusive as que falham) é gravada com quem pesquisou e quando; sem gravar, não há resposta;
//  - as páginas só são lidas se o DNS resolver para endereço público (sem resposta de DNS, a página não é lida);
//  - a chave da IA vem do ambiente (GEMINI_API_KEY) e vai em cabeçalho; nada de nome ou registro vai para o log.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, requireUser } from "../_shared/auth.ts";
import { logUsoIA } from "../_shared/log-ia.ts";
import {
  achadosParaRegistro,
  calcularIndicio,
  type CodigoErro,
  consultaUsada,
  type ConsultaProfissional,
  extrairJson,
  type FonteAterrada,
  htmlParaTexto,
  indicioDeFalha,
  ipPrivado,
  MENSAGENS,
  montarConsulta,
  montarPrompt,
  type NivelIndicio,
  parseDominiosOficiais,
  paginaLegivel,
  paraPesquisa,
  type Pesquisa,
  chaveFonte,
  urlPublicaSegura,
  validarAchados,
} from "../_shared/pesquisa-profissional.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FONTES = 6;
const MAX_BYTES_PAGINA = 600_000;
const TIMEOUT_IA_MS = 45_000;
const TIMEOUT_PAGINAS_MS = 20_000;
const SALTOS_MAXIMOS = 5;

const emAndamento = new Set<string>();

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function falha(codigo: CodigoErro, status = 200, extra: Record<string, unknown> = {}) {
  return json({ ok: false, codigo, mensagem: MENSAGENS[codigo], ...extra }, status);
}

interface ResultadoBusca {
  texto: string;
  fontes: { uri: string; titulo: string }[];
  uso: { prompt_tokens: number; completion_tokens: number };
}

async function buscarNaInternet(
  chave: string,
  modelo: string,
  prompt: string,
): Promise<{ ok: true; busca: ResultadoBusca } | { ok: false; erro: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_IA_MS);
  let resp: Response;
  try {
    resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0 },
      }),
      signal: ctrl.signal,
    });
  } catch (e) {
    return { ok: false, erro: (e as Error)?.name === "AbortError" ? "ia_timeout" : "ia_indisponivel" };
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) {
    await resp.body?.cancel();
    return { ok: false, erro: `ia_http_${resp.status}` };
  }
  let dados: any;
  try {
    dados = await resp.json();
  } catch {
    return { ok: false, erro: "resposta_invalida" };
  }
  if (dados?.promptFeedback?.blockReason) return { ok: false, erro: "ia_bloqueada" };
  const cand = dados?.candidates?.[0];
  if (!cand) return { ok: false, erro: "ia_sem_resposta" };
  if (["SAFETY", "RECITATION", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII"].includes(String(cand.finishReason ?? ""))) {
    return { ok: false, erro: "ia_bloqueada" };
  }
  const partes: unknown[] = Array.isArray(cand.content?.parts) ? cand.content.parts : [];
  const texto = partes
    .filter((p) => !(p as { thought?: boolean } | null)?.thought)
    .map((p) => {
      const t = (p as { text?: unknown } | null)?.text;
      return typeof t === "string" ? t : "";
    })
    .join("");
  const fontes: { uri: string; titulo: string }[] = [];
  const blocos: unknown[] = Array.isArray(cand.groundingMetadata?.groundingChunks) ? cand.groundingMetadata.groundingChunks : [];
  for (const bloco of blocos) {
    const web = (bloco as { web?: { uri?: unknown; title?: unknown } } | null)?.web;
    const uri = web?.uri;
    if (typeof uri === "string" && uri && !fontes.some((f) => f.uri === uri)) {
      fontes.push({ uri, titulo: typeof web?.title === "string" ? web.title : "" });
    }
  }
  const um = dados?.usageMetadata;
  return {
    ok: true,
    busca: {
      texto,
      fontes,
      uso: {
        prompt_tokens: Number(um?.promptTokenCount) || 0,
        completion_tokens: (Number(um?.candidatesTokenCount) || 0) + (Number(um?.thoughtsTokenCount) || 0),
      },
    },
  };
}

/**
 * A página só é lida se o DNS resolver o host e TODOS os endereços forem públicos. Fecha em falha: sem
 * Deno.resolveDns, com erro de DNS (que não seja "sem registro deste tipo") ou sem nenhum endereço, não lê.
 * Não impede a troca de DNS entre esta checagem e a conexão (rebinding): ver docs/triagem-planos.md.
 */
async function hostPublico(host: string): Promise<boolean> {
  if (typeof Deno.resolveDns !== "function") return false;
  const nome = host.toLowerCase().replace(/\.+$/, "");
  let achouEndereco = false;
  for (const tipo of ["A", "AAAA"] as const) {
    try {
      const ips = await Deno.resolveDns(nome, tipo);
      for (const ip of ips) {
        if (ipPrivado(ip)) return false;
        achouEndereco = true;
      }
    } catch (e) {
      if (!(e instanceof Deno.errors.NotFound)) return false;
    }
  }
  return achouEndereco;
}

async function lerCorpo(resp: Response, tipo: string): Promise<string> {
  const leitor = resp.body?.getReader();
  if (!leitor) return "";
  const partes: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < MAX_BYTES_PAGINA) {
      const { done, value } = await leitor.read();
      if (done || !value) break;
      partes.push(value);
      total += value.length;
    }
  } finally {
    await leitor.cancel().catch(() => {
      // a leitura já pode ter terminado; cancelar de novo não muda nada
    });
  }
  const buf = new Uint8Array(Math.min(total, MAX_BYTES_PAGINA));
  let pos = 0;
  for (const p of partes) {
    const cabe = buf.length - pos;
    if (cabe <= 0) break;
    buf.set(p.length > cabe ? p.subarray(0, cabe) : p, pos);
    pos += Math.min(p.length, cabe);
  }
  const charset = /charset=([\w-]+)/i.exec(tipo)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset, { fatal: true }).decode(buf);
  } catch {
    try {
      return new TextDecoder("windows-1252").decode(buf);
    } catch {
      return "";
    }
  }
}

/**
 * Segue o redirecionamento da busca até a página real e lê o texto dela. Cada salto passa pela checagem de
 * endereço público; página que é barreira (captcha, login, erro) volta com texto vazio. null = não foi
 * possível nem chegar a uma URL pública segura.
 */
async function lerFonte(uri: string, titulo: string, sinal: AbortSignal): Promise<FonteAterrada | null> {
  let atual = uri;
  for (let salto = 0; salto <= SALTOS_MAXIMOS; salto++) {
    if (!urlPublicaSegura(atual) || !(await hostPublico(new URL(atual).hostname))) return null;
    let resp: Response;
    try {
      resp = await fetch(atual, {
        redirect: "manual",
        signal: sinal,
        headers: {
          Accept: "text/html,text/plain;q=0.9",
          "Accept-Language": "pt-BR,pt;q=0.9",
          "User-Agent": "MyHealthID-ConferenciaProfissional/1.0 (+https://www.myhealthid.com.br)",
        },
      });
    } catch {
      return null;
    }
    if ([301, 302, 303, 307, 308].includes(resp.status)) {
      const destino = resp.headers.get("location");
      await resp.body?.cancel();
      if (!destino) return null;
      try {
        atual = new URL(destino, atual).toString();
      } catch {
        return null;
      }
      continue;
    }
    const tipo = (resp.headers.get("content-type") ?? "").toLowerCase();
    if (!resp.ok || !/text\/html|text\/plain|application\/xhtml/.test(tipo)) {
      await resp.body?.cancel();
      return { url: atual, urlOriginal: uri, titulo, texto: "" };
    }
    const bruto = await lerCorpo(resp, tipo);
    const texto = tipo.includes("text/plain") ? bruto.replace(/\s+/g, " ").trim() : htmlParaTexto(bruto);
    return { url: atual, urlOriginal: uri, titulo, texto: paginaLegivel(texto) ? texto : "" };
  }
  return null;
}

async function lerFontes(candidatas: { uri: string; titulo: string }[]): Promise<FonteAterrada[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_PAGINAS_MS);
  try {
    const lidas = await Promise.allSettled(candidatas.map((c) => lerFonte(c.uri, c.titulo, ctrl.signal)));
    const fontes: FonteAterrada[] = [];
    for (const r of lidas) {
      if (r.status !== "fulfilled" || !r.value) continue;
      const chave = chaveFonte(r.value.url);
      if (chave && fontes.some((f) => chaveFonte(f.url) === chave)) continue;
      fontes.push(r.value);
    }
    return fontes;
  } finally {
    clearTimeout(timer);
  }
}

// deno-lint-ignore no-explicit-any
type Admin = any;

/** Conclui a reserva com o resultado e devolve o que ficou gravado. null = não foi possível registrar. */
async function gravar(
  admin: Admin,
  args: {
    reservaId: string;
    alvo: string;
    por: string;
    nivel: NivelIndicio;
    resumo: string;
    achados: unknown[];
    consulta: ConsultaProfissional;
    modelo: string;
    erro: string | null;
  },
): Promise<Pesquisa | null> {
  const { data: id, error } = await admin.rpc("registrar_pesquisa_profissional", {
    p_user_id: args.alvo,
    p_pesquisado_por: args.por,
    p_nivel_indicio: args.nivel,
    p_resumo: args.resumo,
    p_achados: args.achados,
    p_consulta_usada: consultaUsada(args.consulta),
    p_modelo: args.modelo,
    p_erro: args.erro,
    p_id: args.reservaId,
  });
  if (error || typeof id !== "string") {
    console.error("pesquisar-profissional: não consegui registrar a pesquisa");
    return null;
  }
  const { data: linha } = await admin
    .from("profissional_pesquisas")
    .select("id, pesquisado_em, nivel_indicio, resumo, achados, consulta_usada, modelo, erro")
    .eq("id", id)
    .maybeSingle();
  if (linha) return paraPesquisa(linha);
  return paraPesquisa({
    id,
    pesquisado_em: new Date().toISOString(),
    nivel_indicio: args.nivel,
    resumo: args.resumo,
    achados: args.achados,
    consulta_usada: consultaUsada(args.consulta),
    modelo: args.modelo,
    erro: args.erro,
  });
}

async function pesquisar(admin: Admin, por: string, alvo: string): Promise<Response> {
  const { data: perfil, error: erroPerfil } = await admin
    .from("profiles")
    .select("nome, sobrenome, perfil_profissional, registro_profissional, crefito")
    .eq("user_id", alvo)
    .maybeSingle();
  if (erroPerfil) return falha("indisponivel", 503);
  if (!perfil) return falha("sem_registro");

  const { data: clinica, error: erroClinica } = await admin
    .from("config_clinica")
    .select("cidade, uf")
    .eq("terapeuta_id", alvo)
    .maybeSingle();
  if (erroClinica) console.warn("pesquisar-profissional: não consegui ler a cidade da clínica");

  const consulta = montarConsulta({ ...perfil, cidade: clinica?.cidade, uf: clinica?.uf });
  if (!consulta) return falha("sem_registro");

  const chave = Deno.env.get("GEMINI_API_KEY");
  if (!chave) {
    return json({ ok: false, codigo: "falha_busca", mensagem: "A pesquisa automática ainda não está configurada (falta a chave da IA)." });
  }
  const modelo = Deno.env.get("GEMINI_MODEL_BUSCA") || "gemini-2.5-flash";
  const dominiosOficiais = parseDominiosOficiais(Deno.env.get("PESQUISA_DOMINIOS_OFICIAIS"));

  const { data: reserva, error: erroReserva } = await admin.rpc("pesquisa_profissional_pode_pesquisar", {
    p_user_id: alvo,
    p_pesquisado_por: por,
  });
  if (erroReserva || !reserva || typeof reserva !== "object") return falha("indisponivel", 503);
  if (reserva.ok !== true) {
    return falha(reserva.motivo === "limite_profissional" ? "limite_profissional" : "limite_diario");
  }
  const reservaId = typeof reserva.id === "string" ? reserva.id : "";
  if (!reservaId) return falha("indisponivel", 503);

  const registrarFalha = async (erro: string): Promise<Response> => {
    console.error("pesquisar-profissional: a busca falhou:", erro);
    const indicio = indicioDeFalha();
    const pesquisa = await gravar(admin, {
      reservaId, alvo, por, nivel: indicio.nivel, resumo: indicio.resumo, achados: [], consulta, modelo, erro,
    });
    if (!pesquisa) return falha("indisponivel", 503);
    return falha("falha_busca", 200, { pesquisa });
  };

  try {
    const busca = await buscarNaInternet(chave, modelo, montarPrompt(consulta));
    if (!busca.ok) return await registrarFalha(busca.erro);
    await logUsoIA("pesquisar-profissional", modelo, busca.busca.uso);

    const bruto = extrairJson(busca.busca.texto);
    if (bruto === null) return await registrarFalha(busca.busca.texto.trim() ? "resposta_invalida" : "ia_sem_resposta");

    const candidatas = busca.busca.fontes.slice(0, MAX_FONTES);
    const fontes = await lerFontes(candidatas);
    const validacao = validarAchados(bruto, consulta, fontes);
    const legiveis = fontes.filter((f) => f.texto.length > 0).length;
    const indicio = calcularIndicio(consulta, validacao.achados, {
      fontesTotal: candidatas.length,
      fontesLegiveis: legiveis,
      dominiosOficiais,
    });
    console.log(
      "pesquisar-profissional: fontes", candidatas.length, "legiveis", legiveis,
      "achados", validacao.achados.length, "descartados", validacao.descartados.length, "nivel", indicio.nivel,
    );

    const pesquisa = await gravar(admin, {
      reservaId, alvo, por, nivel: indicio.nivel, resumo: indicio.resumo, achados: achadosParaRegistro(validacao.achados),
      consulta, modelo, erro: null,
    });
    if (!pesquisa) return falha("indisponivel", 503);
    return json({ ok: true, pesquisa });
  } catch (e) {
    return await registrarFalha(`erro_interno: ${(e as Error)?.name ?? "desconhecido"}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return falha("pedido_invalido", 405);

  let userId = "";
  let admin: Admin;
  try {
    const sessao = await requireUser(req);
    userId = sessao.userId;
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !servico) return falha("sem_permissao", 403);
    const doUsuario = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${sessao.token}` } } });
    const { data: ehSuperAdmin, error } = await doUsuario.rpc("eh_super_admin");
    if (error || ehSuperAdmin !== true) return falha("sem_permissao", 403);
    admin = createClient(url, servico);
  } catch {
    return falha("sem_permissao", 403);
  }

  const corpo = await req.json().catch(() => ({}));
  const alvo = typeof corpo?.user_id === "string" ? corpo.user_id.trim() : "";
  if (!UUID.test(alvo)) return falha("pedido_invalido", 400);
  if (emAndamento.has(alvo)) {
    return json({ ok: false, codigo: "limite_profissional", mensagem: "Já há uma pesquisa em andamento para este profissional." });
  }

  emAndamento.add(alvo);
  try {
    return await pesquisar(admin, userId, alvo);
  } catch (e) {
    console.error("pesquisar-profissional:", (e as Error)?.message);
    return falha("indisponivel", 500);
  } finally {
    emAndamento.delete(alvo);
  }
});
