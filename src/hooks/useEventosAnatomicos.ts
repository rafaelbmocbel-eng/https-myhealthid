import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export type SistemaCorporal =
  | 'musculoesqueletico' | 'nervoso' | 'digestorio' | 'circulatorio'
  | 'respiratorio' | 'endocrino' | 'urinario'
  | 'reprodutor' | 'tegumentar' | 'linfatico' | 'sensorial';

export type OrigemAchado =
  | 'subjetivo_myid' | 'exame_clinico' | 'exame_imagem'
  | 'voz_ia' | 'autocadastro_paciente' | 'outro';

export type TipoDiagnostico =
  | 'relato_paciente'
  | 'historico_relatado'
  | 'achado_clinico'
  | 'diagnostico_medico'
  | 'diagnostico_fisioterapia'
  | 'diagnostico_psicologia'
  | 'diagnostico_nutricao'
  | 'diagnostico_fonoaudiologia'
  | 'diagnostico_outro';

export type StatusEvento = 'ativo' | 'em_tratamento' | 'resolvido' | 'cronico';

export interface EventoAnatomico {
  id: string;
  paciente_id: string;
  terapeuta_id: string;
  regiao_id: string;
  sistema: SistemaCorporal;
  origem: OrigemAchado;
  tipo_achado: string;
  tipo_diagnostico: TipoDiagnostico;
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
 * Cor derivada de tipo_diagnostico + status + severidade.
 *
 * Hierarquia visual:
 *   diagnostico_*  → vermelho intenso / âmbar forte (diagnóstico confirmado)
 *   achado_clinico → vermelho/laranja médio (achado presencial)
 *   relato_paciente → lilás claro / cinza suave (relato não confirmado)
 *   historico_relatado → azul-cinza (histórico pendente de confirmação)
 *   resolvido (qualquer tipo) → cinza (memória histórica)
 */
export function corEvento(ev: EventoAnatomico): string {
  if (ev.status === 'resolvido') return '#9ca3af'; // cinza histórico
  if (ev.status === 'em_tratamento') return '#f97316'; // laranja tratamento
  if (ev.status === 'cronico') return '#eab308'; // amarelo crônico

  const td = (ev as any).tipo_diagnostico as TipoDiagnostico | undefined;

  // Histórico relatado (não confirmado) — azul-cinza discreto
  if (td === 'historico_relatado') return '#94a3b8';

  // Relato não confirmado do paciente — lilás suave
  if (td === 'relato_paciente') {
    if (ev.severidade >= 3) return '#c4b5fd';
    if (ev.severidade === 2) return '#ddd6fe';
    return '#e9d5ff';
  }

  // Diagnóstico confirmado por profissional — marcação forte
  if (td?.startsWith('diagnostico_')) {
    if (ev.severidade >= 3) return '#991b1b'; // vermelho escuro — grave
    if (ev.severidade === 2) return '#dc2626'; // vermelho — moderado
    return '#f97316'; // laranja — leve confirmado
  }

  // achado_clinico (padrão) — marcação média
  if (ev.severidade >= 3) return '#dc2626';
  if (ev.severidade === 2) return '#ef4444';
  return '#fb923c';
}
