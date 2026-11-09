import { useMemo } from 'react';
import type { ContracaoResumo } from '@/lib/emg/sessao';
import { degrauRedondo, envelopeParaGrafico, numeroPt } from './desenho';

const LARGURA = 360;
const ALTURA = 170;
const MARGEM = { esquerda: 38, direita: 8, topo: 10, base: 24 };

interface Props {
  /** Amostras filtradas da tarefa, em µV. */
  amostras: ArrayLike<number>;
  fsHz: number;
  contracoes: readonly ContracaoResumo[];
  /** Limiar de detecção (média do repouso + k desvios), em µV; null sem repouso utilizável. */
  limiarUv: number | null;
  cvmUv: number | null;
}

/**
 * Envelope RMS (100 ms) da tarefa, com as contrações detectadas sombreadas e o limiar tracejado.
 * Com CVM o eixo vertical é % da CVM; sem CVM, µV.
 */
export default function GraficoEnvelope({ amostras, fsHz, contracoes, limiarUv, cvmUv }: Props) {
  const envelope = useMemo(() => envelopeParaGrafico(amostras, fsHz), [amostras, fsHz]);
  if (envelope.uv.length === 0) return null;

  const fator = cvmUv ? 100 / cvmUv : 1;
  const unidade = cvmUv ? '% da CVM' : 'µV';
  const valores = envelope.uv.map((v) => v * fator);
  const limiar = limiarUv === null ? null : limiarUv * fator;
  const topoDosDados = Math.max(...valores, limiar ?? 0, cvmUv ? 100 : 0);
  const yMax = degrauRedondo(topoDosDados * 1.1);
  const duracao = envelope.duracaoS;
  const larguraUtil = LARGURA - MARGEM.esquerda - MARGEM.direita;
  const alturaUtil = ALTURA - MARGEM.topo - MARGEM.base;
  const x = (s: number): number => MARGEM.esquerda + (s / duracao) * larguraUtil;
  const y = (v: number): number => MARGEM.topo + alturaUtil - (Math.min(v, yMax) / yMax) * alturaUtil;
  const pontos = envelope.tempoS.map((t, i) => `${x(t).toFixed(1)},${y(valores[i]).toFixed(1)}`).join(' ');
  const n = contracoes.length;
  const descricao = `Envelope do sinal na tarefa, de 0 a ${numeroPt(duracao, 1)} s. ${n === 0 ? 'Nenhuma contração detectada' : `${n} ${n === 1 ? 'contração detectada' : 'contrações detectadas'}`}.`;

  return (
    <figure className="space-y-1">
      <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} role="img" aria-label={descricao} className="h-auto w-full max-w-2xl" data-testid="grafico-envelope">
        <title>{descricao}</title>
        {contracoes.map((c, i) => (
          <rect
            key={i}
            x={x(c.inicioS)}
            y={MARGEM.topo}
            width={Math.max(1, x(Math.min(c.fimS, duracao)) - x(c.inicioS))}
            height={alturaUtil}
            style={{ fill: 'hsl(var(--primary))', fillOpacity: 0.14 }}
          />
        ))}
        <line x1={MARGEM.esquerda} y1={y(0)} x2={LARGURA - MARGEM.direita} y2={y(0)} style={{ stroke: 'hsl(var(--border))' }} />
        <line x1={MARGEM.esquerda} y1={MARGEM.topo} x2={MARGEM.esquerda} y2={y(0)} style={{ stroke: 'hsl(var(--border))' }} />
        {cvmUv && yMax >= 100 && (
          <>
            <line x1={MARGEM.esquerda} y1={y(100)} x2={LARGURA - MARGEM.direita} y2={y(100)} strokeDasharray="2 3" style={{ stroke: 'hsl(var(--muted-foreground))' }} />
            <text x={LARGURA - MARGEM.direita} y={y(100) - 3} textAnchor="end" fontSize="9" style={{ fill: 'hsl(var(--muted-foreground))' }}>
              100 % da CVM
            </text>
          </>
        )}
        {limiar !== null && limiar <= yMax && (
          <>
            <line x1={MARGEM.esquerda} y1={y(limiar)} x2={LARGURA - MARGEM.direita} y2={y(limiar)} strokeDasharray="5 3" style={{ stroke: 'hsl(var(--destructive))' }} />
            <text x={MARGEM.esquerda + 3} y={y(limiar) - 3} fontSize="9" style={{ fill: 'hsl(var(--destructive))' }}>
              limiar de detecção
            </text>
          </>
        )}
        <polyline points={pontos} fill="none" strokeWidth="1.5" strokeLinejoin="round" style={{ stroke: 'hsl(var(--primary))' }} />
        <text x={MARGEM.esquerda - 4} y={y(yMax) + 8} textAnchor="end" fontSize="9" style={{ fill: 'hsl(var(--muted-foreground))' }}>
          {numeroPt(yMax, 0)}
        </text>
        <text x={MARGEM.esquerda - 4} y={y(0) + 3} textAnchor="end" fontSize="9" style={{ fill: 'hsl(var(--muted-foreground))' }}>
          0
        </text>
        <text x={MARGEM.esquerda} y={ALTURA - 8} fontSize="9" style={{ fill: 'hsl(var(--muted-foreground))' }}>
          0 s
        </text>
        <text x={LARGURA - MARGEM.direita} y={ALTURA - 8} textAnchor="end" fontSize="9" style={{ fill: 'hsl(var(--muted-foreground))' }}>
          {numeroPt(duracao, 1)} s
        </text>
      </svg>
      <figcaption className="text-[11px] text-muted-foreground">
        Envelope RMS de 100 ms da tarefa ({unidade}). Faixas sombreadas: contrações detectadas.
      </figcaption>
    </figure>
  );
}
