import { useState } from 'react';
import { Bloco6Data, UnidadeCorporal } from '@/types/identidade';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronRight, ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { getSeverityColorHex } from '@/utils/calculations';

const UNIDADES_CONFIG = [
  {
    id: 'UC1', nome: 'UC1 – Cabeça & Pescoço',
    emoji: '🧠',
    checklist: ['Rigidez cervical', 'Cefaleia tensional', 'Restrição ROM >20%', 'Dor à palpação', 'Restrição articular C0-C3', 'Vertigem/tontura'],
  },
  {
    id: 'UC2', nome: 'UC2 – Coluna Torácica',
    emoji: '🫁',
    checklist: ['Cifose excessiva', 'Restrição ROM >30%', 'Dor interescapular', 'Hipomobilidade costal', 'Restrição T1-T12', 'Fadiga ao respirar'],
  },
  {
    id: 'UC3', nome: 'UC3 – Coluna Lombar',
    emoji: '💪',
    checklist: ['Hiperlordose', 'Restrição ROM >30%', 'Fraqueza abdominal', 'Dor à mobilização', 'Instabilidade lombar'],
  },
  {
    id: 'UC4', nome: 'UC4 – Sacro-Pélvica',
    emoji: '⚖️',
    checklist: ['Assimetria pélvica', 'Restrição sacroilíaca', 'Dor sacroilíaca', 'Instabilidade'],
  },
  {
    id: 'UA-D', nome: 'UA-D – MMSS Direito',
    emoji: '💪',
    checklist: ['Restrição ROM >20%', 'Fraqueza rotator cuff', 'Síndrome do impacto', 'Dor cervical-braquial', 'Restrição articular'],
  },
  {
    id: 'UA-E', nome: 'UA-E – MMSS Esquerdo',
    emoji: '💪',
    checklist: ['Restrição ROM >20%', 'Fraqueza rotator cuff', 'Síndrome do impacto', 'Dor cervical-braquial', 'Restrição articular'],
  },
  {
    id: 'ID', nome: 'ID – MMII Direito',
    emoji: '🦵',
    checklist: ['Restrição ROM >20%', 'Fraqueza musculatura', 'Dor articular', 'Limitação marcha', 'Desequilíbrio'],
  },
  {
    id: 'DD', nome: 'DD – MMII Esquerdo',
    emoji: '🦵',
    checklist: ['Restrição ROM >20%', 'Fraqueza musculatura', 'Dor articular', 'Limitação marcha', 'Desequilíbrio'],
  },
];

