import { cn } from '@/lib/utils';
import { SELO_CLIENTE, SELO_PROFISSIONAL } from '@/lib/resumoClinico/tipos';
import type { OrigemDoDado } from '@/lib/resumoClinico/tipos';

export default function SeloDeOrigem({ origem }: { origem: OrigemDoDado }) {
  const cliente = origem === 'cliente';
  return (
    <span
      data-origem={origem}
      className={cn(
        'inline-flex max-w-full items-center rounded-md border px-1.5 py-0.5 text-xs font-medium leading-tight',
        cliente
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300'
          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
      )}
    >
      {cliente ? SELO_CLIENTE : SELO_PROFISSIONAL}
    </span>
  );
}
