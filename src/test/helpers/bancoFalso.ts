// Banco falso em memória para testar telas inteiras sem rede: imita o encadeamento do client do Supabase
// (select/eq/in/ilike/gte/lt/is/not/order/limit/update/insert/upsert/delete) sobre tabelas de verdade em
// memória, e registra cada operação para o teste conferir o que foi gravado.
export type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface Operacao {
  tabela: string;
  tipo: 'select' | 'update' | 'insert' | 'upsert' | 'delete';
  payload?: unknown;
  opcoes?: unknown;
  filtros: Array<[string, ...unknown[]]>;
}

export interface BancoFalso {
  from: (tabela: string) => unknown;
  tabelas: Record<string, Linha[]>;
  operacoes: Operacao[];
  escritas: () => Operacao[];
  // Faz toda escrita que casar com o filtro devolver este erro (para testar o caminho de falha).
  falharEscritaQuando: (quando: ((op: Operacao) => boolean) | null, mensagem?: string) => void;
  // Segura cada escrita até a função devolver (para testar duas gravações em andamento ao mesmo tempo).
  antesDeEscrever: (gancho: ((op: Operacao) => Promise<void> | void) | null) => void;
}

const comparar = (a: unknown, b: unknown) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);

export function criarBancoFalso(inicial: Record<string, Linha[]>): BancoFalso {
  const tabelas: Record<string, Linha[]> = {};
  for (const [nome, linhas] of Object.entries(inicial)) tabelas[nome] = linhas.map((l) => ({ ...l }));
  const operacoes: Operacao[] = [];
  let falhar: ((op: Operacao) => boolean) | null = null;
  let ganchoEscrita: ((op: Operacao) => Promise<void> | void) | null = null;
  let mensagemFalha = 'falha simulada';

  class Consulta implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
    private tipo: Operacao['tipo'] = 'select';
    private payload: unknown;
    private opcoes: unknown;
    private filtros: Array<[string, ...unknown[]]> = [];
    private testes: Array<(r: Linha) => boolean> = [];
    private unico = false;
    private colunas: string[] | null = null;
    private faixa: [number, number] | null = null;
    constructor(private tabela: string) {}

    // Como o PostgREST: só devolve as colunas pedidas ("*" e relações embutidas devolvem a linha inteira).
    select(colunas?: string) {
      if (typeof colunas === 'string' && !colunas.includes('*') && !colunas.includes('(')) this.colunas = colunas.split(',').map((c) => c.trim()).filter(Boolean);
      return this;
    }
    private filtro(nome: string, args: unknown[], teste: (r: Linha) => boolean) {
      this.filtros.push([nome, ...args]);
      this.testes.push(teste);
      return this;
    }
    eq(c: string, v: unknown) { return this.filtro('eq', [c, v], (r) => r[c] === v); }
    neq(c: string, v: unknown) { return this.filtro('neq', [c, v], (r) => r[c] !== v); }
    in(c: string, vs: unknown[]) { return this.filtro('in', [c, vs], (r) => vs.includes(r[c])); }
    is(c: string, v: unknown) { return this.filtro('is', [c, v], (r) => (r[c] ?? null) === v); }
    not(c: string, op: string, v: unknown) {
      return this.filtro('not', [c, op, v], (r) => (op === 'is' ? (r[c] ?? null) !== v : true));
    }
    ilike(c: string, padrao: string) {
      const re = new RegExp(`^${padrao.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*')}$`, 'i');
      return this.filtro('ilike', [c, padrao], (r) => re.test(String(r[c] ?? '')));
    }
    gte(c: string, v: unknown) { return this.filtro('gte', [c, v], (r) => comparar(r[c], v) >= 0); }
    gt(c: string, v: unknown) { return this.filtro('gt', [c, v], (r) => comparar(r[c], v) > 0); }
    lte(c: string, v: unknown) { return this.filtro('lte', [c, v], (r) => comparar(r[c], v) <= 0); }
    lt(c: string, v: unknown) { return this.filtro('lt', [c, v], (r) => comparar(r[c], v) < 0); }
    order() { return this; }
    limit() { return this; }
    range(de: number, ate: number) { this.faixa = [de, ate]; return this; }
    update(p: unknown) { this.tipo = 'update'; this.payload = p; return this; }
    insert(p: unknown) { this.tipo = 'insert'; this.payload = p; return this; }
    upsert(p: unknown, o?: unknown) { this.tipo = 'upsert'; this.payload = p; this.opcoes = o; return this; }
    delete() { this.tipo = 'delete'; return this; }
    maybeSingle() { this.unico = true; return this; }
    single() { this.unico = true; return this; }

    private operacao(): Operacao {
      return { tabela: this.tabela, tipo: this.tipo, payload: this.payload, opcoes: this.opcoes, filtros: this.filtros };
    }

    private executar(op: Operacao) {
      operacoes.push(op);
      const linhas = (tabelas[this.tabela] ??= []);
      if (this.tipo !== 'select' && falhar && falhar(op)) return { data: null, error: { message: mensagemFalha } };
      const casa = (r: Linha) => this.testes.every((t) => t(r));
      if (this.tipo === 'select') {
        const cols = this.colunas;
        const faixa = this.faixa;
        const filtradas = linhas.filter(casa);
        const achadas = (faixa ? filtradas.slice(faixa[0], faixa[1] + 1) : filtradas).map((l) => (cols ? Object.fromEntries(cols.map((c) => [c, l[c]])) : { ...l }));
        return { data: this.unico ? (achadas[0] ?? null) : achadas, error: null };
      }
      if (this.tipo === 'update') {
        for (const l of linhas.filter(casa)) Object.assign(l, this.payload as Linha);
        return { data: null, error: null };
      }
      if (this.tipo === 'delete') {
        tabelas[this.tabela] = linhas.filter((l) => !casa(l));
        return { data: null, error: null };
      }
      const novas = (Array.isArray(this.payload) ? this.payload : [this.payload]) as Linha[];
      const conflito = String((this.opcoes as { onConflict?: string } | undefined)?.onConflict || '').split(',').filter(Boolean);
      for (const n of novas) {
        const repetida = conflito.length > 0 && linhas.some((l) => conflito.every((c) => l[c] === n[c]));
        if (repetida && this.tipo === 'upsert') continue;
        linhas.push({ id: `${this.tabela}-${linhas.length + 1}`, ...n });
      }
      return { data: null, error: null };
    }

    then<R1 = { data: unknown; error: { message: string } | null }, R2 = never>(
      resolver?: ((v: { data: unknown; error: { message: string } | null }) => R1 | PromiseLike<R1>) | null,
      rejeitar?: ((e: unknown) => R2 | PromiseLike<R2>) | null,
    ): PromiseLike<R1 | R2> {
      const op = this.operacao();
      return Promise.resolve()
        .then(async () => { if (op.tipo !== 'select' && ganchoEscrita) await ganchoEscrita(op); })
        .then(() => this.executar(op))
        .then(resolver, rejeitar);
    }
  }

  return {
    from: (tabela: string) => new Consulta(tabela),
    tabelas,
    operacoes,
    escritas: () => operacoes.filter((o) => o.tipo !== 'select'),
    falharEscritaQuando: (quando, mensagem = 'falha simulada') => { falhar = quando; mensagemFalha = mensagem; },
    antesDeEscrever: (gancho) => { ganchoEscrita = gancho; },
  };
}
