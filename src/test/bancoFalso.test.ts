import { describe, it, expect } from 'vitest';
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
