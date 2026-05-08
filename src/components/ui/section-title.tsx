import * as React from 'react';
import { cn } from '@/lib/utils';

interface SectionTitleProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Título de seção dentro de uma página.
 * Use entre blocos de conteúdo para criar hierarquia clara
 * sem precisar abusar de cards ou dividers.
 */
export function SectionTitle({ title, description, icon, actions, className }: SectionTitleProps) {
  return (
    <div className={cn('flex items-end justify-between gap-3 mb-3', className)}>
      <div className="flex items-start gap-2 min-w-0">
        {icon && <div className="shrink-0 mt-0.5 text-muted-foreground">{icon}</div>}
        <div className="min-w-0">
          <h2 className="h-section">{title}</h2>
          {description && <p className="text-caption mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export default SectionTitle;
