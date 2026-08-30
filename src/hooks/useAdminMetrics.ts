import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminMetrics {
  gerado_em: string;
  ai_uso?: {
    custo_7d_usd: number; custo_24h_usd: number; chamadas_7d: number; cache_hits: number;
    por_funcao: Array<{ funcao: string; chamadas: number; custo_usd: number }>;
  };
  resumo: {
    mrr_total: number; mrr_profissionais: number; mrr_alunos: number;
    clinicas_ativas: number; clinicas_total: number;
    profissionais_ativos: number; profissionais_total: number;
    alunos_ativos: number; alunos_total: number;
    inadimplentes: number; receita_vendas_12m: number;
  };
  clinicas: { total: number; ativas: number; lista: Array<{ id: string; nome: string; ativa: boolean; profissionais: number; limite: number }> };
  profissionais: { total: number; ativos: number; por_especialidade: Array<{ especialidade: string; total: number }> };
  profissionais_lista: Array<{
    id: string; nome: string; email: string; telefone: string;
    especialidade: string; especialidade_texto: string; crefito: string;
    cidade: string; uf: string; clinica: string;
    plano: string; status_assinatura: string; cadastrado_em: string;
  }>;
  assinaturas_profissionais: { por_status: Record<string, number>; mrr: number; por_plano: Array<{ nome: string; ativas: number; mrr: number }> };
  assinaturas_alunos: { por_status: Record<string, number>; mrr: number; inadimplentes: number };
  evolucao_mensal: Array<{ mes: string; profissionais: number; alunos: number }>;
  periodo?: string;
  vendas: { receita_12m: number; receita_periodo?: number; novos_profissionais?: number; novos_alunos?: number; por_forma_pagamento: Array<{ forma: string; qtd: number; valor: number }> };
  planos: Array<{ id: string; nome: string; descricao: string | null; preco_mensal: number; ativo: boolean; stripe_price_id: string | null; modulos: string[] }>;
  formas_pagamento: string[];
  cortesias: Array<{ user_id: string; email: string; plano_id: string; plano: string; status: string; data_fim: string | null }>;
  parceiro_links?: Array<{ id: string; token: string; label: string; ativo: boolean; created_at: string }>;
}

export type PeriodoAdmin = 'mes' | 'trimestre' | 'ano' | '12m';

export function useAdminMetrics(periodo: PeriodoAdmin = '12m') {
  return useQuery({
    queryKey: ['admin-metrics', periodo],
    queryFn: async (): Promise<AdminMetrics> => {
      const { data, error } = await supabase.functions.invoke('admin-metrics', { body: { periodo } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as AdminMetrics;
    },
    staleTime: 60_000,
    retry: false,
  });
}

/** Cria um link read-only de parceiro. Retorna o token gerado. */
export async function criarLinkParceiro(label: string) {
  const { data, error } = await supabase.functions.invoke('admin-metrics', {
    body: { action: 'criar_link_parceiro', label },
  });
  if (error) {
    let msg = error.message;
    try { const ctx = (error as any).context; if (ctx?.json) { const b = await ctx.json(); if (b?.error) msg = b.error; } } catch { /* ignore */ }
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as { ok: boolean; token: string };
}

/** Revoga (desativa) um link de parceiro. */
export async function revogarLinkParceiro(id: string) {
  const { data, error } = await supabase.functions.invoke('admin-metrics', {
    body: { action: 'revogar_link_parceiro', id },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

/** Atualiza um plano (preço/nome/ativo) via admin-metrics. */
export async function atualizarPlano(patch: { id: string; nome?: string; preco_mensal?: number; ativo?: boolean; modulos?: string[] }) {
  const { data, error } = await supabase.functions.invoke('admin-metrics', {
    body: { action: 'update_plano', ...patch },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

/** Libera um plano (cortesia/parceiro) para um e-mail. */
export async function concederPlano(patch: { email: string; plano_id: string; dias?: number }) {
  const { data, error } = await supabase.functions.invoke('admin-metrics', {
    body: { action: 'conceder_plano', ...patch },
  });
  if (error) {
    let msg = error.message;
    try { const ctx = (error as any).context; if (ctx?.json) { const b = await ctx.json(); if (b?.error) msg = b.error; } } catch { /* ignore */ }
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

/** Revoga uma cortesia. */
export async function revogarCortesia(patch: { user_id: string; plano_id: string }) {
  const { data, error } = await supabase.functions.invoke('admin-metrics', {
    body: { action: 'revogar_plano', ...patch },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

/** Concede um plano (cortesia) a TODOS os profissionais que ainda não têm assinatura ativa. */
export async function grandfatherTodos(patch: { plano_id: string }) {
  const { data, error } = await supabase.functions.invoke('admin-metrics', {
    body: { action: 'grandfather_todos', ...patch },
  });
  if (error) {
    let msg = error.message;
    try { const ctx = (error as any).context; if (ctx?.json) { const b = await ctx.json(); if (b?.error) msg = b.error; } } catch { /* ignore */ }
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as { ok: boolean; concedidos: number };
}

/** Dispara uma rodada da tradução automática da biblioteca de exercícios (super-admin). */
export async function traduzirBibliotecaBatch() {
  const { data, error } = await supabase.functions.invoke('traduzir-biblioteca-batch', { body: {} });
  if (error) {
    let msg = error.message;
    try { const ctx = (error as any).context; if (ctx?.json) { const b = await ctx.json(); if (b?.error) msg = b.error; } } catch { /* ignore */ }
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as { ok: boolean; traduzidos: number; falhas: number; restantes: number; processados: number };
}

/** Remove um plano descontinuado (trava: recusa se houver assinatura ativa). */
export async function removerPlano(id: string) {
  const { data, error } = await supabase.functions.invoke('admin-metrics', {
    body: { action: 'delete_plano', id },
  });
  if (error) {
    // supabase-js embrulha não-2xx; tenta extrair a mensagem real do corpo.
    let msg = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        const b = await ctx.json();
        if (b?.error) msg = b.error;
      }
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}
