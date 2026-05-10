import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, CheckCircle2, Clock, ChevronRight, ArrowLeft, Loader2, Eye, RefreshCw, Save } from 'lucide-react';
import { MyIDWizard } from '@/components/myid/MyIDWizard';
import { MyIDResult } from '@/components/myid/MyIDResult';
import { format, parseISO, differenceInDays } from 'date-fns';
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

export default function PacienteQuestionarios() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [questionarios, setQuestionarios] = useState<QuestionarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
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

  // Auto-save progress
  const handleSaveProgress = async (data: any, step: number) => {
    if (!activeId) return;
    try {
      await supabase.from('myid_avaliacoes').update({
        respostas_brutas: { ...data, _savedStep: step },
        status: 'em_andamento',
        updated_at: new Date().toISOString(),
      }).eq('id', activeId);
      
      toast({ title: '💾 Progresso salvo', description: 'Você pode continuar depois.', duration: 2000 });
    } catch (err) {
      console.warn('Erro ao salvar progresso:', err);
    }
  };

  const handleComplete = async (result: any, rawData: any) => {
    if (!activeId) return;
    setSubmitting(true);

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
    } catch (err: any) {
      await supabase.from('myid_avaliacoes').update({
        status: 'concluido',
        respostas_brutas: rawData,
        resultado_processado: result,
        updated_at: new Date().toISOString(),
      }).eq('id', activeId);
      toast({ title: 'Concluído! ✅', description: 'Sua avaliação foi enviada ao profissional.' });
    } finally {
      setSubmitting(false);
      setActiveId(null);
      setViewMode('list');
      fetchQuestionarios();
    }
  };

  const handleRequestRetake = async () => {
    if (!pacienteId || !terapeutaId) return;
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
            terapeuta_id: terapeutaId,
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
        <PacienteLayout>
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
        <PacienteLayout>
          <div className="p-4 md:p-6 max-w-4xl mx-auto">
            <button
              onClick={() => { setActiveId(null); setViewMode('list'); }}
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground mb-4 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar aos questionários
            </button>
            {item?.resultado_processado ? (
              <div className="bg-card p-4 md:p-6 rounded-xl border shadow-sm">
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
          </div>
        </PacienteLayout>
      </ProtectedPatientRoute>
    );
  }

  // ── View: List ──
  const pendentes = questionarios.filter(q => q.status !== 'concluido');
  const concluidos = questionarios.filter(q => q.status === 'concluido');
  const hasPending = pendentes.length > 0;

  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
          <h1 className="text-lg font-black text-foreground">Questionários</h1>

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
                    Descubra sua Identidade Sistêmica respondendo o questionário por etapas. São 6 blocos curtos — você pode pausar e continuar quando quiser.
                  </p>
                </div>
                {terapeutaId && (
                  <Button
                    onClick={handleRequestRetake}
                    disabled={creatingRetake}
                    className="gap-2"
                  >
                    {creatingRetake ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                    Iniciar MyID
                  </Button>
                )}
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
                            if (q.status === 'pendente') {
                              supabase.from('myid_avaliacoes').update({ status: 'em_andamento' }).eq('id', q.id);
                            }
                            setActiveId(q.id);
                            setViewMode('answering');
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
                    <h2 className="text-sm font-bold text-foreground">Concluídos ({concluidos.length} sessão{concluidos.length !== 1 ? 'ões' : ''})</h2>
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
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
