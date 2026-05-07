import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Trash2 } from 'lucide-react';

function intensityColor(i: number): string {
  if (i <= 0) return 'hsl(var(--muted))';
  if (i <= 3) return '#22c55e';
  if (i <= 6) return '#eab308';
  if (i <= 8) return '#f97316';
  return '#ef4444';
}

interface Region {
  id: string;
  label: string;
  view: 'front' | 'back';
  d: string;
  cx: number;
  cy: number;
}

// Anatomical regions — paths trace approximate body parts on a 200x420 viewBox figure.
const REGIONS: Region[] = [
  // ===== FRONT =====
  { id: 'cabeca',        label: 'Cabeça',           view: 'front', cx: 100, cy: 28,  d: 'M100 8 C 116 8 126 22 126 38 C 126 54 116 66 100 66 C 84 66 74 54 74 38 C 74 22 84 8 100 8 Z' },
  { id: 'pescoco',       label: 'Pescoço',          view: 'front', cx: 100, cy: 76,  d: 'M88 66 L112 66 L114 86 L86 86 Z' },
  { id: 'ombro_d',       label: 'Ombro D',          view: 'front', cx: 70,  cy: 96,  d: 'M86 86 L60 92 L52 110 L74 108 L82 96 Z' },
  { id: 'ombro_e',       label: 'Ombro E',          view: 'front', cx: 130, cy: 96,  d: 'M114 86 L140 92 L148 110 L126 108 L118 96 Z' },
  { id: 'peitoral',      label: 'Tórax',            view: 'front', cx: 100, cy: 118, d: 'M82 96 L118 96 L122 138 L78 138 Z' },
  { id: 'abdomen',       label: 'Abdômen',          view: 'front', cx: 100, cy: 162, d: 'M80 138 L120 138 L122 188 L78 188 Z' },
  { id: 'pelve',         label: 'Pelve',            view: 'front', cx: 100, cy: 202, d: 'M78 188 L122 188 L126 220 L74 220 Z' },
  { id: 'braco_d',       label: 'Braço D',          view: 'front', cx: 56,  cy: 130, d: 'M52 110 L72 108 L70 150 L48 152 Z' },
  { id: 'braco_e',       label: 'Braço E',          view: 'front', cx: 144, cy: 130, d: 'M148 110 L128 108 L130 150 L152 152 Z' },
  { id: 'antebraco_d',   label: 'Antebraço D',      view: 'front', cx: 50,  cy: 178, d: 'M48 152 L70 150 L66 200 L44 202 Z' },
  { id: 'antebraco_e',   label: 'Antebraço E',      view: 'front', cx: 150, cy: 178, d: 'M152 152 L130 150 L134 200 L156 202 Z' },
  { id: 'mao_d',         label: 'Mão D',            view: 'front', cx: 44,  cy: 218, d: 'M44 202 L66 200 L62 230 L42 232 Z' },
  { id: 'mao_e',         label: 'Mão E',            view: 'front', cx: 156, cy: 218, d: 'M156 202 L134 200 L138 230 L158 232 Z' },
  { id: 'coxa_d',        label: 'Coxa D',           view: 'front', cx: 86,  cy: 250, d: 'M76 220 L100 220 L98 282 L74 280 Z' },
  { id: 'coxa_e',        label: 'Coxa E',           view: 'front', cx: 114, cy: 250, d: 'M124 220 L100 220 L102 282 L126 280 Z' },
  { id: 'joelho_d',      label: 'Joelho D',         view: 'front', cx: 84,  cy: 296, d: 'M74 280 L98 282 L98 308 L76 306 Z' },
  { id: 'joelho_e',      label: 'Joelho E',         view: 'front', cx: 116, cy: 296, d: 'M126 280 L102 282 L102 308 L124 306 Z' },
  { id: 'canela_d',      label: 'Canela D',         view: 'front', cx: 84,  cy: 348, d: 'M76 306 L98 308 L96 380 L78 380 Z' },
  { id: 'canela_e',      label: 'Canela E',         view: 'front', cx: 116, cy: 348, d: 'M124 306 L102 308 L104 380 L122 380 Z' },
  { id: 'pe_d',          label: 'Pé D',             view: 'front', cx: 84,  cy: 396, d: 'M78 380 L96 380 L98 408 L74 408 Z' },
  { id: 'pe_e',          label: 'Pé E',             view: 'front', cx: 116, cy: 396, d: 'M122 380 L104 380 L102 408 L126 408 Z' },

  // ===== BACK =====
  { id: 'occipital',     label: 'Nuca/Occipital',   view: 'back',  cx: 100, cy: 28,  d: 'M100 8 C 116 8 126 22 126 38 C 126 54 116 66 100 66 C 84 66 74 54 74 38 C 74 22 84 8 100 8 Z' },
  { id: 'cervical',      label: 'Cervical',         view: 'back',  cx: 100, cy: 76,  d: 'M88 66 L112 66 L114 86 L86 86 Z' },
  { id: 'trapezio_d',    label: 'Trapézio D',       view: 'back',  cx: 78,  cy: 94,  d: 'M86 86 L60 92 L66 108 L88 100 Z' },
  { id: 'trapezio_e',    label: 'Trapézio E',       view: 'back',  cx: 122, cy: 94,  d: 'M114 86 L140 92 L134 108 L112 100 Z' },
  { id: 'dorsal',        label: 'Dorsal',           view: 'back',  cx: 100, cy: 130, d: 'M82 100 L118 100 L122 158 L78 158 Z' },
  { id: 'lombar',        label: 'Lombar',           view: 'back',  cx: 100, cy: 178, d: 'M80 158 L120 158 L122 198 L78 198 Z' },
  { id: 'gluteos',       label: 'Glúteos',          view: 'back',  cx: 100, cy: 212, d: 'M78 198 L122 198 L126 232 L74 232 Z' },
  { id: 'braco_post_d',  label: 'Braço Post. D',    view: 'back',  cx: 56,  cy: 130, d: 'M52 110 L72 108 L70 150 L48 152 Z' },
  { id: 'braco_post_e',  label: 'Braço Post. E',    view: 'back',  cx: 144, cy: 130, d: 'M148 110 L128 108 L130 150 L152 152 Z' },
  { id: 'cotovelo_d',    label: 'Cotovelo D',       view: 'back',  cx: 49,  cy: 156, d: 'M48 152 L70 150 L68 168 L46 170 Z' },
  { id: 'cotovelo_e',    label: 'Cotovelo E',       view: 'back',  cx: 151, cy: 156, d: 'M152 152 L130 150 L132 168 L154 170 Z' },
  { id: 'antebraco_p_d', label: 'Antebraço D',      view: 'back',  cx: 47,  cy: 192, d: 'M46 170 L68 168 L64 212 L44 214 Z' },
  { id: 'antebraco_p_e', label: 'Antebraço E',      view: 'back',  cx: 153, cy: 192, d: 'M154 170 L132 168 L136 212 L156 214 Z' },
  { id: 'isquio_d',      label: 'Isquiotibial D',   view: 'back',  cx: 86,  cy: 258, d: 'M76 232 L100 232 L98 290 L74 288 Z' },
  { id: 'isquio_e',      label: 'Isquiotibial E',   view: 'back',  cx: 114, cy: 258, d: 'M124 232 L100 232 L102 290 L126 288 Z' },
  { id: 'cavo_d',        label: 'Poplíteo D',       view: 'back',  cx: 84,  cy: 304, d: 'M74 288 L98 290 L98 316 L76 314 Z' },
  { id: 'cavo_e',        label: 'Poplíteo E',       view: 'back',  cx: 116, cy: 304, d: 'M126 288 L102 290 L102 316 L124 314 Z' },
  { id: 'panturrilha_d', label: 'Panturrilha D',    view: 'back',  cx: 84,  cy: 350, d: 'M76 314 L98 316 L96 380 L78 380 Z' },
  { id: 'panturrilha_e', label: 'Panturrilha E',    view: 'back',  cx: 116, cy: 350, d: 'M124 314 L102 316 L104 380 L122 380 Z' },
  { id: 'calcanhar_d',   label: 'Calcanhar D',      view: 'back',  cx: 84,  cy: 396, d: 'M78 380 L96 380 L98 408 L74 408 Z' },
  { id: 'calcanhar_e',   label: 'Calcanhar E',      view: 'back',  cx: 116, cy: 396, d: 'M122 380 L104 380 L102 408 L126 408 Z' },
];

