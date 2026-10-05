import type { RefObject } from 'react';
import type { LupaEstado } from '@/hooks/useGestosFoto';
import type { Ponto } from '@/lib/angular/medidas';

export const TAMANHO_LUPA = 120;
export const AUMENTO_LUPA = 3;
const CORES = ['#ef4444', '#3b82f6', '#10b981', '#a855f7'];
const limitar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

// Lupa de 3× que acompanha o dedo, para ver onde o ponto vai cair. `href` é a imagem (foto ou quadro do vídeo).
export default function LupaFoto({ lupa, href, w, h, svgRef, caixaRef, pontos, segmentos, comNovo }: {
  lupa: LupaEstado;
  href: string;
  w: number;
  h: number;
  svgRef: RefObject<SVGSVGElement>;
  caixaRef: RefObject<HTMLDivElement>;
  /** Pontos já marcados da medida ativa. */
  pontos: Ponto[];
  segmentos: [number, number][];
  /** O ponto sob o dedo é um ponto novo (entra na lista do desenho). */
  comNovo: boolean;
}) {
  const escala = (svgRef.current?.getBoundingClientRect().width ?? w) / w;
  const lado = TAMANHO_LUPA / (AUMENTO_LUPA * escala);
  const un = 1 / (AUMENTO_LUPA * escala);
  const larguraCaixa = caixaRef.current?.clientWidth ?? TAMANHO_LUPA;
  const esquerda = limitar(lupa.cx - TAMANHO_LUPA / 2, 4, Math.max(4, larguraCaixa - TAMANHO_LUPA - 4));
  const topo = lupa.cy - TAMANHO_LUPA - 32 < 4 ? lupa.cy + 32 : lupa.cy - TAMANHO_LUPA - 32;
  const pts = comNovo ? [...pontos, lupa.ponto] : pontos;
  return (
    <div className="pointer-events-none absolute z-20 overflow-hidden rounded-full border-2 border-white bg-black shadow-xl" style={{ width: TAMANHO_LUPA, height: TAMANHO_LUPA, left: esquerda, top: topo }} aria-hidden data-testid="lupa">
      <svg viewBox={`${lupa.ponto.x - lado / 2} ${lupa.ponto.y - lado / 2} ${lado} ${lado}`} width={TAMANHO_LUPA} height={TAMANHO_LUPA}>
        <image href={href} width={w} height={h} />
        {segmentos.filter(([i, j]) => i < pts.length && j < pts.length).map(([i, j]) => (
          <line key={`${i}-${j}`} x1={pts[i].x} y1={pts[i].y} x2={pts[j].x} y2={pts[j].y} stroke="#facc15" strokeWidth={2 * un} />
        ))}
        {pts.map((q, i) => <circle key={i} cx={q.x} cy={q.y} r={4 * un} fill={CORES[i % CORES.length]} stroke="#fff" strokeWidth={un} />)}
        <line x1={lupa.ponto.x - 14 * un} x2={lupa.ponto.x + 14 * un} y1={lupa.ponto.y} y2={lupa.ponto.y} stroke="#fff" strokeWidth={un} />
        <line y1={lupa.ponto.y - 14 * un} y2={lupa.ponto.y + 14 * un} x1={lupa.ponto.x} x2={lupa.ponto.x} stroke="#fff" strokeWidth={un} />
      </svg>
    </div>
  );
}
