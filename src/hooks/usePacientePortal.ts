import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface PacientePortal {
  id: string;
  terapeuta_id: string | null;
  nome: string;
  sobrenome: string | null;
  email: string | null;
  telefone: string | null;
  data_nascimento: string | null;
  avatar_url: string | null;
}

const CAMPOS = 'id, terapeuta_id, nome, sobrenome, email, telefone, data_nascimento, avatar_url';

/**
 * Registro do paciente logado, compartilhado por todas as páginas do portal.
 *
 * Substitui o padrão frágil `useEffect + .then()` (que deixava o paciente em
 * spinner infinito quando a rede falhava): React Query dá retry automático,
 * refetch ao reconectar e cache entre navegações — trocar de aba no portal
 * não refaz a busca.
 */
export function usePacientePortal() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['paciente-portal', user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<PacientePortal | null> => {
      const { data, error } = await supabase
        .from('pacientes')
        .select(CAMPOS)
        .eq('user_id', user!.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as PacientePortal | null;
    },
  });

  return {
    paciente: query.data ?? null,
    isLoading: !!user && query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    /** Atualiza o cache local (ex.: avatar trocado) sem refazer o fetch. */
    updateCache: (patch: Partial<PacientePortal>) => {
      qc.setQueryData<PacientePortal | null>(['paciente-portal', user?.id], (old) =>
        old ? { ...old, ...patch } : old,
      );
    },
  };
}
