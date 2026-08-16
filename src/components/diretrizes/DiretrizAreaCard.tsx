import { useState, useEffect, useRef, type ComponentType } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sparkles, Loader2, Eye, Send, EyeOff, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import DiretrizTecnicasEditor from './DiretrizTecnicasEditor';
import { format, parseISO } from '@/lib/dateSafe';
import { erroDaFuncao } from '@/lib/fnError';
import { usePodeChancelar, type AreaChancela } from '@/hooks/usePodeChancelar';

export interface DiretrizAreaProps {
  pacienteId: string;
  area: string;
  nomeCard: string;
  funcaoIA: string;
  Icone: ComponentType<{ className?: string }>;
  corIcone: string;
  descricaoVazio: string;
  descricaoGerar: string;
  placeholderObjetivo: string;
  autoGerar?: boolean;
  ocultarGerador?: boolean;
}

// MOLDE ÚNICO "profissional cria → cliente recebe" das diretrizes por área
// (nutrição, educação física, ...). A IA gera o rascunho dos dados clínicos;
// aqui o profissional revisa fase a fase e envia ao portal do cliente.
export default function DiretrizAreaCard({
  pacienteId, area, nomeCard, funcaoIA, Icone, corIcone, descricaoVazio, descricaoGerar, placeholderObjetivo, autoGerar, ocultarGerador,
}: DiretrizAreaProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(false);
  const [objetivo, setObjetivo] = useState('');
  const [obs, setObs] = useState('');
  const [editarTec, setEditarTec] = useState(false);
  // A chancela (enviar ao portal) é do profissional habilitado pela área.
  const AREA_CHANCELA: Record<string, AreaChancela> = {
    nutricao: 'nutricao',
    educacao_fisica: 'treino',
    medicina: 'medicina',
    psicologia: 'psicologia',
    terapia_ocupacional: 'terapia_ocupacional',
    odontologia: 'odontologia',
  };
  const areaChancela: AreaChancela = AREA_CHANCELA[area] || 'fisioterapia';
  const chancela = usePodeChancelar(areaChancela);

  const { data: diretriz } = useQuery({
    queryKey: ['diretriz-prof', area, pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any).from('diretrizes_profissionais')
        .select('*').eq('paciente_id', pacienteId).eq('area', area)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const gerar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(funcaoIA, {
        body: { paciente_id: pacienteId, area, objetivo: objetivo || undefined, observacoes: obs || undefined },
      });
      if (error) throw await erroDaFuncao(error);
      if (!(data as any)?.ok) throw new Error((data as any)?.error || 'Falha ao gerar');
      return data as any;
    },
    onSuccess: (d) => {
      const ctx = d.contexto || {};
      const usados = Object.entries(ctx)
        .filter(([, v]) => v === true || (typeof v === 'number' && v > 0))
        .map(([k, v]) => (typeof v === 'number' ? `${v} ${k.replace(/_/g, ' ')}` : k.replace(/_/g, ' ')))
        .join(' + ');
      toast.success(`Diretriz gerada${usados ? ` com ${usados}` : ''} — revise e envie ao portal`);
      setOpen(false);
      setView(true);
      qc.invalidateQueries({ queryKey: ['diretriz-prof', area, pacienteId] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar'),
  });

  // "Montar todos os planos": gera a diretriz UMA vez quando ainda não existe.
  const autoDisparado = useRef(false);
  useEffect(() => {
    if (autoGerar && !autoDisparado.current && !diretriz && !gerar.isPending) {
      autoDisparado.current = true;
      gerar.mutate();
    }
  }, [autoGerar, diretriz]); // eslint-disable-line react-hooks/exhaustive-deps

  const enviarPortal = useMutation({
    mutationFn: async (enviar: boolean) => {
      // Só o profissional habilitado (ou a clínica que o tenha) envia ao portal.
      // Ocultar (enviar=false) é sempre permitido.
      if (enviar && !chancela.pode) throw new Error(chancela.motivo);
      const { error } = await (supabase as any).from('diretrizes_profissionais')
        .update({ enviada_portal: enviar, status: enviar ? 'ativa' : 'rascunho', updated_at: new Date().toISOString() })
        .eq('id', diretriz.id);
      if (error) throw error;
    },
    onSuccess: (_d, enviar) => {
      toast.success(enviar ? '📲 Diretriz enviada ao portal do cliente' : 'Diretriz ocultada do portal');
      qc.invalidateQueries({ queryKey: ['diretriz-prof', area, pacienteId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const c = diretriz?.conteudo;

  return (
    <>
      <Card className="border-border/40 shadow-xs">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icone className={`icon-sm ${corIcone} shrink-0`} />
            {nomeCard}
          </CardTitle>
          {/* No modo "Montar todos", esconde o gerar/regerar individual — quem gera é o botão único.
              Mantém o "Regerar" quando já existe diretriz (é gestão do que já foi criado). */}
          {(!ocultarGerador || diretriz) && (
            <Button size="sm" variant={diretriz ? 'outline' : 'default'} onClick={() => setOpen(true)}>
              <Sparkles className="icon-sm mr-1" /> {diretriz ? 'Regerar' : 'Gerar com IA'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!diretriz ? (
            <p className="text-sm text-muted-foreground py-3 text-center flex items-center justify-center gap-1.5">
              {gerar.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {gerar.isPending ? 'Montando…' : descricaoVazio}
            </p>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded-md border border-border/40">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{diretriz.titulo}</p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(diretriz.updated_at), 'dd/MM/yyyy')} · {(c?.fases || []).length} fases
                </p>
              </div>
              {diretriz.enviada_portal
                ? <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">No portal</Badge>
                : <Badge variant="outline" className="text-xs">Rascunho</Badge>}
              <Button variant="ghost" size="icon" title="Ver" onClick={() => setView(true)}>
                <Eye className="icon-sm" />
              </Button>
              <Button variant="ghost" size="icon" title="Editar técnicas" onClick={() => setEditarTec(true)}>
                <Pencil className="icon-sm" />
              </Button>
              <Button variant={diretriz.enviada_portal ? 'ghost' : 'default'} size="sm" className="h-8 text-xs px-2.5"
                onClick={() => enviarPortal.mutate(!diretriz.enviada_portal)}
                disabled={enviarPortal.isPending || (!diretriz.enviada_portal && (chancela.loading || !chancela.pode))}
                title={!diretriz.enviada_portal && !chancela.pode ? chancela.motivo : (chancela.viaClinica ? chancela.motivo : undefined)}>
                {diretriz.enviada_portal ? <><EyeOff className="icon-sm mr-1" /> Ocultar</> : <><Send className="icon-sm mr-1" /> Enviar ao portal</>}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gerar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Gerar {nomeCard.toLowerCase()} (IA)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{descricaoGerar}</p>
            <div>
              <label className="text-xs text-muted-foreground">Objetivo (opcional)</label>
              <Input placeholder={placeholderObjetivo} value={objetivo} onChange={e => setObjetivo(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Observações suas (opcional)</label>
              <Textarea rows={2} placeholder="ex: paciente trabalha em turnos; priorizar praticidade" value={obs} onChange={e => setObs(e.target.value)} />
            </div>
            <Button className="w-full" onClick={() => gerar.mutate()} disabled={gerar.isPending}>
              {gerar.isPending ? <Loader2 className="icon-sm mr-2 animate-spin" /> : <Sparkles className="icon-sm mr-2" />}
              {gerar.isPending ? 'Analisando dados clínicos…' : 'Gerar diretriz'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revisar */}
      <Dialog open={view} onOpenChange={setView}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
          {c && (
            <>
              <DialogHeader><DialogTitle>{c.titulo || diretriz?.titulo}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                {c.objetivo && <p className="text-sm font-medium">{c.objetivo}</p>}
                {c.resumo_clinico && <p className="text-sm text-muted-foreground italic">{c.resumo_clinico}</p>}
                {(c.fases || []).map((f: any) => (
                  <div key={f.numero} className="rounded-lg border border-border/40 p-3 space-y-2">
                    <p className="font-semibold text-sm">
                      Fase {f.numero} — {f.titulo}
                      <span className="text-muted-foreground font-normal"> · {f.duracao_semanas} semanas{f.foco ? ` · ${f.foco}` : ''}</span>
                    </p>
                    {(f.metas || []).length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-1">Metas</p>
                        <ul className="space-y-1 text-sm">
                          {f.metas.map((m: any, i: number) => (
                            <li key={i}>🎯 {m.descricao} <span className="text-xs text-muted-foreground">({m.como_medir})</span></li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(f.marcadores || []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {f.marcadores.map((m: any, i: number) => (
                          <Badge key={i} variant="outline" className="text-[11px]">
                            {m.nome}: {m.atual ? `${m.atual} → ` : ''}{m.alvo}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {(f.orientacoes || []).length > 0 && (
                      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
                        {f.orientacoes.map((o: string, i: number) => <li key={i}>{o}</li>)}
                      </ul>
                    )}
                    {f.reavaliacao && <p className="text-xs text-muted-foreground">🔁 Reavaliação: {f.reavaliacao}</p>}
                  </div>
                ))}
                {(c.alertas || []).length > 0 && (
                  <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-2.5">
                    <p className="text-xs font-medium mb-1">⚠️ Atenção do profissional</p>
                    <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                      {c.alertas.map((a: string, i: number) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}
                {diretriz && !diretriz.enviada_portal && (
                  <>
                    <Button className="w-full" disabled={chancela.loading || !chancela.pode}
                      onClick={() => { enviarPortal.mutate(true); setView(false); }}>
                      <Send className="icon-sm mr-2" /> Revisei — enviar ao portal do cliente
                    </Button>
                    {!chancela.loading && !chancela.pode && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center">🔒 {chancela.motivo}</p>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {editarTec && diretriz && (
        <DiretrizTecnicasEditor diretriz={diretriz} area={area} pacienteId={pacienteId} onClose={() => setEditarTec(false)} />
      )}
    </>
  );
}
