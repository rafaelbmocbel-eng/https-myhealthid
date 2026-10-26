// Banco falso em memória para testar telas inteiras sem rede: imita o encadeamento do client do Supabase
// (select/eq/in/ilike/gte/lt/is/not/order/limit/update/insert/upsert/delete/rpc) sobre tabelas de verdade em
// memória, e registra cada operação para o teste conferir o que foi gravado. Não emula CHECK, GRANT nem RLS do
// Postgres: isso é ensaiado com um PostgreSQL de verdade (ver docs/controle-cassi-listas.md).
export type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface Operacao {
  tabela: string;
  tipo: 'select' | 'update' | 'insert' | 'upsert' | 'delete' | 'rpc';
  payload?: unknown;
  opcoes?: unknown;
  filtros: Array<[string, ...unknown[]]>;
}

export interface BancoFalso {
  from: (tabela: string) => unknown;
  // Função do banco (supabase.rpc). Registrada como operação de escrita; o nome vai em `tabela`.
  rpc: (nome: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  tabelas: Record<string, Linha[]>;
  operacoes: Operacao[];
  escritas: () => Operacao[];
  // Faz toda escrita que casar com o filtro devolver este erro (para testar o caminho de falha).
  falharEscritaQuando: (quando: ((op: Operacao) => boolean) | null, mensagem?: string) => void;
  // Segura cada escrita até a função devolver (para testar duas gravações em andamento ao mesmo tempo).
  antesDeEscrever: (gancho: ((op: Operacao) => Promise<void> | void) | null) => void;
}

const comparar = (a: unknown, b: unknown) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);

// Ordem como no Postgres: números como números, texto como texto; nulos por último na ordem crescente e primeiro na decrescente.
const compararOrdem = (a: unknown, b: unknown, crescente: boolean) => {
  const aNulo = a === null || a === undefined;
  const bNulo = b === null || b === undefined;
  if (aNulo || bNulo) return aNulo === bNulo ? 0 : (aNulo ? 1 : -1) * (crescente ? 1 : -1);
  const c = typeof a === 'number' && typeof b === 'number' ? Math.sign(a - b) : comparar(a, b);
  return crescente ? c : -c;
};

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
    private ordens: Array<{ coluna: string; crescente: boolean }> = [];
    private pedeRetorno = false;
    constructor(private tabela: string) {}

    // Como o PostgREST: só devolve as colunas pedidas ("*" e relações embutidas devolvem a linha inteira).
    select(colunas?: string) {
      if (this.tipo === 'update') this.pedeRetorno = true;
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
    // A primeira ordem pedida manda; as seguintes desempatam (como o PostgREST).
    order(coluna: string, opcoes?: { ascending?: boolean }) { this.ordens.push({ coluna, crescente: opcoes?.ascending !== false }); return this; }
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
        if (this.ordens.length > 0) {
          filtradas.sort((x, y) => {
            for (const o of this.ordens) { const c = compararOrdem(x[o.coluna], y[o.coluna], o.crescente); if (c !== 0) return c; }
            return 0;
          });
        }
        const achadas = (faixa ? filtradas.slice(faixa[0], faixa[1] + 1) : filtradas).map((l) => (cols ? Object.fromEntries(cols.map((c) => [c, l[c]])) : { ...l }));
        return { data: this.unico ? (achadas[0] ?? null) : achadas, error: null };
      }
      if (this.tipo === 'update') {
        const alvo = linhas.filter(casa);
        for (const l of alvo) Object.assign(l, this.payload as Linha);
        // Como o PostgREST: com .select() depois do update, devolve as linhas atualizadas.
        return { data: this.pedeRetorno ? alvo.map((l) => ({ ...l })) : null, error: null };
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

  // Funções do banco que o app chama. cassi_juntar_financeiro_clientes espelha a função SQL da migração: junta as linhas
  // do duplicado no cliente que fica, tudo ou nada, recusando mais de 6 guias no mês.
  const funcoes: Record<string, (args: Record<string, unknown>) => { data: unknown; error: { message: string } | null }> = {
    cassi_juntar_financeiro_clientes: (args) => {
      const origem = args.p_origem; const destino = args.p_destino;
      if (!origem || !destino || origem === destino) return { data: null, error: { message: 'Escolha dois cadastros diferentes para juntar' } };
      const linhas = (tabelas.cassi_financeiro_clientes ??= []);
      const doDuplicado = linhas.filter((l) => l.paciente_id === origem).sort((a, b) => comparar(a.mes, b.mes));
      const plano: Array<{ r: Linha; alvo: Linha | undefined; guias: Array<Record<string, number>> }> = [];
      for (const r of doDuplicado) {
        const alvo = linhas.find((l) => l.paciente_id === destino && l.mes === r.mes && l.terapeuta_id === r.terapeuta_id);
        const guias = [...(alvo?.lancamentos ?? []), ...(r.lancamentos ?? [])].filter((g: Record<string, number>) => Object.keys(g).length > 0);
        if (guias.length > 6) return { data: null, error: { message: `O cliente ficaria com ${guias.length} guias em ${r.mes} (o máximo é 6). Ajuste os lançamentos antes de juntar.` } };
        plano.push({ r, alvo, guias });
      }
      for (const { r, alvo, guias } of plano) {
        if (alvo) alvo.lancamentos = guias;
        else linhas.push({ id: `cassi_financeiro_clientes-${linhas.length + 1}`, terapeuta_id: r.terapeuta_id, mes: r.mes, paciente_id: destino, lancamentos: guias });
      }
      tabelas.cassi_financeiro_clientes = linhas.filter((l) => l.paciente_id !== origem);
      return { data: doDuplicado.length, error: null };
    },
  };

  return {
    from: (tabela: string) => new Consulta(tabela),
    rpc: (nome: string, args: Record<string, unknown> = {}) => {
      const op: Operacao = { tabela: nome, tipo: 'rpc', payload: args, filtros: [] };
      return Promise.resolve()
        .then(async () => { if (ganchoEscrita) await ganchoEscrita(op); })
        .then(() => {
          operacoes.push(op);
          if (falhar && falhar(op)) return { data: null, error: { message: mensagemFalha } };
          const f = funcoes[nome];
          return f ? f(args) : { data: null, error: { message: `Could not find the function public.${nome}` } };
        });
    },
    tabelas,
    operacoes,
    escritas: () => operacoes.filter((o) => o.tipo !== 'select'),
    falharEscritaQuando: (quando, mensagem = 'falha simulada') => { falhar = quando; mensagemFalha = mensagem; },
    antesDeEscrever: (gancho) => { ganchoEscrita = gancho; },
  };
}
