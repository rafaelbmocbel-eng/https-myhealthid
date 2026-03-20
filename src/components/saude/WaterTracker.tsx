import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Droplets, Plus } from 'lucide-react';
import type { WaterLog } from '@/hooks/useHealthData';

interface Props {
  water: WaterLog | null;
  onAdd: (ml: number) => void;
}

const quickAmounts = [
  { ml: 150, label: '150ml', icon: '🥤' },
  { ml: 250, label: '250ml', icon: '🥛' },
  { ml: 350, label: '350ml', icon: '🫗' },
  { ml: 500, label: '500ml', icon: '🍶' },
];

export default function WaterTracker({ water, onAdd }: Props) {
  const amount = water?.amount_ml || 0;
  const goal = water?.goal_ml || 2000;
  const pct = Math.min(100, (amount / goal) * 100);
  const entries = water?.entries || [];

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-cyan-500" />
          <h3 className="text-sm font-bold text-foreground">Água</h3>
        </div>

        {/* Visual water level */}
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-24 rounded-2xl border-2 border-cyan-300 dark:border-cyan-700 overflow-hidden bg-muted/30">
            <div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-cyan-500 to-cyan-300 transition-all duration-700 ease-out rounded-b-xl"
              style={{ height: `${pct}%` }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-black text-foreground drop-shadow">{Math.round(pct)}%</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="text-2xl font-black text-foreground">{amount}<span className="text-sm font-normal text-muted-foreground">ml</span></div>
            <div className="text-[10px] text-muted-foreground">Meta: {goal}ml</div>
            <div className="text-[10px] text-muted-foreground mt-1">
              {amount >= goal ? '🎉 Meta atingida!' : `Faltam ${goal - amount}ml`}
            </div>
          </div>
        </div>

        {/* Quick add buttons */}
        <div className="grid grid-cols-4 gap-2">
          {quickAmounts.map(({ ml, label, icon }) => (
            <Button
              key={ml}
              variant="outline"
              className="flex-col h-auto py-2 text-xs gap-0.5"
              onClick={() => onAdd(ml)}
            >
              <span className="text-base">{icon}</span>
              <span className="font-semibold">+{label}</span>
            </Button>
          ))}
        </div>

        {/* Recent entries */}
        {entries.length > 0 && (
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-muted-foreground">Hoje</span>
            <div className="flex flex-wrap gap-1">
              {entries.slice(-8).map((e: any, i: number) => (
                <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300">
                  {e.time} · {e.ml}ml
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
