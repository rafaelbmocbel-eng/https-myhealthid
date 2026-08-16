import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Apple, Sparkles, Loader2, Trash2, Eye, Plus, Pencil } from 'lucide-react';
import PlanoDietaEditor from './PlanoDietaEditor';
import { toast } from 'sonner';
import { erroDaFuncao } from '@/lib/fnError';
import { usePodeChancelar } from '@/hooks/usePodeChancelar';
import { format, parseISO } from '@/lib/dateSafe';

interface Props { pacienteId: string; autoGerar?: boolean; ocultarGerador?: boolean; }

const OBJETIVOS = [
  'Emagrecimento', 'Hipertrofia', 'Manutenção', 'Reeducação alimentar',
  'Performance esportiva', 'Ganho de peso', 'Controle glicêmico', 'Controle pressórico',
];

export default function PlanoAlimentarCard({ pacienteId, autoGerar, ocultarGerador }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const chancela = usePodeChancelar('nutricao');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<any | null>(null);
  const [editar, setEditar] = useState<any | null>(null);
  const [form, setForm] = useState({
    objetivo: 'Emagrecimento',
    calorias_alvo: '',
    refeicoes_por_dia: '5',
    restricoes: '',
    preferencias: '',
  });

  const { data: paciente } = useQuery({
    queryKey: ['paciente-nutri', pacienteId],
    queryFn: async () => {
      const { data } = await supabase.from('pacientes').select('data_nascimento, sexo').eq('id', pacienteId).maybeSingle();
      return data;
    },
  });

  const { data: antropoUlt } = useQuery({
    queryKey: ['antropo-ult', pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any).from('antropometria')
        .select('*').eq('paciente_id', pacienteId)
        .order('data_medicao', { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const { data: recUlt } = useQuery({
    queryKey: ['rec24-ult', pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any).from('recordatorios_24h')
        .select('*').eq('paciente_id', pacienteId)
        .order('data_referencia', { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const { data: planos = [] } = useQuery({
    queryKey: ['planos-alimentares', pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any).from('planos_alimentares')
        .select('*').eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const gerar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sem sessão');
      const idade = paciente?.data_nascimento
        ? Math.floor((Date.now() - new Date(paciente.data_nascimento).getTime()) / (365.25 * 24 * 3600 * 1000))
        : undefined;
      const { data, error } = await supabase.functions.invoke('gerar-plano-alimentar', {
        body: {
          objetivo: form.objetivo,
          calorias_alvo: Number(form.calorias_alvo) || undefined,
          refeicoes_por_dia: Number(form.refeicoes_por_dia) || 5,
          restricoes: form.restricoes,
          preferencias: form.preferencias,
          idade,
          sexo: paciente?.sexo,
          antropometria: antropoUlt,
          recordatorio: recUlt,
          paciente_id: pacienteId,
        },
      });
      if (error) throw await erroDaFuncao(error);
      if (!data?.ok) throw new Error(data?.error || 'Falha ao gerar');

      const p = data.plano;
      const { error: insErr } = await (supabase as any).from('planos_alimentares').insert({
        paciente_id: pacienteId,
        terapeuta_id: user.id,
        titulo: p.titulo || `Plano ${form.objetivo}`,
        objetivo: form.objetivo,
        calorias_alvo: p.calorias_totais || Number(form.calorias_alvo) || null,
        macros_alvo: p.macros || null,
        plano: p,
        ativo: true,
        aprovado: false,
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success('Plano alimentar gerado');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['planos-alimentares', pacienteId] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar'),
  });

  // "Montar todos os planos": gera a nutrição UMA vez quando ainda não há plano.
  const autoDisparado = useRef(false);
  useEffect(() => {
    if (autoGerar && !autoDisparado.current && planos.length === 0 && !gerar.isPending) {
      autoDisparado.current = true;
      gerar.mutate();
    }
  }, [autoGerar, planos.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('planos_alimentares').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Removido'); qc.invalidateQueries({ queryKey: ['planos-alimentares', pacienteId] }); },
  });

  const aprovar = useMutation({
    mutationFn: async ({ id, aprovado }: { id: string; aprovado: boolean }) => {
      // Chancela: só o Nutricionista (ou a clínica que o tenha) libera. Ocultar é livre.
      if (aprovado && !chancela.pode) throw new Error(chancela.motivo);
      const { error } = await (supabase as any).from('planos_alimentares').update({ aprovado }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => { toast.success(v.aprovado ? 'Liberado para o paciente' : 'Ocultado do paciente'); qc.invalidateQueries({ queryKey: ['planos-alimentares', pacienteId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Card className="border-border/40 shadow-xs">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Apple className="icon-sm text-emerald-600 shrink-0" />
            Plano Alimentar
          </CardTitle>
          {!ocultarGerador && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="icon-sm mr-1" /> Novo
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {planos.length > 0 && !chancela.loading && !chancela.pode && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 text-center">🔒 {chancela.motivo}</p>
          )}
          {planos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center flex items-center justify-center gap-1.5">
              {gerar.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {gerar.isPending ? 'Montando o plano alimentar…' : 'Nenhum plano gerado ainda.'}
            </p>
          ) : (
            planos.map((p: any) => (
              <div key={p.id} className="flex items-center gap-2 p-2 rounded-md border border-border/40">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(p.created_at), 'dd/MM/yyyy')} · {p.calorias_alvo || '—'} kcal · {p.objetivo}
                  </p>
                </div>
                {p.aprovado
                  ? <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Liberado</Badge>
                  : <Badge variant="outline" className="text-xs">Rascunho</Badge>}
                <Button variant={p.aprovado ? 'ghost' : 'default'} size="sm" className="h-8 text-xs px-2.5"
                  onClick={() => aprovar.mutate({ id: p.id, aprovado: !p.aprovado })}
                  disabled={aprovar.isPending || (!p.aprovado && (chancela.loading || !chancela.pode))}
                  title={!p.aprovado && !chancela.pode ? chancela.motivo : (chancela.viaClinica ? chancela.motivo : undefined)}>
                  {p.aprovado ? 'Ocultar' : 'Liberar'}
                </Button>
                <Button variant="ghost" size="icon" title="Ver plano" onClick={() => setView(p.plano)}>
                  <Eye className="icon-sm" />
                </Button>
                <Button variant="ghost" size="icon" title="Editar refeições" onClick={() => setEditar(p)}>
                  <Pencil className="icon-sm" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => excluir.mutate(p.id)}>
                  <Trash2 className="icon-sm text-destructive" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Gerar plano alimentar (IA)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Objetivo</label>
              <Select value={form.objetivo} onValueChange={v => setForm({ ...form, objetivo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{OBJETIVOS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Calorias-alvo</label>
                <Input type="number" placeholder="auto" value={form.calorias_alvo} onChange={e => setForm({ ...form, calorias_alvo: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Refeições/dia</label>
                <Input type="number" value={form.refeicoes_por_dia} onChange={e => setForm({ ...form, refeicoes_por_dia: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Restrições / alergias</label>
              <Textarea rows={2} placeholder="ex: lactose, glúten…" value={form.restricoes} onChange={e => setForm({ ...form, restricoes: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Preferências</label>
              <Textarea rows={2} placeholder="ex: vegetariano, sem frituras…" value={form.preferencias} onChange={e => setForm({ ...form, preferencias: e.target.value })} />
            </div>
            <Button className="w-full" onClick={() => gerar.mutate()} disabled={gerar.isPending}>
              {gerar.isPending ? <Loader2 className="icon-sm mr-2 animate-spin" /> : <Sparkles className="icon-sm mr-2" />}
              Gerar com IA
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!view} onOpenChange={() => setView(null)}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
          {view && (
            <>
              <DialogHeader><DialogTitle>{view.titulo}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                {view.resumo && <p className="text-sm text-muted-foreground italic">{view.resumo}</p>}
                {view.macros && (
                  <div className="flex flex-wrap gap-2">
                    <Badge>{view.calorias_totais} kcal</Badge>
                    <Badge variant="outline">P {view.macros.proteina_g}g</Badge>
                    <Badge variant="outline">C {view.macros.carbo_g}g</Badge>
                    <Badge variant="outline">G {view.macros.gordura_g}g</Badge>
                  </div>
                )}
                {(view.refeicoes || []).map((r: any, i: number) => (
                  <div key={i} className="rounded-lg border border-border/40 p-3">
                    <p className="font-semibold text-sm">{r.nome} <span className="text-muted-foreground font-normal">· {r.horario} · {r.calorias} kcal</span></p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {(r.itens || []).map((it: any, ii: number) => (
                        <li key={ii} className="flex justify-between gap-2">
                          <span>{it.alimento} <span className="text-muted-foreground">— {it.porcao}</span></span>
                          <span className="text-xs text-muted-foreground shrink-0">{it.kcal}kcal</span>
                        </li>
                      ))}
                    </ul>
                    {r.substituicoes && <p className="text-xs text-muted-foreground mt-2 italic">Subst.: {r.substituicoes}</p>}
                  </div>
                ))}
                {view.orientacoes?.length > 0 && (
                  <div>
                    <p className="font-medium text-sm mb-1">Orientações</p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
                      {view.orientacoes.map((o: string, i: number) => <li key={i}>{o}</li>)}
                    </ul>
                  </div>
                )}
                {view.lista_compras?.length > 0 && (
                  <div>
                    <p className="font-medium text-sm mb-1">Lista de compras</p>
                    <p className="text-sm text-muted-foreground">{view.lista_compras.join(' · ')}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {editar && (
        <PlanoDietaEditor plano={editar} pacienteId={pacienteId} onClose={() => setEditar(null)} />
      )}
    </>
  );
}
