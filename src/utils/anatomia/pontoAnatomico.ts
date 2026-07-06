// Posições base dos pontos anatômicos no stick-figure (viewBox 240×520).
// 'views' indica em qual perspectiva o ponto aparece.
export interface PontoInfo {
  cx: number;
  cy: number;
  label: string;
  sistema: string;
  views: ('front' | 'back')[];
}

export const PONTO_ANATOMICO: Record<string, PontoInfo> = {
  // ─ CABEÇA / PESCOÇO ──────────────────────────────────────
  cabeca:               { cx: 120, cy:  32, label: 'Cabeça',            sistema: 'musculoesqueletico', views: ['front'] },
  occipital:            { cx: 120, cy:  32, label: 'Crânio Post.',       sistema: 'musculoesqueletico', views: ['back'] },
  pescoco:              { cx: 120, cy:  61, label: 'Pescoço',            sistema: 'musculoesqueletico', views: ['front'] },
  cervical:             { cx: 120, cy:  61, label: 'Cervical',           sistema: 'musculoesqueletico', views: ['back'] },
  // ─ OMBROS ────────────────────────────────────────────────
  ombro_d:              { cx:  72, cy:  90, label: 'Ombro D',            sistema: 'musculoesqueletico', views: ['front'] },
  ombro_e:              { cx: 168, cy:  90, label: 'Ombro E',            sistema: 'musculoesqueletico', views: ['front'] },
  trapezio_d:           { cx:  82, cy:  99, label: 'Trapézio D',         sistema: 'musculoesqueletico', views: ['back'] },
  trapezio_e:           { cx: 158, cy:  99, label: 'Trapézio E',         sistema: 'musculoesqueletico', views: ['back'] },
  // ─ BRAÇO D (paciente direito = esquerda na tela) ──────────
  braco_d:              { cx:  60, cy: 112, label: 'Braço D',            sistema: 'musculoesqueletico', views: ['front', 'back'] },
  cotovelo_d:           { cx:  51, cy: 138, label: 'Cotovelo D',         sistema: 'musculoesqueletico', views: ['front', 'back'] },
  antebraco_d:          { cx:  50, cy: 152, label: 'Antebraço D',        sistema: 'musculoesqueletico', views: ['front', 'back'] },
  punho_d:              { cx:  50, cy: 161, label: 'Punho D',            sistema: 'musculoesqueletico', views: ['front', 'back'] },
  mao_d:                { cx:  50, cy: 164, label: 'Mão D',              sistema: 'musculoesqueletico', views: ['front', 'back'] },
  // ─ BRAÇO E (paciente esquerdo = direita na tela) ──────────
  braco_e:              { cx: 180, cy: 112, label: 'Braço E',            sistema: 'musculoesqueletico', views: ['front', 'back'] },
  cotovelo_e:           { cx: 189, cy: 138, label: 'Cotovelo E',         sistema: 'musculoesqueletico', views: ['front', 'back'] },
  antebraco_e:          { cx: 190, cy: 152, label: 'Antebraço E',        sistema: 'musculoesqueletico', views: ['front', 'back'] },
  punho_e:              { cx: 190, cy: 161, label: 'Punho E',            sistema: 'musculoesqueletico', views: ['front', 'back'] },
  mao_e:                { cx: 190, cy: 164, label: 'Mão E',              sistema: 'musculoesqueletico', views: ['front', 'back'] },
  // ─ TRONCO ANTERIOR ────────────────────────────────────────
  peitoral:             { cx: 120, cy: 108, label: 'Tórax',              sistema: 'musculoesqueletico', views: ['front'] },
  abdomen:              { cx: 120, cy: 145, label: 'Abdômen',            sistema: 'musculoesqueletico', views: ['front'] },
  pelve:                { cx: 120, cy: 168, label: 'Pelve',              sistema: 'musculoesqueletico', views: ['front'] },
  // ─ TRONCO POSTERIOR ───────────────────────────────────────
  toracica:             { cx: 120, cy: 115, label: 'Coluna Torácica',    sistema: 'musculoesqueletico', views: ['back'] },
  dorso:                { cx: 120, cy: 122, label: 'Dorso',              sistema: 'musculoesqueletico', views: ['back'] },
  lombar:               { cx: 120, cy: 148, label: 'Lombar',             sistema: 'musculoesqueletico', views: ['back'] },
  sacral:               { cx: 120, cy: 166, label: 'Sacro',              sistema: 'musculoesqueletico', views: ['back'] },
  // ─ QUADRIL ────────────────────────────────────────────────
  coxofemural_d:        { cx: 102, cy: 182, label: 'Coxofemural D',      sistema: 'musculoesqueletico', views: ['front'] },
  coxofemural_e:        { cx: 138, cy: 182, label: 'Coxofemural E',      sistema: 'musculoesqueletico', views: ['front'] },
  gluteo_d:             { cx: 100, cy: 182, label: 'Glúteo D',           sistema: 'musculoesqueletico', views: ['back'] },
  gluteo_e:             { cx: 140, cy: 182, label: 'Glúteo E',           sistema: 'musculoesqueletico', views: ['back'] },
  // ─ COXA ───────────────────────────────────────────────────
  coxa_d:               { cx:  99, cy: 248, label: 'Coxa D',             sistema: 'musculoesqueletico', views: ['front', 'back'] },
  coxa_e:               { cx: 141, cy: 248, label: 'Coxa E',             sistema: 'musculoesqueletico', views: ['front', 'back'] },
  // ─ JOELHO ─────────────────────────────────────────────────
  joelho_d:             { cx:  99, cy: 315, label: 'Joelho D',           sistema: 'musculoesqueletico', views: ['front', 'back'] },
  joelho_e:             { cx: 141, cy: 315, label: 'Joelho E',           sistema: 'musculoesqueletico', views: ['front', 'back'] },
  // ─ PERNA / CANELA ─────────────────────────────────────────
  canela_d:             { cx:  98, cy: 376, label: 'Perna D',            sistema: 'musculoesqueletico', views: ['front', 'back'] },
  canela_e:             { cx: 142, cy: 376, label: 'Perna E',            sistema: 'musculoesqueletico', views: ['front', 'back'] },
  // ─ TORNOZELO ──────────────────────────────────────────────
  tornozelo_d:          { cx:  99, cy: 455, label: 'Tornozelo D',        sistema: 'musculoesqueletico', views: ['front', 'back'] },
  tornozelo_e:          { cx: 141, cy: 455, label: 'Tornozelo E',        sistema: 'musculoesqueletico', views: ['front', 'back'] },
  // ─ PÉ ─────────────────────────────────────────────────────
  pe_d:                 { cx: 100, cy: 498, label: 'Pé D',               sistema: 'musculoesqueletico', views: ['front', 'back'] },
  pe_e:                 { cx: 140, cy: 498, label: 'Pé E',               sistema: 'musculoesqueletico', views: ['front', 'back'] },
  // ─ NERVOSO ────────────────────────────────────────────────
  cerebro:              { cx: 120, cy:  26, label: 'Cérebro',            sistema: 'nervoso',            views: ['front'] },
  cerebelo:             { cx: 120, cy:  40, label: 'Cerebelo',           sistema: 'nervoso',            views: ['front'] },
  cerebro_p:            { cx: 120, cy:  26, label: 'Cérebro Post.',      sistema: 'nervoso',            views: ['back'] },
  cerebelo_p:           { cx: 120, cy:  40, label: 'Cerebelo Post.',     sistema: 'nervoso',            views: ['back'] },
  tronco_encefalico:    { cx: 120, cy:  55, label: 'Tronco Encefálico',  sistema: 'nervoso',            views: ['front'] },
  medula_espinhal_v:    { cx: 120, cy: 122, label: 'Medula Esp.',        sistema: 'nervoso',            views: ['front'] },
  medula_p:             { cx: 120, cy: 122, label: 'Medula Esp. Post.',  sistema: 'nervoso',            views: ['back'] },
  // ─ CIRCULATÓRIO ───────────────────────────────────────────
  coracao:              { cx: 112, cy: 108, label: 'Coração',            sistema: 'circulatorio',       views: ['front'] },
  aorta:                { cx: 120, cy: 115, label: 'Aorta',              sistema: 'circulatorio',       views: ['front'] },
  vena_cava:            { cx: 122, cy: 118, label: 'Veia Cava',          sistema: 'circulatorio',       views: ['front'] },
  // ─ RESPIRATÓRIO ───────────────────────────────────────────
  traqueia:             { cx: 120, cy:  78, label: 'Traqueia',           sistema: 'respiratorio',       views: ['front'] },
  pulmao_d:             { cx: 104, cy: 112, label: 'Pulmão D',           sistema: 'respiratorio',       views: ['front'] },
  pulmao_e:             { cx: 136, cy: 112, label: 'Pulmão E',           sistema: 'respiratorio',       views: ['front'] },
  pulmao_d_p:           { cx: 104, cy: 112, label: 'Pulmão D Post.',     sistema: 'respiratorio',       views: ['back'] },
  pulmao_e_p:           { cx: 136, cy: 112, label: 'Pulmão E Post.',     sistema: 'respiratorio',       views: ['back'] },
  // ─ DIGESTÓRIO ─────────────────────────────────────────────
  esofago:              { cx: 120, cy:  90, label: 'Esôfago',            sistema: 'digestorio',         views: ['front'] },
  figado:               { cx: 109, cy: 130, label: 'Fígado',             sistema: 'digestorio',         views: ['front'] },
  estomago:             { cx: 114, cy: 138, label: 'Estômago',           sistema: 'digestorio',         views: ['front'] },
  vesicula_biliar:      { cx: 117, cy: 137, label: 'Vesícula',           sistema: 'digestorio',         views: ['front'] },
  pancreas_corpo:       { cx: 120, cy: 142, label: 'Pâncreas',           sistema: 'digestorio',         views: ['front'] },
  duodeno:              { cx: 126, cy: 140, label: 'Duodeno',            sistema: 'digestorio',         views: ['front'] },
  baco_frente:          { cx: 131, cy: 135, label: 'Baço',               sistema: 'digestorio',         views: ['front'] },
  intestino_delgado:    { cx: 120, cy: 150, label: 'Int. Delgado',       sistema: 'digestorio',         views: ['front'] },
  colon_ascendente:     { cx: 108, cy: 147, label: 'Cólon Asc.',         sistema: 'digestorio',         views: ['front'] },
  colon_transverso:     { cx: 120, cy: 143, label: 'Cólon Trans.',       sistema: 'digestorio',         views: ['front'] },
  colon_descendente:    { cx: 132, cy: 147, label: 'Cólon Desc.',        sistema: 'digestorio',         views: ['front'] },
  colon_sigmoide:       { cx: 128, cy: 158, label: 'Cólon Sig.',         sistema: 'digestorio',         views: ['front'] },
  apendice:             { cx: 110, cy: 153, label: 'Apêndice',           sistema: 'digestorio',         views: ['front'] },
  reto:                 { cx: 120, cy: 163, label: 'Reto',               sistema: 'digestorio',         views: ['front'] },
  // ─ ENDÓCRINO ──────────────────────────────────────────────
  hipofise:             { cx: 120, cy:  28, label: 'Hipófise',           sistema: 'endocrino',          views: ['front'] },
  tireoide:             { cx: 120, cy:  68, label: 'Tireoide',           sistema: 'endocrino',          views: ['front'] },
  adrenal_d:            { cx: 108, cy: 133, label: 'Adrenal D',          sistema: 'endocrino',          views: ['front'] },
  adrenal_e:            { cx: 132, cy: 133, label: 'Adrenal E',          sistema: 'endocrino',          views: ['front'] },
  adrenal_d_p:          { cx: 108, cy: 133, label: 'Adrenal D Post.',    sistema: 'endocrino',          views: ['back'] },
  adrenal_e_p:          { cx: 132, cy: 133, label: 'Adrenal E Post.',    sistema: 'endocrino',          views: ['back'] },
  ilhotas_langerhans:   { cx: 120, cy: 142, label: 'Ilhotas Langerh.',   sistema: 'endocrino',          views: ['front'] },
  // ─ URINÁRIO ───────────────────────────────────────────────
  rim_d_frente:         { cx: 107, cy: 138, label: 'Rim D',              sistema: 'urinario',           views: ['front'] },
  rim_e_frente:         { cx: 133, cy: 138, label: 'Rim E',              sistema: 'urinario',           views: ['front'] },
  rim_d:                { cx: 107, cy: 138, label: 'Rim D Post.',        sistema: 'urinario',           views: ['back'] },
  rim_e:                { cx: 133, cy: 138, label: 'Rim E Post.',        sistema: 'urinario',           views: ['back'] },
  bexiga:               { cx: 120, cy: 163, label: 'Bexiga',             sistema: 'urinario',           views: ['front'] },
  ureteres:             { cx: 120, cy: 150, label: 'Ureteres',           sistema: 'urinario',           views: ['front'] },
  // ─ LINFÁTICO ──────────────────────────────────────────────
  timo:                 { cx: 120, cy:  95, label: 'Timo',               sistema: 'linfatico',          views: ['front'] },
  linfonodos_cervicais: { cx: 120, cy:  67, label: 'Linf. Cervicais',    sistema: 'linfatico',          views: ['front'] },
  linfonodos_axilares_d:{ cx:  65, cy:  95, label: 'Linf. Axilar D',     sistema: 'linfatico',          views: ['front'] },
  linfonodos_axilares_e:{ cx: 175, cy:  95, label: 'Linf. Axilar E',     sistema: 'linfatico',          views: ['front'] },
  linfonodos_inguinais: { cx: 120, cy: 173, label: 'Linf. Inguinais',    sistema: 'linfatico',          views: ['front'] },
  cisterna_chyli:       { cx: 120, cy: 133, label: 'Cisterna Chyli',     sistema: 'linfatico',          views: ['front'] },
  // ─ REPRODUTOR ─────────────────────────────────────────────
  utero:                { cx: 120, cy: 163, label: 'Útero',              sistema: 'reprodutor',         views: ['front'] },
  ovarios:              { cx: 120, cy: 162, label: 'Ovários',            sistema: 'reprodutor',         views: ['front'] },
  testiculos:           { cx: 120, cy: 170, label: 'Testículos',         sistema: 'reprodutor',         views: ['front'] },
  prostata:             { cx: 120, cy: 166, label: 'Próstata',           sistema: 'reprodutor',         views: ['front'] },
};

