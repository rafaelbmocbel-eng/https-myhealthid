import AppLayout from '@/components/AppLayout';
import VitrineConfig from '@/components/configuracoes/VitrineConfig';
import { Store } from 'lucide-react';

export default function Vitrine() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-2">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Store className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-black text-foreground leading-tight">Vitrine</h1>
            <p className="text-xs text-muted-foreground">Apareça para pacientes que buscam um profissional</p>
          </div>
        </div>

        <VitrineConfig />
      </div>
    </AppLayout>
  );
}
