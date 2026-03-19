import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={cn(
            'h-9 w-9 rounded-lg flex items-center justify-center',
            'text-muted-foreground hover:text-primary hover:bg-primary/5',
            'border border-transparent hover:border-border/50',
            'transition-all active:scale-95',
          )}
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Alternar tema</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</TooltipContent>
    </Tooltip>
  );
}
