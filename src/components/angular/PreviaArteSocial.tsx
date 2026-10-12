import { useEffect, useRef } from 'react';
import { desenharArteSocial, type OpcoesArte, type PainelPronto, type RecursosArte } from '@/lib/social/desenhar';
import { FORMATOS } from '@/lib/social/formatos';
import type { LayoutSocial } from '@/lib/social/layout';

export type FerramentaPrevia = 'enquadrar' | 'rosto';

interface Props {
  opcoes: OpcoesArte;
  paineis: PainelPronto[];
  recursos: RecursosArte;
  /** Fração do tamanho final em que a prévia é desenhada. */
  escala?: number;
  ferramenta: FerramentaPrevia;
  aoLayout?: (layout: LayoutSocial) => void;
  /** Arrasto de um dedo sobre a foto `i`, em pixels da arte. */
  aoArrastar: (i: number, dx: number, dy: number) => void;
  /** Pinça sobre a foto `i`: fator relativo ao zoom do início do gesto e o ponto entre os dedos, em pixels da arte. */
  aoZoom: (i: number, fator: number, foco: { x: number; y: number }) => void;
  aoIniciarGesto?: () => void;
  descricao: string;
}

interface Gesto { i: number; pontos: Map<number, { x: number; y: number }>; distancia0: number }

const dentro = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// A prévia usa o mesmo compositor do arquivo final, só em escala menor. Os gestos (arrastar, pinça) são
// traduzidos para pixels da arte e repassados; quem guarda o estado decide o que cada ferramenta faz.
export default function PreviaArteSocial({ opcoes, paineis, recursos, escala = 0.7, ferramenta, aoLayout, aoArrastar, aoZoom, aoIniciarGesto, descricao }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<LayoutSocial | null>(null);
  const gestoRef = useRef<Gesto | null>(null);
  const info = FORMATOS[opcoes.formato];

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return undefined;
    const quadro = requestAnimationFrame(() => {
      const w = Math.round(info.largura * escala), h = Math.round(info.altura * escala);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      const layout = desenharArteSocial(ctx, opcoes, paineis, recursos, escala);
      layoutRef.current = layout;
      aoLayout?.(layout);
    });
    return () => cancelAnimationFrame(quadro);
    // aoLayout muda a cada render do pai; incluí-lo reiniciaria o desenho em laço.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opcoes, paineis, recursos, escala, info]);

  const paraArte = (e: { clientX: number; clientY: number }) => {
    const cv = canvasRef.current;
    const r = cv?.getBoundingClientRect();
    if (!cv || !r || !r.width) return null;
    return { x: ((e.clientX - r.left) / r.width) * info.largura, y: ((e.clientY - r.top) / r.height) * info.altura };
  };

  const indiceSob = (p: { x: number; y: number }) => layoutRef.current?.paineis.findIndex((b) => dentro(b, p.x, p.y)) ?? -1;

  const aoPressionar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = paraArte(e);
    if (!p) return;
    const g = gestoRef.current;
    if (g) {
      if (g.pontos.size === 1 && ferramenta === 'enquadrar') {
        g.pontos.set(e.pointerId, p);
        const [a, b] = [...g.pontos.values()];
        g.distancia0 = Math.hypot(a.x - b.x, a.y - b.y);
      }
    } else {
      const i = indiceSob(p);
      if (i < 0) return;
      aoIniciarGesto?.();
      gestoRef.current = { i, pontos: new Map([[e.pointerId, p]]), distancia0: 0 };
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const aoMover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gestoRef.current;
    const p = paraArte(e);
    if (!g || !p || !g.pontos.has(e.pointerId)) return;
    if (g.pontos.size === 2) {
      g.pontos.set(e.pointerId, p);
      const [a, b] = [...g.pontos.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (g.distancia0 > 0 && d > 0) {
        aoZoom(g.i, d / g.distancia0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        g.distancia0 = d;
      }
      return;
    }
    const ant = g.pontos.get(e.pointerId)!;
    g.pontos.set(e.pointerId, p);
    aoArrastar(g.i, p.x - ant.x, p.y - ant.y);
  };

  const aoSoltar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const g = gestoRef.current;
    if (!g) return;
    g.pontos.delete(e.pointerId);
    if (g.pontos.size === 0) gestoRef.current = null;
    else g.distancia0 = 0;
  };

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={descricao}
      data-testid="previa-arte-social"
      width={Math.round(info.largura * escala)}
      height={Math.round(info.altura * escala)}
      onPointerDown={aoPressionar}
      onPointerMove={aoMover}
      onPointerUp={aoSoltar}
      onPointerCancel={aoSoltar}
      className="mx-auto block h-auto max-h-[58dvh] w-auto max-w-full select-none rounded-xl bg-[#0a0f1c] shadow-lg"
      style={{ touchAction: 'none', aspectRatio: `${info.largura} / ${info.altura}` }}
    />
  );
}
