import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { StructuralPreferences, TECHNIQUE_OPTIONS, AVERSION_OPTIONS } from '@/types/structural';
import { Heart, Shield } from 'lucide-react';

interface Props {
  data: StructuralPreferences;
  onChange: (data: StructuralPreferences) => void;
}

export default function StructuralPreferencesStep({ data, onChange }: Props) {
  const toggle = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];

  return (
    <div className="space-y-6">
      <div className="clinical-card">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs">Preferências</Badge>
        </div>
        <h2 className="text-xl font-bold">Preferências & Contraindicações</h2>
        <p className="text-muted-foreground text-sm mt-1">Informe as preferências de técnica e histórico relevante</p>
      </div>

      {/* Técnicas de Preferência */}
      <div className="clinical-card">
        <div className="flex items-center gap-2 mb-3">
          <Heart className="h-4 w-4 text-primary" />
          <Label className="font-semibold">Técnicas de Preferência</Label>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TECHNIQUE_OPTIONS.map(opt => (
            <div key={opt} className="flex items-center gap-2">
              <Checkbox
                checked={data.techniquePreference.includes(opt)}
                onCheckedChange={() => onChange({ ...data, techniquePreference: toggle(data.techniquePreference, opt) })}
              />
              <Label className="text-sm cursor-pointer">{opt}</Label>
            </div>
          ))}
        </div>
      </div>

      {/* Aversões */}
      <div className="clinical-card">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-destructive" />
          <Label className="font-semibold">Aversões / Contraindicações</Label>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {AVERSION_OPTIONS.map(opt => (
            <div key={opt} className="flex items-center gap-2">
              <Checkbox
                checked={data.techniqueAversion.includes(opt)}
                onCheckedChange={() => onChange({ ...data, techniqueAversion: toggle(data.techniqueAversion, opt) })}
              />
              <Label className="text-sm cursor-pointer">{opt}</Label>
            </div>
          ))}
        </div>
      </div>



      {/* Dor Tolerável */}
      <div className="clinical-card">
        <div className="flex justify-between items-center mb-2">
          <Label className="font-semibold">Nível máximo de dor aceitável durante tratamento</Label>
          <span className="text-lg font-bold text-primary">{data.painTolerance}/10</span>
        </div>
        <Slider
          value={[data.painTolerance]}
          min={0} max={10} step={1}
          onValueChange={([v]) => onChange({ ...data, painTolerance: v })}
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>0 = Nenhuma dor</span><span>10 = Insuportável</span>
        </div>
      </div>

      {/* Observações */}
      <div className="clinical-card">
        <Label className="font-semibold">Observações Adicionais</Label>
        <Textarea
          value={data.additionalNotes}
          onChange={e => onChange({ ...data, additionalNotes: e.target.value })}
          placeholder="Informações relevantes sobre o paciente..."
          className="mt-2 resize-none"
          rows={3}
        />
      </div>
    </div>
  );
}
