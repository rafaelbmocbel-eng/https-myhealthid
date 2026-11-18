import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { criarBancoFalso } from './helpers/bancoFalso';

// O banco falso é a base dos testes de tela do Controle CASSI: se ele não ordena como o PostgREST, uma regra que
// depende de order() (guia mais recente primeiro, por exemplo) passa nos testes sem passar de verdade.
describe('banco falso: order()', () => {
  const lerOrdenado = async (linhas: Array<Record<string, unknown>>, ...ordens: Array<[string, boolean]>) => {
    const banco = criarBancoFalso({ t: linhas });
    let q = (banco.from('t') as { select: (c: string) => unknown }).select('*') as { order: (c: string, o: { ascending: boolean }) => unknown };
    for (const [coluna, crescente] of ordens) q = q.order(coluna, { ascending: crescente }) as typeof q;
    return (await (q as unknown as PromiseLike<{ data: Array<Record<string, unknown>> }>)).data;
  };

  it('crescente e decrescente, com números como números (10 vem depois de 9)', async () => {
    const linhas = [{ n: 10 }, { n: 9 }, { n: 100 }];
    expect((await lerOrdenado(linhas, ['n', true])).map((l) => l.n)).toEqual([9, 10, 100]);
    expect((await lerOrdenado(linhas, ['n', false])).map((l) => l.n)).toEqual([100, 10, 9]);
  });

  it('a primeira ordem manda e a seguinte desempata', async () => {
    const linhas = [{ d: '2026-10-01', c: '2026-10-01T10' }, { d: '2026-10-05', c: '2026-10-05T08' }, { d: '2026-10-05', c: '2026-10-05T09' }];
    expect((await lerOrdenado(linhas, ['d', false], ['c', false])).map((l) => l.c)).toEqual(['2026-10-05T09', '2026-10-05T08', '2026-10-01T10']);
  });

  it('nulos por último na ordem crescente e primeiro na decrescente (como o Postgres)', async () => {
    const linhas = [{ n: 2 }, { n: null }, { n: 1 }];
    expect((await lerOrdenado(linhas, ['n', true])).map((l) => l.n)).toEqual([1, 2, null]);
    expect((await lerOrdenado(linhas, ['n', false])).map((l) => l.n)).toEqual([null, 2, 1]);
  });
});

type Tabela = {
  select: (colunas: string) => { eq: (coluna: string, valor: unknown) => PromiseLike<{ data: unknown }> };
  upsert: (linhas: unknown[], opcoes: unknown) => PromiseLike<unknown>;
};

describe('banco falso: jsonb e valores padrão', () => {
  it('eq com texto JSON compara com o jsonb da coluna (como o PostgREST); cassi_financeiro_clientes nasce com lancamentos = []', async () => {
    const banco = criarBancoFalso({ cassi_financeiro_clientes: [{ id: '1', paciente_id: 'a' }, { id: '2', paciente_id: 'b', lancamentos: [{ '012': 1 }] }] });
    const tabela = () => banco.from('cassi_financeiro_clientes') as unknown as Tabela;
    expect((await tabela().select('paciente_id').eq('lancamentos', '[]')).data).toEqual([{ paciente_id: 'a' }]);
    await tabela().upsert([{ paciente_id: 'c' }], { onConflict: 'paciente_id' });
    expect(banco.tabelas.cassi_financeiro_clientes.find((l) => l.paciente_id === 'c')?.lancamentos).toEqual([]);
    expect((await tabela().select('paciente_id').eq('lancamentos', 'isto não é json')).data).toEqual([]);
  });
});

describe('banco falso: select com caminho JSON e apelido (como o PostgREST)', () => {
  const ler = async (colunas: string) => {
    const banco = criarBancoFalso({ t: [
      { id: 1, resultado: { _meta: { origem: 'portal_paciente_historia', n: 3 } } },
      { id: 2, resultado: { _meta: {} } },
      { id: 3, resultado: null },
      { id: 4, resultado: { outro: 1 } },
    ] });
    return ((await (banco.from('t') as unknown as { select: (c: string) => PromiseLike<{ data: unknown }> }).select(colunas)).data) as Array<Record<string, unknown>>;
  };

  it('"->>" devolve texto; caminho que não existe, ou coluna nula, devolve null', async () => {
    expect(await ler('id, origem:resultado->_meta->>origem')).toEqual([
      { id: 1, origem: 'portal_paciente_historia' }, { id: 2, origem: null }, { id: 3, origem: null }, { id: 4, origem: null },
    ]);
  });

  it('"->>" num número devolve o número como texto e "->" devolve o json', async () => {
    expect((await ler('n:resultado->_meta->>n'))[0]).toEqual({ n: '3' });
    expect((await ler('meta:resultado->_meta'))[0]).toEqual({ meta: { origem: 'portal_paciente_historia', n: 3 } });
  });

  it('coluna comum continua igual (sem apelido não se mexe)', async () => {
    expect((await ler('id'))[1]).toEqual({ id: 2 });
  });
});

