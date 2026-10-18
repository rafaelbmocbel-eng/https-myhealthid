import type { ResultadoMetrica } from './tipos';

/*
 * Valores de referência biomecânica.
 *
 * Regra desta tabela: só entra faixa com fonte verificada (autor, ano, periódico e PMID) e com o número lido no próprio
 * texto indexado no PubMed (resumo ou texto completo aberto). Cada referência guarda o trecho original em `fonte.trecho`
 * para conferência. O que não foi confirmado fica como 'sem_referencia' e NÃO classifica o resultado. Nenhum limite é calculado
 * ou arredondado a partir de outros números. Se for incluir uma referência nova, confira o número na fonte e copie o trecho.
 */

export type EstatutoReferencia = 'confirmada' | 'sem_referencia';

/**
 *  - faixa_de_medias: o menor e o maior valor entre as médias dos grupos (sexo × faixa etária) do estudo; NÃO é intervalo de
 *    previsão individual, então um valor fora não indica problema por si só;
 *  - limiar_heuristico: ponto de corte prático ligado a um desfecho (ex.: intensidade), não uma faixa de normalidade.
 */
export type TipoReferencia = 'faixa_de_medias' | 'limiar_heuristico';

export interface FonteReferencia {
  /** Autor, ano, periódico (volume, páginas). */
  citacao: string;
  /** Forma curta para o cartão, por exemplo "Bohannon, 1997". */
  rotulo?: string;
  pmid?: string;
  doi?: string;
  /** Trecho original (em inglês) do texto de onde o número foi lido. */
  trecho?: string;
}

export interface ContextoLiteratura {
  /** O que a fonte relata, em português. */
  texto: string;
  fonte: FonteReferencia;
}

export interface ReferenciaBiomecanica {
  chave: string;
  /** Chave da métrica (ResultadoMetrica.metrica). */
  metrica: string;
  populacao: string;
  faixa: { min?: number; max?: number };
  fonte: FonteReferencia;
  estatuto: EstatutoReferencia;
  unidade: string;
  tipo?: TipoReferencia;
  /** Gestos a que a referência se aplica (ids de MODELOS_GESTO); vazio = a todos que usam a métrica. */
  aplicaA?: string[];
  /** Ressalva que deve aparecer junto do valor. */
  nota?: string;
  /** Na 'sem_referencia': o que a literatura verificada relata, sem virar faixa de classificação. */
  contexto?: ContextoLiteratura[];
}

export const AVISO_REFERENCIAS =
  'Os valores de referência vêm de estudos com outras populações e outros métodos de medida (marcadores 3D, sensores, passarela instrumentada). A pose estimada em vídeo comum tem erro maior: use a comparação como orientação, nunca como diagnóstico.';

const BOHANNON_1997: FonteReferencia = {
  citacao: 'Bohannon RW. Comfortable and maximum walking speed of adults aged 20-79 years: reference values and determinants. Age Ageing. 1997;26(1):15-19.',
  rotulo: 'Bohannon, 1997',
  pmid: '9143432',
  doi: '10.1093/ageing/26.1.15',
  trecho: 'mean comfortable gait speed ranged from 127.2 cm/s for women in their seventies to 146.2 cm/s for men in their forties.',
};

const BOHANNON_ANDREWS_2011: FonteReferencia = {
  citacao: 'Bohannon RW, Williams Andrews A. Normal walking speed: a descriptive meta-analysis. Physiotherapy. 2011;97(3):182-189.',
  rotulo: 'Bohannon e Andrews, 2011',
  pmid: '21820535',
  doi: '10.1016/j.physio.2010.12.004',
  trecho: 'The gait speed was homogeneous within strata and ranged from a mean of 143.4 cm/second for men aged 40 to 49 years to a mean of 94.3 cm/second for women aged 80 to 99 years.',
};

const TUDOR_LOCKE_2018: FonteReferencia = {
  citacao: 'Tudor-Locke C, Han H, Aguiar EJ, et al. How fast is fast enough? Walking cadence (steps/min) as a practical estimate of intensity in adults: a narrative review. Br J Sports Med. 2018;52(12):776-788.',
  rotulo: 'Tudor-Locke et al., 2018',
  pmid: '29858465',
  doi: '10.1136/bjsports-2017-097628',
  trecho: '≥100 steps/min is a consistent heuristic (e.g, evidence-based, rounded) value associated with absolutely defined moderate intensity (3 metabolic equivalents (METs)).',
};

