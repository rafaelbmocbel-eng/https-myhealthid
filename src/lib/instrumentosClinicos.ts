// Instrumentos clínicos validados (versões em português) + motor adaptativo.
// O MyID é o triador: cada instrumento só é recomendado quando a dimensão
// correspondente indica necessidade — nada de bateria fixa duplicando perguntas.
// Escores e classificações seguem os pontos de corte da literatura.

export type InstrumentoId = 'parq' | 'psfs' | 'sbst' | 'isi' | 'phq4';

export interface PerguntaInstrumento {
  id: string;
  texto: string;
  opcoes: { valor: number; rotulo: string }[];
}

export interface Instrumento {
  id: InstrumentoId;
  nome: string;
  sigla: string;
  descricao: string;
  tempoEstimado: string;
  perguntas: PerguntaInstrumento[];
  /** PSFS usa atividades livres em vez de perguntas fechadas */
  atividadesLivres?: boolean;
  pontuar: (respostas: Record<string, number>) => { escore: number; classificacao: string };
}

const SIM_NAO = [
  { valor: 1, rotulo: 'Sim' },
  { valor: 0, rotulo: 'Não' },
];

const CONCORDO = [
  { valor: 1, rotulo: 'Concordo' },
  { valor: 0, rotulo: 'Discordo' },
];

const FREQ_0_3 = [
  { valor: 0, rotulo: 'Nenhum dia' },
  { valor: 1, rotulo: 'Vários dias' },
  { valor: 2, rotulo: 'Mais da metade dos dias' },
  { valor: 3, rotulo: 'Quase todos os dias' },
];

