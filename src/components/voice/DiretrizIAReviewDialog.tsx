import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sparkles, CheckCircle2, Edit3, Trash2, Loader2, Target, Lightbulb, Activity, Leaf, AlertTriangle, CalendarClock } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  diretriz: any;
  queixa?: string;
  classificacao?: string;
  origem: 'ia_voz' | 'ia_escrita';
  loading?: boolean;
  onAprovar: () => void;
  onEditar: () => void;
  onDescartar: () => void;
}

const FASES_CFG = [
  { key: 'fase_1_alivio', titulo: 'Fase 1 — Alívio & Proteção', semanas: '1-2' },
  { key: 'fase_2_carga', titulo: 'Fase 2 — Carga Progressiva', semanas: '3-6' },
  { key: 'fase_3_retorno', titulo: 'Fase 3 — Retorno Funcional', semanas: '7-12' },
];

export default function DiretrizIAReviewDialog({
  open, onOpenChange, diretriz, queixa, classificacao, origem,
  loading, onAprovar, onEditar, onDescartar,
}: Props) {
  const totalTecnicas = useMemo(() => {
    if (!diretriz) return 0;
    return FASES_CFG.reduce((acc, f) => acc + (diretriz?.[f.key]?.tecnicas?.length || 0), 0);
  }, [diretriz]);

  const origemLabel = origem === 'ia_voz' ? 'IA · Voz' : 'IA · Escrita';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col p-0">
        <DialogHeader className="p-5 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px] gap-1 border-primary/40 text-primary">
              <Sparkles className="h-3 w-3" /> {origemLabel} · Rascunho
            </Badge>
            {classificacao && <Badge variant="outline" className="text-[10px]">{classificacao}</Badge>}
            <Badge variant="outline" className="text-[10px]">{totalTecnicas} técnicas</Badge>
          </div>
          <DialogTitle className="text-base">Revisar diretriz sugerida pela IA</DialogTitle>
          <DialogDescription className="text-xs">
            {queixa ? <><strong>Queixa:</strong> {queixa} · </> : null}
            Antes de enviar ao prontuário do paciente, confira as 3 fases e técnicas sugeridas.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-5 py-4">
          <div className="space-y-3">
            {FASES_CFG.map((cfg, idx) => {
              const fase = diretriz?.[cfg.key] || {};
              const tecnicas = Array.isArray(fase.tecnicas) ? fase.tecnicas : [];
              const objetivos = Array.isArray(fase.objetivos) ? fase.objetivos : [];
              return (
                <div key={cfg.key} className="rounded-xl border border-border/40 p-3 bg-muted/20">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold">{idx + 1}</div>
                      <span className="text-sm font-semibold">{cfg.titulo}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">Sem {cfg.semanas}</Badge>
                  </div>

                  {objetivos.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                        <Target className="h-3 w-3" /> Objetivos
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-0.5 pl-1">
                        {objetivos.slice(0, 3).map((o: string, i: number) => <li key={i}>• {o}</li>)}
                      </ul>
                    </div>
                  )}

                  {tecnicas.length > 0 ? (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 flex items-center gap-1">
                        <Activity className="h-3 w-3" /> Técnicas ({tecnicas.length})
                      </p>
                      <div className="space-y-1.5">
                        {tecnicas.map((t: any, i: number) => (
                          <div key={i} className="bg-background rounded-md p-2 border border-border/30">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-xs font-medium">{t.tecnica || 'Técnica'}</span>
                              <div className="flex gap-1">
                                {t.lente_clinica && (
                                  <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">{t.lente_clinica}</Badge>
                                )}
                                {t.nivel_evidencia && <Badge variant="outline" className="text-[9px]">N{t.nivel_evidencia}</Badge>}
                              </div>
                            </div>
                            {t.justificativa && (
                              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{t.justificativa}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">Sem técnicas sugeridas para esta fase.</p>
                  )}
                </div>
              );
            })}

            {(diretriz?.frequencia_sugerida || diretriz?.prognostico) && (
              <>
                <Separator className="my-2" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {diretriz?.frequencia_sugerida && (
                    <div className="rounded-lg bg-muted/40 p-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Frequência</p>
                      <p>{diretriz.frequencia_sugerida}</p>
                    </div>
                  )}
                  {diretriz?.prognostico && (
                    <div className="rounded-lg bg-muted/40 p-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Prognóstico</p>
                      <p>{diretriz.prognostico}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {Array.isArray(diretriz?.criterios_alta) && diretriz.criterios_alta.length > 0 && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-700/40 p-2">
                <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase mb-1 flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" /> Critérios de Alta
                </p>
                <ul className="text-xs text-emerald-800 dark:text-emerald-200 space-y-0.5">
                  {diretriz.criterios_alta.map((c: string, i: number) => <li key={i}>✓ {c}</li>)}
                </ul>
              </div>
            )}

            {diretriz?.manutencao && (
              (() => {
                const m = diretriz.manutencao;
                const rotina = Array.isArray(m.rotina_minima) ? m.rotina_minima : [];
                const habitos = Array.isArray(m.habitos_chave) ? m.habitos_chave : [];
                const sinais = Array.isArray(m.sinais_para_retornar) ? m.sinais_para_retornar : [];
                const hasContent = m.mensagem_paciente || m.frequencia_reavaliacao || rotina.length || habitos.length || sinais.length;
                if (!hasContent) return null;
                return (
                  <div className="rounded-xl border border-emerald-300/60 dark:border-emerald-700/40 bg-emerald-50/70 dark:bg-emerald-900/15 p-3 space-y-2">
                    <p className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase flex items-center gap-1">
                      <Leaf className="h-3 w-3" /> Plano de Manutenção (pós-alta)
                    </p>
                    {m.mensagem_paciente && (
                      <p className="text-xs italic text-emerald-900 dark:text-emerald-100 leading-snug">"{m.mensagem_paciente}"</p>
                    )}
                    {m.frequencia_reavaliacao && (
                      <p className="text-xs text-emerald-900 dark:text-emerald-100 flex items-start gap-1.5">
                        <CalendarClock className="h-3 w-3 mt-0.5 shrink-0" />
                        <span><strong>Reavaliação:</strong> {m.frequencia_reavaliacao}</span>
                      </p>
                    )}
                    {rotina.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-200 uppercase mb-0.5">Rotina mínima</p>
                        <ul className="text-xs text-emerald-900 dark:text-emerald-100 space-y-0.5 pl-1">
                          {rotina.map((r: string, i: number) => <li key={i}>• {r}</li>)}
                        </ul>
                      </div>
                    )}
                    {habitos.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-200 uppercase mb-0.5">Hábitos-chave</p>
                        <ul className="text-xs text-emerald-900 dark:text-emerald-100 space-y-0.5 pl-1">
                          {habitos.map((h: string, i: number) => <li key={i}>• {h}</li>)}
                        </ul>
                      </div>
                    )}
                    {sinais.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 uppercase mb-0.5 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Voltar ao profissional se
                        </p>
                        <ul className="text-xs text-amber-900 dark:text-amber-100 space-y-0.5 pl-1">
                          {sinais.map((s: string, i: number) => <li key={i}>• {s}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })()
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border/40 p-4 bg-muted/20">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={onDescartar}
              disabled={loading}
              className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 order-3 sm:order-1"
            >
              <Trash2 className="icon-sm shrink-0" />
              Descartar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onEditar}
              disabled={loading}
              className="gap-1.5 order-2"
            >
              {loading ? <Loader2 className="icon-sm animate-spin shrink-0" /> : <Edit3 className="icon-sm shrink-0" />}
              Editar antes
            </Button>
            <Button
              size="sm"
              onClick={onAprovar}
              disabled={loading}
              className="gap-1.5 bg-primary text-primary-foreground order-1 sm:order-3"
            >
              {loading ? <Loader2 className="icon-sm animate-spin shrink-0" /> : <CheckCircle2 className="icon-sm shrink-0" />}
              Aprovar e ativar
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            <strong>Aprovar:</strong> ativa e envia ao prontuário · <strong>Editar:</strong> salva como rascunho e abre o editor · <strong>Descartar:</strong> não cria nada
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
