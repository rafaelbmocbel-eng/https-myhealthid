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

  // Acesso clínico (paciente vinculado a profissional)
  const acessoClinico = (data?.acesso_clinico as 'ativo' | 'carencia' | 'bloqueado' | undefined) ?? 'ativo';
  const acessoClinicoExpiraEm = data?.acesso_clinico_expira_em as string | undefined;
  const diasRestantesCarencia = (data?.dias_restantes_carencia as number | null | undefined) ?? null;
  const emCarencia = isClinico && acessoClinico === 'carencia';
  const bloqueadoClinico = isClinico && acessoClinico === 'bloqueado';
  const podeReceberAtividadesNovas = !isClinico || acessoClinico === 'ativo';

  const trialAte = data?.trial_ate as string | undefined;
  const isInTrial = !!data?.is_in_trial;
  const trialDiasRestantes = trialAte
    ? Math.max(0, Math.ceil((new Date(trialAte).getTime() - Date.now()) / 86_400_000))
    : 0;

  // Consulta mensal NÃO entra no trial (só Premium pago)
  const TRIAL_EXCLUDED: WellnessFeature[] = ['consulta_mensal'];

  const hasFeature = (feature: WellnessFeature): boolean => {
    if (isClinico || isPremium) return true;
    if (isFree) {
      if (FREE_FEATURES.includes(feature)) return true;
      if (isInTrial && !TRIAL_EXCLUDED.includes(feature)) return true;
      return false;
    }
    return false;
  };

  return {
    isLoading,
    tipoConta,
    isClinico,
    isFree,
    isPremium,
    isWellness,
    isInTrial,
    trialAte,
    trialDiasRestantes,
    hasFeature,
    pacienteId: data?.paciente_id as string | undefined,
    consultaMensalDisponivel: !!data?.consulta_mensal_disponivel,
    proximaCobranca: data?.proxima_cobranca as string | undefined,
  };
}
