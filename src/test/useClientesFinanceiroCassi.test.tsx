import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';

const h = vi.hoisted(() => ({ banco: null as unknown as BancoFalso }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (t: string) => h.banco.from(t) } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1' } }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { useClientesFinanceiroCassi } from '@/hooks/useClientesFinanceiroCassi';

const montar = (de: string, ate: string) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return renderHook(() => useClientesFinanceiroCassi(de, ate), { wrapper });
};
const linha = (mes: string, paciente_id: string, terapeuta_id = 'prof-1'): Linha => ({ id: `${mes}-${paciente_id}-${terapeuta_id}`, terapeuta_id, mes, paciente_id });

describe('useClientesFinanceiroCassi', () => {
  beforeEach(() => { h.banco = criarBancoFalso({ cassi_financeiro_clientes: [] }); });

  it('lê só os meses pedidos e só do profissional logado', async () => {
    h.banco.tabelas.cassi_financeiro_clientes.push(
      linha('2026-04', 'a'), linha('2026-05', 'b'), linha('2026-10', 'c'), linha('2026-11', 'd'), linha('2026-10', 'z', 'outro-profissional'),
    );
    const { result } = montar('2026-05', '2026-10');
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect([...result.current.doMes('2026-05')]).toEqual(['b']);
    expect([...result.current.doMes('2026-10')]).toEqual(['c']);
    expect(result.current.doMes('2026-04').size).toBe(0); // fora da janela
    expect(result.current.doMes('2026-11').size).toBe(0); // fora da janela
  });

  it('lê TODAS as linhas mesmo passando de 1000 (o PostgREST corta em 1000 sem avisar): nenhum cliente some da conta', async () => {
    const muitas = Array.from({ length: 1100 }, (_, i) => linha('2026-10', `cliente-${String(i).padStart(4, '0')}`));
    h.banco.tabelas.cassi_financeiro_clientes.push(...muitas);
    // Corte do PostgREST: cada resposta traz no máximo 1000 linhas, mesmo que o pedido seja maior.
    const original = h.banco.from;
    h.banco.from = ((t: string) => {
      const q = original(t) as any;
      const range = q.range.bind(q);
      q.range = (de: number, ate: number) => range(de, Math.min(ate, de + 999));
      return q;
    }) as typeof h.banco.from;
    const { result } = montar('2026-05', '2026-10');
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.doMes('2026-10').size).toBe(1100);
    expect(result.current.doMes('2026-10').has('cliente-1099')).toBe(true); // a última, que um corte em 1000 perderia
  });

  it('erro só conta quando não há lista para mostrar', async () => {
    const original = h.banco.from;
    h.banco.from = ((t: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'gte', 'lte', 'order', 'range']) q[m] = () => q;
      q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'sem rede' } }).then(res);
      return t === 'cassi_financeiro_clientes' ? q : original(t);
    }) as typeof h.banco.from;
    const { result } = montar('2026-05', '2026-10');
    await waitFor(() => expect(result.current.erro).toBe(true));
    expect(result.current.carregando).toBe(false);
  });
});

