import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { VISCERAL_REGIONS, type OrganRegion } from '@/utils/anatomia/regioesViscerais';
import avatarHumanoFrente from '@/assets/avatar-humano-frente.png';
import avatarHumanoCostas from '@/assets/avatar-humano-costas.png';

// Approximate centroid by averaging all coordinate pairs in the path string
function pathCentroid(d: string): { cx: number; cy: number } {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (nums.length < 2) return { cx: 120, cy: 260 };
  let sumX = 0, sumY = 0, count = 0;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    sumX += nums[i];
    sumY += nums[i + 1];
    count++;
  }
  return { cx: sumX / count, cy: sumY / count };
}

const SYS_COLOR: Record<string, string> = {
  linfatico:        '#22c55e',
  digestorio:       '#f97316',
  respiratorio:     '#60a5fa',
  circulatorio:     '#ef4444',
  endocrino:        '#a78bfa',
  reprodutor:       '#f472b6',
  urinario:         '#facc15',
  nervoso:          '#818cf8',
  musculoesqueletico:'#94a3b8',
  locomotor:        '#94a3b8',
  imune:            '#34d399',
  tegumentar:       '#fbbf24',
  sensorial:        '#38bdf8',
};

const ALL_SYSTEMS = [
  'todos',
  ...Object.keys(SYS_COLOR),
];

const FRONT_FRAME = { x: -59.5, y: -4.8,  width: 363.6, height: 547.2 };
const BACK_FRAME  = { x: -33,   y:  6.7,  width: 304.2, height: 520.1 };

type Offset = { dx: number; dy: number };

const LS_KEY = 'organ-offsets-calibrado';

