// Anatomical body avatar — front + back, system-aware, symptom-type visualization

interface Region {
  id: string;
  nome: string;
  cx: number;
  cy: number;
  r: number;
}

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

// ── Body system per region ────────────────────────────────────────
const REGION_SYSTEM: Record<string, { system: string; color: string }> = {
  cabeca: { system: 'nervoso', color: '#818cf8' },
  cabeca_f: { system: 'nervoso', color: '#818cf8' },
  cabeca_b: { system: 'nervoso', color: '#818cf8' },
  pescoco: { system: 'musculoesqueletico', color: '#fb923c' },
  pescoco_f: { system: 'musculoesqueletico', color: '#fb923c' },
  pescoco_b: { system: 'musculoesqueletico', color: '#fb923c' },
  ombroDireito: { system: 'musculoesqueletico', color: '#fb923c' },
  ombroEsquerdo: { system: 'musculoesqueletico', color: '#fb923c' },
  ombroDireito_f: { system: 'musculoesqueletico', color: '#fb923c' },
  ombroEsquerdo_f: { system: 'musculoesqueletico', color: '#fb923c' },
  ombroDireito_b: { system: 'musculoesqueletico', color: '#fb923c' },
  ombroEsquerdo_b: { system: 'musculoesqueletico', color: '#fb923c' },
  colunaToracica: { system: 'musculoesqueletico', color: '#fb923c' },
  colunaToracica_f: { system: 'musculoesqueletico', color: '#fb923c' },
  colunaToracica_b: { system: 'musculoesqueletico', color: '#fb923c' },
  escapulaDireita_b: { system: 'musculoesqueletico', color: '#fb923c' },
  escapulaEsquerda_b: { system: 'musculoesqueletico', color: '#fb923c' },
  abdomen: { system: 'digestorio', color: '#34d399' },
  abdomen_f: { system: 'digestorio', color: '#34d399' },
  colunaLombar: { system: 'musculoesqueletico', color: '#fb923c' },
  colunaLombar_f: { system: 'musculoesqueletico', color: '#fb923c' },
  colunaLombar_b: { system: 'musculoesqueletico', color: '#fb923c' },
  sacroPelvica: { system: 'musculoesqueletico', color: '#fb923c' },
  sacroPelvica_f: { system: 'musculoesqueletico', color: '#fb923c' },
  sacroPelvica_b: { system: 'musculoesqueletico', color: '#fb923c' },
  gluteoDireito_b: { system: 'musculoesqueletico', color: '#fb923c' },
  gluteoEsquerdo_b: { system: 'musculoesqueletico', color: '#fb923c' },
  bracoDireito: { system: 'musculoesqueletico', color: '#fb923c' },
  bracoEsquerdo: { system: 'musculoesqueletico', color: '#fb923c' },
  bracoDireito_f: { system: 'musculoesqueletico', color: '#fb923c' },
  bracoEsquerdo_f: { system: 'musculoesqueletico', color: '#fb923c' },
  bracoDireito_b: { system: 'musculoesqueletico', color: '#fb923c' },
  bracoEsquerdo_b: { system: 'musculoesqueletico', color: '#fb923c' },
  cotoveloAntebracoDireito: { system: 'musculoesqueletico', color: '#fb923c' },
  cotoveloAntebracoEsquerdo: { system: 'musculoesqueletico', color: '#fb923c' },
  cotoveloAntebracoDireito_f: { system: 'musculoesqueletico', color: '#fb923c' },
  cotoveloAntebracoEsquerdo_f: { system: 'musculoesqueletico', color: '#fb923c' },
  cotoveloAntebracoDireito_b: { system: 'musculoesqueletico', color: '#fb923c' },
  cotoveloAntebracoEsquerdo_b: { system: 'musculoesqueletico', color: '#fb923c' },
  maoDireita: { system: 'nervoso', color: '#818cf8' },
  maoEsquerda: { system: 'nervoso', color: '#818cf8' },
  maoDireita_f: { system: 'nervoso', color: '#818cf8' },
  maoEsquerda_f: { system: 'nervoso', color: '#818cf8' },
  coxaDireita: { system: 'musculoesqueletico', color: '#fb923c' },
  coxaEsquerda: { system: 'musculoesqueletico', color: '#fb923c' },
  coxaDireita_f: { system: 'musculoesqueletico', color: '#fb923c' },
  coxaEsquerda_f: { system: 'musculoesqueletico', color: '#fb923c' },
  coxaDireita_b: { system: 'musculoesqueletico', color: '#fb923c' },
  coxaEsquerda_b: { system: 'musculoesqueletico', color: '#fb923c' },
  joelhoDireito: { system: 'musculoesqueletico', color: '#fb923c' },
  joelhoEsquerdo: { system: 'musculoesqueletico', color: '#fb923c' },
  joelhoDireito_f: { system: 'musculoesqueletico', color: '#fb923c' },
  joelhoEsquerdo_f: { system: 'musculoesqueletico', color: '#fb923c' },
  joelhoDireito_b: { system: 'musculoesqueletico', color: '#fb923c' },
  joelhoEsquerdo_b: { system: 'musculoesqueletico', color: '#fb923c' },
  pernaDireita: { system: 'musculoesqueletico', color: '#fb923c' },
  pernaEsquerda: { system: 'musculoesqueletico', color: '#fb923c' },
  pernaDireita_f: { system: 'musculoesqueletico', color: '#fb923c' },
  pernaEsquerda_f: { system: 'musculoesqueletico', color: '#fb923c' },
  panturrilhaDireita_b: { system: 'musculoesqueletico', color: '#fb923c' },
  panturrilhaEsquerda_b: { system: 'musculoesqueletico', color: '#fb923c' },
  peDireito: { system: 'musculoesqueletico', color: '#fb923c' },
  peEsquerdo: { system: 'musculoesqueletico', color: '#fb923c' },
  peDireito_f: { system: 'musculoesqueletico', color: '#fb923c' },
  peEsquerdo_f: { system: 'musculoesqueletico', color: '#fb923c' },
  calcanharDireito_b: { system: 'musculoesqueletico', color: '#fb923c' },
  calcanharEsquerdo_b: { system: 'musculoesqueletico', color: '#fb923c' },
};

