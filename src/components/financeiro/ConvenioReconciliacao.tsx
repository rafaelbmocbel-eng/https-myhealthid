import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useConvenios } from '@/hooks/useConvenios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import { format, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Building2, CheckCircle2, Clock, AlertTriangle, FileCheck2 } from 'lucide-react';
import { SectionTitle } from '@/components/ui/section-title';

type SessaoConv = {
  id: string;
  data_sessao: string;
  valor_cobrado: number | null;
  convenio_id: string | null;
  paciente_id: string | null;
  pacientes?: { nome: string; sobrenome: string | null } | null;
};

const fmtBRL = (v: number) =>
  `R$ ${v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

export default function ConvenioReconciliacao() {
  const { user } = useAuth();
  const { convenios } = useConvenios();
  const qc = useQueryClient();
  const [loteOpen, setLoteOpen] = useState<string | null>(null); // convenio_id
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [loteRef, setLoteRef] = useState('');
  const [loteObs, setLoteObs] = useState('');

  const { data: sessoes = [], isLoading } = useQuery({
    queryKey: ['convenio-pendentes', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('controle_sessoes')
        .select('id, data_sessao, valor_cobrado, convenio_id, paciente_id, pacientes(nome, sobrenome)')
        .eq('terapeuta_id', user!.id)
        .eq('status', 'realizada')
        .eq('status_pagamento', 'pendente')
        .not('convenio_id', 'is', null)
        .gt('valor_cobrado', 0)
        .order('data_sessao', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as SessaoConv[];
    },
  });

  const grupos = useMemo(() => {
    const map = new Map<string, { sessoes: SessaoConv[]; total: number; maisAntiga: number }>();
    const today = new Date();
    sessoes.forEach((s) => {
      if (!s.convenio_id) return;
      const g = map.get(s.convenio_id) || { sessoes: [], total: 0, maisAntiga: 0 };
      g.sessoes.push(s);
      g.total += Number(s.valor_cobrado) || 0;
      const dias = differenceInCalendarDays(today, new Date(s.data_sessao));
      if (dias > g.maisAntiga) g.maisAntiga = dias;
      map.set(s.convenio_id, g);
    });
    return map;
  }, [sessoes]);

  const mutLote = useMutation({
    mutationFn: async ({ ids, ref, obs }: { ids: string[]; ref: string; obs: string }) => {
      const observacao = [ref ? `Lote: ${ref}` : null, obs || null].filter(Boolean).join(' · ') || null;
      const { error } = await supabase
        .from('controle_sessoes')
        .update({
          status_pagamento: 'pago',
          forma_recebimento: 'convenio',
          observacao_pagamento: observacao,
        })
        .in('id', ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} ${count === 1 ? 'sessão recebida' : 'sessões recebidas'} no lote`);
      qc.invalidateQueries({ queryKey: ['convenio-pendentes'] });
      qc.invalidateQueries({ queryKey: ['a-receber'] });
      qc.invalidateQueries({ queryKey: ['financeiro-kpis-topo'] });
      setLoteOpen(null);
      setSelecionadas(new Set());
      setLoteRef('');
      setLoteObs('');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  const abrirLote = (convenioId: string) => {
    const g = grupos.get(convenioId);
    if (!g) return;
    setSelecionadas(new Set(g.sessoes.map((s) => s.id)));
    setLoteOpen(convenioId);
  };

  const toggleSel = (id: string) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const conveniosComPendencias = convenios.filter((c) => grupos.has(c.id));
  const semVinculo = convenios.length > 0 && conveniosComPendencias.length === 0;

  if (isLoading) {
    return <p className="text-caption">Carregando…</p>;
  }

  if (conveniosComPendencias.length === 0) {
    return (
      <Card className="p-4 sm:p-5 border-border/40 shadow-xs">
        <div className="flex items-center gap-3 text-muted-foreground">
          <CheckCircle2 className="icon-md text-emerald-600 shrink-0" />
          <div>
            <p className="font-semibold text-foreground">Nada a conciliar</p>
            <p className="text-caption mt-0.5">
              {semVinculo
                ? 'Não há sessões com convênio pendentes de recebimento.'
                : 'Cadastre convênios e vincule sessões para conciliar lotes aqui.'}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-5 border-border/40 shadow-xs">
      <SectionTitle
        icon={<FileCheck2 className="icon-sm text-primary" />}
        title="Conciliação de lotes"
        description="Marque sessões pagas por convênio em massa"
      />

      <Accordion type="multiple" className="space-y-2">
        {conveniosComPendencias.map((conv) => {
          const g = grupos.get(conv.id)!;
          const prazoAlerta = g.maisAntiga > (conv.prazo_repasse_dias ?? 30);
          return (
            <AccordionItem key={conv.id} value={conv.id} className="border border-border/40 rounded-lg px-3">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <Building2 className="icon-sm text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{conv.nome}</p>
                    <p className="text-micro mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>{g.sessoes.length} {g.sessoes.length === 1 ? 'sessão' : 'sessões'}</span>
                      <span>·</span>
                      <span className="font-semibold text-foreground">{fmtBRL(g.total)}</span>
                      {prazoAlerta ? (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 gap-0.5 border-red-300 text-red-700 dark:text-red-300">
                          <AlertTriangle className="icon-xs" /> {g.maisAntiga}d · acima do prazo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 gap-0.5 border-amber-300 text-amber-700 dark:text-amber-300">
                          <Clock className="icon-xs" /> {g.maisAntiga}d
                        </Badge>
                      )}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-3">
                <div className="space-y-1 mb-3">
                  {g.sessoes.map((s) => {
                    const dias = differenceInCalendarDays(new Date(), new Date(s.data_sessao));
                    const nome = `${s.pacientes?.nome || '—'} ${s.pacientes?.sobrenome || ''}`.trim();
                    return (
                      <div key={s.id} className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted/30">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{nome}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(s.data_sessao), 'dd/MM/yyyy', { locale: ptBR })} · {dias}d
                          </p>
                        </div>
                        <p className="font-semibold text-sm shrink-0">{fmtBRL(Number(s.valor_cobrado) || 0)}</p>
                      </div>
                    );
                  })}
                </div>
                <Button
                  size="sm"
                  className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => abrirLote(conv.id)}
                >
                  <CheckCircle2 className="icon-sm" />
                  Receber lote ({fmtBRL(g.total)})
                </Button>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Dialog: confirmar lote */}
      <Dialog open={!!loteOpen} onOpenChange={(o) => !o && setLoteOpen(null)}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck2 className="icon-sm text-emerald-600" />
              Confirmar recebimento em lote
            </DialogTitle>
          </DialogHeader>
          {loteOpen && (() => {
            const g = grupos.get(loteOpen);
            if (!g) return null;
            const totalSel = g.sessoes
              .filter((s) => selecionadas.has(s.id))
              .reduce((a, s) => a + (Number(s.valor_cobrado) || 0), 0);
            return (
              <div className="space-y-3">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3">
                  <p className="text-caption">Selecionadas</p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                    {selecionadas.size} {selecionadas.size === 1 ? 'sessão' : 'sessões'} · {fmtBRL(totalSel)}
                  </p>
                </div>

                <div className="border border-border/40 rounded-lg max-h-48 overflow-y-auto divide-y divide-border/40">
                  {g.sessoes.map((s) => {
                    const nome = `${s.pacientes?.nome || '—'} ${s.pacientes?.sobrenome || ''}`.trim();
                    return (
                      <label key={s.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/30">
                        <Checkbox
                          checked={selecionadas.has(s.id)}
                          onCheckedChange={() => toggleSel(s.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{nome}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(s.data_sessao), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        </div>
                        <p className="text-sm font-semibold">{fmtBRL(Number(s.valor_cobrado) || 0)}</p>
                      </label>
                    );
                  })}
                </div>

                <div>
                  <Label>Nº do lote / NF (opcional)</Label>
                  <Input
                    value={loteRef}
                    onChange={(e) => setLoteRef(e.target.value)}
                    placeholder="Ex: Lote 2025-11 ou NF 4521"
                  />
                </div>
                <div>
                  <Label>Observação (opcional)</Label>
                  <Textarea
                    value={loteObs}
                    onChange={(e) => setLoteObs(e.target.value)}
                    rows={2}
                    placeholder="Glosas, valores ajustados..."
                  />
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoteOpen(null)}>Cancelar</Button>
            <Button
              disabled={mutLote.isPending || selecionadas.size === 0}
              onClick={() => mutLote.mutate({ ids: Array.from(selecionadas), ref: loteRef, obs: loteObs })}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {mutLote.isPending ? 'Processando...' : `Receber ${selecionadas.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
