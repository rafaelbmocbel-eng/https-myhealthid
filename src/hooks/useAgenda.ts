import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { isAuthLockTimeoutError, withAuthLockRetry } from '@/lib/authLock';
import { DEFAULT_SERVICOS } from '@/hooks/useServicosAtivos';

export interface Paciente {
  id: string;
  nome: string;
  sobrenome: string;
  email?: string;
  telefone?: string;
  ativo: boolean;
}

export interface Agendamento {
  id: string;
  paciente_id?: string;
  titulo?: string;
  data_inicio: string;
  data_fim: string;
  status: 'confirmado' | 'pendente' | 'bloqueado' | 'concluido' | 'cancelado' | 'faltou';
  tipo_atendimento?: string;
  observacoes?: string;
  cor?: string;
  recorrencia_grupo_id?: string;
  pacientes?: Paciente;
}

export interface TurnoBloco {
  inicio: string; // HH:MM
  fim: string;    // HH:MM
}

export type TurnosPorDia = Partial<Record<'seg'|'ter'|'qua'|'qui'|'sex'|'sab'|'dom', TurnoBloco[]>>;

export interface ConfigAgenda {
  id?: string;
  horario_inicio: string;
  horario_fim: string;
  duracao_padrao: number;
  dias_semana: Record<string, boolean>;
  intervalo_entre_sessoes: number;
  vagas_por_horario: number;
  slug?: string;
  turnos?: TurnosPorDia;
}

const DEFAULT_CONFIG: ConfigAgenda = {
  horario_inicio: '06:00:00',
  horario_fim: '20:00:00',
  duracao_padrao: 60,
  dias_semana: { seg: true, ter: true, qua: true, qui: true, sex: true, sab: false, dom: false },
  intervalo_entre_sessoes: 0,
  vagas_por_horario: 1,
  turnos: {},
};

