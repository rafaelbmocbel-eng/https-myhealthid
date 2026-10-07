import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import PortalErrorState from '@/components/paciente/PortalErrorState';
import { Loader2, Dumbbell, Salad, Lock, Sparkles, Info, ClipboardList, Check } from 'lucide-react';
import PlanoTreinoInterativo from '@/components/paciente/PlanoTreinoInterativo';
import TriagemSegurancaCard from '@/components/planos/TriagemSegurancaCard';
import SeloGovernanca from '@/components/planos/SeloGovernanca';
import ResumoAcompanhamento from '@/components/planos/ResumoAcompanhamento';
import { lerGovernanca, lerTriagemSalva, triagemCompleta } from '@/lib/governanca';

// Seção reutilizável do plano personalizado (treino IA + personal + nutrição).
// Mora dentro de "Treino personalizado" (/paciente/questionarios?foco=plano) —
// o único lugar correto. Sem wrapper de layout (o pai fornece).
export function PlanoPersonalizadoSection() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [erroCarregar, setErroCarregar] = useState(false);
  const [treino, setTreino] = useState<any>(null);
  const [dieta, setDieta] = useState<any>(null);
  const [diretrizes, setDiretrizes] = useState<any[]>([]);
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [triagemCompletaOk, setTriagemCompletaOk] = useState<boolean | null>(null);

  // O plano é sempre criado, editado e LIBERADO pelo profissional; o cliente só vê
  // o que foi liberado (por RPC, que já tira da resposta a revisão e a justificativa).
  const carregar = async (pid: string) => {
    const [t, d, dir, anam] = await Promise.all([
      (supabase as any).rpc('meu_plano_liberado', { p_tipo: 'treino' }),
      (supabase as any).rpc('meu_plano_liberado', { p_tipo: 'nutricao' }),
      // RLS só entrega o que o profissional enviou ao portal — todas as áreas
      (supabase as any).from('diretrizes_profissionais').select('titulo, area, conteudo, updated_at')
        .eq('paciente_id', pid).eq('enviada_portal', true)
        .order('updated_at', { ascending: false }),
      (supabase as any).from('nutricao_anamnese').select('respostas').eq('paciente_id', pid).maybeSingle(),
    ]);
    const falha = [t, d, dir].find(r => r.error);
    if (falha) throw falha.error;
    // Falha ao ler a anamnese não derruba a tela: a triagem fica "desconhecida" e o card aparece aberto.
    setTriagemCompletaOk(anam.error ? null : triagemCompleta(lerTriagemSalva(anam.data?.respostas).respostas));
    setTreino(t.data || null);
    setDieta(d.data || null);
    setDiretrizes(dir.data || []);
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

  if (loading) {
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

            {/* A triagem de segurança do cliente ajuda o profissional a montar o plano. */}
            {pacienteId && (
              <TriagemSegurancaCard
                pacienteId={pacienteId}
                defaultAberto={triagemCompletaOk !== true}
                onSalvo={() => setTriagemCompletaOk(true)}
              />
            )}

            {/* Planos agrupados por ÁREA, cada um com seu cabeçalho. Cada seção
                só aparece se tiver conteúdo liberado/gerado. */}
            {(() => {
              const usadas = new Set<string>();
              const dirDe = (areas: string[]) => {
                const list = diretrizes.filter((d: any) => areas.includes(d.area));
                list.forEach((d: any) => usadas.add(d.area));
                return list;
              };
              const reab = dirDe(['fisioterapia', 'reabilitacao', 'fisio']);
              const personalDir = dirDe(['educacao_fisica']);
              const nutriDir = dirDe(['nutricao']);
              const psiDir = dirDe(['psicologia']);
              const medDir = dirDe(['medicina']);
              const odontoDir = dirDe(['odontologia']);
              const outrasDir = diretrizes.filter((d: any) => !usadas.has(d.area));

              const temPersonal = personalDir.length > 0 || !!treino;
              const temNutri = nutriDir.length > 0 || !!dieta;
              const vazio = !reab.length && !temPersonal && !temNutri && !psiDir.length && !medDir.length && !odontoDir.length && !outrasDir.length;

              const mapDir = (list: any[]) => list.map((d, i) => <DiretrizProfissionalView key={i} diretriz={d} />);

              return (
                <>
                  {reab.length > 0 && <SecaoPlano titulo="🦴 Reabilitação">{mapDir(reab)}</SecaoPlano>}

                  {temPersonal && (
                    <SecaoPlano titulo="🏋️ Personal (treino)">
                      {mapDir(personalDir)}
                      {treino && pacienteId && (
                        <>
                          <SeloGovernanca conteudo={treino.conteudo} origem="profissional" visao="paciente" aprovado />
                          <PlanoTreinoInterativo
                            pacienteId={pacienteId}
                            titulo={treino.titulo}
                            conteudo={treino.conteudo}
                          />
                          <ResumoAcompanhamento conteudo={treino.conteudo} aprovacaoEm={lerGovernanca(treino.conteudo)?.aprovacao?.em} />
                        </>
                      )}
                    </SecaoPlano>
                  )}

                  {temNutri && (
                    <SecaoPlano titulo="🥗 Nutricional">
                      {mapDir(nutriDir)}
                      {dieta && (
                        <>
                          <SeloGovernanca conteudo={dieta.conteudo} origem="profissional" visao="paciente" aprovado />
                          <PlanoDietaView dieta={{ titulo: dieta.titulo, plano: dieta.conteudo, calorias_alvo: dieta.calorias_alvo }} />
                          <ResumoAcompanhamento conteudo={dieta.conteudo} aprovacaoEm={lerGovernanca(dieta.conteudo)?.aprovacao?.em} />
                        </>
                      )}
                    </SecaoPlano>
                  )}

                  {psiDir.length > 0 && <SecaoPlano titulo="🧠 Psicológico">{mapDir(psiDir)}</SecaoPlano>}
                  {medDir.length > 0 && <SecaoPlano titulo="🩺 Médico">{mapDir(medDir)}</SecaoPlano>}
                  {odontoDir.length > 0 && <SecaoPlano titulo="🦷 Odontológico">{mapDir(odontoDir)}</SecaoPlano>}
                  {outrasDir.length > 0 && <SecaoPlano titulo="📋 Outros planos">{mapDir(outrasDir)}</SecaoPlano>}

                  {vazio && (
                    <Card><CardContent className="p-8 text-center">
                      <Sparkles className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">Nenhum plano ainda</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Seu profissional monta seu plano sob medida — ele aparece aqui assim que for liberado.
                      </p>
                    </CardContent></Card>
                  )}
                </>
              );
            })()}

    </div>
  );
}

// Cabeçalho de seção por área na aba "Plano de tratamento".
function SecaoPlano({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-black text-foreground/80 pt-1">{titulo}</h2>
      {children}
    </div>
  );
}

// Rota antiga /paciente/plano-ia → o plano agora vive na aba unificada
// "Plano de tratamento" (/paciente/exercicios). Redireciona para lá.
export default function PacientePlanoIA() {
  return <Navigate to="/paciente/exercicios" replace />;
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
        <SeloGovernanca conteudo={est} aprovado={ia ? undefined : true} origem={ia ? 'cliente' : 'profissional'} visao="paciente" compacto />
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
        <SeloGovernanca conteudo={plano} aprovado={ia ? undefined : true} origem={ia ? 'cliente' : 'profissional'} visao="paciente" compacto />
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

