// Módulo EMG "RunE W2" simulado: serve para testar o serviço sem o aparelho e para o modo
// demonstração da tela. Fala o protocolo de docs/emg-protocolo-runew2.md, byte a byte.
//
// SUPOSIÇÕES (a spec não confirma; o aparelho real pode ser diferente):
// - O carimbo (ts48) do quadro bruto é o instante do ÚLTIMO ponto do quadro, como no RMS, contado
//   no relógio do módulo: EPOCA_RELOGIO_MODULO_MS + ms desde que o módulo "ligou" (o relógio corre
//   com avancar(), mesmo parado). O ts enviado no comando 0x11 é ignorado.
// - A amostra-base (float32) do quadro é a 1ª amostra dele: um quadro de N amostras tem N-1 deltas.
// - O byte entre o último dado e o 5A existe (XOR de LEN até o último dado) ou não, conforme
//   comByteAntesDoFim. Com ele o LEN é sempre par; sem ele, ímpar.
// - Respostas de texto (0x01/0x02): o decodificador descarta os 2 últimos bytes antes do 5A. Sem o
//   byte extra, o simulador acrescenta um 0x00 ao texto para o último caractere não se perder.
// - A confirmação (ack) é um quadro sem dados, com o ADDR do comando. Em endereços que também têm
//   resposta própria (0x06, 0x17, 0x1D), interpretarQuadro lê o byte extra como se fosse dado.
// - Perder a conexão não para a aquisição do módulo: os quadros do intervalo se perdem (o ts48 salta)
//   e, ao religar, o app precisa assinar a fff4 de novo.
//
// NÃO simulado: modos 1 (RMS), 2 e 4 do 0x11 (só recebem confirmação, sem dados), histórico 0x07,
// filtro do hardware (o sinal sai sempre "cru"), sleep/desligar.
//
// Entrega no Bluetooth simulado: dados vindos de avancar() chegam na hora (latenciaMs 0); respostas
// a comandos chegam sempre DEPOIS de a escrita terminar, como num aparelho real, para o serviço
// poder esperar a confirmação depois de escrever.

import {
  DIVISOR_EEG,
  DIVISOR_EMG,
  ENDERECO,
  EPOCA_RELOGIO_MODULO_MS,
  MODO,
  UUID_ESCRITA,
  UUID_NOTIFICACAO,
  UUID_SERVICO,
  type CanalBruto,
  type ModeloHardware,
} from "./protocolo";
import { FiltroIIR, projetarPassaAltaButterworth, type Secao } from "./filtros";
import type {
  CaracteristicaBle,
  DispositivoBle,
  EventoValorBle,
  OpcoesRequestDevice,
  PropriedadesBle,
  ServicoBle,
  ServidorGattBle,
  TransporteBle,
} from "./tiposBle";

export const VERSAO_HARDWARE_SIMULADA = "RunE-W2 HW 1.0 (simulado)";
export const VERSAO_SOFTWARE_SIMULADA = "RunE-W2 FW 1.0.0 (simulado)";

/** RMS (µV) do ruído de repouso quando ruidoBasalUv não é informado. */
export const RUIDO_BASAL_PADRAO_UV = 2;
export const REDE_HZ_PADRAO = 60;
/** Duração de cada rampa (subida e descida) de uma rajada; rajada curta usa metade da duração. */
export const RAMPA_RAJADA_S = 0.05;
/** Máximo de amostras por quadro bruto: 1 base + 115 deltas (LEN <= 244). */
export const MAX_AMOSTRAS_POR_QUADRO = 116;

const QUADRO_INICIO = 0xa5;
const QUADRO_FIM = 0x5a;
const COMANDO_INICIO = 0xaa;
const COMANDO_FIM = 0xbb;
const RW_ESCRITA = 0x80;
const RW_LEITURA = 0x81;
const LEN_MAXIMO_DADOS = 244;
const LEN_MAXIMO = 255;
const DELTA_MAXIMO = 32767;
const TS48_LIMITE = 2 ** 48;
const MODELOS: readonly ModeloHardware[] = ["EMG-Module", "EEG-Module", "EMG-Pro", "EEG-Pro"];

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

function exigirFinito(nome: string, valor: number): void {
  if (!Number.isFinite(valor)) {
    throw new RangeError(`${nome} deve ser um número finito (recebido ${valor})`);
  }
}

function exigirPositivo(nome: string, valor: number): void {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new RangeError(`${nome} deve ser finito e > 0 (recebido ${valor})`);
  }
}

function exigirNaoNegativo(nome: string, valor: number): void {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new RangeError(`${nome} deve ser finito e >= 0 (recebido ${valor})`);
  }
}

function exigirInteiroEntre(nome: string, valor: number, minimo: number, maximo: number): void {
  if (!Number.isInteger(valor) || valor < minimo || valor > maximo) {
    throw new RangeError(`${nome} deve ser um inteiro em ${minimo}..${maximo} (recebido ${valor})`);
  }
}

function ehByte(valor: number): boolean {
  return Number.isInteger(valor) && valor >= 0 && valor <= 0xff;
}

// ---------------------------------------------------------------------------
// Sinal sintético
// ---------------------------------------------------------------------------

export interface RajadaEmg {
  inicioS: number;
  fimS: number;
  /** Amplitude de pico de uma senoide equivalente: o RMS da rajada é amplitudeUv / √2. */
  amplitudeUv: number;
}