// ── Symptom visual config ─────────────────────────────────────────
const SINTOMA_CONFIG: Record<string, { color: string; label: string; symbol: string }> = {
  dor:            { color: '#ef4444', label: 'Dor',          symbol: '✦' },
  queimacao:      { color: '#f97316', label: 'Queimação',    symbol: '🔥' },
  rigidez:        { color: '#3b82f6', label: 'Rigidez',      symbol: '⬡' },
  formigamento:   { color: '#eab308', label: 'Formigamento', symbol: '⚡' },
  dormencia:      { color: '#8b5cf6', label: 'Dormência',    symbol: '◎' },
  inchaco:        { color: '#10b981', label: 'Inchaço',      symbol: '◉' },
  irradiacao:     { color: '#ec4899', label: 'Irradiação',   symbol: '↗' },
  'Pontada aguda':{ color: '#dc2626', label: 'Pontada',      symbol: '★' },
  'Peso/Pressão': { color: '#6366f1', label: 'Peso/Pressão', symbol: '▼' },
};

function getBaseRegionId(regionId: string): string {
  return regionId.replace(/_[fb]$/, '');
}

function getIntensityColor(intensity: number): string {
  if (intensity <= 0) return 'transparent';
  if (intensity <= 2) return '#4ade80';
  if (intensity <= 4) return '#fbbf24';
  if (intensity <= 6) return '#f97316';
  if (intensity <= 8) return '#ef4444';
  return '#7f1d1d';
}