export const INSTRUMENTOS: Record<InstrumentoId, Instrumento> = {
  parq: {
    id: 'parq',
    nome: 'Prontidão para Atividade Física',
    sigla: 'PAR-Q+',
    descricao: 'Sete perguntas de segurança antes de começar ou intensificar exercícios.',
    tempoEstimado: '1 min',
    perguntas: [
      { id: 'q1', texto: 'Algum médico já disse que você tem um problema de coração OU pressão alta?', opcoes: SIM_NAO },
      { id: 'q2', texto: 'Você sente dor no peito em repouso, nas atividades do dia a dia ou quando faz atividade física?', opcoes: SIM_NAO },
      { id: 'q3', texto: 'Você perde o equilíbrio por tontura OU perdeu a consciência nos últimos 12 meses?', opcoes: SIM_NAO },
      { id: 'q4', texto: 'Você já foi diagnosticado com alguma outra condição crônica de saúde (além de coração ou pressão)?', opcoes: SIM_NAO },
      { id: 'q5', texto: 'Você toma atualmente medicamentos receitados para alguma condição crônica?', opcoes: SIM_NAO },
      { id: 'q6', texto: 'Você tem (ou teve nos últimos 12 meses) algum problema em osso, articulação ou músculo que possa piorar com atividade física?', opcoes: SIM_NAO },
      { id: 'q7', texto: 'Algum médico já disse que você só deve fazer atividade física com supervisão médica?', opcoes: SIM_NAO },
    ],
    pontuar: (r) => {
      const sims = Object.values(r).reduce((s, v) => s + (v || 0), 0);
      return sims === 0
        ? { escore: 0, classificacao: 'liberado' }
        : { escore: sims, classificacao: 'requer_atencao' };
    },
  },

  psfs: {
    id: 'psfs',
    nome: 'Escala Funcional Específica do Paciente',
    sigla: 'PSFS',
    descricao: 'Escolha 3 atividades importantes para você que estão difíceis de fazer e dê uma nota de 0 (incapaz) a 10 (consigo como antes).',
    tempoEstimado: '2 min',
    atividadesLivres: true,
    perguntas: [],
    pontuar: (r) => {
      const notas = ['a1', 'a2', 'a3'].map(k => r[k]).filter(v => typeof v === 'number');
      const media = notas.length ? notas.reduce((s, v) => s + v, 0) / notas.length : 0;
      const escore = Math.round(media * 10) / 10;
      const classificacao = escore >= 7 ? 'boa_funcao' : escore >= 4 ? 'funcao_moderada' : 'funcao_reduzida';
      return { escore, classificacao };
    },
  },

  sbst: {
    id: 'sbst',
    nome: 'START Back — risco da dor',
    sigla: 'SBST',
    descricao: 'Nove perguntas sobre como a dor afetou você nas últimas 2 semanas.',
    tempoEstimado: '2 min',
    perguntas: [
      { id: 'q1', texto: 'Minha dor se espalhou pela(s) perna(s) nas últimas 2 semanas.', opcoes: CONCORDO },
      { id: 'q2', texto: 'Eu tive dor no ombro ou no pescoço em algum momento nas últimas 2 semanas.', opcoes: CONCORDO },
      { id: 'q3', texto: 'Eu só caminhei distâncias curtas por causa da minha dor.', opcoes: CONCORDO },
      { id: 'q4', texto: 'Nas últimas 2 semanas, me vesti mais devagar do que o normal por causa da dor.', opcoes: CONCORDO },
      { id: 'q5', texto: 'Não é seguro uma pessoa com a minha condição ser fisicamente ativa.', opcoes: CONCORDO },
      { id: 'q6', texto: 'Preocupações passaram pela minha cabeça na maior parte do tempo.', opcoes: CONCORDO },
      { id: 'q7', texto: 'Sinto que minha dor é terrível e que nunca vai melhorar.', opcoes: CONCORDO },
      { id: 'q8', texto: 'Em geral, deixei de gostar de coisas que eu costumava gostar.', opcoes: CONCORDO },
      {
        id: 'q9', texto: 'De modo geral, quanto a sua dor te incomodou nas últimas 2 semanas?',
        opcoes: [
          { valor: 0, rotulo: 'Nada' }, { valor: 0, rotulo: 'Pouco' }, { valor: 0, rotulo: 'Moderado' },
          { valor: 1, rotulo: 'Muito' }, { valor: 1, rotulo: 'Extremamente' },
        ],
      },
    ],
    pontuar: (r) => {
      const total = ['q1','q2','q3','q4','q5','q6','q7','q8','q9'].reduce((s, k) => s + (r[k] || 0), 0);
      if (total <= 3) return { escore: total, classificacao: 'baixo_risco' };
      const psicossocial = ['q5','q6','q7','q8','q9'].reduce((s, k) => s + (r[k] || 0), 0);
      return { escore: total, classificacao: psicossocial >= 4 ? 'alto_risco' : 'medio_risco' };
    },
  },

  isi: {
    id: 'isi',
    nome: 'Índice de Gravidade de Insônia',
    sigla: 'ISI',
    descricao: 'Sete perguntas sobre o seu sono nas últimas 2 semanas.',
    tempoEstimado: '2 min',
    perguntas: [
      { id: 'q1', texto: 'Dificuldade para pegar no sono:', opcoes: [
        { valor: 0, rotulo: 'Nenhuma' }, { valor: 1, rotulo: 'Leve' }, { valor: 2, rotulo: 'Moderada' },
        { valor: 3, rotulo: 'Grave' }, { valor: 4, rotulo: 'Muito grave' } ] },
      { id: 'q2', texto: 'Dificuldade para manter o sono (acordar no meio da noite):', opcoes: [
        { valor: 0, rotulo: 'Nenhuma' }, { valor: 1, rotulo: 'Leve' }, { valor: 2, rotulo: 'Moderada' },
        { valor: 3, rotulo: 'Grave' }, { valor: 4, rotulo: 'Muito grave' } ] },
      { id: 'q3', texto: 'Acordar muito cedo sem conseguir voltar a dormir:', opcoes: [
        { valor: 0, rotulo: 'Nenhuma' }, { valor: 1, rotulo: 'Leve' }, { valor: 2, rotulo: 'Moderada' },
        { valor: 3, rotulo: 'Grave' }, { valor: 4, rotulo: 'Muito grave' } ] },
      { id: 'q4', texto: 'Quão satisfeito(a) você está com o seu sono atual?', opcoes: [
        { valor: 0, rotulo: 'Muito satisfeito' }, { valor: 1, rotulo: 'Satisfeito' }, { valor: 2, rotulo: 'Neutro' },
        { valor: 3, rotulo: 'Insatisfeito' }, { valor: 4, rotulo: 'Muito insatisfeito' } ] },
      { id: 'q5', texto: 'Quanto o seu problema de sono interfere no seu dia a dia (cansaço, humor, concentração)?', opcoes: [
        { valor: 0, rotulo: 'Nada' }, { valor: 1, rotulo: 'Um pouco' }, { valor: 2, rotulo: 'Moderadamente' },
        { valor: 3, rotulo: 'Muito' }, { valor: 4, rotulo: 'Extremamente' } ] },
      { id: 'q6', texto: 'Quanto você acha que os outros percebem que seu sono prejudica sua qualidade de vida?', opcoes: [
        { valor: 0, rotulo: 'Nada' }, { valor: 1, rotulo: 'Um pouco' }, { valor: 2, rotulo: 'Moderadamente' },
        { valor: 3, rotulo: 'Muito' }, { valor: 4, rotulo: 'Extremamente' } ] },
      { id: 'q7', texto: 'Quão preocupado(a) você está com o seu problema de sono atual?', opcoes: [
        { valor: 0, rotulo: 'Nada' }, { valor: 1, rotulo: 'Um pouco' }, { valor: 2, rotulo: 'Moderadamente' },
        { valor: 3, rotulo: 'Muito' }, { valor: 4, rotulo: 'Extremamente' } ] },
    ],
    pontuar: (r) => {
      const total = ['q1','q2','q3','q4','q5','q6','q7'].reduce((s, k) => s + (r[k] || 0), 0);
      const classificacao = total <= 7 ? 'sem_insonia' : total <= 14 ? 'insonia_subliminar'
        : total <= 21 ? 'insonia_moderada' : 'insonia_grave';
      return { escore: total, classificacao };
    },
  },

  phq4: {
    id: 'phq4',
    nome: 'Bem-estar emocional',
    sigla: 'PHQ-4',
    descricao: 'Quatro perguntas rápidas sobre como você se sentiu nas últimas 2 semanas.',
    tempoEstimado: '1 min',
    perguntas: [
      { id: 'q1', texto: 'Pouco interesse ou prazer em fazer as coisas.', opcoes: FREQ_0_3 },
      { id: 'q2', texto: 'Sentir-se para baixo, deprimido(a) ou sem esperança.', opcoes: FREQ_0_3 },
      { id: 'q3', texto: 'Sentir-se nervoso(a), ansioso(a) ou muito tenso(a).', opcoes: FREQ_0_3 },
      { id: 'q4', texto: 'Não conseguir parar ou controlar as preocupações.', opcoes: FREQ_0_3 },
    ],
    pontuar: (r) => {
      const total = ['q1','q2','q3','q4'].reduce((s, k) => s + (r[k] || 0), 0);
      const classificacao = total <= 2 ? 'normal' : total <= 5 ? 'leve' : total <= 8 ? 'moderado' : 'grave';
      return { escore: total, classificacao };
    },
  },
};

