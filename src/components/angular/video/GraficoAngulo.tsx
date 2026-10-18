import { memo, useMemo, useRef, type PointerEvent } from 'react';
import {
  layoutDoGrafico, tempoDoToque, valorNoTempo,
  type BandaGrafico, type LayoutGrafico, type MarcadorGrafico, type SerieGrafico,
} from '@/lib/angular/analiseVideo/graficoLayout';
import { COR_LADO } from '@/lib/angular/analiseVideo/tiposUi';

const L = 360, A = 190;
const nf = (v: number, c = 1) => v.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c });

function faixaDaSerie(s: SerieGrafico, unidade: string): string {
  const v = s.pontos.flatMap((p) => (p.v !== null && Number.isFinite(p.v) ? [p.v] : []));
  if (!v.length) return 'sem dados';
  return `de ${nf(Math.min(...v), 0)} a ${nf(Math.max(...v), 0)}${unidade}`;
}

const corDoMarcador = (lado?: 'D' | 'E' | null) => (lado ? COR_LADO[lado] : '#71717a');

// Parte que não muda com o quadro: eixos, bandas de referência, eventos e curvas. Fica memorizada para o cursor
// poder andar a 30 quadros por segundo sem refazer as curvas.
const Fixo = memo(function Fixo({ layout }: { layout: LayoutGrafico }) {
  const { area, fonte } = layout;
  return (
    <g>
      {layout.bandas.map((b) => (
        <g key={b.id} data-testid="banda-referencia">
          <rect x={area.x0} y={b.y0} width={area.x1 - area.x0} height={Math.max(0, b.y1 - b.y0)} fill="#10b981" fillOpacity={0.14} />
          <line x1={area.x0} x2={area.x1} y1={b.y0} y2={b.y0} stroke="#10b981" strokeOpacity={0.6} strokeDasharray="4 3" />
          <line x1={area.x0} x2={area.x1} y1={b.y1} y2={b.y1} stroke="#10b981" strokeOpacity={0.6} strokeDasharray="4 3" />
        </g>
      ))}
      {layout.ticksY.map((tk) => (
        <g key={`y${tk.v}`}>
          <line x1={area.x0} x2={area.x1} y1={tk.y} y2={tk.y} stroke="currentColor" opacity={tk.v === 0 ? 0.3 : 0.12} />
          <text x={area.x0 - fonte * 0.4} y={tk.y} textAnchor="end" dominantBaseline="central" fontSize={fonte} fill="currentColor" opacity={0.65}>{tk.rotulo}</text>
        </g>
      ))}
      {layout.ticksX.map((tk) => (
        <text key={`x${tk.t}`} x={tk.x} y={area.y1 + fonte * 1.5} textAnchor="middle" fontSize={fonte} fill="currentColor" opacity={0.65}>{tk.rotulo}</text>
      ))}
      <line x1={area.x0} x2={area.x1} y1={area.y1} y2={area.y1} stroke="currentColor" opacity={0.3} />
      {layout.marcadores.map((m) => {
        const cor = corDoMarcador(m.lado);
        const contato = m.tipo === 'contato';
        return (
          <g key={m.id} data-testid={`marcador-${m.tipo}`}>
            <line x1={m.x} x2={m.x} y1={area.y0} y2={area.y1} stroke={cor} strokeOpacity={0.36} strokeWidth={1} strokeDasharray={contato ? undefined : '3 3'} />
            {contato && <path d={`M${m.x - 4},${area.y0 - 1} L${m.x + 4},${area.y0 - 1} L${m.x},${area.y0 + 6} Z`} fill={cor} />}
            {m.tipo === 'saida' && <circle cx={m.x} cy={area.y0 + 2} r={3.2} fill="none" stroke={cor} strokeWidth={1.5} />}
            {m.tipo === 'outro' && <path d={`M${m.x},${area.y0 - 2} L${m.x + 4},${area.y0 + 2} L${m.x},${area.y0 + 6} L${m.x - 4},${area.y0 + 2} Z`} fill="none" stroke={cor} strokeWidth={1.5} />}
          </g>
        );
      })}
      {layout.caminhos.map((c) => (
        <path key={c.id} d={c.d} fill="none" stroke={c.cor} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" data-testid={`curva-${c.id}`} />
      ))}
    </g>
  );
});