export interface OpcoesSinalEmg {
  fsHz: number;
  duracaoS: number;
  /** Inteiro de 32 bits (a parte fracionária é descartada). */
  semente: number;
  rajadas?: RajadaEmg[];
  /** RMS do ruído de repouso, em µV (padrão RUIDO_BASAL_PADRAO_UV). */
  ruidoBasalUv?: number;
  /** Frequência da rede (padrão 60 Hz); só tem efeito com redeUv > 0. */
  redeHz?: number;
  /** Amplitude de pico da senoide da rede somada ao sinal, em µV (padrão 0: sem rede). */
  redeUv?: number;
}

function mulberry32(semente: number): () => number {
  let estado = Math.trunc(semente) >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = Math.imul(estado ^ (estado >>> 15), estado | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Passa-baixa de Butterworth em seções de 2ª ordem, pela mesma transformada bilinear de filtros.ts. */
function projetarPassaBaixaButterworth(ordem: number, fcHz: number, fsHz: number): Secao[] {
  const t = Math.tan((Math.PI * fcHz) / fsHz);
  const t2 = t * t;
  const secoes: Secao[] = [];
  for (let k = 1; k <= ordem / 2; k++) {
    const theta = (Math.PI * (2 * k - 1)) / (2 * ordem);
    const dt = 2 * Math.sin(theta) * t;
    const d0 = 1 + dt + t2;
    secoes.push({
      b0: t2 / d0,
      b1: (2 * t2) / d0,
      b2: t2 / d0,
      a1: (2 * (t2 - 1)) / d0,
      a2: (1 - dt + t2) / d0,
    });
  }
  return secoes;
}

const BANDA_PASSA_ALTA_HZ = 20;
// 0,9·Nyquist: 450 Hz a 1 kHz, 225 Hz a 500 Hz (a 500 Hz não cabe 450 Hz).
const FRACAO_PASSA_BAIXA = 0.45;
const ORDEM_FILTRO_BANDA = 4;
const AQUECIMENTO_S = 0.5;
const RESPOSTA_IMPULSIVA_AMOSTRAS = 4096;

/** Soma de h²: quanto o filtro multiplica a variância de um ruído branco de variância 1. */
function ganhoDePotencia(secoes: Secao[]): number {
  const filtro = new FiltroIIR(secoes);
  let soma = 0;
  for (let i = 0; i < RESPOSTA_IMPULSIVA_AMOSTRAS; i++) {
    const y = filtro.processar(i === 0 ? 1 : 0);
    soma += y * y;
  }
  return soma;
}

/** Ruído branco gaussiano filtrado (≈ 20 Hz a 0,45·fs), com variância 1 em regime. */
class RuidoDeBandaLarga {
  private readonly sorteio: () => number;
  private readonly filtro: FiltroIIR;
  private readonly escala: number;
  private reserva: number | null = null;

  constructor(fsHz: number, semente: number) {
    this.sorteio = mulberry32(semente);
    const secoes = [
      ...projetarPassaAltaButterworth(ORDEM_FILTRO_BANDA, BANDA_PASSA_ALTA_HZ, fsHz),
      ...projetarPassaBaixaButterworth(ORDEM_FILTRO_BANDA, FRACAO_PASSA_BAIXA * fsHz, fsHz),
    ];
    this.filtro = new FiltroIIR(secoes);
    this.escala = 1 / Math.sqrt(ganhoDePotencia(secoes));
    // O filtro parte do repouso; jogar fora o transiente evita um começo "calmo" demais.
    const aquecimento = Math.ceil(fsHz * AQUECIMENTO_S);
    for (let i = 0; i < aquecimento; i++) this.filtro.processar(this.gaussiano());
  }

  proximo(): number {
    return this.filtro.processar(this.gaussiano()) * this.escala;
  }

  // Box-Muller: cada par de uniformes rende dois gaussianos.
  private gaussiano(): number {
    if (this.reserva !== null) {
      const valor = this.reserva;
      this.reserva = null;
      return valor;
    }
    const u1 = 1 - this.sorteio();
    const u2 = this.sorteio();
    const raio = Math.sqrt(-2 * Math.log(u1));
    this.reserva = raio * Math.sin(2 * Math.PI * u2);
    return raio * Math.cos(2 * Math.PI * u2);
  }
}

/** 0 fora da rajada, 1 no platô, cosseno elevado nas rampas (dentro de [inicioS, fimS)). */
function envoltoria(tS: number, rajada: RajadaEmg): number {
  if (tS < rajada.inicioS || tS >= rajada.fimS) return 0;
  const rampa = Math.min(RAMPA_RAJADA_S, (rajada.fimS - rajada.inicioS) / 2);
  const distanciaDaBorda = Math.min(tS - rajada.inicioS, rajada.fimS - tS);
  if (distanciaDaBorda >= rampa) return 1;
  return 0.5 * (1 - Math.cos((Math.PI * distanciaDaBorda) / rampa));
}

interface ConfiguracaoDoGerador {
  fsHz: number;
  semente: number;
  ruidoBasalUv: number;
  redeHz: number;
  redeUv: number;
}

/**
 * Ruído de banda larga com amplitude modulada: o RMS local é
 * √(basal² + Σ (A/√2 · envoltória)²), então no platô de uma rajada vale √(basal² + A²/2).
 * A rede entra somada, sem passar pela envoltória. Chame amostra() com i = 0, 1, 2, ... em ordem.
 */
class GeradorDeSinal {
  private readonly ruido: RuidoDeBandaLarga;
  private readonly faseRede: number;

  constructor(private readonly cfg: ConfiguracaoDoGerador) {
    this.ruido = new RuidoDeBandaLarga(cfg.fsHz, cfg.semente);
    // Sorteio à parte: ligar ou desligar a rede não muda o ruído.
    this.faseRede = 2 * Math.PI * mulberry32((Math.trunc(cfg.semente) >>> 0) ^ 0x5bd1e995)();
  }

  amostra(i: number, rajadas: readonly RajadaEmg[]): number {
    const { fsHz, ruidoBasalUv, redeHz, redeUv } = this.cfg;
    const tS = i / fsHz;
    let variancia = ruidoBasalUv * ruidoBasalUv;
    for (const rajada of rajadas) {
      const e = envoltoria(tS, rajada);
      if (e > 0) {
        const rms = (rajada.amplitudeUv / Math.SQRT2) * e;
        variancia += rms * rms;
      }
    }
    let valor = this.ruido.proximo() * Math.sqrt(variancia);
    if (redeUv > 0) valor += redeUv * Math.sin(2 * Math.PI * redeHz * tS + this.faseRede);
    return valor;
  }
}

function validarRajada(rajada: RajadaEmg, rotulo: string): void {
  exigirFinito(`${rotulo}.inicioS`, rajada.inicioS);
  exigirFinito(`${rotulo}.fimS`, rajada.fimS);
  if (!(rajada.fimS > rajada.inicioS)) {
    throw new RangeError(`${rotulo}: fimS (${rajada.fimS}) deve ser maior que inicioS (${rajada.inicioS})`);
  }
  exigirNaoNegativo(`${rotulo}.amplitudeUv`, rajada.amplitudeUv);
}

function configurarGerador(
  fsHz: number,
  semente: number,
  ruidoBasalUv: number,
  redeHz: number,
  redeUv: number,
): ConfiguracaoDoGerador {
  exigirPositivo("fsHz", fsHz);
  exigirFinito("semente", semente);
  exigirNaoNegativo("ruidoBasalUv", ruidoBasalUv);
  exigirNaoNegativo("redeUv", redeUv);
  if (redeUv > 0 && !(redeHz > 0 && redeHz < fsHz / 2)) {
    throw new RangeError(`redeHz deve estar em (0, fs/2) = (0, ${fsHz / 2}) Hz (recebido ${redeHz})`);
  }
  return { fsHz, semente, ruidoBasalUv, redeHz, redeUv };
}

/**
 * Sinal de EMG em µV: ruído de banda larga (≈ 20 Hz a 0,45·fs) com rajadas de amplitude controlada.
 * Sem rajada o RMS é ruidoBasalUv; no platô da rajada, √(ruidoBasalUv² + amplitudeUv²/2). Determinístico:
 * a mesma semente dá o mesmo sinal (o começo não depende de duracaoS).
 */
export function sinalEmgSintetico(opcoes: OpcoesSinalEmg): Float64Array {
  const {
    fsHz,
    duracaoS,
    semente,
    rajadas = [],
    ruidoBasalUv = RUIDO_BASAL_PADRAO_UV,
    redeHz = REDE_HZ_PADRAO,
    redeUv = 0,
  } = opcoes;
  const cfg = configurarGerador(fsHz, semente, ruidoBasalUv, redeHz, redeUv);
  exigirNaoNegativo("duracaoS", duracaoS);
  rajadas.forEach((rajada, i) => validarRajada(rajada, `rajadas[${i}]`));

  const gerador = new GeradorDeSinal(cfg);
  const n = Math.round(duracaoS * fsHz);
  const saida = new Float64Array(n);
  for (let i = 0; i < n; i++) saida[i] = gerador.amostra(i, rajadas);
  return saida;
}

// ---------------------------------------------------------------------------
// Montagem de quadros (sensor -> app): A5 LEN ADDR LEN^ADDR PAYLOAD [extra] 5A
// ---------------------------------------------------------------------------

/** LEN = payload + 2 (+ 1 com byte extra); o total do quadro é LEN + 3. */
function fecharQuadro(
  endereco: number,
  payload: Uint8Array,
  comByteExtra: boolean,
  lenMaximo: number,
): Uint8Array {
  const len = payload.length + 2 + (comByteExtra ? 1 : 0);
  if (len > lenMaximo) {
    throw new RangeError(`quadro com LEN ${len} excede o máximo de ${lenMaximo}`);
  }
  const total = len + 3;
  const quadro = new Uint8Array(total);
  quadro[0] = QUADRO_INICIO;
  quadro[1] = len;
  quadro[2] = endereco;
  quadro[3] = len ^ endereco;
  quadro.set(payload, 4);
  if (comByteExtra) {
    let xor = 0;
    for (let i = 1; i < 4 + payload.length; i++) xor ^= quadro[i];
    quadro[4 + payload.length] = xor;
  }
  quadro[total - 1] = QUADRO_FIM;
  return quadro;
}

/** ts48 big-endian (6 bytes) em `destino` a partir de `pos`: tsMs menos a época do relógio do módulo. */
function escreverTs48(destino: DataView, pos: number, tsMs: number): void {
  exigirFinito("tsMs", tsMs);
  const ts = Math.round(tsMs) - EPOCA_RELOGIO_MODULO_MS;
  if (ts < 0 || ts >= TS48_LIMITE) {
    throw new RangeError(`tsMs fora da faixa do relógio do módulo de 48 bits: ${tsMs}`);
  }
  destino.setUint16(pos, Math.floor(ts / 0x100000000), false);
  destino.setUint32(pos + 2, ts % 0x100000000, false);
}

export interface OpcoesQuadroBruto {
  canal?: CanalBruto;
  /** Padrão true: byte extra (XOR de LEN até o último dado) antes do 5A. */
  comByteAntesDoFim?: boolean;
}

/**
 * Quadro bruto (modo 3 ou 4 do 0x11): 1ª amostra em float32 e, para cada uma das seguintes, um delta
 * int16 em contagens (µV · 3,1457). A quantização é de malha fechada: o delta mira a amostra real a
 * partir da reconstrução que o decodificador terá, então o erro fica em meio degrau e não acumula,
 * mesmo quando um delta satura em ±32767. Aceita de 1 a MAX_AMOSTRAS_POR_QUADRO amostras.
 */
export function montarQuadroBruto(
  amostras: Float64Array,
  tsMs: number,
  opcoes: OpcoesQuadroBruto = {},
): Uint8Array {
  const { canal = "emg", comByteAntesDoFim = true } = opcoes;
  const n = amostras.length;
  if (n < 1) throw new RangeError("o quadro bruto precisa de pelo menos 1 amostra");
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(amostras[i])) {
      throw new RangeError(`amostras[${i}] não é finita: ${amostras[i]}`);
    }
  }
  const divisor = canal === "emg" ? DIVISOR_EMG : DIVISOR_EEG;
  const modo = canal === "emg" ? MODO.EMG : MODO.EEG;
  const deltas = n - 1;

  const payload = new Uint8Array(1 + 6 + 4 + 2 * deltas);
  const dv = new DataView(payload.buffer);
  payload[0] = modo;
  escreverTs48(dv, 1, tsMs);
  let reconstruida = Math.fround(amostras[0]);
  dv.setFloat32(7, amostras[0], true);
  for (let i = 1; i < n; i++) {
    const bruto = Math.round((amostras[i] - reconstruida) * divisor);
    const delta = Math.max(-DELTA_MAXIMO, Math.min(DELTA_MAXIMO, bruto));
    dv.setInt16(11 + 2 * (i - 1), delta, true);
    reconstruida += delta / divisor;
  }
  return fecharQuadro(ENDERECO.AQUISICAO, payload, comByteAntesDoFim, LEN_MAXIMO_DADOS);
}

