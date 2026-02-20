import { useState } from 'react';
import { Bloco5Data } from '@/types/identidade';
import { calcularScoresRC } from '@/utils/calculations';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronLeft, Moon, Zap, Brain, AlertCircle } from 'lucide-react';

interface SliderItemProps {
  label: string;
  value: number;
  min: string;
  max: string;
  onChange: (v: number) => void;
}

function SliderItem({ label, value, min, max, onChange }: SliderItemProps) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm font-bold text-primary">{value}/10</span>
      </div>
      <Slider value={[value]} min={0} max={10} step={1} onValueChange={([v]) => onChange(v)} />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

interface Props {
  data: Bloco5Data;
  onChange: (data: Bloco5Data) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Bloco5Regulacao({ data, onChange, onNext, onBack }: Props) {
  const [localData, setLocalData] = useState<Bloco5Data>(data);

  const update = (field: keyof Bloco5Data, value: number) => {
    const updated = { ...localData, [field]: value };
    const { r1, r2, r3, r, c } = calcularScoresRC(updated);
    updated.scoreR1 = r1; updated.scoreR2 = r2; updated.scoreR3 = r3;
    updated.scoreR = r; updated.scoreC = c;
    setLocalData(updated);
    onChange(updated);
  };

  const { r1, r2, r3, r, c } = calcularScoresRC(localData);

  const getScoreColor = (score: number) => {
    if (score <= 3) return 'text-destructive';
    if (score <= 6) return 'text-amber-600';
    return 'text-success';
  };

  return (
    <div className="space-y-6">
      <div className="clinical-card">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">Bloco 5</Badge>
              <span className="text-xs text-muted-foreground">~10 min</span>
            </div>
            <h2 className="text-xl font-bold">Regulação Neurovegetativa & Contexto</h2>
            <p className="text-muted-foreground text-sm mt-1">Scores R (regulação) e C (carga contextual)</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Score R</div>
            <div className={`text-3xl font-bold ${getScoreColor(r)}`}>{r.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">/10</div>
          </div>
        </div>
      </div>

      {/* Scores mini-cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Sono', val: r1, icon: '🛌' },
          { label: 'Energia', val: r2, icon: '⚡' },
          { label: 'Psicológico', val: r3, icon: '🧠' },
          { label: 'Carga C', val: c, icon: '⚖️' },
        ].map(({ label, val, icon }) => (
          <div key={label} className="clinical-card p-3 text-center">
            <div className="text-xl mb-1">{icon}</div>
            <div className={`text-xl font-bold ${getScoreColor(val)}`}>{val.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {/* R1 – Sono */}
      <div className="clinical-card space-y-5">
        <h3 className="font-semibold flex items-center gap-2">
          <Moon className="h-5 w-5 text-blue-500" />
          5A – Qualidade do Sono (R1 = {r1.toFixed(1)}/10)
        </h3>
        <SliderItem label="Qualidade geral do sono" value={localData.qualidadeSono} min="Horrível" max="Excelente" onChange={v => update('qualidadeSono', v)} />
        <SliderItem label="Horas de sono por noite (0=<5h, 10=8-9h)" value={localData.horasSono} min="<5h (insuficiente)" max="8-9h (ideal)" onChange={v => update('horasSono', v)} />
        <SliderItem label="Acorda durante a noite?" value={localData.acordaNaNoite} min="Não acorda" max="Várias vezes" onChange={v => update('acordaNaNoite', v)} />
        <SliderItem label="A dor afeta o seu sono?" value={localData.dorAfetaSono} min="Não afeta" max="Sempre acorda com dor" onChange={v => update('dorAfetaSono', v)} />
        <SliderItem label="Sente-se descansado ao acordar?" value={localData.descansadoAoAcordar} min="Não descansado" max="Totalmente descansado" onChange={v => update('descansadoAoAcordar', v)} />
      </div>

      {/* R2 – Energia */}
      <div className="clinical-card space-y-5">
        <h3 className="font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          5B – Nível de Energia (R2 = {r2.toFixed(1)}/10)
        </h3>
        <SliderItem label="Nível de energia ao acordar" value={localData.energiaAoAcordar} min="Exausto" max="Pleno" onChange={v => update('energiaAoAcordar', v)} />
        <SliderItem label="Fadiga durante o dia" value={localData.fadigaDia} min="Nenhuma fadiga" max="Fadiga constante" onChange={v => update('fadigaDia', v)} />
        <SliderItem label="Precisa cochilar?" value={localData.precisaCochiblar} min="Não" max="Várias vezes ao dia" onChange={v => update('precisaCochiblar', v)} />
        <SliderItem label="Motivação para atividades" value={localData.motivacao} min="Nenhuma motivação" max="Total motivação" onChange={v => update('motivacao', v)} />
        <SliderItem label="Resistência física" value={localData.resistenciaFisica} min="Nenhuma" max="Excelente" onChange={v => update('resistenciaFisica', v)} />
      </div>

      {/* R3 – Psicológico */}
      <div className="clinical-card space-y-5">
        <h3 className="font-semibold flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-500" />
          5C – Estado Psicológico (R3 = {r3.toFixed(1)}/10)
        </h3>
        <SliderItem label="Nível de stress/ansiedade" value={localData.nivelStress} min="Nenhum" max="Extremo" onChange={v => update('nivelStress', v)} />
        <SliderItem label="Humor geral" value={localData.humorGeral} min="Deprimido" max="Ótimo" onChange={v => update('humorGeral', v)} />
        <SliderItem label="Capacidade de concentração" value={localData.concentracao} min="Não consigo" max="Perfeita" onChange={v => update('concentracao', v)} />
        <SliderItem label="Preocupação com a saúde" value={localData.preocupacaoSaude} min="Nenhuma" max="Constantemente" onChange={v => update('preocupacaoSaude', v)} />
        <SliderItem label="Sensação de controle sobre o problema" value={localData.sensacaoControle} min="Sem controle" max="Total controle" onChange={v => update('sensacaoControle', v)} />
      </div>

      {/* Score C – Carga Contextual */}
      <div className="clinical-card space-y-5">
        <h3 className="font-semibold flex items-center gap-2">
          ⚖️ Carga Contextual (C = {c.toFixed(1)}/10)
        </h3>
        <SliderItem label="Carga laboral/ocupacional" value={localData.cargaLaboral} min="Relaxada" max="Insustentável" onChange={v => update('cargaLaboral', v)} />
        <SliderItem label="Relacionamentos/família" value={localData.relacionamentos} min="Ótimos" max="Conflituosos" onChange={v => update('relacionamentos', v)} />
        <SliderItem label="Situação financeira" value={localData.situacaoFinanceira} min="Confortável" max="Em apuros" onChange={v => update('situacaoFinanceira', v)} />
        <SliderItem label="Eventos de vida estressantes recentes" value={localData.eventosEstressantes} min="Nenhum" max="Múltiplos" onChange={v => update('eventosEstressantes', v)} />
      </div>

      {r < 2 && (
        <div className="clinical-card border-destructive bg-red-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-destructive">Regulação Neurovegetativa Crítica (R = {r.toFixed(1)} &lt; 2)</div>
              <p className="text-sm text-destructive/80 mt-1">
                Este score crítico adiciona +3 ao ID final. Recomenda-se: higiene do sono, relaxamento, gestão de stress urgente.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="clinical-card bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />Voltar
          </Button>
          <Button onClick={onNext} className="bg-gradient-primary text-white shadow-primary">
            Próximo: Estrutural
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
