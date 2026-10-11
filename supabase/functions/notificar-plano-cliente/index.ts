// Avisa o cliente (WhatsApp) que a equipe científica chancelou ou recusou o plano dele.
//
// Chamada pela fila de chancela DEPOIS de chancelar/recusar: body { plano_id }. O chamador precisa
// ser da equipe científica (conferido pelo banco com o JWT dele). A mensagem é curta e sem conteúdo
// clínico, vai só para cliente cadastrado e ativo e segue as regras das mensagens automáticas: pausa
// geral das automações (enviarWhatsapp) e registro na conversa do Zap. Best-effort: nenhum desfecho
// aqui desfaz a decisão da equipe, e sem WhatsApp configurado o aviso simplesmente não sai (o portal
// continua mostrando o status).
//
// Segurança: o aviso sai SEMPRE pela conta da marca (plano_cliente_remetente_aviso), nunca pelo profissional
// do cadastro do cliente (o cliente edita terapeuta_id, telefone e nome do próprio cadastro). Só o revisor que
// decidiu o plano, ou o administrador, pede o aviso. A linha de agente_disparos é reservada ANTES do envio (índice
// único parcial), então chamadas paralelas não duplicam a mensagem.
//
// Resposta: { ok, enviado, motivo? }. A lógica de decisão está em _shared/aviso-plano-cliente.ts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireUser } from "../_shared/auth.ts";
import { enviarWhatsapp } from "../_shared/enviar-whatsapp.ts";
import { registrarMensagemSaida } from "../_shared/registrar-saida.ts";
import {
  chamadorPodeAvisar, decidirAviso, GATILHO_AVISO, ORIGEM_AVISO, type StatusAvisavel,
} from "../_shared/aviso-plano-cliente.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let token = "";
  let userId = "";
  try { ({ token, userId } = await requireUser(req)); } catch (r) { return r as Response; }

  try {
    const body = await req.json().catch(() => ({}));
    const planoId = typeof body?.plano_id === "string" ? body.plano_id.trim() : "";
    if (!UUID.test(planoId)) return json({ ok: false, enviado: false, motivo: "plano_id_invalido" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    // Quem chama é conferido pelo banco, com o JWT dele, e não pelo corpo do pedido.
    const doUsuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: ehEquipe, error: erroEquipe } = await doUsuario.rpc("eh_equipe_cientifica");
    if (erroEquipe) return json({ ok: false, enviado: false, motivo: "verificacao_indisponivel" }, 503);
    if (ehEquipe !== true) return json({ ok: false, enviado: false, motivo: "sem_permissao" }, 403);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: plano, error: erroPlano } = await admin.from("plano_cliente_chancela")
      .select("id, paciente_id, tipo, status, revisado_em, revisor_id").eq("id", planoId).maybeSingle();
    if (erroPlano) return json({ ok: false, enviado: false, motivo: "verificacao_indisponivel" }, 503);
    if (!plano) return json({ ok: false, enviado: false, motivo: "plano_nao_encontrado" }, 404);

    let ehSuperAdmin = false;
    if (plano.revisor_id !== userId) {
      const { data: ehSuper, error: erroSuper } = await doUsuario.rpc("eh_super_admin");
      if (erroSuper) return json({ ok: false, enviado: false, motivo: "verificacao_indisponivel" }, 503);
      ehSuperAdmin = ehSuper === true;
    }
    if (!chamadorPodeAvisar({ chamadorId: userId, revisorId: plano.revisor_id, ehSuperAdmin })) {
      return json({ ok: false, enviado: false, motivo: "sem_permissao" }, 403);
    }

    const { data: paciente, error: erroPaciente } = plano.paciente_id
      ? await admin.from("pacientes").select("nome, telefone, ativo, user_id").eq("id", plano.paciente_id).maybeSingle()
      : { data: null, error: null };
    if (erroPaciente) return json({ ok: false, enviado: false, motivo: "verificacao_indisponivel" }, 503);

    let remetenteId: string | null = null;
    if (plano.paciente_id) {
      const { data, error } = await admin.rpc("plano_cliente_remetente_aviso", { p_paciente_id: plano.paciente_id });
      if (error) return json({ ok: false, enviado: false, motivo: "verificacao_indisponivel" }, 503);
      remetenteId = typeof data === "string" && data ? data : null;
    }

    let jaNotificado: boolean | "indisponivel" = false;
    if (plano.status === "chancelado" || plano.status === "recusado") {
      const { count, error } = await admin.from("agente_disparos")
        .select("id", { count: "exact", head: true })
        .eq("gatilho", GATILHO_AVISO[plano.status as StatusAvisavel]).eq("ref_id", plano.id).in("status", ["reservado", "enviado"]);
      jaNotificado = error ? "indisponivel" : (count ?? 0) > 0;
    }

    const decisao = decidirAviso({ plano, paciente, remetenteId, jaNotificado, agora: new Date() });
    if (!decisao.enviar) return json({ ok: true, enviado: false, motivo: decisao.motivo });

    // Reserva antes de enviar: o índice único parcial deixa só uma linha reservada/enviada por plano decidido.
    const { data: reserva, error: erroReserva } = await admin.from("agente_disparos").insert({
      terapeuta_id: decisao.remetenteId, paciente_id: plano.paciente_id, gatilho: decisao.gatilho, ref_id: plano.id,
      conteudo: decisao.mensagem, status: "reservado",
    }).select("id").single();
    if (erroReserva || !reserva) {
      if (erroReserva?.code === "23505") return json({ ok: true, enviado: false, motivo: "ja_notificado" });
      console.warn("[notificar-plano-cliente] falha ao reservar o disparo:", erroReserva?.message);
      return json({ ok: false, enviado: false, motivo: "verificacao_indisponivel" }, 503);
    }

    let enviado = false;
    try {
      enviado = await enviarWhatsapp(admin, decisao.remetenteId, decisao.telefone, decisao.mensagem);
    } catch (e) {
      console.warn("[notificar-plano-cliente] falha no envio:", (e as Error).message);
    }
    if (enviado) {
      try {
        await registrarMensagemSaida(admin, {
          terapeuta_id: decisao.remetenteId, paciente_id: plano.paciente_id, telefone: decisao.telefone,
          conteudo: decisao.mensagem, origem: ORIGEM_AVISO,
        });
      } catch (e) {
        console.warn("[notificar-plano-cliente] mensagem enviada, mas não registrada na conversa:", (e as Error).message);
      }
    }
    const { error: erroDisparo } = await admin.from("agente_disparos")
      .update({ status: enviado ? "enviado" : "erro", erro: enviado ? null : "nao_enviado" }).eq("id", reserva.id);
    if (erroDisparo) console.warn("[notificar-plano-cliente] falha ao fechar o disparo:", erroDisparo.message);

    return json(enviado ? { ok: true, enviado: true } : { ok: true, enviado: false, motivo: "whatsapp_nao_enviado" });
  } catch (e) {
    console.error("[notificar-plano-cliente] erro:", (e as Error).message);
    return json({ ok: false, enviado: false, motivo: "erro_interno" }, 500);
  }
});
