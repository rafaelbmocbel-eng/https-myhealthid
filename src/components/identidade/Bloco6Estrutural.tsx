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
const TIPOS_ESTRUTURAIS = [
  { id: 'muscular', label: 'Muscular', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'articular', label: 'Articular', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'ligamentar', label: 'Ligamentar', color: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'nervosa', label: 'Nervosa', color: 'bg-red-100 text-red-700 border-red-200' },
  { id: 'visceral', label: 'Visceral', color: 'bg-purple-100 text-purple-700 border-purple-200' },
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
      };
    })
  );

  const updateUnidade = (id: string, updater: (u: UnidadeCorporal) => UnidadeCorporal) => {
    const newUnidades = unidades.map(u => u.id === id ? updater(u) : u);
    setUnidades(newUnidades);
    const scoreE = newUnidades.reduce((acc, u) => acc + u.score, 0) / newUnidades.length;
    onChange({ unidades: newUnidades, scoreE });
  };

  // Auto-calculate score from checklist count
  const autoScoreFromChecklist = (checklist: Record<string, boolean>, totalItems: number): number => {
    const marked = Object.values(checklist).filter(Boolean).length;
    return Math.round((marked / totalItems) * 10 * 10) / 10;
  };

  const scoreE = unidades.reduce((acc, u) => acc + u.score, 0) / unidades.length;

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
            <div className="text-xs text-muted-foreground">Score E</div>
            <div className="text-3xl font-bold text-primary">{scoreE.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">/10</div>
          </div>
        </div>
      </div>

      {/* Layout: Avatar + units */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Body avatar */}
        <div className="clinical-card flex flex-col items-center">
          <h3 className="font-semibold text-sm mb-3 self-start">Mapa Corporal</h3>
          <p className="text-xs text-muted-foreground mb-3 self-start">
            Cada unidade colorida por nível de comprometimento
          </p>
          <BodyAvatarSVG
            mode="structural"
            ucScoreMap={ucScoreMap}
            highlightedUC={expandedUnit}
            onRegionClick={(regionId) => {
              for (const [ucId, regions] of Object.entries(UC_TO_REGIONS)) {
                if (regions.includes(regionId)) {
                  setExpandedUnit(ucId);
                  break;
                }
              }
            }}
            className="w-44"
          />

          {/* Legend */}
          <div className="flex flex-wrap gap-2 mt-3 text-xs self-start">
            {[
              { label: 'Normal', color: 'bg-[#e8f4f8]' },
              { label: 'Leve', color: 'bg-[#fef3c7]' },
              { label: 'Moderado', color: 'bg-[#f97316]' },
              { label: 'Severo', color: 'bg-[#ef4444]' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded-full ${l.color} border border-border`}></div>
                <span>{l.label}</span>
              </div>
            ))}
          </div>

          {/* Structural types legend */}
          <div className="mt-4 w-full">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Estruturas moduladoras:</p>
            <div className="flex flex-wrap gap-1">
              {TIPOS_ESTRUTURAIS.map(t => (
                <span key={t.id} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${t.color}`}>
                  {t.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Units panel */}
        <div className="lg:col-span-2 space-y-3">
          {/* Score mini-grid */}
          <div className="grid grid-cols-4 gap-2">
            {unidades.map(u => (
              <button
                key={u.id}
                onClick={() => setExpandedUnit(expandedUnit === u.id ? null : u.id)}
                className={`p-2 rounded-xl border-2 text-center transition-all cursor-pointer ${
                  expandedUnit === u.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="text-base">{UNIDADES_CONFIG.find(uc => uc.id === u.id)?.emoji}</div>
                <div className="text-xs font-medium truncate">{u.id}</div>
                <div className="text-base font-bold" style={{ color: getSeverityColorHex(u.score) }}>
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
                      <div className="text-xs text-muted-foreground">
                        {Object.values(unidade.checklist).filter(Boolean).length}/{config.checklist.length} achados
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-bold" style={{ color: getSeverityColorHex(unidade.score) }}>
                      {unidade.score.toFixed(1)}/10
                    </div>
                    {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-5 space-y-5 border-t pt-5">
                    {/* Structural tissue types */}
                    <div>
                      <Label className="mb-2 block text-sm font-semibold">Estruturas comprometidas</Label>
                      <div className="flex flex-wrap gap-2">
                        {TIPOS_ESTRUTURAIS.map(tipo => {
                          const checked = (unidade.checklist[`_tipo_${tipo.id}`] ?? false) as boolean;
                          return (
                            <button
                              key={tipo.id}
                              type="button"
                              onClick={() => updateUnidade(unidade.id, u => ({
                                ...u, checklist: { ...u.checklist, [`_tipo_${tipo.id}`]: !checked }
                              }))}
                              className={`text-xs px-3 py-1 rounded-full border font-medium transition-all ${
                                checked ? tipo.color : 'bg-muted text-muted-foreground border-border'
                              }`}
                            >
                              {tipo.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Score slider with auto-score button */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <Label>Score de comprometimento</Label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const auto = autoScoreFromChecklist(unidade.checklist, config.checklist.length);
                              updateUnidade(unidade.id, u => ({ ...u, score: auto }));
                            }}
                            className="text-xs text-primary hover:underline"
                          >
                            Auto-calcular do checklist
                          </button>
                          <span className="font-bold text-lg" style={{ color: getSeverityColorHex(unidade.score) }}>
                            {unidade.score.toFixed(1)}/10
                          </span>
                        </div>
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
                              checked={(unidade.checklist[item] as boolean) || false}
                              onCheckedChange={checked => {
                                const newChecklist = { ...unidade.checklist, [item]: !!checked };
                                // Auto-update score based on marked items
                                const auto = autoScoreFromChecklist(
                                  Object.fromEntries(Object.entries(newChecklist).filter(([k]) => !k.startsWith('_tipo_'))),
                                  config.checklist.length
                                );
                                updateUnidade(unidade.id, u => ({ ...u, checklist: newChecklist, score: auto }));
                              }}
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
                        placeholder="Estruturas comprometidas, achados específicos (fáscia, articulação, ligamento, nervo, víscera)..."
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
        </div>
      </div>

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
