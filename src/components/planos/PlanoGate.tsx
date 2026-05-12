import { ReactNode } from "react";
import { Lock, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { usePlanoAtivo, temAcessoModulo } from "@/hooks/usePlanoAtivo";

interface PlanoGateProps {
  feature: string;
  children: ReactNode;
  /** Quando true (default), renderiza o paywall inline. Quando false, esconde o conteúdo silenciosamente. */
  showPaywall?: boolean;
  /** Texto custom do call-to-action */
  title?: string;
  description?: string;
}

/**
 * Bloqueia conteúdo conforme o módulo do plano ativo do usuário.
 * Se o usuário não tem plano (modo legado), libera tudo — esse comportamento
 * vai mudar quando o pagamento for ativado.
 */
export function PlanoGate({
  feature,
  children,
  showPaywall = true,
  title = "Função premium",
  description = "Esta funcionalidade está disponível em planos superiores.",
}: PlanoGateProps) {
  const { data: plano, isLoading } = usePlanoAtivo();

  if (isLoading) return null;
  if (temAcessoModulo(plano, feature)) return <>{children}</>;
  if (!showPaywall) return null;

  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Lock className="icon-md text-primary" />
      </div>
      <h3 className="h-card mb-1">{title}</h3>
      <p className="text-caption mb-4 max-w-md mx-auto">{description}</p>
      <Button asChild size="sm" className="gap-2">
        <Link to="/precos">
          <Sparkles className="icon-sm" />
          Ver planos
        </Link>
      </Button>
    </div>
  );
}
