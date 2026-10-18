import type { GraficoParaCanvas } from '../analiseVideo/graficoCanvas';
import type { AmostraAngulo, DefinicaoAngulo } from '../video/angulos';
import type { EventoPasso } from '../video/eventos';
import type { IdGesto } from '../video/modelos';
import type { Lado } from '../video/tipos';

/*
 * CONTRATO da Etapa 3 (apoio à avaliação biomecânica feita pelo profissional). Só tipos: a lógica fica em
 * analisarMovimento.ts (agente M), laudo.ts e laudoPdf.ts (agente L) e biblioteca/ (agente R).
 * Especificação do produto: docs/avaliacao-movimento-v3.md. Não é treino, não dá nota, não diagnostica.
 *
 * Regras que valem para todos os tipos abaixo:
 *  - Nenhum campo traz juízo de valor. Sem limite de fonte confirmada ou critério do profissional, a medida é só observação
 *    ("sem referência"); veredito (dentro do critério, no limite, fora do critério) só existe com critério.
 *  - Nada é inventado: número, dose, referência, PMID ou trecho só entram com origem verificada.
 *  - Tudo é determinístico (modelos de frase, sem modelo de linguagem) para ser testável.
 */

export type { AmostraAngulo, EventoPasso, Lado };

// ---------- protocolos ----------

/** Protocolo = movimento + vista. O mesmo rastreio (TrilhaPose) alimenta todos; o plano de câmera é uma propriedade declarada. */
export type IdProtocolo = 'agachamento_lateral' | 'agachamento_frontal' | 'marcha_lateral';

/** Plano em que o vídeo foi filmado. A medida 2D só vale nesse plano. */
export type PlanoCamera = 'lateral' | 'frontal';

/**
 * Catálogo fixo de achados. As chaves são o elo entre a análise (M), o laudo (L) e a biblioteca de hipóteses (R):
 * não renomear nem criar chave sem avisar os três.
 */
export type ChaveAchado =
  | 'assimetria_flexao_joelho'
  | 'assimetria_flexao_quadril'
  | 'assimetria_dorsiflexao'
  | 'valgo_dinamico'
  | 'desvio_lateral_pelve'
  | 'inclinacao_tronco'
  | 'avanco_joelho'
  | 'variacao_profundidade'
  | 'tendencia_na_serie'
  | 'assimetria_tempo_apoio'
  | 'assimetria_flexao_joelho_marcha'
  | 'assimetria_amplitude_quadril'
  | 'inclinacao_tronco_marcha';

/**
 * Três marcos dentro de uma repetição. `fundo` é o marco intermediário: o ponto mais baixo no agachamento e a saída do pé
 * (fim do apoio) na marcha. Com três marcos todas as fases viram janelas [de, ate] sobre a mesma repetição.
 */
export type MarcoRepeticao = 'inicio' | 'fundo' | 'fim';

/** Fase do movimento: janela entre dois marcos da repetição (inclusive nas pontas). `de === ate` é um instante. */
export interface FaseMovimento {
  id: string;
  nome: string;
  descricao: string;
  de: MarcoRepeticao;
  ate: MarcoRepeticao;
}

/** Sinalizadores existem para o profissional conferir a segmentação; não são nota. */
export type SinalizadorRepeticao =
  /** Encosta numa ponta do trecho analisado ou não completa o movimento: fica na lista, mas todos os valores medidos são null. */
  | 'incompleta'
  /** Faltam pontos do corpo em parte dos quadros da repetição: os valores que dependem deles ficam null. */
  | 'pontos_ausentes'
  /** A duração se afasta da mediana pelo mesmo critério estatístico de `repeticao_discrepante`. */
  | 'duracao_discrepante';

/**
 * Uma repetição segmentada: um agachamento (descida, fundo, subida) ou uma passada (do contato do pé ao contato seguinte do mesmo pé).
 * Índices de quadro apontam para `trilha.quadros`; os tempos são absolutos no vídeo, como em QuadroPose.t.
 */