/**
 * Quadro RMS (modo 1 do 0x11): ts48 do último valor e `valores` uint16 big-endian, um a cada 50 ms.
 */
export function montarQuadroRms(
  valores: number[],
  tsUltimoMs: number,
  opcoes: { comByteAntesDoFim?: boolean } = {},
): Uint8Array {
  const { comByteAntesDoFim = true } = opcoes;
  const payload = new Uint8Array(1 + 6 + 2 * valores.length);
  const dv = new DataView(payload.buffer);
  payload[0] = MODO.RMS;
  escreverTs48(dv, 1, tsUltimoMs);
  valores.forEach((valor, i) => {
    exigirFinito(`valores[${i}]`, valor);
    const inteiro = Math.round(valor);
    exigirInteiroEntre(`valores[${i}]`, inteiro, 0, 0xffff);
    dv.setUint16(7 + 2 * i, inteiro, false);
  });
  return fecharQuadro(ENDERECO.AQUISICAO, payload, comByteAntesDoFim, LEN_MAXIMO_DADOS);
}

/** Resposta genérica: A5 LEN ADDR LEN^ADDR payload [byte extra] 5A. */
export function montarResposta(
  endereco: number,
  payload: ArrayLike<number>,
  opcoes: { comByteAntesDoFim?: boolean } = {},
): Uint8Array {
  const { comByteAntesDoFim = true } = opcoes;
  if (!ehByte(endereco)) throw new RangeError(`endereco fora de 0..255: ${endereco}`);
  const bytes = new Uint8Array(payload.length);
  for (let i = 0; i < payload.length; i++) {
    if (!ehByte(payload[i])) throw new RangeError(`payload[${i}] fora de 0..255: ${payload[i]}`);
    bytes[i] = payload[i];
  }
  return fecharQuadro(endereco, bytes, comByteAntesDoFim, LEN_MAXIMO);
}

