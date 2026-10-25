import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
