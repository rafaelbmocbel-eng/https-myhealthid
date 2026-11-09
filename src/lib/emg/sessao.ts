/**
 * Gravação guiada de EMG de superfície e o que vai para o prontuário. Lógica pura
 * (sem DOM e sem React) sobre o sinal em µV já filtrado (ver filtros.ts).
 *
 * Etapas do protocolo:
 * - REPOUSO: músculo relaxado; dá o ruído basal e a linha de base para detectar contrações.
 * - CVM: contração voluntária máxima, em tentativas; a referência é a maior delas.
 * - TAREFA: contração livre, de duração livre; é nela que se detectam as contrações.
 *
 * Tudo aqui é medida de apoio, interpretada pelo profissional: limiares e durações são
 * parâmetros de análise (exportados e gravados junto do exame), não critérios clínicos.
 */

import {
  PADRAO_CONTRACOES,
  cvmDeTentativas,
  detectarContracoes,
  envelopeRms,
  normalizarPorCVM,
  picoEmJanela,
  qualidadeDoSinal,
  rms,
  rmsEmJanelas,
  type QualidadeSinal,
} from './metricas';

export type TipoEtapa = 'repouso' | 'cvm' | 'tarefa';
export type LadoCanal = 'D' | 'E' | '-';

export interface CanalEmg {
  id: string;
  musculo: string;
  lado: LadoCanal;
}

const TIPOS_DE_ETAPA: readonly TipoEtapa[] = ['repouso', 'cvm', 'tarefa'];

/** Valores sugeridos pela tela. O descanso entre tentativas de CVM é só uma sugestão: quem decide é a tela. */
export const PROTOCOLO_SESSAO = {
  repousoS: 5,
  cvmTentativas: 3,
  cvmDuracaoS: 5,
  cvmDescansoSugeridoS: 30,
} as const;

/** Teto de uma etapa (memória): o que passar disso é ignorado e a etapa fica marcada como cortada. */
export const DURACAO_MAX_ETAPA_S = 900;

/** Repouso mais curto que isto não dá linha de base confiável: as contrações não são detectadas. */
export const REPOUSO_MIN_S = 3;

/**
 * Quantos desvios-padrão do repouso acima da média o envelope precisa passar para contar como
 * contração. Com k = 3 e repouso de 1 s houve muito falso positivo em ruído puro (achado da revisão
 * da etapa 1); com repouso >= 3 s e k = 5 a simulação com 300 sementes não gera nenhuma.
 */
export const K_CONTRACAO = 5;

/**
 * Piso absoluto: a contração só vale se o pico passar da média do repouso por pelo menos isto (µV).
 * Em repouso muito quieto o desvio do envelope é minúsculo e k·desvio sozinho aceitaria flutuação.
 */
export const PISO_CONTRACAO_UV = 5;

/** Janela do envelope RMS usado para detectar contrações. */
export const JANELA_ENVELOPE_DETECCAO_MS = 100;

/**
 * Duração mínima de uma contração, medida no envelope. O envelope RMS alarga a rajada em cerca de
 * uma janela (100 ms), então 300 ms equivalem a rajadas reais de uns 200 ms: estalos de cabo e
 * toques no eletrodo, bem mais curtos, são descartados.
 */
export const DURACAO_MIN_CONTRACAO_MS = 300;

/** Contrações separadas por menos que isto (no envelope) viram uma só. */
export const JUNTAR_CONTRACOES_MS = PADRAO_CONTRACOES.juntarMs;

/** Janela do RMS que define a CVM (maior RMS em janela deslizante, por tentativa). */
export const JANELA_CVM_MS = 1000;

/** Janela do envelope guardado no exame (um valor a cada 50 ms = 20 Hz). */
export const JANELA_ENVELOPE_SALVO_MS = 50;

/** CVM abaixo de tantas vezes o ruído basal sugere que não houve contração máxima ou que o sensor está mal posicionado. */
export const RAZAO_MIN_CVM_RUIDO = 3;

/** RMS do repouso inteiro acima de tantas vezes o ruído basal (trecho mais quieto): o músculo se mexeu durante o repouso. */
export const RAZAO_MAX_REPOUSO_INSTAVEL = 1.5;

/** Quantas contrações o texto do laudo lista; as demais ficam só nos dados do exame. */
export const MAX_CONTRACOES_NO_LAUDO = 20;

export interface ParametrosAnalise {
  k: number;
  pisoUv: number;
  repousoMinS: number;
  duracaoMinContracaoMs: number;
  juntarMs: number;
  janelas: { deteccaoMs: number; cvmMs: number; envelopeSalvoMs: number };
}

