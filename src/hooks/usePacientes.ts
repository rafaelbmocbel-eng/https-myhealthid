import { useQuery } from '@tanstack/react-query';
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

  // Busca todos os pacientes ativos do terapeuta
  const { data: allPacientes = [], isLoading } = useQuery({
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

  // Busca serviços — RLS garante apenas pacientes do terapeuta logado
  const { data: servicos = [] } = useQuery({
    queryKey: ['paciente_servicos', user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Busca apenas serviços dos pacientes do terapeuta via subquery nos IDs
      const pacienteIds = allPacientes.map(p => p.id);
      if (pacienteIds.length === 0) return [];
      const { data, error } = await supabase
        .from('paciente_servicos')
        .select('*')
        .in('paciente_id', pacienteIds)
        .eq('ativo', true);
      if (error) throw error;
      return (data || []) as PacienteServico[];
    },
    enabled: !!user && allPacientes.length > 0,
  });

  const getServicosForPaciente = (pid: string) =>
    servicos.filter(s => s.paciente_id === pid).map(s => s.servico);

  const pacientes = filtroServico && filtroServico !== 'todos'
    ? allPacientes.filter(p => getServicosForPaciente(p.id).includes(filtroServico))
    : allPacientes;

  return { pacientes, allPacientes, servicos, getServicosForPaciente, isLoading };
}

