
export interface OrganRegion {
  id: string;
  label: string;
  view: 'front' | 'back';
  sistemas: string[];
  d: string;
}

export const VISCERAL_REGIONS: OrganRegion[] = [
  // ===== FRONT =====
  {
    id: 'tireoide',
    label: 'Tireoide',
    view: 'front',
    sistemas: ['endocrino', 'visceral'],
    d: 'M112 98 Q120 102 128 98 L126 104 Q120 108 114 104 Z'
  },
  {
    id: 'pulmao_e',
    label: 'Pulmão Esquerdo',
    view: 'front',
    sistemas: ['respiratorio', 'visceral'],
    d: 'M125 135 C135 132 150 135 152 155 C154 175 140 180 128 178 Q125 155 125 135 Z'
  },
  {
    id: 'pulmao_d',
    label: 'Pulmão Direito',
    view: 'front',
    sistemas: ['respiratorio', 'visceral'],
    d: 'M115 135 C105 132 90 135 88 155 C86 175 100 180 112 178 Q115 155 115 135 Z'
  },
  {
    id: 'coracao',
    label: 'Coração',
    view: 'front',
    sistemas: ['circulatorio', 'visceral'],
    d: 'M118 148 C115 142 125 140 132 145 C140 150 135 165 125 168 C115 165 112 155 118 148 Z'
  },
  {
    id: 'figado',
    label: 'Fígado',
    view: 'front',
    sistemas: ['digestorio', 'visceral'],
    d: 'M88 188 C100 185 120 190 125 205 L115 212 C100 215 85 205 88 188 Z'
  },
  {
    id: 'estomago',
    label: 'Estômago',
    view: 'front',
    sistemas: ['digestorio', 'visceral'],
    d: 'M128 190 C140 188 152 195 150 210 C148 220 135 215 128 205 Z'
  },
  {
    id: 'intestino',
    label: 'Intestinos',
    view: 'front',
    sistemas: ['digestorio', 'visceral'],
    d: 'M95 215 L145 215 C150 235 145 255 120 258 C95 255 90 235 95 215 Z'
  },
  {
    id: 'bexiga',
    label: 'Bexiga',
    view: 'front',
    sistemas: ['urinario', 'visceral'],
    d: 'M110 265 Q120 260 130 265 Q130 275 120 280 Q110 275 110 265 Z'
  },
  // ===== BACK =====
  {
    id: 'rim_d',
    label: 'Rim Direito',
    view: 'back',
    sistemas: ['urinario', 'visceral'],
    d: 'M98 205 Q105 200 112 205 Q115 215 112 225 Q105 230 98 225 Q95 215 98 205 Z'
  },
  {
    id: 'rim_e',
    label: 'Rim Esquerdo',
    view: 'back',
    sistemas: ['urinario', 'visceral'],
    d: 'M128 205 Q135 200 142 205 Q145 215 142 225 Q135 230 128 225 Q125 215 128 205 Z'
  }
];

export const VISCERAL_STRUCTURES: Record<string, any> = {
  tireoide: { glandulas: ['Lobo direito', 'Lobo esquerdo', 'Istmo'] },
  pulmao_d: { lobos: ['Superior', 'Médio', 'Inferior'], pleura: ['Visceral', 'Parietal'] },
  pulmao_e: { lobos: ['Superior', 'Inferior'], pleura: ['Visceral', 'Parietal'] },
  coracao: { cavidades: ['Átrio D', 'Átrio E', 'Ventrículo D', 'Ventrículo E'], valvas: ['Mitral', 'Tricúspide', 'Aórtica', 'Pulmonar'] },
  figado: { lobos: ['Direito', 'Esquerdo', 'Caudado', 'Quadrado'], vesicula: ['Vesícula biliar'] },
  estomago: { partes: ['Cárdia', 'Fundo', 'Corpo', 'Antro', 'Piloro'] },
  intestino: { partes: ['Duodeno', 'Jejuno', 'Íleo', 'Ceco', 'Cólon ascendente', 'Cólon transverso', 'Cólon descendente', 'Reto'] },
  rim_d: { partes: ['Córtex', 'Medula', 'Pelve renal', 'Ureter'] },
  rim_e: { partes: ['Córtex', 'Medula', 'Pelve renal', 'Ureter'] },
  bexiga: { partes: ['Detrusor', 'Trígono'] }
};