export const PARAMETROS_ANALISE: ParametrosAnalise = {
  k: K_CONTRACAO,
  pisoUv: PISO_CONTRACAO_UV,
  repousoMinS: REPOUSO_MIN_S,
  duracaoMinContracaoMs: DURACAO_MIN_CONTRACAO_MS,
  juntarMs: JUNTAR_CONTRACOES_MS,
  janelas: {
    deteccaoMs: JANELA_ENVELOPE_DETECCAO_MS,
    cvmMs: JANELA_CVM_MS,
    envelopeSalvoMs: JANELA_ENVELOPE_SALVO_MS,
  },
};

/** O mínimo que a análise precisa de uma etapa gravada. */
export interface EtapaDeSinal {
  tipo: TipoEtapa;
  /** Amostras filtradas, em µV. */
  amostras: ArrayLike<number>;
  /** true se a gravação estourou DURACAO_MAX_ETAPA_S e o resto foi ignorado. */
  truncada?: boolean;
}

export interface ResultadoEtapa extends EtapaDeSinal {
  amostras: Float64Array;
  truncada: boolean;
  /** Posição entre as etapas do mesmo tipo já finalizadas (1 = primeira; tentativa de CVM, por exemplo). */
  numero: number;
  duracaoS: number;
  rmsUv: number;
  /** Maior RMS em janela de 1 s (a referência de CVM); 0 se a etapa tem menos de 1 s. */
  picoRms1sUv: number;
}

export interface LinhaDeBase {
  /** Média e desvio-padrão do envelope RMS (100 ms) do repouso, em µV. */
  mediaUv: number;
  desvioUv: number;
  /** média + k·desvio: o envelope da tarefa precisa passar disto para começar uma contração. */
  limiarUv: number;
  /** média + piso: o pico da contração precisa chegar a isto para ela valer. */
  pisoPicoUv: number;
}

export interface ContracaoResumo {
  /** Tempos desde o começo da tarefa, no envelope de 100 ms (incerteza de ~50 ms em cada borda). */
  inicioS: number;
  fimS: number;
  duracaoS: number;
  picoUv: number;
  rmsMedioUv: number;
  picoPctCvm: number | null;
  rmsMedioPctCvm: number | null;
}

export interface ResumoSessao {
  canal: CanalEmg;
  duracaoRepousoS: number;
  duracaoTarefaS: number;
  /** Menor RMS de janela de 1 s do repouso. */
  ruidoBasalRmsUv: number | null;
  /** RMS do repouso inteiro. */
  repousoRmsUv: number | null;
  qualidade: QualidadeSinal | null;
  linhaDeBase: LinhaDeBase | null;
  /** Tentativas de CVM com pelo menos uma janela de 1 s; as mais curtas são ignoradas (com aviso). */
  tentativasCvm: number;
  /** Uma entrada por tentativa contada em `tentativasCvm`, na ordem gravada. */
  cvmPorTentativaUv: number[];
  /** Maior pico entre as tentativas; null sem CVM (ou com tentativas menores que 1 s). */
  cvmUv: number | null;
  contracoes: ContracaoResumo[];
  /** Maior pico entre as contrações, em % da CVM; null sem CVM ou sem contrações. */
  picoPctCvmMax: number | null;
  avisos: string[];
}

function validarFs(fsHz: number): void {
  if (!Number.isFinite(fsHz) || fsHz <= 0) {
    throw new RangeError(`fsHz deve ser finito e > 0 (recebido ${fsHz})`);
  }
}

function ehTipoDeEtapa(tipo: unknown): tipo is TipoEtapa {
  return TIPOS_DE_ETAPA.includes(tipo as TipoEtapa);
}

export class GravadorDeSessao {
  readonly fsHz: number;
  readonly canal: CanalEmg;
  private readonly maxAmostras: number;
  private readonly finalizadas: ResultadoEtapa[] = [];
  private atual: TipoEtapa | null = null;
  private buffer = new Float64Array(0);
  private usadas = 0;
  private cortada = false;

  constructor(opcoes: { fsHz: number; canal: CanalEmg }) {
    validarFs(opcoes.fsHz);
    this.fsHz = opcoes.fsHz;
    this.canal = { id: opcoes.canal.id, musculo: opcoes.canal.musculo, lado: opcoes.canal.lado };
    this.maxAmostras = Math.max(1, Math.floor(this.fsHz * DURACAO_MAX_ETAPA_S));
  }

  get etapaAtual(): TipoEtapa | null {
    return this.atual;
  }

