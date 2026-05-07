import { useState, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, X } from 'lucide-react';

// ---- Catálogo de estruturas por região ----
type StructCat = 'musculos' | 'articulacoes' | 'ligamentos' | 'nervos';
const CAT_LABEL: Record<StructCat, string> = {
  musculos: 'Músculos',
  articulacoes: 'Articulações',
  ligamentos: 'Ligamentos',
  nervos: 'Nervos',
};
const CAT_EMOJI: Record<StructCat, string> = {
  musculos: '💪', articulacoes: '🦴', ligamentos: '🔗', nervos: '⚡',
};

type RegionStructures = Partial<Record<StructCat, string[]>>;
const STRUCTURES: Record<string, RegionStructures> = {
  cabeca: { musculos: ['Temporal', 'Masseter', 'Frontal'], articulacoes: ['ATM'], nervos: ['Trigêmeo', 'Occipital'] },
  pescoco: { musculos: ['ECOM', 'Escalenos', 'Suboccipitais'], articulacoes: ['C1-C7'], nervos: ['Plexo cervical'] },
  cervical: { musculos: ['Suboccipitais', 'Esplênio', 'Semiespinhal'], articulacoes: ['Facetas C2-C7'], nervos: ['Raízes C5-C8'] },
  ombro_d: { musculos: ['Deltoide', 'Supraespinhal', 'Infraespinhal', 'Subescapular', 'Redondo menor'], articulacoes: ['Glenoumeral', 'AC', 'EC'], ligamentos: ['Coracoacromial', 'Glenoumerais'], nervos: ['Axilar', 'Supraescapular'] },
  ombro_e: { musculos: ['Deltoide', 'Supraespinhal', 'Infraespinhal', 'Subescapular', 'Redondo menor'], articulacoes: ['Glenoumeral', 'AC', 'EC'], ligamentos: ['Coracoacromial', 'Glenoumerais'], nervos: ['Axilar', 'Supraescapular'] },
  trapezio_d: { musculos: ['Trapézio sup.', 'Levantador da escápula', 'Romboide'], articulacoes: ['Escápulo-torácica'], nervos: ['Acessório', 'Dorsal da escápula'] },
  trapezio_e: { musculos: ['Trapézio sup.', 'Levantador da escápula', 'Romboide'], articulacoes: ['Escápulo-torácica'], nervos: ['Acessório', 'Dorsal da escápula'] },
  peitoral: { musculos: ['Peitoral maior', 'Peitoral menor', 'Intercostais'], articulacoes: ['Costoesternais', 'Costocondrais'] },
  abdomen: { musculos: ['Reto abdominal', 'Oblíquos', 'Transverso'], nervos: ['Intercostais T7-T12'] },
  pelve: { musculos: ['Iliopsoas', 'Piriforme', 'Assoalho pélvico'], articulacoes: ['Sacroilíaca', 'Sínfise púbica'], ligamentos: ['Sacrotuberoso', 'Sacroespinhoso'] },
  dorsal: { musculos: ['Latíssimo', 'Eretores da espinha', 'Romboides'], articulacoes: ['Facetas T1-T12'] },
  lombar: { musculos: ['Multífidos', 'Quadrado lombar', 'Eretores'], articulacoes: ['Facetas L1-L5', 'L5-S1'], nervos: ['Raízes L1-L5'] },
  gluteos: { musculos: ['Glúteo máx.', 'Glúteo méd.', 'Glúteo mín.', 'Piriforme'], nervos: ['Ciático', 'Glúteo sup.'] },
  braco_d: { musculos: ['Bíceps', 'Braquial', 'Coracobraquial'], nervos: ['Musculocutâneo', 'Mediano'] },
  braco_e: { musculos: ['Bíceps', 'Braquial', 'Coracobraquial'], nervos: ['Musculocutâneo', 'Mediano'] },
  braco_p_d: { musculos: ['Tríceps (3 cabeças)', 'Ancôneo'], nervos: ['Radial'] },
  braco_p_e: { musculos: ['Tríceps (3 cabeças)', 'Ancôneo'], nervos: ['Radial'] },
  cotovelo_d: { articulacoes: ['Úmero-ulnar', 'Úmero-radial', 'Rádio-ulnar prox.'], ligamentos: ['Colateral medial', 'Colateral lateral', 'Anular'], nervos: ['Ulnar', 'Mediano', 'Radial'] },
  cotovelo_e: { articulacoes: ['Úmero-ulnar', 'Úmero-radial', 'Rádio-ulnar prox.'], ligamentos: ['Colateral medial', 'Colateral lateral', 'Anular'], nervos: ['Ulnar', 'Mediano', 'Radial'] },
  cotovelo_p_d: { articulacoes: ['Úmero-ulnar'], ligamentos: ['Colaterais'], nervos: ['Ulnar'] },
  cotovelo_p_e: { articulacoes: ['Úmero-ulnar'], ligamentos: ['Colaterais'], nervos: ['Ulnar'] },
  antebraco_d: { musculos: ['Flexores', 'Extensores', 'Pronador redondo', 'Supinador'], nervos: ['Mediano', 'Radial', 'Ulnar'] },
  antebraco_e: { musculos: ['Flexores', 'Extensores', 'Pronador redondo', 'Supinador'], nervos: ['Mediano', 'Radial', 'Ulnar'] },
  antebr_p_d: { musculos: ['Extensores'], nervos: ['Radial'] },
  antebr_p_e: { musculos: ['Extensores'], nervos: ['Radial'] },
  mao_d: { musculos: ['Tenares', 'Hipotenares', 'Lumbricais'], articulacoes: ['Punho', 'MCF', 'IFP', 'IFD'], ligamentos: ['Colaterais', 'Túnel do carpo'], nervos: ['Mediano', 'Ulnar', 'Radial'] },
  mao_e: { musculos: ['Tenares', 'Hipotenares', 'Lumbricais'], articulacoes: ['Punho', 'MCF', 'IFP', 'IFD'], ligamentos: ['Colaterais', 'Túnel do carpo'], nervos: ['Mediano', 'Ulnar', 'Radial'] },
  mao_p_d: { articulacoes: ['Punho', 'Carpo'], nervos: ['Radial'] },
  mao_p_e: { articulacoes: ['Punho', 'Carpo'], nervos: ['Radial'] },
  coxa_d: { musculos: ['Quadríceps', 'Adutores', 'Sartório', 'TFL'], nervos: ['Femoral', 'Obturador'] },
  coxa_e: { musculos: ['Quadríceps', 'Adutores', 'Sartório', 'TFL'], nervos: ['Femoral', 'Obturador'] },
  isquio_d: { musculos: ['Bíceps femoral', 'Semitendíneo', 'Semimembranoso'], nervos: ['Ciático'] },
  isquio_e: { musculos: ['Bíceps femoral', 'Semitendíneo', 'Semimembranoso'], nervos: ['Ciático'] },
  joelho_d: { articulacoes: ['Tíbio-femoral', 'Patelo-femoral'], ligamentos: ['LCA', 'LCP', 'LCM', 'LCL', 'Menisco medial', 'Menisco lateral'], nervos: ['Fibular comum'] },
  joelho_e: { articulacoes: ['Tíbio-femoral', 'Patelo-femoral'], ligamentos: ['LCA', 'LCP', 'LCM', 'LCL', 'Menisco medial', 'Menisco lateral'], nervos: ['Fibular comum'] },
  cavo_d: { musculos: ['Poplíteo', 'Gastrocnêmio (origem)'], ligamentos: ['LCP'], nervos: ['Tibial'] },
  cavo_e: { musculos: ['Poplíteo', 'Gastrocnêmio (origem)'], ligamentos: ['LCP'], nervos: ['Tibial'] },
  canela_d: { musculos: ['Tibial anterior', 'Fibulares', 'Extensores dos dedos'], nervos: ['Fibular profundo', 'Fibular superficial'] },
  canela_e: { musculos: ['Tibial anterior', 'Fibulares', 'Extensores dos dedos'], nervos: ['Fibular profundo', 'Fibular superficial'] },
  panturr_d: { musculos: ['Gastrocnêmio', 'Sóleo', 'Tibial posterior'], ligamentos: ['Tendão de Aquiles'], nervos: ['Tibial', 'Sural'] },
  panturr_e: { musculos: ['Gastrocnêmio', 'Sóleo', 'Tibial posterior'], ligamentos: ['Tendão de Aquiles'], nervos: ['Tibial', 'Sural'] },
  pe_d: { musculos: ['Intrínsecos', 'Flexor curto'], articulacoes: ['Tornozelo', 'Subtalar', 'MTF'], ligamentos: ['Talofibular ant.', 'Calcaneofibular', 'Deltoide', 'Fáscia plantar'], nervos: ['Tibial', 'Plantar'] },
  pe_e: { musculos: ['Intrínsecos', 'Flexor curto'], articulacoes: ['Tornozelo', 'Subtalar', 'MTF'], ligamentos: ['Talofibular ant.', 'Calcaneofibular', 'Deltoide', 'Fáscia plantar'], nervos: ['Tibial', 'Plantar'] },
  calc_d: { ligamentos: ['Tendão de Aquiles', 'Fáscia plantar'], articulacoes: ['Subtalar'] },
  calc_e: { ligamentos: ['Tendão de Aquiles', 'Fáscia plantar'], articulacoes: ['Subtalar'] },
  occipital: { musculos: ['Suboccipitais', 'Trapézio sup.'], nervos: ['Occipital maior', 'Occipital menor'] },
};
type RegionStructState = Record<string, string[]>; // regionId -> selected structure names

