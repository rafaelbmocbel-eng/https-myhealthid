import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type PacoteResumo = {
  created_at: string;
  data_fim: string | null;
  data_inicio: string | null;
  nome: string | null;
  sessoes_utilizadas: number;
  total_sessoes: number;
} | null;

export function usePatientSessionStats(pacienteId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => ['patient-session-stats', user?.id, pacienteId] as const,
    [user?.id, pacienteId],
  );

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
          .select('total_sessoes, sessoes_utilizadas, nome, data_inicio, data_fim, created_at')
          .eq('paciente_id', pacienteId!)
          .eq('terapeuta_id', user!.id)
          .eq('status', 'ativo')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (sessoesRes.error) throw sessoesRes.error;
      if (pacoteRes.error) throw pacoteRes.error;

      const pacoteData = (pacoteRes.data ?? null) as PacoteResumo;
      let pacote = pacoteData;

      if (pacoteData) {
        const inicioPacote = pacoteData.data_inicio ?? pacoteData.created_at.slice(0, 10);
        const sessoesPacoteRes = await supabase
          .from('controle_sessoes')
          .select('id', { count: 'exact', head: true })
          .eq('paciente_id', pacienteId!)
          .eq('terapeuta_id', user!.id)
          .eq('status', 'realizada')
          .gte('data_sessao', inicioPacote);

        if (sessoesPacoteRes.error) throw sessoesPacoteRes.error;

        pacote = {
          ...pacoteData,
          sessoes_utilizadas: Math.min(
            pacoteData.total_sessoes,
            sessoesPacoteRes.count ?? pacoteData.sessoes_utilizadas,
          ),
        };
      }

      return {
        totalSessoes: sessoesRes.count ?? 0,
        pacote,
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
  }, [pacienteId, queryClient, queryKey, user?.id]);

  const pacote = query.data?.pacote ?? null;

  return {
    ...query,
    totalSessoes: query.data?.totalSessoes ?? 0,
    pacote,
    sessoesRestantes: pacote ? Math.max(0, pacote.total_sessoes - pacote.sessoes_utilizadas) : null,
  };
}