// Reusable anatomical body avatar SVG — front + back view
// Used in Bloco2Dor and Bloco6Estrutural

interface Region {
  id: string;
  nome: string;
  cx?: number;
  cy?: number;
  r?: number;
  type?: 'circle' | 'path';
}

// Complete body regions including all limbs
export const REGIOES_CORPO: Region[] = [
  { id: 'cabeca', nome: 'Cabeça', type: 'circle', cx: 100, cy: 32, r: 20 },
  { id: 'pescoco', nome: 'Pescoço', type: 'circle', cx: 100, cy: 60, r: 8 },
  { id: 'ombroDireito', nome: 'Ombro Direito', type: 'circle', cx: 66, cy: 84, r: 12 },
  { id: 'ombroEsquerdo', nome: 'Ombro Esquerdo', type: 'circle', cx: 134, cy: 84, r: 12 },
  { id: 'colunaToracica', nome: 'Coluna Torácica', type: 'circle', cx: 100, cy: 115, r: 16 },
  { id: 'abdomen', nome: 'Abdômen', type: 'circle', cx: 100, cy: 155, r: 16 },
  { id: 'colunaLombar', nome: 'Coluna Lombar', type: 'circle', cx: 100, cy: 188, r: 14 },
  { id: 'sacroPelvica', nome: 'Sacro-Pélvica', type: 'circle', cx: 100, cy: 218, r: 14 },
  { id: 'bracoDireito', nome: 'Braço Direito', type: 'circle', cx: 48, cy: 122, r: 10 },
  { id: 'cotoveloAntebracoDireito', nome: 'Cotovelo/Antebraço D', type: 'circle', cx: 38, cy: 162, r: 10 },
  { id: 'maoDireita', nome: 'Mão Direita', type: 'circle', cx: 30, cy: 202, r: 8 },
  { id: 'bracoEsquerdo', nome: 'Braço Esquerdo', type: 'circle', cx: 152, cy: 122, r: 10 },
  { id: 'cotoveloAntebracoEsquerdo', nome: 'Cotovelo/Antebraço E', type: 'circle', cx: 162, cy: 162, r: 10 },
  { id: 'maoEsquerda', nome: 'Mão Esquerda', type: 'circle', cx: 170, cy: 202, r: 8 },
  { id: 'coxaDireita', nome: 'Coxa Direita', type: 'circle', cx: 84, cy: 270, r: 14 },
  { id: 'coxaEsquerda', nome: 'Coxa Esquerda', type: 'circle', cx: 116, cy: 270, r: 14 },
  { id: 'joelhoDireito', nome: 'Joelho Direito', type: 'circle', cx: 82, cy: 315, r: 10 },
  { id: 'joelhoEsquerdo', nome: 'Joelho Esquerdo', type: 'circle', cx: 118, cy: 315, r: 10 },
  { id: 'pernaDireita', nome: 'Perna Direita', type: 'circle', cx: 80, cy: 355, r: 10 },
  { id: 'pernaEsquerda', nome: 'Perna Esquerda', type: 'circle', cx: 120, cy: 355, r: 10 },
  { id: 'peDireito', nome: 'Pé Direito', type: 'circle', cx: 78, cy: 390, r: 8 },
  { id: 'peEsquerdo', nome: 'Pé Esquerdo', type: 'circle', cx: 122, cy: 390, r: 8 },
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

interface BodyAvatarProps {
  painMap?: Record<string, number>;
  ucScoreMap?: Record<string, number>;
  highlightedUC?: string | null;
  onRegionClick?: (regionId: string) => void;
  mode?: 'pain' | 'structural';
  className?: string;
  showBack?: boolean;
}

function getRegionColor(intensity: number): string {
  if (intensity <= 0) return '#f0f0f0';
  if (intensity <= 3) return '#fef3c7';
  if (intensity <= 5) return '#fbbf24';
  if (intensity <= 7) return '#f97316';
  return '#ef4444';
}

/* ── Single body figure ────────────────────────────────────── */
function BodyFigure({
  side,
  offsetX,
  painMap,
  ucScoreMap,
  highlightedUC,
  onRegionClick,
  mode,
}: {
  side: 'front' | 'back';
  offsetX: number;
  painMap: Record<string, number>;
  ucScoreMap: Record<string, number>;
  highlightedUC: string | null;
  onRegionClick?: (regionId: string) => void;
  mode: 'pain' | 'structural';
}) {
  const getColor = (regionId: string): string => {
    if (mode === 'pain') return getRegionColor(painMap[regionId] ?? 0);
    for (const [ucId, regions] of Object.entries(UC_TO_REGIONS)) {
      if (regions.includes(regionId)) {
        if (highlightedUC === ucId) return '#7c3aed';
        return getRegionColor(ucScoreMap[ucId] ?? 0);
      }
    }
    return '#f0f0f0';
  };

  const getStroke = (regionId: string): string => {
    if (mode === 'structural') {
      for (const [ucId, regions] of Object.entries(UC_TO_REGIONS)) {
        if (regions.includes(regionId) && highlightedUC === ucId) return '#5b21b6';
      }
    }
    return '#d1d5db';
  };

  return (
    <g transform={`translate(${offsetX}, 0)`}>
      {/* Body outline */}
      {/* Head */}
      <ellipse cx="100" cy="30" rx="18" ry="20" fill="#fafafa" stroke="#d1d5db" strokeWidth="0.8" />
      {/* Neck */}
      <rect x="93" y="48" width="14" height="14" rx="4" fill="#fafafa" stroke="#d1d5db" strokeWidth="0.8" />
      {/* Torso */}
      <path d="M68 72 Q68 68 72 66 L92 62 Q100 60 108 62 L128 66 Q132 68 132 72 L134 200 Q134 224 120 232 L100 238 L80 232 Q66 224 66 200 Z"
        fill="#fafafa" stroke="#d1d5db" strokeWidth="0.8" />
      
      {/* Right arm */}
      <path d="M68 72 Q54 76 50 88 L40 140 Q36 160 32 180 Q28 198 28 206"
        fill="none" stroke="#d1d5db" strokeWidth="12" strokeLinecap="round" />
      <path d="M68 72 Q54 76 50 88 L40 140 Q36 160 32 180 Q28 198 28 206"
        fill="none" stroke="#fafafa" strokeWidth="10" strokeLinecap="round" />
      
      {/* Left arm */}
      <path d="M132 72 Q146 76 150 88 L160 140 Q164 160 168 180 Q172 198 172 206"
        fill="none" stroke="#d1d5db" strokeWidth="12" strokeLinecap="round" />
      <path d="M132 72 Q146 76 150 88 L160 140 Q164 160 168 180 Q172 198 172 206"
        fill="none" stroke="#fafafa" strokeWidth="10" strokeLinecap="round" />

      {/* Right leg */}
      <path d="M82 232 Q78 244 80 260 L80 300 Q80 316 80 330 L78 370 Q78 384 78 394"
        fill="none" stroke="#d1d5db" strokeWidth="14" strokeLinecap="round" />
      <path d="M82 232 Q78 244 80 260 L80 300 Q80 316 80 330 L78 370 Q78 384 78 394"
        fill="none" stroke="#fafafa" strokeWidth="12" strokeLinecap="round" />

      {/* Left leg */}
      <path d="M118 232 Q122 244 120 260 L120 300 Q120 316 120 330 L122 370 Q122 384 122 394"
        fill="none" stroke="#d1d5db" strokeWidth="14" strokeLinecap="round" />
      <path d="M118 232 Q122 244 120 260 L120 300 Q120 316 120 330 L122 370 Q122 384 122 394"
        fill="none" stroke="#fafafa" strokeWidth="12" strokeLinecap="round" />

      {/* Anatomical segment lines (front only) */}
      {side === 'front' && (
        <g stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.6">
          {/* Pec lines */}
          <line x1="72" y1="80" x2="128" y2="80" />
          {/* Waist */}
          <line x1="70" y1="150" x2="130" y2="150" />
          {/* Hip */}
          <line x1="70" y1="195" x2="130" y2="195" />
          {/* Knee lines */}
          <line x1="70" y1="310" x2="92" y2="310" />
          <line x1="108" y1="310" x2="130" y2="310" />
        </g>
      )}

      {/* Back-specific features */}
      {side === 'back' && (
        <g stroke="#e5e7eb" strokeWidth="0.5" opacity="0.5">
          {/* Spine */}
          <line x1="100" y1="60" x2="100" y2="220" strokeDasharray="3,2" />
          {/* Scapula lines */}
          <ellipse cx="85" cy="95" rx="12" ry="16" fill="none" />
          <ellipse cx="115" cy="95" rx="12" ry="16" fill="none" />
        </g>
      )}

      {/* Clickable region zones */}
      {REGIOES_CORPO.map(regiao => (
        <g key={regiao.id} onClick={() => onRegionClick?.(regiao.id)} style={{ cursor: onRegionClick ? 'pointer' : 'default' }}>
          <circle
            cx={regiao.cx}
            cy={regiao.cy}
            r={regiao.r}
            fill={getColor(regiao.id)}
            stroke={getStroke(regiao.id)}
            strokeWidth={getStroke(regiao.id) === '#5b21b6' ? 2 : 1}
            opacity={0.8}
            className="transition-all hover:opacity-100"
          />
        </g>
      ))}

      {/* Label */}
      <text x="100" y="412" textAnchor="middle" fontSize="9" fill="#9ca3af" fontWeight="500">
        {side === 'front' ? 'Anterior' : 'Posterior'}
      </text>
    </g>
  );
}

export function BodyAvatarSVG({
  painMap = {},
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
      viewBox={`0 0 ${width} 425`}
      className={`w-full h-auto ${className}`}
      style={{ maxHeight: showBack ? 500 : 420 }}
    >
      <BodyFigure
        side="front"
        offsetX={0}
        painMap={painMap}
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
          ucScoreMap={ucScoreMap}
          highlightedUC={highlightedUC}
          onRegionClick={onRegionClick}
          mode={mode}
        />
      )}
    </svg>
  );
}