export function useAgenda() {
  const { user, authReady } = useAuth();
  const { toast } = useToast();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [config, setConfig] = useState<ConfigAgenda>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const refreshTimeoutRef = useRef<number | null>(null);

  const fetchAll = useCallback(async () => {
    if (!authReady) return;
    if (!user) {
      setAgendamentos([]);
      setPacientes([]);
      setConfig(DEFAULT_CONFIG);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [agResult, pacResult, cfgResult] = await withAuthLockRetry(async () => {
        const results = await Promise.all([
          supabase
            .from('agendamentos')
            .select('*, pacientes(id, nome, sobrenome, email, telefone, ativo)')
            .eq('terapeuta_id', user.id)
            .order('data_inicio'),
          supabase.from('pacientes').select('*').eq('terapeuta_id', user.id).eq('ativo', true).order('nome'),
          supabase.from('config_agenda').select('*').eq('terapeuta_id', user.id).maybeSingle(),
        ]);

        const lockError = results.map((result) => result.error).find((error) => isAuthLockTimeoutError(error));
        if (lockError) throw lockError;

        return results;
      }, { maxAttempts: 4, baseDelayMs: 300 });

      if (agResult.error) console.error('[useAgenda] agendamentos error:', agResult.error);
      if (pacResult.error) console.error('[useAgenda] pacientes error:', pacResult.error);
      if (cfgResult.error) console.error('[useAgenda] config error:', cfgResult.error);

      setAgendamentos((agResult.data as Agendamento[]) || []);
      setPacientes((pacResult.data as Paciente[]) || []);
      if (cfgResult.data) setConfig(cfgResult.data as ConfigAgenda);
    } catch (error) {
      console.error('[useAgenda] fetchAll fatal error:', error);
      toast({
        title: isAuthLockTimeoutError(error) ? 'Sessão ocupada em outra aba' : 'Erro ao carregar agenda',
        description: isAuthLockTimeoutError(error)
          ? 'Feche outras abas do sistema e atualize a página.'
          : 'Tente novamente em alguns segundos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, authReady, toast]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!authReady || !user) return;

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = window.setTimeout(() => {
        void fetchAll();
      }, 150);
    };

    const channel = supabase
      .channel(`agenda-sync-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'agendamentos',
        filter: `terapeuta_id=eq.${user.id}`,
      }, scheduleRefresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pacientes',
        filter: `terapeuta_id=eq.${user.id}`,
      }, scheduleRefresh)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'config_agenda',
        filter: `terapeuta_id=eq.${user.id}`,
      }, scheduleRefresh)
      .subscribe();

    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }

      void supabase.removeChannel(channel);
    };
  }, [authReady, user, fetchAll]);

  const createAgendamento = async (data: Omit<Agendamento, 'id'>) => {
    if (!user) return;

    try {
      const { error } = await withAuthLockRetry(async () => {
        return await supabase.from('agendamentos').insert({ ...data, terapeuta_id: user.id });
      });
      if (error) throw error;

      toast({ title: 'Agendamento criado! ✅' });
      await fetchAll();
    } catch (error) {
      toast({
        title: 'Erro ao agendar',
        description: error instanceof Error ? error.message : 'Falha ao criar agendamento.',
        variant: 'destructive',
      });
    }
  };

  const createBatchAgendamentos = async (items: Omit<Agendamento, 'id'>[]) => {
    if (!user || items.length === 0) return;

    try {
      const rows = items.map(d => ({ ...d, terapeuta_id: user.id }));
      const { error } = await withAuthLockRetry(async () => {
        return await supabase.from('agendamentos').insert(rows);
      });
      if (error) throw error;
      await fetchAll();
    } catch (error) {
      toast({
        title: 'Erro ao agendar',
        description: error instanceof Error ? error.message : 'Falha ao criar agendamentos.',
        variant: 'destructive',
      });
    }
  };

  const updateFutureAgendamentos = async (
    grupoId: string,
    fromDate: string,
    data: Partial<Agendamento>,
    shift?: {
      oldStart: string;
      oldEnd: string;
      newStart: string;
      newEnd: string;
    },
  ) => {
    if (!user) return;
    try {
      const { data: futuros, error: fetchError } = await withAuthLockRetry(async () => {
        return await supabase
          .from('agendamentos')
          .select('id, data_inicio, data_fim')
          .eq('recorrencia_grupo_id', grupoId)
          .eq('terapeuta_id', user.id)
          .gte('data_inicio', fromDate)
          .order('data_inicio');
      });

      if (fetchError) throw fetchError;

      const startDeltaMs = shift
        ? new Date(shift.newStart).getTime() - new Date(shift.oldStart).getTime()
        : 0;
      const endDeltaMs = shift
        ? new Date(shift.newEnd).getTime() - new Date(shift.oldEnd).getTime()
        : 0;

      const results = await Promise.all(
        (futuros || []).map((item) => {
          const updatePayload: Partial<Agendamento> = {
            ...data,
            ...(shift
              ? {
                  data_inicio: new Date(new Date(item.data_inicio).getTime() + startDeltaMs).toISOString(),
                  data_fim: new Date(new Date(item.data_fim).getTime() + endDeltaMs).toISOString(),
                }
              : {}),
          };

          return withAuthLockRetry(async () => {
            return await supabase.from('agendamentos').update(updatePayload).eq('id', item.id);
          });
        }),
      );

      const firstError = results.find((result) => result.error)?.error;
      if (firstError) throw firstError;

      await fetchAll();
    } catch (error) {
      toast({
        title: 'Erro ao atualizar',
        description: error instanceof Error ? error.message : 'Falha ao atualizar agendamentos.',
        variant: 'destructive',
      });
    }
  };

  const deleteFutureAgendamentos = async (grupoId: string, fromDate: string) => {
    if (!user) return;
    try {
      const { error } = await withAuthLockRetry(async () => {
        return await supabase
          .from('agendamentos')
          .delete()
          .eq('recorrencia_grupo_id', grupoId)
          .eq('terapeuta_id', user.id)
          .gte('data_inicio', fromDate);
      });
      if (error) throw error;
      toast({ title: 'Agendamentos futuros removidos' });
      await fetchAll();
    } catch (error) {
      toast({
        title: 'Erro ao excluir',
        description: error instanceof Error ? error.message : 'Falha ao excluir agendamentos.',
        variant: 'destructive',
      });
    }
  };

  const updateAgendamento = async (id: string, data: Partial<Agendamento>) => {
    try {
      const { error } = await withAuthLockRetry(async () => {
        return await supabase.from('agendamentos').update(data).eq('id', id);
      });
      if (error) throw error;

      await fetchAll();
    } catch (error) {
      toast({
        title: 'Erro ao atualizar',
        description: error instanceof Error ? error.message : 'Falha ao atualizar agendamento.',
        variant: 'destructive',
      });
    }
  };

  const deleteAgendamento = async (id: string) => {
    try {
      const { error } = await withAuthLockRetry(async () => {
        return await supabase.from('agendamentos').delete().eq('id', id);
      });
      if (error) throw error;

      toast({ title: 'Agendamento removido' });
      await fetchAll();
    } catch (error) {
      toast({
        title: 'Erro ao excluir',
        description: error instanceof Error ? error.message : 'Falha ao excluir agendamento.',
        variant: 'destructive',
      });
    }
  };

  const createPaciente = async (data: Omit<Paciente, 'id' | 'ativo'>) => {
    if (!user) return null;

    try {
      const { data: novo, error } = await withAuthLockRetry(async () => {
        return await supabase.from('pacientes').insert({ ...data, terapeuta_id: user.id }).select().single();
      });

      if (error) throw error;

      await fetchAll();
      return novo as Paciente;
    } catch (error) {
      toast({
        title: 'Erro ao cadastrar paciente',
        description: error instanceof Error ? error.message : 'Falha ao cadastrar paciente.',
        variant: 'destructive',
      });
      return null;
    }
  };

  const saveConfig = async (cfg: ConfigAgenda) => {
    if (!user) return;

    const { data: existingConfig } = await withAuthLockRetry(async () => {
      return await supabase
        .from('config_agenda')
        .select('servicos_ativos')
        .eq('terapeuta_id', user.id)
        .maybeSingle();
    });

    const payload = {
      ...cfg,
      terapeuta_id: user.id,
      servicos_ativos: {
        ...DEFAULT_SERVICOS,
        ...((existingConfig?.servicos_ativos as Record<string, boolean> | null) || {}),
      },
    };

    try {
      const { error } = await withAuthLockRetry(async () => {
        return cfg.id
          ? await supabase.from('config_agenda').update(payload).eq('id', cfg.id)
          : await supabase.from('config_agenda').insert(payload);
      });

      if (error) throw error;

      toast({ title: 'Configurações salvas! ✅' });
      await fetchAll();
    } catch (error) {
      toast({
        title: 'Erro ao salvar configuração',
        description: error instanceof Error ? error.message : 'Falha ao salvar configuração da agenda.',
        variant: 'destructive',
      });
    }
  };

  return {
    agendamentos,
    pacientes,
    config,
    loading,
    createAgendamento,
    createBatchAgendamentos,
    updateAgendamento,
    updateFutureAgendamentos,
    deleteAgendamento,
    deleteFutureAgendamentos,
    createPaciente,
    saveConfig,
    refresh: fetchAll,
  };
}
