// Reusable anatomical body avatar SVG — front + back view
// Front and back are INDEPENDENT — each has its own clickable regions

interface Region {
  id: string;
  nome: string;
  cx?: number;
  cy?: number;
  r?: number;
  type?: 'circle' | 'path';
}

// Front-only regions
export const REGIOES_FRENTE: Region[] = [
  { id: 'cabeca_f', nome: 'Cabeça (Ant)', type: 'circle', cx: 100, cy: 30, r: 18 },
  { id: 'pescoco_f', nome: 'Pescoço (Ant)', type: 'circle', cx: 100, cy: 58, r: 7 },
  { id: 'ombroDireito_f', nome: 'Ombro Dir (Ant)', type: 'circle', cx: 68, cy: 82, r: 10 },
  { id: 'ombroEsquerdo_f', nome: 'Ombro Esq (Ant)', type: 'circle', cx: 132, cy: 82, r: 10 },
  { id: 'colunaToracica_f', nome: 'Tórax Ant', type: 'circle', cx: 100, cy: 110, r: 14 },
  { id: 'abdomen_f', nome: 'Abdômen', type: 'circle', cx: 100, cy: 150, r: 14 },
  { id: 'colunaLombar_f', nome: 'Lombar (Ant)', type: 'circle', cx: 100, cy: 182, r: 12 },
  { id: 'sacroPelvica_f', nome: 'Pélvica (Ant)', type: 'circle', cx: 100, cy: 210, r: 12 },
  { id: 'bracoDireito_f', nome: 'Braço Dir (Ant)', type: 'circle', cx: 52, cy: 118, r: 9 },
  { id: 'cotoveloAntebracoDireito_f', nome: 'Cotovelo/Ant.braço D (Ant)', type: 'circle', cx: 42, cy: 155, r: 9 },
  { id: 'maoDireita_f', nome: 'Mão Dir (Ant)', type: 'circle', cx: 34, cy: 195, r: 7 },
  { id: 'bracoEsquerdo_f', nome: 'Braço Esq (Ant)', type: 'circle', cx: 148, cy: 118, r: 9 },
  { id: 'cotoveloAntebracoEsquerdo_f', nome: 'Cotovelo/Ant.braço E (Ant)', type: 'circle', cx: 158, cy: 155, r: 9 },
  { id: 'maoEsquerda_f', nome: 'Mão Esq (Ant)', type: 'circle', cx: 166, cy: 195, r: 7 },
  { id: 'coxaDireita_f', nome: 'Coxa Dir (Ant)', type: 'circle', cx: 86, cy: 260, r: 12 },
  { id: 'coxaEsquerda_f', nome: 'Coxa Esq (Ant)', type: 'circle', cx: 114, cy: 260, r: 12 },
  { id: 'joelhoDireito_f', nome: 'Joelho Dir (Ant)', type: 'circle', cx: 84, cy: 305, r: 9 },
  { id: 'joelhoEsquerdo_f', nome: 'Joelho Esq (Ant)', type: 'circle', cx: 116, cy: 305, r: 9 },
  { id: 'pernaDireita_f', nome: 'Perna Dir (Ant)', type: 'circle', cx: 82, cy: 345, r: 9 },
  { id: 'pernaEsquerda_f', nome: 'Perna Esq (Ant)', type: 'circle', cx: 118, cy: 345, r: 9 },
  { id: 'peDireito_f', nome: 'Pé Dir (Ant)', type: 'circle', cx: 80, cy: 382, r: 7 },
  { id: 'peEsquerdo_f', nome: 'Pé Esq (Ant)', type: 'circle', cx: 120, cy: 382, r: 7 },
];

