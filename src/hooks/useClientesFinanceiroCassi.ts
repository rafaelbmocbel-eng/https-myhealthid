import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const TABELA = 'cassi_financeiro_clientes';
const SEM_CLIENTES: ReadonlySet<string> = new Set<string>();

// Lista de clientes de cada mês na aba Faturamento do Controle CASSI. Lê os meses de `de` a `ate`
// ('AAAA-MM', inclusive) e devolve o conjunto de clientes de cada um.
export function useClientesFinanceiroCassi(de: string, ate: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const chave = ['cassi-financeiro-clientes', user?.id] as const;
  const invalidar = () => qc.invalidateQueries({ queryKey: chave });

  const consulta = useQuery({
    queryKey: [...chave, de, ate],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from(TABELA)
        .select('mes, paciente_id')
        .eq('terapeuta_id', user!.id)
        .gte('mes', de).lte('mes', ate);
      if (error) throw error;
      const porMes = new Map<string, Set<string>>();
      for (const r of (data || []) as Array<{ mes: string; paciente_id: string }>) {
        if (!porMes.has(r.mes)) porMes.set(r.mes, new Set());
        porMes.get(r.mes)!.add(r.paciente_id);
      }
      return porMes;
    },
    enabled: !!user,
  });

  const porMes = consulta.data;
  const doMes = useMemo(
    () => (mes: string): ReadonlySet<string> => porMes?.get(mes) ?? SEM_CLIENTES,
    [porMes],
  );

  const aoFalhar = (acao: string) => (e: unknown) => {
    toast.error(`Não consegui ${acao}: ${(e as { message?: string })?.message || 'erro'}`);
  };

  const adicionar = useMutation({
    mutationFn: async ({ mes, ids }: { mes: string; ids: string[] }) => {
      if (ids.length === 0) return;
      const linhas = ids.map((id) => ({ terapeuta_id: user!.id, mes, paciente_id: id }));
      const { error } = await (supabase as any).from(TABELA)
        .upsert(linhas, { onConflict: 'terapeuta_id,mes,paciente_id', ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: aoFalhar('adicionar à lista'),
  });

  const remover = useMutation({
    mutationFn: async ({ mes, id }: { mes: string; id: string }) => {
      const { error } = await (supabase as any).from(TABELA).delete()
        .eq('terapeuta_id', user!.id).eq('mes', mes).eq('paciente_id', id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: aoFalhar('tirar da lista'),
  });

  const limpar = useMutation({
    mutationFn: async ({ mes }: { mes: string }) => {
      const { error } = await (supabase as any).from(TABELA).delete()
        .eq('terapeuta_id', user!.id).eq('mes', mes);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: aoFalhar('limpar a lista'),
  });

  return {
    doMes,
    carregando: consulta.isLoading,
    // Só é erro se não há lista nenhuma para mostrar: uma busca em segundo plano que falha mantém a lista que já veio.
    erro: consulta.isError && !consulta.data,
    recarregar: () => consulta.refetch(),
    adicionar, remover, limpar,
    ocupado: adicionar.isPending || remover.isPending || limpar.isPending,
  };
}
