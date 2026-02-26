import { useState } from 'react';
import type { MyIDBloco3Data } from '@/types/myid';
import { calcularScoreEFI_MyID } from '@/utils/myidCalculations';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronLeft, Briefcase, Home, Dumbbell, Heart, Users } from 'lucide-react';
import { getSeverityColorHex } from '@/utils/calculations';

const QUESTOES = [
  { key: 'trabalho' as const, icon: Briefcase, label: 'TRABALHO / ESTUDO', desc: 'A dor interfere na sua produtividade?' },
  { key: 'domesticas' as const, icon: Home, label: 'TAREFAS DOMÉSTICAS', desc: 'Precisa de ajuda ou deixa de fazer tarefas em casa?' },
  { key: 'exercicio' as const, icon: Dumbbell, label: 'EXERCÍCIO / ESPORTE', desc: 'Consegue manter sua rotina de treinos e atividade física?' },
  { key: 'independencia' as const, icon: Heart, label: 'INDEPENDÊNCIA', desc: 'Consegue se vestir, tomar banho e se cuidar sozinho?' },
  { key: 'vidaSocial' as const, icon: Users, label: 'VIDA SOCIAL', desc: 'Deixou de sair ou ver pessoas por causa da dor?' },
];

interface Props {
  data: MyIDBloco3Data;
  onChange: (data: MyIDBloco3Data) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function MyIDBloco3({ data, onChange, onNext, onBack }: Props) {
  const [localData, setLocalData] = useState<MyIDBloco3Data>(data);

  const update = (key: keyof MyIDBloco3Data, value: number) => {
    const updated = { ...localData, [key]: value };
    updated.scoreEFI = calcularScoreEFI_MyID(updated);
    setLocalData(updated);
    onChange(updated);
  };

  const scoreEFI = calcularScoreEFI_MyID(localData);

  return (
    <div className="space-y-6">
      <div className="clinical-card">
        <div className="flex items-start justify-between">
          <div>
            <Badge variant="outline" className="text-xs">Bloco 3</Badge>
            <h2 className="text-xl font-bold mt-1">Funcionalidade</h2>
            <p className="text-muted-foreground text-sm">Impacto na vida real (0 = Nada impede | 10 = Totalmente impedido)</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Score EFI</div>
            <div className="text-2xl font-bold text-primary">{scoreEFI.toFixed(1)}</div>
          </div>
        </div>
      </div>

      <div className="clinical-card space-y-8">
        {QUESTOES.map((q, idx) => {
          const Icon = q.icon;
          const val = localData[q.key] as number;
          return (
            <div key={q.key}>
              <div className="flex items-start gap-3 mb-3">
                <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground font-medium">{idx + 1}/5</span>
                      <h4 className="font-semibold text-sm">{q.label}</h4>
                      <p className="text-xs text-muted-foreground">{q.desc}</p>
                    </div>
                    <span className="text-2xl font-bold ml-4" style={{ color: getSeverityColorHex(val) }}>
                      {val}
                    </span>
                  </div>
                  <Slider value={[val]} min={0} max={10} step={1}
                    onValueChange={([v]) => update(q.key, v)} className="mt-3" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Nenhum impacto</span><span>Totalmente impedido</span>
                  </div>
                </div>
              </div>
              {idx < QUESTOES.length - 1 && <div className="border-b border-border/50" />}
            </div>
          );
        })}
      </div>

      <div className="clinical-card bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack}><ChevronLeft className="h-4 w-4 mr-1" />Voltar</Button>
          <Button onClick={onNext} className="bg-gradient-primary text-white shadow-primary">
            Próximo: Comportamento<ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
