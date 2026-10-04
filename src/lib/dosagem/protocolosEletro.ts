// Correntes elétricas: o que a literatura lida sustenta, condição a condição.
// Aqui NÃO há “receita por diagnóstico”: as revisões mostram que, em TENS e
// interferencial, a maioria dos parâmetros não muda o resultado quando a
// intensidade é adequada, e que russa e kHz não são melhores que a pulsada de
// baixa frequência. Por isso cada cartão traz (1) faixas observadas nos
// ensaios, (2) o que a evidência concluiu — incluindo os resultados negativos —
// e (3) exemplos de ensaios que podem ser carregados na calculadora.
// Só entra número lido em artigo; o resto fica “não informado nos resumos lidos”.

export type NivelEvidencia = 'moderada' | 'baixa' | 'muito_baixa' | 'insuficiente' | 'inconclusiva';

export const ROTULO_NIVEL: Record<NivelEvidencia, string> = {
  moderada: 'Certeza moderada',
  baixa: 'Certeza baixa',
  muito_baixa: 'Certeza muito baixa',
  insuficiente: 'Evidência insuficiente',
  inconclusiva: 'Inconclusiva',
};

export interface ParamsEletro {
  freqHz?: number;
  larguraUs?: number;
  duracaoMin?: number;
  sessoes?: number;
  onS?: number;
  offS?: number;
  rampaS?: number;
  portadoraHz?: number;
  burstHz?: number;
  amfHz?: number;
  correnteMa?: number;
}

export interface ExemploEletro {
  titulo: string;
  params: ParamsEletro;
  /** O que o ensaio relatou além dos números carregados. */
  nota?: string;
  fontes: string[];
}

export interface FaixaEletro {
  rotulo: string;
  valor: string;
  fontes: string[];
}

export interface CondicaoEletro {
  id: string;
  nome: string;
  resumo: string;
  nivel?: NivelEvidencia;
  faixas: FaixaEletro[];
  /** Resultados negativos, ressalvas e o que a pesquisa não achou. */
  ressalvas?: string[];
  exemplos?: ExemploEletro[];
  fontes: string[];
}

// ─────────────────────────────────── TENS ────────────────────────────────────

