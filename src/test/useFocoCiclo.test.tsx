import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Banco falso: registra cada operação encadeada em myid_foco_ciclo e devolve o que o teste definir.
const banco = vi.hoisted(() => ({
  ciclo: null as unknown,
  erroNaEscrita: null as { message: string } | null,
  operacoes: [] as Array<{ tipo: string; args: unknown[]; filtros: unknown[][] }>,
}));
const toastar = vi.hoisted(() => vi.fn());

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => {
      expect(tabela).toBe('myid_foco_ciclo');
      const op = { tipo: 'select', args: [] as unknown[], filtros: [] as unknown[][] };
      const cadeia: Record<string, unknown> = {};
      const registra = (nome: string) => (...a: unknown[]) => { op.filtros.push([nome, ...a]); return cadeia; };
      cadeia.select = (...a: unknown[]) => { op.tipo = 'select'; op.args = a; return cadeia; };
      cadeia.insert = (...a: unknown[]) => { op.tipo = 'insert'; op.args = a; banco.operacoes.push(op); return Promise.resolve({ error: banco.erroNaEscrita }); };
      cadeia.update = (...a: unknown[]) => { op.tipo = 'update'; op.args = a; return cadeia; };
      cadeia.eq = (...a: unknown[]) => {
        op.filtros.push(['eq', ...a]);
        if (op.tipo === 'update') { banco.operacoes.push(op); return Promise.resolve({ error: banco.erroNaEscrita }); }
        return cadeia;
      };
      cadeia.is = registra('is');
      cadeia.maybeSingle = () => { banco.operacoes.push(op); return Promise.resolve({ data: banco.ciclo, error: null }); };
      return cadeia;
    },
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1' } }) }));
vi.mock('@/hooks/use-toast', () => ({ toast: toastar }));

import { useFocoCiclo } from '@/hooks/useFocoCiclo';

const cicloAberto = (dimensoes: string[]) => ({
  id: 'ciclo-1', paciente_id: 'pac-1', avaliacao_base_id: 'ava-1', dimensoes, criado_em: '2026-10-01T12:00:00Z', encerrado_em: null,
});

function montar(habilitado = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return renderHook(() => useFocoCiclo('pac-1', habilitado), { wrapper });
}
const escritas = () => banco.operacoes.filter((o) => o.tipo !== 'select');

beforeEach(() => {
  banco.ciclo = null; banco.erroNaEscrita = null; banco.operacoes = []; toastar.mockClear();
});

describe('useFocoCiclo', () => {
  it('lê só o ciclo ABERTO do paciente (encerrado_em nulo)', async () => {
    banco.ciclo = cicloAberto(['D']);
    const { result } = montar();
    await waitFor(() => expect(result.current.foco?.dimensoes).toEqual(['D']));
    const leitura = banco.operacoes[0];
    expect(leitura.filtros).toEqual([['eq', 'paciente_id', 'pac-1'], ['is', 'encerrado_em', null]]);
  });

  it('não consulta nada quando desabilitado (cliente)', async () => {
    const { result } = montar(false);
    await act(async () => { await Promise.resolve(); });
    expect(banco.operacoes).toHaveLength(0);
    expect(result.current.foco).toBeNull();
  });

  it('sem ciclo, marcar uma dimensão cria o ciclo com o MyID atual como base e o profissional logado', async () => {
    const { result } = montar();
    await waitFor(() => expect(result.current.carregando).toBe(false));
    await act(async () => { await result.current.alternar.mutateAsync({ dimensao: 'D', avaliacaoAtualId: 'ava-9' }); });
    expect(escritas()).toHaveLength(1);
    expect(escritas()[0].tipo).toBe('insert');
    expect(escritas()[0].args[0]).toEqual({ paciente_id: 'pac-1', terapeuta_id: 'prof-1', avaliacao_base_id: 'ava-9', dimensoes: ['D'] });
  });

  it('com ciclo aberto, marcar outra dimensão atualiza a lista sem mexer na base', async () => {
    banco.ciclo = cicloAberto(['D', 'P']);
    const { result } = montar();
    await waitFor(() => expect(result.current.foco).not.toBeNull());
    await act(async () => { await result.current.alternar.mutateAsync({ dimensao: 'R', avaliacaoAtualId: 'ava-9' }); });
    const w = escritas()[0];
    expect(w.tipo).toBe('update');
    expect(w.args[0]).toEqual({ dimensoes: ['D', 'P', 'R'] });
    expect(w.filtros).toEqual([['eq', 'id', 'ciclo-1']]);
  });

  it('tirar a última dimensão encerra o ciclo em vez de deixá-lo vazio', async () => {
    banco.ciclo = cicloAberto(['D']);
    const { result } = montar();
    await waitFor(() => expect(result.current.foco).not.toBeNull());
    await act(async () => { await result.current.alternar.mutateAsync({ dimensao: 'D', avaliacaoAtualId: 'ava-9' }); });
    const w = escritas()[0];
    expect(w.tipo).toBe('update');
    expect(Object.keys(w.args[0] as object)).toEqual(['encerrado_em']);
  });

  it('no limite de 3 não grava nada e avisa', async () => {
    banco.ciclo = cicloAberto(['D', 'P', 'R']);
    const { result } = montar();
    await waitFor(() => expect(result.current.foco).not.toBeNull());
    await act(async () => { await result.current.alternar.mutateAsync({ dimensao: 'C', avaliacaoAtualId: 'ava-9' }); });
    expect(escritas()).toHaveLength(0);
    expect(toastar).toHaveBeenCalledWith(expect.objectContaining({ title: 'O foco vai até 3 dimensões' }));
  });

  it('encerrar e reiniciar atualizam o ciclo certo', async () => {
    banco.ciclo = cicloAberto(['D']);
    const { result } = montar();
    await waitFor(() => expect(result.current.foco).not.toBeNull());
    await act(async () => { await result.current.reiniciar.mutateAsync('ava-9'); });
    const reinicio = escritas()[0];
    expect(reinicio.args[0]).toMatchObject({ avaliacao_base_id: 'ava-9' });
    expect(Object.keys(reinicio.args[0] as object).sort()).toEqual(['avaliacao_base_id', 'criado_em']);
    expect(reinicio.filtros).toEqual([['eq', 'id', 'ciclo-1']]);
    await act(async () => { await result.current.encerrar.mutateAsync(); });
    expect(Object.keys(escritas()[1].args[0] as object)).toEqual(['encerrado_em']);
  });

  it('erro do banco vira aviso, sem derrubar a tela', async () => {
    banco.erroNaEscrita = { message: 'boom' };
    const { result } = montar();
    await waitFor(() => expect(result.current.carregando).toBe(false));
    await act(async () => { await result.current.alternar.mutateAsync({ dimensao: 'D', avaliacaoAtualId: 'ava-9' }).catch(() => undefined); });
    await waitFor(() => expect(toastar).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
  });

  it('sem ciclo, encerrar e reiniciar não gravam nada', async () => {
    const { result } = montar();
    await waitFor(() => expect(result.current.carregando).toBe(false));
    await act(async () => { await result.current.encerrar.mutateAsync(); await result.current.reiniciar.mutateAsync('ava-9'); });
    expect(escritas()).toHaveLength(0);
  });
});
