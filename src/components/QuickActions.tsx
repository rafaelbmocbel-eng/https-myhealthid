import { useNavigate } from 'react-router-dom';
import { UserPlus, ClipboardPlus, CalendarDays } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const actions = [
  { label: 'Novo Paciente', icon: UserPlus, href: '/pacientes', hint: 'Cadastrar paciente' },
  { label: 'Nova Avaliação', icon: ClipboardPlus, href: '/metodo-identidade', hint: 'Iniciar avaliação' },
  { label: 'Agenda Hoje', icon: CalendarDays, href: '/agenda', hint: 'Ver agenda do dia' },
];

export default function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center gap-1">
      {actions.map(a => (
        <Tooltip key={a.href} delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => navigate(a.href)}
              className={cn(
                'h-9 w-9 rounded-lg flex items-center justify-center',
                'text-muted-foreground hover:text-primary hover:bg-primary/5',
                'border border-transparent hover:border-border/50',
                'transition-all active:scale-95',
              )}
            >
              <a.icon className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{a.hint}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
