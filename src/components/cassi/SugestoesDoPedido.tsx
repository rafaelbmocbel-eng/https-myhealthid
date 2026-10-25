import { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SugestaoPedido } from '@/lib/cassiPedidos';

// O que o sistema acha que está na hora de pedir. Fica recolhido e nada entra no pedido sem o clique do profissional.
export function SugestoesDoPedido({ sugestoes, onAdicionar, onAdicionarTodos, ocupado = false }: {
  sugestoes: SugestaoPedido[];
  onAdicionar: (id: string) => void;
  onAdicionarTodos: (ids: string[]) => void;
  ocupado?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  if (sugestoes.length === 0) return null;

  return (
    <section className="rounded-xl border border-border/50 bg-background overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold">Sugeridos pelo sistema ({sugestoes.length})</span>
          <span className="block text-[11px] text-muted-foreground">Faltam poucas sessões, a guia acabou ou o cliente está sem guia. Nada entra no pedido sozinho.</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', aberto && 'rotate-180')} aria-hidden />
      </button>
      {aberto && (
        <div className="border-t border-border/50">
          <ul className="divide-y divide-border/40">
            {sugestoes.map((s) => (
              <li key={s.id} className="flex items-center gap-2 px-3 py-2">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{s.nome}</span>
                  <span className="mt-0.5 inline-block text-[9px] uppercase font-bold rounded px-1 text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30">{s.motivo}</span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-[12px] shrink-0"
                  disabled={ocupado}
                  aria-label={`Adicionar ${s.nome} ao pedido`}
                  onClick={() => onAdicionar(s.id)}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Adicionar
                </Button>
              </li>
            ))}
          </ul>
          <div className="px-3 py-2 border-t border-border/40 bg-muted/20">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[12px]"
              disabled={ocupado}
              onClick={() => onAdicionarTodos(sugestoes.map((s) => s.id))}
            >
              Adicionar todos os {sugestoes.length} ao pedido
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
