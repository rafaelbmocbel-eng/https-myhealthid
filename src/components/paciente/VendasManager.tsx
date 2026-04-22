import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Plus, Search, ShoppingCart, CheckCircle, Clock, XCircle, Trash2, Loader2,
  User, Tag, DollarSign, CreditCard, Check, ChevronsUpDown, UserCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type FormaPagamento = 'pix' | 'cartao' | 'dinheiro' | 'transferencia' | 'boleto' | 'link';
type StatusVenda = 'pendente' | 'confirmado' | 'recusado';

interface VendaForm {
  paciente_id: string | null;
  cliente_nome: string;
  vendedor_id: string | null;
  servico: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  forma_pagamento: FormaPagamento;
  status: StatusVenda;
  observacoes: string;
}

const initialForm: VendaForm = {
  paciente_id: null,
  cliente_nome: '',
  vendedor_id: null,
  servico: '',
  descricao: '',
  quantidade: 1,
  valor_unitario: 0,
  forma_pagamento: 'pix',
  status: 'pendente',
  observacoes: '',
};

const SERVICOS_SUGERIDOS = [
  'Sessão de Fisioterapia',
  'Avaliação Inicial',
  'Pacote 10 sessões',
  'Pacote 5 sessões',
  'Consultoria Postural',
  'Laudo Técnico',
  'Palestra/Workshop',
  'E-book / Material Digital',
  'Produto Físico',
  'Outro',
];

