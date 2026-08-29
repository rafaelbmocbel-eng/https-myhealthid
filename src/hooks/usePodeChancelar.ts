import { useLenteAtiva, type PerfilProfissional } from './useLenteAtiva';
import { useClinicaContext } from './useClinicaContext';
import { useAuth } from '@/contexts/AuthContext';

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
  | 'medicina' | 'psicologia' | 'terapia_ocupacional' | 'odontologia';

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
};

const LABEL: Record<AreaChancela, string> = {
  treino: 'Educador Físico ou Fisioterapeuta',
  nutricao: 'Nutricionista',
  fisioterapia: 'Fisioterapeuta',
  medicina: 'Médico(a)',
  psicologia: 'Psicólogo(a)',
  terapia_ocupacional: 'Terapeuta Ocupacional',
  odontologia: 'Dentista',
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
