import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWellnessAccess } from '@/hooks/useWellnessAccess';
import PortalErrorState from '@/components/paciente/PortalErrorState';
import { Loader2, Dumbbell, Salad, Lock, Sparkles, ChevronRight, Info, ClipboardList, Check, Wand2, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { erroDaFuncao } from '@/lib/fnError';
import PlanoTreinoInterativo from '@/components/paciente/PlanoTreinoInterativo';
import { INSTRUMENTOS, CLASSIFICACAO_LABEL } from '@/lib/instrumentosClinicos';

// Seção reutilizável do plano personalizado (treino IA + personal + nutrição).
// Mora dentro de "Treino personalizado" (/paciente/questionarios?foco=plano) —
// o único lugar correto. Sem wrapper de layout (o pai fornece).
export function PlanoPersonalizadoSection() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { isFree, isPremium, isInTrial, isLoading: acLoading } = useWellnessAccess();
  const [loading, setLoading] = useState(true);
  const [erroCarregar, setErroCarregar] = useState(false);
  const [treino, setTreino] = useState<any>(null);
  const [dieta, setDieta] = useState<any>(null);
  const [diretrizes, setDiretrizes] = useState<any[]>([]);
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  // Planos gerados pela IA para o próprio cliente (premium)
  const [treinoIA, setTreinoIA] = useState<any>(null);
  const [dietaIA, setDietaIA] = useState<any>(null);
  const [gerando, setGerando] = useState<'' | 'treino' | 'nutricao' | 'tudo'>('');

  // VER o que o profissional montou: liberado para todo cliente (inclusive o
  // clínico). GERAR o próprio plano com IA: só Premium ou período de teste — o
  // cliente clínico NÃO gera sozinho (paga o Premium ou o profissional monta).
  const podeGerar = isPremium || isInTrial;

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

  const carregarTudo = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setErroCarregar(false);
    try {
      const { data: pac, error: pacErr } = await supabase.from('pacientes').select('id').eq('user_id', user.id).maybeSingle();
      if (pacErr) throw pacErr;
      if (!pac) { setLoading(false); return; }
      setPacienteId(pac.id);
      await carregar(pac.id);
    } catch (e) {
      console.error('[PlanoIA] carregar error:', e);
      setErroCarregar(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Gera o plano do cliente (treino e/ou nutrição) a partir do MyID +
  // questionários + anamnese. Usa as MESMAS funções de IA do profissional
  // (que aceitam paciente_id) e persiste em planos_ia_cliente.
  const gerarPlano = async (alvo: 'treino' | 'nutricao' | 'tudo', incomodo?: string) => {
    if (!pacienteId) return;
    // Trava do cliente: gerar o próprio plano é Premium/teste. Sem isso, leva ao Premium.
    if (!podeGerar) { navigate('/paciente/plano'); return; }
    setGerando(alvo);
    try {
      const [{ data: anamRow }, { data: questRows }] = await Promise.all([
        (supabase as any).from('nutricao_anamnese').select('respostas').eq('paciente_id', pacienteId).maybeSingle(),
        (supabase as any).from('questionarios_clinicos')
          .select('instrumento, classificacao, created_at').eq('paciente_id', pacienteId)
          .order('created_at', { ascending: false }),
      ]);
      const r = (anamRow?.respostas || {}) as Record<string, string>;
      const objetivo = (r.objetivo || '').trim() || 'Saúde geral, alívio de dor e mais energia no dia a dia';

      // Perfil individual que embasou o treino — guardado JUNTO do plano para
      // deixar claro (inclusive na página pública) que é feito dos SEUS
      // questionários, não genérico.
      const ultQuest = new Map<string, any>();
      ((questRows as any[]) || []).forEach((q) => { if (!ultQuest.has(q.instrumento)) ultQuest.set(q.instrumento, q); });
      const baseadoEm = {
        objetivo,
        questionarios: [...ultQuest.values()].map((q: any) => ({
          sigla: (INSTRUMENTOS[q.instrumento as keyof typeof INSTRUMENTOS]?.sigla) || String(q.instrumento).toUpperCase(),
          nome: INSTRUMENTOS[q.instrumento as keyof typeof INSTRUMENTOS]?.nome,
          classificacao: CLASSIFICACAO_LABEL[q.classificacao] || q.classificacao,
        })),
      };

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
            { paciente_id: pacienteId, tipo: 'treino', titulo: plano.titulo || 'Meu treino personalizado', conteudo: { ...plano, baseadoEm } },
            { onConflict: 'paciente_id,tipo' });
        }
      }

      if (alvo === 'nutricao' || alvo === 'tudo') {
        const peso = Number(r.peso_kg) || null;
        const altura = Number(r.altura_cm) || null;
        const imc = peso && altura ? +(peso / ((altura / 100) ** 2)).toFixed(1) : null;
        const res = await supabase.functions.invoke('gerar-plano-alimentar', {
          body: {
            paciente_id: pacienteId, objetivo,
            refeicoes_por_dia: Number(r.refeicoes_por_dia) || 5,
            restricoes: r.restricoes_alergias || '',
            preferencias: r.preferencias || '',
            // Dados que calculam calorias/macros (TMB/TDEE)
            antropometria: (peso || altura) ? { peso_kg: peso, altura_cm: altura, imc } : null,
            idade: r.idade ? Number(r.idade) : undefined,
            sexo: r.sexo || undefined,
            nivel_atividade: r.nivel_atividade || undefined,
          },
        });
        if (res.error) throw await erroDaFuncao(res.error);
        const plano = (res.data as any)?.plano;
        if (plano) {
          await (supabase as any).from('planos_ia_cliente').upsert(
            { paciente_id: pacienteId, tipo: 'nutricao', titulo: plano.titulo || 'Meu plano alimentar personalizado', conteudo: plano },
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
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (erroCarregar) {
    return <PortalErrorState onRetry={() => carregarTudo()} mensagem="Não consegui carregar seu plano. Verifique sua internet e tente de novo." />;
  }

  return (
    <div className="space-y-4">
            {/* Disclaimer de segurança */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 border border-border/40">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground">
                Estes planos são uma <strong>sugestão de apoio personalizada</strong> a partir do seu MyID, questionários e exames — <strong>não substituem</strong> a orientação do seu profissional de saúde. Converse com ele antes de mudanças importantes.
              </p>
            </div>

            {/* A anamnese nutricional agora mora dentro dos "Questionários do
                plano" (QuestionariosClinicosSection), não como card separado. */}

            {/* Gerador de plano do cliente (IA) — só Premium/teste. O cliente
                clínico não gera sozinho: paga o Premium OU o profissional monta. */}
            {podeGerar ? (
              <Card className="border-primary/25">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Wand2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">Montar meu plano personalizado</p>
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
            ) : (
              <Card className="border-0 shadow-md overflow-hidden">
                <div className="p-5 text-center text-white" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)' }}>
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-2">
                    <Wand2 className="h-6 w-6" />
                  </div>
                  <h2 className="text-base font-black">Monte seu treino e nutrição sob medida</h2>
                  <p className="text-xs text-white/85 mt-1 max-w-sm mx-auto">
                    Criar seu próprio plano personalizado faz parte do <strong>Premium</strong>. Você continua vendo tudo o que seu profissional montar para você aqui.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center mt-3">
                    <Button variant="secondary" className="gap-1.5 bg-white text-primary hover:bg-white/90 border-0"
                      onClick={() => navigate('/paciente/plano')}>
                      Assinar o Premium <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="secondary" className="gap-1.5 bg-white/20 hover:bg-white/30 text-white border-0"
                      onClick={() => navigate('/paciente/profissionais')}>
                      Falar com meu profissional
                    </Button>
                  </div>
                </div>
              </Card>
            )}

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
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {podeGerar
                    ? 'Toque em "Gerar treino + nutrição" acima para montar o seu — ou seu profissional pode montar um.'
                    : 'Seu profissional pode montar um plano sob medida para você. Assine o Premium para criar o seu com IA quando quiser.'}
                </p>
              </CardContent></Card>
            )}
    </div>
  );
}

// Rota antiga /paciente/plano-ia → o plano agora vive dentro de "Treino
// personalizado". Redireciona para lá (um único lugar correto).
export default function PacientePlanoIA() {
  return <Navigate to="/paciente/questionarios?foco=plano" replace />;
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

