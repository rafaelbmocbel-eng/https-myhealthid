import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Dumbbell, CheckCircle2, ChevronDown, ChevronRight, Flame, Info, AlertTriangle, Loader2, PlayCircle, FileDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { startOfWeek } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  pacienteId: string;
  titulo?: string | null;
  conteudo: any; // { resumo, fases: [{ nome, semanas, objetivo, sessoes: [{ nome, duracao_min, aquecimento, exercicios: [...], desaquecimento }] }] }
  onRegenerarComIncomodo?: (nota: string) => Promise<void> | void;
  regenerando?: boolean;
}

const hojeStr = () => new Date().toISOString().split('T')[0];
function sessaoKey(fi: number, si: number, nome: string) {
  return `f${fi}s${si}:${String(nome || '').toLowerCase().slice(0, 30)}`;
}

// Experiência de treino do cliente: GIFs do banco, execução bem explicada,
// marcar cada treino como feito (progresso semanal) e reportar incômodo para o
// plano se adaptar.
export default function PlanoTreinoInterativo({ pacienteId, titulo, conteudo, onRegenerarComIncomodo, regenerando }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [baixandoPdf, setBaixandoPdf] = useState(false);
  const fases: any[] = Array.isArray(conteudo?.fases) ? conteudo.fases : [];
  const [aberta, setAberta] = useState<string | null>(() => (fases[0]?.sessoes?.[0] ? sessaoKey(0, 0, fases[0].sessoes[0].nome) : null));
  const [expExercicio, setExpExercicio] = useState<string | null>(null);
  const [gifZoom, setGifZoom] = useState<{ url: string; nome: string } | null>(null);
  const [incomodo, setIncomodo] = useState(false);
  const [notaIncomodo, setNotaIncomodo] = useState('');

  // Treinos feitos nesta semana (progresso) + hoje
  const { data: feitos } = useQuery({
    queryKey: ['plano-ia-treino-feito', pacienteId],
    queryFn: async () => {
      const inicioSemana = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString().split('T')[0];
      const { data } = await (supabase as any).from('plano_ia_treino_feito')
        .select('sessao_key, data').eq('paciente_id', pacienteId).gte('data', inicioSemana);
      return (data || []) as { sessao_key: string; data: string }[];
    },
  });

  const feitosHoje = useMemo(() => new Set((feitos || []).filter(f => f.data === hojeStr()).map(f => f.sessao_key)), [feitos]);
  const totalSemana = feitos?.length || 0;

  const marcar = useMutation({
    mutationFn: async ({ key, jaFeito }: { key: string; jaFeito: boolean }) => {
      if (jaFeito) {
        await (supabase as any).from('plano_ia_treino_feito')
          .delete().eq('paciente_id', pacienteId).eq('sessao_key', key).eq('data', hojeStr());
      } else {
        await (supabase as any).from('plano_ia_treino_feito')
          .upsert({ paciente_id: pacienteId, sessao_key: key, data: hojeStr() }, { onConflict: 'paciente_id,sessao_key,data' });
        // XP real (1x por sessão/dia)
        void (supabase as any).rpc('ganhar_xp', { p_paciente_id: pacienteId, p_chave: `treino-ia:${key}:${hojeStr()}`, p_xp: 25 });
      }
    },
    onSuccess: (_, { jaFeito }) => {
      if (!jaFeito) toast.success('Treino concluído! +25 XP 💪');
      qc.invalidateQueries({ queryKey: ['plano-ia-treino-feito', pacienteId] });
    },
    onError: () => toast.error('Não consegui salvar agora. Tente de novo.'),
  });

  const enviarIncomodo = async () => {
    if (!notaIncomodo.trim() || !onRegenerarComIncomodo) return;
    await onRegenerarComIncomodo(notaIncomodo.trim());
    setIncomodo(false);
    setNotaIncomodo('');
  };

  const baixarPdf = async () => {
    setBaixandoPdf(true);
    try {
      const { data: pac } = await supabase.from('pacientes').select('nome, sobrenome').eq('id', pacienteId).maybeSingle();
      const nome = pac ? `${pac.nome || ''} ${pac.sobrenome || ''}`.trim() : ((user?.user_metadata?.nome as string) || 'Paciente');
      const { gerarPDFPlanoTreino } = await import('@/utils/pdfPlanoTreino');
      const { downloadPDFBlob } = await import('@/utils/pdfMyIDPaciente');
      const blob = await gerarPDFPlanoTreino({ pacienteNome: nome, titulo, conteudo });
      const filename = `Meu_Treino_${new Date().toISOString().slice(0, 10)}.pdf`;
      const file = new File([blob], filename, { type: 'application/pdf' });
      const navAny = navigator as any;
      if (navAny.canShare && navAny.canShare({ files: [file] })) {
        try { await navAny.share({ files: [file], title: 'Meu Treino' }); }
        catch (e: any) { if (e?.name !== 'AbortError') downloadPDFBlob(blob, filename); }
      } else {
        downloadPDFBlob(blob, filename);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Não consegui gerar o PDF agora.');
    } finally {
      setBaixandoPdf(false);
    }
  };

  if (fases.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Cabeçalho + progresso da semana */}
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Dumbbell className="h-5 w-5 text-primary" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate flex items-center gap-1.5">
              {titulo || 'Meu Treino'}
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">IA</span>
            </p>
            {conteudo?.resumo && <p className="text-[11px] text-muted-foreground line-clamp-2">{conteudo.resumo}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-primary/[0.04] border border-primary/15 px-3 py-2">
          <Flame className="h-4 w-4 text-orange-500 shrink-0" />
          <p className="text-[12px] font-semibold text-foreground">{totalSemana} treino{totalSemana !== 1 ? 's' : ''} concluído{totalSemana !== 1 ? 's' : ''} esta semana</p>
          <span className="ml-auto text-[10px] text-muted-foreground">marque abaixo ao terminar</span>
        </div>

        {/* Ver a versão web (GIFs ANIMANDO, imita o PDF) + baixar PDF estático */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button variant="default" className="gap-1.5" onClick={() => navigate('/paciente/treino-completo')}>
            <PlayCircle className="h-4 w-4" /> Ver treino completo (com GIFs)
          </Button>
          <Button variant="outline" className="gap-1.5" disabled={baixandoPdf} onClick={baixarPdf}>
            {baixandoPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {baixandoPdf ? 'Montando PDF…' : 'Baixar PDF'}
          </Button>
        </div>

        {/* Fases → sessões */}
        {fases.map((f, fi) => (
          <div key={fi} className="rounded-xl border border-border/40 overflow-hidden">
            <div className="px-3 py-2 bg-muted/40 flex items-center justify-between">
              <span className="text-xs font-bold">{f.nome || `Fase ${fi + 1}`}</span>
              {f.semanas && <span className="text-[10px] text-muted-foreground">{f.semanas} semanas</span>}
            </div>
            {f.objetivo && <p className="px-3 pt-2 text-[11px] text-muted-foreground">{f.objetivo}</p>}
            <div className="p-2.5 space-y-2">
              {(Array.isArray(f.sessoes) ? f.sessoes : []).map((s: any, si: number) => {
                const key = sessaoKey(fi, si, s.nome);
                const aberto = aberta === key;
                const feito = feitosHoje.has(key);
                return (
                  <div key={si} className={cn('rounded-xl border', feito ? 'border-emerald-300 bg-emerald-50/40 dark:bg-emerald-950/10' : 'border-border/40')}>
                    <button onClick={() => setAberta(aberto ? null : key)} className="w-full flex items-center gap-2 p-2.5 text-left">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', feito ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-primary/10')}>
                        {feito ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <PlayCircle className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{s.nome || `Treino ${si + 1}`}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {(Array.isArray(s.exercicios) ? s.exercicios.length : 0)} exercícios{s.duracao_min ? ` · ~${s.duracao_min} min` : ''}
                        </p>
                      </div>
                      <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', aberto && 'rotate-180')} />
                    </button>

                    {aberto && (
                      <div className="px-2.5 pb-2.5 space-y-2">
                        {s.aquecimento && (
                          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                            <Flame className="h-3 w-3 text-orange-400 shrink-0 mt-0.5" /> <span><strong>Aquecimento:</strong> {s.aquecimento}</span>
                          </p>
                        )}
                        {(Array.isArray(s.exercicios) ? s.exercicios : []).map((ex: any, ei: number) => {
                          const exKey = `${key}-${ei}`;
                          const exp = expExercicio === exKey;
                          return (
                            <div key={ei} className="rounded-lg bg-muted/30 overflow-hidden">
                              <div className="flex items-center gap-2.5 p-2">
                                {ex.gif_url ? (
                                  <button onClick={() => setGifZoom({ url: ex.gif_url, nome: ex.nome })} className="shrink-0">
                                    <img src={ex.gif_url} alt={ex.nome} className="h-14 w-14 rounded-lg object-cover border border-border/40" loading="lazy" />
                                  </button>
                                ) : (
                                  <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-[11px] font-bold text-primary">{ei + 1}</div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] font-semibold leading-tight">{ex.nome || 'Exercício'}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {[ex.series && ex.reps ? `${ex.series}×${ex.reps}` : ex.series, ex.carga, ex.descanso_s && `${ex.descanso_s}s descanso`].filter(Boolean).join(' · ')}
                                  </p>
                                  {(ex.orientacoes || ex.obs) && (
                                    <button onClick={() => setExpExercicio(exp ? null : exKey)} className="text-[10px] text-primary font-medium flex items-center gap-0.5 mt-0.5">
                                      {exp ? 'Menos' : 'Como fazer'} <ChevronRight className={cn('h-3 w-3 transition-transform', exp && 'rotate-90')} />
                                    </button>
                                  )}
                                </div>
                              </div>
                              {exp && (
                                <div className="px-2 pb-2 space-y-1 text-[11px] text-muted-foreground border-t border-border/30 pt-1.5">
                                  {ex.orientacoes && <p><strong className="text-foreground/80">Execução:</strong> {ex.orientacoes}</p>}
                                  {ex.obs && <p className="flex items-start gap-1"><Info className="h-3 w-3 shrink-0 mt-0.5" /> {ex.obs}</p>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {s.desaquecimento && (
                          <p className="text-[11px] text-muted-foreground"><strong>Desaquecimento:</strong> {s.desaquecimento}</p>
                        )}

                        {/* Ações: marcar feito + incômodo */}
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          <Button
                            size="sm"
                            variant={feito ? 'outline' : 'default'}
                            className="gap-1.5 flex-1"
                            disabled={marcar.isPending}
                            onClick={() => marcar.mutate({ key, jaFeito: feito })}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {feito ? 'Feito hoje ✓ (desfazer)' : 'Marcar treino como feito'}
                          </Button>
                          {onRegenerarComIncomodo && (
                            <Button size="sm" variant="ghost" className="gap-1.5 text-amber-700"
                              onClick={() => setIncomodo(true)}>
                              <AlertTriangle className="h-4 w-4" /> Senti incômodo
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {conteudo?.observacoes_gerais && (
          <p className="text-[11px] text-muted-foreground border-t border-border/40 pt-2">{conteudo.observacoes_gerais}</p>
        )}
      </CardContent>

      {/* Zoom do GIF */}
      <Dialog open={!!gifZoom} onOpenChange={(o) => { if (!o) setGifZoom(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">{gifZoom?.nome}</DialogTitle></DialogHeader>
          {gifZoom && <img src={gifZoom.url} alt={gifZoom.nome} className="w-full rounded-xl" />}
        </DialogContent>
      </Dialog>

      {/* Reportar incômodo → adapta o plano */}
      <Dialog open={incomodo} onOpenChange={(o) => { if (!o) setIncomodo(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-base">Senti um incômodo</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">
            Conte o que incomodou (onde, em qual exercício, tipo de dor). Vamos <strong>refazer seu treino</strong> com mais cuidado nessa região. Se a dor for forte ou persistente, procure seu profissional.
          </p>
          <Textarea rows={4} placeholder="Ex: senti fisgada no joelho direito no agachamento, e o ombro incomodou na flexão de parede…"
            value={notaIncomodo} onChange={e => setNotaIncomodo(e.target.value)} />
          <Button onClick={enviarIncomodo} disabled={!notaIncomodo.trim() || regenerando} className="w-full gap-1.5">
            {regenerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dumbbell className="h-4 w-4" />}
            {regenerando ? 'Adaptando seu treino…' : 'Refazer treino com esse cuidado'}
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
