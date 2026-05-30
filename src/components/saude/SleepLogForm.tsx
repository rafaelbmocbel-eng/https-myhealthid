import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Moon, Save } from 'lucide-react';
import { toast } from 'sonner';
import type { SleepLog } from '@/hooks/useHealthData';

interface Props {
  current: SleepLog | null;
  onSave: (data: Partial<SleepLog>) => Promise<any>;
}

export default function SleepLogForm({ current, onSave }: Props) {
  const [totalHours, setTotalHours] = useState(current?.total_hours || 7);
  const [deepHours, setDeepHours] = useState(current?.deep_sleep_hours || 0);
  const [remHours, setRemHours] = useState(current?.rem_sleep_hours || 0);
  const [quality, setQuality] = useState(current?.sleep_quality || 3);
  const [bedtime, setBedtime] = useState(current?.bedtime ? current.bedtime.slice(11, 16) : '23:00');
  const [wakeTime, setWakeTime] = useState(current?.wake_time ? current.wake_time.slice(11, 16) : '07:00');
  const [saving, setSaving] = useState(false);

  const qualityLabels = ['', 'Péssimo', 'Ruim', 'OK', 'Bom', 'Excelente'];
  const qualityEmojis = ['', '😫', '😞', '😐', '😊', '🌟'];

  const handleSave = async () => {
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    const err = await onSave({
      total_hours: totalHours,
      deep_sleep_hours: deepHours || null,
      rem_sleep_hours: remHours || null,
      light_sleep_hours: totalHours - (deepHours || 0) - (remHours || 0) > 0
        ? Math.round((totalHours - (deepHours || 0) - (remHours || 0)) * 10) / 10
        : null,
      sleep_quality: quality,
      bedtime: `${today}T${bedtime}:00`,
      wake_time: `${today}T${wakeTime}:00`,
    });
    setSaving(false);
    if (!err) toast.success('Sono registrado!');
    else toast.error('Erro ao salvar');
  };

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Moon className="h-5 w-5 text-indigo-500" />
          <h3 className="text-sm font-bold text-foreground">Registro de Sono</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px]">Dormiu às</Label>
            <Input type="time" value={bedtime} onChange={e => setBedtime(e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-[10px]">Acordou às</Label>
            <Input type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>

        <div>
          <Label className="text-[10px]">Total de horas: {totalHours}h</Label>
          <Slider value={[totalHours]} onValueChange={([v]) => setTotalHours(v)} min={0} max={14} step={0.5} className="mt-2" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px]">Sono profundo (h)</Label>
            <Input type="number" inputMode="decimal" value={deepHours || ''} onChange={e => setDeepHours(e.target.value === '' ? 0 : Number(e.target.value))} step={0.5} min={0} max={totalHours} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-[10px]">Sono REM (h)</Label>
            <Input type="number" inputMode="decimal" value={remHours || ''} onChange={e => setRemHours(e.target.value === '' ? 0 : Number(e.target.value))} step={0.5} min={0} max={totalHours} className="h-9 text-sm" />
          </div>
        </div>

        <div>
          <Label className="text-[10px]">Qualidade: {qualityEmojis[quality]} {qualityLabels[quality]}</Label>
          <div className="flex gap-2 mt-2">
            {[1, 2, 3, 4, 5].map(i => (
              <button
                key={i}
                onClick={() => setQuality(i)}
                className={`flex-1 py-2 rounded-lg text-lg transition-all ${
                  i <= quality ? 'bg-indigo-100 dark:bg-indigo-900/40 scale-105' : 'bg-muted'
                }`}
              >
                {qualityEmojis[i]}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar sono'}
        </Button>
      </CardContent>
    </Card>
  );
}
