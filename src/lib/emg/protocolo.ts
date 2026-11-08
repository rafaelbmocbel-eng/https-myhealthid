// Protocolo BLE do módulo EMG "RunE W2". Especificação: docs/emg-protocolo-runew2.md.
// Funções puras, sem DOM: a camada de Bluetooth só entrega/recebe bytes.

export const UUID_SERVICO = "0000fff0-0000-1000-8000-00805f9b34fb";
export const UUID_ESCRITA = "0000fff3-0000-1000-8000-00805f9b34fb";
export const UUID_NOTIFICACAO = "0000fff4-0000-1000-8000-00805f9b34fb";

export const PREFIXO_NOME = "RunE W2";

const REGEX_NOME = /^RunE W2 (\d)/;

export function numeroDoSensor(nome: string): number | null {
  if (typeof nome !== "string") return null;
  const achado = REGEX_NOME.exec(nome);
  if (!achado) return null;
  return Number(achado[1]);
}

export const ENDERECO = {
  VERSAO_HARDWARE: 0x01,
  VERSAO_SOFTWARE: 0x02,
  NUMERO_DISPOSITIVO: 0x03,
  MAC: 0x04,
  TAXA_AMOSTRAGEM: 0x06,
  HISTORICO_RMS: 0x07,
  MOS_CARGA: 0x09,
  BATERIA: 0x0b,
  LED: 0x0c,
  SENSOR_HALL: 0x0d,
  FILTRO_HARDWARE: 0x0f,
  AQUISICAO: 0x11,
  SLEEP: 0x12,
  RESET: 0x13,
  DESLIGAR: 0x14,
  ID_CHIP: 0x17,
  MODO_TESTE_PRODUCAO: 0x18,
  REGISTRADORES_LH001: 0x19,
  TIPO_HARDWARE: 0x1d,
} as const;

/** 1º byte de DATA do endereço 0x11. */
export const MODO = {
  PARAR: 0,
  RMS: 1,
  BRUTO_FLOAT: 2,
  EMG: 3,
  EEG: 4,
} as const;

/** 2022-08-31T16:00Z: o relógio do módulo conta ms a partir de meia-noite de 1/9/2022 na China. */
export const EPOCA_RELOGIO_MODULO_MS = 1661961600000;

/** Unidade provável: µV (não confirmada pelo fabricante). */
export const DIVISOR_EMG = 3.1457;
export const DIVISOR_EEG = 12.5786;

const INTERVALO_RMS_MS = 50;

// ---------------------------------------------------------------------------
// Comandos (app -> sensor): AA LEN RW ADDR DATA... XOR BB
// ---------------------------------------------------------------------------

const COMANDO_INICIO = 0xaa;
const COMANDO_FIM = 0xbb;
const RW_ESCRITA = 0x80;
const RW_LEITURA = 0x81;
// LEN = dados + 3 cabe num byte só até 252 bytes de dados.
const MAX_DADOS_COMANDO = 252;

function ehByte(valor: number): boolean {
  return Number.isInteger(valor) && valor >= 0 && valor <= 0xff;
}

export function montarComando(escrita: boolean, endereco: number, dados: ArrayLike<number> = []): Uint8Array {
  if (!ehByte(endereco)) {
    throw new RangeError(`endereco fora de 0..255: ${endereco}`);
  }
  const n = dados.length;
  if (n > MAX_DADOS_COMANDO) {
    throw new RangeError(`dados.length ${n} excede ${MAX_DADOS_COMANDO}`);
  }
  const len = n + 3;
  const rw = escrita ? RW_ESCRITA : RW_LEITURA;
  const saida = new Uint8Array(n + 6);
  saida[0] = COMANDO_INICIO;
  saida[1] = len;
  saida[2] = rw;
  saida[3] = endereco;
  let xor = len ^ rw ^ endereco;
  for (let i = 0; i < n; i++) {
    const byte = dados[i];
    if (!ehByte(byte)) {
      throw new RangeError(`dados[${i}] fora de 0..255: ${byte}`);
    }
    saida[4 + i] = byte;
    xor ^= byte;
  }
  saida[4 + n] = xor;
  saida[5 + n] = COMANDO_FIM;
  return saida;
}

function timestamp8(tsMs: number): Uint8Array {
  if (!Number.isSafeInteger(tsMs) || tsMs < 0) {
    throw new RangeError(`tsMs deve ser inteiro seguro >= 0: ${tsMs}`);
  }
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(tsMs), false);
  return bytes;
}

function dadosDeAquisicao(modo: number, tsMs: number): number[] {
  return [modo, ...Array.from(timestamp8(tsMs))];
}

