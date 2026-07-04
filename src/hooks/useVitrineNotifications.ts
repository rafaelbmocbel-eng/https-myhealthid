import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useVitrineNotifications() {
  const { user } = useAuth();

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['vitrine-pendentes-count', user?.id],
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('solicitacoes_conexao')
        .select('id', { count: 'exact', head: true })
        .eq('terapeuta_id', user!.id)
        .eq('status', 'pendente');
      if (error) return 0;
      return count ?? 0;
    },
  });

  return { pendingCount };
}
