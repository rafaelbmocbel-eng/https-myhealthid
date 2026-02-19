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
  { id: 'cabeca_f', nome: 'Cabeça (Ant)', type: 'circle', cx: 100, cy: 32, r: 20 },
  { id: 'pescoco_f', nome: 'Pescoço (Ant)', type: 'circle', cx: 100, cy: 60, r: 8 },
  { id: 'ombroDireito_f', nome: 'Ombro Dir (Ant)', type: 'circle', cx: 66, cy: 84, r: 12 },
  { id: 'ombroEsquerdo_f', nome: 'Ombro Esq (Ant)', type: 'circle', cx: 134, cy: 84, r: 12 },
  { id: 'colunaToracica_f', nome: 'Tórax Ant', type: 'circle', cx: 100, cy: 115, r: 16 },
  { id: 'abdomen_f', nome: 'Abdômen', type: 'circle', cx: 100, cy: 155, r: 16 },
  { id: 'colunaLombar_f', nome: 'Lombar (Ant)', type: 'circle', cx: 100, cy: 188, r: 14 },
  { id: 'sacroPelvica_f', nome: 'Pélvica (Ant)', type: 'circle', cx: 100, cy: 218, r: 14 },
  { id: 'bracoDireito_f', nome: 'Braço Dir (Ant)', type: 'circle', cx: 48, cy: 122, r: 10 },
  { id: 'cotoveloAntebracoDireito_f', nome: 'Cotovelo/Ant.braço D (Ant)', type: 'circle', cx: 38, cy: 162, r: 10 },
  { id: 'maoDireita_f', nome: 'Mão Dir (Ant)', type: 'circle', cx: 30, cy: 202, r: 8 },
  { id: 'bracoEsquerdo_f', nome: 'Braço Esq (Ant)', type: 'circle', cx: 152, cy: 122, r: 10 },
  { id: 'cotoveloAntebracoEsquerdo_f', nome: 'Cotovelo/Ant.braço E (Ant)', type: 'circle', cx: 162, cy: 162, r: 10 },
  { id: 'maoEsquerda_f', nome: 'Mão Esq (Ant)', type: 'circle', cx: 170, cy: 202, r: 8 },
  { id: 'coxaDireita_f', nome: 'Coxa Dir (Ant)', type: 'circle', cx: 84, cy: 270, r: 14 },
  { id: 'coxaEsquerda_f', nome: 'Coxa Esq (Ant)', type: 'circle', cx: 116, cy: 270, r: 14 },
  { id: 'joelhoDireito_f', nome: 'Joelho Dir (Ant)', type: 'circle', cx: 82, cy: 315, r: 10 },
  { id: 'joelhoEsquerdo_f', nome: 'Joelho Esq (Ant)', type: 'circle', cx: 118, cy: 315, r: 10 },
  { id: 'pernaDireita_f', nome: 'Perna Dir (Ant)', type: 'circle', cx: 80, cy: 355, r: 10 },
  { id: 'pernaEsquerda_f', nome: 'Perna Esq (Ant)', type: 'circle', cx: 120, cy: 355, r: 10 },
  { id: 'peDireito_f', nome: 'Pé Dir (Ant)', type: 'circle', cx: 78, cy: 390, r: 8 },
  { id: 'peEsquerdo_f', nome: 'Pé Esq (Ant)', type: 'circle', cx: 122, cy: 390, r: 8 },
];

