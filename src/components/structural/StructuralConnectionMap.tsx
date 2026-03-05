import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { X, Link2 } from 'lucide-react';
import {
    StructuralAssessmentData, UNIT_CONFIGS,
    StructuralRelationship,
} from '@/types/structural';

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

// Predefined structures per tissue type — all clickable
const STRUCTURES: Record<TissueKey, string[]> = {
    muscle: [
        'Trapézio', 'ECM', 'Escalenos', 'Peitoral maior', 'Peitoral menor',
        'Deltóide', 'Supraespinhoso', 'Infraespinhoso', 'Subescapular', 'Redondo menor',
        'Bíceps', 'Tríceps', 'Serrátil anterior', 'Rombóides', 'Latíssimo do dorso',
        'Eretor da espinha', 'Multífido', 'Quadrado lombar', 'Psoas', 'Ilíaco',
        'Transverso abdominal', 'Oblíquos', 'Reto abdominal', 'Diafragma',
        'Glúteo máximo', 'Glúteo médio', 'Glúteo mínimo', 'Piriforme',
        'Quadríceps', 'Isquiotibiais', 'Adutores', 'TFL/ITB',
        'Gastrocnêmio', 'Sóleo', 'Tibial anterior', 'Fibulares',
    ],
    nerve: [
        'Nervo mediano', 'Nervo ulnar', 'Nervo radial', 'Plexo braquial',
        'Nervo axilar', 'Nervo musculocutâneo', 'Nervo supraescapular',
        'Nervo ciático', 'Nervo femoral', 'Nervo fibular', 'Nervo tibial',
        'Raiz C5-C6', 'Raiz C6-C7', 'Raiz C7-T1',
        'Raiz L4', 'Raiz L5', 'Raiz S1',
        'N. occipital maior', 'N. trigêmeo', 'N. vago',
    ],
    viscera: [
        'Diafragma', 'Pulmão D', 'Pulmão E', 'Coração/Pericárdio',
        'Fígado', 'Estômago', 'Baço', 'Vesícula biliar',
        'Intestino delgado', 'Cólon ascendente', 'Cólon transverso', 'Cólon descendente',
        'Rim D', 'Rim E', 'Bexiga', 'Útero/Próstata',
        'Assoalho pélvico', 'Peritônio',
    ],
    joint: [
        'ATM', 'C0-C1', 'C1-C2', 'Cervical C3-C7',
        'Ombro D', 'Ombro E', 'Acromioclavicular D', 'Acromioclavicular E',
        'Esternoclavicular', 'Costovertebrais',
        'Cotovelo D', 'Cotovelo E', 'Punho D', 'Punho E',
        'Torácica T1-T6', 'Torácica T7-T12', 'Costocondrais',
        'L1-L2', 'L2-L3', 'L3-L4', 'L4-L5', 'L5-S1',
        'SIJ D', 'SIJ E', 'Sínfise púbica',
        'Quadril D', 'Quadril E', 'Joelho D', 'Joelho E',
        'Tornozelo D', 'Tornozelo E', 'Subtalar D', 'Subtalar E',
    ],
    ligament: [
        'LCA D', 'LCA E', 'LCP D', 'LCP E',
        'LCM D', 'LCM E', 'LCL D', 'LCL E',
        'Lig. sacroilíaco', 'Lig. sacrotuberoso', 'Lig. iliolombares',
        'Lig. longitudinal anterior', 'Lig. longitudinal posterior',
        'Lig. amarelo', 'Lig. interespinhoso',
        'Lig. coracoacromial D', 'Lig. coracoacromial E',
        'Lig. glenoumeral D', 'Lig. glenoumeral E',
        'Lig. talofibular ant. D', 'Lig. talofibular ant. E',
        'Lig. calcaneofibular D', 'Lig. calcaneofibular E',
        'Menisco medial D', 'Menisco medial E',
        'Menisco lateral D', 'Menisco lateral E',
    ],
};