const GALE_ANDERST_2020: FonteReferencia = {
  citacao: 'Gale T, Anderst W. Knee kinematics of healthy adults measured using biplane radiography. J Biomech Eng. 2020;142(10).',
  rotulo: 'Gale e Anderst, 2020',
  pmid: '32491153',
  doi: '10.1115/1.4047419',
  trecho: 'The average ROM during gait was 7.0 mm, 3.2 mm, and 2.9 mm in anterior/posterior (AP), medial/lateral (ML), and proximal/distal (PD) directions, and 67.3 deg, 11.5 deg, and 3.7 deg in flexion/extension (FE), internal/external (IE), and abduction/adduction (AbAd).',
};

const BOUTAAYAMOU_2025: FonteReferencia = {
  citacao: 'Boutaayamou M, Pelzer D, Schwartz C, et al. Toward convenient and accurate IMU-based gait analysis. Sensors (Basel). 2025;25(4):1267.',
  rotulo: 'Boutaayamou et al., 2025',
  pmid: '40006497',
  doi: '10.3390/s25041267',
  trecho: 'these changes include a decrease in DS% from 12.5% to 9.9% and in Sa% from 62.5% to 60.0%',
};

const LYTHGO_2011: FonteReferencia = {
  citacao: 'Lythgo N, Wilson C, Galea M. Basic gait and symmetry measures for primary school-aged children and young adults. II: walking at slow, free and fast speed. Gait Posture. 2011;33(1):29-35.',
  rotulo: 'Lythgo et al., 2011',
  pmid: '20971013',
  doi: '10.1016/j.gaitpost.2010.09.017',
  trecho: 'symmetry differentials for step and stance time, single and double support fell around 0.7%.',
};

const SOUZA_2016: FonteReferencia = {
  citacao: 'Souza RB. An evidence-based videotaped running biomechanics analysis. Phys Med Rehabil Clin N Am. 2016;27(1):217-236.',
  rotulo: 'Souza, 2016',
  pmid: '26616185',
  doi: '10.1016/j.pmr.2015.08.006',
};

const HEMMERICH_2006: FonteReferencia = {
  citacao: 'Hemmerich A, Brown H, Smith S, Marthandam SSK, Wyss UP. Hip, knee, and ankle kinematics of high range of motion activities of daily living. J Orthop Res. 2006;24(4):770-781.',
  rotulo: 'Hemmerich et al., 2006',
  pmid: '16514664',
  doi: '10.1002/jor.20114',
  trecho: 'A mean maximum flexion of 157 degrees +/- 6 degrees at the knee joint was required for squatting with heels up. Mean maximum hip flexion angles reached up to 95 degrees +/- 27 degrees for squatting with heels flat.',
};

const ORTIZ_2016: FonteReferencia = {
  citacao: 'Ortiz A, Rosario-Canales M, Rodriguez A, et al. Reliability and concurrent validity between two-dimensional and three-dimensional evaluations of knee valgus during drop jumps. Open Access J Sports Med. 2016;7:65-73.',
  rotulo: 'Ortiz et al., 2016',
  pmid: '27313480',
  doi: '10.2147/OAJSM.S100242',
  trecho: 'KASR and KSD showed excellent correlation (ICC: 0.96; 95% CI: 0.82-0.98 and ICC: 0.94; 95% CI: 0.90-0.96, respectively) with the 3D system, while both methods of frontal plane projection angle showed poor to moderate correlation (ICC: 0-0.57) with the 3D system.',
};

const SEM_FONTE: FonteReferencia = { citacao: 'Sem referência verificada' };

const semReferencia = (chave: string, metrica: string, unidade: string, contexto?: ContextoLiteratura[], aplicaA?: string[]): ReferenciaBiomecanica => ({
  chave, metrica, populacao: '', faixa: {}, fonte: SEM_FONTE, estatuto: 'sem_referencia', unidade,
  ...(aplicaA ? { aplicaA } : {}), ...(contexto ? { contexto } : {}),
});