export default function VendasManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<VendaForm>(initialForm);
  const [clientePopoverOpen, setClientePopoverOpen] = useState(false);
  const [searchCliente, setSearchCliente] = useState('');

  // Pacientes (clientes)
  const { data: pacientes = [] } = useQuery({
    queryKey: ['vendas-pacientes', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('pacientes')
        .select('id, nome, sobrenome, telefone')
        .eq('terapeuta_id', user!.id)
        .eq('ativo', true)
        .order('nome');
      return data || [];
    },
    enabled: !!user,
  });

  // Membros da equipe (vendedores)
  const { data: equipe = [] } = useQuery({
    queryKey: ['vendas-equipe', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('equipe_membros')
        .select('id, nome, cor')
        .eq('terapeuta_id', user!.id)
        .eq('ativo', true)
        .order('nome');
      return data || [];
    },
    enabled: !!user,
  });

  // Vendas
  const { data: vendas = [], isLoading } = useQuery({
    queryKey: ['vendas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendas')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('data_venda', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const resetForm = () => {
    setForm(initialForm);
    setSearchCliente('');
  };

  const handleSubmit = async () => {
    if (!form.servico.trim() || form.valor_unitario <= 0) {
      toast({ title: 'Preencha serviço e valor', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const pacienteSelecionado = pacientes.find(p => p.id === form.paciente_id);
      const vendedorSelecionado = equipe.find(e => e.id === form.vendedor_id);
      const valor_total = form.quantidade * form.valor_unitario;

      const { error } = await supabase.from('vendas').insert({
        terapeuta_id: user!.id,
        paciente_id: form.paciente_id,
        cliente_nome: pacienteSelecionado
          ? `${pacienteSelecionado.nome} ${pacienteSelecionado.sobrenome || ''}`.trim()
          : form.cliente_nome.trim() || null,
        vendedor_id: form.vendedor_id,
        vendedor_nome: vendedorSelecionado?.nome || null,
        servico: form.servico.trim(),
        descricao: form.descricao.trim() || null,
        quantidade: form.quantidade,
        valor_unitario: form.valor_unitario,
        valor_total,
        forma_pagamento: form.forma_pagamento,
        status: form.status,
        observacoes: form.observacoes.trim() || null,
      });
      if (error) throw error;
      toast({ title: 'Venda registrada! 💰' });
      resetForm();
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['vendas', user?.id] });
    } catch (e: any) {
      toast({ title: 'Erro ao registrar venda', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (id: string, current: StatusVenda) => {
    const next: StatusVenda = current === 'confirmado' ? 'pendente' : 'confirmado';
    try {
      const { error } = await supabase.from('vendas').update({ status: next }).eq('id', id);
      if (error) throw error;
      toast({ title: next === 'confirmado' ? 'Venda confirmada ✅' : 'Marcada como pendente' });
      qc.invalidateQueries({ queryKey: ['vendas', user?.id] });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const deleteVenda = async (id: string) => {
    if (!confirm('Excluir esta venda?')) return;
    try {
      const { error } = await supabase.from('vendas').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Venda excluída' });
      qc.invalidateQueries({ queryKey: ['vendas', user?.id] });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const totals = useMemo(() => {
    const confirmadas = vendas.filter((v: any) => v.status === 'confirmado');
    const pendentes = vendas.filter((v: any) => v.status === 'pendente');
    return {
      totalConfirmado: confirmadas.reduce((s: number, v: any) => s + Number(v.valor_total), 0),
      totalPendente: pendentes.reduce((s: number, v: any) => s + Number(v.valor_total), 0),
      countTotal: vendas.length,
    };
  }, [vendas]);

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
  const valorTotal = form.quantidade * form.valor_unitario;
  const pacienteSel = pacientes.find(p => p.id === form.paciente_id);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border">
          <CardContent className="p-3 text-center">
            <CheckCircle className="h-4 w-4 mx-auto mb-1 text-emerald-600" />
            <div className="text-lg font-black text-emerald-600">{fmt(totals.totalConfirmado)}</div>
            <div className="text-[10px] text-muted-foreground">Confirmado</div>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-3 text-center">
            <Clock className="h-4 w-4 mx-auto mb-1 text-amber-600" />
            <div className="text-lg font-black text-amber-600">{fmt(totals.totalPendente)}</div>
            <div className="text-[10px] text-muted-foreground">Pendente</div>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-3 text-center">
            <ShoppingCart className="h-4 w-4 mx-auto mb-1 text-primary" />
            <div className="text-lg font-black">{totals.countTotal}</div>
            <div className="text-[10px] text-muted-foreground">Vendas</div>
          </CardContent>
        </Card>
      </div>

      {/* Botão nova venda */}
      <Button className="w-full gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white" onClick={() => { resetForm(); setOpen(true); }}>
        <Plus className="h-4 w-4" /> Nova Venda
      </Button>

      {/* Lista */}
      <Card className="border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-primary" />
            Histórico de Vendas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : vendas.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground border rounded-xl border-dashed">
              <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="font-medium text-sm">Nenhuma venda registrada</p>
              <p className="text-xs mt-1">Clique em "Nova Venda" para começar</p>
            </div>
          ) : (
            <div className="space-y-2">
              {vendas.map((v: any) => (
                <div key={v.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/30 transition-colors">
                  <button
                    onClick={() => toggleStatus(v.id, v.status)}
                    className={cn(
                      'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border transition-colors',
                      v.status === 'confirmado'
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600'
                        : 'bg-muted border-border text-muted-foreground hover:border-emerald-400'
                    )}
                    title={v.status === 'confirmado' ? 'Marcar como pendente' : 'Confirmar venda'}
                  >
                    {v.status === 'confirmado' ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">{v.servico}</p>
                      {v.quantidade > 1 && <Badge variant="outline" className="text-[9px] h-4">x{v.quantidade}</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                      {v.cliente_nome && (
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{v.cliente_nome}</span>
                      )}
                      {v.vendedor_nome && (
                        <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" />{v.vendedor_nome}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        {v.forma_pagamento === 'pix' ? 'PIX'
                          : v.forma_pagamento === 'cartao' ? 'Cartão'
                          : v.forma_pagamento === 'dinheiro' ? 'Dinheiro'
                          : v.forma_pagamento === 'transferencia' ? 'Transf.'
                          : v.forma_pagamento === 'boleto' ? 'Boleto'
                          : 'Link'}
                      </span>
                      <span>· {format(new Date(v.data_venda), 'dd/MM/yyyy', { locale: ptBR })}</span>
                    </div>
                    {v.descricao && <p className="text-[11px] text-muted-foreground mt-1 italic truncate">{v.descricao}</p>}
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <p className="text-sm font-black">{fmt(Number(v.valor_total))}</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[9px] gap-0.5',
                        v.status === 'confirmado' && 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
                        v.status === 'pendente' && 'bg-amber-500/15 text-amber-700 border-amber-500/30',
                        v.status === 'recusado' && 'bg-destructive/15 text-destructive border-destructive/30',
                      )}
                    >
                      {v.status === 'confirmado' ? 'Pago' : v.status === 'pendente' ? 'Pendente' : 'Recusado'}
                    </Badge>
                    <Button
                      variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10"
                      onClick={() => deleteVenda(v.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Nova Venda */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-emerald-600" />
              Registrar Nova Venda
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Cliente */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <User className="h-3 w-3" /> Cliente
              </Label>
              <Popover open={clientePopoverOpen} onOpenChange={setClientePopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal h-11 text-base bg-card border-2 border-primary/20 hover:border-primary/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 shadow-sm transition-colors"
                  >
                    {pacienteSel
                      ? `${pacienteSel.nome} ${pacienteSel.sobrenome || ''}`
                      : form.cliente_nome || 'Buscar cliente ou digitar nome...'}
                    <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Buscar paciente..."
                      value={searchCliente}
                      onValueChange={setSearchCliente}
                      className="h-11 text-base"
                    />
                    <CommandList>
                      <CommandEmpty>
                        <div className="p-2 text-xs">
                          <p className="text-muted-foreground mb-2">Nenhum paciente encontrado</p>
                          {searchCliente && (
                            <Button
                              size="sm" variant="outline" className="w-full"
                              onClick={() => {
                                setForm(f => ({ ...f, paciente_id: null, cliente_nome: searchCliente }));
                                setClientePopoverOpen(false);
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" /> Usar "{searchCliente}" como cliente avulso
                            </Button>
                          )}
                        </div>
                      </CommandEmpty>
                      <CommandGroup heading="Pacientes cadastrados">
                        <CommandItem
                          onSelect={() => {
                            setForm(f => ({ ...f, paciente_id: null, cliente_nome: '' }));
                            setClientePopoverOpen(false);
                          }}
                        >
                          <span className="text-muted-foreground italic">— Sem cliente (venda livre)</span>
                        </CommandItem>
                        {pacientes.map(p => (
                          <CommandItem
                            key={p.id}
                            value={`${p.nome} ${p.sobrenome || ''}`}
                            onSelect={() => {
                              setForm(f => ({ ...f, paciente_id: p.id, cliente_nome: '' }));
                              setClientePopoverOpen(false);
                            }}
                          >
                            <Check className={cn('h-3 w-3 mr-2', form.paciente_id === p.id ? 'opacity-100' : 'opacity-0')} />
                            {p.nome} {p.sobrenome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {!form.paciente_id && (
                <Input
                  placeholder="Ou digite nome do cliente avulso..."
                  value={form.cliente_nome}
                  onChange={e => setForm(f => ({ ...f, cliente_nome: e.target.value }))}
                  className="text-xs"
                />
              )}
            </div>

            {/* Serviço */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Tag className="h-3 w-3" /> Serviço / Produto *
              </Label>
              <Select
                value={SERVICOS_SUGERIDOS.includes(form.servico) ? form.servico : 'custom'}
                onValueChange={v => setForm(f => ({ ...f, servico: v === 'custom' ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Escolher tipo..." /></SelectTrigger>
                <SelectContent>
                  {SERVICOS_SUGERIDOS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                  <SelectItem value="custom">✏️ Outro (digitar)</SelectItem>
                </SelectContent>
              </Select>
              {(!SERVICOS_SUGERIDOS.includes(form.servico) || form.servico === '') && (
                <Input
                  placeholder="Digite o nome do serviço/produto"
                  value={form.servico}
                  onChange={e => setForm(f => ({ ...f, servico: e.target.value }))}
                />
              )}
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Descrição (opcional)</Label>
              <Textarea
                rows={2}
                placeholder="Detalhes adicionais..."
                value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              />
            </div>

            {/* Quantidade + Valor */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Qtd</Label>
                <Input
                  type="number" min={1}
                  value={form.quantidade}
                  onChange={e => setForm(f => ({ ...f, quantidade: Math.max(1, Number(e.target.value) || 1) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Valor unit. *
                </Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={form.valor_unitario || ''}
                  onChange={e => setForm(f => ({ ...f, valor_unitario: Number(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Total</Label>
                <div className="h-10 flex items-center justify-center px-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 font-bold text-sm">
                  {fmt(valorTotal)}
                </div>
              </div>
            </div>

            {/* Vendedor */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1">
                <UserCheck className="h-3 w-3" /> Vendedor
              </Label>
              <Select
                value={form.vendedor_id || 'none'}
                onValueChange={v => setForm(f => ({ ...f, vendedor_id: v === 'none' ? null : v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Eu mesmo</SelectItem>
                  {equipe.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: m.cor }} />
                        {m.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {equipe.length === 0 && (
                <p className="text-[10px] text-muted-foreground">
                  Cadastre membros em Configurações → Equipe para atribuir vendas.
                </p>
              )}
            </div>

            {/* Forma pagamento + Status */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1">
                  <CreditCard className="h-3 w-3" /> Forma de pagamento
                </Label>
                <Select
                  value={form.forma_pagamento}
                  onValueChange={(v: FormaPagamento) => setForm(f => ({ ...f, forma_pagamento: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="boleto">Boleto</SelectItem>
                    <SelectItem value="link">Link de pagamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v: StatusVenda) => setForm(f => ({ ...f, status: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">🕐 Pendente</SelectItem>
                    <SelectItem value="confirmado">✅ Pago</SelectItem>
                    <SelectItem value="recusado">✕ Recusado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Observações (opcional)</Label>
              <Textarea
                rows={2}
                placeholder="Notas internas..."
                value={form.observacoes}
                onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              />
            </div>

            {/* Ações */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white gap-1"
                onClick={handleSubmit}
                disabled={submitting || !form.servico.trim() || form.valor_unitario <= 0}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Registrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