export const CLASSIFICACAO_LABEL: Record<string, string> = {
  liberado: 'Liberado para exercício',
  requer_atencao: 'Requer atenção antes do treino',
  boa_funcao: 'Boa função nas atividades',
  funcao_moderada: 'Função moderada',
  funcao_reduzida: 'Função reduzida',
  baixo_risco: 'Baixo risco',
  medio_risco: 'Médio risco',
  alto_risco: 'Alto risco',
  sem_insonia: 'Sem insônia significativa',
  insonia_subliminar: 'Insônia leve',
  insonia_moderada: 'Insônia moderada',
  insonia_grave: 'Insônia grave',
  normal: 'Dentro do esperado',
  leve: 'Sintomas leves',
  moderado: 'Sintomas moderados',
  grave: 'Sintomas graves',
};

// ── Motor adaptativo: o MyID decide quais instrumentos pedir ────────────────
// Semântica dos scores (0-10): D/P/I/N altos = pior; R/AF/ERG/HID/NUT/C/EFI
// baixos = pior (mesma regra de gerar-dicas-paciente).
export function instrumentosRecomendados(scores: Record<string, number> | null): InstrumentoId[] {
  const lista: InstrumentoId[] = ['parq', 'psfs']; // núcleo premium: segurança + metas
  if (!scores) return lista;
  const n = (k: string) => Number(scores[k]);
  if (!Number.isNaN(n('D')) && n('D') >= 6) lista.push('sbst');
  if (!Number.isNaN(n('R')) && n('R') <= 5) lista.push('isi');
  if (!Number.isNaN(n('P')) && n('P') >= 6) lista.push('phq4');
  return lista;
}

export const MOTIVO_RECOMENDACAO: Record<InstrumentoId, string> = {
  parq: 'Segurança antes de qualquer treino',
  psfs: 'Define as SUAS metas para o plano',
  sbst: 'Seu MyID indicou dor relevante — isto calibra a conduta',
  isi: 'Seu MyID indicou sono prejudicado — isto aprofunda a avaliação',
  phq4: 'Seu MyID indicou sobrecarga emocional — isto ajuda a cuidar de você',
};
