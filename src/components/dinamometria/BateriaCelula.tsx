import { cn } from '@/lib/utils';

// Carga da bateria da célula em %: verde > 50%, amarelo 20–50%, vermelho < 20%.
export function corBateria(pct: number) {
  return pct > 50 ? 'text-emerald-700 dark:text-emerald-400' : pct >= 20 ? 'text-amber-700 dark:text-amber-400' : 'text-red-600';
}

export default function BateriaCelula({ pct, volts, className }: { pct: number | null; volts?: number | null; className?: string }) {
  if (pct == null) return null;
  const preench = pct > 50 ? 'bg-emerald-500' : pct >= 20 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-xs font-semibold tabular-nums', corBateria(pct), className)}
      title={volts != null ? `Bateria ${pct}% (${volts.toFixed(2).replace('.', ',')} V)` : `Bateria ${pct}%`}
      aria-label={`Bateria da célula em ${pct}%`}
    >
      <span className="relative inline-flex h-2.5 w-5 rounded-[3px] border border-current p-[1px]">
        <span className={cn('h-full rounded-[1px]', preench)} style={{ width: `${Math.max(6, pct)}%` }} />
        <span className="absolute -right-[3px] top-1/2 h-1 w-[2px] -translate-y-1/2 rounded-r-sm bg-current" />
      </span>
      {pct}%
    </span>
  );
}
