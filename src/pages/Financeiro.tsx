import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Wallet } from 'lucide-react';
import ControleMensal from '@/components/configuracoes/ControleMensal';
import SessoesSemValor from '@/components/financeiro/SessoesSemValor';

export default function Financeiro() {
  const [mesOffset] = useState(0);

  return (
    <div className="page-container space-y-4 sm:space-y-5">
      <PageHeader
        back
        icon={<Wallet className="icon-md text-primary" />}
        title="Controle Financeiro"
        subtitle="Visão mensal de atendimentos particulares e por plano de saúde, com repasse a parceiros e exportação em PDF."
      />

      <SessoesSemValor mesOffset={mesOffset} />

      <ControleMensal />
    </div>
  );
}
