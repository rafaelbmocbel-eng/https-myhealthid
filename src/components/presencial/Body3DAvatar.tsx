import { useState } from 'react';
import { BodyAvatarSVG, REGIOES_FRENTE, REGIOES_COSTAS } from '@/components/identidade/BodyAvatarSVG';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Trash2 } from 'lucide-react';

const ALL_REGIONS = [...REGIOES_FRENTE, ...REGIOES_COSTAS];

function intensityColor(i: number): string {
  if (i <= 0) return '#94a3b8';
  if (i <= 3) return '#22c55e';
  if (i <= 6) return '#eab308';
  if (i <= 8) return '#f97316';
  return '#ef4444';
}

interface Props {
  value?: Record<string, number>;
  onChange?: (map: Record<string, number>) => void;
}

export default function Body3DAvatar({ value, onChange }: Props) {
  const [internal, setInternal] = useState<Record<string, number>>(value ?? {});
  const points = value ?? internal;
  const [selected, setSelected] = useState<string | null>(null);

  const update = (map: Record<string, number>) => {
    setInternal(map);
    onChange?.(map);
  };

  const handleRegionClick = (regionId: string) => {
    setSelected(regionId);
    if (!points[regionId]) {
      update({ ...points, [regionId]: 5 });
    }
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

  const selectedLabel = ALL_REGIONS.find((r) => r.id === selected)?.nome;
  const selectedIntensity = selected ? points[selected] ?? 0 : 0;
  const activeRegions = Object.entries(points).filter(([, v]) => v > 0);

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl overflow-hidden border border-border bg-gradient-to-b from-muted/30 to-muted/10 p-4">
        <BodyAvatarSVG
          mode="pain"
          painMap={points}
          onRegionClick={handleRegionClick}
          showBack={true}
          className="max-w-2xl mx-auto"
        />
        {activeRegions.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="absolute top-2 right-2 h-7 text-[10px] gap-1"
            onClick={clearAll}
          >
            <Trash2 className="h-3 w-3" /> Limpar
          </Button>
        )}
        <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground bg-background/70 backdrop-blur px-2 py-1 rounded-md">
          Clique numa região (frente ou costas)
        </div>
      </div>

      {selected ? (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Região selecionada</p>
              <p className="font-bold text-sm">{selectedLabel}</p>
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
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Sem dor</span>
            <span>Insuportável</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center">Clique em uma região do corpo para registrar a dor (0–10).</p>
      )}

      {activeRegions.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">
            Mapa de Dor ({activeRegions.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {activeRegions
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => {
                const r = ALL_REGIONS.find((rr) => rr.id === k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSelected(k)}
                    className="px-2 py-1 rounded-full text-[10px] font-bold text-white inline-flex items-center gap-1"
                    style={{ background: intensityColor(v) }}
                  >
                    {r?.nome ?? k} · {v}
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
    const label = ALL_REGIONS.find((r) => r.id === k)?.nome ?? k;
    return `- ${label}: ${v}/10`;
  });
  return `Mapa de dor:\n${lines.join('\n')}`;
}