export const cmd = {
  versaoHardware: (): Uint8Array => montarComando(false, ENDERECO.VERSAO_HARDWARE),
  versaoSoftware: (): Uint8Array => montarComando(false, ENDERECO.VERSAO_SOFTWARE),
  taxaDeAmostragem: (): Uint8Array => montarComando(false, ENDERECO.TAXA_AMOSTRAGEM),
  bateria: (): Uint8Array => montarComando(false, ENDERECO.BATERIA),

  filtroHardware(ligado: boolean): Uint8Array {
    return montarComando(true, ENDERECO.FILTRO_HARDWARE, [ligado ? 1 : 0]);
  },

  iniciar(modo: number, tsMs: number): Uint8Array {
    return montarComando(true, ENDERECO.AQUISICAO, dadosDeAquisicao(modo, tsMs));
  },

  parar(tsMs: number): Uint8Array {
    return montarComando(true, ENDERECO.AQUISICAO, dadosDeAquisicao(MODO.PARAR, tsMs));
  },

  /** Leitura de 0x07: ts[8] big-endian + quantidade[2] big-endian. */
  historicoRms(tsMs: number, n: number): Uint8Array {
    if (!Number.isInteger(n) || n < 0 || n > 0xffff) {
      throw new RangeError(`n fora de 0..65535: ${n}`);
    }
    return montarComando(false, ENDERECO.HISTORICO_RMS, [...Array.from(timestamp8(tsMs)), n >> 8, n & 0xff]);
  },

  reset: (): Uint8Array => montarComando(true, ENDERECO.RESET, [0x01]),
};

// ---------------------------------------------------------------------------
// Respostas (sensor -> app): A5 LEN ADDR LEN^ADDR PAYLOAD... ?? 5A  (total = LEN + 3)
// ---------------------------------------------------------------------------

const QUADRO_INICIO = 0xa5;
const QUADRO_FIM = 0x5a;
const TAMANHO_CABECALHO = 4;
// Com LEN < 2 o 5A cairia dentro do cabeçalho de 4 bytes.
const LEN_MINIMO = 2;
const TAMANHO_MINIMO_QUADRO = LEN_MINIMO + 3;
const LIMITE_BUFFER = 4096;

export interface Quadro {
  /** Quadro inteiro, de A5 a 5A. */
  bytes: Uint8Array;
  len: number;
  endereco: number;
}

/**
 * Notificações BLE chegam fragmentadas ou coladas; isto remonta os quadros.
 * Um quadro válido tem no máximo 258 bytes (LEN é 1 byte), então o buffer retido
 * após cada passada fica abaixo disso e LIMITE_BUFFER nunca é atingido com dados válidos.
 */
export class AcumuladorDeQuadros {
  /** Bytes jogados fora na ressincronização desde o último reset(). */
  descartados = 0;

  private readonly buf = new Uint8Array(LIMITE_BUFFER);
  private tam = 0;

  /** Bytes à espera do resto de um quadro. */
  get pendentes(): number {
    return this.tam;
  }

  push(pedaco: Uint8Array): Quadro[] {
    const quadros: Quadro[] = [];
    let pos = 0;
    while (pos < pedaco.length) {
      const n = Math.min(pedaco.length - pos, LIMITE_BUFFER - this.tam);
      this.buf.set(pedaco.subarray(pos, pos + n), this.tam);
      this.tam += n;
      pos += n;
      this.extrair(quadros);
    }
    return quadros;
  }

  reset(): void {
    this.tam = 0;
    this.descartados = 0;
  }

  private extrair(saida: Quadro[]): void {
    const buf = this.buf;
    const tam = this.tam;
    let i = 0;
    let descartados = 0;
    while (i < tam) {
      if (buf[i] !== QUADRO_INICIO) {
        i++;
        descartados++;
        continue;
      }
      if (tam - i < TAMANHO_CABECALHO) break;
      const len = buf[i + 1];
      const endereco = buf[i + 2];
      if (len < LEN_MINIMO || buf[i + 3] !== (len ^ endereco)) {
        i++;
        descartados++;
        continue;
      }
      const total = len + 3;
      if (tam - i < total) break;
      if (buf[i + total - 1] !== QUADRO_FIM) {
        i++;
        descartados++;
        continue;
      }
      saida.push({ bytes: buf.slice(i, i + total), len, endereco });
      i += total;
    }
    buf.copyWithin(0, i, tam);
    this.tam = tam - i;
    this.descartados += descartados;
  }
}

// ---------------------------------------------------------------------------
// Interpretação dos quadros
// ---------------------------------------------------------------------------

export type ModeloHardware = "EMG-Module" | "EEG-Module" | "EMG-Pro" | "EEG-Pro";
export type CanalBruto = "emg" | "eeg";

