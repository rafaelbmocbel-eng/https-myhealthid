import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWellnessAccess } from '@/hooks/useWellnessAccess';
import { Loader2, Dumbbell, Salad, Lock, Sparkles, ChevronRight, Info, ClipboardList, Check, Wand2, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { erroDaFuncao } from '@/lib/fnError';
import PlanoTreinoInterativo from '@/components/paciente/PlanoTreinoInterativo';

export default function PacientePlanoIA() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isFree, isInTrial, isLoading: acLoading } = useWellnessAccess();
  const [loading, setLoading] = useState(true);
  const [treino, setTreino] = useState<any>(null);
  const [dieta, setDieta] = useState<any>(null);
  const [diretrizes, setDiretrizes] = useState<any[]>([]);
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  // Planos gerados pela IA para o próprio cliente (premium)
  const [treinoIA, setTreinoIA] = useState<any>(null);
  const [dietaIA, setDietaIA] = useState<any>(null);
  const [gerando, setGerando] = useState<'' | 'treino' | 'nutricao' | 'tudo'>('');

  const bloqueado = isFree && !isInTrial;

  const carregar = async (pid: string) => {
    const [t, d, dir, ia] = await Promise.all([
      supabase.from('planos_treino').select('titulo, objetivo, estrutura, created_at')
        .eq('paciente_id', pid).eq('ativo', true).eq('aprovado', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      (supabase as any).from('planos_alimentares').select('titulo, calorias_alvo, plano, created_at')
        .eq('paciente_id', pid).eq('ativo', true).eq('aprovado', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      // RLS só entrega o que o profissional enviou ao portal — todas as áreas
      (supabase as any).from('diretrizes_profissionais').select('titulo, area, conteudo, updated_at')
        .eq('paciente_id', pid).eq('enviada_portal', true)
        .order('updated_at', { ascending: false }),
      (supabase as any).from('planos_ia_cliente').select('tipo, titulo, conteudo')
        .eq('paciente_id', pid),
    ]);
    setTreino(t.data || null);
    setDieta(d.data || null);
    setDiretrizes(dir.data || []);
    const iaRows = (ia.data || []) as any[];
    setTreinoIA(iaRows.find(r => r.tipo === 'treino') || null);
    setDietaIA(iaRows.find(r => r.tipo === 'nutricao') || null);
  };

  useEffect(() => {
    if (!user || bloqueado) { setLoading(false); return; }
    (async () => {
      const { data: pac } = await supabase.from('pacientes').select('id').eq('user_id', user.id).maybeSingle();
      if (!pac) { setLoading(false); return; }
      setPacienteId(pac.id);
      await carregar(pac.id);
      setLoading(false);
    })();
  }, [user, bloqueado]);

  // Gera o plano do cliente (treino e/ou nutrição) a partir do MyID +
  // questionários + anamnese. Usa as MESMAS funções de IA do profissional
  // (que aceitam paciente_id) e persiste em planos_ia_cliente.
  const gerarPlano = async (alvo: 'treino' | 'nutricao' | 'tudo', incomodo?: string) => {
    if (!pacienteId) return;
    setGerando(alvo);
    try {
      const { data: anamRow } = await (supabase as any).from('nutricao_anamnese')
        .select('respostas').eq('paciente_id', pacienteId).maybeSingle();
      const r = (anamRow?.respostas || {}) as Record<string, string>;
      const objetivo = (r.objetivo || '').trim() || 'Saúde geral, alívio de dor e mais energia no dia a dia';

      if (alvo === 'treino' || alvo === 'tudo') {
        const res = await supabase.functions.invoke('gerar-plano-treino', {
          body: {
            paciente_id: pacienteId, objetivo, nivel: 'iniciante', frequencia_semanal: 3, duracao_semanas: 8,
            // Incômodo relatado pelo cliente → o plano evita/adapta a região
            ...(incomodo ? { restricoes: `IMPORTANTE — incômodo relatado pelo paciente, adapte com cuidado (reduza carga/ADM ou substitua exercícios que sobrecarreguem a região; progrida devagar): ${incomodo}` } : {}),
          },
        });
        if (res.error) throw await erroDaFuncao(res.error);
        const plano = (res.data as any)?.plano;
        if (plano) {
          await (supabase as any).from('planos_ia_cliente').upsert(
            { paciente_id: pacienteId, tipo: 'treino', titulo: plano.titulo || 'Meu treino (IA)', conteudo: plano },
            { onConflict: 'paciente_id,tipo' });
        }
      }

      if (alvo === 'nutricao' || alvo === 'tudo') {
        const res = await supabase.functions.invoke('gerar-plano-alimentar', {
          body: {
            paciente_id: pacienteId, objetivo,
            refeicoes_por_dia: Number(r.refeicoes_por_dia) || 5,
            restricoes: r.restricoes_alergias || '',
            preferencias: r.preferencias || '',
          },
        });
        if (res.error) throw await erroDaFuncao(res.error);
        const plano = (res.data as any)?.plano;
        if (plano) {
          await (supabase as any).from('planos_ia_cliente').upsert(
            { paciente_id: pacienteId, tipo: 'nutricao', titulo: plano.titulo || 'Meu plano alimentar (IA)', conteudo: plano },
            { onConflict: 'paciente_id,tipo' });
        }
      }

      await carregar(pacienteId);
      toast.success(incomodo ? 'Treino adaptado ao seu incômodo! 💪' : 'Plano pronto! 💪 Role a tela para ver.');
    } catch (e: any) {
      toast.error(e?.message || 'Não consegui gerar o plano agora. Tente de novo em instantes.');
    } finally {
      setGerando('');
    }
  };

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

            {/* Perguntas do plano nutricional (anamnese) — alimenta o gerador */}
            {pacienteId && <AnamneseNutricionalCard pacienteId={pacienteId} />}

            {/* Gerador de plano do cliente (IA) — treino + nutrição sob medida */}
            <Card className="border-primary/25">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Wand2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">Montar meu plano com IA</p>
                    <p className="text-[11px] text-muted-foreground">
                      Treino e alimentação sob medida, a partir do seu MyID, questionários e anamnese.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Button variant="outline" className="gap-1.5" disabled={!!gerando}
                    onClick={() => gerarPlano('treino')}>
                    {gerando === 'treino' ? <Loader2 className="h-4 w-4 animate-spin" /> : treinoIA ? <RefreshCw className="h-4 w-4" /> : <Dumbbell className="h-4 w-4" />}
                    {treinoIA ? 'Refazer treino' : 'Gerar treino'}
                  </Button>
                  <Button variant="outline" className="gap-1.5" disabled={!!gerando}
                    onClick={() => gerarPlano('nutricao')}>
                    {gerando === 'nutricao' ? <Loader2 className="h-4 w-4 animate-spin" /> : dietaIA ? <RefreshCw className="h-4 w-4" /> : <Salad className="h-4 w-4" />}
                    {dietaIA ? 'Refazer nutrição' : 'Gerar nutrição'}
                  </Button>
                </div>
                {!treinoIA && !dietaIA && (
                  <Button className="w-full gap-1.5" disabled={!!gerando} onClick={() => gerarPlano('tudo')}>
                    {gerando === 'tudo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    {gerando === 'tudo' ? 'Montando seu plano…' : 'Gerar treino + nutrição'}
                  </Button>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Responda a anamnese acima antes para o plano ficar mais preciso. A geração leva alguns segundos.
                </p>
              </CardContent>
            </Card>

            {/* Diretrizes do profissional (nutrição, treino, ...) */}
            {diretrizes.map((dir, i) => <DiretrizProfissionalView key={i} diretriz={dir} />)}

            {/* Plano de treino — profissional tem prioridade; senão, o da IA
                (interativo: GIFs, como fazer, marcar feito, adaptar por incômodo) */}
            <PlanoTreinoView treino={treino} />
            {!treino && treinoIA && pacienteId && (
              <PlanoTreinoInterativo
                pacienteId={pacienteId}
                titulo={treinoIA.titulo}
                conteudo={treinoIA.conteudo}
                onRegenerarComIncomodo={(nota) => gerarPlano('treino', nota)}
                regenerando={gerando === 'treino'}
              />
            )}

            {/* Plano alimentar */}
            <PlanoDietaView dieta={dieta} />
            {!dieta && dietaIA && <PlanoDietaView dieta={{ titulo: dietaIA.titulo, plano: dietaIA.conteudo, calorias_alvo: dietaIA.conteudo?.calorias_totais }} ia />}

            {!treino && !dieta && !treinoIA && !dietaIA && diretrizes.length === 0 && (
              <Card><CardContent className="p-8 text-center">
                <Sparkles className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum plano ainda</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Toque em "Gerar treino + nutrição" acima para montar o seu — ou seu profissional pode montar um.</p>
              </CardContent></Card>
            )}
          </>
        )}
      </div>
    </PacienteLayout></ProtectedPatientRoute>
  );
}

// Diretriz criada e revisada pelo PROFISSIONAL (por fases, com metas e
// marcadores) — só aparece depois que ele envia ao portal. Uma view para
// todas as áreas; o ícone acompanha a área.
function DiretrizProfissionalView({ diretriz }: { diretriz: any }) {
  if (!diretriz) return null;
  const c = diretriz.conteudo || {};
  const fases: any[] = Array.isArray(c.fases) ? c.fases : [];
  const ehTreino = diretriz.area === 'educacao_fisica';
  const Icone = ehTreino ? Dumbbell : ClipboardList;
  return (
    <Card className={ehTreino ? 'border-primary/30' : 'border-emerald-500/30'}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${ehTreino ? 'bg-primary/10' : 'bg-emerald-500/10'}`}>
            <Icone className={`h-5 w-5 ${ehTreino ? 'text-primary' : 'text-emerald-600'}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{c.titulo || diretriz.titulo || (ehTreino ? 'Diretriz de Treino' : 'Diretriz Nutricional')}</p>
            <p className="text-[11px] text-muted-foreground">Montada e revisada pelo seu profissional</p>
          </div>
        </div>
        {c.objetivo && <p className="text-xs text-foreground">{c.objetivo}</p>}
        {fases.map((f, fi) => (
          <div key={fi} className="rounded-xl border border-border/40 overflow-hidden">
            <div className="px-3 py-2 bg-muted/40 flex items-center justify-between">
              <span className="text-xs font-bold">Fase {f.numero || fi + 1} — {f.titulo}</span>
              {f.duracao_semanas && <span className="text-[10px] text-muted-foreground">{f.duracao_semanas} semanas</span>}
            </div>
            <div className="p-2.5 space-y-2">
              {(Array.isArray(f.metas) ? f.metas : []).map((m: any, mi: number) => (
                <div key={mi} className="flex items-start gap-2 text-[11px]">
                  <span className="shrink-0">🎯</span>
                  <div>
                    <p className="font-medium text-foreground">{m.descricao}</p>
                    {m.como_medir && <p className="text-[10px] text-muted-foreground">Como medir: {m.como_medir}</p>}
                  </div>
                </div>
              ))}
              {(Array.isArray(f.orientacoes) ? f.orientacoes : []).length > 0 && (
                <ul className="list-disc list-inside text-[11px] text-muted-foreground space-y-0.5">
                  {f.orientacoes.map((o: string, oi: number) => <li key={oi}>{o}</li>)}
                </ul>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PlanoTreinoView({ treino, ia }: { treino: any; ia?: boolean }) {
  if (!treino) return null;
  const est = treino.estrutura || {};
  const fases: any[] = Array.isArray(est.fases) ? est.fases : [];
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Dumbbell className="h-5 w-5 text-primary" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate flex items-center gap-1.5">
              {treino.titulo || 'Plano de Treino'}
              {ia && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">IA</span>}
            </p>
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

function PlanoDietaView({ dieta, ia }: { dieta: any; ia?: boolean }) {
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
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate flex items-center gap-1.5">
              {dieta.titulo || 'Plano Alimentar'}
              {ia && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 shrink-0">IA</span>}
            </p>
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

// ─── Anamnese nutricional — perguntas que individualizam o plano alimentar ────
function AnamneseNutricionalCard({ pacienteId }: { pacienteId: string }) {
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [preenchida, setPreenchida] = useState(false);
  const [r, setR] = useState<Record<string, string>>({
    objetivo: '', refeicoes_por_dia: '', restricoes_alergias: '',
    aversoes: '', preferencias: '', rotina: '',
  });

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from('nutricao_anamnese')
        .select('respostas').eq('paciente_id', pacienteId).maybeSingle();
      if (data?.respostas) {
        setR(prev => ({ ...prev, ...data.respostas }));
        setPreenchida(Object.values(data.respostas as Record<string, string>).some(v => String(v || '').trim() !== ''));
      }
    })();
  }, [pacienteId]);

  const salvar = async () => {
    setSalvando(true);
    const { error } = await (supabase as any).from('nutricao_anamnese')
      .upsert({ paciente_id: pacienteId, respostas: r, updated_at: new Date().toISOString() }, { onConflict: 'paciente_id' });
    setSalvando(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    setPreenchida(true);
    setAberto(false);
    toast.success('Respostas salvas! Elas entram no seu próximo plano alimentar.');
  };

  const CAMPOS: { k: string; label: string; ph: string; area?: boolean }[] = [
    { k: 'objetivo', label: 'Qual seu objetivo principal?', ph: 'Ex.: perder gordura, ganhar massa, mais energia…' },
    { k: 'refeicoes_por_dia', label: 'Quantas refeições consegue fazer por dia?', ph: 'Ex.: 4' },
    { k: 'restricoes_alergias', label: 'Restrições ou alergias alimentares', ph: 'Ex.: lactose, glúten, amendoim… (ou "nenhuma")', area: true },
    { k: 'aversoes', label: 'Alimentos que você NÃO gosta', ph: 'Ex.: fígado, quiabo…', area: true },
    { k: 'preferencias', label: 'Alimentos que você adora', ph: 'Ex.: frango, banana, aveia…', area: true },
    { k: 'rotina', label: 'Sua rotina (horários de trabalho/treino/sono)', ph: 'Ex.: trabalho 8h-18h, treino 19h, durmo 23h', area: true },
  ];

  return (
    <Card className="overflow-hidden">
      <button onClick={() => setAberto(v => !v)} className="w-full text-left p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
          {preenchida ? <Check className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">Perguntas do seu plano nutricional</p>
          <p className="text-[11px] text-muted-foreground">
            {preenchida ? 'Respondido — toque para revisar/atualizar.' : 'Responda para o plano ser feito sob medida pra você.'}
          </p>
        </div>
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${aberto ? 'rotate-90' : ''}`} />
      </button>
      {aberto && (
        <CardContent className="pt-0 space-y-3">
          {CAMPOS.map(c => (
            <div key={c.k} className="space-y-1">
              <Label className="text-xs">{c.label}</Label>
              {c.area ? (
                <Textarea rows={2} placeholder={c.ph} value={r[c.k] || ''} onChange={e => setR(prev => ({ ...prev, [c.k]: e.target.value }))} className="text-sm" />
              ) : (
                <Input placeholder={c.ph} value={r[c.k] || ''} onChange={e => setR(prev => ({ ...prev, [c.k]: e.target.value }))} className="text-sm" />
              )}
            </div>
          ))}
          <Button onClick={salvar} disabled={salvando} className="w-full gap-1.5">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Salvar respostas
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
