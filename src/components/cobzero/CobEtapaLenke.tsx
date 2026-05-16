import { useState } from 'react';
import { EtapaLenke as EtapaLenkeType, EtapaRisco } from '@/types/cobzero';
import { calcularRiscoProgressao, getCobbClassification } from '@/utils/calculations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight, ChevronLeft, AlertTriangle } from 'lucide-react';

const LENKE_TYPES = [
  { value: '1', label: '1 – Main Thoracic (MT)' },
  { value: '2', label: '2 – Double Thoracic (DT)' },
  { value: '3', label: '3 – Double Major (DM)' },
  { value: '4', label: '4 – Triple Major (TM)' },
  { value: '5', label: '5 – Thoracolumbar/Lumbar (TL/L)' },
  { value: '6', label: '6 – TL/L Modifier' },
];

interface Props {
  data: EtapaLenkeType;
  pacienteSexo: 'M' | 'F';
  onChange: (data: EtapaLenkeType) => void;
  onRiscoChange: (data: EtapaRisco) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function CobEtapaLenke({ data, pacienteSexo, onChange, onRiscoChange, onNext, onBack }: Props) {
  const [local, setLocal] = useState(data);

  const update = (field: keyof EtapaLenkeType, value: any) => {
    const u = { ...local, [field]: value };
    setLocal(u); onChange(u);
    const risco = calcularRiscoProgressao(u.cobbAngle, pacienteSexo, u.risserStage);
    onRiscoChange({ riskPercentage: risco.percentage, riskLevel: risco.level as any, risserAdjustment: 0 });
  };

  const risco = calcularRiscoProgressao(local.cobbAngle, pacienteSexo, local.risserStage);
  const cobbClass = getCobbClassification(local.cobbAngle);

  return (
    <div className="space-y-6">
      <div className="clinical-card">
        <Badge variant="outline" className="text-xs mb-1">Etapa 3</Badge>
        <h2 className="text-xl font-bold">Radiografia & Classificação Lenke</h2>
        <p className="text-muted-foreground text-sm mt-1">Parâmetros radiográficos e classificação de Lenke</p>
      </div>

      <div className="clinical-card space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Ângulo de Cobb (°)</Label>
            <Input type="number" min={0} max={180} value={local.cobbAngle}
              onChange={e => update('cobbAngle', Number(e.target.value))} className="mt-1.5" />
            {local.cobbAngle > 0 && (
              <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${cobbClass.color}`}>
                {cobbClass.label} ({local.cobbAngle}°)
              </span>
            )}
          </div>
          <div>
            <Label>Estágio de Risser (0-5)</Label>
            <Select value={String(local.risserStage)} onValueChange={v => update('risserStage', Number(v) as any)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0,1,2,3,4,5].map(v => <SelectItem key={v} value={String(v)}>Risser {v} {v<=2?'(crescendo)':v<=3?'(quase fim)':'(maturidade)'}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Tipo Lenke</Label>
          <Select value={local.lenkeType} onValueChange={v => update('lenkeType', v as any)}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LENKE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-2 block">Modificador Lombar</Label>
            <div className="flex gap-2">
              {['A','B','C'].map(m => (
                <button key={m} onClick={() => update('lumbarModifier', m as any)}
                  className={`flex-1 py-2 rounded-lg border-2 font-bold transition-all ${local.lumbarModifier === m ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="mb-2 block">Modificador Sagital</Label>
            <div className="flex gap-2">
              {['-','N','+'].map(m => (
                <button key={m} onClick={() => update('sagittalModifier', m as any)}
                  className={`flex-1 py-2 rounded-lg border-2 font-bold transition-all ${local.sagittalModifier === m ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Classificação Lenke */}
        {local.cobbAngle > 0 && (
          <div className="p-4 rounded-xl bg-secondary border-2 border-primary/20">
            <div className="text-sm font-medium text-muted-foreground mb-1">Classificação Lenke</div>
            <div className="text-2xl font-black text-primary">
              Lenke {local.lenkeType}{local.lumbarModifier} {local.sagittalModifier}
            </div>
          </div>
        )}
      </div>

      {/* Risco de progressão */}
      {local.cobbAngle > 0 && (
        <div className={`clinical-card border-2 ${risco.level === 'ALTO' ? 'border-destructive bg-red-50' : risco.level === 'MODERADO' ? 'border-warning bg-amber-50' : 'border-success bg-green-50'}`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                {risco.level === 'ALTO' && <AlertTriangle className="h-4 w-4 text-destructive" />}
                Risco de Progressão (Lonstein & Carlson)
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Baseado no ângulo de Cobb ({local.cobbAngle}°), sexo ({pacienteSexo}) e Risser ({local.risserStage})
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black">{risco.percentage}%</div>
              <Badge className={`mt-1 ${risco.level === 'ALTO' ? 'bg-destructive' : risco.level === 'MODERADO' ? 'bg-warning text-white' : 'bg-success text-white'}`}>
                {risco.level}
              </Badge>
            </div>
          </div>
        </div>
      )}

      <div className="clinical-card bg-primary/5 border-primary/20">
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}><ChevronLeft className="h-4 w-4 mr-1" />Voltar</Button>
          <Button onClick={onNext} className="bg-primary text-primary-foreground shadow-primary">
            Próximo: Unidades Corporais <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
