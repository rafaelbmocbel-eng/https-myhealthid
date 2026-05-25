import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Plus, Trash2, Edit3, Receipt, Home, Megaphone, Cpu, Package,
  Landmark, Users, Wrench, MoreHorizontal, RotateCw, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { SectionTitle } from '@/components/ui/section-title';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/skeleton-list';

type Despesa = {
  id: string;
  descricao: string;
  valor: number;
  categoria: string;
  data_despesa: string;
  recorrente: boolean;
  forma_pagamento: string | null;
  observacao: string | null;
};

const CATEGORIAS = [
  { value: 'aluguel', label: 'Aluguel', icon: Home },
  { value: 'marketing', label: 'Marketing', icon: Megaphone },
  { value: 'software', label: 'Software', icon: Cpu },
  { value: 'equipamento', label: 'Equipamento', icon: Wrench },
  { value: 'material', label: 'Material', icon: Package },
  { value: 'imposto', label: 'Imposto', icon: Landmark },
  { value: 'salario', label: 'Salário', icon: Users },
  { value: 'servico', label: 'Serviço', icon: Receipt },
  { value: 'outro', label: 'Outro', icon: MoreHorizontal },
];

const catMeta = (v: string) => CATEGORIAS.find((c) => c.value === v) || CATEGORIAS[CATEGORIAS.length - 1];