describe('banco falso: rpc()', () => {
  it('registra a chamada como escrita, aceita falha simulada e recusa função que não existe', async () => {
    const banco = criarBancoFalso({ cassi_financeiro_clientes: [] });
    const inexistente = await banco.rpc('nao_existe', { a: 1 });
    expect(inexistente.error?.message).toMatch(/Could not find the function/);
    banco.falharEscritaQuando((op) => op.tipo === 'rpc', 'sem permissão');
    const falha = await banco.rpc('cassi_juntar_financeiro_clientes', { p_origem: 'a', p_destino: 'b' });
    expect(falha.error?.message).toBe('sem permissão');
    expect(banco.escritas().map((o) => [o.tipo, o.tabela])).toEqual([['rpc', 'nao_existe'], ['rpc', 'cassi_juntar_financeiro_clientes']]);
  });

  it('a mensagem e o teto do espelho são os da função SQL de verdade', async () => {
    const sql = readFileSync(join(__dirname, '..', '..', 'supabase', 'migrations', '20261025230000_cassi_financeiro_lancamentos.sql'), 'utf8');
    const teto = Number(sql.match(/c_max_guias CONSTANT integer := (\d+)/)?.[1]);
    const modelo = sql.match(/RAISE EXCEPTION '(O cliente ficaria com[^']*)'/)?.[1] ?? '';
    const esperada = [7, '2026-07', teto].reduce<string>((texto, valor) => texto.replace('%', String(valor)), modelo);
    const linha = (id: string, pid: string, n: number) => ({ id, terapeuta_id: 'u', mes: '2026-07', paciente_id: pid, lancamentos: Array.from({ length: n }, () => ({ '012': 1 })) });
    const banco = criarBancoFalso({ cassi_financeiro_clientes: [linha('1', 'dup', 4), linha('2', 'fica', 3)] });
    expect((await banco.rpc('cassi_juntar_financeiro_clientes', { p_origem: 'dup', p_destino: 'fica' })).error?.message).toBe(esperada);
    const exato = criarBancoFalso({ cassi_financeiro_clientes: [linha('1', 'dup', teto - 2), linha('2', 'fica', 2)] });
    expect((await exato.rpc('cassi_juntar_financeiro_clientes', { p_origem: 'dup', p_destino: 'fica' })).error).toBeNull(); // exatamente o teto passa
  });

  it('a função de juntar espelha o SQL: tudo ou nada, até 6 guias, guia vazia descartada, origem some', async () => {
    const linha = (id: string, mes: string, pid: string, lancamentos: Array<Record<string, number>>) => ({ id, terapeuta_id: 'u', mes, paciente_id: pid, lancamentos });
    const banco = criarBancoFalso({ cassi_financeiro_clientes: [
      linha('1', '2026-06', 'dup', [{ '012': 1 }]),
      linha('2', '2026-07', 'dup', [{ '012': 1 }, { '012': 2 }, { '012': 3 }, { '012': 4 }]),
      linha('3', '2026-07', 'fica', [{ '144': 1 }, { '144': 1 }, { '144': 1 }]),
    ] });
    const estouro = await banco.rpc('cassi_juntar_financeiro_clientes', { p_origem: 'dup', p_destino: 'fica' });
    expect(estouro.error?.message).toMatch(/ficaria com 7 guias em 2026-07/);
    expect(banco.tabelas.cassi_financeiro_clientes).toHaveLength(3); // nada mudou, nem o mês que cabia
    banco.tabelas.cassi_financeiro_clientes[1].lancamentos = [{ '012': 9 }, {}];
    const ok = await banco.rpc('cassi_juntar_financeiro_clientes', { p_origem: 'dup', p_destino: 'fica' });
    expect(ok).toEqual({ data: 2, error: null });
    const fica = banco.tabelas.cassi_financeiro_clientes.filter((l) => l.paciente_id === 'fica');
    expect(fica.find((l) => l.mes === '2026-06')?.lancamentos).toEqual([{ '012': 1 }]);
    expect(fica.find((l) => l.mes === '2026-07')?.lancamentos).toEqual([{ '144': 1 }, { '144': 1 }, { '144': 1 }, { '012': 9 }]);
    expect(banco.tabelas.cassi_financeiro_clientes.some((l) => l.paciente_id === 'dup')).toBe(false);
    const dois = await banco.rpc('cassi_juntar_financeiro_clientes', { p_origem: 'dup', p_destino: 'fica' });
    expect(dois).toEqual({ data: 0, error: null }); // de novo: nada a juntar, nada dobra
  });
});

