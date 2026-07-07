import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  PONTO_ANATOMICO, SISTEMA_DOT_COLOR,
  ZONAS_CORPORAIS, zonePivot, BILATERAL_PAIRS,
  DEFAULT_FIGURA, deriveFigura, buildStickFigurePaths, computeProportionalOffsets,
  LS_DOT_OFFSETS, LS_FIGURA, LS_SCALES,
  type FiguraParams,
} from '@/utils/anatomia/pontoAnatomico';

type Offset = { dx: number; dy: number };
type Scale  = { sx: number; sy: number };
type View   = 'front' | 'back';

function loadLS<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch { return fallback; }
}

/** Posição central de uma zona para colocar o rótulo */
function labelPos(s: ZonaShape): { x: number; y: number; anchor: 'middle' | 'start' | 'end' } {
  if (s.kind === 'circle')  return { x: s.cx, y: s.cy + 1.5, anchor: 'middle' };
  if (s.kind === 'ellipse') return { x: s.cx, y: s.cy + 1.5, anchor: 'middle' };
  // Para paths: extrai números e calcula ponto médio da bezier
  const nums = s.d.replace(/[A-Za-z]/g, ' ').trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
  if (nums.length >= 6) {
    const mx = Math.round(0.25 * nums[0] + 0.5 * nums[2] + 0.25 * nums[4]);
    const my = Math.round(0.25 * nums[1] + 0.5 * nums[3] + 0.25 * nums[5]);
    // Zona no lado esq da tela (x < 120): label à esquerda
    const left = nums[0] < 110;
    return { x: left ? mx - 6 : mx + 6, y: my, anchor: left ? 'end' : 'start' };
  }
  return { x: 120, y: 260, anchor: 'middle' };
}

