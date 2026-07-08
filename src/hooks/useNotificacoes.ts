import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { withAuthLockRetry } from '@/lib/authLock';

export interface Notificacao {
  id: string;
  terapeuta_id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  lida: boolean;
  rota: string | null;
  metadata: Record<string, string>;
  created_at: string;
}

export function useNotificacoes() {
  const { user, authReady } = useAuth();
  const qc = useQueryClient();

  const { data: notificacoes = [], isLoading } = useQuery({
    queryKey: ['notificacoes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await withAuthLockRetry(async () =>
        await supabase
          .from('notificacoes')
          .select('*')
          .eq('terapeuta_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50)
      );
      if (error) throw error;
      return (data ?? []) as Notificacao[];
    },
    enabled: authReady && !!user,
  });

  const naoLidas = notificacoes.filter(n => !n.lida).length;

  const marcarLida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificacoes'] }),
  });

  const marcarTodasLidas = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('terapeuta_id', user.id)
        .eq('lida', false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificacoes'] }),
  });

  const gerarAlertas = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const now = new Date();
      const alerts: Omit<Notificacao, 'id' | 'created_at'>[] = [];

      // 1. Resumo de atendimentos por bloco do dia
      // Manhã → aviso no almoço (12:00–13:00)
      // Tarde → aviso no final do expediente (17:00+)
      const MIDDAY = 12 * 60;
      const MIDDAY_END = 13 * 60;
      const TARDE = 17 * 60;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      const isMiddayWindow = nowMinutes >= MIDDAY && nowMinutes < MIDDAY_END;
      const isEndOfDayWindow = nowMinutes >= TARDE;

      if (isMiddayWindow || isEndOfDayWindow) {
        const hojeInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const hojeFim = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        const { data: hoje } = await supabase
          .from('agendamentos')
          .select('id, titulo, data_inicio, paciente_id, status')
          .eq('terapeuta_id', user.id)
          .gte('data_inicio', hojeInicio.toISOString())
          .lte('data_inicio', hojeFim.toISOString())
          .in('status', ['confirmado', 'pendente', 'agendado']);

        const manhã = (hoje ?? []).filter(a => new Date(a.data_inicio).getHours() < 12);
        const tarde = (hoje ?? []).filter(a => new Date(a.data_inicio).getHours() >= 12);

        if (isMiddayWindow && manhã.length > 0) {
          alerts.push({
            terapeuta_id: user.id,
            tipo: 'consulta_manha',
            titulo: '☀️ Resumo da manhã',
            descricao: `${manhã.length} atendimento${manhã.length > 1 ? 's' : ''} da manhã — confirme o status na agenda`,
            lida: false,
            rota: '/agenda',
            metadata: {},
          });
        }

        if (isEndOfDayWindow && tarde.length > 0) {
          alerts.push({
            terapeuta_id: user.id,
            tipo: 'consulta_tarde',
            titulo: '🌆 Resumo da tarde',
            descricao: `${tarde.length} atendimento${tarde.length > 1 ? 's' : ''} da tarde — confirme o status na agenda`,
            lida: false,
            rota: '/agenda',
            metadata: {},
          });
        }
      }

      // 2. Questionários MyID pendentes há mais de 3 dias
      const tresDias = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const { data: pendentes } = await supabase
        .from('myid_avaliacoes')
        .select('id, paciente_id, created_at')
        .eq('terapeuta_id', user.id)
        .eq('status', 'pendente')
        .lte('created_at', tresDias.toISOString())
        .limit(5);

      if (pendentes && pendentes.length > 0) {
        alerts.push({
          terapeuta_id: user.id,
          tipo: 'questionario',
          titulo: '📋 Questionários sem resposta',
          descricao: `${pendentes.length} questionário(s) pendente(s) há mais de 3 dias`,
          lida: false,
          rota: '/pacientes',
          metadata: {},
        });
      }

      // 3. NPS recebidos hoje
      const hojeInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const { count: npsHoje } = await supabase
        .from('pesquisas_nps')
        .select('id', { count: 'exact', head: true })
        .eq('terapeuta_id', user.id)
        .gte('created_at', hojeInicio.toISOString());

      if (npsHoje && npsHoje > 0) {
        alerts.push({
          terapeuta_id: user.id,
          tipo: 'nps',
          titulo: '⭐ Novo feedback NPS',
          descricao: `Você recebeu ${npsHoje} avaliação(ões) hoje`,
          lida: false,
          rota: '/relatorios',
          metadata: {},
        });
      }

      // Only insert if we have new alerts and none matching today already
      if (alerts.length > 0) {
        const { data: existing } = await supabase
          .from('notificacoes')
          .select('tipo')
          .eq('terapeuta_id', user.id)
          .gte('created_at', hojeInicio.toISOString());

        const existingTypes = new Set(existing?.map(e => e.tipo) ?? []);
        const newAlerts = alerts.filter(a => !existingTypes.has(a.tipo));

        if (newAlerts.length > 0) {
          await supabase.from('notificacoes').insert(newAlerts);
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notificacoes'] }),
  });

  return { notificacoes, naoLidas, isLoading, marcarLida, marcarTodasLidas, gerarAlertas };
}
