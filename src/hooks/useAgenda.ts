import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { withAuthLockRetry } from '@/lib/authLock';

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
    if (!user) return;
    setLoading(true);
    const [agResult, pacResult, cfgResult] = await Promise.all([
      withAuthLockRetry(async () =>
        await supabase
          .from('agendamentos')
          .select('*, pacientes(id, nome, sobrenome, email, telefone, ativo)')
          .eq('terapeuta_id', user.id)
          .order('data_inicio')
      , 1, 250),
      withAuthLockRetry(async () =>
        await supabase.from('pacientes').select('*').eq('terapeuta_id', user.id).eq('ativo', true).order('nome')
      , 1, 250),
      withAuthLockRetry(async () =>
        await supabase.from('config_agenda').select('*').eq('terapeuta_id', user.id).maybeSingle()
      , 1, 250),
    ]);

    if (agResult.error) console.error('[useAgenda] agendamentos error:', agResult.error);
    if (pacResult.error) console.error('[useAgenda] pacientes error:', pacResult.error);

    setAgendamentos((agResult.data as Agendamento[]) || []);
    setPacientes((pacResult.data as Paciente[]) || []);
    if (cfgResult.data) setConfig(cfgResult.data as ConfigAgenda);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createAgendamento = async (data: Omit<Agendamento, 'id'>) => {
    if (!user) return;
    const { error } = await withAuthLockRetry(async () =>
      await supabase.from('agendamentos').insert({ ...data, terapeuta_id: user.id })
    , 1, 250);
    if (error) { toast({ title: 'Erro ao agendar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Agendamento criado! ✅' });
    await fetchAll();
  };

  const updateAgendamento = async (id: string, data: Partial<Agendamento>) => {
    const { error } = await withAuthLockRetry(async () =>
      await supabase.from('agendamentos').update(data).eq('id', id)
    , 1, 250);
    if (error) { toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' }); return; }
    await fetchAll();
  };

  const deleteAgendamento = async (id: string) => {
    const { error } = await withAuthLockRetry(async () =>
      await supabase.from('agendamentos').delete().eq('id', id)
    , 1, 250);
    if (error) { toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Agendamento removido' });
    await fetchAll();
  };

  const createPaciente = async (data: Omit<Paciente, 'id' | 'ativo'>) => {
    if (!user) return null;
    const { data: novo, error } = await withAuthLockRetry(async () =>
      await supabase.from('pacientes').insert({ ...data, terapeuta_id: user.id }).select().single()
    , 1, 250);
    if (error) { toast({ title: 'Erro ao cadastrar paciente', description: error.message, variant: 'destructive' }); return null; }
    await fetchAll();
    return novo as Paciente;
  };

  const saveConfig = async (cfg: ConfigAgenda) => {
    if (!user) return;
    const payload = { ...cfg, terapeuta_id: user.id };
    const { error } = cfg.id
      ? await withAuthLockRetry(async () => await supabase.from('config_agenda').update(payload).eq('id', cfg.id), 1, 250)
      : await withAuthLockRetry(async () => await supabase.from('config_agenda').insert(payload), 1, 250);
    if (error) { toast({ title: 'Erro ao salvar configuração', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Configurações salvas! ✅' });
    await fetchAll();
  };

  return { agendamentos, pacientes, config, loading, createAgendamento, updateAgendamento, deleteAgendamento, createPaciente, saveConfig, refresh: fetchAll };
}
