// Agente proativo — roda via cron a cada 15 min e dispara mensagens contextualizadas
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { montarContextoClinico } from "../_shared/agente-contexto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function gerarMensagem(systemPrompt: string, instrucao: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: instrucao },
      ],
    }),
  });
  if (!r.ok) return "";
  const j = await r.json();
  return j.choices?.[0]?.message?.content?.trim() || "";
}

async function enviarWhatsapp(admin: any, terapeuta_id: string, phone: string, message: string) {
  const { data: cfg } = await admin.from("config_clinica")
    .select("zapi_instance_id, zapi_token, zapi_client_token")
    .eq("terapeuta_id", terapeuta_id).maybeSingle();
  if (!cfg?.zapi_instance_id || !cfg?.zapi_token) return false;
  const url = `https://api.z-api.io/instances/${cfg.zapi_instance_id}/token/${cfg.zapi_token}/send-text`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.zapi_client_token) headers["Client-Token"] = cfg.zapi_client_token;
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify({ phone, message }) });
  return r.ok;
}

async function jaDisparado(admin: any, paciente_id: string, gatilho: string, ref_id: string | null, janela_horas = 24) {
  const since = new Date(Date.now() - janela_horas * 3600000).toISOString();
  const q = admin.from("agente_disparos")
    .select("id", { count: "exact", head: true })
    .eq("paciente_id", paciente_id)
    .eq("gatilho", gatilho)
    .gte("created_at", since);
  if (ref_id) q.eq("ref_id", ref_id);
  const { count } = await q;
  return (count || 0) > 0;
}

async function registrarDisparo(admin: any, terapeuta_id: string, paciente_id: string, gatilho: string, ref_id: string | null, conteudo: string, ok: boolean, erro?: string) {
  await admin.from("agente_disparos").insert({
    terapeuta_id, paciente_id, gatilho, ref_id, conteudo,
    status: ok ? "enviado" : "erro", erro,
  });
}

type DispatchCtx = {
  admin: any; terapeuta_id: string; paciente_id: string; telefone: string;
  systemPromptBase: string; cfg: any;
};

async function dispararConfirmacao24h(ctx: DispatchCtx, ag: any) {
  if (await jaDisparado(ctx.admin, ctx.paciente_id, "confirmacao_24h", ag.id, 48)) return;
  const instrucao = `Gere uma mensagem CURTA (2 linhas) pedindo confirmação da sessão amanhã às ${new Date(ag.data_inicio).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}. Peça para o paciente responder SIM para confirmar ou REAGENDAR para mudar.`;
  const msg = await gerarMensagem(ctx.systemPromptBase, instrucao);
  if (!msg) return;
  const ok = await enviarWhatsapp(ctx.admin, ctx.terapeuta_id, ctx.telefone, msg);
  await registrarDisparo(ctx.admin, ctx.terapeuta_id, ctx.paciente_id, "confirmacao_24h", ag.id, msg, ok);
}

async function dispararLembrete2h(ctx: DispatchCtx, ag: any) {
  if (await jaDisparado(ctx.admin, ctx.paciente_id, "lembrete_2h", ag.id, 6)) return;
  const instrucao = `Gere uma mensagem MUITO curta (1 linha) lembrando da sessão hoje às ${new Date(ag.data_inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}. Termine com "Te espero! 💙"`;
  const msg = await gerarMensagem(ctx.systemPromptBase, instrucao);
  if (!msg) return;
  const ok = await enviarWhatsapp(ctx.admin, ctx.terapeuta_id, ctx.telefone, msg);
  await registrarDisparo(ctx.admin, ctx.terapeuta_id, ctx.paciente_id, "lembrete_2h", ag.id, msg, ok);
}

async function dispararPosSessao(ctx: DispatchCtx, ag: any) {
  if (await jaDisparado(ctx.admin, ctx.paciente_id, "pos_sessao", ag.id, 72)) return;
  const instrucao = `Gere uma mensagem CURTA (3 linhas) perguntando como o paciente está se sentindo após a sessão de hoje. Use tom acolhedor. Peça nota de 0 a 10 para a sensação atual.`;
  const msg = await gerarMensagem(ctx.systemPromptBase, instrucao);
  if (!msg) return;
  const ok = await enviarWhatsapp(ctx.admin, ctx.terapeuta_id, ctx.telefone, msg);
  await registrarDisparo(ctx.admin, ctx.terapeuta_id, ctx.paciente_id, "pos_sessao", ag.id, msg, ok);
}