// ---------------------------------------------------------------------------
// Módulo simulado
// ---------------------------------------------------------------------------

export interface OpcoesModuloSimulado {
  fsHz?: 500 | 1000;
  semente?: number;
  bateriaPct?: number;
  modelo?: ModeloHardware;
  /** Tamanho máximo de cada notificação (padrão 20, o MTU de 23 sem negociação). */
  mtu?: number;
  /** Amostras por quadro bruto, de 1 a MAX_AMOSTRAS_POR_QUADRO (padrão 50). */
  amostrasPorQuadro?: number;
  comByteAntesDoFim?: boolean;
  /** Amplitude de pico da rede (60 Hz) somada ao sinal, em µV (padrão 0). */
  redeUv?: number;
  ruidoBasalUv?: number;
  /** Se verdadeiro, a leitura do 0x1D devolve o modelo; se falso, o módulo fica mudo (padrão). */
  responderTipoHardware?: boolean;
}

const INTERVALO_RELOGIO_MS = 50;
// Aba em segundo plano pode segurar o timer por minutos: melhor perder tempo do que despejar milhares de quadros.
const MAX_SALTO_RELOGIO_MS = 500;
const MAX_AVANCO_MS = 600_000;

function comandoInvalido(bytes: Uint8Array): string | null {
  const n = bytes.length;
  if (n < 6) return "comando curto demais";
  if (bytes[0] !== COMANDO_INICIO) return "falta o AA inicial";
  if (bytes[n - 1] !== COMANDO_FIM) return "falta o BB final";
  if (bytes[1] !== n - 3) return "LEN não bate com o tamanho";
  if (bytes[2] !== RW_ESCRITA && bytes[2] !== RW_LEITURA) return "RW desconhecido";
  let xor = 0;
  for (let i = 1; i < n - 2; i++) xor ^= bytes[i];
  if (bytes[n - 2] !== xor) return "XOR não confere";
  return null;
}

