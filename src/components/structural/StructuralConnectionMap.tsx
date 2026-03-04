import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
    StructuralAssessmentData, UNIT_CONFIGS, UNIT_RELATIONSHIPS,
    classifyScore, classifyScoreColor,
} from '@/types/structural';

interface Props {
    data: StructuralAssessmentData;
}

// Layout: positions of each unit node in the SVG
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

// Compute compromise percentage based on score difference
function getCompromisePercent(sourceScore: number, targetScore: number): number {
    const avg = (sourceScore + targetScore) / 2;
    return Math.min(95, Math.round(avg * 10));
}

export default function StructuralConnectionMap({ data }: Props) {
    const relationships = useMemo(() => data.relationships, [data.relationships]);
    const hasRelationships = relationships.direct.length > 0 || relationships.indirect.length > 0;

    // Curve path between two nodes
    const createCurvedPath = (
        sx: number, sy: number, tx: number, ty: number, _curve: number = 0
    ) => {
        const dx = tx - sx;
        const dy = ty - sy;
        const mx = (sx + tx) / 2;
        const my = (sy + ty) / 2;
        // Perpendicular offset for curvature
        const offset = _curve * 30;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / len * offset;
        const ny = dx / len * offset;
        const cx = mx + nx;
        const cy = my + ny;
        return { path: `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`, cx, cy };
    };

    return (
        <div className="clinical-card">
            <h3 className="font-bold text-sm mb-1">Mapa de Comprometimento Estrutural</h3>
            <p className="text-[10px] text-muted-foreground mb-3">Conexões diretas e indiretas entre unidades</p>

            <svg viewBox="0 0 600 540" className="w-full max-w-2xl mx-auto" style={{ minHeight: 400 }}>
                <defs>
                    {/* Arrow markers */}
                    <marker id="arrow-severe" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                        <path d="M 0 0 L 8 3 L 0 6 Z" fill="#EF4444" />
                    </marker>
                    <marker id="arrow-moderate" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                        <path d="M 0 0 L 8 3 L 0 6 Z" fill="#F97316" />
                    </marker>
                    <marker id="arrow-mild" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                        <path d="M 0 0 L 8 3 L 0 6 Z" fill="#F59E0B" />
                    </marker>
                    {/* Glow filter for critical nodes */}
                    <filter id="glow-red">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>

                {/* Direct relationship arrows */}
                {relationships.direct.map((rel, i) => {
                    const s = NODE_POSITIONS[rel.source];
                    const t = NODE_POSITIONS[rel.target];
                    if (!s || !t) return null;

                    const sourceScore = data.units[rel.source]?.score || 0;
                    const targetScore = data.units[rel.target]?.score || 0;
                    const pct = getCompromisePercent(sourceScore, targetScore);
                    const color = getArrowColor(rel.severity);
                    const width = getArrowWidth(rel.severity);
                    const markerId = rel.severity === 'SEVERA' ? 'arrow-severe' : rel.severity === 'MODERADA' ? 'arrow-moderate' : 'arrow-mild';

                    // Offset to avoid overlapping arrows
                    const { path, cx, cy } = createCurvedPath(s.x, s.y, t.x, t.y, (i % 3) - 1);

                    return (
                        <g key={`d-${i}`}>
                            <path
                                d={path}
                                fill="none"
                                stroke={color}
                                strokeWidth={width}
                                markerEnd={`url(#${markerId})`}
                                opacity={0.8}
                            />
                            {/* Label on arrow */}
                            <rect x={cx - 22} y={cy - 10} width={44} height={20} rx={6}
                                fill="white" stroke={color} strokeWidth={1} opacity={0.9} />
                            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={9} fontWeight="bold" fill={color}>
                                {pct}%
                            </text>
                        </g>
                    );
                })}

                {/* Indirect relationship arrows (dashed) */}
                {relationships.indirect.map((rel, i) => {
                    const s = NODE_POSITIONS[rel.source];
                    const t = NODE_POSITIONS[rel.target];
                    if (!s || !t) return null;

                    const sourceScore = data.units[rel.source]?.score || 0;
                    const targetScore = data.units[rel.target]?.score || 0;
                    const pct = getCompromisePercent(sourceScore, targetScore);
                    const color = getArrowColor(rel.severity);

                    const { path, cx, cy } = createCurvedPath(s.x, s.y, t.x, t.y, ((i % 3) - 1) * 1.5);

                    return (
                        <g key={`i-${i}`}>
                            <path
                                d={path}
                                fill="none"
                                stroke={color}
                                strokeWidth={1.5}
                                strokeDasharray="8,4"
                                markerEnd={`url(#arrow-${rel.severity === 'SEVERA' ? 'severe' : rel.severity === 'MODERADA' ? 'moderate' : 'mild'})`}
                                opacity={0.6}
                            />
                            <rect x={cx - 22} y={cy - 10} width={44} height={20} rx={6}
                                fill="white" stroke={color} strokeWidth={0.5} opacity={0.8} />
                            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={8} fill={color}>
                                {pct}%
                            </text>
                        </g>
                    );
                })}

                {/* Unit nodes */}
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
                            {/* Node circle */}
                            <circle
                                cx={pos.x} cy={pos.y} r={r}
                                fill={color}
                                stroke={isCritical ? '#EF4444' : 'white'}
                                strokeWidth={isDriver ? 4 : 2}
                                filter={isCritical ? 'url(#glow-red)' : undefined}
                                opacity={score > 0 ? 1 : 0.3}
                            />
                            {/* Score text */}
                            <text x={pos.x} y={pos.y + 5} textAnchor="middle" fontSize={isDriver ? 18 : 15}
                                fontWeight="900" fill="white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                                {score.toFixed(1)}
                            </text>
                            {/* Unit label below */}
                            <text x={pos.x} y={pos.y + r + 14} textAnchor="middle" fontSize={10} fontWeight="700" fill="currentColor">
                                {cfg.id}
                            </text>
                            <text x={pos.x} y={pos.y + r + 25} textAnchor="middle" fontSize={8} fill="#888">
                                {cfg.shortName}
                            </text>
                            {/* Driver indicator */}
                            {isDriver && (
                                <text x={pos.x} y={pos.y - r - 6} textAnchor="middle" fontSize={10} fill="#EF4444" fontWeight="bold">
                                    ⚠️ DRIVER
                                </text>
                            )}
                        </g>
                    );
                })}
            </svg>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 justify-center mt-3 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1">
                    <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#EF4444" strokeWidth="3" /></svg>
                    <span>Direta (Grave)</span>
                </div>
                <div className="flex items-center gap-1">
                    <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#F97316" strokeWidth="2" /></svg>
                    <span>Direta (Moderada)</span>
                </div>
                <div className="flex items-center gap-1">
                    <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#F59E0B" strokeWidth="2" strokeDasharray="6,3" /></svg>
                    <span>Indireta</span>
                </div>
            </div>

            {/* Relationship details */}
            {hasRelationships && (
                <div className="mt-4 space-y-2">
                    <h4 className="text-xs font-bold text-foreground">Mecanismos de Conexão</h4>
                    {relationships.direct.slice(0, 5).map((rel, i) => (
                        <div key={i} className="text-[10px] p-2 rounded border bg-muted/20 flex items-start gap-2">
                            <span className={cn('font-black shrink-0', rel.severity === 'SEVERA' ? 'text-red-600' : rel.severity === 'MODERADA' ? 'text-orange-600' : 'text-amber-600')}>
                                {rel.source} → {rel.target}
                            </span>
                            <span className="text-muted-foreground">{rel.mechanism}</span>
                            {rel.affectedStructures.length > 0 && (
                                <span className="text-primary font-medium ml-auto shrink-0">
                                    [{rel.affectedStructures.join(', ')}]
                                </span>
                            )}
                        </div>
                    ))}
                    {relationships.indirect.slice(0, 3).map((rel, i) => (
                        <div key={`i-${i}`} className="text-[10px] p-2 rounded border border-dashed bg-muted/10 flex items-start gap-2">
                            <span className="font-black text-amber-600 shrink-0">
                                {rel.source} ⟶ {rel.intermediate} ⟶ {rel.target}
                            </span>
                            <span className="text-muted-foreground">{rel.mechanism}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
