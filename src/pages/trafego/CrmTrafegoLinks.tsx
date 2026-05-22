import { EmptyState } from '@/components/ui/empty-state';
import { Link2 } from 'lucide-react';

export default function CrmTrafegoLinks() {
  return (
    <div className="p-3 sm:p-5">
      <EmptyState
        icon={<Link2 className="icon-xl" />}
        title="Gerador de links UTM"
        description="Crie links rastreáveis para Instagram, Google Ads, e-mail e mais. Em breve aqui — peça para liberar a Fase 2 quando quiser."
      />
    </div>
  );
}
