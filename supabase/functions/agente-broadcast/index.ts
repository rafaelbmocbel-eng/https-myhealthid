// Agente broadcast — dispara campanha de mensagens em massa.
//
// O texto de cada cliente sai de um de três jeitos, conforme a marca filtro.personalizar_ia da campanha:
//  - false: texto fixo do profissional, só com {nome}. Sem IA e sem dado clínico do cliente;
//  - true: a IA reescreve o texto do profissional vendo só o tom da clínica e o primeiro nome. Se ela falhar, vai o
//    texto fixo;
//  - ausente (campanha criada antes da marca): o texto é um briefing ("avise que..."), não a mensagem final. Passa
//    pela mesma IA enxuta e, se ela falhar, NÃO envia: mandar o briefing cru ao cliente seria pior que não mandar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isInternalCall, requireUser } from "../_shared/auth.ts";
import { registrarMensagemSaida } from "../_shared/registrar-saida.ts";
import { enviarWhatsapp } from "../_shared/enviar-whatsapp.ts";
import { logUsoIA } from "../_shared/log-ia.ts";
import { montarPedidoIABroadcast, normalizarTom, renderizarModelo, validarModelo, validarSaidaIA } from "../_shared/mensagem-modelos.ts";
import type { Tom } from "../_shared/mensagem-modelos.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const URL_GEMINI = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const MODELO_IA = "gemini-3.1-flash-lite";
const TIMEOUT_IA_MS = 20_000;
const PAUSA_ENTRE_ENVIOS_MS = 5_000;

// Campanha em qualquer um destes status nunca recomeça: reenviaria para quem já recebeu.
const STATUS_JA_PROCESSADA = ["executando", "concluido", "interrompido", "cancelado", "recusado"];
const JA_PROCESSADA = "já em execução ou processada";

type AdminClient = ReturnType<typeof createClient>;
type ModoCampanha = "texto_fixo" | "ia_com_reserva" | "briefing";
type Variante = { key: string; texto: string; peso: number };
type Campanha = {
  terapeuta_id: string;
  status: string;
  intencao: string;
  filtro: unknown;
  ab_variantes: unknown;
  paciente_ids: unknown;
};
type Destinatario = { telefone: string | null; ativo: boolean | null; nome: string | null; vinculo_encerrado_em: string | null };
type Texto = { texto: string } | { texto: null; motivo: string; conteudo: string };

const DESCRICAO_DO_ERRO: Record<string, string> = {
  vazio: "texto vazio",
  modelo_longo: "texto acima de 1000 caracteres",
  chave_desconhecida: "variável desconhecida (só {nome} vale)",
  chave_solta: "chave { ou } solta",
};

// Só a marca explícita libera o texto do profissional como reserva. Sem marca é campanha antiga: briefing.
function modoDaCampanha(filtro: unknown): ModoCampanha {
  const marca = (filtro as { personalizar_ia?: unknown } | null)?.personalizar_ia;
  if (marca === false) return "texto_fixo";
  if (marca === true) return "ia_com_reserva";
  return "briefing";
}

function lerVariantes(bc: Campanha): Variante[] {
  const lista: unknown[] = Array.isArray(bc.ab_variantes) ? bc.ab_variantes : [];
  if (lista.length === 0) return [{ key: "A", texto: String(bc.intencao ?? ""), peso: 100 }];
  return lista.map((item, i) => {
    const v = (item ?? {}) as { key?: unknown; texto?: unknown; peso?: unknown };
    return {
      key: String(v.key ?? `V${i + 1}`),
      texto: typeof v.texto === "string" ? v.texto : "",
      peso: Number(v.peso) || 0,
    };
  });
}

// Devolve o que há de errado nas variantes, ou null se todas servem.
function detalheDeVarianteInvalida(variantes: Variante[]): string | null {
  const problemas: string[] = [];
  for (const v of variantes) {
    const { ok, erros } = validarModelo("broadcast", v.texto);
    if (!ok) problemas.push(`Variante ${v.key}: ${erros.map((e) => DESCRICAO_DO_ERRO[e] ?? e).join(", ")}`);
  }
  if (problemas.length === 0) return null;
  return problemas.join("; ");
}

