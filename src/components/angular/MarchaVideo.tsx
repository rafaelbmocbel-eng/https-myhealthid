import AnaliseVideo, { type AnaliseVideoProps } from '@/components/angular/video/AnaliseVideo';

// Entrada "Gesto automático": abre a análise de vídeo já no modelo da marcha (dá para trocar por corrida, agachamento, salto
// ou elevação do braço). Todo o fluxo mora em `AnaliseVideo`.
export default function MarchaVideo({ paciente, estilo, aoMudarEstilo }: Pick<AnaliseVideoProps, 'paciente' | 'estilo' | 'aoMudarEstilo'>) {
  return <AnaliseVideo paciente={paciente} entrada="gesto" modeloInicial="marcha" estilo={estilo} aoMudarEstilo={aoMudarEstilo} />;
}
