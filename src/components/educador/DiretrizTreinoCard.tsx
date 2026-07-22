import { Dumbbell } from 'lucide-react';
import DiretrizAreaCard from '@/components/diretrizes/DiretrizAreaCard';

// Diretriz de treino (educação física): instância do molde único de diretrizes.
export default function DiretrizTreinoCard({ pacienteId, autoGerar, ocultarGerador }: { pacienteId: string; autoGerar?: boolean; ocultarGerador?: boolean }) {
  return (
    <DiretrizAreaCard
      pacienteId={pacienteId}
      autoGerar={autoGerar}
      ocultarGerador={ocultarGerador}
      area="educacao_fisica"
      nomeCard="Diretriz de Treino"
      funcaoIA="gerar-diretriz-treino"
      Icone={Dumbbell}
      corIcone="text-primary"
      descricaoVazio="Periodização por fases com metas, progressão de carga e marcadores físicos, gerada dos testes funcionais + antropometria + MyID."
      descricaoGerar="A IA usa automaticamente os testes funcionais, antropometria, bioimpedância, sinais vitais e o MyID do paciente. O resultado nasce como rascunho — só chega ao cliente quando você enviar ao portal."
      placeholderObjetivo="ex: hipertrofia com proteção do joelho"
    />
  );
}
