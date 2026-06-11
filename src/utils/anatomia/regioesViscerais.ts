
export interface OrganRegion {
  id: string;
  label: string;
  view: 'front' | 'back';
  sistemas: string[];
  d: string;
}

export const VISCERAL_REGIONS: OrganRegion[] = [
  // ===== FRONT =====
  // SISTEMA ENDÓCRINO
  {
    id: 'tireoide',
    label: 'Tireoide',
    view: 'front',
    sistemas: ['endocrino', 'visceral'],
    d: 'M112 98 Q120 102 128 98 L126 104 Q120 108 114 104 Z'
  },
  {
    id: 'hipofise',
    label: 'Hipófise',
    view: 'front',
    sistemas: ['endocrino'],
    d: 'M119 45 A1.5 1.5 0 1 0 121 45 A1.5 1.5 0 1 0 119 45'
  },
  {
    id: 'adrenais',
    label: 'Suprarrenais',
    view: 'front',
    sistemas: ['endocrino'],
    d: 'M110 200 Q112 195 115 200 M125 200 Q128 195 130 200'
  },
  {
    id: 'pancreas',
    label: 'Pâncreas',
    view: 'front',
    sistemas: ['endocrino', 'digestorio'],
    d: 'M105 208 Q120 205 135 210 L132 215 Q118 212 106 215 Z'
  },

  // SISTEMA RESPIRATÓRIO
  {
    id: 'traqueia',
    label: 'Traqueia',
    view: 'front',
    sistemas: ['respiratorio'],
    d: 'M118 108 L118 130 L122 130 L122 108 Z'
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

  // SISTEMA CIRCULATÓRIO
  {
    id: 'coracao',
    label: 'Coração',
    view: 'front',
    sistemas: ['circulatorio', 'visceral'],
    d: 'M118 148 C115 142 125 140 132 145 C140 150 135 165 125 168 C115 165 112 155 118 148 Z'
  },
  {
    id: 'carotida_d',
    label: 'Artéria Carótida D',
    view: 'front',
    sistemas: ['circulatorio'],
    d: 'M112 90 L110 108'
  },
  {
    id: 'carotida_e',
    label: 'Artéria Carótida E',
    view: 'front',
    sistemas: ['circulatorio'],
    d: 'M128 90 L130 108'
  },
  {
    id: 'aorta_abdominal',
    label: 'Aorta Abdominal',
    view: 'front',
    sistemas: ['circulatorio'],
    d: 'M118 185 L118 245'
  },

  // SISTEMA DIGESTÓRIO
  {
    id: 'esofago',
    label: 'Esôfago',
    view: 'front',
    sistemas: ['digestorio'],
    d: 'M119 108 L119 188 L121 188 L121 108 Z'
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
    id: 'vesicula_biliar',
    label: 'Vesícula Biliar',
    view: 'front',
    sistemas: ['digestorio'],
    d: 'M108 205 A2 3 0 1 0 112 205 A2 3 0 1 0 108 205'
  },
  {
    id: 'intestino',
    label: 'Intestinos',
    view: 'front',
    sistemas: ['digestorio', 'visceral'],
    d: 'M95 215 L145 215 C150 235 145 255 120 258 C95 255 90 235 95 215 Z'
  },

  // SISTEMA URINÁRIO
  {
    id: 'bexiga',
    label: 'Bexiga',
    view: 'front',
    sistemas: ['urinario', 'visceral'],
    d: 'M110 265 Q120 260 130 265 Q130 275 120 280 Q110 275 110 265 Z'
  },

  // SISTEMA LINFÁTICO
  {
    id: 'linfonodos_cervicais',
    label: 'Linfonodos Cervicais',
    view: 'front',
    sistemas: ['linfatico'],
    d: 'M102 95 A2 2 0 1 0 106 95 A2 2 0 1 0 102 95 M134 95 A2 2 0 1 0 138 95 A2 2 0 1 0 134 95'
  },
  {
    id: 'linfonodos_axilares_d',
    label: 'Linfonodos Axilares D',
    view: 'front',
    sistemas: ['linfatico'],
    d: 'M155 130 A2.5 2.5 0 1 0 160 130 A2.5 2.5 0 1 0 155 130 M158 138 A2 2 0 1 0 162 138 A2 2 0 1 0 158 138'
  },
  {
    id: 'linfonodos_axilares_e',
    label: 'Linfonodos Axilares E',
    view: 'front',
    sistemas: ['linfatico'],
    d: 'M80 130 A2.5 2.5 0 1 0 85 130 A2.5 2.5 0 1 0 80 130 M78 138 A2 2 0 1 0 82 138 A2 2 0 1 0 78 138'
  },
  {
    id: 'baco',
    label: 'Baço',
    view: 'front',
    sistemas: ['linfatico', 'visceral'],
    d: 'M152 185 Q158 190 155 200 Q148 205 145 195 Q145 185 152 185'
  },
  {
    id: 'linfonodos_inguinais',
    label: 'Linfonodos Inguinais',
    view: 'front',
    sistemas: ['linfatico'],
    d: 'M100 285 A2.5 2.5 0 1 0 105 285 A2.5 2.5 0 1 0 100 285 M135 285 A2.5 2.5 0 1 0 140 285 A2.5 2.5 0 1 0 135 285'
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
  // Endócrino
  tireoide: { 
    glandulas: ['Lobo direito', 'Lobo esquerdo', 'Istmo'],
    hormonios: ['T3', 'T4', 'Calcitonina']
  },
  hipofise: {
    lobos: ['Adeno-hipófise (anterior)', 'Neuro-hipófise (posterior)'],
    hormonios: ['GH', 'TSH', 'ACTH', 'FSH', 'LH', 'Prolactina', 'ADH', 'Ocitocina']
  },
  adrenais: {
    partes: ['Córtex adrenal', 'Medula adrenal'],
    hormonios: ['Cortisol', 'Aldosterona', 'Adrenalina', 'Noradrenalina']
  },
  pancreas: {
    partes: ['Cabeça', 'Corpo', 'Cauda', 'Processo uncinado'],
    exocrino: ['Ducto pancreático', 'Ácinos pancreáticos'],
    endocrino: ['Ilhotas de Langerhans (Insulina, Glucagon)']
  },

  // Respiratório
  traqueia: { partes: ['Anéis cartilaginosos', 'Carina', 'Mucosa respiratória'] },
  pulmao_d: { 
    lobos: ['Superior', 'Médio', 'Inferior'],
    segmentos: ['Apical', 'Posterior', 'Anterior', 'Lateral', 'Medial', 'Basais'],
    pleura: ['Visceral', 'Parietal'] 
  },
  pulmao_e: { 
    lobos: ['Superior', 'Inferior'],
    segmentos: ['Apical-posterior', 'Anterior', 'Lingular superior', 'Lingular inferior', 'Basais'],
    pleura: ['Visceral', 'Parietal'] 
  },

  // Circulatório
  coracao: { 
    cavidades: ['Átrio D', 'Átrio E', 'Ventrículo D', 'Ventrículo E'],
    valvas: ['Mitral (Bicúspide)', 'Tricúspide', 'Aórtica', 'Pulmonar'],
    vasos: ['Aorta ascendente', 'Arco aórtico', 'Tronco pulmonar', 'Veias pulmonares', 'Veia cava superior', 'Veia cava inferior'],
    coronarias: ['Coronária direita', 'Coronária esquerda', 'Ramo descendente anterior', 'Ramo circunflexo']
  },
  carotida_d: { segmentos: ['Carótida comum', 'Carótida interna', 'Carótida externa', 'Seio carotídeo'] },
  carotida_e: { segmentos: ['Carótida comum', 'Carótida interna', 'Carótida externa', 'Seio carotídeo'] },
  aorta_abdominal: { 
    segmentos: ['Suprarrenal', 'Infrarrenal'],
    ramos: ['Tronco celíaco', 'Artéria mesentérica superior', 'Artérias renais', 'Artéria mesentérica inferior', 'Artérias ilíacas comuns'] 
  },

  // Digestório
  esofago: { segmentos: ['Cervical', 'Torácico', 'Abdominal'], esfincteres: ['Esfíncter superior', 'Esfíncter inferior (Cárdia)'] },
  figado: { 
    lobos: ['Direito', 'Esquerdo', 'Caudado', 'Quadrado'],
    ligamentos: ['Falciforme', 'Redondo', 'Coronário'],
    vasos: ['Veia porta', 'Artéria hepática', 'Veias hepáticas']
  },
  vesicula_biliar: { partes: ['Fundo', 'Corpo', 'Pescoço'], ductos: ['Ducto cístico', 'Ducto colédoco'] },
  estomago: { 
    partes: ['Cárdia', 'Fundo', 'Corpo', 'Antro', 'Piloro'],
    curvaturas: ['Grande curvatura', 'Pequena curvatura'],
    camadas: ['Mucosa', 'Submucosa', 'Muscular', 'Serosa']
  },
  intestino: { 
    delgado: ['Duodeno', 'Jejuno', 'Íleo'],
    grosso: ['Ceco', 'Apêndice', 'Cólon ascendente', 'Cólon transverso', 'Cólon descendente', 'Cólon sigmoide', 'Reto', 'Ânus'],
    valvas: ['Válvula ileocecal']
  },

  // Urinário
  rim_d: { partes: ['Córtex renal', 'Medula renal', 'Pirâmides renais', 'Cálices maiores/menores', 'Pelve renal', 'Ureter'] },
  rim_e: { partes: ['Córtex renal', 'Medula renal', 'Pirâmides renais', 'Cálices maiores/menores', 'Pelve renal', 'Ureter'] },
  bexiga: { partes: ['Ápice', 'Corpo', 'Fundo', 'Trígono vesical', 'Colo da bexiga', 'Músculo detrusor'] },

  // Linfático
  linfonodos_cervicais: { grupos: ['Submentonianos', 'Submandibulares', 'Cervicais anteriores', 'Cervicais laterais', 'Supraclaviculares'] },
  linfonodos_axilares_d: { grupos: ['Peitorais (anteriores)', 'Subescapulares (posteriores)', 'Humerais (laterais)', 'Centrais', 'Apicais'] },
  linfonodos_axilares_e: { grupos: ['Peitorais (anteriores)', 'Subescapulares (posteriores)', 'Humerais (laterais)', 'Centrais', 'Apicais'] },
  baco: { partes: ['Polpa branca (linfóide)', 'Polpa vermelha', 'Cápsula', 'Hilo esplênico'] },
  linfonodos_inguinais: { grupos: ['Superficiais (horizontais/verticais)', 'Profundos'] }
};
