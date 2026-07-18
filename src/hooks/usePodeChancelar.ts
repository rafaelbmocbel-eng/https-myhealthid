import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLenteAtiva, type PerfilProfissional } from './useLenteAtiva';
import { useClinicaContext } from './useClinicaContext';

// Conta principal (fundador) — pode dar a chancela em qualquer área,
// independentemente do perfil profissional. É a conta que criou a plataforma.
const CONTA_PRINCIPAL = 'rafaelbmocbel@gmail.com';

// A CHANCELA (liberar/enviar um plano ao paciente) é ato do profissional
// habilitado: plano de treino/personal → Educador Físico; plano nutricional →
// Nutricionista; plano de fisioterapia → Fisioterapeuta. Gerar rascunho é livre;
// só a LIBERAÇÃO exige o profissional certo — ou uma clínica que tenha esse
// profissional ativo lá dentro (a clínica dá a chancela pela sua equipe).
export type AreaChancela = 'treino' | 'nutricao' | 'fisioterapia';

const PERFIL_EXIGIDO: Record<AreaChancela, PerfilProfissional> = {
  treino: 'educador_fisico',
  nutricao: 'nutricionista',
  fisioterapia: 'fisioterapeuta',
};

const LABEL: Record<AreaChancela, string> = {
  treino: 'Educador Físico',
  nutricao: 'Nutricionista',
  fisioterapia: 'Fisioterapeuta',
};

export interface Chancela {
  pode: boolean;
  motivo: string;      // por que pode (via clínica) ou por que não pode
  loading: boolean;
  labelExigido: string;
  viaClinica: boolean; // liberado porque a clínica tem o profissional, não o próprio
}

export function usePodeChancelar(area: AreaChancela): Chancela {
  const { user } = useAuth();
  const { data: lente, isLoading: lLoading } = useLenteAtiva();
  const { clinica, isSolo, loading: cLoading } = useClinicaContext();
  const exigido = PERFIL_EXIGIDO[area];
  const clinicaId = clinica?.id;
  const ehContaPrincipal = (user?.email || '').trim().toLowerCase() === CONTA_PRINCIPAL;

  // A clínica ativa tem ALGUM profissional do tipo exigido, ativo?
  // Lê só clinica_membros (legível dentro da clínica) — a coluna perfil_profissional
  // do membro é a fonte; se estiver vazia, o fallback é o próprio perfil.
  const { data: clinicaTem, isLoading: qLoading } = useQuery({
    queryKey: ['clinica-tem-perfil', clinicaId, exigido],
    enabled: !!clinicaId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await (supabase as any).from('clinica_membros')
        .select('perfil_profissional')
        .eq('clinica_id', clinicaId).eq('status', 'ativo');
      return (data || []).some((m: any) => m.perfil_profissional === exigido);
    },
  });

  // Conta principal não espera nenhuma query — sempre pode.
  if (ehContaPrincipal) {
    return { pode: true, motivo: '', loading: false, labelExigido: LABEL[area], viaClinica: false };
  }

  const loading = lLoading || cLoading || (!!clinicaId && qLoading);
  const ehProprio = lente?.id === exigido;
  const viaClinica = !ehProprio && clinicaTem === true;
  const pode = ehProprio || viaClinica;

  let motivo = '';
  if (pode && viaClinica) {
    motivo = `Liberado pela clínica (tem ${LABEL[area]} ativo na equipe).`;
  } else if (!pode) {
    motivo = clinicaId
      ? `Só um ${LABEL[area]} pode liberar este plano — nenhum ativo na clínica.`
      : isSolo
        ? `Só um ${LABEL[area]} pode liberar este plano. Ajuste seu perfil em Configurações se for o caso.`
        : `Só um ${LABEL[area]} pode liberar este plano.`;
  }

  return { pode, motivo, loading, labelExigido: LABEL[area], viaClinica };
}
