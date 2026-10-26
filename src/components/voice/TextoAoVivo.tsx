import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  ouvindo: boolean;
  transcrevendo: boolean;
  texto: string;
  /** O ao vivo parou de tentar (o servidor não respondeu várias vezes): o texto completo sai ao final. */
  indisponivel?: boolean;
  className?: string;
}

// Caixa que mostra a transcrição aparecendo enquanto a pessoa fala (trecho a trecho, a cada pausa).
export function TextoAoVivo({ ouvindo, transcrevendo, texto, indisponivel = false, className }: Props) {
  const fimRef = useRef<HTMLDivElement>(null);
  // Fala longa: a caixa rola sozinha para o trecho mais novo.
  useEffect(() => { fimRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [texto]);
  if (!ouvindo && !transcrevendo) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('rounded-lg border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/20 p-2.5 text-sm', className)}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-red-700 dark:text-red-400">
        <span className={cn('h-2 w-2 rounded-full bg-red-500', ouvindo && 'animate-pulse')} aria-hidden />
        {ouvindo ? 'Ouvindo… o texto aparece conforme você fala' : 'Finalizando a transcrição…'}
      </div>
      {texto && (
        <div className="mt-1.5 max-h-48 overflow-y-auto">
          <p className="whitespace-pre-wrap text-foreground">{texto}</p>
          <div ref={fimRef} />
        </div>
      )}
      {indisponivel && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          A prévia ao vivo pausou porque o servidor não respondeu. A transcrição completa continua sendo feita ao final.
        </p>
      )}
    </div>
  );
}
