import { Skeleton } from '@/components/ui/skeleton';

/**
 * Placeholder de carregamento do portal do cliente. Em vez de um spinner cru
 * que faz a tela "piscar" e pular quando os dados chegam, imita o layout (título
 * + cards), dando a sensação de app acabado (estilo Instagram/iFood carregando).
 */
export default function PortalSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4" aria-busy="true" aria-label="Carregando">
      {/* Título da tela */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      {/* Cards */}
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border/40 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}