describe('useClientesFinanceiroCassi: leitura em ordem fixa e escrita condicional', () => {
  beforeEach(() => { h.banco = criarBancoFalso({ cassi_financeiro_clientes: [] }); });
  const comLanc = (mes: string, paciente_id: string, lancamentos: unknown): Linha => ({ id: `${mes}-${paciente_id}`, terapeuta_id: 'prof-1', mes, paciente_id, lancamentos });

  it('a leitura paginada pede ordem fixa (mês e cliente): sem isso cada página poderia repetir ou pular linhas', async () => {
    const ordens: unknown[][] = [];
    const original = h.banco.from;
    h.banco.from = ((t: string) => {
      const q = original(t) as unknown as { order: (coluna: string, opcoes: unknown) => unknown };
      const order = q.order.bind(q);
      q.order = (coluna: string, opcoes: unknown) => { ordens.push([coluna, opcoes]); return order(coluna, opcoes); };
      return q;
    }) as typeof h.banco.from;
    const { result } = montar('2026-05', '2026-10');
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(ordens).toEqual([['mes', { ascending: true }], ['paciente_id', { ascending: true }]]);
  });

  it.each([
    ['adicionar', (r: ReturnType<typeof montar>['result']) => r.current.adicionar.mutate({ mes: '2026-10', ids: ['a'] })],
    ['lancar', (r: ReturnType<typeof montar>['result']) => r.current.lancar.mutate({ mes: '2026-10', itens: [{ id: 'a', guias: [{ '012': 1 }] }] })],
    ['remover', (r: ReturnType<typeof montar>['result']) => r.current.remover.mutate({ mes: '2026-10', id: 'a' })],
    ['limpar', (r: ReturnType<typeof montar>['result']) => r.current.limpar.mutate({ mes: '2026-10' })],
  ])('ocupado fica verdadeiro enquanto %s grava e volta ao fim', async (_nome, disparar) => {
    h.banco.tabelas.cassi_financeiro_clientes.push(comLanc('2026-10', 'a', []));
    const { result } = montar('2026-05', '2026-10');
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.ocupado).toBe(false);
    let soltar = () => {};
    const retida = new Promise<void>((ok) => { soltar = ok; });
    h.banco.antesDeEscrever(async () => { await retida; });
    act(() => { disparar(result); });
    await waitFor(() => expect(result.current.ocupado).toBe(true));
    soltar();
    await waitFor(() => expect(result.current.ocupado).toBe(false));
  });

  it('sem rede a gravação não fica pausada em "Salvando…": tenta na hora e termina (falha ou sucesso)', async () => {
    h.banco.tabelas.cassi_financeiro_clientes.push(comLanc('2026-10', 'a', []));
    const { result } = montar('2026-05', '2026-10');
    await waitFor(() => expect(result.current.carregando).toBe(false));
    onlineManager.setOnline(false);
    try {
      await act(async () => {
        await result.current.lancar.mutateAsync({ mes: '2026-10', itens: [{ id: 'a', guias: [{ '012': 2 }] }] });
      });
      expect(h.banco.tabelas.cassi_financeiro_clientes[0].lancamentos).toEqual([{ '012': 2 }]);
      expect(result.current.lancar.isPaused).toBe(false);
    } finally {
      onlineManager.setOnline(true);
    }
  });

  it('quando a gravação falha, a mutação termina na hora (o aviso e o botão voltam) e a lista é relida em segundo plano', async () => {
    h.banco.tabelas.cassi_financeiro_clientes.push(comLanc('2026-10', 'a', []));
    const { result } = montar('2026-05', '2026-10');
    await waitFor(() => expect(result.current.carregando).toBe(false));
    let soltar = () => {};
    const retida = new Promise<void>((ok) => { soltar = ok; });
    const original = h.banco.from;
    h.banco.from = ((t: string) => {
      const q = original(t) as unknown as { then: (...a: unknown[]) => unknown; update?: unknown };
      const entrega = q.then.bind(q);
      let leitura = true;
      const atualizar = (q as unknown as { update: (p: unknown) => unknown }).update.bind(q);
      (q as unknown as { update: (p: unknown) => unknown }).update = (p: unknown) => { leitura = false; return atualizar(p); };
      q.then = (res: unknown, rej: unknown) => (leitura ? retida.then(() => entrega(res, rej)) : entrega(res, rej)); // as LEITURAS esperam; a escrita não
      return q;
    }) as typeof h.banco.from;
    h.banco.falharEscritaQuando((op) => op.tipo === 'update', 'sem permissão');
    await act(async () => {
      await expect(result.current.lancar.mutateAsync({ mes: '2026-10', itens: [{ id: 'a', guias: [{ '012': 2 }] }] })).rejects.toThrow('sem permissão');
    });
    expect(result.current.lancar.isPending).toBe(false); // terminou mesmo com a releitura ainda presa
    soltar();
  });

  it('somenteSeVazio: grava em quem continua sem lançamento e devolve quem já tinha (sem tocar nele); sem a opção, cliente fora da lista é erro', async () => {
    h.banco.tabelas.cassi_financeiro_clientes.push(comLanc('2026-10', 'vazio', []), comLanc('2026-10', 'cheio', [{ '301': 2 }]));
    const { result } = montar('2026-05', '2026-10');
    await waitFor(() => expect(result.current.carregando).toBe(false));
    let resposta: { pulados: string[] } | undefined;
    await act(async () => {
      resposta = await result.current.lancar.mutateAsync({ mes: '2026-10', somenteSeVazio: true, itens: [{ id: 'vazio', guias: [{ '012': 5 }] }, { id: 'cheio', guias: [{ '012': 5 }] }, { id: 'fora', guias: [{ '012': 5 }] }] });
    });
    expect(resposta).toEqual({ pulados: ['cheio', 'fora'] });
    const linha = (id: string) => h.banco.tabelas.cassi_financeiro_clientes.find((l) => l.paciente_id === id)?.lancamentos;
    expect(linha('vazio')).toEqual([{ '012': 5 }]);
    expect(linha('cheio')).toEqual([{ '301': 2 }]); // intacto
    await act(async () => {
      await expect(result.current.lancar.mutateAsync({ mes: '2026-10', itens: [{ id: 'fora', guias: [{ '012': 5 }] }] })).rejects.toThrow('o cliente não está mais na lista deste mês');
    });
  });
});

