import * as React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Estado vazio padronizado — clean, centralizado, sem ruído.
 * Use sempre que uma lista/seção não tiver dados para mostrar.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-10 sm:py-14',
        className,
      )}
    >
      {icon && (
        <div className="mb-3 h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="h-card">{title}</p>
      {description && (
        <p className="text-caption mt-1.5 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export default EmptyState;
