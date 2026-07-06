import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  PONTO_ANATOMICO, SISTEMA_DOT_COLOR,
  DEFAULT_FIGURA, deriveFigura, buildStickFigurePaths, computeProportionalOffsets,
  LS_DOT_OFFSETS, LS_FIGURA,
  type FiguraParams,
} from '@/utils/anatomia/pontoAnatomico';

type Offset = { dx: number; dy: number };
type View   = 'front' | 'back';

function loadLS<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}

const ALL_SISTEMAS = ['todos', ...Object.keys(SISTEMA_DOT_COLOR)];
const LABEL_SISTEMA: Record<string, string> = {
  todos: 'Todos',
  musculoesqueletico: 'Musculoesquelético',
  nervoso: 'Nervoso',
  circulatorio: 'Circulatório',
  respiratorio: 'Respiratório',
  digestorio: 'Digestório',
  endocrino: 'Endócrino',
  urinario: 'Urinário',
  linfatico: 'Linfático',
  reprodutor: 'Reprodutor',
  tegumentar: 'Tegumentar',
  sensorial: 'Sensorial',
};

export default function Calibrador() {
  const [view,     setView]     = useState<View>('front');
  const [sistema,  setSistema]  = useState('todos');
  const [tab,      setTab]      = useState<'pontos' | 'figura'>('pontos');
  const [offsets,  setOffsets]  = useState<Record<string, Offset>>(() => loadLS(LS_DOT_OFFSETS, {}));
  const [figura,   setFigura]   = useState<FiguraParams>(() => loadLS(LS_FIGURA, DEFAULT_FIGURA));
  const [selected, setSelected] = useState<string | null>(null);
  const [dirty,    setDirty]    = useState(false);
  const [savedAt,  setSavedAt]  = useState<string | null>(null);
  const [propApplied, setPropApplied] = useState(false);

  const svgRef   = useRef<SVGSVGElement>(null);
  const dragging = useRef<{ id: string; svgX0: number; svgY0: number; dx0: number; dy0: number } | null>(null);

  const fig = useMemo(() => deriveFigura(figura), [figura]);
  const paths = useMemo(() => buildStickFigurePaths(figura), [figura]);

  // Pontos filtrados por vista e sistema
  const visibleDots = useMemo(() =>
    Object.entries(PONTO_ANATOMICO).filter(([, p]) =>
      p.views.includes(view) && (sistema === 'todos' || p.sistema === sistema)
    ),
    [view, sistema],
  );

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

  const onPointerDown = useCallback((e: React.PointerEvent, id: string) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const pt = toSvgXY(e);
    const cur = offsets[id] ?? { dx: 0, dy: 0 };
    dragging.current = { id, svgX0: pt.x, svgY0: pt.y, dx0: cur.dx, dy0: cur.dy };
    setSelected(id);
  }, [offsets]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const pt = toSvgXY(e);
    const { id, svgX0, svgY0, dx0, dy0 } = dragging.current;
    const dx = Math.round((dx0 + pt.x - svgX0) * 2) / 2;
    const dy = Math.round((dy0 + pt.y - svgY0) * 2) / 2;
    setOffsets(prev => ({ ...prev, [id]: { dx, dy } }));
    setDirty(true);
  }, []);

  const onPointerUp = useCallback(() => { dragging.current = null; }, []);

  const saveAll = useCallback(() => {
    try {
      localStorage.setItem(LS_DOT_OFFSETS, JSON.stringify(offsets));
      localStorage.setItem(LS_FIGURA, JSON.stringify(figura));
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSavedAt(now);
      setDirty(false);
    } catch {}
  }, [offsets, figura]);

  // Auto-save shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveAll(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [saveAll]);

  // Cross-tab sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_DOT_OFFSETS && e.newValue) setOffsets(JSON.parse(e.newValue));
      if (e.key === LS_FIGURA      && e.newValue) setFigura(JSON.parse(e.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setFiguraField = <K extends keyof FiguraParams>(key: K, val: number) => {
    setFigura(prev => ({ ...prev, [key]: val }));
    setDirty(true);
    setPropApplied(false);
  };

  const applyProportional = () => {
    const proposed = computeProportionalOffsets(figura);
    setOffsets(prev => {
      const next = { ...prev };
      Object.entries(proposed).forEach(([id, off]) => {
        next[id] = {
          dx: (prev[id]?.dx ?? 0) + off.dx,
          dy: (prev[id]?.dy ?? 0) + off.dy,
        };
      });
      return next;
    });
    setDirty(true);
    setPropApplied(true);
  };

  const resetAll = () => {
    setOffsets({});
    setFigura(DEFAULT_FIGURA);
    setDirty(true);
    setPropApplied(false);
  };

  const exportJSON = () => {
    const data = { offsets, figura, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'calibracao-avatar.json' });
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.offsets) setOffsets(data.offsets);
        if (data.figura)  setFigura(data.figura);
        setDirty(true);
      } catch { alert('JSON inválido'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const selDot = selected ? PONTO_ANATOMICO[selected] : null;
  const selOff = selected ? (offsets[selected] ?? { dx: 0, dy: 0 }) : null;

  const BG  = '#0d0d0f';
  const PAN = '#141418';
  const BDR = '#2a2a35';

  const figSliders: Array<{ key: keyof FiguraParams; label: string; min: number; max: number; step: number }> = [
    { key: 'headR',      label: 'Raio da cabeça',      min: 12, max: 40,  step: 1 },
    { key: 'shoulderHW', label: 'Largura ombro (½)',    min: 20, max: 75,  step: 1 },
    { key: 'torsoH',     label: 'Altura do tronco',     min: 50, max: 180, step: 1 },
    { key: 'armLen',     label: 'Comprimento do braço', min: 30, max: 160, step: 1 },
    { key: 'armSpread',  label: 'Abertura do braço',    min: 0,  max: 80,  step: 1 },
    { key: 'legLen',     label: 'Comprimento da perna', min: 80, max: 500, step: 1 },
    { key: 'legSpread',  label: 'Abertura da perna',    min: 4,  max: 50,  step: 1 },
    { key: 'armSW',      label: 'Espessura do braço',   min: 4,  max: 24,  step: 1 },
    { key: 'legSW',      label: 'Espessura da perna',   min: 4,  max: 28,  step: 1 },
  ];

  return (
    <div style={{ display: 'flex', height: '100dvh', background: BG, color: '#e8e8f0',
      fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' }}>

      {/* ── SVG canvas ─────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', position: 'relative' }}>

        {/* Legend strip */}
        <div style={{ position: 'absolute', bottom: 10, left: 10, display: 'flex', flexWrap: 'wrap',
          gap: 6, maxWidth: 220 }}>
          {Object.entries(SISTEMA_DOT_COLOR).map(([s, c]) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
              <span style={{ color: '#888' }}>{LABEL_SISTEMA[s] ?? s}</span>
            </div>
          ))}
        </div>

        <svg
          ref={svgRef}
          viewBox="0 0 240 520"
          style={{ height: '96dvh', maxWidth: '100%', touchAction: 'none' }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {/* Grid guides */}
          <line x1="120" y1="0" x2="120" y2="520" stroke="#ffffff0d" strokeWidth="0.5" />
          <line x1="0" y1="260" x2="240" y2="260" stroke="#ffffff0d" strokeWidth="0.5" />
          {[0,1,2,3,4,5,6,7,8,9,10].map(i => (
            <line key={i} x1="0" y1={i*52} x2="240" y2={i*52} stroke="#ffffff06" strokeWidth="0.3" />
          ))}

          {/* Stick figure */}
          <circle cx={fig.cx} cy={fig.headCy} r={figura.headR}
            fill="none" stroke="#ffffff18" strokeWidth="1.5" />
          <rect x={fig.cx - 8} y={fig.neckTop} width={16} height={fig.neckH} rx={4}
            fill="none" stroke="#ffffff14" strokeWidth="1.2" />
          <path d={paths.torso}  fill="none" stroke="#ffffff18" strokeWidth="1.5" />
          <path d={paths.leftArm}  fill="none" stroke="#ffffff18" strokeWidth={figura.armSW} strokeLinecap="round" />
          <path d={paths.rightArm} fill="none" stroke="#ffffff18" strokeWidth={figura.armSW} strokeLinecap="round" />
          <path d={paths.leftLeg}  fill="none" stroke="#ffffff18" strokeWidth={figura.legSW} strokeLinecap="round" />
          <path d={paths.rightLeg} fill="none" stroke="#ffffff18" strokeWidth={figura.legSW} strokeLinecap="round" />

          {/* Back view spine */}
          {view === 'back' && (
            <g fill="none" stroke="#ffffff1a" strokeLinecap="round">
              <path d={`M120 ${fig.neckBot} L120 ${fig.torsoBot - 10}`} strokeWidth={0.8} strokeDasharray="3,2" />
              {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => {
                const y = fig.neckBot + i * ((fig.torsoBot - fig.neckBot) / 12);
                return <line key={i} x1={115} y1={y} x2={125} y2={y} strokeWidth={0.6} />;
              })}
            </g>
          )}

          {/* Anatomical dots */}
          {visibleDots.map(([id, p]) => {
            const off  = offsets[id] ?? { dx: 0, dy: 0 };
            const cx   = p.cx + off.dx;
            const cy   = p.cy + off.dy;
            const color = SISTEMA_DOT_COLOR[p.sistema] ?? '#888';
            const isSel = selected === id;

            return (
              <g key={id} onPointerDown={e => onPointerDown(e, id)} style={{ cursor: 'grab' }}>
                {isSel && (
                  <circle cx={cx} cy={cy} r={12} fill="none" stroke={color} strokeWidth={1.5}
                    strokeDasharray="3,2" opacity={0.7} />
                )}
                <circle cx={cx} cy={cy} r={isSel ? 6 : 4.5} fill={color}
                  fillOpacity={isSel ? 0.95 : 0.75} />
                <circle cx={cx} cy={cy} r={2} fill="white" opacity={0.7} style={{ pointerEvents: 'none' }} />
                <text x={cx + 7} y={cy + 3} fontSize={4}
                  fill={isSel ? color : '#ccc'} fontWeight={isSel ? '700' : '400'}
                  stroke="#0a0a10" strokeWidth={2} paintOrder="stroke"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {p.label}
                </text>
                {(off.dx !== 0 || off.dy !== 0) && (
                  <text x={cx + 7} y={cy + 8.5} fontSize={3.5} fill="#fffc"
                    stroke="#0a0a10" strokeWidth={1.5} paintOrder="stroke"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {`(${off.dx > 0 ? '+' : ''}${off.dx}, ${off.dy > 0 ? '+' : ''}${off.dy})`}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Right panel ─────────────────────────── */}
      <div style={{ width: 290, display: 'flex', flexDirection: 'column',
        background: PAN, borderLeft: `1px solid ${BDR}`, overflowY: 'auto', flexShrink: 0 }}>

        {/* Header */}
        <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${BDR}` }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '0.02em' }}>
            Calibrador do Avatar
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: 10, color: '#666' }}>
            Arraste pontos · Ctrl+S salva
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${BDR}` }}>
          {(['pontos', 'figura'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: tab === t ? '#1e1e2a' : 'transparent',
              color: tab === t ? '#a78bfa' : '#666',
              borderBottom: tab === t ? '2px solid #a78bfa' : '2px solid transparent',
            }}>
              {t === 'pontos' ? '📍 Pontos' : '📐 Figura'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {tab === 'pontos' && (
            <>
              {/* Vista */}
              <div>
                <div style={{ fontSize: 10, color: '#666', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Vista</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['front', 'back'] as const).map(v => (
                    <button key={v} onClick={() => setView(v)} style={{
                      flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: view === v ? '#7c3aed' : '#1e1e2a',
                      color: view === v ? '#fff' : '#888', fontSize: 11, fontWeight: 600,
                    }}>
                      {v === 'front' ? 'Anterior' : 'Posterior'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sistema filter */}
              <div>
                <div style={{ fontSize: 10, color: '#666', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Sistema</div>
                <select value={sistema} onChange={e => setSistema(e.target.value)} style={{
                  width: '100%', padding: '6px 8px', borderRadius: 6,
                  background: '#1e1e2a', color: '#e8e8f0', border: `1px solid ${BDR}`, fontSize: 11,
                }}>
                  {ALL_SISTEMAS.map(s => (
                    <option key={s} value={s}>{LABEL_SISTEMA[s] ?? s}</option>
                  ))}
                </select>
              </div>

              {/* Selected dot panel */}
              {selDot && selOff && selected && (
                <div style={{ background: '#1a1a28', borderRadius: 8, padding: 10,
                  border: `1px solid ${SISTEMA_DOT_COLOR[selDot.sistema] ?? BDR}44` }}>
                  <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>Selecionado</div>
                  <div style={{ fontWeight: 700, fontSize: 12, color: SISTEMA_DOT_COLOR[selDot.sistema] ?? '#fff', marginBottom: 2 }}>
                    {selDot.label}
                  </div>
                  <div style={{ fontSize: 10, color: '#555', marginBottom: 8 }}>
                    <code style={{ color: '#888' }}>{selected}</code>
                    {'  '}Sistema: {LABEL_SISTEMA[selDot.sistema] ?? selDot.sistema}
                  </div>

                  {/* Position info */}
                  <div style={{ fontSize: 10, color: '#888', marginBottom: 8 }}>
                    Base ({selDot.cx},{selDot.cy}) → Final ({selDot.cx + selOff.dx},{selDot.cy + selOff.dy})
                  </div>

                  {/* Fine-tune sliders */}
                  {(['dx', 'dy'] as const).map(axis => (
                    <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <span style={{ fontSize: 10, width: 14, color: '#888' }}>{axis}:</span>
                      <input type="range" min={-80} max={80} step={0.5}
                        value={selOff[axis]}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setOffsets(prev => ({ ...prev, [selected]: { ...prev[selected] ?? { dx: 0, dy: 0 }, [axis]: val } }));
                          setDirty(true);
                        }}
                        style={{ flex: 1, accentColor: SISTEMA_DOT_COLOR[selDot.sistema] ?? '#a78bfa', height: 3 }}
                      />
                      <span style={{ fontSize: 10, fontFamily: 'monospace', width: 28, textAlign: 'right', color: '#ccc' }}>
                        {selOff[axis] > 0 ? '+' : ''}{selOff[axis]}
                      </span>
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                    <button onClick={() => {
                      setOffsets(prev => { const n = { ...prev }; delete n[selected!]; return n; });
                      setDirty(true);
                    }} style={{ flex: 1, padding: '4px 0', borderRadius: 5, border: 'none', cursor: 'pointer',
                      background: '#2a2a38', color: '#aaa', fontSize: 10 }}>
                      ↺ Resetar
                    </button>
                    <button onClick={() => setSelected(null)} style={{ flex: 1, padding: '4px 0', borderRadius: 5, border: 'none', cursor: 'pointer',
                      background: '#2a2a38', color: '#aaa', fontSize: 10 }}>
                      ✕ Fechar
                    </button>
                  </div>
                </div>
              )}

              {/* Offsets list */}
              {Object.keys(offsets).length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#666', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Pontos movidos ({Object.keys(offsets).length})
                  </div>
                  <div style={{ maxHeight: 130, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {Object.entries(offsets).map(([id, { dx, dy }]) => {
                      const p = PONTO_ANATOMICO[id];
                      return (
                        <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 5,
                          background: '#16161e', borderRadius: 4, padding: '3px 7px', fontSize: 10,
                          cursor: 'pointer', border: selected === id ? `1px solid ${SISTEMA_DOT_COLOR[p?.sistema ?? ''] ?? '#555'}` : '1px solid transparent' }}
                          onClick={() => setSelected(id)}>
                          <span style={{ color: SISTEMA_DOT_COLOR[p?.sistema ?? ''] ?? '#888', flex: 1, minWidth: 0 }}>
                            {p?.label ?? id}
                          </span>
                          <span style={{ fontFamily: 'monospace', color: '#666', fontSize: 9, whiteSpace: 'nowrap' }}>
                            {dx > 0 ? '+' : ''}{dx}, {dy > 0 ? '+' : ''}{dy}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'figura' && (
            <>
              <div style={{ fontSize: 10, color: '#666', lineHeight: 1.5 }}>
                Ajuste as dimensões da figura. Clique em <b style={{ color: '#a78bfa' }}>Aplicar proporções</b> para
                reescalar os pontos automaticamente.
              </div>

              {figSliders.map(({ key, label, min, max, step }) => (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: '#bbb' }}>{label}</span>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#a78bfa' }}>{figura[key]}</span>
                  </div>
                  <input type="range" min={min} max={max} step={step}
                    value={figura[key]}
                    onChange={e => setFiguraField(key, Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#7c3aed', height: 3 }}
                  />
                </div>
              ))}

              <button onClick={applyProportional} style={{
                width: '100%', padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: propApplied ? '#1e3a1e' : '#4c1d95', color: propApplied ? '#4ade80' : '#e9d5ff',
                fontSize: 11, fontWeight: 600, marginTop: 4,
              }}>
                {propApplied ? '✓ Proporções aplicadas' : '⟳ Aplicar proporções aos pontos'}
              </button>

              <button onClick={() => { setFigura(DEFAULT_FIGURA); setDirty(true); setPropApplied(false); }}
                style={{ width: '100%', padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: '#1e1e2a', color: '#666', fontSize: 10 }}>
                Restaurar dimensões padrão
              </button>

              {/* Live preview numbers */}
              <div style={{ background: '#0d0d14', borderRadius: 6, padding: 8, fontSize: 9,
                fontFamily: 'monospace', color: '#666', lineHeight: 1.8 }}>
                <div style={{ color: '#888', marginBottom: 4, fontSize: 10 }}>Pontos-chave calculados</div>
                {[
                  ['Cabeça cy',   fig.headCy.toFixed(1)],
                  ['Pescoço top', fig.neckTop.toFixed(1)],
                  ['Tronco top',  fig.torsoTop.toFixed(1)],
                  ['Tronco bot',  fig.torsoBot.toFixed(1)],
                  ['Braço end y', fig.armEndY.toFixed(1)],
                  ['Pé y',        fig.footY.toFixed(1)],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{k}</span><span style={{ color: '#a78bfa' }}>{v}</span>
                  </div>
                ))}
              </div>
            </>
          )}

        </div>

        {/* Footer actions */}
        <div style={{ padding: '10px 12px', borderTop: `1px solid ${BDR}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={saveAll} style={{
            width: '100%', padding: '10px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
            background: dirty ? '#2563eb' : '#172554',
            color: dirty ? '#fff' : '#4b6cb7', fontSize: 13, fontWeight: 700,
          }}>
            {dirty ? '💾 Salvar tudo' : '✓ Salvo'}
          </button>

          {savedAt && !dirty && (
            <div style={{ textAlign: 'center', fontSize: 10, color: '#4ade80' }}>
              Salvo às {savedAt} — avatar atualizado
            </div>
          )}

          <div style={{ display: 'flex', gap: 5 }}>
            <button onClick={exportJSON} style={{ flex: 1, padding: '5px 0', borderRadius: 5, border: `1px solid ${BDR}`,
              cursor: 'pointer', background: 'transparent', color: '#888', fontSize: 10 }}>
              ↓ Export JSON
            </button>
            <label style={{ flex: 1, padding: '5px 0', borderRadius: 5, border: `1px solid ${BDR}`,
              cursor: 'pointer', background: 'transparent', color: '#888', fontSize: 10, textAlign: 'center' }}>
              ↑ Import JSON
              <input type="file" accept=".json" onChange={importJSON} style={{ display: 'none' }} />
            </label>
          </div>

          <button onClick={resetAll} style={{ width: '100%', padding: '5px 0', borderRadius: 5, border: 'none',
            cursor: 'pointer', background: '#1a0808', color: '#854545', fontSize: 10 }}>
            ⚠ Resetar tudo (posições + figura)
          </button>
        </div>
      </div>
    </div>
  );
}
