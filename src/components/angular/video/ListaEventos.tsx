import { Crosshair, LocateFixed, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatarSegundos } from '@/lib/angular/analiseVideo/tempo';
import { COR_LADO, NOME_EVENTO, type EventoUi, type Lado, type TipoEvento } from '@/lib/angular/analiseVideo/tiposUi';

interface Props {
  eventos: EventoUi[];
  /** Índice do quadro atual: é onde um evento novo é marcado ou movido. */
  quadroAtual: number;
  aoIr: (i: number) => void;
  aoAdicionar: (tipo: TipoEvento, lado: Lado) => void;
  aoMover: (id: string) => void;
  aoRemover: (id: string) => void;
  aoRestaurar?: () => void;
}

// Eventos da marcha ou corrida: o app sugere, o profissional confere e ajusta (mover para o quadro atual, apagar, marcar).
export default function ListaEventos({ eventos, quadroAtual, aoIr, aoAdicionar, aoMover, aoRemover, aoRestaurar }: Props) {
  const editados = eventos.some((e) => e.origem === 'manual');
  return (
    <div className="space-y-3">
      <p className="text-xs leading-snug text-muted-foreground">
        Os eventos são <strong className="text-foreground">sugestões</strong> do app a partir do movimento do pé. Confira em câmera lenta: vá ao quadro certo e use “Mover para este quadro”, ou marque um novo.
      </p>
      <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Marcar evento neste quadro">
        {([['contato', 'D'], ['contato', 'E'], ['saida', 'D'], ['saida', 'E']] as const).map(([tipo, lado]) => (
          <button key={`${tipo}${lado}`} type="button" onClick={() => aoAdicionar(tipo, lado)}
            className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-border/60 px-2 text-sm font-semibold hover:bg-muted/50 active:scale-[0.98]">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: COR_LADO[lado] }} aria-hidden />
            {tipo === 'contato' ? 'Contato' : 'Saída'} {lado === 'D' ? 'direito' : 'esquerdo'}
          </button>
        ))}
      </div>
      {eventos.length === 0 ? (
        <p className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">Nenhum evento detectado. Marque os contatos do pé nos quadros certos.</p>
      ) : (
        <ul className="space-y-1.5" data-testid="lista-eventos">
          {eventos.map((e) => (
            <li key={e.id} className="flex items-center gap-1.5 rounded-xl border border-border/60 p-1.5" data-testid="evento">
              <button type="button" onClick={() => aoIr(e.i)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 text-left hover:bg-muted/40" aria-label={`Ir para ${NOME_EVENTO[e.tipo]} ${e.lado === 'D' ? 'direito' : 'esquerdo'} em ${formatarSegundos(e.t)}`}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: COR_LADO[e.lado] }} aria-hidden>{e.lado}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{NOME_EVENTO[e.tipo]}</span>
                  <span className="block text-[11px] tabular-nums text-muted-foreground">{formatarSegundos(e.t)} · quadro {e.i + 1} · {e.origem === 'auto' ? 'sugerido' : 'editado'}</span>
                </span>
              </button>
              <button type="button" onClick={() => aoMover(e.id)} disabled={e.i === quadroAtual}
                className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30')} aria-label="Mover para este quadro" title="Mover para este quadro">
                <Crosshair className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => aoRemover(e.id)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10" aria-label="Remover evento" title="Remover evento">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {editados && aoRestaurar && (
        <button type="button" onClick={aoRestaurar} className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-border/60 text-sm font-medium hover:bg-muted/50">
          <LocateFixed className="h-4 w-4" /> Voltar às sugestões do app
        </button>
      )}
    </div>
  );
}
