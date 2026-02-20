// Reusable anatomical body avatar SVG — front + back view
// Front and back are INDEPENDENT — each has its own clickable regions

interface Region {
  id: string;
  nome: string;
  cx: number;
  cy: number;
  r: number;
}

// Front-only regions
export const REGIOES_FRENTE: Region[] = [
  { id: 'cabeca_f', nome: 'Cabeça (Ant)', cx: 150, cy: 42, r: 22 },
  { id: 'pescoco_f', nome: 'Pescoço (Ant)', cx: 150, cy: 78, r: 10 },
  { id: 'ombroDireito_f', nome: 'Ombro Dir (Ant)', cx: 108, cy: 112, r: 14 },
  { id: 'ombroEsquerdo_f', nome: 'Ombro Esq (Ant)', cx: 192, cy: 112, r: 14 },
  { id: 'colunaToracica_f', nome: 'Tórax Ant', cx: 150, cy: 155, r: 20 },
  { id: 'abdomen_f', nome: 'Abdômen', cx: 150, cy: 210, r: 18 },
  { id: 'colunaLombar_f', nome: 'Lombar (Ant)', cx: 150, cy: 255, r: 16 },
  { id: 'sacroPelvica_f', nome: 'Pélvica (Ant)', cx: 150, cy: 295, r: 16 },
  { id: 'bracoDireito_f', nome: 'Braço Dir (Ant)', cx: 82, cy: 165, r: 12 },
  { id: 'cotoveloAntebracoDireito_f', nome: 'Cotovelo/Ant.braço D', cx: 70, cy: 220, r: 11 },
  { id: 'maoDireita_f', nome: 'Mão Dir (Ant)', cx: 58, cy: 280, r: 9 },
  { id: 'bracoEsquerdo_f', nome: 'Braço Esq (Ant)', cx: 218, cy: 165, r: 12 },
  { id: 'cotoveloAntebracoEsquerdo_f', nome: 'Cotovelo/Ant.braço E', cx: 230, cy: 220, r: 11 },
  { id: 'maoEsquerda_f', nome: 'Mão Esq (Ant)', cx: 242, cy: 280, r: 9 },
  { id: 'coxaDireita_f', nome: 'Coxa Dir (Ant)', cx: 130, cy: 365, r: 16 },
  { id: 'coxaEsquerda_f', nome: 'Coxa Esq (Ant)', cx: 170, cy: 365, r: 16 },
  { id: 'joelhoDireito_f', nome: 'Joelho Dir (Ant)', cx: 128, cy: 430, r: 12 },
  { id: 'joelhoEsquerdo_f', nome: 'Joelho Esq (Ant)', cx: 172, cy: 430, r: 12 },
  { id: 'pernaDireita_f', nome: 'Perna Dir (Ant)', cx: 126, cy: 495, r: 12 },
  { id: 'pernaEsquerda_f', nome: 'Perna Esq (Ant)', cx: 174, cy: 495, r: 12 },
  { id: 'peDireito_f', nome: 'Pé Dir (Ant)', cx: 122, cy: 555, r: 10 },
  { id: 'peEsquerdo_f', nome: 'Pé Esq (Ant)', cx: 178, cy: 555, r: 10 },
];

