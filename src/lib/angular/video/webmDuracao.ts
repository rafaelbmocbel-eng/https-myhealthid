/*
 * Duração dentro do arquivo WebM. O MediaRecorder de alguns navegadores grava o WebM sem o campo de duração (o arquivo toca, mas
 * galerias, editores e o próprio <video> mostram "duração desconhecida" e não deixam arrastar a barra). Aqui o campo é acrescentado
 * ao cabeçalho do arquivo sem recodificar nada. Se a estrutura do arquivo não for a esperada, o arquivo fica como está.
 */

const ID_EBML = 0x1a45dfa3;
const ID_SEGMENT = 0x18538067;
const ID_SEEKHEAD = 0x114d9b74;
const ID_SEEK = 0x4dbb;
const ID_SEEK_ID = 0x53ab;
const ID_SEEK_POS = 0x53ac;
const ID_INFO = 0x1549a966;
const ID_TIMESCALE = 0x2ad7b1;
const ID_DURATION = 0x4489;
const ID_VOID = 0xec;
const ID_CUES = 0x1c53bb6b;
const TAMANHO_DURACAO = 11;
/** Bytes iniciais do arquivo que bastam para achar o cabeçalho (Info vem antes do primeiro Cluster). */
export const BYTES_DO_CABECALHO = 65536;

interface Elemento {
  id: number;
  /** Posição do primeiro byte do ID. */
  inicio: number;
  posTamanho: number;
  lenTamanho: number;
  tamanho: number;
  desconhecido: boolean;
  inicioDados: number;
  /** Fim do elemento (inicioDados + tamanho); para tamanho desconhecido, o fim da área lida. */
  fim: number;
}

function lerElemento(b: Uint8Array, pos: number, limite = b.length): Elemento | null {
  if (pos >= limite) return null;
  const primeiro = b[pos];
  if (!primeiro) return null;
  let lenId = 1;
  while (lenId <= 4 && !(primeiro & (0x80 >> (lenId - 1)))) lenId++;
  if (lenId > 4 || pos + lenId >= limite) return null;
  let id = 0;
  for (let i = 0; i < lenId; i++) id = id * 256 + b[pos + i];
  const posTamanho = pos + lenId;
  const t0 = b[posTamanho];
  if (!t0) return null;
  let lenT = 1;
  while (lenT <= 8 && !(t0 & (0x80 >> (lenT - 1)))) lenT++;
  if (lenT > 8 || posTamanho + lenT > limite) return null;
  let valor = t0 & (0xff >> lenT);
  let tudoUm = valor === (0xff >> lenT);
  for (let i = 1; i < lenT; i++) {
    valor = valor * 256 + b[posTamanho + i];
    if (b[posTamanho + i] !== 0xff) tudoUm = false;
  }
  const inicioDados = posTamanho + lenT;
  return { id, inicio: pos, posTamanho, lenTamanho: lenT, tamanho: tudoUm ? 0 : valor, desconhecido: tudoUm, inicioDados, fim: tudoUm ? limite : inicioDados + valor };
}

/** Escreve `valor` como tamanho EBML em exatamente `len` bytes; false se não couber. */
function escreverTamanho(b: Uint8Array, pos: number, len: number, valor: number): boolean {
  if (valor < 0 || valor >= Math.pow(2, 7 * len) - 1) return false;
  let resto = valor;
  for (let i = len - 1; i >= 0; i--) {
    b[pos + i] = resto % 256;
    resto = Math.floor(resto / 256);
  }
  b[pos] |= 0x80 >> (len - 1);
  return true;
}

function lerUint(b: Uint8Array, e: Elemento): number {
  let v = 0;
  for (let i = e.inicioDados; i < e.fim; i++) v = v * 256 + b[i];
  return v;
}

function escreverUint(b: Uint8Array, e: Elemento, valor: number): boolean {
  const len = e.fim - e.inicioDados;
  if (valor < 0 || valor >= Math.pow(256, len)) return false;
  let resto = valor;
  for (let i = e.fim - 1; i >= e.inicioDados; i--) {
    b[i] = resto % 256;
    resto = Math.floor(resto / 256);
  }
  return true;
}

