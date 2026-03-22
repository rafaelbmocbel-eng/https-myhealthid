import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CalendarDays, Clock, Loader2, CheckCircle2, ExternalLink, XCircle, AlertCircle, Plus, Edit3 } from 'lucide-react';
import { format, parseISO, addMinutes, startOfDay, endOfDay, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';

interface PacienteData {
  id: string;
  terapeuta_id: string;
}

interface ConfigAgenda {
  horario_inicio: string;
  horario_fim: string;
  duracao_padrao: number;
  dias_semana: Record<string, boolean>;
  vagas_por_horario: number;
}

interface Agendamento {
  id: string;
  data_inicio: string;
  data_fim: string;
  status: string;
  titulo: string | null;
  tipo_atendimento: string | null;
  paciente_id: string | null;
}

const DAY_MAP: Record<string, number> = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 };

function getAllowedWeekdays(dias: Record<string, boolean>): number[] {
  return Object.entries(dias).filter(([, v]) => v).map(([k]) => DAY_MAP[k] ?? -1).filter((n) => n >= 0);
}

function buildGoogleCalendarUrl(titulo: string, dataInicio: string | Date, dataFim: string | Date): string {
  const toGoogleDate = (d: string | Date) => {
    const date = typeof d === 'string' ? parseISO(d) : d;
    return format(date, "yyyyMMdd'T'HHmmss");
  };
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: titulo,
    dates: `${toGoogleDate(dataInicio)}/${toGoogleDate(dataFim)}`,
    details: 'Sessão agendada via MyHealth ID',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: typeof CheckCircle2 }> = {
  confirmado: { label: 'Confirmado', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: CheckCircle2 },
  pendente: { label: 'Pendente', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: AlertCircle },
  concluido: { label: 'Concluído', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: CheckCircle2 },
  cancelado: { label: 'Recusado', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: XCircle },
  faltou: { label: 'Faltou', bg: 'bg-muted', text: 'text-muted-foreground', icon: XCircle },
};

