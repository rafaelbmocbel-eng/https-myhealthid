import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, Clock, AlertTriangle, Flame, MessageCircle, DollarSign } from 'lucide-react';
import { SectionTitle } from '@/components/ui/section-title';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/skeleton-list';

type Sessao = {
  id: string;
  data_sessao: string;
  valor_cobrado: number | null;
  status_pagamento: string;
  data_recebimento: string | null;
  forma_recebimento: string | null;
  observacao_pagamento: string | null;
  paciente_id: string | null;
  pacientes?: { nome: string; sobrenome: string | null; telefone: string | null } | null;
};

type Bucket = '0-30' | '31-60' | '61-90' | '90+';
const BUCKETS: { key: Bucket; label: string; tone: string; icon: any }[] = [
  { key: '0-30', label: '0-30 dias', tone: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300', icon: Clock },
  { key: '31-60', label: '31-60 dias', tone: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300', icon: AlertTriangle },
  { key: '61-90', label: '61-90 dias', tone: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300', icon: AlertTriangle },
  { key: '90+', label: '90+ dias', tone: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300', icon: Flame },
];

function bucketOf(dias: number): Bucket {
  if (dias <= 30) return '0-30';
  if (dias <= 60) return '31-60';
  if (dias <= 90) return '61-90';
  return '90+';
}

const fmtBRL = (v: number) =>
  `R$ ${v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

export default function AReceber() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [marcarPagoId, setMarcarPagoId] = useState<string | null>(null);
  const [formaRecebimento, setFormaRecebimento] = useState('pix');
  const [observacao, setObservacao] = useState('');

  const { data: sessoes = [], isLoading } = useQuery({
    queryKey: ['a-receber', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('controle_sessoes')
        .select(`
          id, data_sessao, valor_cobrado, status_pagamento, data_recebimento,
          forma_recebimento, observacao_pagamento, paciente_id,
          pacientes(nome, sobrenome, telefone)
        `)
        .eq('terapeuta_id', user!.id)
        .eq('status', 'realizada')
        .eq('status_pagamento', 'pendente')
        .gt('valor_cobrado', 0)
        .order('data_sessao', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Sessao[];
    },
  });

  const buckets = useMemo(() => {
    const today = new Date();
    const grouped: Record<Bucket, Sessao[]> = { '0-30': [], '31-60': [], '61-90': [], '90+': [] };
    const totals: Record<Bucket, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    sessoes.forEach((s) => {
      const dias = differenceInCalendarDays(today, new Date(s.data_sessao));
      const b = bucketOf(dias);
      grouped[b].push(s);
      totals[b] += Number(s.valor_cobrado) || 0;
    });
    return { grouped, totals, totalGeral: sessoes.reduce((a, s) => a + (Number(s.valor_cobrado) || 0), 0) };
  }, [sessoes]);

  const mutMarcarPago = useMutation({
    mutationFn: async ({ id, forma, obs }: { id: string; forma: string; obs: string }) => {
      const { error } = await supabase
        .from('controle_sessoes')
        .update({
          status_pagamento: 'pago',
          forma_recebimento: forma,
          observacao_pagamento: obs || null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Pagamento registrado');
      qc.invalidateQueries({ queryKey: ['a-receber'] });
      qc.invalidateQueries({ queryKey: ['financeiro-kpis-topo'] });
      setMarcarPagoId(null);
      setObservacao('');
      setFormaRecebimento('pix');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  const cobrarWhatsApp = (s: Sessao) => {
    const tel = s.pacientes?.telefone?.replace(/\D/g, '');
    if (!tel) {
      toast.error('Paciente sem telefone');
      return;
    }
    const nome = s.pacientes?.nome || 'Olá';
    const dataFmt = format(new Date(s.data_sessao), "dd/MM/yyyy", { locale: ptBR });
    const valor = fmtBRL(Number(s.valor_cobrado) || 0);
    const msg = `Olá ${nome}! Passando para lembrar do pagamento da sessão de ${dataFmt} (${valor}). Se já realizou, por favor me avise. Obrigado!`;
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  if (isLoading) {
    return <div className="text-center py-8 text-sm text-muted-foreground">Carregando...</div>;
  }

  if (sessoes.length === 0) {
    return (
      <EmptyState
        illustration="spark"
        title="Nada a receber"
        description="Todas as sessões com valor estão marcadas como pagas. Quando registrar novas sessões particulares, elas aparecerão aqui automaticamente."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header totais */}
      <Card className="p-4 sm:p-5 border-border/40 shadow-xs">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-caption mb-1">Total a receber</p>
            <p className="text-2xl sm:text-3xl font-bold text-foreground">{fmtBRL(buckets.totalGeral)}</p>
            <p className="text-micro mt-1">{sessoes.length} {sessoes.length === 1 ? 'sessão pendente' : 'sessões pendentes'}</p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {BUCKETS.map((b) => (
              <div key={b.key} className={`rounded-lg border px-2 py-1.5 ${b.tone}`}>
                <p className="text-[9px] uppercase font-bold tracking-wide opacity-80">{b.label}</p>
                <p className="text-xs sm:text-sm font-bold">{fmtBRL(buckets.totals[b.key])}</p>
                <p className="text-[9px] opacity-70">{buckets.grouped[b.key].length}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Listas por bucket */}
      {BUCKETS.map((b) => {
        const lista = buckets.grouped[b.key];
        if (lista.length === 0) return null;
        const Icon = b.icon;
        return (
          <div key={b.key} className="space-y-2">
            <SectionTitle
              icon={<Icon className="icon-sm" />}
              title={b.label}
              description={`${lista.length} ${lista.length === 1 ? 'sessão' : 'sessões'}`}
            />
            <div className="space-y-2">
              {lista.map((s) => {
                const dias = differenceInCalendarDays(new Date(), new Date(s.data_sessao));
                const nome = `${s.pacientes?.nome || 'Paciente'} ${s.pacientes?.sobrenome || ''}`.trim();
                return (
                  <Card key={s.id} className="p-3 sm:p-4 border-border/40 shadow-xs">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm truncate">{nome}</p>
                        <p className="text-micro mt-0.5">
                          {format(new Date(s.data_sessao), "dd/MM/yyyy", { locale: ptBR })} ·{' '}
                          <span className="font-medium">{dias}d atrás</span>
                        </p>
                      </div>
                      <Badge variant="outline" className={b.tone}>
                        {fmtBRL(Number(s.valor_cobrado) || 0)}
                      </Badge>
                      <div className="flex gap-1.5">
                        {s.pacientes?.telefone && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => cobrarWhatsApp(s)}
                            className="h-8 gap-1"
                          >
                            <MessageCircle className="icon-xs" />
                            <span className="hidden sm:inline">Cobrar</span>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => setMarcarPagoId(s.id)}
                          className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckCircle2 className="icon-xs" />
                          <span className="hidden sm:inline">Recebi</span>
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Dialog: confirmar recebimento */}
      <Dialog open={!!marcarPagoId} onOpenChange={(o) => !o && setMarcarPagoId(null)}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="icon-sm text-emerald-600" />
              Registrar recebimento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Forma de recebimento</Label>
              <Select value={formaRecebimento} onValueChange={setFormaRecebimento}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="convenio">Convênio</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observação (opcional)</Label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: comprovante enviado, lote Unimed agosto..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarcarPagoId(null)}>Cancelar</Button>
            <Button
              onClick={() => marcarPagoId && mutMarcarPago.mutate({ id: marcarPagoId, forma: formaRecebimento, obs: observacao })}
              disabled={mutMarcarPago.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {mutMarcarPago.isPending ? 'Salvando...' : 'Confirmar recebimento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