interface Props {
  value?: Record<string, number>;
  onChange?: (map: Record<string, number>) => void;
}

function BodyView({
  view,
  points,
  selected,
  onSelect,
}: {
  view: 'front' | 'back';
  points: Record<string, number>;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const regions = REGIONS.filter(r => r.view === view);
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground text-center mb-1">
        {view === 'front' ? 'Anterior' : 'Posterior'}
      </p>
      <svg viewBox="0 0 200 420" className="w-full h-auto" style={{ maxHeight: 360 }}>
        {/* base body silhouette outline */}
        <g fill="hsl(var(--muted) / 0.35)" stroke="hsl(var(--border))" strokeWidth={0.8}>
          {/* head */}
          <ellipse cx={100} cy={37} rx={26} ry={29} />
          {/* neck */}
          <path d="M88 64 L112 64 L114 86 L86 86 Z" />
          {/* torso */}
          <path d="M60 92 L140 92 L126 220 L74 220 Z" />
          {/* arms */}
          <path d="M60 92 L52 110 L44 214 L62 216 L72 152 L74 100 Z" />
          <path d="M140 92 L148 110 L156 214 L138 216 L128 152 L126 100 Z" />
          {/* hands */}
          <ellipse cx={44} cy={228} rx={11} ry={14} />
          <ellipse cx={156} cy={228} rx={11} ry={14} />
          {/* legs */}
          <path d="M74 220 L100 220 L98 408 L74 408 Z" />
          <path d="M126 220 L100 220 L102 408 L126 408 Z" />
          {/* feet */}
          <ellipse cx={86} cy={412} rx={14} ry={6} />
          <ellipse cx={114} cy={412} rx={14} ry={6} />
        </g>

        {/* clickable regions */}
        {regions.map((r) => {
          const v = points[r.id] ?? 0;
          const isSel = selected === r.id;
          const fill = v > 0 ? intensityColor(v) : 'transparent';
          return (
            <g key={r.id} onClick={() => onSelect(r.id)} className="cursor-pointer">
              <path
                d={r.d}
                fill={fill}
                fillOpacity={v > 0 ? 0.7 : 0}
                stroke={isSel ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                strokeWidth={isSel ? 1.6 : 0.5}
                className="transition-all hover:fill-primary/20"
              />
              {v > 0 && (
                <text
                  x={r.cx}
                  y={r.cy + 3}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={800}
                  fill="white"
                  style={{ pointerEvents: 'none' }}
                >
                  {v}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function Body3DAvatar({ value, onChange }: Props) {
  const [internal, setInternal] = useState<Record<string, number>>(value ?? {});
  const points = value ?? internal;
  const [selected, setSelected] = useState<string | null>(null);

  const update = (map: Record<string, number>) => {
    setInternal(map);
    onChange?.(map);
  };

  const handleSelect = (id: string) => {
    setSelected(id);
    if (!points[id]) update({ ...points, [id]: 5 });
  };

  const setIntensity = (key: string, v: number) => {
    const next = { ...points };
    if (v <= 0) delete next[key];
    else next[key] = v;
    update(next);
  };

  const clearAll = () => {
    update({});
    setSelected(null);
  };

  const selectedRegion = REGIONS.find(r => r.id === selected);
  const selectedIntensity = selected ? points[selected] ?? 0 : 0;
  const active = Object.entries(points).filter(([, v]) => v > 0);

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl border border-border bg-card p-3">
        <div className="flex gap-2 items-start">
          <BodyView view="front" points={points} selected={selected} onSelect={handleSelect} />
          <BodyView view="back"  points={points} selected={selected} onSelect={handleSelect} />
        </div>
        {active.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="absolute top-3 right-3 h-7 text-[10px] gap-1"
            onClick={clearAll}
          >
            <Trash2 className="h-3 w-3" /> Limpar
          </Button>
        )}
      </div>

      {selected && selectedRegion ? (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                Região · {selectedRegion.view === 'front' ? 'anterior' : 'posterior'}
              </p>
              <p className="font-bold text-sm">{selectedRegion.label}</p>
            </div>
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center text-white font-black text-sm"
              style={{ background: intensityColor(selectedIntensity) }}
            >
              {selectedIntensity}
            </div>
          </div>
          <Slider
            value={[selectedIntensity]}
            min={0}
            max={10}
            step={1}
            onValueChange={(v) => setIntensity(selected, v[0])}
          />
          <div className="grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                type="button"
                onClick={() => setIntensity(selected, n)}
                className={`h-8 rounded-md text-[11px] font-bold border transition-all ${
                  selectedIntensity === n
                    ? 'text-white border-transparent scale-105 shadow'
                    : 'bg-background text-foreground border-border hover:bg-muted'
                }`}
                style={
                  selectedIntensity === n
                    ? { background: intensityColor(n) }
                    : undefined
                }
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Sem dor</span>
            <span>Insuportável</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center">
          Toque numa região do corpo para registrar a intensidade da dor (0–10).
        </p>
      )}

      {active.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">
            Regiões com dor ({active.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {active
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => {
                const r = REGIONS.find(x => x.id === k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSelected(k)}
                    className="px-2 py-1 rounded-full text-[10px] font-bold text-white inline-flex items-center gap-1"
                    style={{ background: intensityColor(v) }}
                  >
                    {r?.label ?? k} · {v}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

export function painMapToText(map: Record<string, number>): string {
  const entries = Object.entries(map).filter(([, v]) => v > 0);
  if (!entries.length) return '';
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const lines = sorted.map(([k, v]) => {
    const r = REGIONS.find(x => x.id === k);
    const view = r?.view === 'back' ? ' (post.)' : '';
    return `- ${r?.label ?? k}${view}: ${v}/10`;
  });
  return `Mapa de dor:\n${lines.join('\n')}`;
}
