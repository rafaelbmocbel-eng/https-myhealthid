import AnaliseVideo, { type AnaliseVideoProps } from '@/components/angular/video/AnaliseVideo';

// Entrada "Marcha automática": abre a análise de gesto de vídeo já no modelo da marcha (o profissional pode trocar por corrida,
// agachamento, aterrissagem de salto ou elevação do braço). Todo o fluxo mora em `AnaliseVideo`.
export default function MarchaVideo({ paciente, estilo, aoMudarEstilo }: Pick<AnaliseVideoProps, 'paciente' | 'estilo' | 'aoMudarEstilo'>) {
  return <AnaliseVideo paciente={paciente} entrada="gesto" modeloInicial="marcha" estilo={estilo} aoMudarEstilo={aoMudarEstilo} />;
}
