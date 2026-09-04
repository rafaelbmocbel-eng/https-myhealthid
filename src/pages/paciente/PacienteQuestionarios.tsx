import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import PortalSemVinculoCard from '@/components/paciente/PortalSemVinculoCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, CheckCircle2, Clock, ChevronRight, ArrowLeft, Loader2, Eye, RefreshCw, Save, Sparkles, Mic } from 'lucide-react';
import { MyIDWizard } from '@/components/myid/MyIDWizard';
import { MyIDResult } from '@/components/myid/MyIDResult';
import HistoricoClinicoCard from '@/components/paciente/HistoricoClinicoCard';
import QuestionariosClinicosSection from '@/components/paciente/QuestionariosClinicosSection';
import EvolucaoAoVivoResultado from '@/components/paciente/EvolucaoAoVivoResultado';
import { format, parseISO, differenceInDays } from '@/lib/dateSafe';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';

interface QuestionarioItem {
  id: string;
  token_acesso: string;
  status: string;
  created_at: string;
  updated_at: string;
  respostas_brutas: any;
  resultado_processado: any;
  paciente_id: string;
  terapeuta_id: string;
}

type ViewMode = 'list' | 'answering' | 'viewing';

// ?foco=historico → só o Histórico Clínico (sem o resultado do MyID, que já tem
// lugar próprio no Início); ?foco=plano → só os questionários do plano
// personalizado (Treino personalizado). Sem foco → a página é do MyID.
type Foco = 'historico' | 'plano' | null;