interface Props {
  data: Bloco6Data;
  onChange: (data: Bloco6Data) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Bloco6Estrutural({ data, onChange, onNext, onBack }: Props) {
  const [expandedUnit, setExpandedUnit] = useState<string | null>('UC1');
  const [unidades, setUnidades] = useState<UnidadeCorporal[]>(() =>
    UNIDADES_CONFIG.map(uc => {
      const existing = data.unidades.find(u => u.id === uc.id);
      return existing || {
        id: uc.id, nome: uc.nome, score: 0,
        checklist: Object.fromEntries(uc.checklist.map(k => [k, false])),
        observacoes: '',
      };
    })
  );

  const updateUnidade = (id: string, updater: (u: UnidadeCorporal) => UnidadeCorporal) => {
    const newUnidades = unidades.map(u => u.id === id ? updater(u) : u);
    setUnidades(newUnidades);
    const scoreE = newUnidades.reduce((acc, u) => acc + u.score, 0) / newUnidades.length;
    onChange({ unidades: newUnidades, scoreE });
  };

  const scoreE = unidades.reduce((acc, u) => acc + u.score, 0) / unidades.length;

  return (
    <div className="space-y-6">
      <div className="clinical-card">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">Bloco 6</Badge>
              <span className="text-xs text-muted-foreground">~15 min</span>
            </div>
            <h2 className="text-xl font-bold">Avaliação Estrutural</h2>
            <p className="text-muted-foreground text-sm mt-1">8 Unidades Corporais (UC1-UC4, UA-D/E, ID, DD)</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Score E</div>
            <div className="text-3xl font-bold text-primary">{scoreE.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">/10</div>
          </div>
        </div>
      </div>

      {/* Score mini-grid */}
      <div className="grid grid-cols-4 gap-2">
        {unidades.map(u => (
          <button
            key={u.id}
            onClick={() => setExpandedUnit(expandedUnit === u.id ? null : u.id)}
            className={`p-3 rounded-xl border-2 text-center transition-all cursor-pointer ${
              expandedUnit === u.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="text-lg">{UNIDADES_CONFIG.find(uc => uc.id === u.id)?.emoji}</div>
            <div className="text-xs font-medium truncate">{u.id}</div>
            <div
              className="text-lg font-bold"
              style={{ color: getSeverityColorHex(u.score) }}
            >
              {u.score.toFixed(1)}
            </div>
          </button>
        ))}
      </div>

      {/* Expandable units */}
      {unidades.map(unidade => {
        const config = UNIDADES_CONFIG.find(uc => uc.id === unidade.id)!;
        const isExpanded = expandedUnit === unidade.id;

        return (
          <div
            key={unidade.id}
            className={`clinical-card border-2 transition-all ${isExpanded ? 'border-primary' : 'border-border'}`}
          >
            <button
              className="w-full flex items-center justify-between"
              onClick={() => setExpandedUnit(isExpanded ? null : unidade.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{config.emoji}</span>
                <div className="text-left">
                  <div className="font-semibold text-sm">{unidade.nome}</div>
                  <div className="text-xs text-muted-foreground">{config.checklist.length} indicadores</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="text-2xl font-bold"
                  style={{ color: getSeverityColorHex(unidade.score) }}
                >
                  {unidade.score.toFixed(1)}/10
                </div>
                {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </div>
            </button>

            {isExpanded && (
              <div className="mt-5 space-y-5 border-t pt-5">
                {/* Score slider */}
                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Score de comprometimento</Label>
                    <span
                      className="font-bold text-lg"
                      style={{ color: getSeverityColorHex(unidade.score) }}
                    >
                      {unidade.score.toFixed(1)}/10
                    </span>
                  </div>
                  <Slider
                    value={[unidade.score]}
                    min={0} max={10} step={0.5}
                    onValueChange={([v]) => updateUnidade(unidade.id, u => ({ ...u, score: v }))}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0 = Sem restrição</span><span>10 = Muito comprometido</span>
                  </div>
                </div>

                {/* Checklist */}
                <div>
                  <Label className="mb-2 block">Achados clínicos</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {config.checklist.map(item => (
                      <div key={item} className="flex items-center gap-2">
                        <Checkbox
                          id={`${unidade.id}-${item}`}
                          checked={unidade.checklist[item] || false}
                          onCheckedChange={checked => updateUnidade(unidade.id, u => ({
                            ...u, checklist: { ...u.checklist, [item]: !!checked }
                          }))}
                        />
                        <Label htmlFor={`${unidade.id}-${item}`} className="text-sm cursor-pointer">{item}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Observações */}
                <div>
                  <Label>Observações clínicas</Label>
                  <Textarea
                    placeholder="Estruturas comprometidas, achados específicos..."
                    value={unidade.observacoes}
                    onChange={e => updateUnidade(unidade.id, u => ({ ...u, observacoes: e.target.value }))}
                    className="mt-1.5 resize-none"
                    rows={2}
                    maxLength={200}
                  />
                  <div className="text-xs text-muted-foreground mt-1">{unidade.observacoes.length}/200</div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="clinical-card bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />Voltar
          </Button>
          <span className="text-sm text-muted-foreground">Score E: <strong className="text-primary">{scoreE.toFixed(1)}/10</strong></span>
          <Button onClick={onNext} className="bg-gradient-primary text-white shadow-primary">
            Gerar Relatório ID
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