export const REFERENCIAS: ReferenciaBiomecanica[] = [
  {
    chave: 'velocidade_marcha.bohannon1997', metrica: 'velocidade_marcha', unidade: 'cm/s',
    populacao: 'Adultos saudáveis de 20 a 79 anos (230 voluntários); velocidade confortável em 7,62 m.',
    faixa: { min: 127.2, max: 146.2 }, fonte: BOHANNON_1997, estatuto: 'confirmada', tipo: 'faixa_de_medias', aplicaA: ['marcha'],
    nota: 'Vai da menor à maior média entre os grupos por sexo e década (mulheres de 70 a 79 anos: 127,2; homens de 40 a 49 anos: 146,2). Não é intervalo individual.',
  },
  {
    chave: 'velocidade_marcha.bohannon2011', metrica: 'velocidade_marcha', unidade: 'cm/s',
    populacao: 'Adultos aparentemente saudáveis (metanálise de 41 artigos, 23.111 pessoas); ritmo habitual em 3 a 30 m.',
    faixa: { min: 94.3, max: 143.4 }, fonte: BOHANNON_ANDREWS_2011, estatuto: 'confirmada', tipo: 'faixa_de_medias', aplicaA: ['marcha'],
    nota: 'Vai da menor à maior média entre os grupos por sexo e década (mulheres de 80 a 99 anos: 94,3; homens de 40 a 49 anos: 143,4). Não é intervalo individual; inclui idosos. A metanálise incluiu adultos aparentemente saudáveis andando em ritmo habitual por percursos de 3 a 30 m. Os autores ressalvam que os dados podem não servir de padrão de normalidade se a velocidade for medida em distâncias curtas a partir do comando "vá", ou se houver curva. A velocidade estimada por vídeo costuma vir de um trecho curto; se ele começa com a pessoa parada ou inclui curva, a ressalva dos autores provavelmente se aplica.',
  },
  {
    chave: 'cadencia.tudor2018', metrica: 'cadencia', unidade: 'passos/min',
    populacao: 'Adultos; caminhada contínua e rítmica.',
    faixa: { min: 100 }, fonte: TUDOR_LOCKE_2018, estatuto: 'confirmada', tipo: 'limiar_heuristico', aplicaA: ['marcha'],
    nota: 'Limiar prático de intensidade moderada (3 METs), não faixa de normalidade: andar abaixo disso é comum e não indica alteração por si só.',
  },

  semReferencia('adm_joelho.marcha', 'adm_joelho', '°', [{
    texto: 'Em 39 joelhos saudáveis de adultos, medidos por radiografia biplanar na caminhada em esteira, a amplitude média de flexão/extensão foi de 67,3°. A medida é óssea e direta, diferente da pose estimada em vídeo, e o resumo não traz dispersão da amplitude: por isso não classifica.',
    fonte: GALE_ANDERST_2020,
  }], ['marcha']),
  semReferencia('apoio_pct.marcha', 'apoio_pct', '% do ciclo', [{
    texto: 'Em 101 adultos saudáveis de 40 a 65 anos (sensores nos calcanhares), a fase de apoio foi em média 62,5% do ciclo na caminhada preferida (60,0% na rápida). Os desvios-padrão ficam em tabelas que não foram verificadas aqui: por isso não classifica.',
    fonte: BOUTAAYAMOU_2025,
  }], ['marcha']),
  semReferencia('assimetria_tempo_passo.marcha', 'assimetria_tempo_passo', '%', [{
    texto: 'Em crianças de 5 a 13 anos e adultos jovens saudáveis (passarela instrumentada), as diferenças entre os lados nos tempos de passo e de apoio ficaram em torno de 0,7%. Em vídeo a 30 quadros/s um quadro vale cerca de 33 ms: a precisão do vídeo não chega a essa escala.',
    fonte: LYTHGO_2011,
  }], ['marcha']),
  semReferencia('assimetria_tempo_apoio.marcha', 'assimetria_tempo_apoio', '%', [{
    texto: 'Em crianças de 5 a 13 anos e adultos jovens saudáveis (passarela instrumentada), as diferenças entre os lados nos tempos de passo e de apoio ficaram em torno de 0,7%. Em vídeo a 30 quadros/s um quadro vale cerca de 33 ms: a precisão do vídeo não chega a essa escala.',
    fonte: LYTHGO_2011,
  }], ['marcha']),

  semReferencia('cadencia.corrida', 'cadencia', 'passos/min', [{
    texto: 'Sugere-se cerca de 180 passos/min como cadência ideal, mas a maior parte do suporte vem de estudos de economia de corrida, não de mecânica de lesão; a autora diz ser cedo para recomendar uma cadência única.',
    fonte: { ...SOUZA_2016, trecho: 'The optimal cadence has been an area of debate, with some suggesting that approximately 180 steps per minute being ideal. However, the majority of support for this comes from running economy studies, not studies on injury mechanics.' },
  }], ['corrida']),
  semReferencia('flexao_joelho_pico_apoio.corrida', 'flexao_joelho_pico_apoio', '°', [{
    texto: 'A autora descreve que o pico normal de flexão do joelho no apoio médio da corrida se aproxima de cerca de 45°, mas afirma que não há pontos de corte definidos para essa variável.',
    fonte: { ...SOUZA_2016, trecho: 'In general, normal peak knee flexion approaches approximately 45° at midstance [...]. Although explicit cutoffs have not been developed for this variable' },
  }], ['corrida']),
  semReferencia('tempo_contato.corrida', 'tempo_contato', 'ms', [{
    texto: 'Não há ponto de corte validado para a mecânica da corrida em vídeo 2D: segundo a revisão, os cortes para classificar a cinemática como anormal ou preditiva de lesão ainda não existem.',
    fonte: { ...SOUZA_2016, trecho: 'To date, cutoffs for kinematics to be identified as abnormal, or predictive of injury, do not exist.' },
  }], ['corrida']),

  semReferencia('flexao_joelho_max.agachamento', 'flexao_joelho_max', '°', [{
    texto: 'Em 30 adultos saudáveis indianos (48,2 ± 7,6 anos), o agachamento de grande amplitude com os calcanhares elevados exigiu flexão máxima média do joelho de 157° ± 6° (rastreamento eletromagnético). Descreve a exigência dessa tarefa, não uma meta para o agachamento comum.',
    fonte: HEMMERICH_2006,
  }], ['agachamento']),
  semReferencia('flexao_quadril_max.agachamento', 'flexao_quadril_max', '°', [{
    texto: 'No mesmo estudo, a flexão máxima média do quadril chegou a até 95° ± 27° no agachamento com os calcanhares apoiados; o desvio-padrão alto mostra a grande variação entre pessoas.',
    fonte: HEMMERICH_2006,
  }], ['agachamento']),

  semReferencia('valgo_contato.salto', 'valgo_contato', '°', [{
    texto: 'Em 16 adultos saudáveis num salto em profundidade de 40 cm, a razão de separação joelho–tornozelo (KASR) e a distância de separação dos joelhos (KSD) em vídeo 2D tiveram correlação excelente com o 3D (ICC 0,96 e 0,94), enquanto os dois métodos de ângulo de projeção no plano frontal tiveram correlação fraca a moderada (ICC 0 a 0,57): prefira a razão joelho–tornozelo e use o ângulo com cautela.',
    fonte: ORTIZ_2016,
  }], ['salto']),
  semReferencia('valgo_max.salto', 'valgo_max', '°', [{
    texto: 'Em 16 adultos saudáveis num salto em profundidade de 40 cm, a razão de separação joelho–tornozelo (KASR) e a distância de separação dos joelhos (KSD) em vídeo 2D tiveram correlação excelente com o 3D (ICC 0,96 e 0,94), enquanto os dois métodos de ângulo de projeção no plano frontal tiveram correlação fraca a moderada (ICC 0 a 0,57).',
    fonte: ORTIZ_2016,
  }], ['salto']),
  semReferencia('kasr_contato.salto', 'kasr_contato', 'razão', [{
    texto: 'Em 16 adultos saudáveis num salto em profundidade de 40 cm, a razão de separação joelho–tornozelo (KASR) em vídeo 2D teve correlação excelente com o 3D (ICC 0,96). O estudo valida a medida, mas o resumo não traz valores de referência.',
    fonte: ORTIZ_2016,
  }], ['salto']),
  semReferencia('kasr_min.salto', 'kasr_min', 'razão', [{
    texto: 'Em 16 adultos saudáveis num salto em profundidade de 40 cm, a razão de separação joelho–tornozelo (KASR) em vídeo 2D teve correlação excelente com o 3D (ICC 0,96). O estudo valida a medida, mas o resumo não traz valores de referência.',
    fonte: ORTIZ_2016,
  }], ['salto']),
];

