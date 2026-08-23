// Painel administrativo (dono do app) — métricas de vendas e uso: clínicas,
// profissionais, assinaturas de profissionais e de alunos (wellness), MRR,
// evolução mensal, inadimplência, vendas e formas de pagamento. Também permite
// gerenciar os planos (preço/nome/ativo).
//
// Acesso: SOMENTE super-admin (por e-mail). Agrega com service role (as tabelas
// têm RLS por usuário; um painel global precisa ler todo mundo com segurança).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPER_ADMINS = ["rafaelbmocbel@gmail.com"];

function ymd(d: string | null): string | null {
  if (!d) return null;
  return d.slice(0, 7); // YYYY-MM
}

// Últimos 12 meses como rótulos YYYY-MM, do mais antigo ao atual.
function ultimos12Meses(agoraIso: string): string[] {
  const [y, m] = agoraIso.slice(0, 7).split("-").map(Number);
  const out: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const dt = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(dt.toISOString().slice(0, 7));
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── Auth: precisa ser super-admin (por e-mail) ──
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const authClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  const email = userData?.user?.email?.toLowerCase() || "";
  if (userErr || !email || !SUPER_ADMINS.includes(email)) {
    return new Response(JSON.stringify({ error: "Acesso restrito ao administrador." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action || "metrics";

    // ── Ação de escrita: atualizar um plano (preço/nome/ativo) ──
    if (action === "update_plano") {
      const { id, nome, preco_mensal, ativo } = body;
      if (!id) return new Response(JSON.stringify({ error: "id do plano ausente" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof nome === "string") patch.nome = nome;
      if (preco_mensal != null && !Number.isNaN(Number(preco_mensal))) patch.preco_mensal = Number(preco_mensal);
      if (typeof ativo === "boolean") patch.ativo = ativo;
      const { error } = await admin.from("planos").update(patch).eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Leitura: agrega tudo ──
    const nowIso = new Date().toISOString();
    const meses = ultimos12Meses(nowIso);
    const umAnoAtras = new Date(Date.now() - 365 * 24 * 3600_000).toISOString();

    const [
      clinicasRes, membrosRes, profilesRes, assinRes, planosRes, wellnessRes, vendasRes,
    ] = await Promise.all([
      admin.from("clinicas").select("id, nome, ativa, limite_profissionais, dono_user_id, created_at"),
      admin.from("clinica_membros").select("clinica_id, user_id"),
      admin.from("profiles").select("id, perfil_profissional, created_at"),
      admin.from("assinaturas").select("id, user_id, plano_id, status, origem, data_inicio, data_fim, created_at"),
      admin.from("planos").select("id, nome, descricao, preco_mensal, ativo, stripe_price_id, created_at").order("preco_mensal", { ascending: true }),
      admin.from("wellness_assinaturas").select("id, status, provider, valor_mensal, data_inicio, proxima_cobranca, created_at"),
      admin.from("vendas").select("valor_total, forma_pagamento, status, data_venda").gte("data_venda", umAnoAtras),
    ]);

    const clinicas = clinicasRes.data || [];
    const membros = membrosRes.data || [];
    const profiles = profilesRes.data || [];
    const assinaturas = assinRes.data || [];
    const planos = planosRes.data || [];
    const wellness = wellnessRes.data || [];
    const vendas = vendasRes.data || [];

    const planoById: Record<string, any> = {};
    planos.forEach((p: any) => { planoById[p.id] = p; });

    // ── Clínicas ──
    const membrosPorClinica: Record<string, number> = {};
    membros.forEach((m: any) => { membrosPorClinica[m.clinica_id] = (membrosPorClinica[m.clinica_id] || 0) + 1; });
    const clinicasResumo = {
      total: clinicas.length,
      ativas: clinicas.filter((c: any) => c.ativa).length,
      lista: clinicas
        .map((c: any) => ({ id: c.id, nome: c.nome, ativa: c.ativa, profissionais: membrosPorClinica[c.id] || 0, limite: c.limite_profissionais }))
        .sort((a, b) => b.profissionais - a.profissionais),
    };

    // ── Profissionais ──
    const porEspecialidade: Record<string, number> = {};
    profiles.forEach((p: any) => {
      const e = p.perfil_profissional || "fisioterapeuta";
      porEspecialidade[e] = (porEspecialidade[e] || 0) + 1;
    });
    const assinAtivasUserIds = new Set(assinaturas.filter((a: any) => a.status === "ativa").map((a: any) => a.user_id));
    const profissionaisResumo = {
      total: profiles.length,
      ativos: assinAtivasUserIds.size, // com assinatura ativa
      por_especialidade: Object.entries(porEspecialidade).map(([k, v]) => ({ especialidade: k, total: v })).sort((a, b) => b.total - a.total),
    };

    // ── Assinaturas de profissionais ──
    const assinPorStatus: Record<string, number> = {};
    assinaturas.forEach((a: any) => { assinPorStatus[a.status] = (assinPorStatus[a.status] || 0) + 1; });
    const mrrProfissionais = assinaturas
      .filter((a: any) => a.status === "ativa")
      .reduce((s: number, a: any) => s + Number(planoById[a.plano_id]?.preco_mensal || 0), 0);
    const assinPorPlano: Record<string, { nome: string; ativas: number; mrr: number }> = {};
    assinaturas.filter((a: any) => a.status === "ativa").forEach((a: any) => {
      const pl = planoById[a.plano_id];
      const nome = pl?.nome || "—";
      if (!assinPorPlano[a.plano_id]) assinPorPlano[a.plano_id] = { nome, ativas: 0, mrr: 0 };
      assinPorPlano[a.plano_id].ativas += 1;
      assinPorPlano[a.plano_id].mrr += Number(pl?.preco_mensal || 0);
    });

    // ── Assinaturas de alunos (wellness) ──
    const wellnessPorStatus: Record<string, number> = {};
    wellness.forEach((w: any) => { wellnessPorStatus[w.status] = (wellnessPorStatus[w.status] || 0) + 1; });
    const mrrAlunos = wellness.filter((w: any) => w.status === "ativa").reduce((s: number, w: any) => s + Number(w.valor_mensal || 0), 0);
    const inadimplentes = wellness.filter((w: any) => w.status === "inadimplente").length;

    // ── Evolução mensal (novas assinaturas por mês) ──
    const novasPorMes = meses.map((mes) => ({
      mes,
      profissionais: assinaturas.filter((a: any) => ymd(a.data_inicio || a.created_at) === mes).length,
      alunos: wellness.filter((w: any) => ymd(w.data_inicio || w.created_at) === mes).length,
    }));

    // ── Vendas (registradas pelos profissionais) ──
    const STATUS_PAGO = new Set(["pago", "concluido", "concluída", "concluida", "quitado"]);
    const vendasPagas = vendas.filter((v: any) => STATUS_PAGO.has(String(v.status || "").toLowerCase()));
    const receitaVendas = vendasPagas.reduce((s: number, v: any) => s + Number(v.valor_total || 0), 0);
    const porFormaPagamento: Record<string, { qtd: number; valor: number }> = {};
    vendas.forEach((v: any) => {
      const f = v.forma_pagamento || "—";
      if (!porFormaPagamento[f]) porFormaPagamento[f] = { qtd: 0, valor: 0 };
      porFormaPagamento[f].qtd += 1;
      porFormaPagamento[f].valor += Number(v.valor_total || 0);
    });

    // ── Formas/provedores de pagamento em uso ──
    const provedores = new Set<string>();
    assinaturas.forEach((a: any) => { if (a.origem) provedores.add(`assinatura:${a.origem}`); });
    wellness.forEach((w: any) => { if (w.provider) provedores.add(`wellness:${w.provider}`); });
    Object.keys(porFormaPagamento).forEach((f) => provedores.add(`venda:${f}`));

    return new Response(JSON.stringify({
      gerado_em: nowIso,
      resumo: {
        mrr_total: Math.round((mrrProfissionais + mrrAlunos) * 100) / 100,
        mrr_profissionais: Math.round(mrrProfissionais * 100) / 100,
        mrr_alunos: Math.round(mrrAlunos * 100) / 100,
        clinicas_ativas: clinicasResumo.ativas,
        clinicas_total: clinicasResumo.total,
        profissionais_ativos: profissionaisResumo.ativos,
        profissionais_total: profissionaisResumo.total,
        alunos_ativos: wellnessPorStatus["ativa"] || 0,
        alunos_total: wellness.length,
        inadimplentes,
        receita_vendas_12m: Math.round(receitaVendas * 100) / 100,
      },
      clinicas: clinicasResumo,
      profissionais: profissionaisResumo,
      assinaturas_profissionais: {
        por_status: assinPorStatus,
        mrr: Math.round(mrrProfissionais * 100) / 100,
        por_plano: Object.values(assinPorPlano).sort((a, b) => b.mrr - a.mrr),
      },
      assinaturas_alunos: {
        por_status: wellnessPorStatus,
        mrr: Math.round(mrrAlunos * 100) / 100,
        inadimplentes,
      },
      evolucao_mensal: novasPorMes,
      vendas: {
        receita_12m: Math.round(receitaVendas * 100) / 100,
        por_forma_pagamento: Object.entries(porFormaPagamento).map(([forma, v]) => ({ forma, ...v, valor: Math.round(v.valor * 100) / 100 })).sort((a, b) => b.valor - a.valor),
      },
      planos: planos.map((p: any) => ({ id: p.id, nome: p.nome, descricao: p.descricao, preco_mensal: Number(p.preco_mensal || 0), ativo: p.ativo, stripe_price_id: p.stripe_price_id })),
      formas_pagamento: Array.from(provedores).sort(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error)?.message || "Falha ao carregar métricas." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
