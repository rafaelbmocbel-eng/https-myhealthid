// Reusable anatomical body avatar SVG component with all limbs
// Used in Bloco2Dor and Bloco6Estrutural

interface Region {
  id: string;
  nome: string;
  // SVG path or shape definition
  path?: string;
  cx?: number;
  cy?: number;
  r?: number;
  type?: 'circle' | 'path';
}

// Complete body regions including all limbs
export const REGIOES_CORPO: Region[] = [
  { id: 'cabeca', nome: 'Cabeça', type: 'circle', cx: 150, cy: 38, r: 26 },
  { id: 'pescoco', nome: 'Pescoço', type: 'circle', cx: 150, cy: 73, r: 11 },
  // Shoulders
  { id: 'ombroDireito', nome: 'Ombro Direito', type: 'circle', cx: 99, cy: 102, r: 16 },
  { id: 'ombroEsquerdo', nome: 'Ombro Esquerdo', type: 'circle', cx: 201, cy: 102, r: 16 },
  // Trunk
  { id: 'colunaToracica', nome: 'Coluna Torácica', type: 'circle', cx: 150, cy: 140, r: 20 },
  { id: 'abdomen', nome: 'Abdômen', type: 'circle', cx: 150, cy: 190, r: 20 },
  { id: 'colunaLombar', nome: 'Coluna Lombar', type: 'circle', cx: 150, cy: 230, r: 18 },
  { id: 'sacroPelvica', nome: 'Sacro-Pélvica', type: 'circle', cx: 150, cy: 268, r: 18 },
  // Upper limbs right
  { id: 'bracoDireito', nome: 'Braço Direito', type: 'circle', cx: 75, cy: 148, r: 13 },
  { id: 'cotoveloAntebracoDireito', nome: 'Cotovelo/Antebraço D', type: 'circle', cx: 58, cy: 198, r: 13 },
  { id: 'maoDireita', nome: 'Mão Direita', type: 'circle', cx: 44, cy: 248, r: 12 },
  // Upper limbs left
  { id: 'bracoEsquerdo', nome: 'Braço Esquerdo', type: 'circle', cx: 225, cy: 148, r: 13 },
  { id: 'cotoveloAntebracoEsquerdo', nome: 'Cotovelo/Antebraço E', type: 'circle', cx: 242, cy: 198, r: 13 },
  { id: 'maoEsquerda', nome: 'Mão Esquerda', type: 'circle', cx: 256, cy: 248, r: 12 },
  // Lower limbs
  { id: 'coxaDireita', nome: 'Coxa Direita', type: 'circle', cx: 125, cy: 325, r: 18 },
  { id: 'coxaEsquerda', nome: 'Coxa Esquerda', type: 'circle', cx: 175, cy: 325, r: 18 },
  { id: 'joelhoDireito', nome: 'Joelho Direito', type: 'circle', cx: 121, cy: 380, r: 14 },
  { id: 'joelhoEsquerdo', nome: 'Joelho Esquerdo', type: 'circle', cx: 179, cy: 380, r: 14 },
  { id: 'pernaDireita', nome: 'Perna Direita', type: 'circle', cx: 118, cy: 425, r: 13 },
  { id: 'pernaEsquerda', nome: 'Perna Esquerda', type: 'circle', cx: 182, cy: 425, r: 13 },
  { id: 'peDireito', nome: 'Pé Direito', type: 'circle', cx: 113, cy: 468, r: 12 },
  { id: 'peEsquerdo', nome: 'Pé Esquerdo', type: 'circle', cx: 187, cy: 468, r: 12 },
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
  // For Bloco2: color each region by pain intensity
  painMap?: Record<string, number>; // regionId -> intensity 0-10
  // For Bloco6: color each region by UC score
  ucScoreMap?: Record<string, number>; // ucId -> score 0-10
  // Highlighted unit (Bloco6 use)
  highlightedUC?: string | null;
  // Click handler
  onRegionClick?: (regionId: string) => void;
  // Mode
  mode?: 'pain' | 'structural';
  className?: string;
}

function getRegionColor(intensity: number): string {
  if (intensity <= 0) return '#e8f4f8';
  if (intensity <= 3) return '#fef3c7'; // yellow
  if (intensity <= 5) return '#fbbf24'; // amber
  if (intensity <= 7) return '#f97316'; // orange
  return '#ef4444'; // red
}