export interface Repeticao {
  /** 1, 2, 3... como o profissional lê. A posição na lista (índice 0-based) é o que `Achado.repeticoes` e os valores usam. */
  numero: number;
  /** Pé que define a passada na marcha; null no agachamento (a repetição vale para os dois lados). */
  lado: Lado | null;
  inicioI: number;
  fundoI: number;
  fimI: number;
  inicioT: number;
  fundoT: number;
  fimT: number;
  /** fimT − inicioT, em segundos. */
  duracao: number;
  sinalizadores: SinalizadorRepeticao[];
}

// ---------- medidas ----------

/**
 * Natureza da grandeza, porque decide como a incerteza é estimada:
 *  - angulo: resíduo da série angular (bruta × suavizada), em graus;
 *  - deslocamento: o mesmo resíduo, na unidade normalizada da medida (sem escala em cm);
 *  - tempo: um quadro (1 ÷ taxa efetiva).
 */
export type GrandezaMedida = 'angulo' | 'deslocamento' | 'tempo';

/**
 * Como o valor da fase vira um número, sempre sobre a série SUAVIZADA, na janela [de, ate] da fase da repetição:
 *  - valor_no_marco: valor no marco `de` da fase (a fase é um instante: de === ate);
 *  - maximo / minimo: extremo da janela; amplitude: máximo − mínimo da janela; media: média da janela;
 *  - duracao: tempo do marco `ate` − tempo do marco `de`, em segundos.
 */
export type ExtracaoMedida = 'valor_no_marco' | 'maximo' | 'minimo' | 'amplitude' | 'media' | 'duracao';

export interface DefMedidaRepeticao {
  /** Estável: é a chave de `MedidaPorRepeticao`, de `resumos` e dos critérios. */
  id: string;
  nome: string;
  /** '°', 's', '% da coxa', '% da base de apoio', '% do comprimento do pé'. As normalizadas dispensam a escala em cm. */
  unidade: string;
  /** true = um valor por lado (D e E); false = um valor só ('unico'). */
  porLado: boolean;
  /** Id de uma FaseMovimento do protocolo, em que o valor é extraído. */
  fase: string;
  extracao: ExtracaoMedida;
  grandeza: GrandezaMedida;
  planoCamera: PlanoCamera;
  /** Como é calculada, em texto legível: vai para o laudo. Inclui o sentido do sinal quando houver. */
  formula: string;
}

/** 'unico' é a chave das medidas sem lado (porLado = false). */
export type ChaveLado = Lado | 'unico';

/**
 * Valores alinhados às repetições: cada array tem o MESMO comprimento de `AnaliseMovimento.repeticoes`, com null onde não houve
 * medida. Na marcha cada passada pertence a um pé (`Repeticao.lado`): numa medida por lado, `valores.D` só tem número nas passadas
 * do pé D e `valores.E` nas do pé E (o restante é null). Assim a posição k significa sempre a repetição k.
 */
export type ValoresPorLado = Partial<Record<ChaveLado, (number | null)[]>>;

export interface MedidaPorRepeticao {
  def: DefMedidaRepeticao;
  valores: ValoresPorLado;
  /** Incerteza de UM valor da medida (na unidade dela), por lado; null se não deu para estimar. */
  incerteza: Partial<Record<ChaveLado, number | null>>;
  avisos: string[];
}

/** Resumo de uma medida em um lado, sobre os valores não nulos. */
export interface ResumoMedida {
  n: number;
  media: number | null;
  /** Desvio-padrão amostral (n − 1); null com menos de 2 valores. */
  dp: number | null;
  mediana: number | null;
  min: number | null;
  max: number | null;
  /** Primeira e última repetição COM valor, e a posição de cada uma na lista de repetições. */
  primeira: number | null;
  ultima: number | null;
  iPrimeira: number | null;
  iUltima: number | null;
  /** ultima − primeira, com sinal, na unidade da medida; null com menos de 2 valores. */
  tendencia: number | null;
}

/** Resumo por id de medida e por lado. */
export type ResumosPorMedida = Record<string, Partial<Record<ChaveLado, ResumoMedida>>>;

// ---------- achados ----------

