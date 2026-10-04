import type { JanelaLaser } from './calculos';

// Faixas de dose por condição, uma a uma com a fonte (ids de referencias.ts).
// REGRA: só entra número que apareceu no resumo/texto do artigo. Onde a
// pesquisa não encontrou dose, a condição aparece como "sem dose confirmada" —
// a calculadora continua servindo para registrar o que você aplicou.
// Estado: em validação clínica pelo profissional responsável.

export const AVISO_VALIDACAO =
  'Parâmetros em validação clínica. As faixas vêm de ensaios e revisões (PubMed) e orientam, não substituem o seu raciocínio clínico nem o manual do aparelho.';

// ───────────────────────────────── Laser ─────────────────────────────────────

export interface CondicaoLaser {
  id: string;
  nome: string;
  resumo: string;
  janelas: JanelaLaser[];
  /** Dica de pontos e frequência de sessões, quando a fonte traz. */
  aplicacao?: string[];
  /** true quando nenhuma dose por ponto foi confirmada. */
  semDose?: boolean;
  fontes: string[];
}

const MIN_TENDINOPATIA: JanelaLaser[] = [
  { faixa: '904', minJ: 2, fontes: ['naterstad2022'], nota: 'Mínimo por ponto, 904 nm.' },
  { faixa: '780-860', minJ: 4, fontes: ['naterstad2022'], nota: 'Mínimo por ponto, 780–860 nm.' },
];

export const CONDICOES_LASER: CondicaoLaser[] = [
  {
    id: 'tendinopatia_membro_inferior',
    nome: 'Tendinopatia do Aquiles ou patelar',
    resumo: 'Com as doses recomendadas, a dor caiu 14,98 mm na EVA contra placebo ao fim do tratamento; com dose não recomendada (um ensaio), não houve redução significativa.',
    janelas: MIN_TENDINOPATIA,
    aplicacao: [
      'A dose é POR PONTO, e não por área: irradiar no mínimo 2–3 pontos sobre o tendão.',
      'Nos ensaios: 10 a 24 sessões ao longo de 2 a 8 semanas.',
      'Mover a ponteira durante a irradiação reduz a dose por cm tratado.',
    ],
    fontes: ['naterstad2022', 'tumilty2010'],
  },
  {
    id: 'fascite_plantar',
    nome: 'Fascite plantar',
    resumo: 'Mesmos mínimos da tendinopatia. A pele da planta é espessa e absorve uma grande parte do laser.',
    janelas: MIN_TENDINOPATIA,
    aplicacao: [
      'Irradiar no mínimo 2–3 pontos sobre a fáscia (dose por ponto).',
      'Nos ensaios: 10 a 18 sessões ao longo de 3 a 6 semanas.',
    ],
    fontes: ['naterstad2022'],
  },
  {
    id: 'osteoartrite_joelho',
    nome: 'Osteoartrite de joelho',
    resumo: 'Com as doses recomendadas, a dor caiu 18,71 mm na EVA contra placebo no fim do tratamento (doses não recomendadas: 6,34 mm). Há indício de um limite superior de eficácia.',
    janelas: [
      { faixa: '780-860', minJ: 4, maxJ: 8, sugeridaJ: 6, fontes: ['stausholm2019'], nota: 'Faixa estudada 4–8 J por ponto; mediana 6 J. Potência média de 5 a 500 mW.' },
      { faixa: '904', minJ: 1, maxJ: 3, sugeridaJ: 3, fontes: ['stausholm2019'], nota: 'Faixa estudada 1–3 J por ponto; mediana 3 J. Potência média de 5 a 500 mW com pico acima de 1000 mW.' },
    ],
    aplicacao: [
      'Irradiar a linha articular e a sinóvia (dose por ponto).',
      'Duração média do tratamento nos ensaios com dose recomendada: 3,5 semanas.',
      'Em 904 nm contínuo, a recomendação é 4× a dose do superpulsado.',
    ],
    fontes: ['stausholm2019', 'naterstad2022'],
  },
  {
    id: 'desempenho_muscular',
    nome: 'Desempenho e recuperação muscular (antes do exercício)',
    resumo: 'Em 13 ensaios, os resultados mais consistentes vieram com luz vermelha ou infravermelha, aplicada ANTES do exercício, com 50–200 mW e 5 a 6 J por ponto.',
    janelas: [
      { faixa: 'qualquer', minJ: 5, maxJ: 6, semFatorContinuo: true, fontes: ['leal2015'], nota: 'Luz vermelha ou infravermelha; doses de 5 e 6 J por ponto.' },
    ],
    aplicacao: ['Potência de 50 a 200 mW; aplicar antes do exercício.'],
    fontes: ['leal2015'],
  },
  {
    id: 'cervical',
    nome: 'Dor cervical',
    resumo: 'Redução de 19,86 mm na EVA (11 ensaios). O resumo não traz dose por ponto, por isso não há faixa para comparar.',
    janelas: [], semDose: true, fontes: ['chow2009'],
  },
  {
    id: 'ombro',
    nome: 'Ombro (manguito / impacto)',
    resumo: 'Ensaios com dose inadequada foram ineficazes em todos os desfechos. O valor da dose adequada não está no resumo.',
    janelas: [], semDose: true, fontes: ['haslerud2015'],
  },
  {
    id: 'epicondilite_lateral',
    nome: 'Epicondilite lateral',
    resumo: 'Preensão +9,59 kg nos ensaios de melhor qualidade. Sem J por ponto confirmado nas fontes lidas.',
    janelas: [], semDose: true, fontes: ['tumilty2010'],
  },
  {
    id: 'lombar_carpo_atm',
    nome: 'Dor lombar, túnel do carpo, ATM e dor miofascial',
    resumo: 'Evidência conflitante ou sem dose numérica nas fontes lidas (lombar: duas revisões discordam; túnel do carpo: revisões divergem). Use o protocolo do fabricante e registre o que aplicou.',
    janelas: [], semDose: true, fontes: [],
  },
];

