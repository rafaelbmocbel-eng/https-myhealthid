/**
 * Detector falso determinístico para testes: devolve os pontos de uma figura articulada sintética com ângulos conhecidos
 * (marcha, corrida, agachamento, aterrissagem de salto, elevação do braço) no instante pedido. O MediaPipe não roda sem rede,
 * então os testes injetam este detector em `rastrearVideo`. Só código de teste importa este módulo: não entra no build de produção.
 *
 *   const cfg = configurar('marcha');
 *   const trilha = await rastrearVideo(video, { detector: detectorFalso(cfg), fps: 30 });
 *   const { verdade } = poseSintetica(cfg, 1.5);  // ângulos conhecidos em t = 1,5 s
 */
export {
  aleatorio, configurar, desenharFigura, detectorFalso, eventosVerdade, landmarksSinteticos, poseSintetica, trilhaSintetica,
  type ConfigFigura, type EventosVerdade, type GestoSintetico, type OpcoesDetectorFalso, type PoseSintetica, type VerdadeQuadro,
} from './figuraSintetica';