interface TissueConnection {
    source: string;
    target: string;
    tissueType: TissueKey;
    structure: string;
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

function getTissue(key: TissueKey) {
    return TISSUE_TYPES.find(t => t.key === key)!;
}

type Step = 'idle' | 'select-tissue' | 'select-source' | 'select-target' | 'select-structure';

export default function StructuralConnectionMap({ data, editable = false, onDataChange }: Props) {
    const [step, setStep] = useState<Step>('idle');
    const [selectedTissue, setSelectedTissue] = useState<TissueKey | null>(null);
    const [source, setSource] = useState<string | null>(null);
    const [target, setTarget] = useState<string | null>(null);

    const tissueConnections = useMemo((): TissueConnection[] => {
        return data.relationships.direct
            .filter(r => r.affectedStructures.length > 0 && r.affectedStructures[0].startsWith('TISSUE:'))
            .map(r => ({
                source: r.source,
                target: r.target,
                tissueType: r.affectedStructures[0].replace('TISSUE:', '') as TissueKey,
                structure: r.mechanism,
            }));
    }, [data.relationships.direct]);

    const autoConnections = useMemo(() => {
        return data.relationships.direct.filter(
            r => r.affectedStructures.length === 0 || !r.affectedStructures[0].startsWith('TISSUE:')
        );
    }, [data.relationships.direct]);

    const createCurvedPath = (sx: number, sy: number, tx: number, ty: number, curve: number = 0) => {
        const dx = tx - sx; const dy = ty - sy;
        const mx = (sx + tx) / 2; const my = (sy + ty) / 2;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const offset = curve * 30;
        const cx = mx + (-dy / len * offset);
        const cy = my + (dx / len * offset);
        return { path: `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`, cx, cy };
    };

    const handleNodeClick = (unitId: string) => {
        if (!editable) return;
        if (step === 'select-source') {
            setSource(unitId);
            setStep('select-target');
        } else if (step === 'select-target') {
            if (unitId === source) { cancelConnect(); return; }
            setTarget(unitId);
            setStep('select-structure');
        }
    };

    const cancelConnect = () => {
        setStep('idle'); setSelectedTissue(null); setSource(null); setTarget(null);
    };

    const selectStructure = (structName: string) => {
        if (!onDataChange || !source || !target || !selectedTissue) return;
        const rel: StructuralRelationship = {
            source, target,
            mechanism: structName,
            affectedStructures: [`TISSUE:${selectedTissue}`],
            severity: (data.units[source]?.score || 0) >= 8 ? 'SEVERA' :
                (data.units[source]?.score || 0) >= 5 ? 'MODERADA' : 'LEVE',
            interventionPriority: data.relationships.direct.length + 1,
        };
        onDataChange({
            ...data,
            relationships: { ...data.relationships, direct: [...data.relationships.direct, rel] },
        });
        cancelConnect();
    };

    const removeConnection = (i: number) => {
        if (!onDataChange) return;
        const arr = [...data.relationships.direct]; arr.splice(i, 1);
        onDataChange({ ...data, relationships: { ...data.relationships, direct: arr } });
    };

    const removeIndirectRel = (i: number) => {
        if (!onDataChange) return;
        const arr = [...data.relationships.indirect]; arr.splice(i, 1);
        onDataChange({ ...data, relationships: { ...data.relationships, indirect: arr } });
    };

    const getInstruction = () => {
        if (step === 'select-tissue') return '① Selecione o tipo de tecido';
        if (step === 'select-source') return `② Toque na unidade de ORIGEM`;
        if (step === 'select-target') return `③ Toque na unidade de DESTINO (origem: ${source})`;
        if (step === 'select-structure') return `④ Selecione a estrutura comprometida`;
        return editable ? 'Toque "Conectar" para mapear tecidos comprometidos' : 'Mapa de conexões estruturais';
    };

    return (
        <div className="clinical-card">
            <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-sm">Mapa de Comprometimento</h3>
                {editable && step === 'idle' && (
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                        onClick={() => setStep('select-tissue')}>
                        <Link2 className="h-3 w-3" /> Conectar
                    </Button>
                )}
                {editable && step !== 'idle' && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-red-500" onClick={cancelConnect}>
                        <X className="h-3 w-3" /> Cancelar
                    </Button>
                )}
            </div>

            {/* Instruction bar */}
            <div className={cn(
                'text-[11px] px-3 py-1.5 rounded-lg mb-3 text-center font-medium transition-all',
                step === 'idle' ? 'text-muted-foreground bg-muted/30' :
                    step === 'select-structure' ? 'text-primary bg-primary/10 border border-primary/30' :
                        'text-amber-700 bg-amber-50 border border-amber-200'
            )}>
                {getInstruction()}
            </div>

            {/* ① Tissue type selector — clickable colored buttons */}
            {step === 'select-tissue' && (
                <div className="flex flex-wrap gap-2 justify-center mb-3 animate-slide-in">
                    {TISSUE_TYPES.map(t => (
                        <button key={t.key}
                            onClick={() => { setSelectedTissue(t.key); setStep('select-source'); }}
                            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border-2 transition-all hover:scale-105 active:scale-95 shadow-sm"
                            style={{ borderColor: t.color, backgroundColor: `${t.color}15` }}>
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.color }} />
                            <span className="text-xs font-bold">{t.emoji} {t.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Active tissue indicator */}
            {selectedTissue && step !== 'idle' && step !== 'select-tissue' && (
                <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getTissue(selectedTissue).color }} />
                    <span className="text-xs font-bold" style={{ color: getTissue(selectedTissue).stroke }}>
                        {getTissue(selectedTissue).label}
                    </span>
                </div>
            )}

            {/* ④ Structure selector — all clickable buttons */}
            {step === 'select-structure' && selectedTissue && source && target && (
                <div className="p-3 rounded-xl border mb-3 animate-slide-in"
                    style={{ borderColor: getTissue(selectedTissue).color, backgroundColor: `${getTissue(selectedTissue).color}08` }}>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getTissue(selectedTissue).color }} />
                        <Badge>{source}</Badge> <span className="text-xs">→</span> <Badge>{target}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                        {STRUCTURES[selectedTissue].map(name => (
                            <button key={name}
                                onClick={() => selectStructure(name)}
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all hover:scale-105 active:scale-95"
                                style={{
                                    borderColor: `${getTissue(selectedTissue).color}60`,
                                    color: getTissue(selectedTissue).stroke,
                                    backgroundColor: `${getTissue(selectedTissue).color}10`,
                                }}>
                                {name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* SVG Map */}
            <svg viewBox="0 0 600 540" className="w-full max-w-2xl mx-auto" style={{ minHeight: 340 }}>
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

                {/* Auto connections (faded background) */}
                {autoConnections.map((rel, i) => {
                    const s = NODE_POSITIONS[rel.source]; const t = NODE_POSITIONS[rel.target];
                    if (!s || !t) return null;
                    const { path } = createCurvedPath(s.x, s.y, t.x, t.y, (i % 3) - 1);
                    return <path key={`a-${i}`} d={path} fill="none" stroke="#E5E7EB" strokeWidth={1} strokeDasharray="4,4" markerEnd="url(#arr-auto)" opacity={0.3} />;
                })}

                {/* Tissue connections */}
                {tissueConnections.map((tc, i) => {
                    const s = NODE_POSITIONS[tc.source]; const t = NODE_POSITIONS[tc.target];
                    if (!s || !t) return null;
                    const tissue = getTissue(tc.tissueType);
                    const { path, cx, cy } = createCurvedPath(s.x, s.y, t.x, t.y, (i % 5 - 2) * 0.8);
                    const label = tc.structure.length > 14 ? tc.structure.slice(0, 14) + '…' : tc.structure;
                    const w = Math.max(80, label.length * 6.5);
                    return (
                        <g key={`tc-${i}`}>
                            <path d={path} fill="none" stroke={tissue.color} strokeWidth={3} markerEnd={`url(#arr-${tc.tissueType})`} opacity={0.85} />
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
                    return <path key={`i-${i}`} d={path} fill="none" stroke="#D1D5DB" strokeWidth={1} strokeDasharray="6,4" markerEnd="url(#arr-auto)" opacity={0.4} />;
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
                    const isSelectable = step === 'select-source' || step === 'select-target';
                    const r = isDriver ? 34 : isSource ? 32 : 28;
                    const ringColor = selectedTissue ? getTissue(selectedTissue).color : '#3B82F6';
                    return (
                        <g key={cfg.id} onClick={() => handleNodeClick(cfg.id)}
                            className={isSelectable ? 'cursor-pointer' : ''}>
                            {isSource && (
                                <circle cx={pos.x} cy={pos.y} r={r + 6} fill="none" stroke={ringColor}
                                    strokeWidth={3} strokeDasharray="8,4" opacity={0.9}>
                                    <animate attributeName="stroke-dashoffset" from="0" to="24" dur="1s" repeatCount="indefinite" />
                                </circle>
                            )}
                            {isSelectable && !isSource && (
                                <circle cx={pos.x} cy={pos.y} r={r + 8} fill="transparent" />
                            )}
                            <circle cx={pos.x} cy={pos.y} r={r} fill={color}
                                stroke={isSource ? ringColor : isCritical ? '#EF4444' : 'white'}
                                strokeWidth={isSource ? 4 : isDriver ? 4 : 2}
                                filter={isCritical ? 'url(#glow)' : undefined}
                                opacity={score > 0 ? 1 : isSelectable ? 0.5 : 0.3} />
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

            {/* Tissue Legend */}
            <div className="flex flex-wrap gap-3 justify-center mt-2">
                {TISSUE_TYPES.map(t => (
                    <div key={t.key} className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                        <span className="text-[10px] text-muted-foreground font-medium">{t.label}</span>
                    </div>
                ))}
            </div>

            {/* Connection list */}
            {(tissueConnections.length > 0 || autoConnections.length > 0 || data.relationships.indirect.length > 0) && (
                <div className="mt-3 space-y-1.5">
                    <h4 className="text-xs font-bold">Conexões</h4>
                    {data.relationships.direct.map((rel, i) => {
                        const isTissue = rel.affectedStructures[0]?.startsWith('TISSUE:');
                        const tissueKey = isTissue ? rel.affectedStructures[0].replace('TISSUE:', '') as TissueKey : null;
                        const tissue = tissueKey ? getTissue(tissueKey) : null;
                        return (
                            <div key={`c-${i}`} className="text-[10px] p-2 rounded-lg border flex items-center gap-2"
                                style={{ borderColor: tissue ? `${tissue.color}40` : '#E5E7EB', backgroundColor: tissue ? `${tissue.color}08` : 'transparent' }}>
                                <div className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: tissue?.color || '#D1D5DB' }} />
                                <span className="font-black shrink-0">{rel.source} → {rel.target}</span>
                                <span className="text-muted-foreground flex-1">{rel.mechanism}</span>
                                {tissue && (
                                    <Badge variant="outline" className="text-[8px] shrink-0"
                                        style={{ borderColor: tissue.color, color: tissue.stroke }}>
                                        {tissue.label}
                                    </Badge>
                                )}
                                {editable && (
                                    <button onClick={() => removeConnection(i)} className="shrink-0 text-red-400 hover:text-red-600">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    {data.relationships.indirect.map((rel, i) => (
                        <div key={`i-${i}`} className="text-[10px] p-2 rounded-lg border border-dashed bg-muted/10 flex items-center gap-2">
                            <span className="font-black text-muted-foreground shrink-0">
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
