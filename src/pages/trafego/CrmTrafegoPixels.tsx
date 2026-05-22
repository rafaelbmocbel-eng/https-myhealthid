import { EmptyState } from '@/components/ui/empty-state';
import { Crosshair } from 'lucide-react';

export default function CrmTrafegoPixels() {
  return (
    <div className="p-3 sm:p-5">
      <EmptyState
        icon={<Crosshair className="icon-xl" />}
        title="Pixels de conversão"
        description="Cole seu Meta Pixel ID e GA4 Measurement ID. Eles serão injetados nos seus links públicos para medir conversões. Em breve — Fase 3."
      />
    </div>
  );
}
