import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminMetrics {
  gerado_em: string;
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
  vendas: { receita_12m: number; por_forma_pagamento: Array<{ forma: string; qtd: number; valor: number }> };
  planos: Array<{ id: string; nome: string; descricao: string | null; preco_mensal: number; ativo: boolean; stripe_price_id: string | null; modulos: string[] }>;
  formas_pagamento: string[];
}

export function useAdminMetrics() {
  return useQuery({
    queryKey: ['admin-metrics'],
    queryFn: async (): Promise<AdminMetrics> => {
      const { data, error } = await supabase.functions.invoke('admin-metrics', { body: {} });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as AdminMetrics;
    },
    staleTime: 60_000,
    retry: false,
  });
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
