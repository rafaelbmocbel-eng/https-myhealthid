import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CalendarDays, ChevronRight,
  Trophy, Star, Flame, ClipboardList, Fingerprint, Loader2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import PatientIntegratedDashboard from '@/components/paciente/PatientIntegratedDashboard';
import PacienteAlertasLembretes from '@/components/paciente/PacienteAlertasLembretes';
import PacienteMetasDesafios from '@/components/paciente/PacienteMetasDesafios';
import PacienteExerciciosResumido from '@/components/paciente/PacienteExerciciosResumido';
import { usePacienteNotifications } from '@/hooks/usePacienteNotifications';

interface PacienteInfo {
  id: string;
  nome: string;
  sobrenome: string;
}

interface Agendamento {
  id: string;
  data_inicio: string;
  data_fim: string;
  titulo: string | null;
  status: string;
  tipo_atendimento: string | null;
}

// XP / Gamification helpers
function calcXP(stats: { avaliacoes: number; consultas: number; diarios: number }) {
  return stats.avaliacoes * 50 + stats.consultas * 30 + stats.diarios * 10;
}
function getLevel(xp: number) {
  if (xp >= 500) return { label: 'Ouro', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: Trophy, next: null };
  if (xp >= 250) return { label: 'Prata', color: 'text-slate-500', bg: 'bg-slate-100', icon: Star, next: 500 };
  if (xp >= 100) return { label: 'Bronze', color: 'text-amber-700', bg: 'bg-amber-100', icon: Flame, next: 250 };
  return { label: 'Iniciante', color: 'text-primary', bg: 'bg-primary/10', icon: Star, next: 100 };
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: "easeOut" as const },
  }),
};

