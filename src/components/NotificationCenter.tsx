import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificacoes } from '@/hooks/useNotificacoes';
import { Bell, CheckCheck, CalendarDays, ClipboardList, Star, MessageSquare, ExternalLink } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const iconMap: Record<string, typeof Bell> = {
  consulta: CalendarDays,
  questionario: ClipboardList,
  nps: Star,
  geral: MessageSquare,
};

export default function NotificationCenter() {
  const navigate = useNavigate();
  const { notificacoes, naoLidas, marcarLida, marcarTodasLidas, gerarAlertas } = useNotificacoes();

  // Generate alerts on mount and every 5 minutes
  useEffect(() => {
    gerarAlertas.mutate();
    const interval = setInterval(() => gerarAlertas.mutate(), 5 * 60 * 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rotaMap: Record<string, string> = {
    consulta: '/agenda',
    questionario: '/pacientes',
    nps: '/relatorios',
    geral: '/',
    reagendamento: '/agenda',
    cancelamento: '/agenda',
  };

  const handleClick = (id: string, rota: string | null, tipo?: string) => {
    marcarLida.mutate(id);
    const destino = rota && !rota.startsWith('/paciente') ? rota : rotaMap[tipo || ''] || null;
    if (destino) navigate(destino);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative h-10 w-10 rounded-xl bg-card/80 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/5 border border-border/50 transition-all hover:shadow-md active:scale-95">
          <Bell className="h-5 w-5" />
          {naoLidas > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
              {naoLidas > 9 ? '9+' : naoLidas}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 max-h-[70vh] flex flex-col" align="end">
        <div className="flex items-center justify-between p-3 border-b border-border/50">
          <h3 className="text-sm font-bold text-foreground">Notificações</h3>
          {naoLidas > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => marcarTodasLidas.mutate()}
            >
              <CheckCheck className="h-3 w-3" /> Marcar todas lidas
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 overflow-auto" style={{ maxHeight: 'calc(70vh - 48px)' }}>
          {notificacoes.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma notificação
            </div>
          ) : (
            notificacoes.map(n => {
              const Icon = iconMap[n.tipo] || Bell;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n.id, n.rota, n.tipo)}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 text-left hover:bg-accent/50 transition-colors border-b border-border/30 last:border-b-0',
                    !n.lida && 'bg-primary/5'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                    !n.lida ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs truncate', !n.lida ? 'font-bold text-foreground' : 'text-muted-foreground')}>
                      {n.titulo}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">{n.descricao}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  {n.rota && <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-1" />}
                </button>
              );
            })
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
