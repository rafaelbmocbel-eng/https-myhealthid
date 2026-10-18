import { useRef, useState } from 'react';
import { Move } from 'lucide-react';
import { deslocamentoDaTecla, moverPosicaoDaCaixa, type PosicaoCaixa, type TamanhoCaixa } from '@/lib/angular/video/caixaFixaRosto';
import type { Retangulo } from '@/lib/social/formatos';

/*
 * Caixa de cobertura do rosto sobre a prévia, para os quadros em que o app não localizou o rosto: o profissional a arrasta (toque ou
 * mouse) ou a move pelas setas do teclado até cobrir o rosto. A camada acompanha o canvas da prévia, então as posições são em porcentagem
 * do canvas; o que sai daqui é a nova posição do centro, em fração do quadro do vídeo.
 */

/** Lado mínimo da área de toque, em px: a caixa pode ser menor que um dedo. */
const ALVO_MINIMO_PX = 44;

interface Props {
  /** Tamanho do canvas da prévia e a área do vídeo dentro dele, em pixels do canvas. */
  larguraCanvas: number;
  alturaCanvas: number;
  areaVideo: Retangulo;
  posicao: PosicaoCaixa;
  /** O que a caixa cobre num quadro sem rosto, em fração do quadro do vídeo. */
  tamanho: TamanhoCaixa;
  aoMudar: (posicao: PosicaoCaixa) => void;
}

interface Arrasto { id: number; x: number; y: number; inicio: PosicaoCaixa }

const percentual = (v: number) => Math.round(v * 100);

export default function CaixaRostoArrastavel({ larguraCanvas, alturaCanvas, areaVideo, posicao, tamanho, aoMudar }: Props) {
  const areaRef = useRef<HTMLDivElement | null>(null);
  const arrasto = useRef<Arrasto | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [anuncio, setAnuncio] = useState('');

  if (!(larguraCanvas > 0) || !(alturaCanvas > 0) || !(areaVideo.w > 0) || !(areaVideo.h > 0)) return null;

  const centroX = ((areaVideo.x + posicao.cx * areaVideo.w) / larguraCanvas) * 100;
  const centroY = ((areaVideo.y + posicao.cy * areaVideo.h) / alturaCanvas) * 100;
  const larguraPct = ((tamanho.w * areaVideo.w) / larguraCanvas) * 100;
  const alturaPct = ((tamanho.h * areaVideo.h) / alturaCanvas) * 100;
  const posicaoCss = { left: `${centroX}%`, top: `${centroY}%`, width: `${larguraPct}%`, height: `${alturaPct}%` };

  const aoPressionar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const r = areaRef.current?.getBoundingClientRect();
    if (!r || r.width <= 0 || r.height <= 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Sem captura de ponteiro (navegador antigo): o arrasto segue enquanto o dedo ou o mouse ficarem sobre a caixa.
    }
    arrasto.current = { id: e.pointerId, x: e.clientX, y: e.clientY, inicio: posicao };
    setArrastando(true);
    e.currentTarget.focus({ preventScroll: true });
  };

  const aoMover = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = arrasto.current;
    const r = areaRef.current?.getBoundingClientRect();
    if (!a || a.id !== e.pointerId || !r || r.width <= 0 || r.height <= 0) return;
    // Pixels da tela -> fração do quadro do vídeo. A posição vem sempre do ponto de partida do arrasto, então, quando a caixa encosta na
    // borda e o dedo continua, ela volta a acompanhar o dedo assim que ele retorna.
    const dx = ((e.clientX - a.x) / r.width) * (larguraCanvas / areaVideo.w);
    const dy = ((e.clientY - a.y) / r.height) * (alturaCanvas / areaVideo.h);
    aoMudar(moverPosicaoDaCaixa(a.inicio, dx, dy, tamanho));
  };

  const aoSoltar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (arrasto.current?.id !== e.pointerId) return;
    arrasto.current = null;
    setArrastando(false);
  };

  const aoTeclar = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const d = deslocamentoDaTecla(e.key, e.shiftKey);
    if (!d) return;
    e.preventDefault();
    const nova = moverPosicaoDaCaixa(posicao, d.dx, d.dy, tamanho);
    aoMudar(nova);
    setAnuncio(`Caixa a ${percentual(nova.cx)}% da esquerda e a ${percentual(nova.cy)}% do alto do quadro.`);
  };

  return (
    <div
      ref={areaRef}
      className="pointer-events-none absolute inset-y-0 left-1/2 h-full -translate-x-1/2 overflow-hidden"
      style={{ aspectRatio: `${larguraCanvas} / ${alturaCanvas}` }}
      data-testid="area-caixa-rosto"
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-dashed border-amber-300 shadow-[0_0_0_2px_rgba(8,12,22,0.7)] ${arrastando ? 'bg-amber-300/10' : ''}`}
        style={posicaoCss}
        data-testid="contorno-caixa-rosto"
      />
      <div
        role="group"
        tabIndex={0}
        aria-roledescription="caixa arrastável"
        aria-label="Cobertura do rosto neste quadro. Arraste ou use as setas do teclado para mover; com Shift o passo é maior."
        onPointerDown={aoPressionar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        onKeyDown={aoTeclar}
        className="pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 active:cursor-grabbing"
        style={{ ...posicaoCss, minWidth: ALVO_MINIMO_PX, minHeight: ALVO_MINIMO_PX }}
        data-testid="caixa-rosto-arrastavel"
      >
        <Move className="h-5 w-5 rounded-full bg-[#080c16]/70 p-0.5 text-amber-200" aria-hidden />
      </div>
      <span className="sr-only" role="status" aria-live="polite">{anuncio}</span>
    </div>
  );
}