async function dispararExerciciosPendentes(ctx: DispatchCtx, ctxClinico: any) {
  if (await jaDisparado(ctx.admin, ctx.paciente_id, "exercicio_pendente", null, 72)) return;
  if (ctxClinico.exercicios_pendentes < 1) return;
  const dimensao = ctxClinico.myid?.dimensoes_criticas?.[0]?.nome || "seu plano";
  const instrucao = `O paciente tem ${ctxClinico.exercicios_pendentes} exercícios pendentes no portal, focados em ${dimensao}. Gere uma mensagem CURTA (3 linhas), motivacional, sem culpar, lembrando dos exercícios e do impacto deles na recuperação. Mencione a dimensão.`;
  const msg = await gerarMensagem(ctx.systemPromptBase, instrucao);
  if (!msg) return;
  const ok = await enviarWhatsapp(ctx.admin, ctx.terapeuta_id, ctx.telefone, msg);
  await registrarDisparo(ctx.admin, ctx.terapeuta_id, ctx.paciente_id, "exercicio_pendente", null, msg, ok);
}

async function dispararMyidVencido(ctx: DispatchCtx, ctxClinico: any) {
  if (await jaDisparado(ctx.admin, ctx.paciente_id, "myid_vencido", null, 30 * 24)) return;
  if (!ctxClinico.myid || (ctxClinico.myid.dias_desde || 0) < 30) return;
  const instrucao = `O MyID do paciente foi feito há ${ctxClinico.myid.dias_desde} dias. Gere mensagem CURTA convidando a refazer a avaliação para vermos a evolução. Tom positivo.`;
  const msg = await gerarMensagem(ctx.systemPromptBase, instrucao);
  if (!msg) return;
  const ok = await enviarWhatsapp(ctx.admin, ctx.terapeuta_id, ctx.telefone, msg);
  await registrarDisparo(ctx.admin, ctx.terapeuta_id, ctx.paciente_id, "myid_vencido", null, msg, ok);
}

async function dispararReengajamento(ctx: DispatchCtx, ctxClinico: any, dias: number) {
  const key = `reengajamento_${dias}d`;
  if (await jaDisparado(ctx.admin, ctx.paciente_id, key, null, 60 * 24)) return;
  const instrucao = `O paciente não tem sessão há ${dias} dias. Gere uma mensagem (3 linhas) gentil perguntando como está e oferecendo retomar o cuidado. NÃO seja insistente nem culpe. Tom de cuidado genuíno.`;
  const msg = await gerarMensagem(ctx.systemPromptBase, instrucao);
  if (!msg) return;
  const ok = await enviarWhatsapp(ctx.admin, ctx.terapeuta_id, ctx.telefone, msg);
  await registrarDisparo(ctx.admin, ctx.terapeuta_id, ctx.paciente_id, key, null, msg, ok);
}

