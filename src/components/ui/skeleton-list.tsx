import { Skeleton } from './skeleton';

interface SkeletonListProps {
  rows?: number;
  /** mostra avatar circular à esquerda (lista de pacientes/mensagens) */
  avatar?: boolean;
  className?: string;
}

/**
 * Lista skeleton premium — shimmer dourado sutil + layout fiel ao card real.
 * Use em qualquer lista pesada (pacientes, conversas, agenda, financeiro).
 */
export function SkeletonList({ rows = 5, avatar = true, className }: SkeletonListProps) {
  return (
    <div className={`space-y-2 ${className || ''}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton-row animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
          {avatar && <Skeleton className="h-10 w-10 rounded-full shrink-0" />}
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-6 w-14 rounded-md shrink-0" />
        </div>
      ))}
    </div>
  );
}

export default SkeletonList;
