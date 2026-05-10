import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, isToday } from 'date-fns';
import { Bell, CheckCircle2, Clock, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Agendamento, Paciente, ConfigAgenda } from '@/hooks/useAgenda';

interface Props {
  agendamentos: Agendamento[];
  pacientes: Paciente[];
  config: ConfigAgenda;
  onMarcarConcluido: (id: string) => void;
  onMarcarFaltou: (id: string) => void;
}

export default function LembreteEncerramento({ agendamentos, pacientes, config, onMarcarConcluido, onMarcarFaltou }: Props) {
  const todayKey = `lembrete-encerramento-dismissed-${format(new Date(), 'yyyy-MM-dd')}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(todayKey) === '1'; } catch { return false; }
  });
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const fimMinutes = useMemo(() => {
    const [h, m] = (config.horario_fim || '20:00:00').split(':').map(Number);
    return h * 60 + (m || 0);
  }, [config.horario_fim]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const shouldShow = nowMinutes >= fimMinutes - 30;

  const pendentesHoje = useMemo(() => {
    return agendamentos.filter(ag => {
      if (!ag.paciente_id) return false;
      const dt = parseISO(ag.data_inicio);
      if (!isToday(dt)) return false;
      return ag.status === 'confirmado' || ag.status === 'pendente';
    }).filter(ag => parseISO(ag.data_fim) <= now);
  }, [agendamentos, now]);

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(todayKey, '1'); } catch {}
  };

  if (dismissed || !shouldShow || pendentesHoje.length === 0) return null;

  return (
    <div className="border-b bg-primary/5 shrink-0 animate-in slide-in-from-top-2">
      {/* Compact bar — tap to expand, X to dismiss */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left active:opacity-70"
        >
          <Bell className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-medium text-foreground truncate">
            {pendentesHoje.length} atendimento{pendentesHoje.length > 1 ? 's' : ''} sem status
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dispensar"
          className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-accent active:scale-95 shrink-0"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-2 space-y-1.5 max-h-48 overflow-y-auto">
          {pendentesHoje.map(ag => {
            const pac = pacientes.find(p => p.id === ag.paciente_id);
            return (
              <div key={ag.id} className="flex items-center justify-between gap-2 bg-card rounded-lg border px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">
                    {pac ? `${pac.nome} ${pac.sobrenome}` : ag.titulo || 'Paciente'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                    {format(parseISO(ag.data_inicio), 'HH:mm')} – {format(parseISO(ag.data_fim), 'HH:mm')}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px] border-orange-300 text-orange-600 hover:bg-orange-50"
                    onClick={() => onMarcarFaltou(ag.id)}
                  >
                    Faltou
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => onMarcarConcluido(ag.id)}
                  >
                    <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Atendido
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