export const CONDICOES_TENS: CondicaoEletro[] = [
  {
    id: 'geral',
    nome: 'Princípio geral (qualquer dor)',
    nivel: 'moderada',
    resumo: 'Em revisão de 381 ensaios, o TENS forte e não doloroso, no local ou perto da dor, reduziu a dor durante ou logo após o uso (SMD −0,96, em 91 ensaios). Quando a sensação é forte, a frequência não mudou o resultado; a orientação é ajustar frequência, largura e padrão ao que for mais confortável.',
    faixas: [
      { rotulo: 'Intensidade', valor: 'forte, não dolorosa, no local ou perto da dor, titulada durante a sessão', fontes: ['johnson2022', 'aarskog2007'] },
      { rotulo: 'Limites dos estudos', valor: '≤ 250 pps, ≤ 500 µs, ≤ 60 mA pico a pico (critério de inclusão, não recomendação)', fontes: ['johnson2022'] },
    ],
    ressalvas: [
      'Pode haver tolerância fisiológica: se a sensação diminuir, aumente a intensidade ou use correntes moduladas.',
      'Eventos adversos leves e pouco frequentes (irritação de pele, dor à palpação, desconforto); nenhum evento sério atribuível ao TENS, com certeza muito baixa.',
      'A comparação com placebo mede o efeito durante ou logo após o uso, não o efeito prolongado.',
    ],
    exemplos: [{
      titulo: 'Voluntários saudáveis (Aarskog 2007)',
      params: { freqHz: 100, larguraUs: 150, duracaoMin: 20 },
      nota: 'Intensidade forte e confortável ajustada pelo terapeuta aumentou o limiar de dor à pressão; no limiar sensorial, não.',
      fontes: ['aarskog2007'],
    }],
    fontes: ['johnson2022', 'aarskog2007'],
  },
  {
    id: 'pos_operatoria',
    nome: 'Dor pós-operatória',
    resumo: 'TENS forte e subnocivo na área da ferida, em frequência adequada, reduziu o consumo de analgésicos em 35,5%, contra 4,1% quando a estimulação não foi confirmada como adequada.',
    faixas: [
      { rotulo: 'Convencional', valor: '25–150 Hz (mediana de 85 Hz nos estudos de estimulação ótima)', fontes: ['bjordal2003'] },
      { rotulo: 'Tipo acupuntura', valor: '1–8 Hz (um estudo, 2 Hz)', fontes: ['bjordal2003'] },
      { rotulo: 'Intensidade', valor: 'forte, definida, subnociva, máxima tolerável (mais de 15 mA em parte dos estudos)', fontes: ['bjordal2003'] },
      { rotulo: 'Eletrodos', valor: 'na área da incisão', fontes: ['bjordal2003'] },
    ],
    ressalvas: ['A largura de pulso não consta nos resumos lidos.'],
    fontes: ['bjordal2003'],
  },
  {
    id: 'lombar_cronica',
    nome: 'Dor lombar crônica',
    nivel: 'baixa',
    resumo: 'O efeito global não foi significativo (d = 0,16), mas com intensidade adequada o efeito foi grande (d = 0,97) e com a inadequada, pequeno (d = 0,30). Frequência, número de sessões e posição dos eletrodos não alteraram o resultado de forma significativa.',
    faixas: [
      { rotulo: 'Intensidade', valor: 'perceptível, de nível sensorial, titulada ao longo da sessão', fontes: ['amer2026'] },
      { rotulo: 'Frequência nos estudos', valor: 'alta (10–200 Hz) em 12 de 29 estudos; baixa (≤ 10 Hz) em 5', fontes: ['amer2026'] },
    ],
    ressalvas: [
      'Intensidade fixa, ou forte a ponto de provocar contração muscular, geralmente não é recomendada.',
      'Largura de pulso e duração da sessão não foram encontradas nos resumos lidos.',
    ],
    fontes: ['amer2026'],
  },
  {
    id: 'joelho_oa',
    nome: 'Osteoartrite de joelho',
    resumo: 'Em 36 ensaios (2518 pacientes), o alívio foi maior quando a estimulação durou 40 minutos ou mais. Frequência, intensidade e número de sessões não moderaram o resultado.',
    faixas: [
      { rotulo: 'Duração da sessão', valor: '≥ 40 min', fontes: ['bueno2026'] },
    ],
    ressalvas: ['Os autores pedem ensaios com placebo de melhor qualidade e com todos os parâmetros relatados.'],
    exemplos: [{ titulo: 'Duração com maior alívio', params: { duracaoMin: 40 }, fontes: ['bueno2026'] }],
    fontes: ['bueno2026'],
  },
  {
    id: 'pelvica_dismenorreia',
    nome: 'Dismenorreia primária e dor pélvica',
    nivel: 'baixa',
    resumo: 'TENS de alta e de baixa frequência podem reduzir a dor contra placebo ou nada, com certeza baixa. Na dor pélvica, a alta frequência com intensidade máxima tolerada foi mais eficaz.',
    faixas: [
      { rotulo: 'Duração', valor: 'pelo menos 20 min', fontes: ['babazadeh2022'] },
      { rotulo: 'Largura de pulso', valor: '50–400 µs', fontes: ['babazadeh2022'] },
      { rotulo: 'Frequência', valor: '2–120 Hz', fontes: ['babazadeh2022'] },
    ],
    ressalvas: ['Não se sabe se a alta frequência é melhor que a baixa (diferença não conclusiva).'],
    exemplos: [{ titulo: 'Alta frequência, intensidade máxima tolerada', params: { duracaoMin: 20 }, nota: 'Faixas relatadas: 2–120 Hz e 50–400 µs.', fontes: ['babazadeh2022', 'han2024'] }],
    fontes: ['han2024', 'babazadeh2022'],
  },
  {
    id: 'fibromialgia',
    nome: 'Fibromialgia',
    nivel: 'insuficiente',
    resumo: 'A revisão Cochrane não encontrou evidência de qualidade suficiente para apoiar ou refutar o TENS. Uma revisão de revisões de 2026 viu alívio de curto prazo, sobretudo com intensidades mais altas e 10 ou mais sessões.',
    faixas: [
      { rotulo: 'Sessões', valor: '10 ou mais', fontes: ['sahebari2026'] },
      { rotulo: 'Intensidade', valor: 'sensações perceptíveis; intensidades mais altas se saíram melhor', fontes: ['johnson2017', 'sahebari2026'] },
    ],
    fontes: ['johnson2017', 'sahebari2026'],
  },
  {
    id: 'neuropatica',
    nome: 'Dor neuropática',
    nivel: 'muito_baixa',
    resumo: 'Não é possível afirmar se o TENS controla a dor neuropática (15 estudos, 724 participantes). Os poucos estudos titularam a intensidade para um formigamento confortável e perceptível.',
    faixas: [
      { rotulo: 'Intensidade', valor: 'formigamento confortável e perceptível', fontes: ['gibson2017'] },
      { rotulo: 'Aplicações nos estudos', valor: 'de 15 min a 1 h, até 4 vezes ao dia; de 4 dias a 3 meses (observado, não recomendação)', fontes: ['gibson2017'] },
    ],
    ressalvas: ['Único evento adverso relatado: irritação de pele sob os eletrodos.'],
    fontes: ['gibson2017'],
  },
  {
    id: 'aguda',
    nome: 'Dor aguda no adulto',
    nivel: 'inconclusiva',
    resumo: 'A revisão Cochrane não conseguiu chegar a conclusão definitiva sobre a eficácia do TENS isolado para dor aguda no adulto.',
    faixas: [],
    fontes: ['walsh2009'],
  },
];