// Devolve null em qualquer falha (sem chave, resposta ruim, exceção, timeout): quem chama decide o que fazer.
async function reescreverComIA(pedido: { system: string; user: string }): Promise<string | null> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_IA_MS);
  try {
    const r = await fetch(URL_GEMINI, {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELO_IA,
        messages: [
          { role: "system", content: pedido.system },
          { role: "user", content: pedido.user },
        ],
      }),
    });
    if (!r.ok) return null;
    const j: { choices?: { message?: { content?: unknown } }[]; usage?: unknown } = await r.json();
    // O custo existe mesmo que o envio falhe depois, por isso a medição vem antes de qualquer decisão.
    await logUsoIA("agente-broadcast", MODELO_IA, j.usage);
    const texto = j.choices?.[0]?.message?.content;
    if (typeof texto !== "string") return null;
    return texto.trim();
  } catch (e) {
    console.warn("[agente-broadcast] IA indisponível:", e instanceof Error ? e.message : String(e));
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Texto final para um cliente. texto nulo = NÃO ENVIAR; conteudo é o que fica gravado na linha de erro.
async function decidirTexto(modo: ModoCampanha, tom: Tom, modelo: string, nome: string | null): Promise<Texto> {
  const base = renderizarModelo("broadcast", modelo, { nome });
  if (base.texto === null) return { texto: null, motivo: base.motivo, conteudo: modelo };
  if (modo === "texto_fixo") return { texto: base.texto };

  const reescrito = await reescreverComIA(montarPedidoIABroadcast({ tom, nome, texto: base.texto }));
  if (reescrito !== null) {
    const veredito = validarSaidaIA(base.texto, reescrito);
    if (veredito.ok) return { texto: reescrito };
    console.warn(`[agente-broadcast] saída da IA reprovada (${veredito.motivo}); a IA não vale para este cliente`);
  }
  if (modo === "ia_com_reserva") return { texto: base.texto };
  return { texto: null, motivo: "ia_indisponivel", conteudo: base.texto };
}

async function lerTom(admin: AdminClient, terapeuta_id: string): Promise<Tom> {
  try {
    const { data } = await admin.from("whatsapp_automacoes")
      .select("tom_voz").eq("terapeuta_id", terapeuta_id).maybeSingle();
    return normalizarTom((data as { tom_voz?: unknown } | null)?.tom_voz);
  } catch (e) {
    console.warn("[agente-broadcast] não leu o tom da clínica; usa o amigável:", e instanceof Error ? e.message : String(e));
    return normalizarTom(null);
  }
}

async function gravarDisparo(admin: AdminClient, d: {
  terapeuta_id: string; paciente_id: string; broadcast_id: string; conteudo: string; status: "enviado" | "erro"; erro?: string;
}) {
  const { error } = await admin.from("agente_disparos").insert({
    terapeuta_id: d.terapeuta_id, paciente_id: d.paciente_id, gatilho: "broadcast",
    ref_id: d.broadcast_id, conteudo: d.conteudo, status: d.status, erro: d.erro,
  });
  if (error) console.error(`[agente-broadcast] não gravou o disparo do paciente ${d.paciente_id}:`, error.message);
}

async function executarCampanha(admin: AdminClient, broadcast_id: string, bc: Campanha, a: {
  modo: ModoCampanha; variantes: Variante[]; pacienteIds: string[]; agendada: boolean; pausado: () => Promise<boolean>;
}) {
  const { modo, variantes, pacienteIds, agendada, pausado } = a;
  const pesoTotal = variantes.reduce((s, v) => s + (v.peso || 0), 0) || 100;
  const pickVariante = () => {
    let r = Math.random() * pesoTotal;
    for (const v of variantes) { r -= (v.peso || 0); if (r <= 0) return v; }
    return variantes[0];
  };
  const stats: Record<string, { enviados: number; erros: number }> = {};
  variantes.forEach((v) => { stats[v.key] = { enviados: 0, erros: 0 }; });

  // Uma leitura por rodada, e só quando a IA entra: o texto fixo não precisa do tom.
  let tom = normalizarTom(null);
  if (modo !== "texto_fixo") tom = await lerTom(admin, bc.terapeuta_id);

  let enviados = 0, erros = 0;
  let interrompida = false;
  for (const paciente_id of pacienteIds) {
    // Pausou no meio da campanha agendada: para aqui (não reenvia depois).
    if (agendada && await pausado()) { interrompida = true; break; }
    try {
      // Só cliente deste profissional, ativo e com vínculo vivo recebe: id de outro profissional ou de quem
      // excluiu a conta não devolve linha ou é pulado.
      const { data, error: erroLeitura } = await admin.from("pacientes")
        .select("telefone, ativo, nome, vinculo_encerrado_em")
        .eq("id", paciente_id).eq("terapeuta_id", bc.terapeuta_id).maybeSingle();
      if (erroLeitura) console.error(`[agente-broadcast] não leu o paciente ${paciente_id}:`, erroLeitura.message);
      const pac = data as Destinatario | null;
      if (!pac?.telefone || pac.ativo === false || pac.vinculo_encerrado_em) { erros++; continue; }

      const variante = pickVariante();
      const decisao = await decidirTexto(modo, tom, variante.texto, pac.nome);
      if (decisao.texto === null) {
        erros++; stats[variante.key].erros++;
        console.warn(`[agente-broadcast] sem envio (${decisao.motivo}) para o paciente ${paciente_id}`);
        await gravarDisparo(admin, { terapeuta_id: bc.terapeuta_id, paciente_id, broadcast_id, conteudo: decisao.conteudo, status: "erro", erro: decisao.motivo });
        continue;
      }
      const msg = decisao.texto;
      // Campanha composta e disparada pelo próprio profissional — conta
      // como envio intencional, não é pausada pelo modo férias
      const ok = await enviarWhatsapp(admin, bc.terapeuta_id, pac.telefone, msg, { manual: true });
      await gravarDisparo(admin, { terapeuta_id: bc.terapeuta_id, paciente_id, broadcast_id, conteudo: msg, status: ok ? "enviado" : "erro" });
      // Registra no chat (cria a conversa se preciso) para o paciente
      // aparecer no Zap com o histórico da campanha.
      if (ok) {
        try {
          await registrarMensagemSaida(admin, {
            terapeuta_id: bc.terapeuta_id, paciente_id,
            telefone: pac.telefone, conteudo: msg, origem: "broadcast",
          });
        } catch (e) {
          // A mensagem já saiu: falhar o registro na conversa não pode contá-la como erro.
          console.error(`[agente-broadcast] não registrou a mensagem na conversa do paciente ${paciente_id}:`, e instanceof Error ? e.message : String(e));
        }
      }
      if (ok) { enviados++; stats[variante.key].enviados++; }
      else { erros++; stats[variante.key].erros++; }
      await admin.from("agente_broadcasts").update({
        enviados, erros, resultado_variantes: stats,
      }).eq("id", broadcast_id);
      await new Promise((r) => setTimeout(r, PAUSA_ENTRE_ENVIOS_MS));
    } catch (e) {
      console.error(`[agente-broadcast] falha com o paciente ${paciente_id}:`, e instanceof Error ? e.message : String(e));
      erros++;
    }
  }
  const { error } = await admin.from("agente_broadcasts").update({
    status: interrompida ? "interrompido" : "concluido", concluido_em: new Date().toISOString(),
    enviados, erros, resultado_variantes: stats,
  }).eq("id", broadcast_id);
  if (error) console.error(`[agente-broadcast] não fechou a campanha ${broadcast_id}:`, error.message);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Aceita chamadas internas (cron/scheduler) ou de terapeuta autenticado
  let callerTerapeutaId: string | null = null;
  if (!isInternalCall(req)) {
    try {
      const { userId } = await requireUser(req);
      callerTerapeutaId = userId;
    } catch {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: jsonHeaders });
    }
  }

  try {
    const { broadcast_id } = await req.json();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: achada } = await admin.from("agente_broadcasts")
      .select("*").eq("id", broadcast_id).maybeSingle();
    const bc = achada as Campanha | null;
    if (!bc) throw new Error("broadcast não encontrado");

    // Garante que o terapeuta autenticado é dono do broadcast
    if (callerTerapeutaId && bc.terapeuta_id !== callerTerapeutaId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: jsonHeaders });
    }
    if (STATUS_JA_PROCESSADA.includes(bc.status)) {
      return new Response(JSON.stringify({ ok: false, error: JA_PROCESSADA }), { headers: corsHeaders });
    }

    // Campanha AGENDADA (disparada pelo cron) respeita "Pausar automações":
    // fica agendada e sai quando o profissional retomar. O envio imediato
    // (clicado pelo profissional) continua sendo intencional.
    const agendada = !callerTerapeutaId;
    const pausado = async () => {
      const { data } = await admin.from("whatsapp_automacoes")
        .select("automacoes_pausadas").eq("terapeuta_id", bc.terapeuta_id).maybeSingle();
      return (data as { automacoes_pausadas?: boolean } | null)?.automacoes_pausadas === true;
    };
    if (agendada && await pausado()) {
      return new Response(JSON.stringify({ ok: true, skip: "automações pausadas" }), { headers: corsHeaders });
    }

    // Variantes A/B: [{ key:'A', texto:'...', peso: 50 }, ...]
    const variantes = lerVariantes(bc);
    const modo = modoDaCampanha(bc.filtro);

    // Texto fixo vai ao cliente exatamente como está escrito: variante com defeito recusa a campanha inteira, antes
    // da trava e de qualquer envio. O briefing antigo e a campanha com IA não passam por aqui.
    if (modo === "texto_fixo") {
      const detalhe = detalheDeVarianteInvalida(variantes);
      if (detalhe !== null) {
        console.warn(`[agente-broadcast] campanha ${broadcast_id} recusada: ${detalhe}`);
        const { error: erroRecusa } = await admin.from("agente_broadcasts")
          .update({ status: "recusado" })
          .eq("id", broadcast_id).in("status", ["agendado", "rascunho"]);
        if (erroRecusa) console.error(`[agente-broadcast] não marcou a campanha ${broadcast_id} como recusada:`, erroRecusa.message);
        return new Response(JSON.stringify({ error: "variante_invalida", detalhe }), { status: 422, headers: jsonHeaders });
      }
    }

    const pacienteIds = [...new Set(Array.isArray(bc.paciente_ids) ? (bc.paciente_ids as string[]) : [])];

    // Trava atômica: duas chamadas simultâneas (cron + clique) não disparam
    // a campanha duas vezes — só quem mudar o status segue.
    const { data: travado, error: erroTrava } = await admin.from("agente_broadcasts").update({
      status: "executando", iniciado_em: new Date().toISOString(),
      total: pacienteIds.length,
    }).eq("id", broadcast_id).not("status", "in", `(${STATUS_JA_PROCESSADA.join(",")})`).select("id");
    if (erroTrava) console.error(`[agente-broadcast] não travou a campanha ${broadcast_id}:`, erroTrava.message);
    if (!travado?.length) {
      return new Response(JSON.stringify({ ok: false, error: JA_PROCESSADA }), { headers: corsHeaders });
    }

    // @ts-expect-error -- EdgeRuntime disponível em Supabase Edge Functions
    EdgeRuntime.waitUntil(executarCampanha(admin, broadcast_id, bc, { modo, variantes, pacienteIds, agendada, pausado })
      .catch((e) => console.error("agente-broadcast background error:", e)));

    return new Response(JSON.stringify({ ok: true, total: pacienteIds.length }), { headers: jsonHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: jsonHeaders,
    });
  }
});
