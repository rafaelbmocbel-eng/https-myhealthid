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
const FRONT_SILHOUETTE = `
  M 150 18
  C 170 18 178 30 178 45 C 178 58 170 68 162 72
  L 165 75 C 168 78 170 82 170 85 L 170 92
  C 180 95 195 100 205 108 C 215 116 220 122 222 128
  L 235 168 C 238 178 240 190 242 200 L 248 260
  C 250 272 248 282 244 288 L 240 285
  C 238 278 235 268 232 258 L 222 200
  C 220 192 218 185 215 180 L 205 150
  C 200 140 198 135 196 130 L 192 120
  C 188 118 185 120 183 125 L 180 140
  C 178 148 176 155 175 162 L 173 180
  C 172 195 172 210 172 225 L 172 250
  C 172 265 174 280 178 295 C 182 310 185 320 186 330
  L 186 340 C 185 348 182 355 180 365 L 178 395
  C 176 410 175 425 175 435 L 176 460
  C 176 475 177 490 178 500 L 180 530
  C 181 540 182 548 184 555 C 186 562 190 566 192 570
  L 192 572 C 190 576 185 578 178 578
  C 172 578 170 575 168 570 L 168 555
  C 167 548 166 540 166 530 L 164 500
  C 163 490 162 475 162 460 L 162 435
  C 162 425 161 410 160 400 L 157 370
  C 155 358 153 348 152 340 L 150 330 L 148 340
  C 147 348 145 358 143 370 L 140 400
  C 139 410 138 425 138 435 L 138 460
  C 138 475 137 490 136 500 L 134 530
  C 134 540 133 548 132 555 L 132 570
  C 130 575 128 578 122 578 C 115 578 110 576 108 572
  L 108 570 C 110 566 114 562 116 555
  C 118 548 119 540 120 530 L 122 500
  C 123 490 124 475 124 460 L 124 435
  C 125 425 124 410 122 395 L 120 365
  C 118 355 115 348 114 340 L 114 330
  C 115 320 118 310 122 295 C 126 280 128 265 128 250
  L 128 225 C 128 210 128 195 127 180 L 125 162
  C 124 155 122 148 120 140 L 117 125
  C 115 120 112 118 108 120 L 104 130
  C 102 135 100 140 95 150 L 85 180
  C 82 185 80 192 78 200 L 68 258
  C 65 268 62 278 60 285 L 56 288
  C 52 282 50 272 52 260 L 58 200
  C 60 190 62 178 65 168 L 78 128
  C 80 122 85 116 95 108 C 105 100 120 95 130 92
  L 130 85 C 130 82 132 78 135 75 L 138 72
  C 130 68 122 58 122 45 C 122 30 130 18 150 18 Z
`;

function BodyOutline({ side, uid }: { side: 'front' | 'back'; uid: string }) {
  const bodyColor = 'hsl(var(--muted-foreground))';
  return (
    <g>
      <defs>
        <radialGradient id={`skin-${uid}`} cx="50%" cy="30%" r="70%">
          <stop offset="0%" stopColor={bodyColor} stopOpacity="0.05" />
          <stop offset="100%" stopColor={bodyColor} stopOpacity="0.10" />
        </radialGradient>
        <clipPath id={`body-clip-${uid}`}>
          <path d={FRONT_SILHOUETTE} />
        </clipPath>
        <filter id={`glow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Body fill */}
      <path d={FRONT_SILHOUETTE} fill={`url(#skin-${uid})`} stroke={bodyColor} strokeWidth="1.5" opacity="0.45" />

      {/* Anatomical detail lines */}
      {side === 'front' && (
        <g opacity="0.18" stroke={bodyColor} fill="none">
          <path d="M 115 100 Q 135 94 150 97 Q 165 94 185 100" strokeWidth="0.8" />
          <path d="M 150 104 L 150 118" strokeWidth="0.5" strokeDasharray="2,3" />
          <line x1="150" y1="97" x2="150" y2="318" strokeWidth="0.4" strokeDasharray="2,6" />
          <circle cx="150" cy="215" r="3.5" strokeWidth="0.7" />
          <path d="M 118 238 Q 150 232 182 238" strokeWidth="0.5" strokeDasharray="3,4" />
          <path d="M 116 289 Q 150 283 184 289" strokeWidth="0.5" strokeDasharray="3,4" />
          <path d="M 118 295 Q 130 302 130 312 Q 130 322 128 332" strokeWidth="0.5" />
          <path d="M 182 295 Q 170 302 170 312 Q 170 322 172 332" strokeWidth="0.5" />
          <ellipse cx="128" cy="431" rx="9" ry="11" strokeWidth="0.6" />
          <ellipse cx="172" cy="431" rx="9" ry="11" strokeWidth="0.6" />
        </g>
      )}
      {side === 'back' && (
        <g opacity="0.18" stroke={bodyColor} fill="none">
          <line x1="150" y1="72" x2="150" y2="295" strokeWidth="0.9" strokeDasharray="3,3" />
          {[90,105,120,135,150,165,180,195,210,225,245,265,280].map(y => (
            <line key={y} x1="147" y1={y} x2="153" y2={y} strokeWidth="1" />
          ))}
          <path d="M 118 120 Q 112 130 115 148 Q 122 155 130 150 Q 136 142 132 128 Q 128 118 118 120" strokeWidth="0.8" />
          <path d="M 182 120 Q 188 130 185 148 Q 178 155 170 150 Q 164 142 168 128 Q 172 118 182 120" strokeWidth="0.8" />
          <path d="M 132 300 Q 150 313 168 300" strokeWidth="0.7" />
          <circle cx="142" cy="274" r="2.5" strokeWidth="0.5" />
          <circle cx="158" cy="274" r="2.5" strokeWidth="0.5" />
          <line x1="126" y1="518" x2="124" y2="552" strokeWidth="0.6" />
          <line x1="174" y1="518" x2="176" y2="552" strokeWidth="0.6" />
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
