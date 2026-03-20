import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UtensilsCrossed, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Props {
  pacienteId: string;
  terapeutaId: string;
  onSaved: () => void;
}

const mealTypes = [
  { value: 'cafe_manha', label: '☕ Café da manhã' },
  { value: 'lanche_manha', label: '🍎 Lanche manhã' },
  { value: 'almoco', label: '🍽️ Almoço' },
  { value: 'lanche_tarde', label: '🥤 Lanche tarde' },
  { value: 'jantar', label: '🍲 Jantar' },
  { value: 'ceia', label: '🌙 Ceia' },
  { value: 'snack', label: '🍿 Outro' },
];

export default function MealLogForm({ pacienteId, terapeutaId, onSaved }: Props) {
  const [mealType, setMealType] = useState('almoco');
  const [description, setDescription] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!description.trim()) { toast.error('Descreva a refeição'); return; }
    setSaving(true);

    const { error } = await supabase.from('meal_logs').insert({
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      date: format(new Date(), 'yyyy-MM-dd'),
      meal_type: mealType,
      description: description.trim(),
      calories: Number(calories) || null,
      protein_g: Number(protein) || null,
      carbs_g: Number(carbs) || null,
      fat_g: Number(fat) || null,
      time_eaten: new Date().toISOString(),
    });

    setSaving(false);
    if (!error) {
      toast.success('Refeição registrada!');
      setDescription('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      onSaved();
    } else {
      toast.error('Erro ao salvar');
    }
  };

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-amber-500" />
          <h3 className="text-sm font-bold text-foreground">Registrar Refeição</h3>
        </div>

        <Select value={mealType} onValueChange={setMealType}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {mealTypes.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div>
          <Label className="text-[10px]">O que você comeu?</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Ex: Arroz, feijão, frango grelhado e salada" className="text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px]">Calorias (kcal)</Label>
            <Input type="number" value={calories} onChange={e => setCalories(e.target.value)} className="h-8 text-sm" placeholder="450" />
          </div>
          <div>
            <Label className="text-[10px]">Proteína (g)</Label>
            <Input type="number" value={protein} onChange={e => setProtein(e.target.value)} className="h-8 text-sm" placeholder="30" />
          </div>
          <div>
            <Label className="text-[10px]">Carboidrato (g)</Label>
            <Input type="number" value={carbs} onChange={e => setCarbs(e.target.value)} className="h-8 text-sm" placeholder="60" />
          </div>
          <div>
            <Label className="text-[10px]">Gordura (g)</Label>
            <Input type="number" value={fat} onChange={e => setFat(e.target.value)} className="h-8 text-sm" placeholder="15" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Salvando...' : 'Registrar refeição'}
        </Button>
      </CardContent>
    </Card>
  );
}
