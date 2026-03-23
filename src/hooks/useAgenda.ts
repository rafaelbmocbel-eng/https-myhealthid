import { useState, useEffect, useCallback } from 'react';
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
  pacientes?: Paciente;
}

export interface ConfigAgenda {
  id?: string;
  horario_inicio: string;
  horario_fim: string;
  duracao_padrao: number;
  dias_semana: Record<string, boolean>;
  intervalo_entre_sessoes: number;
  vagas_por_horario: number;
}

const DEFAULT_CONFIG: ConfigAgenda = {
  horario_inicio: '06:00:00',
  horario_fim: '20:00:00',
  duracao_padrao: 60,
  dias_semana: { seg: true, ter: true, qua: true, qui: true, sex: true, sab: false, dom: false },
  intervalo_entre_sessoes: 0,
  vagas_por_horario: 1,
};

export function useAgenda() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [config, setConfig] = useState<ConfigAgenda>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
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
  }, [user, toast]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

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

    const { data: existingConfig } = await supabase
      .from('config_agenda')
      .select('servicos_ativos')
      .eq('terapeuta_id', user.id)
      .maybeSingle();

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
    updateAgendamento,
    deleteAgendamento,
    createPaciente,
    saveConfig,
    refresh: fetchAll,
  };
}
