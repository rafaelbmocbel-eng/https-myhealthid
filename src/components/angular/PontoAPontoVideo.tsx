import AnaliseVideo, { type AnaliseVideoProps } from '@/components/angular/video/AnaliseVideo';

// Entrada "Ponto a ponto": a mesma análise de vídeo, com a marcação quadro a quadro em primeiro plano (dá para medir sem rastrear
// o corpo, ou rastrear e corrigir os pontos). Todo o fluxo mora em `AnaliseVideo`.
export default function PontoAPontoVideo({ paciente, estilo, aoMudarEstilo }: Pick<AnaliseVideoProps, 'paciente' | 'estilo' | 'aoMudarEstilo'>) {
  return <AnaliseVideo paciente={paciente} entrada="ponto" modeloInicial="marcha" estilo={estilo} aoMudarEstilo={aoMudarEstilo} />;
}
