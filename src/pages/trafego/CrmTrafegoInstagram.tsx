import { EmptyState } from '@/components/ui/empty-state';
import { Instagram } from 'lucide-react';

export default function CrmTrafegoInstagram() {
  return (
    <div className="p-3 sm:p-5">
      <EmptyState
        icon={<Instagram className="icon-xl" />}
        title="Instagram em breve"
        description="Conecte sua conta Instagram Profissional para publicar, agendar posts, ver insights e receber DMs direto na inbox. Esta integração exige configuração de um app Meta — me peça para liberar quando estiver pronto."
      />
    </div>
  );
}
