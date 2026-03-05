import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Plus, X, Pencil } from 'lucide-react';
import {
    StructuralAssessmentData, UNIT_CONFIGS, UNIT_RELATIONSHIPS,
    classifyScore, classifyScoreColor,
    StructuralRelationship, IndirectRelationship,
} from '@/types/structural';

interface Props {
    data: StructuralAssessmentData;
    editable?: boolean;
    onDataChange?: (data: StructuralAssessmentData) => void;
}

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
    if (score <= 2) return '#22C55E';
    if (score <= 4) return '#84CC16';
    if (score <= 6) return '#F59E0B';
    if (score <= 8) return '#F97316';
    return '#EF4444';
}

function getArrowColor(severity: string): string {
    if (severity === 'SEVERA') return '#EF4444';
    if (severity === 'MODERADA') return '#F97316';
    return '#F59E0B';
}

function getArrowWidth(severity: string): number {
    if (severity === 'SEVERA') return 4;
    if (severity === 'MODERADA') return 2.5;
    return 1.5;
}

function getCompromisePercent(sourceScore: number, targetScore: number): number {
    const avg = (sourceScore + targetScore) / 2;
    return Math.min(95, Math.round(avg * 10));
}

const UNIT_IDS = UNIT_CONFIGS.map(c => c.id);

