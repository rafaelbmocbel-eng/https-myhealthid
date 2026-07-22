import { Stethoscope, Brain, Hand, Smile, Activity } from 'lucide-react';
import DiretrizAreaCard from './DiretrizAreaCard';
import { useLenteAtiva, type PerfilProfissional } from '@/hooks/useLenteAtiva';

// Diretriz de tratamento GENÉRICA por lente (médico, psicólogo, terapeuta
// ocupacional, dentista). Cada uma usa a mesma base — avaliação presencial +
// MyID + questionários — via a edge function gerar-diretriz-clinica, com a
// persona da profissão. Fisio/educador/nutri têm cards próprios.
const LENTE_DIRETRIZ: Partial<Record<PerfilProfissional, {
  area: string; nome: string; Icone: any; cor: string; objetivoPh: string;
}>> = {
  fisioterapeuta: { area: 'fisioterapia', nome: 'Plano Fisioterápico (Tratamento)', Icone: Activity, cor: 'text-rose-600', objetivoPh: 'ex: alívio de dor lombar e estabilização' },
  medico: { area: 'medicina', nome: 'Diretriz de Tratamento (Médica)', Icone: Stethoscope, cor: 'text-sky-600', objetivoPh: 'ex: controle pressórico e metabólico' },
  psicologo: { area: 'psicologia', nome: 'Plano Terapêutico (Psicologia)', Icone: Brain, cor: 'text-violet-600', objetivoPh: 'ex: reduzir sintomas de ansiedade' },
  terapeuta_ocupacional: { area: 'terapia_ocupacional', nome: 'Plano Ocupacional (TO)', Icone: Hand, cor: 'text-amber-600', objetivoPh: 'ex: independência nas AVDs' },
  dentista: { area: 'odontologia', nome: 'Plano de Tratamento (Odontologia)', Icone: Smile, cor: 'text-teal-600', objetivoPh: 'ex: adequação do meio bucal e reabilitação' },
};

export default function DiretrizLenteCard({ pacienteId, autoGerar }: { pacienteId: string; autoGerar?: boolean }) {
  const { data: lente } = useLenteAtiva();
  const cfg = lente ? LENTE_DIRETRIZ[lente.id] : undefined;
  if (!cfg) return null;
  return (
    <DiretrizAreaCard
      pacienteId={pacienteId}
      autoGerar={autoGerar}
      area={cfg.area}
      nomeCard={cfg.nome}
      funcaoIA="gerar-diretriz-clinica"
      Icone={cfg.Icone}
      corIcone={cfg.cor}
      descricaoVazio="Gere a diretriz de tratamento a partir da avaliação presencial, do MyID e dos questionários respondidos."
      descricaoGerar="A IA usa a avaliação presencial (achados + suas observações), o MyID e os questionários. Depois é só revisar e enviar ao portal."
      placeholderObjetivo={cfg.objetivoPh}
    />
  );
}
