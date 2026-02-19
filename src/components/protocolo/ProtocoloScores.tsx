import { Badge } from '@/components/ui/badge';

interface Props {
  scores: Record<string, any>;
}

const SCORE_ITEMS = [
  { key: 'E', label: 'Estrutural', color: 'bg-blue-500' },
  { key: 'P', label: 'Psico-Comp.', color: 'bg-red-500' },
  { key: 'C', label: 'Contextual', color: 'bg-orange-500' },
  { key: 'F', label: 'Biológico', color: 'bg-green-500' },
  { key: 'D', label: 'Dor', color: 'bg-purple-500' },
  { key: 'R', label: 'Regulação', color: 'bg-slate-500' },
  { key: 'EFI', label: 'Funcional.', color: 'bg-teal-500' },
];

export default function ProtocoloScores({ scores }: Props) {
  if (Object.keys(scores).length === 0) return null;

  return (
    <div className="clinical-card mb-6">
      <h3 className="font-semibold mb-4">📊 Scores da Avaliação Base</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
        {SCORE_ITEMS.map(item => {
          const val = (scores[item.key] as number) || 0;
          const pct = Math.min(100, (val / 10) * 100);
          const isAlerta = val >= 7 || (item.key === 'R' && val <= 4) || (item.key === 'EFI' && val <= 4);
          return (
            <div key={item.key} className="flex items-center gap-3">
              <div className="w-24 text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                {item.label}
                {isAlerta && <span className="text-destructive">⚠</span>}
              </div>
              <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                <div className={`h-3 rounded-full ${item.color} transition-all`} style={{ width: `${pct}%` }} />
              </div>
              <div className="w-14 text-right text-xs font-bold text-foreground">{val.toFixed(1)}/10</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