// Back-only regions
export const REGIOES_COSTAS: Region[] = [
  { id: 'cabeca_b', nome: 'Cabeça (Post)', type: 'circle', cx: 100, cy: 30, r: 18 },
  { id: 'pescoco_b', nome: 'Pescoço (Post)', type: 'circle', cx: 100, cy: 58, r: 7 },
  { id: 'ombroDireito_b', nome: 'Ombro Dir (Post)', type: 'circle', cx: 68, cy: 82, r: 10 },
  { id: 'ombroEsquerdo_b', nome: 'Ombro Esq (Post)', type: 'circle', cx: 132, cy: 82, r: 10 },
  { id: 'colunaToracica_b', nome: 'Torácica (Post)', type: 'circle', cx: 100, cy: 110, r: 14 },
  { id: 'escapulaDireita_b', nome: 'Escápula Dir', type: 'circle', cx: 80, cy: 98, r: 9 },
  { id: 'escapulaEsquerda_b', nome: 'Escápula Esq', type: 'circle', cx: 120, cy: 98, r: 9 },
  { id: 'colunaLombar_b', nome: 'Lombar (Post)', type: 'circle', cx: 100, cy: 158, r: 14 },
  { id: 'sacroPelvica_b', nome: 'Sacro-Pélvica (Post)', type: 'circle', cx: 100, cy: 198, r: 12 },
  { id: 'gluteoDireito_b', nome: 'Glúteo Dir', type: 'circle', cx: 84, cy: 225, r: 11 },
  { id: 'gluteoEsquerdo_b', nome: 'Glúteo Esq', type: 'circle', cx: 116, cy: 225, r: 11 },
  { id: 'bracoDireito_b', nome: 'Braço Dir (Post)', type: 'circle', cx: 52, cy: 118, r: 9 },
  { id: 'cotoveloAntebracoDireito_b', nome: 'Cotovelo D (Post)', type: 'circle', cx: 42, cy: 155, r: 9 },
  { id: 'bracoEsquerdo_b', nome: 'Braço Esq (Post)', type: 'circle', cx: 148, cy: 118, r: 9 },
  { id: 'cotoveloAntebracoEsquerdo_b', nome: 'Cotovelo E (Post)', type: 'circle', cx: 158, cy: 155, r: 9 },
  { id: 'coxaDireita_b', nome: 'Coxa Dir (Post)', type: 'circle', cx: 86, cy: 260, r: 12 },
  { id: 'coxaEsquerda_b', nome: 'Coxa Esq (Post)', type: 'circle', cx: 114, cy: 260, r: 12 },
  { id: 'joelhoDireito_b', nome: 'Joelho Dir (Post)', type: 'circle', cx: 84, cy: 305, r: 9 },
  { id: 'joelhoEsquerdo_b', nome: 'Joelho Esq (Post)', type: 'circle', cx: 116, cy: 305, r: 9 },
  { id: 'panturrilhaDireita_b', nome: 'Panturrilha Dir', type: 'circle', cx: 82, cy: 345, r: 9 },
  { id: 'panturrilhaEsquerda_b', nome: 'Panturrilha Esq', type: 'circle', cx: 118, cy: 345, r: 9 },
  { id: 'calcanharDireito_b', nome: 'Calcanhar Dir', type: 'circle', cx: 80, cy: 382, r: 7 },
  { id: 'calcanharEsquerdo_b', nome: 'Calcanhar Esq', type: 'circle', cx: 120, cy: 382, r: 7 },
];

// Backward-compatible unified list
export const REGIOES_CORPO: Region[] = [
  { id: 'cabeca', nome: 'Cabeça', type: 'circle', cx: 100, cy: 30, r: 18 },
  { id: 'pescoco', nome: 'Pescoço', type: 'circle', cx: 100, cy: 58, r: 7 },
  { id: 'ombroDireito', nome: 'Ombro Direito', type: 'circle', cx: 68, cy: 82, r: 10 },
  { id: 'ombroEsquerdo', nome: 'Ombro Esquerdo', type: 'circle', cx: 132, cy: 82, r: 10 },
  { id: 'colunaToracica', nome: 'Coluna Torácica', type: 'circle', cx: 100, cy: 110, r: 14 },
  { id: 'abdomen', nome: 'Abdômen', type: 'circle', cx: 100, cy: 150, r: 14 },
  { id: 'colunaLombar', nome: 'Coluna Lombar', type: 'circle', cx: 100, cy: 182, r: 12 },
  { id: 'sacroPelvica', nome: 'Sacro-Pélvica', type: 'circle', cx: 100, cy: 210, r: 12 },
  { id: 'bracoDireito', nome: 'Braço Direito', type: 'circle', cx: 52, cy: 118, r: 9 },
  { id: 'cotoveloAntebracoDireito', nome: 'Cotovelo/Antebraço D', type: 'circle', cx: 42, cy: 155, r: 9 },
  { id: 'maoDireita', nome: 'Mão Direita', type: 'circle', cx: 34, cy: 195, r: 7 },
  { id: 'bracoEsquerdo', nome: 'Braço Esquerdo', type: 'circle', cx: 148, cy: 118, r: 9 },
  { id: 'cotoveloAntebracoEsquerdo', nome: 'Cotovelo/Antebraço E', type: 'circle', cx: 158, cy: 155, r: 9 },
  { id: 'maoEsquerda', nome: 'Mão Esquerda', type: 'circle', cx: 166, cy: 195, r: 7 },
  { id: 'coxaDireita', nome: 'Coxa Direita', type: 'circle', cx: 86, cy: 260, r: 12 },
  { id: 'coxaEsquerda', nome: 'Coxa Esquerda', type: 'circle', cx: 114, cy: 260, r: 12 },
  { id: 'joelhoDireito', nome: 'Joelho Direito', type: 'circle', cx: 84, cy: 305, r: 9 },
  { id: 'joelhoEsquerdo', nome: 'Joelho Esquerdo', type: 'circle', cx: 116, cy: 305, r: 9 },
  { id: 'pernaDireita', nome: 'Perna Direita', type: 'circle', cx: 82, cy: 345, r: 9 },
  { id: 'pernaEsquerda', nome: 'Perna Esquerda', type: 'circle', cx: 118, cy: 345, r: 9 },
  { id: 'peDireito', nome: 'Pé Direito', type: 'circle', cx: 80, cy: 382, r: 7 },
  { id: 'peEsquerdo', nome: 'Pé Esquerdo', type: 'circle', cx: 120, cy: 382, r: 7 },
];

