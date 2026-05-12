import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { withAuthLockRetry } from '@/lib/authLock';

export type EventoCategoria = 'aula_online' | 'workshop' | 'live' | 'triagem' | 'desafio' | 'sazonal' | 'outro';
export type EventoPublicoAlvo = 'publico' | 'pacientes_ativos';

export interface Evento {
  id: string;
  terapeuta_id: string;
  titulo: string;
  descricao: string | null;
  descricao_formulario: string | null;
  data_evento: string;
  horario_inicio: string;
  horario_fim: string;
  local: string | null;
  vagas_max: number | null;
  valor: number;
  cobrar_pagamento: boolean;
  pix_chave: string | null;
  pix_tipo: string | null;
  pix_nome: string | null;
  link_pagamento: string | null;
  ativo: boolean;
  created_at: string;
  categoria: EventoCategoria;
  link_video: string | null;
  publico_alvo: EventoPublicoAlvo;
  recorrencia_grupo_id: string | null;
}

export interface RecorrenciaConfig {
  tipo: 'diaria' | 'semanal';
  intervalo: number; // ex: 1 = toda semana, 2 = a cada 2 semanas
  ocorrencias: number; // total de eventos a criar (1 = único)
}

export interface EventoPergunta {
  id: string;
  evento_id: string;
  ordem: number;
  tipo: 'text' | 'multiple_choice' | 'multiple_select' | 'scale' | 'boolean';
  pergunta: string;
  opcoes: string[];
  obrigatoria: boolean;
  limite_por_opcao: number | null;
}

export interface EventoInscricao {
  id: string;
  evento_id: string;
  paciente_id: string | null;
  nome: string;
  email: string | null;
  telefone: string | null;
  status: string;
  pago: boolean;
  ja_era_paciente: boolean;
  created_at: string;
}

export function useEventos() {
  const { user, authReady } = useAuth();
  const qc = useQueryClient();

  const eventosQuery = useQuery({
    queryKey: ['eventos', user?.id],
    queryFn: async () => {
      const { data, error } = await withAuthLockRetry(async () =>
        await supabase
          .from('eventos')
          .select('*')
          .eq('terapeuta_id', user!.id)
          .order('data_evento', { ascending: false })
      );
      if (error) throw error;
      return data as unknown as Evento[];
    },
    enabled: authReady && !!user,
  });

  const criarEvento = useMutation({
    mutationFn: async (
      evento: Omit<Evento, 'id' | 'terapeuta_id' | 'created_at' | 'recorrencia_grupo_id'> & {
        perguntas: Omit<EventoPergunta, 'id' | 'evento_id'>[];
        recorrencia?: RecorrenciaConfig | null;
      }
    ) => {
      const { perguntas, recorrencia, ...eventoData } = evento;

      // Build list of dates based on recurrence
      const ocorrencias = recorrencia && recorrencia.ocorrencias > 1 ? recorrencia.ocorrencias : 1;
      const stepDays = recorrencia
        ? (recorrencia.tipo === 'semanal' ? 7 : 1) * Math.max(1, recorrencia.intervalo)
        : 0;
      const baseDate = new Date(eventoData.data_evento + 'T12:00:00');
      const grupoId = ocorrencias > 1 ? crypto.randomUUID() : null;

      const rows = Array.from({ length: ocorrencias }, (_, i) => {
        const d = new Date(baseDate);
        d.setDate(d.getDate() + i * stepDays);
        const ymd = d.toISOString().split('T')[0];
        return { ...eventoData, data_evento: ymd, terapeuta_id: user!.id, recorrencia_grupo_id: grupoId };
      });

      const { data, error } = await supabase
        .from('eventos')
        .insert(rows as any)
        .select('id');
      if (error) throw error;

      if (perguntas.length > 0 && data) {
        const allRows = data.flatMap(ev =>
          perguntas.map((p, i) => ({
            evento_id: ev.id,
            ordem: i + 1,
            tipo: p.tipo,
            pergunta: p.pergunta,
            opcoes: p.opcoes || [],
            obrigatoria: p.obrigatoria,
            limite_por_opcao: (p as any).limite_por_opcao ?? null,
          }))
        );
        await supabase.from('evento_perguntas').insert(allRows as any);
      }
      return { count: rows.length };
    },
    onSuccess: ({ count }) => {
      toast.success(count > 1 ? `${count} eventos criados!` : 'Evento criado com sucesso!');
      qc.invalidateQueries({ queryKey: ['eventos'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editarEvento = useMutation({
    mutationFn: async ({ id, ...eventoData }: Partial<Evento> & { id: string }) => {
      const { error } = await supabase.from('eventos').update(eventoData as Record<string, unknown>).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Evento atualizado!');
      qc.invalidateQueries({ queryKey: ['eventos'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarPerguntas = useMutation({
    mutationFn: async ({ eventoId, perguntas }: { eventoId: string; perguntas: (Omit<EventoPergunta, 'id' | 'evento_id'> & { limite_por_opcao?: number | null })[] }) => {
      // Delete existing questions then re-insert
      await supabase.from('evento_perguntas').delete().eq('evento_id', eventoId);
      if (perguntas.length > 0) {
        const rows = perguntas.map((p, i) => ({
          evento_id: eventoId,
          ordem: i + 1,
          tipo: p.tipo,
          pergunta: p.pergunta,
          opcoes: p.opcoes || [],
          obrigatoria: p.obrigatoria,
          limite_por_opcao: (p as any).limite_por_opcao ?? null,
        }));
        const { error } = await supabase.from('evento_perguntas').insert(rows as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Questionário salvo!');
      qc.invalidateQueries({ queryKey: ['evento-detalhe'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleEvento = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('eventos').update({ ativo } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eventos'] }),
  });

  const deletarEvento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('eventos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Evento removido');
      qc.invalidateQueries({ queryKey: ['eventos'] });
    },
  });

  return { ...eventosQuery, criarEvento, editarEvento, salvarPerguntas, toggleEvento, deletarEvento };
}

export function useMarcarInscricaoPaga() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ inscricaoId, pago }: { inscricaoId: string; pago: boolean }) => {
      const { error } = await supabase
        .from('evento_inscricoes')
        .update({ pago } as any)
        .eq('id', inscricaoId);
      if (error) throw error;
    },
    onSuccess: (_, { pago }) => {
      toast.success(pago ? 'Pagamento confirmado!' : 'Pagamento desmarcado');
      qc.invalidateQueries({ queryKey: ['evento-detalhe'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useEventoDetalhe(eventoId: string | null) {
  return useQuery({
    queryKey: ['evento-detalhe', eventoId],
    queryFn: async () => {
      const [{ data: perguntas }, { data: inscricoes }] = await Promise.all([
        supabase.from('evento_perguntas').select('*').eq('evento_id', eventoId!).order('ordem') as any,
        supabase.from('evento_inscricoes').select('*').eq('evento_id', eventoId!).order('created_at', { ascending: false }) as any,
      ]);
      return {
        perguntas: (perguntas || []) as EventoPergunta[],
        inscricoes: (inscricoes || []) as EventoInscricao[],
      };
    },
    enabled: !!eventoId,
  });
}

export function useEventoRespostas(inscricaoId: string | null) {
  return useQuery({
    queryKey: ['evento-respostas', inscricaoId],
    queryFn: async () => {
      const { data } = await supabase
        .from('evento_respostas')
        .select('*')
        .eq('inscricao_id', inscricaoId!) as any;
      return data || [];
    },
    enabled: !!inscricaoId,
  });
}
