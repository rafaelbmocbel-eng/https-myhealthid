
export interface OrganRegion {
  id: string;
  label: string;
  view: 'front' | 'back';
  sistemas: string[];
  d: string;
}

/**
 * Anatomical Regions with precise SVG paths based on standard anatomical position (240x520 viewbox)
 */
export const VISCERAL_REGIONS: OrganRegion[] = [
  // ===== FRONT =====
  
  // ENDOCRINE
  {
    id: 'tireoide',
    label: 'Tireoide',
    view: 'front',
    sistemas: ['endocrino', ],
    d: 'M112 98 Q120 102 128 98 L126 104 Q120 108 114 104 Z'
  },
  {
    id: 'hipofise',
    label: 'Hipófise',
    view: 'front',
    sistemas: ['endocrino'],
    d: 'M119 44 A1.5 1.5 0 1 0 121 44 A1.5 1.5 0 1 0 119 44'
  },
  {
    id: 'adrenais',
    label: 'Suprarrenais',
    view: 'front',
    sistemas: ['endocrino'],
    d: 'M108 200 Q112 196 116 201 M124 201 Q128 196 132 200'
  },
  {
    id: 'pancreas',
    label: 'Pâncreas',
    view: 'front',
    sistemas: ['endocrino', 'digestorio'],
    d: 'M105 212 C108 208 125 205 138 210 L136 218 C120 215 110 218 105 212'
  },

  // RESPIRATORY
  {
    id: 'traqueia',
    label: 'Traqueia',
    view: 'front',
    sistemas: ['respiratorio'],
    d: 'M118 102 L118 132 Q120 134 122 132 L122 102 Z'
  },
  {
    id: 'pulmao_d',
    label: 'Pulmão Direito',
    view: 'front',
    sistemas: ['respiratorio', ],
    d: 'M115 135 C100 130 85 140 82 170 C80 200 95 215 118 212 Q115 170 115 135'
  },
  {
    id: 'pulmao_e',
    label: 'Pulmão Esquerdo',
    view: 'front',
    sistemas: ['respiratorio', ],
    d: 'M125 135 C140 130 155 140 158 170 C160 200 145 215 122 212 Q125 170 125 135'
  },

  // CIRCULATORY
  {
    id: 'coracao',
    label: 'Coração',
    view: 'front',
    sistemas: ['circulatorio', ],
    d: 'M120 145 C110 145 105 160 120 175 C135 185 145 170 140 155 C135 145 125 142 120 145'
  },
  {
    id: 'carotida_d',
    label: 'Artéria Carótida D',
    view: 'front',
    sistemas: ['circulatorio'],
    d: 'M112 90 L110 102'
  },
  {
    id: 'carotida_e',
    label: 'Artéria Carótida E',
    view: 'front',
    sistemas: ['circulatorio'],
    d: 'M128 90 L130 102'
  },
  {
    id: 'aorta_abdominal',
    label: 'Aorta Abdominal',
    view: 'front',
    sistemas: ['circulatorio'],
    d: 'M119 180 L119 255 L121 255 L121 180 Z'
  },

  // DIGESTIVE
  {
    id: 'esofago',
    label: 'Esôfago',
    view: 'front',
    sistemas: ['digestorio'],
    d: 'M119 102 L119 185 L121 185 L121 102 Z'
  },
  {
    id: 'figado',
    label: 'Fígado',
    view: 'front',
    sistemas: ['digestorio', ],
    d: 'M85 190 C100 185 125 188 140 205 L135 215 C115 220 90 220 82 210 Z'
  },
  {
    id: 'estomago',
    label: 'Estômago',
    view: 'front',
    sistemas: ['digestorio', ],
    d: 'M130 195 C145 190 158 205 155 225 C150 240 135 235 125 220 Q122 205 130 195'
  },
  {
    id: 'vesicula_biliar',
    label: 'Vesícula Biliar',
    view: 'front',
    sistemas: ['digestorio'],
    d: 'M112 210 Q115 205 118 210 Q118 218 115 222 Q112 218 112 210'
  },
  {
    id: 'intestino',
    label: 'Intestinos',
    view: 'front',
    sistemas: ['digestorio', ],
    d: 'M90 225 L150 225 L155 270 L85 270 Z'
  },

  // URINARY
  {
    id: 'bexiga',
    label: 'Bexiga',
    view: 'front',
    sistemas: ['urinario', ],
    d: 'M110 275 Q120 270 130 275 Q135 290 120 295 Q105 290 110 275'
  },

  // LYMPHATIC
  {
    id: 'linfonodos_cervicais',
    label: 'Linfonodos Cervicais',
    view: 'front',
    sistemas: ['linfatico'],
    d: 'M104 94 A1.5 1.5 0 1 0 107 94 A1.5 1.5 0 1 0 104 94 M133 94 A1.5 1.5 0 1 0 136 94 A1.5 1.5 0 1 0 133 94'
  },
  {
    id: 'linfonodos_axilares_d',
    label: 'Linfonodos Axilares D',
    view: 'front',
    sistemas: ['linfatico'],
    d: 'M158 128 A2 2 0 1 0 162 128 A2 2 0 1 0 158 128 M161 135 A1.8 1.8 0 1 0 164.6 135 A1.8 1.8 0 1 0 161 135'
  },
  {
    id: 'linfonodos_axilares_e',
    label: 'Linfonodos Axilares E',
    view: 'front',
    sistemas: ['linfatico'],
    d: 'M78 128 A2 2 0 1 0 82 128 A2 2 0 1 0 78 128 M75.4 135 A1.8 1.8 0 1 0 79 135 A1.8 1.8 0 1 0 75.4 135'
  },
  {
    id: 'baco',
    label: 'Baço',
    view: 'front',
    sistemas: ['linfatico', ],
    d: 'M155 205 Q162 208 158 220 Q152 225 148 215 Q148 205 155 205'
  },
  {
    id: 'linfonodos_inguinais',
    label: 'Linfonodos Inguinais',
    view: 'front',
    sistemas: ['linfatico'],
    d: 'M102 282 A2 2 0 1 0 106 282 A2 2 0 1 0 102 282 M134 282 A2 2 0 1 0 138 282 A2 2 0 1 0 134 282'
  },

  // ===== BACK =====
  {
    id: 'rim_d',
    label: 'Rim Direito',
    view: 'back',
    sistemas: ['urinario', ],
    d: 'M95 210 Q105 205 115 210 Q120 225 115 240 Q105 245 95 240 Q90 225 95 210'
  },
  {
    id: 'rim_e',
    label: 'Rim Esquerdo',
    view: 'back',
    sistemas: ['urinario', ],
    d: 'M125 210 Q135 205 145 210 Q150 225 145 240 Q135 245 125 240 Q120 225 125 210'
  }
];