// Back-only regions
export const REGIOES_COSTAS: Region[] = [
  { id: 'cabeca_b', nome: 'Cabeça (Post)', type: 'circle', cx: 100, cy: 32, r: 20 },
  { id: 'pescoco_b', nome: 'Pescoço (Post)', type: 'circle', cx: 100, cy: 60, r: 8 },
  { id: 'ombroDireito_b', nome: 'Ombro Dir (Post)', type: 'circle', cx: 66, cy: 84, r: 12 },
  { id: 'ombroEsquerdo_b', nome: 'Ombro Esq (Post)', type: 'circle', cx: 134, cy: 84, r: 12 },
  { id: 'colunaToracica_b', nome: 'Torácica (Post)', type: 'circle', cx: 100, cy: 115, r: 16 },
  { id: 'escapulaDireita_b', nome: 'Escápula Dir', type: 'circle', cx: 78, cy: 100, r: 10 },
  { id: 'escapulaEsquerda_b', nome: 'Escápula Esq', type: 'circle', cx: 122, cy: 100, r: 10 },
  { id: 'colunaLombar_b', nome: 'Lombar (Post)', type: 'circle', cx: 100, cy: 165, r: 16 },
  { id: 'sacroPelvica_b', nome: 'Sacro-Pélvica (Post)', type: 'circle', cx: 100, cy: 205, r: 14 },
  { id: 'gluteoDireito_b', nome: 'Glúteo Dir', type: 'circle', cx: 82, cy: 230, r: 12 },
  { id: 'gluteoEsquerdo_b', nome: 'Glúteo Esq', type: 'circle', cx: 118, cy: 230, r: 12 },
  { id: 'bracoDireito_b', nome: 'Braço Dir (Post)', type: 'circle', cx: 48, cy: 122, r: 10 },
  { id: 'cotoveloAntebracoDireito_b', nome: 'Cotovelo D (Post)', type: 'circle', cx: 38, cy: 162, r: 10 },
  { id: 'bracoEsquerdo_b', nome: 'Braço Esq (Post)', type: 'circle', cx: 152, cy: 122, r: 10 },
  { id: 'cotoveloAntebracoEsquerdo_b', nome: 'Cotovelo E (Post)', type: 'circle', cx: 162, cy: 162, r: 10 },
  { id: 'coxaDireita_b', nome: 'Coxa Dir (Post)', type: 'circle', cx: 84, cy: 270, r: 14 },
  { id: 'coxaEsquerda_b', nome: 'Coxa Esq (Post)', type: 'circle', cx: 116, cy: 270, r: 14 },
  { id: 'joelhoDireito_b', nome: 'Joelho Dir (Post)', type: 'circle', cx: 82, cy: 315, r: 10 },
  { id: 'joelhoEsquerdo_b', nome: 'Joelho Esq (Post)', type: 'circle', cx: 118, cy: 315, r: 10 },
  { id: 'panturrilhaDireita_b', nome: 'Panturrilha Dir', type: 'circle', cx: 80, cy: 355, r: 10 },
  { id: 'panturrilhaEsquerda_b', nome: 'Panturrilha Esq', type: 'circle', cx: 120, cy: 355, r: 10 },
  { id: 'calcanharDireito_b', nome: 'Calcanhar Dir', type: 'circle', cx: 78, cy: 390, r: 8 },
  { id: 'calcanharEsquerdo_b', nome: 'Calcanhar Esq', type: 'circle', cx: 122, cy: 390, r: 8 },
];

// Backward-compatible unified list (strip suffix for UC mapping)
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

// Map front/back region IDs to their base UC region
function getBaseRegionId(regionId: string): string {
  return regionId.replace(/_[fb]$/, '');
}

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
  if (intensity <= 0) return '#e8f4f8';
  if (intensity <= 3) return '#fef3c7';
  if (intensity <= 5) return '#fbbf24';
  if (intensity <= 7) return '#f97316';
  return '#ef4444';
}