export default function Calibrador() {
  const [view, setView]         = useState<'front' | 'back'>('front');
  const [sistema, setSistema]   = useState('todos');
  const [offsets, setOffsets]   = useState<Record<string, Offset>>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [savedAt, setSavedAt]   = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<{
    id: string;
    startSvgX: number;
    startSvgY: number;
    origDx: number;
    origDy: number;
  } | null>(null);

  const toSvgXY = (e: React.PointerEvent | PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt  = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const s = pt.matrixTransform(ctm.inverse());
    return { x: s.x, y: s.y };
  };

  const organs: OrganRegion[] = useMemo(() =>
    VISCERAL_REGIONS
      .filter(r => r.view === view && (sistema === 'todos' || r.sistemas.includes(sistema)))
      .sort((a, b) => (a.layer ?? 5) - (b.layer ?? 5)),
    [view, sistema],
  );

  const onPointerDown = useCallback((e: React.PointerEvent, id: string) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const pt = toSvgXY(e);
    const cur = offsets[id] ?? { dx: 0, dy: 0 };
    dragging.current = { id, startSvgX: pt.x, startSvgY: pt.y, origDx: cur.dx, origDy: cur.dy };
    setSelected(id);
  }, [offsets]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const pt = toSvgXY(e);
    const { id, startSvgX, startSvgY, origDx, origDy } = dragging.current;
    const dx = Math.round((origDx + pt.x - startSvgX) * 10) / 10;
    const dy = Math.round((origDy + pt.y - startSvgY) * 10) / 10;
    setOffsets(prev => ({ ...prev, [id]: { dx, dy } }));
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = null;
  }, []);

  const saveOffsets = useCallback(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(offsets));
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSavedAt(now);
    } catch {}
  }, [offsets]);

  // Sync: se outra aba salvar, reflita aqui também
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== LS_KEY) return;
      try { if (e.newValue) setOffsets(JSON.parse(e.newValue)); } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const nonZero = Object.entries(offsets).filter(([, v]) => v.dx !== 0 || v.dy !== 0);

  const exportLines = nonZero.map(([id, { dx, dy }]) => `${id}: dx=${dx}, dy=${dy}`).join('\n');

  const frame = view === 'front' ? FRONT_FRAME : BACK_FRAME;

  return (
    <div style={{ display: 'flex', height: '100dvh', background: '#0f0f0f', color: '#fff', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>

      {/* ── SVG canvas ──────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <svg
          ref={svgRef}
          viewBox="0 0 240 520"
          style={{ height: '100%', maxHeight: '100dvh', touchAction: 'none' }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {/* Avatar image */}
          <image
            href={view === 'front' ? avatarHumanoFrente : avatarHumanoCostas}
            x={frame.x} y={frame.y} width={frame.width} height={frame.height}
            preserveAspectRatio="none"
            opacity={0.65}
          />

          {/* Grid lines for reference */}
          <line x1="120" y1="0" x2="120" y2="520" stroke="#ffffff18" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1="0" y1="260" x2="240" y2="260" stroke="#ffffff18" strokeWidth="0.5" strokeDasharray="4 4" />

          {/* Organs */}
          {organs.map(organ => {
            const { cx, cy } = pathCentroid(organ.d);
            const off   = offsets[organ.id] ?? { dx: 0, dy: 0 };
            const color = SYS_COLOR[organ.sistemas[0]] ?? '#ffffff';
            const isSel = selected === organ.id;
            return (
              <g key={organ.id} transform={`translate(${off.dx},${off.dy})`}>
                {/* Organ shape */}
                <path
                  d={organ.d}
                  fill={color}
                  fillOpacity={isSel ? 0.7 : 0.38}
                  stroke={color}
                  strokeWidth={isSel ? 1.2 : 0.6}
                />
                {/* Drag handle */}
                <circle
                  cx={cx} cy={cy} r={5}
                  fill={color}
                  stroke="#fff"
                  strokeWidth={1.2}
                  style={{ cursor: 'grab' }}
                  onPointerDown={e => onPointerDown(e, organ.id)}
                />
                {/* Label */}
                <text
                  x={cx + 6} y={cy + 3}
                  fontSize={4.5}
                  fill="#fff"
                  stroke="#0008"
                  strokeWidth={2}
                  paintOrder="stroke"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {organ.label}
                </text>
                {/* Offset badge when moved */}
                {(off.dx !== 0 || off.dy !== 0) && (
                  <text
                    x={cx + 6} y={cy + 9}
                    fontSize={3.5}
                    fill="#fffc"
                    stroke="#0008"
                    strokeWidth={2}
                    paintOrder="stroke"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {`(${off.dx > 0 ? '+' : ''}${off.dx}, ${off.dy > 0 ? '+' : ''}${off.dy})`}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Right panel ─────────────────────────────── */}
      <div style={{
        width: 300,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 16,
        background: '#1a1a1a',
        overflowY: 'auto',
        borderLeft: '1px solid #333',
      }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Calibrador de Órgãos</h2>
        <p style={{ margin: 0, fontSize: 12, color: '#aaa', lineHeight: 1.5 }}>
          Arraste o círculo colorido de cada órgão para a posição anatômica correta.
          Os offsets aparecem abaixo.
        </p>

        {/* Vista */}
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Vista</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['front', 'back'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: view === v ? '#3b82f6' : '#2e2e2e',
                color: '#fff', fontSize: 13,
              }}>
                {v === 'front' ? 'Frente' : 'Costas'}
              </button>
            ))}
          </div>
        </div>

        {/* Sistema */}
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Sistema</div>
          <select
            value={sistema}
            onChange={e => setSistema(e.target.value)}
            style={{
              width: '100%', padding: '6px 8px', borderRadius: 6,
              background: '#2e2e2e', color: '#fff', border: '1px solid #444', fontSize: 13,
            }}
          >
            {ALL_SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Reset */}
        <button
          onClick={() => setOffsets({})}
          style={{
            padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: '#3f3f3f', color: '#ccc', fontSize: 13,
          }}
        >
          Resetar todos os offsets
        </button>

        {/* ── SALVAR ──────────────────────────────── */}
        <div>
          <button
            onClick={saveOffsets}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 6, border: 'none',
              cursor: 'pointer', background: '#2563eb', color: '#fff',
              fontSize: 14, fontWeight: 600, letterSpacing: '0.01em',
            }}
          >
            💾 Salvar posições
          </button>
          {savedAt && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#4ade80', textAlign: 'center' }}>
              ✓ Salvo às {savedAt} — avatar atualizado automaticamente
            </div>
          )}
          {!savedAt && nonZero.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#fbbf24', textAlign: 'center' }}>
              ⚠ Você tem alterações não salvas
            </div>
          )}
        </div>

        {/* Selected organ info */}
        {selected && (
          <div style={{ background: '#2e2e2e', borderRadius: 8, padding: 10, fontSize: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {organs.find(o => o.id === selected)?.label ?? selected}
            </div>
            <div style={{ color: '#aaa' }}>
              dx: <b style={{ color: '#fff' }}>{offsets[selected]?.dx ?? 0}</b>
              {'  '}
              dy: <b style={{ color: '#fff' }}>{offsets[selected]?.dy ?? 0}</b>
            </div>
            <button
              onClick={() => setOffsets(prev => { const n = { ...prev }; delete n[selected]; return n; })}
              style={{
                marginTop: 6, padding: '4px 10px', borderRadius: 4, border: 'none',
                background: '#555', color: '#fff', cursor: 'pointer', fontSize: 11,
              }}
            >
              Resetar este
            </button>
          </div>
        )}

        {/* Offsets list */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
            Offsets ({nonZero.length} órgão{nonZero.length !== 1 ? 's' : ''} movido{nonZero.length !== 1 ? 's' : ''})
          </div>
          {nonZero.length === 0 ? (
            <p style={{ color: '#555', fontSize: 12 }}>Nenhum órgão movido ainda.</p>
          ) : (
            <>
              <pre style={{
                background: '#111', padding: 10, borderRadius: 6,
                fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                maxHeight: 280, overflowY: 'auto', margin: 0,
              }}>
                {exportLines}
              </pre>
              <button
                onClick={() => navigator.clipboard.writeText(exportLines)}
                style={{
                  width: '100%', marginTop: 8, padding: '8px 0',
                  background: '#16a34a', color: '#fff', border: 'none',
                  borderRadius: 6, cursor: 'pointer', fontSize: 13,
                }}
              >
                Copiar offsets
              </button>
            </>
          )}
        </div>

        {/* Legend */}
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Legenda</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {Object.entries(SYS_COLOR).map(([s, c]) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: c, flexShrink: 0 }} />
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