function intensityColor(i: number): string {
  if (i <= 0) return 'hsl(var(--muted))';
  if (i <= 3) return '#22c55e';
  if (i <= 6) return '#eab308';
  if (i <= 8) return '#f97316';
  return '#ef4444';
}

interface Region {
  id: string;
  label: string;
  view: 'front' | 'back';
  d: string;
  cx: number;
  cy: number;
}

/**
 * Anatomical silhouette — smooth, human-like proportions on a 240x520 viewBox.
 * Body parts are drawn with cubic bezier curves to look like a real human outline,
 * and clickable region paths tile the body without gaps.
 */

// Outline of the FRONT body (used as silhouette and clipPath)
const FRONT_OUTLINE =
  'M120 18 ' +
  'C 138 18 152 34 152 54 ' +              // head right
  'C 152 70 144 84 132 90 ' +              // jaw right
  'L 134 104 ' +                            // neck right
  'C 156 110 178 118 184 132 ' +           // shoulder right top
  'L 192 168 ' +                            // upper arm out
  'L 200 230 ' +                            // forearm out
  'L 204 280 ' +                            // wrist
  'L 196 308 L 188 308 L 184 282 ' +       // hand bottom + back
  'L 176 232 L 168 178 ' +                  // arm inside up
  'L 160 168 L 158 220 L 156 280 ' +       // ribcage to hip right
  'L 162 360 L 158 430 L 152 500 ' +       // leg right outside
  'L 138 506 L 134 500 L 132 430 ' +       // foot R + leg back
  'L 128 360 L 124 280 ' +                  // groin right
  'L 116 280 L 112 360 L 108 430 ' +       // groin left → leg left
  'L 106 500 L 102 506 L 88 500 ' +        // foot L
  'L 82 430 L 78 360 L 84 280 ' +           // leg left outside
  'L 82 220 L 80 168 L 72 178 ' +           // hip left to ribcage
  'L 64 232 L 56 282 L 52 308 ' +           // forearm L
  'L 44 308 L 36 280 L 40 230 ' +           // hand L
  'L 48 168 L 56 132 ' +                    // upper arm L
  'C 62 118 84 110 106 104 ' +             // shoulder L
  'L 108 90 ' +                             // neck L
  'C 96 84 88 70 88 54 ' +                  // jaw L
  'C 88 34 102 18 120 18 Z';