const SEMPRE_SEM_REFERENCIA = 'Sem referência verificada';

export function referenciasDaMetrica(metrica: string, modeloId?: string): ReferenciaBiomecanica[] {
  return REFERENCIAS.filter((r) => r.metrica === metrica && (!r.aplicaA || !modeloId || r.aplicaA.includes(modeloId)));
}

export type ClasseReferencia = 'dentro' | 'fora' | 'sem_referencia';

/**
 * Compara o valor com a faixa da referência. Só referências 'confirmada' classificam; sem faixa, sem valor ou sem referência
 * o resultado é 'sem_referencia'. Nenhuma tolerância é acrescentada aos limites publicados.
 */
export function classificarContraReferencia(valor: number | null | undefined, ref: ReferenciaBiomecanica | null | undefined): ClasseReferencia {
  if (!ref || ref.estatuto !== 'confirmada' || valor === null || valor === undefined || !Number.isFinite(valor)) return 'sem_referencia';
  const { min, max } = ref.faixa;
  if (min === undefined && max === undefined) return 'sem_referencia';
  if (min !== undefined && valor < min) return 'fora';
  if (max !== undefined && valor > max) return 'fora';
  return 'dentro';
}

export interface AvaliacaoReferencia { ref: ReferenciaBiomecanica; classe: ClasseReferencia }