export default function PacienteAgenda() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [paciente, setPaciente] = useState<PacienteData | null>(null);
  const [config, setConfig] = useState<ConfigAgenda | null>(null);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedSlot, setSelectedSlot] = useState<{ dataInicio: Date; dataFim: Date } | null>(null);
  const [view, setView] = useState<'meus' | 'agendar'>('meus');
  const [confirmado, setConfirmado] = useState(false);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);

  const fetchPatientAndConfig = useCallback(async () => {
    if (!user) return;
    const { data: pac } = await supabase
      .from('pacientes')
      .select('id, terapeuta_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!pac) { setLoading(false); return; }
    setPaciente(pac);

    const { data: cfg } = await supabase
      .from('config_agenda')
      .select('horario_inicio, horario_fim, duracao_padrao, dias_semana, vagas_por_horario')
      .eq('terapeuta_id', pac.terapeuta_id)
      .maybeSingle();

    if (cfg) {
      const dias = typeof cfg.dias_semana === 'object' && !Array.isArray(cfg.dias_semana)
        ? (cfg.dias_semana as Record<string, boolean>)
        : { seg: true, ter: true, qua: true, qui: true, sex: true, sab: false, dom: false };
      setConfig({ ...cfg, dias_semana: dias } as ConfigAgenda);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPatientAndConfig();
  }, [fetchPatientAndConfig]);

  const fetchAgendamentos = useCallback(async () => {
    if (!paciente) return;

    let from: Date, to: Date;
    if (view === 'agendar' && selectedDate) {
      from = startOfDay(selectedDate);
      to = endOfDay(selectedDate);
    } else {
      from = new Date();
      from.setDate(from.getDate() - 30); // Show recent past too
      to = new Date();
      to.setDate(to.getDate() + 90);
    }

    const { data } = await supabase
      .from('agendamentos')
      .select('id, data_inicio, data_fim, status, titulo, tipo_atendimento, paciente_id')
      .eq('terapeuta_id', paciente.terapeuta_id)
      .gte('data_inicio', from.toISOString())
      .lte('data_inicio', to.toISOString());

    setAgendamentos(data || []);
  }, [paciente, view, selectedDate]);

  useEffect(() => {
    if (paciente) fetchAgendamentos();
  }, [paciente, fetchAgendamentos]);

  // Realtime subscription for appointment status changes
  useEffect(() => {
    if (!paciente) return;

    const channel = supabase
      .channel('paciente-agenda-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'agendamentos',
          filter: `paciente_id=eq.${paciente.id}`,
        },
        (payload) => {
          const updated = payload.new as Agendamento;
          const old = payload.old as Partial<Agendamento>;

          // Update local state
          setAgendamentos(prev =>
            prev.map(ag => ag.id === updated.id ? { ...ag, ...updated } : ag)
          );

          // Show notification based on status change
          if (old.status !== updated.status) {
            if (updated.status === 'confirmado') {
              toast({
                title: '✅ Consulta confirmada!',
                description: `Sua sessão de ${format(parseISO(updated.data_inicio), "d MMM 'às' HH:mm", { locale: ptBR })} foi confirmada pelo terapeuta.`,
              });
            } else if (updated.status === 'cancelado') {
              toast({
                title: '❌ Consulta recusada',
                description: `Sua sessão de ${format(parseISO(updated.data_inicio), "d MMM 'às' HH:mm", { locale: ptBR })} não foi aceita. Tente outro horário.`,
                variant: 'destructive',
              });
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [paciente, toast]);

  const allowedDays = useMemo(() => config ? getAllowedWeekdays(config.dias_semana) : [], [config]);

  const calendarDisabled = useMemo(() => {
    return (date: Date) => {
      if (date < startOfDay(new Date())) return true;
      return !allowedDays.includes(date.getDay());
    };
  }, [allowedDays]);

  const slotsForDay = useMemo(() => {
    if (!config || !selectedDate) return [];
    if (!allowedDays.includes(selectedDate.getDay())) return [];

    const [hI, mI] = config.horario_inicio.split(':').map(Number);
    const [hF, mF] = config.horario_fim.split(':').map(Number);

    const slots: { dataInicio: Date; dataFim: Date; disponivel: boolean }[] = [];
    let slotInicio = new Date(selectedDate);
    slotInicio.setHours(hI, mI, 0, 0);
    const fimDia = new Date(selectedDate);
    fimDia.setHours(hF, mF, 0, 0);

    while (slotInicio < fimDia) {
      const slotFim = addMinutes(slotInicio, config.duracao_padrao);
      if (slotFim > fimDia) break;

      const ocupados = agendamentos.filter(
        (ag) =>
          ag.status !== 'cancelado' &&
          parseISO(ag.data_inicio) < slotFim &&
          parseISO(ag.data_fim) > slotInicio
      ).length;

      const vagas = config.vagas_por_horario || 1;
      const disponivel = ocupados < vagas && slotInicio > new Date();

      slots.push({ dataInicio: new Date(slotInicio), dataFim: new Date(slotFim), disponivel });
      slotInicio = slotFim;
    }
    return slots;
  }, [config, selectedDate, agendamentos, allowedDays]);

  const handleAgendar = async () => {
    if (!selectedSlot || !paciente) return;
    setSubmitting(true);

    const { error } = await supabase.from('agendamentos').insert({
      terapeuta_id: paciente.terapeuta_id,
      paciente_id: paciente.id,
      data_inicio: selectedSlot.dataInicio.toISOString(),
      data_fim: selectedSlot.dataFim.toISOString(),
      status: 'pendente',
      tipo_atendimento: 'retorno',
    });

    if (error) {
      toast({ title: 'Erro ao agendar', description: error.message, variant: 'destructive' });
    } else {
      setConfirmado(true);
      toast({ title: 'Agendado com sucesso! ✅', description: 'Aguarde a confirmação do seu terapeuta.' });

      // Create notification for therapist
      await supabase.from('notificacoes').insert({
        terapeuta_id: paciente.terapeuta_id,
        tipo: 'agendamento',
        titulo: 'Novo agendamento pendente',
        descricao: `Paciente solicitou sessão em ${format(selectedSlot.dataInicio, "d MMM 'às' HH:mm", { locale: ptBR })}. Confirme ou recuse na agenda.`,
        rota: '/agenda',
        metadata: { paciente_id: paciente.id },
      });

      fetchAgendamentos();
    }
    setSubmitting(false);
  };

  const handleCancelar = async (agId: string) => {
    const { error } = await supabase
      .from('agendamentos')
      .update({ status: 'cancelado' })
      .eq('id', agId);

    if (error) {
      toast({ title: 'Erro ao cancelar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Consulta cancelada' });
      fetchAgendamentos();
    }
  };

  const meusAgendamentos = agendamentos
    .filter((ag) => ag.paciente_id === paciente?.id)
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));

  const futuros = meusAgendamentos.filter(ag => parseISO(ag.data_inicio) >= new Date() && ag.status !== 'cancelado');
  const passados = meusAgendamentos.filter(ag => parseISO(ag.data_inicio) < new Date() || ag.status === 'cancelado').slice(-10).reverse();

  if (loading) {
    return (
      <ProtectedPatientRoute>
        <PacienteLayout>
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </PacienteLayout>
      </ProtectedPatientRoute>
    );
  }

  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-black text-foreground">Agenda</h1>
            {view === 'meus' && (
              <Button
                size="sm"
                className="rounded-xl gap-1.5"
                onClick={() => { setView('agendar'); setConfirmado(false); setSelectedSlot(null); }}
              >
                <Plus className="h-4 w-4" />
                Agendar
              </Button>
            )}
          </div>

          {/* View toggle */}
          <div className="flex rounded-xl bg-muted p-1">
            {([
              { key: 'meus' as const, label: 'Minhas consultas' },
              { key: 'agendar' as const, label: 'Agendar nova' },
            ]).map((t) => (
              <button
                key={t.key}
                onClick={() => { setView(t.key); setConfirmado(false); setSelectedSlot(null); }}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                  view === t.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* My appointments view */}
          {view === 'meus' && (
            <div className="space-y-4">
              {/* Upcoming */}
              {futuros.length === 0 && passados.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <CalendarDays className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground mb-3">Nenhuma consulta agendada</p>
                    <Button
                      size="sm"
                      className="rounded-xl"
                      onClick={() => setView('agendar')}
                    >
                      Agendar sessão
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {futuros.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-foreground">Próximas consultas</p>
                      {futuros.map((ag) => {
                        const cfg = STATUS_CONFIG[ag.status] || STATUS_CONFIG.pendente;
                        const StatusIcon = cfg.icon;
                        const isPendente = ag.status === 'pendente';
                        return (
                          <Card key={ag.id}>
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                  <CalendarDays className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate">
                                    {ag.titulo || ag.tipo_atendimento || 'Consulta'}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {format(parseISO(ag.data_inicio), "EEE, d MMM · HH:mm", { locale: ptBR })}
                                    {' – '}
                                    {format(parseISO(ag.data_fim), 'HH:mm')}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                                    <StatusIcon className="h-3 w-3" />
                                    {cfg.label}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {isPendente && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="rounded-lg text-[11px] h-7 text-destructive border-destructive/30 hover:bg-destructive/10"
                                    onClick={() => handleCancelar(ag.id)}
                                  >
                                    Cancelar
                                  </Button>
                                )}
                                <a
                                  href={buildGoogleCalendarUrl(
                                    ag.titulo || ag.tipo_atendimento || 'Consulta',
                                    ag.data_inicio,
                                    ag.data_fim
                                  )}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Google Calendar
                                </a>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {passados.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-muted-foreground">Histórico recente</p>
                      {passados.map((ag) => {
                        const cfg = STATUS_CONFIG[ag.status] || STATUS_CONFIG.pendente;
                        return (
                          <Card key={ag.id} className="opacity-60">
                            <CardContent className="p-3 flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">
                                  {ag.titulo || ag.tipo_atendimento || 'Consulta'}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {format(parseISO(ag.data_inicio), "d MMM · HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                                {cfg.label}
                              </span>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Scheduling view */}
          {view === 'agendar' && !confirmado && (
            <div className="space-y-4">
              {!config ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-xs text-muted-foreground">Agenda não configurada pelo terapeuta.</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card>
                    <CardContent className="p-3 flex justify-center">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(d) => { setSelectedDate(d); setSelectedSlot(null); }}
                        disabled={calendarDisabled}
                        locale={ptBR}
                        className="rounded-xl"
                      />
                    </CardContent>
                  </Card>

                  {selectedDate && (
                    <div>
                      <p className="text-xs font-bold text-foreground mb-2 capitalize">
                        {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                      </p>
                      {slotsForDay.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nenhum horário disponível neste dia.</p>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {slotsForDay.map((slot, i) => {
                            const isSelected = selectedSlot?.dataInicio.getTime() === slot.dataInicio.getTime();
                            return (
                              <button
                                key={i}
                                disabled={!slot.disponivel}
                                onClick={() => setSelectedSlot(slot.disponivel ? slot : null)}
                                className={`py-2.5 px-3 rounded-xl text-xs font-medium transition-all border ${
                                  isSelected
                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                    : slot.disponivel
                                    ? 'bg-card border-border hover:border-primary/40 text-foreground'
                                    : 'bg-muted/50 border-transparent text-muted-foreground/40 cursor-not-allowed line-through'
                                }`}
                              >
                                <Clock className="h-3 w-3 inline mr-1" />
                                {format(slot.dataInicio, 'HH:mm')}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedSlot && (
                    <Card className="border-primary/20 bg-primary/5">
                      <CardContent className="p-4">
                        <p className="text-sm font-bold text-foreground mb-1">Confirmar agendamento</p>
                        <p className="text-xs text-muted-foreground mb-3">
                          {format(selectedSlot.dataInicio, "EEEE, d 'de' MMMM · HH:mm", { locale: ptBR })} –{' '}
                          {format(selectedSlot.dataFim, 'HH:mm')}
                        </p>
                        <p className="text-[10px] text-muted-foreground mb-3">
                          ⏳ Após agendar, o terapeuta receberá uma notificação e confirmará o horário.
                        </p>
                        <Button onClick={handleAgendar} disabled={submitting} className="w-full rounded-xl">
                          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar horário'}
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          )}

          {/* Confirmation */}
          {view === 'agendar' && confirmado && (
            <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
              <CardContent className="p-6 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-green-800 dark:text-green-300 mb-1">Agendado! ✅</h2>
                <p className="text-xs text-green-700 dark:text-green-400 mb-1">
                  Seu terapeuta receberá uma notificação e confirmará o horário.
                </p>
                <p className="text-[10px] text-green-600 dark:text-green-500">
                  Você será notificado(a) aqui quando houver uma resposta.
                </p>
                {selectedSlot && (
                  <a
                    href={buildGoogleCalendarUrl('Consulta', selectedSlot.dataInicio, selectedSlot.dataFim)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    Adicionar ao Google Calendar
                  </a>
                )}
                <div className="mt-2">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => { setView('meus'); setConfirmado(false); }}
                  >
                    Ver minhas consultas
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