  /** Quanto já foi gravado na etapa em andamento (0 se não há etapa). */
  get duracaoEtapaS(): number {
    return this.usadas / this.fsHz;
  }

  /** Etapas já finalizadas, na ordem em que foram gravadas. */
  get etapas(): readonly ResultadoEtapa[] {
    return [...this.finalizadas];
  }

  iniciarEtapa(tipo: TipoEtapa): void {
    if (!ehTipoDeEtapa(tipo)) {
      throw new Error(`Tipo de etapa desconhecido: "${String(tipo)}" (use repouso, cvm ou tarefa).`);
    }
    if (this.atual !== null) {
      throw new Error(
        `A etapa "${this.atual}" ainda está em andamento: finalize ou cancele antes de iniciar "${tipo}".`,
      );
    }
    this.atual = tipo;
    this.zerarBuffer();
  }

  /**
   * Marca a etapa em andamento como cortada. Quem encerra a gravação no teto antes de entregar o que
   * passaria dele (o controlador da tela) usa isto, porque aí `receber` nunca vê amostra além do limite.
   */
  marcarCortada(): void {
    if (this.atual !== null) this.cortada = true;
  }

  /** Amostras recebidas fora de uma etapa são ignoradas. */
  receber(filtradas: ArrayLike<number>): void {
    if (this.atual === null) return;
    const n = filtradas.length;
    const cabem = Math.min(n, this.maxAmostras - this.usadas);
    if (cabem < n) this.cortada = true;
    if (cabem <= 0) return;
    this.garantirEspaco(this.usadas + cabem);
    for (let i = 0; i < cabem; i++) this.buffer[this.usadas + i] = filtradas[i];
    this.usadas += cabem;
  }

  finalizarEtapa(): ResultadoEtapa {
    if (this.atual === null) {
      throw new Error('Nenhuma etapa em andamento: chame iniciarEtapa() antes de finalizarEtapa().');
    }
    const tipo = this.atual;
    const amostras = this.buffer.slice(0, this.usadas);
    const resultado: ResultadoEtapa = {
      tipo,
      amostras,
      truncada: this.cortada,
      numero: this.finalizadas.filter((e) => e.tipo === tipo).length + 1,
      duracaoS: amostras.length / this.fsHz,
      rmsUv: rms(amostras),
      picoRms1sUv: picoEmJanela(amostras, this.fsHz, JANELA_CVM_MS).valor,
    };
    this.finalizadas.push(resultado);
    this.atual = null;
    this.zerarBuffer();
    return resultado;
  }

  /** Abandona a etapa em andamento sem guardá-la (conexão perdida, "refazer"). Sem etapa, não faz nada. */
  cancelarEtapa(): void {
    this.atual = null;
    this.zerarBuffer();
  }

  /** Tira a última etapa finalizada (para refazê-la) e a devolve; null se não há nenhuma. */
  descartarUltimaEtapa(): ResultadoEtapa | null {
    return this.finalizadas.pop() ?? null;
  }

  /** Resumo das etapas já finalizadas; null enquanto não há nenhuma. */
  resumo(): ResumoSessao | null {
    if (this.finalizadas.length === 0) return null;
    return resumirSessao(this.finalizadas, this.fsHz, this.canal);
  }

  private zerarBuffer(): void {
    this.buffer = new Float64Array(0);
    this.usadas = 0;
    this.cortada = false;
  }

  // Dobra o tamanho a cada estouro: a cópia custa O(1) amortizado por amostra e a etapa de tarefa tem duração livre.
  private garantirEspaco(necessario: number): void {
    if (necessario <= this.buffer.length) return;
    const proximo = Math.min(
      this.maxAmostras,
      Math.max(necessario, this.buffer.length * 2, Math.ceil(this.fsHz * PROTOCOLO_SESSAO.repousoS)),
    );
    const maior = new Float64Array(proximo);
    maior.set(this.buffer.subarray(0, this.usadas));
    this.buffer = maior;
  }
}

function concatenar(etapas: readonly EtapaDeSinal[]): Float64Array {
  let total = 0;
  for (const e of etapas) total += e.amostras.length;
  const saida = new Float64Array(total);
  let pos = 0;
  for (const e of etapas) {
    for (let i = 0; i < e.amostras.length; i++) saida[pos + i] = e.amostras[i];
    pos += e.amostras.length;
  }
  return saida;
}

