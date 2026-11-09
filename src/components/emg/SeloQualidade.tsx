import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { BufferCircular } from '@/lib/emg/bufferCircular';
import { qualidadeDoSinal, type NivelQualidade } from '@/lib/emg/metricas';
import { cn } from '@/lib/utils';

/** Janela avaliada: o selo olha o trecho mais quieto dela, então uma contração curta não o derruba. */
export const JANELA_QUALIDADE_S = 8;
/** Com menos sinal que isto o selo diz "Medindo". */
export const MINIMO_QUALIDADE_S = 3;
const INTERVALO_MS = 1000;

type Leitura = { nivel: NivelQualidade; motivos: string[] } | 'medindo' | null;

const ROTULOS: Record<NivelQualidade, string> = { bom: 'Sinal bom', atencao: 'Sinal pede atenção', ruim: 'Sinal ruim' };
const CLASSES: Record<NivelQualidade, string> = {
  bom: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  atencao: 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  ruim: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
};

function igual(a: Leitura, b: Leitura): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === 'medindo' || b === 'medindo') return false;
  return a.nivel === b.nivel && a.motivos.join('|') === b.motivos.join('|');
}

interface Props {
  buffer: BufferCircular;
  fsHz: number | null;
  ativo: boolean;
}

/** Selo de qualidade do sinal ao vivo (ruído de repouso, rede elétrica, saturação), atualizado a cada segundo. */
export default function SeloQualidade({ buffer, fsHz, ativo }: Props) {
  const [leitura, setLeitura] = useState<Leitura>(null);

  useEffect(() => {
    if (!ativo || !fsHz) {
      setLeitura(null);
      return;
    }
    const avaliar = (): void => {
      const amostras = buffer.ultimas(Math.round(fsHz * JANELA_QUALIDADE_S));
      let nova: Leitura;
      if (amostras.length < fsHz * MINIMO_QUALIDADE_S) {
        nova = 'medindo';
      } else {
        const q = qualidadeDoSinal(amostras, fsHz);
        nova = { nivel: q.nivel, motivos: q.motivos };
      }
      setLeitura((anterior) => (igual(anterior, nova) ? anterior : nova));
    };
    avaliar();
    const id = setInterval(avaliar, INTERVALO_MS);
    return () => clearInterval(id);
  }, [buffer, fsHz, ativo]);

  if (leitura === null) return null;
  if (leitura === 'medindo') {
    return (
      <span
        data-testid="selo-qualidade"
        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
      >
        <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" aria-hidden /> Medindo o sinal…
      </span>
    );
  }
  const Icone = leitura.nivel === 'bom' ? CheckCircle2 : leitura.nivel === 'atencao' ? AlertTriangle : XCircle;
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span
        data-testid="selo-qualidade"
        title={`Avaliado no trecho mais quieto dos últimos ${JANELA_QUALIDADE_S} s.`}
        className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', CLASSES[leitura.nivel])}
      >
        <Icone className="h-3 w-3" aria-hidden /> {ROTULOS[leitura.nivel]}
      </span>
      {leitura.nivel !== 'bom' && leitura.motivos.length > 0 && (
        <span className="text-[11px] leading-snug text-muted-foreground">{leitura.motivos.join('; ')}</span>
      )}
    </span>
  );
}