/**
 * O que dispara um achado (regras exatas e mínimo de repetições em GATILHOS, protocolos.ts). Nenhuma usa limite clínico.
 * (a) assimetria_entre_lados, (b) variacao_entre_repeticoes, (c) tendencia_primeira_ultima, (d) repeticao_discrepante,
 * (e) criterio_profissional.
 */
export type TipoGatilho =
  | 'assimetria_entre_lados'
  | 'variacao_entre_repeticoes'
  | 'tendencia_primeira_ultima'
  | 'repeticao_discrepante'
  | 'criterio_profissional';

/** Grandeza natural de cada chave do catálogo: o número que um critério do profissional compara. */
export type GrandezaDoAchado = 'diferenca_entre_lados' | 'media_por_lado' | 'media' | 'modulo_da_media' | 'desvio_padrao' | 'tendencia';

/** Entrada do catálogo (independente de protocolo). */
export interface DefAchado {
  chave: ChaveAchado;
  /** Título neutro: descreve o que é comparado, não um julgamento. */
  titulo: string;
  oQueCompara: string;
  gatilhos: TipoGatilho[];
  grandeza: GrandezaDoAchado;
  /** Critério debatido na literatura: fica DESLIGADO por padrão e só vira veredito se o profissional o definir e ativar. */
  criterioDebatido?: boolean;
  notaCriterio?: string;
}

/** O que um protocolo faz com uma chave do catálogo. */
export interface AchadoDoProtocolo {
  chave: ChaveAchado;
  /** Plano de câmera em que a medida do achado é válida. Se diferir do plano filmado, o achado fica em `indisponiveis`. */
  planoExigido: PlanoCamera;
  /** Ids de DefMedidaRepeticao que alimentam o achado. Vazio só nos indisponíveis (a medida pertence a outro protocolo). */
  medidas: string[];
  /** Limitações próprias deste achado neste protocolo (copiadas para `Achado.limitacoes`). */
  limitacoes: string[];
}

export type SituacaoCriterio = 'dentro_do_criterio' | 'no_limite' | 'fora_do_criterio' | 'sem_referencia';

export type OperadorCriterio = '<' | '<=' | '>' | '>=';

/**
 * Critério definido pelo profissional (gatilho e). SEMPRE nasce desligado (`ativo: false`) e sem valor presumido: use `novoCriterio`.
 * Compara a grandeza natural da chave (DefAchado.grandeza) calculada sobre a medida `metrica`.
 */
export interface CriterioProfissional {
  id: string;
  /** Achado que recebe o veredito. */
  chave: ChaveAchado;
  /** Id da DefMedidaRepeticao sobre a qual a grandeza é calculada (precisa estar em `AchadoDoProtocolo.medidas` da chave). */
  metrica: string;
  /** Sem lado, vale para cada lado separadamente (ou para o valor único). */
  lado?: Lado;
  operador: OperadorCriterio;
  valor: number;
  unidade: string;
  /** Texto exibido, por exemplo "diferença entre os lados ≤ 5°". */
  rotulo: string;
  /** Quem definiu (nome do profissional ou do serviço): sem isso o critério não se aplica. */
  definidoPor: string;
  /** Fonte do critério, se o profissional quiser citar uma. */
  fonte?: FonteBiblio;
  ativo: boolean;
}

/** Veredito de um achado: existe só quando há critério ativo. */
export interface VereditoAchado {
  situacao: Exclude<SituacaoCriterio, 'sem_referencia'>;
  criterio: CriterioProfissional;
}

