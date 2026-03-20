import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CalendarDays, Clock, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { format, parseISO, addMinutes, startOfDay, endOfDay } from 'date-fns';
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

  useEffect(() => {
    if (!user) return;
    fetchPatientAndConfig();
  }, [user]);

  // Fetch agendamentos for selected date or for "meus" view (next 60 days)
  useEffect(() => {
    if (paciente) fetchAgendamentos();
  }, [paciente, selectedDate, view]);

  const fetchPatientAndConfig = async () => {
    const { data: pac } = await supabase
      .from('pacientes')
      .select('id, terapeuta_id')
      .eq('user_id', user!.id)
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
  };

  const fetchAgendamentos = async () => {
    if (!paciente) return;

    let from: Date, to: Date;
    if (view === 'agendar' && selectedDate) {
      from = startOfDay(selectedDate);
      to = endOfDay(selectedDate);
    } else {
      from = new Date();
      to = new Date();
      to.setDate(to.getDate() + 60);
    }

    const { data } = await supabase
      .from('agendamentos')
      .select('id, data_inicio, data_fim, status, titulo, tipo_atendimento, paciente_id')
      .eq('terapeuta_id', paciente.terapeuta_id)
      .gte('data_inicio', from.toISOString())
      .lte('data_inicio', to.toISOString());

    setAgendamentos(data || []);
  };

  const allowedDays = useMemo(() => config ? getAllowedWeekdays(config.dias_semana) : [], [config]);

  // Calendar: disable days not in config
  const calendarDisabled = useMemo(() => {
    return (date: Date) => {
      if (date < startOfDay(new Date())) return true;
      return !allowedDays.includes(date.getDay());
    };
  }, [allowedDays]);

  // Generate slots for selected date
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
      fetchAgendamentos();
    }
    setSubmitting(false);
  };

  const meusAgendamentos = agendamentos
    .filter((ag) => ag.paciente_id === paciente?.id && ag.status !== 'cancelado')
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));

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
          <h1 className="text-lg font-black text-foreground">Agenda</h1>

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
            <div className="space-y-2">
              {meusAgendamentos.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <CalendarDays className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Nenhuma consulta agendada</p>
                  </CardContent>
                </Card>
              ) : (
                meusAgendamentos.map((ag) => (
                  <Card key={ag.id}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <CalendarDays className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {ag.titulo || ag.tipo_atendimento || 'Consulta'}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {format(parseISO(ag.data_inicio), "EEE, d MMM · HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            ag.status === 'confirmado'
                              ? 'bg-green-100 text-green-700'
                              : ag.status === 'concluido'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {ag.status === 'confirmado' ? 'Confirmado' : ag.status === 'concluido' ? 'Concluído' : 'Pendente'}
                        </span>
                        <a
                          href={buildGoogleCalendarUrl(
                            ag.titulo || ag.tipo_atendimento || 'Consulta',
                            ag.data_inicio,
                            ag.data_fim
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-primary/10 transition-colors"
                          title="Adicionar ao Google Calendar"
                        >
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Scheduling view with real calendar */}
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
                  {/* Calendar picker */}
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

                  {/* Slots for selected day */}
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

                  {/* Confirm */}
                  {selectedSlot && (
                    <Card className="border-primary/20 bg-primary/5">
                      <CardContent className="p-4">
                        <p className="text-sm font-bold text-foreground mb-1">Confirmar agendamento</p>
                        <p className="text-xs text-muted-foreground mb-3">
                          {format(selectedSlot.dataInicio, "EEEE, d 'de' MMMM · HH:mm", { locale: ptBR })} –{' '}
                          {format(selectedSlot.dataFim, 'HH:mm')}
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
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-6 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
                <h2 className="text-lg font-bold text-green-800 mb-1">Agendado! ✅</h2>
                <p className="text-xs text-green-700">
                  Seu terapeuta será notificado. Aguarde a confirmação.
                </p>
                <Button
                  variant="outline"
                  className="mt-4 rounded-xl"
                  onClick={() => { setView('meus'); setConfirmado(false); }}
                >
                  Ver minhas consultas
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