// Back-only regions
export const REGIOES_COSTAS: Region[] = [
  { id: 'cabeca_b', nome: 'Cabeça (Post)', cx: 150, cy: 42, r: 22 },
  { id: 'pescoco_b', nome: 'Pescoço (Post)', cx: 150, cy: 78, r: 10 },
  { id: 'ombroDireito_b', nome: 'Ombro Dir (Post)', cx: 108, cy: 112, r: 14 },
  { id: 'ombroEsquerdo_b', nome: 'Ombro Esq (Post)', cx: 192, cy: 112, r: 14 },
  { id: 'colunaToracica_b', nome: 'Torácica (Post)', cx: 150, cy: 155, r: 20 },
  { id: 'escapulaDireita_b', nome: 'Escápula Dir', cx: 122, cy: 138, r: 12 },
  { id: 'escapulaEsquerda_b', nome: 'Escápula Esq', cx: 178, cy: 138, r: 12 },
  { id: 'colunaLombar_b', nome: 'Lombar (Post)', cx: 150, cy: 225, r: 16 },
  { id: 'sacroPelvica_b', nome: 'Sacro-Pélvica (Post)', cx: 150, cy: 278, r: 14 },
  { id: 'gluteoDireito_b', nome: 'Glúteo Dir', cx: 130, cy: 310, r: 14 },
  { id: 'gluteoEsquerdo_b', nome: 'Glúteo Esq', cx: 170, cy: 310, r: 14 },
  { id: 'bracoDireito_b', nome: 'Braço Dir (Post)', cx: 82, cy: 165, r: 12 },
  { id: 'cotoveloAntebracoDireito_b', nome: 'Cotovelo D (Post)', cx: 70, cy: 220, r: 11 },
  { id: 'bracoEsquerdo_b', nome: 'Braço Esq (Post)', cx: 218, cy: 165, r: 12 },
  { id: 'cotoveloAntebracoEsquerdo_b', nome: 'Cotovelo E (Post)', cx: 230, cy: 220, r: 11 },
  { id: 'coxaDireita_b', nome: 'Coxa Dir (Post)', cx: 130, cy: 365, r: 16 },
  { id: 'coxaEsquerda_b', nome: 'Coxa Esq (Post)', cx: 170, cy: 365, r: 16 },
  { id: 'joelhoDireito_b', nome: 'Joelho Dir (Post)', cx: 128, cy: 430, r: 12 },
  { id: 'joelhoEsquerdo_b', nome: 'Joelho Esq (Post)', cx: 172, cy: 430, r: 12 },
  { id: 'panturrilhaDireita_b', nome: 'Panturrilha Dir', cx: 126, cy: 495, r: 12 },
  { id: 'panturrilhaEsquerda_b', nome: 'Panturrilha Esq', cx: 174, cy: 495, r: 12 },
  { id: 'calcanharDireito_b', nome: 'Calcanhar Dir', cx: 122, cy: 555, r: 10 },
  { id: 'calcanharEsquerdo_b', nome: 'Calcanhar Esq', cx: 178, cy: 555, r: 10 },
];

