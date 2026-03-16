import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { gerarNotaDiario } from '@/utils/prontuarioAutoNotes';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Plus, Smile, Frown, Meh, Moon, Zap, Activity,
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Check
} from 'lucide-react';
import { format, parseISO, subDays, isToday, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';
import HealthSyncCard from '@/components/paciente/HealthSyncCard';
import { useHealthSync, HealthSyncResult } from '@/hooks/useHealthSync';

interface DailyLog {
  id: string;
  created_at: string;
  mood: number;
  pain: number;
  energy: number;
  sleep_hours: number;
  notes: string | null;
}

interface PacienteData {
  id: string;
  terapeuta_id: string;
}

const MOOD_EMOJI = ['😢', '😟', '😐', '🙂', '😄'];
const MOOD_LABELS = ['Péssimo', 'Ruim', 'Normal', 'Bom', 'Ótimo'];
const ENERGY_LABELS = ['Exausto', 'Cansado', 'Normal', 'Energizado', 'Muito ativo'];

export default function PacienteDiario() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { estimateEnergyFromSteps } = useHealthSync();
  const [paciente, setPaciente] = useState<PacienteData | null>(null);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showChart, setShowChart] = useState(false);

  // Form state
  const [mood, setMood] = useState(3);
  const [pain, setPain] = useState(0);
  const [energy, setEnergy] = useState(3);
  const [sleepHours, setSleepHours] = useState(7);
  const [notes, setNotes] = useState('');

  const fetchData = async () => {
    if (!user) return;

    const { data: pac } = await supabase
      .from('pacientes')
      .select('id, terapeuta_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!pac) { setLoading(false); return; }
    setPaciente(pac);

    const { data: logsData } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('paciente_id', pac.id)
      .order('created_at', { ascending: false })
      .limit(30);

    setLogs(logsData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const todayLogged = useMemo(() => {
    return logs.some(l => isToday(parseISO(l.created_at)));
  }, [logs]);

  const handleSubmit = async () => {
    if (!paciente) return;
    setSubmitting(true);

    const { error } = await supabase.from('daily_logs').insert({
      paciente_id: paciente.id,
      terapeuta_id: paciente.terapeuta_id,
      mood,
      pain,
      energy,
      sleep_hours: sleepHours,
      notes: notes.trim() || null,
    });

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      // Auto-generate prontuário note
      gerarNotaDiario({
        pacienteId: paciente.id,
        terapeutaId: paciente.terapeuta_id,
        mood,
        pain,
        energy,
        sleepHours,
        notes: notes.trim() || undefined,
      });
      toast({ title: 'Registro salvo! ✅', description: '+10 XP pelo registro diário' });
      setShowForm(false);
      setMood(3); setPain(0); setEnergy(3); setSleepHours(7); setNotes('');
      fetchData();
    }
    setSubmitting(false);
  };

  // Chart data (last 14 days)
  const chartData = useMemo(() => {
    const last14 = [...logs].reverse().slice(-14);
    return last14.map(l => ({
      date: format(parseISO(l.created_at), 'dd/MM'),
      Humor: l.mood,
      Dor: l.pain,
      Energia: l.energy,
      Sono: l.sleep_hours,
    }));
  }, [logs]);

  // Averages for summary
  const averages = useMemo(() => {
    if (logs.length === 0) return null;
    const recent = logs.slice(0, 7);
    return {
      mood: (recent.reduce((s, l) => s + l.mood, 0) / recent.length),
      pain: (recent.reduce((s, l) => s + l.pain, 0) / recent.length),
      energy: (recent.reduce((s, l) => s + l.energy, 0) / recent.length),
      sleep: (recent.reduce((s, l) => s + l.sleep_hours, 0) / recent.length),
    };
  }, [logs]);

  if (loading) {
    return (
      <ProtectedPatientRoute>
        <PacienteLayout>
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </PacienteLayout>
      </ProtectedPatientRoute>
    );
  }

  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-black text-foreground">Diário de Saúde</h1>
              <p className="text-xs text-muted-foreground">Registre como você está se sentindo hoje</p>
            </div>
            {todayLogged && (
              <Badge variant="outline" className="text-[10px] text-green-700 border-green-200 bg-green-50 gap-1">
                <Check className="h-3 w-3" /> Registrado hoje
              </Badge>
            )}
          </div>

          {/* CTA: New entry */}
          {!showForm && (
            <Card
              className={`cursor-pointer transition-shadow hover:shadow-md ${todayLogged ? 'opacity-60' : 'border-primary/30 bg-primary/5'}`}
              onClick={() => setShowForm(true)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">
                    {todayLogged ? 'Adicionar outro registro' : 'Registrar agora'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {todayLogged ? 'Você já registrou hoje' : 'Leva menos de 1 minuto'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Form */}
          {showForm && (
            <Card className="border-primary/20 shadow-lg">
              <CardContent className="p-5 space-y-5">
                <h2 className="text-sm font-bold text-foreground">Como você está?</h2>

                {/* Mood */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-2">
                    Humor — {MOOD_LABELS[mood - 1]}
                  </label>
                  <div className="flex justify-between gap-2">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button
                        key={v}
                        onClick={() => setMood(v)}
                        className={`flex-1 py-2 rounded-xl text-center text-xl transition-all ${
                          mood === v
                            ? 'bg-primary/10 ring-2 ring-primary scale-110'
                            : 'bg-muted/50 hover:bg-muted'
                        }`}
                      >
                        {MOOD_EMOJI[v - 1]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pain */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-2">
                    Nível de Dor — <span className={pain > 6 ? 'text-red-500' : pain > 3 ? 'text-amber-500' : 'text-emerald-600'}>{pain}/10</span>
                  </label>
                  <Slider
                    value={[pain]}
                    onValueChange={([v]) => setPain(v)}
                    min={0}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                    <span>Sem dor</span>
                    <span>Máxima</span>
                  </div>
                </div>

                {/* Energy */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-2">
                    Energia — {ENERGY_LABELS[energy - 1]}
                  </label>
                  <div className="flex justify-between gap-2">
                    {[1, 2, 3, 4, 5].map(v => (
                      <button
                        key={v}
                        onClick={() => setEnergy(v)}
                        className={`flex-1 py-2 rounded-xl text-center text-sm font-bold transition-all ${
                          energy === v
                            ? 'bg-primary/10 ring-2 ring-primary text-primary'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sleep */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-2">
                    Horas de Sono — <span className="text-foreground font-bold">{sleepHours}h</span>
                  </label>
                  <Slider
                    value={[sleepHours]}
                    onValueChange={([v]) => setSleepHours(v)}
                    min={0}
                    max={14}
                    step={0.5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                    <span>0h</span>
                    <span>14h</span>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-2">
                    Observações (opcional)
                  </label>
                  <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Como foi o seu dia? Algum sintoma diferente?"
                    maxLength={500}
                    className="text-sm resize-none h-20"
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 text-sm" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                  <Button className="flex-1 text-sm font-bold gap-2" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary cards */}
          {averages && (
            <div className="grid grid-cols-4 gap-2">
              <SummaryMini icon={<Smile className="h-3.5 w-3.5" />} label="Humor" value={averages.mood.toFixed(1)} color="text-violet-600" />
              <SummaryMini icon={<Activity className="h-3.5 w-3.5" />} label="Dor" value={averages.pain.toFixed(1)} color={averages.pain > 5 ? 'text-red-500' : 'text-emerald-600'} />
              <SummaryMini icon={<Zap className="h-3.5 w-3.5" />} label="Energia" value={averages.energy.toFixed(1)} color="text-amber-500" />
              <SummaryMini icon={<Moon className="h-3.5 w-3.5" />} label="Sono" value={`${averages.sleep.toFixed(1)}h`} color="text-blue-500" />
            </div>
          )}

          {/* Trend chart */}
          {chartData.length >= 2 && (
            <Card>
              <CardContent className="p-4">
                <button
                  className="flex items-center justify-between w-full mb-3"
                  onClick={() => setShowChart(!showChart)}
                >
                  <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Tendências
                  </h2>
                  {showChart ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {showChart && (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 9 }} domain={[0, 10]} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontSize: 9 }} />
                        <Line type="monotone" dataKey="Humor" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 2 }} />
                        <Line type="monotone" dataKey="Dor" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
                        <Line type="monotone" dataKey="Energia" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                        <Line type="monotone" dataKey="Sono" stroke="#3b82f6" strokeWidth={1.5} dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* History */}
          {logs.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-foreground mb-3">Histórico</h2>
              <div className="space-y-2">
                {logs.slice(0, 14).map(log => (
                  <Card key={log.id} className="hover:bg-muted/20 transition-colors">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-foreground">
                          {isToday(parseISO(log.created_at))
                            ? 'Hoje'
                            : format(parseISO(log.created_at), "EEEE, d MMM", { locale: ptBR })}
                        </span>
                        <span className="text-xl">{MOOD_EMOJI[log.mood - 1]}</span>
                      </div>
                      <div className="flex gap-3 text-[10px] text-muted-foreground">
                        <span className={log.pain > 6 ? 'text-red-500 font-bold' : ''}>
                          Dor: {log.pain}/10
                        </span>
                        <span>Energia: {log.energy}/5</span>
                        <span>Sono: {log.sleep_hours}h</span>
                      </div>
                      {log.notes && (
                        <p className="text-[11px] text-muted-foreground mt-1.5 italic line-clamp-2">
                          "{log.notes}"
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {logs.length === 0 && !showForm && (
            <Card>
              <CardContent className="p-8 text-center">
                <Moon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum registro ainda</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Comece agora e acompanhe suas tendências ao longo do tempo.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}

function SummaryMini({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <Card>
      <CardContent className="p-2 text-center">
        <div className={`mx-auto mb-0.5 ${color}`}>{icon}</div>
        <span className="text-sm font-black text-foreground block">{value}</span>
        <span className="text-[9px] text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}
