// Pedido semanal do check-in de bem-estar pelo Zap (cron: domingo, 18h30 às 20h50 de Brasília, a cada 10 min).
// Para cada profissional com o gatilho "checkin_semanal" LIGADO (desligado por padrão), pede 6 números
// (7 para quem treinou nas últimas 3 semanas) a até 5 clientes por rodada, com pausa entre os envios.
// A resposta é lida no whatsapp-webhook; o pedido fica em checkin_pedidos (vale por 48 h).
// Cada cliente é RESERVADO (insert em checkin_pedidos, único por paciente+semana) antes do envio: se a execução
// cair no meio, ou duas rodadas se sobrepuserem, ninguém recebe duas vezes. Envio que falha devolve a reserva.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireInternal } from "../_shared/auth.ts";
import { enviarWhatsapp } from "../_shared/enviar-whatsapp.ts";
import { registrarMensagemSaida } from "../_shared/registrar-saida.ts";
import { inicioDaSemanaBR, montarPedidoCheckin } from "../_shared/checkin-semanal.ts";
import {
  chaveDoTelefone,
  chavesDeTelefoneCompartilhado,
  cortarLote,
  contarPuladosPorTelefoneCompartilhado,
  dentroDaJanelaDeEnvio,
  deveInterromperLote,
  ehConflitoDeReserva,
  emBlocos,
  expiraEmDoPedido,
  filtrarElegiveis,
  inicioDaJanelaDeTreino,
  instanteDoInicioDaSemana,
  linkMyIDSeFaltar,
  pausaEntreEnvios,
  telefoneParaEnvio,
  type CandidatoCheckin,
} from "../_shared/checkin-whatsapp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TAMANHO_PAGINA = 1000;
const TAMANHO_BLOCO_IDS = 100;

type Admin = ReturnType<typeof createClient>;

interface Cliente extends CandidatoCheckin {
  id: string;
  nome: string | null;
  portal_token: string | null;
}

interface ConfigAutomacao {
  terapeuta_id: string;
  gatilhos_ativos: Record<string, unknown> | null;
  automacoes_pausadas: boolean | null;
}

interface Contagens {
  candidatos: number;
  elegiveis: number;
  enviados: number;
  falhas: number;
  adiados: number;
  pausados: number;
  com_erro_de_consulta: number;
  pulados_telefone_compartilhado: number;
  ja_reservados: number;
  erros_de_reserva: number;
}

const zerar = (): Contagens => ({
  candidatos: 0, elegiveis: 0, enviados: 0, falhas: 0, adiados: 0, pausados: 0, com_erro_de_consulta: 0,
  pulados_telefone_compartilhado: 0, ja_reservados: 0, erros_de_reserva: 0,
});

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function lerCorpo(req: Request): Promise<{ forcar?: boolean }> {
  try {
    const corpo = await req.json();
    return corpo && typeof corpo === "object" ? corpo : {};
  } catch {
    return {}; // o cron manda '{}'; corpo vazio ou inválido significa "sem opções"
  }
}

// Traz TODAS as fichas ativas com telefone, inclusive as de conta excluída (vinculo_encerrado_em): a elegibilidade
// as tira do envio, mas elas contam para saber se o número é compartilhado.
async function listarClientesAtivos(admin: Admin, terapeuta_id: string) {
  const todos: {
    id: string; nome: string | null; telefone: string | null; portal_token: string | null; vinculo_encerrado_em: string | null;
  }[] = [];
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const { data, error } = await admin
      .from("pacientes")
      .select("id, nome, telefone, portal_token, vinculo_encerrado_em")
      .eq("terapeuta_id", terapeuta_id)
      .eq("ativo", true)
      .not("telefone", "is", null)
      .order("id")
      .range(de, de + TAMANHO_PAGINA - 1);
    if (error) throw new Error(`pacientes: ${error.message}`);
    todos.push(...((data as typeof todos | null) || []));
    if (!data || data.length < TAMANHO_PAGINA) break;
  }
  return todos;
}

// Falha de consulta aborta o profissional: sem saber quem já recebeu, reenviaria a cada rodada.
async function consultarEmBlocos(
  rotulo: string,
  ids: string[],
  consulta: (bloco: string[]) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
) {
  const linhas: Record<string, unknown>[] = [];
  for (const bloco of emBlocos(ids, TAMANHO_BLOCO_IDS)) {
    const { data, error } = await consulta(bloco);
    if (error) throw new Error(`${rotulo}: ${error.message}`);
    linhas.push(...((data as Record<string, unknown>[] | null) || []));
  }
  return linhas;
}

