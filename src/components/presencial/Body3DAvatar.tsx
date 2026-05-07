import { useState, useMemo } from 'react';
import BodyMapSelector from '@/components/structural/BodyMapSelector';
import { UNIT_CONFIGS, type UnitAssessment } from '@/types/structural';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Trash2 } from 'lucide-react';

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

  // Build UnitAssessment shape expected by BodyMapSelector
  const units: Record<string, UnitAssessment> = useMemo(() => {
    const out: Record<string, UnitAssessment> = {};
    for (const cfg of UNIT_CONFIGS) {
      out[cfg.id] = {
        unitId: cfg.id,
        score: points[cfg.id] ?? 0,
        classification: '',
        testsPerformed: [],
        affectedStructures: { muscles: [], joints: [], ligaments: [], nerves: [], viscera: [] },
        observacoes: '',
      };
    }
    return out;
  }, [points]);

  const handleSelectUnit = (unitId: string) => {
    setSelected(unitId);
    if (!points[unitId]) update({ ...points, [unitId]: 5 });
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

  const selectedCfg = UNIT_CONFIGS.find(c => c.id === selected);
  const selectedIntensity = selected ? points[selected] ?? 0 : 0;
  const activeUnits = Object.entries(points).filter(([, v]) => v > 0);

  return (
    <div className="space-y-3">
      <div className="relative">
        <BodyMapSelector
          units={units}
          activeUnitId={selected ?? undefined}
          onSelectUnit={handleSelectUnit}
        />
        {activeUnits.length > 0 && (
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

      {selected && selectedCfg ? (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Unidade selecionada</p>
              <p className="font-bold text-sm">{selectedCfg.emoji} {selectedCfg.id} · {selectedCfg.name}</p>
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
            <span>Sem alteração</span>
            <span>Crítico</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center">Toque numa das 8 unidades corporais para registrar (0–10).</p>
      )}

      {activeUnits.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">
            Unidades comprometidas ({activeUnits.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {activeUnits
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => {
                const cfg = UNIT_CONFIGS.find(c => c.id === k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSelected(k)}
                    className="px-2 py-1 rounded-full text-[10px] font-bold text-white inline-flex items-center gap-1"
                    style={{ background: intensityColor(v) }}
                  >
                    {cfg?.emoji} {k} · {cfg?.shortName ?? ''} · {v}
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
    const cfg = UNIT_CONFIGS.find(c => c.id === k);
    return `- ${k} ${cfg?.name ?? ''}: ${v}/10`;
  });
  return `Mapa das 8 Unidades:\n${lines.join('\n')}`;
}