export const VISCERAL_STRUCTURES: Record<string, any> = {
  // Endocrine
  tireoide: { 
    glandulas: ['Lobo direito', 'Lobo esquerdo', 'Istmo'],
    hormonios: ['T3 (Tri-iodotironina)', 'T4 (Tiroxina)', 'Calcitonina']
  },
  hipofise: {
    lobos: ['Adeno-hipófise (Anterior)', 'Neuro-hipófise (Posterior)'],
    hormonios: ['GH', 'TSH', 'ACTH', 'FSH', 'LH', 'Prolactina', 'ADH', 'Ocitocina']
  },
  adrenais: {
    partes: ['Córtex adrenal', 'Medula adrenal'],
    hormonios: ['Cortisol', 'Aldosterona', 'DHEA', 'Adrenalina', 'Noradrenalina']
  },
  pancreas: {
    partes: ['Cabeça', 'Corpo', 'Cauda', 'Processo uncinado'],
    exocrino: ['Ducto pancreático principal', 'Ácinos pancreáticos'],
    endocrino: ['Ilhotas de Langerhans (Insulina, Glucagon, Somatostatina)']
  },

  // Respiratory
  traqueia: { partes: ['Anéis cartilaginosos traqueais', 'Carina', 'Mucosa respiratória ciliada'] },
  pulmao_d: { 
    lobos: ['Superior', 'Médio', 'Inferior'],
    segmentos: ['Apical', 'Posterior', 'Anterior', 'Lateral', 'Medial', 'Superior', 'Basal medial', 'Basal anterior', 'Basal lateral', 'Basal posterior'],
    pleura: ['Visceral', 'Parietal'] 
  },
  pulmao_e: { 
    lobos: ['Superior', 'Inferior'],
    segmentos: ['Apical-posterior', 'Anterior', 'Lingular superior', 'Lingular inferior', 'Superior', 'Basal anteromedial', 'Basal lateral', 'Basal posterior'],
    pleura: ['Visceral', 'Parietal'] 
  },

  // Circulatory
  coracao: { 
    cavidades: ['Átrio Direito', 'Átrio Esquerdo', 'Ventrículo Direito', 'Ventrículo Esquerdo'],
    valvas: ['Mitral (Bicúspide)', 'Tricúspide', 'Aórtica semilunar', 'Pulmonar semilunar'],
    vasos: ['Aorta ascendente', 'Arco aórtico', 'Veia cava superior', 'Veia cava inferior', 'Tronco pulmonar', 'Veias pulmonares'],
    coronarias: ['Tronco da coronária esquerda', 'Coronária direita', 'Ramo descendente anterior', 'Ramo circunflexo']
  },
  carotida_d: { segmentos: ['Carótida comum', 'Carótida interna', 'Carótida externa', 'Bulbo carotídeo (barorreceptores)'] },
  carotida_e: { segmentos: ['Carótida comum', 'Carótida interna', 'Carótida externa', 'Bulbo carotídeo (barorreceptores)'] },
  aorta_abdominal: { 
    segmentos: ['Tronco celíaco', 'Artéria mesentérica superior', 'Artérias renais', 'Artéria mesentérica inferior', 'Bifurcação ilíaca'] 
  },

  // Digestive
  esofago: { segmentos: ['Cervical', 'Torácico', 'Abdominal'], esfincteres: ['Esfíncter esofágico superior', 'Esfíncter esofágico inferior (Cárdia)'] },
  figado: { 
    lobos: ['Direito (Lobo de Laennec)', 'Esquerdo', 'Caudado (Lobo de Spiegel)', 'Quadrado'],
    segmentos: ['I (Caudado)', 'II/III (Esquerdo)', 'IV (Quadrado)', 'V/VI/VII/VIII (Direito)'],
    vascularizacao: ['Veia porta', 'Artéria hepática própria', 'Veias hepáticas']
  },
  vesicula_biliar: { partes: ['Fundo', 'Corpo', 'Infundíbulo (Pescoço)'], ductos: ['Ducto cístico', 'Ducto colédoco'] },
  estomago: { 
    partes: ['Cárdia', 'Fundo gástrico', 'Corpo gástrico', 'Antro pilórico', 'Canal pilórico'],
    curvaturas: ['Grande curvatura', 'Pequena curvatura'],
    incisuras: ['Incisura cárdica', 'Incisura angular']
  },
  intestino: { 
    delgado: ['Duodeno (4 porções)', 'Jejuno', 'Íleo'],
    grosso: ['Ceco', 'Apêndice vermiforme', 'Cólon ascendente', 'Cólon transverso', 'Cólon descendente', 'Cólon sigmoide', 'Reto'],
    flexuras: ['Flexura hepática', 'Flexura esplênica']
  },

  // Urinary
  rim_d: { partes: ['Córtex renal', 'Medula (Pirâmides)', 'Cálices maiores e menores', 'Pelve renal', 'Hilo renal'] },
  rim_e: { partes: ['Córtex renal', 'Medula (Pirâmides)', 'Cálices maiores e menores', 'Pelve renal', 'Hilo renal'] },
  bexiga: { partes: ['Vértice', 'Corpo', 'Fundo (Trígono)', 'Colo vesical', 'Músculo detrusor'] },

  // Lymphatic
  linfonodos_cervicais: { grupos: ['Nível I (Submentonianos)', 'Nível II/III/IV (Jugulares)', 'Nível V (Triângulo posterior)', 'Nível VI (Compartimento anterior)'] },
  linfonodos_axilares_d: { grupos: ['Grupo lateral', 'Grupo anterior (peitoral)', 'Grupo posterior (subescapular)', 'Grupo central', 'Grupo apical'] },
  linfonodos_axilares_e: { grupos: ['Grupo lateral', 'Grupo anterior (peitoral)', 'Grupo posterior (subescapular)', 'Grupo central', 'Grupo apical'] },
  baco: { partes: ['Polpa branca', 'Polpa vermelha', 'Hilo esplênico', 'Cápsula esplênica'] },
  linfonodos_inguinais: { grupos: ['Superficiais (Cadeia vertical e horizontal)', 'Profundos (Linfonodo de Cloquet)'] }
};
