import type { Modalidade } from './tipos';

// Guia: para cada patologia, quais recursos têm mais respaldo na literatura
// levantada. A FAIXA de cada recurso é uma classificação do app a partir do que
// os artigos concluem (e está em validação clínica); o texto traz os números
// lidos nos resumos. Onde não há dado, o recurso não aparece como indicado: fica
// na lista "sem dados levantados". Só existe comparação direta entre recursos
// onde uma meta-análise em rede a fez (dor cervical).

export type Faixa = 'A' | 'B' | 'C' | 'D';

export const FAIXAS: Record<Faixa, { titulo: string; descricao: string }> = {
  A: { titulo: 'Favorável', descricao: 'Revisão ou meta-análise favorável, com dose ou parâmetros definidos nos estudos.' },
  B: { titulo: 'Favorável, com ressalvas', descricao: 'Resultado favorável, mas com certeza baixa, poucos ensaios, evidência discordante ou desfecho parcial.' },
  C: { titulo: 'Incerto ou conflitante', descricao: 'Os estudos discordam, ou a revisão concluiu que a evidência é insuficiente.' },
  D: { titulo: 'Sem benefício demonstrado', descricao: 'A revisão não encontrou vantagem sobre placebo ou sobre outra terapia.' },
};

const PESO_FAIXA: Record<Faixa, number> = { A: 0, B: 1, C: 2, D: 3 };

export type GrupoGuia = 'tendoes' | 'ombro' | 'articulacoes' | 'coluna' | 'dor' | 'forca';

export const GRUPOS_GUIA: { id: GrupoGuia; titulo: string }[] = [
  { id: 'tendoes', titulo: 'Tendões e partes moles' },
  { id: 'ombro', titulo: 'Ombro' },
  { id: 'articulacoes', titulo: 'Articulações' },
  { id: 'coluna', titulo: 'Coluna e pescoço' },
  { id: 'dor', titulo: 'Dor e nervos' },
  { id: 'forca', titulo: 'Força e função' },
];

export interface IndicacaoGuia {
  modalidade: Modalidade;
  faixa: Faixa;
  resumo: string;
  fontes: string[];
  /** Condição correspondente na calculadora da modalidade. */
  calc: string;
}

export interface PatologiaGuia {
  id: string;
  nome: string;
  grupo: GrupoGuia;
  /** Padrões (sobre texto sem acento e em minúsculas) com peso, para entender a descrição do paciente. */
  padroes: [RegExp, number][];
  nota?: string;
  /** Em ordem de apresentação; a faixa decide a posição final, esta ordem desempata. */
  indicacoes: IndicacaoGuia[];
}

