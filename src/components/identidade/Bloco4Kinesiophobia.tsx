import { useState } from 'react';
import { Bloco4Data } from '@/types/identidade';
import { calcularScoreP } from '@/utils/calculations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronLeft, AlertTriangle } from 'lucide-react';

// TSK-11 adaptada: todos os itens estão redigidos na direção do medo ao movimento.
// "Concordo Fortemente" = máxima cinesiofobia em TODOS os itens (sem inversão).
const TSK_ITEMS = [
  'Eu tenho medo de que meu problema de saúde possa piorar se eu for fisicamente ativo',
  'Tenho medo de me machucar acidentalmente durante a fisioterapia',
  'Meu corpo me diz para evitar certos movimentos por medo de lesão',
  'Eu não deveria fazer atividades que causem dor',
  'Se eu experimentar dor, significa que meu corpo está sendo prejudicado',
  'Para estar seguro, é melhor ser inativo quando se tem dor',
  'Dor significa que há algo errado no meu corpo',
  'Meu problema de saúde pode levar a uma lesão grave',
  'Eu tenho medo de não poder controlar meu problema de saúde',
  'Não é seguro praticar nenhum tipo de movimento quando em dor',
  'Eu gosto de deixar outras pessoas saberem que estou em dor',
];

const OPCOES = [
  { value: 1, label: 'Discordo Fortemente', emoji: '💪' },
  { value: 2, label: 'Discordo', emoji: '🙂' },
  { value: 3, label: 'Concordo', emoji: '😟' },
  { value: 4, label: 'Concordo Fortemente', emoji: '😨' },
];

interface Props {
  data: Bloco4Data;
  onChange: (data: Bloco4Data) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Bloco4Kinesiophobia({ data, onChange, onNext, onBack }: Props) {
  const [respostas, setRespostas] = useState<number[]>(data.respostas);

  const update = (idx: number, value: number) => {
    const newResp = [...respostas];
    newResp[idx] = value;
    setRespostas(newResp);
    const scoreP = calcularScoreP({ respostas: newResp, scoreP: 0 });
    onChange({ respostas: newResp, scoreP });
  };

  const scoreP = calcularScoreP({ respostas, scoreP: 0 });
  const allAnswered = respostas.every(r => r >= 1 && r <= 4);

  const getInterpretacao = () => {
    if (scoreP <= 3) return { label: 'Baixa cinesiofobia', color: 'text-success bg-green-50 border-green-200', icon: '✅' };
    if (scoreP <= 6) return { label: 'Cinesiofobia moderada', color: 'text-amber-600 bg-amber-50 border-amber-200', icon: '⚠️' };
    return { label: 'Alta cinesiofobia – Risco de cronicidade', color: 'text-destructive bg-red-50 border-red-200', icon: '🚨' };
  };

  const interp = getInterpretacao();

  return (
    <div className="space-y-6">
      <div className="clinical-card">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">Bloco 4</Badge>
              <span className="text-xs text-muted-foreground">~6 min</span>
            </div>
            <h2 className="text-xl font-bold">Comportamento</h2>
            <p className="text-muted-foreground text-sm mt-1">Escala Tampa de Cinesiofobia (TSK-11 adaptada)</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Score P</div>
            <div className="text-3xl font-bold text-primary">{scoreP.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">/10</div>
          </div>
        </div>
      </div>

      <div className="clinical-card">
        <p className="text-sm text-muted-foreground mb-6">
          Por favor, indique até que ponto você concorda com cada afirmação abaixo em relação ao seu problema de saúde atual.
        </p>

        {/* Header de opções */}
        <div className="hidden md:grid grid-cols-4 gap-2 mb-4 ml-8">
          {OPCOES.map(op => (
            <div key={op.value} className="text-center">
              <div className="text-lg">{op.emoji}</div>
              <div className="text-xs text-muted-foreground">{op.label}</div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {TSK_ITEMS.map((item, idx) => {
            const resp = respostas[idx];
            const respondido = resp >= 1 && resp <= 4;
            // Concordar (≥3) = mais medo = âmbar; discordar (≤2) = menos medo = verde
            const cardClass = respondido
              ? resp >= 3
                ? 'border-amber-200 bg-amber-50/50'
                : 'border-green-200 bg-green-50/50'
              : 'border-border bg-card';

            return (
              <div key={idx} className={`p-4 rounded-xl border-2 transition-all ${cardClass}`}>
                <div className="flex gap-3">
                  <span className="text-xs font-bold text-muted-foreground mt-1 w-6 shrink-0">{idx + 1}.</span>
                  <div className="flex-1">
                    <p className="text-sm mb-3 font-medium">{item}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {OPCOES.map(op => (
                        <button
                          key={op.value}
                          onClick={() => update(idx, op.value)}
                          className={`flex items-center gap-2 p-2 rounded-lg border-2 text-sm transition-all ${
                            resp === op.value
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border hover:border-primary/50 hover:bg-secondary'
                          }`}
                        >
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
      </div>

      {/* Resultado */}
      {allAnswered && (
        <div className={`clinical-card border-2 ${interp.color}`}>
          <div className="flex items-start gap-3">
            <span className="text-2xl">{interp.icon}</span>
            <div>
              <div className="font-semibold">Score TSK-11: {scoreP.toFixed(1)}/10</div>
              <div className="text-sm mt-1">{interp.label}</div>
              {scoreP > 7 && (
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <AlertTriangle className="h-3 w-3" />
                  Cinesiofobia acentuada (+2 ao ID final) – Recomendado: educação em dor e graded exposure
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="clinical-card bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />Voltar
          </Button>
          <span className="text-sm text-muted-foreground">{respostas.filter(r => r > 0).length}/11 respondidas</span>
          <Button onClick={onNext} className="bg-gradient-primary text-white shadow-primary">
            Próximo: Regulação
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