function textoEmBytes(texto: string): number[] {
  return Array.from(texto, (c) => c.charCodeAt(0) & 0x7f);
}

export class ModuloSimulado {
  /** Cada pedaço (no máximo mtu bytes) que o módulo notificaria pela característica fff4. */
  aoNotificar: (pedaco: Uint8Array) => void = () => undefined;
  /** Preenchido por criarBluetoothSimulado: derruba a conexão simulada. */
  derrubarConexao?: () => void;
  /** Comandos válidos recebidos, na ordem (cópias). */
  readonly comandosRecebidos: Uint8Array[] = [];
  /** Comandos descartados por AA/BB, LEN, RW ou XOR errado (cópias). */
  readonly comandosInvalidos: Uint8Array[] = [];
  bateriaPct: number;

  readonly fsHz: 500 | 1000;
  readonly modelo: ModeloHardware;
  readonly mtu: number;
  readonly amostrasPorQuadro: number;
  readonly comByteAntesDoFim: boolean;

  private readonly semente: number;
  private readonly ruidoBasalUv: number;
  private readonly redeUv: number;
  private readonly responderTipoHardware: boolean;
  private readonly contracoes: RajadaEmg[] = [];

  private emAquisicao = false;
  private gerador: GeradorDeSinal | null = null;
  private relogioMs = 0;
  private inicioAquisicaoMs = 0;
  private decorridoMs = 0;
  private geradas = 0;
  private buffer: Float64Array;
  private noBuffer = 0;
  private perdasPendentes = 0;
  private emitidos = 0;
  private perdidos = 0;
  private temporizador: ReturnType<typeof setInterval> | null = null;

  constructor(opcoes: OpcoesModuloSimulado = {}) {
    const {
      fsHz = 1000,
      semente = 1,
      bateriaPct = 85,
      modelo = "EMG-Module",
      mtu = 20,
      amostrasPorQuadro = 50,
      comByteAntesDoFim = true,
      redeUv = 0,
      ruidoBasalUv = RUIDO_BASAL_PADRAO_UV,
      responderTipoHardware = false,
    } = opcoes;
    if (fsHz !== 500 && fsHz !== 1000) throw new RangeError(`fsHz deve ser 500 ou 1000 (recebido ${fsHz})`);
    exigirFinito("semente", semente);
    exigirNaoNegativo("bateriaPct", bateriaPct);
    if (bateriaPct > 100) throw new RangeError(`bateriaPct deve estar em 0..100 (recebido ${bateriaPct})`);
    if (!MODELOS.includes(modelo)) throw new RangeError(`modelo desconhecido: ${modelo}`);
    exigirInteiroEntre("mtu", mtu, 1, 0xffff);
    exigirInteiroEntre("amostrasPorQuadro", amostrasPorQuadro, 1, MAX_AMOSTRAS_POR_QUADRO);
    exigirNaoNegativo("ruidoBasalUv", ruidoBasalUv);
    exigirNaoNegativo("redeUv", redeUv);

    this.fsHz = fsHz;
    this.semente = semente;
    this.bateriaPct = Math.round(bateriaPct);
    this.modelo = modelo;
    this.mtu = mtu;
    this.amostrasPorQuadro = amostrasPorQuadro;
    this.comByteAntesDoFim = comByteAntesDoFim;
    this.redeUv = redeUv;
    this.ruidoBasalUv = ruidoBasalUv;
    this.responderTipoHardware = responderTipoHardware;
    this.buffer = new Float64Array(amostrasPorQuadro);
  }

  /** Verdadeiro entre o 0x11 modo 3 e o 0x11 modo 0. */
  get adquirindo(): boolean {
    return this.emAquisicao;
  }

  /** Segundos de sinal gerados desde o início da aquisição atual (0 fora dela); é a base de tempo de contrair(). */
  get tempoS(): number {
    return this.geradas / this.fsHz;
  }

  /** Quadros brutos entregues por aoNotificar. */
  get quadrosEmitidos(): number {
    return this.emitidos;
  }

  /** Quadros brutos descartados por perderQuadros(). */
  get quadrosPerdidos(): number {
    return this.perdidos;
  }

  /**
   * Agenda uma rajada de contração, em segundos desde o início da aquisição (o 1º ponto é o instante
   * 0; use tempoS para "agora"). Vale também antes de iniciar. Cada início de aquisição recomeça o
   * sinal da semente e reaplica as rajadas agendadas; limparContracoes() as esquece.
   */
  contrair(inicioS: number, duracaoS: number, amplitudeUv: number): void {
    exigirFinito("inicioS", inicioS);
    exigirPositivo("duracaoS", duracaoS);
    const rajada = { inicioS, fimS: inicioS + duracaoS, amplitudeUv };
    validarRajada(rajada, "contracao");
    this.contracoes.push(rajada);
  }

  limparContracoes(): void {
    this.contracoes.length = 0;
  }

  /** Descarta os próximos n quadros brutos; o relógio segue, então o ts48 dá um salto. */
  perderQuadros(n: number): void {
    exigirInteiroEntre("n", n, 0, Number.MAX_SAFE_INTEGER);
    this.perdasPendentes += n;
  }

  /** Um comando completo (o que uma escrita em fff3 entrega). */
  receberComando(bytes: Uint8Array): void {
    const copia = Uint8Array.from(bytes);
    if (comandoInvalido(copia) !== null) {
      this.comandosInvalidos.push(copia);
      return;
    }
    this.comandosRecebidos.push(copia);
    const endereco = copia[3];
    if (copia[2] === RW_LEITURA) {
      this.aoLer(endereco);
    } else {
      this.aoEscrever(endereco, copia.subarray(4, copia.length - 2));
    }
  }