// Map UC unit IDs to region IDs for Bloco6
export const UC_TO_REGIONS: Record<string, string[]> = {
  'UC1': ['cabeca', 'pescoco'],
  'UC2': ['colunaToracica'],
  'UC3': ['abdomen', 'colunaLombar'],
  'UC4': ['sacroPelvica'],
  'UA-D': ['ombroDireito', 'bracoDireito', 'cotoveloAntebracoDireito', 'maoDireita'],
  'UA-E': ['ombroEsquerdo', 'bracoEsquerdo', 'cotoveloAntebracoEsquerdo', 'maoEsquerda'],
  'ID': ['coxaDireita', 'joelhoDireito', 'pernaDireita', 'peDireito'],
  'DD': ['coxaEsquerda', 'joelhoEsquerdo', 'pernaEsquerda', 'peEsquerdo'],
};

function getBaseRegionId(regionId: string): string {
  return regionId.replace(/_[fb]$/, '');
}

interface BodyAvatarProps {
  painMap?: Record<string, number>;
  sintomaMap?: Record<string, string[]>; // regionId -> array of sintoma types
  ucScoreMap?: Record<string, number>;
  highlightedUC?: string | null;
  onRegionClick?: (regionId: string) => void;
  mode?: 'pain' | 'structural';
  className?: string;
  showBack?: boolean;
}

function getRegionColor(intensity: number): string {
  if (intensity <= 0) return 'transparent';
  if (intensity <= 3) return '#fef3c7';
  if (intensity <= 5) return '#fbbf24';
  if (intensity <= 7) return '#f97316';
  return '#ef4444';
}

// Sintoma-specific colors for gradient overlay
const SINTOMA_CORES: Record<string, string> = {
  dor: '#C41E3A',
  irradiacao: '#F97316',
  rigidez: '#3B82F6',
  formigamento: '#FBBF24',
  inchaco: '#10B981',
  queimacao: '#DC2626',
};

