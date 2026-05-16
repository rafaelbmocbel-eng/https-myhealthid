import { useState } from 'react';
import { EtapaAntropometrica } from '@/types/cobzero';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface Props {
  data: EtapaAntropometrica;
  onChange: (data: EtapaAntropometrica) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function CobEtapaAntropometrica({ data, onChange, onNext, onBack }: Props) {
  const [local, setLocal] = useState(data);
  const update = (field: keyof EtapaAntropometrica, value: any) => {
    const u = { ...local, [field]: value };
    setLocal(u); onChange(u);
  };

  const imc = local.peso && local.altura ? (local.peso / ((local.altura / 100) ** 2)).toFixed(1) : '-';

  return (
    <div className="space-y-6">
      <div className="clinical-card">
        <Badge variant="outline" className="text-xs mb-1">Etapa 2</Badge>
        <h2 className="text-xl font-bold">Avaliação Antropométrica & Clínica</h2>
        <p className="text-muted-foreground text-sm mt-1">Medidas corporais e testes físicos</p>
      </div>

      <div className="clinical-card space-y-5">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Altura (cm)</Label>
            <Input type="number" value={local.altura} onChange={e => update('altura', Number(e.target.value))} className="mt-1.5" />
          </div>
          <div>
            <Label>Peso (kg)</Label>
            <Input type="number" value={local.peso} onChange={e => update('peso', Number(e.target.value))} className="mt-1.5" />
          </div>
          <div>
            <Label>IMC</Label>
            <div className="mt-1.5 h-10 flex items-center px-3 rounded-md border bg-muted font-bold text-primary">{imc}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Teste de Adam – ΔH (mm)</Label>
            <Input type="number" value={local.testeAdam} onChange={e => update('testeAdam', Number(e.target.value))} className="mt-1.5" placeholder="0-30 mm" />
          </div>
          <div>
            <Label>ATR – Ângulo Tronco (°)</Label>
            <Input type="number" value={local.atr} onChange={e => update('atr', Number(e.target.value))} className="mt-1.5" placeholder="0-20°" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { key: 'romCervical', label: 'ROM Cervical (%)' },
            { key: 'romToracica', label: 'ROM Torácica (%)' },
            { key: 'romLombar', label: 'ROM Lombar (%)' },
          ].map(({ key, label }) => (
            <div key={key}>
              <Label>{label}</Label>
              <Input type="number" min={0} max={100} value={(local as any)[key]}
                onChange={e => update(key as keyof EtapaAntropometrica, Number(e.target.value))} className="mt-1.5" />
            </div>
          ))}
        </div>

        {local.atr > 0 && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
            <strong>ATR estimado de Cobb:</strong> {(local.atr / 0.6).toFixed(0)}° – {(local.atr / 0.5).toFixed(0)}° (proxy ÷ 0.5-0.7)
          </div>
        )}
      </div>

      <div className="clinical-card bg-primary/5 border-primary/20">
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}><ChevronLeft className="h-4 w-4 mr-1" />Voltar</Button>
          <Button onClick={onNext} className="bg-primary text-primary-foreground shadow-primary">
            Próximo: Lenke & Cobb <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
