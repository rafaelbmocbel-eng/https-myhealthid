import { useState } from 'react';
import type { MyIDBloco5Data } from '@/types/myid';
import { calcularScoreR_MyID } from '@/utils/myidCalculations';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight, ChevronLeft, Moon, Zap, Brain } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Props {
  data: MyIDBloco5Data;
  onChange: (data: MyIDBloco5Data) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function MyIDBloco5({ data, onChange, onNext, onBack }: Props) {
  const [localData, setLocalData] = useState<MyIDBloco5Data>(data);

  const update = (field: keyof MyIDBloco5Data, value: any) => {
    const updated = { ...localData, [field]: value };
    const scores = calcularScoreR_MyID(updated);
    updated.scoreR1 = scores.r1; updated.scoreR2 = scores.r2;
    updated.scoreR3 = scores.r3; updated.scoreR = scores.r; updated.scoreC = scores.c;
    setLocalData(updated);
    onChange(updated);
  };

  const scores = calcularScoreR_MyID(localData);

  const getColor = (score: number, inverted = false) => {
    const v = inverted ? 10 - score : score;
    if (v >= 7) return 'text-destructive';
    if (v >= 4) return 'text-amber-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-6">
      <div className="clinical-card">
        <div className="flex items-start justify-between">
          <div>
            <Badge variant="outline" className="text-xs">Bloco 5</Badge>
            <h2 className="text-xl font-bold mt-1">Regulação Neurovegetativa</h2>
            <p className="text-muted-foreground text-sm">Sono, energia, psicológico e contexto social</p>
          </div>
          <div className="flex gap-3 text-right">
            <div>
              <div className="text-xs text-muted-foreground">R</div>
              <div className={`text-xl font-bold ${getColor(scores.r)}`}>{scores.r.toFixed(1)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">C</div>
              <div className={`text-xl font-bold ${getColor(scores.c)}`}>{scores.c.toFixed(1)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Mini-scores */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Sono', val: scores.r1, icon: '🛌' },
          { label: 'Energia', val: scores.r2, icon: '⚡' },
          { label: 'Psicológico', val: scores.r3, icon: '🧠' },
          { label: 'Contexto', val: scores.c, icon: '⚖️' },
        ].map(({ label, val, icon }) => (
          <div key={label} className="clinical-card p-3 text-center">
            <div className="text-lg">{icon}</div>
            <div className={`text-lg font-bold ${getColor(val)}`}>{val.toFixed(1)}</div>
            <div className="text-[10px] text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {/* 5A: Sono */}
      <div className="clinical-card space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Moon className="h-4 w-4 text-blue-500" />5A – Sono
        </h3>
        <div>
          <div className="flex justify-between"><Label>Qualidade do sono</Label><span className="font-bold text-primary">{localData.qualidadeSono}/10</span></div>
          <Slider value={[localData.qualidadeSono]} min={0} max={10} step={1} onValueChange={([v]) => update('qualidadeSono', v)} className="mt-2" />
        </div>
        <div>
          <Label>Horas de sono por noite</Label>
          <Input type="number" min={0} max={14} step={0.5} value={localData.horasSono}
            onChange={e => update('horasSono', parseFloat(e.target.value) || 0)} className="mt-1.5 w-32" />
        </div>
        <div>
          <Label>Acorda durante a noite por causa da dor?</Label>
          <Select value={localData.acordaPorDor} onValueChange={v => update('acordaPorDor', v)}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nunca">Nunca</SelectItem>
              <SelectItem value="raramente">Raramente (1-2×/sem)</SelectItem>
              <SelectItem value="frequentemente">Frequentemente (3-5×/sem)</SelectItem>
              <SelectItem value="sempre">Sempre (todos os dias)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 5B: Energia */}
      <div className="clinical-card space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-500" />5B – Energia
        </h3>
        <div>
          <div className="flex justify-between"><Label>Nível de fadiga durante o dia</Label><span className="font-bold text-primary">{localData.fadiga}/10</span></div>
          <Slider value={[localData.fadiga]} min={0} max={10} step={1} onValueChange={([v]) => update('fadiga', v)} className="mt-2" />
        </div>
        <div>
          <Label>Sente-se exausto logo ao acordar?</Label>
          <Select value={localData.exaustoAoAcordar} onValueChange={v => update('exaustoAoAcordar', v)}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="nunca">Nunca</SelectItem>
              <SelectItem value="as_vezes">Às vezes (2-3×/sem)</SelectItem>
              <SelectItem value="frequentemente">Frequentemente (4-5×/sem)</SelectItem>
              <SelectItem value="sempre">Sempre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 5C: Psicológico */}
      <div className="clinical-card space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-500" />5C – Psicológico
        </h3>
        <div>
          <div className="flex justify-between"><Label>Nível de ESTRESSE</Label><span className="font-bold text-primary">{localData.estresse}/10</span></div>
          <Slider value={[localData.estresse]} min={0} max={10} step={1} onValueChange={([v]) => update('estresse', v)} className="mt-2" />
        </div>
        <div>
          <div className="flex justify-between"><Label>Nível de ANSIEDADE</Label><span className="font-bold text-primary">{localData.ansiedade}/10</span></div>
          <Slider value={[localData.ansiedade]} min={0} max={10} step={1} onValueChange={([v]) => update('ansiedade', v)} className="mt-2" />
        </div>
        <div>
          <Label>Sente-se no controle de sua saúde?</Label>
          <Select value={localData.controleSaude} onValueChange={v => update('controleSaude', v)}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="muito">Muito controlado</SelectItem>
              <SelectItem value="moderado">Moderadamente controlado</SelectItem>
              <SelectItem value="pouco">Pouco controlado</SelectItem>
              <SelectItem value="sem">Sem controle</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 5D: Contexto */}
      <div className="clinical-card space-y-4">
        <h3 className="font-semibold">⚖️ 5D – Contexto Social</h3>
        {[
          { key: 'trabalhoEstressante' as const, label: 'Seu ambiente de trabalho é estressante?' },
          { key: 'conflitosFamiliares' as const, label: 'Tem tido conflitos familiares ou pessoais recentes?' },
          { key: 'preocupacaoFinanceira' as const, label: 'Sua situação financeira te gera preocupação?' },
        ].map(({ key, label }) => (
          <div key={key}>
            <div className="flex justify-between"><Label className="text-sm">{label}</Label><span className="font-bold text-primary">{localData[key]}/10</span></div>
            <Slider value={[localData[key]]} min={0} max={10} step={1}
              onValueChange={([v]) => update(key, v)} className="mt-2" />
          </div>
        ))}
      </div>

      <div className="clinical-card bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack}><ChevronLeft className="h-4 w-4 mr-1" />Voltar</Button>
          <Button onClick={onNext} className="bg-gradient-primary text-white shadow-primary">
            Próximo: Ruído Sistêmico<ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