export const PATOLOGIAS: PatologiaGuia[] = [
  // ───────────────────────────── Tendões e partes moles ─────────────────────
  {
    id: 'tendinopatia_patelar_aquiles', nome: 'Tendinopatia patelar ou do Aquiles', grupo: 'tendoes',
    padroes: [[/tendin(opatia|ite|ose)\s+(do\s+|de\s+|da\s+)?(patelar|aquil|calcane)/, 3], [/joelho do saltador/, 3], [/aquiles/, 2], [/tendao (patelar|de aquiles)/, 3], [/patelar/, 1], [/tendin(opatia|ite|ose)/, 1]],
    indicacoes: [
      { modalidade: 'laser', faixa: 'A', calc: 'tendinopatia_membro_inferior', fontes: ['naterstad2022', 'tumilty2010'],
        resumo: 'Com as doses recomendadas, a dor caiu 14,98 mm na EVA contra placebo; com dose não recomendada, a redução não foi significativa. Dose por ponto: mínimo de 2 J (904 nm) ou 4 J (780–860 nm).' },
      { modalidade: 'ondas_choque', faixa: 'C', calc: 'patelar', fontes: ['friedman2026', 'guo2026', 'katolicky2025', 'schmitz2015'],
        resumo: 'Na patelar, as revisões discordam (uma favorável, outra sem efeito contra placebo) e a dose-resposta não está definida. No Aquiles, a EFD média foi 0,17 mJ/mm² nos ensaios positivos e 0,06 no negativo; os resumos lidos não trazem medida de efeito.' },
      { modalidade: 'ultrassom', faixa: 'D', calc: 'geral', fontes: ['robertson2001', 'dudon2026'],
        resumo: 'A revisão de ensaios encontrou pouca evidência de que o ultrassom ativo supere o placebo, e outra revisão colocou as ondas de choque à frente do ultrassom em tendinopatias (certeza muito baixa).' },
    ],
  },
  {
    id: 'fascite_plantar', nome: 'Fascite plantar / esporão de calcâneo', grupo: 'tendoes',
    padroes: [[/fasci(ite|te)\s+plantar/, 3], [/esporao/, 3], [/dor (no|do) calcanhar/, 2], [/talalgia/, 3]],
    indicacoes: [
      { modalidade: 'laser', faixa: 'A', calc: 'fascite_plantar', fontes: ['naterstad2022'],
        resumo: 'Entra no mesmo resultado da tendinopatia de membro inferior: dor −14,98 mm contra placebo com as doses recomendadas (mínimo de 2 J em 904 nm ou 4 J em 780–860 nm, por ponto).' },
      { modalidade: 'ondas_choque', faixa: 'B', calc: 'fascite_plantar', fontes: ['schmitz2015', 'gerdesmeyer2008', 'gollwitzer2015'],
        resumo: 'Ensaios positivos com EFD média de 0,19 mJ/mm² (0,08 nos negativos), em 3 sessões de 2000 impulsos; só dor e edema passageiros como efeito do aparelho. Os resumos lidos não trazem a medida de efeito.' },
    ],
  },
  {
    id: 'epicondilite_lateral', nome: 'Epicondilite lateral', grupo: 'tendoes',
    padroes: [[/epicondil/, 3], [/cotovelo de tenista/, 3]],
    indicacoes: [
      { modalidade: 'laser', faixa: 'B', calc: 'epicondilite_lateral', fontes: ['tumilty2010'],
        resumo: 'Nos ensaios de melhor qualidade, a força de preensão ficou 9,59 kg maior. Os resumos lidos não trazem a dose por ponto.' },
      { modalidade: 'ondas_choque', faixa: 'C', calc: 'epicondilite_lateral', fontes: ['rompe1998', 'rompe2004', 'dudon2026'],
        resumo: 'Pode reduzir mais a dor em repouso que o ultrassom (DM −1,51), com certeza muito baixa e sem diferença no PRTEE. Protocolo clássico: baixa energia, semanal por 3 semanas.' },
      { modalidade: 'ultrassom', faixa: 'C', calc: 'geral', fontes: ['dudon2026', 'robertson2001'],
        resumo: 'Sem dose confirmada; na comparação direta, ficou atrás das ondas de choque na dor em repouso.' },
    ],
  },
  {
    id: 'trocanterica', nome: 'Dor trocantérica (síndrome dolorosa do trocânter maior)', grupo: 'tendoes',
    padroes: [[/trocanter/, 3], [/dor lateral do quadril/, 3], [/bursite trocanterica/, 3]],
    indicacoes: [
      { modalidade: 'ondas_choque', faixa: 'B', calc: 'trocanterica', fontes: ['carlisi2019', 'notarnicola2023'],
        resumo: 'As ondas focais foram mais eficazes que o ultrassom aos 2 meses (2,08 contra 3,36; P < 0,05). Protocolo relatado: 3 sessões semanais, 2000 impulsos a 4 Hz, EFD de 0,03 a 0,17 mJ/mm².' },
    ],
  },
  {
    id: 'estresse_tibial', nome: 'Síndrome do estresse tibial medial (canelite)', grupo: 'tendoes',
    padroes: [[/estresse tibial/, 3], [/canelite/, 3], [/periostite tibial/, 3]],
    indicacoes: [
      { modalidade: 'ondas_choque', faixa: 'C', calc: 'estresse_tibial', fontes: ['moen2011'],
        resumo: 'Só há estudo observacional (5 sessões em 9 semanas junto com corrida); sem ensaio com grupo controle nos resumos lidos.' },
    ],
  },
  {
    id: 'pontos_gatilho', nome: 'Pontos-gatilho e dor miofascial', grupo: 'tendoes',
    padroes: [[/ponto.?gatilho/, 3], [/miofascial/, 3], [/trigger/, 2]],
    indicacoes: [
      { modalidade: 'ondas_choque', faixa: 'C', calc: 'pontos_gatilho', fontes: ['suputtitada2022'],
        resumo: 'Um ensaio-piloto com 60 pacientes (radial, EFD+ 0,10 mJ/mm², 2000 impulsos, 3 sessões semanais) é a única dose completa encontrada.' },
    ],
  },

  // ───────────────────────────────── Ombro ──────────────────────────────────
  {
    id: 'ombro_calcificante', nome: 'Ombro com calcificação (tendinite calcária)', grupo: 'ombro',
    padroes: [[/calcific/, 3], [/tendinite calcarea/, 3], [/calcarea/, 2]],
    indicacoes: [
      { modalidade: 'ondas_choque', faixa: 'B', calc: 'ombro_calcificante', fontes: ['gerdesmeyer2003', 'surace2020'],
        resumo: 'A alta energia foi superior à baixa. A revisão Cochrane viu poucos benefícios clinicamente importantes e mais eventos adversos que o placebo (RR 3,61; certeza baixa).' },
      { modalidade: 'ultrassom', faixa: 'B', calc: 'calcarea_ombro', fontes: ['cota2023'],
        resumo: 'Um ensaio com 46 pacientes: a calcificação diminuiu 10,92% contra 5,04% no placebo (P = 0,008), com 1 MHz, 1,5 W/cm², 10 min e exercícios por 4 semanas.' },
    ],
  },
  {
    id: 'ombro_manguito_impacto', nome: 'Ombro doloroso (manguito rotador / impacto)', grupo: 'ombro',
    padroes: [[/manguito/, 3], [/impacto (do )?ombro|impingement/, 3], [/dor no ombro|omalgia|ombro doloroso|bursite subacromial/, 2], [/tendinopatia do ombro/, 3]],
    indicacoes: [
      { modalidade: 'laser', faixa: 'B', calc: 'ombro', fontes: ['haslerud2015'],
        resumo: 'Como monoterapia, a dor caiu 20,41 mm (IC 12,38–28,44) contra placebo; os ensaios com dose inadequada foram ineficazes em todos os desfechos.' },
      { modalidade: 'ondas_choque', faixa: 'C', calc: 'protocolo_geral', fontes: ['surace2020'],
        resumo: 'A revisão Cochrane (com e sem calcificação) viu poucos benefícios clinicamente importantes e mais eventos adversos que o placebo.' },
      { modalidade: 'ultrassom', faixa: 'D', calc: 'geral', fontes: ['yu2015'],
        resumo: 'Em dor de ombro, fita pré-tensionada, ultrassom e interferencial não foram eficazes.' },
      { modalidade: 'interferencial', faixa: 'D', calc: 'geral', fontes: ['yu2015', 'fuentes2010'],
        resumo: 'Em dor de ombro, não foi eficaz; a primeira revisão sistemática concluiu que, isolada, não foi melhor que placebo.' },
    ],
  },

  // ───────────────────────────── Articulações ───────────────────────────────
  {
    id: 'joelho_oa', nome: 'Osteoartrite de joelho', grupo: 'articulacoes',
    padroes: [[/artrose.*joelho|joelho.*artrose/, 3], [/gonartrose/, 3], [/osteoartrite.*joelho|joelho.*osteoartrite/, 3], [/\boa\b.*joelho|joelho.*\boa\b/, 3], [/osteoartrite|artrose/, 1]],
    indicacoes: [
      { modalidade: 'laser', faixa: 'A', calc: 'osteoartrite_joelho', fontes: ['stausholm2019', 'naterstad2022'],
        resumo: 'Com as doses recomendadas, a dor caiu 18,71 mm contra placebo no fim do tratamento (6,34 mm com doses não recomendadas). Faixa estudada: 4–8 J (780–860 nm) ou 1–3 J (904 nm), por ponto, na linha articular.' },
      { modalidade: 'ultrassom', faixa: 'B', calc: 'osteoartrite_joelho', fontes: ['luo2024'],
        resumo: 'Em 21 ensaios, dor SMD −0,64 e WOMAC −0,45; o pulsado com intensidade ≤ 2,5 W/cm² e 24 sessões teve melhor alívio. Heterogeneidade alta (I² 71%) e resumo ambíguo sobre a duração.' },
      { modalidade: 'interferencial', faixa: 'B', calc: 'joelho_oa', fontes: ['chen2022', 'varapirom2024', 'ata2024'],
        resumo: 'A meta-análise de 10 ensaios viu alívio de curto prazo (SMD −0,64) e de longo prazo (−0,36). Mas, em um ensaio de 144 pacientes, a diferença ficou abaixo da mínima clinicamente importante e sumiu na 6ª semana.' },
      { modalidade: 'tens', faixa: 'B', calc: 'joelho_oa', fontes: ['bueno2026'],
        resumo: 'Em 36 ensaios (2518 pacientes), o alívio foi maior com sessões de 40 min ou mais. O resumo lido não traz o tamanho do efeito.' },
    ],
  },
  {
    id: 'atm_muscular', nome: 'Disfunção temporomandibular (dor muscular da ATM)', grupo: 'articulacoes',
    padroes: [[/\batm\b/, 3], [/temporomandibular/, 3], [/bruxismo/, 2], [/\bdtm\b/, 3]],
    indicacoes: [
      { modalidade: 'ultrassom', faixa: 'B', calc: 'atm_muscular', fontes: ['subhikshaa2026'],
        resumo: 'Um ensaio com 36 pacientes: melhor dor e abertura bucal que a medicação a curto prazo (1 MHz, 1,0 W/cm² contínuo, 10 min por dia, 7 dias).' },
      { modalidade: 'laser', faixa: 'C', calc: 'lombar_carpo_atm', fontes: ['alves2026'],
        resumo: 'A heterogeneidade clínica e metodológica impede conclusões definitivas; não há dose por ponto confirmada.' },
    ],
  },

  // ───────────────────────────── Coluna e pescoço ───────────────────────────
  {
    id: 'lombar_cronica', nome: 'Dor lombar crônica', grupo: 'coluna',
    padroes: [[/cronic\w*.*lomb|lomb.*cronic/, 3], [/lombalgia|dor lombar|lombociatalgia|dor nas costas/, 2]],
    indicacoes: [
      { modalidade: 'interferencial', faixa: 'B', calc: 'lombar_cronica', fontes: ['wang2025', 'facci2011', 'dias2021'],
        resumo: 'Na rede de 15 ensaios, SMD −0,96 (certeza baixa). Em 150 pacientes, equivaleu ao TENS e ambos foram melhores que nenhum tratamento. Em sessão única, 4 kHz a 100 Hz se destacou.' },
      { modalidade: 'tens', faixa: 'C', calc: 'lombar_cronica', fontes: ['amer2026'],
        resumo: 'O efeito global não foi significativo (d = 0,16; certeza baixa); com intensidade adequada, d = 0,97, e com a inadequada, 0,30.' },
      { modalidade: 'laser', faixa: 'C', calc: 'lombar_carpo_atm', fontes: ['huang2015', 'tomazoni2020'],
        resumo: 'As revisões discordam: uma viu redução de dor (−13,57), outra, com 12 ensaios, concluiu que a evidência atual não sustenta o laser.' },
    ],
  },
  {
    id: 'lombar_aguda', nome: 'Dor lombar aguda', grupo: 'coluna',
    padroes: [[/aguda.*lomb|lomb.*aguda/, 3], [/lumbago/, 3], [/lombalgia|dor lombar/, 1]],
    indicacoes: [
      { modalidade: 'interferencial', faixa: 'C', calc: 'lombar_aguda', fontes: ['hurley2001'],
        resumo: 'Com parâmetros padronizados (3,85 kHz, 140 Hz, 130 µs, 30 min), a posição “nervo espinal” deu melhor incapacidade; em outro ensaio, juntar manipulação e interferencial não mudou o resultado.' },
    ],
  },
  {
    id: 'cervical', nome: 'Dor cervical', grupo: 'coluna',
    padroes: [[/cervicalgia/, 3], [/dor cervical/, 3], [/pescoco|torcicolo/, 2], [/cervical/, 1]],
    nota: 'A meta-análise em rede (34 ensaios, 2141 pacientes) ordenou: laser de alta intensidade (HILT), ondas de choque, interferencial, TENS, laser de baixa intensidade e ultrassom. O HILT ainda não está nas calculadoras.',
    indicacoes: [
      { modalidade: 'ondas_choque', faixa: 'B', calc: 'protocolo_geral', fontes: ['hao2025'],
        resumo: '2º na ordem de prioridade da rede. Os resumos lidos não trazem os parâmetros.' },
      { modalidade: 'interferencial', faixa: 'B', calc: 'geral', fontes: ['hao2025', 'albornoz2021'],
        resumo: '3º na rede. Em 49 pacientes, somar interferencial ao exercício melhorou dor e incapacidade imediatas (NNT 2), sem ganho de amplitude de movimento.' },
      { modalidade: 'tens', faixa: 'B', calc: 'geral', fontes: ['hao2025'],
        resumo: '4º na rede; parâmetros não informados nos resumos lidos.' },
      { modalidade: 'laser', faixa: 'B', calc: 'cervical', fontes: ['hao2025', 'chow2009'],
        resumo: '5º na rede. Em 11 ensaios, a dor caiu 19,86 mm na EVA; o resumo não traz a dose por ponto.' },
      { modalidade: 'ultrassom', faixa: 'C', calc: 'cervical', fontes: ['hao2025', 'qing2021'],
        resumo: 'Último da rede. Pode reduzir mais a dor que placebo ou nada, mas o benefício adicional ao tratamento habitual é incerto.' },
    ],
  },

  // ───────────────────────────── Dor e nervos ───────────────────────────────
  {
    id: 'tunel_carpo', nome: 'Síndrome do túnel do carpo', grupo: 'dor',
    padroes: [[/tunel do carpo/, 3], [/sindrome do tunel/, 3], [/\bstc\b/, 2]],
    indicacoes: [
      { modalidade: 'ultrassom', faixa: 'C', calc: 'tunel_carpo', fontes: ['page2013'],
        resumo: 'Só evidência de baixa qualidade a favor do ultrassom contra placebo (um estudo, RR 2,36); sem regime preferível nem vantagem sobre órtese ou exercícios.' },
    ],
  },
  {
    id: 'fibromialgia', nome: 'Fibromialgia', grupo: 'dor',
    padroes: [[/fibromialgia/, 3]],
    indicacoes: [
      { modalidade: 'tens', faixa: 'C', calc: 'fibromialgia', fontes: ['johnson2017', 'sahebari2026'],
        resumo: 'A revisão Cochrane não encontrou evidência de qualidade suficiente. Uma revisão de revisões viu alívio de curto prazo, sobretudo com intensidades mais altas e 10 ou mais sessões.' },
    ],
  },
  {
    id: 'dor_neuropatica', nome: 'Dor neuropática', grupo: 'dor',
    padroes: [[/neuropatic/, 3], [/neuropatia/, 2], [/neuralgia/, 2]],
    indicacoes: [
      { modalidade: 'tens', faixa: 'C', calc: 'neuropatica', fontes: ['gibson2017'],
        resumo: 'Não é possível afirmar se o TENS controla a dor neuropática (15 estudos, 724 participantes; qualidade muito baixa).' },
    ],
  },
  {
    id: 'dor_qualquer', nome: 'Dor (qualquer diagnóstico), durante o uso', grupo: 'dor',
    padroes: [[/dor cronica/, 2], [/dor generalizada|dor em geral|dor sem diagnostico/, 2]],
    indicacoes: [
      { modalidade: 'tens', faixa: 'A', calc: 'geral', fontes: ['johnson2022'],
        resumo: 'Em 381 ensaios, o TENS forte e não doloroso reduziu a dor durante ou logo após o uso (SMD −0,96; certeza moderada). Mede o efeito imediato, não o prolongado.' },
    ],
  },
  {
    id: 'dor_aguda', nome: 'Dor aguda no adulto (TENS isolado)', grupo: 'dor',
    padroes: [[/dor aguda/, 3]],
    indicacoes: [
      { modalidade: 'tens', faixa: 'C', calc: 'aguda', fontes: ['walsh2009'],
        resumo: 'A revisão Cochrane não chegou a conclusão definitiva sobre o TENS isolado na dor aguda do adulto.' },
    ],
  },
  {
    id: 'dor_pos_operatoria', nome: 'Dor pós-operatória', grupo: 'dor',
    padroes: [[/pos[- ]?operatori/, 3], [/pos[- ]?op\b/, 3], [/pos[- ]?cirurg/, 3], [/incisao/, 1]],
    indicacoes: [
      { modalidade: 'tens', faixa: 'B', calc: 'pos_operatoria', fontes: ['bjordal2003'],
        resumo: 'Em 21 ensaios, o TENS forte e subnocivo na área da ferida reduziu o consumo de analgésicos em 35,5%, contra 4,1% com estimulação inadequada.' },
      { modalidade: 'interferencial', faixa: 'C', calc: 'pos_operatorio', fontes: ['schulz2025', 'kadi2019'],
        resumo: 'Os ensaios discordam: após esternotomia reduziu a dor (diferença ajustada −8,3); após artroplastia de joelho, não houve diferença.' },
    ],
  },
  {
    id: 'dismenorreia_pelvica', nome: 'Dismenorreia primária e dor pélvica', grupo: 'dor',
    padroes: [[/dismenorreia/, 3], [/colica menstrual/, 3], [/dor pelvica/, 3]],
    indicacoes: [
      { modalidade: 'tens', faixa: 'B', calc: 'pelvica_dismenorreia', fontes: ['han2024', 'babazadeh2022'],
        resumo: 'Em 20 ensaios (585 mulheres), a alta frequência (−1,39) e a baixa (−2,04) podem reduzir a dor, com certeza baixa. Na dor pélvica, a alta frequência com intensidade máxima tolerada foi mais eficaz.' },
    ],
  },

  // ───────────────────────────── Força e função ─────────────────────────────
  {
    id: 'quadriceps_pos_atj', nome: 'Quadríceps após artroplastia de joelho', grupo: 'forca',
    padroes: [[/artroplastia/, 3], [/protese (total )?de joelho/, 3], [/\batj\b|\bptj\b/, 3]],
    indicacoes: [
      { modalidade: 'nmes', faixa: 'C', calc: 'pos_atj', fontes: ['peng2021', 'labanca2022', 'bistolfi2018', 'volpato2015'],
        resumo: 'Há ganho de força no 1º mês (SMD 0,81), mas muitos desfechos ficaram abaixo da diferença clinicamente importante, não há diferença a médio e longo prazo, e uma revisão a achou menos eficaz que a reabilitação tradicional (embora útil para ativar o quadríceps nos primeiros dias).' },
      { modalidade: 'interferencial', faixa: 'D', calc: 'pos_operatorio', fontes: ['kadi2019'],
        resumo: 'Para dor, amplitude e edema após artroplastia, não houve diferença contra placebo.' },
    ],
  },
  {
    id: 'lca_pos', nome: 'Reconstrução do LCA', grupo: 'forca',
    padroes: [[/\blca\b/, 3], [/ligamento cruzado/, 3], [/ligamentoplastia/, 3]],
    indicacoes: [
      { modalidade: 'nmes', faixa: 'B', calc: 'lca', fontes: ['kim2010', 'bax2005'],
        resumo: 'NMES com exercício pode fortalecer o quadríceps mais que só exercício; o efeito funcional é inconclusivo e os parâmetros dos estudos são inconsistentes. O exercício voluntário parece mais eficaz na maioria das situações.' },
    ],
  },
  {
    id: 'fraqueza_uti', nome: 'Fraqueza no paciente crítico (UTI)', grupo: 'forca',
    padroes: [[/\buti\b/, 3], [/terapia intensiva/, 3], [/paciente critico/, 3], [/fraqueza adquirida/, 3], [/atrofia por desuso|imobilizacao prolongada/, 2]],
    indicacoes: [
      { modalidade: 'nmes', faixa: 'B', calc: 'uti', fontes: ['maffiuletti2013'],
        resumo: 'Em 8 ensaios (172 pacientes), evidência moderada a forte para a força e inconclusiva para evitar a perda de massa muscular; o critério mínimo foi a contração visível.' },
    ],
  },
  {
    id: 'pe_caido_avc', nome: 'Pé caído após AVC', grupo: 'forca',
    padroes: [[/pe caido|foot drop/, 3], [/avc.*(pe|marcha)|(pe|marcha).*avc/, 2], [/hemiparesia/, 1]],
    indicacoes: [
      { modalidade: 'nmes', faixa: 'B', calc: 'fes_avc', fontes: ['kottink2004', 'dunning2015', 'he2025'],
        resumo: 'A velocidade de marcha melhorou 0,13 m/s (38%) e a FES equivaleu à órtese tornozelo-pé. Mas, em uma rede de 37 ensaios, a eficácia não foi significativa nas fases de sequela.' },
    ],
  },
  {
    id: 'pe_caido_em', nome: 'Pé caído na esclerose múltipla', grupo: 'forca',
    padroes: [[/esclerose multipla/, 3], [/pe caido/, 1]],
    indicacoes: [
      { modalidade: 'nmes', faixa: 'B', calc: 'fes_em', fontes: ['miller2017'],
        resumo: 'Efeito ortótico na velocidade de marcha em testes curtos (+0,05 e +0,08 m/s) e nenhum efeito terapêutico.' },
    ],
  },
  {
    id: 'espasticidade_avc', nome: 'Espasticidade após AVC', grupo: 'forca',
    padroes: [[/espastic/, 3]],
    indicacoes: [
      { modalidade: 'ondas_choque', faixa: 'B', calc: 'espasticidade', fontes: ['liu2025'],
        resumo: 'Na meta-análise, a onda radial foi melhor que a focal e o efeito foi maior com frequência abaixo de 8 Hz e pressão abaixo de 2 bar; impulsos e sessões não constam no resumo.' },
    ],
  },
  {
    id: 'desempenho_muscular', nome: 'Desempenho e recuperação muscular', grupo: 'forca',
    padroes: [[/desempenho muscular|recuperacao muscular/, 3], [/dor muscular tardia|\bdoms\b/, 3], [/fadiga muscular/, 2]],
    indicacoes: [
      { modalidade: 'laser', faixa: 'A', calc: 'desempenho_muscular', fontes: ['leal2015'],
        resumo: 'Em 13 ensaios, os resultados mais consistentes vieram com luz vermelha ou infravermelha aplicada ANTES do exercício, 50–200 mW e 5–6 J por ponto (+5,47 repetições).' },
    ],
  },
];

