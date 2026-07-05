import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { VISCERAL_REGIONS, type OrganRegion } from '@/utils/anatomia/regioesViscerais';
import { REGIONS } from '@/components/presencial/Body3DAvatar';
import avatarHumanoFrente from '@/assets/avatar-humano-frente.png';
import avatarHumanoCostas from '@/assets/avatar-humano-costas.png';

// Wrap REGIONS into OrganRegion shape so the calibrator can handle them uniformly
const MUSCULO_REGIONS: OrganRegion[] = REGIONS.map(r => ({
  id: r.id,
  label: r.label,
  view: r.view,
  sistemas: ['musculoesqueletico'],
  d: r.d,
  type: 'organ' as const,
  layer: 1,
}));

function pathCentroid(d: string): { cx: number; cy: number } {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (nums.length < 2) return { cx: 120, cy: 260 };
  let sumX = 0, sumY = 0, count = 0;
  for (let i = 0; i + 1 < nums.length; i += 2) { sumX += nums[i]; sumY += nums[i + 1]; count++; }
  return { cx: sumX / count, cy: sumY / count };
}

const SYS_COLOR: Record<string, string> = {
  linfatico:         '#22c55e',
  digestorio:        '#f97316',
  respiratorio:      '#60a5fa',
  circulatorio:      '#ef4444',
  endocrino:         '#a78bfa',
  reprodutor:        '#f472b6',
  urinario:          '#facc15',
  nervoso:           '#818cf8',
  musculoesqueletico:'#94a3b8',
  locomotor:         '#94a3b8',
  imune:             '#34d399',
  tegumentar:        '#fbbf24',
  sensorial:         '#38bdf8',
};

const ALL_SYSTEMS = ['todos', ...Object.keys(SYS_COLOR)];
const FRONT_FRAME = { x: -59.5, y: -4.8, width: 363.6, height: 547.2 };
const BACK_FRAME  = { x: -33,   y:  6.7, width: 304.2, height: 520.1 };

type Offset = { dx: number; dy: number };

const LS_OFFSETS = 'organ-offsets-calibrado';
const LS_LABELS  = 'organ-labels-calibrado';
const LS_HIDDEN  = 'organ-hidden-calibrado';

function loadLS<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}

// Inline button style helper
const btn = (bg: string, extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
  background: bg, color: '#fff', fontSize: 11, fontWeight: 500, ...extra,
});

