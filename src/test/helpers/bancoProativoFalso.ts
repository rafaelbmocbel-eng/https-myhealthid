// Banco falso em memória para o teste do handler do agente-proativo. O bancoFalso comum não tem o que o handler usa:
// contagem sem linhas (select com count e head) e o id da linha recém-inserida (insert().select().single()).
// Cada consulta é anotada para o teste conferir o que foi lido e gravado, e dá para mandar uma tabela falhar.
export type Linha = Record<string, unknown>;

export interface ConsultaAnotada {
  tabela: string;
  op: 'select' | 'insert' | 'update' | 'delete';
  payload?: unknown;
  chamadas: Array<[string, unknown[]]>;
}

export interface RegraDeFalha {
  tabela: string;
  op: ConsultaAnotada['op'];
  // 'erro' devolve { error } como o PostgREST; 'lancar' rejeita a promessa como uma queda de rede.
  tipo: 'erro' | 'lancar';
  mensagem?: string;
  quando?: (c: ConsultaAnotada) => boolean;
}

export interface BancoProativo {
  from: (tabela: string) => unknown;
  tabelas: Record<string, Linha[]>;
  consultas: ConsultaAnotada[];
  regras: RegraDeFalha[];
  linhas: (tabela: string) => Linha[];
}

type Resultado = { data: unknown; error: { message: string } | null; count?: number };

const textoDe = (v: unknown) => String(v);

