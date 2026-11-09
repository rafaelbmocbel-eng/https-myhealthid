import { useEffect, useRef, useState } from 'react';
import type { BufferCircular } from '@/lib/emg/bufferCircular';
import { normalizarPorCVM } from '@/lib/emg/metricas';
import { JANELA_RMS_VIVO_MS, pctPt, rmsRecente, uvPt } from './desenho';

/** O número muda 5 vezes por segundo: mais que isso ninguém lê e cansa a tela. */
const INTERVALO_MS = 200;

interface Props {
  buffer: BufferCircular;
  fsHz: number | null;
  /** Só lê quando o módulo está mandando sinal. */
  ativo: boolean;
  /** CVM da sessão, em µV; com ela o valor também sai em % da CVM. */
  cvmUv: number | null;
}

/** RMS dos últimos 250 ms. Lê o buffer num relógio próprio (nada de estado por amostra). */
export default function RmsAoVivo({ buffer, fsHz, ativo, cvmUv }: Props) {
  const [rmsUv, setRmsUv] = useState<number | null>(null);
  const totalVisto = useRef(-1);

  useEffect(() => {
    if (!ativo || !fsHz) {
      totalVisto.current = -1;
      setRmsUv(null);
      return;
    }
    const ler = (): void => {
      // Sem amostra nova desde a última leitura: o módulo parou de mandar.
      const total = buffer.totalRecebido;
      const mudou = total !== totalVisto.current;
      totalVisto.current = total;
      const valor = mudou ? rmsRecente(buffer, fsHz, JANELA_RMS_VIVO_MS) : null;
      const arredondado = valor === null ? null : Math.round(valor * 10) / 10;
      setRmsUv((anterior) => (anterior === arredondado ? anterior : arredondado));
    };
    ler();
    const id = setInterval(ler, INTERVALO_MS);
    return () => clearInterval(id);
  }, [buffer, fsHz, ativo]);

  const pct = rmsUv !== null && cvmUv ? normalizarPorCVM(rmsUv, cvmUv) : null;

  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">RMS (últimos 250 ms)</p>
      <p className="flex flex-wrap items-baseline gap-x-2 leading-tight" role="status" aria-live="off">
        <span className="font-mono text-3xl font-bold tabular-nums" data-testid="rms-uv">
          {rmsUv === null ? '—' : uvPt(rmsUv)}
        </span>
        <span className="text-sm text-muted-foreground">µV</span>
        {pct !== null && (
          <span className="font-mono text-lg font-semibold tabular-nums text-primary" data-testid="rms-pct-cvm">
            {pctPt(pct)} % da CVM
          </span>
        )}
      </p>
    </div>
  );
}