export interface Achado {
  /** Determinístico (chave:medida:gatilho:lado:repetições), serve de chave React e de âncora no laudo. */
  id: string;
  chave: ChaveAchado;
  /** Do catálogo; nos achados de critério do profissional, o título é "Critério do profissional: <rótulo>". */
  titulo: string;
  /** Uma frase neutra montada por modelo: o que foi medido e quanto, sem causa e sem juízo. */
  descricao: string;
  /** Id da DefMedidaRepeticao principal. */
  medida: string;
  /** Lado a que se refere: o de maior valor numa assimetria, o lado medido nos demais; null = os dois/sem lado. */
  lado: Lado | null;
  /** POSIÇÕES (0-based) em `AnaliseMovimento.repeticoes` das repetições envolvidas. */
  repeticoes: number[];
  /**
   * Magnitude que disparou o achado, por gatilho:
   *  - assimetria_entre_lados: |média D − média E| (ou |média| nas medidas sem par, como o desvio lateral da pelve);
   *  - variacao_entre_repeticoes: desvio-padrão entre repetições;
   *  - tendencia_primeira_ultima: última − primeira, com sinal;
   *  - repeticao_discrepante: valor da repetição − mediana, com sinal;
   *  - criterio_profissional: a grandeza natural da chave (DefAchado.grandeza).
   */
  valor: number | null;
  unidade: string;
  /** Valores por lado usados na comparação (médias), para o laudo mostrar "D 98,2° · E 91,0°". */
  valoresPorLado?: Partial<Record<Lado, number | null>>;
  /** Incerteza do `valor` (mesma unidade), conforme a regra do gatilho; null se não estimada. */
  incerteza: number | null;
  /** valor maior que a incerteza. Achado de critério pode ter false: aí o laudo diz que está dentro da incerteza do vídeo. */
  superaIncerteza: boolean;
  gatilho: TipoGatilho;
  /** Sem critério ativo: 'sem_referencia' (observação medida). */
  situacao: SituacaoCriterio;
  veredito?: VereditoAchado;
  planoCamera: PlanoCamera;
  /** Equivalente em cm, só para medidas de deslocamento e só com `escalaCmPorPixel` informada. */
  equivalenteCm?: number | null;
  limitacoes: string[];
}

/** Achado do protocolo que não pôde ser avaliado por exigir outro plano de câmera. */
export interface AchadoIndisponivel {
  chave: ChaveAchado;
  titulo: string;
  planoExigido: PlanoCamera;
  planoFilmado: PlanoCamera;
  motivo: string;
  /** O que gravar para obtê-lo. */
  comoObter: string;
}

// ---------- análise ----------

/** Incerteza estimada do próprio vídeo: empírica, nunca uma tolerância fixa em graus. */
export interface IncertezaEstimada {
  /** Incerteza angular (graus) da série usada; null se não houve amostras suficientes. */
  angularGraus: number | null;
  /** Um quadro, em segundos (1 ÷ taxa efetiva da trilha). */
  quadroS: number;
  /** Quantas amostras entraram no resíduo. */
  nAmostras: number;
  /** Fórmula exibida no laudo. */
  formula: string;
  /** Uma ou duas frases: o que é e o que não é (ex.: o resíduo não capta o erro sistemático do detector). */
  descricao: string;
}

/** Opções de `analisarMovimento`. `criterios` e `escalaCmPorPixel` são o contrato mínimo; o resto evita refazer o que a tela já tem. */
export interface OpcoesAnalise {
  /** Só os que estiverem ativos e aplicáveis entram (ver `criterioAplicavel`). */
  criterios?: CriterioProfissional[];
  escalaCmPorPixel?: number | null;
  /** Marcha: eventos já conferidos pelo profissional na tela. Sem isto são detectados automaticamente. */
  eventos?: EventoPasso[];
  /** Para onde o paciente está virado/andando (+1 direita da imagem). Sem isto é estimado pelos pés. */
  direcao?: 1 | -1;
  /** Janela de suavização das séries angulares, em segundos (padrão do motor). */
  suavizacaoS?: number;
}

export interface AnaliseMovimento {
  protocolo: IdProtocolo;
  planoFilmado: PlanoCamera;
  direcao: 1 | -1;
  repeticoes: Repeticao[];
  /** Uma entrada por DefMedidaRepeticao do protocolo, na ordem do protocolo, mesmo sem valores. */
  medidas: MedidaPorRepeticao[];
  resumos: ResumosPorMedida;
  achados: Achado[];
  indisponiveis: AchadoIndisponivel[];
  incerteza: IncertezaEstimada;
  /** Séries angulares suavizadas usadas nas medidas, por id de articulação (para os gráficos). */
  series: Record<string, AmostraAngulo[]>;
  /** Marcha: eventos usados (detectados ou conferidos); vazio no agachamento. */
  eventos: EventoPasso[];
  avisos: string[];
}