// Desvio amostral (n - 1), o mesmo de detectarContracoes, para o limiar informado ser o usado.
function mediaEDesvio(x: ArrayLike<number>): { media: number; desvio: number } {
  const n = x.length;
  let soma = 0;
  for (let i = 0; i < n; i++) soma += x[i];
  const media = soma / n;
  let desvios = 0;
  for (let i = 0; i < n; i++) desvios += (x[i] - media) * (x[i] - media);
  return { media, desvio: n > 1 ? Math.sqrt(desvios / (n - 1)) : 0 };
}

function plural(n: number, singular: string, pluralStr: string): string {
  return n === 1 ? singular : pluralStr;
}

function numeroPt(v: number, casas: number): string {
  return v.toFixed(casas).replace('.', ',');
}

function uvTexto(v: number): string {
  return numeroPt(v, v >= 100 ? 0 : 1);
}

function pctTexto(v: number): string {
  return numeroPt(v, 0);
}

function segundosTexto(v: number): string {
  return numeroPt(v, 1);
}

/**
 * Resume as etapas gravadas. A ordem das etapas na lista não importa, só o tipo:
 * - repouso: vale o último com amostras (refazer substitui); com menos de REPOUSO_MIN_S não há
 *   detecção de contrações, só um aviso;
 * - cvm: todas as tentativas contam e a CVM é a maior;
 * - tarefa: as gravações são emendadas na ordem da lista, e os tempos das contrações contam dessa
 *   tarefa emendada.
 */
