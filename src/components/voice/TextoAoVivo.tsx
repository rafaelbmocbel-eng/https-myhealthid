import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  ouvindo: boolean;
  transcrevendo: boolean;
  texto: string;
  /** O ao vivo não está rodando (sem Web Audio ou o servidor não respondeu): o texto completo sai ao final. */
  indisponivel?: boolean;
  className?: string;
}

export function TextoAoVivo({ ouvindo, transcrevendo, texto, indisponivel = false, className }: Props) {
  const caixaRef = useRef<HTMLDivElement>(null);
  // Rola só a caixa (não a página, que a pessoa pode estar lendo em outro ponto).
  useEffect(() => {
    const caixa = caixaRef.current;
    if (caixa) caixa.scrollTop = caixa.scrollHeight;
  }, [texto]);
  if (!ouvindo && !transcrevendo) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('rounded-lg border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/20 p-2.5 text-sm', className)}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-red-700 dark:text-red-400">
        <span className={cn('h-2 w-2 rounded-full bg-red-500', ouvindo && 'animate-pulse')} aria-hidden />
        {ouvindo ? (indisponivel ? 'Ouvindo… o texto aparece ao parar' : 'Ouvindo… o texto aparece conforme você fala') : 'Finalizando a transcrição…'}
      </div>
      {texto && (
        <div ref={caixaRef} className="mt-1.5 max-h-48 overflow-y-auto">
          <p className="whitespace-pre-wrap text-foreground">{texto}</p>
        </div>
      )}
      {indisponivel && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          A prévia ao vivo não está disponível agora. A transcrição completa é feita ao final da gravação.
        </p>
      )}
    </div>
  );
}