export interface Protocolo {
  id: IdProtocolo;
  nome: string;
  /** Gesto do motor ao qual o protocolo pertence: agrupa os protocolos na tela (agachamento → lateral e frontal). */
  gesto: IdGesto;
  planoFilmado: PlanoCamera;
  rotuloRepeticao: { singular: string; plural: string };
  descricao: string;
  /** Como as repetições são identificadas, em texto legível: entra no método do laudo para o profissional conferir a segmentação. */
  segmentacao: string;
  fases: FaseMovimento[];
  /** Orientações de gravação por plano; o outro plano orienta como obter os achados indisponíveis. */
  gravacao: Partial<Record<PlanoCamera, string[]>>;
  fpsSugerido: number;
  /** Ângulos acompanhados (definições do motor); a análise produz uma série para cada um. */
  articulacoes: DefinicaoAngulo[];
  medidas: DefMedidaRepeticao[];
  achados: AchadoDoProtocolo[];
  /** Limitações próprias do protocolo; entram em todo laudo dele. */
  limitacoes: string[];
}

export interface DefGatilho {
  tipo: TipoGatilho;
  nome: string;
  /** Regra exatamente como o laudo a imprime; M implementa o que está escrito aqui. */
  regra: string;
  /** Menos repetições com valor que isto: o gatilho não é avaliado. É decisão de engenharia (estabilidade da estatística), não limite clínico. */
  minimoRepeticoes: number;
}

// ---------- biblioteca de hipóteses (agente R) ----------

/** Fonte verificada no PubMed. O `trecho` é cópia LITERAL do resumo indexado, em inglês, entre aspas no laudo. */
export interface FonteBiblio {
  pmid: string;
  /** Autor(es), título, periódico, ano — como no padrão do repositório (referencias.ts). */
  citacao: string;
  ano: number;
  periodico: string;
  doi?: string;
  trecho: string;
  /** Quem foi estudado, se o resumo disser. */
  populacao?: string;
  /** Data (AAAA-MM-DD) em que o trecho foi conferido no PubMed. */
  verificadoEm?: string;
  /** Nível da avaliação metodológica (biblioteca/avaliacaoMetodologica.ts): o laudo o mostra junto da fonte. Ausente em fonte informada à mão (critério do profissional). */
  qualidade?: 'alta' | 'moderada' | 'baixa';
  /** Principal limitação metodológica da fonte, em uma frase, exibida no laudo ao lado do nível de qualidade. */
  limitacaoPrincipal?: string;
}

export type ForcaEvidencia = 'revisao_sistematica' | 'meta_analise' | 'observacional' | 'experimental' | 'a_confirmar';

/**
 * Possível fator contribuinte: hipótese para o profissional confirmar, nunca causa afirmada.
 * `forca` diferente de 'a_confirmar' exige ao menos uma fonte; 'a_confirmar' pode ter `fontes` vazio.
 */
export interface FatorContribuinte {
  id: string;
  /** Redigido como hipótese ("pode contribuir"), sem afirmar causa. */
  texto: string;
  forca: ForcaEvidencia;
  fontes: FonteBiblio[];
  /** Sempre presente: o que a fonte não permite concluir (população, método, associação × causa). */
  ressalva: string;
}

/** O que conferir na avaliação presencial. Sem fonte, declarar `semReferenciaVerificada: true` para o laudo escrever "sem referência verificada". */
export interface ItemConferir {
  texto: string;
  fonte?: FonteBiblio;
  semReferenciaVerificada?: boolean;
}

export interface EntradaBiblioteca {
  /** Uma ChaveAchado. */
  chave: string;
  titulo: string;
  fatores: FatorContribuinte[];
  conferir: ItemConferir[];
}

export type Biblioteca = Record<string, EntradaBiblioteca>;

// ---------- laudo (agente L) ----------