// ── Paleta de cores por sistema ──────────────────────────────
export const SISTEMA_DOT_COLOR: Record<string, string> = {
  musculoesqueletico: '#a855f7',
  nervoso:            '#818cf8',
  circulatorio:       '#ef4444',
  respiratorio:       '#06b6d4',
  digestorio:         '#f97316',
  endocrino:          '#eab308',
  urinario:           '#6366f1',
  linfatico:          '#84cc16',
  reprodutor:         '#ec4899',
  tegumentar:         '#78716c',
  sensorial:          '#10b981',
};

// ── Parâmetros da figura ─────────────────────────────────────
export interface FiguraParams {
  headR:       number;  // raio da cabeça (padrão 24)
  shoulderHW:  number;  // meia-largura do ombro (padrão 41)
  torsoH:      number;  // altura do tronco (padrão 96)
  armLen:      number;  // comprimento do braço vertical (padrão 80)
  armSpread:   number;  // abertura horizontal do braço (padrão 29)
  legLen:      number;  // comprimento da perna (padrão 333)
  legSpread:   number;  // distância horizontal centro-perna (padrão 17)
  armSW:       number;  // stroke-width braço (padrão 11)
  legSW:       number;  // stroke-width perna (padrão 14)
}

export const DEFAULT_FIGURA: FiguraParams = {
  headR: 24, shoulderHW: 41, torsoH: 96,
  armLen: 80, armSpread: 29,
  legLen: 333, legSpread: 17,
  armSW: 11, legSW: 14,
};