  /**
   * Anda `ms` no relógio do módulo e, se estiver adquirindo, emite os quadros que fecham nesse
   * intervalo. Sem timers: o resultado só depende da sequência de chamadas.
   */
  avancar(ms: number): void {
    exigirNaoNegativo("ms", ms);
    if (ms > MAX_AVANCO_MS) throw new RangeError(`ms excede ${MAX_AVANCO_MS} (recebido ${ms})`);
    this.relogioMs += ms;
    if (!this.emAquisicao) return;
    this.decorridoMs += ms;
    // O epsilon cobre o erro de ponto flutuante em múltiplos exatos de 1/fs.
    const alvo = Math.floor((this.decorridoMs * this.fsHz) / 1000 + 1e-9);
    // emAquisicao entra na condição porque um ouvinte síncrono pode mandar parar no meio do laço.
    while (this.emAquisicao && this.gerador && this.geradas < alvo) {
      const i = this.geradas++;
      this.buffer[this.noBuffer++] = this.gerador.amostra(i, this.contracoes);
      if (this.noBuffer === this.amostrasPorQuadro) this.fecharQuadroBruto(i);
    }
  }

  /** Para o modo demonstração: chama avancar() com o tempo real decorrido, a cada ~50 ms. */
  iniciarRelogio(): void {
    if (this.temporizador !== null) return;
    let anterior = Date.now();
    this.temporizador = setInterval(() => {
      const agora = Date.now();
      const passou = Math.min(Math.max(0, agora - anterior), MAX_SALTO_RELOGIO_MS);
      anterior = agora;
      if (passou > 0) this.avancar(passou);
    }, INTERVALO_RELOGIO_MS);
  }

  pararRelogio(): void {
    if (this.temporizador === null) return;
    clearInterval(this.temporizador);
    this.temporizador = null;
  }

  private emitir(quadro: Uint8Array): void {
    for (let i = 0; i < quadro.length; i += this.mtu) {
      this.aoNotificar(quadro.slice(i, i + this.mtu));
    }
  }

  private responder(endereco: number, payload: ArrayLike<number>): void {
    this.emitir(montarResposta(endereco, payload, { comByteAntesDoFim: this.comByteAntesDoFim }));
  }

  private responderTexto(endereco: number, texto: string): void {
    const bytes = textoEmBytes(texto);
    if (!this.comByteAntesDoFim) bytes.push(0);
    this.responder(endereco, bytes);
  }

  private aoLer(endereco: number): void {
    switch (endereco) {
      case ENDERECO.VERSAO_HARDWARE:
        this.responderTexto(endereco, VERSAO_HARDWARE_SIMULADA);
        return;
      case ENDERECO.VERSAO_SOFTWARE:
        this.responderTexto(endereco, VERSAO_SOFTWARE_SIMULADA);
        return;
      case ENDERECO.TAXA_AMOSTRAGEM:
        this.responder(endereco, [this.fsHz === 1000 ? 1 : 0]);
        return;
      case ENDERECO.BATERIA: {
        const pct = Math.max(0, Math.min(100, Math.round(this.bateriaPct)));
        // Só o byte f[10] (o 7º do payload) é documentado; os outros são valores plausíveis (tensão em mV).
        const milivolts = 3300 + 9 * pct;
        this.responder(endereco, [0, milivolts >> 8, milivolts & 0xff, 0, 0, 0, pct]);
        return;
      }
      case ENDERECO.TIPO_HARDWARE:
        if (this.responderTipoHardware) this.responder(endereco, [MODELOS.indexOf(this.modelo)]);
        return;
      default:
        this.responder(endereco, []);
    }
  }

  private aoEscrever(endereco: number, dados: Uint8Array): void {
    if (endereco === ENDERECO.AQUISICAO && dados.length > 0) {
      if (dados[0] === MODO.EMG) this.iniciarAquisicao();
      if (dados[0] === MODO.PARAR) this.pararAquisicao();
    }
    this.responder(endereco, []);
  }

  private iniciarAquisicao(): void {
    if (this.emAquisicao) return;
    this.emAquisicao = true;
    this.gerador = new GeradorDeSinal({
      fsHz: this.fsHz,
      semente: this.semente,
      ruidoBasalUv: this.ruidoBasalUv,
      redeHz: REDE_HZ_PADRAO,
      redeUv: this.redeUv,
    });
    this.inicioAquisicaoMs = this.relogioMs;
    this.decorridoMs = 0;
    this.geradas = 0;
    this.noBuffer = 0;
  }

  private pararAquisicao(): void {
    this.emAquisicao = false;
    this.gerador = null;
    this.noBuffer = 0;
    this.geradas = 0;
  }

  private fecharQuadroBruto(indiceDaUltima: number): void {
    const amostras = this.buffer.slice(0, this.noBuffer);
    this.noBuffer = 0;
    if (this.perdasPendentes > 0) {
      this.perdasPendentes--;
      this.perdidos++;
      return;
    }
    const tsMs =
      EPOCA_RELOGIO_MODULO_MS + Math.round(this.inicioAquisicaoMs + (indiceDaUltima * 1000) / this.fsHz);
    this.emitidos++;
    this.emitir(montarQuadroBruto(amostras, tsMs, { canal: "emg", comByteAntesDoFim: this.comByteAntesDoFim }));
  }
}

// ---------------------------------------------------------------------------
// Bluetooth simulado
// ---------------------------------------------------------------------------

