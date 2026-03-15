import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CalendarDays, TrendingUp, TrendingDown, Activity, ChevronRight,
  Trophy, Star, Flame, ClipboardList, Fingerprint, Minus, Loader2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import PatientIntegratedDashboard from '@/components/paciente/PatientIntegratedDashboard';

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

const SCORE_LABELS: Record<string, string> = {
  D: 'Dor', EFI: 'Função', P: 'Psicológico', I: 'Inércia', N: 'Ruído', R: 'Regulação', C: 'Contexto'
};

export default function PacienteDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [paciente, setPaciente] = useState<PacienteInfo | null>(null);
  const [proximasConsultas, setProximasConsultas] = useState<Agendamento[]>([]);
  const [avaliacoes, setAvaliacoes] = useState<AvaliacaoIdentidade[]>([]);
  const [stats, setStats] = useState({ avaliacoes: 0, consultas: 0, diarios: 0, pendentes: 0 });
  const [loading, setLoading] = useState(true);

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

      const [agendaRes, avalRes, sessaoRes, diarioRes, pendentesRes, avaliacoesRes] = await Promise.all([
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
        // Fetch full evaluations for charts
        supabase.from('avaliacoes_identidade')
          .select('id, created_at, data_avaliacao, classificacao, myid_score, score_d, score_p, score_efi, score_i, score_n, score_r, score_c')
          .eq('paciente_id', pac.id)
          .not('myid_score', 'is', null)
          .order('created_at', { ascending: true }),
      ]);

      setProximasConsultas(agendaRes.data || []);
      setAvaliacoes(avaliacoesRes.data || []);
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

  // ── Chart data from avaliacoes ──
  const ultimaAval = avaliacoes[avaliacoes.length - 1];
  const primeiraAval = avaliacoes[0];
  const hasEvolution = avaliacoes.length >= 2;

  const radarData = ultimaAval ? [
    { score: 'Dor', atual: Number(ultimaAval.score_d) || 0, inicial: Number(primeiraAval?.score_d) || 0 },
    { score: 'Função', atual: Number(ultimaAval.score_efi) || 0, inicial: Number(primeiraAval?.score_efi) || 0 },
    { score: 'Psico', atual: Number(ultimaAval.score_p) || 0, inicial: Number(primeiraAval?.score_p) || 0 },
    { score: 'Inércia', atual: Number(ultimaAval.score_i) || 0, inicial: Number(primeiraAval?.score_i) || 0 },
    { score: 'Regulação', atual: Number(ultimaAval.score_r) || 0, inicial: Number(primeiraAval?.score_r) || 0 },
    { score: 'Contexto', atual: Number(ultimaAval.score_c) || 0, inicial: Number(primeiraAval?.score_c) || 0 },
    { score: 'Ruído', atual: Number(ultimaAval.score_n) || 0, inicial: Number(primeiraAval?.score_n) || 0 },
  ] : [];

  const lineData = avaliacoes.map((av, idx) => ({
    name: `#${idx + 1}`,
    MyID: Number(av.myid_score) || 0,
    D: Number(av.score_d) || 0,
    P: Number(av.score_p) || 0,
    R: Number(av.score_r) || 0,
  }));

  // ── Score deltas ──
  const getScoreDelta = (key: string) => {
    if (!hasEvolution) return null;
    const curr = Number((ultimaAval as any)?.[`score_${key.toLowerCase()}`]) || 0;
    const prev = Number((primeiraAval as any)?.[`score_${key.toLowerCase()}`]) || 0;
    return Number((curr - prev).toFixed(1));
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
          {/* Greeting + Level */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-black text-foreground">
                {getGreeting()}, {paciente?.nome || '...'} 👋
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Acompanhe sua evolução e próximas consultas.
              </p>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${level.bg}`}>
              <LevelIcon className={`h-3.5 w-3.5 ${level.color}`} />
              <span className={`text-[11px] font-bold ${level.color}`}>{level.label}</span>
            </div>
          </div>

          {/* XP bar */}
          {level.next && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{xp} XP</span>
                <span>Próximo: {level.next} XP</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, (xp / level.next) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Alert: pending questionnaires */}
          {stats.pendentes > 0 && (
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
          )}

          {/* ── MyID Score Card with Fingerprint ── */}
          {ultimaAval && (() => {
            const fpScores: Record<string, number> = {
              D: Number(ultimaAval.score_d) || 0,
              EFI: Number(ultimaAval.score_efi) || 0,
              P: Number(ultimaAval.score_p) || 0,
              I: Number(ultimaAval.score_i) || 0,
              R: Number(ultimaAval.score_r) || 0,
              C: Number(ultimaAval.score_c) || 0,
              N: Number(ultimaAval.score_n) || 0,
            };
            const fpRings = getMyIDFingerprintData(fpScores);

            return (
              <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-violet-50/40 dark:to-violet-950/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-md">
                      <Fingerprint className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-sm font-black text-foreground">Seu MyID Score</h2>
                      <p className="text-[10px] text-muted-foreground">Resultado mais recente</p>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-black text-violet-600">{Number(ultimaAval.myid_score).toFixed(1)}</span>
                      <p className="text-[10px] font-bold text-muted-foreground">/10</p>
                    </div>
                  </div>

                  {ultimaAval.classificacao && (
                    <Badge variant="outline" className="text-[10px] font-bold mb-3">
                      {ultimaAval.classificacao}
                    </Badge>
                  )}

                  {/* Fingerprint Visualization */}
                  {fpRings.length > 0 && (
                    <div className="my-4">
                      <MyIDFingerprint
                        rings={fpRings}
                        myidScore={Number(ultimaAval.myid_score) || 0}
                        className="w-full max-w-sm mx-auto"
                      />
                    </div>
                  )}

                  {/* Score dimensions */}
                  <div className="grid grid-cols-4 gap-1.5 mt-2">
                    {(['d', 'efi', 'p', 'i', 'r', 'c', 'n'] as const).map((key) => {
                      const val = Number((ultimaAval as any)[`score_${key}`]) || 0;
                      const delta = getScoreDelta(key);
                      const labels: Record<string, string> = { d: 'Dor', efi: 'Função', p: 'Psico', i: 'Inércia', r: 'Regulação', c: 'Contexto', n: 'Ruído' };
                      return (
                        <div key={key} className="bg-muted/50 rounded-lg p-2 text-center">
                          <span className="text-[9px] text-muted-foreground font-semibold uppercase block">{labels[key]}</span>
                          <span className="text-sm font-black text-foreground">{val.toFixed(1)}</span>
                          {delta !== null && delta !== 0 && (
                            <div className="flex items-center justify-center gap-0.5 mt-0.5">
                              {delta < 0 ? (
                                <TrendingDown className="h-2.5 w-2.5 text-emerald-600" />
                              ) : (
                                <TrendingUp className="h-2.5 w-2.5 text-red-500" />
                              )}
                              <span className={`text-[9px] font-bold ${delta < 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {delta > 0 ? '+' : ''}{delta}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* ── Evolution Charts (only if 2+ avaliacoes) ── */}
          {hasEvolution && (
            <>
              {/* Radar: First vs Last */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      Comparativo
                    </h2>
                    <Badge variant="outline" className="text-[10px]">1ª vs Última</Badge>
                  </div>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid className="stroke-border" />
                        <PolarAngleAxis dataKey="score" tick={{ fontSize: 9 }} />
                        <Radar name="1ª Avaliação" dataKey="inicial" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.15} strokeDasharray="4 4" />
                        <Radar name="Atual" dataKey="atual" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontSize: 9 }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Line: Evolution */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Evolução
                    </h2>
                    <Badge variant="outline" className="text-[10px]">{avaliacoes.length} avaliações</Badge>
                  </div>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lineData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} domain={[0, 10]} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontSize: 9 }} />
                        <Line type="monotone" dataKey="MyID" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} name="MyID Score" />
                        <Line type="monotone" dataKey="D" stroke="#ef4444" strokeWidth={1.5} dot={{ r: 2 }} name="Dor" />
                        <Line type="monotone" dataKey="P" stroke="#f59e0b" strokeWidth={1.5} dot={{ r: 2 }} name="Psico" />
                        <Line type="monotone" dataKey="R" stroke="#8b5cf6" strokeWidth={1.5} dot={{ r: 2 }} name="Regulação" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* MyID Score Delta */}
              <Card className="bg-gradient-to-r from-emerald-50/50 to-card dark:from-emerald-950/10">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    {Number(ultimaAval.myid_score) <= Number(primeiraAval.myid_score) ? (
                      <TrendingDown className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <TrendingUp className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">
                      {Number(ultimaAval.myid_score) <= Number(primeiraAval.myid_score)
                        ? 'Você está melhorando! 🎉'
                        : 'Atenção ao seu progresso'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      MyID de {Number(primeiraAval.myid_score).toFixed(1)} → {Number(ultimaAval.myid_score).toFixed(1)}
                      {' '}({(Number(ultimaAval.myid_score) - Number(primeiraAval.myid_score) > 0 ? '+' : '')}
                      {(Number(ultimaAval.myid_score) - Number(primeiraAval.myid_score)).toFixed(1)})
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Quick stats */}
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
                <Activity className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                <span className="text-xl font-black text-foreground block">{stats.avaliacoes}</span>
                <span className="text-[10px] text-muted-foreground">Avaliações</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <Flame className="h-4 w-4 text-orange-500 mx-auto mb-1" />
                <span className="text-xl font-black text-foreground block">{stats.consultas}</span>
                <span className="text-[10px] text-muted-foreground">Sessões</span>
              </CardContent>
            </Card>
          </div>

          {/* Upcoming appointments */}
          <div>
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
                {proximasConsultas.map((ag) => (
                  <Card key={ag.id} className="hover:shadow-sm transition-shadow">
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
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {ag.status === 'confirmado' ? 'Confirmado' : 'Pendente'}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Gamification badges */}
          <div>
            <h2 className="text-sm font-bold text-foreground mb-3">Conquistas</h2>
            <div className="flex flex-wrap gap-2">
              {stats.avaliacoes >= 1 && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] gap-1">
                  <ClipboardList className="h-3 w-3" /> 1ª Avaliação
                </Badge>
              )}
              {stats.avaliacoes >= 3 && (
                <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-[10px] gap-1">
                  <Fingerprint className="h-3 w-3" /> 3 Avaliações
                </Badge>
              )}
              {stats.consultas >= 5 && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] gap-1">
                  <CalendarDays className="h-3 w-3" /> 5 Sessões
                </Badge>
              )}
              {stats.diarios >= 7 && (
                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-[10px] gap-1">
                  <Flame className="h-3 w-3" /> 7 Dias de Diário
                </Badge>
              )}
              {stats.consultas >= 10 && (
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] gap-1">
                  <Trophy className="h-3 w-3" /> 10 Sessões
                </Badge>
              )}
              {xp < 50 && (
                <p className="text-[10px] text-muted-foreground/50 italic">
                  Continue interagindo para desbloquear conquistas!
                </p>
              )}
            </div>
          </div>
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
