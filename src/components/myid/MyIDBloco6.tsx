import { useState } from 'react';
import type { MyIDBloco6Data } from '@/types/myid';
import { SINAIS_AUTONOMICOS } from '@/types/myid';
import { calcularScoreN } from '@/utils/myidCalculations';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  data: MyIDBloco6Data;
  onChange: (data: MyIDBloco6Data) => void;
  onSubmit: () => void;
  onBack: () => void;
  submitting?: boolean;
}

export default function MyIDBloco6({ data, onChange, onSubmit, onBack, submitting }: Props) {
  const [localData, setLocalData] = useState<MyIDBloco6Data>(data);

  const update = (field: keyof MyIDBloco6Data, value: any) => {
    const updated = { ...localData, [field]: value };
    updated.scoreN = calcularScoreN(updated);
    setLocalData(updated);
    onChange(updated);
  };

  const toggleSinal = (item: string) => {
    const current = localData.sinaisAutonomicos;
    if (item === 'Nenhum desses') {
      update('sinaisAutonomicos', current.includes(item) ? [] : [item]);
    } else {
      const filtered = current.filter(s => s !== 'Nenhum desses');
      update('sinaisAutonomicos',
        filtered.includes(item) ? filtered.filter(s => s !== item) : [...filtered, item]
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="clinical-card">
        <div className="flex items-start justify-between">
          <div>
            <Badge variant="outline" className="text-xs">Bloco 6</Badge>
            <h2 className="text-xl font-bold mt-1">Ruído Sistêmico</h2>
            <p className="text-muted-foreground text-sm">Saúde visceral e histórico hormonal</p>
          </div>
        </div>
      </div>

      {/* 6.3 Sinais Autonômicos */}
      <div className="clinical-card space-y-4">
        <h3 className="font-semibold text-sm">6.3 – Saúde Visceral / Sinais Autonômicos</h3>
        <p className="text-sm text-muted-foreground">Sente frequentemente:</p>
        <div className="space-y-2">
          {SINAIS_AUTONOMICOS.map(item => (
            <div key={item} className={cn('flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer',
              localData.sinaisAutonomicos.includes(item)
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/30'
            )} onClick={() => toggleSinal(item)}>
              <Checkbox checked={localData.sinaisAutonomicos.includes(item)} onCheckedChange={() => toggleSinal(item)} />
              <span className="text-sm">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 6.4 Saúde feminina */}
      <div className="clinical-card space-y-4">
        <h3 className="font-semibold text-sm">6.4 – Histórico Específico (opcional)</h3>
        <p className="text-sm text-muted-foreground">Diagnóstico de Endometriose ou Síndrome do Ovário Policístico?</p>
        <Select value={localData.diagnosticoFeminino} onValueChange={v => update('diagnosticoFeminino', v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="nao">Não tenho</SelectItem>
            <SelectItem value="endometriose">Sim - Endometriose</SelectItem>
            <SelectItem value="pcos">Sim - PCOS</SelectItem>
            <SelectItem value="ambas">Sim - Ambas</SelectItem>
            <SelectItem value="prefiro_nao">Prefiro não responder</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Submit */}
      <div className="clinical-card bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack}><ChevronLeft className="h-4 w-4 mr-1" />Voltar</Button>
          <Button onClick={onSubmit} disabled={submitting}
            className="bg-primary text-primary-foreground shadow-primary">
            {submitting ? 'Enviando...' : 'Finalizar Questionário'}
            <CheckCircle2 className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
