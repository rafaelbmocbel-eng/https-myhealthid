import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Paciente {
  id: string;
  nome: string;
  sobrenome: string;
  email?: string;
  telefone?: string;
  data_nascimento?: string;
  genero?: string;
  cpf?: string;
  endereco?: string;
  observacoes?: string;
  ativo: boolean;
  created_at: string;
  terapeuta_id: string;
}

export interface PacienteServico {
  id: string;
  paciente_id: string;
  servico: string;
  ativo: boolean;
}

export function usePacientes(filtroServico?: string) {
  const { user } = useAuth();

  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ['pacientes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data as Paciente[];
    },
    enabled: !!user,
  });

  const { data: servicos = [] } = useQuery({
    queryKey: ['paciente_servicos', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paciente_servicos')
        .select('*')
        .eq('ativo', true);
      if (error) throw error;
      return data as PacienteServico[];
    },
    enabled: !!user,
  });

  const getServicosForPaciente = (pid: string) =>
    servicos.filter(s => s.paciente_id === pid).map(s => s.servico);

  const filtered = filtroServico && filtroServico !== 'todos'
    ? pacientes.filter(p => getServicosForPaciente(p.id).includes(filtroServico))
    : pacientes;

  return { pacientes: filtered, allPacientes: pacientes, servicos, getServicosForPaciente, isLoading };
}
