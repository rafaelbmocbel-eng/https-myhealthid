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

describe('banco falso: jsonb e valores padrão', () => {
  it('eq com texto JSON compara com o jsonb da coluna (como o PostgREST); cassi_financeiro_clientes nasce com lancamentos = []', async () => {
    const banco = criarBancoFalso({ cassi_financeiro_clientes: [{ id: '1', paciente_id: 'a' }, { id: '2', paciente_id: 'b', lancamentos: [{ '012': 1 }] }] });
    const q = (banco.from('cassi_financeiro_clientes') as any).select('paciente_id').eq('lancamentos', '[]');
    expect((await q).data).toEqual([{ paciente_id: 'a' }]);
    await (banco.from('cassi_financeiro_clientes') as any).upsert([{ paciente_id: 'c' }], { onConflict: 'paciente_id' });
    expect(banco.tabelas.cassi_financeiro_clientes.find((l) => l.paciente_id === 'c')?.lancamentos).toEqual([]);
    const lixo = (banco.from('cassi_financeiro_clientes') as any).select('paciente_id').eq('lancamentos', 'isto não é json');
    expect((await lixo).data).toEqual([]);
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