const fmtBRL = (v: number) =>
  `R$ ${v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

const emptyForm = (): Partial<Despesa> => ({
  descricao: '',
  valor: 0,
  categoria: 'outro',
  data_despesa: format(new Date(), 'yyyy-MM-dd'),
  recorrente: false,
  forma_pagamento: 'pix',
  observacao: '',
});

export default function DespesasManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [mesOffset, setMesOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Despesa | null>(null);
  const [form, setForm] = useState<Partial<Despesa>>(emptyForm());

  const periodo = useMemo(() => {
    const base = subMonths(new Date(), -mesOffset);
    return {
      ini: format(startOfMonth(base), 'yyyy-MM-dd'),
      fim: format(endOfMonth(base), 'yyyy-MM-dd'),
      label: format(base, "MMMM 'de' yyyy", { locale: ptBR }),
    };
  }, [mesOffset]);

  const { data: despesas = [], isLoading } = useQuery({
    queryKey: ['despesas', user?.id, periodo.ini],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('despesas')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .gte('data_despesa', periodo.ini)
        .lte('data_despesa', periodo.fim)
        .order('data_despesa', { ascending: false });
      if (error) throw error;
      return (data || []) as Despesa[];
    },
  });

  const totals = useMemo(() => {
    const porCat: Record<string, number> = {};
    let total = 0;
    let fixos = 0;
    despesas.forEach((d) => {
      porCat[d.categoria] = (porCat[d.categoria] || 0) + Number(d.valor);
      total += Number(d.valor);
      if (d.recorrente) fixos += Number(d.valor);
    });
    return { porCat, total, fixos, variaveis: total - fixos };
  }, [despesas]);

  const mutSave = useMutation({
    mutationFn: async (payload: Partial<Despesa>) => {
      if (editing) {
        const { error } = await supabase
          .from('despesas')
          .update({
            descricao: payload.descricao,
            valor: payload.valor,
            categoria: payload.categoria,
            data_despesa: payload.data_despesa,
            recorrente: payload.recorrente,
            forma_pagamento: payload.forma_pagamento,
            observacao: payload.observacao,
          })
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('despesas').insert({
          terapeuta_id: user!.id,
          descricao: payload.descricao!,
          valor: payload.valor!,
          categoria: payload.categoria!,
          data_despesa: payload.data_despesa!,
          recorrente: payload.recorrente,
          forma_pagamento: payload.forma_pagamento,
          observacao: payload.observacao,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? 'Despesa atualizada' : 'Despesa registrada');
      qc.invalidateQueries({ queryKey: ['despesas'] });
      qc.invalidateQueries({ queryKey: ['financeiro-kpis-topo'] });
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm());
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  const mutDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('despesas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Despesa removida');
      qc.invalidateQueries({ queryKey: ['despesas'] });
      qc.invalidateQueries({ queryKey: ['financeiro-kpis-topo'] });
    },
  });

  const openEdit = (d: Despesa) => {
    setEditing(d);
    setForm({ ...d });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Navegação mensal */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => setMesOffset((v) => v - 1)} className="gap-1">
          <ChevronLeft className="icon-sm" /> <span className="hidden sm:inline">Anterior</span>
        </Button>
        <p className="text-sm font-semibold capitalize">{periodo.label}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMesOffset((v) => v + 1)}
          disabled={mesOffset >= 0}
          className="gap-1"
        >
          <span className="hidden sm:inline">Próximo</span> <ChevronRight className="icon-sm" />
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="p-3 sm:p-4 border-border/40 shadow-xs">
          <p className="text-[10px] uppercase font-semibold tracking-wide opacity-70 mb-1">Total</p>
          <p className="text-lg sm:text-xl font-bold text-foreground">{fmtBRL(totals.total)}</p>
          <p className="text-[10px] opacity-60 mt-0.5">{despesas.length} {despesas.length === 1 ? 'lançamento' : 'lançamentos'}</p>
        </Card>
        <Card className="p-3 sm:p-4 border-border/40 shadow-xs">
          <p className="text-[10px] uppercase font-semibold tracking-wide opacity-70 mb-1 flex items-center gap-1">
            <RotateCw className="icon-xs" /> Fixos
          </p>
          <p className="text-lg sm:text-xl font-bold text-blue-700 dark:text-blue-300">{fmtBRL(totals.fixos)}</p>
          <p className="text-[10px] opacity-60 mt-0.5">recorrentes</p>
        </Card>
        <Card className="p-3 sm:p-4 border-border/40 shadow-xs">
          <p className="text-[10px] uppercase font-semibold tracking-wide opacity-70 mb-1">Variáveis</p>
          <p className="text-lg sm:text-xl font-bold text-foreground">{fmtBRL(totals.variaveis)}</p>
          <p className="text-[10px] opacity-60 mt-0.5">eventuais</p>
        </Card>
      </div>

      {/* Botão adicionar */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setForm(emptyForm()); } }}>
        <DialogTrigger asChild>
          <Button onClick={openNew} className="w-full gap-2">
            <Plus className="icon-sm" /> Nova despesa
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar despesa' : 'Nova despesa'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Descrição</Label>
              <Input
                value={form.descricao || ''}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Ex: Aluguel sala, Google Ads, etc."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valor ?? ''}
                  onChange={(e) => setForm({ ...form, valor: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  value={form.data_despesa || ''}
                  onChange={(e) => setForm({ ...form, data_despesa: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={form.forma_pagamento || 'pix'} onValueChange={(v) => setForm({ ...form, forma_pagamento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 border border-border/40 rounded-lg">
              <div>
                <Label className="text-sm">Despesa fixa mensal</Label>
                <p className="text-[11px] text-muted-foreground">Marca como custo recorrente</p>
              </div>
              <Switch
                checked={!!form.recorrente}
                onCheckedChange={(v) => setForm({ ...form, recorrente: v })}
              />
            </div>
            <div>
              <Label>Observação (opcional)</Label>
              <Textarea
                value={form.observacao || ''}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => mutSave.mutate(form)}
              disabled={mutSave.isPending || !form.descricao || !form.valor}
            >
              {mutSave.isPending ? 'Salvando...' : (editing ? 'Atualizar' : 'Registrar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lista */}
      {isLoading ? (
        <SkeletonList rows={3} avatar={false} />
      ) : despesas.length === 0 ? (
        <EmptyState
          illustration="inbox"
          title="Nenhuma despesa neste mês"
          description="Registre aluguel, marketing, software e outros custos para acompanhar o lucro real do consultório."
        />
      ) : (
        <div className="space-y-2">
          <SectionTitle title="Lançamentos" description={`${despesas.length} no mês`} />
          {despesas.map((d) => {
            const cat = catMeta(d.categoria);
            const Icon = cat.icon;
            return (
              <Card key={d.id} className="p-3 sm:p-4 border-border/40 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="shrink-0 size-9 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground">
                    <Icon className="icon-sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-sm truncate">{d.descricao}</p>
                      {d.recorrente && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 gap-0.5 border-blue-300 text-blue-700 dark:text-blue-300">
                          <RotateCw className="icon-xs" /> Fixa
                        </Badge>
                      )}
                    </div>
                    <p className="text-micro mt-0.5">
                      {cat.label} · {format(new Date(d.data_despesa + 'T00:00'), 'dd/MM', { locale: ptBR })}
                      {d.forma_pagamento ? ` · ${d.forma_pagamento}` : ''}
                    </p>
                  </div>
                  <p className="font-bold text-sm shrink-0">{fmtBRL(Number(d.valor))}</p>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}>
                      <Edit3 className="icon-xs" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-600 hover:text-red-700"
                      onClick={() => {
                        if (confirm('Remover esta despesa?')) mutDelete.mutate(d.id);
                      }}
                    >
                      <Trash2 className="icon-xs" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