function lerFloat(b: Uint8Array, e: Elemento): number | null {
  const len = e.fim - e.inicioDados;
  const v = new DataView(b.buffer, b.byteOffset + e.inicioDados, len);
  if (len === 4) return v.getFloat32(0);
  if (len === 8) return v.getFloat64(0);
  return null;
}

function elementoDuracao(valor: number): Uint8Array {
  const out = new Uint8Array(TAMANHO_DURACAO);
  out[0] = 0x44;
  out[1] = 0x89;
  out[2] = 0x88;
  new DataView(out.buffer).setFloat64(3, valor);
  return out;
}

function filhos(b: Uint8Array, de: number, ate: number): Elemento[] {
  const lista: Elemento[] = [];
  let p = de;
  while (p < ate) {
    const e = lerElemento(b, p, ate);
    if (!e) break;
    lista.push(e);
    if (e.desconhecido || e.fim > ate) break;
    p = e.fim;
  }
  return lista;
}

export interface CorrecaoWebm {
  /** Substitui os bytes `[0, ate)` do arquivo original por estes (que podem ser mais longos); o resto do arquivo segue como está. */
  novo: Uint8Array;
  ate: number;
}

/**
 * Plano para acrescentar a duração ao cabeçalho do WebM. `cabeca` são os primeiros bytes do arquivo (`BYTES_DO_CABECALHO`).
 * Devolve null quando o arquivo já tem duração ou quando a estrutura não permite acrescentar com segurança.
 */
export function planejarDuracaoWebm(cabeca: Uint8Array, duracaoS: number): CorrecaoWebm | null {
  if (!(duracaoS > 0) || !Number.isFinite(duracaoS)) return null;
  const ebml = lerElemento(cabeca, 0);
  if (!ebml || ebml.id !== ID_EBML || ebml.desconhecido) return null;
  const seg = lerElemento(cabeca, ebml.fim);
  if (!seg || seg.id !== ID_SEGMENT) return null;
  const segDados = seg.inicioDados;
  const limite = cabeca.length;
  const topo = filhos(cabeca, segDados, limite);
  const info = topo.find((e) => e.id === ID_INFO);
  if (!info || info.desconhecido || info.fim > limite) return null;

  const dentro = filhos(cabeca, info.inicioDados, info.fim);
  const escala = dentro.find((e) => e.id === ID_TIMESCALE);
  const nsPorTick = escala ? lerUint(cabeca, escala) : 1_000_000;
  if (!(nsPorTick > 0)) return null;
  const ticks = (duracaoS * 1e9) / nsPorTick;

  const atual = dentro.find((e) => e.id === ID_DURATION);
  if (atual) {
    const v = lerFloat(cabeca, atual);
    if (v !== null && Number.isFinite(v) && v > 0) return null;
    // Duração presente mas zerada: troca o valor no mesmo lugar.
    const copia = cabeca.slice(0, info.fim);
    const view = new DataView(copia.buffer);
    if (atual.fim - atual.inicioDados === 4) view.setFloat32(atual.inicioDados, ticks);
    else if (atual.fim - atual.inicioDados === 8) view.setFloat64(atual.inicioDados, ticks);
    else return null;
    return { novo: copia, ate: info.fim };
  }

  const sizeInfoNovo = info.tamanho + TAMANHO_DURACAO;
  const temPosicoes = topo.some((e) => e.id === ID_SEEKHEAD || e.id === ID_CUES);

  if (!temPosicoes) {
    // Sem índice de posições: inserir os bytes no fim do Info não desloca nada que alguém aponte.
    const novo = new Uint8Array(info.fim + TAMANHO_DURACAO);
    novo.set(cabeca.subarray(0, info.fim), 0);
    novo.set(elementoDuracao(ticks), info.fim);
    if (!escreverTamanho(novo, info.posTamanho, info.lenTamanho, sizeInfoNovo)) return null;
    if (!seg.desconhecido && !escreverTamanho(novo, seg.posTamanho, seg.lenTamanho, seg.tamanho + TAMANHO_DURACAO)) return null;
    return { novo, ate: info.fim };
  }

  // Com índice (SeekHead/Cues): o espaço vazio logo antes do Info paga os bytes novos e nada depois dele muda de lugar.
  const indice = topo.indexOf(info);
  const anterior = indice > 0 ? topo[indice - 1] : null;
  if (!anterior || anterior.id !== ID_VOID || anterior.fim !== info.inicio || anterior.desconhecido) return null;
  const sobra = anterior.tamanho - TAMANHO_DURACAO;
  if (sobra < 0) return null;
  const infoNovoInicio = info.inicio - TAMANHO_DURACAO;

  const novo = cabeca.slice(0, info.fim);
  if (!escreverTamanho(novo, anterior.posTamanho, anterior.lenTamanho, sobra)) return null;
  novo.fill(0, anterior.inicioDados, anterior.inicioDados + sobra);
  // O Info (com a duração no fim) começa onde o espaço vazio agora termina.
  const infoBytes = new Uint8Array(info.fim - info.inicio + TAMANHO_DURACAO);
  infoBytes.set(cabeca.subarray(info.inicio, info.fim), 0);
  infoBytes.set(elementoDuracao(ticks), info.fim - info.inicio);
  if (!escreverTamanho(infoBytes, info.posTamanho - info.inicio, info.lenTamanho, sizeInfoNovo)) return null;
  novo.set(infoBytes, anterior.inicioDados + sobra);

  // O índice aponta para o Info pela posição (a partir do início do Segment): ele andou TAMANHO_DURACAO bytes para trás.
  const seekHead = topo.find((e) => e.id === ID_SEEKHEAD);
  if (seekHead && !seekHead.desconhecido) {
    const posInfoAntes = info.inicio - segDados;
    for (const s of filhos(novo, seekHead.inicioDados, seekHead.fim)) {
      if (s.id !== ID_SEEK) continue;
      const partes = filhos(novo, s.inicioDados, s.fim);
      const idAlvo = partes.find((p) => p.id === ID_SEEK_ID);
      const pos = partes.find((p) => p.id === ID_SEEK_POS);
      if (!idAlvo || !pos || lerUint(novo, idAlvo) !== ID_INFO || lerUint(novo, pos) !== posInfoAntes) continue;
      if (!escreverUint(novo, pos, infoNovoInicio - segDados)) return null;
    }
  }
  return { novo, ate: info.fim };
}

