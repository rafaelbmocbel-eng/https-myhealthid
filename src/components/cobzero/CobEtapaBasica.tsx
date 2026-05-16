import { useState } from 'react';
import { EtapaBasica as EtapaBasicaType } from '@/types/cobzero';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ChevronRight } from 'lucide-react';

interface Props {
  data: EtapaBasicaType;
  onChange: (data: EtapaBasicaType) => void;
  onNext: () => void;
}

export default function CobEtapaBasica({ data, onChange, onNext }: Props) {
  const [local, setLocal] = useState(data);
  const update = (field: keyof EtapaBasicaType, value: any) => {
    const u = { ...local, [field]: value };
    setLocal(u); onChange(u);
  };

  return (
    <div className="space-y-6">
      <div className="clinical-card">
        <div className="flex items-start justify-between">
          <div>
            <Badge variant="outline" className="text-xs mb-1">Etapa 1</Badge>
            <h2 className="text-xl font-bold">Dados Básicos & Queixa</h2>
            <p className="text-muted-foreground text-sm mt-1">Contexto inicial e história do paciente</p>
          </div>
        </div>
      </div>

      <div className="clinical-card space-y-5">
        <div>
          <Label>Queixa principal</Label>
          <Textarea placeholder="Ex: coluna torta, dor nas costas, assimetria..." value={local.queixaPrincipal}
            onChange={e => update('queixaPrincipal', e.target.value)} className="mt-1.5 resize-none" rows={3} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Duração (meses)</Label>
            <Input type="number" min={0} value={local.duracaoMeses}
              onChange={e => update('duracaoMeses', Number(e.target.value))} className="mt-1.5" />
          </div>
          <div>
            <Label>Atividade física</Label>
            <Select value={local.atividadeFisica} onValueChange={v => update('atividadeFisica', v)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['nenhuma','leve','moderada','intensa'].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox id="crescendo" checked={local.aindaCrescendo}
            onCheckedChange={v => update('aindaCrescendo', !!v)} />
          <Label htmlFor="crescendo" className="cursor-pointer">Paciente ainda está em crescimento?</Label>
        </div>
        <div>
          <Label>Estágio de Tanner (1-5)</Label>
          <Select value={String(local.tannerStage)} onValueChange={v => update('tannerStage', Number(v))}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1,2,3,4,5].map(v => <SelectItem key={v} value={String(v)}>Tanner {v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <Checkbox id="historicEsc" checked={local.historicEscoliose}
            onCheckedChange={v => update('historicEscoliose', !!v)} />
          <Label htmlFor="historicEsc" className="cursor-pointer">Histórico familiar de escoliose?</Label>
        </div>
      </div>

      <div className="clinical-card bg-primary/5 border-primary/20">
        <div className="flex justify-end">
          <Button onClick={onNext} className="bg-primary text-primary-foreground shadow-primary">
            Próximo: Antropometria <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
