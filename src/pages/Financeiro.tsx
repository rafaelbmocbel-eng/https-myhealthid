import { PageHeader } from '@/components/ui/page-header';
import { Wallet } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ControleMensal from '@/components/configuracoes/ControleMensal';
import SessoesSemValor from '@/components/financeiro/SessoesSemValor';
import ConveniosManager from '@/components/financeiro/ConveniosManager';
import RepasseConfigManager from '@/components/financeiro/RepasseConfigManager';
import FechamentoProfissional from '@/components/financeiro/FechamentoProfissional';
import BreakdownVisual from '@/components/financeiro/BreakdownVisual';

export default function Financeiro({ embedded = false }: { embedded?: boolean } = {}) {
  return (
    <div className={embedded ? 'space-y-4 sm:space-y-5' : 'page-container space-y-4 sm:space-y-5'}>
      {!embedded && (
        <PageHeader
          back
          icon={<Wallet className="icon-md text-primary" />}
          title="Controle Financeiro"
          subtitle="Visão mensal de atendimentos particulares e por plano, com fechamento e recibo individual por profissional."
        />
      )}

      <Tabs defaultValue="mensal" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="mensal">Mensal</TabsTrigger>
          <TabsTrigger value="analise">Análise</TabsTrigger>
          <TabsTrigger value="fechamento">Fechamento</TabsTrigger>
          <TabsTrigger value="convenios">Convênios</TabsTrigger>
          <TabsTrigger value="repasses">Repasses</TabsTrigger>
        </TabsList>

        <TabsContent value="mensal" className="space-y-4 sm:space-y-5 mt-4">
          <SessoesSemValor mesOffset={0} />
          <ControleMensal />
        </TabsContent>

        <TabsContent value="analise" className="mt-4">
          <BreakdownVisual />
        </TabsContent>

        <TabsContent value="fechamento" className="mt-4">
          <FechamentoProfissional />
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
