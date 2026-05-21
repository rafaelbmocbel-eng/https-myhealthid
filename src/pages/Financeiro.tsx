import { PageHeader } from '@/components/ui/page-header';
import { Wallet } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ControleMensal from '@/components/configuracoes/ControleMensal';
import SessoesSemValor from '@/components/financeiro/SessoesSemValor';
import ConveniosManager from '@/components/financeiro/ConveniosManager';
import RepasseConfigManager from '@/components/financeiro/RepasseConfigManager';

export default function Financeiro() {
  return (
    <div className="page-container space-y-4 sm:space-y-5">
      <PageHeader
        back
        icon={<Wallet className="icon-md text-primary" />}
        title="Controle Financeiro"
        subtitle="Visão mensal de atendimentos particulares e por plano de saúde, com repasse por profissional e exportação em PDF."
      />

      <Tabs defaultValue="mensal" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="mensal">Mensal</TabsTrigger>
          <TabsTrigger value="convenios">Convênios</TabsTrigger>
          <TabsTrigger value="repasses">Repasses</TabsTrigger>
        </TabsList>

        <TabsContent value="mensal" className="space-y-4 sm:space-y-5 mt-4">
          <SessoesSemValor mesOffset={0} />
          <ControleMensal />
        </TabsContent>

        <TabsContent value="convenios" className="mt-4">
          <ConveniosManager />
        </TabsContent>

        <TabsContent value="repasses" className="mt-4">
          <RepasseConfigManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
