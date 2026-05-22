import { Heart } from 'lucide-react';

/**
 * Rodapé interno do app — copyright + autoria.
 * Aparece em todas as páginas internas (envolvidas por AppLayout).
 */
export default function AppFooter() {
  const ano = new Date().getFullYear();
  return (
    <footer className="mt-8 border-t border-border/40 px-4 sm:px-6 py-4 text-[11px] text-muted-foreground/80 flex flex-col sm:flex-row items-center justify-between gap-1.5">
      <div className="flex items-center gap-1.5">
        <span>© {ano}</span>
        <span className="font-medium text-foreground/80">Rafael Marcus Braga Mocbel</span>
        <span className="hidden sm:inline">— Todos os direitos reservados.</span>
      </div>
      <div className="flex items-center gap-1 opacity-80">
        <span>MY HEALTH ID</span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          Feito com <Heart className="h-3 w-3 fill-current text-rose-500/80" /> para a saúde
        </span>
      </div>
    </footer>
  );
}
