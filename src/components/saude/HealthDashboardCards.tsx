import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Footprints, Heart, Moon, Droplets, Scale, Flame, Activity, Wind, Plus } from 'lucide-react';
import HealthRing from './HealthRing';
import type { HealthMetrics, SleepLog, WaterLog, BodyComposition } from '@/hooks/useHealthData';

interface Props {
  metrics: HealthMetrics | null;
  sleep: SleepLog | null;
  water: WaterLog | null;
  body: BodyComposition | null;
  onAddWater: (ml: number) => void;
  onNavigate: (section: string) => void;
}

export default function HealthDashboardCards({ metrics, sleep, water, body, onAddWater, onNavigate }: Props) {
  const steps = metrics?.steps || 0;
  const stepsGoal = 10000;
  const calories = metrics?.calories_burned || 0;
  const heartRate = metrics?.heart_rate_avg || 0;
  const spo2 = metrics?.spo2_avg || 0;
  const activeMin = metrics?.active_minutes || 0;
  const sleepHours = sleep?.total_hours || 0;
  const waterMl = water?.amount_ml || 0;
  const waterGoal = water?.goal_ml || 2000;
  const weight = body?.weight_kg;
  const bmi = body?.bmi;

  return (
    <div className="space-y-3">
      {/* Activity Rings - Samsung Health style */}
      <Card className="border-0 shadow-md overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-foreground">Atividade diária</h3>
            <span className="text-[10px] text-muted-foreground">Hoje</span>
          </div>
          <div className="flex justify-around">
            <HealthRing
              value={steps} max={stepsGoal} size={80} strokeWidth={7}
              color="hsl(var(--primary))" label="Passos"
              displayValue={steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : String(steps)}
              icon={<Footprints className="h-3 w-3 text-primary" />}
            />
            <HealthRing
              value={calories} max={500} size={80} strokeWidth={7}
              color="#f97316" label="Calorias"
              displayValue={String(calories)}
              unit="kcal"
              icon={<Flame className="h-3 w-3 text-orange-500" />}
            />
            <HealthRing
              value={activeMin} max={60} size={80} strokeWidth={7}
              color="#10b981" label="Ativo"
              displayValue={String(activeMin)}
              unit="min"
              icon={<Activity className="h-3 w-3 text-emerald-500" />}
            />
          </div>
        </CardContent>
      </Card>

      {/* Health vitals row */}
      <div className="grid grid-cols-2 gap-2">
        {/* Heart Rate */}
        <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onNavigate('heart')}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Heart className="icon-sm text-red-500" />
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground">Freq. Cardíaca</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-foreground">{heartRate || '—'}</span>
              <span className="text-[10px] text-muted-foreground">bpm</span>
            </div>
            {metrics?.heart_rate_resting && (
              <span className="text-[9px] text-muted-foreground">Repouso: {metrics.heart_rate_resting} bpm</span>
            )}
          </CardContent>
        </Card>

        {/* SpO2 */}
        <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onNavigate('spo2')}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Wind className="icon-sm text-blue-500" />
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground">SpO₂</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-foreground">{spo2 || '—'}</span>
              <span className="text-[10px] text-muted-foreground">%</span>
            </div>
          </CardContent>
        </Card>

        {/* Sleep */}
        <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => onNavigate('sleep')}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <Moon className="icon-sm text-indigo-500" />
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground">Sono</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-foreground">{sleepHours || '—'}</span>
              <span className="text-[10px] text-muted-foreground">horas</span>
            </div>
            {sleep?.sleep_quality && (
              <div className="flex gap-0.5 mt-0.5">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${i <= sleep.sleep_quality! ? 'bg-indigo-500' : 'bg-muted'}`} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Water */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                  <Droplets className="icon-sm text-cyan-500" />
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground">Água</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onAddWater(250)}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-foreground">{waterMl}</span>
              <span className="text-[10px] text-muted-foreground">/ {waterGoal}ml</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (waterMl / waterGoal) * 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Body Composition */}
      <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => onNavigate('body')}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Scale className="icon-sm text-purple-500" />
            </div>
            <span className="text-xs font-bold text-foreground">Composição Corporal</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <span className="text-lg font-black text-foreground block">{weight ? `${weight}` : '—'}</span>
              <span className="text-[9px] text-muted-foreground">kg</span>
            </div>
            <div className="text-center">
              <span className="text-lg font-black text-foreground block">{bmi ? `${bmi}` : '—'}</span>
              <span className="text-[9px] text-muted-foreground">IMC</span>
            </div>
            <div className="text-center">
              <span className="text-lg font-black text-foreground block">
                {body?.body_fat_pct ? `${body.body_fat_pct}%` : '—'}
              </span>
              <span className="text-[9px] text-muted-foreground">Gordura</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