// Backward-compatible unified list
export const REGIOES_CORPO: Region[] = [
  { id: 'cabeca', nome: 'Cabeça', cx: 150, cy: 42, r: 22 },
  { id: 'pescoco', nome: 'Pescoço', cx: 150, cy: 78, r: 10 },
  { id: 'ombroDireito', nome: 'Ombro Direito', cx: 108, cy: 112, r: 14 },
  { id: 'ombroEsquerdo', nome: 'Ombro Esquerdo', cx: 192, cy: 112, r: 14 },
  { id: 'colunaToracica', nome: 'Coluna Torácica', cx: 150, cy: 155, r: 20 },
  { id: 'abdomen', nome: 'Abdômen', cx: 150, cy: 210, r: 18 },
  { id: 'colunaLombar', nome: 'Coluna Lombar', cx: 150, cy: 255, r: 16 },
  { id: 'sacroPelvica', nome: 'Sacro-Pélvica', cx: 150, cy: 295, r: 16 },
  { id: 'bracoDireito', nome: 'Braço Direito', cx: 82, cy: 165, r: 12 },
  { id: 'cotoveloAntebracoDireito', nome: 'Cotovelo/Antebraço D', cx: 70, cy: 220, r: 11 },
  { id: 'maoDireita', nome: 'Mão Direita', cx: 58, cy: 280, r: 9 },
  { id: 'bracoEsquerdo', nome: 'Braço Esquerdo', cx: 218, cy: 165, r: 12 },
  { id: 'cotoveloAntebracoEsquerdo', nome: 'Cotovelo/Antebraço E', cx: 230, cy: 220, r: 11 },
  { id: 'maoEsquerda', nome: 'Mão Esquerda', cx: 242, cy: 280, r: 9 },
  { id: 'coxaDireita', nome: 'Coxa Direita', cx: 130, cy: 365, r: 16 },
  { id: 'coxaEsquerda', nome: 'Coxa Esquerda', cx: 170, cy: 365, r: 16 },
  { id: 'joelhoDireito', nome: 'Joelho Direito', cx: 128, cy: 430, r: 12 },
  { id: 'joelhoEsquerdo', nome: 'Joelho Esquerdo', cx: 172, cy: 430, r: 12 },
  { id: 'pernaDireita', nome: 'Perna Direita', cx: 126, cy: 495, r: 12 },
  { id: 'pernaEsquerda', nome: 'Perna Esquerda', cx: 174, cy: 495, r: 12 },
  { id: 'peDireito', nome: 'Pé Direito', cx: 122, cy: 555, r: 10 },
  { id: 'peEsquerdo', nome: 'Pé Esquerdo', cx: 178, cy: 555, r: 10 },
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

// Sintoma-specific colors
const SINTOMA_CORES: Record<string, string> = {
  dor: '#C41E3A',
  irradiacao: '#F97316',
  rigidez: '#3B82F6',
  formigamento: '#FBBF24',
  inchaco: '#10B981',
  queimacao: '#DC2626',
};

interface BodyAvatarProps {
  painMap?: Record<string, number>;
  sintomaMap?: Record<string, string[]>;
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

/* ── Realistic anatomical body silhouette ─────────────────────── */
function BodyOutline({ side }: { side: 'front' | 'back' }) {
  const bodyColor = 'hsl(var(--muted-foreground))';

  return (
    <g>
      {/* Gradient fills for body */}
      <defs>
        <radialGradient id={`skin-${side}`} cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor={bodyColor} stopOpacity="0.06" />
          <stop offset="100%" stopColor={bodyColor} stopOpacity="0.12" />
        </radialGradient>
        <filter id={`body-shadow-${side}`}>
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="1" dy="2" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.1" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Full body silhouette as a single filled path */}
      <path
        d={side === 'front' ? `
          M 150 18
          C 170 18 178 30 178 45
          C 178 58 170 68 162 72
          L 165 75
          C 168 78 170 82 170 85
          L 170 92
          C 180 95 195 100 205 108
          C 215 116 220 122 222 128
          L 235 168
          C 238 178 240 190 242 200
          L 248 260
          C 250 272 248 282 244 288
          L 240 285
          C 238 278 235 268 232 258
          L 222 200
          C 220 192 218 185 215 180
          L 205 150
          C 200 140 198 135 196 130
          L 192 120
          C 188 118 185 120 183 125
          L 180 140
          C 178 148 176 155 175 162
          L 173 180
          C 172 195 172 210 172 225
          L 172 250
          C 172 265 174 280 178 295
          C 182 310 185 320 186 330
          L 186 340
          C 185 348 182 355 180 365
          L 178 395
          C 176 410 175 425 175 435
          L 176 460
          C 176 475 177 490 178 500
          L 180 530
          C 181 540 182 548 184 555
          C 186 562 190 566 192 570
          L 192 572
          C 190 576 185 578 178 578
          C 172 578 170 575 168 570
          L 168 555
          C 167 548 166 540 166 530
          L 164 500
          C 163 490 162 475 162 460
          L 162 435
          C 162 425 161 410 160 400
          L 157 370
          C 155 358 153 348 152 340
          L 150 330
          L 148 340
          C 147 348 145 358 143 370
          L 140 400
          C 139 410 138 425 138 435
          L 138 460
          C 138 475 137 490 136 500
          L 134 530
          C 134 540 133 548 132 555
          L 132 570
          C 130 575 128 578 122 578
          C 115 578 110 576 108 572
          L 108 570
          C 110 566 114 562 116 555
          C 118 548 119 540 120 530
          L 122 500
          C 123 490 124 475 124 460
          L 124 435
          C 125 425 124 410 122 395
          L 120 365
          C 118 355 115 348 114 340
          L 114 330
          C 115 320 118 310 122 295
          C 126 280 128 265 128 250
          L 128 225
          C 128 210 128 195 127 180
          L 125 162
          C 124 155 122 148 120 140
          L 117 125
          C 115 120 112 118 108 120
          L 104 130
          C 102 135 100 140 95 150
          L 85 180
          C 82 185 80 192 78 200
          L 68 258
          C 65 268 62 278 60 285
          L 56 288
          C 52 282 50 272 52 260
          L 58 200
          C 60 190 62 178 65 168
          L 78 128
          C 80 122 85 116 95 108
          C 105 100 120 95 130 92
          L 130 85
          C 130 82 132 78 135 75
          L 138 72
          C 130 68 122 58 122 45
          C 122 30 130 18 150 18 Z
        ` : `
          M 150 18
          C 170 18 178 30 178 45
          C 178 58 170 68 162 72
          L 165 75
          C 168 78 170 82 170 85
          L 170 92
          C 180 95 195 100 205 108
          C 215 116 220 122 222 128
          L 235 168
          C 238 178 240 190 242 200
          L 248 260
          C 250 272 248 282 244 288
          L 240 285
          C 238 278 235 268 232 258
          L 222 200
          C 220 192 218 185 215 180
          L 205 150
          C 200 140 198 135 196 130
          L 192 120
          C 188 118 185 120 183 125
          L 180 140
          C 178 148 176 155 175 162
          L 173 180
          C 172 195 172 210 172 225
          L 172 250
          C 172 265 174 280 178 295
          C 182 310 185 320 186 330
          L 186 340
          C 185 348 182 355 180 365
          L 178 395
          C 176 410 175 425 175 435
          L 176 460
          C 176 475 177 490 178 500
          L 180 530
          C 181 540 182 548 184 555
          C 186 562 190 566 192 570
          L 192 572
          C 190 576 185 578 178 578
          C 172 578 170 575 168 570
          L 168 555
          C 167 548 166 540 166 530
          L 164 500
          C 163 490 162 475 162 460
          L 162 435
          C 162 425 161 410 160 400
          L 157 370
          C 155 358 153 348 152 340
          L 150 330
          L 148 340
          C 147 348 145 358 143 370
          L 140 400
          C 139 410 138 425 138 435
          L 138 460
          C 138 475 137 490 136 500
          L 134 530
          C 134 540 133 548 132 555
          L 132 570
          C 130 575 128 578 122 578
          C 115 578 110 576 108 572
          L 108 570
          C 110 566 114 562 116 555
          C 118 548 119 540 120 530
          L 122 500
          C 123 490 124 475 124 460
          L 124 435
          C 125 425 124 410 122 395
          L 120 365
          C 118 355 115 348 114 340
          L 114 330
          C 115 320 118 310 122 295
          C 126 280 128 265 128 250
          L 128 225
          C 128 210 128 195 127 180
          L 125 162
          C 124 155 122 148 120 140
          L 117 125
          C 115 120 112 118 108 120
          L 104 130
          C 102 135 100 140 95 150
          L 85 180
          C 82 185 80 192 78 200
          L 68 258
          C 65 268 62 278 60 285
          L 56 288
          C 52 282 50 272 52 260
          L 58 200
          C 60 190 62 178 65 168
          L 78 128
          C 80 122 85 116 95 108
          C 105 100 120 95 130 92
          L 130 85
          C 130 82 132 78 135 75
          L 138 72
          C 130 68 122 58 122 45
          C 122 30 130 18 150 18 Z
        `}
        fill={`url(#skin-${side})`}
        stroke={bodyColor}
        strokeWidth="1.5"
        opacity="0.4"
        filter={`url(#body-shadow-${side})`}
      />

      {/* Anatomical detail lines */}
      {side === 'front' && (
        <g opacity="0.15" stroke={bodyColor} fill="none">
          {/* Clavicle lines */}
          <path d="M 115 100 Q 135 95 150 98 Q 165 95 185 100" strokeWidth="0.8" />
          {/* Pectoral division */}
          <path d="M 150 105 L 150 115" strokeWidth="0.5" strokeDasharray="2,3" />
          {/* Midline */}
          <line x1="150" y1="98" x2="150" y2="320" strokeWidth="0.4" strokeDasharray="2,5" />
          {/* Navel */}
          <circle cx="150" cy="215" r="3" strokeWidth="0.6" />
          {/* Waist line */}
          <path d="M 120 240 Q 150 235 180 240" strokeWidth="0.5" strokeDasharray="3,4" />
          {/* Hip line */}
          <path d="M 118 290 Q 150 285 182 290" strokeWidth="0.5" strokeDasharray="3,4" />
          {/* Knee caps */}
          <ellipse cx="128" cy="430" rx="8" ry="10" strokeWidth="0.5" />
          <ellipse cx="172" cy="430" rx="8" ry="10" strokeWidth="0.5" />
        </g>
      )}

      {side === 'back' && (
        <g opacity="0.15" stroke={bodyColor} fill="none">
          {/* Spine */}
          <line x1="150" y1="72" x2="150" y2="295" strokeWidth="0.8" strokeDasharray="3,3" />
          {/* Vertebrae markers */}
          {[90, 110, 130, 150, 170, 190, 210, 230, 250, 270].map(y => (
            <line key={y} x1="148" y1={y} x2="152" y2={y} strokeWidth="1" />
          ))}
          {/* Scapulae */}
          <path d="M 118 120 Q 112 130 115 148 Q 122 155 130 150 Q 135 142 132 128 Q 128 120 118 120" strokeWidth="0.8" />
          <path d="M 182 120 Q 188 130 185 148 Q 178 155 170 150 Q 165 142 168 128 Q 172 120 182 120" strokeWidth="0.8" />
          {/* Gluteal crease */}
          <path d="M 132 300 Q 150 312 168 300" strokeWidth="0.6" />
          {/* Sacral dimples */}
          <circle cx="142" cy="275" r="2" strokeWidth="0.5" />
          <circle cx="158" cy="275" r="2" strokeWidth="0.5" />
          {/* Achilles tendon hints */}
          <line x1="126" y1="520" x2="124" y2="550" strokeWidth="0.5" />
          <line x1="174" y1="520" x2="176" y2="550" strokeWidth="0.5" />
        </g>
      )}
    </g>
  );
}

/* ── Single body figure ──────────────────────────────────────── */
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
      const sintomas = sintomaMap[regionId] || sintomaMap[getBaseRegionId(regionId)] || [];
      if (sintomas.length > 0 && intensity > 0) {
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
      if (intensity <= 0) return 0.08;
      return 0.25 + (intensity / 10) * 0.55;
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
            {/* Soft glow for active regions */}
            {hasData && (
              <>
                <circle cx={regiao.cx} cy={regiao.cy} r={regiao.r + 6} fill={color} opacity={0.08} />
                <circle cx={regiao.cx} cy={regiao.cy} r={regiao.r + 3} fill={color} opacity={0.12} className="animate-pulse" />
              </>
            )}
            {/* Main circle */}
            <circle
              cx={regiao.cx}
              cy={regiao.cy}
              r={regiao.r}
              fill={color}
              stroke={hasData ? color : 'hsl(var(--border))'}
              strokeWidth={hasData ? 1.8 : 0.4}
              opacity={opacity}
              className="transition-all duration-300 hover:opacity-80"
            />
            {/* Multi-sintoma dots below region */}
            {sintomas.length > 1 && sintomas.slice(0, 4).map((s, i) => (
              <circle
                key={s}
                cx={regiao.cx + (i - (sintomas.length - 1) / 2) * 6}
                cy={regiao.cy + regiao.r + 6}
                r={2.5}
                fill={SINTOMA_CORES[s] || '#888'}
                opacity={0.85}
                stroke="#fff"
                strokeWidth="0.5"
              />
            ))}
          </g>
        );
      })}

      {/* Label */}
      <text x="150" y="595" textAnchor="middle" fontSize="12" fill="hsl(var(--muted-foreground))" fontWeight="700" letterSpacing="1.5" opacity="0.5">
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
  const width = showBack ? 620 : 300;

  return (
    <svg
      viewBox={`0 0 ${width} 610`}
      className={`w-full h-auto ${className}`}
      style={{ maxHeight: showBack ? 560 : 480 }}
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
          offsetX={320}
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