/** Acrescenta a duração a um Blob WebM que não a traz. Qualquer outro arquivo (ou falha) volta como veio. */
export async function corrigirDuracaoDoBlob(blob: Blob, duracaoS: number): Promise<Blob> {
  if (!/^video\/webm/i.test(blob.type) || typeof blob.slice !== 'function') return blob;
  try {
    const cabeca = new Uint8Array(await blob.slice(0, BYTES_DO_CABECALHO).arrayBuffer());
    const plano = planejarDuracaoWebm(cabeca, duracaoS);
    if (!plano) return blob;
    return new Blob([plano.novo, blob.slice(plano.ate)], { type: blob.type });
  } catch {
    // Não deu para ler o cabeçalho: o arquivo segue sem a duração, que só afeta o contador do player.
    return blob;
  }
}

/** Duração gravada no cabeçalho (s), ou null se não houver. Serve para conferir arquivos. */
export function lerDuracaoWebm(cabeca: Uint8Array): number | null {
  const ebml = lerElemento(cabeca, 0);
  if (!ebml || ebml.id !== ID_EBML) return null;
  const seg = lerElemento(cabeca, ebml.fim);
  if (!seg || seg.id !== ID_SEGMENT) return null;
  const info = filhos(cabeca, seg.inicioDados, cabeca.length).find((e) => e.id === ID_INFO);
  if (!info || info.desconhecido || info.fim > cabeca.length) return null;
  const dentro = filhos(cabeca, info.inicioDados, info.fim);
  const escala = dentro.find((e) => e.id === ID_TIMESCALE);
  const ns = escala ? lerUint(cabeca, escala) : 1_000_000;
  const d = dentro.find((e) => e.id === ID_DURATION);
  const v = d ? lerFloat(cabeca, d) : null;
  return v !== null && Number.isFinite(v) && v > 0 ? (v * ns) / 1e9 : null;
}
