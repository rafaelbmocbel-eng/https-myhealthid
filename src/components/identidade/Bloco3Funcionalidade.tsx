import { useState } from 'react';
import { Bloco3Data } from '@/types/identidade';
import { calcularScoreEFI, getSeverityColorHex } from '@/utils/calculations';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronLeft, Briefcase, Home, Dumbbell, Heart, Users } from 'lucide-react';

const QUESTOES = [
  {
    key: 'trabalho' as keyof Bloco3Data,
    icon: Briefcase,
    label: 'Capacidade de TRABALHO/ESTUDO',
    desc: 'Quanto a dor/restrição afeta sua capacidade de trabalhar ou estudar?',
    min: 'Nenhum impacto',
    max: 'Impossível trabalhar',
  },
  {
    key: 'domesticas' as keyof Bloco3Data,
    icon: Home,
    label: 'ATIVIDADES DOMÉSTICAS',
    desc: 'Quanto afeta limpar, cozinhar, lavar roupa?',
    min: 'Faço tudo normalmente',
    max: 'Preciso de ajuda em tudo',
  },
  {
    key: 'exercicio' as keyof Bloco3Data,
    icon: Dumbbell,
    label: 'EXERCÍCIO/ESPORTE',
    desc: 'Quanto afeta sua capacidade de se exercitar ou praticar esportes?',
    min: 'Pratico normalmente',
    max: 'Não consigo fazer nada',
  },
  {
    key: 'independencia' as keyof Bloco3Data,
    icon: Heart,
    label: 'INDEPENDÊNCIA PESSOAL',
    desc: 'Quanto afeta vestir-se, higiene, alimentação?',
    min: 'Totalmente independente',
    max: 'Totalmente dependente',
  },
  {
    key: 'vidaSocial' as keyof Bloco3Data,
    icon: Users,
    label: 'VIDA SOCIAL/RELACIONAMENTOS',
    desc: 'Quanto afeta sua vida social e relacionamentos?',
    min: 'Vida social ativa',
    max: 'Isolado completamente',
  },
];

interface Props {
  data: Bloco3Data;
  onChange: (data: Bloco3Data) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Bloco3Funcionalidade({ data, onChange, onNext, onBack }: Props) {
  const [localData, setLocalData] = useState<Bloco3Data>(data);

  const update = (key: keyof Bloco3Data, value: number) => {
    const updated = { ...localData, [key]: value };
    updated.scoreEFI = calcularScoreEFI(updated);
    setLocalData(updated);
    onChange(updated);
  };

  const scoreEFI = calcularScoreEFI(localData);

  const getInterpretacao = (score: number) => {
    if (score <= 2) return { label: 'Sem comprometimento', color: 'text-success bg-green-50' };
    if (score <= 5) return { label: 'Leve comprometimento', color: 'text-amber-600 bg-amber-50' };
    if (score <= 7) return { label: 'Moderado', color: 'text-orange-600 bg-orange-50' };
    if (score <= 9) return { label: 'Severo', color: 'text-destructive bg-red-50' };
    return { label: 'Total incapacidade', color: 'text-purple-700 bg-purple-50' };
  };

  const interp = getInterpretacao(scoreEFI);

  return (
    <div className="space-y-6">
      <div className="clinical-card">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">Bloco 3</Badge>
              <span className="text-xs text-muted-foreground">~4 min</span>
            </div>
            <h2 className="text-xl font-bold">Escala de Funcionalidade (EFI)</h2>
            <p className="text-muted-foreground text-sm mt-1">5 questões para avaliar o impacto funcional da disfunção</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Score EFI</div>
            <div className="text-3xl font-bold text-primary">{scoreEFI.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">/10</div>
          </div>
        </div>
      </div>

      <div className="clinical-card">
        <div className="space-y-8">
          {QUESTOES.map((q, idx) => {
            const Icon = q.icon;
            const val = (localData as any)[q.key] as number;
            return (
              <div key={q.key}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-muted-foreground font-medium">Questão {idx + 1}</span>
                        <h4 className="font-semibold text-sm">{q.label}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{q.desc}</p>
                      </div>
                      <div
                        className="text-2xl font-bold ml-4"
                        style={{ color: getSeverityColorHex(val) }}
                      >
                        {val}
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="relative">
                        <div className="h-3 rounded-full w-full" style={{
                          background: `linear-gradient(to right, #22c55e, #f59e0b, #ef4444)`
                        }} />
                        <Slider
                          value={[val]}
                          min={0} max={10} step={1}
                          onValueChange={([v]) => update(q.key, v)}
                          className="mt-2"
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{q.min}</span>
                        <span className="text-right">{q.max}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {idx < QUESTOES.length - 1 && <div className="border-b border-border/50 mt-4" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Score summary */}
      <div className="clinical-card">
        <h3 className="font-semibold mb-4">Resumo de Funcionalidade</h3>
        <div className="space-y-3">
          {QUESTOES.map(q => {
            const val = (localData as any)[q.key] as number;
            return (
              <div key={q.key} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-40 truncate">{q.label}</span>
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${val * 10}%`, backgroundColor: getSeverityColorHex(val) }}
                  />
                </div>
                <span className="text-sm font-semibold w-8 text-right">{val}/10</span>
              </div>
            );
          })}
        </div>
        <div className={`mt-4 p-3 rounded-lg border ${interp.color}`}>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm">Score EFI: {scoreEFI.toFixed(1)}/10</span>
            <span className="text-sm font-medium">{interp.label}</span>
          </div>
        </div>
      </div>

      <div className="clinical-card bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />Voltar
          </Button>
          <Button onClick={onNext} className="bg-gradient-primary text-white shadow-primary">
            Próximo: Comportamento
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