export function resumirSessao(
  etapas: readonly EtapaDeSinal[],
  fsHz: number,
  canal: CanalEmg,
): ResumoSessao {
  validarFs(fsHz);
  const avisos: string[] = [];
  const repousos = etapas.filter((e) => e.tipo === 'repouso' && e.amostras.length > 0);
  const cvms = etapas.filter((e) => e.tipo === 'cvm' && e.amostras.length > 0);
  const tarefas = etapas.filter((e) => e.tipo === 'tarefa' && e.amostras.length > 0);
  for (const e of etapas) {
    if (e.truncada) {
      avisos.push(
        `A etapa "${e.tipo}" atingiu o limite de ${DURACAO_MAX_ETAPA_S} s e foi cortada: o que viesse depois não foi gravado.`,
      );
    }
  }

  let duracaoRepousoS = 0;
  let ruidoBasalRmsUv: number | null = null;
  let repousoRmsUv: number | null = null;
  let qualidade: QualidadeSinal | null = null;
  let linhaDeBase: LinhaDeBase | null = null;
  let basal: Float64Array | null = null;

  if (repousos.length === 0) {
    avisos.push('Sem repouso gravado: o ruído basal não foi medido e as contrações não puderam ser detectadas.');
  } else {
    if (repousos.length > 1) avisos.push('Mais de um repouso gravado: foi usado o último.');
    const repouso = Float64Array.from(repousos[repousos.length - 1].amostras);
    duracaoRepousoS = repouso.length / fsHz;
    repousoRmsUv = rms(repouso);
    qualidade = qualidadeDoSinal(repouso, fsHz);
    ruidoBasalRmsUv = qualidade.ruidoBasalRms;
    if (qualidade.nivel !== 'bom') {
      const nome = qualidade.nivel === 'ruim' ? 'ruim' : 'pede atenção';
      avisos.push(`Qualidade do sinal no repouso: ${nome} (${qualidade.motivos.join('; ')}).`);
    }
    if (ruidoBasalRmsUv > 0 && repousoRmsUv > RAZAO_MAX_REPOUSO_INSTAVEL * ruidoBasalRmsUv) {
      avisos.push(
        'O repouso não ficou estável: houve trechos com bem mais sinal que o resto. Refaça com o músculo relaxado.',
      );
    }
    if (repouso.length < REPOUSO_MIN_S * fsHz) {
      avisos.push(
        `Repouso de ${segundosTexto(duracaoRepousoS)} s é curto demais (mínimo de ${REPOUSO_MIN_S} s): as contrações não foram detectadas. Repita o repouso com o músculo relaxado.`,
      );
    } else {
      // Passo de 1 amostra, para o repouso ter a mesma densidade do envelope da tarefa.
      basal = rmsEmJanelas(repouso, fsHz, JANELA_ENVELOPE_DETECCAO_MS, 1000 / fsHz).rms;
      const { media, desvio } = mediaEDesvio(basal);
      linhaDeBase = {
        mediaUv: media,
        desvioUv: desvio,
        limiarUv: media + K_CONTRACAO * desvio,
        pisoPicoUv: media + PISO_CONTRACAO_UV,
      };
    }
  }

  // Mesma regra de picoEmJanela: tentativa menor que a janela não dá RMS de janela e valeria 0 µV na lista.
  const amostrasDaJanelaCvm = Math.max(1, Math.round((fsHz * JANELA_CVM_MS) / 1000));
  const cvmsValidas = cvms.filter((e) => e.amostras.length >= amostrasDaJanelaCvm);
  const cvmsCurtas = cvms.length - cvmsValidas.length;
  const tentativas = cvmsValidas.map((e) => e.amostras);
  const { cvm, porTentativa } = cvmDeTentativas(tentativas, fsHz, JANELA_CVM_MS);
  const cvmUv = cvm > 0 ? cvm : null;
  if (cvms.length === 0) {
    avisos.push('Sem CVM gravada: os valores ficam em µV e não puderam ser normalizados em % da CVM.');
  } else if (cvmUv === null) {
    avisos.push(
      `As tentativas de CVM têm menos de ${JANELA_CVM_MS / 1000} s: não foi possível calcular a CVM. Grave de novo, mantendo a contração máxima por alguns segundos.`,
    );
  } else {
    if (cvmsCurtas > 0) {
      avisos.push(
        `${cvmsCurtas} ${plural(cvmsCurtas, 'tentativa', 'tentativas')} de CVM com menos de ${JANELA_CVM_MS / 1000} s ${plural(cvmsCurtas, 'foi ignorada', 'foram ignoradas')}.`,
      );
    }
    if (tentativas.length < PROTOCOLO_SESSAO.cvmTentativas) {
      avisos.push(
        `Só ${tentativas.length} ${plural(tentativas.length, 'tentativa', 'tentativas')} de CVM (o protocolo prevê ${PROTOCOLO_SESSAO.cvmTentativas}).`,
      );
    }
    if (ruidoBasalRmsUv !== null && cvmUv < RAZAO_MIN_CVM_RUIDO * ruidoBasalRmsUv) {
      avisos.push(
        `A CVM (${uvTexto(cvmUv)} µV) está muito perto do ruído de repouso (${uvTexto(ruidoBasalRmsUv)} µV): confira se houve contração máxima e se o eletrodo está bem colado.`,
      );
    }
  }

  const duracaoTarefaS = tarefas.reduce((soma, e) => soma + e.amostras.length, 0) / fsHz;
  let contracoes: ContracaoResumo[] = [];
  if (tarefas.length > 1) {
    avisos.push('Mais de uma gravação de tarefa: os tempos das contrações contam as gravações emendadas.');
  }
  if (tarefas.length > 0 && basal !== null && linhaDeBase !== null) {
    const envelope = envelopeRms(concatenar(tarefas), fsHz, JANELA_ENVELOPE_DETECCAO_MS);
    const detectadas = detectarContracoes(envelope, fsHz, {
      repouso: basal,
      k: K_CONTRACAO,
      duracaoMinMs: DURACAO_MIN_CONTRACAO_MS,
      juntarMs: JUNTAR_CONTRACOES_MS,
    });
    const { pisoPicoUv } = linhaDeBase;
    contracoes = detectadas
      .filter((c) => c.picoUv >= pisoPicoUv)
      .map((c) => ({
        inicioS: c.inicioS,
        fimS: c.fimS,
        duracaoS: c.duracaoS,
        picoUv: c.picoUv,
        rmsMedioUv: c.rmsMedioUv,
        picoPctCvm: cvmUv === null ? null : normalizarPorCVM(c.picoUv, cvmUv),
        rmsMedioPctCvm: cvmUv === null ? null : normalizarPorCVM(c.rmsMedioUv, cvmUv),
      }));
    if (contracoes.length === 0) avisos.push('Nenhuma contração detectada na tarefa.');
  }

  let picoPctCvmMax: number | null = null;
  for (const c of contracoes) {
    if (c.picoPctCvm !== null && (picoPctCvmMax === null || c.picoPctCvm > picoPctCvmMax)) {
      picoPctCvmMax = c.picoPctCvm;
    }
  }

  // A sessão só recebe o sinal já filtrado, e depois de um passa-alta o platô da saturação deixa de ser exato.
  if (cvms.length > 0 || tarefas.length > 0) {
    avisos.push(
      'A qualidade do sinal vale só para o repouso e foi medida depois do filtro. A saturação do sensor não é verificada na CVM nem na tarefa: se ele saturar na contração máxima, a CVM fica subestimada e o % da CVM, inflado.',
    );
  }

  return {
    canal: { id: canal.id, musculo: canal.musculo, lado: canal.lado },
    duracaoRepousoS,
    duracaoTarefaS,
    ruidoBasalRmsUv,
    repousoRmsUv,
    qualidade,
    linhaDeBase,
    tentativasCvm: tentativas.length,
    cvmPorTentativaUv: porTentativa,
    cvmUv,
    contracoes,
    picoPctCvmMax,
    avisos,
  };
}

