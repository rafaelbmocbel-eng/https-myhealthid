import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Padrão único do "fechar" em todo o app (modais, painéis laterais e telas
// sobrepostas): círculo de 36px com borda e fundo próprio, visível sobre
// qualquer conteúdo, no canto superior direito.
export const fecharButtonClass =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/95 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export const FecharIcone = () => <X className="h-5 w-5" strokeWidth={2.25} aria-hidden />;

export const FecharButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button ref={ref} type="button" aria-label="Fechar" className={cn(fecharButtonClass, className)} {...props}>
      <FecharIcone />
    </button>
  ),
);
FecharButton.displayName = "FecharButton";