// ───────────────────────────────── FES / NMES ────────────────────────────────

export const CONDICOES_NMES: CondicaoEletro[] = [
  {
    id: 'geral',
    nome: 'Parâmetros gerais de contração',
    resumo: 'O torque evocado é o principal determinante da eficácia da NMES, mas não foi relatado em nenhum dos ensaios de UTI revisados. Use a maior intensidade que o paciente tolerar, com contração visível.',
    faixas: [
      { rotulo: 'Frequência', valor: 'a maioria dos regimes clínicos usa 20–50 Hz', fontes: ['doucet2012'] },
      { rotulo: 'Frequência baixa', valor: 'abaixo de 16 Hz não bastou para levar o joelho a 40°', fontes: ['doucet2012'] },
      { rotulo: 'Ciclo de trabalho', valor: '1:3 é comum como padrão', fontes: ['doucet2012'] },
      { rotulo: 'Rampa', valor: '1–3 s são comuns na reabilitação', fontes: ['doucet2012'] },
      { rotulo: 'FES-cycling', valor: 'pulsos de 300–600 µs', fontes: ['doucet2012'] },
    ],
    ressalvas: [
      'Músculo fatigado estimulado em 10–30 Hz pode produzir forças menores por 24 h ou mais.',
      'Pulso largo e alta frequência: um estudo viu mais fadiga, outro viu perda de força igual; os resultados discordam.',
    ],
    fontes: ['doucet2012', 'maffiuletti2013', 'neyroud2014', 'martin2016'],
  },
  {
    id: 'pos_atj',
    nome: 'Quadríceps após artroplastia de joelho',
    resumo: 'Em 9 ensaios (691 pacientes), a força melhorou no 1º mês (SMD 0,81), mas muitos desfechos não atingiram a diferença clinicamente importante. O benefício foi maior com 1–2 aplicações por dia por 4–6 semanas, em intensidade alta; outras revisões viram efeito limitado ou nenhuma diferença a médio e longo prazo.',
    faixas: [
      { rotulo: 'Nos ensaios', valor: '30–100 Hz; pulso de 300 µs a 5 ms; de 15 min por dia a 2 h duas vezes ao dia', fontes: ['peng2021'] },
      { rotulo: 'Maior benefício', valor: '1–2 vezes por dia, 4–6 semanas, 100–120 mA, 30–100 Hz', fontes: ['yue2018'] },
      { rotulo: 'Intensidade', valor: 'máxima tolerável', fontes: ['peng2021'] },
    ],
    ressalvas: [
      'NMES de curta duração e baixa intensidade tem efeito limitado na força do quadríceps.',
      'Sem diferença a médio e longo prazo.',
      'Uma revisão concluiu que foi menos eficaz que a reabilitação tradicional em função, força e amplitude, porém útil para ativar o quadríceps nos primeiros dias.',
      'O tempo on:off e a rampa não constam nos resumos lidos.',
    ],
    exemplos: [
      { titulo: 'Avramidis 2003 (vasto medial)', params: { freqHz: 40, larguraUs: 300, duracaoMin: 120 }, nota: '2 h por vez, 2 vezes ao dia, do 2º dia de pós-operatório até 6 semanas; intensidade máxima tolerável.', fontes: ['peng2021'] },
      { titulo: 'Valdés 2010', params: { freqHz: 65, larguraUs: 300, duracaoMin: 15 }, nota: '15 min, 1 vez ao dia, a partir do dia seguinte à cirurgia; 15–30 mA.', fontes: ['peng2021'] },
      { titulo: 'Yoshida 2017 (motora)', params: { freqHz: 100, larguraUs: 1000, duracaoMin: 45 }, nota: '45 min por dia, 5 dias por semana, 2 semanas; 15–38 mA, máxima tolerável.', fontes: ['peng2021'] },
    ],
    fontes: ['peng2021', 'yue2018', 'labanca2022', 'bistolfi2018', 'volpato2015'],
  },
  {
    id: 'uti',
    nome: 'Paciente crítico (UTI)',
    resumo: 'Em 8 ensaios, a maioria no quadríceps, a NMES teve evidência moderada a forte para a força e evidência inconclusiva para evitar a perda de massa muscular. O critério mínimo foi a contração muscular visível.',
    faixas: [
      { rotulo: 'Frequência', valor: '8–100 Hz', fontes: ['maffiuletti2013'] },
      { rotulo: 'Pulso', valor: '250–400 µs', fontes: ['maffiuletti2013'] },
      { rotulo: 'On:off nos estudos', valor: '12:6 s, 8:24 s, 4:6 s e 2:4 s', fontes: ['maffiuletti2013'] },
      { rotulo: 'Sessões', valor: '25–60 min por dia, 5–7 dias por semana, de 7 dias a 6 semanas', fontes: ['maffiuletti2013'] },
    ],
    ressalvas: ['Rampa foi relatada em só 3 estudos, sem valores.'],
    fontes: ['maffiuletti2013'],
  },
  {
    id: 'lca',
    nome: 'Pós-reconstrução do LCA',
    resumo: 'NMES com exercício pode fortalecer o quadríceps mais que o exercício sozinho; o efeito funcional é inconclusivo. Em outra revisão, o exercício voluntário pareceu mais eficaz na maioria das situações.',
    faixas: [],
    ressalvas: ['Os parâmetros dos estudos são inconsistentes; os resumos lidos não trazem Hz, µs nem on:off.'],
    fontes: ['kim2010', 'bax2005'],
  },
  {
    id: 'fes_avc',
    nome: 'FES para pé caído (AVC)',
    resumo: 'A melhora conjunta da velocidade de marcha foi de 0,13 m/s (38%). A estimulação e a órtese tornozelo-pé parecem eficazes e equivalentes para a velocidade de marcha.',
    faixas: [
      { rotulo: 'Programa de marcha com FES', valor: '3 a 5 sessões de 1 h por semana, por pelo menos 4 semanas', fontes: ['doucet2012'] },
    ],
    ressalvas: ['Hz, largura de pulso e ciclo não constam nos resumos lidos.'],
    fontes: ['kottink2004', 'dunning2015', 'doucet2012'],
  },
  {
    id: 'fes_em',
    nome: 'FES para pé caído (esclerose múltipla)',
    resumo: 'Houve efeito ortótico na velocidade de marcha em testes curtos (+0,05 m/s no início e +0,08 m/s no uso contínuo) e nenhum efeito terapêutico; nos testes longos, nenhum efeito.',
    faixas: [],
    ressalvas: ['Hz, largura de pulso e ciclo não constam nos resumos lidos.'],
    fontes: ['miller2017'],
  },
];

