import { ClipboardList } from 'lucide-react';
import DiretrizAreaCard from '@/components/diretrizes/DiretrizAreaCard';

// Diretriz nutricional: instância do molde único de diretrizes por área.
export default function DiretrizNutricionalCard({ pacienteId }: { pacienteId: string }) {
  return (
    <DiretrizAreaCard
      pacienteId={pacienteId}
      area="nutricao"
      nomeCard="Diretriz Nutricional"
      funcaoIA="gerar-diretriz-nutricional"
      Icone={ClipboardList}
      corIcone="text-emerald-600"
      descricaoVazio="Acompanhamento por fases com metas e marcadores de exame, gerado dos dados clínicos + MyID."
      descricaoGerar="A IA usa automaticamente os exames importados, bioimpedância, antropometria, sinais vitais, anamnese nutricional e o MyID do paciente. O resultado nasce como rascunho — só chega ao cliente quando você enviar ao portal."
      placeholderObjetivo="ex: controle glicêmico e perda de gordura"
    />
  );
}
