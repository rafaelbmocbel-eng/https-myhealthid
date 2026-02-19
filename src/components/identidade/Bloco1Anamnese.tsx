import { useState } from 'react';
import { Bloco1Data } from '@/types/identidade';
import { calcularScoreF } from '@/utils/calculations';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, AlertCircle, Info } from 'lucide-react';

const COMORBIDADES = [
  'Diabetes', 'Hipertensão', 'Artrite', 'Fibromialgia', 'Cirurgias prévias',
  'Fraturas', 'Osteoporose', 'Depressão/Ansiedade', 'Doença cardíaca', 'Doença pulmonar',
];

interface Props {
  data: Bloco1Data;
  onChange: (data: Bloco1Data) => void;
  onNext: () => void;
}

export default function Bloco1Anamnese({ data, onChange, onNext }: Props) {
  const [localData, setLocalData] = useState<Bloco1Data>(data);

  const update = (field: keyof Bloco1Data, value: any) => {
    const updated = { ...localData, [field]: value };
    updated.scoreF = calcularScoreF(updated);
    setLocalData(updated);
    onChange(updated);
  };

  const toggleComorbidade = (item: string) => {
    const updated = localData.historicoMedico.includes(item)
      ? localData.historicoMedico.filter(i => i !== item)
      : [...localData.historicoMedico, item];
    update('historicoMedico', updated);
  };

  const scoreF = calcularScoreF(localData);

  return (
    <div className="space-y-6">
      {/* Header do bloco */}
      <div className="clinical-card">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">Bloco 1</Badge>
              <span className="text-xs text-muted-foreground">~8 min</span>
            </div>
            <h2 className="text-xl font-bold">Anamnese & Contexto</h2>
            <p className="text-muted-foreground text-sm mt-1">Coletando informações contextuais para calcular o Score F (Fator Contextual)</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground mb-1">Score F</div>
            <div className="text-3xl font-bold text-primary">{scoreF.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">/10</div>
          </div>
        </div>
      </div>

      {/* Queixa principal */}
      <div className="clinical-card space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">1</span>
          Queixa Principal & Contexto
        </h3>

        <div>
          <Label>Queixa principal <span className="text-destructive">*</span></Label>
          <Textarea
            placeholder="Descreva a queixa principal do paciente..."
            value={localData.queixaPrincipal}
            onChange={e => update('queixaPrincipal', e.target.value)}
            className="mt-1.5 resize-none"
            rows={3}
            maxLength={500}
          />
          <div className="text-xs text-muted-foreground mt-1">{localData.queixaPrincipal.length}/500</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Duração dos sintomas</Label>
            <Select value={localData.duracao} onValueChange={v => update('duracao', v)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="<2 semanas">&lt;2 semanas</SelectItem>
                <SelectItem value="2-4 semanas">2-4 semanas</SelectItem>
                <SelectItem value="1-3 meses">1-3 meses</SelectItem>
                <SelectItem value="3-6 meses">3-6 meses</SelectItem>
                <SelectItem value="6-12 meses">6-12 meses</SelectItem>
                <SelectItem value=">1 ano">&gt;1 ano</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Atividade física</Label>
            <Select value={localData.atividadeFisica} onValueChange={v => update('atividadeFisica', v)}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Nenhuma</SelectItem>
                <SelectItem value="leve">Leve (&lt;2×/sem)</SelectItem>
                <SelectItem value="moderada">Moderada (2-4×/sem)</SelectItem>
                <SelectItem value="intensa">Intensa (&gt;4×/sem)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id="evento"
            checked={localData.eventoPrecipitante}
            onCheckedChange={v => update('eventoPrecipitante', !!v)}
          />
          <Label htmlFor="evento" className="cursor-pointer">Houve evento precipitante?</Label>
        </div>
        {localData.eventoPrecipitante && (
          <Input
            placeholder="Descreva o evento..."
            value={localData.eventoPrecipitanteDescricao}
            onChange={e => update('eventoPrecipitanteDescricao', e.target.value)}
          />
        )}

        <div>
          <Label>Profissão</Label>
          <Input
            placeholder="Ex: Contador, Motorista, Professora..."
            value={localData.profissao}
            onChange={e => update('profissao', e.target.value)}
            className="mt-1.5"
          />
        </div>

        <div>
          <Label>Horas em posição sedentária/dia: <strong>{localData.horasSedentario}h</strong></Label>
          <Slider
            value={[localData.horasSedentario]}
            min={0} max={16} step={1}
            onValueChange={([v]) => update('horasSedentario', v)}
            className="mt-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0h (ativo)</span><span>16h (muito sedentário)</span>
          </div>
        </div>
      </div>

      {/* Histórico médico */}
      <div className="clinical-card space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">2</span>
          Histórico Médico
        </h3>

        <div>
          <Label>Comorbidades (selecione todas que se aplicam)</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {COMORBIDADES.map(item => (
              <div key={item} className="flex items-center gap-2">
                <Checkbox
                  id={item}
                  checked={localData.historicoMedico.includes(item)}
                  onCheckedChange={() => toggleComorbidade(item)}
                />
                <Label htmlFor={item} className="cursor-pointer text-sm">{item}</Label>
              </div>
            ))}
          </div>
          {localData.historicoMedico.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {localData.historicoMedico.map(item => (
                <Badge key={item} variant="secondary" className="text-xs">{item}</Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id="familiarH"
            checked={localData.historicoFamiliar}
            onCheckedChange={v => update('historicoFamiliar', !!v)}
          />
          <Label htmlFor="familiarH" className="cursor-pointer">Histórico familiar relevante?</Label>
        </div>
        {localData.historicoFamiliar && (
          <Input
            placeholder="Qual condição familiar?"
            value={localData.historicoFamiliarDescricao}
            onChange={e => update('historicoFamiliarDescricao', e.target.value)}
          />
        )}
      </div>

      {/* Escalas Likert */}
      <div className="clinical-card space-y-6">
        <h3 className="font-semibold flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">3</span>
          Questões de Gravidade
        </h3>

        {[
          { key: 'impactoQualidadeVida', label: 'Impacto na qualidade de vida?', l: 'Nenhum', r: 'Total' },
          { key: 'interferenciaTrbalho', label: 'Interferência no trabalho?', l: 'Nenhuma', r: 'Impossível trabalhar' },
          { key: 'quantidadeComorbidades', label: 'Quantidade de comorbidades (0-5+)?', l: '0 (nenhuma)', r: '5+ comorbidades' },
          { key: 'historicoFamiliarPeso', label: 'Peso do histórico familiar?', l: 'Sem relevância', r: 'Muito relevante' },
        ].map(({ key, label, l, r }) => (
          <div key={key}>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm">{label}</Label>
              <span className="text-lg font-bold text-primary">{(localData as any)[key]}/10</span>
            </div>
            <Slider
              value={[(localData as any)[key]]}
              min={0} max={10} step={1}
              onValueChange={([v]) => update(key as keyof Bloco1Data, v)}
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{l}</span><span>{r}</span>
            </div>
          </div>
        ))}

        {localData.duracao && ['6-12 meses', '>1 ano'].includes(localData.duracao) && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertCircle className="h-4 w-4 text-warning flex-shrink-0" />
            <p className="text-xs text-warning-foreground">Dor crônica identificada – bônus +2 aplicado ao Score F</p>
          </div>
        )}
      </div>

      {/* Score preview */}
      <div className="clinical-card bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Score F calculado: <strong className="text-primary">{scoreF.toFixed(1)}/10</strong></span>
          </div>
          <Button onClick={onNext} className="bg-gradient-primary text-white shadow-primary">
            Próximo: Avaliação da Dor
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
