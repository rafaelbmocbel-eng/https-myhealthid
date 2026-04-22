import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, UserPlus, ClipboardPlus, CalendarDays, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

const ACTIONS = [
  { key: 'pacientes', label: 'Novo Paciente', icon: UserPlus, href: '/pacientes' },
  { key: 'avaliacao', label: 'Nova Avaliação', icon: ClipboardPlus, href: '/pacientes' },
  { key: 'agenda', label: 'Agenda Hoje', icon: CalendarDays, href: '/agenda' },
  { key: 'eventos', label: 'Eventos', icon: PartyPopper, href: '/eventos' },
];

const FREQ_KEY = 'quick_actions_freq';

export default function MobileQuickActionsFab() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const handle = useCallback((href: string, key: string) => {
    try {
      const f = JSON.parse(localStorage.getItem(FREQ_KEY) || '{}');
      f[key] = (f[key] || 0) + 1;
      localStorage.setItem(FREQ_KEY, JSON.stringify(f));
    } catch {}
    setOpen(false);
    navigate(href);
  }, [navigate]);

  return (
    <div
      ref={ref}
      className="fixed right-4 z-50 md:hidden flex flex-col items-end gap-2"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 76px)' }}
    >
      <AnimatePresence>
        {open && ACTIONS.map((a, i) => (
          <motion.button
            key={a.key}
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.8 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => handle(a.href, a.key)}
            className={cn(
              'flex items-center gap-2 pl-3 pr-4 h-11 rounded-full',
              'bg-card border border-border/60 shadow-lg',
              'text-sm font-medium text-foreground active:scale-95 transition-transform',
            )}
          >
            <a.icon className="h-4 w-4 text-primary" />
            {a.label}
          </motion.button>
        ))}
      </AnimatePresence>

      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'h-14 w-14 rounded-full flex items-center justify-center',
          'bg-primary text-primary-foreground shadow-xl shadow-primary/30',
          'transition-all active:scale-90',
          open && 'rotate-45',
        )}
        aria-label={open ? 'Fechar ações' : 'Abrir ações rápidas'}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
}