// ───────────────────────────────── Ultrassom ─────────────────────────────────

export type NivelEvidencia = 'um_ensaio' | 'baixa' | 'ambigua' | 'sem_dose';

export interface CondicaoUS {
  id: string;
  nome: string;
  resumo: string;
  sugestao?: { freqMhz?: 1 | 3; sata?: number; modo?: 'continuo' | 'pulsado'; tempoMin?: number; sessoes?: string; nota?: string };
  evidencia: NivelEvidencia;
  fontes: string[];
}

export const NIVEL_EVIDENCIA_ROTULO: Record<NivelEvidencia, string> = {
  um_ensaio: 'Um ensaio isolado',
  baixa: 'Evidência de baixa qualidade',
  ambigua: 'Resumo ambíguo',
  sem_dose: 'Sem dose confirmada',
};

export const CONDICOES_US: CondicaoUS[] = [
  {
    id: 'aquecimento',
    nome: 'Objetivo térmico (aquecer o tecido)',
    resumo: 'Não há dose única “certa”: a calculadora estima o aquecimento a partir das taxas medidas por Draper em adultos saudáveis (ultrassom contínuo). Pulsado e atérmico não têm estimativa.',
    evidencia: 'baixa', fontes: ['draper1995', 'draper1995b', 'draper2010', 'rigby2015'],
  },
  {
    id: 'calcarea_ombro',
    nome: 'Tendinite calcária do ombro',
    resumo: 'Redução da calcificação de 10,92% contra 5,04% no placebo, junto com exercícios (46 pacientes).',
    sugestao: { freqMhz: 1, sata: 1.5, tempoMin: 10, sessoes: '4 semanas, com exercícios', nota: '4500 J por sessão; modo não declarado no resumo.' },
    evidencia: 'um_ensaio', fontes: ['cota2023'],
  },
  {
    id: 'atm_muscular',
    nome: 'Dor muscular da ATM',
    resumo: 'Maior redução de dor e de abertura bucal que a medicação a curto prazo (36 pacientes).',
    sugestao: { freqMhz: 1, sata: 1.0, modo: 'continuo', tempoMin: 10, sessoes: '1 vez por dia, 7 dias' },
    evidencia: 'um_ensaio', fontes: ['subhikshaa2026'],
  },
  {
    id: 'osteoartrite_joelho',
    nome: 'Osteoartrite de joelho',
    resumo: 'Em 21 ensaios, o ultrassom pulsado com intensidade ≤ 2,5 W/cm² e 24 sessões teve melhor alívio da dor. O resumo é ambíguo quanto à duração do tratamento.',
    sugestao: { modo: 'pulsado', sessoes: '24 sessões', nota: 'Intensidade ≤ 2,5 W/cm².' },
    evidencia: 'ambigua', fontes: ['luo2024'],
  },
  {
    id: 'tunel_carpo',
    nome: 'Síndrome do túnel do carpo',
    resumo: 'Só evidência de baixa qualidade a favor do ultrassom contra placebo; não há regime preferível nem vantagem sobre órtese ou exercícios.',
    evidencia: 'sem_dose', fontes: ['page2013'],
  },
  {
    id: 'cervical',
    nome: 'Dor cervical',
    resumo: 'Pode reduzir a dor mais que placebo ou nada, mas o benefício adicional ao tratamento habitual é incerto. Sem parâmetros no resumo.',
    evidencia: 'sem_dose', fontes: ['qing2021'],
  },
  {
    id: 'geral',
    nome: 'Outras condições (tendinopatias, lesão muscular, miofascial…)',
    resumo: 'A revisão de ensaios encontrou pouca evidência de que o ultrassom ativo supere o placebo, e as doses variavam sem motivo claro. Registre o que aplicou para acompanhar a resposta.',
    evidencia: 'sem_dose', fontes: ['robertson2001'],
  },
];