export interface DadosExameEmg {
  versao: 1;
  fsHz: number;
  canais: CanalEmg[];
  parametros: ParametrosAnalise;
  resumo: ResumoSessao;
  etapas: Array<{
    tipo: TipoEtapa;
    duracaoS: number;
    /** RMS de 50 ms, um valor a cada 50 ms (20 Hz), arredondado a 0,1 µV. */
    envelope20Hz: number[];
  }>;
  observacoes: string | null;
}

function arred(v: number, casas: number): number {
  const f = 10 ** casas;
  return Math.round(v * f) / f;
}

function arredOuNulo(v: number | null, casas: number): number | null {
  return v === null ? null : arred(v, casas);
}

// O resumo guardado não precisa de 15 casas decimais: µV a 0,01, % a 0,1 e tempos a 1 ms.
function resumoParaGravar(r: ResumoSessao): ResumoSessao {
  return {
    canal: { id: r.canal.id, musculo: r.canal.musculo, lado: r.canal.lado },
    duracaoRepousoS: arred(r.duracaoRepousoS, 3),
    duracaoTarefaS: arred(r.duracaoTarefaS, 3),
    ruidoBasalRmsUv: arredOuNulo(r.ruidoBasalRmsUv, 2),
    repousoRmsUv: arredOuNulo(r.repousoRmsUv, 2),
    qualidade:
      r.qualidade === null
        ? null
        : {
            ...r.qualidade,
            ruidoBasalRms: arred(r.qualidade.ruidoBasalRms, 2),
            contaminacaoRede: arred(r.qualidade.contaminacaoRede, 3),
            motivos: [...r.qualidade.motivos],
          },
    linhaDeBase:
      r.linhaDeBase === null
        ? null
        : {
            mediaUv: arred(r.linhaDeBase.mediaUv, 2),
            desvioUv: arred(r.linhaDeBase.desvioUv, 3),
            limiarUv: arred(r.linhaDeBase.limiarUv, 2),
            pisoPicoUv: arred(r.linhaDeBase.pisoPicoUv, 2),
          },
    tentativasCvm: r.tentativasCvm,
    cvmPorTentativaUv: r.cvmPorTentativaUv.map((v) => arred(v, 2)),
    cvmUv: arredOuNulo(r.cvmUv, 2),
    contracoes: r.contracoes.map((c) => ({
      inicioS: arred(c.inicioS, 3),
      fimS: arred(c.fimS, 3),
      duracaoS: arred(c.duracaoS, 3),
      picoUv: arred(c.picoUv, 2),
      rmsMedioUv: arred(c.rmsMedioUv, 2),
      picoPctCvm: arredOuNulo(c.picoPctCvm, 1),
      rmsMedioPctCvm: arredOuNulo(c.rmsMedioPctCvm, 1),
    })),
    picoPctCvmMax: arredOuNulo(r.picoPctCvmMax, 1),
    avisos: [...r.avisos],
  };
}

/**
 * Monta o JSON do exame (coluna `dados` de exames_presenciais). Não leva o sinal bruto (pesado e
 * dado biométrico bruto): só o envelope RMS de 50 ms a 20 Hz de cada etapa, o resumo e os
 * parâmetros usados na análise.
 */
export function paraGravar(
  resumo: ResumoSessao,
  etapas: readonly EtapaDeSinal[],
  fsHz: number,
  canal: CanalEmg,
  observacoes?: string,
): DadosExameEmg {
  validarFs(fsHz);
  const texto = observacoes?.trim() ?? '';
  return {
    versao: 1,
    fsHz,
    canais: [{ id: canal.id, musculo: canal.musculo, lado: canal.lado }],
    parametros: {
      ...PARAMETROS_ANALISE,
      janelas: { ...PARAMETROS_ANALISE.janelas },
    },
    resumo: resumoParaGravar(resumo),
    etapas: etapas.map((e) => ({
      tipo: e.tipo,
      duracaoS: arred(e.amostras.length / fsHz, 3),
      envelope20Hz: Array.from(
        rmsEmJanelas(e.amostras, fsHz, JANELA_ENVELOPE_SALVO_MS, JANELA_ENVELOPE_SALVO_MS).rms,
        (v) => arred(v, 1),
      ),
    })),
    observacoes: texto === '' ? null : texto,
  };
}

