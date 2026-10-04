import type { ReactNode } from 'react';
import { Activity, AudioWaveform, Dumbbell, Radio, Waypoints, Waves, Zap, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ACC, estiloAcento } from '@/lib/dosagem/acentos';
import type { Modalidade } from '@/lib/dosagem/tipos';

export const ICONES: Record<Modalidade, LucideIcon> = {
  laser: Zap,
  ultrassom: Waves,
  ondas_choque: Activity,
  tens: Radio,
  nmes: Dumbbell,
  russa: AudioWaveform,
  interferencial: Waypoints,
};

export type Tom = 'bom' | 'atencao' | 'ruim' | 'neutro';

const TONS_SELO: Record<Tom, string> = {
  bom: 'bg-emerald-100 text-emerald-900 ring-emerald-300/60 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800',
  atencao: 'bg-amber-100 text-amber-900 ring-amber-300/60 dark:bg-amber-950/50 dark:text-amber-200 dark:ring-amber-800',
  ruim: 'bg-red-100 text-red-900 ring-red-300/60 dark:bg-red-950/50 dark:text-red-200 dark:ring-red-800',
  neutro: 'bg-muted text-muted-foreground ring-border',
};

export function SeloStatus({ tom, icone, children, className }: { tom: Tom; icone?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1', TONS_SELO[tom], className)}>
      {icone}{children}
    </span>
  );
}

/**
 * Cartão principal do resultado: o número que importa, grande, na cor da
 * modalidade. O ícone da modalidade aparece como marca d’água.
 */
export function DoseHero({ modalidade, rotulo, valor, unidade, detalhe, children }: {
  modalidade: Modalidade; rotulo: string; valor: string; unidade?: string; detalhe?: string; children?: ReactNode;
}) {
  const Icone = ICONES[modalidade];
  return (
    <div style={estiloAcento(modalidade)} className={cn('relative overflow-hidden rounded-3xl border p-5 shadow-sm', ACC.borda, ACC.gradiente)}>
      <Icone aria-hidden className={cn('pointer-events-none absolute -bottom-5 -right-3 h-32 w-32 opacity-[0.09]', ACC.texto)} strokeWidth={1.25} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{rotulo}</p>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-5xl font-extrabold leading-none tracking-tight tabular-nums" aria-live="polite">{valor}</span>
        {unidade && <span className={cn('text-xl font-bold', ACC.texto)}>{unidade}</span>}
      </div>
      {detalhe && <p className="mt-2 text-sm text-muted-foreground tabular-nums">{detalhe}</p>}
      {children && <div className="relative mt-3 space-y-2">{children}</div>}
    </div>
  );
}

/**
 * Resumo que acompanha a rolagem no celular: o número da dose fica visível
 * enquanto os parâmetros são digitados. Some no computador, onde o cartão
 * completo já fica ao lado.
 */
export function DoseBarraMovel({ modalidade, rotulo, valor, unidade, nota }: {
  modalidade: Modalidade; rotulo: string; valor: string; unidade?: string; nota?: string;
}) {
  const Icone = ICONES[modalidade];
  return (
    <div className={cn('sticky top-[4.25rem] z-20 overflow-hidden rounded-2xl border bg-card/95 shadow-md backdrop-blur lg:hidden', ACC.borda)}>
      <span aria-hidden className={cn('absolute inset-0', ACC.suave)} />
      <div className="relative flex items-center gap-3 px-3.5 py-2.5">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', ACC.solido)}><Icone className="h-[18px] w-[18px]" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{rotulo}</p>
          <p className="flex items-baseline gap-1 tabular-nums"><span className="text-2xl font-extrabold leading-none">{valor}</span>{unidade && <span className={cn('text-sm font-bold', ACC.texto)}>{unidade}</span>}</p>
        </div>
        {nota && <p className="max-w-[40%] text-right text-[11px] leading-tight text-muted-foreground">{nota}</p>}
      </div>
    </div>
  );
}
