import { useState, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, X } from 'lucide-react';

// ---- Catálogo de estruturas por região ----
type StructCat = 'musculos' | 'articulacoes' | 'ligamentos' | 'nervos' | 'vertebras';
const CAT_LABEL: Record<StructCat, string> = {
  musculos: 'Músculos',
  articulacoes: 'Articulações',
  ligamentos: 'Ligamentos',
  nervos: 'Nervos',
  vertebras: 'Nível Vertebral',
};
const CAT_EMOJI: Record<StructCat, string> = {
  musculos: '💪', articulacoes: '🦴', ligamentos: '🔗', nervos: '⚡', vertebras: '🦴',
};

type RegionStructures = Partial<Record<StructCat, string[]>>;
export const STRUCTURES: Record<string, RegionStructures> = {
  cabeca: { musculos: ['Temporal', 'Masseter', 'Frontal'], articulacoes: ['ATM'], nervos: ['Trigêmeo', 'Occipital'] },
  pescoco: { musculos: ['ECOM', 'Escalenos', 'Suboccipitais'], articulacoes: ['C1-C7'], nervos: ['Plexo cervical'] },
  cervical: { musculos: ['Suboccipitais', 'Esplênio', 'Semiespinhal'], articulacoes: ['Facetas C2-C7'], nervos: ['Raízes C5-C8'], vertebras: ['C2', 'C3', 'C4', 'C5', 'C6', 'C7'] },
  ombro_d: { musculos: ['Deltoide', 'Supraespinhal', 'Infraespinhal', 'Subescapular', 'Redondo menor'], articulacoes: ['Glenoumeral', 'AC', 'EC'], ligamentos: ['Coracoacromial', 'Glenoumerais'], nervos: ['Axilar', 'Supraescapular'] },
  ombro_e: { musculos: ['Deltoide', 'Supraespinhal', 'Infraespinhal', 'Subescapular', 'Redondo menor'], articulacoes: ['Glenoumeral', 'AC', 'EC'], ligamentos: ['Coracoacromial', 'Glenoumerais'], nervos: ['Axilar', 'Supraescapular'] },
  trapezio_d: { musculos: ['Trapézio sup.', 'Levantador da escápula', 'Romboide'], articulacoes: ['Escápulo-torácica'], nervos: ['Acessório', 'Dorsal da escápula'] },
  trapezio_e: { musculos: ['Trapézio sup.', 'Levantador da escápula', 'Romboide'], articulacoes: ['Escápulo-torácica'], nervos: ['Acessório', 'Dorsal da escápula'] },
  peitoral: { musculos: ['Peitoral maior', 'Peitoral menor', 'Intercostais'], articulacoes: ['Costoesternais', 'Costocondrais'] },
  abdomen: { musculos: ['Reto abdominal', 'Oblíquos', 'Transverso'], nervos: ['Intercostais T7-T12'] },
  pelve: { musculos: ['Iliopsoas', 'Piriforme', 'Assoalho pélvico'], articulacoes: ['Sacroilíaca', 'Sínfise púbica'], ligamentos: ['Sacrotuberoso', 'Sacroespinhoso'] },
  dorsal: { musculos: ['Latíssimo', 'Eretores da espinha', 'Romboides'], articulacoes: ['Facetas T1-T12'], vertebras: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'] },
  lombar: { musculos: ['Multífidos', 'Quadrado lombar', 'Eretores'], articulacoes: ['Facetas L1-L5', 'L5-S1'], nervos: ['Raízes L1-L5'], vertebras: ['L1', 'L2', 'L3', 'L4', 'L5', 'S1 (Sacro)', 'Cóccix'] },
  gluteos: { musculos: ['Glúteo máx.', 'Glúteo méd.', 'Glúteo mín.', 'Piriforme'], nervos: ['Ciático', 'Glúteo sup.'] },
  braco_d: { musculos: ['Bíceps', 'Braquial', 'Coracobraquial'], nervos: ['Musculocutâneo', 'Mediano'] },
  braco_e: { musculos: ['Bíceps', 'Braquial', 'Coracobraquial'], nervos: ['Musculocutâneo', 'Mediano'] },
  braco_p_d: { musculos: ['Tríceps (3 cabeças)', 'Ancôneo'], nervos: ['Radial'] },
  braco_p_e: { musculos: ['Tríceps (3 cabeças)', 'Ancôneo'], nervos: ['Radial'] },
  cotovelo_d: { articulacoes: ['Úmero-ulnar', 'Úmero-radial', 'Rádio-ulnar prox.'], ligamentos: ['Colateral medial', 'Colateral lateral', 'Anular'], nervos: ['Ulnar', 'Mediano', 'Radial'] },
  cotovelo_e: { articulacoes: ['Úmero-ulnar', 'Úmero-radial', 'Rádio-ulnar prox.'], ligamentos: ['Colateral medial', 'Colateral lateral', 'Anular'], nervos: ['Ulnar', 'Mediano', 'Radial'] },
  cotovelo_p_d: { articulacoes: ['Úmero-ulnar', 'Úmero-radial', 'Rádio-ulnar prox.'], ligamentos: ['Colateral medial', 'Colateral lateral', 'Anular'], nervos: ['Ulnar', 'Mediano', 'Radial'] },
  cotovelo_p_e: { articulacoes: ['Úmero-ulnar', 'Úmero-radial', 'Rádio-ulnar prox.'], ligamentos: ['Colateral medial', 'Colateral lateral', 'Anular'], nervos: ['Ulnar', 'Mediano', 'Radial'] },
  antebraco_d: { musculos: ['Flexores', 'Extensores', 'Pronador redondo', 'Supinador'], nervos: ['Mediano', 'Radial', 'Ulnar'] },
  antebraco_e: { musculos: ['Flexores', 'Extensores', 'Pronador redondo', 'Supinador'], nervos: ['Mediano', 'Radial', 'Ulnar'] },
  antebr_p_d: { musculos: ['Flexores', 'Extensores', 'Pronador redondo', 'Supinador'], nervos: ['Mediano', 'Radial', 'Ulnar'] },
  antebr_p_e: { musculos: ['Flexores', 'Extensores', 'Pronador redondo', 'Supinador'], nervos: ['Mediano', 'Radial', 'Ulnar'] },
  mao_d: { musculos: ['Tenares', 'Hipotenares', 'Lumbricais'], articulacoes: ['Punho', 'MCF', 'IFP', 'IFD'], ligamentos: ['Colaterais', 'Túnel do carpo'], nervos: ['Mediano', 'Ulnar', 'Radial'] },
  mao_e: { musculos: ['Tenares', 'Hipotenares', 'Lumbricais'], articulacoes: ['Punho', 'MCF', 'IFP', 'IFD'], ligamentos: ['Colaterais', 'Túnel do carpo'], nervos: ['Mediano', 'Ulnar', 'Radial'] },
  mao_p_d: { musculos: ['Tenares', 'Hipotenares', 'Lumbricais'], articulacoes: ['Punho', 'MCF', 'IFP', 'IFD'], ligamentos: ['Colaterais', 'Túnel do carpo'], nervos: ['Mediano', 'Ulnar', 'Radial'] },
  mao_p_e: { musculos: ['Tenares', 'Hipotenares', 'Lumbricais'], articulacoes: ['Punho', 'MCF', 'IFP', 'IFD'], ligamentos: ['Colaterais', 'Túnel do carpo'], nervos: ['Mediano', 'Ulnar', 'Radial'] },
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

export const REGIONS: Region[] = [
  // ===== FRONT =====
  { id: 'cabeca',       label: 'Cabeça',          view: 'front', cx: 120, cy: 50,
    d: 'M 120 22 C 104 22 90 32 88 48 C 86 64 94 76 106 82 C 112 85 120 87 120 87 C 120 87 128 85 134 82 C 146 76 154 64 152 48 C 150 32 136 22 120 22 Z' },
  { id: 'pescoco',      label: 'Pescoço',          view: 'front', cx: 120, cy: 100,
    d: 'M 108 90 L 110 108 L 130 108 L 132 90 Z' },
  { id: 'ombro_d',      label: 'Ombro D',          view: 'front', cx: 72,  cy: 140,
    d: 'M 106 108 L 58 134 C 50 144 50 160 58 168 C 66 174 78 172 86 166 C 96 158 100 146 102 132 L 106 116 Z' },
  { id: 'ombro_e',      label: 'Ombro E',          view: 'front', cx: 168, cy: 140,
    d: 'M 134 108 L 182 134 C 190 144 190 160 182 168 C 174 174 162 172 154 166 C 144 158 140 146 138 132 L 134 116 Z' },
  { id: 'peitoral',     label: 'Tórax',            view: 'front', cx: 120, cy: 155,
    d: 'M 110 108 L 102 148 C 96 164 90 178 88 196 C 100 202 110 204 120 204 C 130 204 140 202 152 196 C 150 178 144 164 138 148 L 130 108 Z' },
  { id: 'abdomen',      label: 'Abdômen',          view: 'front', cx: 120, cy: 238,
    d: 'M 88 196 L 84 282 L 116 282 L 124 282 L 156 282 L 152 196 C 140 202 130 204 120 204 C 110 204 100 202 88 196 Z' },
  { id: 'pelve',        label: 'Pelve',            view: 'front', cx: 120, cy: 296,
    d: 'M 84 282 C 88 294 98 306 112 312 L 128 312 C 142 306 152 294 156 282 L 124 282 L 116 282 Z' },
  { id: 'braco_d',      label: 'Braço D',          view: 'front', cx: 52,  cy: 200,
    d: 'M 58 134 L 40 230 L 56 232 C 60 214 64 196 70 178 C 76 162 84 148 90 140 Z' },
  { id: 'cotovelo_d',   label: 'Cotovelo D',       view: 'front', cx: 46,  cy: 228,
    d: 'M 34 228 A 12 14 0 1 0 58 228 A 12 14 0 1 0 34 228 Z' },
  { id: 'antebraco_d',  label: 'Antebraço D',      view: 'front', cx: 44,  cy: 265,
    d: 'M 40 230 L 36 280 L 52 282 L 56 232 Z' },
  { id: 'mao_d',        label: 'Mão D',            view: 'front', cx: 44,  cy: 296,
    d: 'M 36 280 L 36 308 L 52 308 L 52 282 Z' },
  { id: 'braco_e',      label: 'Braço E',          view: 'front', cx: 188, cy: 200,
    d: 'M 182 134 L 200 230 L 184 232 C 180 214 176 196 170 178 C 164 162 156 148 150 140 Z' },
  { id: 'cotovelo_e',   label: 'Cotovelo E',       view: 'front', cx: 194, cy: 228,
    d: 'M 182 228 A 12 14 0 1 0 206 228 A 12 14 0 1 0 182 228 Z' },
  { id: 'antebraco_e',  label: 'Antebraço E',      view: 'front', cx: 196, cy: 265,
    d: 'M 200 230 L 184 232 L 188 282 L 204 280 Z' },
  { id: 'mao_e',        label: 'Mão E',            view: 'front', cx: 196, cy: 296,
    d: 'M 188 282 L 188 308 L 204 308 L 204 280 Z' },
  { id: 'coxa_d',       label: 'Coxa D',           view: 'front', cx: 95,  cy: 322,
    d: 'M 84 282 L 78 360 L 112 360 L 116 282 Z' },
  { id: 'joelho_d',     label: 'Joelho D',         view: 'front', cx: 95,  cy: 378,
    d: 'M78 378 A17 18 0 1 0 112 378 A17 18 0 1 0 78 378 Z' },
  { id: 'canela_d',     label: 'Perna D',          view: 'front', cx: 95,  cy: 400,
    d: 'M 78 360 L 82 440 L 108 440 L 112 360 Z' },
  { id: 'pe_d',         label: 'Pé D',             view: 'front', cx: 95,  cy: 472,
    d: 'M 82 440 L 86 504 L 106 500 L 108 440 Z' },
  { id: 'coxa_e',       label: 'Coxa E',           view: 'front', cx: 145, cy: 322,
    d: 'M 124 282 L 128 360 L 162 360 L 156 282 Z' },
  { id: 'joelho_e',     label: 'Joelho E',         view: 'front', cx: 145, cy: 378,
    d: 'M128 378 A17 18 0 1 0 162 378 A17 18 0 1 0 128 378 Z' },
  { id: 'canela_e',     label: 'Perna E',          view: 'front', cx: 145, cy: 400,
    d: 'M 128 360 L 132 440 L 158 440 L 162 360 Z' },
  { id: 'pe_e',         label: 'Pé E',             view: 'front', cx: 145, cy: 472,
    d: 'M 132 440 L 134 500 L 154 504 L 158 440 Z' },

  // ===== BACK =====
  { id: 'occipital',    label: 'Crânio Post.',     view: 'back',  cx: 120, cy: 50,
    d: 'M 120 22 C 104 22 90 32 88 48 C 86 64 94 76 106 82 C 112 85 120 87 120 87 C 120 87 128 85 134 82 C 146 76 154 64 152 48 C 150 32 136 22 120 22 Z' },
  { id: 'cervical',     label: 'Cervical',         view: 'back',  cx: 120, cy: 100,
    d: 'M 108 90 L 110 108 L 130 108 L 132 90 Z' },
  { id: 'trapezio_d',   label: 'Trapézio / Dorso D', view: 'back', cx: 158, cy: 190,
    d: 'M 180 168 L 162 238 L 128 238 L 128 124 C 140 136 154 152 180 168 Z' },
  { id: 'trapezio_e',   label: 'Trapézio / Dorso E', view: 'back', cx: 82,  cy: 190,
    d: 'M 60 168 L 78 238 L 112 238 L 112 124 C 100 136 86 152 60 168 Z' },
  { id: 'dorsal',       label: 'Dorsal',           view: 'back',  cx: 120, cy: 190,
    d: 'M 112 124 L 128 124 L 162 238 L 78 238 Z' },
  { id: 'lombar',       label: 'Lombar',           view: 'back',  cx: 120, cy: 258,
    d: 'M 78 238 L 84 280 L 156 280 L 162 238 L 128 238 L 112 238 Z' },
  { id: 'gluteos',      label: 'Glúteos',          view: 'back',  cx: 120, cy: 275,
    d: 'M84 248 C 84 242 86 238 90 238 C 100 238 112 242 120 248 C 128 242 140 238 150 238 C 154 238 156 242 156 248 C 156 262 150 278 140 290 C 132 300 124 306 120 308 C 116 306 108 300 100 290 C 90 278 84 262 84 248 Z' },
  { id: 'braco_p_d',    label: 'Braço Post. D',   view: 'back',  cx: 178, cy: 195,
    d: 'M 180 132 L 200 230 L 184 232 C 180 214 176 196 170 178 C 164 162 156 148 150 140 Z' },
  { id: 'cotovelo_p_d', label: 'Cotovelo D',       view: 'back',  cx: 200, cy: 228,
    d: 'M 188 228 A 12 14 0 1 0 212 228 A 12 14 0 1 0 188 228 Z' },
  { id: 'antebr_p_d',   label: 'Antebraço Post. D', view: 'back', cx: 196, cy: 256,
    d: 'M 200 230 L 184 232 L 188 282 L 204 280 Z' },
  { id: 'mao_p_d',      label: 'Mão Post. D',     view: 'back',  cx: 196, cy: 296,
    d: 'M 188 282 L 188 308 L 204 308 L 204 280 Z' },
  { id: 'braco_p_e',    label: 'Braço Post. E',   view: 'back',  cx: 62,  cy: 195,
    d: 'M 60 132 L 40 230 L 56 232 C 60 214 64 196 70 178 C 76 162 84 148 90 140 Z' },
  { id: 'cotovelo_p_e', label: 'Cotovelo E',       view: 'back',  cx: 40,  cy: 228,
    d: 'M 28 228 A 12 14 0 1 0 52 228 A 12 14 0 1 0 28 228 Z' },
  { id: 'antebr_p_e',   label: 'Antebraço Post. E', view: 'back', cx: 44,  cy: 256,
    d: 'M 40 230 L 36 280 L 52 282 L 56 232 Z' },
  { id: 'mao_p_e',      label: 'Mão Post. E',     view: 'back',  cx: 44,  cy: 296,
    d: 'M 36 280 L 36 308 L 52 308 L 52 282 Z' },
  { id: 'isquio_d',     label: 'Coxa Post. D',    view: 'back',  cx: 144, cy: 320,
    d: 'M 124 280 L 128 360 L 162 360 L 156 280 Z' },
  { id: 'cavo_d',       label: 'Poplíteo D',       view: 'back',  cx: 144, cy: 378,
    d: 'M127 378 A17 18 0 1 0 161 378 A17 18 0 1 0 127 378 Z' },
  { id: 'panturr_d',    label: 'Panturrilha D',    view: 'back',  cx: 144, cy: 400,
    d: 'M 128 360 L 132 440 L 158 440 L 162 360 Z' },
  { id: 'calc_d',       label: 'Calcanhar D',      view: 'back',  cx: 144, cy: 472,
    d: 'M 132 440 L 134 500 L 154 504 L 158 440 Z' },
  { id: 'isquio_e',     label: 'Coxa Post. E',    view: 'back',  cx: 96,  cy: 320,
    d: 'M 84 280 L 78 360 L 112 360 L 116 280 Z' },
  { id: 'cavo_e',       label: 'Poplíteo E',       view: 'back',  cx: 96,  cy: 378,
    d: 'M79 378 A17 18 0 1 0 113 378 A17 18 0 1 0 79 378 Z' },
  { id: 'panturr_e',    label: 'Panturrilha E',    view: 'back',  cx: 96,  cy: 400,
    d: 'M 78 360 L 82 440 L 108 440 L 112 360 Z' },
  { id: 'calc_e',       label: 'Calcanhar E',      view: 'back',  cx: 96,  cy: 472,
    d: 'M 82 440 L 86 504 L 106 500 L 108 440 Z' },
];

interface Props {
  value?: Record<string, number>;
  onChange?: (map: Record<string, number>) => void;
  structures?: RegionStructState;
  onStructuresChange?: (s: RegionStructState) => void;
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
  const glowId = `body-glow-${view}`;
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
          <radialGradient id={gradId} cx="48%" cy="28%" r="65%">
            <stop offset="0%"   stopColor="hsl(var(--muted-foreground))" stopOpacity="0.06" />
            <stop offset="60%"  stopColor="hsl(var(--muted-foreground))" stopOpacity="0.10" />
            <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.18" />
          </radialGradient>
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Ground shadow */}
        <ellipse cx={120} cy={516} rx={44} ry={3.5} fill="hsl(var(--foreground))" opacity={0.07} />

        {/* Body silhouette fill */}
        <path d={FRONT_OUTLINE} fill={`url(#${gradId})`} stroke="none" />

        {/* Anatomical detail lines */}
        <g fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth={0.55} opacity={0.22} clipPath={`url(#${clipId})`}>
          {view === 'front' ? (
            <>
              <path d="M120 108 L120 288" />
              <path d="M96 136 Q 110 148 120 142 Q 130 148 144 136" strokeWidth={0.7} />
              <path d="M120 188 L120 238" />
              <path d="M103 200 L137 200" />
              <path d="M103 218 L137 218" />
              <path d="M103 228 L137 228" />
              <circle cx={120} cy={210} r={3} strokeWidth={0.6} />
              <path d="M94 244 Q 120 238 146 244" strokeDasharray="3,3" />
              <path d="M90 280 Q 120 274 150 280" strokeDasharray="3,3" />
              <ellipse cx={144} cy={380} rx={11} ry={7} strokeWidth={0.6} />
              <ellipse cx={96}  cy={380} rx={11} ry={7} strokeWidth={0.6} />
            </>
          ) : (
            <>
              <path d="M120 108 L120 288" strokeDasharray="3,3" strokeWidth={0.8} />
              {[130,148,166,184,202,220,240,258,276].map(y => (
                <line key={y} x1={116} y1={y} x2={124} y2={y} strokeWidth={0.9} />
              ))}
              <path d="M96 148 Q 108 166 112 186" />
              <path d="M144 148 Q 132 166 128 186" />
              <path d="M112 244 Q 120 256 128 244" strokeWidth={0.7} />
              <circle cx={112} cy={278} r={2.5} />
              <circle cx={128} cy={278} r={2.5} />
              <path d="M144 432 Q 150 454 145 480" />
              <path d="M96  432 Q 90  454 95  480" />
            </>
          )}
        </g>

        {/* Clickable regions */}
        <g clipPath={`url(#${clipId})`}>
          {regions.map((r) => {
            const v = points[r.id] ?? 0;
            const isSel = selected === r.id;
            const color = v > 0 ? intensityColor(v) : 'transparent';
            return (
              <g key={r.id}>
                {v > 0 && (
                  <path d={r.d} fill={color} fillOpacity={0.15} />
                )}
                <path
                  d={r.d}
                  fill={color}
                  fillOpacity={v > 0 ? 0.60 : 0.001}
                  stroke={isSel ? 'hsl(var(--primary))' : v > 0 ? color : 'transparent'}
                  strokeWidth={isSel ? 2 : v > 0 ? 0.8 : 0}
                  filter={v > 0 ? `url(#${glowId})` : undefined}
                  pointerEvents="all"
                  onClick={() => onSelect(r.id)}
                  style={{ cursor: 'pointer' }}
                  className="transition-all duration-200 hover:brightness-110"
                />
              </g>
            );
          })}
        </g>

        {/* Crisp outline on top */}
        <path
          d={FRONT_OUTLINE}
          fill="none"
          stroke="hsl(var(--foreground))"
          strokeWidth={1.4}
          strokeLinejoin="round"
          opacity={0.55}
          pointerEvents="none"
        />

        {/* Score badges */}
        {regions.map((r) => {
          const v = points[r.id] ?? 0;
          if (v <= 0) return null;
          const color = intensityColor(v);
          return (
            <g key={`l-${r.id}`} pointerEvents="none">
              <circle cx={r.cx} cy={r.cy} r={10} fill={color} opacity={0.92} />
              <circle cx={r.cx} cy={r.cy} r={10} fill="none" stroke="white" strokeWidth={1.2} opacity={0.6} />
              <text x={r.cx} y={r.cy + 3.5} textAnchor="middle" fontSize={9} fontWeight={900} fill="white">
                {v}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function Body3DAvatar({ value, onChange, structures, onStructuresChange }: Props) {
  const [internal, setInternal] = useState<Record<string, number>>(value ?? {});
  const points = value ?? internal;
  const [selected, setSelected] = useState<string | null>(null);
  const [internalStruct, setInternalStruct] = useState<RegionStructState>(structures ?? {});
  const struct = structures ?? internalStruct;
  const [customInput, setCustomInput] = useState('');

  const updateStruct = (next: RegionStructState) => {
    setInternalStruct(next);
    onStructuresChange?.(next);
  };

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
    updateStruct({});
    setSelected(null);
  };

  const toggleStructure = (regionId: string, name: string) => {
    const list = struct[regionId] ?? [];
    const next = list.includes(name) ? list.filter(s => s !== name) : [...list, name];
    updateStruct({ ...struct, [regionId]: next });
  };

  const addCustomStructure = () => {
    const v = customInput.trim();
    if (!v || !selected) return;
    const list = struct[selected] ?? [];
    if (!list.includes(v)) updateStruct({ ...struct, [selected]: [...list, v] });
    setCustomInput('');
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

          {/* ── Estruturas acometidas (aparece após escolher a região) ── */}
          {selectedIntensity > 0 && (
            <div className="pt-3 mt-2 border-t border-border space-y-3">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                Estruturas acometidas
              </p>
              {(() => {
                const baseId = selected!.replace(/_p_/, '_').replace(/_p$/, '');
                const cat = STRUCTURES[selected!] ?? STRUCTURES[baseId] ?? {};
                const cats = Object.keys(cat) as StructCat[];
                const selList = struct[selected!] ?? [];
                return (
                  <>
                    {cats.length === 0 && (
                      <p className="text-[11px] text-muted-foreground italic">
                        Sem catálogo pré-definido. Adicione abaixo.
                      </p>
                    )}
                    {cats.map(c => (
                      <div key={c}>
                        <p className="text-[11px] font-semibold mb-1 flex items-center gap-1">
                          <span>{CAT_EMOJI[c]}</span> {CAT_LABEL[c]}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {(cat[c] ?? []).map(name => {
                            const isSel = selList.includes(name);
                            return (
                              <button
                                key={name}
                                type="button"
                                onClick={() => toggleStructure(selected!, name)}
                                className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                                  isSel
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background border-border hover:border-primary/50'
                                }`}
                              >
                                {name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    {/* Custom adicionados (que não estão no catálogo) */}
                    {(() => {
                      const known = new Set(cats.flatMap(c => cat[c] ?? []));
                      const extras = selList.filter(s => !known.has(s));
                      if (!extras.length) return null;
                      return (
                        <div>
                          <p className="text-[11px] font-semibold mb-1">✏️ Outros</p>
                          <div className="flex flex-wrap gap-1">
                            {extras.map(name => (
                              <button
                                key={name}
                                type="button"
                                onClick={() => toggleStructure(selected!, name)}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground border border-primary inline-flex items-center gap-1"
                              >
                                {name} <X className="h-2.5 w-2.5" />
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    {/* Input livre */}
                    <div className="flex gap-1.5 pt-1">
                      <Input
                        value={customInput}
                        onChange={(e) => setCustomInput(e.target.value)}
                        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCustomStructure();
                          }
                        }}
                        placeholder="Outra estrutura…"
                        className="h-8 text-[11px]"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addCustomStructure}
                        className="h-8 px-2"
                      >
                        <Plus className="icon-sm" />
                      </Button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
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