export interface CartaoMetrica {
  resultado: ResultadoMetrica;
  /** Referências confirmadas e a classificação do valor em cada uma. */
  avaliacoes: AvaliacaoReferencia[];
  /** 'dentro' se estiver dentro de qualquer faixa confirmada, 'fora' se estiver fora de todas, 'sem_referencia' se não houver nenhuma. */
  classe: ClasseReferencia;
  /** Texto curto para o cartão. */
  textoReferencia: string;
  /** O que a literatura verificada relata quando não há faixa para classificar. */
  contexto: ContextoLiteratura[];
}

/** Junta o resultado com as referências aplicáveis: o que o cartão (e o PDF) mostra. */
export function montarCartao(resultado: ResultadoMetrica, modeloId?: string): CartaoMetrica {
  const todas = referenciasDaMetrica(resultado.metrica, modeloId);
  const avaliacoes = todas.filter((r) => r.estatuto === 'confirmada').map((ref) => ({ ref, classe: classificarContraReferencia(resultado.valor, ref) }));
  let classe: ClasseReferencia = 'sem_referencia';
  if (avaliacoes.length && resultado.valor !== null) {
    classe = avaliacoes.some((a) => a.classe === 'dentro') ? 'dentro' : 'fora';
  }
  const contexto = todas.flatMap((r) => r.contexto ?? []);
  const textoReferencia = avaliacoes.length
    ? avaliacoes.map(({ ref }) => `${descreverFaixa(ref)} (${ref.fonte.rotulo ?? ref.fonte.citacao}, PMID ${ref.fonte.pmid})`).join(' · ')
    : SEMPRE_SEM_REFERENCIA.toLowerCase();
  return { resultado, avaliacoes, classe, textoReferencia, contexto };
}

export const montarCartoes = (resultados: ResultadoMetrica[], modeloId?: string): CartaoMetrica[] => resultados.map((r) => montarCartao(r, modeloId));

const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/** Um limite da faixa com a unidade, ex.: "100 passos/min"; undefined se a faixa não tem esse limite. */
export function descreverLimite(ref: ReferenciaBiomecanica, qual: 'min' | 'max'): string | undefined {
  const v = ref.faixa[qual];
  return v === undefined ? undefined : `${num(v)} ${ref.unidade}`;
}

export function descreverFaixa(ref: ReferenciaBiomecanica): string {
  const { min, max } = ref.faixa;
  if (min !== undefined && max !== undefined) return `${num(min)} a ${num(max)} ${ref.unidade}`;
  if (min !== undefined) return `≥ ${num(min)} ${ref.unidade}`;
  if (max !== undefined) return `≤ ${num(max)} ${ref.unidade}`;
  return SEMPRE_SEM_REFERENCIA.toLowerCase();
}