export default function PacienteDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [paciente, setPaciente] = useState<PacienteInfo | null>(null);
  const [proximasConsultas, setProximasConsultas] = useState<Agendamento[]>([]);
  const [stats, setStats] = useState({ avaliacoes: 0, consultas: 0, diarios: 0, pendentes: 0 });
  const [loading, setLoading] = useState(true);
  const notifications = usePacienteNotifications(user?.id);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const { data: pac } = await supabase
        .from('pacientes')
        .select('id, nome, sobrenome')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!pac) { setLoading(false); return; }
      setPaciente(pac);

      const now = new Date().toISOString();

      const [agendaRes, avalRes, sessaoRes, diarioRes, pendentesRes] = await Promise.all([
        supabase.from('agendamentos')
          .select('id, data_inicio, data_fim, titulo, status, tipo_atendimento')
          .eq('paciente_id', pac.id)
          .gte('data_inicio', now)
          .in('status', ['confirmado', 'pendente'])
          .order('data_inicio', { ascending: true })
          .limit(3),
        supabase.from('avaliacoes_identidade')
          .select('id', { count: 'exact', head: true })
          .eq('paciente_id', pac.id),
        supabase.from('controle_sessoes')
          .select('id', { count: 'exact', head: true })
          .eq('paciente_id', pac.id)
          .eq('status', 'realizada'),
        supabase.from('daily_logs')
          .select('id', { count: 'exact', head: true })
          .eq('paciente_id', pac.id),
        supabase.from('myid_avaliacoes')
          .select('id', { count: 'exact', head: true })
          .eq('paciente_id', pac.id)
          .neq('status', 'concluido'),
      ]);

      setProximasConsultas(agendaRes.data || []);
      setStats({
        avaliacoes: avalRes.count || 0,
        consultas: sessaoRes.count || 0,
        diarios: diarioRes.count || 0,
        pendentes: pendentesRes.count || 0,
      });
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const xp = calcXP(stats);
  const level = getLevel(xp);
  const LevelIcon = level.icon;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

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
          {/* Welcome card with gradient */}
          <motion.div
            variants={fadeUp} initial="hidden" animate="visible" custom={0}
          >
            <Card className="overflow-hidden border-0 shadow-md"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(213 55% 28%) 100%)' }}
            >
              <CardContent className="p-4 md:p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-lg font-black text-primary-foreground">
                      {getGreeting()}, {paciente?.nome || '...'} 👋
                    </h1>
                    <p className="text-xs text-primary-foreground/70 mt-0.5">
                      Acompanhe sua evolução e próximas consultas.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm">
                    <LevelIcon className="h-3.5 w-3.5 text-primary-foreground" />
                    <span className="text-[11px] font-bold text-primary-foreground">{level.label}</span>
                  </div>
                </div>

                {/* XP bar */}
                {level.next && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[10px] text-primary-foreground/60">
                      <span>{xp} XP</span>
                      <span>Próximo: {level.next} XP</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: 'hsl(var(--accent))' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (xp / level.next) * 100)}%` }}
                        transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>
                )}

                {/* Streak */}
                {notifications.streak > 1 && (
                  <div className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10">
                    <span className="text-sm">🔥</span>
                    <span className="text-[11px] font-bold text-primary-foreground">
                      {notifications.streak} dias consecutivos
                    </span>
                    <span className="text-[10px] text-primary-foreground/60">no diário</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Alert: pending questionnaires */}
          {stats.pendentes > 0 && (
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
              <Card
                className="border-primary/30 bg-primary/5 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => navigate('/paciente/questionarios')}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <ClipboardList className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">
                      {stats.pendentes} questionário{stats.pendentes > 1 ? 's' : ''} pendente{stats.pendentes > 1 ? 's' : ''}
                    </p>
                    <p className="text-[11px] text-muted-foreground">Toque para responder agora</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-primary" />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── Alertas & Lembretes ── */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
            {paciente && <PacienteAlertasLembretes pacienteId={paciente.id} />}
          </motion.div>

          {/* ── Metas & Desafios Semanais ── */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}>
            {paciente && <PacienteMetasDesafios pacienteId={paciente.id} />}
          </motion.div>

          {/* ── Exercícios para Casa ── */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}>
            {paciente && <PacienteExerciciosResumido pacienteId={paciente.id} />}
          </motion.div>

          {/* ── Visão Integrada MyID ── */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
            {paciente && (
              <PatientIntegratedDashboard
                pacienteId={paciente.id}
                serviceType="identidade"
              />
            )}
          </motion.div>

          {/* Quick stats */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6}>
            <div className="grid grid-cols-3 gap-2">
              <Card className="bg-primary/5 border-primary/10">
                <CardContent className="p-3 text-center">
                  <CalendarDays className="h-4 w-4 text-primary mx-auto mb-1" />
                  <span className="text-xl font-black text-foreground block">{proximasConsultas.length}</span>
                  <span className="text-[10px] text-muted-foreground">Consultas</span>
                </CardContent>
              </Card>
              <Card className="bg-accent/5 border-accent/10">
                <CardContent className="p-3 text-center">
                  <Fingerprint className="h-4 w-4 mx-auto mb-1 text-primary" />
                  <span className="text-xl font-black text-foreground block">{stats.avaliacoes}</span>
                  <span className="text-[10px] text-muted-foreground">Avaliações</span>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <Flame className="h-4 w-4 text-primary mx-auto mb-1" />
                  <span className="text-xl font-black text-foreground block">{stats.consultas}</span>
                  <span className="text-[10px] text-muted-foreground">Sessões</span>
                </CardContent>
              </Card>
            </div>
          </motion.div>

          {/* Upcoming appointments */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={7}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground">Próximas consultas</h2>
              <button
                onClick={() => navigate('/paciente/agenda')}
                className="text-[11px] font-semibold text-primary flex items-center gap-0.5"
              >
                Ver agenda <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            {proximasConsultas.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <CalendarDays className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhuma consulta agendada</p>
                  <button
                    onClick={() => navigate('/paciente/agenda')}
                    className="text-xs font-semibold text-primary mt-2"
                  >
                    Agendar agora
                  </button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {proximasConsultas.map((ag, i) => (
                  <motion.div key={ag.id} variants={fadeUp} initial="hidden" animate="visible" custom={8 + i}>
                    <Card className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <CalendarDays className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {ag.titulo || ag.tipo_atendimento || 'Consulta'}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {format(parseISO(ag.data_inicio), "EEEE, d 'de' MMM · HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            ag.status === 'confirmado'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {ag.status === 'confirmado' ? 'Confirmado' : 'Pendente'}
                        </span>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Gamification badges */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={10}>
            <h2 className="text-sm font-bold text-foreground mb-3">Conquistas</h2>
            <div className="flex flex-wrap gap-2">
              {stats.avaliacoes >= 1 && (
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] gap-1">
                  <ClipboardList className="h-3 w-3" /> 1ª Avaliação
                </Badge>
              )}
              {stats.avaliacoes >= 3 && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] gap-1">
                  <Fingerprint className="h-3 w-3" /> 3 Avaliações
                </Badge>
              )}
              {stats.consultas >= 5 && (
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] gap-1">
                  <CalendarDays className="h-3 w-3" /> 5 Sessões
                </Badge>
              )}
              {stats.diarios >= 7 && (
                <Badge variant="outline" className="bg-accent/10 text-accent-foreground border-accent/20 text-[10px] gap-1">
                  <Flame className="h-3 w-3" /> 7 Dias de Diário
                </Badge>
              )}
              {notifications.streak >= 3 && (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-[10px] gap-1">
                  🔥 Streak {notifications.streak}d
                </Badge>
              )}
              {stats.consultas >= 10 && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] gap-1">
                  <Trophy className="h-3 w-3" /> 10 Sessões
                </Badge>
              )}
              {xp < 50 && (
                <p className="text-[10px] text-muted-foreground/50 italic">
                  Continue interagindo para desbloquear conquistas!
                </p>
              )}
            </div>
          </motion.div>
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
