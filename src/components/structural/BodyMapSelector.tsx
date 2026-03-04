import { useState } from 'react';
import { cn } from '@/lib/utils';
import { UNIT_CONFIGS, classifyScore, classifyScoreColor, type UnitAssessment } from '@/types/structural';

interface Props {
    units: Record<string, UnitAssessment>;
    activeUnitId?: string;
    onSelectUnit: (unitId: string) => void;
}

const UNIT_COLORS: Record<string, { base: string; hover: string; active: string }> = {
    'UC-1': { base: '#87CEEB', hover: '#6BB8D9', active: '#4AA3C7' },
    'UC-2': { base: '#FFFACD', hover: '#F5EFB3', active: '#EBE49A' },
    'UC-3': { base: '#FFD580', hover: '#F5C466', active: '#EBB34D' },
    'UC-4': { base: '#E6D5F5', hover: '#D4BFE8', active: '#C2A9DB' },
    'UA-1': { base: '#90EE90', hover: '#70DE70', active: '#50CE50' },
    'UA-2': { base: '#90EE90', hover: '#70DE70', active: '#50CE50' },
    'UA-3': { base: '#FFA07A', hover: '#F08A64', active: '#E0744E' },
    'UA-4': { base: '#FFA07A', hover: '#F08A64', active: '#E0744E' },
};

function getSeverityColor(score: number): string {
    if (score >= 8) return '#22C55E';
    if (score >= 6) return '#F59E0B';
    if (score >= 4) return '#F97316';
    return '#EF4444';
}