export default function PacienteQuestionarios() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const focoParam = new URLSearchParams(location.search).get('foco');
  const foco: Foco = focoParam === 'historico' || focoParam === 'plano' ? focoParam : null;
  const [questionarios, setQuestionarios] = useState<QuestionarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  // Entrou na view de resultado direto do Início (?ver=ultimo)? Então "Voltar"
  // volta pro Início, não para a lista de questionários (que confunde).
  const [veioDoInicio, setVeioDoInicio] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [creatingRetake, setCreatingRetake] = useState(false);
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [terapeutaId, setTerapeutaId] = useState<string | null>(null);

  const fetchQuestionarios = async () => {
    if (!user) return;

    const { data: pac } = await supabase
      .from('pacientes')
      .select('id, terapeuta_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!pac) { setLoading(false); return; }
    setPacienteId(pac.id);
    setTerapeutaId(pac.terapeuta_id);

    const { data } = await supabase
      .from('myid_avaliacoes')
      .select('id, token_acesso, status, created_at, updated_at, respostas_brutas, resultado_processado, paciente_id, terapeuta_id')
      .eq('paciente_id', pac.id)
      .order('created_at', { ascending: false });

    setQuestionarios(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchQuestionarios(); }, [user]);

  // ?ver=ultimo — atalho do Início ("Ver meu resultado completo"): abre direto
  // o resultado da avaliação concluída mais recente, sem caçar o botão "Ver".
  useEffect(() => {
    if (loading || viewMode !== 'list') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('ver') !== 'ultimo') return;
    const ultimo = questionarios.find(q => q.status === 'concluido');
    if (ultimo) {
      setActiveId(ultimo.id);
      setViewMode('viewing');
      setVeioDoInicio(true); // veio do Início ("Ver meu resultado completo")
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, questionarios]);

  // Auto-save progress
  const handleSaveProgress = async (data: any, step: number) => {
    if (!activeId) return;
    try {
      const { error } = await supabase.from('myid_avaliacoes').update({
        respostas_brutas: { ...data, _savedStep: step },
        status: 'em_andamento',
        updated_at: new Date().toISOString(),
      }).eq('id', activeId);
      if (error) throw error;
      toast({ title: '💾 Progresso salvo', description: 'Você pode continuar depois.', duration: 2000 });
    } catch (err) {
      // Antes o toast de sucesso aparecia mesmo em falha (o update não lança, só
      // retorna {error}) — o cliente achava que pausou salvo e perdia respostas.
      console.warn('Erro ao salvar progresso:', err);
      toast({ title: 'Não consegui salvar seu progresso agora', description: 'Sua conexão pode ter caído — tente pausar de novo em instantes.', variant: 'destructive', duration: 3500 });
    }
  };

  const handleComplete = async (result: any, rawData: any) => {
    if (!activeId) return;
    setSubmitting(true);

    // Fecha o wizard e volta para a lista. Só é chamado quando a avaliação
    // foi de fato persistida — numa falha dura mantemos o wizard aberto para
    // o paciente poder tentar de novo sem redigitar.
    const encerrarComSucesso = () => {
      setActiveId(null);
      setViewMode('list');
      fetchQuestionarios();
    };

    try {
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/complete-myid`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey,
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || anonKey}`,
          },
          body: JSON.stringify({
            avaliacao_id: activeId,
            result,
            raw_data: rawData,
          }),
        }
      );

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Erro ao processar avaliação');

      toast({ title: 'Concluído! ✅', description: 'Sua avaliação foi enviada e sincronizada.' });
      encerrarComSucesso();
    } catch (err: any) {
      // Fallback: grava direto na tabela se a edge function falhar. Mas se o
      // fallback também falhar, NÃO podemos mostrar "concluído" — o paciente
      // perderia as respostas sem saber.
      console.error('[complete-myid] edge function falhou, tentando fallback direto:', err);
      const { error: fbErr } = await supabase.from('myid_avaliacoes').update({
        status: 'concluido',
        respostas_brutas: rawData,
        resultado_processado: result,
        updated_at: new Date().toISOString(),
      }).eq('id', activeId);
      if (fbErr) {
        console.error('[complete-myid] fallback direto falhou:', fbErr);
        toast({
          title: 'Não foi possível enviar',
          description: 'Verifique sua conexão e tente novamente — suas respostas não foram perdidas.',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Concluído! ✅', description: 'Sua avaliação foi enviada ao profissional.' });
      encerrarComSucesso();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestRetake = async () => {
    if (!pacienteId) return;
    setCreatingRetake(true);

    try {
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-myid-retake`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey,
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || anonKey}`,
          },
          body: JSON.stringify({
            paciente_id: pacienteId,
          }),
        }
      );

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Erro ao criar questionário');
      }

      toast({ title: '📋 Questionário criado!', description: 'Você já pode respondê-lo.' });
      fetchQuestionarios();
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setCreatingRetake(false);
    }
  };

  // ── View: Answering wizard ──
  if (viewMode === 'answering' && activeId) {
    const item = questionarios.find(q => q.id === activeId);
    const savedStep = item?.respostas_brutas?._savedStep;
    return (
      <ProtectedPatientRoute>
        <PacienteLayout hideVoltar>
          <div className="p-4 md:p-6 max-w-4xl mx-auto">
            <button
              onClick={() => { setActiveId(null); setViewMode('list'); }}
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground mb-4 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <MyIDWizard
              onComplete={handleComplete}
              onSaveProgress={handleSaveProgress}
              initialData={item?.respostas_brutas || {}}
              initialStep={savedStep || 0}
              draftKey={`myid-wizard:${activeId}`}
            />
            {submitting && (
              <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
                <div className="flex flex-col items-center gap-3 bg-card p-6 rounded-2xl shadow-xl border">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium text-foreground">Processando sua avaliação...</p>
                </div>
              </div>
            )}
          </div>
        </PacienteLayout>
      </ProtectedPatientRoute>
    );
  }

  // ── View: Viewing results ──
  if (viewMode === 'viewing' && activeId) {
    const item = questionarios.find(q => q.id === activeId);
    return (
      <ProtectedPatientRoute>
        <PacienteLayout hideVoltar>
          <div className="p-4 md:p-6 max-w-4xl mx-auto">
            <button
              onClick={() => {
                if (veioDoInicio) { navigate('/paciente/dashboard'); return; }
                setActiveId(null); setViewMode('list');
              }}
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground mb-4 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> {veioDoInicio ? 'Voltar ao início' : 'Voltar aos questionários'}
            </button>
            {item?.resultado_processado ? (
              <div className="bg-card p-4 md:p-6 rounded-xl border shadow-sm">
                {/* Camada viva: reflete a Jornada do cliente acima do resultado */}
                <EvolucaoAoVivoResultado pacienteId={item.paciente_id} />
                <MyIDResult
                  result={item.resultado_processado}
                  rawData={item.respostas_brutas}
                  pacienteId={item.paciente_id}
                  terapeutaId={item.terapeuta_id}
                  avaliacaoId={item.id}
                />
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-sm text-muted-foreground">Resultado não disponível para esta avaliação.</p>
                </CardContent>
              </Card>
            )}

            {/* Próximo passo após o MyID: completar o perfil com o histórico clínico
                (é o que monta o avatar). Momento de maior ativação do fluxo. */}
            {item?.resultado_processado && (
              <button
                onClick={() => { setActiveId(null); setViewMode('list'); navigate('/paciente/questionarios?foco=historico'); }}
                className="w-full mt-3 rounded-xl bg-primary text-primary-foreground p-4 text-left flex items-center gap-3 active:scale-[0.99]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">Complete seu perfil de saúde</p>
                  <p className="text-xs opacity-90">Conte doenças, cirurgias e traumas que já teve — é o que monta seu avatar clínico.</p>
                </div>
                <span className="text-lg shrink-0">→</span>
              </button>
            )}
          </div>
        </PacienteLayout>
      </ProtectedPatientRoute>
    );
  }

  // ── View: Histórico clínico (só o card de perguntas — o resultado do MyID
  // tem lugar próprio no Início e em "Ver meu resultado completo") ──
  if (foco === 'historico') {
    return (
      <ProtectedPatientRoute>
        <PacienteLayout>
          <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
            <h1 className="h-page">Histórico clínico</h1>
            <p className="text-xs text-muted-foreground -mt-3">
              Fraturas, cirurgias, medicações e condições — vira achados clínicos para o seu Avatar.
            </p>

            {/* Contar sua história (História da Doença Atual, com áudio) — mora
                aqui, junto do histórico clínico */}
            <Card className="overflow-hidden">
              <button onClick={() => navigate('/paciente/historia')} className="w-full text-left p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Mic className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">Contar sua história</p>
                  <p className="text-[11px] text-muted-foreground">
                    Fale (áudio) ou escreva como você está — sua queixa, quando começou e o que muda. Seu profissional recebe tudo.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </Card>

            <HistoricoClinicoCard />
          </div>
        </PacienteLayout>
      </ProtectedPatientRoute>
    );
  }

  // ── View: Treino personalizado (pago) — questionários que montam o plano ──
  if (foco === 'plano') {
    return (
      <ProtectedPatientRoute>
        <PacienteLayout>
          <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
            <h1 className="h-page">Treino personalizado</h1>
            <p className="text-xs text-muted-foreground -mt-3">
              Monte seu plano nutricional, seu treino e tratamento personalizado — estes
              questionários calibram tudo com base no seu MyID.
            </p>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : pacienteId ? (
              <>
                {/* Questionários específicos que calibram o plano */}
                <QuestionariosClinicosSection pacienteId={pacienteId} />

                {/* O plano em si (treino IA + personal + nutrição) agora vive em
                    um único lugar: a aba "Plano de tratamento". Aqui ficam só os
                    questionários que o calibram, com um atalho para vê-lo. */}
                <button
                  onClick={() => navigate('/paciente/exercicios')}
                  className="w-full rounded-xl border border-dashed p-6 text-center hover:bg-muted/40 transition-colors"
                >
                  <p className="text-sm font-bold text-foreground">Ver meu plano de tratamento</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Seu treino, nutrição e tratamento personalizado ficam lá — já calibrados por estes questionários.
                  </p>
                </button>

                {!terapeutaId && (
                  <button
                    onClick={() => navigate('/paciente/profissionais')}
                    className="w-full text-[11px] font-medium text-primary hover:underline"
                  >
                    Quer um plano acompanhado por um profissional? Conecte-se a um →
                  </button>
                )}
              </>
            ) : <PortalSemVinculoCard recurso="seu plano de tratamento" />}
          </div>
        </PacienteLayout>
      </ProtectedPatientRoute>
    );
  }

  // ── View: List (MyID) ──
  const pendentes = questionarios.filter(q => q.status !== 'concluido');
  const concluidos = questionarios.filter(q => q.status === 'concluido');
  const hasPending = pendentes.length > 0;

  if (!loading && !pacienteId) {
    return (
      <ProtectedPatientRoute>
        <PacienteLayout>
          <PortalSemVinculoCard recurso="os questionários" />
        </PacienteLayout>
      </ProtectedPatientRoute>
    );
  }

  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
          <h1 className="h-page">Questionários</h1>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : questionarios.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <div>
                  <p className="text-sm font-medium text-foreground">Questionário MyID</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Descubra seu perfil de saúde respondendo o questionário por etapas. São 6 blocos curtos — você pode pausar e continuar quando quiser.
                  </p>
                </div>
                <Button
                  onClick={handleRequestRetake}
                  disabled={creatingRetake || !pacienteId}
                  className="gap-2"
                >
                  {creatingRetake ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                  Iniciar MyID
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {pendentes.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-sm font-bold text-foreground">Pendentes</h2>
                  {pendentes.map((q) => (
                    <Card key={q.id} className="border-primary/20 bg-primary/5">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Clock className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">Questionário MyID</p>
                          <p className="text-[11px] text-muted-foreground">
                            Enviado em {format(parseISO(q.created_at), "d 'de' MMM, yyyy", { locale: ptBR })}
                          </p>
                          {q.respostas_brutas?._savedStep && (
                            <p className="text-[10px] text-primary font-semibold mt-0.5 flex items-center gap-1">
                              <Save className="h-3 w-3" />
                              Progresso salvo (Bloco {q.respostas_brutas._savedStep}/6)
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          className="text-xs font-bold gap-1"
                          onClick={() => {
                            setActiveId(q.id);
                            setViewMode('answering');
                            if (q.status === 'pendente') {
                              // não bloqueia a UX, mas registra falha (antes era
                              // fire-and-forget e o status ficava dessincronizado em silêncio)
                              void supabase.from('myid_avaliacoes')
                                .update({ status: 'em_andamento' }).eq('id', q.id)
                                .then(({ error }) => {
                                  if (error) console.warn('[questionarios] falha ao marcar em_andamento:', error.message);
                                });
                            }
                          }}
                        >
                          {q.status === 'em_andamento' ? 'Continuar' : 'Responder'}
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {concluidos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-foreground">Concluídos ({concluidos.length} avaliação{concluidos.length !== 1 ? 'ões' : ''})</h2>
                    {!hasPending && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1"
                        onClick={handleRequestRetake}
                        disabled={creatingRetake}
                      >
                        {creatingRetake ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        Nova avaliação
                      </Button>
                    )}
                  </div>
                  {concluidos.map((q, idx) => {
                    const sessionNumber = concluidos.length - idx;
                    return (
                    <Card key={q.id} className={idx === 0 ? 'border-green-200' : ''}>
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            Sessão #{sessionNumber}
                            {idx === 0 && <span className="text-[10px] text-green-600 ml-1">(mais recente)</span>}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Respondido em {format(parseISO(q.updated_at), "d 'de' MMM, yyyy", { locale: ptBR })}
                          </p>
                          {q.resultado_processado && (
                            <p className="text-[10px] text-primary font-semibold mt-0.5">
                              Score: {(q.resultado_processado as any)?.MyID_score?.toFixed(1) || (q.resultado_processado as any)?.myidScore?.toFixed(1) || '—'}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {q.resultado_processado && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs gap-1 text-primary"
                              onClick={() => {
                                setActiveId(q.id);
                                setViewMode('viewing');
                              }}
                            >
                              <Eye className="icon-sm" />
                              Ver
                            </Button>
                          )}
                          <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50 text-[10px]">
                            #{sessionNumber}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Cada coisa no seu lugar: aqui é a página do MyID. Histórico e
              Treino personalizado têm views próprias (?foco=) — só atalhos. */}
          <div className="space-y-2">
            <button
              onClick={() => navigate('/paciente/questionarios?foco=historico')}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:bg-muted/40 text-left transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <ClipboardList className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Histórico clínico</p>
                <p className="text-[11px] text-muted-foreground">Fraturas, cirurgias, medicações e condições</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
            <button
              onClick={() => navigate('/paciente/questionarios?foco=plano')}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:bg-muted/40 text-left transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0">
                <ClipboardList className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Treino personalizado</p>
                <p className="text-[11px] text-muted-foreground">Questionários que montam seu plano nutricional e treino</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </div>
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
