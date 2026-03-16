import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface Pagamento {
  id: string;
  descricao: string;
  valor: number;
  forma_pagamento: string;
  status: string;
  created_at: string;
}

interface ResumoFinanceiroProps {
  pagamentos: Pagamento[];
}

export default function ResumoFinanceiro({ pagamentos }: ResumoFinanceiroProps) {
  const totalConfirmado = pagamentos
    .filter(p => p.status === 'confirmado')
    .reduce((s, p) => s + Number(p.valor), 0);

  const totalPendente = pagamentos
    .filter(p => p.status === 'pendente')
    .reduce((s, p) => s + Number(p.valor), 0);

  const totalRecusado = pagamentos
    .filter(p => p.status === 'recusado')
    .reduce((s, p) => s + Number(p.valor), 0);

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  return (
    <div className="grid grid-cols-3 gap-3">
      <Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="p-3 text-center">
          <CheckCircle className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground">Confirmado</p>
          <p className="text-sm font-bold text-emerald-600">{fmt(totalConfirmado)}</p>
        </CardContent>
      </Card>
      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-3 text-center">
          <Clock className="h-4 w-4 text-amber-600 mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground">Pendente</p>
          <p className="text-sm font-bold text-amber-600">{fmt(totalPendente)}</p>
        </CardContent>
      </Card>
      <Card className="border-red-500/20 bg-red-500/5">
        <CardContent className="p-3 text-center">
          <AlertTriangle className="h-4 w-4 text-red-500 mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground">Recusado</p>
          <p className="text-sm font-bold text-red-500">{fmt(totalRecusado)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
