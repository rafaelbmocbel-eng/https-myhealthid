import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { X, Pencil } from 'lucide-react';
import {
    StructuralAssessmentData, UNIT_CONFIGS,
    StructuralRelationship,
} from '@/types/structural';
import { getThermalColor } from '@/utils/myidCalculations';

interface Props {
    data: StructuralAssessmentData;
    editable?: boolean;
    onDataChange?: (data: StructuralAssessmentData) => void;
}

const TISSUE_TYPES = [
    { key: 'muscle', label: 'Músculo', emoji: '💪', color: '#EF4444', stroke: '#DC2626' },
    { key: 'nerve', label: 'Nervo', emoji: '⚡', color: '#EAB308', stroke: '#CA8A04' },
    { key: 'viscera', label: 'Víscera', emoji: '🫀', color: '#22C55E', stroke: '#16A34A' },
    { key: 'joint', label: 'Articulação', emoji: '🦴', color: '#3B82F6', stroke: '#2563EB' },
    { key: 'ligament', label: 'Ligamento', emoji: '🔗', color: '#9CA3AF', stroke: '#6B7280' },
] as const;

type TissueKey = typeof TISSUE_TYPES[number]['key'];

const NODE_POSITIONS: Record<string, { x: number; y: number }> = {
    'UC-1': { x: 300, y: 60 },
    'UA-2': { x: 80, y: 160 },
    'UA-1': { x: 520, y: 160 },
    'UC-2': { x: 300, y: 200 },
    'UC-3': { x: 300, y: 340 },
    'UA-4': { x: 80, y: 400 },
    'UA-3': { x: 520, y: 400 },
    'UC-4': { x: 300, y: 470 },
};

function getNodeColor(score: number): string {
    return getThermalColor(score);
}

function getTissue(key: TissueKey) {
    return TISSUE_TYPES.find(t => t.key === key)!;
}