/** "Quadríceps D", "Quadríceps" (sem lado) ou "canal 1" (sem nome de músculo). */
export function rotuloDoCanal(canal: CanalEmg): string {
  const musculo = canal.musculo.trim() === '' ? `canal ${canal.id}` : canal.musculo.trim();
  return canal.lado === '-' ? musculo : `${musculo} ${canal.lado}`;
}

/**
 * Uma frase para `exames_presenciais.resumo`: descreve o que foi medido, sem interpretar.
 * Ex.: "EMG de superfície — Quadríceps D: CVM de 245 µV; 4 contrações, pico de 63 % da CVM."
 */
export function resumoCurto(resumo: ResumoSessao, canal: CanalEmg): string {
  const partes: string[] = [];
  partes.push(resumo.cvmUv === null ? 'sem CVM registrada' : `CVM de ${uvTexto(resumo.cvmUv)} µV`);

  const n = resumo.contracoes.length;
  if (resumo.duracaoTarefaS === 0) {
    partes.push('tarefa não gravada');
  } else if (resumo.linhaDeBase === null) {
    partes.push('contrações não detectadas (sem repouso utilizável)');
  } else if (n === 0) {
    partes.push('nenhuma contração detectada na tarefa');
  } else {
    let texto = `${n} ${plural(n, 'contração', 'contrações')}`;
    if (resumo.picoPctCvmMax !== null) {
      texto += `, pico de ${pctTexto(resumo.picoPctCvmMax)} % da CVM`;
    } else {
      const maior = Math.max(...resumo.contracoes.map((c) => c.picoUv));
      texto += `, pico de ${uvTexto(maior)} µV absolutos (sem normalização pela CVM; não comparáveis entre pessoas ou sessões)`;
    }
    partes.push(texto);
  }
  return `EMG de superfície — ${rotuloDoCanal(canal)}: ${partes.join('; ')}.`;
}

function linhaContracao(c: ContracaoResumo, i: number): string {
  const comPct = (uv: number, pct: number | null): string =>
    pct === null ? `${uvTexto(uv)} µV` : `${uvTexto(uv)} µV (${pctTexto(pct)} % da CVM)`;
  return (
    `${i + 1}. início em ${segundosTexto(c.inicioS)} s, duração de ${segundosTexto(c.duracaoS)} s, ` +
    `pico de ${comPct(c.picoUv, c.picoPctCvm)}, RMS médio de ${comPct(c.rmsMedioUv, c.rmsMedioPctCvm)}.`
  );
}

/**
 * Texto descritivo em português para o campo "resultado" do exame. Só descreve o registro; a
 * interpretação é do profissional.
 */
