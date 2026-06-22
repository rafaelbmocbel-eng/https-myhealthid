import { useState, useEffect, useMemo } from 'react';
import { format, parseISO, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bell, CheckCircle2, Clock, X, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PacienteSelect } from '@/components/paciente/PacienteSelect';
import type { Agendamento, Paciente, ConfigAgenda } from '@/hooks/useAgenda';

interface Props {
  agendamentos: Agendamento[];
  pacientes: Paciente[];
  config: ConfigAgenda;
  onMarcarConcluido: (id: string) => void;
  onMarcarFaltou: (id: string) => void;
  onAddWalkIn: (pacienteId: string) => Promise<void>;
}

export default function LembreteEncerramento({ agendamentos, pacientes, config, onMarcarConcluido, onMarcarFaltou, onAddWalkIn }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(new Date());
  const [showAddWalkIn, setShowAddWalkIn] = useState(false);
  const [walkInPacienteId, setWalkInPacienteId] = useState('');
  const [addingWalkIn, setAddingWalkIn] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Parse horario_fim from config
  const fimMinutes = useMemo(() => {
    const [h, m] = (config.horario_fim || '20:00:00').split(':').map(Number);
    return h * 60 + (m || 0);
  }, [config.horario_fim]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  // Show reminder 30 min before end or after end
  const shouldShow = nowMinutes >= fimMinutes - 30;

  // Today's appointments that need status confirmation
  const pendentesHoje = useMemo(() => {
    return agendamentos.filter(ag => {
      if (!ag.paciente_id) return false;
      const dt = parseISO(ag.data_inicio);
      if (!isToday(dt)) return false;
      // Only those still in "confirmado" or "pendente" (not yet marked as concluded/faltou/cancelado)
      return ag.status === 'confirmado' || ag.status === 'pendente';
    }).filter(ag => {
      // Only past appointments (already happened)
      return parseISO(ag.data_fim) <= now;
    });
  }, [agendamentos, now]);

  if (dismissed || !shouldShow) return null;
  if (pendentesHoje.length === 0 && !showAddWalkIn) return null;

  return (
    <div className="border-b bg-gradient-to-r from-primary/5 to-primary/10 px-4 py-3 shrink-0 animate-in slide-in-from-top-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
            <Bell className="h-4 w-4 text-primary animate-bounce" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">
              Encerramento do expediente
            </p>
            <p className="text-[11px] text-muted-foreground">
              {pendentesHoje.length > 0
                ? `${pendentesHoje.length} atendimento${pendentesHoje.length > 1 ? 's' : ''} de hoje sem status final`
                : 'Todos os atendimentos de hoje já têm status final'}
            </p>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="p-1 rounded-full hover:bg-accent">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {pendentesHoje.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto mb-2">
          {pendentesHoje.map(ag => {
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

      {!showAddWalkIn ? (
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
      )}
    </div>
  );
}
