import { useQuery } from '@tanstack/react-query';
import { useLenteAtiva, type PerfilProfissional } from './useLenteAtiva';
import { useClinicaContext } from './useClinicaContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// A CHANCELA (liberar/enviar um plano ao paciente) é ato do profissional
// habilitado: plano de treino/personal → Educador Físico; plano nutricional →
// Nutricionista; plano de reabilitação/fisioterapia → Fisioterapeuta; plano
// médico/medicamentoso → Médico. Gerar rascunho é livre; só a LIBERAÇÃO exige o
// profissional certo — CADA profissional libera apenas a SUA área (inclusive
// dentro de uma clínica com vários profissionais). Exceção: a(s) conta(s)
// super-admin (do dono do produto) liberam qualquer área.

// Super-admin global (libera todas as áreas). Editar aqui para adicionar contas.
const SUPER_ADMINS = ['rafaelbmocbel@gmail.com'];
export type AreaChancela =
  | 'treino' | 'nutricao' | 'fisioterapia'
  | 'medicina' | 'psicologia' | 'terapia_ocupacional' | 'odontologia'
  // Diretriz de tratamento nascida da avaliação do próprio profissional: cada
  // profissão envia a sua, do mesmo jeito que o fisioterapeuta.
  | 'diretriz';

// Perfis que podem liberar cada área. Prescrição de exercício terapêutico é
// competência tanto do Educador Físico quanto do Fisioterapeuta — por isso
// 'treino' aceita os dois.
const PERFIL_EXIGIDO: Record<AreaChancela, PerfilProfissional[]> = {
  treino: ['educador_fisico', 'fisioterapeuta'],
  nutricao: ['nutricionista'],
  fisioterapia: ['fisioterapeuta'],
  medicina: ['medico'],
  psicologia: ['psicologo'],
  terapia_ocupacional: ['terapeuta_ocupacional'],
  odontologia: ['dentista'],
  diretriz: ['fisioterapeuta', 'medico', 'psicologo', 'nutricionista', 'educador_fisico', 'terapeuta_ocupacional', 'dentista'],
};

const LABEL: Record<AreaChancela, string> = {
  treino: 'Educador Físico ou Fisioterapeuta',
  nutricao: 'Nutricionista',
  fisioterapia: 'Fisioterapeuta',
  medicina: 'Médico(a)',
  psicologia: 'Psicólogo(a)',
  terapia_ocupacional: 'Terapeuta Ocupacional',
  odontologia: 'Dentista',
  diretriz: 'profissional com a profissão definida no perfil',
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
  const { isSolo, loading: cLoading } = useClinicaContext();
  const exigido = PERFIL_EXIGIDO[area];

  // Super-admin (conta do dono do produto): libera qualquer área.
  const isSuperAdmin = !!user?.email && SUPER_ADMINS.includes(user.email.toLowerCase());

  const loading = lLoading || cLoading;
  // Cada profissional libera apenas a área da SUA especialidade (mesmo dentro de
  // uma clínica: o nutricionista libera nutrição, o fisio libera reabilitação…).
  const ehProprio = !!lente?.id && exigido.includes(lente.id);
  const pode = isSuperAdmin || ehProprio;

  let motivo = '';
  if (pode && isSuperAdmin && !ehProprio) {
    motivo = 'Liberado (conta administradora).';
  } else if (!pode) {
    motivo = isSolo
      ? `Só um ${LABEL[area]} pode liberar este plano. Ajuste seu perfil profissional em Configurações se for o caso.`
      : `Só um ${LABEL[area]} pode liberar — cada profissional libera a sua própria área.`;
  }

  // viaClinica mantido por compatibilidade (não é mais usado para conceder chancela).
  return { pode, motivo, loading, labelExigido: LABEL[area], viaClinica: false };
}

export type TipoPlanoCliente = 'treino' | 'nutricao';

/**
 * Mesma regra do banco para chancelar/editar o plano do cliente (`plano_cliente_perfil_ok`):
 * vale o perfil GRAVADO em `profiles.perfil_profissional`. Sem perfil gravado não há habilitação
 * (a lente cai em 'fisioterapeuta' por padrão, e o banco não). Super-admin chancela qualquer área.
 */
export function podeChancelarPlanoCliente(tipo: TipoPlanoCliente, perfilGravado: string | null | undefined, superAdmin: boolean): boolean {
  if (superAdmin) return true;
  return !!perfilGravado && (PERFIL_EXIGIDO[tipo] as string[]).includes(perfilGravado);
}

/** Como `usePodeChancelar`, para a fila de chancela da equipe científica: sem o perfil padrão da lente. */
export function usePodeChancelarPlanoCliente(tipo: TipoPlanoCliente): Chancela {
  const { user } = useAuth();
  const { data: perfil, isLoading } = useQuery({
    queryKey: ['perfil-profissional-gravado', user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('perfil_profissional')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as { perfil_profissional?: string | null } | null)?.perfil_profissional ?? null;
    },
  });

  const isSuperAdmin = !!user?.email && SUPER_ADMINS.includes(user.email.toLowerCase());
  const pode = podeChancelarPlanoCliente(tipo, perfil, isSuperAdmin);
  const ehProprio = podeChancelarPlanoCliente(tipo, perfil, false);

  let motivo = '';
  if (pode && !ehProprio) {
    motivo = 'Liberado (conta administradora).';
  } else if (!pode) {
    motivo = perfil
      ? `Só um ${LABEL[tipo]} pode chancelar este plano — cada profissional chancela a sua própria área.`
      : `Seu perfil profissional ainda não está definido. Ajuste em Configurações; só um ${LABEL[tipo]} pode chancelar este plano.`;
  }

  return { pode, motivo, loading: !!user?.id && isLoading, labelExigido: LABEL[tipo], viaClinica: false };
}