async function dispararAniversario(ctx: DispatchCtx) {
  if (await jaDisparado(ctx.admin, ctx.paciente_id, "aniversario", null, 24 * 300)) return;
  const instrucao = `HOJE é aniversário do paciente. Gere mensagem CURTA, calorosa, com um voto sincero. Sem promoções.`;
  const msg = await gerarMensagem(ctx.systemPromptBase, instrucao);
  if (!msg) return;
  const ok = await enviarWhatsapp(ctx.admin, ctx.terapeuta_id, ctx.telefone, msg);
  await registrarDisparo(ctx.admin, ctx.terapeuta_id, ctx.paciente_id, "aniversario", null, msg, ok);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const stats = { confirmacao: 0, lembrete: 0, pos: 0, exerc: 0, myid: 0, reeng: 0, aniv: 0 };

  // Para cada terapeuta com automações + bot ativos
  const { data: configs } = await admin.from("whatsapp_automacoes")
    .select("*").eq("bot_ativo", true);

  for (const cfg of configs || []) {
    const gatilhos = (cfg.gatilhos_ativos as any) || {};
    const terapeuta_id = cfg.terapeuta_id;

    // 1) Confirmação 24h: sessões entre 22-26h à frente
    if (gatilhos.confirmacao_24h !== false) {
      const ini = new Date(Date.now() + 22 * 3600000);
      const fim = new Date(Date.now() + 26 * 3600000);
      const { data: ags } = await admin.from("agendamentos")
        .select("id, paciente_id, data_inicio, pacientes(telefone, nome, sobrenome)")
        .eq("terapeuta_id", terapeuta_id)
        .gte("data_inicio", ini.toISOString())
        .lte("data_inicio", fim.toISOString())
        .neq("status", "cancelado")
        .not("paciente_id", "is", null);
      for (const ag of ags || []) {
        const tel = (ag as any).pacientes?.telefone;
        if (!tel || !ag.paciente_id) continue;
        const ctxClinico = await montarContextoClinico(admin, terapeuta_id, ag.paciente_id, tel, null);
        const { buildSystemPrompt } = await import("../_shared/agente-contexto.ts");
        await dispararConfirmacao24h({
          admin, terapeuta_id, paciente_id: ag.paciente_id, telefone: tel,
          systemPromptBase: buildSystemPrompt(ctxClinico), cfg,
        }, ag);
        stats.confirmacao++;
      }
    }

    // 2) Lembrete 2h: sessões entre 1.5h-2.5h à frente
    if (gatilhos.lembrete_2h !== false) {
      const ini = new Date(Date.now() + 1.5 * 3600000);
      const fim = new Date(Date.now() + 2.5 * 3600000);
      const { data: ags } = await admin.from("agendamentos")
        .select("id, paciente_id, data_inicio, pacientes(telefone)")
        .eq("terapeuta_id", terapeuta_id)
        .gte("data_inicio", ini.toISOString())
        .lte("data_inicio", fim.toISOString())
        .neq("status", "cancelado")
        .not("paciente_id", "is", null);
      for (const ag of ags || []) {
        const tel = (ag as any).pacientes?.telefone;
        if (!tel || !ag.paciente_id) continue;
        const ctxClinico = await montarContextoClinico(admin, terapeuta_id, ag.paciente_id, tel, null);
        const { buildSystemPrompt } = await import("../_shared/agente-contexto.ts");
        await dispararLembrete2h({
          admin, terapeuta_id, paciente_id: ag.paciente_id, telefone: tel,
          systemPromptBase: buildSystemPrompt(ctxClinico), cfg,
        }, ag);
        stats.lembrete++;
      }
    }

    // 3) Pós-sessão: concluídas entre 1.5-2.5h atrás
    if (gatilhos.pos_sessao !== false) {
      const fim = new Date(Date.now() - 1.5 * 3600000);
      const ini = new Date(Date.now() - 2.5 * 3600000);
      const { data: ags } = await admin.from("agendamentos")
        .select("id, paciente_id, data_inicio, pacientes(telefone)")
        .eq("terapeuta_id", terapeuta_id)
        .eq("status", "concluido")
        .gte("data_inicio", ini.toISOString())
        .lte("data_inicio", fim.toISOString())
        .not("paciente_id", "is", null);
      for (const ag of ags || []) {
        const tel = (ag as any).pacientes?.telefone;
        if (!tel || !ag.paciente_id) continue;
        const ctxClinico = await montarContextoClinico(admin, terapeuta_id, ag.paciente_id, tel, null);
        const { buildSystemPrompt } = await import("../_shared/agente-contexto.ts");
        await dispararPosSessao({
          admin, terapeuta_id, paciente_id: ag.paciente_id, telefone: tel,
          systemPromptBase: buildSystemPrompt(ctxClinico), cfg,
        }, ag);
        stats.pos++;
      }
    }

    // 4-7) Por paciente ativo do terapeuta — só roda 1x por dia (na faixa 9-10h BRT)
    const horaUTC = new Date().getUTCHours();
    const horaBRT = (horaUTC - 3 + 24) % 24;
    if (horaBRT === 9) {
      const { data: pacs } = await admin.from("pacientes")
        .select("id, telefone, data_nascimento")
        .eq("terapeuta_id", terapeuta_id)
        .eq("ativo", true)
        .not("telefone", "is", null);

      for (const p of pacs || []) {
        if (!p.telefone) continue;
        const ctxClinico = await montarContextoClinico(admin, terapeuta_id, p.id, p.telefone, null);
        const { buildSystemPrompt } = await import("../_shared/agente-contexto.ts");
        const baseCtx = {
          admin, terapeuta_id, paciente_id: p.id, telefone: p.telefone,
          systemPromptBase: buildSystemPrompt(ctxClinico), cfg,
        };

        if (gatilhos.aniversario !== false && ctxClinico.paciente.aniversario_hoje) {
          await dispararAniversario(baseCtx); stats.aniv++;
        }
        if (gatilhos.exercicio_pendente !== false) {
          await dispararExerciciosPendentes(baseCtx, ctxClinico); stats.exerc++;
        }
        if (gatilhos.myid_vencido !== false) {
          await dispararMyidVencido(baseCtx, ctxClinico); stats.myid++;
        }
        if (gatilhos.reengajamento !== false && ctxClinico.ultima_sessao) {
          const d = ctxClinico.ultima_sessao.dias_desde;
          if ([14, 30, 60].includes(d)) {
            await dispararReengajamento(baseCtx, ctxClinico, d); stats.reeng++;
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, stats }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