export default function StructuralConnectionMap({ data, editable = false, onDataChange }: Props) {
    const [addingConnection, setAddingConnection] = useState(false);
    const [newConn, setNewConn] = useState({ source: 'UC-1', target: 'UC-2', mechanism: '', structures: '', type: 'direct' as 'direct' | 'indirect', intermediate: 'UC-2' });

    const relationships = useMemo(() => data.relationships, [data.relationships]);
    const hasRelationships = relationships.direct.length > 0 || relationships.indirect.length > 0;

    const createCurvedPath = (sx: number, sy: number, tx: number, ty: number, curve: number = 0) => {
        const dx = tx - sx;
        const dy = ty - sy;
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;
        const offset = curve * 30;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len * offset;
        const ny = dx / len * offset;
        const cx = mx + nx;
        const cy = my + ny;
        return { path: `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`, cx, cy };
    };

    const removeDirectRelationship = (index: number) => {
        if (!onDataChange) return;
        const newDirect = [...data.relationships.direct];
        newDirect.splice(index, 1);
        onDataChange({
            ...data,
            relationships: { ...data.relationships, direct: newDirect },
        });
    };

    const removeIndirectRelationship = (index: number) => {
        if (!onDataChange) return;
        const newIndirect = [...data.relationships.indirect];
        newIndirect.splice(index, 1);
        onDataChange({
            ...data,
            relationships: { ...data.relationships, indirect: newIndirect },
        });
    };

    const addConnection = () => {
        if (!onDataChange || !newConn.mechanism.trim()) return;
        const structures = newConn.structures.split(',').map(s => s.trim()).filter(Boolean);

        if (newConn.type === 'direct') {
            const rel: StructuralRelationship = {
                source: newConn.source,
                target: newConn.target,
                mechanism: newConn.mechanism,
                affectedStructures: structures,
                severity: data.units[newConn.source]?.score >= 8 ? 'SEVERA' :
                    data.units[newConn.source]?.score >= 5 ? 'MODERADA' : 'LEVE',
                interventionPriority: data.relationships.direct.length + 1,
            };
            onDataChange({
                ...data,
                relationships: { ...data.relationships, direct: [...data.relationships.direct, rel] },
            });
        } else {
            const rel: IndirectRelationship = {
                source: newConn.source,
                intermediate: newConn.intermediate,
                target: newConn.target,
                mechanism: newConn.mechanism,
                chainLength: 3,
                severity: data.units[newConn.source]?.score >= 8 ? 'SEVERA' :
                    data.units[newConn.source]?.score >= 5 ? 'MODERADA' : 'LEVE',
            };
            onDataChange({
                ...data,
                relationships: { ...data.relationships, indirect: [...data.relationships.indirect, rel] },
            });
        }

        setNewConn({ source: 'UC-1', target: 'UC-2', mechanism: '', structures: '', type: 'direct', intermediate: 'UC-2' });
        setAddingConnection(false);
    };

    return (
        <div className="clinical-card">
            <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-sm">Mapa de Comprometimento Estrutural</h3>
                {editable && (
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setAddingConnection(a => !a)}>
                        {addingConnection ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                        {addingConnection ? 'Cancelar' : 'Conexão'}
                    </Button>
                )}
            </div>
            <p className="text-[10px] text-muted-foreground mb-3">
                {editable ? 'Clique no ✕ para remover conexões · + para adicionar' : 'Conexões diretas e indiretas entre unidades'}
            </p>

            {/* Add connection form */}
            {addingConnection && editable && (
                <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 mb-3 space-y-2">
                    <div className="flex gap-2 items-center flex-wrap">
                        <select value={newConn.type} onChange={e => setNewConn(c => ({ ...c, type: e.target.value as any }))}
                            className="text-xs border rounded px-2 py-1 bg-background">
                            <option value="direct">Direta</option>
                            <option value="indirect">Indireta</option>
                        </select>
                        <select value={newConn.source} onChange={e => setNewConn(c => ({ ...c, source: e.target.value }))}
                            className="text-xs border rounded px-2 py-1 bg-background">
                            {UNIT_IDS.map(id => <option key={id} value={id}>{id}</option>)}
                        </select>
                        <span className="text-xs text-muted-foreground">→</span>
                        {newConn.type === 'indirect' && (
                            <>
                                <select value={newConn.intermediate} onChange={e => setNewConn(c => ({ ...c, intermediate: e.target.value }))}
                                    className="text-xs border rounded px-2 py-1 bg-background">
                                    {UNIT_IDS.map(id => <option key={id} value={id}>{id}</option>)}
                                </select>
                                <span className="text-xs text-muted-foreground">→</span>
                            </>
                        )}
                        <select value={newConn.target} onChange={e => setNewConn(c => ({ ...c, target: e.target.value }))}
                            className="text-xs border rounded px-2 py-1 bg-background">
                            {UNIT_IDS.map(id => <option key={id} value={id}>{id}</option>)}
                        </select>
                    </div>
                    <Input placeholder="Mecanismo (ex: Cifose → compressão radicular)" value={newConn.mechanism}
                        onChange={e => setNewConn(c => ({ ...c, mechanism: e.target.value }))} className="text-xs h-8" />
                    {newConn.type === 'direct' && (
                        <Input placeholder="Tecidos afetados (separados por vírgula)" value={newConn.structures}
                            onChange={e => setNewConn(c => ({ ...c, structures: e.target.value }))} className="text-xs h-8" />
                    )}
                    <Button size="sm" className="w-full h-8 text-xs" onClick={addConnection} disabled={!newConn.mechanism.trim()}>
                        Adicionar Conexão
                    </Button>
                </div>
            )}

            {/* SVG Map */}
            <svg viewBox="0 0 600 540" className="w-full max-w-2xl mx-auto" style={{ minHeight: 360 }}>
                <defs>
                    <marker id="arr-s" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                        <path d="M 0 0 L 8 3 L 0 6 Z" fill="#EF4444" />
                    </marker>
                    <marker id="arr-m" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                        <path d="M 0 0 L 8 3 L 0 6 Z" fill="#F97316" />
                    </marker>
                    <marker id="arr-l" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                        <path d="M 0 0 L 8 3 L 0 6 Z" fill="#F59E0B" />
                    </marker>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="4" result="b" />
                        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>

                {/* Direct arrows */}
                {relationships.direct.map((rel, i) => {
                    const s = NODE_POSITIONS[rel.source];
                    const t = NODE_POSITIONS[rel.target];
                    if (!s || !t) return null;
                    const ss = data.units[rel.source]?.score || 0;
                    const ts = data.units[rel.target]?.score || 0;
                    const pct = getCompromisePercent(ss, ts);
                    const color = getArrowColor(rel.severity);
                    const width = getArrowWidth(rel.severity);
                    const mid = rel.severity === 'SEVERA' ? 'arr-s' : rel.severity === 'MODERADA' ? 'arr-m' : 'arr-l';
                    const { path, cx, cy } = createCurvedPath(s.x, s.y, t.x, t.y, (i % 3) - 1);
                    return (
                        <g key={`d-${i}`}>
                            <path d={path} fill="none" stroke={color} strokeWidth={width} markerEnd={`url(#${mid})`} opacity={0.8} />
                            <rect x={cx - 22} y={cy - 10} width={44} height={20} rx={6} fill="white" stroke={color} strokeWidth={1} opacity={0.9} />
                            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={9} fontWeight="bold" fill={color}>{pct}%</text>
                        </g>
                    );
                })}

                {/* Indirect arrows */}
                {relationships.indirect.map((rel, i) => {
                    const s = NODE_POSITIONS[rel.source];
                    const t = NODE_POSITIONS[rel.target];
                    if (!s || !t) return null;
                    const ss = data.units[rel.source]?.score || 0;
                    const ts = data.units[rel.target]?.score || 0;
                    const pct = getCompromisePercent(ss, ts);
                    const color = getArrowColor(rel.severity);
                    const mid = rel.severity === 'SEVERA' ? 'arr-s' : rel.severity === 'MODERADA' ? 'arr-m' : 'arr-l';
                    const { path, cx, cy } = createCurvedPath(s.x, s.y, t.x, t.y, ((i % 3) - 1) * 1.5);
                    return (
                        <g key={`i-${i}`}>
                            <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="8,4"
                                markerEnd={`url(#${mid})`} opacity={0.6} />
                            <rect x={cx - 22} y={cy - 10} width={44} height={20} rx={6} fill="white" stroke={color} strokeWidth={0.5} opacity={0.8} />
                            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={8} fill={color}>{pct}%</text>
                        </g>
                    );
                })}

                {/* Nodes */}
                {UNIT_CONFIGS.map(cfg => {
                    const pos = NODE_POSITIONS[cfg.id];
                    if (!pos) return null;
                    const unit = data.units[cfg.id];
                    const score = unit?.score || 0;
                    const color = getNodeColor(score);
                    const isCritical = score >= 8;
                    const isDriver = data.primaryDriver === cfg.id;
                    const r = isDriver ? 34 : 28;
                    return (
                        <g key={cfg.id}>
                            <circle cx={pos.x} cy={pos.y} r={r} fill={color}
                                stroke={isCritical ? '#EF4444' : 'white'} strokeWidth={isDriver ? 4 : 2}
                                filter={isCritical ? 'url(#glow)' : undefined} opacity={score > 0 ? 1 : 0.3} />
                            <text x={pos.x} y={pos.y + 5} textAnchor="middle" fontSize={isDriver ? 18 : 15}
                                fontWeight="900" fill="white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                                {score.toFixed(1)}
                            </text>
                            <text x={pos.x} y={pos.y + r + 14} textAnchor="middle" fontSize={10} fontWeight="700" fill="currentColor">{cfg.id}</text>
                            <text x={pos.x} y={pos.y + r + 25} textAnchor="middle" fontSize={8} fill="#888">{cfg.shortName}</text>
                            {isDriver && (
                                <text x={pos.x} y={pos.y - r - 6} textAnchor="middle" fontSize={10} fill="#EF4444" fontWeight="bold">⚠️ DRIVER</text>
                            )}
                        </g>
                    );
                })}
            </svg>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 justify-center mt-3 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1">
                    <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#EF4444" strokeWidth="3" /></svg>
                    <span>Grave</span>
                </div>
                <div className="flex items-center gap-1">
                    <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#F97316" strokeWidth="2" /></svg>
                    <span>Moderada</span>
                </div>
                <div className="flex items-center gap-1">
                    <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#F59E0B" strokeWidth="2" strokeDasharray="6,3" /></svg>
                    <span>Indireta</span>
                </div>
            </div>

            {/* Editable Mechanism List */}
            {hasRelationships && (
                <div className="mt-4 space-y-2">
                    <h4 className="text-xs font-bold text-foreground">Mecanismos de Conexão</h4>
                    {relationships.direct.map((rel, i) => (
                        <div key={`d-${i}`} className="text-[10px] p-2 rounded border bg-muted/20 flex items-start gap-2">
                            <span className={cn('font-black shrink-0', rel.severity === 'SEVERA' ? 'text-red-600' : rel.severity === 'MODERADA' ? 'text-orange-600' : 'text-amber-600')}>
                                {rel.source} → {rel.target}
                            </span>
                            <span className="text-muted-foreground flex-1">{rel.mechanism}</span>
                            {rel.affectedStructures.length > 0 && (
                                <span className="text-primary font-medium shrink-0">[{rel.affectedStructures.join(', ')}]</span>
                            )}
                            {editable && (
                                <button onClick={() => removeDirectRelationship(i)} className="shrink-0 text-red-400 hover:text-red-600">
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                    {relationships.indirect.map((rel, i) => (
                        <div key={`i-${i}`} className="text-[10px] p-2 rounded border border-dashed bg-muted/10 flex items-start gap-2">
                            <span className="font-black text-amber-600 shrink-0">
                                {rel.source} ⟶ {rel.intermediate} ⟶ {rel.target}
                            </span>
                            <span className="text-muted-foreground flex-1">{rel.mechanism}</span>
                            {editable && (
                                <button onClick={() => removeIndirectRelationship(i)} className="shrink-0 text-red-400 hover:text-red-600">
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
