import { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CalendarDays, ChevronRight,
  Trophy, Star, Flame, ClipboardList, Fingerprint, Loader2, Sparkles, Clock, Mic,
  CheckCircle2, Circle,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
const PatientIntegratedDashboard = lazy(() => import('@/components/paciente/PatientIntegratedDashboard'));
import PacienteAlertasLembretes from '@/components/paciente/PacienteAlertasLembretes';
import PacienteDicaInteligente from '@/components/paciente/PacienteDicaInteligente';
import PacienteInsightsDaAvaliacao from '@/components/paciente/PacienteInsightsDaAvaliacao';
import MyIDPDFButton from '@/components/paciente/MyIDPDFButton';
import PacienteExerciciosResumido from '@/components/paciente/PacienteExerciciosResumido';
import BloqueioPortalCard from '@/components/paciente/BloqueioPortalCard';
import { usePacienteNotifications } from '@/hooks/usePacienteNotifications';
import ReacaoPosSessaoCard from '@/components/paciente/ReacaoPosSessaoCard';
import { useWellnessAccess } from '@/hooks/useWellnessAccess';
import { cn } from '@/lib/utils';

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

function calcXP(stats: { avaliacoes: number; consultas: number; diarios: number; vocais: number }) {
  return stats.avaliacoes * 50 + stats.consultas * 30 + stats.diarios * 10 + stats.vocais * 20;
}
function getLevel(xp: number) {
  if (xp >= 500) return { label: 'Ouro',     color: 'text-yellow-600', icon: Trophy, next: null };
  if (xp >= 250) return { label: 'Prata',    color: 'text-slate-500',  icon: Star,   next: 500 };
  if (xp >= 100) return { label: 'Bronze',   color: 'text-amber-700',  icon: Flame,  next: 250 };
  return           { label: 'Iniciante', color: 'text-primary',    icon: Star,   next: 100 };
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: 'easeOut' as const },
  }),
};

function V({ i, children }: { i: number; children: React.ReactNode }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={i}>
      {children}
    </motion.div>
  );
}