export default function Calibrador() {
  const [view,        setView]        = useState<View>('front');
  const [tab,         setTab]         = useState<'zonas' | 'figura'>('zonas');
  const [offsets,     setOffsets]     = useState<Record<string, Offset>>(() => loadLS(LS_DOT_OFFSETS, {}));
  const [scales,      setScales]      = useState<Record<string, Scale>>(() => loadLS(LS_SCALES, {}));
  const [figura,      setFigura]      = useState<FiguraParams>(() => loadLS(LS_FIGURA, DEFAULT_FIGURA));
  const [selected,    setSelected]    = useState<string | null>(null);
  const [dirty,       setDirty]       = useState(false);
  const [savedAt,     setSavedAt]     = useState<string | null>(null);
  const [propApplied, setPropApplied] = useState(false);

  const svgRef   = useRef<SVGSVGElement>(null);
  const dragging = useRef<{ id: string; svgX0: number; svgY0: number; dx0: number; dy0: number } | null>(null);

  const fig   = useMemo(() => deriveFigura(figura), [figura]);
  const paths = useMemo(() => buildStickFigurePaths(figura), [figura]);

  const visibleZones = useMemo(() =>
    ZONAS_CORPORAIS.filter(z => !z.views || z.views.includes(view)),
    [view],
  );

  const adjustedZones = useMemo(() =>
    ZONAS_CORPORAIS.filter(z => {
      const o = offsets[z.id];
      const sc = scales[z.id];
      return (o && (o.dx !== 0 || o.dy !== 0)) || (sc && (sc.sx !== 1 || sc.sy !== 1));
    }),
    [offsets, scales],
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
    const pt  = toSvgXY(e);
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

  const persistNow = useCallback((
    offs: typeof offsets, scs: typeof scales, fig: typeof figura
  ) => {
    try {
      localStorage.setItem(LS_DOT_OFFSETS, JSON.stringify(offs));
      localStorage.setItem(LS_SCALES,      JSON.stringify(scs));
      localStorage.setItem(LS_FIGURA,      JSON.stringify(fig));
      return true;
    } catch { return false; }
  }, []);

  const saveAll = useCallback(() => {
    if (persistNow(offsets, scales, figura)) {
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setSavedAt(now);
      setDirty(false);
    }
  }, [offsets, scales, figura, persistNow]);

  // Auto-save 600ms after any change — user never needs to click the button
  useEffect(() => {
    if (!dirty) return;
    const id = setTimeout(() => {
      if (persistNow(offsets, scales, figura)) {
        const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setSavedAt(now);
        setDirty(false);
      }
    }, 600);
    return () => clearTimeout(id);
  }, [offsets, scales, figura, dirty, persistNow]);

  // Safety net: save synchronously when user navigates away
  useEffect(() => {
    const onUnload = () => { if (dirty) persistNow(offsets, scales, figura); };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty, offsets, scales, figura, persistNow]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveAll(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [saveAll]);

  useEffect(() => {
    const h = (e: StorageEvent) => {
      if (e.key === LS_DOT_OFFSETS && e.newValue) setOffsets(JSON.parse(e.newValue));
      if (e.key === LS_SCALES      && e.newValue) setScales(JSON.parse(e.newValue));
      if (e.key === LS_FIGURA      && e.newValue) setFigura(JSON.parse(e.newValue));
    };
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  }, []);

  const setFigField = <K extends keyof FiguraParams>(key: K, val: number) => {
    setFigura(prev => ({ ...prev, [key]: val }));
    setDirty(true);
    setPropApplied(false);
  };

  const applyProportional = () => {
    const proposed = computeProportionalOffsets(figura);
    setOffsets(prev => {
      const next = { ...prev };
      Object.entries(proposed).forEach(([id, off]) => {
        next[id] = { dx: (prev[id]?.dx ?? 0) + off.dx, dy: (prev[id]?.dy ?? 0) + off.dy };
      });
      return next;
    });
    setDirty(true);
    setPropApplied(true);
  };

  const resetAll = () => { setOffsets({}); setScales({}); setFigura(DEFAULT_FIGURA); setDirty(true); setPropApplied(false); };

  const exportJSON = () => {
    const data = { offsets, scales, figura, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: 'calibracao-avatar.json' }).click();
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
        if (data.scales)  setScales(data.scales);
        if (data.figura)  setFigura(data.figura);
        setDirty(true);
      } catch { alert('JSON inválido'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const selZona  = selected ? ZONAS_CORPORAIS.find(z => z.id === selected) : null;
  const selOff   = selected ? (offsets[selected] ?? { dx: 0, dy: 0 }) : null;
  const selScale = selected ? (scales[selected]  ?? { sx: 1, sy: 1  }) : null;

  const BG  = '#0d0d0f';
  const PAN = '#141418';
  const BDR = '#2a2a35';
  const ACC = '#a78bfa';
  const ORG = '#f97316';

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
      fontFamily: 'system-ui,-apple-system,sans-serif', overflow: 'hidden' }}>

      {/* ── SVG canvas ─────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', position: 'relative' }}>

        {/* Status bar */}
        <div style={{ position: 'absolute', top: 10, left: 12, fontSize: 10, color: '#555', lineHeight: 1.6 }}>
          <span style={{ color: ACC, fontWeight: 600 }}>Calibrador de Regiões</span>
          {adjustedZones.length > 0 && (
            <span style={{ color: ORG, marginLeft: 8 }}>
              {adjustedZones.length} região{adjustedZones.length > 1 ? 'ões' : ''} ajustada{adjustedZones.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <svg
          ref={svgRef}
          viewBox="0 0 240 520"
          style={{ height: '92dvh', maxWidth: '100%', touchAction: 'none' }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {/* Guias */}
          <line x1="120" y1="0"   x2="120" y2="520" stroke="#ffffff08" strokeWidth="0.5" />
          <line x1="0"   y1="260" x2="240" y2="260"  stroke="#ffffff08" strokeWidth="0.5" />

          {/* Boneco de palito */}
          <circle cx={fig.cx} cy={fig.headCy} r={figura.headR}
            fill="none" stroke="#ffffff12" strokeWidth="1.5" />
          <rect x={fig.cx - 8} y={fig.neckTop} width={16} height={fig.neckH} rx={4}
            fill="none" stroke="#ffffff0e" strokeWidth="1.2" />
          <path d={paths.torso}    fill="none" stroke="#ffffff12" strokeWidth="1.5" />
          <path d={paths.leftArm}  fill="none" stroke="#ffffff12" strokeWidth={figura.armSW} strokeLinecap="round" />
          <path d={paths.rightArm} fill="none" stroke="#ffffff12" strokeWidth={figura.armSW} strokeLinecap="round" />
          <path d={paths.leftLeg}  fill="none" stroke="#ffffff12" strokeWidth={figura.legSW} strokeLinecap="round" />
          <path d={paths.rightLeg} fill="none" stroke="#ffffff12" strokeWidth={figura.legSW} strokeLinecap="round" />
          {view === 'back' && (
            <g fill="none" stroke="#ffffff18" strokeLinecap="round">
              <path d={`M120 ${fig.neckBot} L120 ${fig.torsoBot - 10}`} strokeWidth={0.8} strokeDasharray="3,2" />
              {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => {
                const y = fig.neckBot + i * ((fig.torsoBot - fig.neckBot) / 12);
                return <line key={i} x1={115} y1={y} x2={125} y2={y} strokeWidth={0.6} />;
              })}
            </g>
          )}

          {/* ═══ Zonas corporais arrastáveis ═══ */}
          {visibleZones.map(zona => {
            const off    = offsets[zona.id] ?? { dx: 0, dy: 0 };
            const sc     = scales[zona.id]  ?? { sx: 1, sy: 1 };
            const isSel  = selected === zona.id;
            const hasScale = sc.sx !== 1 || sc.sy !== 1;
            const isMov  = off.dx !== 0 || off.dy !== 0 || hasScale;
            const s      = zona.shape;
            const lp     = labelPos(s);
            const piv    = zonePivot(s);

            const zColor = isSel ? ACC : isMov ? ORG : '#c8c8e8';
            const fOpac  = isSel ? 0.22 : isMov ? 0.16 : 0.07;
            const sOpac  = isSel ? 0.85 : isMov ? 0.72 : 0.28;

            const zTransform = hasScale
              ? `translate(${off.dx},${off.dy}) translate(${piv.x},${piv.y}) scale(${sc.sx},${sc.sy}) translate(${-piv.x},${-piv.y})`
              : `translate(${off.dx},${off.dy})`;

            return (
              <g key={zona.id}
                transform={zTransform}
                onPointerDown={e => onPointerDown(e, zona.id)}
                style={{ cursor: 'grab' }}>

                {/* Anel de seleção */}
                {isSel && s.kind === 'circle' && (
                  <circle cx={s.cx} cy={s.cy} r={s.r + 6} fill="none"
                    stroke={ACC} strokeWidth={1} strokeDasharray="3,2" opacity={0.65} />
                )}
                {isSel && s.kind === 'ellipse' && (
                  <ellipse cx={s.cx} cy={s.cy} rx={s.rx + 6} ry={s.ry + 6} fill="none"
                    stroke={ACC} strokeWidth={1} strokeDasharray="3,2" opacity={0.65} />
                )}

                {/* Forma da zona */}
                {s.kind === 'circle' && (
                  <circle cx={s.cx} cy={s.cy} r={s.r}
                    fill={zColor} fillOpacity={fOpac}
                    stroke={zColor} strokeOpacity={sOpac} strokeWidth={1.2} />
                )}
                {s.kind === 'ellipse' && (
                  <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry}
                    fill={zColor} fillOpacity={fOpac}
                    stroke={zColor} strokeOpacity={sOpac} strokeWidth={1.2} />
                )}
                {s.kind === 'path' && s.sw && (
                  <>
                    {/* Área de toque maior (invisível) */}
                    <path d={s.d} fill="none" stroke="transparent" strokeWidth={s.sw + 16} strokeLinecap="round" />
                    <path d={s.d} fill="none"
                      stroke={zColor} strokeOpacity={sOpac} strokeWidth={s.sw} strokeLinecap="round" />
                    {isSel && (
                      <path d={s.d} fill="none"
                        stroke={ACC} strokeOpacity={0.5} strokeWidth={s.sw + 6}
                        strokeLinecap="round" strokeDasharray="5,4" />
                    )}
                  </>
                )}
                {s.kind === 'path' && !s.sw && (
                  <path d={s.d}
                    fill={zColor} fillOpacity={fOpac}
                    stroke={zColor} strokeOpacity={sOpac} strokeWidth={1.2} />
                )}

                {/* Rótulo */}
                <text x={lp.x} y={lp.y} fontSize={isSel ? 5.5 : 4.2}
                  fill={isSel ? '#fff' : isMov ? ORG : '#8888aa'}
                  stroke="#05050a" strokeWidth={isSel ? 3 : 2} paintOrder="stroke"
                  textAnchor={lp.anchor}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {zona.label}
                </text>

                {/* Offset */}
                {isMov && (
                  <text x={lp.x} y={lp.y + (s.kind === 'path' ? 7 : 7)} fontSize={3.8}
                    fill={ORG} stroke="#05050a" strokeWidth={1.8} paintOrder="stroke"
                    textAnchor={lp.anchor}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}>
                    {`${off.dx > 0 ? '+' : ''}${off.dx}, ${off.dy > 0 ? '+' : ''}${off.dy}`}
                  </text>
                )}
              </g>
            );
          })}

          {/* Sombra */}
          <ellipse cx={120} cy={516} rx={50} ry={4.5} fill="black" opacity={0.3} />
        </svg>
      </div>

      {/* ── Painel direito ──────────────────────────────── */}
      <div style={{ width: 290, display: 'flex', flexDirection: 'column',
        background: PAN, borderLeft: `1px solid ${BDR}`, overflowY: 'auto', flexShrink: 0 }}>

        {/* Cabeçalho */}
        <div style={{ padding: '14px 14px 10px', borderBottom: `1px solid ${BDR}` }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '0.02em' }}>
            Calibrador do Avatar
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: 10, color: '#555' }}>
            Arraste regiões · salvo automaticamente
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${BDR}` }}>
          {(['zonas', 'figura'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: tab === t ? '#1e1e2a' : 'transparent',
              color: tab === t ? ACC : '#555',
              borderBottom: tab === t ? `2px solid ${ACC}` : '2px solid transparent',
            }}>
              {t === 'zonas' ? '🗺 Zonas' : '📐 Figura'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* ── Tab Zonas ── */}
          {tab === 'zonas' && (
            <>
              {/* Vista */}
              <div>
                <div style={{ fontSize: 10, color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Vista</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['front', 'back'] as const).map(v => (
                    <button key={v} onClick={() => setView(v)} style={{
                      flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: view === v ? '#7c3aed' : '#1e1e2a',
                      color: view === v ? '#fff' : '#666', fontSize: 11, fontWeight: 600,
                    }}>
                      {v === 'front' ? 'Anterior' : 'Posterior'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Zona selecionada */}
              {selZona && selOff && selScale && selected ? (
                <div style={{ background: '#1a1a28', borderRadius: 8, padding: 10,
                  border: `1px solid ${ACC}44` }}>
                  <div style={{ fontSize: 10, color: '#555', marginBottom: 3 }}>Região selecionada</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: ACC, marginBottom: 6 }}>
                    {selZona.label}
                  </div>

                  {/* Posição */}
                  <div style={{ fontSize: 9, color: '#444', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Posição</div>
                  {(['dx', 'dy'] as const).map(axis => (
                    <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <span style={{ fontSize: 10, width: 16, color: '#666' }}>{axis}:</span>
                      <input type="range" min={-80} max={80} step={0.5}
                        value={selOff[axis]}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setOffsets(prev => ({ ...prev, [selected]: { ...prev[selected] ?? { dx: 0, dy: 0 }, [axis]: val } }));
                          setDirty(true);
                        }}
                        style={{ flex: 1, accentColor: ACC, height: 3 }}
                      />
                      <span style={{ fontSize: 10, fontFamily: 'monospace', width: 32, textAlign: 'right', color: '#ccc' }}>
                        {selOff[axis] > 0 ? '+' : ''}{selOff[axis]}
                      </span>
                    </div>
                  ))}

                  {/* Escala */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Escala</div>
                    {BILATERAL_PAIRS[selected] && (
                      <div style={{ fontSize: 8, color: '#a78bfa', background: '#2d1b6933',
                        border: '1px solid #7c3aed55', borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap' }}>
                        ⟷ bilateral
                      </div>
                    )}
                  </div>
                  {([
                    { axis: 'sx' as const, label: 'Largura' },
                    { axis: 'sy' as const, label: 'Comprimento' },
                  ]).map(({ axis, label }) => (
                    <div key={axis} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                      <span style={{ fontSize: 10, width: 70, color: '#666', flexShrink: 0 }}>{label}:</span>
                      <input type="range" min={0.2} max={2.5} step={0.05}
                        value={selScale[axis]}
                        onChange={e => {
                          const val = Number(e.target.value);
                          const partner = BILATERAL_PAIRS[selected];
                          setScales(prev => {
                            const next = { ...prev, [selected]: { ...(prev[selected] ?? { sx: 1, sy: 1 }), [axis]: val } };
                            if (partner) next[partner] = { ...(prev[partner] ?? { sx: 1, sy: 1 }), [axis]: val };
                            return next;
                          });
                          setDirty(true);
                        }}
                        style={{ flex: 1, accentColor: '#7c3aed', height: 3 }}
                      />
                      <span style={{ fontSize: 10, fontFamily: 'monospace', width: 36, textAlign: 'right', color: '#ccc' }}>
                        {selScale[axis].toFixed(2)}×
                      </span>
                    </div>
                  ))}

                  <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                    <button onClick={() => {
                      const partner = BILATERAL_PAIRS[selected!];
                      setOffsets(prev => { const n = { ...prev }; delete n[selected!]; return n; });
                      setScales(prev => {
                        const n = { ...prev };
                        delete n[selected!];
                        if (partner) delete n[partner];
                        return n;
                      });
                      setDirty(true);
                    }} style={{ flex: 1, padding: '4px 0', borderRadius: 5, border: 'none', cursor: 'pointer',
                      background: '#2a2a38', color: '#aaa', fontSize: 10 }}>
                      ↺ Resetar{BILATERAL_PAIRS[selected] ? ' (ambos)' : ''}
                    </button>
                    <button onClick={() => setSelected(null)}
                      style={{ flex: 1, padding: '4px 0', borderRadius: 5, border: 'none', cursor: 'pointer',
                      background: '#2a2a38', color: '#aaa', fontSize: 10 }}>
                      ✕ Fechar
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#3a3a50', textAlign: 'center', padding: '16px 4px', lineHeight: 1.5 }}>
                  Toque em uma região do corpo para selecionar e ajustar sua posição.
                </div>
              )}

              {/* Regiões movidas */}
              {adjustedZones.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Ajustadas ({adjustedZones.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {adjustedZones.map(z => {
                      const off = offsets[z.id] ?? { dx: 0, dy: 0 };
                      const sc  = scales[z.id]  ?? { sx: 1, sy: 1 };
                      const hasMov = off.dx !== 0 || off.dy !== 0;
                      const hasSc  = sc.sx !== 1 || sc.sy !== 1;
                      return (
                        <div key={z.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#16161e',
                            borderRadius: 4, padding: '3px 7px', fontSize: 10, cursor: 'pointer',
                            border: selected === z.id ? `1px solid ${ACC}` : '1px solid transparent' }}
                          onClick={() => setSelected(z.id)}>
                          <span style={{ color: ORG, flex: 1 }}>{z.label}</span>
                          <span style={{ fontFamily: 'monospace', color: '#555', fontSize: 9, whiteSpace: 'nowrap' }}>
                            {hasMov && `${off.dx > 0?'+':''}${off.dx},${off.dy > 0?'+':''}${off.dy} `}
                            {hasSc  && `${sc.sx.toFixed(1)}×${sc.sy.toFixed(1)}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Lista de todas as zonas */}
              <div>
                <div style={{ fontSize: 10, color: '#555', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Todas ({visibleZones.length})
                </div>
                <div style={{ maxHeight: 210, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {visibleZones.map(z => {
                    const off  = offsets[z.id] ?? { dx: 0, dy: 0 };
                    const moved = off.dx !== 0 || off.dy !== 0;
                    return (
                      <div key={z.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 5,
                          background: selected === z.id ? '#1e1e2e' : 'transparent',
                          borderRadius: 4, padding: '3px 6px', fontSize: 10, cursor: 'pointer',
                          border: selected === z.id ? `1px solid ${ACC}55` : '1px solid transparent' }}
                        onClick={() => setSelected(z.id)}>
                        <span style={{ color: moved ? ORG : '#555', flex: 1 }}>{z.label}</span>
                        {moved && (
                          <span style={{ fontFamily: 'monospace', color: '#444', fontSize: 9, whiteSpace: 'nowrap' }}>
                            {off.dx > 0 ? '+' : ''}{off.dx},{off.dy > 0 ? '+' : ''}{off.dy}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── Tab Figura ── */}
          {tab === 'figura' && (
            <>
              <div style={{ fontSize: 10, color: '#555', lineHeight: 1.5 }}>
                Ajuste as dimensões do boneco. Clique em{' '}
                <b style={{ color: ACC }}>Aplicar proporções</b> para reescalar as regiões automaticamente.
              </div>

              {figSliders.map(({ key, label, min, max, step }) => (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: '#bbb' }}>{label}</span>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', color: ACC }}>{figura[key]}</span>
                  </div>
                  <input type="range" min={min} max={max} step={step}
                    value={figura[key]}
                    onChange={e => setFigField(key, Number(e.target.value))}
                    style={{ width: '100%', accentColor: '#7c3aed', height: 3 }}
                  />
                </div>
              ))}

              <button onClick={applyProportional} style={{
                width: '100%', padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: propApplied ? '#1e3a1e' : '#4c1d95',
                color: propApplied ? '#4ade80' : '#e9d5ff',
                fontSize: 11, fontWeight: 600, marginTop: 4,
              }}>
                {propApplied ? '✓ Proporções aplicadas' : '⟳ Aplicar proporções às regiões'}
              </button>

              <button onClick={() => { setFigura(DEFAULT_FIGURA); setDirty(true); setPropApplied(false); }}
                style={{ width: '100%', padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: '#1e1e2a', color: '#555', fontSize: 10 }}>
                Restaurar dimensões padrão
              </button>

              <div style={{ background: '#0d0d14', borderRadius: 6, padding: 8, fontSize: 9,
                fontFamily: 'monospace', color: '#555', lineHeight: 1.8 }}>
                <div style={{ color: '#777', marginBottom: 4, fontSize: 10 }}>Pontos-chave calculados</div>
                {[
                  ['Cabeça cy',    fig.headCy.toFixed(1)],
                  ['Pescoço top',  fig.neckTop.toFixed(1)],
                  ['Tronco top',   fig.torsoTop.toFixed(1)],
                  ['Tronco bot',   fig.torsoBot.toFixed(1)],
                  ['Braço end y',  fig.armEndY.toFixed(1)],
                  ['Pé y',         fig.footY.toFixed(1)],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{k}</span><span style={{ color: ACC }}>{v}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '10px 12px', borderTop: `1px solid ${BDR}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={saveAll} style={{
            width: '100%', padding: '10px 0', borderRadius: 7, border: 'none', cursor: 'pointer',
            background: dirty ? '#1d4ed8' : '#14532d',
            color: dirty ? '#fff' : '#86efac', fontSize: 13, fontWeight: 700,
          }}>
            {dirty ? '⏳ Salvando…' : '✓ Salvo automaticamente'}
          </button>

          {savedAt && (
            <div style={{ textAlign: 'center', fontSize: 10, color: '#4ade80' }}>
              Auto-salvo às {savedAt}
            </div>
          )}

          <div style={{ display: 'flex', gap: 5 }}>
            <button onClick={exportJSON} style={{ flex: 1, padding: '5px 0', borderRadius: 5,
              border: `1px solid ${BDR}`, cursor: 'pointer', background: 'transparent', color: '#666', fontSize: 10 }}>
              ↓ Export JSON
            </button>
            <label style={{ flex: 1, padding: '5px 0', borderRadius: 5, border: `1px solid ${BDR}`,
              cursor: 'pointer', background: 'transparent', color: '#666', fontSize: 10, textAlign: 'center' }}>
              ↑ Import JSON
              <input type="file" accept=".json" onChange={importJSON} style={{ display: 'none' }} />
            </label>
          </div>

          <button onClick={resetAll} style={{ width: '100%', padding: '5px 0', borderRadius: 5,
            border: 'none', cursor: 'pointer', background: '#1a0808', color: '#854545', fontSize: 10 }}>
            ⚠ Resetar tudo
          </button>
        </div>
      </div>
    </div>
  );
}