/* ── Improved anatomical body silhouette ──────────────────────── */
function BodyOutline({ side }: { side: 'front' | 'back' }) {
  return (
    <g>
      {/* Head */}
      <ellipse cx="100" cy="28" rx="16" ry="19" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1.2" opacity="0.35" />
      {/* Ear hints */}
      <ellipse cx="83" cy="28" rx="3" ry="6" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.6" opacity="0.2" />
      <ellipse cx="117" cy="28" rx="3" ry="6" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.6" opacity="0.2" />
      {/* Neck */}
      <path d="M92 46 Q92 42 94 40 L100 38 L106 40 Q108 42 108 46 L108 62 Q108 66 106 68 L94 68 Q92 66 92 62 Z"
        fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1" opacity="0.3" />
      {/* Shoulders + Torso */}
      <path d="M94 68 Q80 70 68 76 Q58 82 56 90 L50 108
               Q46 120 42 140 L38 160 Q36 170 34 182 Q32 192 32 198
               M106 68 Q120 70 132 76 Q142 82 144 90 L150 108
               Q154 120 158 140 L162 160 Q164 170 166 182 Q168 192 168 198"
        fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1" opacity="0.3" />
      {/* Torso outline */}
      <path d="M68 76 Q66 80 66 90 L64 140 Q64 160 66 178 Q68 195 72 208
               Q78 225 84 235 L100 240 L116 235
               Q122 225 128 208 Q132 195 134 178 Q136 160 136 140 L134 90 Q134 80 132 76"
        fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1.2" opacity="0.3" />
      {/* Legs */}
      <path d="M84 235 Q80 248 80 258 L78 290 Q78 300 80 310 L80 340 Q80 360 80 375 Q80 385 80 390"
        fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1.2" opacity="0.3" />
      <path d="M116 235 Q120 248 120 258 L122 290 Q122 300 120 310 L120 340 Q120 360 120 375 Q120 385 120 390"
        fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1.2" opacity="0.3" />
      {/* Leg inner lines */}
      <path d="M92 235 Q90 248 90 258 L90 290 Q90 300 88 310 L88 340 Q88 360 88 375 Q88 385 88 390"
        fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" opacity="0.2" />
      <path d="M108 235 Q110 248 110 258 L110 290 Q110 300 112 310 L112 340 Q112 360 112 375 Q112 385 112 390"
        fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" opacity="0.2" />
      {/* Feet */}
      <ellipse cx="80" cy="392" rx="10" ry="5" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" opacity="0.25" />
      <ellipse cx="120" cy="392" rx="10" ry="5" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" opacity="0.25" />
      {/* Hands */}
      <ellipse cx="34" cy="197" rx="6" ry="8" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" opacity="0.25" />
      <ellipse cx="166" cy="197" rx="6" ry="8" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.8" opacity="0.25" />

      {/* Anatomical guidelines */}
      {side === 'front' && (
        <g opacity="0.12">
          {/* Chest line */}
          <line x1="75" y1="90" x2="125" y2="90" stroke="hsl(var(--muted-foreground))" strokeWidth="0.4" strokeDasharray="2,3" />
          {/* Waist */}
          <line x1="72" y1="170" x2="128" y2="170" stroke="hsl(var(--muted-foreground))" strokeWidth="0.4" strokeDasharray="2,3" />
          {/* Hip */}
          <line x1="74" y1="205" x2="126" y2="205" stroke="hsl(var(--muted-foreground))" strokeWidth="0.4" strokeDasharray="2,3" />
          {/* Midline */}
          <line x1="100" y1="46" x2="100" y2="240" stroke="hsl(var(--muted-foreground))" strokeWidth="0.3" strokeDasharray="1,4" />
          {/* Navel */}
          <circle cx="100" cy="152" r="2" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.4" />
        </g>
      )}

      {side === 'back' && (
        <g opacity="0.12">
          {/* Spine */}
          <line x1="100" y1="48" x2="100" y2="210" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" strokeDasharray="2,3" />
          {/* Scapulae outlines */}
          <path d="M78 88 Q74 94 76 104 Q80 110 86 108 Q90 104 88 94 Q86 88 78 88" 
            fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />
          <path d="M122 88 Q126 94 124 104 Q120 110 114 108 Q110 104 112 94 Q114 88 122 88" 
            fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.5" />
          {/* Gluteal crease */}
          <path d="M88 218 Q100 225 112 218" fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="0.4" />
        </g>
      )}
    </g>
  );
}

