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
import { BodyAvatarSVG, UC_TO_REGIONS } from './BodyAvatarSVG';

// Structural tissue types that modulate the pain equation
const TIPOS_ESTRUTURAIS: { id: keyof Pick<UnidadeCorporal, 'scoreMuscular' | 'scoreArticular' | 'scoreLigamentar' | 'scoreNervosa' | 'scoreVisceral'>; label: string; color: string }[] = [
  { id: 'scoreMuscular', label: 'Muscular', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'scoreArticular', label: 'Articular', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'scoreLigamentar', label: 'Ligamentar', color: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'scoreNervosa', label: 'Nervosa', color: 'bg-red-100 text-red-700 border-red-200' },
  { id: 'scoreVisceral', label: 'Visceral', color: 'bg-purple-100 text-purple-700 border-purple-200' },
];

const UNIDADES_CONFIG = [
  {
    id: 'UC1', nome: 'UC1 – Cabeça & Pescoço', emoji: '🧠',
    checklist: [
      'Rigidez cervical', 'Cefaleia tensional', 'Restrição ROM >20%',
      'Dor à palpação', 'Restrição articular C0-C3', 'Vertigem/tontura',
      'Protração cervical (anteriorização)',
    ],
  },
  {
    id: 'UC2', nome: 'UC2 – Coluna Torácica', emoji: '🫁',
    checklist: [
      'Cifose excessiva', 'Restrição ROM >30%', 'Dor interescapular',
      'Hipomobilidade costal', 'Restrição T1-T12', 'Fadiga ao respirar',
      'Restrição expansibilidade torácica',
    ],
  },
  {
    id: 'UC3', nome: 'UC3 – Coluna Lombar', emoji: '💡',
    checklist: [
      'Hiperlordose', 'Restrição ROM >30%', 'Fraqueza abdominal',
      'Dor à mobilização', 'Instabilidade lombar', 'Restrição articular facetária',
      'Tensão fascial toraco-lombar',
    ],
  },
  {
    id: 'UC4', nome: 'UC4 – Sacro-Pélvica', emoji: '⚖️',
    checklist: [
      'Assimetria pélvica', 'Restrição sacroilíaca', 'Dor sacroilíaca',
      'Instabilidade', 'Tensão piriforme/glúteo', 'Restrição coccígea',
    ],
  },
  {
    id: 'UA-D', nome: 'UA-D – MMSS Direito', emoji: '💪',
    checklist: [
      'Restrição ROM >20%', 'Fraqueza rotator cuff', 'Síndrome do impacto',
      'Dor cervical-braquial', 'Restrição articular glenoumeral', 'Síndrome do túnel do carpo',
    ],
  },
  {
    id: 'UA-E', nome: 'UA-E – MMSS Esquerdo', emoji: '💪',
    checklist: [
      'Restrição ROM >20%', 'Fraqueza rotator cuff', 'Síndrome do impacto',
      'Dor cervical-braquial', 'Restrição articular glenoumeral', 'Síndrome do túnel do carpo',
    ],
  },
  {
    id: 'ID', nome: 'ID – MMII Direito', emoji: '🦵',
    checklist: [
      'Restrição ROM >20%', 'Fraqueza quadríceps', 'Dor articular coxofemoral/joelho',
      'Limitação marcha/claudicação', 'Desequilíbrio/risco queda', 'Restrição tornozelo',
    ],
  },
  {
    id: 'DD', nome: 'DD – MMII Esquerdo', emoji: '🦵',
    checklist: [
      'Restrição ROM >20%', 'Fraqueza quadríceps', 'Dor articular coxofemoral/joelho',
      'Limitação marcha/claudicação', 'Desequilíbrio/risco queda', 'Restrição tornozelo',
    ],
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
        scoreMuscular: 0,
        scoreArticular: 0,
        scoreLigamentar: 0,
        scoreNervosa: 0,
        scoreVisceral: 0,
      };
    })
  );

  const updateUnidade = (id: string, updater: (u: UnidadeCorporal) => UnidadeCorporal) => {
    const newUnidades = unidades.map(u => u.id === id ? updater(u) : u);
    setUnidades(newUnidades);
    const scoreE = newUnidades.reduce((acc, u) => acc + (u.score / 2), 0);
    onChange({ unidades: newUnidades, scoreE });
  };

  // Auto-calculate score from checklist count
  const autoScoreFromChecklist = (checklist: Record<string, boolean>, totalItems: number): number => {
    const marked = Object.values(checklist).filter(Boolean).length;
    return Math.round((marked / totalItems) * 10 * 10) / 10;
  };

  const scoreE = unidades.reduce((acc, u) => acc + (u.score / 2), 0);

  // Build ucScoreMap for avatar
  const ucScoreMap = Object.fromEntries(unidades.map(u => [u.id, u.score]));

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
            <p className="text-muted-foreground text-sm mt-1">8 Unidades Corporais – estruturas moduladoras da dor</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Soma estrutural</div>
            <div className="text-3xl font-bold text-primary">{scoreE.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">pontos</div>
          </div>
        </div>
      </div>

      {/* Layout: Avatar + units */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Body avatar (Sticky) */}
        <div className="lg:col-span-5 sticky top-24">
          <div className="clinical-card flex flex-col items-center">
            <h3 className="font-semibold text-sm mb-3 self-start">Mapa Corporal</h3>
            <p className="text-xs text-muted-foreground mb-3 self-start">
              Clique em uma região para avaliar os tecidos e achados clínicos
            </p>
            <BodyAvatarSVG
              mode="structural"
              ucScoreMap={ucScoreMap}
              highlightedUC={expandedUnit}
              showBack
              onRegionClick={(regionId) => {
                for (const [ucId, regions] of Object.entries(UC_TO_REGIONS)) {
                  if (regions.includes(regionId)) {
                    setExpandedUnit(ucId);
                    break;
                  }
                }
              }}
              className="w-full max-w-sm"
            />

            {/* Legend */}
            <div className="flex flex-wrap gap-2 mt-4 text-[10px] self-start">
              {[
                { label: 'Normal', color: 'bg-[#e8f4f8]' },
                { label: 'Leve', color: 'bg-[#fef3c7]' },
                { label: 'Moderado', color: 'bg-[#f97316]' },
                { label: 'Severo', color: 'bg-[#ef4444]' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${l.color} border border-border`}></div>
                  <span>{l.label}</span>
                </div>
              ))}
            </div>

            {/* Structural types legend */}
            <div className="mt-4 w-full pt-4 border-t">
              <p className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Moduladores:</p>
              <div className="flex flex-wrap gap-1">
                {TIPOS_ESTRUTURAIS.map(t => (
                  <span key={t.id} className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${t.color}`}>
                    {t.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Units panel & Editor */}
        <div className="lg:col-span-7 space-y-4">
          {/* Unit Selector (Mini-grid) */}
          <div className="clinical-card p-3">
            <Label className="text-[10px] font-bold text-muted-foreground uppercase mb-2 block">Navegação Rápida</Label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {unidades.map(u => (
                <button
                  key={u.id}
                  onClick={() => setExpandedUnit(u.id)}
                  className={`p-1.5 rounded-lg border transition-all text-center flex flex-col items-center justify-center gap-0.5 ${expandedUnit === u.id
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                      : 'border-border hover:border-primary/50 bg-white'
                    }`}
                >
                  <span className="text-sm">{UNIDADES_CONFIG.find(uc => uc.id === u.id)?.emoji}</span>
                  <span className={`text-[9px] font-bold ${expandedUnit === u.id ? 'text-primary' : 'text-muted-foreground'}`}>
                    {u.score.toFixed(1)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Unit Editor */}
          {expandedUnit ? (() => {
            const unidade = unidades.find(u => u.id === expandedUnit)!;
            const config = UNIDADES_CONFIG.find(uc => uc.id === expandedUnit)!;

            return (
              <div key={unidade.id} className="clinical-card border-l-4 border-l-primary animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl p-2 bg-primary/5 rounded-xl">{config.emoji}</span>
                    <div>
                      <h3 className="font-bold text-lg leading-tight">{unidade.nome}</h3>
                      <p className="text-xs text-muted-foreground">ID Unidade: {unidade.id}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-1">Score Atual</div>
                    <div className="text-3xl font-black" style={{ color: getSeverityColorHex(unidade.score) }}>
                      {unidade.score.toFixed(1)}
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  {/* 1. Structural Sliders */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-bold flex items-center gap-2 text-indigo-900">
                        1. Tecidos Envolvidos
                        <Badge variant="secondary" className="text-[10px]">Moduladores de Dor</Badge>
                      </Label>
                    </div>
                    <div className="grid gap-4 bg-muted/20 p-4 rounded-xl border border-dashed border-muted-foreground/30">
                      {TIPOS_ESTRUTURAIS.map(tipo => {
                        const val = unidade[tipo.id] ?? 0;
                        return (
                          <div key={tipo.id} className="space-y-1.5">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className={`px-2 py-0.5 rounded-full border font-bold ${tipo.color}`}>
                                {tipo.label}
                              </span>
                              <span className="font-black text-xs" style={{ color: getSeverityColorHex(val) }}>
                                {val.toFixed(1)}/10
                              </span>
                            </div>
                            <Slider
                              value={[val]}
                              min={0} max={10} step={0.5}
                              onValueChange={([v]) => updateUnidade(unidade.id, u => ({ ...u, [tipo.id]: v }))}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Compromisso Unit Score */}
                  <div className="space-y-4 bg-primary/5 p-4 rounded-xl border border-primary/20">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-bold flex items-center gap-2 text-primary">
                        2. Comprometimento da Unidade
                      </Label>
                      <button
                        type="button"
                        onClick={() => {
                          const auto = autoScoreFromChecklist(unidade.checklist, config.checklist.length);
                          updateUnidade(unidade.id, u => ({ ...u, score: auto }));
                        }}
                        className="text-[10px] bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary/20 transition-colors font-bold uppercase"
                      >
                        Auto-Score do Checklist
                      </button>
                    </div>
                    <Slider
                      value={[unidade.score]}
                      min={0} max={10} step={0.5}
                      onValueChange={([v]) => updateUnidade(unidade.id, u => ({ ...u, score: v }))}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground font-medium px-1">
                      <span>Mínimo (Saudável)</span>
                      <span>Crítico (Disfuncional)</span>
                    </div>
                  </div>

                  {/* 3. Clinical Findings */}
                  <div className="space-y-3">
                    <Label className="text-sm font-bold flex items-center gap-2 text-slate-800">
                      3. Achados Clínicos (Checklist)
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white border rounded-xl p-4 shadow-sm">
                      {config.checklist.map(item => (
                        <div key={item}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer",
                            unidade.checklist[item] ? "bg-primary/5" : "hover:bg-muted/30"
                          )}
                          onClick={() => {
                            const newChecklist = { ...unidade.checklist, [item]: !unidade.checklist[item] };
                            updateUnidade(unidade.id, u => ({ ...u, checklist: newChecklist }));
                          }}
                        >
                          <Checkbox
                            id={`${unidade.id}-${item}`}
                            checked={!!unidade.checklist[item]}
                            className="pointer-events-none"
                          />
                          <Label className="text-xs font-medium cursor-pointer flex-1 line-clamp-1">
                            {item}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 4. Observations */}
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-800">4. Observações Específicas</Label>
                    <Textarea
                      placeholder="Achados de palpação, mobilidade segmentar, testes provocativos..."
                      value={unidade.observacoes}
                      onChange={e => updateUnidade(unidade.id, u => ({ ...u, observacoes: e.target.value }))}
                      className="resize-none bg-white text-xs min-h-[80px]"
                      maxLength={200}
                    />
                    <div className="flex justify-between items-center px-1">
                      <p className="text-[10px] text-muted-foreground italic">Seja conciso na descrição clínica</p>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{unidade.observacoes.length}/200</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })() : (
            <div className="clinical-card border-dashed flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-3xl opacity-50">🧭</div>
              <div>
                <h4 className="font-bold text-muted-foreground">Nenhuma unidade selecionada</h4>
                <p className="text-xs text-muted-foreground max-w-[240px] mt-1 mx-auto">
                  Toque em uma região no mapa corporal à esquerda para iniciar a avaliação.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="clinical-card bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />Voltar
          </Button>
          <span className="text-sm text-muted-foreground">Soma: <strong className="text-primary">{scoreE.toFixed(1)} pontos</strong></span>
          <Button onClick={onNext} className="bg-gradient-primary text-white shadow-primary">
            Gerar Relatório ID
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
