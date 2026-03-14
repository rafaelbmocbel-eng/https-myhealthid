import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Clock, ChevronLeft, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';
import { format, addDays, startOfWeek, isSameDay, parseISO, addMinutes } from 'date-fns';
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
  dias_semana: number[];
  vagas_por_horario: number;
}

interface Agendamento {
  id: string;
  data_inicio: string;
  data_fim: string;
  status: string;
  titulo: string | null;
  tipo_atendimento: string | null;
}

export default function PacienteAgenda() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [paciente, setPaciente] = useState<PacienteData | null>(null);
  const [config, setConfig] = useState<ConfigAgenda | null>(null);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<{ dataInicio: Date; dataFim: Date } | null>(null);
  const [view, setView] = useState<'meus' | 'agendar'>('meus');
  const [confirmado, setConfirmado] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchPatientAndConfig();
  }, [user]);

  useEffect(() => {
    if (paciente) fetchAgendamentos();
  }, [paciente, semanaOffset]);

  const fetchPatientAndConfig = async () => {
    const { data: pac } = await supabase
      .from('pacientes')
      .select('id, terapeuta_id')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (!pac) {
      setLoading(false);
      return;
    }
    setPaciente(pac);

    const { data: cfg } = await supabase
      .from('config_agenda')
      .select('horario_inicio, horario_fim, duracao_padrao, dias_semana, vagas_por_horario')
      .eq('terapeuta_id', pac.terapeuta_id)
      .maybeSingle();

    if (cfg) {
      setConfig({
        ...cfg,
        dias_semana: Array.isArray(cfg.dias_semana) ? (cfg.dias_semana as number[]) : [1, 2, 3, 4, 5],
      });
    }
    setLoading(false);
  };

  const fetchAgendamentos = async () => {
    if (!paciente) return;
    const inicioSemana = startOfWeek(addDays(new Date(), semanaOffset * 7), { weekStartsOn: 1 });
    const fimSemana = addDays(inicioSemana, 7);

    const { data } = await supabase
      .from('agendamentos')
      .select('id, data_inicio, data_fim, status, titulo, tipo_atendimento')
      .eq('terapeuta_id', paciente.terapeuta_id)
      .gte('data_inicio', inicioSemana.toISOString())
      .lte('data_inicio', fimSemana.toISOString());

    setAgendamentos(data || []);
  };

  const gerarSlots = () => {
    if (!config) return [];
    const inicioSemana = startOfWeek(addDays(new Date(), semanaOffset * 7), { weekStartsOn: 1 });
    const slots: { dataInicio: Date; dataFim: Date; disponivel: boolean }[] = [];

    for (let d = 0; d < 7; d++) {
      const dia = addDays(inicioSemana, d);
      const diaSemana = dia.getDay();
      if (!config.dias_semana.includes(diaSemana)) continue;

      const [hI, mI] = config.horario_inicio.split(':').map(Number);
      const [hF, mF] = config.horario_fim.split(':').map(Number);

      let slotInicio = new Date(dia);
      slotInicio.setHours(hI, mI, 0, 0);
      const fimDia = new Date(dia);
      fimDia.setHours(hF, mF, 0, 0);

      while (slotInicio < fimDia) {
        const slotFim = addMinutes(slotInicio, config.duracao_padrao);
        if (slotFim > fimDia) break;

        // Check availability
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
    }
    return slots;
  };

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

  // My appointments (upcoming)
  const minhasConsultas = agendamentos
    .filter((ag) => ag.paciente_id === paciente?.id || true) // RLS already filters
    .filter((ag) => ag.status !== 'cancelado')
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));

  const meusAgendamentos = agendamentos.filter(
    (ag) => ag.status !== 'cancelado'
  );

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

  const slots = view === 'agendar' ? gerarSlots() : [];
  const inicioSemana = startOfWeek(addDays(new Date(), semanaOffset * 7), { weekStartsOn: 1 });

  // Group slots by day
  const slotsByDay = slots.reduce<Record<string, typeof slots>>((acc, slot) => {
    const key = format(slot.dataInicio, 'yyyy-MM-dd');
    if (!acc[key]) acc[key] = [];
    acc[key].push(slot);
    return acc;
  }, {});

  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
          <h1 className="text-lg font-black text-foreground">Agenda</h1>

          {/* View toggle */}
          <div className="flex rounded-xl bg-muted p-1">
            {([
              { key: 'meus', label: 'Minhas consultas' },
              { key: 'agendar', label: 'Agendar nova' },
            ] as const).map((t) => (
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
                    <p className="text-xs text-muted-foreground">Nenhuma consulta esta semana</p>
                  </CardContent>
                </Card>
              ) : (
                meusAgendamentos.map((ag) => (
                  <Card key={ag.id}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
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
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          ag.status === 'confirmado'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {ag.status === 'confirmado' ? 'Confirmado' : 'Pendente'}
                      </span>
                    </CardContent>
                  </Card>
                ))
              )}

              {/* Week navigation */}
              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" size="sm" onClick={() => setSemanaOffset((s) => s - 1)}>
                  <ChevronLeft className="h-4 w-4" /> Anterior
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  {format(inicioSemana, "d MMM", { locale: ptBR })} – {format(addDays(inicioSemana, 6), "d MMM", { locale: ptBR })}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setSemanaOffset((s) => s + 1)}>
                  Próxima <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Scheduling view */}
          {view === 'agendar' && !confirmado && (
            <>
              {/* Week navigation */}
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setSemanaOffset((s) => Math.max(0, s - 1))} disabled={semanaOffset === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-medium text-muted-foreground">
                  {format(inicioSemana, "d MMM", { locale: ptBR })} – {format(addDays(inicioSemana, 6), "d MMM", { locale: ptBR })}
                </span>
                <Button variant="ghost" size="sm" onClick={() => setSemanaOffset((s) => s + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {!config ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-xs text-muted-foreground">Agenda não configurada pelo terapeuta.</p>
                  </CardContent>
                </Card>
              ) : Object.keys(slotsByDay).length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <p className="text-xs text-muted-foreground">Nenhum horário disponível esta semana.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {Object.entries(slotsByDay).map(([dateKey, daySlots]) => (
                    <div key={dateKey}>
                      <p className="text-xs font-bold text-foreground mb-2 capitalize">
                        {format(new Date(dateKey), "EEEE, d 'de' MMMM", { locale: ptBR })}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {daySlots.map((slot, i) => {
                          const isSelected =
                            selectedSlot?.dataInicio.getTime() === slot.dataInicio.getTime();
                          return (
                            <button
                              key={i}
                              disabled={!slot.disponivel}
                              onClick={() => setSelectedSlot(slot.disponivel ? slot : null)}
                              className={`py-2 px-3 rounded-xl text-xs font-medium transition-all border ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                  : slot.disponivel
                                  ? 'bg-card border-border hover:border-primary/40 text-foreground'
                                  : 'bg-muted/50 border-transparent text-muted-foreground/40 cursor-not-allowed'
                              }`}
                            >
                              <Clock className="h-3 w-3 inline mr-1" />
                              {format(slot.dataInicio, 'HH:mm')}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
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
                    <Button
                      onClick={handleAgendar}
                      disabled={submitting}
                      className="w-full rounded-xl"
                    >
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar horário'}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
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