describe('banco falso: filtro por caminho JSON (eq e not), delete que devolve as linhas e chave repetida', () => {
  interface Resposta { data: unknown; error: { message: string; code?: string } | null }
  interface Consulta extends PromiseLike<Resposta> {
    select: (colunas?: string) => Consulta;
    eq: (coluna: string, valor: unknown) => Consulta;
    not: (coluna: string, op: string, valor: unknown) => Consulta;
    delete: () => Consulta;
    insert: (linhas: unknown) => Consulta;
    upsert: (linhas: unknown, opcoes?: unknown) => Consulta;
  }
  const linhas = () => [
    { id: 'a', paciente_id: 'p1', metadata: { origem: 'confirmacao_de_marco', chave_cliente: 'k1', versao: 1 } },
    { id: 'b', paciente_id: 'p1', metadata: { origem: 'manual' } },
    { id: 'c', paciente_id: 'p1', metadata: {} },
    { id: 'd', paciente_id: 'p2', metadata: { origem: 'confirmacao_de_marco' } },
    { id: 'e', paciente_id: 'p1', metadata: null },
  ];
  const novo = () => {
    const banco = criarBancoFalso({ t: linhas() });
    return { banco, t: () => banco.from('t') as unknown as Consulta };
  };

  it('eq em "coluna->>chave" compara o texto do caminho (e não uma coluna chamada assim, que não existe)', async () => {
    const { t } = novo();
    expect(((await t().select('id').eq('metadata->>origem', 'confirmacao_de_marco')).data as unknown[])).toEqual([{ id: 'a' }, { id: 'd' }]);
    expect(((await t().select('id').eq('metadata->>origem', 'manual')).data as unknown[])).toEqual([{ id: 'b' }]);
    expect(((await t().select('id').eq('metadata->>origem', 'nao-existe')).data as unknown[])).toEqual([]);
  });

  it('eq no caminho com número no json compara o texto ("1"), como o ->> do Postgres', async () => {
    const { t } = novo();
    expect(((await t().select('id').eq('metadata->>versao', '1')).data as unknown[])).toEqual([{ id: 'a' }]);
  });

  it('not(..., "is", null) no caminho tira só as linhas em que o caminho é nulo ou não existe (antes tirava todas)', async () => {
    const { t } = novo();
    expect(((await t().select('id').not('metadata->>chave_cliente', 'is', null)).data as unknown[])).toEqual([{ id: 'a' }]);
    expect(((await t().select('id').not('metadata->>origem', 'is', null)).data as unknown[])).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'd' }]);
  });

  it('coluna comum no eq e no not continua igual', async () => {
    const { t } = novo();
    expect(((await t().select('id').eq('paciente_id', 'p2')).data as unknown[])).toEqual([{ id: 'd' }]);
    expect(((await t().select('id').not('metadata', 'is', null)).data as unknown[]).length).toBe(4);
  });

  it('delete com .select("id") devolve só as linhas removidas e só a coluna pedida; sem .select() não devolve nada', async () => {
    const { banco, t } = novo();
    const r = await t().delete().eq('id', 'a').eq('paciente_id', 'p1').eq('metadata->>origem', 'confirmacao_de_marco').select('id');
    expect(r).toEqual({ data: [{ id: 'a' }], error: null });
    expect(banco.tabelas.t.map((l) => l.id)).toEqual(['b', 'c', 'd', 'e']);
    const semRetorno = await t().delete().eq('id', 'b');
    expect(semRetorno).toEqual({ data: null, error: null });
    expect(banco.tabelas.t.map((l) => l.id)).toEqual(['c', 'd', 'e']);
  });

  it('delete que não casa nenhuma linha devolve lista vazia (não erro) e não apaga nada', async () => {
    const { banco, t } = novo();
    const r = await t().delete().eq('id', 'b').eq('metadata->>origem', 'confirmacao_de_marco').select('id');
    expect(r).toEqual({ data: [], error: null });
    expect(banco.tabelas.t).toHaveLength(5);
  });

  it('delete com .select() sem colunas devolve as linhas inteiras', async () => {
    const { t } = novo();
    const r = await t().delete().eq('id', 'd').select();
    expect(r.data).toEqual([{ id: 'd', paciente_id: 'p2', metadata: { origem: 'confirmacao_de_marco' } }]);
  });

  it('insert com id que já existe recusa com o código 23505, não grava nada e a tentativa fica registrada', async () => {
    const { banco, t } = novo();
    const r = await t().insert({ id: 'a', paciente_id: 'p1' });
    expect(r.data).toBeNull();
    expect(r.error?.code).toBe('23505');
    expect(r.error?.message).toMatch(/duplicate key value violates unique constraint/);
    expect(banco.tabelas.t).toHaveLength(5);
    expect(banco.escritas().map((o) => o.tipo)).toEqual(['insert']);
  });

  it('insert em lote com um id repetido recusa o lote inteiro (como um comando só no Postgres), inclusive repetido dentro do próprio lote', async () => {
    const { banco, t } = novo();
    expect((await t().insert([{ id: 'x1' }, { id: 'a' }])).error?.code).toBe('23505');
    expect((await t().insert([{ id: 'y1' }, { id: 'y1' }])).error?.code).toBe('23505');
    expect(banco.tabelas.t).toHaveLength(5);
  });

  it('insert com id novo, ou sem id, continua gravando; depois de apagar, o mesmo id volta a valer', async () => {
    const { banco, t } = novo();
    expect((await t().insert({ id: 'n1', paciente_id: 'p1' })).error).toBeNull();
    expect((await t().insert({ paciente_id: 'p1' })).error).toBeNull();
    expect((await t().insert({ paciente_id: 'p1' })).error).toBeNull();
    expect(banco.tabelas.t).toHaveLength(8);
    await t().delete().eq('id', 'n1');
    expect((await t().insert({ id: 'n1', paciente_id: 'p1' })).error).toBeNull();
  });

  it('o upsert não muda: segue ignorando a repetida só quando há onConflict', async () => {
    const { banco, t } = novo();
    expect((await t().upsert([{ id: 'a', paciente_id: 'p1' }], { onConflict: 'id' })).error).toBeNull();
    expect(banco.tabelas.t).toHaveLength(5);
  });
});

