import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, ClipboardPlus, CalendarDays, PartyPopper, Plus } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

const ACTIONS = [
  { key: 'pacientes', label: 'Novo Paciente', icon: UserPlus, href: '/pacientes', hint: 'Cadastrar paciente' },
  { key: 'avaliacao', label: 'Nova Avaliação', icon: ClipboardPlus, href: '/metodo-identidade', hint: 'Iniciar avaliação' },
  { key: 'agenda', label: 'Agenda Hoje', icon: CalendarDays, href: '/agenda', hint: 'Ver agenda do dia' },
  { key: 'eventos', label: 'Eventos', icon: PartyPopper, href: '/eventos', hint: 'Abrir eventos' },
];

const FREQ_KEY = 'quick_actions_freq';

function getFreqs(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(FREQ_KEY) || '{}'); } catch { return {}; }
}

export default function QuickActions() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [sorted, setSorted] = useState(ACTIONS);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const freqs = getFreqs();
    const s = [...ACTIONS].sort((a, b) => (freqs[b.key] || 0) - (freqs[a.key] || 0));
    setSorted(s);
  }, []);

  const handleClick = useCallback((action: typeof ACTIONS[0]) => {
    const freqs = getFreqs();
    freqs[action.key] = (freqs[action.key] || 0) + 1;
    localStorage.setItem(FREQ_KEY, JSON.stringify(freqs));
    setOpen(false);
    navigate(action.href);
  }, [navigate]);

  // Mobile: collapse into a single popover button
  if (isMobile) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'h-9 w-9 rounded-lg flex items-center justify-center',
              'text-muted-foreground hover:text-primary hover:bg-primary/5',
              'border border-transparent hover:border-border/50',
              'transition-all active:scale-95',
            )}
          >
            <Plus className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-48 p-1">
          {sorted.map(a => (
            <button
              key={a.key}
              onClick={() => handleClick(a)}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              <a.icon className="h-4 w-4 text-muted-foreground" />
              {a.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    );
  }

  // Desktop: show all icons inline
  return (
    <div className="flex items-center gap-1">
      {sorted.map(a => (
        <Tooltip key={a.key} delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleClick(a)}
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
