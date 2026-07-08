import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, isToday } from 'date-fns';
import { Bell, CheckCircle2, Clock, X, UserPlus, Loader2, Sun, Sunset } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PacienteSelect } from '@/components/paciente/PacienteSelect';
import type { Agendamento, Paciente, ConfigAgenda } from '@/hooks/useAgenda';

interface Props {
  agendamentos: Agendamento[];
  pacientes: Paciente[];
  config: ConfigAgenda;
  onMarcarConcluido: (id: string) => void;
  onMarcarFaltou: (id: string) => void;
  onAddWalkIn: (pacienteId: string) => Promise<void>;
  onOpenDrawer?: () => void;
}

const MIDDAY = 12 * 60;        // 12:00
const MIDDAY_END = 13 * 60 + 30; // 13:30 — almoço window ends

export default function LembreteEncerramento({ agendamentos, pacientes, config, onMarcarConcluido, onMarcarFaltou, onAddWalkIn, onOpenDrawer }: Props) {
  const [now, setNow] = useState(new Date());
  const [showAddWalkIn, setShowAddWalkIn] = useState(false);
  const [walkInPacienteId, setWalkInPacienteId] = useState('');
  const [addingWalkIn, setAddingWalkIn] = useState(false);

  // Dismissals persist per-day via sessionStorage so navigating away doesn't reset them.
  const todayStr = now.toDateString();
  const [dismissedMidday, setDismissedMidday] = useState(
    () => sessionStorage.getItem('lembrete-midday') === todayStr
  );
  const [dismissedEndOfDay, setDismissedEndOfDay] = useState(
    () => sessionStorage.getItem('lembrete-eod') === todayStr
  );

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const fimMinutes = useMemo(() => {
    const [h, m] = (config.horario_fim || '20:00:00').split(':').map(Number);
    return h * 60 + (m || 0);
  }, [config.horario_fim]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const isMiddayWindow = nowMinutes >= MIDDAY && nowMinutes < MIDDAY_END;
  const isEndOfDayWindow = nowMinutes >= fimMinutes - 30;

  // All of today's appointments still needing a status decision (past + still open)
  const pendentesHoje = useMemo(() => {
    return agendamentos.filter(ag => {
      if (!ag.paciente_id) return false;
      const dt = parseISO(ag.data_inicio);
      if (!isToday(dt)) return false;
      return ag.status === 'confirmado' || ag.status === 'pendente';
    }).filter(ag => parseISO(ag.data_fim) <= now);
  }, [agendamentos, now]);

  // Morning = started before noon; shown at midday window
  const morningPendentes = useMemo(
    () => pendentesHoje.filter(ag => parseISO(ag.data_inicio).getHours() < 12),
    [pendentesHoje],
  );
  // Afternoon = started at noon or later; shown at end-of-day window
  const afternoonPendentes = useMemo(
    () => pendentesHoje.filter(ag => parseISO(ag.data_inicio).getHours() >= 12),
    [pendentesHoje],
  );

  // Which period is active right now?
  const activePeriod: 'manha' | 'tarde' | null =
    isMiddayWindow ? 'manha' : isEndOfDayWindow ? 'tarde' : null;

  const displayPendentes = activePeriod === 'manha' ? morningPendentes : pendentesHoje;
  const isDismissed = activePeriod === 'manha' ? dismissedMidday : dismissedEndOfDay;

  const dismiss = () => {
    if (activePeriod === 'manha') {
      setDismissedMidday(true);
      try { sessionStorage.setItem('lembrete-midday', todayStr); } catch { /* ignore */ }
    } else {
      setDismissedEndOfDay(true);
      try { sessionStorage.setItem('lembrete-eod', todayStr); } catch { /* ignore */ }
    }
  };

  // Only render inside the two time windows
  if (!activePeriod) return null;
  if (isDismissed && !showAddWalkIn) return null;
  if (displayPendentes.length === 0 && activePeriod === 'manha') return null;
  if (displayPendentes.length === 0 && activePeriod === 'tarde' && !showAddWalkIn) return null;

  const isManha = activePeriod === 'manha';
  const Icon = isManha ? Sun : Sunset;
  const titulo = isManha ? 'Resumo da manhã' : 'Encerramento do expediente';
  const subtitulo = displayPendentes.length > 0
    ? `${displayPendentes.length} atendimento${displayPendentes.length > 1 ? 's' : ''} ${isManha ? 'da manhã' : 'de hoje'} sem status final`
    : 'Todos os atendimentos já têm status final';

  return (
    <div className="border-b bg-gradient-to-r from-primary/5 to-primary/10 px-4 py-3 shrink-0 animate-in slide-in-from-top-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{titulo}</p>
            <p className="text-[11px] text-muted-foreground">{subtitulo}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onOpenDrawer && displayPendentes.length > 0 && (
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => { dismiss(); onOpenDrawer(); }}>
              Abrir painel <CheckCircle2 className="h-3 w-3" />
            </Button>
          )}
          <button onClick={dismiss} className="p-1 rounded-full hover:bg-accent">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {displayPendentes.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto mb-2">
          {displayPendentes.map(ag => {
            const pac = pacientes.find(p => p.id === ag.paciente_id);
            return (
              <div key={ag.id} className="flex items-center justify-between gap-2 bg-card rounded-lg border px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">
                    {pac ? `${pac.nome} ${pac.sobrenome}` : ag.titulo || 'Paciente'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-0.5" />
                    {format(parseISO(ag.data_inicio), 'HH:mm')} – {format(parseISO(ag.data_fim), 'HH:mm')}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] border-orange-300 text-orange-600 hover:bg-orange-50"
                    onClick={() => onMarcarFaltou(ag.id)}
                  >
                    ✗ Faltou
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => onMarcarConcluido(ag.id)}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Atendido
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Walk-in registration only at end of day */}
      {activePeriod === 'tarde' && (
        !showAddWalkIn ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] gap-1.5"
            onClick={() => setShowAddWalkIn(true)}
          >
            <UserPlus className="h-3 w-3" /> Adicionar paciente que veio sem agendamento
          </Button>
        ) : (
          <div className="flex items-center gap-1.5 bg-card rounded-lg border px-2 py-2">
            <div className="flex-1 min-w-0">
              <PacienteSelect
                pacientes={pacientes}
                value={walkInPacienteId}
                onValueChange={setWalkInPacienteId}
                placeholder="Selecionar paciente..."
              />
            </div>
            <Button
              size="sm"
              className="h-9 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              disabled={!walkInPacienteId || addingWalkIn}
              onClick={async () => {
                setAddingWalkIn(true);
                try {
                  await onAddWalkIn(walkInPacienteId);
                  setWalkInPacienteId('');
                  setShowAddWalkIn(false);
                } finally {
                  setAddingWalkIn(false);
                }
              }}
            >
              {addingWalkIn ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
              Registrar
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0"
              onClick={() => { setShowAddWalkIn(false); setWalkInPacienteId(''); }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )
      )}
    </div>
  );
}
