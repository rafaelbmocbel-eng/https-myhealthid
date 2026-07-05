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

  // Medula espinhal (vista anterior): faixa vertical fina pela linha média
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

  // Plexo lombossacro direito: feixe nervoso lombar baixo direito
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

  // Nervo femoral direito: nervo da coxa direita
  {
    id: 'nervo_femoral_d',
    label: 'Nervo Femoral D',
    view: 'front',
    sistemas: ['nervoso'],
    type: 'nerve',
    layer: 9,
    d: 'M142 316 C 144 334 146 354 145 374'
  },

  // Nervo femoral esquerdo: nervo da coxa esquerda
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

  // Aorta abdominal: midline descending, bifurcates into iliac arteries
  {
    id: 'aorta_abdominal',
    label: 'Aorta Abdominal',
    view: 'front',
    sistemas: ['circulatorio'],
    type: 'vessel',
    layer: 9,
    d: 'M118 182 L118 294 L122 294 L122 182 Z'
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

  // Veia cava inferior: parallel to aorta abdominal, slightly to patient's right (screen LEFT)
  {
    id: 'veia_cava_inf',
    label: 'Veia Cava Inferior',
    view: 'front',
    sistemas: ['circulatorio'],
    type: 'vessel',
    layer: 9,
    d: 'M113 184 L113 294 L115 294 L115 184 Z'
  },

  // Vasos pulmonares: short trunks from heart base toward each lung hilum
  {
    id: 'vasos_pulmonares',
    label: 'Vasos Pulmonares',
    view: 'front',
    sistemas: ['circulatorio'],
    type: 'vessel',
    layer: 9,
    d: 'M128 148 C 122 144 116 140 110 138 M128 152 C 134 148 140 144 146 142'
  },

  // Femoral direita: artéria da coxa direita
  {
    id: 'femoral_d',
    label: 'Artéria Femoral D',
    view: 'front',
    sistemas: ['circulatorio'],
    type: 'vessel',
    layer: 9,
    d: 'M108 308 C 106 326 104 348 103 372 C 102 392 102 410 102 430'
  },

  // Femoral esquerda: artéria da coxa esquerda
  {
    id: 'femoral_e',
    label: 'Artéria Femoral E',
    view: 'front',
    sistemas: ['circulatorio'],
    type: 'vessel',
    layer: 9,
    d: 'M132 308 C 134 326 136 348 137 372 C 138 392 138 410 138 430'
  },

  // Artérias subclávias: do arco aórtico para os ombros/braços
  {
    id: 'subclavias_d',
    label: 'Artéria Subclávia D',
    view: 'front',
    sistemas: ['circulatorio'],
    type: 'vessel',
    layer: 9,
    d: 'M118 124 C 108 120 96 118 86 122 C 78 126 74 136 76 150'
  },
  {
    id: 'subclavias_e',
    label: 'Artéria Subclávia E',
    view: 'front',
    sistemas: ['circulatorio'],
    type: 'vessel',
    layer: 9,
    d: 'M122 124 C 132 120 144 118 154 122 C 162 126 166 136 164 150'
  },

  // Artérias ilíacas comuns: bifurcação da aorta abdominal (y=294) para as femorais (y=308)
  {
    id: 'iliaca_d',
    label: 'Artéria Ilíaca D',
    view: 'front',
    sistemas: ['circulatorio'],
    type: 'vessel',
    layer: 9,
    d: 'M118 294 C 116 298 112 304 108 308'
  },
  {
    id: 'iliaca_e',
    label: 'Artéria Ilíaca E',
    view: 'front',
    sistemas: ['circulatorio'],
    type: 'vessel',
    layer: 9,
    d: 'M122 294 C 124 298 128 304 132 308'
  },

  // ── RESPIRATORY ─────────────────────────────

  // Traqueia: começa abaixo da laringe (y114) e desce até a carina/bifurcação
  {
    id: 'traqueia',
    label: 'Traqueia',
    view: 'front',
    sistemas: ['respiratorio'],
    type: 'organ',
    layer: 8,
    d: 'M118 114 L118 133 C 114 138 106 142 104 148 L106 150 C 108 145 116 140 118 137 L120 140 L122 137 C 124 140 132 145 134 150 L136 148 C 134 142 126 138 122 133 L122 114 Z'
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

  // Pulmão direito (patient RIGHT = screen LEFT): preenche a caixa torácica
  // do ombro até o gradil costal inferior, como referenciado no desenho
  {
    id: 'pulmao_d',
    label: 'Pulmão Direito',
    view: 'front',
    sistemas: ['respiratorio'],
    type: 'organ',
    layer: 2,
    d: 'M115 107 C 108 106 96 108 87 113 C 78 118 73 128 73 138 C 73 150 75 162 79 171 C 83 179 88 185 95 189 C 102 192 110 192 115 190 L115 107 Z'
  },

  // Pulmão esquerdo (patient LEFT = screen RIGHT): preenche a caixa torácica
  // do ombro até o gradil costal inferior, como referenciado no desenho
  {
    id: 'pulmao_e',
    label: 'Pulmão Esquerdo',
    view: 'front',
    sistemas: ['respiratorio'],
    type: 'organ',
    layer: 2,
    d: 'M125 107 C 132 106 143 108 152 113 C 161 118 167 128 167 138 C 167 150 165 162 161 172 C 157 180 151 186 143 190 C 136 193 130 192 125 190 C 125 184 124 177 121 171 C 119 165 119 157 122 151 C 124 145 125 140 125 133 L125 107 Z'
  },

  // Diafragma: dome-shaped arch, raised to follow new lung base
  {
    id: 'diafragma',
    label: 'Diafragma',
    view: 'front',
    sistemas: ['respiratorio'],
    type: 'structural',
    layer: 10,
    d: 'M82 198 C 88 192 96 186 104 182 C 110 179 115 178 120 178 C 125 178 130 179 136 182 C 144 186 152 192 158 198'
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
    d: 'M119 102 C 119 116 119 132 119 140 L121 140 C 121 132 121 116 121 102 Z'
  },

  // Fígado: large right-dominant wedge, right upper quadrant
  // Patient RIGHT = screen LEFT: x=76-138, y=200-242 (below diaphragm)
  {
    id: 'figado',
    label: 'Fígado',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 6,
    d: 'M 118 200 C 108 198 94 198 84 202 C 78 206 76 214 76 222 C 76 230 80 236 88 240 C 96 244 108 244 118 242 C 128 240 136 234 138 226 C 140 218 138 208 132 202 C 126 198 122 198 118 200 Z'
  },

  // Vesícula biliar: pear-shaped under liver right lobe
  // Below liver inferior surface y≈242: x=108-119, y=232-248
  {
    id: 'vesicula_biliar',
    label: 'Vesícula Biliar',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 7,
    d: 'M 110 232 C 108 227 109 220 112 218 C 115 216 118 218 119 222 C 120 226 119 232 117 237 C 115 241 110 241 109 237 C 108 235 109 233 110 232 Z'
  },

  // Estômago: J-shaped bag, patient LEFT (screen RIGHT)
  // Fundus at top (x≈140,y≈200), body curves down, antrum turns medially
  {
    id: 'estomago',
    label: 'Estômago',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 6,
    d: 'M 140 200 C 148 197 160 201 163 212 C 166 224 165 239 161 251 C 157 259 151 263 145 261 C 139 259 135 253 134 245 C 133 235 134 223 137 213 C 138 207 139 202 140 200 Z'
  },

  // Baço (vista anterior, para digestório/linfático)
  // Anatômico: 9ª–11ª costela, hipocôndrio esquerdo, abaixo do diafragma
  {
    id: 'baco_frente',
    label: 'Baço',
    view: 'front',
    sistemas: ['digestorio', 'linfatico'],
    type: 'organ',
    layer: 6,
    d: 'M 154 200 C 158 197 164 200 167 208 C 170 216 168 224 163 228 C 159 231 154 229 151 223 C 148 217 150 206 154 200 Z'
  },

  // Pâncreas: retroperitoneal, atrás do estômago — deslocado para y=236-252
  // para aparecer visível abaixo da borda inferior do fígado (y=244)
  {
    id: 'pancreas_corpo',
    label: 'Pâncreas',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 5,
    d: 'M 102 240 C 108 236 118 234 130 234 C 142 234 152 236 157 242 C 159 244 158 248 155 250 C 149 252 138 252 128 250 C 118 250 108 250 102 248 C 100 246 100 242 102 240 Z'
  },

  // Ilhotas de Langerhans (endócrino do pâncreas): mesma posição
  {
    id: 'ilhotas_langerhans',
    label: 'Ilhotas de Langerhans',
    view: 'front',
    sistemas: ['endocrino'],
    type: 'gland',
    layer: 5,
    d: 'M 102 240 C 108 236 118 234 130 234 C 142 234 152 236 157 242 C 159 244 158 248 155 250 C 149 252 138 252 128 250 C 118 250 108 250 102 248 C 100 246 100 242 102 240 Z'
  },

  // Duodeno: alça em C contornando a cabeça do pâncreas, lado DIREITO do paciente (x<120)
  // y=238-272, abaixo do fígado/pâncreas
  {
    id: 'duodeno',
    label: 'Duodeno',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 7,
    d: 'M 114 238 C 108 234 100 236 96 244 C 92 252 94 262 98 268 C 102 274 110 274 114 270 C 116 268 116 262 114 256 C 112 250 112 244 114 238 Z'
  },

  // Intestino delgado: alças centrais abaixo do fígado e estômago
  {
    id: 'intestino_delgado',
    label: 'Intestino Delgado',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 4,
    d: 'M 100 246 C 106 242 118 240 130 242 C 138 244 144 248 144 254 C 144 260 138 264 130 266 C 122 268 112 268 104 266 C 96 264 92 258 94 252 C 96 248 100 246 100 246 M 102 270 C 110 268 122 268 132 270 C 140 272 144 278 142 284 C 140 288 134 290 126 290 C 116 290 106 288 100 284 C 96 280 98 272 102 270 Z'
  },

  // Cólon ascendente: right side (screen LEFT), do flanco direito ao ângulo hepático
  {
    id: 'colon_ascendente',
    label: 'Cólon Ascendente',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 3,
    d: 'M 88 282 C 86 268 86 256 88 246 C 90 240 94 238 98 240 C 100 242 100 248 100 256 C 100 268 98 280 96 288 C 94 292 90 288 88 282 Z'
  },

  // Cólon transverso: horizontal, abaixo do fígado e estômago
  {
    id: 'colon_transverso',
    label: 'Cólon Transverso',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 3,
    d: 'M 96 244 C 104 240 112 238 120 240 C 128 238 136 240 144 244 C 148 246 150 250 148 252 C 146 256 138 256 128 254 C 120 254 112 254 104 256 C 98 256 94 252 96 244 Z'
  },

  // Cólon descendente: left side (screen RIGHT), do ângulo esplênico ao sigmoide
  {
    id: 'colon_descendente',
    label: 'Cólon Descendente',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 3,
    d: 'M 148 244 C 150 258 152 272 152 284 C 152 290 150 294 146 294 C 142 294 140 290 140 284 C 140 272 140 258 142 246 C 143 242 147 240 148 244 Z'
  },

  // Cólon sigmoide: S-shaped lower left
  {
    id: 'colon_sigmoide',
    label: 'Cólon Sigmoide',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 3,
    d: 'M 146 288 C 144 292 140 296 134 296 C 128 296 124 292 122 288 C 120 284 118 282 120 286 C 122 290 122 296 120 300 C 118 302 116 302 116 298 Z'
  },

  // Apêndice: small finger at cecum, lower right
  {
    id: 'apendice',
    label: 'Apêndice Vermiforme',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 7,
    d: 'M 94 286 C 96 286 98 288 100 292 C 102 296 102 300 100 302 C 98 304 96 302 94 298 C 92 294 92 286 94 286 Z'
  },

  // Reto: rectum midline, pelvis
  {
    id: 'reto',
    label: 'Reto',
    view: 'front',
    sistemas: ['digestorio'],
    type: 'organ',
    layer: 5,
    d: 'M 116 280 C 116 276 118 272 120 272 C 122 272 124 276 124 280 L 124 296 C 124 298 122 300 120 300 C 118 300 116 298 116 296 Z'
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

  // Pineal: tiny gland between cerebrum and cerebellum
  {
    id: 'pineal',
    label: 'Glândula Pineal',
    view: 'front',
    sistemas: ['endocrino'],
    type: 'gland',
    layer: 10,
    d: 'M122 59 C 122 57.5 123 57 124 57.5 C 125 58 125 60 124 60.5 C 123 61 122 60.5 122 59 Z'
  },

  // Paratireoides: 4 tiny glands, 2 per thyroid lobe
  {
    id: 'paratireoides',
    label: 'Paratireoides',
    view: 'front',
    sistemas: ['endocrino'],
    type: 'gland',
    layer: 9,
    d: 'M106 93 C 105.5 92 106.5 91 107.5 92 C 108.5 93 107.5 94.5 106 93 Z M106 101 C 105.5 100 106.5 99 107.5 100 C 108.5 101 107.5 102.5 106 101 Z M132 93 C 131.5 92 132.5 91 133.5 92 C 134.5 93 133.5 94.5 132 93 Z M132 101 C 131.5 100 132.5 99 133.5 100 C 134.5 101 133.5 102.5 132 101 Z'
  },

  // Adrenal direita (patient RIGHT = screen LEFT): polo superior do rim direito (y≈172)
  // Pequena glândula triangular assentada sobre o polo superior do rim D
  {
    id: 'adrenal_d',
    label: 'Glândula Suprarrenal D',
    view: 'front',
    sistemas: ['endocrino'],
    type: 'gland',
    layer: 7,
    d: 'M 105 164 C 109 160 114 160 116 164 C 118 168 116 173 113 175 C 110 176 106 174 104 170 C 103 168 103 166 105 164 Z'
  },

  // Adrenal esquerda (patient LEFT = screen RIGHT): polo superior do rim esquerdo (y≈164)
  // Pequena glândula em meia-lua sobre o polo superior do rim E
  {
    id: 'adrenal_e',
    label: 'Glândula Suprarrenal E',
    view: 'front',
    sistemas: ['endocrino'],
    type: 'gland',
    layer: 7,
    d: 'M 125 157 C 129 153 134 153 136 157 C 138 161 136 166 133 168 C 130 169 126 167 124 164 C 123 162 123 159 125 157 Z'
  },

  // ── URINARY ──────────────────────────────────

  // Rim direito (vista anterior): retroperitoneal, entre a 9ª e a 12ª costela,
  // levemente mais baixo que o esquerdo por causa do fígado
  {
    id: 'rim_d_frente',
    label: 'Rim Direito',
    view: 'front',
    sistemas: ['urinario'],
    type: 'organ',
    layer: 1,
    d: 'M92 171.9 C 88 174.5 86 179.7 86 186.1 C 86 192.6 88 197.8 92 200.4 C 96 203 102 203 108 201.7 C 114 200.4 117 197.8 118 192.6 C 119 190 117 187.4 115 186.1 C 117 184.9 119 182.3 118 178.4 C 117 173.2 113 170.6 107 169.3 C 101 168 96 169.3 92 171.9 Z'
  },

  // Rim esquerdo (vista anterior): retroperitoneal, entre a 9ª e a 12ª costela
  {
    id: 'rim_e_frente',
    label: 'Rim Esquerdo',
    view: 'front',
    sistemas: ['urinario'],
    type: 'organ',
    layer: 1,
    d: 'M148 164.8 C 152 167.3 154 172.3 154 178.6 C 154 184.9 152 190 148 192.5 C 144 195 138 195 132 193.7 C 126 192.5 123 190 122 184.9 C 121 182.4 123 179.9 125 178.6 C 123 177.4 121 174.9 122 171.1 C 123 166 127 163.5 133 162.3 C 139 162.3 144 162.3 148 164.8 Z'
  },

  // Ureteres: dos rins (y≈203/195) até o topo da bexiga (y=218)
  {
    id: 'ureteres',
    label: 'Ureteres',
    view: 'front',
    sistemas: ['urinario'],
    type: 'vessel',
    layer: 6,
    d: 'M112 203 C 113 208 114 214 116 218 M128 195 C 127 200 126 210 124 218'
  },

  // Bexiga: baixo abdome / pelve, acima da sínfise pubiana
  {
    id: 'bexiga',
    label: 'Bexiga Urinária',
    view: 'front',
    sistemas: ['urinario'],
    type: 'organ',
    layer: 5,
    d: 'M116 218 C 112 214 108 214 108 224 C 108 232 110 238 114 242 C 116 244 118 246 120 246 C 122 246 124 244 126 242 C 130 238 132 232 132 224 C 132 214 128 214 124 218 C 122 216 118 216 116 218 Z'
  },

  // Uretra: continua do colo da bexiga até o períneo
  {
    id: 'uretra',
    label: 'Uretra',
    view: 'front',
    sistemas: ['urinario'],
    type: 'organ',
    layer: 5,
    d: 'M118 258 L118 270 L122 270 L122 258 Z'
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

  // Baço (linfático): mesma posição do baco_frente (9ª–11ª costela, hipocôndrio esquerdo, abaixo do diafragma)
  {
    id: 'baco',
    label: 'Baço',
    view: 'front',
    sistemas: ['linfatico'],
    type: 'organ',
    layer: 6,
    d: 'M 154 200 C 158 197 164 200 167 208 C 170 216 168 224 163 228 C 159 231 154 229 151 223 C 148 217 150 206 154 200 Z'
  },

  // Cisterna do quilo: nível de L2, abaixo do fígado e intestinos (y≈252)
  {
    id: 'vasos_quiferos',
    label: 'Cisterna do Quilo',
    view: 'front',
    sistemas: ['linfatico'],
    type: 'gland',
    layer: 8,
    d: 'M118 252 C 118 249 119 248 120 248 C 121 248 122 249 122 252 C 122 255 121 256 120 256 C 119 256 118 255 118 252 Z'
  },

  // Ducto torácico: da cisterna (y=252) sobe pela coluna até o ângulo venoso (y=128)
  {
    id: 'ducto_toracico',
    label: 'Ducto Torácico',
    view: 'front',
    sistemas: ['linfatico'],
    type: 'vessel',
    layer: 8,
    d: 'M120 252 C 121 236 122 218 122 200 C 122 182 120 164 118 148 C 118 140 118 134 118 128'
  },

  // Linfonodos inguinais: bilateral na região inguinal (y=242-248)
  {
    id: 'linfonodos_inguinais',
    label: 'Linfonodos Inguinais',
    view: 'front',
    sistemas: ['linfatico'],
    type: 'gland',
    layer: 9,
    d: 'M100 246 C 99 244 100 242 102 242 C 104 242 105 244 104 246 C 104 248 102 248 100 246 Z M136 246 C 135 244 136 242 138 242 C 140 242 141 244 140 246 C 140 248 138 248 136 246 Z'
  },

  // ── REPRODUCTIVE ─────────────────────────────

  // Útero: pera na pelve, posterior à bexiga (y=232-252)
  {
    id: 'utero',
    label: 'Útero',
    view: 'front',
    sistemas: ['reprodutor'],
    type: 'organ',
    layer: 6,
    d: 'M114 242 C 112 238 112 234 116 232 C 118 230 122 230 124 232 C 128 234 128 238 126 242 C 124 246 122 250 120 252 C 118 250 116 246 114 242 Z'
  },

  // Ovários: dois óvulos laterais ao útero (y=235-244)
  {
    id: 'ovarios',
    label: 'Ovários',
    view: 'front',
    sistemas: ['reprodutor'],
    type: 'organ',
    layer: 6,
    d: 'M106 240 C 105 238 106 235 108 235 C 110 235 111 238 110 240 C 110 243 108 244 106 242 C 105 242 106 241 106 240 Z M130 240 C 129 238 130 235 132 235 C 134 235 135 238 134 240 C 134 243 132 244 130 242 C 129 242 130 241 130 240 Z'
  },

  // Trompas de Falópio: tubos curvos conectando ovários ao fundo uterino (y=230-237)
  {
    id: 'trompas_falopio',
    label: 'Trompas de Falópio',
    view: 'front',
    sistemas: ['reprodutor'],
    type: 'organ',
    layer: 7,
    d: 'M108 237 C 112 233 116 231 120 230 M132 237 C 128 233 124 231 120 230'
  },

  // Testículos: abaixo da sínfise pubiana (y=254-264)
  {
    id: 'testiculos',
    label: 'Testículos',
    view: 'front',
    sistemas: ['reprodutor'],
    type: 'organ',
    layer: 6,
    d: 'M112 260 C 111 257 112 254 115 254 C 118 254 119 257 118 260 C 118 263 116 265 114 264 C 112 263 112 262 112 260 Z M128 260 C 127 257 128 254 131 254 C 134 254 135 257 134 260 C 134 263 132 265 130 264 C 128 263 128 262 128 260 Z'
  },

  // Próstata: abaixo da bexiga (y=250-258)
  {
    id: 'prostata',
    label: 'Próstata',
    view: 'front',
    sistemas: ['reprodutor'],
    type: 'gland',
    layer: 6,
    d: 'M116 254 C 116 251 118 250 120 250 C 122 250 124 251 124 254 C 124 257 122 258 120 258 C 118 258 116 257 116 254 Z'
  },

  // Vesículas seminais: posterolaterais à base da bexiga, acima da próstata (y=240-248)
  {
    id: 'vesiculas_seminais',
    label: 'Vesículas Seminais',
    view: 'front',
    sistemas: ['reprodutor'],
    type: 'gland',
    layer: 6,
    d: 'M110 246 C 108 244 108 241 111 240 C 114 239 116 241 116 244 C 116 247 113 249 111 248 C 110 248 110 247 110 246 Z M130 246 C 132 244 132 241 129 240 C 126 239 124 241 124 244 C 124 247 127 249 129 248 C 130 248 130 247 130 246 Z'
  },

  // ── SENSORY SYSTEM ───────────────────────────
  // Calibrado contra os landmarks reais da imagem do avatar (avatar-humano-frente.png):
  // olhos ≈ y 50, orelhas ≈ y 53, nariz ≈ y 58-66, boca ≈ y 70-74.

  // Olho direito (paciente) = lado esquerdo da tela
  {
    id: 'olho_d',
    label: 'Olho D',
    view: 'front',
    sistemas: ['sensorial'],
    type: 'organ',
    layer: 11,
    d: 'M108 50 C 108 48 110 47 112 48 C 114 49 114 51 112 52 C 110 53 108 52 108 50 Z'
  },

  // Olho esquerdo (paciente) = lado direito da tela
  {
    id: 'olho_e',
    label: 'Olho E',
    view: 'front',
    sistemas: ['sensorial'],
    type: 'organ',
    layer: 11,
    d: 'M128 50 C 128 48 130 47 132 48 C 134 49 134 51 132 52 C 130 53 128 52 128 50 Z'
  },

  // Orelha direita: na lateral da cabeça, altura do canal auditivo
  {
    id: 'orelha_d',
    label: 'Orelha D (Externa/Média/Interna)',
    view: 'front',
    sistemas: ['sensorial'],
    type: 'organ',
    layer: 11,
    d: 'M100 51 C 97 52 96 57 98 61 C 100 64 103 63 103 58 C 103 54 102 51 100 51 Z'
  },

  // Orelha esquerda
  {
    id: 'orelha_e',
    label: 'Orelha E (Externa/Média/Interna)',
    view: 'front',
    sistemas: ['sensorial'],
    type: 'organ',
    layer: 11,
    d: 'M140 51 C 143 52 144 57 142 61 C 140 64 137 63 137 58 C 137 54 138 51 140 51 Z'
  },

  // Nariz / mucosa olfatória: linha média do rosto
  {
    id: 'nariz_olfato',
    label: 'Nariz / Mucosa Olfatória',
    view: 'front',
    sistemas: ['sensorial'],
    type: 'organ',
    layer: 11,
    d: 'M118 58 C 117 62 116 65 117 67 C 118 69 122 69 123 67 C 124 65 123 62 122 58 C 121 57 119 57 118 58 Z'
  },

  // Língua / paladar: linha da boca
  {
    id: 'lingua_paladar',
    label: 'Língua / Paladar',
    view: 'front',
    sistemas: ['sensorial'],
    type: 'organ',
    layer: 11,
    d: 'M114 72 C 114 70 126 70 126 72 C 126 75 122 77 120 77 C 118 77 114 75 114 72 Z'
  },

  // ── INTEGUMENTARY SYSTEM ─────────────────────

  // Couro cabeludo: scalp arc at top of head
  {
    id: 'couro_cabeludo',
    label: 'Couro Cabeludo',
    view: 'front',
    sistemas: ['tegumentar'],
    type: 'structural',
    layer: 11,
    d: 'M96 27 C 100 19 140 19 144 27 L142 29 C 136 22 104 22 98 29 Z'
  },

  // Glândulas sebáceas: T-zone, symbolic
  {
    id: 'glandulas_sebaceas',
    label: 'Glândulas Sebáceas',
    view: 'front',
    sistemas: ['tegumentar'],
    type: 'gland',
    layer: 11,
    d: 'M116 46 C 115.5 45 116.5 44 117.5 45 C 118.5 46 117.5 47.5 116 46 Z M122 46 C 121.5 45 122.5 44 123.5 45 C 124.5 46 123.5 47.5 122 46 Z'
  },

  // Glândulas sudoríparas: palms, symbolic (hiperidrose palmar)
  {
    id: 'glandulas_sudoriparas',
    label: 'Glândulas Sudoríparas (palmares)',
    view: 'front',
    sistemas: ['tegumentar'],
    type: 'gland',
    layer: 11,
    d: 'M190 289 C 189.5 288 190.5 287 191.5 288 C 192.5 289 191.5 290.5 190 289 Z M46 289 C 45.5 288 46.5 287 47.5 288 C 48.5 289 47.5 290.5 46 289 Z'
  },

  // Unhas das mãos: bilateral, at hand tips
  {
    id: 'unhas_maos',
    label: 'Unhas das Mãos',
    view: 'front',
    sistemas: ['tegumentar'],
    type: 'structural',
    layer: 11,
    d: 'M190 298 C 190 296 192 295 194 296 C 196 297 196 299 194 300 C 192 301 190 300 190 298 Z M46 298 C 46 296 48 295 50 296 C 52 297 52 299 50 300 C 48 301 46 300 46 298 Z'
  },

  // Unhas dos pés: bilateral, at foot tips
  {
    id: 'unhas_pes',
    label: 'Unhas dos Pés',
    view: 'front',
    sistemas: ['tegumentar'],
    type: 'structural',
    layer: 11,
    d: 'M142 504 C 142 502 144 501 146 502 C 148 503 148 505 146 506 C 144 507 142 506 142 504 Z M94 504 C 94 502 96 501 98 502 C 100 503 100 505 98 506 C 96 507 94 506 94 504 Z'
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
  // Preenche a caixa torácica do ombro até o gradil costal inferior
  {
    id: 'pulmao_d_p',
    label: 'Pulmão Direito (Posterior)',
    view: 'back',
    sistemas: ['respiratorio'],
    type: 'organ',
    layer: 2,
    d: 'M115 107 C 108 106 96 108 87 113 C 78 118 73 128 73 138 C 73 150 75 162 79 171 C 83 179 88 185 95 189 C 102 192 110 192 115 190 L115 107 Z'
  },

  // Pulmão esquerdo posterior: left side (patient LEFT = screen RIGHT)
  // Vista posterior não tem entalhe cardíaco; base estendida até o diafragma
  {
    id: 'pulmao_e_p',
    label: 'Pulmão Esquerdo (Posterior)',
    view: 'back',
    sistemas: ['respiratorio'],
    type: 'organ',
    layer: 2,
    d: 'M125 107 C 132 106 143 108 152 113 C 161 118 167 128 167 138 C 167 150 165 162 161 172 C 157 180 151 186 143 190 C 136 193 130 192 125 190 L125 107 Z'
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

  // Rim direito (patient RIGHT = screen RIGHT na vista posterior, sem espelhamento): classic kidney bean shape, hilum medial
  // Entre a 9ª e a 12ª costela; rebaixado em relação ao rim esquerdo por causa do fígado
  {
    id: 'rim_d',
    label: 'Rim Direito',
    view: 'back',
    sistemas: ['urinario'],
    type: 'organ',
    layer: 6,
    d: 'M150 171.9 C 154 174.5 156 179.7 156 186.1 C 156 192.6 154 197.8 150 200.4 C 146 203 140 203 134 201.7 C 128 200.4 124 197.8 123 192.6 C 122 190 124 187.4 126 186.1 C 124 184.9 122 182.3 123 178.4 C 124 173.2 128 170.6 134 169.3 C 140 168 146 169.3 150 171.9 Z'
  },

  // Rim esquerdo (patient LEFT = screen LEFT na vista posterior, sem espelhamento): kidney bean, hilum medial
  // Entre a 9ª e a 12ª costela
  {
    id: 'rim_e',
    label: 'Rim Esquerdo',
    view: 'back',
    sistemas: ['urinario'],
    type: 'organ',
    layer: 6,
    d: 'M90 164.8 C 86 167.3 84 172.3 84 178.6 C 84 184.9 86 190 90 192.5 C 94 195 100 195 106 193.7 C 112 192.5 116 190 117 184.9 C 118 182.4 116 179.9 114 178.6 C 116 177.4 118 174.9 117 171.1 C 116 166 112 163.5 106 162.3 C 100 161 94 162.3 90 164.8 Z'
  },

  // Adrenal direita posterior: ovoide acima do polo superior do rim direito, sem sobreposição
  {
    id: 'adrenal_d_p',
    label: 'Glândula Suprarrenal D (Posterior)',
    view: 'back',
    sistemas: ['endocrino'],
    type: 'gland',
    layer: 7,
    d: 'M132 160 C 132 156.1 135.6 153 140 153 C 144.4 153 148 156.1 148 160 C 148 163.9 144.4 167 140 167 C 135.6 167 132 163.9 132 160 Z'
  },

  // Adrenal esquerda posterior: ovoide acima do polo superior do rim esquerdo, sem sobreposição
  {
    id: 'adrenal_e_p',
    label: 'Glândula Suprarrenal E (Posterior)',
    view: 'back',
    sistemas: ['endocrino'],
    type: 'gland',
    layer: 7,
    d: 'M93 153 C 93 149.1 96.6 146 101 146 C 105.4 146 109 149.1 109 153 C 109 156.9 105.4 160 101 160 C 96.6 160 93 156.9 93 153 Z'
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

  // ─────────────────────────────────────────────
  // NOVOS — Cobertura clínica adicional
  // ─────────────────────────────────────────────

  // ── NERVOSO — nervos periféricos e cranianos ──
  {
    id: 'nervos_cranianos', label: 'Nervos Cranianos (I–XII)', view: 'front',
    sistemas: ['nervoso'], type: 'nerve', layer: 9,
    d: 'M104 56 C 100 60 96 66 96 72 M116 58 C 112 64 108 70 106 76 M124 58 C 128 64 132 70 134 76 M136 56 C 140 60 144 66 144 72'
  },
  {
    id: 'nervo_vago', label: 'Nervo Vago (X)', view: 'front',
    sistemas: ['nervoso'], type: 'nerve', layer: 9,
    d: 'M114 92 C 112 110 110 140 112 170 C 113 188 114 206 116 224 M126 92 C 128 110 130 140 128 170 C 127 188 126 206 124 224'
  },
  {
    id: 'ganglio_estrelado', label: 'Gânglio Estrelado', view: 'front',
    sistemas: ['nervoso'], type: 'nerve', layer: 9,
    d: 'M110 106 C 108 106 108 110 110 110 C 112 110 112 106 110 106 Z M130 106 C 128 106 128 110 130 110 C 132 110 132 106 130 106 Z'
  },
  {
    id: 'nervo_ulnar_d', label: 'Nervo Ulnar D', view: 'front',
    sistemas: ['nervoso'], type: 'nerve', layer: 9,
    d: 'M156 130 C 164 152 174 184 180 232 C 184 260 184 280 182 300'
  },
  {
    id: 'nervo_ulnar_e', label: 'Nervo Ulnar E', view: 'front',
    sistemas: ['nervoso'], type: 'nerve', layer: 9,
    d: 'M84 130 C 76 152 66 184 60 232 C 56 260 56 280 58 300'
  },
  {
    id: 'nervo_radial_d', label: 'Nervo Radial D', view: 'front',
    sistemas: ['nervoso'], type: 'nerve', layer: 9,
    d: 'M150 122 C 160 144 172 174 180 220 C 184 250 184 274 182 296'
  },
  {
    id: 'nervo_radial_e', label: 'Nervo Radial E', view: 'front',
    sistemas: ['nervoso'], type: 'nerve', layer: 9,
    d: 'M90 122 C 80 144 68 174 60 220 C 56 250 56 274 58 296'
  },
  {
    id: 'nervo_tibial_d', label: 'Nervo Tibial D', view: 'back',
    sistemas: ['nervoso'], type: 'nerve', layer: 9,
    d: 'M144 424 C 144 444 142 466 142 490'
  },
  {
    id: 'nervo_tibial_e', label: 'Nervo Tibial E', view: 'back',
    sistemas: ['nervoso'], type: 'nerve', layer: 9,
    d: 'M96 424 C 96 444 98 466 98 490'
  },
  {
    id: 'nervo_fibular_d', label: 'Nervo Fibular D', view: 'back',
    sistemas: ['nervoso'], type: 'nerve', layer: 9,
    d: 'M150 424 C 152 442 152 460 152 484'
  },
  {
    id: 'nervo_fibular_e', label: 'Nervo Fibular E', view: 'back',
    sistemas: ['nervoso'], type: 'nerve', layer: 9,
    d: 'M90 424 C 88 442 88 460 88 484'
  },

  // ── CIRCULATÓRIO — vasos grandes adicionais ──
  {
    id: 'jugular_d', label: 'Veia Jugular D', view: 'front',
    sistemas: ['circulatorio'], type: 'vessel', layer: 9,
    d: 'M108 92 L 110 110'
  },
  {
    id: 'jugular_e', label: 'Veia Jugular E', view: 'front',
    sistemas: ['circulatorio'], type: 'vessel', layer: 9,
    d: 'M132 92 L 130 110'
  },
  {
    id: 'subclavia_d', label: 'Artéria/Veia Subclávia D', view: 'front',
    sistemas: ['circulatorio'], type: 'vessel', layer: 9,
    d: 'M118 110 C 130 112 144 116 156 122'
  },
  {
    id: 'subclavia_e', label: 'Artéria/Veia Subclávia E', view: 'front',
    sistemas: ['circulatorio'], type: 'vessel', layer: 9,
    d: 'M122 110 C 110 112 96 116 84 122'
  },
  {
    id: 'iliaca_d', label: 'Artéria Ilíaca D', view: 'front',
    sistemas: ['circulatorio'], type: 'vessel', layer: 9,
    d: 'M119 282 C 124 290 134 296 144 300'
  },
  {
    id: 'iliaca_e', label: 'Artéria Ilíaca E', view: 'front',
    sistemas: ['circulatorio'], type: 'vessel', layer: 9,
    d: 'M121 282 C 116 290 106 296 96 300'
  },
  {
    id: 'veia_porta', label: 'Veia Porta', view: 'front',
    sistemas: ['circulatorio', 'digestorio'], type: 'vessel', layer: 8,
    d: 'M108 218 C 114 224 120 228 124 232'
  },

  // ── RESPIRATÓRIO — vias aéreas superiores ──
  {
    id: 'seios_face', label: 'Seios da Face', view: 'front',
    sistemas: ['respiratorio'], type: 'organ', layer: 7,
    d: 'M108 54 C 104 54 102 60 106 64 C 110 64 112 60 108 54 Z M132 54 C 136 54 138 60 134 64 C 130 64 128 60 132 54 Z M114 70 C 112 70 112 76 116 76 C 120 76 122 72 120 70 Z M126 70 C 128 70 128 76 124 76 C 120 76 118 72 120 70 Z'
  },
  {
    id: 'faringe', label: 'Faringe', view: 'front',
    sistemas: ['respiratorio', 'digestorio'], type: 'organ', layer: 7,
    d: 'M116 78 L 116 100 L 124 100 L 124 78 Z'
  },
  {
    id: 'laringe', label: 'Laringe', view: 'front',
    sistemas: ['respiratorio'], type: 'organ', layer: 7,
    d: 'M114 100 L 114 114 L 126 114 L 126 100 Z'
  },
  {
    id: 'bronquiolos_d', label: 'Bronquíolos D', view: 'front',
    sistemas: ['respiratorio'], type: 'organ', layer: 6,
    d: 'M150 156 C 156 162 160 170 162 180 M148 162 C 152 170 156 178 158 188 M154 168 C 160 174 164 182 168 192'
  },
  {
    id: 'bronquiolos_e', label: 'Bronquíolos E', view: 'front',
    sistemas: ['respiratorio'], type: 'organ', layer: 6,
    d: 'M90 156 C 84 162 80 170 78 180 M92 162 C 88 170 84 178 82 188 M86 168 C 80 174 76 182 72 192'
  },

  // ── DIGESTÓRIO — boca/ducto/ânus ──
  {
    id: 'glandula_parotida_d', label: 'Parótida D', view: 'front',
    sistemas: ['digestorio'], type: 'gland', layer: 8,
    d: 'M148 74 C 144 74 142 82 146 86 C 152 86 154 80 152 76 C 151 74 150 74 148 74 Z'
  },
  {
    id: 'glandula_parotida_e', label: 'Parótida E', view: 'front',
    sistemas: ['digestorio'], type: 'gland', layer: 8,
    d: 'M92 74 C 96 74 98 82 94 86 C 88 86 86 80 88 76 C 89 74 90 74 92 74 Z'
  },
  {
    id: 'glandula_submandibular', label: 'Submandibulares', view: 'front',
    sistemas: ['digestorio'], type: 'gland', layer: 8,
    d: 'M112 88 C 108 88 108 94 112 94 C 116 94 116 88 112 88 Z M128 88 C 124 88 124 94 128 94 C 132 94 132 88 128 88 Z'
  },
  {
    id: 'ducto_biliar', label: 'Ducto Biliar Comum', view: 'front',
    sistemas: ['digestorio'], type: 'vessel', layer: 7,
    d: 'M106 212 C 110 220 116 226 122 232'
  },
  {
    id: 'anus', label: 'Ânus', view: 'front',
    sistemas: ['digestorio'], type: 'organ', layer: 7,
    d: 'M118 308 C 116 308 116 314 118 314 L 122 314 C 124 314 124 308 122 308 Z'
  },

  // ── URINÁRIO — pelve renal e néfrons ──
  // Hilo medial do rim direito, na altura média do rim (não mais perto da base, evitando parecer uma "bolinha" solta)
  {
    id: 'pelve_renal_d', label: 'Pelve Renal D', view: 'back',
    sistemas: ['urinario'], type: 'organ', layer: 7,
    d: 'M124 185 C 124 180.6 126.7 177 130 177 C 133.3 177 136 180.6 136 185 C 136 189.4 133.3 193 130 193 C 126.7 193 124 189.4 124 185 Z'
  },
  // Hilo medial do rim esquerdo, na altura média do rim
  {
    id: 'pelve_renal_e', label: 'Pelve Renal E', view: 'back',
    sistemas: ['urinario'], type: 'organ', layer: 7,
    d: 'M104 178 C 104 173.6 106.7 170 110 170 C 113.3 170 116 173.6 116 178 C 116 182.4 113.3 186 110 186 C 106.7 186 104 182.4 104 178 Z'
  },

  // ── LINFÁTICO — linfonodos profundos e MALT ──
  {
    id: 'amigdalas', label: 'Amígdalas', view: 'front',
    sistemas: ['linfatico'], type: 'organ', layer: 8,
    d: 'M114 86 C 112 86 112 92 114 92 C 116 92 116 86 114 86 Z M126 86 C 124 86 124 92 126 92 C 128 92 128 86 126 86 Z'
  },
  {
    id: 'linfonodos_mediastinais', label: 'Linfonodos Mediastinais', view: 'front',
    sistemas: ['linfatico'], type: 'organ', layer: 6,
    d: 'M114 150 C 112 150 112 154 114 154 C 116 154 116 150 114 150 Z M126 150 C 124 150 124 154 126 154 C 128 154 128 150 126 150 Z M120 162 C 118 162 118 166 120 166 C 122 166 122 162 120 162 Z'
  },
  {
    id: 'linfonodos_mesentericos', label: 'Linfonodos Mesentéricos', view: 'front',
    sistemas: ['linfatico'], type: 'organ', layer: 6,
    d: 'M108 248 C 106 248 106 252 108 252 C 110 252 110 248 108 248 Z M132 248 C 130 248 130 252 132 252 C 134 252 134 248 132 248 Z M120 258 C 118 258 118 262 120 262 C 122 262 122 258 120 258 Z'
  },
  {
    id: 'linfonodos_popliteos_d', label: 'Linfonodos Poplíteos D', view: 'back',
    sistemas: ['linfatico'], type: 'organ', layer: 7,
    d: 'M144 416 C 142 416 142 422 144 422 C 146 422 146 416 144 416 Z'
  },
  {
    id: 'linfonodos_popliteos_e', label: 'Linfonodos Poplíteos E', view: 'back',
    sistemas: ['linfatico'], type: 'organ', layer: 7,
    d: 'M96 416 C 94 416 94 422 96 422 C 98 422 98 416 96 416 Z'
  },

  // ── REPRODUTOR — completar genitália ──
  {
    id: 'mama_d', label: 'Mama D', view: 'front',
    sistemas: ['reprodutor', 'endocrino'], type: 'organ', layer: 6,
    d: 'M148 155 C 138 155 132 165 138 175 C 146 179 156 175 158 167 C 159 160 154 155 148 155 Z'
  },
  {
    id: 'mama_e', label: 'Mama E', view: 'front',
    sistemas: ['reprodutor', 'endocrino'], type: 'organ', layer: 6,
    d: 'M92 155 C 102 155 108 165 102 175 C 94 179 84 175 82 167 C 81 160 86 155 92 155 Z'
  },
  {
    id: 'vagina', label: 'Vagina', view: 'front',
    sistemas: ['reprodutor'], type: 'organ', layer: 7,
    d: 'M117 268 L 117 284 L 123 284 L 123 268 Z'
  },
  {
    id: 'epididimo_d', label: 'Epidídimo D', view: 'front',
    sistemas: ['reprodutor'], type: 'organ', layer: 8,
    d: 'M132 282 C 130 282 130 290 132 290 C 134 290 134 282 132 282 Z'
  },
  {
    id: 'epididimo_e', label: 'Epidídimo E', view: 'front',
    sistemas: ['reprodutor'], type: 'organ', layer: 8,
    d: 'M108 282 C 106 282 106 290 108 290 C 110 290 110 282 108 282 Z'
  },
  {
    id: 'penis', label: 'Pênis', view: 'front',
    sistemas: ['reprodutor'], type: 'organ', layer: 7,
    d: 'M116 276 L 116 294 L 124 294 L 124 276 Z'
  },
  {
    id: 'escroto', label: 'Escroto', view: 'front',
    sistemas: ['reprodutor'], type: 'organ', layer: 6,
    d: 'M104 286 C 100 292 104 298 120 298 C 136 298 140 292 136 286 C 130 284 110 284 104 286 Z'
  },
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
  pineal: { hormonios: ['Melatonina'], funcao: ['Ciclo circadiano'] },
  paratireoides: { glandulas: ['Superior D', 'Inferior D', 'Superior E', 'Inferior E'], hormonios: ['PTH (Paratormônio)'], funcao: ['Controle do cálcio e fósforo sérico'] },
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
  veia_cava_inf: { afluentes: ['Veias renais', 'Veias hepáticas', 'Veias ilíacas comuns', 'Veias lombares'], trajeto: ['Retroperitoneal, à direita da aorta'] },
  vasos_pulmonares: { partes: ['Tronco pulmonar', 'Artérias pulmonares D/E', 'Veias pulmonares (4)'], funcao: ['Circulação pulmonar (pequena circulação)', 'Troca gasosa'] },
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
  uretra: {
    segmentos: ['Uretra feminina (3-4 cm)', 'Uretra masculina: prostática, membranosa, esponjosa (18-20 cm)'],
    esfincteres: ['Esfíncter uretral interno (involuntário)', 'Esfíncter uretral externo (voluntário)']
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
  trompas_falopio: {
    partes: ['Infundíbulo (fímbrias)', 'Ampola', 'Istmo', 'Porção intramural'],
    funcao: ['Captação do oócito', 'Local da fertilização', 'Transporte do embrião ao útero']
  },
  vesiculas_seminais: {
    funcao: ['Produção de fluido seminal (60-70% do volume ejaculado)', 'Fonte de frutose para os espermatozoides'],
    adjacentes: ['Bexiga (anterior)', 'Reto (posterior)', 'Ducto deferente']
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

  // Sensory System
  olho_d: {
    partes: ['Córnea', 'Cristalino', 'Retina', 'Nervo óptico (II par)', 'Músculos extraoculares'],
    funcoes: ['Visão', 'Acomodação', 'Reflexo pupilar']
  },
  olho_e: {
    partes: ['Córnea', 'Cristalino', 'Retina', 'Nervo óptico (II par)', 'Músculos extraoculares'],
    funcoes: ['Visão', 'Acomodação', 'Reflexo pupilar']
  },
  orelha_d: {
    partes: ['Orelha externa (pavilhão, canal auditivo)', 'Orelha média (martelo, bigorna, estribo)', 'Orelha interna (cóclea, labirinto vestibular)'],
    nervo: ['Nervo vestibulococlear (VIII par)'],
    funcoes: ['Audição', 'Equilíbrio']
  },
  orelha_e: {
    partes: ['Orelha externa (pavilhão, canal auditivo)', 'Orelha média (martelo, bigorna, estribo)', 'Orelha interna (cóclea, labirinto vestibular)'],
    nervo: ['Nervo vestibulococlear (VIII par)'],
    funcoes: ['Audição', 'Equilíbrio']
  },
  nariz_olfato: {
    partes: ['Mucosa olfatória', 'Bulbo olfatório', 'Conchas nasais'],
    nervo: ['Nervo olfatório (I par)'],
    funcoes: ['Olfato', 'Aquecimento e umidificação do ar']
  },
  lingua_paladar: {
    partes: ['Papilas fungiformes', 'Papilas filiformes', 'Papilas circunvaladas', 'Papilas foliadas'],
    nervo: ['Facial (VII par, 2/3 anteriores)', 'Glossofaríngeo (IX par, 1/3 posterior)'],
    sabores: ['Doce', 'Salgado', 'Ácido', 'Amargo', 'Umami']
  },

  // Integumentary System
  couro_cabeludo: {
    partes: ['Epiderme', 'Derme', 'Folículos pilosos', 'Tecido subcutâneo'],
    condicoes: ['Dermatite seborreica', 'Alopecia', 'Psoríase capilar']
  },
  glandulas_sebaceas: {
    funcao: ['Produção de sebo (lubrificação cutânea)'],
    condicoes: ['Acne', 'Seborreia', 'Cisto sebáceo']
  },
  glandulas_sudoriparas: {
    tipos: ['Écrinas (termorregulação)', 'Apócrinas (axilas, região genital)'],
    condicoes: ['Hiperidrose', 'Anidrose', 'Miliária']
  },
  unhas_maos: {
    partes: ['Lâmina ungueal', 'Leito ungueal', 'Matriz', 'Cutícula', 'Lúnula'],
    condicoes: ['Onicomicose', 'Psoríase ungueal', 'Baqueteamento digital', 'Coiloníquia']
  },
  unhas_pes: {
    partes: ['Lâmina ungueal', 'Leito ungueal', 'Matriz', 'Cutícula'],
    condicoes: ['Onicomicose', 'Onicocriptose (unha encravada)', 'Trauma ungueal']
  },
};