interface Props {
  titulo: string;
  series: SerieGrafico[];
  marcadores?: MarcadorGrafico[];
  /** Só faixas com referência confirmada em fonte; sem elas, o gráfico não desenha banda nenhuma. */
  bandas?: BandaGrafico[];
  t0: number;
  duracao: number;
  /** Instante do quadro atual (o cursor). */
  t: number;
  aoIrPara: (t: number) => void;
  unidade?: string;
  /** Sentido do sinal dos ângulos (ex.: "0° = estendido; negativo = extensão"). */
  legendaSinal?: string;
}

// Gráfico ângulo x tempo: uma curva por lado, eventos, faixa de referência (só se confirmada) e o cursor do quadro.
export default function GraficoAngulo({ titulo, series, marcadores = [], bandas = [], t0, duracao, t, aoIrPara, unidade = '°', legendaSinal }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const layout = useMemo(() => layoutDoGrafico(series, marcadores, bandas, { largura: L, altura: A, t0, duracao, unidade }), [series, marcadores, bandas, t0, duracao, unidade]);
  const x = layout.xDoTempo(Math.min(Math.max(t, t0), t0 + duracao));
  const valores = series.map((s) => ({ s, v: valorNoTempo(s, t) }));

  const ir = (e: PointerEvent<SVGSVGElement>) => {
    const r = svg.current?.getBoundingClientRect();
    if (r) aoIrPara(tempoDoToque(layout, e.clientX - r.left, r.width, t0, duracao));
  };

  const resumo = `${titulo}: ${series.map((s) => `${s.rotulo} ${faixaDaSerie(s, unidade)}`).join('; ')}`;

  return (
    <figure className="space-y-1" data-testid="grafico-angulo">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-sm font-semibold">{titulo}</span>
        <span className="flex gap-3 text-xs font-semibold tabular-nums" aria-live="off">
          {valores.map(({ s, v }) => (
            <span key={s.id} style={{ color: s.cor }}>{s.rotulo} {v === null ? '—' : `${nf(v)}${unidade}`}</span>
          ))}
        </span>
      </figcaption>
      <svg
        ref={svg} viewBox={`0 0 ${L} ${A}`} className="w-full cursor-pointer select-none text-foreground [touch-action:pan-y]" role="img" aria-label={resumo}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); ir(e); }}
        onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') ir(e); }}
      >
        <Fixo layout={layout} />
        <line x1={x} x2={x} y1={layout.area.y0} y2={layout.area.y1} stroke="currentColor" strokeWidth={1.4} opacity={0.85} data-testid="cursor-grafico" />
        {valores.map(({ s, v }) => (v === null ? null : <circle key={s.id} cx={x} cy={layout.yDoValor(v)} r={4} fill={s.cor} stroke="#fff" strokeWidth={1.5} />))}
      </svg>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {series.map((s) => <span key={s.id} className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 rounded" style={{ background: s.cor }} aria-hidden />{s.rotulo}</span>)}
        {marcadores.some((m) => m.tipo === 'contato') && <span className="flex items-center gap-1"><span aria-hidden>▼</span> contato inicial</span>}
        {marcadores.some((m) => m.tipo === 'saida') && <span className="flex items-center gap-1"><span aria-hidden>○</span> saída do pé</span>}
        {[...new Set(marcadores.filter((m) => m.tipo === 'outro' && m.legenda).map((m) => m.legenda))].map((l) => <span key={l} className="flex items-center gap-1"><span aria-hidden>◇</span> {l}</span>)}
        {bandas.map((b) => <span key={b.id} className="flex items-center gap-1"><span className="inline-block h-2.5 w-4 rounded-sm border border-dashed border-emerald-500 bg-emerald-500/15" aria-hidden />{b.rotulo}</span>)}
      </div>
      {legendaSinal && <p className="text-[11px] leading-snug text-muted-foreground" data-testid="legenda-sinal">{legendaSinal}</p>}
    </figure>
  );
}
