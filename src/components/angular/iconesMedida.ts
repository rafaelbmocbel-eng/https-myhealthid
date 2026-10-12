import { Anchor, Bone, Compass, DraftingCompass, Footprints, GitCommitHorizontal, Gauge, MoveDiagonal, MoveHorizontal, MoveVertical, PersonStanding, Ruler, Scaling, Scan, Slash, Spline, Triangle, TriangleRight, type LucideIcon } from 'lucide-react';
import { MEDIDAS } from '@/lib/angular/medidas';

// Ícone de cada ferramenta de medida na barra ao lado da foto ou do vídeo.
export const ICONE_MEDIDA: Record<string, LucideIcon> = {
  ombros: MoveHorizontal, pelve: GitCommitHorizontal, cabeca: Scan, tronco: PersonStanding, cva: Compass, 'tronco-perfil': Slash,
  'joelho-d': Bone, 'joelho-e': Bone, joelho: Bone, 'quadril-d': GitCommitHorizontal, 'quadril-e': GitCommitHorizontal,
  'tornozelo-d': Triangle, 'tornozelo-e': Triangle,
  livre: Triangle, reta: MoveDiagonal, cobb: Spline, regua: Ruler, nivel: Gauge, escala: Scaling,
  compasso: DraftingCompass, 'compasso-ref': TriangleRight, 'prumo-perfil': Anchor, 'prumo-frente': Anchor, altura: MoveVertical,
  'angulo-q-d': Bone, 'angulo-q-e': Bone, 'retrope-d': Footprints, 'retrope-e': Footprints, 'pelve-perfil': GitCommitHorizontal, 'protracao-ombro': MoveDiagonal,
};

// Letra do lado (direito/esquerdo) mostrada sobre o ícone.
export const LADO_MEDIDA: Record<string, string> = {
  'joelho-d': 'D', 'joelho-e': 'E', 'quadril-d': 'D', 'quadril-e': 'E', 'tornozelo-d': 'D', 'tornozelo-e': 'E',
  'angulo-q-d': 'D', 'angulo-q-e': 'E', 'retrope-d': 'D', 'retrope-e': 'E',
};

export const COR_REFERENCIA: Record<string, string> = Object.fromEntries(MEDIDAS.flatMap((m) => (m.corReferencia ? [[m.id, m.corReferencia]] : [])));