const REGIONS: Region[] = [
  // ===== FRONT =====
  // Head
  { id: 'cabeca',       label: 'Cabeça',       view: 'front', cx: 120, cy: 50,
    d: 'M88 54 C 88 34 102 18 120 18 C 138 18 152 34 152 54 C 152 70 144 84 132 90 L108 90 C 96 84 88 70 88 54 Z' },
  // Neck
  { id: 'pescoco',      label: 'Pescoço',      view: 'front', cx: 120, cy: 100,
    d: 'M108 90 L132 90 L134 108 L106 108 Z' },
  // Shoulders
  { id: 'ombro_d',      label: 'Ombro D',      view: 'front', cx: 158, cy: 122,
    d: 'M134 108 C 156 110 178 118 184 132 L 168 144 L 152 130 Z' },
  { id: 'ombro_e',      label: 'Ombro E',      view: 'front', cx: 82,  cy: 122,
    d: 'M106 108 C 84 110 62 118 56 132 L 72 144 L 88 130 Z' },
  // Chest
  { id: 'peitoral',     label: 'Tórax',        view: 'front', cx: 120, cy: 152,
    d: 'M88 130 L152 130 L168 144 L160 184 L80 184 L72 144 Z' },
  // Abdomen
  { id: 'abdomen',      label: 'Abdômen',      view: 'front', cx: 120, cy: 210,
    d: 'M80 184 L160 184 L162 240 L78 240 Z' },
  // Pelvis
  { id: 'pelve',        label: 'Pelve',        view: 'front', cx: 120, cy: 264,
    d: 'M78 240 L162 240 L156 290 L84 290 Z' },
  // Right arm (anatomically — viewer's left)
  { id: 'braco_d',      label: 'Braço D',      view: 'front', cx: 178, cy: 168,
    d: 'M184 132 L192 168 L176 184 L168 144 Z' },
  { id: 'cotovelo_d',   label: 'Cotovelo D',   view: 'front', cx: 184, cy: 200,
    d: 'M192 168 L200 230 L182 224 L176 184 Z' },
  { id: 'antebraco_d',  label: 'Antebraço D',  view: 'front', cx: 192, cy: 250,
    d: 'M200 230 L204 280 L188 280 L182 224 Z' },
  { id: 'mao_d',        label: 'Mão D',        view: 'front', cx: 192, cy: 296,
    d: 'M204 280 L196 308 L184 308 L188 280 Z' },
  // Left arm (viewer's right)
  { id: 'braco_e',      label: 'Braço E',      view: 'front', cx: 62,  cy: 168,
    d: 'M56 132 L48 168 L64 184 L72 144 Z' },
  { id: 'cotovelo_e',   label: 'Cotovelo E',   view: 'front', cx: 56,  cy: 200,
    d: 'M48 168 L40 230 L58 224 L64 184 Z' },
  { id: 'antebraco_e',  label: 'Antebraço E',  view: 'front', cx: 48,  cy: 250,
    d: 'M40 230 L36 280 L52 280 L58 224 Z' },
  { id: 'mao_e',        label: 'Mão E',        view: 'front', cx: 48,  cy: 296,
    d: 'M36 280 L44 308 L56 308 L52 280 Z' },
  // Right thigh (viewer's left)
  { id: 'coxa_d',       label: 'Coxa D',       view: 'front', cx: 144, cy: 330,
    d: 'M124 290 L156 290 L162 360 L128 360 Z' },
  { id: 'joelho_d',     label: 'Joelho D',     view: 'front', cx: 144, cy: 380,
    d: 'M128 360 L162 360 L160 400 L130 400 Z' },
  { id: 'canela_d',     label: 'Canela D',     view: 'front', cx: 144, cy: 450,
    d: 'M130 400 L160 400 L158 490 L134 490 Z' },
  { id: 'pe_d',         label: 'Pé D',         view: 'front', cx: 144, cy: 502,
    d: 'M134 490 L158 490 L152 510 L138 510 Z' },
  // Left thigh
  { id: 'coxa_e',       label: 'Coxa E',       view: 'front', cx: 96,  cy: 330,
    d: 'M84 290 L116 290 L112 360 L78 360 Z' },
  { id: 'joelho_e',     label: 'Joelho E',     view: 'front', cx: 96,  cy: 380,
    d: 'M78 360 L112 360 L110 400 L80 400 Z' },
  { id: 'canela_e',     label: 'Canela E',     view: 'front', cx: 96,  cy: 450,
    d: 'M80 400 L110 400 L106 490 L82 490 Z' },
  { id: 'pe_e',         label: 'Pé E',         view: 'front', cx: 96,  cy: 502,
    d: 'M82 490 L106 490 L102 510 L88 510 Z' },

  // ===== BACK ===== (mirror anatomical labels)
  { id: 'occipital',    label: 'Nuca',         view: 'back', cx: 120, cy: 50,
    d: 'M88 54 C 88 34 102 18 120 18 C 138 18 152 34 152 54 C 152 70 144 84 132 90 L108 90 C 96 84 88 70 88 54 Z' },
  { id: 'cervical',     label: 'Cervical',     view: 'back', cx: 120, cy: 100,
    d: 'M108 90 L132 90 L134 108 L106 108 Z' },
  { id: 'trapezio_d',   label: 'Trapézio D',   view: 'back', cx: 158, cy: 122,
    d: 'M134 108 C 156 110 178 118 184 132 L 168 144 L 152 130 Z' },
  { id: 'trapezio_e',   label: 'Trapézio E',   view: 'back', cx: 82,  cy: 122,
    d: 'M106 108 C 84 110 62 118 56 132 L 72 144 L 88 130 Z' },
  { id: 'dorsal',       label: 'Dorsal',       view: 'back', cx: 120, cy: 160,
    d: 'M88 130 L152 130 L168 144 L162 184 L78 184 L72 144 Z' },
  { id: 'lombar',       label: 'Lombar',       view: 'back', cx: 120, cy: 212,
    d: 'M78 184 L162 184 L160 240 L80 240 Z' },
  { id: 'gluteos',      label: 'Glúteos',      view: 'back', cx: 120, cy: 264,
    d: 'M80 240 L160 240 L156 290 L84 290 Z' },
  { id: 'braco_p_d',    label: 'Tríceps D',    view: 'back', cx: 178, cy: 168,
    d: 'M184 132 L192 168 L176 184 L168 144 Z' },
  { id: 'cotovelo_p_d', label: 'Cotovelo D',   view: 'back', cx: 184, cy: 200,
    d: 'M192 168 L200 230 L182 224 L176 184 Z' },
  { id: 'antebr_p_d',   label: 'Antebraço D',  view: 'back', cx: 192, cy: 250,
    d: 'M200 230 L204 280 L188 280 L182 224 Z' },
  { id: 'mao_p_d',      label: 'Mão D',        view: 'back', cx: 192, cy: 296,
    d: 'M204 280 L196 308 L184 308 L188 280 Z' },
  { id: 'braco_p_e',    label: 'Tríceps E',    view: 'back', cx: 62,  cy: 168,
    d: 'M56 132 L48 168 L64 184 L72 144 Z' },
  { id: 'cotovelo_p_e', label: 'Cotovelo E',   view: 'back', cx: 56,  cy: 200,
    d: 'M48 168 L40 230 L58 224 L64 184 Z' },
  { id: 'antebr_p_e',   label: 'Antebraço E',  view: 'back', cx: 48,  cy: 250,
    d: 'M40 230 L36 280 L52 280 L58 224 Z' },
  { id: 'mao_p_e',      label: 'Mão E',        view: 'back', cx: 48,  cy: 296,
    d: 'M36 280 L44 308 L56 308 L52 280 Z' },
  { id: 'isquio_d',     label: 'Isquiotibial D', view: 'back', cx: 144, cy: 330,
    d: 'M124 290 L156 290 L162 360 L128 360 Z' },
  { id: 'cavo_d',       label: 'Poplíteo D',   view: 'back', cx: 144, cy: 380,
    d: 'M128 360 L162 360 L160 400 L130 400 Z' },
  { id: 'panturr_d',    label: 'Panturrilha D', view: 'back', cx: 144, cy: 450,
    d: 'M130 400 L160 400 L158 490 L134 490 Z' },
  { id: 'calc_d',       label: 'Calcanhar D',  view: 'back', cx: 144, cy: 502,
    d: 'M134 490 L158 490 L152 510 L138 510 Z' },
  { id: 'isquio_e',     label: 'Isquiotibial E', view: 'back', cx: 96, cy: 330,
    d: 'M84 290 L116 290 L112 360 L78 360 Z' },
  { id: 'cavo_e',       label: 'Poplíteo E',   view: 'back', cx: 96,  cy: 380,
    d: 'M78 360 L112 360 L110 400 L80 400 Z' },
  { id: 'panturr_e',    label: 'Panturrilha E', view: 'back', cx: 96, cy: 450,
    d: 'M80 400 L110 400 L106 490 L82 490 Z' },
  { id: 'calc_e',       label: 'Calcanhar E',  view: 'back', cx: 96,  cy: 502,
    d: 'M82 490 L106 490 L102 510 L88 510 Z' },
];

