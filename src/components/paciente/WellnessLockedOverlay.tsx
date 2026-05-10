import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface Props {
  title?: string;
  description?: string;
  className?: string;
}

/**
 * Overlay translúcido para conteúdo bloqueado a usuários Wellness Free.
 * Cobre o card pai (que deve ser `relative`).
 */
export default function WellnessLockedOverlay({
  title = 'Recurso Premium',
  description = 'Assine o plano Wellness para desbloquear',
  className = '',
}: Props) {
  const navigate = useNavigate();
  return (
    <div
      className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-background/85 backdrop-blur-sm p-4 text-center ${className}`}
    >
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
        <Lock className="icon-md text-primary" />
      </div>
      <p className="text-sm font-bold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground max-w-[240px]">{description}</p>
      <Button
        size="sm"
        className="mt-1 h-8 text-xs gap-1"
        onClick={() => navigate('/paciente/plano')}
      >
        <Sparkles className="icon-sm" /> Conhecer plano
      </Button>
    </div>
  );
}
