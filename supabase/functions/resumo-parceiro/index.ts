// Página pública de PARCEIRO (read-only, sem login). Recebe um token; se ele
// existir e estiver ativo, devolve APENAS agregados de negócio — faturamento
// (MRR), nº de clínicas/profissionais/alunos ativos e receita de vendas do
// período. NUNCA retorna nome, e-mail, telefone ou qualquer dado de paciente.
// verify_jwt=false (público), mas o acesso é controlado pelo token na tabela
// parceiro_links (revogável a qualquer momento pelo super-admin).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get("token") || "";
    if (!token) { try { const b = await req.json(); token = String(b?.token || ""); } catch { /* sem corpo */ } }
    token = token.trim();
    if (!token) return json({ error: "Link inválido." }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: link } = await admin.from("parceiro_links")
      .select("label, ativo").eq("token", token).maybeSingle();
    if (!link || !link.ativo) return json({ error: "Link inválido ou revogado." }, 404);

    const umAnoAtras = new Date(Date.now() - 365 * 24 * 3600_000).toISOString();
    const [assinRes, planosRes, wellnessRes, clinicasRes, vendasRes] = await Promise.all([
      admin.from("assinaturas").select("plano_id, status"),
      admin.from("planos").select("id, preco_mensal"),
      admin.from("wellness_assinaturas").select("status, valor_mensal"),
      admin.from("clinicas").select("ativa"),
      admin.from("vendas").select("valor_total, status, data_venda").gte("data_venda", umAnoAtras),
    ]);

    const precoById: Record<string, number> = {};
    (planosRes.data || []).forEach((p: any) => { precoById[p.id] = Number(p.preco_mensal || 0); });
    const ativas = (assinRes.data || []).filter((a: any) => a.status === "ativa");
    const mrrProf = ativas.reduce((s: number, a: any) => s + (precoById[a.plano_id] || 0), 0);
    const alunosAtivos = (wellnessRes.data || []).filter((w: any) => w.status === "ativa");
    const mrrAlunos = alunosAtivos.reduce((s: number, w: any) => s + Number(w.valor_mensal || 0), 0);
    const clinicasAtivas = (clinicasRes.data || []).filter((c: any) => c.ativa).length;
    const STATUS_PAGO = new Set(["pago", "concluido", "concluída", "concluida", "quitado"]);
    const receita12m = (vendasRes.data || [])
      .filter((v: any) => STATUS_PAGO.has(String(v.status || "").toLowerCase()))
      .reduce((s: number, v: any) => s + Number(v.valor_total || 0), 0);

    return json({
      ok: true,
      label: link.label,
      gerado_em: new Date().toISOString(),
      negocio: {
        mrr_total: Math.round((mrrProf + mrrAlunos) * 100) / 100,
        mrr_profissionais: Math.round(mrrProf * 100) / 100,
        mrr_alunos: Math.round(mrrAlunos * 100) / 100,
        clinicas_ativas: clinicasAtivas,
        profissionais_ativos: ativas.length,
        alunos_ativos: alunosAtivos.length,
        receita_vendas_12m: Math.round(receita12m * 100) / 100,
      },
    });
  } catch (e) {
    return json({ error: (e as Error)?.message || "Falha ao carregar resumo." }, 500);
  }
});
