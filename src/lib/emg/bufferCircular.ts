/**
 * Buffer circular de amostras (Float64) para a tela ao vivo: guarda só o final do
 * sinal, com memória fixa. Sem DOM e sem dependências.
 *
 * `empurrar` copia as amostras para o espaço já alocado, sem criar objetos por
 * amostra; só `ultimas` aloca (uma cópia, para o gráfico poder desenhar enquanto
 * novas amostras chegam).
 */
export class BufferCircular {
  readonly capacidade: number;
  private readonly dados: Float64Array;
  /** Posição onde entra a próxima amostra. */
  private escrita = 0;
  private cheios = 0;
  private total = 0;

  constructor(capacidade: number) {
    if (!Number.isInteger(capacidade) || capacidade < 1) {
      throw new RangeError(`capacidade deve ser um inteiro >= 1 (recebido ${capacidade})`);
    }
    this.capacidade = capacidade;
    this.dados = new Float64Array(capacidade);
  }

  /** Quantas amostras estão guardadas agora (no máximo a capacidade). */
  get comprimento(): number {
    return this.cheios;
  }

  /** Quantas amostras já entraram desde a criação ou desde o último `limpar`, mesmo as que saíram. */
  get totalRecebido(): number {
    return this.total;
  }

  /** Se entrar mais que a capacidade de uma vez, só o final é guardado (e todas contam em totalRecebido). */
  empurrar(amostras: ArrayLike<number>): void {
    const n = amostras.length;
    if (n === 0) return;
    const inicio = Math.max(0, n - this.capacidade);
    for (let i = inicio; i < n; i++) {
      this.dados[this.escrita] = amostras[i];
      this.escrita++;
      if (this.escrita === this.capacidade) this.escrita = 0;
    }
    this.cheios = Math.min(this.capacidade, this.cheios + (n - inicio));
    this.total += n;
  }

  /**
   * As `n` amostras mais recentes, da mais antiga para a mais nova. Se `n` passa do
   * que há guardado, devolve tudo o que há. `n` precisa ser >= 0 (Infinity vale como "tudo").
   */
  ultimas(n: number): Float64Array {
    if (Number.isNaN(n) || n < 0) {
      throw new RangeError(`n deve ser um número >= 0 (recebido ${n})`);
    }
    const quantas = Math.min(Math.floor(n), this.cheios);
    const saida = new Float64Array(quantas);
    // A amostra mais nova está logo antes de `escrita`; a mais antiga das `quantas`, `quantas` posições atrás.
    let leitura = this.escrita - quantas;
    if (leitura < 0) leitura += this.capacidade;
    for (let i = 0; i < quantas; i++) {
      saida[i] = this.dados[leitura];
      leitura++;
      if (leitura === this.capacidade) leitura = 0;
    }
    return saida;
  }

  /** Esvazia o buffer e zera os contadores; o conteúdo antigo também é apagado da memória. */
  limpar(): void {
    this.dados.fill(0);
    this.escrita = 0;
    this.cheios = 0;
    this.total = 0;
  }
}
