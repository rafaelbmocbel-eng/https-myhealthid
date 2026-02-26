import { useState } from 'react';
import type { MyIDBloco4Data } from '@/types/myid';
import { calcularScoreP_MyID } from '@/utils/myidCalculations';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const OPCOES_14 = [
  { value: 1, label: 'Discordo totalmente', emoji: '💪' },
  { value: 2, label: 'Discordo', emoji: '🙂' },
  { value: 3, label: 'Concordo', emoji: '😟' },
  { value: 4, label: 'Concordo totalmente', emoji: '😨' },
];

const PERGUNTAS = [
  { key: 'medoMovimento' as const, label: 'MEDO DO MOVIMENTO', text: 'Tenho medo de que atividade física ou movimento piore meu problema.' },
  { key: 'catastrofizacao' as const, label: 'CATASTROFIZAÇÃO', text: 'Se sinto dor, significa que meu corpo está sofrendo um dano.' },
  { key: 'evitacao' as const, label: 'EVITAÇÃO', text: 'Meu corpo me diz para evitar certos movimentos por medo de lesão.' },
];

interface Props {
  data: MyIDBloco4Data;
  onChange: (data: MyIDBloco4Data) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function MyIDBloco4({ data, onChange, onNext, onBack }: Props) {
  const [localData, setLocalData] = useState<MyIDBloco4Data>(data);

  const update = (key: keyof MyIDBloco4Data, value: number) => {
    const updated = { ...localData, [key]: value };
    updated.scoreP = calcularScoreP_MyID(updated);
    setLocalData(updated);
    onChange(updated);
  };

  const scoreP = calcularScoreP_MyID(localData);

  return (
    <div className="space-y-6">
      <div className="clinical-card">
        <div className="flex items-start justify-between">
          <div>
            <Badge variant="outline" className="text-xs">Bloco 4</Badge>
            <h2 className="text-xl font-bold mt-1">Comportamento e Crenças</h2>
            <p className="text-muted-foreground text-sm">Como você pensa sobre movimento e dor</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Score P</div>
            <div className="text-2xl font-bold text-primary">{scoreP.toFixed(1)}</div>
          </div>
        </div>
      </div>

      {/* 3 perguntas Likert 1-4 */}
      <div className="clinical-card space-y-6">
        <p className="text-sm text-muted-foreground">Marque de 1 a 4 quanto você concorda com cada frase:</p>
        {PERGUNTAS.map((perg, idx) => {
          const val = localData[perg.key];
          return (
            <div key={perg.key} className={cn(
              'p-4 rounded-xl border-2 transition-all',
              val >= 3 ? 'border-amber-200 bg-amber-50/50' : val > 0 ? 'border-green-200 bg-green-50/50' : 'border-border'
            )}>
              <div className="flex gap-3">
                <span className="text-xs font-bold text-muted-foreground mt-1 w-6">{idx + 1}.</span>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground font-medium">{perg.label}</p>
                  <p className="text-sm font-medium mb-3">{perg.text}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {OPCOES_14.map(op => (
                      <button key={op.value} onClick={() => update(perg.key, op.value)}
                        className={cn('flex items-center gap-2 p-2 rounded-lg border-2 text-sm transition-all',
                          val === op.value
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border hover:border-primary/50'
                        )}>
                        <span>{op.emoji}</span>
                        <span className="text-xs truncate">{op.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Autoeficácia slider */}
      <div className="clinical-card space-y-4">
        <h3 className="font-semibold text-sm">AUTOEFICÁCIA</h3>
        <p className="text-sm text-muted-foreground">Eu me sinto capaz de realizar minhas tarefas mesmo com dor.</p>
        <div className="flex justify-between items-center">
          <Label>Sua resposta</Label>
          <span className="text-2xl font-bold text-primary">{localData.autoeficacia}/10</span>
        </div>
        <Slider value={[localData.autoeficacia]} min={0} max={10} step={1}
          onValueChange={([v]) => update('autoeficacia', v)} />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Incapaz</span><span>Totalmente capaz</span>
        </div>
      </div>

      <div className="clinical-card bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack}><ChevronLeft className="h-4 w-4 mr-1" />Voltar</Button>
          <Button onClick={onNext} className="bg-gradient-primary text-white shadow-primary">
            Próximo: Regulação<ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