const UUID_BASE_CURTO = /^(?:0x)?([0-9a-f]{4})$/;

function normalizarUuid(uuid: string): string {
  const minusculo = uuid.toLowerCase();
  const curto = UUID_BASE_CURTO.exec(minusculo);
  if (curto) return `0000${curto[1]}-0000-1000-8000-00805f9b34fb`;
  return minusculo;
}

function erroBle(nome: string, mensagem: string): Error {
  const erro = new Error(mensagem);
  erro.name = nome;
  return erro;
}

function aguardar(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Como o EventTarget do navegador: um ouvinte que lança não impede os outros nem quem disparou.
function chamarOuvinte<E>(ouvinte: (ev: E) => void, ev: E): void {
  try {
    ouvinte(ev);
  } catch (erro) {
    console.error("[bluetooth simulado] ouvinte lançou uma exceção:", erro);
  }
}

/** Uma conexão GATT: só vale enquanto `ativa`; depois de cair, os objetos dela ficam inertes. */
interface SessaoGatt {
  ativa: boolean;
  servidor: ServidorGattBle;
  notificacao: CaracteristicaSimulada;
}

class CaracteristicaSimulada implements CaracteristicaBle {
  readonly uuid: string;
  readonly properties: PropriedadesBle;
  value?: DataView;
  notificando = false;

  private readonly conexao: ConexaoSimulada;
  private readonly sessao: { ativa: boolean };
  private readonly ouvintes = new Set<(ev: EventoValorBle) => void>();

  constructor(
    uuid: string,
    properties: PropriedadesBle,
    conexao: ConexaoSimulada,
    sessao: { ativa: boolean },
  ) {
    this.uuid = uuid;
    this.properties = properties;
    this.conexao = conexao;
    this.sessao = sessao;
  }

  addEventListener(tipo: "characteristicvaluechanged", ouvinte: (ev: EventoValorBle) => void): void {
    if (tipo === "characteristicvaluechanged") this.ouvintes.add(ouvinte);
  }

  removeEventListener(tipo: "characteristicvaluechanged", ouvinte: (ev: EventoValorBle) => void): void {
    if (tipo === "characteristicvaluechanged") this.ouvintes.delete(ouvinte);
  }

  async startNotifications(): Promise<CaracteristicaSimulada> {
    this.exigirAtiva();
    if (!this.properties.notify && !this.properties.indicate) {
      throw erroBle("NotSupportedError", "GATT Error: Not supported.");
    }
    await this.conexao.aguardarLatencia();
    this.exigirAtiva();
    this.notificando = true;
    return this;
  }

  writeValue(dados: Uint8Array): Promise<void> {
    return this.escrever(dados, false);
  }

  writeValueWithoutResponse(dados: Uint8Array): Promise<void> {
    return this.escrever(dados, true);
  }

  entregar(pedaco: Uint8Array): void {
    this.value = new DataView(pedaco.buffer, pedaco.byteOffset, pedaco.byteLength);
    const ev: EventoValorBle = { target: this };
    for (const ouvinte of Array.from(this.ouvintes)) chamarOuvinte(ouvinte, ev);
  }

  private exigirAtiva(): void {
    if (this.sessao.ativa) return;
    if (this.conexao.conectado) {
      throw erroBle("InvalidStateError", "GATT Characteristic no longer exists.");
    }
    throw erroBle("NetworkError", "GATT Server is disconnected. Cannot perform GATT operations.");
  }

  private async escrever(dados: Uint8Array, semResposta: boolean): Promise<void> {
    this.exigirAtiva();
    const permitido = semResposta ? this.properties.writeWithoutResponse : this.properties.write;
    if (!permitido) throw erroBle("NotSupportedError", "GATT operation not permitted.");
    const copia = Uint8Array.from(dados);
    await this.conexao.aguardarLatencia();
    // A conexão caiu no meio da escrita: o comando se perde, sem erro para quem escreveu sem resposta.
    if (!this.sessao.ativa) return;
    this.conexao.escreverNoModulo(copia);
  }
}

class DispositivoSimulado implements DispositivoBle {
  readonly name: string;
  readonly gatt: {
    readonly connected: boolean;
    connect(): Promise<ServidorGattBle>;
    disconnect(): void;
  };

  private readonly ouvintes = new Set<(ev: unknown) => void>();

  constructor(nome: string, conexao: ConexaoSimulada) {
    this.name = nome;
    this.gatt = {
      get connected(): boolean {
        return conexao.conectado;
      },
      connect: () => conexao.conectar(),
      disconnect: () => conexao.cair(),
    };
  }

  addEventListener(tipo: "gattserverdisconnected", ouvinte: (ev: unknown) => void): void {
    if (tipo === "gattserverdisconnected") this.ouvintes.add(ouvinte);
  }

  removeEventListener(tipo: "gattserverdisconnected", ouvinte: (ev: unknown) => void): void {
    if (tipo === "gattserverdisconnected") this.ouvintes.delete(ouvinte);
  }

  avisarQueda(): void {
    const ev = { type: "gattserverdisconnected", target: this };
    for (const ouvinte of Array.from(this.ouvintes)) chamarOuvinte(ouvinte, ev);
  }
}

class ConexaoSimulada {
  readonly dispositivo: DispositivoSimulado;

  private sessao: SessaoGatt | null = null;
  private servicosPermitidos = new Set<string>();
  private readonly modulo: ModuloSimulado;
  private readonly latenciaMs: number;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private dentroDeEscrita = 0;

  constructor(modulo: ModuloSimulado, nome: string, latenciaMs: number) {
    this.modulo = modulo;
    this.latenciaMs = latenciaMs;
    this.dispositivo = new DispositivoSimulado(nome, this);
    modulo.aoNotificar = (pedaco) => this.aoNotificarDoModulo(pedaco);
    modulo.derrubarConexao = () => this.cair();
  }

  get conectado(): boolean {
    return this.sessao !== null;
  }

  aguardarLatencia(): Promise<void> {
    return aguardar(this.latenciaMs);
  }

  async pedirDispositivo(opcoes: OpcoesRequestDevice): Promise<DispositivoBle> {
    await this.aguardarLatencia();
    const filtros = opcoes?.filters ?? [];
    if (!opcoes?.acceptAllDevices && filtros.length === 0) {
      throw new TypeError("requestDevice precisa de filters ou de acceptAllDevices.");
    }
    if (!opcoes.acceptAllDevices && !filtros.some((f) => this.filtroAceita(f))) {
      throw erroBle("NotFoundError", "Nenhum dispositivo encontrado para estes filtros (simulado).");
    }
    const permitidos = [
      ...filtros.flatMap((f) => f.services ?? []),
      ...(opcoes.optionalServices ?? []),
    ];
    this.servicosPermitidos = new Set(permitidos.map(normalizarUuid));
    return this.dispositivo;
  }

  async conectar(): Promise<ServidorGattBle> {
    await this.aguardarLatencia();
    const sessao = this.sessao ?? this.abrirSessao();
    return sessao.servidor;
  }

  /** Derruba a conexão (sem efeito se já caiu): avisa o app e perde o que estava a caminho. */
  cair(): void {
    const sessao = this.sessao;
    if (!sessao) return;
    sessao.ativa = false;
    this.sessao = null;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.dispositivo.avisarQueda();
  }

  escreverNoModulo(comando: Uint8Array): void {
    this.dentroDeEscrita++;
    try {
      this.modulo.receberComando(comando);
    } finally {
      this.dentroDeEscrita--;
    }
  }

  private aoNotificarDoModulo(pedaco: Uint8Array): void {
    if (!this.sessao) return;
    const copia = pedaco.slice();
    const imediato = this.dentroDeEscrita === 0 && this.latenciaMs <= 0 && this.timers.size === 0;
    if (imediato) {
      this.entregar(copia);
      return;
    }
    // Atrasos iguais disparam na ordem em que foram criados, o que mantém a ordem das notificações.
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      this.entregar(copia);
    }, this.latenciaMs);
    this.timers.add(timer);
  }

  private entregar(pedaco: Uint8Array): void {
    const notificacao = this.sessao?.notificacao;
    if (notificacao?.notificando) notificacao.entregar(pedaco);
  }

  private filtroAceita(filtro: NonNullable<OpcoesRequestDevice["filters"]>[number]): boolean {
    const nome = this.dispositivo.name ?? "";
    if (filtro.namePrefix !== undefined && !nome.startsWith(filtro.namePrefix)) return false;
    return (filtro.services ?? []).every((s) => normalizarUuid(s) === UUID_SERVICO);
  }

  private abrirSessao(): SessaoGatt {
    const marca = { ativa: true };
    const escrita = new CaracteristicaSimulada(
      UUID_ESCRITA,
      { read: false, write: false, writeWithoutResponse: true, notify: false, indicate: false },
      this,
      marca,
    );
    const notificacao = new CaracteristicaSimulada(
      UUID_NOTIFICACAO,
      { read: false, write: false, writeWithoutResponse: false, notify: true, indicate: false },
      this,
      marca,
    );
    const servico: ServicoBle = {
      uuid: UUID_SERVICO,
      getCharacteristics: async () => {
        await this.aguardarLatencia();
        this.exigirSessao(marca);
        return [escrita, notificacao];
      },
    };
    const servidor: ServidorGattBle = {
      getPrimaryServices: async () => {
        await this.aguardarLatencia();
        this.exigirSessao(marca);
        if (!this.servicosPermitidos.has(UUID_SERVICO)) {
          throw erroBle("NotFoundError", "No Services found in device.");
        }
        return [servico];
      },
    };
    const sessao: SessaoGatt = Object.assign(marca, { servidor, notificacao });
    this.sessao = sessao;
    return sessao;
  }

  private exigirSessao(marca: { ativa: boolean }): void {
    if (!marca.ativa) {
      throw erroBle("NetworkError", "GATT Server is disconnected. Cannot perform GATT operations.");
    }
  }
}

export type BluetoothSimulado = TransporteBle & { derrubar(): void };

/**
 * Bluetooth (forma de tiposBle.ts) com um dispositivo "RunE W2 1" que fala com `modulo`: escritas em
 * fff3 viram receberComando(); aoNotificar vira "characteristicvaluechanged" na fff4. Como no
 * Web Bluetooth, depois de uma queda é preciso conectar de novo, buscar serviço e características
 * de novo e chamar startNotifications() de novo: os objetos antigos não servem mais.
 * Uma chamada por módulo: ela assume modulo.aoNotificar.
 */
export function criarBluetoothSimulado(
  modulo: ModuloSimulado,
  opcoes: { nome?: string; latenciaMs?: number } = {},
): BluetoothSimulado {
  const { nome = "RunE W2 1", latenciaMs = 0 } = opcoes;
  exigirNaoNegativo("latenciaMs", latenciaMs);
  const conexao = new ConexaoSimulada(modulo, nome, latenciaMs);
  return {
    requestDevice: (pedido) => conexao.pedirDispositivo(pedido),
    derrubar: () => conexao.cair(),
  };
}
