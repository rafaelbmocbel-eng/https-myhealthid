export interface OrganRegion {
  id: string;
  label: string;
  view: 'front' | 'back';
  sistemas: string[];
  d: string;
  type?: 'organ' | 'vessel' | 'nerve' | 'gland' | 'structural';
  layer?: number; // render order: 0=back, 10=front
}

/**
 * Anatomical Regions with precise SVG paths
 * ViewBox: 240×520
 * x=120 = anatomical midline
 * x < 120 = patient RIGHT side (liver, right lung, right kidney)
 * x > 120 = patient LEFT side (stomach, spleen, left lung, left kidney)
 *
 * Key Y coordinates:
 *   Head:    y=18–88  (oval center ≈ y=44)
 *   Neck:    y=88–108
 *   Thorax:  y=108–230 (costal arch ≈ y=195)
 *   Abdomen: y=192–285
 *   Pelvis:  y=282–315
 *   Navel:   y≈250
 */
export const VISCERAL_REGIONS: OrganRegion[] = [

  // ─────────────────────────────────────────────
  // FRONT VIEW
  // ─────────────────────────────────────────────

  // ── NERVOUS SYSTEM ──────────────────────────

  // Cerebro: two cerebral hemispheres as one contiguous oval filling head
  {
    id: 'cerebro',
    label: 'Encéfalo',
    view: 'front',
    sistemas: ['nervoso'],
    type: 'organ',
    layer: 8,
    d: 'M120 24 C 108 24 98 28 94 36 C 90 44 90 54 94 62 C 98 70 108 74 120 74 C 132 74 142 70 146 62 C 150 54 150 44 146 36 C 142 28 132 24 120 24 Z'
  },

  // Cerebelo: smaller oval at posterior-inferior brain
  {
    id: 'cerebelo',
    label: 'Cerebelo',
    view: 'front',
    sistemas: ['nervoso'],
    type: 'organ',
    layer: 7,
    d: 'M112 66 C 110 63 110 59 120 58 C 130 59 130 63 128 66 C 126 70 114 70 112 66 Z'
  },

  // Tronco encefálico: narrow tube from brain to cord
  {
    id: 'tronco_encefalico',
    label: 'Tronco Encefálico',
    view: 'front',
    sistemas: ['nervoso'],
    type: 'organ',
    layer: 9,
    d: 'M117 68 C 117 68 116 74 116 82 C 116 86 118 88 120 88 C 122 88 124 86 124 82 C 124 74 123 68 123 68 Z'
  },

  // Medula espinhal (vista anterior): thin vertical strip down midline
  {
    id: 'medula_espinhal_v',
    label: 'Medula Espinhal',
    view: 'front',
    sistemas: ['nervoso'],
    type: 'nerve',
    layer: 9,
    d: 'M119 88 L119 282 L121 282 L121 88 Z'
  },

  // Plexo braquial direito: fan of roots from right cervical to arm
  {
    id: 'plexo_braquial_d',
    label: 'Plexo Braquial D',
    view: 'front',
    sistemas: ['nervoso'],
    type: 'nerve',
    layer: 9,
    d: 'M118 96 C 124 100 136 106 152 118 M119 100 C 126 104 138 112 155 126'
  },

  // Plexo braquial esquerdo: mirror fan from left cervical to arm
  {
    id: 'plexo_braquial_e',
    label: 'Plexo Braquial E',
    view: 'front',
    sistemas: ['nervoso'],
    type: 'nerve',
    layer: 9,
    d: 'M122 96 C 116 100 104 106 88 118 M121 100 C 114 104 102 112 85 126'
  },

  // Nervo mediano direito: single line down right arm
  {
    id: 'nervo_mediano_d',
    label: 'Nervo Mediano D',
    view: 'front',
    sistemas: ['nervoso'],
    type: 'nerve',
    layer: 9,
    d: 'M155 126 C 162 148 170 178 175 230 C 178 258 178 276 176 300'
  },

  // Nervo mediano esquerdo: single line down left arm
  {
    id: 'nervo_mediano_e',
    label: 'Nervo Mediano E',
    view: 'front',
    sistemas: ['nervoso'],
    type: 'nerve',
    layer: 9,
    d: 'M85 126 C 78 148 70 178 65 230 C 62 258 62 276 64 300'
  },

  // Plexo lombossacro direito: nerve bundle lower right
  {
    id: 'plexo_lombosacro_d',
    label: 'Plexo Lombossacro D',
    view: 'front',
    sistemas: ['nervoso'],
    type: 'nerve',
    layer: 9,
    d: 'M122 268 C 126 278 132 290 138 308 M122 274 C 128 286 136 298 144 316'
  },

  // Plexo lombossacro esquerdo
  {
    id: 'plexo_lombosacro_e',
    label: 'Plexo Lombossacro E',
    view: 'front',
    sistemas: ['nervoso'],
    type: 'nerve',
    layer: 9,
    d: 'M118 268 C 114 278 108 290 102 308 M118 274 C 112 286 104 298 96 316'
  },

  // Nervo femoral direito: thigh nerve right
  {
    id: 'nervo_femoral_d',
    label: 'Nervo Femoral D',
    view: 'front',
    sistemas: ['nervoso'],
    type: 'nerve',
    layer: 9,
    d: 'M142 316 C 144 334 146 354 145 374'
  },

  // Nervo femoral esquerdo: thigh nerve left
  {
    id: 'nervo_femoral_e',
    label: 'Nervo Femoral E',
    view: 'front',
    sistemas: ['nervoso'],
    type: 'nerve',
    layer: 9,
    d: 'M98 316 C 96 334 94 354 95 374'
  },

  // ── CIRCULATORY ─────────────────────────────

  // Coração: proper cardiac silhouette, slightly left of midline
  // Base at y≈143, apex pointing left-inferior toward (112,177)
  {
    id: 'coracao',
    label: 'Coração',
    view: 'front',
    sistemas: ['circulatorio'],
    type: 'organ',
    layer: 7,
    d: 'M120 143 C 125 140 134 140 138 146 C 142 152 142 160 136 166 C 134 170 128 176 120 178 C 112 182 106 178 110 170 C 112 164 118 162 120 160 C 116 158 108 158 106 151 C 104 144 110 140 120 143 Z'
  },

  // Pericárdio: subtle outline slightly larger than heart
  {
    id: 'pericardio',
    label: 'Pericárdio',
    view: 'front',
    sistemas: ['circulatorio'],
    type: 'structural',
    layer: 6,
    d: 'M120 139 C 127 136 138 136 143 144 C 147 152 147 164 140 172 C 137 177 129 183 120 186 C 111 190 103 185 106 175 C 108 167 116 164 120 162 C 115 158 104 156 102 148 C 100 140 108 136 120 139 Z'
  },

  // Arco aórtico: rises from heart base, curves left, arches over
  {
    id: 'aorta_arco',
    label: 'Arco Aórtico',
    view: 'front',
    sistemas: ['circulatorio'],
    type: 'vessel',
    layer: 9,
    d: 'M127 143 C 127 136 128 130 126 124 C 124 118 118 118 116 124 C 114 130 116 136 118 143'
  },

  // Aorta abdominal: midline descending
  {
    id: 'aorta_abdominal',
    label: 'Aorta Abdominal',
    view: 'front',
    sistemas: ['circulatorio'],
    type: 'vessel',
    layer: 9,
    d: 'M118 182 L118 262 L122 262 L122 182 Z'
  },

  // Veia cava superior: right of aorta, shorter
  {
    id: 'veia_cava_sup',
    label: 'Veia Cava Superior',
    view: 'front',
    sistemas: ['circulatorio'],
    type: 'vessel',
    layer: 9,
    d: 'M124 128 C 126 130 128 136 128 143 L130 143 C 130 136 128 130 126 128 Z'
  },

  // Carótida direita: right neck thin line
  {
    id: 'carotida_d',
    label: 'Artéria Carótida D',
    view: 'front',
    sistemas: ['circulatorio'],
    type: 'vessel',
    layer: 9,
    d: 'M118 128 C 116 118 115 110 115 104'
  },

  // Carótida esquerda: left neck thin line
  {
    id: 'carotida_e',
    label: 'Artéria Carótida E',
    view: 'front',
    sistemas: ['circulatorio'],
    type: 'vessel',
    layer: 9,
    d: 'M122 128 C 124 118 125 110 125 104'
  },

  // Femoral direita: right thigh artery
  {
    id: 'femoral_d',
    label: 'Artéria Femoral D',
    view: 'front',
    sistemas: ['circulatorio'],
    type: 'vessel',
    layer: 9,
    d: 'M108 308 C 106 326 104 348 103 372 C 102 392 102 410 102 430'
  },

  // Femoral esquerda: left thigh artery
  {
    id: 'femoral_e',
    label: 'Artéria Femoral E',
    view: 'front',
    sistemas: ['circulatorio'],
    type: 'vessel',
    layer: 9,
    d: 'M132 308 C 134 326 136 348 137 372 C 138 392 138 410 138 430'
  },

  // ── RESPIRATORY ─────────────────────────────

  // Traqueia: vertical tube from neck to carina with bifurcation
  {
    id: 'traqueia',
    label: 'Traqueia',
    view: 'front',
    sistemas: ['respiratorio'],
    type: 'organ',
    layer: 8,
    d: 'M118 102 L118 133 C 114 138 106 142 104 148 L106 150 C 108 145 116 140 118 137 L120 140 L122 137 C 124 140 132 145 134 150 L136 148 C 134 142 126 138 122 133 L122 102 Z'
  },

  // Brônquio direito: short right bronchus
  {
    id: 'bronquio_d',
    label: 'Brônquio Principal D',
    view: 'front',
    sistemas: ['respiratorio'],
    type: 'vessel',
    layer: 8,
    d: 'M118 137 C 113 137 106 140 104 148'
  },

  // Brônquio esquerdo: short left bronchus
  {
    id: 'bronquio_e',
    label: 'Brônquio Principal E',
    view: 'front',
    sistemas: ['respiratorio'],
    type: 'vessel',
    layer: 8,
    d: 'M122 137 C 127 137 134 140 136 148'
  },

  // Pulmão direito (patient RIGHT = screen LEFT): 3-lobed
  // Medial border along sternum x≈116, lateral follows thoracic wall
  {
    id: 'pulmao_d',
    label: 'Pulmão Direito',
    view: 'front',
    sistemas: ['respiratorio'],
    type: 'organ',
    layer: 2,
    d: 'M116 133 C 110 132 100 134 92 140 C 84 146 80 158 80 170 C 80 184 82 196 86 206 C 90 214 96 220 104 222 C 110 224 116 222 116 222 L116 133 Z'
  },

  // Pulmão esquerdo (patient LEFT = screen RIGHT): 2-lobed, with cardiac notch
  // Cardiac notch: concavity at inferomedial border x=122-130, y=155-178
  {
    id: 'pulmao_e',
    label: 'Pulmão Esquerdo',
    view: 'front',
    sistemas: ['respiratorio'],
    type: 'organ',
    layer: 2,
    d: 'M124 133 C 130 132 140 134 148 140 C 156 146 160 158 160 170 C 160 184 158 196 154 206 C 150 214 144 220 136 222 C 130 224 126 222 124 220 C 122 218 118 210 118 200 C 118 188 122 180 126 174 C 124 168 122 162 124 156 C 124 144 124 133 124 133 Z'
  },

  // Diafragma: dome-shaped arch, structural divider
  {
    id: 'diafragma',
    label: 'Diafragma',
    view: 'front',
    sistemas: ['respiratorio'],
    type: 'structural',
    layer: 10,
    d: 'M82 210 C 88 204 96 198 104 194 C 110 191 115 190 120 190 C 125 190 130 191 136 194 C 144 198 152 204 158 210'
  },

  // ── DIGESTIVE ────────────────────────────────

  // Esôfago: thin tube behind trachea
  {
    id: 'esofago',
    label: 'Esôfago',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 7,
    d: 'M119 102 C 119 118 119 142 119 188 L121 188 C 121 142 121 118 121 102 Z'
  },

  // Fígado: large right-dominant wedge, right upper quadrant
  // Patient RIGHT = screen LEFT: x=80-145, y=188-228
  {
    id: 'figado',
    label: 'Fígado',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 6,
    d: 'M116 190 C 108 188 96 188 88 192 C 82 196 80 204 80 212 C 80 220 84 226 90 228 C 98 230 108 230 116 228 C 124 226 130 222 134 216 C 138 210 138 202 134 196 C 130 190 124 190 116 190 Z'
  },

  // Vesícula biliar: pear-shaped under liver right lobe
  {
    id: 'vesicula_biliar',
    label: 'Vesícula Biliar',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 7,
    d: 'M112 218 C 110 214 110 210 113 208 C 116 206 119 207 120 210 C 121 214 121 220 119 224 C 117 228 113 228 112 224 C 111 222 112 220 112 218 Z'
  },

  // Estômago: J-shaped bag, patient LEFT (screen RIGHT)
  // Fundus at top (x≈148,y≈196), body curves down, antrum turns medially
  {
    id: 'estomago',
    label: 'Estômago',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 6,
    d: 'M136 196 C 142 194 152 196 156 204 C 160 212 158 226 154 238 C 150 248 144 252 138 250 C 132 248 128 242 126 234 C 124 226 124 216 126 210 C 128 204 130 198 136 196 Z'
  },

  // Baço (vista anterior, para digestório/linfático)
  {
    id: 'baco_frente',
    label: 'Baço',
    view: 'front',
    sistemas: ['digestorio', 'linfatico'],
    type: 'organ',
    layer: 6,
    d: 'M152 200 C 156 200 162 204 162 212 C 162 220 158 226 152 226 C 148 226 144 222 144 216 C 144 208 148 200 152 200 Z'
  },

  // Pâncreas: retroperitoneal, behind stomach
  {
    id: 'pancreas_corpo',
    label: 'Pâncreas',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 5,
    d: 'M100 220 C 106 216 116 214 128 214 C 138 214 146 216 150 220 C 152 222 152 226 150 228 C 146 230 136 230 126 228 C 116 228 106 228 100 226 C 98 224 98 222 100 220 Z'
  },

  // Ilhotas de Langerhans (endócrino do pâncreas): same region
  {
    id: 'ilhotas_langerhans',
    label: 'Ilhotas de Langerhans',
    view: 'front',
    sistemas: ['endocrino'],
    type: 'gland',
    layer: 5,
    d: 'M100 220 C 106 216 116 214 128 214 C 138 214 146 216 150 220 C 152 222 152 226 150 228 C 146 230 136 230 126 228 C 116 228 106 228 100 226 C 98 224 98 222 100 220 Z'
  },

  // Duodeno: C-shaped loop wrapping around pancreatic head, right side
  {
    id: 'duodeno',
    label: 'Duodeno',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 7,
    d: 'M128 228 C 130 224 134 222 138 224 C 142 226 142 232 140 238 C 138 244 134 250 130 254 C 126 258 122 256 122 250 C 122 244 124 236 128 228 Z'
  },

  // Intestino delgado: coiled central area, multiple loops
  {
    id: 'intestino_delgado',
    label: 'Intestino Delgado',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 4,
    d: 'M100 232 C 106 228 118 226 130 228 C 138 230 144 234 144 240 C 144 246 138 250 130 252 C 122 254 112 254 104 252 C 96 250 92 244 94 238 C 96 234 100 232 100 232 M102 256 C 110 254 122 254 132 256 C 140 258 144 264 142 270 C 140 274 134 276 126 276 C 116 276 106 274 100 270 C 96 266 98 258 102 256 Z'
  },

  // Cólon ascendente: right side (screen LEFT), goes up
  {
    id: 'colon_ascendente',
    label: 'Cólon Ascendente',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 3,
    d: 'M88 280 C 86 266 86 254 88 242 C 90 236 94 234 98 236 C 100 238 100 244 100 252 C 100 264 98 278 96 286 C 94 290 90 286 88 280 Z'
  },

  // Cólon transverso: horizontal across upper abdomen
  {
    id: 'colon_transverso',
    label: 'Cólon Transverso',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 3,
    d: 'M96 236 C 104 232 112 230 120 232 C 128 230 136 232 144 236 C 148 238 150 242 148 244 C 146 248 138 248 128 246 C 120 246 112 246 104 248 C 98 248 94 244 96 236 Z'
  },

  // Cólon descendente: left side (screen RIGHT), goes down
  {
    id: 'colon_descendente',
    label: 'Cólon Descendente',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 3,
    d: 'M148 236 C 150 250 152 264 152 278 C 152 284 150 288 146 288 C 142 288 140 284 140 278 C 140 264 140 250 142 238 C 143 234 147 232 148 236 Z'
  },

  // Cólon sigmoide: S-shaped lower left
  {
    id: 'colon_sigmoide',
    label: 'Cólon Sigmoide',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 3,
    d: 'M146 284 C 144 288 140 292 134 292 C 128 292 124 288 122 284 C 120 280 118 278 120 282 C 122 286 122 292 120 296 C 118 298 116 298 116 294 Z'
  },

  // Apêndice: small finger at cecum, lower right
  {
    id: 'apendice',
    label: 'Apêndice Vermiforme',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 7,
    d: 'M94 284 C 96 284 98 286 100 290 C 102 294 102 298 100 300 C 98 302 96 300 94 296 C 92 292 92 284 94 284 Z'
  },

  // Reto: rectum midline, pelvis
  {
    id: 'reto',
    label: 'Reto',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 5,
    d: 'M116 292 C 116 288 118 284 120 284 C 122 284 124 288 124 292 L124 308 C 124 310 122 312 120 312 C 118 312 116 310 116 308 Z'
  },

  // ── ENDOCRINE ────────────────────────────────

  // Hipófise: tiny gland at base of brain
  {
    id: 'hipofise',
    label: 'Hipófise',
    view: 'front',
    sistemas: ['endocrino'],
    type: 'gland',
    layer: 10,
    d: 'M118 66 C 118 63 119 62 120 62 C 121 62 122 63 122 66 C 122 69 121 70 120 70 C 119 70 118 69 118 66 Z'
  },

  // Tireoide: butterfly/bowtie in neck, two lobes with isthmus
  {
    id: 'tireoide',
    label: 'Glândula Tireoide',
    view: 'front',
    sistemas: ['endocrino'],
    type: 'gland',
    layer: 8,
    d: 'M108 98 C 106 96 106 92 110 91 C 113 90 116 92 117 96 C 118 100 117 105 115 107 C 112 108 109 106 108 98 Z M132 98 C 134 96 134 92 130 91 C 127 90 124 92 123 96 C 122 100 123 105 125 107 C 128 108 131 106 132 98 Z M117 98 C 118 98 122 98 123 98 L122 100 C 121 100 119 100 118 100 Z'
  },

  // Adrenal direita (patient RIGHT = screen LEFT): small triangular gland atop right kidney projection
  {
    id: 'adrenal_d',
    label: 'Glândula Suprarrenal D',
    view: 'front',
    sistemas: ['endocrino'],
    type: 'gland',
    layer: 7,
    d: 'M104 200 C 108 196 114 196 116 200 C 118 204 116 208 113 210 C 110 212 106 210 104 206 C 103 204 103 202 104 200 Z'
  },

  // Adrenal esquerda (patient LEFT = screen RIGHT): atop left kidney projection
  {
    id: 'adrenal_e',
    label: 'Glândula Suprarrenal E',
    view: 'front',
    sistemas: ['endocrino'],
    type: 'gland',
    layer: 7,
    d: 'M124 200 C 128 196 134 196 136 200 C 138 204 136 208 133 210 C 130 212 126 210 124 206 C 123 204 123 202 124 200 Z'
  },

  // ── URINARY ──────────────────────────────────

  // Ureteres: two tubes from kidneys to bladder
  {
    id: 'ureteres',
    label: 'Ureteres',
    view: 'front',
    sistemas: ['urinario'],
    type: 'vessel',
    layer: 6,
    d: 'M110 228 C 110 240 110 256 112 272 C 113 278 114 282 116 284 M130 228 C 130 240 130 256 128 272 C 127 278 126 282 124 284'
  },

  // Bexiga: pear-shaped, rounded top, tapers below
  {
    id: 'bexiga',
    label: 'Bexiga Urinária',
    view: 'front',
    sistemas: ['urinario'],
    type: 'organ',
    layer: 5,
    d: 'M116 282 C 112 278 108 274 108 284 C 108 294 110 300 114 304 C 116 306 118 308 120 308 C 122 308 124 306 126 304 C 130 300 132 294 132 284 C 132 274 128 278 124 282 C 122 280 118 280 116 282 Z'
  },

  // ── LYMPHATIC ────────────────────────────────

  // Timo: superior mediastinum, bilobed
  {
    id: 'timo',
    label: 'Timo',
    view: 'front',
    sistemas: ['linfatico'],
    type: 'gland',
    layer: 8,
    d: 'M116 128 C 114 126 114 122 117 122 C 120 122 120 126 120 128 C 120 132 118 136 117 140 C 116 136 116 130 116 128 Z M124 128 C 126 126 126 122 123 122 C 120 122 120 126 120 128 C 120 132 122 136 123 140 C 124 136 124 130 124 128 Z'
  },

  // Linfonodos cervicais: 2 small ovals in neck bilateral
  {
    id: 'linfonodos_cervicais',
    label: 'Linfonodos Cervicais',
    view: 'front',
    sistemas: ['linfatico'],
    type: 'gland',
    layer: 9,
    d: 'M106 92 C 105 90 106 88 108 88 C 110 88 111 90 110 92 C 110 94 108 94 106 92 Z M130 92 C 129 90 130 88 132 88 C 134 88 135 90 134 92 C 134 94 132 94 130 92 Z'
  },

  // Linfonodos axilares direitos: near right axilla
  {
    id: 'linfonodos_axilares_d',
    label: 'Linfonodos Axilares D',
    view: 'front',
    sistemas: ['linfatico'],
    type: 'gland',
    layer: 9,
    d: 'M160 130 C 159 128 160 126 162 126 C 164 126 165 128 164 130 C 164 132 162 132 160 130 Z M164 138 C 163 136 164 134 166 134 C 168 134 169 136 168 138 C 168 140 166 140 164 138 Z'
  },

  // Linfonodos axilares esquerdos: near left axilla
  {
    id: 'linfonodos_axilares_e',
    label: 'Linfonodos Axilares E',
    view: 'front',
    sistemas: ['linfatico'],
    type: 'gland',
    layer: 9,
    d: 'M80 130 C 79 128 80 126 82 126 C 84 126 85 128 84 130 C 84 132 82 132 80 130 Z M76 138 C 75 136 76 134 78 134 C 80 134 81 136 80 138 C 80 140 78 140 76 138 Z'
  },

  // Baço (linfático): same path as baco_frente
  {
    id: 'baco',
    label: 'Baço',
    view: 'front',
    sistemas: ['linfatico'],
    type: 'organ',
    layer: 6,
    d: 'M152 200 C 156 200 162 204 162 212 C 162 220 158 226 152 226 C 148 226 144 222 144 216 C 144 208 148 200 152 200 Z'
  },

  // Cisterna do quilo: near L2 level
  {
    id: 'vasos_quiferos',
    label: 'Cisterna do Quilo',
    view: 'front',
    sistemas: ['linfatico'],
    type: 'gland',
    layer: 8,
    d: 'M118 226 C 118 223 119 222 120 222 C 121 222 122 223 122 226 C 122 229 121 230 120 230 C 119 230 118 229 118 226 Z'
  },

  // Ducto torácico: line from cistern up spine
  {
    id: 'ducto_toracico',
    label: 'Ducto Torácico',
    view: 'front',
    sistemas: ['linfatico'],
    type: 'vessel',
    layer: 8,
    d: 'M120 226 C 121 210 122 192 122 174 C 122 156 120 140 118 128'
  },

  // Linfonodos inguinais: bilateral at inguinal region
  {
    id: 'linfonodos_inguinais',
    label: 'Linfonodos Inguinais',
    view: 'front',
    sistemas: ['linfatico'],
    type: 'gland',
    layer: 9,
    d: 'M100 286 C 99 284 100 282 102 282 C 104 282 105 284 104 286 C 104 288 102 288 100 286 Z M136 286 C 135 284 136 282 138 282 C 140 282 141 284 140 286 C 140 288 138 288 136 286 Z'
  },

  // ── REPRODUCTIVE ─────────────────────────────

  // Útero: pear-shaped in pelvis
  {
    id: 'utero',
    label: 'Útero',
    view: 'front',
    sistemas: ['reprodutor'],
    type: 'organ',
    layer: 6,
    d: 'M114 290 C 112 286 112 282 116 280 C 118 278 122 278 124 280 C 128 282 128 286 126 290 C 124 294 122 298 120 300 C 118 298 116 294 114 290 Z'
  },

  // Ovários: two small ovals lateral to uterus
  {
    id: 'ovarios',
    label: 'Ovários',
    view: 'front',
    sistemas: ['reprodutor'],
    type: 'organ',
    layer: 6,
    d: 'M106 290 C 105 288 106 285 108 285 C 110 285 111 288 110 290 C 110 293 108 294 106 292 C 105 292 106 291 106 290 Z M130 290 C 129 288 130 285 132 285 C 134 285 135 288 134 290 C 134 293 132 294 130 292 C 129 292 130 291 130 290 Z'
  },

  // Testículos: two circles below pubis
  {
    id: 'testiculos',
    label: 'Testículos',
    view: 'front',
    sistemas: ['reprodutor'],
    type: 'organ',
    layer: 6,
    d: 'M112 310 C 111 307 112 304 115 304 C 118 304 119 307 118 310 C 118 313 116 315 114 314 C 112 313 112 312 112 310 Z M128 310 C 127 307 128 304 131 304 C 134 304 135 307 134 310 C 134 313 132 315 130 314 C 128 313 128 312 128 310 Z'
  },

  // Próstata: small oval below bladder
  {
    id: 'prostata',
    label: 'Próstata',
    view: 'front',
    sistemas: ['reprodutor'],
    type: 'gland',
    layer: 6,
    d: 'M116 306 C 116 303 118 302 120 302 C 122 302 124 303 124 306 C 124 309 122 310 120 310 C 118 310 116 309 116 306 Z'
  },

  // ─────────────────────────────────────────────
  // BACK VIEW
  // ─────────────────────────────────────────────

  // Encéfalo posterior
  {
    id: 'cerebro_p',
    label: 'Encéfalo (Posterior)',
    view: 'back',
    sistemas: ['nervoso'],
    type: 'organ',
    layer: 8,
    d: 'M120 24 C 108 24 98 28 94 36 C 90 44 90 54 94 62 C 98 70 108 74 120 74 C 132 74 142 70 146 62 C 150 54 150 44 146 36 C 142 28 132 24 120 24 Z'
  },

  // Cerebelo posterior: more prominent in back view
  {
    id: 'cerebelo_p',
    label: 'Cerebelo (Posterior)',
    view: 'back',
    sistemas: ['nervoso'],
    type: 'organ',
    layer: 9,
    d: 'M110 66 C 108 62 110 58 120 58 C 130 58 132 62 130 66 C 128 72 112 72 110 66 Z'
  },

  // Medula espinhal posterior
  {
    id: 'medula_p',
    label: 'Medula Espinhal (Posterior)',
    view: 'back',
    sistemas: ['nervoso'],
    type: 'nerve',
    layer: 9,
    d: 'M119 88 L119 282 L121 282 L121 88 Z'
  },

  // Pulmão direito posterior: right side (patient RIGHT = screen LEFT)
  {
    id: 'pulmao_d_p',
    label: 'Pulmão Direito (Posterior)',
    view: 'back',
    sistemas: ['respiratorio'],
    type: 'organ',
    layer: 2,
    d: 'M116 133 C 110 132 100 134 92 140 C 84 146 80 158 80 170 C 80 186 82 200 86 210 C 90 218 96 224 104 226 C 110 228 116 226 116 222 L116 133 Z'
  },

  // Pulmão esquerdo posterior: left side (patient LEFT = screen RIGHT)
  {
    id: 'pulmao_e_p',
    label: 'Pulmão Esquerdo (Posterior)',
    view: 'back',
    sistemas: ['respiratorio'],
    type: 'organ',
    layer: 2,
    d: 'M124 133 C 130 132 140 134 148 140 C 156 146 160 158 160 170 C 160 186 158 200 154 210 C 150 218 144 224 136 226 C 130 228 124 226 124 222 L124 133 Z'
  },

  // Diafragma posterior
  {
    id: 'diafragma_p',
    label: 'Diafragma (Posterior)',
    view: 'back',
    sistemas: ['respiratorio'],
    type: 'structural',
    layer: 10,
    d: 'M82 210 C 88 204 96 198 104 194 C 110 191 115 190 120 190 C 125 190 130 191 136 194 C 144 198 152 204 158 210'
  },

  // Rim direito (patient RIGHT = screen LEFT): classic kidney bean shape, hilum medial
  {
    id: 'rim_d',
    label: 'Rim Direito',
    view: 'back',
    sistemas: ['urinario'],
    type: 'organ',
    layer: 6,
    d: 'M90 206 C 86 210 84 218 84 228 C 84 238 86 246 90 250 C 94 254 100 254 106 252 C 112 250 116 246 117 238 C 118 234 116 230 114 228 C 116 226 118 222 117 216 C 116 208 112 204 106 202 C 100 200 94 202 90 206 Z'
  },

  // Rim esquerdo (patient LEFT = screen RIGHT): kidney bean, hilum medial
  {
    id: 'rim_e',
    label: 'Rim Esquerdo',
    view: 'back',
    sistemas: ['urinario'],
    type: 'organ',
    layer: 6,
    d: 'M150 206 C 154 210 156 218 156 228 C 156 238 154 246 150 250 C 146 254 140 254 134 252 C 128 250 124 246 123 238 C 122 234 124 230 126 228 C 124 226 122 222 123 216 C 124 208 128 204 134 202 C 140 200 146 202 150 206 Z'
  },

  // Adrenal direita posterior: atop right kidney
  {
    id: 'adrenal_d_p',
    label: 'Glândula Suprarrenal D (Posterior)',
    view: 'back',
    sistemas: ['endocrino'],
    type: 'gland',
    layer: 7,
    d: 'M92 200 C 94 196 100 194 104 196 C 108 198 108 202 106 206 C 104 208 100 208 97 206 C 94 204 91 202 92 200 Z'
  },

  // Adrenal esquerda posterior: atop left kidney
  {
    id: 'adrenal_e_p',
    label: 'Glândula Suprarrenal E (Posterior)',
    view: 'back',
    sistemas: ['endocrino'],
    type: 'gland',
    layer: 7,
    d: 'M148 200 C 146 196 140 194 136 196 C 132 198 132 202 134 206 C 136 208 140 208 143 206 C 146 204 149 202 148 200 Z'
  },

  // Glúteos: gluteal muscle group area
  {
    id: 'gluteos_p',
    label: 'Região Glútea',
    view: 'back',
    sistemas: ['musculoesqueletico'],
    type: 'organ',
    layer: 3,
    d: 'M84 248 C 84 242 86 238 90 238 C 100 238 112 242 120 248 C 128 242 140 238 150 238 C 154 238 156 242 156 248 C 156 262 150 278 140 290 C 132 300 124 306 120 308 C 116 306 108 300 100 290 C 90 278 84 262 84 248 Z'
  },

  // Nervo ciático direito: down right leg
  {
    id: 'nervo_ciatico_d',
    label: 'Nervo Isquiático D',
    view: 'back',
    sistemas: ['nervoso'],
    type: 'nerve',
    layer: 9,
    d: 'M140 290 C 144 308 148 330 148 354 C 148 378 146 400 144 424'
  },

  // Nervo ciático esquerdo: down left leg
  {
    id: 'nervo_ciatico_e',
    label: 'Nervo Isquiático E',
    view: 'back',
    sistemas: ['nervoso'],
    type: 'nerve',
    layer: 9,
    d: 'M100 290 C 96 308 92 330 92 354 C 92 378 94 400 96 424'
  },
];

