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
      const { id, nome, preco_mensal, ativo, modulos } = body;
      if (!id) return new Response(JSON.stringify({ error: "id do plano ausente" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (typeof nome === "string") patch.nome = nome;
      if (preco_mensal != null && !Number.isNaN(Number(preco_mensal))) patch.preco_mensal = Number(preco_mensal);
      if (typeof ativo === "boolean") patch.ativo = ativo;
      // Funcionalidades liberadas pelo plano (array de chaves de módulo).
      if (Array.isArray(modulos)) patch.modulos = modulos.filter((m) => typeof m === "string");
      const { error } = await admin.from("planos").update(patch).eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Ação de escrita: remover um plano descontinuado ──
    if (action === "delete_plano") {
      const { id } = body;
      if (!id) return new Response(JSON.stringify({ error: "id do plano ausente" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      // Trava de segurança: nunca remove um plano com assinatura ATIVA.
      const { count, error: cErr } = await admin
        .from("assinaturas")
        .select("id", { count: "exact", head: true })
        .eq("plano_id", id)
        .eq("status", "ativa");
      if (cErr) throw cErr;
      if ((count || 0) > 0) {
        return new Response(JSON.stringify({ error: `Não dá pra remover: há ${count} assinatura(s) ativa(s) neste plano. Migre-as antes.` }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await admin.from("planos").delete().eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Ação: LIBERAR plano por e-mail (cortesia / parceiro) ──
    if (action === "conceder_plano") {
      const { email, plano_id, dias } = body;
      if (!email || !plano_id) return new Response(JSON.stringify({ error: "Informe e-mail e plano." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: prof } = await admin.from("profiles").select("user_id").ilike("email", String(email).trim()).maybeSingle();
      if (!prof?.user_id) {
        return new Response(JSON.stringify({ error: "Nenhuma conta com esse e-mail. Peça para a pessoa criar a conta primeiro, depois libere." }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data_fim = dias && Number(dias) > 0 ? new Date(Date.now() + Number(dias) * 86400000).toISOString() : null;
      const { error } = await admin.from("assinaturas").upsert({
        user_id: prof.user_id, plano_id, status: "ativa", origem: "cortesia",
        data_inicio: new Date().toISOString(), data_fim, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,plano_id" });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Ação: GRANDFATHER em massa — dá um plano a todo profissional sem assinatura ──
    if (action === "grandfather_todos") {
      const { plano_id } = body;
      if (!plano_id) return new Response(JSON.stringify({ error: "Informe o plano." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const [{ data: profs }, { data: ativas }] = await Promise.all([
        admin.from("profiles").select("user_id"),
        admin.from("assinaturas").select("user_id").eq("status", "ativa"),
      ]);
      const comAtiva = new Set((ativas || []).map((a: any) => a.user_id));
      const alvos = (profs || []).map((p: any) => p.user_id).filter((uid: string) => uid && !comAtiva.has(uid));
      const nowIsoG = new Date().toISOString();
      const rows = alvos.map((uid: string) => ({ user_id: uid, plano_id, status: "ativa", origem: "cortesia", data_inicio: nowIsoG, data_fim: null, updated_at: nowIsoG }));
      if (rows.length) {
        const { error } = await admin.from("assinaturas").upsert(rows, { onConflict: "user_id,plano_id" });
        if (error) throw error;
      }
      return new Response(JSON.stringify({ ok: true, concedidos: rows.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Ação: REVOGAR uma cortesia ──
    if (action === "revogar_plano") {
      const { user_id, plano_id } = body;
      if (!user_id || !plano_id) return new Response(JSON.stringify({ error: "Dados incompletos." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { error } = await admin.from("assinaturas").delete()
        .eq("user_id", user_id).eq("plano_id", plano_id).eq("origem", "cortesia");
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Ação: CRIAR link read-only para parceiro ──
    if (action === "criar_link_parceiro") {
      const label = String(body?.label || "").trim();
      if (!label) return new Response(JSON.stringify({ error: "Dê um nome ao link (ex.: nome do parceiro)." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const bytes = new Uint8Array(24);
      crypto.getRandomValues(bytes);
      const tokenGerado = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      const { error } = await admin.from("parceiro_links").insert({ token: tokenGerado, label, ativo: true });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, token: tokenGerado }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Ação: REVOGAR link de parceiro ──
    if (action === "revogar_link_parceiro") {
      const { id } = body;
      if (!id) return new Response(JSON.stringify({ error: "id do link ausente" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { error } = await admin.from("parceiro_links").update({ ativo: false }).eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Leitura: agrega tudo ──
    const nowIso = new Date().toISOString();
    const meses = ultimos12Meses(nowIso);
    // Filtro de período (afeta VENDAS e "novos no período"). MRR é sempre o atual.
    const periodo = String(body?.periodo || "12m");
    const agoraMs = Date.now();
    const dNow = new Date(agoraMs);
    let inicioPeriodoIso = new Date(agoraMs - 365 * 24 * 3600_000).toISOString();
    if (periodo === "mes") inicioPeriodoIso = new Date(Date.UTC(dNow.getUTCFullYear(), dNow.getUTCMonth(), 1)).toISOString();
    else if (periodo === "trimestre") inicioPeriodoIso = new Date(Date.UTC(dNow.getUTCFullYear(), dNow.getUTCMonth() - 2, 1)).toISOString();
    else if (periodo === "ano") inicioPeriodoIso = new Date(Date.UTC(dNow.getUTCFullYear(), 0, 1)).toISOString();
    const umAnoAtras = new Date(Date.now() - 365 * 24 * 3600_000).toISOString();

    const [
      clinicasRes, membrosRes, profilesRes, assinRes, planosRes, wellnessRes, vendasRes, configRes, parceiroLinksRes,
    ] = await Promise.all([
      admin.from("clinicas").select("id, nome, ativa, limite_profissionais, dono_user_id, created_at"),
      admin.from("clinica_membros").select("clinica_id, user_id"),
      admin.from("profiles").select("id, user_id, nome, sobrenome, email, telefone, perfil_profissional, especialidade, crefito, created_at"),
      admin.from("assinaturas").select("id, user_id, plano_id, status, origem, data_inicio, data_fim, created_at"),
      admin.from("planos").select("id, nome, descricao, preco_mensal, ativo, stripe_price_id, modulos, created_at").order("preco_mensal", { ascending: true }),
      admin.from("wellness_assinaturas").select("id, status, provider, valor_mensal, data_inicio, proxima_cobranca, created_at"),
      admin.from("vendas").select("valor_total, forma_pagamento, status, data_venda").gte("data_venda", umAnoAtras),
      admin.from("config_clinica").select("terapeuta_id, cidade, uf, razao_social"),
      admin.from("parceiro_links").select("id, token, label, ativo, created_at").order("created_at", { ascending: false }),
    ]);

    const clinicas = clinicasRes.data || [];
    const membros = membrosRes.data || [];
    const profiles = profilesRes.data || [];
    const configs = configRes.data || [];
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

    // ── Lista de profissionais (quem são, de onde são, plano/status) ──
    const configByTerapeuta: Record<string, any> = {};
    configs.forEach((c: any) => { configByTerapeuta[c.terapeuta_id] = c; });
    // Melhor assinatura por usuário: prioriza 'ativa', senão a mais recente.
    const assinByUser: Record<string, any> = {};
    assinaturas.forEach((a: any) => {
      const cur = assinByUser[a.user_id];
      if (!cur) { assinByUser[a.user_id] = a; return; }
      if (a.status === "ativa" && cur.status !== "ativa") { assinByUser[a.user_id] = a; return; }
      if ((a.data_inicio || a.created_at) > (cur.data_inicio || cur.created_at) && !(cur.status === "ativa" && a.status !== "ativa")) {
        assinByUser[a.user_id] = a;
      }
    });
    const profissionaisLista = profiles.map((p: any) => {
      const cfg = configByTerapeuta[p.user_id];
      const assin = assinByUser[p.user_id];
      const plano = assin ? planoById[assin.plano_id] : null;
      const nomeCompleto = [p.nome, p.sobrenome].filter(Boolean).join(" ").trim() || "(sem nome)";
      return {
        id: p.user_id,
        nome: nomeCompleto,
        email: p.email || "",
        telefone: p.telefone || "",
        especialidade: p.perfil_profissional || "fisioterapeuta",
        especialidade_texto: p.especialidade || "",
        crefito: p.crefito || "",
        cidade: cfg?.cidade || "",
        uf: cfg?.uf || "",
        clinica: cfg?.razao_social || "",
        plano: plano?.nome || "—",
        status_assinatura: assin?.status || "sem assinatura",
        cadastrado_em: p.created_at,
      };
    }).sort((a, b) => (b.cadastrado_em || "").localeCompare(a.cadastrado_em || ""));

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

    // ── Vendas (registradas pelos profissionais) — escopadas ao período ──
    const STATUS_PAGO = new Set(["pago", "concluido", "concluída", "concluida", "quitado"]);
    const vendasNoPeriodo = vendas.filter((v: any) => (v.data_venda || "") >= inicioPeriodoIso);
    const vendasPagas = vendasNoPeriodo.filter((v: any) => STATUS_PAGO.has(String(v.status || "").toLowerCase()));
    const receitaVendas = vendasPagas.reduce((s: number, v: any) => s + Number(v.valor_total || 0), 0);
    const porFormaPagamento: Record<string, { qtd: number; valor: number }> = {};
    vendasNoPeriodo.forEach((v: any) => {
      const f = v.forma_pagamento || "—";
      if (!porFormaPagamento[f]) porFormaPagamento[f] = { qtd: 0, valor: 0 };
      porFormaPagamento[f].qtd += 1;
      porFormaPagamento[f].valor += Number(v.valor_total || 0);
    });
    // Novos no período (assinaturas e alunos iniciados na janela).
    const novosProfissionaisPeriodo = assinaturas.filter((a: any) => (a.data_inicio || a.created_at || "") >= inicioPeriodoIso).length;
    const novosAlunosPeriodo = wellness.filter((w: any) => (w.data_inicio || w.created_at || "") >= inicioPeriodoIso).length;

    // ── Formas/provedores de pagamento em uso ──
    const provedores = new Set<string>();
    assinaturas.forEach((a: any) => { if (a.origem) provedores.add(`assinatura:${a.origem}`); });
    wellness.forEach((w: any) => { if (w.provider) provedores.add(`wellness:${w.provider}`); });
    Object.keys(porFormaPagamento).forEach((f) => provedores.add(`venda:${f}`));

    // ── Cortesias (planos liberados por e-mail: parceiros/afiliados) ──
    const emailByUser: Record<string, string> = {};
    profiles.forEach((p: any) => { if (p.user_id) emailByUser[p.user_id] = p.email || ""; });
    const cortesias = assinaturas
      .filter((a: any) => a.origem === "cortesia")
      .map((a: any) => ({
        user_id: a.user_id,
        email: emailByUser[a.user_id] || "(sem cadastro)",
        plano_id: a.plano_id,
        plano: planoById[a.plano_id]?.nome || "—",
        status: a.status,
        data_fim: a.data_fim,
      }))
      .sort((x, y) => x.email.localeCompare(y.email, "pt-BR"));

    // ── Uso e custo de IA (últimos 7 dias) + efetividade do cache ──
    const desde7dIa = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const desde24hIa = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: usoRows } = await admin.from("ai_usage_log").select("function_name, est_cost_usd, created_at").gte("created_at", desde7dIa);
    const porFnIa: Record<string, { n: number; usd: number }> = {};
    let custo7dIa = 0, custo24hIa = 0, chamadas7d = 0;
    for (const rr of usoRows || []) {
      const usd = Number(rr.est_cost_usd || 0);
      custo7dIa += usd; chamadas7d++;
      if (rr.created_at >= desde24hIa) custo24hIa += usd;
      const k = rr.function_name || "?";
      porFnIa[k] = porFnIa[k] || { n: 0, usd: 0 };
      porFnIa[k].n++; porFnIa[k].usd += usd;
    }
    let cacheHitsIa = 0;
    try {
      const { data: cacheRows } = await admin.from("ai_response_cache").select("hit_count");
      cacheHitsIa = (cacheRows || []).reduce((s: number, c: any) => s + Number(c.hit_count || 0), 0);
    } catch { /* tabela ausente em algum ambiente */ }
    const aiUso = {
      custo_7d_usd: Math.round(custo7dIa * 10000) / 10000,
      custo_24h_usd: Math.round(custo24hIa * 10000) / 10000,
      chamadas_7d: chamadas7d,
      cache_hits: cacheHitsIa,
      por_funcao: Object.entries(porFnIa).map(([funcao, v]) => ({ funcao, chamadas: v.n, custo_usd: Math.round(v.usd * 10000) / 10000 })).sort((a, b) => b.custo_usd - a.custo_usd).slice(0, 8),
    };

    return new Response(JSON.stringify({
      gerado_em: nowIso,
      ai_uso: aiUso,
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
      profissionais_lista: profissionaisLista,
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
      periodo,
      evolucao_mensal: novasPorMes,
      vendas: {
        receita_12m: Math.round(receitaVendas * 100) / 100,
        receita_periodo: Math.round(receitaVendas * 100) / 100,
        novos_profissionais: novosProfissionaisPeriodo,
        novos_alunos: novosAlunosPeriodo,
        por_forma_pagamento: Object.entries(porFormaPagamento).map(([forma, v]) => ({ forma, ...v, valor: Math.round(v.valor * 100) / 100 })).sort((a, b) => b.valor - a.valor),
      },
      planos: planos.map((p: any) => ({ id: p.id, nome: p.nome, descricao: p.descricao, preco_mensal: Number(p.preco_mensal || 0), ativo: p.ativo, stripe_price_id: p.stripe_price_id, modulos: Array.isArray(p.modulos) ? p.modulos : [] })),
      formas_pagamento: Array.from(provedores).sort(),
      cortesias,
      parceiro_links: (parceiroLinksRes.data || []).map((l: any) => ({ id: l.id, token: l.token, label: l.label, ativo: l.ativo, created_at: l.created_at })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error)?.message || "Falha ao carregar métricas." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