async function carregarClientes(admin: Admin, terapeuta_id: string, semana: string): Promise<Cliente[]> {
  const pacs = await listarClientesAtivos(admin, terapeuta_id);
  const ids = pacs.map((p) => p.id);
  if (ids.length === 0) return [];

  const [pedidos, respostas, prefs, disparos] = await Promise.all([
    consultarEmBlocos("checkin_pedidos", ids, (b) =>
      admin.from("checkin_pedidos").select("paciente_id").eq("semana", semana).in("paciente_id", b)),
    consultarEmBlocos("checkins_semanais", ids, (b) =>
      admin.from("checkins_semanais").select("paciente_id").eq("semana", semana).in("paciente_id", b)),
    consultarEmBlocos("checkin_preferencias", ids, (b) =>
      admin.from("checkin_preferencias").select("paciente_id, whatsapp_ativo").in("paciente_id", b)),
    consultarEmBlocos("agente_disparos", ids, (b) =>
      admin.from("agente_disparos").select("paciente_id, status")
        .eq("terapeuta_id", terapeuta_id).eq("gatilho", "checkin_semanal")
        .gte("created_at", instanteDoInicioDaSemana(semana)).in("paciente_id", b)),
  ]);

  const comPedido = new Set(pedidos.map((l) => l.paciente_id as string));
  const comResposta = new Set(respostas.map((l) => l.paciente_id as string));
  const preferencia = new Map(prefs.map((l) => [l.paciente_id as string, l.whatsapp_ativo as boolean]));
  // Envio registrado sem pedido (a gravação do pedido falhou) também vale como "já pediu".
  const jaEnviado = new Set(disparos.filter((l) => l.status === "enviado").map((l) => l.paciente_id as string));
  const erros = new Map<string, number>();
  for (const l of disparos) {
    if (l.status !== "erro") continue;
    const id = l.paciente_id as string;
    erros.set(id, (erros.get(id) || 0) + 1);
  }

  const compartilhados = chavesDeTelefoneCompartilhado(pacs);

  return pacs.map((p) => ({
    id: p.id,
    nome: p.nome,
    portal_token: p.portal_token,
    telefone: p.telefone,
    ativo: true,
    vinculoEncerradoEm: p.vinculo_encerrado_em,
    telefoneCompartilhado: compartilhados.has(chaveDoTelefone(p.telefone)),
    whatsappAtivo: preferencia.has(p.id) ? preferencia.get(p.id)! : null,
    pedidoNaSemana: comPedido.has(p.id) || jaEnviado.has(p.id),
    respondeuNaSemana: comResposta.has(p.id),
    errosNaSemana: erros.get(p.id) || 0,
  }));
}

