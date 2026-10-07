import { CalendarClock, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  calcularDataReavaliacao, diasAteReavaliacao, formatarDataBR, lerAcompanhamento, lerGovernanca,
} from '@/lib/governanca';

// Como acompanhar o plano: indicadores (como medir / quando agir) e a data da
// reavaliação, lidos de `_governanca.acompanhamento`. Plano sem esse bloco (legado)
// não mostra nada. Os textos de "quando agir" são orientações gerais e não
// substituem a avaliação de um profissional.

interface Props {
  conteudo: unknown;
  /** Data de liberação do plano; se omitida, usa a do registro de aprovação. */
  aprovacaoEm?: string | Date | null;
  titulo?: string;
  className?: string;
}

function rotuloPrazo(dias: number): string {
  if (dias < 0) return 'Reavaliação em atraso — combine com o seu profissional.';
  if (dias === 0) return 'A reavaliação é hoje.';
  if (dias === 1) return 'Falta 1 dia para a reavaliação.';
  return `Faltam ${dias} dias para a reavaliação.`;
}

export default function ResumoAcompanhamento({ conteudo, aprovacaoEm, titulo = 'Como acompanhar este plano', className }: Props) {
  const acompanhamento = lerAcompanhamento(conteudo);
  if (!acompanhamento) return null;

  const gov = lerGovernanca(conteudo);
  const semanas = acompanhamento.reavaliar_em_semanas;
  const dataReavaliacao = calcularDataReavaliacao(gov, aprovacaoEm, acompanhamento);
  const dias = dataReavaliacao ? diasAteReavaliacao(dataReavaliacao) : null;
  const atrasada = dias !== null && dias < 0;

  return (
    <section className={cn('rounded-xl border border-border/60 bg-card p-3 space-y-3', className)} aria-label={titulo}>
      <div className="flex items-start gap-2">
        <Activity className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
        <h4 className="text-sm font-semibold leading-snug">{titulo}</h4>
      </div>

      {semanas !== null && (
        <div
          className={cn(
            'flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs',
            atrasada ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30' : 'border-border/60 bg-muted/30',
          )}
        >
          <CalendarClock className={cn('h-4 w-4 shrink-0 mt-0.5', atrasada ? 'text-amber-600' : 'text-primary')} aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold">
              Reavaliar em {semanas} {semanas === 1 ? 'semana' : 'semanas'}
              {dataReavaliacao ? ` (até ${formatarDataBR(dataReavaliacao)})` : ''}
            </p>
            {dataReavaliacao && dias !== null ? (
              <p className="text-muted-foreground">{rotuloPrazo(dias)}</p>
            ) : (
              <p className="text-muted-foreground">O prazo conta a partir da liberação do plano.</p>
            )}
          </div>
        </div>
      )}

      {acompanhamento.indicadores.length > 0 && (
        <ul className="space-y-2">
          {acompanhamento.indicadores.map((i) => (
            <li key={i.id} className="rounded-lg border border-border/50 p-2.5 space-y-1">
              <p className="text-xs font-semibold">{i.nome}</p>
              {i.como_medir && (
                <p className="text-xs text-foreground/85">
                  <span className="font-semibold">Como medir:</span> {i.como_medir}
                </p>
              )}
              {i.quando_agir && (
                <p className="text-xs text-foreground/85">
                  <span className="font-semibold">Quando agir:</span> {i.quando_agir}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-[10px] italic text-muted-foreground">
        Orientações gerais de acompanhamento. Não substituem a avaliação de um profissional de saúde.
      </p>
    </section>
  );
}