export default function StructuralConnectionMap({ data: rawData, editable = false, onDataChange }: Props) {
    const data = useMemo(() => ({
        ...rawData,
        units: rawData.units || {},
        relationships: {
            direct: rawData.relationships?.direct || [],
            indirect: rawData.relationships?.indirect || [],
        },
    }), [rawData]);
    const [selectedTissue, setSelectedTissue] = useState<TissueKey>('muscle');
    const [source, setSource] = useState<string | null>(null);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    const tissueConnections = useMemo(() => {
        return data.relationships.direct
            .map((r, i) => ({ ...r, index: i }))
            .filter(r => r.affectedStructures[0]?.startsWith('TISSUE:'));
    }, [data.relationships.direct]);

    const autoConnections = useMemo(() => {
        return data.relationships.direct.filter(
            r => !r.affectedStructures[0]?.startsWith('TISSUE:')
        );
    }, [data.relationships.direct]);

    const createCurvedPath = (sx: number, sy: number, tx: number, ty: number, curve: number = 0) => {
        const dx = tx - sx; const dy = ty - sy;
        const mx = (sx + tx) / 2; const my = (sy + ty) / 2;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const cx = mx + (-dy / len * curve * 60);
        const cy = my + (dx / len * curve * 60);
        return { path: `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`, cx, cy };
    };

    // Build curve offset map: group all connections by source-target pair key
    const pairCounts = useMemo(() => {
        const map = new Map<string, number>();
        for (const rel of data.relationships.direct) {
            const key = [rel.source, rel.target].sort().join('-');
            map.set(key, (map.get(key) || 0) + 1);
        }
        return map;
    }, [data.relationships.direct]);

    const getCurveForPair = (src: string, tgt: string, globalIndex: number): number => {
        const key = [src, tgt].sort().join('-');
        const total = pairCounts.get(key) || 1;
        if (total === 1) return 0;
        let pairIndex = 0;
        for (let j = 0; j < globalIndex; j++) {
            const r = data.relationships.direct[j];
            const k = [r.source, r.target].sort().join('-');
            if (k === key) pairIndex++;
        }
        // Alternating spread: 0, -1, 1, -2, 2, -3, 3...
        // This pushes each arrow to a different side
        if (pairIndex === 0) return 0;
        const side = pairIndex % 2 === 1 ? 1 : -1;
        const magnitude = Math.ceil(pairIndex / 2);
        return side * magnitude * 1.5;
    };

    const handleNodeClick = (unitId: string) => {
        if (!editable) return;
        if (!source) {
            setSource(unitId);
        } else {
            if (unitId === source) { setSource(null); return; }
            // Create connection immediately
            if (!onDataChange) return;
            const tissue = getTissue(selectedTissue);
            const rel: StructuralRelationship = {
                source, target: unitId,
                mechanism: tissue.label,
                affectedStructures: [`TISSUE:${selectedTissue}`],
                severity: (data.units[source]?.score || 0) >= 8 ? 'SEVERA' :
                    (data.units[source]?.score || 0) >= 5 ? 'MODERADA' : 'LEVE',
                interventionPriority: data.relationships.direct.length + 1,
            };
            onDataChange({
                ...data,
                relationships: { ...data.relationships, direct: [...data.relationships.direct, rel] },
            });
            setSource(null);
        }
    };

    const removeConnection = (i: number) => {
        if (!onDataChange) return;
        const arr = [...data.relationships.direct]; arr.splice(i, 1);
        onDataChange({ ...data, relationships: { ...data.relationships, direct: arr } });
        if (editingIndex === i) setEditingIndex(null);
    };

    const removeIndirectRel = (i: number) => {
        if (!onDataChange) return;
        const arr = [...data.relationships.indirect]; arr.splice(i, 1);
        onDataChange({ ...data, relationships: { ...data.relationships, indirect: arr } });
    };

    const updateConnectionName = (i: number, name: string) => {
        if (!onDataChange) return;
        const arr = [...data.relationships.direct];
        arr[i] = { ...arr[i], mechanism: name };
        onDataChange({ ...data, relationships: { ...data.relationships, direct: arr } });
    };

    const instruction = source
        ? `Toque na unidade de DESTINO (origem: ${source})`
        : editable
            ? 'Selecione um tecido e toque em 2 unidades para conectar'
            : 'Mapa de conexões estruturais';

    return (
        <div className="clinical-card">
            <h3 className="font-bold text-sm mb-1">Mapa de Comprometimento</h3>

            {/* Tissue type selector — always visible */}
            {editable && (
                <div className="flex flex-wrap gap-1.5 justify-center mb-2">
                    {TISSUE_TYPES.map(t => (
                        <button key={t.key}
                            onClick={() => { setSelectedTissue(t.key); setSource(null); }}
                            className={cn(
                                'flex items-center gap-1 px-2.5 py-1.5 rounded-lg border-2 transition-all text-[11px] font-bold',
                                selectedTissue === t.key ? 'scale-105 shadow-sm' : 'opacity-50 hover:opacity-80'
                            )}
                            style={{
                                borderColor: selectedTissue === t.key ? t.color : `${t.color}40`,
                                backgroundColor: selectedTissue === t.key ? `${t.color}20` : 'transparent',
                                color: t.stroke,
                            }}>
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                            {t.emoji} {t.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Instruction */}
            {editable && (
                <div className={cn(
                    'text-[10px] px-3 py-1 rounded-lg mb-2 text-center font-medium',
                    source ? 'text-amber-700 bg-amber-50 border border-amber-200 animate-pulse' : 'text-muted-foreground bg-muted/30'
                )}>
                    {instruction}
                </div>
            )}

            {/* SVG Map */}
            <svg viewBox="0 0 600 540" className="w-full max-w-2xl mx-auto" style={{ minHeight: 320 }}>
                <defs>
                    {TISSUE_TYPES.map(t => (
                        <marker key={t.key} id={`arr-${t.key}`} markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                            <path d="M 0 0 L 8 3 L 0 6 Z" fill={t.color} />
                        </marker>
                    ))}
                    <marker id="arr-auto" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                        <path d="M 0 0 L 8 3 L 0 6 Z" fill="#D1D5DB" />
                    </marker>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="4" result="b" />
                        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>

                {/* Auto connections (faded) */}
                {autoConnections.map((rel, i) => {
                    const s = NODE_POSITIONS[rel.source]; const t = NODE_POSITIONS[rel.target];
                    if (!s || !t) return null;
                    const origIdx = data.relationships.direct.indexOf(rel);
                    const curve = getCurveForPair(rel.source, rel.target, origIdx);
                    const { path } = createCurvedPath(s.x, s.y, t.x, t.y, curve);
                    return <path key={`a-${i}`} d={path} fill="none" stroke="#E5E7EB" strokeWidth={1} strokeDasharray="4,4" markerEnd="url(#arr-auto)" opacity={0.25} />;
                })}

                {/* Tissue connections */}
                {tissueConnections.map((tc, i) => {
                    const s = NODE_POSITIONS[tc.source]; const t = NODE_POSITIONS[tc.target];
                    if (!s || !t) return null;
                    const tissueKey = tc.affectedStructures[0].replace('TISSUE:', '') as TissueKey;
                    const tissue = getTissue(tissueKey);
                    const curve = getCurveForPair(tc.source, tc.target, tc.index);
                    const { path, cx, cy } = createCurvedPath(s.x, s.y, t.x, t.y, curve);
                    const label = tc.mechanism.length > 14 ? tc.mechanism.slice(0, 14) + '…' : tc.mechanism;
                    const w = Math.max(80, label.length * 6.5);
                    return (
                        <g key={`tc-${i}`}>
                            <path d={path} fill="none" stroke={tissue.color} strokeWidth={3} markerEnd={`url(#arr-${tissueKey})`} opacity={0.85} />
                            <rect x={cx - w / 2} y={cy - 10} width={w} height={20} rx={8}
                                fill="white" stroke={tissue.color} strokeWidth={1.5} opacity={0.95} />
                            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={8} fontWeight="bold" fill={tissue.stroke}>{label}</text>
                        </g>
                    );
                })}

                {/* Indirect */}
                {data.relationships.indirect.map((rel, i) => {
                    const s = NODE_POSITIONS[rel.source]; const t = NODE_POSITIONS[rel.target];
                    if (!s || !t) return null;
                    const { path } = createCurvedPath(s.x, s.y, t.x, t.y, ((i % 3) - 1) * 1.5);
                    return <path key={`i-${i}`} d={path} fill="none" stroke="#D1D5DB" strokeWidth={1} strokeDasharray="6,4" markerEnd="url(#arr-auto)" opacity={0.35} />;
                })}

                {/* Nodes */}
                {UNIT_CONFIGS.map(cfg => {
                    const pos = NODE_POSITIONS[cfg.id]; if (!pos) return null;
                    const unit = data.units[cfg.id];
                    const score = unit?.score || 0;
                    const color = getNodeColor(score);
                    const isCritical = score >= 8;
                    const isDriver = data.primaryDriver === cfg.id;
                    const isSource = source === cfg.id;
                    const r = isDriver ? 34 : isSource ? 32 : 28;
                    const ringColor = getTissue(selectedTissue).color;
                    return (
                        <g key={cfg.id} onClick={() => handleNodeClick(cfg.id)}
                            className={editable ? 'cursor-pointer' : ''}>
                            {isSource && (
                                <circle cx={pos.x} cy={pos.y} r={r + 6} fill="none" stroke={ringColor}
                                    strokeWidth={3} strokeDasharray="8,4" opacity={0.9}>
                                    <animate attributeName="stroke-dashoffset" from="0" to="24" dur="1s" repeatCount="indefinite" />
                                </circle>
                            )}
                            {editable && !isSource && (
                                <circle cx={pos.x} cy={pos.y} r={r + 8} fill="transparent" />
                            )}
                            <circle cx={pos.x} cy={pos.y} r={r} fill={color}
                                stroke={isSource ? ringColor : isCritical ? '#EF4444' : 'white'}
                                strokeWidth={isSource ? 4 : isDriver ? 4 : 2}
                                filter={isCritical ? 'url(#glow)' : undefined}
                                opacity={score > 0 ? 1 : 0.3} />
                            <text x={pos.x} y={pos.y + 5} textAnchor="middle" fontSize={isDriver ? 18 : 15}
                                fontWeight="900" fill="white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)', pointerEvents: 'none' }}>
                                {score.toFixed(1)}
                            </text>
                            <text x={pos.x} y={pos.y + r + 14} textAnchor="middle" fontSize={10} fontWeight="700"
                                fill="currentColor" style={{ pointerEvents: 'none' }}>{cfg.id}</text>
                            <text x={pos.x} y={pos.y + r + 25} textAnchor="middle" fontSize={8}
                                fill="#888" style={{ pointerEvents: 'none' }}>{cfg.shortName}</text>
                            {isDriver && (
                                <text x={pos.x} y={pos.y - r - 6} textAnchor="middle" fontSize={10}
                                    fill="#EF4444" fontWeight="bold" style={{ pointerEvents: 'none' }}>⚠️ DRIVER</text>
                            )}
                        </g>
                    );
                })}
            </svg>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 justify-center mt-2 mb-1">
                {TISSUE_TYPES.map(t => (
                    <div key={t.key} className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                        <span className="text-[9px] text-muted-foreground">{t.label}</span>
                    </div>
                ))}
            </div>

            {/* Connection list — editable name on each line */}
            {(tissueConnections.length > 0 || data.relationships.indirect.length > 0) && (
                <div className="mt-2 space-y-1">
                    {data.relationships.direct.map((rel, i) => {
                        const isTissue = rel.affectedStructures[0]?.startsWith('TISSUE:');
                        if (!isTissue) return null;
                        const tissueKey = rel.affectedStructures[0].replace('TISSUE:', '') as TissueKey;
                        const tissue = getTissue(tissueKey);
                        const isEditing = editingIndex === i;
                        return (
                            <div key={`c-${i}`} className="text-[10px] p-1.5 rounded-lg border flex items-center gap-1.5"
                                style={{ borderColor: `${tissue.color}40`, backgroundColor: `${tissue.color}06` }}>
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tissue.color }} />
                                <span className="font-black shrink-0 text-[10px]">{rel.source}→{rel.target}</span>
                                {isEditing && editable ? (
                                    <Input
                                        value={rel.mechanism}
                                        onChange={e => updateConnectionName(i, e.target.value)}
                                        onBlur={() => setEditingIndex(null)}
                                        onKeyDown={e => e.key === 'Enter' && setEditingIndex(null)}
                                        className="h-5 text-[10px] flex-1 px-1 py-0 border-0 bg-transparent focus-visible:ring-0"
                                        autoFocus
                                    />
                                ) : (
                                    <span className="text-muted-foreground flex-1 truncate">{rel.mechanism}</span>
                                )}
                                {editable && !isEditing && (
                                    <button onClick={() => setEditingIndex(i)} className="shrink-0 text-muted-foreground hover:text-foreground">
                                        <Pencil className="h-3 w-3" />
                                    </button>
                                )}
                                {editable && (
                                    <button onClick={() => removeConnection(i)} className="shrink-0 text-red-400 hover:text-red-600">
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    {data.relationships.indirect.map((rel, i) => (
                        <div key={`i-${i}`} className="text-[10px] p-1.5 rounded-lg border border-dashed bg-muted/10 flex items-center gap-1.5">
                            <span className="font-black text-muted-foreground shrink-0">
                                {rel.source}⟶{rel.intermediate}⟶{rel.target}
                            </span>
                            <span className="text-muted-foreground flex-1 truncate">{rel.mechanism}</span>
                            {editable && (
                                <button onClick={() => removeIndirectRel(i)} className="shrink-0 text-red-400 hover:text-red-600">
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
