import { useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  titulo: ReactNode;
  /** Linha curta sob o título, visível também com o bloco recolhido. */
  resumo?: ReactNode;
  iniciaAberto?: boolean;
  children: ReactNode;
  className?: string;
  testid?: string;
  /** Nome acessível do botão quando o título tem só ícones ou é longo demais para leitores de tela. */
  rotulo?: string;
}

// Bloco que abre e fecha por um botão (alvo de toque de 44 px, foco visível, estado lido por leitores de tela). Não usa cor para dizer o estado.
export default function Disclosure({ titulo, resumo, iniciaAberto = false, children, className, testid, rotulo }: Props) {
  const [aberto, setAberto] = useState(iniciaAberto);
  const id = useId();
  return (
    <div className={cn('rounded-2xl border border-border/60 bg-card', className)} data-testid={testid}>
      <button type="button" aria-expanded={aberto} aria-controls={id} aria-label={rotulo} onClick={() => setAberto((v) => !v)}
        className="flex min-h-11 w-full items-start gap-2 rounded-2xl px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold leading-snug">{titulo}</span>
          {resumo && <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{resumo}</span>}
        </span>
        <ChevronDown className={cn('mt-0.5 h-4 w-4 shrink-0 transition-transform', aberto && 'rotate-180')} aria-hidden />
      </button>
      <div id={id} hidden={!aberto} className="space-y-2 border-t border-border/60 px-3 py-2.5">{aberto ? children : null}</div>
    </div>
  );
}
