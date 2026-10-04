import { Check } from 'lucide-react';
import { REGIOES } from '@/lib/dinamometria/analise';
import { miniCorpoSVG } from '@/lib/dinamometria/anatomia';
import { cn } from '@/lib/utils';

// Escolha das articulações do teste: cartões com a miniatura do corpo e a
// articulação destacada, e os dois grupos musculares que serão medidos.
export default function SeletorRegioes({ selecionadas, onAlternar }: { selecionadas: string[]; onAlternar: (r: string) => void }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
      {Object.entries(REGIOES).map(([k, r]) => {
        const ativo = selecionadas.includes(k);
        return (
          <button
            key={k}
            type="button"
            onClick={() => onAlternar(k)}
            aria-pressed={ativo}
            className={cn(
              'relative flex items-center gap-2.5 rounded-xl border p-2 pr-3 text-left transition-all active:scale-[0.98]',
              ativo ? 'border-primary bg-primary/5 ring-1 ring-primary/30 shadow-sm' : 'border-border/70 bg-card hover:bg-muted/50',
            )}
          >
            <span className="block h-[68px] w-9 shrink-0 overflow-hidden" dangerouslySetInnerHTML={{ __html: miniCorpoSVG(k, ativo) }} />
            <span className="min-w-0">
              <span className={cn('block text-sm font-semibold leading-tight [overflow-wrap:anywhere] pr-4', ativo ? 'text-foreground' : 'text-foreground/80')}>{r.l}</span>
              <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">{r.ag} × {r.an}</span>
            </span>
            {ativo && (
              <span className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <Check className="h-3 w-3" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
