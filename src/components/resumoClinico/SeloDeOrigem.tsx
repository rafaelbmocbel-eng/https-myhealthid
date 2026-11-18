import { cn } from '@/lib/utils';
import { SELO_CLIENTE, SELO_DATA_CONFIRMADA, SELO_PROFISSIONAL } from '@/lib/resumoClinico/tipos';
import type { OrigemDoDado } from '@/lib/resumoClinico/tipos';

interface Props {
  origem: OrigemDoDado;
  // Terceiro visual: a data é do profissional, mas o texto é do cliente (marco confirmado). Sem isto, o selo diria só
  // "Registrado pelo profissional" e assinaria o que o cliente escreveu.
  dataConfirmada?: boolean;
}

const APARENCIA: Record<OrigemDoDado | 'data-confirmada', { texto: string; cor: string }> = {
  cliente: { texto: SELO_CLIENTE, cor: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300' },
  profissional: { texto: SELO_PROFISSIONAL, cor: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300' },
  'data-confirmada': { texto: SELO_DATA_CONFIRMADA, cor: 'border-teal-500/30 bg-teal-500/10 text-teal-800 dark:text-teal-300' },
};

export default function SeloDeOrigem({ origem, dataConfirmada = false }: Props) {
  const { texto, cor } = APARENCIA[dataConfirmada ? 'data-confirmada' : origem];
  return (
    <span
      data-origem={origem}
      data-selo={dataConfirmada ? 'data-confirmada' : undefined}
      className={cn('inline-flex max-w-full items-center break-words rounded-md border px-1.5 py-0.5 text-xs font-medium leading-tight', cor)}
    >
      {texto}
    </span>
  );
}