// ── Anatomical region shapes ──────────────────────────────────────
function RegionShape({ id, cx, cy, r, fill, stroke, strokeWidth, opacity, className }: {
  id: string;
  cx: number; cy: number; r: number;
  fill: string; stroke: string; strokeWidth: number; opacity: number;
  className?: string;
}) {
  const base = getBaseRegionId(id);

  const sharedProps = { fill, stroke, strokeWidth, opacity, className };

  // Head: slightly oval
  if (base === 'cabeca') {
    return <ellipse cx={cx} cy={cy} rx={r} ry={r * 1.1} {...sharedProps} />;
  }
  // Neck: narrow tall rectangle
  if (base === 'pescoco') {
    return <rect x={cx - r * 0.7} y={cy - r * 1.3} width={r * 1.4} height={r * 2.6} rx={r * 0.5} {...sharedProps} />;
  }
  // Shoulders: wide low ellipse
  if (base === 'ombroDireito' || base === 'ombroEsquerdo') {
    return <ellipse cx={cx} cy={cy} rx={r * 1.3} ry={r * 0.9} {...sharedProps} />;
  }
  // Scapulae (back): angular shape
  if (base === 'escapulaDireita' || base === 'escapulaEsquerda') {
    const flip = base === 'escapulaEsquerda' ? 1 : -1;
    return (
      <path
        d={`M ${cx} ${cy - r} C ${cx + flip * r * 0.6} ${cy - r * 0.8} ${cx + flip * r * 1.2} ${cy} ${cx + flip * r * 0.8} ${cy + r * 0.9} C ${cx + flip * r * 0.2} ${cy + r} ${cx - flip * r * 0.4} ${cy + r * 0.6} ${cx} ${cy - r} Z`}
        {...sharedProps}
      />
    );
  }
  // Thorax front: wide trapezoid
  if (base === 'colunaToracica') {
    return (
      <path
        d={`M ${cx - r * 1.35} ${cy - r} L ${cx + r * 1.35} ${cy - r} L ${cx + r * 1.1} ${cy + r} L ${cx - r * 1.1} ${cy + r} Z`}
        rx="4"
        {...sharedProps}
      />
    );
  }
  // Abdomen: rounded rect slightly narrower
  if (base === 'abdomen') {
    return <rect x={cx - r * 1.1} y={cy - r * 1.1} width={r * 2.2} height={r * 2.2} rx={r * 0.4} {...sharedProps} />;
  }
  // Lumbar: wider ellipse
  if (base === 'colunaLombar') {
    return <ellipse cx={cx} cy={cy} rx={r * 1.1} ry={r * 0.85} {...sharedProps} />;
  }
  // Sacro-pelvic: wide fan shape
  if (base === 'sacroPelvica') {
    return (
      <path
        d={`M ${cx - r * 1.5} ${cy + r * 0.4} Q ${cx - r * 0.6} ${cy - r * 1.2} ${cx} ${cy - r * 1.1} Q ${cx + r * 0.6} ${cy - r * 1.2} ${cx + r * 1.5} ${cy + r * 0.4} Q ${cx} ${cy + r * 1.3} ${cx - r * 1.5} ${cy + r * 0.4} Z`}
        {...sharedProps}
      />
    );
  }
  // Glutes (back): round bottom-heavy shape
  if (base === 'gluteoDireito' || base === 'gluteoEsquerdo') {
    return <ellipse cx={cx} cy={cy + r * 0.2} rx={r * 1.1} ry={r * 1.1} {...sharedProps} />;
  }
  // Upper arm: tall oval
  if (base === 'bracoDireito' || base === 'bracoEsquerdo') {
    return <ellipse cx={cx} cy={cy} rx={r * 0.8} ry={r * 1.5} {...sharedProps} />;
  }
  // Forearm/elbow: slightly thinner tall oval
  if (base === 'cotoveloAntebracoDireito' || base === 'cotoveloAntebracoEsquerdo') {
    return <ellipse cx={cx} cy={cy} rx={r * 0.7} ry={r * 1.6} {...sharedProps} />;
  }
  // Hand: slightly wider at bottom
  if (base === 'maoDireita' || base === 'maoEsquerda') {
    return (
      <path
        d={`M ${cx - r} ${cy - r * 0.6} Q ${cx - r * 0.8} ${cy - r * 1.1} ${cx} ${cy - r * 1.1} Q ${cx + r * 0.8} ${cy - r * 1.1} ${cx + r} ${cy - r * 0.6} L ${cx + r * 1.1} ${cy + r * 0.8} Q ${cx} ${cy + r * 1.2} ${cx - r * 1.1} ${cy + r * 0.8} Z`}
        {...sharedProps}
      />
    );
  }
  // Thigh: tapers downward
  if (base === 'coxaDireita' || base === 'coxaEsquerda') {
    return (
      <path
        d={`M ${cx - r * 1.1} ${cy - r} L ${cx + r * 1.1} ${cy - r} L ${cx + r * 0.85} ${cy + r} L ${cx - r * 0.85} ${cy + r} Z`}
        {...sharedProps}
      />
    );
  }
  // Knee: wide round
  if (base === 'joelhoDireito' || base === 'joelhoEsquerdo') {
    return <ellipse cx={cx} cy={cy} rx={r * 1.15} ry={r * 0.9} {...sharedProps} />;
  }
  // Shin (front): slender oval
  if (base === 'pernaDireita' || base === 'pernaEsquerda') {
    return <ellipse cx={cx} cy={cy} rx={r * 0.65} ry={r * 1.5} {...sharedProps} />;
  }
  // Calf (back): double-lobe gastrocnemius shape
  if (base === 'panturrilhaDireita' || base === 'panturrilhaEsquerda') {
    return (
      <path
        d={`M ${cx} ${cy - r * 1.4} C ${cx - r * 0.9} ${cy - r * 0.8} ${cx - r * 1.1} ${cy + r * 0.3} ${cx - r * 0.5} ${cy + r * 1.3} L ${cx + r * 0.5} ${cy + r * 1.3} C ${cx + r * 1.1} ${cy + r * 0.3} ${cx + r * 0.9} ${cy - r * 0.8} ${cx} ${cy - r * 1.4} Z`}
        {...sharedProps}
      />
    );
  }
  // Foot front: rounded toe area
  if (base === 'peDireito' || base === 'peEsquerdo') {
    return (
      <path
        d={`M ${cx - r * 0.8} ${cy - r * 1.1} L ${cx + r * 0.8} ${cy - r * 1.1} Q ${cx + r * 1.2} ${cy - r * 0.4} ${cx + r * 1.3} ${cy + r * 0.5} Q ${cx + r} ${cy + r * 1.2} ${cx} ${cy + r * 1.1} Q ${cx - r} ${cy + r * 1.2} ${cx - r * 1.3} ${cy + r * 0.5} Q ${cx - r * 1.2} ${cy - r * 0.4} ${cx - r * 0.8} ${cy - r * 1.1} Z`}
        {...sharedProps}
      />
    );
  }
  // Heel (back): wide oval
  if (base === 'calcanharDireito' || base === 'calcanharEsquerdo') {
    return <ellipse cx={cx} cy={cy} rx={r * 1.2} ry={r * 0.85} {...sharedProps} />;
  }

  // Default fallback
  return <circle cx={cx} cy={cy} r={r} {...sharedProps} />;
}