// ─────────────────────────────── Funções ─────────────────────────────────────

export const patologia = (id: string) => PATOLOGIAS.find((p) => p.id === id);

/** Indicações da melhor para a pior faixa; dentro da faixa, vale a ordem dos dados. */
export function indicacoesOrdenadas(p: PatologiaGuia): IndicacaoGuia[] {
  return p.indicacoes
    .map((i, ordem) => ({ i, ordem }))
    .sort((a, b) => PESO_FAIXA[a.i.faixa] - PESO_FAIXA[b.i.faixa] || a.ordem - b.ordem)
    .map((x) => x.i);
}

export function modalidadesSemDados(p: PatologiaGuia, todas: Modalidade[]): Modalidade[] {
  const com = new Set(p.indicacoes.map((i) => i.modalidade));
  return todas.filter((m) => !com.has(m));
}

const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export interface Interpretacao { id: string; nome: string; pontos: number; trechos: string[] }

/** Entende uma descrição livre do paciente e devolve as patologias do guia mais prováveis. */
export function interpretarDescricao(texto: string, limite = 4): Interpretacao[] {
  const t = normalizar(texto);
  if (t.trim().length < 3) return [];
  const out: Interpretacao[] = [];
  for (const p of PATOLOGIAS) {
    let pontos = 0;
    const trechos: string[] = [];
    for (const [re, peso] of p.padroes) {
      const m = re.exec(t);
      if (m) { pontos += peso; trechos.push(m[0].trim()); }
    }
    if (pontos > 0) out.push({ id: p.id, nome: p.nome, pontos, trechos });
  }
  return out.sort((a, b) => b.pontos - a.pontos).slice(0, limite);
}

const ORIGENS_CLINICAS = ['Queixa principal', 'Avatar clínico', 'Diagnósticos', 'História atual', 'Histórico clínico', 'Condições preexistentes'];

export interface InterpretacaoProntuario extends Interpretacao { origens: string[] }

/** Procura no prontuário (queixa, achados do avatar, diagnósticos, história) as patologias do guia. */
export function interpretarProntuario(textos: { origem: string; texto: string }[], limite = 4): InterpretacaoProntuario[] {
  const acc = new Map<string, InterpretacaoProntuario>();
  for (const t of textos.filter((x) => ORIGENS_CLINICAS.includes(x.origem))) {
    for (const r of interpretarDescricao(t.texto, 10)) {
      const atual = acc.get(r.id) ?? { ...r, pontos: 0, trechos: [], origens: [] };
      atual.pontos += r.pontos;
      atual.trechos.push(...r.trechos.filter((x) => !atual.trechos.includes(x)));
      if (!atual.origens.includes(t.origem)) atual.origens.push(t.origem);
      acc.set(r.id, atual);
    }
  }
  return [...acc.values()].sort((a, b) => b.pontos - a.pontos).slice(0, limite);
}