export default function PacienteDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [paciente, setPaciente] = useState<PacienteInfo | null>(null);
  const [proximasConsultas, setProximasConsultas] = useState<Agendamento[]>([]);
  const [stats, setStats] = useState({ avaliacoes: 0, consultas: 0, diarios: 0, pendentes: 0, vocais: 0 });
  const [loading, setLoading] = useState(true);
  const [showMyIdPrompt, setShowMyIdPrompt] = useState(false);
  const [myIdPromptType, setMyIdPromptType] = useState<'first' | 'monthly'>('first');
  const [historiaContada, setHistoriaContada] = useState(false);

  const notifications = usePacienteNotifications(user?.id);
  const { isFree, isInTrial, trialDiasRestantes, emCarencia, bloqueadoClinico, diasRestantesCarencia } = useWellnessAccess();
  const [profissional, setProfissional] = useState<{ nome?: string; whatsapp?: string }>({});

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const { data: pac } = await supabase
        .from('pacientes')
        .select('id, nome, sobrenome, terapeuta_id, cadastro_status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!pac) { setLoading(false); return; }

      if ((pac as any).cadastro_status === 'pendente_paciente') {
        navigate('/paciente/completar-cadastro', { replace: true });
        return;
      }

      setPaciente(pac);

      if (pac.terapeuta_id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('nome, sobrenome, telefone')
          .eq('user_id', pac.terapeuta_id)
          .maybeSingle();
        if (prof) setProfissional({ nome: [prof.nome, prof.sobrenome].filter(Boolean).join(' '), whatsapp: prof.telefone ?? undefined });
      }

      const now = new Date().toISOString();

      const [agendaRes, avalRes, sessaoRes, diarioRes, pendentesRes, lastMyIdRes, historiaRes] = await Promise.all([
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
        supabase.from('myid_avaliacoes')
          .select('id, updated_at')
          .eq('paciente_id', pac.id)
          .eq('status', 'concluido')
          .order('updated_at', { ascending: false })
          .limit(1),
        supabase.from('avaliacoes_voz')
          .select('id', { count: 'exact', head: true })
          .eq('paciente_id', pac.id),
      ]);

      setProximasConsultas(agendaRes.data || []);
      setStats({
        avaliacoes: avalRes.count || 0,
        consultas: sessaoRes.count || 0,
        diarios: diarioRes.count || 0,
        pendentes: pendentesRes.count || 0,
        vocais: (historiaRes as any).count || 0,
      });
      setHistoriaContada((historiaRes.count || 0) > 0);

      const completedMyIds = lastMyIdRes.data || [];
      const jaContou = (historiaRes.count || 0) > 0;
      if (!jaContou) {
        setShowMyIdPrompt(false);
      } else if (completedMyIds.length === 0) {
        setShowMyIdPrompt(true);
        setMyIdPromptType('first');
      } else {
        const daysSince = differenceInDays(new Date(), new Date(completedMyIds[0].updated_at));
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

  useEffect(() => {
    if (!paciente?.id || loading) return;
    supabase.from('pacientes').update({ xp_total: xp }).eq('id', paciente.id).then(() => {});
  }, [paciente?.id, xp, loading]);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  // Onboarding — 3 passos iniciais para novos pacientes
  const onboardingSteps = [
    {
      done: historiaContada,
      label: 'Contar sua história',
      sub: 'Responda em voz como você está',
      path: '/paciente/historia',
      Icon: Mic,
    },
    {
      done: stats.avaliacoes > 0,
      label: 'Completar avaliação MyID',
      sub: 'Descubra seu perfil de saúde',
      path: '/paciente/questionarios',
      Icon: Fingerprint,
    },
    {
      done: stats.consultas > 0,
      label: 'Participar da 1ª consulta',
      sub: 'Acompanhe sua evolução com o profissional',
      path: '/paciente/agenda',
      Icon: CalendarDays,
    },
  ];
  const onboardingCompleto = onboardingSteps.every(s => s.done);
  const proxPasso = onboardingSteps.findIndex(s => !s.done);

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

          {/* Saudação + nível */}
          <V i={0}>
            <div className="flex items-center justify-between px-1 pt-1">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full p-0.5 shrink-0 bg-gradient-to-tr from-[hsl(42,60%,55%)] via-primary to-primary/60">
                  <div className="w-full h-full rounded-full bg-card flex items-center justify-center">
                    <span className="text-sm font-semibold text-foreground">
                      {(paciente?.nome?.[0] || '?').toUpperCase()}{(paciente?.sobrenome?.[0] || '').toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground font-medium">{getGreeting()}</p>
                  <h1 className="font-display text-2xl sm:text-3xl text-foreground truncate leading-tight">
                    {paciente?.nome || '...'}
                  </h1>
                  {notifications.streak > 1 && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-[hsl(var(--gold))] shrink-0" />
                      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                        {notifications.streak} dias de foco
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 shrink-0">
                <LevelIcon className={cn('h-4 w-4', level.color)} />
                <span className="text-[11px] font-medium text-foreground">{level.label} · {xp} XP</span>
              </div>
            </div>
          </V>

          {/* Onboarding — primeiros passos (some quando tudo feito) */}
          {!onboardingCompleto && (
            <V i={1}>
              <Card className="border-primary/20 bg-primary/[0.03]">
                <CardContent className="p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary mb-3">
                    Seus primeiros passos
                  </p>
                  <div className="space-y-3">
                    {onboardingSteps.map((step, idx) => {
                      const isNext = idx === proxPasso;
                      return (
                        <button
                          key={idx}
                          disabled={step.done}
                          onClick={() => !step.done && navigate(step.path)}
                          className={cn(
                            'w-full flex items-center gap-3 text-left transition-all rounded-xl px-3 py-2.5',
                            step.done
                              ? 'opacity-50 cursor-default'
                              : isNext
                              ? 'bg-primary/8 hover:bg-primary/12 active:scale-[0.98]'
                              : 'hover:bg-muted/60 active:scale-[0.98]',
                          )}
                        >
                          {step.done
                            ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                            : <Circle className={cn('h-5 w-5 shrink-0', isNext ? 'text-primary' : 'text-muted-foreground/40')} />
                          }
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm font-semibold truncate', step.done ? 'line-through text-muted-foreground' : 'text-foreground')}>
                              {step.label}
                            </p>
                            {!step.done && (
                              <p className="text-[11px] text-muted-foreground truncate">{step.sub}</p>
                            )}
                          </div>
                          {isNext && <ChevronRight className="h-4 w-4 text-primary shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </V>
          )}

          {/* Bloqueio total */}
          {bloqueadoClinico && (
            <V i={2}>
              <BloqueioPortalCard
                whatsappProfissional={profissional.whatsapp}
                nomeProfissional={profissional.nome}
              />
            </V>
          )}

          {/* Período de carência */}
          {emCarencia && (
            <V i={2}>
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-amber-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-900">
                      Período de carência — {diasRestantesCarencia ?? 0} {diasRestantesCarencia === 1 ? 'dia' : 'dias'} restantes
                    </p>
                    <p className="text-[11px] text-amber-800/80 mt-0.5">
                      Seu pacote terminou. O portal segue aberto para acompanhamento, mas seu profissional não pode adicionar novas atividades.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </V>
          )}

          {/* Reação pós-sessão — feedback imediato (alta prioridade) */}
          {paciente && (
            <V i={3}>
              <ReacaoPosSessaoCard pacienteId={paciente.id} />
            </V>
          )}

          {/* Próxima sessão */}
          {proximasConsultas.length > 0 && (
            <V i={4}>
              <button
                onClick={() => navigate('/paciente/agenda')}
                className="w-full rounded-2xl border border-[hsl(var(--gold)/0.35)] bg-[hsl(var(--gold)/0.06)] p-4 flex items-center justify-between gap-3 hover:bg-[hsl(var(--gold)/0.12)] transition-colors text-left active:scale-[0.99]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gradient-gold flex items-center justify-center shadow-xs shrink-0">
                    <CalendarDays className="h-5 w-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="eyebrow-gold mb-0.5">Próxima Sessão</p>
                    <p className="text-sm font-semibold text-foreground truncate">
                      {format(parseISO(proximasConsultas[0].data_inicio), "EEE, d MMM · HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              </button>
            </V>
          )}

          {/* Questionários pendentes */}
          {stats.pendentes > 0 && (
            <V i={5}>
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
            </V>
          )}

          {/* CTA: contar história (se ainda não contou e onboarding não completo) */}
          {!historiaContada && onboardingCompleto === false && (
            <V i={5}>
              <Card
                className="border-0 shadow-md overflow-hidden cursor-pointer"
                style={{ background: 'linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(213 55% 28%) 100%)' }}
                onClick={() => navigate('/paciente/historia')}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Mic className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-primary-foreground">🎙️ Conte como você está</h3>
                    <p className="text-[11px] text-primary-foreground/75 mt-0.5">
                      Responda em voz algumas perguntas — adianta sua avaliação inicial.
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-primary-foreground/80 shrink-0" />
                </CardContent>
              </Card>
            </V>
          )}

          {/* Prompt MyID — primeira vez ou reavaliação mensal */}
          {showMyIdPrompt && stats.pendentes === 0 && (
            <V i={6}>
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
                        {myIdPromptType === 'first' ? '🎯 Descubra seu MyID!' : '🔄 Hora de atualizar seu MyID!'}
                      </h3>
                      <p className="text-[11px] text-primary-foreground/70 mt-0.5">
                        {myIdPromptType === 'first'
                          ? 'Responda seu primeiro questionário MyID para conhecer seu perfil de saúde e receber orientações personalizadas.'
                          : 'Já faz mais de 30 dias desde sua última avaliação. Atualize para acompanhar sua evolução!'}
                      </p>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-2 h-7 text-xs font-bold bg-white/20 hover:bg-white/30 text-primary-foreground border-0"
                        onClick={() => navigate('/paciente/questionarios')}
                      >
                        <Fingerprint className="h-3.5 w-3.5 mr-1" />
                        {myIdPromptType === 'first' ? 'Responder agora' : 'Atualizar MyID'}
                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </V>
          )}

          {/* Dashboard MyID (gráfico + evolução) */}
          <V i={7}>
            {paciente && (
              <Suspense fallback={
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              }>
                <PatientIntegratedDashboard pacienteId={paciente.id} serviceType="identidade" />
              </Suspense>
            )}
          </V>

          {/* Exercícios */}
          <V i={8}>
            {paciente && <PacienteExerciciosResumido pacienteId={paciente.id} />}
          </V>

          {/* Insights da avaliação + Desafio do Dia */}
          {paciente && (
            <V i={9}>
              <PacienteInsightsDaAvaliacao pacienteId={paciente.id} />
            </V>
          )}

          {/* Alertas e lembretes */}
          <V i={10}>
            {paciente && <PacienteAlertasLembretes pacienteId={paciente.id} />}
          </V>

          {/* Dica inteligente */}
          <V i={11}>
            <PacienteDicaInteligente />
          </V>

          {/* Recompensas */}
          <V i={12}>
            <button
              onClick={() => navigate('/paciente/recompensas')}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border/40 bg-gradient-to-r from-amber-50 to-yellow-50 hover:shadow-md transition-shadow text-left active:scale-[0.99]"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Trophy className="w-5 h-5 text-amber-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">Suas recompensas</div>
                <div className="text-[11px] text-muted-foreground">Troque XP por benefícios reais</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </V>

          {/* Upgrade Wellness — mostrado depois do valor, não antes */}
          {isFree && (
            <V i={12}>
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
                        ? 'Você tem acesso completo. Assine para continuar após o trial.'
                        : 'Exercícios, protocolos, missões completas e 1 consulta/mês.'}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-primary-foreground/80 shrink-0" />
                </CardContent>
              </Card>
            </V>
          )}

          {/* PDF MyID */}
          <V i={13}>
            <MyIDPDFButton />
          </V>

          {/* Outras consultas */}
          {proximasConsultas.length > 1 && (
            <V i={14}>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-foreground">Outras consultas</h2>
                <button onClick={() => navigate('/paciente/agenda')} className="text-[10px] font-semibold text-primary flex items-center gap-0.5">
                  Ver agenda <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              <div className="space-y-1.5">
                {proximasConsultas.slice(1).map((ag) => (
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
            </V>
          )}

        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
