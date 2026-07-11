import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Loader2, Dumbbell, Check, ChevronDown, ChevronUp,
  Play, Clock, Flame, AlertCircle, Star, X, SkipForward,
} from 'lucide-react';
import { format, parseISO, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

// Converte um link de vídeo (YouTube / Vimeo / arquivo direto) no formato certo
// para exibir dentro do app.
function resolverVideo(url: string): { tipo: 'iframe' | 'video'; src: string } {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return { tipo: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}` };
  const vim = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vim) return { tipo: 'iframe', src: `https://player.vimeo.com/video/${vim[1]}` };
  return { tipo: 'video', src: url };
}

function fmtTimer(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

interface Treino {
  id: string;
  titulo: string;
  objetivo: string | null;
  duracao_estimada: string | null;
  intensidade: string | null;
  frequencia: string | null;
  ordem: number | null;
}

interface TreinoExercicio {
  id: string;
  treino_id: string;
  nome_customizado: string | null;
  grupo_muscular: string | null;
  series: number | null;
  repeticoes: number | null;
  carga_kg: number | null;
  descanso_segundos: number | null;
  cadencia: string | null;
  metodo: string | null;
  orientacoes: string | null;
  video_url: string | null;
  gif_url: string | null;
  ordem: number | null;
}

interface Execucao {
  id: string;
  treino_id: string;
  data_execucao: string | null;
  completo: boolean | null;
  duracao_minutos: number | null;
  nota_dor: number | null;
  feedback_aluno: string | null;
}

export default function PacienteExercicios() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [terapeutaId, setTerapeutaId] = useState<string | null>(null);
  const [treinos, setTreinos] = useState<Treino[]>([]);
  const [exercicios, setExercicios] = useState<TreinoExercicio[]>([]);
  const [execucoes, setExecucoes] = useState<Execucao[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTreino, setExpandedTreino] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [sessionDor, setSessionDor] = useState(0);
  const [sessionFeedback, setSessionFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [doneEx, setDoneEx] = useState<Set<string>>(new Set());
  const [restSec, setRestSec] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Timer de descanso (conta pra baixo). Chega a 0 → some.
  useEffect(() => {
    if (restSec === null) return;
    if (restSec <= 0) { setRestSec(null); return; }
    const t = setTimeout(() => setRestSec(s => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [restSec]);

  const toggleDone = (ex: TreinoExercicio) => {
    setDoneEx(prev => {
      const n = new Set(prev);
      if (n.has(ex.id)) {
        n.delete(ex.id);
      } else {
        n.add(ex.id);
        // Ao marcar como feito, já inicia o descanso prescrito.
        if (ex.descanso_segundos && ex.descanso_segundos > 0) setRestSec(ex.descanso_segundos);
      }
      return n;
    });
  };

  const fetchData = async () => {
    if (!user) return;
    const { data: pac } = await supabase
      .from('pacientes')
      .select('id, terapeuta_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!pac) { setLoading(false); return; }
    setPacienteId(pac.id);
    setTerapeutaId(pac.terapeuta_id);

    const [treinosRes, execRes] = await Promise.all([
      supabase.from('studio_treinos').select('id, titulo, objetivo, duracao_estimada, intensidade, frequencia, ordem')
        .eq('paciente_id', pac.id).eq('publicado', true).eq('ativo', true)
        .order('ordem', { ascending: true }),
      supabase.from('studio_execucoes').select('*')
        .eq('paciente_id', pac.id)
        .order('data_execucao', { ascending: false }).limit(100),
    ]);

    const treinosList = (treinosRes.data || []) as Treino[];
    setTreinos(treinosList);
    setExecucoes((execRes.data || []) as Execucao[]);

    if (treinosList.length > 0) {
      const ids = treinosList.map(t => t.id);
      const { data: exData } = await supabase
        .from('studio_treino_exercicios')
        .select('*')
        .in('treino_id', ids)
        .order('ordem', { ascending: true });
      setExercicios((exData || []) as TreinoExercicio[]);
      setExpandedTreino(treinosList[0].id);
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const treinoStats = useMemo(() => {
    const stats: Record<string, { total: number; thisWeek: number; lastDate: string | null }> = {};
    treinos.forEach(t => {
      const execs = execucoes.filter(e => e.treino_id === t.id && e.completo);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      stats[t.id] = {
        total: execs.length,
        thisWeek: execs.filter(e => e.data_execucao && new Date(e.data_execucao) >= weekAgo).length,
        lastDate: execs.length > 0 ? execs[0].data_execucao : null,
      };
    });
    return stats;
  }, [treinos, execucoes]);

  const handleStartSession = (treinoId: string) => {
    setActiveSession(treinoId);
    setSessionDor(0);
    setSessionFeedback('');
    setDoneEx(new Set());
    setRestSec(null);
  };

  const cancelSession = () => {
    setActiveSession(null);
    setDoneEx(new Set());
    setRestSec(null);
  };

  const handleCompleteSession = async () => {
    if (!activeSession || !pacienteId || !terapeutaId) return;
    setSubmitting(true);

    const { error } = await supabase.from('studio_execucoes').insert({
      treino_id: activeSession,
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      completo: true,
      nota_dor: sessionDor,
      feedback_aluno: sessionFeedback.trim() || null,
    });

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Treino concluído! 💪', description: '+15 XP pelo treino completo' });
      setActiveSession(null);
      setDoneEx(new Set());
      setRestSec(null);
      fetchData();
    }
    setSubmitting(false);
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
          {/* Header */}
          <div>
            <h1 className="h-page flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-primary" />
              Meus Exercícios
            </h1>
            <p className="text-xs text-muted-foreground">Treinos prescritos pelo seu profissional</p>
          </div>

          {/* Active session modal */}
          {activeSession && (
            <Card className="border-primary/30 shadow-lg bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="p-5 space-y-4">
                {(() => {
                  const sessExs = exercicios.filter(e => e.treino_id === activeSession);
                  const feitos = sessExs.filter(e => doneEx.has(e.id)).length;
                  return (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Play className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground">Sessão em andamento</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {treinos.find(t => t.id === activeSession)?.titulo}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-primary tabular-nums shrink-0">
                          {feitos}/{sessExs.length}
                        </span>
                      </div>

                      {/* Timer de descanso */}
                      {restSec !== null && (
                        <div className="rounded-xl bg-primary text-primary-foreground p-3 flex items-center gap-2">
                          <Clock className="h-4 w-4 shrink-0" />
                          <span className="text-sm font-semibold">Descanso</span>
                          <span className="text-xl font-black tabular-nums ml-auto">{fmtTimer(restSec)}</span>
                          <button onClick={() => setRestSec(s => (s ?? 0) + 15)} className="h-8 px-2 rounded-lg bg-white/20 text-xs font-bold shrink-0">+15s</button>
                          <button onClick={() => setRestSec(null)} className="h-8 px-2.5 rounded-lg bg-white/20 text-xs font-bold flex items-center gap-1 shrink-0"><SkipForward className="h-3 w-3" /> Pular</button>
                        </div>
                      )}

                      {/* Checklist interativo */}
                      <div className="space-y-1.5">
                        {sessExs.map(ex => {
                          const done = doneEx.has(ex.id);
                          return (
                            <div key={ex.id} className={cn(
                              'flex items-center gap-2.5 p-2.5 rounded-lg text-xs transition-colors',
                              done ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-background/50',
                            )}>
                              <button onClick={() => toggleDone(ex)} className="shrink-0" aria-label="Marcar como feito">
                                <span className={cn(
                                  'h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors',
                                  done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-muted-foreground/40',
                                )}>
                                  {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                                </span>
                              </button>
                              <div className="flex-1 min-w-0" onClick={() => toggleDone(ex)}>
                                <span className={cn('font-medium block truncate', done && 'line-through text-muted-foreground')}>
                                  {ex.nome_customizado || 'Exercício'}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {ex.series}×{ex.repeticoes}{ex.carga_kg ? ` · ${ex.carga_kg}kg` : ''}
                                </span>
                              </div>
                              {ex.video_url && (
                                <button onClick={() => setVideoUrl(ex.video_url)} title="Ver vídeo"
                                  className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                  <Play className="h-4 w-4" />
                                </button>
                              )}
                              {ex.descanso_segundos ? (
                                <button onClick={() => setRestSec(ex.descanso_segundos!)} title="Iniciar descanso"
                                  className="h-8 px-2 rounded-full bg-muted flex items-center gap-1 text-[10px] font-medium shrink-0">
                                  <Clock className="h-3 w-3" /> {ex.descanso_segundos}s
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}

                {/* Pain rating */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-2">
                    Dor durante o treino — <span className={sessionDor > 6 ? 'text-red-500' : sessionDor > 3 ? 'text-amber-500' : 'text-emerald-600'}>{sessionDor}/10</span>
                  </label>
                  <Slider value={[sessionDor]} onValueChange={([v]) => setSessionDor(v)} min={0} max={10} step={1} />
                </div>

                {/* Feedback */}
                <Textarea
                  value={sessionFeedback}
                  onChange={e => setSessionFeedback(e.target.value)}
                  placeholder="Como foi o treino? Alguma dificuldade?"
                  maxLength={300}
                  className="text-sm resize-none h-16"
                />

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 text-sm" onClick={cancelSession}>
                    Cancelar
                  </Button>
                  <Button className="flex-1 text-sm font-bold gap-2" onClick={handleCompleteSession} disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Concluir Treino
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Treinos list */}
          {treinos.map(treino => {
            const stats = treinoStats[treino.id];
            const exs = exercicios.filter(e => e.treino_id === treino.id);
            const isExpanded = expandedTreino === treino.id;
            const weeklyTarget = parseInt(treino.frequencia?.match(/\d+/)?.[0] || '3');
            const weekProgress = Math.min(100, ((stats?.thisWeek || 0) / weeklyTarget) * 100);

            return (
              <Card key={treino.id} className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Treino header */}
                  <button
                    className="w-full p-4 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedTreino(isExpanded ? null : treino.id)}
                  >
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Dumbbell className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{treino.titulo}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {treino.duracao_estimada && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" /> {treino.duracao_estimada}
                          </span>
                        )}
                        {treino.intensidade && (
                          <Badge variant="outline" className="text-[9px] py-0 h-4">
                            {treino.intensidade}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-foreground">{stats?.thisWeek || 0}/{weeklyTarget}</span>
                      <p className="text-[9px] text-muted-foreground">esta semana</p>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </button>

                  {/* Weekly progress bar */}
                  <div className="px-4 pb-2">
                    <Progress value={weekProgress} className="h-1.5" />
                  </div>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="border-t border-border">
                      {/* Exercises */}
                      <div className="p-4 space-y-2">
                        {exs.map((ex, i) => {
                          // GIF da Biblioteca de Treinos anima sozinho; senão, imagem por convenção.
                          const imgUrl = ex.gif_url || `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/exercise-images/exercises/${ex.id}.png`;
                          return (
                          <div key={ex.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/30">
                            <div className="h-14 w-14 rounded-xl bg-muted/50 flex items-center justify-center shrink-0 mt-0.5 overflow-hidden border border-border">
                              <img
                                src={imgUrl}
                                alt={ex.nome_customizado || 'Exercício'}
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  // Fallback to number circle
                                  const target = e.currentTarget;
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  if (parent) {
                                    parent.innerHTML = `<span class="text-sm font-black text-primary">${i + 1}</span>`;
                                    parent.classList.add('bg-primary/10');
                                  }
                                }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-foreground">{ex.nome_customizado || 'Exercício'}</p>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
                                {ex.series && <span>{ex.series} séries</span>}
                                {ex.repeticoes && <span>{ex.repeticoes} reps</span>}
                                {ex.carga_kg != null && ex.carga_kg > 0 && <span>{ex.carga_kg}kg</span>}
                                {ex.descanso_segundos && <span>{ex.descanso_segundos}s desc.</span>}
                                {ex.cadencia && <span>Cad: {ex.cadencia}</span>}
                              </div>
                              {ex.metodo && (
                                <Badge variant="outline" className="text-[9px] mt-1 py-0 h-4">{ex.metodo}</Badge>
                              )}
                              {ex.orientacoes && (
                                <p className="text-[10px] text-muted-foreground mt-1 italic">💡 {ex.orientacoes}</p>
                              )}
                              {ex.grupo_muscular && (
                                <span className="text-[9px] text-muted-foreground/70 block mt-0.5">{ex.grupo_muscular}</span>
                              )}
                            </div>
                            {ex.video_url && (
                              <button onClick={() => setVideoUrl(ex.video_url)} title="Ver vídeo"
                                className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 self-center">
                                <Play className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          );
                        })}
                      </div>

                      {/* Start session button */}
                      {!activeSession && (
                        <div className="p-4 pt-0">
                          <Button
                            className="w-full font-bold gap-2"
                            onClick={() => handleStartSession(treino.id)}
                          >
                            <Play className="h-4 w-4" />
                            Iniciar Treino
                          </Button>
                        </div>
                      )}

                      {/* Recent history */}
                      {execucoes.filter(e => e.treino_id === treino.id).slice(0, 3).length > 0 && (
                        <div className="p-4 pt-0">
                          <p className="text-[10px] font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">Últimas execuções</p>
                          {execucoes.filter(e => e.treino_id === treino.id).slice(0, 3).map(ex => (
                            <div key={ex.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                              <span className="text-[11px] text-foreground">
                                {ex.data_execucao
                                  ? isToday(parseISO(ex.data_execucao))
                                    ? 'Hoje'
                                    : format(parseISO(ex.data_execucao), "d MMM", { locale: ptBR })
                                  : '—'}
                              </span>
                              <div className="flex items-center gap-2 text-[10px]">
                                {ex.nota_dor != null && (
                                  <span className={ex.nota_dor > 5 ? 'text-red-500 font-bold' : 'text-muted-foreground'}>
                                    Dor: {ex.nota_dor}/10
                                  </span>
                                )}
                                {ex.completo && <Check className="h-3 w-3 text-emerald-600" />}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Empty state */}
          {treinos.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Dumbbell className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum treino prescrito</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Quando seu profissional publicar treinos, eles aparecerão aqui.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Player de vídeo do exercício */}
        <Dialog open={!!videoUrl} onOpenChange={(o) => { if (!o) setVideoUrl(null); }}>
          <DialogContent className="max-w-lg p-0 overflow-hidden bg-black border-0">
            {videoUrl && (() => {
              const v = resolverVideo(videoUrl);
              return (
                <div className="relative w-full aspect-video bg-black">
                  {v.tipo === 'iframe' ? (
                    <iframe
                      src={v.src}
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Vídeo do exercício"
                    />
                  ) : (
                    <video src={v.src} controls autoPlay playsInline className="absolute inset-0 w-full h-full" />
                  )}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