describe('useClientesFinanceiroCassi: lançamentos', () => {
  beforeEach(() => { h.banco = criarBancoFalso({ cassi_financeiro_clientes: [] }); });
  const comLanc = (mes: string, paciente_id: string, lancamentos: unknown): Linha => ({ id: `${mes}-${paciente_id}`, terapeuta_id: 'prof-1', mes, paciente_id, lancamentos });

  it('lê os lançamentos de cada cliente por mês; dado estranho vira lista vazia (nunca quebra a conta)', async () => {
    h.banco.tabelas.cassi_financeiro_clientes.push(
      comLanc('2026-10', 'a', [{ '012': 10, '144': 1 }, { '012': 4 }]),
      comLanc('2026-10', 'b', 'lixo'),
      comLanc('2026-10', 'c', [{ '012': -3, '020': 'x' }, null, 7]),
      comLanc('2026-09', 'a', [{ '131': 3 }]),
    );
    const { result } = montar('2026-05', '2026-10');
    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.lancamentosDoMes('2026-10').get('a')).toEqual([{ '012': 10, '144': 1 }, { '012': 4 }]);
    expect(result.current.lancamentosDoMes('2026-10').get('b')).toEqual([]);
    expect(result.current.lancamentosDoMes('2026-10').get('c')).toEqual([]);
    expect(result.current.lancamentosDoMes('2026-09').get('a')).toEqual([{ '131': 3 }]);
    expect([...result.current.doMes('2026-10')].sort()).toEqual(['a', 'b', 'c']); // quem está na lista continua nela
    expect(result.current.lancamentosDoMes('2026-08').size).toBe(0);
  });

  it('lancar grava uma atualização por cliente, só do profissional logado e do mês, com os lançamentos já limpos', async () => {
    h.banco.tabelas.cassi_financeiro_clientes.push(comLanc('2026-10', 'a', []), comLanc('2026-10', 'b', []), comLanc('2026-09', 'a', []));
    const { result } = montar('2026-05', '2026-10');
    await waitFor(() => expect(result.current.carregando).toBe(false));
    await act(async () => {
      await result.current.lancar.mutateAsync({ mes: '2026-10', itens: [
        { id: 'a', guias: [{ '012': 10, '144': 0 }, {}, { '301': 2 }] },
        { id: 'b', guias: [{ '012': 5 }] },
      ] });
    });
    const escritas = h.banco.escritas();
    expect(escritas.map((o) => o.tipo)).toEqual(['update', 'update']);
    expect(escritas[0].payload).toEqual({ lancamentos: [{ '012': 10 }, { '301': 2 }] }); // zero e guia vazia saem
    expect(escritas[0].filtros).toEqual([['eq', 'terapeuta_id', 'prof-1'], ['eq', 'mes', '2026-10'], ['eq', 'paciente_id', 'a']]);
    expect(h.banco.tabelas.cassi_financeiro_clientes.find((l) => l.mes === '2026-09')?.lancamentos).toEqual([]); // outro mês intacto
    await waitFor(() => expect(result.current.lancamentosDoMes('2026-10').get('b')).toEqual([{ '012': 5 }]));
  });

  it('se alguma gravação falhar, a promessa rejeita e o erro é avisado', async () => {
    h.banco.tabelas.cassi_financeiro_clientes.push(comLanc('2026-10', 'a', []));
    const { result } = montar('2026-05', '2026-10');
    await waitFor(() => expect(result.current.carregando).toBe(false));
    h.banco.falharEscritaQuando((op) => op.tipo === 'update', 'sem permissão');
    await act(async () => {
      await expect(result.current.lancar.mutateAsync({ mes: '2026-10', itens: [{ id: 'a', guias: [{ '012': 1 }] }] })).rejects.toBeTruthy();
    });
  });

  it('sem itens não faz nenhuma gravação', async () => {
    const { result } = montar('2026-05', '2026-10');
    await waitFor(() => expect(result.current.carregando).toBe(false));
    await act(async () => { await result.current.lancar.mutateAsync({ mes: '2026-10', itens: [] }); });
    expect(h.banco.escritas()).toHaveLength(0);
  });
});
