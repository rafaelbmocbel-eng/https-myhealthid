import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { withAuthLockRetry } from '@/lib/authLock';

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
  servicos?: string[];
  portal_token?: string | null;
}

export interface PacienteServico {
  id: string;
  paciente_id: string;
  servico: string;
  ativo: boolean;
}

export function usePacientes(filtroServico?: string) {
  const { user, authReady } = useAuth();

  // Busca pacientes com seus serviços em uma única query JOIN
  const { data: pacientesRaw = [], isLoading } = useQuery({
    queryKey: ['pacientes-com-servicos', user?.id],
    queryFn: async () => {
      return withAuthLockRetry(async () => {
        const { data, error } = await supabase
          .from('pacientes')
          .select('*, paciente_servicos(id, servico, ativo, paciente_id)')
          .eq('terapeuta_id', user!.id)
          .eq('ativo', true)
          .order('nome');

        if (error) throw error;
        return data || [];
      }, { maxAttempts: 4, baseDelayMs: 300 });
    },
    enabled: authReady && !!user,
  });

  // Normaliza os dados: extrai a lista de serviços ativos para cada paciente
  interface PacienteRaw {
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
    portal_token?: string | null;
    paciente_servicos?: PacienteServico[];
  }

  const allPacientes: Paciente[] = (pacientesRaw as PacienteRaw[]).map((p) => ({
    ...p,
    servicos: (p.paciente_servicos || [])
      .filter((s) => s.ativo)
      .map((s) => s.servico),
  }));

  // Monta lista de serviços para compatibilidade
  const servicos: PacienteServico[] = (pacientesRaw as PacienteRaw[]).flatMap((p) =>
    (p.paciente_servicos || []).map((s) => s)
  );

  const getServicosForPaciente = (pid: string): string[] => {
    const p = allPacientes.find((x) => x.id === pid);
    return p?.servicos || [];
  };

  // Se o filtro for 'metodo_identidade' ou 'cob_zero' mas nenhum paciente tem esses serviços,
  // mostramos todos os pacientes ativos (fluxo simplificado — terapeuta vê todos)
  // Todos os pacientes ficam disponíveis em todos os serviços
  const pacientes = allPacientes;

  return { pacientes, allPacientes, servicos, getServicosForPaciente, isLoading };
}