export default function BodyMapSelector({ units, activeUnitId, onSelectUnit }: Props) {
    const [hovered, setHovered] = useState<string | null>(null);

    const getZoneFill = (unitId: string) => {
        const score = units[unitId]?.score;
        const hasScore = score !== undefined && score > 0;
        const colors = UNIT_COLORS[unitId];

        if (hasScore) return getSeverityColor(score);
        if (unitId === activeUnitId) return colors.active;
        if (unitId === hovered) return colors.hover;
        return colors.base;
    };

    const getZoneOpacity = (unitId: string) => {
        if (!activeUnitId && !hovered) return 1;
        if (unitId === activeUnitId || unitId === hovered) return 1;
        return 0.4;
    };

    const cfg = (id: string) => UNIT_CONFIGS.find(c => c.id === id);

    return (
        <div className="clinical-card">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-bold text-foreground">Mapa Corporal</span>
                <span className="text-[10px] text-muted-foreground">Toque para navegar</span>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 items-center">
                {/* SVG Body Map */}
                <div className="relative flex-shrink-0">
                    <svg
                        viewBox="0 0 300 520"
                        width="240"
                        height="416"
                        className="drop-shadow-sm"
                    >
                        {/* UC-1: Head & Neck */}
                        <g
                            onClick={() => onSelectUnit('UC-1')}
                            onMouseEnter={() => setHovered('UC-1')}
                            onMouseLeave={() => setHovered(null)}
                            className="cursor-pointer"
                            style={{ transition: 'all 0.2s ease' }}
                        >
                            {/* Head */}
                            <ellipse cx="150" cy="42" rx="30" ry="36"
                                fill={getZoneFill('UC-1')} opacity={getZoneOpacity('UC-1')}
                                stroke={activeUnitId === 'UC-1' ? '#0ea5e9' : 'rgba(0,0,0,0.15)'}
                                strokeWidth={activeUnitId === 'UC-1' ? 2.5 : 1} />
                            {/* Neck */}
                            <rect x="138" y="74" width="24" height="22" rx="6"
                                fill={getZoneFill('UC-1')} opacity={getZoneOpacity('UC-1')}
                                stroke={activeUnitId === 'UC-1' ? '#0ea5e9' : 'rgba(0,0,0,0.15)'}
                                strokeWidth={activeUnitId === 'UC-1' ? 2.5 : 1} />
                        </g>

                        {/* UC-2: Thorax / Chest */}
                        <g
                            onClick={() => onSelectUnit('UC-2')}
                            onMouseEnter={() => setHovered('UC-2')}
                            onMouseLeave={() => setHovered(null)}
                            className="cursor-pointer"
                        >
                            <path
                                d="M 104 96 Q 100 100 98 120 L 98 210 Q 100 212 150 214 Q 200 212 202 210 L 202 120 Q 200 100 196 96 Z"
                                fill={getZoneFill('UC-2')} opacity={getZoneOpacity('UC-2')}
                                stroke={activeUnitId === 'UC-2' ? '#0ea5e9' : 'rgba(0,0,0,0.15)'}
                                strokeWidth={activeUnitId === 'UC-2' ? 2.5 : 1} />
                        </g>

                        {/* UC-3: Abdomen / Lumbar */}
                        <g
                            onClick={() => onSelectUnit('UC-3')}
                            onMouseEnter={() => setHovered('UC-3')}
                            onMouseLeave={() => setHovered(null)}
                            className="cursor-pointer"
                        >
                            <path
                                d="M 98 214 Q 100 216 150 218 Q 200 216 202 214 L 202 280 Q 200 282 150 284 Q 100 282 98 280 Z"
                                fill={getZoneFill('UC-3')} opacity={getZoneOpacity('UC-3')}
                                stroke={activeUnitId === 'UC-3' ? '#0ea5e9' : 'rgba(0,0,0,0.15)'}
                                strokeWidth={activeUnitId === 'UC-3' ? 2.5 : 1} />
                        </g>

                        {/* UC-4: Pelvis / Sacrum */}
                        <g
                            onClick={() => onSelectUnit('UC-4')}
                            onMouseEnter={() => setHovered('UC-4')}
                            onMouseLeave={() => setHovered(null)}
                            className="cursor-pointer"
                        >
                            <path
                                d="M 98 284 Q 100 286 150 288 Q 200 286 202 284 L 200 330 Q 190 345 170 348 L 150 350 L 130 348 Q 110 345 100 330 Z"
                                fill={getZoneFill('UC-4')} opacity={getZoneOpacity('UC-4')}
                                stroke={activeUnitId === 'UC-4' ? '#0ea5e9' : 'rgba(0,0,0,0.15)'}
                                strokeWidth={activeUnitId === 'UC-4' ? 2.5 : 1} />
                        </g>

                        {/* UA-1: Right Arm (viewer left) */}
                        <g
                            onClick={() => onSelectUnit('UA-1')}
                            onMouseEnter={() => setHovered('UA-1')}
                            onMouseLeave={() => setHovered(null)}
                            className="cursor-pointer"
                        >
                            {/* Shoulder + Upper arm */}
                            <path
                                d="M 100 96 Q 80 100 68 120 L 56 186 Q 54 194 58 196 L 68 196 Q 72 194 74 186 L 80 138 Q 82 126 86 120 L 96 108 Z"
                                fill={getZoneFill('UA-1')} opacity={getZoneOpacity('UA-1')}
                                stroke={activeUnitId === 'UA-1' ? '#0ea5e9' : 'rgba(0,0,0,0.15)'}
                                strokeWidth={activeUnitId === 'UA-1' ? 2.5 : 1} />
                            {/* Forearm + hand */}
                            <path
                                d="M 56 196 L 44 268 Q 38 282 34 294 Q 32 300 36 302 L 48 300 Q 54 290 56 282 L 68 196 Z"
                                fill={getZoneFill('UA-1')} opacity={getZoneOpacity('UA-1')}
                                stroke={activeUnitId === 'UA-1' ? '#0ea5e9' : 'rgba(0,0,0,0.15)'}
                                strokeWidth={activeUnitId === 'UA-1' ? 2.5 : 1} />
                        </g>

                        {/* UA-2: Left Arm (viewer right) */}
                        <g
                            onClick={() => onSelectUnit('UA-2')}
                            onMouseEnter={() => setHovered('UA-2')}
                            onMouseLeave={() => setHovered(null)}
                            className="cursor-pointer"
                        >
                            <path
                                d="M 200 96 Q 220 100 232 120 L 244 186 Q 246 194 242 196 L 232 196 Q 228 194 226 186 L 220 138 Q 218 126 214 120 L 204 108 Z"
                                fill={getZoneFill('UA-2')} opacity={getZoneOpacity('UA-2')}
                                stroke={activeUnitId === 'UA-2' ? '#0ea5e9' : 'rgba(0,0,0,0.15)'}
                                strokeWidth={activeUnitId === 'UA-2' ? 2.5 : 1} />
                            <path
                                d="M 244 196 L 256 268 Q 262 282 266 294 Q 268 300 264 302 L 252 300 Q 246 290 244 282 L 232 196 Z"
                                fill={getZoneFill('UA-2')} opacity={getZoneOpacity('UA-2')}
                                stroke={activeUnitId === 'UA-2' ? '#0ea5e9' : 'rgba(0,0,0,0.15)'}
                                strokeWidth={activeUnitId === 'UA-2' ? 2.5 : 1} />
                        </g>

                        {/* UA-3: Right Leg (viewer left) */}
                        <g
                            onClick={() => onSelectUnit('UA-3')}
                            onMouseEnter={() => setHovered('UA-3')}
                            onMouseLeave={() => setHovered(null)}
                            className="cursor-pointer"
                        >
                            <path
                                d="M 102 334 Q 108 345 126 348 L 148 350 L 146 400 L 140 460 Q 138 480 134 498 Q 132 510 128 514 L 116 514 Q 114 510 116 498 L 120 460 L 112 400 Q 106 370 100 350 Z"
                                fill={getZoneFill('UA-3')} opacity={getZoneOpacity('UA-3')}
                                stroke={activeUnitId === 'UA-3' ? '#0ea5e9' : 'rgba(0,0,0,0.15)'}
                                strokeWidth={activeUnitId === 'UA-3' ? 2.5 : 1} />
                        </g>

                        {/* UA-4: Left Leg (viewer right) */}
                        <g
                            onClick={() => onSelectUnit('UA-4')}
                            onMouseEnter={() => setHovered('UA-4')}
                            onMouseLeave={() => setHovered(null)}
                            className="cursor-pointer"
                        >
                            <path
                                d="M 198 334 Q 192 345 174 348 L 152 350 L 154 400 L 160 460 Q 162 480 166 498 Q 168 510 172 514 L 184 514 Q 186 510 184 498 L 180 460 L 188 400 Q 194 370 200 350 Z"
                                fill={getZoneFill('UA-4')} opacity={getZoneOpacity('UA-4')}
                                stroke={activeUnitId === 'UA-4' ? '#0ea5e9' : 'rgba(0,0,0,0.15)'}
                                strokeWidth={activeUnitId === 'UA-4' ? 2.5 : 1} />
                        </g>
                    </svg>

                    {/* Floating Labels */}
                    {(['UC-1', 'UA-1', 'UA-2', 'UC-2', 'UC-3', 'UC-4', 'UA-3', 'UA-4'] as const).map(id => {
                        const unit = units[id];
                        const config = cfg(id);
                        if (!config) return null;
                        const hasScore = unit?.score > 0;
                        const isActive = activeUnitId === id;
                        const isHovered = hovered === id;

                        const positions: Record<string, { top: string; left?: string; right?: string; textAlign?: string }> = {
                            'UC-1': { top: '0%', right: '-4px', textAlign: 'right' },
                            'UA-1': { top: '20%', left: '-8px' },
                            'UA-2': { top: '20%', right: '-8px', textAlign: 'right' },
                            'UC-2': { top: '32%', right: '-4px', textAlign: 'right' },
                            'UC-3': { top: '48%', right: '-4px', textAlign: 'right' },
                            'UC-4': { top: '60%', left: '-8px' },
                            'UA-3': { top: '82%', left: '-8px' },
                            'UA-4': { top: '82%', right: '-8px', textAlign: 'right' },
                        };

                        const pos = positions[id];

                        return (
                            <button
                                key={id}
                                onClick={() => onSelectUnit(id)}
                                onMouseEnter={() => setHovered(id)}
                                onMouseLeave={() => setHovered(null)}
                                className={cn(
                                    'absolute px-2 py-1 rounded-md text-left transition-all duration-200 whitespace-nowrap border',
                                    isActive
                                        ? 'bg-primary/10 border-primary shadow-md scale-105'
                                        : isHovered
                                            ? 'bg-background border-primary/40 shadow-sm scale-102'
                                            : 'bg-background/80 border-border hover:border-primary/30',
                                )}
                                style={{
                                    top: pos.top,
                                    ...(pos.left ? { left: pos.left } : {}),
                                    ...(pos.right ? { right: pos.right } : {}),
                                    textAlign: (pos.textAlign as any) || 'left',
                                }}
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-bold text-foreground">{config.emoji} {id}</span>
                                    {hasScore && (
                                        <span className={cn('text-[10px] font-black', classifyScoreColor(unit.score))}>
                                            {unit.score.toFixed(1)}
                                        </span>
                                    )}
                                </div>
                                <div className="text-[9px] text-muted-foreground leading-tight">{config.shortName}</div>
                            </button>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex lg:flex-col gap-2 flex-wrap justify-center">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 hidden lg:block">Severidade</div>
                    {[
                        { label: 'Excelente', color: '#22C55E', range: '8-10' },
                        { label: 'Moderado', color: '#F59E0B', range: '6-8' },
                        { label: 'Alerta', color: '#F97316', range: '4-6' },
                        { label: 'Crítico', color: '#EF4444', range: '0-4' },
                    ].map(item => (
                        <div key={item.label} className="flex items-center gap-1.5">
                            <div className="h-3 w-3 rounded-sm border" style={{ backgroundColor: item.color }} />
                            <span className="text-[10px] text-muted-foreground">{item.label} ({item.range})</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