export type EventoModulo =
  | { tipo: "versao_hw"; texto: string }
  | { tipo: "versao_sw"; texto: string }
  | { tipo: "taxa"; hz: 500 | 1000 }
  | { tipo: "bateria"; pct: number }
  | { tipo: "chip"; codigo: number }
  | { tipo: "hardware"; modelo: ModeloHardware }
  | { tipo: "historico_rms"; tsMs: number; valores: number[] }
  | { tipo: "rms"; tsUltimoMs: number; valores: number[]; intervaloMs: 50 }
  | { tipo: "bruto"; canal: CanalBruto; tsMs: number; amostras: Float64Array }
  | { tipo: "ack"; endereco: number }
  | { tipo: "invalido"; motivo: string };

export interface OpcoesInterpretacao {
  /**
   * Se o quadro bruto também emite a amostra-base (float32) além dos n deltas.
   * Pendente, a confirmar com ble_emg_device.dart: a spec só diz que a base é a "1ª amostra".
   */
  incluirPrimeiraAmostra?: boolean;
}

const MODELOS_HARDWARE: readonly ModeloHardware[] = ["EMG-Module", "EEG-Module", "EMG-Pro", "EEG-Pro"];

const NOMES_CHIP: Readonly<Record<number, string>> = {
  125: "LH001-91",
  126: "LH001-99",
};

export function nomeDoChip(codigo: number): string | null {
  return NOMES_CHIP[codigo] ?? null;
}

// Posições no quadro inteiro (f[0] = A5).
const POS_PRIMEIRO_DADO = 4;
const POS_RMS_TS = 5;
const POS_RMS_VALORES = 11;
const POS_HISTORICO_VALORES = 10;
const POS_BRUTO_TS = 5;
const POS_BRUTO_BASE = 11;
const POS_BRUTO_DELTAS = 15;
const POS_BATERIA = 10;

const decodificadorUtf8 = new TextDecoder("utf-8");

function invalido(motivo: string): EventoModulo {
  return { tipo: "invalido", motivo };
}

function lerBigEndian48(dv: DataView, pos: number): number {
  return dv.getUint16(pos, false) * 0x100000000 + dv.getUint32(pos + 2, false);
}

/** Quantos itens de 2 bytes cabem: a fórmula da spec, nunca além do que o quadro tem. */
function contarPares(porFormula: number, fim: number, posInicial: number): number {
  const cabem = Math.floor((fim - posInicial) / 2);
  return Math.max(0, Math.min(Math.floor(porFormula), cabem));
}

function lerUint16BE(dv: DataView, pos: number, n: number): number[] {
  const valores: number[] = [];
  for (let i = 0; i < n; i++) {
    valores.push(dv.getUint16(pos + 2 * i, false));
  }
  return valores;
}

function interpretarBruto(
  dv: DataView,
  len: number,
  fim: number,
  canal: CanalBruto,
  incluirPrimeiraAmostra: boolean,
): EventoModulo {
  if (fim < POS_BRUTO_DELTAS) return invalido("quadro bruto curto demais");
  const base = dv.getFloat32(POS_BRUTO_BASE, true);
  if (!Number.isFinite(base)) return invalido("amostra-base do quadro bruto não é finita");
  const divisor = canal === "emg" ? DIVISOR_EMG : DIVISOR_EEG;
  const n = contarPares((len - 13) / 2, fim, POS_BRUTO_DELTAS);

  const amostras = new Float64Array(n + (incluirPrimeiraAmostra ? 1 : 0));
  let k = 0;
  let v = base;
  if (incluirPrimeiraAmostra) amostras[k++] = v;
  for (let i = 0; i < n; i++) {
    v += dv.getInt16(POS_BRUTO_DELTAS + 2 * i, true) / divisor;
    amostras[k++] = v;
  }
  // Carimbo na mesma posição do RMS (f[5..11)) é inferência: a confirmar com ble_emg_device.dart.
  const tsMs = lerBigEndian48(dv, POS_BRUTO_TS) + EPOCA_RELOGIO_MODULO_MS;
  return { tipo: "bruto", canal, tsMs, amostras };
}

