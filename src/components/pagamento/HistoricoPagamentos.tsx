import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Clock, CheckCircle, XCircle, Filter } from 'lucide-react';
import UploadComprovante from './UploadComprovante';

interface Pagamento {
  id: string;
  descricao: string;
  valor: number;
  forma_pagamento: string;
  status: string;
  created_at: string;
  comprovante_url?: string | null;
}

interface HistoricoPagamentosProps {
  pagamentos: Pagamento[];
  userId: string;
  onRefresh: () => void;
}

const statusConfig: Record<string, { badge: React.ReactNode }> = {
  confirmado: {
    badge: <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 gap-1"><CheckCircle className="h-3 w-3" />Confirmado</Badge>,
  },
  recusado: {
    badge: <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Recusado</Badge>,
  },
  pendente: {
    badge: <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pendente</Badge>,
  },
};

type FilterStatus = 'todos' | 'pendente' | 'confirmado' | 'recusado';

export default function HistoricoPagamentos({ pagamentos, userId, onRefresh }: HistoricoPagamentosProps) {
  const [filter, setFilter] = useState<FilterStatus>('todos');

  if (pagamentos.length === 0) return null;

  const filtered = filter === 'todos' ? pagamentos : pagamentos.filter(p => p.status === filter);

  const filters: { label: string; value: FilterStatus }[] = [
    { label: 'Todos', value: 'todos' },
    { label: 'Pendente', value: 'pendente' },
    { label: 'Confirmado', value: 'confirmado' },
    { label: 'Recusado', value: 'recusado' },
  ];

  return (
    <>
      <Separator />
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Histórico</h2>
          <div className="flex items-center gap-1">
            <Filter className="h-3 w-3 text-muted-foreground" />
            {filters.map(f => (
              <Button
                key={f.value}
                variant={filter === f.value ? 'default' : 'ghost'}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhum pagamento nesta categoria.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <div key={p.id} className="p-3 rounded-xl border border-border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString('pt-BR')} · {p.forma_pagamento === 'pix' ? 'PIX' : 'Cartão'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-foreground">
                      R$ {Number(p.valor).toFixed(2).replace('.', ',')}
                    </span>
                    {(statusConfig[p.status] || statusConfig.pendente).badge}
                  </div>
                </div>
                {p.status === 'pendente' && !p.comprovante_url && (
                  <UploadComprovante pagamentoId={p.id} userId={userId} onUploaded={onRefresh} />
                )}
                {p.comprovante_url && (
                  <p className="text-[10px] text-emerald-600">📎 Comprovante enviado</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
