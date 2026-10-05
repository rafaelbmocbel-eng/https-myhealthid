import { Bone, Compass, GitCommitHorizontal, Gauge, MoveDiagonal, MoveHorizontal, PersonStanding, Ruler, Scaling, Scan, Slash, Spline, Triangle, type LucideIcon } from 'lucide-react';

// Ícone de cada ferramenta de medida na barra ao lado da foto ou do vídeo.
export const ICONE_MEDIDA: Record<string, LucideIcon> = {
  ombros: MoveHorizontal, pelve: GitCommitHorizontal, cabeca: Scan, tronco: PersonStanding, cva: Compass, 'tronco-perfil': Slash,
  'joelho-d': Bone, 'joelho-e': Bone, joelho: Bone, 'quadril-d': GitCommitHorizontal, 'quadril-e': GitCommitHorizontal,
  'tornozelo-d': Triangle, 'tornozelo-e': Triangle,
  livre: Triangle, reta: MoveDiagonal, cobb: Spline, regua: Ruler, nivel: Gauge, escala: Scaling,
};

// Letra do lado (direito/esquerdo) mostrada sobre o ícone.
export const LADO_MEDIDA: Record<string, string> = {
  'joelho-d': 'D', 'joelho-e': 'E', 'quadril-d': 'D', 'quadril-e': 'E', 'tornozelo-d': 'D', 'tornozelo-e': 'E',
};

export const COR_REFERENCIA: Record<string, string> = { nivel: '#22d3ee', escala: '#fb923c' };