// ───────────────────────────── Ondas de choque ───────────────────────────────

export interface SugestaoESWT {
  tipo: 'focal' | 'radial';
  efd?: number;
  efdFaixa?: [number, number];
  impulsos?: number;
  hz?: number;
  sessoes?: number;
  intervalo?: string;
  nota?: string;
  fontes: string[];
}

export interface CondicaoESWT {
  id: string;
  nome: string;
  resumo: string;
  sugestoes: SugestaoESWT[];
  fontes: string[];
}

export const CONDICOES_ESWT: CondicaoESWT[] = [
  {
    id: 'protocolo_geral',
    nome: 'Protocolo geral (qualquer indicação)',
    resumo: 'Nos ensaios, a média da EFD foi 0,19 mJ/mm² (0,03 a 0,78), com média de 2029 impulsos por sessão e 2,9 sessões. O limite “baixa × alta energia” de 0,2 mJ/mm² é arbitrário. Anestesia local piora o resultado.',
    sugestoes: [{ tipo: 'focal', impulsos: 2000, sessoes: 3, intervalo: '1 semana', nota: 'Maior EFD que o paciente tolerar, sem anestesia local.', fontes: ['schmitz2015'] }],
    fontes: ['schmitz2015'],
  },
  {
    id: 'fascite_plantar',
    nome: 'Fascite plantar',
    resumo: 'EFD média 0,19 mJ/mm² nos ensaios positivos (0,08 nos negativos). Só dor e edema passageiros como efeito do aparelho.',
    sugestoes: [
      { tipo: 'radial', efd: 0.16, impulsos: 2000, sessoes: 3, nota: 'Intervalo entre sessões não informado no resumo.', fontes: ['gerdesmeyer2008'] },
      { tipo: 'focal', efd: 0.25, impulsos: 2000, sessoes: 3, intervalo: '1 semana', fontes: ['gollwitzer2015'] },
    ],
    fontes: ['schmitz2015', 'gerdesmeyer2008', 'gollwitzer2015'],
  },
  {
    id: 'epicondilite_lateral',
    nome: 'Epicondilite lateral',
    resumo: 'Baixa energia, semanal por 3 semanas, com acompanhamento de até 52 semanas no ensaio original.',
    sugestoes: [{ tipo: 'focal', efd: 0.08, impulsos: 1000, sessoes: 3, intervalo: '1 semana', nota: 'Total de 3000 impulsos (3 × 1000).', fontes: ['rompe1998', 'rompe2004'] }],
    fontes: ['rompe1998', 'rompe2004'],
  },
  {
    id: 'ombro_calcificante',
    nome: 'Ombro com calcificação',
    resumo: 'Alta energia foi superior à baixa. A revisão Cochrane define alta dose como 0,2 a 0,4 mJ/mm² ou mais, vê poucos benefícios clínicos importantes e mais eventos adversos que placebo (RR 3,61, certeza baixa).',
    sugestoes: [{ tipo: 'focal', efd: 0.28, sessoes: 2, intervalo: 'cerca de 2 semanas', nota: '0,28 mJ/mm² é a média dos ensaios positivos. Impulsos e frequência não constam nos resumos.', fontes: ['gerdesmeyer2003', 'schmitz2015', 'surace2020'] }],
    fontes: ['gerdesmeyer2003', 'schmitz2015', 'surace2020'],
  },
  {
    id: 'aquiles',
    nome: 'Tendinopatia do Aquiles',
    resumo: 'Baixa energia repetida. EFD média de 0,17 mJ/mm² nos ensaios positivos contra 0,06 no negativo. Impulsos e sessões não constam nos resumos lidos.',
    sugestoes: [{ tipo: 'focal', efd: 0.17, nota: 'Média dos ensaios positivos (± 0,04). Em idosos com onda focal, há relato raro de ruptura do Aquiles.', fontes: ['schmitz2015', 'reilly2018'] }],
    fontes: ['schmitz2015', 'reilly2018'],
  },
  {
    id: 'patelar',
    nome: 'Tendinopatia patelar',
    resumo: 'Quatro sessões semanais em um ensaio; as revisões são conflitantes e a relação dose-resposta não está definida.',
    sugestoes: [{ tipo: 'focal', sessoes: 4, intervalo: '1 semana', nota: 'EFD e impulsos não constam no resumo.', fontes: ['katolicky2025'] }],
    fontes: ['katolicky2025'],
  },
  {
    id: 'trocanterica',
    nome: 'Dor trocantérica (síndrome dolorosa do trocânter maior)',
    resumo: 'Três sessões semanais de 2000 impulsos a 4 Hz, com EFD de 0,03 a 0,17 mJ/mm².',
    sugestoes: [{ tipo: 'focal', efdFaixa: [0.03, 0.17], impulsos: 2000, hz: 4, sessoes: 3, intervalo: '1 semana', fontes: ['notarnicola2023'] }],
    fontes: ['notarnicola2023'],
  },
  {
    id: 'estresse_tibial',
    nome: 'Síndrome do estresse tibial medial',
    resumo: 'Cinco sessões em 9 semanas junto com corrida, em estudo observacional. Revisões apontam risco de viés em todos os estudos.',
    sugestoes: [{ tipo: 'focal', sessoes: 5, intervalo: '5 sessões em 9 semanas', nota: 'EFD e impulsos não constam no resumo.', fontes: ['moen2011'] }],
    fontes: ['moen2011'],
  },
  {
    id: 'pontos_gatilho',
    nome: 'Pontos-gatilho do trapézio',
    resumo: 'Piloto com 60 pacientes. Um único ensaio com dose completa.',
    sugestoes: [{ tipo: 'radial', efd: 0.1, impulsos: 2000, sessoes: 3, intervalo: '1 semana', nota: 'EFD positiva de 0,10 mJ/mm².', fontes: ['suputtitada2022'] }],
    fontes: ['suputtitada2022'],
  },
  {
    id: 'espasticidade',
    nome: 'Espasticidade pós-AVC',
    resumo: 'Na meta-análise, a onda radial foi melhor que a focal e o efeito foi maior com frequência abaixo de 8 Hz e pressão abaixo de 2 bar. Impulsos e número de sessões não constam no resumo.',
    sugestoes: [{ tipo: 'radial', nota: 'Frequência < 8 Hz e pressão < 2 bar.', fontes: ['liu2025'] }],
    fontes: ['liu2025'],
  },
  {
    id: 'pseudoartrose',
    nome: 'Pseudoartrose de ossos longos',
    resumo: 'Doses altas (0,40 e 0,70 mJ/mm²) com 4000 impulsos. O intervalo e a frequência não constam no resumo.',
    sugestoes: [{ tipo: 'focal', efdFaixa: [0.4, 0.7], impulsos: 4000, sessoes: 4, nota: 'Grupos com 0,40 e com 0,70 mJ/mm².', fontes: ['cacchio2009'] }],
    fontes: ['cacchio2009'],
  },
];
