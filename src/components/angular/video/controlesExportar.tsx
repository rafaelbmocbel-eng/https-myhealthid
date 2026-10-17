import type { ReactNode } from 'react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/*
 * Controles do diálogo "Baixar vídeo analisado", no mesmo desenho do diálogo "Arte para Instagram" (alvos de toque de 44 px ou mais).
 */

export function Grupo({ titulo, dica, children }: { titulo: string; dica?: string; children: ReactNode }) {
  return (
    <section className="space-y-2" aria-label={titulo}>
      <div>
        <h3 className="text-sm font-semibold">{titulo}</h3>
        {dica && <p className="text-xs text-muted-foreground">{dica}</p>}
      </div>
      {children}
    </section>
  );
}

export interface OpcaoChip<T extends string> { valor: T; rotulo: string; detalhe?: string }

export function Chips<T extends string>({ rotulo, valor, opcoes, aoEscolher, colunas, desabilitado }: { rotulo: string; valor: T; opcoes: OpcaoChip<T>[]; aoEscolher: (v: T) => void; colunas?: string; desabilitado?: boolean }) {
  return (
    <div role="group" aria-label={rotulo} className={cn('grid gap-1.5', colunas ?? 'grid-cols-2 sm:grid-cols-3')}>
      {opcoes.map((o) => (
        <button
          key={o.valor} type="button" aria-pressed={valor === o.valor} disabled={desabilitado} onClick={() => aoEscolher(o.valor)}
          className={cn('flex min-h-11 flex-col items-center justify-center rounded-xl border px-2 py-1 text-sm font-semibold leading-tight transition-colors disabled:pointer-events-none disabled:opacity-50',
            valor === o.valor ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/50')}
        >
          {o.rotulo}
          {o.detalhe && <span className="text-[11px] font-normal text-muted-foreground">{o.detalhe}</span>}
        </button>
      ))}
    </div>
  );
}

export function Deslizante({ rotulo, valor, min, max, passo, aoMudar, texto, desabilitado }: { rotulo: string; valor: number; min: number; max: number; passo: number; aoMudar: (v: number) => void; texto: string; desabilitado?: boolean }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{rotulo}</span>
        <span className="text-xs font-semibold tabular-nums">{texto}</span>
      </div>
      <input type="range" min={min} max={max} step={passo} value={valor} disabled={desabilitado} aria-label={rotulo} onChange={(e) => aoMudar(Number(e.target.value))} className="h-11 w-full cursor-pointer touch-pan-x accent-primary disabled:opacity-50" />
    </div>
  );
}

export function Interruptor({ rotulo, marcado, aoMudar, desabilitado }: { rotulo: string; marcado: boolean; aoMudar: (v: boolean) => void; desabilitado?: boolean }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm">
      <span>{rotulo}</span>
      <Switch checked={marcado} disabled={desabilitado} onCheckedChange={aoMudar} aria-label={rotulo} />
    </label>
  );
}