export function criarBancoProativo(inicial: Record<string, Linha[]>): BancoProativo {
  const tabelas: Record<string, Linha[]> = {};
  for (const [nome, linhas] of Object.entries(inicial)) tabelas[nome] = linhas.map((l) => ({ ...l }));
  const consultas: ConsultaAnotada[] = [];
  const regras: RegraDeFalha[] = [];

  class Consulta implements PromiseLike<Resultado> {
    private anotada: ConsultaAnotada;
    private testes: Array<(r: Linha) => boolean> = [];
    private colunas: string[] | null = null;
    private contar = false;
    private semCorpo = false;
    private ordens: Array<{ coluna: string; crescente: boolean }> = [];
    private unico: 'nenhum' | 'maybe' | 'single' = 'nenhum';
    private pedeRetorno = false;

    constructor(private tabela: string) {
      this.anotada = { tabela, op: 'select', chamadas: [] };
    }

    private nota(metodo: string, args: unknown[]) {
      this.anotada.chamadas.push([metodo, args]);
    }

    private filtro(metodo: string, args: unknown[], teste: (r: Linha) => boolean) {
      this.nota(metodo, args);
      this.testes.push(teste);
      return this;
    }

    select(colunas?: string, opcoes?: { count?: string; head?: boolean }) {
      this.nota('select', [colunas, opcoes]);
      if (this.anotada.op === 'insert' || this.anotada.op === 'update') this.pedeRetorno = true;
      if (opcoes?.count) this.contar = true;
      if (opcoes?.head) this.semCorpo = true;
      if (typeof colunas === 'string' && colunas !== '*') this.colunas = colunas.split(',').map((c) => c.trim());
      return this;
    }

    eq(c: string, v: unknown) { return this.filtro('eq', [c, v], (r) => (r[c] ?? null) === (v ?? null)); }
    neq(c: string, v: unknown) { return this.filtro('neq', [c, v], (r) => r[c] !== v); }
    is(c: string, v: unknown) { return this.filtro('is', [c, v], (r) => (r[c] ?? null) === v); }
    not(c: string, op: string, v: unknown) {
      return this.filtro('not', [c, op, v], (r) => {
        if (op === 'is') return (r[c] ?? null) !== v;
        // Formato do PostgREST: "(a,b,c)".
        if (op === 'in') return !String(v).replace(/^\(|\)$/g, '').split(',').includes(String(r[c]));
        return true;
      });
    }
    in(c: string, valores: unknown[]) { return this.filtro('in', [c, valores], (r) => valores.includes(r[c])); }
    gte(c: string, v: unknown) { return this.filtro('gte', [c, v], (r) => textoDe(r[c]) >= textoDe(v)); }
    lte(c: string, v: unknown) { return this.filtro('lte', [c, v], (r) => textoDe(r[c]) <= textoDe(v)); }
    order(coluna: string, opcoes?: { ascending?: boolean }) {
      this.nota('order', [coluna, opcoes]);
      this.ordens.push({ coluna, crescente: opcoes?.ascending !== false });
      return this;
    }
    limit(n: number) { this.nota('limit', [n]); return this; }
    maybeSingle() { this.nota('maybeSingle', []); this.unico = 'maybe'; return this; }
    single() { this.nota('single', []); this.unico = 'single'; return this; }
    insert(payload: unknown) { this.nota('insert', [payload]); this.anotada.op = 'insert'; this.anotada.payload = payload; return this; }
    update(payload: unknown) { this.nota('update', [payload]); this.anotada.op = 'update'; this.anotada.payload = payload; return this; }
    delete() { this.nota('delete', []); this.anotada.op = 'delete'; return this; }

    private projetar(l: Linha): Linha {
      if (!this.colunas) return { ...l };
      return Object.fromEntries(this.colunas.map((c) => [c, l[c]]));
    }

    private executar(): Resultado {
      const linhas = (tabelas[this.tabela] ??= []);
      const casa = (r: Linha) => this.testes.every((t) => t(r));
      const op = this.anotada.op;

      if (op === 'insert') {
        const nova: Linha = {
          id: `${this.tabela}-${linhas.length + 1}`,
          created_at: new Date().toISOString(),
          ...(this.anotada.payload as Linha),
        };
        linhas.push(nova);
        if (!this.pedeRetorno) return { data: null, error: null };
        return { data: this.projetar(nova), error: null };
      }
      if (op === 'update') {
        const alteradas = linhas.filter(casa);
        for (const l of alteradas) Object.assign(l, this.anotada.payload as Linha);
        if (!this.pedeRetorno) return { data: null, error: null };
        return { data: alteradas.map((l) => this.projetar(l)), error: null };
      }
      if (op === 'delete') {
        tabelas[this.tabela] = linhas.filter((l) => !casa(l));
        return { data: null, error: null };
      }

      const achadas = linhas.filter(casa);
      for (const o of [...this.ordens].reverse()) {
        achadas.sort((a, b) => {
          const x = textoDe(a[o.coluna] ?? '');
          const y = textoDe(b[o.coluna] ?? '');
          if (x === y) return 0;
          return (x < y ? -1 : 1) * (o.crescente ? 1 : -1);
        });
      }
      const limite = this.anotada.chamadas.find(([m]) => m === 'limit')?.[1][0];
      const cortadas = typeof limite === 'number' ? achadas.slice(0, limite) : achadas;
      const contagem = this.contar ? { count: achadas.length } : {};
      if (this.semCorpo) return { data: null, error: null, ...contagem };
      const projetadas = cortadas.map((l) => this.projetar(l));
      if (this.unico === 'nenhum') return { data: projetadas, error: null, ...contagem };
      return { data: projetadas[0] ?? null, error: null, ...contagem };
    }

    then<R1 = Resultado, R2 = never>(
      resolver?: ((v: Resultado) => R1 | PromiseLike<R1>) | null,
      rejeitar?: ((e: unknown) => R2 | PromiseLike<R2>) | null,
    ): PromiseLike<R1 | R2> {
      consultas.push(this.anotada);
      const regra = regras.find((r) => r.tabela === this.tabela && r.op === this.anotada.op && (r.quando?.(this.anotada) ?? true));
      const mensagem = regra?.mensagem ?? 'falha simulada';
      if (regra?.tipo === 'lancar') return Promise.reject(new Error(mensagem)).then(resolver, rejeitar);
      const resultado: Resultado = regra ? { data: null, error: { message: mensagem } } : this.executar();
      return Promise.resolve(resultado).then(resolver, rejeitar);
    }
  }

  return {
    from: (tabela: string) => new Consulta(tabela),
    tabelas,
    consultas,
    regras,
    linhas: (tabela: string) => tabelas[tabela] ?? [],
  };
}