// ── Body silhouette outline ───────────────────────────────────────
// Composição modular (cabeça, pescoço, tronco, braços, pernas, mãos, pés)
// — anatomicamente proporcional, simétrica e visualmente limpa.

function BodyOutline({ side, uid }: { side: 'front' | 'back'; uid: string }) {
  const bodyColor = 'hsl(var(--muted-foreground))';
  const skinFill = `url(#skin-${uid})`;
  const strokeProps = {
    fill: skinFill,
    stroke: bodyColor,
    strokeWidth: 1.4,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    opacity: 0.55,
  };

  // Torso: ombros largos → cintura → quadril (silhueta humana clássica)
  // Anatomicamente: ombro y=92, peito y=130, cintura y=235, quadril y=300, virilha y=318
  const torsoPath = `
    M 108 92
    C 96 96 86 106 82 122
    L 76 168
    C 75 175 80 180 86 178
    C 92 176 94 170 95 162
    L 100 132
    L 100 245
    C 100 268 104 285 110 300
    L 116 318
    L 184 318
    L 190 300
    C 196 285 200 268 200 245
    L 200 132
    L 205 162
    C 206 170 208 176 214 178
    C 220 180 225 175 224 168
    L 218 122
    C 214 106 204 96 192 92
    C 178 88 164 86 150 86
    C 136 86 122 88 108 92 Z
  `.trim();

  // Braço: ombro → bíceps → cotovelo → antebraço → punho (afinando)
  const armLeft = `
    M 82 122
    C 70 145 64 175 62 210
    C 60 245 60 275 58 300
    C 57 310 56 318 60 322
    C 64 324 70 322 72 316
    C 76 300 80 275 84 245
    C 88 215 92 180 96 145
  `.trim();
  const armRight = `
    M 218 122
    C 230 145 236 175 238 210
    C 240 245 240 275 242 300
    C 243 310 244 318 240 322
    C 236 324 230 322 228 316
    C 224 300 220 275 216 245
    C 212 215 208 180 204 145
  `.trim();

  // Mão: oval suave no fim do braço
  // Perna: quadril → coxa → joelho → panturrilha → tornozelo (afinando)
  const legLeft = `
    M 116 318
    C 110 340 106 380 108 425
    C 110 470 114 515 118 560
    C 120 580 122 590 126 592
    C 132 592 136 588 138 580
    C 142 555 144 515 146 470
    C 148 425 150 380 150 340
    L 150 318 Z
  `.trim();
  const legRight = `
    M 184 318
    C 190 340 194 380 192 425
    C 190 470 186 515 182 560
    C 180 580 178 590 174 592
    C 168 592 164 588 162 580
    C 158 555 156 515 154 470
    C 152 425 150 380 150 340
    L 150 318 Z
  `.trim();

  return (
    <g>
      <defs>
        <radialGradient id={`skin-${uid}`} cx="50%" cy="25%" r="80%">
          <stop offset="0%" stopColor={bodyColor} stopOpacity="0.04" />
          <stop offset="100%" stopColor={bodyColor} stopOpacity="0.11" />
        </radialGradient>
        <filter id={`glow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Cabeça */}
      <ellipse cx="150" cy="44" rx="26" ry="30" {...strokeProps} />
      {/* Pescoço */}
      <path d="M 138 68 L 138 88 Q 150 94 162 88 L 162 68 Z" {...strokeProps} />
      {/* Tronco */}
      <path d={torsoPath} {...strokeProps} />
      {/* Braços */}
      <path d={armLeft} {...strokeProps} fill="none" />
      <path d={armRight} {...strokeProps} fill="none" />
      {/* Mãos */}
      <ellipse cx="62" cy="332" rx="11" ry="14" {...strokeProps} />
      <ellipse cx="238" cy="332" rx="11" ry="14" {...strokeProps} />
      {/* Pernas */}
      <path d={legLeft} {...strokeProps} />
      <path d={legRight} {...strokeProps} />
      {/* Pés */}
      {side === 'front' ? (
        <>
          <ellipse cx="128" cy="600" rx="14" ry="7" {...strokeProps} />
          <ellipse cx="172" cy="600" rx="14" ry="7" {...strokeProps} />
        </>
      ) : (
        <>
          <ellipse cx="128" cy="600" rx="12" ry="8" {...strokeProps} />
          <ellipse cx="172" cy="600" rx="12" ry="8" {...strokeProps} />
        </>
      )}

      {/* Detalhes anatômicos sutis */}
      {side === 'front' && (
        <g opacity="0.18" stroke={bodyColor} fill="none">
          {/* Clavículas */}
          <path d="M 115 100 Q 135 94 150 98 Q 165 94 185 100" strokeWidth="0.8" />
          {/* Esterno */}
          <path d="M 150 108 L 150 130" strokeWidth="0.5" strokeDasharray="2,3" />
          {/* Linea alba */}
          <line x1="150" y1="135" x2="150" y2="295" strokeWidth="0.4" strokeDasharray="2,5" />
          {/* Umbigo */}
          <circle cx="150" cy="220" r="2.5" strokeWidth="0.7" />
          {/* Linha peitoral */}
          <path d="M 118 145 Q 150 138 182 145" strokeWidth="0.5" strokeDasharray="3,4" />
          {/* Linha pélvica */}
          <path d="M 118 290 Q 150 285 182 290" strokeWidth="0.5" strokeDasharray="3,4" />
          {/* Joelhos */}
          <ellipse cx="138" cy="432" rx="7" ry="9" strokeWidth="0.6" />
          <ellipse cx="162" cy="432" rx="7" ry="9" strokeWidth="0.6" />
        </g>
      )}
      {side === 'back' && (
        <g opacity="0.2" stroke={bodyColor} fill="none">
          {/* Coluna vertebral */}
          <line x1="150" y1="86" x2="150" y2="315" strokeWidth="0.9" strokeDasharray="3,3" />
          {/* Vértebras */}
          {[100,115,130,145,160,175,190,205,220,235,255,275,295].map(y => (
            <line key={y} x1="146" y1={y} x2="154" y2={y} strokeWidth="1" />
          ))}
          {/* Escápulas */}
          <path d="M 120 130 Q 110 145 118 165 Q 132 168 138 152 Q 138 138 130 128 Q 124 126 120 130" strokeWidth="0.7" />
          <path d="M 180 130 Q 190 145 182 165 Q 168 168 162 152 Q 162 138 170 128 Q 176 126 180 130" strokeWidth="0.7" />
          {/* Sulco glúteo */}
          <path d="M 130 320 Q 150 332 170 320" strokeWidth="0.7" />
          {/* Fossas lombares */}
          <circle cx="140" cy="285" r="2" strokeWidth="0.5" />
          <circle cx="160" cy="285" r="2" strokeWidth="0.5" />
          {/* Tendão de Aquiles */}
          <line x1="128" y1="555" x2="128" y2="590" strokeWidth="0.6" />
          <line x1="172" y1="555" x2="172" y2="590" strokeWidth="0.6" />
        </g>
      )}
    </g>
  );
}

// ── Symptom dots row shown below a region ─────────────────────────
function SintomaDots({ cx, cy, r, sintomas }: { cx: number; cy: number; r: number; sintomas: string[] }) {
  if (sintomas.length === 0) return null;
  const shown = sintomas.slice(0, 5);
  const spacing = 6;
  const totalW = (shown.length - 1) * spacing;
  return (
    <g>
      {shown.map((s, i) => {
        const cfg = SINTOMA_CONFIG[s];
        if (!cfg) return null;
        return (
          <circle
            key={s}
            cx={cx - totalW / 2 + i * spacing}
            cy={cy + r + 7}
            r={3}
            fill={cfg.color}
            stroke="#fff"
            strokeWidth="0.6"
            opacity="0.9"
          />
        );
      })}
    </g>
  );
}

// ── Legend strip (symptom types) ─────────────────────────────────
function SintomaLegend({ sintomas }: { sintomas: string[] }) {
  const unique = Array.from(new Set(sintomas));
  if (unique.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2 px-1">
      {unique.map(s => {
        const cfg = SINTOMA_CONFIG[s];
        if (!cfg) return null;
        return (
          <span
            key={s}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{ background: cfg.color + '22', color: cfg.color, border: `1px solid ${cfg.color}55` }}
          >
            <span>{cfg.symbol}</span>
            {cfg.label}
          </span>
        );
      })}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────
interface BodyAvatarProps {
  painMap?: Record<string, number>;
  sintomaMap?: Record<string, string[]>;
  ucScoreMap?: Record<string, number>;
  highlightedUC?: string | null;
  onRegionClick?: (regionId: string) => void;
  mode?: 'pain' | 'structural';
  className?: string;
  showBack?: boolean;
  showLegend?: boolean;
}

// ── Single body figure ────────────────────────────────────────────
function BodyFigure({
  side, offsetX, painMap, sintomaMap, ucScoreMap, highlightedUC, onRegionClick, mode,
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
  const uid = `${side}-${offsetX}`;

  const getFill = (regionId: string): string => {
    const base = getBaseRegionId(regionId);
    if (mode === 'structural') {
      for (const [ucId, ucRegs] of Object.entries(UC_TO_REGIONS)) {
        if (ucRegs.some(r => base.startsWith(r) || r === base)) {
          if (highlightedUC === ucId) return '#7c3aed';
          const score = ucScoreMap[ucId] ?? 0;
          return getIntensityColor(score);
        }
      }
      return 'transparent';
    }
    const intensity = painMap[regionId] ?? painMap[base] ?? 0;
    const sintomas = sintomaMap[regionId] ?? sintomaMap[base] ?? [];
    if (sintomas.length > 0 && intensity > 0) {
      const primary = sintomas[0];
      return SINTOMA_CONFIG[primary]?.color ?? getIntensityColor(intensity);
    }
    return getIntensityColor(intensity);
  };

  const getOpacity = (regionId: string): number => {
    const base = getBaseRegionId(regionId);
    if (mode === 'structural') return 0.6;
    const intensity = painMap[regionId] ?? painMap[base] ?? 0;
    if (intensity <= 0) {
      const sys = REGION_SYSTEM[regionId] ?? REGION_SYSTEM[base];
      return sys ? 0.10 : 0.06;
    }
    return 0.30 + (intensity / 10) * 0.55;
  };

  const getSystemTint = (regionId: string): string => {
    const base = getBaseRegionId(regionId);
    const sys = REGION_SYSTEM[regionId] ?? REGION_SYSTEM[base];
    return sys ? sys.color : 'hsl(var(--muted-foreground))';
  };

  const hasActivity = (regionId: string): boolean => {
    const base = getBaseRegionId(regionId);
    const intensity = painMap[regionId] ?? painMap[base] ?? 0;
    const sintomas = sintomaMap[regionId] ?? sintomaMap[base] ?? [];
    return intensity > 0 || sintomas.length > 0;
  };

  return (
    <g transform={`translate(${offsetX}, 0)`}>
      <BodyOutline side={side} uid={uid} />

      {regions.map(reg => {
        const fill = getFill(reg.id);
        const opacity = getOpacity(reg.id);
        const active = hasActivity(reg.id);
        const sintomas = sintomaMap[reg.id] ?? sintomaMap[getBaseRegionId(reg.id)] ?? [];
        const systemColor = getSystemTint(reg.id);
        const strokeColor = active ? fill : systemColor;

        return (
          <g key={reg.id} onClick={() => onRegionClick?.(reg.id)} style={{ cursor: onRegionClick ? 'pointer' : 'default' }}>
            {/* Outer glow ring */}
            {active && (
              <RegionShape
                id={reg.id} cx={reg.cx} cy={reg.cy} r={reg.r + 5}
                fill={fill} stroke="none" strokeWidth={0} opacity={0.10}
              />
            )}
            {/* Pulse ring */}
            {active && (
              <RegionShape
                id={reg.id} cx={reg.cx} cy={reg.cy} r={reg.r + 2}
                fill={fill} stroke="none" strokeWidth={0} opacity={0.14}
                className="animate-pulse"
              />
            )}
            {/* Main region shape */}
            <RegionShape
              id={reg.id} cx={reg.cx} cy={reg.cy} r={reg.r}
              fill={active ? fill : systemColor}
              stroke={strokeColor}
              strokeWidth={active ? 1.6 : 0.5}
              opacity={opacity}
              className="transition-all duration-300 hover:opacity-90"
            />
            {/* System tint underlay (always visible at low opacity) */}
            {!active && (
              <RegionShape
                id={reg.id} cx={reg.cx} cy={reg.cy} r={reg.r}
                fill={systemColor} stroke="none" strokeWidth={0} opacity={0.07}
              />
            )}
            {/* Symptom dots */}
            {active && (
              <SintomaDots cx={reg.cx} cy={reg.cy} r={reg.r} sintomas={sintomas} />
            )}
          </g>
        );
      })}

      {/* View label */}
      <text
        x="150" y="596"
        textAnchor="middle"
        fontSize="9"
        fill="hsl(var(--muted-foreground))"
        fontWeight="700"
        letterSpacing="2"
        opacity="0.4"
        fontFamily="system-ui, sans-serif"
      >
        {side === 'front' ? 'ANTERIOR' : 'POSTERIOR'}
      </text>
    </g>
  );
}

// ── Main export ───────────────────────────────────────────────────
export function BodyAvatarSVG({
  painMap = {},
  sintomaMap = {},
  ucScoreMap = {},
  highlightedUC = null,
  onRegionClick,
  mode = 'pain',
  className = '',
  showBack = false,
  showLegend = false,
}: BodyAvatarProps) {
  const width = showBack ? 620 : 300;

  const allSintomas = Object.values(sintomaMap).flat();

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg
        viewBox={`0 0 ${width} 610`}
        style={{ maxHeight: showBack ? 560 : 480, width: '100%', height: 'auto' }}
      >
        <BodyFigure
          side="front" offsetX={0}
          painMap={painMap} sintomaMap={sintomaMap}
          ucScoreMap={ucScoreMap} highlightedUC={highlightedUC ?? null}
          onRegionClick={onRegionClick} mode={mode}
        />
        {showBack && (
          <BodyFigure
            side="back" offsetX={320}
            painMap={painMap} sintomaMap={sintomaMap}
            ucScoreMap={ucScoreMap} highlightedUC={highlightedUC ?? null}
            onRegionClick={onRegionClick} mode={mode}
          />
        )}
      </svg>
      {showLegend && mode === 'pain' && <SintomaLegend sintomas={allSintomas} />}
    </div>
  );
}