interface Props {
  value?: Record<string, number>;
  onChange?: (map: Record<string, number>) => void;
}

function BodyView({
  view,
  points,
  selected,
  onSelect,
}: {
  view: 'front' | 'back';
  points: Record<string, number>;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const regions = REGIONS.filter(r => r.view === view);
  const clipId = `body-clip-${view}`;
  const gradId = `body-grad-${view}`;
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground text-center mb-1">
        {view === 'front' ? 'Anterior' : 'Posterior'}
      </p>
      <svg viewBox="0 0 240 520" className="w-full h-auto" style={{ maxHeight: 420 }}>
        <defs>
          <clipPath id={clipId}>
            <path d={FRONT_OUTLINE} />
          </clipPath>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="hsl(var(--muted))" stopOpacity="0.55" />
            <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity="0.30" />
          </linearGradient>
        </defs>

        {/* Soft shadow under figure */}
        <ellipse cx={120} cy={515} rx={48} ry={4} fill="hsl(var(--foreground))" opacity={0.08} />

        {/* Body silhouette */}
        <path
          d={FRONT_OUTLINE}
          fill={`url(#${gradId})`}
          stroke="hsl(var(--border))"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />

        {/* Subtle anatomical hint lines (purely decorative) */}
        <g
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={0.6}
          opacity={0.5}
          clipPath={`url(#${clipId})`}
        >
          {view === 'front' ? (
            <>
              {/* center line */}
              <path d="M120 108 L120 290" />
              {/* pectoral curves */}
              <path d="M92 152 Q 110 168 120 158" />
              <path d="M148 152 Q 130 168 120 158" />
              {/* abs */}
              <path d="M120 188 L120 238" />
              <path d="M104 200 L136 200" />
              <path d="M104 218 L136 218" />
              {/* knee caps */}
              <ellipse cx={144} cy={380} rx={10} ry={6} />
              <ellipse cx={96}  cy={380} rx={10} ry={6} />
            </>
          ) : (
            <>
              {/* spine */}
              <path d="M120 108 L120 290" />
              {/* scapulae */}
              <path d="M96 144 Q 110 160 116 180" />
              <path d="M144 144 Q 130 160 124 180" />
              {/* gluteal cleft */}
              <path d="M120 244 L120 286" />
              {/* calves */}
              <path d="M144 430 Q 150 450 144 480" />
              <path d="M96  430 Q 90  450 96  480" />
            </>
          )}
        </g>

        {/* Clickable regions (clipped to silhouette so they look anatomical) */}
        <g clipPath={`url(#${clipId})`}>
          {regions.map((r) => {
            const v = points[r.id] ?? 0;
            const isSel = selected === r.id;
            return (
              <path
                key={r.id}
                d={r.d}
                fill={v > 0 ? intensityColor(v) : '#000'}
                fillOpacity={v > 0 ? 0.55 : 0.001}
                stroke={isSel ? 'hsl(var(--primary))' : 'transparent'}
                strokeWidth={isSel ? 1.8 : 0}
                pointerEvents="all"
                onClick={() => onSelect(r.id)}
                style={{ cursor: 'pointer' }}
              />
            );
          })}
        </g>

        {/* Outline overlay so the silhouette edge stays crisp above colored regions */}
        <path
          d={FRONT_OUTLINE}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={1.2}
          strokeLinejoin="round"
          pointerEvents="none"
        />

        {/* Score labels for active regions */}
        {regions.map((r) => {
          const v = points[r.id] ?? 0;
          if (v <= 0) return null;
          return (
            <g key={`l-${r.id}`} pointerEvents="none">
              <circle cx={r.cx} cy={r.cy} r={9} fill="white" opacity={0.9} />
              <text
                x={r.cx}
                y={r.cy + 3}
                textAnchor="middle"
                fontSize={10}
                fontWeight={800}
                fill={intensityColor(v)}
              >
                {v}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function Body3DAvatar({ value, onChange }: Props) {
  const [internal, setInternal] = useState<Record<string, number>>(value ?? {});
  const points = value ?? internal;
  const [selected, setSelected] = useState<string | null>(null);

  const update = (map: Record<string, number>) => {
    setInternal(map);
    onChange?.(map);
  };

  const handleSelect = (id: string) => {
    setSelected(id);
    if (!points[id]) update({ ...points, [id]: 5 });
  };

  const setIntensity = (key: string, v: number) => {
    const next = { ...points };
    if (v <= 0) delete next[key];
    else next[key] = v;
    update(next);
  };

  const clearAll = () => {
    update({});
    setSelected(null);
  };

  const selectedRegion = REGIONS.find(r => r.id === selected);
  const selectedIntensity = selected ? points[selected] ?? 0 : 0;
  const active = Object.entries(points).filter(([, v]) => v > 0);

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl border border-border bg-gradient-to-b from-muted/10 to-background p-3">
        <div className="flex gap-2 items-start">
          <BodyView view="front" points={points} selected={selected} onSelect={handleSelect} />
          <BodyView view="back"  points={points} selected={selected} onSelect={handleSelect} />
        </div>
        {active.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="absolute top-3 right-3 h-7 text-[10px] gap-1"
            onClick={clearAll}
          >
            <Trash2 className="h-3 w-3" /> Limpar
          </Button>
        )}
      </div>

      {selected && selectedRegion ? (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">
                Região · {selectedRegion.view === 'front' ? 'anterior' : 'posterior'}
              </p>
              <p className="font-bold text-sm">{selectedRegion.label}</p>
            </div>
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center text-white font-black text-sm"
              style={{ background: intensityColor(selectedIntensity) }}
            >
              {selectedIntensity}
            </div>
          </div>
          <Slider
            value={[selectedIntensity]}
            min={0}
            max={10}
            step={1}
            onValueChange={(v) => setIntensity(selected, v[0])}
          />
          <div className="grid grid-cols-11 gap-1">
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                type="button"
                onClick={() => setIntensity(selected, n)}
                className={`h-8 rounded-md text-[11px] font-bold border transition-all ${
                  selectedIntensity === n
                    ? 'text-white border-transparent scale-105 shadow'
                    : 'bg-background text-foreground border-border hover:bg-muted'
                }`}
                style={
                  selectedIntensity === n
                    ? { background: intensityColor(n) }
                    : undefined
                }
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Sem dor</span>
            <span>Insuportável</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center">
          Toque numa região do corpo para registrar a intensidade da dor (0–10).
        </p>
      )}

      {active.length > 0 && (
        <div className="rounded-xl border border-border bg-muted/20 p-3">
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">
            Regiões com dor ({active.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {active
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => {
                const r = REGIONS.find(x => x.id === k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSelected(k)}
                    className="px-2 py-1 rounded-full text-[10px] font-bold text-white inline-flex items-center gap-1"
                    style={{ background: intensityColor(v) }}
                  >
                    {r?.label ?? k} · {v}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

export function painMapToText(map: Record<string, number>): string {
  const entries = Object.entries(map).filter(([, v]) => v > 0);
  if (!entries.length) return '';
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const lines = sorted.map(([k, v]) => {
    const r = REGIONS.find(x => x.id === k);
    const view = r?.view === 'back' ? ' (post.)' : '';
    return `- ${r?.label ?? k}${view}: ${v}/10`;
  });
  return `Mapa de dor:\n${lines.join('\n')}`;
}