// Contexto do lote (quem treina e quem já concluiu o MyID): se a consulta falhar, o texto fica
// no padrão (sem a 7ª pergunta, com o link do MyID), nunca impede o envio.
async function idsDe(
  rotulo: string,
  ids: string[],
  consulta: (bloco: string[]) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<Set<string>> {
  try {
    const linhas = await consultarEmBlocos(rotulo, ids, consulta);
    return new Set(linhas.map((l) => l.paciente_id as string));
  } catch (e) {
    console.warn(`[zap-checkin-semanal] ${rotulo} indisponível, seguindo com o texto padrão:`, e);
    return new Set();
  }
}

// Reserva ANTES de enviar: checkin_pedidos é único por paciente+semana, então só uma execução fica com o cliente.
// "conflito" = outra execução já reservou; "erro" = não deu para reservar (o cliente fica para a próxima rodada).
async function reservarCliente(admin: Admin, paciente_id: string, semana: string): Promise<"reservado" | "conflito" | "erro"> {
  try {
    const { error } = await admin.from("checkin_pedidos").insert({
      paciente_id, semana, expira_em: expiraEmDoPedido(new Date()),
    });
    if (!error) return "reservado";
    if (ehConflitoDeReserva(error)) return "conflito";
    console.warn(`[zap-checkin-semanal] reserva não gravada (paciente ${paciente_id}):`, error.message);
  } catch (e) {
    console.warn(`[zap-checkin-semanal] reserva falhou (paciente ${paciente_id}):`, e);
  }
  return "erro";
}

// Envio que falhou: a reserva sai para o cliente ser tentado de novo na rodada seguinte (limitado por MAX_ERROS_POR_SEMANA).
async function liberarReserva(admin: Admin, paciente_id: string, semana: string) {
  try {
    const { error } = await admin.from("checkin_pedidos").delete()
      .eq("paciente_id", paciente_id).eq("semana", semana).is("respondido_em", null);
    if (error) console.warn(`[zap-checkin-semanal] reserva não removida, o cliente não será tentado de novo nesta semana (paciente ${paciente_id}):`, error.message);
  } catch (e) {
    console.warn(`[zap-checkin-semanal] reserva não removida, o cliente não será tentado de novo nesta semana (paciente ${paciente_id}):`, e);
  }
}

async function processarProfissional(
  admin: Admin, terapeuta_id: string, semana: string, agora: Date, pausado: boolean,
): Promise<Contagens> {
  const c = zerar();
  if (pausado) {
    c.pausados = 1;
    return c;
  }

  let clientes: Cliente[];
  try {
    clientes = await carregarClientes(admin, terapeuta_id, semana);
  } catch (e) {
    console.warn(`[zap-checkin-semanal] profissional ${terapeuta_id}: consulta falhou, ninguém recebe nesta rodada:`, e);
    c.com_erro_de_consulta = 1;
    return c;
  }

  const elegiveis = filtrarElegiveis(clientes);
  const lote = cortarLote(elegiveis);
  c.candidatos = clientes.length;
  c.elegiveis = elegiveis.length;
  c.adiados = elegiveis.length - lote.length;
  c.pulados_telefone_compartilhado = contarPuladosPorTelefoneCompartilhado(clientes);
  if (lote.length === 0) return c;

  const idsLote = lote.map((p) => p.id);
  const [treinaram, concluiram] = await Promise.all([
    idsDe("studio_execucoes", idsLote, (b) =>
      admin.from("studio_execucoes").select("paciente_id")
        .gte("data_execucao", inicioDaJanelaDeTreino(agora)).in("paciente_id", b)),
    idsDe("myid_avaliacoes", idsLote, (b) =>
      admin.from("myid_avaliacoes").select("paciente_id").eq("status", "concluido").in("paciente_id", b)),
  ]);

  let falhasSeguidas = 0;
  let tentouEnviar = false;
  for (let i = 0; i < lote.length; i++) {
    if (deveInterromperLote(falhasSeguidas)) {
      c.adiados += lote.length - i;
      break;
    }
    const pac = lote[i];

    // A pausa vem antes da reserva para a janela entre reservar e enviar ser a menor possível.
    if (tentouEnviar) await dormir(pausaEntreEnvios());

    const reserva = await reservarCliente(admin, pac.id, semana);
    if (reserva !== "reservado") {
      if (reserva === "conflito") c.ja_reservados++;
      else c.erros_de_reserva++;
      continue;
    }
    tentouEnviar = true;

    const msg = montarPedidoCheckin({
      nome: pac.nome,
      comPsr: treinaram.has(pac.id),
      linkMyID: linkMyIDSeFaltar(concluiram.has(pac.id), pac.portal_token),
    });

    let ok = false;
    try {
      ok = await enviarWhatsapp(admin, terapeuta_id, telefoneParaEnvio(pac.telefone), msg);
    } catch (e) {
      console.warn(`[zap-checkin-semanal] envio falhou (paciente ${pac.id}):`, e);
    }

    if (ok) {
      falhasSeguidas = 0;
      c.enviados++;
      try {
        await registrarMensagemSaida(admin, {
          terapeuta_id, paciente_id: pac.id, telefone: pac.telefone || "",
          conteudo: msg, origem: "checkin_semanal", bot: true,
        });
      } catch (e) {
        console.warn(`[zap-checkin-semanal] mensagem não registrada na conversa (paciente ${pac.id}):`, e);
      }
    } else {
      falhasSeguidas++;
      c.falhas++;
      await liberarReserva(admin, pac.id, semana);
    }

    const { error: erroDisparo } = await admin.from("agente_disparos").insert({
      terapeuta_id, paciente_id: pac.id, gatilho: "checkin_semanal",
      ref_id: null, conteudo: msg, status: ok ? "enviado" : "erro",
    });
    if (erroDisparo) console.warn(`[zap-checkin-semanal] disparo não registrado (paciente ${pac.id}):`, erroDisparo.message);
  }
  return c;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try { requireInternal(req); } catch (r) { return r as Response; }
  try {
    const { forcar } = await lerCorpo(req);
    const agora = new Date();
    if (!dentroDaJanelaDeEnvio(agora, { forcar: forcar === true })) {
      return json({ ok: true, fora_da_janela: true });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const semana = inicioDaSemanaBR(agora);

    const { data: cfgs, error: erroCfg } = await admin
      .from("whatsapp_automacoes")
      .select("terapeuta_id, gatilhos_ativos, automacoes_pausadas")
      .not("gatilhos_ativos", "is", null);
    if (erroCfg) throw new Error(`whatsapp_automacoes: ${erroCfg.message}`);

    const ligados = ((cfgs as ConfigAutomacao[] | null) || []).filter(
      (cfg) => cfg.gatilhos_ativos?.checkin_semanal === true,
    );

    // Cada profissional usa o próprio número: ficam em paralelo; dentro de cada um, o envio é em fila com pausa.
    const parciais = await Promise.all(ligados.map((cfg) =>
      processarProfissional(admin, cfg.terapeuta_id, semana, agora, cfg.automacoes_pausadas === true)));

    const total = parciais.reduce((s, p) => ({
      candidatos: s.candidatos + p.candidatos,
      elegiveis: s.elegiveis + p.elegiveis,
      enviados: s.enviados + p.enviados,
      falhas: s.falhas + p.falhas,
      adiados: s.adiados + p.adiados,
      pausados: s.pausados + p.pausados,
      com_erro_de_consulta: s.com_erro_de_consulta + p.com_erro_de_consulta,
      pulados_telefone_compartilhado: s.pulados_telefone_compartilhado + p.pulados_telefone_compartilhado,
      ja_reservados: s.ja_reservados + p.ja_reservados,
      erros_de_reserva: s.erros_de_reserva + p.erros_de_reserva,
    }), zerar());

    return json({ ok: true, semana, profissionais: ligados.length, ...total });
  } catch (e) {
    console.error("[zap-checkin-semanal] erro:", e);
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
