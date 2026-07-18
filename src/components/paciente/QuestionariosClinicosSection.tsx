import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { ClipboardCheck, ChevronRight, CheckCircle2, Loader2, Lock, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useWellnessAccess } from '@/hooks/useWellnessAccess';
import {
  INSTRUMENTOS, CLASSIFICACAO_LABEL, MOTIVO_RECOMENDACAO,
  instrumentosRecomendados, type InstrumentoId,
} from '@/lib/instrumentosClinicos';
import { scoresDoResultado } from '@/utils/myid/scores';

interface Props { pacienteId: string; }

// Questionários clínicos ADAPTATIVOS (premium): o MyID decide quais aparecem.
// PAR-Q+ e PSFS sempre; SBST/ISI/PHQ-4 só quando a dimensão indica.
export default function QuestionariosClinicosSection({ pacienteId }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isFree, isInTrial } = useWellnessAccess();
  const bloqueado = isFree && !isInTrial;

  const [aberto, setAberto] = useState<InstrumentoId | null>(null);
  const [histAberto, setHistAberto] = useState(false);
  const [respostas, setRespostas] = useState<Record<string, number>>({});
  const [atividades, setAtividades] = useState<{ nome: string; nota: number }[]>([
    { nome: '', nota: 5 }, { nome: '', nota: 5 }, { nome: '', nota: 5 },
  ]);

  const { data } = useQuery({
    queryKey: ['questionarios-clinicos', pacienteId],
    queryFn: async () => {
      const sb = supabase as any;
      const [myid, resp] = await Promise.all([
        sb.from('myid_avaliacoes').select('resultado_processado')
          .eq('paciente_id', pacienteId).eq('status', 'concluido')
          .order('updated_at', { ascending: false }).limit(1).maybeSingle(),
        sb.from('questionarios_clinicos').select('instrumento, escore, classificacao, created_at')
          .eq('paciente_id', pacienteId).order('created_at', { ascending: false }),
      ]);
      const scores = scoresDoResultado(myid.data?.resultado_processado);
      const ultimos = new Map<string, any>();
      (resp.data || []).forEach((r: any) => { if (!ultimos.has(r.instrumento)) ultimos.set(r.instrumento, r); });
      return { scores, ultimos, temMyid: !!scores };
    },
  });

  const salvar = useMutation({
    mutationFn: async (instrumento: InstrumentoId) => {
      const inst = INSTRUMENTOS[instrumento];
      let resp: Record<string, unknown>;
      let notas: Record<string, number>;
      if (inst.atividadesLivres) {
        if (atividades.some(a => !a.nome.trim())) throw new Error('Preencha as 3 atividades');
        notas = { a1: atividades[0].nota, a2: atividades[1].nota, a3: atividades[2].nota };
        resp = { atividades };
      } else {
        const faltam = inst.perguntas.filter(p => respostas[p.id] === undefined);
        if (faltam.length > 0) throw new Error('Responda todas as perguntas');
        // respostas guarda o ÍNDICE da opção; converte para o valor pontuável
        notas = {};
        const rotulos: Record<string, string> = {};
        inst.perguntas.forEach(p => {
          const op = p.opcoes[respostas[p.id]];
          notas[p.id] = op.valor;
          rotulos[p.id] = op.rotulo;
        });
        resp = { valores: notas, rotulos };
      }
      const { escore, classificacao } = inst.pontuar(notas);
      const { error } = await (supabase as any).from('questionarios_clinicos').insert({
        paciente_id: pacienteId, instrumento, respostas: resp, escore, classificacao,
      });
      if (error) throw error;
      return { escore, classificacao };
    },
    onSuccess: (r) => {
      toast.success(`Respondido! ${CLASSIFICACAO_LABEL[r.classificacao] || ''}`);
      setAberto(null);
      setRespostas({});
      setAtividades([{ nome: '', nota: 5 }, { nome: '', nota: 5 }, { nome: '', nota: 5 }]);
      qc.invalidateQueries({ queryKey: ['questionarios-clinicos', pacienteId] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  if (!data) return null;

  const recomendados = instrumentosRecomendados(data.scores);
  const inst = aberto ? INSTRUMENTOS[aberto] : null;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">Questionários do plano</p>
            <p className="text-[11px] text-muted-foreground">
              Baseados em evidência — montam seu plano nutricional e treino personalizados
            </p>
          </div>
        </div>

        {bloqueado ? (
          <button onClick={() => navigate('/paciente/plano')}
            className="w-full flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border/50 text-left">
            <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground flex-1">
              Estes questionários calibram seu treino, fisioterapia e nutrição no <strong>Premium</strong>. Toque para conhecer.
            </p>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        ) : !data.temMyid ? (
          <p className="text-xs text-muted-foreground p-2">
            Complete primeiro o Questionário MyID acima — ele define quais destes você precisa responder.
          </p>
        ) : (() => {
          // Pendentes ficam como cards (ação a fazer); respondidos viram um
          // histórico compacto e recolhível — não ocupam a tela toda.
          const pendentes = recomendados.filter((id) => !data.ultimos.get(id));
          const respondidos = recomendados.filter((id) => data.ultimos.get(id));
          return (
            <div className="space-y-2">
              {pendentes.length === 0 && respondidos.length > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <p className="text-[12px] font-medium text-emerald-700 dark:text-emerald-400">Você respondeu todos os questionários do seu plano. 🎉</p>
                </div>
              )}

              {pendentes.map((id) => {
                const i = INSTRUMENTOS[id];
                return (
                  <button key={id} onClick={() => { setAberto(id); setRespostas({}); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:bg-muted/40 text-left transition-colors">
                    <Sparkles className="h-5 w-5 text-violet-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{i.nome} <span className="text-muted-foreground font-normal">({i.sigla})</span></p>
                      <p className="text-[11px] text-muted-foreground">{MOTIVO_RECOMENDACAO[id]} · {i.tempoEstimado}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">Responder</Badge>
                  </button>
                );
              })}

              {respondidos.length > 0 && (
                <div className="rounded-xl border border-border/40 overflow-hidden">
                  <button onClick={() => setHistAberto(v => !v)}
                    className="w-full flex items-center gap-2 px-3 py-2 bg-muted/30 text-left">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span className="text-xs font-semibold flex-1">Respondidos ({respondidos.length})</span>
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${histAberto ? 'rotate-90' : ''}`} />
                  </button>
                  {histAberto && (
                    <div className="divide-y divide-border/40">
                      {respondidos.map((id) => {
                        const i = INSTRUMENTOS[id];
                        const feito = data.ultimos.get(id);
                        return (
                          <button key={id} onClick={() => { setAberto(id); setRespostas({}); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/30 text-left">
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-medium truncate">{i.sigla} <span className="text-muted-foreground font-normal">· {CLASSIFICACAO_LABEL[feito.classificacao] || feito.classificacao}</span></p>
                            </div>
                            <span className="text-[10px] text-primary shrink-0">Refazer</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </CardContent>

      <Dialog open={!!aberto} onOpenChange={(o) => { if (!o) setAberto(null); }}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          {inst && (
            <>
              <DialogHeader><DialogTitle>{inst.nome} ({inst.sigla})</DialogTitle></DialogHeader>
              <p className="text-xs text-muted-foreground">{inst.descricao}</p>
              <div className="space-y-4">
                {inst.atividadesLivres ? (
                  atividades.map((a, i) => (
                    <div key={i} className="space-y-2 rounded-xl border border-border/40 p-3">
                      <Input placeholder={`Atividade ${i + 1} — ex: subir escadas, pegar meu filho no colo…`}
                        value={a.nome}
                        onChange={e => setAtividades(prev => prev.map((x, xi) => xi === i ? { ...x, nome: e.target.value } : x))} />
                      <div className="flex items-center gap-3">
                        <Slider min={0} max={10} step={1} value={[a.nota]}
                          onValueChange={([v]) => setAtividades(prev => prev.map((x, xi) => xi === i ? { ...x, nota: v } : x))}
                          className="flex-1" />
                        <span className="text-sm font-bold w-8 text-right tabular-nums">{a.nota}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">0 = incapaz de realizar · 10 = consigo como antes</p>
                    </div>
                  ))
                ) : (
                  inst.perguntas.map((p, idx) => (
                    <div key={p.id} className="space-y-1.5">
                      <p className="text-sm font-medium">{idx + 1}. {p.texto}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {p.opcoes.map((o, oi) => (
                          <button key={oi}
                            onClick={() => setRespostas(prev => ({ ...prev, [p.id]: oi }))}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              respostas[p.id] === oi
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'border-border/60 hover:bg-muted'
                            }`}>
                            {o.rotulo}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
                <Button className="w-full" onClick={() => aberto && salvar.mutate(aberto)} disabled={salvar.isPending}>
                  {salvar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Enviar respostas
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
