import { useEffect, useRef, useState } from 'react';
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
  const painelRef = useRef<HTMLDivElement>(null);
  const caixaRef = useRef<HTMLDivElement>(null);
  const [anuncio, setAnuncio] = useState('');

  // A região de aviso para leitor de tela precisa existir antes de o conteúdo mudar, senão o primeiro aviso se perde:
  // por isso fica sempre montada, enquanto o painel visual aparece só durante a gravação e a finalização.
  useEffect(() => {
    setAnuncio((anterior) => {
      if (ouvindo) return 'Gravando';
      if (transcrevendo) return 'Finalizando a transcrição';
      return anterior ? 'Gravação finalizada' : '';
    });
  }, [ouvindo, transcrevendo]);

  // Em tela baixa o painel nasce abaixo da dobra: traz para a vista, sem mexer na página se já estiver visível.
  useEffect(() => {
    if (ouvindo) painelRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [ouvindo]);

  // Rola só a caixa (não a página, que a pessoa pode estar lendo em outro ponto).
  useEffect(() => {
    const caixa = caixaRef.current;
    if (caixa) caixa.scrollTop = caixa.scrollHeight;
  }, [texto]);

  return (
    <>
      <div role="status" className="sr-only">{anuncio}</div>
      {(ouvindo || transcrevendo) && (
        <div ref={painelRef} className={cn('rounded-lg border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/20 p-2.5 text-sm', className)}>
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-red-700 dark:text-red-400">
            <span className={cn('h-2 w-2 rounded-full bg-red-500', ouvindo && 'animate-pulse')} aria-hidden />
            {ouvindo ? (indisponivel ? 'Ouvindo… o texto aparece ao parar' : 'Ouvindo… o texto aparece conforme você fala') : 'Finalizando a transcrição…'}
          </div>
          {!texto && ouvindo && !indisponivel && (
            <p className="mt-1 text-[11px] text-muted-foreground">O texto começa a aparecer depois de alguns segundos de fala.</p>
          )}
          {texto && (
            <div ref={caixaRef} className="mt-1.5 max-h-48 overflow-y-auto">
              <p className="whitespace-pre-wrap text-foreground">{texto}</p>
            </div>
          )}
          {indisponivel && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              A prévia ao vivo não está disponível agora. A gravação continua normalmente.
            </p>
          )}
        </div>
      )}
    </>
  );
}
