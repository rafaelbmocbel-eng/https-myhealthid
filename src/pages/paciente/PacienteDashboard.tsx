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
const JornadaPacienteCard = lazy(() => import('@/components/paciente/JornadaPacienteCard'));
import MyIDPDFButton from '@/components/paciente/MyIDPDFButton';
import BloqueioPortalCard from '@/components/paciente/BloqueioPortalCard';
import { usePacienteNotifications } from '@/hooks/usePacienteNotifications';
import ReacaoPosSessaoCard from '@/components/paciente/ReacaoPosSessaoCard';
import { useWellnessAccess } from '@/hooks/useWellnessAccess';
import { NIVEL_LIMITES } from '@/hooks/useRecompensas';
import { calcularPerdaDimensao } from '@/utils/myid/lossTable';
import { INSTRUMENTOS, instrumentosRecomendados } from '@/lib/instrumentosClinicos';
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

// Escala ÚNICA de níveis — a mesma do banco (calcular_nivel_paciente) e das
// Recompensas: bronze 0 · prata 200 · ouro 500 · platina 1000 · diamante 2000.
// Limiares vêm da MESMA fonte das Recompensas (NIVEL_LIMITES) — uma escala só.
function getLevel(xp: number) {
  if (xp >= NIVEL_LIMITES.diamante) return { label: 'Diamante', color: 'text-cyan-500',   icon: Trophy, next: null };
  if (xp >= NIVEL_LIMITES.platina)  return { label: 'Platina',  color: 'text-slate-400',  icon: Trophy, next: NIVEL_LIMITES.diamante };
  if (xp >= NIVEL_LIMITES.ouro)     return { label: 'Ouro',     color: 'text-yellow-600', icon: Trophy, next: NIVEL_LIMITES.platina };
  if (xp >= NIVEL_LIMITES.prata)    return { label: 'Prata',    color: 'text-slate-500',  icon: Star,   next: NIVEL_LIMITES.ouro };
  return                              { label: 'Bronze',   color: 'text-amber-700',  icon: Flame,  next: NIVEL_LIMITES.prata };
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
  const [myidConcluido, setMyidConcluido] = useState(false);
  const [nDicas, setNDicas] = useState(0);
  const [focos, setFocos] = useState<{ oportunidade: string; atencao: string | null } | null>(null);
  const [proxInstrumento, setProxInstrumento] = useState<{ nome: string; sigla: string } | null>(null);

  const notifications = usePacienteNotifications(user?.id);
  const { isFree, isInTrial, trialDiasRestantes, emCarencia, bloqueadoClinico, diasRestantesCarencia } = useWellnessAccess();
  const [profissional, setProfissional] = useState<{ nome?: string; whatsapp?: string }>({});

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      try {
        const { data: pac, error: pacError } = await supabase
          .from('pacientes')
          .select('id, nome, sobrenome, terapeuta_id, cadastro_status, xp_total, historico_clinico')
          .eq('user_id', user.id)
          .maybeSingle();
        if (pacError) throw pacError;

        if (!pac) { return; }

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

        const [agendaRes, avalRes, sessaoRes, diarioRes, pendentesRes, lastMyIdRes, avalVozRes, historiaRes, dicasRes, questClinRes] = await Promise.all([
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
            .select('id, updated_at, resultado_processado')
            .eq('paciente_id', pac.id)
            .eq('status', 'concluido')
            .order('updated_at', { ascending: false })
            .limit(1),
          supabase.from('avaliacoes_voz')
            .select('id', { count: 'exact', head: true })
            .eq('paciente_id', pac.id),
          supabase.from('avaliacoes_voz')
            .select('resultado')
            .eq('paciente_id', pac.id)
            .order('created_at', { ascending: false })
            .limit(20),
          (supabase as any).from('paciente_dicas')
            .select('dicas')
            .eq('paciente_id', pac.id)
            .maybeSingle(),
          (supabase as any).from('questionarios_clinicos')
            .select('instrumento')
            .eq('paciente_id', pac.id),
        ]);

        setProximasConsultas(agendaRes.data || []);
        setStats({
          avaliacoes: avalRes.count || 0,
          consultas: sessaoRes.count || 0,
          diarios: diarioRes.count || 0,
          pendentes: pendentesRes.count || 0,
          vocais: avalVozRes.count || 0,
        });
        setHistoriaContada((historiaRes.data || []).some((r: any) => r?.resultado?._meta?.origem === 'portal_paciente_historia'));
        setNDicas(Array.isArray((dicasRes.data as any)?.dicas) ? (dicasRes.data as any).dicas.length : 0);

        const completedMyIds = lastMyIdRes.data || [];
        setMyidConcluido(completedMyIds.length > 0);

        // Focos da avaliação (mesma lógica do painel MyID): maior oportunidade
        // e ponto de atenção — mostrados DENTRO do card "Sua avaliação gerou..."
        const sc = (completedMyIds[0] as any)?.resultado_processado?.scores;
        if (sc) {
          const fatores = [
            { label: 'Melhorar o sono', p: calcularPerdaDimensao('R', 10 - sc.R).perda_pontos },
            { label: 'Beber mais água', p: calcularPerdaDimensao('HID', 10 - sc.HID).perda_pontos },
            { label: 'Mais movimento', p: calcularPerdaDimensao('AF', 10 - sc.AF).perda_pontos },
            { label: 'Ajustar a alimentação', p: calcularPerdaDimensao('NUT', 10 - sc.NUT).perda_pontos },
            { label: 'Reduzir a ansiedade', p: calcularPerdaDimensao('P', sc.P).perda_pontos },
            { label: 'Vencer a inércia', p: calcularPerdaDimensao('I', sc.I).perda_pontos },
            { label: 'Reduzir a dor', p: calcularPerdaDimensao('D', sc.D).perda_pontos },
            { label: 'Melhorar a rotina', p: calcularPerdaDimensao('C', 10 - sc.C).perda_pontos },
            { label: 'Cuidar da postura', p: calcularPerdaDimensao('ERG', 10 - sc.ERG).perda_pontos },
          ].filter(f => f.p > 0).sort((a, b) => b.p - a.p);
          if (fatores.length > 0) {
            setFocos({
              oportunidade: fatores[0].label,
              atencao: fatores.length > 1 ? fatores[fatores.length - 1].label : null,
            });
          }

          // Próximo questionário apontado pelo MyID (o primeiro recomendado
          // que ainda não foi respondido) — mostrado dentro do funil
          const respondidos = new Set(((questClinRes.data as any[]) || []).map((r: any) => r.instrumento));
          const prox = instrumentosRecomendados(sc).find((id) => !respondidos.has(id));
          setProxInstrumento(prox ? { nome: INSTRUMENTOS[prox].nome, sigla: INSTRUMENTOS[prox].sigla } : null);
        }
        // Mostra prompt do MyID independentemente de avaliação de voz
        if (completedMyIds.length === 0) {
          setShowMyIdPrompt(true);
          setMyIdPromptType('first');
        } else {
          const daysSince = differenceInDays(new Date(), new Date(completedMyIds[0].updated_at));
          if (daysSince >= 30) {
            setShowMyIdPrompt(true);
            setMyIdPromptType('monthly');
          }
        }
      } catch (e) {
        console.error('[PacienteDashboard] fetchData error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, navigate]);

  // XP agora vem SÓ da carteira real (pacientes.xp_total), creditada pela
  // função ganhar_xp em missões/metas/diário/treino/desafios — sem recomputo
  // local nem sobrescrita concorrente.
  const xp = (paciente as any)?.xp_total || 0;
  const level = getLevel(xp);
  const LevelIcon = level.icon;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  // Onboarding — 3 passos iniciais: MyID primeiro, depois o histórico clínico.
  // "Contar sua história" NÃO é passo — é o card fixo logo abaixo (áudio ou texto).
  const historicoFeito = !!(paciente as any)?.historico_clinico;
  const onboardingSteps = [
    {
      // Conta o MyID CONCLUÍDO de verdade (antes olhava avaliacoes_identidade,
      // que nem sempre existe para conta de autocadastro — o passo nunca marcava)
      done: myidConcluido,
      label: 'Completar avaliação MyID',
      sub: 'Descubra seu perfil de saúde',
      path: '/paciente/questionarios',
      Icon: Fingerprint,
    },
    {
      done: historicoFeito,
      label: 'Responder histórico clínico',
      sub: 'Fraturas, cirurgias, medicações e condições',
      path: '/paciente/questionarios?foco=historico',
      Icon: ClipboardList,
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

          {/* Hero — saudação, nível e streak */}
          <V i={0}>
            <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-primary to-primary-dark text-white shadow-md">
              <span className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[hsl(42,75%,60%)]/25 blur-2xl" aria-hidden />
              <div className="relative flex items-center gap-3">
                <div className="w-12 h-12 rounded-full p-[2px] shrink-0 bg-gradient-to-tr from-[hsl(42,75%,62%)] to-white/40">
                  <div className="w-full h-full rounded-full bg-primary flex items-center justify-center">
                    <span className="text-sm font-bold text-white">
                      {(paciente?.nome?.[0] || '?').toUpperCase()}{(paciente?.sobrenome?.[0] || '').toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-white/70">{getGreeting()}</p>
                  <h1 className="font-display text-2xl sm:text-3xl text-white truncate leading-tight">
                    {paciente?.nome || '...'}
                  </h1>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm shrink-0 self-start">
                  <LevelIcon className="h-4 w-4 text-[hsl(42,85%,72%)]" />
                  <span className="text-[11px] font-semibold text-white">{level.label} · {xp} XP</span>
                </div>
              </div>
              {notifications.streak > 1 && (
                <div className="relative mt-3 flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5 text-[hsl(28,90%,62%)]" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
                    {notifications.streak} dias de foco
                  </span>
                </div>
              )}
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

          {/* Contar sua história — card fixo (substitui o microfone do topo).
              Fala (ditado) ou escreve, como na avaliação presencial. */}
          <V i={1}>
            <Card className="overflow-hidden">
              <button onClick={() => navigate('/paciente/historia')} className="w-full text-left p-4 flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                  historiaContada ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary',
                )}>
                  {historiaContada ? <CheckCircle2 className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">Contar sua história</p>
                  <p className="text-[11px] text-muted-foreground">
                    {historiaContada
                      ? 'História registrada — toque para atualizar quando algo mudar'
                      : 'Fale (áudio) ou escreva como você está — seu profissional recebe tudo'}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </Card>
          </V>

          {/* 🎯 PRÓXIMOS PASSOS DA AVALIAÇÃO — o funil pós-MyID: resultado
              completo, exercícios da IA e questionários do plano (ou Premium) */}
          {myidConcluido && (
            <V i={1}>
              <Card className="border-primary/25">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">
                    Sua avaliação gerou isto para você
                  </p>

                  {/* Os achados importantes, direto no funil */}
                  {focos && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                        🎯 Maior oportunidade: {focos.oportunidade}
                      </span>
                      {focos.atencao && (
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          ⚠️ Ponto de atenção: {focos.atencao}
                        </span>
                      )}
                    </div>
                  )}

                  <button onClick={() => navigate('/paciente/questionarios?ver=ultimo')}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:bg-muted/40 text-left transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Fingerprint className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">Ver meu resultado completo</p>
                      <p className="text-[11px] text-muted-foreground">Como está seu corpo hoje, em linguagem simples</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>

                  {/* O próximo questionário que o MyID apontou — tudo importante
                      fica aqui dentro; free vê que o próximo é do Premium */}
                  {proxInstrumento && (
                    <button
                      onClick={() => navigate(isFree && !isInTrial ? '/paciente/plano' : '/paciente/questionarios?foco=plano')}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:bg-muted/40 text-left transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                        <ClipboardList className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">
                          Próximo questionário: {proxInstrumento.sigla}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {isFree && !isInTrial
                            ? `🔒 ${proxInstrumento.nome} — o MyID apontou este, disponível no Premium`
                            : `${proxInstrumento.nome} — o seu MyID apontou este como o próximo passo`}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  )}

                  <button onClick={() => navigate('/paciente/dicas')}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:bg-muted/40 text-left transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">Exercícios &amp; dicas da IA</p>
                      <p className="text-[11px] text-muted-foreground">
                        {nDicas > 0
                          ? `${nDicas} dicas prontas, feitas do seu MyID`
                          : 'Sendo preparadas a partir do seu MyID — volte em instantes'}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>

                  <button
                    onClick={() => navigate(isFree && !isInTrial ? '/paciente/plano' : '/paciente/questionarios?foco=plano')}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:bg-muted/40 text-left transition-colors">
                    <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0">
                      <ClipboardList className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">
                        Treino personalizado
                        {isFree && !isInTrial && <span className="ml-1.5 text-[10px] font-bold text-violet-600">💎 Premium</span>}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {isFree && !isInTrial
                          ? '🔒 Monte seu plano nutricional, seu treino e tratamento personalizado'
                          : 'Monte seu plano nutricional, seu treino e tratamento personalizado'}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                </CardContent>
              </Card>
            </V>
          )}

          {/* Sem terapeuta vinculado: convite ao marketplace (fluxo aprovado —
              premium terá o avatar montado por um profissional) */}
          {paciente && !(paciente as any).terapeuta_id && (
            <V i={1}>
              <button
                onClick={() => navigate('/paciente/profissionais')}
                className="w-full rounded-2xl border border-[hsl(var(--gold)/0.35)] bg-[hsl(var(--gold)/0.06)] p-4 flex items-center gap-3 hover:bg-[hsl(var(--gold)/0.12)] transition-colors text-left active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-gold flex items-center justify-center shadow-xs shrink-0">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">Conecte-se a um profissional</p>
                  <p className="text-[11px] text-muted-foreground">
                    Um profissional monta seu Avatar Clínico, revisa sua avaliação e acompanha você de perto
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </V>
          )}

          {/* Jornada (plano de hoje + metas) — SOBE: é a ação diária do cliente */}
          {paciente && myidConcluido && (
            <V i={2}>
              <Suspense fallback={null}>
                <JornadaPacienteCard pacienteId={paciente.id} />
              </Suspense>
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

          {/* Prompt MyID — reavaliação mensal (1ª vez já fica coberta pelo checklist de onboarding) */}
          {showMyIdPrompt && stats.pendentes === 0 && (myIdPromptType === 'monthly' || onboardingCompleto) && (
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
                        {myIdPromptType === 'first' ? 'Descubra seu MyID!' : 'Hora de atualizar seu MyID!'}
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

          {/* Jornada para quem ainda NÃO fez o MyID (a versão pós-MyID subiu
              para logo abaixo dos Próximos Passos) */}
          {paciente && !myidConcluido && (
            <V i={8}>
              <Suspense fallback={null}>
                <JornadaPacienteCard pacienteId={paciente.id} />
              </Suspense>
            </V>
          )}

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
                        ? `Trial Premium ativo — ${trialDiasRestantes} ${trialDiasRestantes === 1 ? 'dia restante' : 'dias restantes'}`
                        : 'Desbloqueie tudo com Wellness Premium'}
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
