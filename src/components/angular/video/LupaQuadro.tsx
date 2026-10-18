import type { ReactNode, RefObject } from 'react';
import type { LupaEstado } from '@/hooks/useGestosFoto';
import { AUMENTO_LUPA, TAMANHO_LUPA } from '@/components/angular/LupaFoto';
import { COR_CENTRO, COR_LADO, type LigacaoUi, type PontosDoQuadro } from '@/lib/angular/analiseVideo/tiposUi';
import { posicaoDaLupa } from '@/lib/angular/analiseVideo/lupa';

// Lupa de 3× do arrasto de um ponto: mostra o quadro parado, o esqueleto e a mira no ponto que o dedo segura.
export default function LupaQuadro({ lupa, href, w, h, svgRef, caixaRef, pontos, ligacoes, nomeAtivo, extra }: {
  lupa: LupaEstado;
  href: string;
  w: number;
  h: number;
  svgRef: RefObject<SVGSVGElement>;
  caixaRef: RefObject<HTMLDivElement>;
  pontos: PontosDoQuadro;
  ligacoes: LigacaoUi[];
  nomeAtivo: string | null;
  /** Marcações extras (medidas à mão), no sistema de coordenadas do vídeo. */
  extra?: ReactNode;
}) {
  const escala = (svgRef.current?.getBoundingClientRect().width ?? w) / w;
  const lado = TAMANHO_LUPA / (AUMENTO_LUPA * escala);
  const un = 1 / (AUMENTO_LUPA * escala);
  const larguraCaixa = caixaRef.current?.clientWidth ?? TAMANHO_LUPA;
  const { left: esquerda, top: topo } = posicaoDaLupa({ cx: lupa.cx, cy: lupa.cy, tamanho: TAMANHO_LUPA, larguraCaixa, topoDaCaixaNaTela: caixaRef.current?.getBoundingClientRect().top ?? 0 });
  const cor = (l: LigacaoUi['lado']) => (l ? COR_LADO[l] : COR_CENTRO);
  return (
    <div className="pointer-events-none absolute z-20 overflow-hidden rounded-full border-2 border-white bg-black shadow-xl" style={{ width: TAMANHO_LUPA, height: TAMANHO_LUPA, left: esquerda, top: topo }} aria-hidden data-testid="lupa">
      <svg viewBox={`${lupa.ponto.x - lado / 2} ${lupa.ponto.y - lado / 2} ${lado} ${lado}`} width={TAMANHO_LUPA} height={TAMANHO_LUPA}>
        <image href={href} width={w} height={h} />
        {extra}
        {ligacoes.map((l) => {
          const a = pontos[l.a], b = pontos[l.b];
          return a && b ? <line key={`${l.a}-${l.b}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={cor(l.lado)} strokeOpacity={0.9} strokeWidth={2 * un} strokeLinecap="round" /> : null;
        })}
        {Object.entries(pontos).map(([nome, p]) => <circle key={nome} cx={p.x} cy={p.y} r={(nome === nomeAtivo ? 3.5 : 2.5) * un} fill={nome === nomeAtivo ? '#facc15' : '#fff'} stroke="#000" strokeWidth={0.6 * un} />)}
        <line x1={lupa.ponto.x - 14 * un} x2={lupa.ponto.x + 14 * un} y1={lupa.ponto.y} y2={lupa.ponto.y} stroke="#fff" strokeWidth={un} />
        <line y1={lupa.ponto.y - 14 * un} y2={lupa.ponto.y + 14 * un} x1={lupa.ponto.x} x2={lupa.ponto.x} stroke="#fff" strokeWidth={un} />
      </svg>
    </div>
  );
}
