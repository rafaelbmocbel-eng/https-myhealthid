import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Evento {
  id: string;
  terapeuta_id: string;
  titulo: string;
  descricao: string | null;
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
}

export interface EventoPergunta {
  id: string;
  evento_id: string;
  ordem: number;
  tipo: 'text' | 'multiple_choice' | 'scale' | 'boolean';
  pergunta: string;
  opcoes: string[];
  obrigatoria: boolean;
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
  const { user } = useAuth();
  const qc = useQueryClient();

  const eventosQuery = useQuery({
    queryKey: ['eventos', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eventos')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('data_evento', { ascending: false });
      if (error) throw error;
      return data as unknown as Evento[];
    },
    enabled: !!user,
  });

  const criarEvento = useMutation({
    mutationFn: async (evento: Omit<Evento, 'id' | 'terapeuta_id' | 'created_at'> & { perguntas: Omit<EventoPergunta, 'id' | 'evento_id'>[] }) => {
      const { perguntas, ...eventoData } = evento;
      const { data, error } = await supabase
        .from('eventos')
        .insert({ ...eventoData, terapeuta_id: user!.id } as any)
        .select('id')
        .single();
      if (error) throw error;

      if (perguntas.length > 0) {
        const rows = perguntas.map((p, i) => ({
          evento_id: data.id,
          ordem: i + 1,
          tipo: p.tipo,
          pergunta: p.pergunta,
          opcoes: p.opcoes || [],
          obrigatoria: p.obrigatoria,
        }));
        await supabase.from('evento_perguntas').insert(rows as any);
      }
      return data;
    },
    onSuccess: () => {
      toast.success('Evento criado com sucesso!');
      qc.invalidateQueries({ queryKey: ['eventos'] });
    },
    onError: (e: any) => toast.error(e.message),
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

  return { ...eventosQuery, criarEvento, toggleEvento, deletarEvento };
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
