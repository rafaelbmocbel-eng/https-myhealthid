// Reduz o áudio do microfone (44,1 ou 48 kHz) para os 16 kHz que o Whisper usa, em fluxo (bloco a bloco).
//
// Por que não basta pegar uma amostra a cada 3 (ou interpolar entre duas): o que está acima de 8 kHz (chiado do "s", do
// "f", ruído) não some, "dobra" para dentro da faixa da fala e distorce justamente as consoantes que mais confundem
// palavras. Antes de reduzir é preciso cortar o que passa de ~7 kHz. Aqui isso é feito por interpolação sinc com janela
// Kaiser: cada amostra de saída é uma média ponderada de ~70 amostras de entrada, com pesos que já fazem o corte.
const FASES = 128; // resolução da posição fracionária: 1/128 de amostra de entrada
const BETA = 8; // janela Kaiser: o que fica fora da faixa cai ~70 dB
const CORTE = 0.45; // fração da taxa de saída que passa inteira (7,2 kHz com saída de 16 kHz)
const LARGURA = 12; // meia largura do filtro, em amostras de entrada por razão de redução

function bessel0(x: number): number {
  let soma = 1;
  let termo = 1;
  const q = (x * x) / 4;
  for (let k = 1; k < 60; k++) {
    termo *= q / (k * k);
    soma += termo;
    if (termo < 1e-14 * soma) break;
  }
  return soma;
}

const sinc = (x: number) => (x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));

function paraInt16(s: number): number {
  const c = s < -1 ? -1 : s > 1 ? 1 : s;
  return c < 0 ? c * 0x8000 : c * 0x7fff;
}

export class Reamostrador {
  private readonly razao: number;
  private readonly meia: number;
  private readonly tabela: Float32Array;
  private readonly filtrar: boolean;
  private historico: Float32Array;
  private pos: number;

  constructor(taxaEntrada: number, taxaSaida: number) {
    this.razao = taxaEntrada / taxaSaida;
    if (!Number.isFinite(this.razao) || this.razao <= 0) throw new Error(`Taxa de áudio inválida: ${taxaEntrada} Hz`);
    // Sem redução (mesma taxa, ou subindo a taxa) não há o que dobrar: interpolação linear basta.
    this.filtrar = this.razao > 1.0001;
    this.meia = this.filtrar ? Math.ceil(LARGURA * this.razao) : 0;
    this.tabela = new Float32Array(this.filtrar ? FASES * 2 * this.meia : 0);
    if (this.filtrar) this.montarTabela(taxaEntrada, taxaSaida);
    // A saída fica atrasada em `meia` amostras de entrada (<1 ms): o filtro precisa enxergar o que vem depois.
    this.historico = new Float32Array(this.filtrar ? 2 * this.meia : 0);
    this.pos = this.filtrar ? this.meia : 0;
  }

  private montarTabela(taxaEntrada: number, taxaSaida: number) {
    const m = this.meia;
    const corte = (CORTE * taxaSaida) / taxaEntrada; // ciclos por amostra de entrada
    const i0Beta = bessel0(BETA);
    for (let p = 0; p < FASES; p++) {
      const frac = p / FASES;
      let soma = 0;
      for (let k = 0; k < 2 * m; k++) {
        const t = k - m + 1 - frac; // distância entre a amostra de entrada e o ponto de saída
        const u = t / m;
        const janela = Math.abs(u) < 1 ? bessel0(BETA * Math.sqrt(1 - u * u)) / i0Beta : 0;
        const peso = 2 * corte * sinc(2 * corte * t) * janela;
        this.tabela[p * 2 * m + k] = peso;
        soma += peso;
      }
      for (let k = 0; k < 2 * m; k++) this.tabela[p * 2 * m + k] /= soma; // ganho 1 em frequência zero
    }
  }

  /** Recebe um bloco do microfone (Float32, -1 a 1) e devolve as amostras de 16 kHz (Int16) que ficaram prontas. */
  processar(entrada: Float32Array): Int16Array {
    return this.filtrar ? this.processarComFiltro(entrada) : this.processarLinear(entrada);
  }

  private processarLinear(entrada: Float32Array): Int16Array {
    const saida: number[] = [];
    let pos = this.pos;
    while (pos < entrada.length) {
      const i = Math.floor(pos);
      const frac = pos - i;
      const s0 = entrada[i];
      const s1 = i + 1 < entrada.length ? entrada[i + 1] : s0;
      saida.push(paraInt16(s0 + (s1 - s0) * frac));
      pos += this.razao;
    }
    this.pos = pos - entrada.length;
    return Int16Array.from(saida);
  }

  private processarComFiltro(entrada: Float32Array): Int16Array {
    const m = this.meia;
    const buf = new Float32Array(this.historico.length + entrada.length);
    buf.set(this.historico, 0);
    buf.set(entrada, this.historico.length);
    const saida = new Int16Array(Math.max(0, Math.ceil((buf.length - this.pos) / this.razao)));
    let n = 0;
    let pos = this.pos;
    for (;;) {
      let i = Math.floor(pos);
      let fase = Math.round((pos - i) * FASES);
      if (fase === FASES) { fase = 0; i++; }
      if (i + m > buf.length - 1) break; // faltam amostras à frente: espera o próximo bloco
      const base = fase * 2 * m;
      const inicio = i - m + 1;
      let acc = 0;
      for (let k = 0; k < 2 * m; k++) acc += buf[inicio + k] * this.tabela[base + k];
      saida[n++] = paraInt16(acc);
      pos += this.razao;
    }
    const descartar = Math.max(0, Math.floor(pos) - m + 1);
    this.historico = buf.slice(descartar);
    this.pos = pos - descartar;
    return saida.slice(0, n);
  }
}