export function deriveFigura(p: FiguraParams) {
  const cx       = 120;
  const headCy   = 8 + p.headR;
  const headBot  = headCy + p.headR;
  const neckTop  = headBot - 2;
  const neckH    = 14;
  const neckBot  = neckTop + neckH;
  const torsoTop = neckBot + 2;
  const torsoBot = torsoTop + p.torsoH;
  const lsx      = cx - p.shoulderHW;  // left shoulder x
  const rsx      = cx + p.shoulderHW;  // right shoulder x
  const armStartY = torsoTop + 4;
  const armEndY   = armStartY + p.armLen;
  const lwx       = lsx - p.armSpread; // left wrist x
  const rwx       = rsx + p.armSpread; // right wrist x
  const hipY      = torsoBot;
  const lhx       = cx - p.legSpread;  // left hip x
  const rhx       = cx + p.legSpread;  // right hip x
  const footY     = hipY + p.legLen;

  return { cx, headCy, neckTop, neckH, neckBot, torsoTop, torsoBot,
           lsx, rsx, armStartY, armEndY, lwx, rwx, hipY, lhx, rhx, footY };
}

export function buildStickFigurePaths(p: FiguraParams) {
  const d = deriveFigura(p);
  const hw = p.shoulderHW;
  const th = p.torsoH;

  const torso =
    `M${d.lsx} ${d.torsoTop} ` +
    `Q${d.lsx - 8} ${d.torsoTop + th * 0.42} ${d.lsx - 4} ${d.torsoBot - 8} ` +
    `Q${d.cx - 24} ${d.torsoBot} ${d.cx} ${d.torsoBot} ` +
    `Q${d.cx + 24} ${d.torsoBot} ${d.rsx + 4} ${d.torsoBot - 8} ` +
    `Q${d.rsx + 8} ${d.torsoTop + th * 0.42} ${d.rsx} ${d.torsoTop} ` +
    `Q${d.cx + hw * 0.54} ${d.torsoTop - 6} ${d.cx} ${d.torsoTop - 6} ` +
    `Q${d.cx - hw * 0.54} ${d.torsoTop - 6} ${d.lsx} ${d.torsoTop} Z`;

  const leftArm  = `M${d.lsx} ${d.armStartY} Q${d.lsx - p.armSpread * 0.7} ${d.armStartY + p.armLen * 0.35} ${d.lwx} ${d.armEndY}`;
  const rightArm = `M${d.rsx} ${d.armStartY} Q${d.rsx + p.armSpread * 0.7} ${d.armStartY + p.armLen * 0.35} ${d.rwx} ${d.armEndY}`;
  const ll = p.legLen;
  const leftLeg  = `M${d.lhx} ${d.hipY} Q${d.lhx - 2} ${d.hipY + ll * 0.42} ${d.lhx - 2} ${d.hipY + ll * 0.65} Q${d.lhx - 2} ${d.hipY + ll * 0.88} ${d.lhx} ${d.footY}`;
  const rightLeg = `M${d.rhx} ${d.hipY} Q${d.rhx + 2} ${d.hipY + ll * 0.42} ${d.rhx + 2} ${d.hipY + ll * 0.65} Q${d.rhx + 2} ${d.hipY + ll * 0.88} ${d.rhx} ${d.footY}`;

  return { torso, leftArm, rightArm, leftLeg, rightLeg };
}

