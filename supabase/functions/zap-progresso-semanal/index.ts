// Mensagem semanal de progresso no Zap (cron: domingo à noite).
// Para cada CLIENTE cadastrado e ativo que teve atividade na semana (XP/diário),
// envia um resumo gamificado: XP ganho, nível, quanto falta pro próximo.
// Liga a gamificação da Jornada ao WhatsApp — retenção.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireInternal } from "../_shared/auth.ts";
import { enviarWhatsapp } from "../_shared/enviar-whatsapp.ts";
import { registrarMensagemSaida } from "../_shared/registrar-saida.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mesma escala do banco (calcular_nivel_paciente) e das Recompensas.
function nivelInfo(xp: number): { nivel: string; proximo: string | null; faltam: number } {
  if (xp >= 2000) return { nivel: "Diamante 💎", proximo: null, faltam: 0 };
  if (xp >= 1000) return { nivel: "Platina", proximo: "Diamante 💎", faltam: 2000 - xp };
  if (xp >= 500) return { nivel: "Ouro 🥇", proximo: "Platina", faltam: 1000 - xp };
  if (xp >= 200) return { nivel: "Prata 🥈", proximo: "Ouro 🥇", faltam: 500 - xp };
  return { nivel: "Bronze 🥉", proximo: "Prata 🥈", faltam: 200 - xp };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try { requireInternal(req); } catch (r) { return r as Response; }
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const semanaAtras = new Date(Date.now() - 7 * 86400000).toISOString();
    let enviados = 0, pulados = 0;

    // Terapeutas com o gatilho ligado
    const { data: cfgs } = await admin
      .from("whatsapp_automacoes")
      .select("terapeuta_id, gatilhos_ativos")
      .not("gatilhos_ativos", "is", null);

    for (const cfg of cfgs || []) {
      if (!(cfg.gatilhos_ativos as Record<string, boolean> | null)?.progresso_semanal) continue;
      const terapeuta_id = cfg.terapeuta_id as string;

      // Clientes ativos com telefone
      const { data: pacs } = await admin
        .from("pacientes")
        .select("id, nome, telefone, xp_total")
        .eq("terapeuta_id", terapeuta_id)
        .eq("ativo", true)
        .not("telefone", "is", null);

      for (const pac of pacs || []) {
        // Dedupe: 1 mensagem por semana
        const { count: jaEnviado } = await admin
          .from("agente_disparos")
          .select("id", { count: "exact", head: true })
          .eq("paciente_id", pac.id)
          .eq("gatilho", "progresso_semanal")
          .gte("created_at", new Date(Date.now() - 6 * 86400000).toISOString());
        if ((jaEnviado || 0) > 0) { pulados++; continue; }

        // Atividade da semana: XP creditado + dias de diário
        const [{ data: xpEvts }, { count: diasDiario }] = await Promise.all([
          admin.from("xp_eventos").select("xp, chave")
            .eq("paciente_id", pac.id).gte("created_at", semanaAtras),
          admin.from("daily_logs").select("id", { count: "exact", head: true })
            .eq("paciente_id", pac.id).gte("created_at", semanaAtras),
        ]);
        const xpSemana = (xpEvts || []).reduce((s: number, e: any) => s + (e.xp || 0), 0);
        const missoes = (xpEvts || []).filter((e: any) => String(e.chave).startsWith("missao:")).length;

        // Só quem teve atividade — sem spam pra quem está parado
        if (xpSemana === 0 && (diasDiario || 0) === 0) { pulados++; continue; }

        const primeiro = (pac.nome || "").split(" ")[0] || "";
        const { nivel, proximo, faltam } = nivelInfo(pac.xp_total || 0);
        const linhas = [
          `Oi ${primeiro}! 🎯 Sua semana no My Health ID:`,
          (diasDiario || 0) > 0 ? `📔 ${diasDiario} dia${(diasDiario || 0) > 1 ? "s" : ""} de diário` : null,
          missoes > 0 ? `✅ ${missoes} missõ${missoes > 1 ? "es" : "o"} concluída${missoes > 1 ? "s" : ""}` : null,
          `⚡ +${xpSemana} XP ganhos (total: ${pac.xp_total || 0} XP · nível ${nivel})`,
          proximo ? `Faltam só ${faltam} XP para ${proximo} — dá pra buscar essa semana! 💪` : `Você está no topo — nível máximo! 👑`,
        ].filter(Boolean);
        const msg = linhas.join("\n");

        const ok = await enviarWhatsapp(admin, terapeuta_id, pac.telefone, msg);
        if (ok) {
          await registrarMensagemSaida(admin, {
            terapeuta_id, paciente_id: pac.id, telefone: pac.telefone,
            conteudo: msg, origem: "progresso_semanal",
          });
          enviados++;
        }
        await admin.from("agente_disparos").insert({
          terapeuta_id, paciente_id: pac.id, gatilho: "progresso_semanal",
          ref_id: null, conteudo: msg, status: ok ? "enviado" : "erro",
        });
      }
    }

    return new Response(JSON.stringify({ ok: true, enviados, pulados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[progresso-semanal] erro:", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
