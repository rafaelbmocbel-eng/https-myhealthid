import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ClipboardList, CheckCircle2, Clock, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react';
import { MyIDWizard } from '@/components/myid/MyIDWizard';
import { format, parseISO } from 'date-fns';
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
}

export default function PacienteQuestionarios() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [questionarios, setQuestionarios] = useState<QuestionarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const fetchQuestionarios = async () => {
    if (!user) return;

    // Get patient record
    const { data: pac } = await supabase
      .from('pacientes')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!pac) { setLoading(false); return; }

    const { data } = await supabase
      .from('myid_avaliacoes')
      .select('id, token_acesso, status, created_at, updated_at, respostas_brutas, resultado_processado')
      .eq('paciente_id', pac.id)
      .order('created_at', { ascending: false });

    setQuestionarios(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchQuestionarios(); }, [user]);

  const handleComplete = async (result: any, rawData: any) => {
    if (!activeId) return;
    const { error } = await supabase
      .from('myid_avaliacoes')
      .update({
        status: 'concluido',
        respostas_brutas: rawData,
        resultado_processado: result,
        updated_at: new Date().toISOString(),
      })
      .eq('id', activeId);

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Concluído! ✅', description: 'Sua avaliação foi enviada ao profissional.' });
    setActiveId(null);
    fetchQuestionarios();
  };

  // Render wizard if answering
  if (activeId) {
    const item = questionarios.find(q => q.id === activeId);
    return (
      <ProtectedPatientRoute>
        <PacienteLayout>
          <div className="p-4 md:p-6 max-w-4xl mx-auto">
            <button
              onClick={() => setActiveId(null)}
              className="flex items-center gap-1 text-sm font-medium text-muted-foreground mb-4 hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <MyIDWizard
              onComplete={handleComplete}
              initialData={item?.respostas_brutas || {}}
            />
          </div>
        </PacienteLayout>
      </ProtectedPatientRoute>
    );
  }

  const pendentes = questionarios.filter(q => q.status !== 'concluido');
  const concluidos = questionarios.filter(q => q.status === 'concluido');

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
              <CardContent className="p-8 text-center">
                <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Nenhum questionário disponível</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Quando seu profissional enviar um questionário, ele aparecerá aqui.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Pending */}
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
                        </div>
                        <Button
                          size="sm"
                          className="text-xs font-bold gap-1"
                          onClick={() => {
                            // mark as in progress
                            if (q.status === 'pendente') {
                              supabase.from('myid_avaliacoes').update({ status: 'em_andamento' }).eq('id', q.id);
                            }
                            setActiveId(q.id);
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

              {/* Completed */}
              {concluidos.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-sm font-bold text-foreground">Concluídos</h2>
                  {concluidos.map((q) => (
                    <Card key={q.id} className="opacity-80">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">Questionário MyID</p>
                          <p className="text-[11px] text-muted-foreground">
                            Respondido em {format(parseISO(q.updated_at), "d 'de' MMM, yyyy", { locale: ptBR })}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50 text-[10px]">
                          Concluído
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