// Recomputa posições naturais dos pontos para uma dada figura,
// devolvendo os offsets (dx/dy) relativos a PONTO_ANATOMICO base.
export function computeProportionalOffsets(
  newP: FiguraParams,
  baseP: FiguraParams = DEFAULT_FIGURA,
): Record<string, { dx: number; dy: number }> {
  const newD = deriveFigura(newP);
  const baseD = deriveFigura(baseP);
  const result: Record<string, { dx: number; dy: number }> = {};

  // Pernas: reescala cy a partir do hipY
  const legIds = ['coxa_d','coxa_e','joelho_d','joelho_e','canela_d','canela_e',
                  'tornozelo_d','tornozelo_e','pe_d','pe_e',
                  'coxofemural_d','coxofemural_e','gluteo_d','gluteo_e'];
  const legScale = newP.legLen / baseP.legLen;
  const legSpreadDelta = newP.legSpread - baseP.legSpread;
  legIds.forEach(id => {
    const base = PONTO_ANATOMICO[id];
    if (!base) return;
    const isRight = id.endsWith('_e');
    const distFromHip = base.cy - baseD.hipY;
    const newCy = newD.hipY + distFromHip * legScale;
    const newCx = base.cx + (isRight ? legSpreadDelta : -legSpreadDelta);
    result[id] = { dx: Math.round(newCx - base.cx), dy: Math.round(newCy - base.cy) };
  });

  // Braços: reescala cy e cx a partir do armStartY/shoulderX
  const armIds = ['braco_d','cotovelo_d','antebraco_d','punho_d','mao_d',
                  'braco_e','cotovelo_e','antebraco_e','punho_e','mao_e',
                  'ombro_d','ombro_e','trapezio_d','trapezio_e',
                  'linfonodos_axilares_d','linfonodos_axilares_e'];
  const armScale  = newP.armLen / baseP.armLen;
  const swDelta   = newP.shoulderHW - baseP.shoulderHW;
  armIds.forEach(id => {
    const base = PONTO_ANATOMICO[id];
    if (!base) return;
    const isRight = id.endsWith('_e') || id === 'ombro_e' || id === 'trapezio_e' || id === 'linfonodos_axilares_e';
    const distFromShoulder = base.cy - baseD.armStartY;
    const armLenDist = distFromShoulder > 0 ? distFromShoulder * armScale : distFromShoulder;
    const newCy = newD.armStartY + armLenDist;
    const newCx = base.cx + (isRight ? swDelta : -swDelta);
    result[id] = { dx: Math.round(newCx - base.cx), dy: Math.round(newCy - base.cy) };
  });

  // Torso: reescala cy dentro do tronco
  const torsoIds = ['peitoral','toracica','dorso','abdomen','lombar','pelve','sacral',
                    'coracao','aorta','vena_cava','traqueia','pulmao_d','pulmao_e',
                    'pulmao_d_p','pulmao_e_p','esofago','figado','estomago',
                    'vesicula_biliar','pancreas_corpo','duodeno','baco_frente',
                    'intestino_delgado','colon_ascendente','colon_transverso',
                    'colon_descendente','colon_sigmoide','apendice','reto',
                    'adrenal_d','adrenal_e','adrenal_d_p','adrenal_e_p',
                    'ilhotas_langerhans','rim_d_frente','rim_e_frente','rim_d','rim_e',
                    'bexiga','ureteres','timo','linfonodos_inguinais','cisterna_chyli',
                    'utero','ovarios','testiculos','prostata'];
  const torsoScale = newP.torsoH / baseP.torsoH;
  torsoIds.forEach(id => {
    const base = PONTO_ANATOMICO[id];
    if (!base) return;
    const distFromTop = base.cy - baseD.torsoTop;
    const newCy = newD.torsoTop + distFromTop * torsoScale;
    result[id] = { ...(result[id] ?? { dx: 0 }), dy: Math.round(newCy - base.cy) };
  });

  // Cabeça: ajuste headCy
  const headIds = ['cabeca','occipital','cerebro','cerebro_p','cerebelo','cerebelo_p',
                   'hipofise','tronco_encefalico'];
  const headDelta = newD.headCy - baseD.headCy;
  headIds.forEach(id => {
    const base = PONTO_ANATOMICO[id];
    if (!base) return;
    const distFromCenter = base.cy - baseD.headCy;
    const newCy = newD.headCy + distFromCenter;
    result[id] = { dx: 0, dy: Math.round(newCy - base.cy) };
  });

  // Pescoço
  ['pescoco','cervical','tireoide','linfonodos_cervicais'].forEach(id => {
    const base = PONTO_ANATOMICO[id];
    if (!base) return;
    result[id] = { dx: 0, dy: Math.round(headDelta) };
  });

  return result;
}

export const LS_DOT_OFFSETS = 'organ-offsets-calibrado';
export const LS_FIGURA      = 'stick-figura-calibrado';
