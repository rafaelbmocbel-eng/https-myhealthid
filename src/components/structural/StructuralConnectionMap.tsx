import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { X, Link2 } from 'lucide-react';
import {
    StructuralAssessmentData, UNIT_CONFIGS,
    classifyScore,
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

function getCompromisePercent(s1: number, s2: number): number {
    return Math.min(95, Math.round(((s1 + s2) / 2) * 10));
}

function getSeverity(score: number): 'SEVERA' | 'MODERADA' | 'LEVE' {
    if (score >= 8) return 'SEVERA';
    if (score >= 5) return 'MODERADA';
    return 'LEVE';
}

type ConnectStep = 'idle' | 'select-source' | 'select-target' | 'fill-details';

export default function StructuralConnectionMap({ data, editable = false, onDataChange }: Props) {
    const [connectStep, setConnectStep] = useState<ConnectStep>('idle');
    const [source, setSource] = useState<string | null>(null);
    const [target, setTarget] = useState<string | null>(null);
    const [mechanism, setMechanism] = useState('');
    const [structures, setStructures] = useState('');

    const relationships = useMemo(() => data.relationships, [data.relationships]);
    const hasRelationships = relationships.direct.length > 0 || relationships.indirect.length > 0;

    const createCurvedPath = (sx: number, sy: number, tx: number, ty: number, curve: number = 0) => {
        const dx = tx - sx;
        const dy = ty - sy;
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const offset = curve * 30;
        const cx = mx + (-dy / len * offset);
        const cy = my + (dx / len * offset);
        return { path: `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`, cx, cy };
    };

    // --- Node click handler for creating connections ---
    const handleNodeClick = (unitId: string) => {
        if (!editable) return;

        if (connectStep === 'idle' || connectStep === 'select-source') {
            setSource(unitId);
            setTarget(null);
            setConnectStep('select-target');
        } else if (connectStep === 'select-target') {
            if (unitId === source) {
                // Tapped same node — cancel
                cancelConnect();
                return;
            }
            setTarget(unitId);
            setConnectStep('fill-details');
        }
    };

    const cancelConnect = () => {
        setConnectStep('idle');
        setSource(null);
        setTarget(null);
        setMechanism('');
        setStructures('');
    };

    const confirmConnection = () => {
        if (!onDataChange || !source || !target) return;
        const sourceScore = data.units[source]?.score || 0;
        const structList = structures.split(',').map(s => s.trim()).filter(Boolean);

        const rel: StructuralRelationship = {
            source,
            target,
            mechanism: mechanism.trim() || `Conexão ${source} → ${target}`,
            affectedStructures: structList,
            severity: getSeverity(sourceScore),
            interventionPriority: data.relationships.direct.length + 1,
        };

        onDataChange({
            ...data,
            relationships: { ...data.relationships, direct: [...data.relationships.direct, rel] },
        });
        cancelConnect();
    };

    const removeDirectRel = (i: number) => {
        if (!onDataChange) return;
        const arr = [...data.relationships.direct];
        arr.splice(i, 1);
        onDataChange({ ...data, relationships: { ...data.relationships, direct: arr } });
    };

    const removeIndirectRel = (i: number) => {
        if (!onDataChange) return;
        const arr = [...data.relationships.indirect];
        arr.splice(i, 1);
        onDataChange({ ...data, relationships: { ...data.relationships, indirect: arr } });
    };

    // Instruction text
    const getInstruction = () => {
        if (connectStep === 'select-source') return '1️⃣ Toque na unidade de ORIGEM';
        if (connectStep === 'select-target') return `2️⃣ Agora toque na unidade de DESTINO (origem: ${source})`;
        if (connectStep === 'fill-details') return `Descreva a conexão ${source} → ${target}`;
        return editable ? 'Toque num nó para iniciar uma conexão' : 'Conexões entre unidades';
    };

    return (
        <div className="clinical-card">
            <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-sm">Mapa de Comprometimento</h3>
                {editable && connectStep === 'idle' && (
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                        onClick={() => setConnectStep('select-source')}>
                        <Link2 className="h-3 w-3" /> Conectar
                    </Button>
                )}
                {editable && connectStep !== 'idle' && connectStep !== 'fill-details' && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-red-500" onClick={cancelConnect}>
                        <X className="h-3 w-3" /> Cancelar
                    </Button>
                )}
            </div>

            {/* Instruction bar */}
            <div className={cn(
                'text-[11px] px-3 py-1.5 rounded-lg mb-3 text-center font-medium transition-all',
                connectStep === 'idle' ? 'text-muted-foreground bg-muted/30' :
                    connectStep === 'fill-details' ? 'text-primary bg-primary/10 border border-primary/30' :
                        'text-amber-700 bg-amber-50 border border-amber-200 animate-pulse'
            )}>
                {getInstruction()}
            </div>

            {/* Fill details inline form */}
            {connectStep === 'fill-details' && source && target && (
                <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 mb-3 space-y-2 animate-slide-in">
                    <div className="flex items-center gap-2 text-sm font-bold">
                        <Badge>{source}</Badge>
                        <span>→</span>
                        <Badge>{target}</Badge>
                    </div>
                    <Input placeholder="Mecanismo (ex: Cifose → compressão radicular)" value={mechanism}
                        onChange={e => setMechanism(e.target.value)} className="text-xs h-8" autoFocus />
                    <Input placeholder="Tecidos afetados (vírgula)" value={structures}
                        onChange={e => setStructures(e.target.value)} className="text-xs h-8" />
                    <div className="flex gap-2">
                        <Button size="sm" className="flex-1 h-8 text-xs" onClick={confirmConnection}>
                            Criar Conexão
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={cancelConnect}>
                            Cancelar
                        </Button>
                    </div>
                </div>
            )}

            {/* SVG Map */}
            <svg viewBox="0 0 600 540" className="w-full max-w-2xl mx-auto" style={{ minHeight: 340 }}>
                <defs>
                    <marker id="as" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                        <path d="M 0 0 L 8 3 L 0 6 Z" fill="#EF4444" />
                    </marker>
                    <marker id="am" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                        <path d="M 0 0 L 8 3 L 0 6 Z" fill="#F97316" />
                    </marker>
                    <marker id="al" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                        <path d="M 0 0 L 8 3 L 0 6 Z" fill="#F59E0B" />
                    </marker>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="4" result="b" />
                        <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    {/* Selection ring pulse */}
                    <filter id="select-glow">
                        <feGaussianBlur stdDeviation="6" result="b" />
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
                    const mid = rel.severity === 'SEVERA' ? 'as' : rel.severity === 'MODERADA' ? 'am' : 'al';
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
                    const mid = rel.severity === 'SEVERA' ? 'as' : rel.severity === 'MODERADA' ? 'am' : 'al';
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

                {/* Nodes — clickable for connections */}
                {UNIT_CONFIGS.map(cfg => {
                    const pos = NODE_POSITIONS[cfg.id];
                    if (!pos) return null;
                    const unit = data.units[cfg.id];
                    const score = unit?.score || 0;
                    const color = getNodeColor(score);
                    const isCritical = score >= 8;
                    const isDriver = data.primaryDriver === cfg.id;
                    const isSource = source === cfg.id;
                    const isSelecting = connectStep === 'select-source' || connectStep === 'select-target';
                    const r = isDriver ? 34 : isSource ? 32 : 28;

                    return (
                        <g key={cfg.id}
                            onClick={() => handleNodeClick(cfg.id)}
                            className={isSelecting ? 'cursor-pointer' : editable ? 'cursor-pointer' : ''}
                            style={{ transition: 'all 0.2s ease' }}
                        >
                            {/* Selection ring */}
                            {isSource && (
                                <circle cx={pos.x} cy={pos.y} r={r + 6}
                                    fill="none" stroke="#3B82F6" strokeWidth={3} strokeDasharray="8,4"
                                    filter="url(#select-glow)" opacity={0.8}>
                                    <animate attributeName="stroke-dashoffset" from="0" to="24" dur="1s" repeatCount="indefinite" />
                                </circle>
                            )}
                            {/* Clickable area (larger hit target) */}
                            {isSelecting && (
                                <circle cx={pos.x} cy={pos.y} r={r + 10} fill="transparent" />
                            )}
                            {/* Node */}
                            <circle cx={pos.x} cy={pos.y} r={r} fill={color}
                                stroke={isSource ? '#3B82F6' : isCritical ? '#EF4444' : 'white'}
                                strokeWidth={isSource ? 4 : isDriver ? 4 : 2}
                                filter={isCritical ? 'url(#glow)' : undefined}
                                opacity={score > 0 ? 1 : 0.3} />
                            {/* Score */}
                            <text x={pos.x} y={pos.y + 5} textAnchor="middle" fontSize={isDriver ? 18 : 15}
                                fontWeight="900" fill="white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)', pointerEvents: 'none' }}>
                                {score.toFixed(1)}
                            </text>
                            {/* Label */}
                            <text x={pos.x} y={pos.y + r + 14} textAnchor="middle" fontSize={10} fontWeight="700"
                                fill="currentColor" style={{ pointerEvents: 'none' }}>{cfg.id}</text>
                            <text x={pos.x} y={pos.y + r + 25} textAnchor="middle" fontSize={8}
                                fill="#888" style={{ pointerEvents: 'none' }}>{cfg.shortName}</text>
                            {/* Driver */}
                            {isDriver && (
                                <text x={pos.x} y={pos.y - r - 6} textAnchor="middle" fontSize={10}
                                    fill="#EF4444" fontWeight="bold" style={{ pointerEvents: 'none' }}>⚠️ DRIVER</text>
                            )}
                        </g>
                    );
                })}
            </svg>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 justify-center mt-2 text-[10px] text-muted-foreground">
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

            {/* Mechanisms list (editable) */}
            {hasRelationships && (
                <div className="mt-3 space-y-1.5">
                    <h4 className="text-xs font-bold">Conexões</h4>
                    {relationships.direct.map((rel, i) => (
                        <div key={`d-${i}`} className="text-[10px] p-2 rounded border bg-muted/20 flex items-start gap-2">
                            <span className={cn('font-black shrink-0',
                                rel.severity === 'SEVERA' ? 'text-red-600' :
                                    rel.severity === 'MODERADA' ? 'text-orange-600' : 'text-amber-600')}>
                                {rel.source} → {rel.target}
                            </span>
                            <span className="text-muted-foreground flex-1">{rel.mechanism}</span>
                            {rel.affectedStructures.length > 0 && (
                                <span className="text-primary font-medium shrink-0">[{rel.affectedStructures.join(', ')}]</span>
                            )}
                            {editable && (
                                <button onClick={() => removeDirectRel(i)} className="shrink-0 text-red-400 hover:text-red-600">
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
                                <button onClick={() => removeIndirectRel(i)} className="shrink-0 text-red-400 hover:text-red-600">
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