export function laudoTexto(resumo: ResumoSessao, canal: CanalEmg, observacoes?: string): string {
  const linhas: string[] = [];
  linhas.push(`Eletromiografia (EMG) de superfície — ${rotuloDoCanal(canal)}`);
  linhas.push('');
  linhas.push(
    'Medida de apoio à avaliação, feita com sensor de EMG de superfície sem fio. Este texto descreve o sinal registrado; a interpretação é do profissional.',
  );
  linhas.push('');

  if (resumo.linhaDeBase === null && resumo.repousoRmsUv === null) {
    linhas.push('Repouso: não gravado.');
  } else {
    let repouso = `Repouso: ${segundosTexto(resumo.duracaoRepousoS)} s gravados`;
    if (resumo.ruidoBasalRmsUv !== null) repouso += `; ruído basal de ${uvTexto(resumo.ruidoBasalRmsUv)} µV (RMS)`;
    if (resumo.repousoRmsUv !== null) repouso += `; RMS do repouso de ${uvTexto(resumo.repousoRmsUv)} µV`;
    if (resumo.qualidade !== null) {
      const nomes = { bom: 'boa', atencao: 'pede atenção', ruim: 'ruim' } as const;
      repouso += `; qualidade do sinal: ${nomes[resumo.qualidade.nivel]}`;
    }
    linhas.push(`${repouso}.`);
  }

  if (resumo.cvmUv === null) {
    linhas.push(
      'CVM (contração voluntária máxima): não registrada; os valores ficam em µV absolutos, sem normalização pela CVM, e não são comparáveis entre pessoas nem entre sessões.',
    );
  } else {
    const porTentativa = resumo.cvmPorTentativaUv.map(uvTexto).join(' · ');
    linhas.push(
      `CVM (contração voluntária máxima): ${resumo.tentativasCvm} ${plural(resumo.tentativasCvm, 'tentativa', 'tentativas')} (${porTentativa} µV); referência adotada de ${uvTexto(resumo.cvmUv)} µV, o maior RMS em janela de ${JANELA_CVM_MS / 1000} s.`,
    );
  }

  if (resumo.duracaoTarefaS === 0) {
    linhas.push('Tarefa: não gravada.');
  } else if (resumo.linhaDeBase === null) {
    linhas.push(
      `Tarefa: ${segundosTexto(resumo.duracaoTarefaS)} s gravados; contrações não detectadas por falta de um repouso utilizável.`,
    );
  } else {
    const n = resumo.contracoes.length;
    linhas.push(
      `Tarefa: ${segundosTexto(resumo.duracaoTarefaS)} s gravados; ${n === 0 ? 'nenhuma contração detectada' : `${n} ${plural(n, 'contração detectada', 'contrações detectadas')}`}.`,
    );
    linhas.push(
      `Critério de detecção: envelope RMS de ${JANELA_ENVELOPE_DETECCAO_MS} ms acima da média do repouso mais ${K_CONTRACAO} desvios-padrão, ` +
        `com pico de pelo menos ${PISO_CONTRACAO_UV} µV acima da média do repouso, por no mínimo ${DURACAO_MIN_CONTRACAO_MS} ms.`,
    );
  }

  if (resumo.contracoes.length > 0) {
    linhas.push('');
    linhas.push('Contrações na tarefa:');
    const listadas = resumo.contracoes.slice(0, MAX_CONTRACOES_NO_LAUDO);
    listadas.forEach((c, i) => linhas.push(linhaContracao(c, i)));
    const restantes = resumo.contracoes.length - listadas.length;
    if (restantes > 0) {
      linhas.push(`… e mais ${restantes} ${plural(restantes, 'contração', 'contrações')} nos dados do exame.`);
    }
    if (resumo.picoPctCvmMax !== null) {
      linhas.push(`Maior pico: ${pctTexto(resumo.picoPctCvmMax)} % da CVM.`);
    }
  }

  if (resumo.avisos.length > 0) {
    linhas.push('');
    linhas.push('Avisos do registro:');
    for (const aviso of resumo.avisos) linhas.push(`- ${aviso}`);
  }

  const notas = observacoes?.trim() ?? '';
  if (notas !== '') {
    linhas.push('');
    linhas.push(`Observações do profissional: ${notas}`);
  }

  linhas.push('');
  linhas.push(
    'Ressalva: os valores em µV absolutos dependem do eletrodo, da preparação da pele e da posição do sensor, e não foram calibrados contra um padrão; ' +
      'por isso a comparação entre sessões ou entre pessoas deve usar o % da CVM, com o mesmo posicionamento. A interpretação é do profissional.',
  );
  return linhas.join('\n');
}

// Sem o BOM o Excel abre o UTF-8 como ANSI.
const BOM_UTF8 = String.fromCharCode(0xfeff);

/**
 * CSV do sinal filtrado: etapa, tempo_s, sinal_uV. O tempo conta desde o começo de cada etapa; a etapa
 * é o tipo seguido da posição entre as do mesmo tipo (repouso_1, cvm_1, cvm_2, tarefa_1...).
 * Feito para abrir direto no Excel em português do Brasil: separador ";", vírgula decimal e BOM UTF-8
 * no começo (sem ele o Excel lê os acentos errado). Cabeçalho na primeira linha, amostra não finita
 * vira célula vazia. Vazio ("", sem BOM) se não há nenhuma amostra.
 */
export function csvDoSinal(etapas: readonly EtapaDeSinal[], fsHz: number): string {
  validarFs(fsHz);
  if (etapas.every((e) => e.amostras.length === 0)) return '';
  const linhas: string[] = ['etapa;tempo_s;sinal_uV'];
  const contagem: Record<string, number> = {};
  for (const e of etapas) {
    contagem[e.tipo] = (contagem[e.tipo] ?? 0) + 1;
    const nome = `${e.tipo}_${contagem[e.tipo]}`;
    for (let i = 0; i < e.amostras.length; i++) {
      const v = e.amostras[i];
      const tempo = String(Math.round((i / fsHz) * 1e6) / 1e6).replace('.', ',');
      const valor = Number.isFinite(v) ? String(Math.round(v * 1000) / 1000).replace('.', ',') : '';
      linhas.push(`${nome};${tempo};${valor}`);
    }
  }
  return `${BOM_UTF8}${linhas.join('\n')}\n`;
}
