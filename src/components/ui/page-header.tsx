import * as React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Cabeçalho de página padronizado.
 * Mantém hierarquia tipográfica e espaçamentos consistentes em todo o app.
 *
 * Uso:
 *   <PageHeader
 *     title="Pacientes"
 *     subtitle="Gestão completa dos seus clientes"
 *     actions={<Button>Novo</Button>}
 *   />
 */
export function PageHeader({ title, subtitle, icon, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-5 sm:mb-6',
        className,
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div className="shrink-0 mt-0.5 text-muted-foreground/70">{icon}</div>
        )}
        <div className="min-w-0">
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
