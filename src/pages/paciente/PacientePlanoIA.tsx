import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWellnessAccess } from '@/hooks/useWellnessAccess';
import { Loader2, Dumbbell, Salad, Lock, Sparkles, ChevronRight, Info } from 'lucide-react';

export default function PacientePlanoIA() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isFree, isInTrial, isLoading: acLoading } = useWellnessAccess();
  const [loading, setLoading] = useState(true);
  const [treino, setTreino] = useState<any>(null);
  const [dieta, setDieta] = useState<any>(null);

  const bloqueado = isFree && !isInTrial;

  useEffect(() => {
    if (!user || bloqueado) { setLoading(false); return; }
    (async () => {
      const { data: pac } = await supabase.from('pacientes').select('id').eq('user_id', user.id).maybeSingle();
      if (!pac) { setLoading(false); return; }
      const [t, d] = await Promise.all([
        supabase.from('planos_treino').select('titulo, objetivo, estrutura, created_at')
          .eq('paciente_id', pac.id).eq('ativo', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        (supabase as any).from('planos_alimentares').select('titulo, calorias_alvo, plano, created_at')
          .eq('paciente_id', pac.id).eq('ativo', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      setTreino(t.data || null);
      setDieta(d.data || null);
      setLoading(false);
    })();
  }, [user, bloqueado]);

  if (acLoading || loading) {
    return (
      <ProtectedPatientRoute><PacienteLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </PacienteLayout></ProtectedPatientRoute>
    );
  }

  return (
    <ProtectedPatientRoute><PacienteLayout>
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
        <div>
          <h1 className="h-page flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Meu Plano</h1>
          <p className="text-xs text-muted-foreground">Treino e alimentação montados com IA a partir da sua avaliação.</p>
        </div>

        {bloqueado ? (
          <Card className="border-0 shadow-md overflow-hidden">
            <div className="p-6 text-center text-white" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)' }}>
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-3">
                <Lock className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-black">Recurso do Premium</h2>
              <p className="text-sm text-white/80 mt-1 max-w-sm mx-auto">
                Plano de treino e plano alimentar personalizados pela IA fazem parte do Wellness Premium.
                No plano gratuito você já tem seus exercícios, dicas e a avaliação MyID.
              </p>
              <Button variant="secondary" className="mt-4 gap-1.5 bg-white/20 hover:bg-white/30 text-white border-0"
                onClick={() => navigate('/paciente/plano')}>
                Conhecer o Premium <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Disclaimer de segurança */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 border border-border/40">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground">
                Estes planos são uma <strong>sugestão de apoio</strong> gerada por IA a partir da sua avaliação — <strong>não substituem</strong> a orientação do seu profissional de saúde. Converse com ele antes de mudanças importantes.
              </p>
            </div>

            {/* Plano de treino */}
            <PlanoTreinoView treino={treino} />

            {/* Plano alimentar */}
            <PlanoDietaView dieta={dieta} />

            {!treino && !dieta && (
              <Card><CardContent className="p-8 text-center">
                <Sparkles className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum plano ainda</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Seu profissional vai gerar seu plano personalizado em breve.</p>
              </CardContent></Card>
            )}
          </>
        )}
      </div>
    </PacienteLayout></ProtectedPatientRoute>
  );
}

function PlanoTreinoView({ treino }: { treino: any }) {
  if (!treino) return null;
  const est = treino.estrutura || {};
  const fases: any[] = Array.isArray(est.fases) ? est.fases : [];
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Dumbbell className="h-5 w-5 text-primary" /></div>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{treino.titulo || 'Plano de Treino'}</p>
            {est.resumo && <p className="text-[11px] text-muted-foreground line-clamp-2">{est.resumo}</p>}
          </div>
        </div>
        {fases.map((f, fi) => (
          <div key={fi} className="rounded-xl border border-border/40 overflow-hidden">
            <div className="px-3 py-2 bg-muted/40 flex items-center justify-between">
              <span className="text-xs font-bold">{f.nome || `Fase ${fi + 1}`}</span>
              {f.semanas && <span className="text-[10px] text-muted-foreground">{f.semanas} semanas</span>}
            </div>
            <div className="p-2.5 space-y-2">
              {(Array.isArray(f.sessoes) ? f.sessoes : []).map((s: any, si: number) => (
                <div key={si}>
                  <p className="text-[11px] font-semibold text-foreground mb-1">{s.nome || `Sessão ${si + 1}`}</p>
                  <div className="space-y-1">
                    {(Array.isArray(s.exercicios) ? s.exercicios : []).map((ex: any, ei: number) => (
                      <div key={ei} className="flex items-center gap-2.5 p-1.5 rounded-lg bg-muted/30">
                        {ex.gif_url
                          ? <img src={ex.gif_url} alt="" className="h-10 w-10 rounded-lg object-cover shrink-0" loading="lazy" />
                          : <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-[10px] font-bold text-primary">{ei + 1}</div>}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium truncate">{ex.nome || 'Exercício'}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {[ex.series && `${ex.series}×${ex.reps ?? ''}`, ex.carga, ex.descanso_s && `${ex.descanso_s}s desc.`].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PlanoDietaView({ dieta }: { dieta: any }) {
  if (!dieta) return null;
  const plano = dieta.plano || {};
  const refeicoes: any[] = Array.isArray(plano.refeicoes) ? plano.refeicoes
    : Array.isArray(plano.meals) ? plano.meals
    : Array.isArray(plano) ? plano : [];
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0"><Salad className="h-5 w-5 text-emerald-600" /></div>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{dieta.titulo || 'Plano Alimentar'}</p>
            {dieta.calorias_alvo && <p className="text-[11px] text-muted-foreground">Meta: ~{dieta.calorias_alvo} kcal/dia</p>}
          </div>
        </div>
        {refeicoes.map((r: any, ri: number) => {
          const itens: any[] = Array.isArray(r.itens) ? r.itens : Array.isArray(r.alimentos) ? r.alimentos : [];
          return (
            <div key={ri} className="rounded-xl border border-border/40 overflow-hidden">
              <div className="px-3 py-2 bg-muted/40 flex items-center justify-between">
                <span className="text-xs font-bold">{r.nome || r.refeicao || `Refeição ${ri + 1}`}</span>
                {(r.horario || r.hora) && <span className="text-[10px] text-muted-foreground">{r.horario || r.hora}</span>}
              </div>
              <div className="p-2.5 space-y-1">
                {itens.map((it: any, ii: number) => (
                  <div key={ii} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-foreground truncate">{it.alimento || it.nome || String(it)}</span>
                    <span className="text-muted-foreground whitespace-nowrap shrink-0">
                      {[it.porcao || it.porção, it.kcal && `${it.kcal} kcal`].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