export default function Calibrador() {
  const [view, setView]     = useState<'front' | 'back'>('front');
  const [sistema, setSistema] = useState('todos');
  const [offsets, setOffsets] = useState<Record<string, Offset>>(() => loadLS(LS_OFFSETS, {}));
  const [labels,  setLabels]  = useState<Record<string, string>>(() => loadLS(LS_LABELS, {}));
  const [hidden,  setHidden]  = useState<Set<string>>(() => new Set(loadLS<string[]>(LS_HIDDEN, [])));
  const [selected, setSelected] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState(false);
  const [tempLabel, setTempLabel]       = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty]     = useState(false);

  const svgRef   = useRef<SVGSVGElement>(null);
  const labelRef = useRef<HTMLInputElement>(null);
  const dragging = useRef<{ id: string; startSvgX: number; startSvgY: number; origDx: number; origDy: number } | null>(null);

  const toSvgXY = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const s = pt.matrixTransform(ctm.inverse());
    return { x: s.x, y: s.y };
  };

  const organs: OrganRegion[] = useMemo(() =>
    [...VISCERAL_REGIONS, ...MUSCULO_REGIONS]
      .filter(r => r.view === view && (sistema === 'todos' || r.sistemas.includes(sistema)))
      .sort((a, b) => (a.layer ?? 5) - (b.layer ?? 5)),
    [view, sistema],
  );

  const onPointerDown = useCallback((e: React.PointerEvent, id: string) => {
    if (hidden.has(id)) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const pt = toSvgXY(e);
    const cur = offsets[id] ?? { dx: 0, dy: 0 };
    dragging.current = { id, startSvgX: pt.x, startSvgY: pt.y, origDx: cur.dx, origDy: cur.dy };
    setSelected(id);
    setEditingLabel(false);
  }, [offsets, hidden]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const pt = toSvgXY(e);
    const { id, startSvgX, startSvgY, origDx, origDy } = dragging.current;
    const dx = Math.round((origDx + pt.x - startSvgX) * 10) / 10;
    const dy = Math.round((origDy + pt.y - startSvgY) * 10) / 10;
    setOffsets(prev => ({ ...prev, [id]: { dx, dy } }));
    setDirty(true);
  }, []);

  const onPointerUp = useCallback(() => { dragging.current = null; }, []);

  // Save all three stores at once
  const saveAll = useCallback(() => {
    try {
      localStorage.setItem(LS_OFFSETS, JSON.stringify(offsets));
      localStorage.setItem(LS_LABELS,  JSON.stringify(labels));
      localStorage.setItem(LS_HIDDEN,  JSON.stringify([...hidden]));
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSavedAt(now);
      setDirty(false);
    } catch {}
  }, [offsets, labels, hidden]);

  // Cross-tab sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_OFFSETS && e.newValue) setOffsets(JSON.parse(e.newValue));
      if (e.key === LS_LABELS  && e.newValue) setLabels(JSON.parse(e.newValue));
      if (e.key === LS_HIDDEN  && e.newValue) setHidden(new Set(JSON.parse(e.newValue)));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Focus input when editing starts
  useEffect(() => { if (editingLabel) setTimeout(() => labelRef.current?.focus(), 50); }, [editingLabel]);

  const selectedOrgan = selected
    ? organs.find(o => o.id === selected)
      ?? VISCERAL_REGIONS.find(o => o.id === selected)
      ?? MUSCULO_REGIONS.find(o => o.id === selected)
    : null;
  const getLabel = (organ: OrganRegion) => labels[organ.id] ?? organ.label;

  const confirmLabel = () => {
    if (selected && tempLabel.trim()) {
      setLabels(prev => ({ ...prev, [selected]: tempLabel.trim() }));
      setDirty(true);
    }
    setEditingLabel(false);
  };

  const deleteSelected = () => {
    if (!selected) return;
    setHidden(prev => new Set([...prev, selected]));
    setDirty(true);
    setSelected(null);
    setEditingLabel(false);
  };

  const restore = (id: string) => {
    setHidden(prev => { const n = new Set(prev); n.delete(id); return n; });
    setDirty(true);
  };

  const frame = view === 'front' ? FRONT_FRAME : BACK_FRAME;
  const nonZero = Object.entries(offsets).filter(([, v]) => v.dx !== 0 || v.dy !== 0);
  const hiddenList = [...hidden];

  return (
    <div style={{ display: 'flex', height: '100dvh', background: '#0f0f0f', color: '#fff', fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>

      {/* ── SVG canvas ─────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <svg
          ref={svgRef}
          viewBox="0 0 240 520"
          style={{ height: '100%', maxHeight: '100dvh', touchAction: 'none' }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <image
            href={view === 'front' ? avatarHumanoFrente : avatarHumanoCostas}
            x={frame.x} y={frame.y} width={frame.width} height={frame.height}
            preserveAspectRatio="none" opacity={0.65}
          />
          <line x1="120" y1="0" x2="120" y2="520" stroke="#ffffff18" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1="0" y1="260" x2="240" y2="260" stroke="#ffffff18" strokeWidth="0.5" strokeDasharray="4 4" />

          {organs.map(organ => {
            const { cx, cy } = pathCentroid(organ.d);
            const off   = offsets[organ.id] ?? { dx: 0, dy: 0 };
            const color = SYS_COLOR[organ.sistemas[0]] ?? '#fff';
            const isSel = selected === organ.id;
            const isHid = hidden.has(organ.id);

            return (
              <g key={organ.id} transform={`translate(${off.dx},${off.dy})`} opacity={isHid ? 0.12 : 1}>
                <path d={organ.d} fill={color} fillOpacity={isSel ? 0.7 : 0.38}
                  stroke={isHid ? '#ff4444' : color} strokeWidth={isSel ? 1.2 : 0.6}
                  strokeDasharray={isHid ? '2 2' : undefined}
                />
                {!isHid && (
                  <circle cx={cx} cy={cy} r={5} fill={color} stroke="#fff" strokeWidth={1.2}
                    style={{ cursor: 'grab' }}
                    onPointerDown={e => onPointerDown(e, organ.id)}
                  />
                )}
                <text x={cx + 6} y={cy + 3} fontSize={4.5} fill="#fff"
                  stroke="#0008" strokeWidth={2} paintOrder="stroke"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {getLabel(organ)}
                </text>
                {(off.dx !== 0 || off.dy !== 0) && !isHid && (
                  <text x={cx + 6} y={cy + 9} fontSize={3.5} fill="#fffc"
                    stroke="#0008" strokeWidth={2} paintOrder="stroke"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {`(${off.dx > 0 ? '+' : ''}${off.dx}, ${off.dy > 0 ? '+' : ''}${off.dy})`}
                  </text>
                )}
                {isHid && (
                  <text x={cx - 3} y={cy + 2} fontSize={6} fill="#ff4444"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >✕</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Right panel ─────────────────────────────── */}
      <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 10, padding: 14,
        background: '#1a1a1a', overflowY: 'auto', borderLeft: '1px solid #333' }}>

        <h2 style={{ margin: 0, fontSize: 15 }}>Calibrador de Regiões</h2>

        {/* Vista */}
        <div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>Vista</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['front', 'back'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: view === v ? '#3b82f6' : '#2e2e2e', color: '#fff', fontSize: 12,
              }}>
                {v === 'front' ? 'Frente' : 'Costas'}
              </button>
            ))}
          </div>
        </div>

        {/* Sistema */}
        <div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>Sistema</div>
          <select value={sistema} onChange={e => setSistema(e.target.value)} style={{
            width: '100%', padding: '6px 8px', borderRadius: 6,
            background: '#2e2e2e', color: '#fff', border: '1px solid #444', fontSize: 12,
          }}>
            {ALL_SYSTEMS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* ── Órgão selecionado ────────────────── */}
        {selectedOrgan && (
          <div style={{ background: '#252525', borderRadius: 8, padding: 10, border: `1px solid ${SYS_COLOR[selectedOrgan.sistemas[0]] ?? '#444'}44` }}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>Selecionado</div>

            {/* Nome — modo visualização ou edição */}
            {editingLabel ? (
              <div style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
                <input
                  ref={labelRef}
                  value={tempLabel}
                  onChange={e => setTempLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') confirmLabel(); if (e.key === 'Escape') setEditingLabel(false); }}
                  style={{
                    flex: 1, padding: '4px 7px', borderRadius: 4, border: '1px solid #555',
                    background: '#333', color: '#fff', fontSize: 12,
                  }}
                />
                <button onClick={confirmLabel} style={btn('#16a34a')}>✓</button>
                <button onClick={() => setEditingLabel(false)} style={btn('#555')}>✕</button>
              </div>
            ) : (
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                {getLabel(selectedOrgan)}
                {labels[selectedOrgan.id] && (
                  <span style={{ fontSize: 10, color: '#a78bfa', marginLeft: 6 }}>(editado)</span>
                )}
              </div>
            )}

            {/* Coordenadas */}
            <div style={{ color: '#aaa', fontSize: 11, marginBottom: 8 }}>
              ID: <code style={{ color: '#888', fontSize: 10 }}>{selectedOrgan.id}</code>
              <span style={{ marginLeft: 10 }}>
                dx: <b style={{ color: '#fff' }}>{offsets[selectedOrgan.id]?.dx ?? 0}</b>
                {'  '}
                dy: <b style={{ color: '#fff' }}>{offsets[selectedOrgan.id]?.dy ?? 0}</b>
              </span>
            </div>

            {/* Ações */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {!editingLabel && (
                <button onClick={() => { setTempLabel(getLabel(selectedOrgan)); setEditingLabel(true); }} style={btn('#7c3aed')}>
                  ✏ Editar nome
                </button>
              )}
              <button
                onClick={() => { setOffsets(prev => { const n = { ...prev }; delete n[selectedOrgan.id]; return n; }); setDirty(true); }}
                style={btn('#374151')}
              >
                ↺ Reset posição
              </button>
              <button onClick={deleteSelected} style={btn('#dc2626')}>
                🗑 Excluir
              </button>
            </div>
          </div>
        )}

        {/* ── SALVAR ───────────────────────────── */}
        <div>
          <button onClick={saveAll} style={{
            width: '100%', padding: '10px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: dirty ? '#2563eb' : '#1e3a5f', color: '#fff', fontSize: 14, fontWeight: 600,
          }}>
            💾 Salvar tudo
          </button>
          {savedAt && !dirty && (
            <div style={{ marginTop: 5, fontSize: 11, color: '#4ade80', textAlign: 'center' }}>
              ✓ Salvo às {savedAt} — avatar atualizado
            </div>
          )}
          {dirty && (
            <div style={{ marginTop: 5, fontSize: 11, color: '#fbbf24', textAlign: 'center' }}>
              ⚠ Alterações não salvas
            </div>
          )}
        </div>

        {/* ── Reset geral ──────────────────────── */}
        <button
          onClick={() => { setOffsets({}); setLabels({}); setHidden(new Set()); setDirty(true); }}
          style={{ padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#2e2e2e', color: '#aaa', fontSize: 12 }}
        >
          Resetar tudo (posições + nomes + exclusões)
        </button>

        {/* ── Excluídos ────────────────────────── */}
        {hiddenList.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>
              Excluídos ({hiddenList.length}) — clique para restaurar
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
              {hiddenList.map(id => {
                const org = VISCERAL_REGIONS.find(o => o.id === id);
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#2a1a1a', borderRadius: 5, padding: '4px 8px', fontSize: 11 }}>
                    <span style={{ color: '#f87171' }}>{org ? getLabel(org) : id}</span>
                    <button onClick={() => restore(id)} style={btn('#374151', { padding: '2px 7px', fontSize: 10 })}>
                      Restaurar
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Nomes editados ───────────────────── */}
        {Object.keys(labels).length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>
              Nomes editados ({Object.keys(labels).length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
              {Object.entries(labels).map(([id, lbl]) => {
                const org = VISCERAL_REGIONS.find(o => o.id === id);
                return (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#1a1a2e', borderRadius: 5, padding: '4px 8px', fontSize: 11 }}>
                    <div>
                      <span style={{ color: '#aaa', textDecoration: 'line-through', fontSize: 10 }}>
                        {org?.label ?? id}
                      </span>
                      <span style={{ color: '#a78bfa', marginLeft: 5 }}>→ {lbl}</span>
                    </div>
                    <button
                      onClick={() => { setLabels(p => { const n = {...p}; delete n[id]; return n; }); setDirty(true); }}
                      style={btn('#374151', { padding: '2px 7px', fontSize: 10 })}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Movidos ──────────────────────────── */}
        {nonZero.length > 0 && (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>
              Posições ({nonZero.length} movido{nonZero.length !== 1 ? 's' : ''})
            </div>
            <pre style={{ background: '#111', padding: 8, borderRadius: 5, fontSize: 10,
              whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 160, overflowY: 'auto', margin: 0 }}>
              {nonZero.map(([id, { dx, dy }]) => `${id}: dx=${dx}, dy=${dy}`).join('\n')}
            </pre>
          </div>
        )}

        {/* ── Legenda ──────────────────────────── */}
        <div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>Legenda</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
            {Object.entries(SYS_COLOR).map(([s, c]) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                <div style={{ width: 9, height: 9, borderRadius: 2, background: c, flexShrink: 0 }} />
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
