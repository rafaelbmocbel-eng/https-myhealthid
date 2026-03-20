import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Activity, Save } from 'lucide-react';
import { toast } from 'sonner';
import type { HealthMetrics } from '@/hooks/useHealthData';

interface Props {
  current: HealthMetrics | null;
  onSave: (data: Partial<HealthMetrics>) => Promise<any>;
}

export default function MetricsManualForm({ current, onSave }: Props) {
  const [steps, setSteps] = useState(current?.steps || '');
  const [calories, setCalories] = useState(current?.calories_burned || '');
  const [hrAvg, setHrAvg] = useState(current?.heart_rate_avg || '');
  const [hrResting, setHrResting] = useState(current?.heart_rate_resting || '');
  const [spo2, setSpo2] = useState(current?.spo2_avg || '');
  const [activeMin, setActiveMin] = useState(current?.active_minutes || '');
  const [distance, setDistance] = useState(current?.distance_km || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const err = await onSave({
      steps: Number(steps) || 0,
      calories_burned: Number(calories) || null,
      heart_rate_avg: Number(hrAvg) || null,
      heart_rate_resting: Number(hrResting) || null,
      spo2_avg: Number(spo2) || null,
      active_minutes: Number(activeMin) || null,
      distance_km: Number(distance) || null,
    });
    setSaving(false);
    if (!err) toast.success('Métricas salvas!');
    else toast.error('Erro ao salvar');
  };

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Registro Manual</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px]">👟 Passos</Label>
            <Input type="number" value={steps} onChange={e => setSteps(e.target.value)} className="h-9 text-sm" placeholder="8000" />
          </div>
          <div>
            <Label className="text-[10px]">🔥 Calorias</Label>
            <Input type="number" value={calories} onChange={e => setCalories(e.target.value)} className="h-9 text-sm" placeholder="350" />
          </div>
          <div>
            <Label className="text-[10px]">❤️ FC média (bpm)</Label>
            <Input type="number" value={hrAvg} onChange={e => setHrAvg(e.target.value)} className="h-9 text-sm" placeholder="75" />
          </div>
          <div>
            <Label className="text-[10px]">💤 FC repouso</Label>
            <Input type="number" value={hrResting} onChange={e => setHrResting(e.target.value)} className="h-9 text-sm" placeholder="60" />
          </div>
          <div>
            <Label className="text-[10px]">🫁 SpO₂ (%)</Label>
            <Input type="number" value={spo2} onChange={e => setSpo2(e.target.value)} className="h-9 text-sm" placeholder="97" />
          </div>
          <div>
            <Label className="text-[10px]">⏱️ Minutos ativos</Label>
            <Input type="number" value={activeMin} onChange={e => setActiveMin(e.target.value)} className="h-9 text-sm" placeholder="30" />
          </div>
          <div className="col-span-2">
            <Label className="text-[10px]">📏 Distância (km)</Label>
            <Input type="number" value={distance} onChange={e => setDistance(e.target.value)} step={0.1} className="h-9 text-sm" placeholder="5.2" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar métricas'}
        </Button>
      </CardContent>
    </Card>
  );
}
