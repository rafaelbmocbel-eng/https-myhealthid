import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface EvolucaoRecord {
  id: string;
  paciente_id: string;
  terapeuta_id: string;
  avaliacao_atual_id: string;
  avaliacao_anterior_id: string | null;
  numero_avaliacao: number;
  data_registro: string;
  classificacao: string | null;
  id_final: number | null;
  myid_score: number | null;
  score_e: number | null;
  score_p: number | null;
  score_c: number | null;
  score_f: number | null;
  score_d: number | null;
  score_r: number | null;
  score_efi: number | null;
  score_i: number | null;
  score_n: number | null;
  delta_e: number | null;
  delta_p: number | null;
  delta_c: number | null;
  delta_f: number | null;
  delta_d: number | null;
  delta_r: number | null;
  delta_efi: number | null;
  delta_id_final: number | null;
  dias_desde_anterior: number | null;
  observacoes: string | null;
  created_at: string;
}

export function useEvolucaoPaciente(pacienteId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: evolucoes = [], isLoading } = useQuery({
    queryKey: ['evolucao-paciente', user?.id, pacienteId],
    queryFn: async () => {
      if (!pacienteId) return [];
      const { data, error } = await (supabase as any)
        .from('evolucao_paciente')
        .select('*')
        .eq('paciente_id', pacienteId)
        .eq('terapeuta_id', user!.id)
        .order('numero_avaliacao', { ascending: true });
      if (error) throw error;
      return (data || []) as EvolucaoRecord[];
    },
    enabled: !!user && !!pacienteId,
  });

  const registrarEvolucao = useMutation({
    mutationFn: async (payload: {
      pacienteId: string;
      avaliacaoAtualId: string;
      avaliacaoAnteriorId?: string | null;
      numeroAvaliacao: number;
      classificacao?: string | null;
      idFinal?: number | null;
      scores: Record<string, number | null>;
      deltas: Record<string, number | null>;
      diasDesdeAnterior?: number | null;
    }) => {
      const row = {
        paciente_id: payload.pacienteId,
        terapeuta_id: user!.id,
        avaliacao_atual_id: payload.avaliacaoAtualId,
        avaliacao_anterior_id: payload.avaliacaoAnteriorId || null,
        numero_avaliacao: payload.numeroAvaliacao,
        classificacao: payload.classificacao || null,
        id_final: payload.idFinal ?? null,
        score_e: payload.scores.score_e ?? null,
        score_p: payload.scores.score_p ?? null,
        score_c: payload.scores.score_c ?? null,
        score_f: payload.scores.score_f ?? null,
        score_d: payload.scores.score_d ?? null,
        score_r: payload.scores.score_r ?? null,
        score_efi: payload.scores.score_efi ?? null,
        delta_e: payload.deltas.delta_e ?? 0,
        delta_p: payload.deltas.delta_p ?? 0,
        delta_c: payload.deltas.delta_c ?? 0,
        delta_f: payload.deltas.delta_f ?? 0,
        delta_d: payload.deltas.delta_d ?? 0,
        delta_r: payload.deltas.delta_r ?? 0,
        delta_efi: payload.deltas.delta_efi ?? 0,
        delta_id_final: payload.deltas.delta_id_final ?? 0,
        dias_desde_anterior: payload.diasDesdeAnterior ?? null,
      };
      const { data, error } = await (supabase as any)
        .from('evolucao_paciente')
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['evolucao-paciente'] });
    },
  });

  return {
    evolucoes,
    isLoading,
    registrar: registrarEvolucao.mutateAsync,
    registrando: registrarEvolucao.isPending,
  };
}