// ────────────────────────────────── Corrente russa ───────────────────────────

export const CONDICOES_RUSSA: CondicaoEletro[] = [
  {
    id: 'kots',
    nome: 'Regime de Kots (origem da russa)',
    resumo: 'Kots relatou ganhos de força de 30–40% em atletas de elite, sem detalhar o trabalho. A revisão histórica descreve o regime “10/50/10” e a portadora de 2,5 kHz, e as comparações com a pulsada monofásica são inconclusivas.',
    faixas: [
      { rotulo: 'Portadora', valor: '2,5 kHz (valor citado)', fontes: ['ward2002'] },
      { rotulo: 'Regime 10/50/10', valor: '10 s de estímulo, 50 s de repouso, por 10 min', fontes: ['ward2002'] },
    ],
    ressalvas: ['Os textos lidos não trazem a duração do burst nem a frequência de burst da “russa original”.'],
    exemplos: [{ titulo: 'Regime 10/50/10', params: { portadoraHz: 2500, onS: 10, offS: 50, duracaoMin: 10 }, fontes: ['ward2002'] }],
    fontes: ['ward2002', 'hasan2024'],
  },
  {
    id: 'atletas',
    nome: 'Fortalecimento de quadríceps em atletas',
    resumo: 'Em 10 atletas de vôlei, 12 sessões em 6 semanas aumentaram o pico de torque e a resistência com russa e com corrente de alta voltagem, mas só a razão de resistência foi significativa, sem vantagem de uma corrente sobre a outra. O estudo é pequeno e sem grupo controle.',
    faixas: [
      { rotulo: 'Portadora e burst', valor: '2500 Hz, 50 pulsos por segundo, pulso de 200 µs', fontes: ['akinoglu2020'] },
      { rotulo: 'On:off e duração', valor: '10 s : 10 s, 20 min após o treino isocinético', fontes: ['akinoglu2020'] },
      { rotulo: 'Programa', valor: '12 sessões, 2 por semana, 6 semanas', fontes: ['akinoglu2020'] },
      { rotulo: 'Intensidade', valor: '70% do limiar máximo de dor tolerado', fontes: ['akinoglu2020'] },
    ],
    exemplos: [{ titulo: 'Protocolo de Akınoğlu 2020', params: { portadoraHz: 2500, burstHz: 50, onS: 10, offS: 10, duracaoMin: 20, sessoes: 12 }, fontes: ['akinoglu2020'] }],
    fontes: ['akinoglu2020'],
  },
  {
    id: 'agudo',
    nome: 'Efeito agudo no torque (saudáveis)',
    resumo: 'Em 48 saudáveis, uma sessão de 15 min aumentou o torque isocinético de 123,3 para 136,7. É um efeito agudo, não ganho de força por treinamento.',
    faixas: [
      { rotulo: 'Parâmetros', valor: '2500 Hz, burst de 50 Hz, 2 s on : 2 s off, 15 min', fontes: ['hasan2024'] },
      { rotulo: 'Intensidade', valor: 'até a tolerância máxima, 7/10 na escala numérica de dor', fontes: ['hasan2024'] },
    ],
    exemplos: [{ titulo: 'Sessão de Hasan 2024', params: { portadoraHz: 2500, burstHz: 50, onS: 2, offS: 2, duracaoMin: 15 }, fontes: ['hasan2024'] }],
    fontes: ['hasan2024'],
  },
  {
    id: 'comparacao',
    nome: 'Russa × pulsada de baixa frequência',
    nivel: 'inconclusiva',
    resumo: 'A literatura não sustenta que a corrente de kHz seja melhor que a pulsada de baixa frequência para fortalecer: o torque evocado e o desconforto foram semelhantes ou piores com a russa, e a russa teve torque evocado menor em um estudo (50,8% contra 70,1–76,9%).',
    faixas: [
      { rotulo: 'Burst sugerido por Ward', valor: 'bursts retangulares curtos de 2–4 ms; os parâmetros usuais da russa e da interferencial são subótimos', fontes: ['ward2009'] },
    ],
    ressalvas: [
      'Não foi encontrado ensaio de ganho de força com kHz em pós-lesão com todos os parâmetros relatados.',
      'Os estudos de limiar e de torque agudo são de laboratório, não de desfecho clínico.',
    ],
    fontes: ['dasilva2015', 'vaz2017', 'dantas2015', 'ward2009'],
  },
];

