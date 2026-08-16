import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, isToday } from '@/lib/dateSafe';
import {
  CheckCircle2, X, UserPlus, Loader2, Sunset,
  Clock, ClipboardCheck, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PacienteSelect } from '@/components/paciente/PacienteSelect';
import { cn } from '@/lib/utils';
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

const STATUS_CFG: Record<string, { label: string; dot: string }> = {
  concluido:  { label: 'Atendido',  dot: 'bg-emerald-500' },
  faltou:     { label: 'Faltou',    dot: 'bg-orange-500'  },
  cancelado:  { label: 'Cancelado', dot: 'bg-red-500'     },
  confirmado: { label: 'Pendente',  dot: 'bg-amber-500'   },
  pendente:   { label: 'Pendente',  dot: 'bg-amber-500'   },
};

export default function LembreteEncerramento({
  agendamentos, pacientes, config,
  onMarcarConcluido, onMarcarFaltou, onAddWalkIn, onOpenDrawer,
}: Props) {
  const [now, setNow] = useState(new Date());
  const [showAddWalkIn, setShowAddWalkIn] = useState(false);
  const [walkInPacienteId, setWalkInPacienteId] = useState('');
  const [addingWalkIn, setAddingWalkIn] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const todayStr = now.toDateString();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('lembrete-eod') === todayStr,
  );

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // All non-blocked appointments today
  const todosHoje = useMemo(() => agendamentos
    .filter(ag => {
      if (!ag.paciente_id) return false;
      if (!isToday(parseISO(ag.data_inicio))) return false;
      return ag.status !== 'bloqueado';
    })
    .sort((a, b) => parseISO(a.data_inicio).getTime() - parseISO(b.data_inicio).getTime()),
  [agendamentos]);

  // Timestamp of the last appointment end today
  const ultimoFim = useMemo(() => {
    const fims = todosHoje.map(ag => parseISO(ag.data_fim).getTime());
    return fims.length > 0 ? Math.max(...fims) : 0;
  }, [todosHoje]);

  // Configured end-of-day window: 30 min before horario_fim
  const fimMinutes = useMemo(() => {
    const [h, m] = (config.horario_fim || '20:00:00').split(':').map(Number);
    return h * 60 + (m || 0);
  }, [config.horario_fim]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Show when: last appointment ended OR 30 min before configured end-of-day
  const todosEncerrados = ultimoFim > 0 && now.getTime() >= ultimoFim;
  const proximoDoFim    = nowMinutes >= fimMinutes - 30;
  const isActive        = todosEncerrados || proximoDoFim;

  const pendentes = todosHoje.filter(
    ag => (ag.status === 'confirmado' || ag.status === 'pendente') && parseISO(ag.data_fim) <= now,
  );

  if (!isActive) return null;
  if (dismissed && !showAddWalkIn) return null;
  if (todosHoje.length === 0 && !showAddWalkIn) return null;

  const atendidos  = todosHoje.filter(ag => ag.status === 'concluido').length;
  const faltaram   = todosHoje.filter(ag => ag.status === 'faltou').length;
  const cancelados = todosHoje.filter(ag => ag.status === 'cancelado').length;
  const nPendentes = pendentes.length;
  const total      = todosHoje.length;

  const nomePaciente = (ag: Agendamento) => {
    const p = pacientes.find(x => x.id === ag.paciente_id);
    return p ? `${p.nome} ${p.sobrenome}` : ag.titulo || 'Paciente';
  };

  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem('lembrete-eod', todayStr); } catch { /* ignore */ }
  };

  return (
    <div className="border-b bg-gradient-to-r from-primary/5 via-primary/8 to-primary/5 shrink-0 animate-in slide-in-from-top-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <Sunset className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground leading-tight">
              {todosEncerrados ? 'Atendimentos encerrados' : 'Encerrando expediente'}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {total} paciente{total !== 1 ? 's' : ''} hoje
              {nPendentes > 0 && ` · ${nPendentes} pendente${nPendentes !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onOpenDrawer && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] gap-1"
              onClick={() => { dismiss(); onOpenDrawer(); }}
            >
              <ClipboardCheck className="h-3 w-3" /> Painel completo
            </Button>
          )}
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded-full hover:bg-accent"
            aria-label={expanded ? 'Recolher' : 'Expandir'}
          >
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          <button onClick={dismiss} className="p-1.5 rounded-full hover:bg-accent">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {/* Resumo rápido */}
          <div className="flex items-center gap-3 text-[11px] font-medium">
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> {atendidos} atendido{atendidos !== 1 ? 's' : ''}
            </span>
            {faltaram > 0 && (
              <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                <span className="inline-block h-2 w-2 rounded-full bg-orange-500" /> {faltaram} faltou{faltaram !== 1 ? 'ram' : ''}
              </span>
            )}
            {cancelados > 0 && (
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> {cancelados} cancelado{cancelados !== 1 ? 's' : ''}
              </span>
            )}
            {nPendentes > 0 && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" /> {nPendentes} pendente{nPendentes !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Lista completa de pacientes */}
          <div className="space-y-1 max-h-52 overflow-y-auto pr-0.5">
            {todosHoje.map(ag => {
              const isPendente = (ag.status === 'confirmado' || ag.status === 'pendente') && parseISO(ag.data_fim) <= now;
              const st = STATUS_CFG[ag.status] || STATUS_CFG.pendente;

              return (
                <div
                  key={ag.id}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 bg-card',
                    isPendente && 'border-amber-300/60 bg-amber-50/50 dark:bg-amber-950/20',
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full shrink-0', st.dot)} />

                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-foreground truncate leading-tight">
                      {nomePaciente(ag)}
                    </p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {format(parseISO(ag.data_inicio), 'HH:mm')} – {format(parseISO(ag.data_fim), 'HH:mm')}
                    </p>
                  </div>

                  {isPendente ? (
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-[11px] border-orange-300 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                        onClick={() => onMarcarFaltou(ag.id)}
                      >
                        <X className="h-3 w-3 mr-0.5" /> Faltou
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => onMarcarConcluido(ag.id)}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-0.5" /> Atendido
                      </Button>
                    </div>
                  ) : (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] shrink-0',
                        ag.status === 'concluido'  && 'border-emerald-300 text-emerald-700 dark:text-emerald-400',
                        ag.status === 'faltou'     && 'border-orange-300 text-orange-600 dark:text-orange-400',
                        ag.status === 'cancelado'  && 'border-red-300 text-red-600 dark:text-red-400',
                      )}
                    >
                      {st.label}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          {/* Walk-in */}
          {!showAddWalkIn ? (
            <button
              onClick={() => setShowAddWalkIn(true)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Registrar paciente sem agendamento
            </button>
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
          )}
        </div>
      )}
    </div>
  );
}
