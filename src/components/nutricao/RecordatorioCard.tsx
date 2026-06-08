import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UtensilsCrossed, Plus, Trash2, Save, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

interface Props { pacienteId: string; }

const TIPOS = [
  'Café da manhã', 'Lanche manhã', 'Almoço', 'Lanche tarde', 'Jantar', 'Ceia',
];

type Item = { alimento: string; porcao: string; kcal?: number; p?: number; c?: number; g?: number };
type Refeicao = { tipo: string; horario: string; itens: Item[] };

const empty: Refeicao = { tipo: 'Café da manhã', horario: '07:00', itens: [{ alimento: '', porcao: '' }] };

export default function RecordatorioCard({ pacienteId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [data, setData] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [refeicoes, setRefeicoes] = useState<Refeicao[]>([{ ...empty, itens: [{ alimento: '', porcao: '' }] }]);
  const [observacoes, setObs] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: historico = [] } = useQuery({
    queryKey: ['rec24', pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('recordatorios_24h').select('*')
        .eq('paciente_id', pacienteId)
        .order('data_referencia', { ascending: false }).limit(10);
      return data || [];
    },
  });

  const totais = refeicoes.reduce((acc, r) => {
    r.itens.forEach(i => {
      acc.kcal += Number(i.kcal) || 0;
      acc.p += Number(i.p) || 0;
      acc.c += Number(i.c) || 0;
      acc.g += Number(i.g) || 0;
    });
    return acc;
  }, { kcal: 0, p: 0, c: 0, g: 0 });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sem sessão');
      const payload = {
        paciente_id: pacienteId,
        terapeuta_id: user.id,
        data_referencia: data,
        refeicoes,
        totais,
        observacoes: observacoes || null,
      };
      const { error } = await (supabase as any).from('recordatorios_24h').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Recordatório salvo');
      setRefeicoes([{ ...empty, itens: [{ alimento: '', porcao: '' }] }]);
      setObs('');
      qc.invalidateQueries({ queryKey: ['rec24', pacienteId] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('recordatorios_24h').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Removido'); qc.invalidateQueries({ queryKey: ['rec24', pacienteId] }); },
  });

  const addRef = () => setRefeicoes([...refeicoes, { ...empty, itens: [{ alimento: '', porcao: '' }] }]);
  const removeRef = (i: number) => setRefeicoes(refeicoes.filter((_, idx) => idx !== i));
  const updateRef = (i: number, patch: Partial<Refeicao>) =>
    setRefeicoes(refeicoes.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const addItem = (i: number) =>
    updateRef(i, { itens: [...refeicoes[i].itens, { alimento: '', porcao: '' }] });
  const updateItem = (ri: number, ii: number, patch: Partial<Item>) =>
    updateRef(ri, { itens: refeicoes[ri].itens.map((it, idx) => idx === ii ? { ...it, ...patch } : it) });
  const removeItem = (ri: number, ii: number) =>
    updateRef(ri, { itens: refeicoes[ri].itens.filter((_, idx) => idx !== ii) });

  return (
    <Card className="border-border/40 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <UtensilsCrossed className="icon-sm text-amber-600 shrink-0" />
          Recordatório 24h
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-1">
            <label className="text-xs text-muted-foreground">Data referência</label>
            <Input type="date" value={data} onChange={e => setData(e.target.value)} />
          </div>
          <div className="sm:col-span-3 flex items-end gap-2 flex-wrap">
            <Badge variant="secondary">{totais.kcal.toFixed(0)} kcal</Badge>
            <Badge variant="outline">P {totais.p.toFixed(0)}g</Badge>
            <Badge variant="outline">C {totais.c.toFixed(0)}g</Badge>
            <Badge variant="outline">G {totais.g.toFixed(0)}g</Badge>
          </div>
        </div>

        {refeicoes.map((r, ri) => (
          <div key={ri} className="rounded-lg border border-border/40 p-3 space-y-2">
            <div className="flex gap-2 items-center">
              <Select value={r.tipo} onValueChange={v => updateRef(ri, { tipo: v })}>
                <SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="time" value={r.horario} onChange={e => updateRef(ri, { horario: e.target.value })} className="w-28 h-9" />
              {refeicoes.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => removeRef(ri)}>
                  <Trash2 className="icon-sm text-destructive" />
                </Button>
              )}
            </div>
            {r.itens.map((it, ii) => (
              <div key={ii} className="grid grid-cols-12 gap-1.5">
                <Input className="col-span-5 h-8 text-sm" placeholder="Alimento" value={it.alimento} onChange={e => updateItem(ri, ii, { alimento: e.target.value })} />
                <Input className="col-span-3 h-8 text-sm" placeholder="Porção" value={it.porcao} onChange={e => updateItem(ri, ii, { porcao: e.target.value })} />
                <Input className="col-span-3 h-8 text-sm" placeholder="kcal" type="number" value={it.kcal ?? ''} onChange={e => updateItem(ri, ii, { kcal: Number(e.target.value) || undefined })} />
                <Button variant="ghost" size="icon" className="col-span-1 h-8 w-8" onClick={() => removeItem(ri, ii)}>
                  <Trash2 className="icon-xs text-muted-foreground" />
                </Button>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addItem(ri)}>
              <Plus className="icon-xs mr-1" /> Item
            </Button>
          </div>
        ))}

        <Button variant="outline" size="sm" onClick={addRef} className="w-full">
          <Plus className="icon-sm mr-1" /> Nova refeição
        </Button>

        <Textarea placeholder="Observações (apetite, sintomas, ingestão hídrica…)" value={observacoes} onChange={e => setObs(e.target.value)} rows={2} />

        <Button onClick={() => salvar.mutate()} disabled={salvar.isPending} className="w-full">
          {salvar.isPending ? <Loader2 className="icon-sm mr-2 animate-spin" /> : <Save className="icon-sm mr-2" />}
          Salvar recordatório
        </Button>

        {historico.length > 0 && (
          <div className="pt-2 border-t border-border/40 space-y-1.5">
            <p className="text-caption">Histórico</p>
            {historico.map((h: any) => (
              <div key={h.id} className="rounded-md border border-border/40 text-sm">
                <button onClick={() => setExpandedId(expandedId === h.id ? null : h.id)} className="w-full p-2 flex items-center gap-2">
                  <span className="flex-1 text-left">{format(parseISO(h.data_referencia), 'dd/MM/yyyy')}</span>
                  <Badge variant="secondary" className="text-xs">{h.totais?.kcal?.toFixed(0) || 0} kcal</Badge>
                  {expandedId === h.id ? <ChevronUp className="icon-xs" /> : <ChevronDown className="icon-xs" />}
                </button>
                {expandedId === h.id && (
                  <div className="px-3 pb-3 space-y-2 text-xs">
                    {(h.refeicoes || []).map((r: Refeicao, ri: number) => (
                      <div key={ri}>
                        <p className="font-medium">{r.tipo} · {r.horario}</p>
                        <ul className="list-disc list-inside text-muted-foreground">
                          {r.itens.map((it, ii) => <li key={ii}>{it.alimento} — {it.porcao} {it.kcal ? `(${it.kcal} kcal)` : ''}</li>)}
                        </ul>
                      </div>
                    ))}
                    {h.observacoes && <p className="text-muted-foreground italic">"{h.observacoes}"</p>}
                    <Button variant="ghost" size="sm" onClick={() => excluir.mutate(h.id)} className="h-7 text-xs text-destructive">
                      <Trash2 className="icon-xs mr-1" /> Excluir
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