// ─────────────────────────────── Corrente interferencial ─────────────────────

export const CONDICOES_IFC: CondicaoEletro[] = [
  {
    id: 'geral',
    nome: 'Como é definida e o que se sabe',
    nivel: 'inconclusiva',
    resumo: 'A interferencial usa duas correntes alternadas de média frequência (acima de 1 e abaixo de 10 kHz), defasadas; o batimento (AMF) é a diferença entre elas. A primeira revisão sistemática concluiu que, sozinha, ela não foi melhor que placebo ou outra terapia, e a heterogeneidade impede conclusões.',
    faixas: [
      { rotulo: 'Portadoras', valor: 'uma fixa em 4000 Hz e a outra entre 4000 e 4250 Hz', fontes: ['rampazo2022'] },
      { rotulo: 'Batimento (AMF)', valor: '0–250 Hz, igual à diferença entre as correntes', fontes: ['rampazo2022'] },
      { rotulo: 'Nos ensaios', valor: 'portadora de 4 kHz, AMF de 30–180 Hz, 20–40 min, intensidade forte e confortável', fontes: ['rampazo2022'] },
      { rotulo: 'Pulso', valor: 'a maioria dos aparelhos tem 125 µs fixos', fontes: ['rampazo2022'] },
    ],
    ressalvas: [
      'A maioria dos parâmetros parece não influenciar a analgesia, exceto portadora de 1 ou 4 kHz com AMF de 100 Hz, que pode analgesiar mais que portadoras mais altas e confortáveis.',
      'Os efeitos atribuídos a faixas de AMF (por exemplo, 130 Hz mais sedativo) vêm mais da experiência dos autores que de evidência.',
      'Em dor de ombro, a interferencial não foi eficaz; em dor musculoesquelética, não foi mais eficaz que os tratamentos comparados.',
    ],
    fontes: ['rampazo2022', 'fuentes2010', 'hussein2021', 'yu2015'],
  },
  {
    id: 'lombar_cronica',
    nome: 'Lombalgia crônica',
    nivel: 'baixa',
    resumo: 'Na rede de 15 ensaios, a interferencial teve SMD −0,96, com certeza baixa. No ensaio de 150 pacientes, interferencial e TENS foram equivalentes e ambas melhores que nenhum tratamento. Em aplicação única, todas as correntes aliviaram mais que placebo, com destaque para 4 kHz a 100 Hz.',
    faixas: [
      { rotulo: 'Eletrodos nos ensaios', valor: '4 eletrodos de 5 × 5 cm (tetrapolar)', fontes: ['facci2011'] },
    ],
    ressalvas: ['O ensaio de 150 pacientes não teve placebo (controle sem tratamento).'],
    exemplos: [
      { titulo: 'Facci 2011', params: { portadoraHz: 4000, amfHz: 20, duracaoMin: 30, sessoes: 10 }, nota: 'ΔF de 10 Hz, tetrapolar, 10 sessões em 2 semanas, intensidade forte e confortável.', fontes: ['facci2011'] },
      { titulo: 'Dias 2021 (aplicação única)', params: { portadoraHz: 4000, amfHz: 100, duracaoMin: 30, sessoes: 1 }, fontes: ['dias2021'] },
    ],
    fontes: ['wang2025', 'facci2011', 'dias2021'],
  },
  {
    id: 'lombar_aguda',
    nome: 'Lombalgia aguda',
    resumo: 'Com parâmetros padronizados, a melhor incapacidade veio da posição “nervo espinal” dos eletrodos. Em outro ensaio, associar manipulação e interferencial não mudou o resultado.',
    faixas: [
      { rotulo: 'Parâmetros', valor: '3,85 kHz; 140 Hz constante; pulso de 130 µs; 30 min', fontes: ['hurley2001'] },
    ],
    exemplos: [{ titulo: 'Hurley 2001', params: { portadoraHz: 3850, amfHz: 140, duracaoMin: 30 }, fontes: ['hurley2001'] }],
    fontes: ['hurley2001'],
  },
  {
    id: 'joelho_oa',
    nome: 'Osteoartrite de joelho',
    resumo: 'A meta-análise de 10 ensaios (493 pacientes) viu alívio de dor de curto prazo (SMD −0,64) e de longo prazo (−0,36). Em um ensaio de 144 pacientes, a diferença ficou abaixo da mínima clinicamente importante e desapareceu na 6ª semana. Entre portadoras de 2, 4 e 8 kHz, nenhuma foi superior.',
    faixas: [
      { rotulo: 'Parâmetros nos ensaios', valor: '2, 4 ou 8 kHz, 100 Hz, 20 min por dia, 5 dias por semana, 3 semanas', fontes: ['ata2024', 'varapirom2024'] },
      { rotulo: 'Intensidade', valor: 'aumentar até sentir formigamento sob os eletrodos, sem dor; eletrodos de 5 × 5 cm', fontes: ['ata2024'] },
    ],
    ressalvas: ['A meta-análise pede ensaios maiores e de melhor qualidade para padronizar o tratamento.'],
    exemplos: [{ titulo: 'Ata 2024', params: { portadoraHz: 4000, amfHz: 100, duracaoMin: 20, sessoes: 15 }, nota: '15 sessões em 3 semanas, com exercício domiciliar.', fontes: ['ata2024'] }],
    fontes: ['chen2022', 'ata2024', 'varapirom2024'],
  },
  {
    id: 'pos_operatorio',
    nome: 'Dor pós-operatória',
    resumo: 'Os dois ensaios discordam: após esternotomia (200 pacientes), a interferencial reduziu a dor contra placebo (diferença ajustada −8,3); após artroplastia de joelho, não houve diferença em dor, amplitude e edema.',
    faixas: [
      { rotulo: 'Esternotomia', valor: '4 kHz; 10–20 mA; 18 min; 6 sessões em 21 dias; formigamento no limiar sensitivo', fontes: ['schulz2025'] },
    ],
    ressalvas: ['O ensaio de esternotomia foi de centro único e todos os pacientes tinham fios de cerclagem no esterno.'],
    exemplos: [{ titulo: 'Schulz 2025 (esternotomia)', params: { portadoraHz: 4000, correnteMa: 15, duracaoMin: 18, sessoes: 6 }, nota: '10–20 mA; 2 vezes por semana.', fontes: ['schulz2025'] }],
    fontes: ['schulz2025', 'kadi2019'],
  },
];