export const VISCERAL_STRUCTURES: Record<string, any> = {
  // Endocrine
  tireoide: {
    glandulas: ['Lobo direito', 'Lobo esquerdo', 'Istmo'],
    hormonios: ['T3 (Tri-iodotironina)', 'T4 (Tiroxina)', 'Calcitonina']
  },
  paratireoides: { hormonios: ['PTH (Paratormônio)'], funcao: ['Controle do cálcio e fósforo'] },
  hipofise: {
    lobos: ['Adeno-hipófise (Anterior)', 'Neuro-hipófise (Posterior)'],
    hormonios: ['GH', 'TSH', 'ACTH', 'FSH', 'LH', 'Prolactina', 'ADH', 'Ocitocina']
  },
  pineal: { hormonios: ['Melatonina'], funcao: ['Ciclo circadiano'] },
  timo: { funcao: ['Maturação de linfócitos T', 'Imunidade celular', 'Produção de timosina'] },
  adrenal_d: {
    partes: ['Córtex adrenal', 'Medula adrenal'],
    hormonios: ['Cortisol', 'Aldosterona', 'DHEA', 'Adrenalina', 'Noradrenalina']
  },
  adrenal_e: {
    partes: ['Córtex adrenal', 'Medula adrenal'],
    hormonios: ['Cortisol', 'Aldosterona', 'DHEA', 'Adrenalina', 'Noradrenalina']
  },
  adrenal_d_p: {
    partes: ['Córtex adrenal', 'Medula adrenal'],
    hormonios: ['Cortisol', 'Aldosterona', 'DHEA', 'Adrenalina', 'Noradrenalina']
  },
  adrenal_e_p: {
    partes: ['Córtex adrenal', 'Medula adrenal'],
    hormonios: ['Cortisol', 'Aldosterona', 'DHEA', 'Adrenalina', 'Noradrenalina']
  },
  ilhotas_langerhans: {
    endocrino: ['Células Beta (Insulina)', 'Células Alfa (Glucagon)', 'Células Delta (Somatostatina)'],
    funcao: ['Regulação glicêmica', 'Homeostase metabólica']
  },
  pancreas_corpo: {
    partes: ['Cabeça', 'Processo uncinado', 'Colo', 'Corpo', 'Cauda'],
    exocrino: ['Ducto pancreático principal (Wirsung)', 'Ducto acessório (Santorini)', 'Ácinos pancreáticos'],
    endocrino: ['Ilhotas de Langerhans (Insulina, Glucagon, Somatostatina)']
  },

  // Respiratory
  traqueia: { partes: ['Anéis cartilaginosos traqueais', 'Carina traqueal', 'Mucosa respiratória ciliada', 'Glote'] },
  bronquio_d: { partes: ['Brônquio principal direito', 'Bifurcação lobar superior', 'Bifurcação lobar médio/inferior'] },
  bronquio_e: { partes: ['Brônquio principal esquerdo', 'Bifurcação lobar superior', 'Bifurcação lobar inferior'] },
  pulmao_d: {
    lobos: ['Superior (S1-S3)', 'Médio (S4-S5)', 'Inferior (S6-S10)'],
    segmentos: ['Apical', 'Posterior', 'Anterior', 'Lateral', 'Medial', 'Superior', 'Basal medial', 'Basal anterior', 'Basal lateral', 'Basal posterior'],
    pleura: ['Visceral', 'Parietal'],
    fissuras: ['Fissura oblíqua', 'Fissura horizontal']
  },
  pulmao_e: {
    lobos: ['Superior (S1-S5)', 'Inferior (S6-S10)'],
    segmentos: ['Apical-posterior', 'Anterior', 'Lingular superior', 'Lingular inferior', 'Superior', 'Basal anteromedial', 'Basal lateral', 'Basal posterior'],
    pleura: ['Visceral', 'Parietal'],
    fissuras: ['Fissura oblíqua'],
    especial: ['Incisura cardíaca (lingular)']
  },
  diafragma: { partes: ['Cúpula direita', 'Cúpula esquerda', 'Pilar direito', 'Pilar esquerdo', 'Centro tendíneo'], orifícios: ['Hiato esofágico (T10)', 'Hiato aórtico (T12)', 'Forame vena cava (T8)'] },
  pulmao_d_p: { partes: ['Segmentos basais posteriores', 'Lobo inferior posterior', 'Pleura parietal posterior'] },
  pulmao_e_p: { partes: ['Segmentos basais posteriores', 'Lobo inferior posterior', 'Pleura parietal posterior'] },
  diafragma_p: { partes: ['Cúpula direita (posterior)', 'Cúpula esquerda (posterior)', 'Pilares posteriores'] },

  // Circulatory
  coracao: {
    cavidades: ['Átrio Direito', 'Átrio Esquerdo', 'Ventrículo Direito', 'Ventrículo Esquerdo'],
    valvas: ['Mitral (Bicúspide)', 'Tricúspide', 'Aórtica semilunar', 'Pulmonar semilunar'],
    vasos: ['Aorta ascendente', 'Arco aórtico', 'Veia cava superior', 'Veia cava inferior', 'Tronco pulmonar', 'Veias pulmonares (4)'],
    coronarias: ['Tronco da coronária esquerda', 'Coronária direita', 'Descendente anterior (DA)', 'Circunflexa (Cx)'],
    conducao: ['Nodo SA (Keith-Flack)', 'Nodo AV (Aschoff-Tawara)', 'Feixe de His', 'Fibras de Purkinje']
  },
  pericardio: { partes: ['Pericárdio fibroso', 'Pericárdio seroso (parietal)', 'Epicárdio (visceral)', 'Cavidade pericárdica'] },
  aorta_arco: { segmentos: ['Aorta ascendente', 'Arco aórtico', 'Tronco braquiocefálico', 'Carótida comum esquerda', 'Subclávia esquerda'] },
  aorta_abdominal: {
    segmentos: ['Tronco celíaco (T12)', 'Artéria mesentérica superior (L1)', 'Artérias renais (L1-L2)', 'Artéria mesentérica inferior (L3)', 'Bifurcação ilíaca (L4)'],
    camadas: ['Íntima', 'Média', 'Adventícia']
  },
  veia_cava_sup: { afluentes: ['Veia braquiocefálica direita', 'Veia braquiocefálica esquerda', 'Veia ázigos'] },
  carotida_d: { segmentos: ['Carótida comum D', 'Carótida interna D', 'Carótida externa D', 'Bulbo carotídeo (barorreceptores/quimiorreceptores)'] },
  carotida_e: { segmentos: ['Carótida comum E', 'Carótida interna E', 'Carótida externa E', 'Bulbo carotídeo (barorreceptores/quimiorreceptores)'] },
  femoral_d: { segmentos: ['Artéria femoral comum D', 'Artéria femoral superficial D', 'Artéria femoral profunda D'] },
  femoral_e: { segmentos: ['Artéria femoral comum E', 'Artéria femoral superficial E', 'Artéria femoral profunda E'] },

  // Digestive
  esofago: {
    segmentos: ['Cervical (C6-T1)', 'Torácico (T1-T10)', 'Abdominal (T10-T11)'],
    esfincteres: ['Esfíncter esofágico superior (EES)', 'Esfíncter esofágico inferior/Cárdia (EEI)'],
    relacoes: ['Aorta descendente', 'Ducto torácico', 'Traqueia (anterior)']
  },
  figado: {
    lobos: ['Lobo direito (maior)', 'Lobo esquerdo', 'Lobo caudado (Spiegel)', 'Lobo quadrado'],
    segmentos: ['I (Caudado)', 'II/III (Esquerdo lateral)', 'IV (Quadrado)', 'V/VI (Direito anterior)', 'VII/VIII (Direito posterior)'],
    vascularizacao: ['Veia porta (70% fluxo)', 'Artéria hepática própria (30% fluxo)', 'Veias hepáticas (3 principais)']
  },
  vesicula_biliar: {
    partes: ['Fundo', 'Corpo', 'Infundíbulo (Pescoço de Hartmann)'],
    ductos: ['Ducto cístico', 'Ducto hepático comum', 'Ducto colédoco (coledocal)']
  },
  estomago: {
    partes: ['Cárdia', 'Fundo gástrico', 'Corpo gástrico', 'Antro pilórico', 'Canal pilórico'],
    curvaturas: ['Grande curvatura', 'Pequena curvatura (Incisura angular)'],
    camadas: ['Mucosa (células parietais, principais, G)', 'Submucosa', 'Muscular', 'Serosa']
  },
  baco_frente: {
    partes: ['Polpa branca (nódulos linfáticos)', 'Polpa vermelha (sinusóides)', 'Hilo esplênico', 'Cápsula esplênica'],
    funcoes: ['Filtração sanguínea', 'Hematopoiese fetal', 'Imunidade']
  },
  duodeno: {
    partes: ['Bulbo (D1)', 'Porção descendente (D2)', 'Porção horizontal (D3)', 'Porção ascendente (D4)'],
    especial: ['Papila duodenal maior (Vater)', 'Papila duodenal menor', 'Esfíncter de Oddi']
  },
  intestino_delgado: {
    segmentos: ['Duodeno (25 cm)', 'Jejuno (2-3 m)', 'Íleo (3-4 m)'],
    vascularizacao: ['Artéria mesentérica superior'],
    mucosa: ['Vilosidades intestinais', 'Microvilosidades (borda em escova)', 'Placas de Peyer (íleo)']
  },
  colon_ascendente: { partes: ['Ceco', 'Cólon ascendente', 'Flexura hepática (direita)'], caracteristicas: ['Haustras', 'Tênias cólicas', 'Apêndices epiploicos'] },
  colon_transverso: { partes: ['Flexura hepática', 'Cólon transverso', 'Flexura esplênica'], mesenterio: ['Mesocólon transverso'] },
  colon_descendente: { partes: ['Flexura esplênica (esquerda)', 'Cólon descendente', 'Junção retossigmoide'] },
  colon_sigmoide: { partes: ['Cólon sigmoide', 'Junção retossigmoide'], relevancia: ['Alta incidência de diverticulose', 'Torção (vólvulo)'] },
  apendice: { partes: ['Base (ponto de McBurney)', 'Corpo', 'Ápice'], posicoes: ['Retrocecal (65%)', 'Pélvica (30%)', 'Outras (5%)'] },
  reto: { partes: ['Reto proximal', 'Ampola retal', 'Canal anal', 'Esfíncter anal interno (involuntário)', 'Esfíncter anal externo (voluntário)'] },

  // Urinary
  rim_d: {
    partes: ['Córtex renal', 'Medula (Pirâmides de Malpighi)', 'Cálices menores (8-12)', 'Cálices maiores (2-3)', 'Pelve renal', 'Hilo renal'],
    unidade: ['Néfron (1 milhão/rim)', 'Corpúsculo de Malpighi', 'Túbulos proximais e distais', 'Alça de Henle', 'Ducto coletor']
  },
  rim_e: {
    partes: ['Córtex renal', 'Medula (Pirâmides de Malpighi)', 'Cálices menores (8-12)', 'Cálices maiores (2-3)', 'Pelve renal', 'Hilo renal'],
    unidade: ['Néfron (1 milhão/rim)', 'Corpúsculo de Malpighi', 'Túbulos proximais e distais', 'Alça de Henle', 'Ducto coletor']
  },
  ureteres: {
    segmentos: ['Abdominal', 'Pélvico', 'Intramural (vesical)'],
    estreitamentos: ['Junção pielocalicial', 'Cruzamento vasos ilíacos', 'Junção ureterovesical'],
    funcao: ['Transporte ativo de urina por peristaltismo']
  },
  bexiga: {
    partes: ['Vértice', 'Corpo', 'Fundo (Trígono vesical)', 'Colo vesical', 'Músculo detrusor', 'Mucosa (urotélio)'],
    capacidade: ['Fisiológica: 300-500 mL', 'Máxima: 600-1000 mL']
  },

  // Lymphatic
  linfonodos_cervicais: {
    grupos: ['Nível I (Submentoniano/Submandibular)', 'Nível II/III/IV (Cadeia jugular interna)', 'Nível V (Triângulo posterior)', 'Nível VI (Compartimento central)'],
    drenagem: ['Cabeça', 'Pescoço', 'Parte superior do tórax']
  },
  linfonodos_axilares_d: {
    grupos: ['Grupo lateral (venoso braquial)', 'Grupo anterior/peitoral', 'Grupo posterior/subescapular', 'Grupo central', 'Grupo apical/subclavicular'],
    drenagem: ['Membro superior D', 'Mama D', 'Parede torácica D']
  },
  linfonodos_axilares_e: {
    grupos: ['Grupo lateral (venoso braquial)', 'Grupo anterior/peitoral', 'Grupo posterior/subescapular', 'Grupo central', 'Grupo apical/subclavicular'],
    drenagem: ['Membro superior E', 'Mama E', 'Parede torácica E']
  },
  vasos_quiferos: {
    partes: ['Cisterna do Quilo (L1-L2)', 'Ducto torácico', 'Confluência dos troncos linfáticos abdominais'],
    funcao: ['Coleta de quilo intestinal', 'Drenagem linfática abdominal inferior']
  },
  ducto_toracico: { trajeto: ['Cisterna do quilo', 'Tórax posterior (D→E)', 'Ângulo venoso jugulo-subclávio esquerdo'], funcao: ['Drenagem de 3/4 do corpo'] },
  baco: {
    partes: ['Polpa branca (nódulos linfáticos)', 'Polpa vermelha (sinusóides)', 'Hilo esplênico', 'Cápsula fibrosa'],
    funcoes: ['Filtração eritrocitária', 'Resposta imune (anticorpos)', 'Reserva plaquetária', 'Eritropoiese fetal']
  },
  linfonodos_inguinais: {
    grupos: ['Superficiais horizontais (ligamento inguinal)', 'Superficiais verticais (veia safena magna)', 'Profundos (nó de Cloquet/Rosenmüller)'],
    drenagem: ['Membro inferior', 'Genitália externa', 'Períneo', 'Região glútea inferior']
  },

  // Reproductive
  utero: {
    partes: ['Fundo uterino', 'Corpo uterino', 'Istmo', 'Cérvix (colo)'],
    camadas: ['Endométrio (funcional + basal)', 'Miométrio (muscular liso)', 'Perimétrio (serosa)'],
    ligamentos: ['Ligamento largo', 'Ligamento redondo', 'Ligamento útero-sacral'],
    adjacentes: ['Trompas de Falópio', 'Ovários']
  },
  ovarios: {
    partes: ['Córtex (folículos)', 'Medula (vasos)', 'Hilo ovariano'],
    ciclo: ['Folículo primordial → primário → secundário → de Graaf → ovulação → corpo lúteo → corpo albicante'],
    hormonios: ['Estrogênio', 'Progesterona', 'Androgênios (DHEA)']
  },
  testiculos: {
    partes: ['Epidídimo (cabeça/corpo/cauda)', 'Túbulos seminíferos', 'Células de Sertoli', 'Células de Leydig', 'Túnica albugínea', 'Túnica vaginal'],
    hormonios: ['Testosterona', 'Inibina B'],
    funcao: ['Espermatogênese', 'Esteroidogênese']
  },
  prostata: {
    zonas: ['Zona periférica (70%)', 'Zona central (25%)', 'Zona de transição (5%)', 'Estroma fibromuscular anterior'],
    funcao: ['Produção de fluido seminal (30%)', 'PSA (antígeno prostático específico)'],
    adjacentes: ['Bexiga (superior)', 'Reto (posterior)', 'Glândulas bulbouretrais de Cowper']
  },

  // Nervous System Details
  cerebro: {
    partes: ['Telencéfalo', 'Diencéfalo (tálamo/hipotálamo)', 'Lobos: Frontal, Parietal, Temporal, Occipital', 'Corpo caloso', 'Núcleos da base'],
    funcoes: ['Cognição', 'Linguagem', 'Controle Motor Voluntário', 'Sensibilidade', 'Memória', 'Emoção']
  },
  cerebelo: {
    partes: ['Lobo anterior', 'Lobo posterior', 'Vermis', 'Hemisférios cerebelares', 'Núcleos profundos'],
    funcoes: ['Coordenação motora fina', 'Equilíbrio', 'Aprendizado motor', 'Ajuste tônus muscular']
  },
  cerebro_p: {
    partes: ['Córtex occipital', 'Lobo parietal posterior', 'Cerebelo (visão posterior)', 'Artérias vertebrobasilares'],
    funcoes: ['Processamento visual', 'Integração sensorial', 'Coordenação']
  },
  cerebelo_p: { partes: ['Vermis cerebelar', 'Hemisférios (visão posterior)', 'Tonsila cerebelar'], funcoes: ['Coordenação, equilíbrio'] },
  tronco_encefalico: {
    partes: ['Mesencéfalo (pedúnculos cerebrais, colículos)', 'Ponte (Varolii)', 'Bulbo (mielencéfalo)', 'Formação reticular'],
    funcoes: ['Controle Autonômico Vital (FC, FR, PA)', 'Nervos Cranianos III–XII', 'Consciência (SARA)']
  },
  medula_espinhal_v: {
    segmentos: ['Cervical (C1-C8)', 'Torácico (T1-T12)', 'Lombar (L1-L5)', 'Sacral (S1-S5)', 'Coccígeo'],
    funcoes: ['Condução nervosa aferente/eferente', 'Reflexos medulares', 'Controle esfincteriano'],
    estruturas: ['Substância cinzenta (cornos anterior/posterior)', 'Substância branca (cordões)']
  },
  medula_p: {
    segmentos: ['Cervical (C1-C8)', 'Torácico (T1-T12)', 'Lombar (L1-L5)', 'Sacral (S1-S5)', 'Caudal Equina'],
    funcoes: ['Condução eferente/aferente', 'Reflexos', 'Controle autonômico']
  },
  plexo_braquial_d: {
    raizes: ['C5', 'C6', 'C7', 'C8', 'T1'],
    troncos: ['Superior (C5-C6)', 'Médio (C7)', 'Inferior (C8-T1)'],
    fasciculos: ['Lateral', 'Posterior', 'Medial'],
    nervos: ['Musculocutâneo', 'Mediano', 'Ulnar', 'Radial', 'Axilar'],
    inervacao: ['Membro Superior Direito completo']
  },
  plexo_braquial_e: {
    raizes: ['C5', 'C6', 'C7', 'C8', 'T1'],
    troncos: ['Superior (C5-C6)', 'Médio (C7)', 'Inferior (C8-T1)'],
    nervos: ['Musculocutâneo', 'Mediano', 'Ulnar', 'Radial', 'Axilar'],
    inervacao: ['Membro Superior Esquerdo completo']
  },
  nervo_mediano_d: {
    origem: ['Fascículo medial e lateral do plexo braquial'],
    trajeto: ['Braço (medial)', 'Fossa cubital', 'Antebraço (entre flexores)', 'Túnel do carpo', 'Palma'],
    funcoes: ['Flexão punho/dedos I-III', 'Oposição do polegar', 'Sensibilidade palmar lateral']
  },
  nervo_mediano_e: {
    origem: ['Fascículo medial e lateral do plexo braquial'],
    trajeto: ['Braço (medial)', 'Fossa cubital', 'Antebraço', 'Túnel do carpo', 'Palma'],
    funcoes: ['Flexão punho/dedos I-III', 'Oposição do polegar', 'Sensibilidade palmar lateral']
  },
  plexo_lombosacro_d: {
    plexo_lombar: ['L1 (ilio-hipogástrico, ilio-inguinal)', 'L2-L3 (femoral cutâneo lateral)', 'L2-L4 (femoral, obturatório)'],
    plexo_sacral: ['L4-S4 (isquiático/ciático)', 'S2-S4 (pudendo)', 'S4-Co1 (coccígeo)'],
    funcao: ['Inervação motora e sensitiva de pelve e membro inferior D']
  },
  plexo_lombosacro_e: {
    plexo_lombar: ['L1 (ilio-hipogástrico, ilio-inguinal)', 'L2-L3 (femoral cutâneo lateral)', 'L2-L4 (femoral, obturatório)'],
    plexo_sacral: ['L4-S4 (isquiático/ciático)', 'S2-S4 (pudendo)', 'S4-Co1 (coccígeo)'],
    funcao: ['Inervação motora e sensitiva de pelve e membro inferior E']
  },
  nervo_femoral_d: {
    origem: ['L2-L4 (plexo lombar)'],
    trajeto: ['Lacuna muscular (sob ligamento inguinal)', 'Trígono femoral', 'Canal do adutor (Hunter)', 'Nervo safeno (ramo sensitivo)'],
    inervacao: ['Motor: quadríceps, íliopsoas, sartório, pectíneo', 'Sensitivo: coxa anterior, perna medial (safeno)']
  },
  nervo_femoral_e: {
    origem: ['L2-L4 (plexo lombar)'],
    trajeto: ['Lacuna muscular', 'Trígono femoral', 'Canal do adutor'],
    inervacao: ['Motor: quadríceps, íliopsoas', 'Sensitivo: coxa anterior, perna medial']
  },
  gluteos_p: {
    musculos: ['Glúteo máximo (extensão/rotação lateral do quadril)', 'Glúteo médio (abdução)', 'Glúteo mínimo (abdução)', 'Piriforme', 'Obturador interno/externo', 'Quadrado femoral', 'Gêmeos superior/inferior'],
    nervos: ['Nervo glúteo superior (L4-S1)', 'Nervo glúteo inferior (L5-S2)', 'Nervo isquiático', 'Nervo pudendo']
  },
  nervo_ciatico_d: {
    origem: ['L4-S3 (maior nervo do corpo)'],
    trajeto: ['Forame isquiático maior', 'Abaixo do piriforme', 'Fossa poplítea → divisão tibial/fibular'],
    inervacao: ['Motor: isquiotibiais, toda perna/pé', 'Sensitivo: perna posterior, pé'],
    patologias: ['Ciatalgia', 'Síndrome do Piriforme', 'Hérnia discal L4-S1']
  },
  nervo_ciatico_e: {
    origem: ['L4-S3'],
    trajeto: ['Forame isquiático maior E', 'Coxa posterior E', 'Divisão tibial/fibular'],
    inervacao: ['Motor: isquiotibiais, perna/pé E', 'Sensitivo: perna posterior E, pé E'],
    patologias: ['Ciatalgia', 'Síndrome do Piriforme', 'Compressão discal']
  },
};
