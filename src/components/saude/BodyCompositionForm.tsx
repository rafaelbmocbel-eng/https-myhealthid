import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Scale, Save } from 'lucide-react';
import { toast } from 'sonner';
import type { BodyComposition } from '@/hooks/useHealthData';

interface Props {
  current: BodyComposition | null;
  onSave: (data: Partial<BodyComposition>) => Promise<any>;
}

export default function BodyCompositionForm({ current, onSave }: Props) {
  const [weight, setWeight] = useState(current?.weight_kg || '');
  const [height, setHeight] = useState(current?.height_cm || '');
  const [bodyFat, setBodyFat] = useState(current?.body_fat_pct || '');
  const [muscleMass, setMuscleMass] = useState(current?.muscle_mass_kg || '');
  const [waist, setWaist] = useState(current?.waist_cm || '');
  const [hip, setHip] = useState(current?.hip_cm || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const err = await onSave({
      weight_kg: Number(weight) || null,
      height_cm: Number(height) || null,
      body_fat_pct: Number(bodyFat) || null,
      muscle_mass_kg: Number(muscleMass) || null,
      waist_cm: Number(waist) || null,
      hip_cm: Number(hip) || null,
    });
    setSaving(false);
    if (!err) toast.success('Composição corporal salva!');
    else toast.error('Erro ao salvar');
  };

  const w = Number(weight);
  const h = Number(height);
  const bmi = w && h ? (w / ((h / 100) ** 2)).toFixed(1) : null;

  const getBmiCategory = (v: number) => {
    if (v < 18.5) return { label: 'Abaixo do peso', color: 'text-amber-500' };
    if (v < 25) return { label: 'Normal', color: 'text-emerald-600' };
    if (v < 30) return { label: 'Sobrepeso', color: 'text-orange-500' };
    return { label: 'Obesidade', color: 'text-red-500' };
  };

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-purple-500" />
          <h3 className="text-sm font-bold text-foreground">Composição Corporal</h3>
        </div>

        {bmi && (
          <div className="text-center p-3 rounded-xl bg-muted/50">
            <div className="text-3xl font-black text-foreground">{bmi}</div>
            <div className={`text-xs font-semibold ${getBmiCategory(Number(bmi)).color}`}>
              IMC · {getBmiCategory(Number(bmi)).label}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[10px]">Peso (kg)</Label>
            <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} step={0.1} className="h-9 text-sm" placeholder="70.5" />
          </div>
          <div>
            <Label className="text-[10px]">Altura (cm)</Label>
            <Input type="number" value={height} onChange={e => setHeight(e.target.value)} className="h-9 text-sm" placeholder="175" />
          </div>
          <div>
            <Label className="text-[10px]">% Gordura</Label>
            <Input type="number" value={bodyFat} onChange={e => setBodyFat(e.target.value)} step={0.1} className="h-9 text-sm" placeholder="15.0" />
          </div>
          <div>
            <Label className="text-[10px]">Massa muscular (kg)</Label>
            <Input type="number" value={muscleMass} onChange={e => setMuscleMass(e.target.value)} step={0.1} className="h-9 text-sm" placeholder="30.0" />
          </div>
          <div>
            <Label className="text-[10px]">Cintura (cm)</Label>
            <Input type="number" value={waist} onChange={e => setWaist(e.target.value)} step={0.1} className="h-9 text-sm" placeholder="80" />
          </div>
          <div>
            <Label className="text-[10px]">Quadril (cm)</Label>
            <Input type="number" value={hip} onChange={e => setHip(e.target.value)} step={0.1} className="h-9 text-sm" placeholder="95" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar medidas'}
        </Button>
      </CardContent>
    </Card>
  );
}
