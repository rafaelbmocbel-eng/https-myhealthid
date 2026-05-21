import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Mostra botão de voltar. `true` = history.back(), string = navega para rota. */
  back?: boolean | string;
}

/**
 * Cabeçalho de página padronizado (Serene Health Premium).
 * - `eyebrow` opcional renderiza pequeno label dourado uppercase acima do título.
 * - `back` opcional renderiza botão de voltar à esquerda do título.
 */
export function PageHeader({ title, subtitle, eyebrow, icon, actions, className, back }: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (typeof back === 'string') {
      navigate(back);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <header
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-5 sm:mb-6',
        className,
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        {back && (
          <button
            type="button"
            onClick={handleBack}
            aria-label="Voltar"
            className="shrink-0 mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/50 bg-background text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        {icon && (
          <div className="shrink-0 mt-0.5 text-muted-foreground/70">{icon}</div>
        )}
        <div className="min-w-0">
          {eyebrow && <div className="eyebrow-accent mb-1.5">{eyebrow}</div>}
          <h1 className="h-page truncate">{title}</h1>
          {subtitle && (
            <p className="text-caption mt-1 line-clamp-2">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </header>
  );
}

export default PageHeader;
