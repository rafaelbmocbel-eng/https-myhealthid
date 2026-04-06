import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type PacoteResumo = {
  nome: string | null;
  sessoes_utilizadas: number;
  total_sessoes: number;
} | null;

export function usePatientSessionStats(pacienteId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['patient-session-stats', user?.id, pacienteId] as const;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const [sessoesRes, pacoteRes] = await Promise.all([
        supabase
          .from('controle_sessoes')
          .select('id', { count: 'exact', head: true })
          .eq('paciente_id', pacienteId!)
          .eq('terapeuta_id', user!.id)
          .eq('status', 'realizada'),
        supabase
          .from('pacotes_sessoes')
          .select('total_sessoes, sessoes_utilizadas, nome')
          .eq('paciente_id', pacienteId!)
          .eq('terapeuta_id', user!.id)
          .eq('status', 'ativo')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (sessoesRes.error) throw sessoesRes.error;
      if (pacoteRes.error) throw pacoteRes.error;

      return {
        totalSessoes: sessoesRes.count ?? 0,
        pacote: (pacoteRes.data ?? null) as PacoteResumo,
      };
    },
    enabled: !!user?.id && !!pacienteId,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!user?.id || !pacienteId) return;

    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey });
    };

    const channel = supabase
      .channel(`patient-session-stats:${user.id}:${pacienteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'controle_sessoes',
          filter: `paciente_id=eq.${pacienteId}`,
        },
        invalidate,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pacotes_sessoes',
          filter: `paciente_id=eq.${pacienteId}`,
        },
        invalidate,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [pacienteId, queryClient, user?.id, queryKey]);

  const pacote = query.data?.pacote ?? null;

  return {
    ...query,
    totalSessoes: query.data?.totalSessoes ?? 0,
    pacote,
    sessoesRestantes: pacote ? Math.max(0, pacote.total_sessoes - pacote.sessoes_utilizadas) : null,
  };
}