function interpretarAquisicao(
  dv: DataView,
  len: number,
  fim: number,
  incluirPrimeiraAmostra: boolean,
): EventoModulo {
  // Sem byte de modo é só a confirmação do comando.
  if (fim <= POS_PRIMEIRO_DADO) return { tipo: "ack", endereco: ENDERECO.AQUISICAO };
  const modo = dv.getUint8(POS_PRIMEIRO_DADO);

  if (modo === MODO.PARAR) return { tipo: "ack", endereco: ENDERECO.AQUISICAO };

  if (modo === MODO.RMS) {
    if (fim < POS_RMS_VALORES) return invalido("quadro RMS curto demais");
    const n = contarPares((len - 9) / 2, fim, POS_RMS_VALORES);
    return {
      tipo: "rms",
      tsUltimoMs: lerBigEndian48(dv, POS_RMS_TS) + EPOCA_RELOGIO_MODULO_MS,
      valores: lerUint16BE(dv, POS_RMS_VALORES, n),
      intervaloMs: INTERVALO_RMS_MS,
    };
  }

  if (modo === MODO.EMG) return interpretarBruto(dv, len, fim, "emg", incluirPrimeiraAmostra);
  if (modo === MODO.EEG) return interpretarBruto(dv, len, fim, "eeg", incluirPrimeiraAmostra);

  if (modo === MODO.BRUTO_FLOAT) return invalido("modo 0x02 (float32 bruto legado) não suportado");
  return invalido(`modo de aquisição desconhecido: 0x${modo.toString(16).padStart(2, "0")}`);
}

function interpretar(q: Quadro, incluirPrimeiraAmostra: boolean): EventoModulo {
  if (!q || !q.bytes || typeof q.bytes.length !== "number") return invalido("quadro ausente");
  const b = q.bytes;
  if (b.length < TAMANHO_MINIMO_QUADRO) return invalido("quadro curto demais");
  if (b[0] !== QUADRO_INICIO || b[1] !== q.len || b[2] !== q.endereco) {
    return invalido("campos do quadro inconsistentes com os bytes");
  }
  if (b.length < q.len + 3) return invalido("quadro truncado");

  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  // Índice (exclusivo) onde acaba a área de dados: logo antes do 5A final.
  const fim = Math.min(q.len + 2, b.length - 1);

  switch (q.endereco) {
    case ENDERECO.VERSAO_HARDWARE:
    case ENDERECO.VERSAO_SOFTWARE: {
      // A spec exclui os 2 últimos bytes (byte antes do 5A e o próprio 5A).
      const texto = decodificadorUtf8.decode(b.subarray(POS_PRIMEIRO_DADO, Math.min(q.len + 1, fim)));
      if (q.endereco === ENDERECO.VERSAO_HARDWARE) return { tipo: "versao_hw", texto };
      return { tipo: "versao_sw", texto };
    }

    case ENDERECO.TAXA_AMOSTRAGEM: {
      if (fim <= POS_PRIMEIRO_DADO) return invalido("resposta de taxa sem dados");
      const codigo = b[POS_PRIMEIRO_DADO];
      if (codigo === 0) return { tipo: "taxa", hz: 500 };
      if (codigo === 1) return { tipo: "taxa", hz: 1000 };
      return invalido(`código de taxa desconhecido: ${codigo}`);
    }

    case ENDERECO.BATERIA: {
      if (fim <= POS_BATERIA) return invalido("resposta de bateria curta demais");
      const pct = b[POS_BATERIA];
      if (pct > 100) return invalido(`bateria fora de 0..100: ${pct}`);
      return { tipo: "bateria", pct };
    }

    case ENDERECO.ID_CHIP: {
      if (fim <= POS_PRIMEIRO_DADO) return invalido("resposta de chip sem dados");
      return { tipo: "chip", codigo: b[POS_PRIMEIRO_DADO] };
    }

    case ENDERECO.TIPO_HARDWARE: {
      if (fim <= POS_PRIMEIRO_DADO) return invalido("resposta de hardware sem dados");
      const modelo = MODELOS_HARDWARE[b[POS_PRIMEIRO_DADO]];
      if (!modelo) return invalido(`tipo de hardware desconhecido: ${b[POS_PRIMEIRO_DADO]}`);
      return { tipo: "hardware", modelo };
    }

    case ENDERECO.HISTORICO_RMS: {
      if (fim < POS_HISTORICO_VALORES) return invalido("histórico RMS curto demais");
      const n = contarPares((q.len - 8) / 2, fim, POS_HISTORICO_VALORES);
      return {
        tipo: "historico_rms",
        tsMs: lerBigEndian48(dv, POS_PRIMEIRO_DADO) + EPOCA_RELOGIO_MODULO_MS,
        valores: lerUint16BE(dv, POS_HISTORICO_VALORES, n),
      };
    }

    case ENDERECO.AQUISICAO:
      return interpretarAquisicao(dv, q.len, fim, incluirPrimeiraAmostra);

    default:
      // Qualquer quadro com o endereço X confirma o comando X.
      return { tipo: "ack", endereco: q.endereco };
  }
}

/** Nunca lança: quadro malformado, truncado ou curto vira `{ tipo: "invalido" }`. */
export function interpretarQuadro(q: Quadro, opcoes?: OpcoesInterpretacao): EventoModulo {
  try {
    return interpretar(q, opcoes?.incluirPrimeiraAmostra ?? true);
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro);
    return invalido(`falha ao interpretar o quadro: ${detalhe}`);
  }
}
