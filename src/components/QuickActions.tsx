import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, ClipboardPlus, CalendarDays, PartyPopper } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const ACTIONS = [
  { key: 'pacientes', label: 'Novo Paciente', icon: UserPlus, href: '/pacientes', hint: 'Cadastrar paciente' },
  { key: 'avaliacao', label: 'Nova Avaliação', icon: ClipboardPlus, href: '/pacientes', hint: 'Iniciar avaliação' },
  { key: 'agenda', label: 'Agenda Hoje', icon: CalendarDays, href: '/agenda', hint: 'Ver agenda do dia' },
  { key: 'eventos', label: 'Eventos', icon: PartyPopper, href: '/eventos', hint: 'Abrir eventos' },
];

const FREQ_KEY = 'quick_actions_freq';

function getFreqs(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(FREQ_KEY) || '{}'); } catch { return {}; }
}

export default function QuickActions() {
  const navigate = useNavigate();
  const [sorted, setSorted] = useState(ACTIONS);

  useEffect(() => {
    const freqs = getFreqs();
    const s = [...ACTIONS].sort((a, b) => (freqs[b.key] || 0) - (freqs[a.key] || 0));
    setSorted(s);
  }, []);

  const handleClick = useCallback((action: typeof ACTIONS[0]) => {
    const freqs = getFreqs();
    freqs[action.key] = (freqs[action.key] || 0) + 1;
    localStorage.setItem(FREQ_KEY, JSON.stringify(freqs));
    navigate(action.href);
  }, [navigate]);

  return (
    <div className="flex items-center gap-0.5 md:gap-1">
      {sorted.map(a => (
        <Tooltip key={a.key} delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleClick(a)}
              className={cn(
                'h-8 w-8 md:h-9 md:w-9 rounded-lg flex items-center justify-center',
                'text-muted-foreground hover:text-primary hover:bg-primary/5',
                'border border-transparent hover:border-border/50',
                'transition-all active:scale-95',
              )}
            >
              <a.icon className="h-4 w-4 shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{a.hint}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