/* ── Single body figure ────────────────────────────────────── */
function BodyFigure({
  side,
  offsetX,
  painMap,
  sintomaMap,
  ucScoreMap,
  highlightedUC,
  onRegionClick,
  mode,
}: {
  side: 'front' | 'back';
  offsetX: number;
  painMap: Record<string, number>;
  sintomaMap: Record<string, string[]>;
  ucScoreMap: Record<string, number>;
  highlightedUC: string | null;
  onRegionClick?: (regionId: string) => void;
  mode: 'pain' | 'structural';
}) {
  const regions = side === 'front' ? REGIOES_FRENTE : REGIOES_COSTAS;

  const getColor = (regionId: string): string => {
    if (mode === 'pain') {
      const intensity = painMap[regionId] ?? painMap[getBaseRegionId(regionId)] ?? 0;
      // If has specific sintomas, use sintoma color blending
      const sintomas = sintomaMap[regionId] || sintomaMap[getBaseRegionId(regionId)] || [];
      if (sintomas.length > 0 && intensity > 0) {
        // Use the primary sintoma color with opacity based on intensity
        const primarySintoma = sintomas[0];
        return SINTOMA_CORES[primarySintoma] || getRegionColor(intensity);
      }
      return getRegionColor(intensity);
    }
    const baseId = getBaseRegionId(regionId);
    for (const [ucId, ucRegions] of Object.entries(UC_TO_REGIONS)) {
      if (ucRegions.some(r => baseId.startsWith(r.replace(/_[fb]$/, '')) || r === baseId)) {
        if (highlightedUC === ucId) return '#7c3aed';
        return getRegionColor(ucScoreMap[ucId] ?? 0);
      }
    }
    return 'transparent';
  };

  const getOpacity = (regionId: string): number => {
    if (mode === 'pain') {
      const intensity = painMap[regionId] ?? painMap[getBaseRegionId(regionId)] ?? 0;
      if (intensity <= 0) return 0.15;
      return 0.3 + (intensity / 10) * 0.5;
    }
    return 0.6;
  };

  return (
    <g transform={`translate(${offsetX}, 0)`}>
      <BodyOutline side={side} />

      {/* Clickable region zones */}
      {regions.map(regiao => {
        const color = getColor(regiao.id);
        const opacity = getOpacity(regiao.id);
        const hasData = (painMap[regiao.id] ?? painMap[getBaseRegionId(regiao.id)] ?? 0) > 0 ||
          (sintomaMap[regiao.id] || sintomaMap[getBaseRegionId(regiao.id)] || []).length > 0;
        const sintomas = sintomaMap[regiao.id] || sintomaMap[getBaseRegionId(regiao.id)] || [];

        return (
          <g key={regiao.id} onClick={() => onRegionClick?.(regiao.id)} style={{ cursor: onRegionClick ? 'pointer' : 'default' }}>
            {/* Glow effect for active regions */}
            {hasData && (
              <circle
                cx={regiao.cx}
                cy={regiao.cy}
                r={(regiao.r || 10) + 3}
                fill={color}
                opacity={0.15}
                className="animate-pulse"
              />
            )}
            {/* Main circle */}
            <circle
              cx={regiao.cx}
              cy={regiao.cy}
              r={regiao.r}
              fill={color}
              stroke={hasData ? color : 'hsl(var(--border))'}
              strokeWidth={hasData ? 1.5 : 0.6}
              opacity={opacity}
              className="transition-all duration-200 hover:opacity-90"
            />
            {/* Multi-sintoma indicator dots */}
            {sintomas.length > 1 && sintomas.slice(0, 3).map((s, i) => (
              <circle
                key={s}
                cx={(regiao.cx || 0) + (i - 1) * 5}
                cy={(regiao.cy || 0) + (regiao.r || 10) + 5}
                r={2}
                fill={SINTOMA_CORES[s] || '#888'}
                opacity={0.9}
              />
            ))}
          </g>
        );
      })}

      {/* Label */}
      <text x="100" y="408" textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))" fontWeight="600" letterSpacing="0.5">
        {side === 'front' ? 'ANTERIOR' : 'POSTERIOR'}
      </text>
    </g>
  );
}

export function BodyAvatarSVG({
  painMap = {},
  sintomaMap = {},
  ucScoreMap = {},
  highlightedUC = null,
  onRegionClick,
  mode = 'pain',
  className = '',
  showBack = false,
}: BodyAvatarProps) {
  const width = showBack ? 420 : 200;

  return (
    <svg
      viewBox={`0 0 ${width} 420`}
      className={`w-full h-auto ${className}`}
      style={{ maxHeight: showBack ? 480 : 400 }}
    >
      <BodyFigure
        side="front"
        offsetX={0}
        painMap={painMap}
        sintomaMap={sintomaMap}
        ucScoreMap={ucScoreMap}
        highlightedUC={highlightedUC}
        onRegionClick={onRegionClick}
        mode={mode}
      />
      {showBack && (
        <BodyFigure
          side="back"
          offsetX={220}
          painMap={painMap}
          sintomaMap={sintomaMap}
          ucScoreMap={ucScoreMap}
          highlightedUC={highlightedUC}
          onRegionClick={onRegionClick}
          mode={mode}
        />
      )}
    </svg>
  );
}
