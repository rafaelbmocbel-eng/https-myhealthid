import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type MyIDFreshness = 'fresh' | 'aging' | 'stale' | 'none';

export interface MyIDFreshnessInfo {
  status: MyIDFreshness;
  diasDesde: number | null;
  ultimaData: string | null;
}

const DEFAULT_INFO: MyIDFreshnessInfo = { status: 'none', diasDesde: null, ultimaData: null };

/**
 * Calcula a "frescor" do MyID para cada paciente da lista.
 * - fresh: < 30 dias
 * - aging: 30-60 dias
 * - stale: > 60 dias
 * - none: nunca concluído
 */
export function useMyIDFreshnessMap(pacienteIds: string[]) {
  const ids = Array.from(new Set(pacienteIds.filter(Boolean))).sort();
  const key = ids.join(',');

  return useQuery({
    queryKey: ['myid-freshness', key],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('myid_avaliacoes')
        .select('paciente_id, updated_at')
        .in('paciente_id', ids)
        .eq('status', 'concluido')
        .order('updated_at', { ascending: false });
      if (error) throw error;

      const map = new Map<string, MyIDFreshnessInfo>();
      const now = Date.now();
      for (const row of data || []) {
        if (!row.paciente_id || map.has(row.paciente_id)) continue;
        const dt = new Date(row.updated_at).getTime();
        const dias = Math.floor((now - dt) / (1000 * 60 * 60 * 24));
        const status: MyIDFreshness = dias < 30 ? 'fresh' : dias <= 60 ? 'aging' : 'stale';
        map.set(row.paciente_id, { status, diasDesde: dias, ultimaData: row.updated_at });
      }
      return map;
    },
  });
}

export function getFreshnessInfo(
  map: Map<string, MyIDFreshnessInfo> | undefined,
  pacienteId: string | null | undefined,
): MyIDFreshnessInfo {
  if (!pacienteId || !map) return DEFAULT_INFO;
  return map.get(pacienteId) || DEFAULT_INFO;
}