/* ── Body silhouette outline ──────────────────────────── */
function BodyOutline({ side }: { side: 'front' | 'back' }) {
  return (
    <>
      {/* Head */}
      <ellipse cx="100" cy="30" rx="18" ry="20" fill="#fafafa" stroke="#d1d5db" strokeWidth="0.8" />
      {/* Neck */}
      <rect x="93" y="48" width="14" height="14" rx="4" fill="#fafafa" stroke="#d1d5db" strokeWidth="0.8" />
      {/* Torso */}
      <path d="M68 72 Q68 68 72 66 L92 62 Q100 60 108 62 L128 66 Q132 68 132 72 L134 200 Q134 224 120 232 L100 238 L80 232 Q66 224 66 200 Z"
        fill="#fafafa" stroke="#d1d5db" strokeWidth="0.8" />
      {/* Arms */}
      <path d="M68 72 Q54 76 50 88 L40 140 Q36 160 32 180 Q28 198 28 206" fill="none" stroke="#d1d5db" strokeWidth="12" strokeLinecap="round" />
      <path d="M68 72 Q54 76 50 88 L40 140 Q36 160 32 180 Q28 198 28 206" fill="none" stroke="#fafafa" strokeWidth="10" strokeLinecap="round" />
      <path d="M132 72 Q146 76 150 88 L160 140 Q164 160 168 180 Q172 198 172 206" fill="none" stroke="#d1d5db" strokeWidth="12" strokeLinecap="round" />
      <path d="M132 72 Q146 76 150 88 L160 140 Q164 160 168 180 Q172 198 172 206" fill="none" stroke="#fafafa" strokeWidth="10" strokeLinecap="round" />
      {/* Legs */}
      <path d="M82 232 Q78 244 80 260 L80 300 Q80 316 80 330 L78 370 Q78 384 78 394" fill="none" stroke="#d1d5db" strokeWidth="14" strokeLinecap="round" />
      <path d="M82 232 Q78 244 80 260 L80 300 Q80 316 80 330 L78 370 Q78 384 78 394" fill="none" stroke="#fafafa" strokeWidth="12" strokeLinecap="round" />
      <path d="M118 232 Q122 244 120 260 L120 300 Q120 316 120 330 L122 370 Q122 384 122 394" fill="none" stroke="#d1d5db" strokeWidth="14" strokeLinecap="round" />
      <path d="M118 232 Q122 244 120 260 L120 300 Q120 316 120 330 L122 370 Q122 384 122 394" fill="none" stroke="#fafafa" strokeWidth="12" strokeLinecap="round" />

      {side === 'front' && (
        <g stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.6">
          <line x1="72" y1="80" x2="128" y2="80" />
          <line x1="70" y1="150" x2="130" y2="150" />
          <line x1="70" y1="195" x2="130" y2="195" />
          <line x1="70" y1="310" x2="92" y2="310" />
          <line x1="108" y1="310" x2="130" y2="310" />
        </g>
      )}

      {side === 'back' && (
        <g stroke="#e5e7eb" strokeWidth="0.5" opacity="0.5">
          <line x1="100" y1="60" x2="100" y2="220" strokeDasharray="3,2" />
          <ellipse cx="85" cy="95" rx="12" ry="16" fill="none" />
          <ellipse cx="115" cy="95" rx="12" ry="16" fill="none" />
        </g>
      )}
    </>
  );
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
  const regions = side === 'front' ? REGIOES_FRENTE : REGIOES_COSTAS;

  const getColor = (regionId: string): string => {
    if (mode === 'pain') {
      // Check with full ID first, then base ID
      return getRegionColor(painMap[regionId] ?? painMap[getBaseRegionId(regionId)] ?? 0);
    }
    const baseId = getBaseRegionId(regionId);
    for (const [ucId, ucRegions] of Object.entries(UC_TO_REGIONS)) {
      if (ucRegions.some(r => baseId.startsWith(r.replace(/_[fb]$/, '')) || r === baseId)) {
        if (highlightedUC === ucId) return '#7c3aed';
        return getRegionColor(ucScoreMap[ucId] ?? 0);
      }
    }
    return '#e8f4f8';
  };

  const getStroke = (regionId: string): string => {
    if (mode === 'structural') {
      const baseId = getBaseRegionId(regionId);
      for (const [ucId, ucRegions] of Object.entries(UC_TO_REGIONS)) {
        if (ucRegions.some(r => baseId.startsWith(r.replace(/_[fb]$/, '')) || r === baseId) && highlightedUC === ucId) return '#5b21b6';
      }
    }
    return '#d1d5db';
  };

  return (
    <g transform={`translate(${offsetX}, 0)`}>
      <BodyOutline side={side} />

      {/* Clickable region zones — independent per side */}
      {regions.map(regiao => (
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
