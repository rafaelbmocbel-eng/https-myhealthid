import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CalendarDays, ChevronRight,
  Trophy, Star, Flame, ClipboardList, Fingerprint, Loader2, Sparkles, Clock
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import PatientIntegratedDashboard from '@/components/paciente/PatientIntegratedDashboard';
import PacienteAlertasLembretes from '@/components/paciente/PacienteAlertasLembretes';
import PacienteMetasDesafios from '@/components/paciente/PacienteMetasDesafios';
import PacienteExerciciosResumido from '@/components/paciente/PacienteExerciciosResumido';
import PwaInstallBanner from '@/components/paciente/PwaInstallBanner';
import BloqueioPortalCard from '@/components/paciente/BloqueioPortalCard';
import { usePacienteNotifications } from '@/hooks/usePacienteNotifications';
import ReacaoPosSessaoCard from '@/components/paciente/ReacaoPosSessaoCard';
import { useWellnessAccess } from '@/hooks/useWellnessAccess';

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
  const [showMyIdPrompt, setShowMyIdPrompt] = useState(false);
  const [myIdPromptType, setMyIdPromptType] = useState<'first' | 'monthly'>('first');
  const notifications = usePacienteNotifications(user?.id);
  const { isFree, isInTrial, trialDiasRestantes } = useWellnessAccess();

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

      const [agendaRes, avalRes, sessaoRes, diarioRes, pendentesRes, lastMyIdRes] = await Promise.all([
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
        // Get latest completed MyID to check monthly recurrence
        supabase.from('myid_avaliacoes')
          .select('id, updated_at')
          .eq('paciente_id', pac.id)
          .eq('status', 'concluido')
          .order('updated_at', { ascending: false })
          .limit(1),
      ]);

      setProximasConsultas(agendaRes.data || []);
      setStats({
        avaliacoes: avalRes.count || 0,
        consultas: sessaoRes.count || 0,
        diarios: diarioRes.count || 0,
        pendentes: pendentesRes.count || 0,
      });

      // Determine MyID prompt visibility
      const completedMyIds = lastMyIdRes.data || [];
      if (completedMyIds.length === 0) {
        // Never completed a MyID — show first-time prompt
        setShowMyIdPrompt(true);
        setMyIdPromptType('first');
      } else {
        // Check if last completed MyID is older than 30 days
        const lastDate = new Date(completedMyIds[0].updated_at);
        const daysSince = differenceInDays(new Date(), lastDate);
        if (daysSince >= 30) {
          setShowMyIdPrompt(true);
          setMyIdPromptType('monthly');
        }
      }

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
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
          {/* Welcome card with stats integrated */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
            <Card className="overflow-hidden border-0 shadow-md"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(213 55% 28%) 100%)' }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h1 className="text-lg font-black text-primary-foreground">
                      {getGreeting()}, {paciente?.nome || '...'} 👋
                    </h1>
                    <p className="text-[11px] text-primary-foreground/60 mt-0.5">
                      Acompanhe sua evolução e próximas consultas.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-sm">
                    <LevelIcon className="h-3 w-3 text-primary-foreground" />
                    <span className="text-[10px] font-bold text-primary-foreground">{level.label}</span>
                  </div>
                </div>

                {/* Inline stats */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[
                    { icon: CalendarDays, value: proximasConsultas.length, label: 'Consultas' },
                    { icon: Fingerprint, value: stats.avaliacoes, label: 'Avaliações' },
                    { icon: Flame, value: stats.consultas, label: 'Sessões' },
                  ].map(s => {
                    const Icon = s.icon;
                    return (
                      <div key={s.label} className="text-center px-2 py-1.5 rounded-lg bg-white/10">
                        <Icon className="icon-sm text-primary-foreground/70 mx-auto mb-0.5" />
                        <div className="text-sm font-black text-primary-foreground">{s.value}</div>
                        <div className="text-[8px] text-primary-foreground/50">{s.label}</div>
                      </div>
                    );
                  })}
                </div>

                {/* XP bar + Streak inline */}
                <div className="flex items-center gap-3">
                  {level.next && (
                    <div className="flex-1 space-y-0.5">
                      <div className="flex justify-between text-[9px] text-primary-foreground/50">
                        <span>{xp} XP</span>
                        <span>{level.next} XP</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: 'hsl(var(--accent))' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (xp / level.next) * 100)}%` }}
                          transition={{ duration: 1, delay: 0.3 }}
                        />
                      </div>
                    </div>
                  )}
                  {notifications.streak > 1 && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 shrink-0">
                      <span className="text-xs">🔥</span>
                      <span className="text-[10px] font-bold text-primary-foreground">{notifications.streak}d</span>
                    </div>
                  )}
                  {/* Inline badges */}
                  {stats.avaliacoes >= 1 && (
                    <Badge variant="outline" className="bg-white/10 border-white/20 text-primary-foreground text-[8px] h-5 gap-0.5 shrink-0">
                      <ClipboardList className="h-2.5 w-2.5" /> {stats.avaliacoes}ª
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* PWA Install Banner */}
          <PwaInstallBanner />

          {/* Reação pós-sessão (NPS rápido) */}
          {paciente && <ReacaoPosSessaoCard pacienteId={paciente.id} />}

          {/* Upgrade banner — Wellness Free */}
          {isFree && (
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
              <Card
                className="border-0 shadow-md overflow-hidden cursor-pointer"
                style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)' }}
                onClick={() => navigate('/paciente/plano')}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Sparkles className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-primary-foreground">
                      {isInTrial
                        ? `🎁 Trial Premium ativo — ${trialDiasRestantes} ${trialDiasRestantes === 1 ? 'dia restante' : 'dias restantes'}`
                        : '✨ Desbloqueie tudo com Wellness Premium'}
                    </h3>
                    <p className="text-[11px] text-primary-foreground/75 mt-0.5">
                      {isInTrial
                        ? 'Você tem acesso completo aos exercícios, protocolos e missões. Assine para continuar após o trial.'
                        : 'Exercícios, protocolos, missões completas e 1 consulta/mês com profissional.'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-primary-foreground/80 shrink-0" />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* MyID Prompt — first time or monthly */}
          {showMyIdPrompt && (
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1}>
              <Card className="border-0 shadow-md overflow-hidden"
                style={{ background: 'linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(var(--primary)) 100%)' }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <Sparkles className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black text-primary-foreground">
                        {myIdPromptType === 'first'
                          ? '🎯 Descubra seu MyID!'
                          : '🔄 Hora de atualizar seu MyID!'
                        }
                      </h3>
                      <p className="text-[11px] text-primary-foreground/70 mt-0.5">
                        {myIdPromptType === 'first'
                          ? 'Responda seu primeiro questionário MyID para conhecer seu perfil de saúde e receber orientações personalizadas.'
                          : 'Já faz mais de 30 dias desde sua última avaliação. Atualize para acompanhar sua evolução!'
                        }
                      </p>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-2 h-7 text-xs font-bold bg-white/20 hover:bg-white/30 text-primary-foreground border-0"
                        onClick={() => navigate('/paciente/questionarios')}
                      >
                        <Fingerprint className="icon-sm mr-1" />
                        {myIdPromptType === 'first' ? 'Responder agora' : 'Atualizar MyID'}
                        <ChevronRight className="icon-sm ml-1" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Pending questionnaires alert */}
          {stats.pendentes > 0 && (
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
              <Card
                className="border-primary/30 bg-primary/5 cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => navigate('/paciente/questionarios')}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <ClipboardList className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">
                      {stats.pendentes} questionário{stats.pendentes > 1 ? 's' : ''} pendente{stats.pendentes > 1 ? 's' : ''}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Toque para responder</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-primary" />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* MyID Dashboard */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}>
            {paciente && (
              <PatientIntegratedDashboard pacienteId={paciente.id} serviceType="identidade" />
            )}
          </motion.div>

          {/* Metas & Alertas & Exercícios — stacked */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={4}>
            {paciente && <PacienteMetasDesafios pacienteId={paciente.id} />}
          </motion.div>
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={5}>
            {paciente && <PacienteAlertasLembretes pacienteId={paciente.id} />}
          </motion.div>
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={6}>
            {paciente && <PacienteExerciciosResumido pacienteId={paciente.id} />}
          </motion.div>

          {/* Upcoming appointments — compact */}
          {proximasConsultas.length > 0 && (
            <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={7}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-foreground">Próximas consultas</h2>
                <button onClick={() => navigate('/paciente/agenda')} className="text-[10px] font-semibold text-primary flex items-center gap-0.5">
                  Ver agenda <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-1.5">
                {proximasConsultas.map((ag) => (
                  <Card key={ag.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-2.5 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <CalendarDays className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {ag.titulo || ag.tipo_atendimento || 'Consulta'}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(parseISO(ag.data_inicio), "EEE, d MMM · HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                        ag.status === 'confirmado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {ag.status === 'confirmado' ? '✓' : '⏳'}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
