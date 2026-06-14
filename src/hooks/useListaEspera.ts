import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ItemListaEspera {
  id: string;
  terapeuta_id: string;
  paciente_id?: string | null;
  nome_contato: string;
  telefone: string;
  data_preferida?: string | null;
  horario_preferido_inicio?: string | null;
  horario_preferido_fim?: string | null;
  tipo_atendimento: string;
  observacoes?: string | null;
  prioridade: number;
  notificado_em?: string | null;
  status: 'aguardando' | 'notificado' | 'agendou' | 'desistiu';
  created_at: string;
  pacientes?: { nome: string; sobrenome: string; telefone?: string } | null;
}

export function useListaEspera() {
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['agenda_lista_espera'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agenda_lista_espera')
        .select('*, pacientes(nome, sobrenome, telefone)')
        .in('status', ['aguardando', 'notificado'])
        .order('prioridade', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ItemListaEspera[];
    },
  });

  const adicionar = useMutation({
    mutationFn: async (item: Omit<ItemListaEspera, 'id' | 'terapeuta_id' | 'status' | 'created_at' | 'prioridade' | 'notificado_em' | 'pacientes'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const { error } = await supabase.from('agenda_lista_espera').insert({
        ...item,
        terapeuta_id: user.id,
        status: 'aguardando',
        prioridade: (data?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agenda_lista_espera'] }); toast.success('Adicionado à lista de espera'); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  const notificar = useMutation({
    mutationFn: async ({ id, telefone, nome }: { id: string; telefone: string; nome: string }) => {
      const msg = encodeURIComponent(`Olá ${nome}! Temos um horário disponível. Gostaria de agendar? Responda SIM para confirmar ou entre em contato.`);
      window.open(`https://wa.me/55${telefone.replace(/\D/g, '')}?text=${msg}`, '_blank');
      const { error } = await supabase.from('agenda_lista_espera')
        .update({ status: 'notificado', notificado_em: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agenda_lista_espera'] }); toast.success('Notificação enviada'); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  const remover = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'agendou' | 'desistiu' }) => {
      const { error } = await supabase.from('agenda_lista_espera').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agenda_lista_espera'] }); toast.success('Atualizado'); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  return { data, isLoading, adicionar, notificar, remover };
}

export function useSalaEspera(terapeuta_id?: string) {
  const qc = useQueryClient();
  const hoje = new Date().toISOString().slice(0, 10);

  const { data = [], isLoading } = useQuery({
    queryKey: ['sala_espera', hoje],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*, pacientes(nome, sobrenome, telefone)')
        .gte('data_inicio', `${hoje}T00:00:00`)
        .lte('data_inicio', `${hoje}T23:59:59`)
        .in('status', ['confirmado', 'pendente'])
        .order('data_inicio', { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    refetchInterval: 30_000,
  });

  const checkIn = useMutation({
    mutationFn: async (agendamentoId: string) => {
      const { error } = await supabase.from('agendamentos')
        .update({ checked_in_em: new Date().toISOString() })
        .eq('id', agendamentoId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sala_espera'] }); toast.success('Check-in registrado'); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  const desfazerCheckIn = useMutation({
    mutationFn: async (agendamentoId: string) => {
      const { error } = await supabase.from('agendamentos')
        .update({ checked_in_em: null })
        .eq('id', agendamentoId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sala_espera'] }); },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  const aguardando = data.filter((a: any) => a.checked_in_em);
  const semCheckIn = data.filter((a: any) => !a.checked_in_em);

  return { data, aguardando, semCheckIn, isLoading, checkIn, desfazerCheckIn };
}
