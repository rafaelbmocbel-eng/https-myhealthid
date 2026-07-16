import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Award, Sparkles, Loader2, Eye, EyeOff, Send, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { erroDaFuncao } from '@/lib/fnError';

interface Props { pacienteId: string; pacienteNome?: string; pacienteTelefone?: string | null; }

// Relatório de Avaliação: devolutiva de pontos fortes e a melhorar gerada
// automaticamente quando o cliente conclui o MyID (regenerável aqui). O
// profissional revisa, controla a visibilidade no portal e avisa pelo Zap.
export default function RelatorioAvaliacaoCard({ pacienteId, pacienteNome, pacienteTelefone }: Props) {
  const qc = useQueryClient();
  const [view, setView] = useState(false);

  const { data: rel } = useQuery({
    queryKey: ['relatorio-avaliacao', pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any).from('relatorios_avaliacao')
        .select('*').eq('paciente_id', pacienteId).maybeSingle();
      return data;
    },
  });

  const gerar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('gerar-relatorio-avaliacao', {
        body: { paciente_id: pacienteId },
      });
      if (error) throw await erroDaFuncao(error);
      if ((data as any)?.reason === 'sem_myid') throw new Error('O cliente ainda não concluiu o MyID');
      if (!(data as any)?.ok) throw new Error((data as any)?.error || 'Falha ao gerar');
      return data;
    },
    onSuccess: () => {
      toast.success('Relatório gerado — revise e avise o cliente');
      setView(true);
      qc.invalidateQueries({ queryKey: ['relatorio-avaliacao', pacienteId] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar'),
  });

  const visibilidade = useMutation({
    mutationFn: async (mostrar: boolean) => {
      const { error } = await (supabase as any).from('relatorios_avaliacao')
        .update({ enviado_portal: mostrar, updated_at: new Date().toISOString() })
        .eq('id', rel.id);
      if (error) throw error;
    },
    onSuccess: (_d, mostrar) => {
      toast.success(mostrar ? 'Visível no portal do cliente' : 'Oculto do portal');
      qc.invalidateQueries({ queryKey: ['relatorio-avaliacao', pacienteId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const avisarZap = async () => {
    if (!pacienteTelefone) { toast.error('Cliente sem telefone cadastrado'); return; }
    const primeiro = (pacienteNome || '').split(' ')[0];
    const msg = `Oi ${primeiro}! 🎉 Seu Relatório de Avaliação está pronto no seu portal: seus pontos fortes, o que vamos melhorar juntos e os primeiros passos. Entra lá em "Evolução" para ver!`;
    const { shareViaWhatsApp } = await import('@/utils/whatsapp');
    const r = await shareViaWhatsApp(pacienteTelefone, msg, undefined, true);
    if (r.success) toast.success('📲 Aviso enviado pelo Zap');
    else toast.error(r.error || 'Falha ao enviar');
  };

  const c = rel?.conteudo;

  return (
    <>
      <Card className="border-border/40 shadow-xs">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Award className="icon-sm text-amber-600 shrink-0" />
            Relatório de Avaliação
          </CardTitle>
          <Button size="sm" variant={rel ? 'outline' : 'default'} onClick={() => gerar.mutate()} disabled={gerar.isPending}>
            {gerar.isPending ? <Loader2 className="icon-sm mr-1 animate-spin" /> : <Sparkles className="icon-sm mr-1" />}
            {gerar.isPending ? 'Gerando…' : rel ? 'Regerar' : 'Gerar'}
          </Button>
        </CardHeader>
        <CardContent>
          {!rel ? (
            <p className="text-sm text-muted-foreground py-2 text-center">
              Pontos fortes e a melhorar do cliente (MyID + avatar clínico + métricas), escritos para ele ler.
              É gerado sozinho quando o MyID é concluído.
            </p>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded-md border border-border/40 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c?.titulo || 'Relatório de Avaliação'}</p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(rel.updated_at), 'dd/MM/yyyy')} · {(c?.pontos_fortes || []).length} fortes · {(c?.pontos_a_melhorar || []).length} a melhorar
                </p>
              </div>
              {rel.enviado_portal
                ? <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">No portal</Badge>
                : <Badge variant="outline" className="text-xs">Oculto</Badge>}
              <Button variant="ghost" size="icon" onClick={() => setView(true)}>
                <Eye className="icon-sm" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 text-xs px-2"
                onClick={() => visibilidade.mutate(!rel.enviado_portal)} disabled={visibilidade.isPending}>
                {rel.enviado_portal ? <><EyeOff className="icon-sm mr-1" /> Ocultar</> : <><Send className="icon-sm mr-1" /> Mostrar</>}
              </Button>
              {rel.enviado_portal && (
                <Button variant="outline" size="sm" className="h-8 text-xs px-2" onClick={avisarZap}>
                  <MessageCircle className="icon-sm mr-1" /> Avisar no Zap
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={view} onOpenChange={setView}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
          {c && (
            <>
              <DialogHeader><DialogTitle>{c.titulo || 'Relatório de Avaliação'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                {c.resumo && <p className="text-sm text-muted-foreground italic">{c.resumo}</p>}
                {(c.pontos_fortes || []).length > 0 && (
                  <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3">
                    <p className="text-xs font-bold mb-2">💪 Pontos fortes</p>
                    <ul className="space-y-1.5 text-sm">
                      {c.pontos_fortes.map((p: any, i: number) => (
                        <li key={i}><span className="font-medium">{p.titulo}</span> — <span className="text-muted-foreground">{p.descricao}</span></li>
                      ))}
                    </ul>
                  </div>
                )}
                {(c.pontos_a_melhorar || []).length > 0 && (
                  <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
                    <p className="text-xs font-bold mb-2">🎯 Pontos a melhorar</p>
                    <ul className="space-y-2 text-sm">
                      {c.pontos_a_melhorar.map((p: any, i: number) => (
                        <li key={i}>
                          <p className="font-medium">{p.titulo}</p>
                          <p className="text-muted-foreground text-xs">{p.por_que}</p>
                          {p.primeiro_passo && <p className="text-xs mt-0.5">👉 {p.primeiro_passo}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(c.proximos_passos || []).length > 0 && (
                  <div>
                    <p className="text-xs font-bold mb-1">Próximos passos</p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
                      {c.proximos_passos.map((p: string, i: number) => <li key={i}>{p}</li>)}
                    </ul>
                  </div>
                )}
                {c.mensagem_final && <p className="text-sm font-medium">{c.mensagem_final}</p>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