/** Dados que a análise não tem: identificação, data e o que o profissional fez na tela. */
export interface ContextoLaudo {
  video: { nome: string; duracaoS?: number; largura?: number; altura?: number };
  /** AAAA-MM-DD (data da análise); o laudo formata. */
  data: string;
  /** Taxa da trilha analisada (a efetiva), que pode diferir da do arquivo. */
  taxaEfetivaFps: number;
  trecho?: { inicio: number; fim: number };
  /** Quadros com pontos corrigidos à mão (resumoCorrecoes(trilha).quadros). */
  quadrosChaveCorrigidos: number;
  /** Medidas manuais em instantes fora do trecho, que não entraram (a nota vem de `notaMedidasForaDoTrecho`). */
  medidasManuaisForaDoTrecho: number;
  /** Fica em branco de propósito: quem revisa assina/preenche; o laudo não presume revisão. */
  responsavelRevisao: string;
  /** Critérios do profissional; só os ativos e aplicáveis são tratados como critério usado. */
  criterios: CriterioProfissional[];
  paciente?: string;
  profissional?: string;
  logoUrl?: string;
}

/** Tabela já em texto pt-BR: a tela e o PDF só desenham. */
export interface TabelaLaudo {
  titulo?: string;
  colunas: string[];
  linhas: string[][];
  legenda?: string;
}

export interface SecaoLaudo {
  id: string;
  titulo: string;
  paragrafos: string[];
  itens: string[];
  tabelas: TabelaLaudo[];
}

export interface CabecalhoLaudo {
  titulo: string;
  subtitulo: string;
  /** "beta": o recurso está em validação. */
  etiqueta: string;
  /** Pares rótulo/valor: vídeo, data, taxa efetiva, trecho, quadros corrigidos, responsável pela revisão (em branco)... */
  linhas: { rotulo: string; valor: string }[];
}

export interface ReferenciaLaudo {
  /** Número que as hipóteses citam, por exemplo [1]. */
  numero: number;
  fonte: FonteBiblio;
}

export interface HipoteseLaudo {
  texto: string;
  /** Rótulo pronto (ROTULO_FORCA): "revisão sistemática", "a confirmar"... */
  forca: string;
  ressalva: string;
  /** Números de `LaudoMovimento.referencias`. Vazio quando a força é 'a confirmar'. */
  referencias: number[];
}

export interface ItemConferirLaudo {
  texto: string;
  referencia?: number;
  semReferenciaVerificada: boolean;
}

export interface AchadoLaudo {
  achado: Achado;
  titulo: string;
  descricao: string;
  /** "sem referência", "fora do critério"... (ROTULO_SITUACAO). */
  situacao: string;
  /** Texto de apoio já formatado: valor e incerteza, repetições envolvidas. */
  medida: string;
  incerteza: string;
  repeticoes: string;
  hipoteses: HipoteseLaudo[];
  conferir: ItemConferirLaudo[];
  /** Não há entrada da biblioteca para a chave: o laudo diz que não há hipóteses curadas, sem improvisar. */
  semBiblioteca: boolean;
  limitacoes: string[];
  notaCriterio?: string;
}

export interface GraficoLaudo {
  titulo: string;
  legenda?: string;
  /** Mesmo formato do gráfico da tela e do relatório de vídeo: o PDF o pinta com `canvasDoGrafico`. */
  grafico: GraficoParaCanvas;
}

export interface LaudoMovimento {
  protocolo: IdProtocolo;
  cabecalho: CabecalhoLaudo;
  resumo: SecaoLaudo;
  /** Uma tabela por medida: linhas = repetições, colunas = lados; no fim, média, desvio-padrão e n. */
  medidasPorRepeticao: SecaoLaudo;
  achados: AchadoLaudo[];
  /** Achados que exigem outro plano de câmera e como obtê-los. */
  indisponiveis: SecaoLaudo;
  /** Incerteza estimada (com a fórmula), regras dos gatilhos e critérios usados. */
  metodo: SecaoLaudo;
  limitacoes: SecaoLaudo;
  graficos: GraficoLaudo[];
  referencias: ReferenciaLaudo[];
  /** Fixo: AVISO_ESTIMATIVA_VIDEO ("Estimativa por vídeo · não é diagnóstico"). */
  rodape: string;
}
