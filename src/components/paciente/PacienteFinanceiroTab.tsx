import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, CheckCircle, Clock, XCircle, DollarSign, Loader2, CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  pacienteId: string;
  pacienteNome: string;
}

export default function PacienteFinanceiroTab({ pacienteId, pacienteNome }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [formaPagamento, setFormaPagamento] = useState('pix');
  const [statusPag, setStatusPag] = useState('pendente');

  const { data: pagamentos = [], isLoading } = useQuery({
    queryKey: ['pagamentos-perfil', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pagamentos_paciente')
        .select('*')
        .eq('paciente_id', pacienteId)
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const handleSubmit = async () => {
    if (!descricao.trim() || !valor) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('pagamentos_paciente').insert({
        paciente_id: pacienteId,
        terapeuta_id: user!.id,
        descricao: descricao.trim(),
        valor: parseFloat(valor),
        forma_pagamento: formaPagamento,
        status: statusPag,
      });
      if (error) throw error;
      toast({ title: 'Pagamento registrado! 💰' });
      setDescricao('');
      setValor('');
      setStatusPag('pendente');
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['pagamentos-perfil', pacienteId] });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (pagId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'confirmado' ? 'pendente' : 'confirmado';
    try {
      const { error } = await supabase
        .from('pagamentos_paciente')
        .update({ status: newStatus })
        .eq('id', pagId);
      if (error) throw error;
      toast({ title: newStatus === 'confirmado' ? 'Marcado como pago ✅' : 'Marcado como pendente' });
      qc.invalidateQueries({ queryKey: ['pagamentos-perfil', pacienteId] });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const totalRecebido = pagamentos
    .filter((p: any) => p.status === 'confirmado')
    .reduce((sum: number, p: any) => sum + Number(p.valor), 0);

  const totalPendente = pagamentos
    .filter((p: any) => p.status === 'pendente')
    .reduce((sum: number, p: any) => sum + Number(p.valor), 0);

  const statusConfig: Record<string, { icon: React.ReactNode; badge: string; color: string }> = {
    confirmado: { icon: <CheckCircle className="h-3 w-3" />, badge: 'Pago', color: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' },
    pendente: { icon: <Clock className="h-3 w-3" />, badge: 'Pendente', color: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
    recusado: { icon: <XCircle className="h-3 w-3" />, badge: 'Recusado', color: 'bg-destructive/15 text-destructive border-destructive/30' },
  };

  return (
    <div className="space-y-4">
      {/* KPI resumo */}
      <div className="grid grid-cols-2 gap-2">
        <div className="clinical-card !p-3 text-center">
          <DollarSign className="h-4 w-4 mx-auto mb-1 text-emerald-600" />
          <div className="text-lg font-bold text-emerald-600">R$ {totalRecebido.toFixed(2).replace('.', ',')}</div>
          <div className="text-[10px] text-muted-foreground">Recebido</div>
        </div>
        <div className="clinical-card !p-3 text-center">
          <Clock className="h-4 w-4 mx-auto mb-1 text-amber-600" />
          <div className="text-lg font-bold text-amber-600">R$ {totalPendente.toFixed(2).replace('.', ',')}</div>
          <div className="text-[10px] text-muted-foreground">Pendente</div>
        </div>
      </div>

      {/* Botão novo */}
      <Button size="sm" className="gap-1.5 w-full" onClick={() => setShowForm(!showForm)}>
        <Plus className="h-3.5 w-3.5" /> Nova Cobrança
      </Button>

      {/* Form */}
      {showForm && (
        <div className="clinical-card !p-4 space-y-3">
          <Input placeholder="Descrição (ex: Sessão Fisioterapia)" value={descricao} onChange={e => setDescricao(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" placeholder="Valor (R$)" value={valor} onChange={e => setValor(e.target.value)} min="0" step="0.01" />
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Select value={statusPag} onValueChange={setStatusPag}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">🕐 Pendente</SelectItem>
              <SelectItem value="confirmado">✅ Pago</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 gap-1" onClick={handleSubmit} disabled={submitting || !descricao || !valor}>
              {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
              Registrar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : pagamentos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed">
          <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum pagamento registrado</p>
          <p className="text-sm mt-1">Crie uma cobrança para começar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pagamentos.map((p: any) => {
            const cfg = statusConfig[p.status] || statusConfig.pendente;
            return (
              <div key={p.id} className="clinical-card !p-3 flex items-center gap-3">
                <button
                  onClick={() => toggleStatus(p.id, p.status)}
                  className={cn(
                    'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border transition-colors',
                    p.status === 'confirmado' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600' : 'bg-muted border-border text-muted-foreground hover:border-emerald-400'
                  )}
                  title={p.status === 'confirmado' ? 'Marcar como pendente' : 'Marcar como pago'}
                >
                  {p.status === 'confirmado' ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.descricao}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString('pt-BR')} · {p.forma_pagamento === 'pix' ? 'PIX' : p.forma_pagamento === 'cartao' ? 'Cartão' : p.forma_pagamento === 'dinheiro' ? 'Dinheiro' : 'Transf.'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">R$ {Number(p.valor).toFixed(2).replace('.', ',')}</p>
                  <Badge variant="outline" className={cn('text-[9px] gap-0.5', cfg.color)}>
                    {cfg.icon} {cfg.badge}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