describe('banco falso: falha simulada com código do banco', () => {
  it('sem código, o erro só tem a mensagem (como sempre); com código, o erro traz o código numerado', async () => {
    const banco = criarBancoFalso({ t: [] });
    banco.falharEscritaQuando((op) => op.tipo === 'insert', 'sem coluna');
    const semCodigo = await (banco.from('t') as { insert: (p: unknown) => PromiseLike<{ error: { message: string; code?: string } | null }> }).insert({ id: 'a' });
    expect(semCodigo.error).toEqual({ message: 'sem coluna' });
    banco.falharEscritaQuando((op) => op.tipo === 'insert', 'sem coluna', 'PGRST204');
    const comCodigo = await (banco.from('t') as { insert: (p: unknown) => PromiseLike<{ error: { message: string; code?: string } | null }> }).insert({ id: 'b' });
    expect(comCodigo.error).toEqual({ message: 'sem coluna', code: 'PGRST204' });
    expect(banco.tabelas.t).toHaveLength(0);
  });

  it('desligar a falha (null) volta a gravar e esquece o código', async () => {
    const banco = criarBancoFalso({ t: [] });
    banco.falharEscritaQuando(() => true, 'x', '42501');
    banco.falharEscritaQuando(null);
    const r = await (banco.from('t') as { insert: (p: unknown) => PromiseLike<{ error: unknown }> }).insert({ id: 'a' });
    expect(r.error).toBeNull();
    expect(banco.tabelas.t).toHaveLength(1);
  });
});

describe('banco falso: padrões que o servidor preenche no insert (opt-in)', () => {
  it('só a linha NOVA ganha o padrão; as linhas iniciais e o que o app mandou ficam como estão', async () => {
    const banco = criarBancoFalso({ t: [{ id: 'a' }] }, { padroesNoInsert: { t: () => ({ created_at: 'agora' }) } });
    const tabela = () => banco.from('t') as { insert: (p: unknown) => PromiseLike<{ error: unknown }> };
    await tabela().insert({ id: 'b' });
    await tabela().insert({ id: 'c', created_at: 'mandado pelo app' });
    expect(banco.tabelas.t).toEqual([{ id: 'a' }, { id: 'b', created_at: 'agora' }, { id: 'c', created_at: 'mandado pelo app' }]);
  });

  it('sem a opção nada muda', async () => {
    const banco = criarBancoFalso({ t: [] });
    await (banco.from('t') as { insert: (p: unknown) => PromiseLike<unknown> }).insert({ id: 'b' });
    expect(banco.tabelas.t).toEqual([{ id: 'b' }]);
  });
});