export function BodyAvatarSVG({
  painMap = {},
  ucScoreMap = {},
  highlightedUC = null,
  onRegionClick,
  mode = 'pain',
  className = '',
}: BodyAvatarProps) {
  // Compute color for a given region
  const getColor = (regionId: string): string => {
    if (mode === 'pain') {
      const intensity = painMap[regionId] ?? 0;
      return getRegionColor(intensity);
    }
    // structural mode: find which UC this region belongs to
    for (const [ucId, regions] of Object.entries(UC_TO_REGIONS)) {
      if (regions.includes(regionId)) {
        const score = ucScoreMap[ucId] ?? 0;
        const isHighlighted = highlightedUC === ucId;
        if (isHighlighted) return '#6366f1'; // indigo highlight
        return getRegionColor(score);
      }
    }
    return '#e8f4f8';
  };

  const getStroke = (regionId: string): string => {
    if (mode === 'structural') {
      for (const [ucId, regions] of Object.entries(UC_TO_REGIONS)) {
        if (regions.includes(regionId) && highlightedUC === ucId) return '#4f46e5';
      }
    }
    const hasPain = mode === 'pain' && (painMap[regionId] ?? 0) > 0;
    return hasPain ? '#666' : '#ccc';
  };

  return (
    <svg
      viewBox="0 0 300 490"
      className={`w-full h-auto ${className}`}
      style={{ maxHeight: 480 }}
    >
      {/* ── Body outline shapes ── */}
      {/* Head */}
      <ellipse cx="150" cy="38" rx="26" ry="28" fill="#f5f5f5" stroke="#e0e0e0" strokeWidth="1" />
      {/* Neck */}
      <rect x="140" y="64" width="20" height="18" rx="5" fill="#f5f5f5" stroke="#e0e0e0" strokeWidth="1" />
      {/* Torso */}
      <rect x="106" y="84" width="88" height="190" rx="14" fill="#f5f5f5" stroke="#e0e0e0" strokeWidth="1" />
      {/* Pelvis */}
      <ellipse cx="150" cy="280" rx="44" ry="22" fill="#f5f5f5" stroke="#e0e0e0" strokeWidth="1" />

      {/* Right arm */}
      <rect x="62" y="102" width="36" height="155" rx="12" fill="#f5f5f5" stroke="#e0e0e0" strokeWidth="1" />
      {/* Right hand */}
      <ellipse cx="80" cy="268" rx="14" ry="11" fill="#f5f5f5" stroke="#e0e0e0" strokeWidth="1" />

      {/* Left arm */}
      <rect x="202" y="102" width="36" height="155" rx="12" fill="#f5f5f5" stroke="#e0e0e0" strokeWidth="1" />
      {/* Left hand */}
      <ellipse cx="220" cy="268" rx="14" ry="11" fill="#f5f5f5" stroke="#e0e0e0" strokeWidth="1" />

      {/* Right leg */}
      <rect x="108" y="298" width="34" height="170" rx="12" fill="#f5f5f5" stroke="#e0e0e0" strokeWidth="1" />
      {/* Right foot */}
      <ellipse cx="118" cy="476" rx="18" ry="9" fill="#f5f5f5" stroke="#e0e0e0" strokeWidth="1" />

      {/* Left leg */}
      <rect x="158" y="298" width="34" height="170" rx="12" fill="#f5f5f5" stroke="#e0e0e0" strokeWidth="1" />
      {/* Left foot */}
      <ellipse cx="182" cy="476" rx="18" ry="9" fill="#f5f5f5" stroke="#e0e0e0" strokeWidth="1" />

      {/* ── Clickable region circles ── */}
      {REGIOES_CORPO.map(regiao => (
        <g key={regiao.id} onClick={() => onRegionClick?.(regiao.id)} style={{ cursor: onRegionClick ? 'pointer' : 'default' }}>
          <circle
            cx={regiao.cx}
            cy={regiao.cy}
            r={regiao.r}
            fill={getColor(regiao.id)}
            stroke={getStroke(regiao.id)}
            strokeWidth={getStroke(regiao.id) === '#4f46e5' ? 2.5 : 1.5}
            opacity={0.88}
            className="transition-all hover:opacity-100"
          />
          {/* Show intensity/score value if > 0 */}
          {(() => {
            const val = mode === 'pain'
              ? (painMap[regiao.id] ?? 0)
              : (() => {
                  for (const [ucId, regions] of Object.entries(UC_TO_REGIONS)) {
                    if (regions.includes(regiao.id)) return ucScoreMap[ucId] ?? 0;
                  }
                  return 0;
                })();
            return val > 0 ? (
              <text
                x={regiao.cx}
                y={(regiao.cy ?? 0) + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="7"
                fontWeight="600"
                fill="#333"
                className="pointer-events-none select-none"
              >
                {val.toFixed(mode === 'structural' ? 1 : 0)}
              </text>
            ) : null;
          })()}
        </g>
      ))}

      {/* ── Structural connection lines (only in structural mode) ── */}
      {mode === 'structural' && (
        <g opacity="0.25" stroke="#6366f1" strokeWidth="1" strokeDasharray="3,3">
          {/* Spine line */}
          <line x1="150" y1="73" x2="150" y2="268" />
          {/* Shoulder connections */}
          <line x1="99" y1="102" x2="201" y2="102" />
          {/* Hip connections */}
          <line x1="125" y1="295" x2="175" y2="295" />
          {/* Arm connections */}
          <line x1="75" y1="148" x2="58" y2="198" />
          <line x1="58" y1="198" x2="44" y2="248" />
          <line x1="225" y1="148" x2="242" y2="198" />
          <line x1="242" y1="198" x2="256" y2="248" />
          {/* Leg connections */}
          <line x1="125" y1="325" x2="121" y2="380" />
          <line x1="121" y1="380" x2="118" y2="425" />
          <line x1="118" y1="425" x2="113" y2="468" />
          <line x1="175" y1="325" x2="179" y2="380" />
          <line x1="179" y1="380" x2="182" y2="425" />
          <line x1="182" y1="425" x2="187" y2="468" />
        </g>
      )}
    </svg>
  );
}
