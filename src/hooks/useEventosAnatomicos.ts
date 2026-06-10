import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export type SistemaCorporal =
  | 'musculoesqueletico' | 'nervoso' | 'cardiovascular' | 'respiratorio'
  | 'digestorio' | 'endocrino' | 'urinario' | 'reprodutor'
  | 'tegumentar' | 'linfatico' | 'sensorial';

export type OrigemAchado =
  | 'subjetivo_myid' | 'exame_clinico' | 'exame_imagem'
  | 'voz_ia' | 'autocadastro_paciente' | 'outro';

export type StatusEvento = 'ativo' | 'em_tratamento' | 'resolvido' | 'cronico';

export interface EventoAnatomico {
  id: string;
  paciente_id: string;
  terapeuta_id: string;
  regiao_id: string;
  sistema: SistemaCorporal;
  origem: OrigemAchado;
  tipo_achado: string;
  estrutura: string | null;
  diagnostico_cid: string | null;
  severidade: number;
  status: StatusEvento;
  data_inicio: string;
  data_resolucao: string | null;
  notas_clinicas: string | null;
  visivel_paciente: boolean;
  evento_origem_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export function useEventosAnatomicos(pacienteId: string | undefined) {
  return useQuery({
    queryKey: ['eventos-anatomicos', pacienteId],
    enabled: !!pacienteId,
    queryFn: async (): Promise<EventoAnatomico[]> => {
      const { data, error } = await supabase
        .from('eventos_clinicos_anatomicos' as any)
        .select('*')
        .eq('paciente_id', pacienteId!)
        .order('data_inicio', { ascending: false });
      if (error) throw error;
      return (data || []) as any;
    },
  });
}

export function useSaveEventoAnatomico() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<EventoAnatomico> & { paciente_id: string; regiao_id: string; tipo_achado: string }) => {
      const payload: any = { ...input, terapeuta_id: user!.id };
      if (input.id) {
        const { id, created_at, updated_at, ...rest } = payload;
        const { error } = await supabase
          .from('eventos_clinicos_anatomicos' as any)
          .update(rest)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('eventos_clinicos_anatomicos' as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['eventos-anatomicos', vars.paciente_id] });
      toast({ title: 'Evento clínico salvo' });
    },
    onError: (e: any) => toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteEventoAnatomico(pacienteId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('eventos_clinicos_anatomicos' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eventos-anatomicos', pacienteId] });
      toast({ title: 'Evento removido' });
    },
  });
}

/**
 * Cor derivada da severidade + status + idade do achado.
 * Vermelho: ativo + ≤6m  | Laranja: em_tratamento  | Amarelo: crônico
 * Cinza: resolvido (memória tecidual)
 */
export function corEvento(ev: EventoAnatomico): string {
  if (ev.status === 'resolvido') return '#9ca3af';
  if (ev.status === 'cronico') return '#eab308';
  if (ev.status === 'em_tratamento') return '#f97316';
  // ativo
  if (ev.severidade >= 3) return '#dc2626';
  if (ev.severidade === 2) return '#ef4444';
  return '#fb923c';
}
