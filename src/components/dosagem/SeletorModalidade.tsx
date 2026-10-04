import { cn } from '@/lib/utils';
import { ACC, estiloAcento } from '@/lib/dosagem/acentos';
import { GRUPOS, MODALIDADES, type Modalidade } from '@/lib/dosagem/tipos';
import { ICONES } from './visual';

// Escolha da modalidade: cartões agrupados, cada um na cor da sua modalidade.
export default function SeletorModalidade({ valor, onChange }: { valor: Modalidade; onChange: (m: Modalidade) => void }) {
  return (
    <div role="tablist" aria-label="Modalidade" className="space-y-3">
      {GRUPOS.map((g) => (
        <div key={g.id} className="space-y-1.5">
          <p className="px-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{g.titulo}</p>
          <div className={cn('grid gap-2', g.id === 'luz_ondas' ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4')}>
            {MODALIDADES.filter((m) => m.grupo === g.id).map((m) => {
              const Icone = ICONES[m.id];
              const ativo = m.id === valor;
              return (
                <button key={m.id} type="button" role="tab" aria-selected={ativo} onClick={() => onChange(m.id)} style={estiloAcento(m.id)}
                  className={cn(
                    'group relative flex flex-col gap-2 rounded-2xl border p-3 text-left transition-all duration-200 sm:flex-row sm:items-center sm:gap-3',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    ACC.anel,
                    ativo
                      ? cn(ACC.borda, ACC.suave, 'ring-2 shadow-sm')
                      : 'border-border/60 bg-card hover:-translate-y-px hover:border-border hover:shadow-sm motion-reduce:hover:translate-y-0',
                  )}>
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors', ativo ? ACC.solido : cn(ACC.suaveForte, ACC.texto))}>
                    <Icone className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold leading-tight">{m.curto}</span>
                    <span className="mt-0.5 hidden text-[11px] leading-snug text-muted-foreground sm:block">{m.resumo}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
