import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type WellnessFeature =
  | 'myid'
  | 'missoes_basicas'
  | 'missoes_avancadas'
  | 'exercicios_full'
  | 'protocolo_ansiedade'
  | 'chat'
  | 'consulta_mensal'
  | 'eventos_premium';

const FREE_FEATURES: WellnessFeature[] = ['myid', 'missoes_basicas'];

export function useWellnessAccess() {
  const { user, authReady } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['wellness-status', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_wellness_status');
      if (error) throw error;
      return (data && data[0]) || null;
    },
    enabled: authReady && !!user,
    staleTime: 60_000,
  });

  const tipoConta = (data?.tipo_conta as 'clinico' | 'wellness_free' | 'wellness_premium' | undefined) ?? 'clinico';
  const isClinico = tipoConta === 'clinico';
  const isFree = tipoConta === 'wellness_free';
  const isPremium = tipoConta === 'wellness_premium';
  const isWellness = isFree || isPremium;

  const hasFeature = (feature: WellnessFeature): boolean => {
    if (isClinico || isPremium) return true;
    if (isFree) return FREE_FEATURES.includes(feature);
    return false;
  };

  return {
    isLoading,
    tipoConta,
    isClinico,
    isFree,
    isPremium,
    isWellness,
    hasFeature,
    pacienteId: data?.paciente_id as string | undefined,
    consultaMensalDisponivel: !!data?.consulta_mensal_disponivel,
    proximaCobranca: data?.proxima_cobranca as string | undefined,
  };
}
