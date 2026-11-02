import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({
  equipe: { ehEquipe: true, loading: false },
  exercicios: [] as Record<string, unknown>[],
  alterados: [{ id: 'ex-1' }] as unknown[],
  erro: null as string | null,
  chamadas: [] as { op: string; valor?: unknown; filtros: [string, unknown][]; colunas?: string }[],
}));

vi.mock('@/hooks/useEquipeCientifica', () => ({ useEquipeCientifica: () => h.equipe }));
vi.mock('@/components/AppLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => {
      const chamada = { op: 'select', valor: undefined as unknown, filtros: [] as [string, unknown][], colunas: undefined as string | undefined };
      const b: Record<string, unknown> = {};
      b.select = (colunas: string) => {
        chamada.colunas = colunas;
        if (chamada.op === 'select') h.chamadas.push(chamada);
        return b;
      };
      b.update = (valor: unknown) => { chamada.op = 'update'; chamada.valor = valor; h.chamadas.push(chamada); return b; };
      b.delete = () => { chamada.op = 'delete'; h.chamadas.push(chamada); return b; };
      b.eq = (c: string, v: unknown) => { chamada.filtros.push([c, v]); return b; };
      b.order = () => b;
      b.limit = () => b;
      b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
        Promise.resolve(
          chamada.op === 'select'
            ? { data: h.exercicios, error: null }
            : h.erro
              ? { data: null, error: { message: h.erro } }
              : { data: h.alterados, error: null },
        ).then(ok, ko);
      return b;
    },
  },
}));

import { toast } from 'sonner';
import CatalogoEvidencia from '@/pages/CatalogoEvidencia';

const ex = (id: string, nome: string, aprovado: boolean) => ({
  id, nome, categoria: 'mobilidade', descricao: null, instrucoes: [], precaucoes: [], perfis_indicados: [], evidencia: [],
  nivel_dificuldade: null, tempo_duracao: null, aprovado, gerado_por_ia: true,
});

const abrir = async (nome: string) => {
  render(<MemoryRouter><CatalogoEvidencia /></MemoryRouter>);
  await screen.findByText(nome);
};

describe('CatalogoEvidencia: só a equipe científica libera, oculta e remove', () => {
  beforeEach(() => {
    h.equipe = { ehEquipe: true, loading: false };
    h.exercicios = [ex('ex-1', 'Rotação de tronco', false)];
    h.alterados = [{ id: 'ex-1' }];
    h.erro = null;
    h.chamadas = [];
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it('quem não é da equipe vê os exercícios e a evidência, mas não tem os botões de liberar, ocultar e remover', async () => {
    h.equipe = { ehEquipe: false, loading: false };
    await abrir('Rotação de tronco');
    expect(screen.queryByRole('button', { name: /liberar/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /ocultar/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /remover/i })).toBeNull();
    expect(screen.getByText(/só da equipe científica/i)).toBeTruthy();
    expect(screen.getByText(/ver detalhes e evidência/i)).toBeTruthy();
  });

  it('enquanto ainda confere se a pessoa é da equipe, não pisca o aviso nem os botões', async () => {
    h.equipe = { ehEquipe: false, loading: true };
    await abrir('Rotação de tronco');
    expect(screen.queryByText(/só da equipe científica/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /liberar/i })).toBeNull();
  });

  it('a equipe libera o exercício: grava aprovado, confere a linha alterada e mostra o aviso de sucesso', async () => {
    await abrir('Rotação de tronco');
    fireEvent.click(screen.getByRole('button', { name: /liberar/i }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Liberado para os pacientes'));
    const grav = h.chamadas.find((c) => c.op === 'update');
    expect(grav?.valor).toEqual({ aprovado: true });
    expect(grav?.filtros).toEqual([['id', 'ex-1']]);
    expect(grav?.colunas).toBe('id');
    expect(screen.queryByText('Rotação de tronco')).toBeNull(); // saiu de "Rascunhos"
    fireEvent.click(screen.getByRole('button', { name: /liberados/i }));
    expect(screen.getByRole('button', { name: /ocultar/i })).toBeTruthy();
  });

  it('se o banco não alterar nenhuma linha (sem permissão), avisa e NÃO finge que liberou', async () => {
    h.alterados = [];
    await abrir('Rotação de tronco');
    fireEvent.click(screen.getByRole('button', { name: /liberar/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Só a equipe científica pode alterar o catálogo.'));
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /liberar/i })).toBeTruthy();
  });

  it('a equipe remove o exercício e ele sai da lista; sem linha apagada, avisa e mantém o exercício', async () => {
    await abrir('Rotação de tronco');
    h.alterados = [];
    fireEvent.click(screen.getByRole('button', { name: /remover rotação de tronco/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Só a equipe científica pode alterar o catálogo.'));
    expect(screen.getByText('Rotação de tronco')).toBeTruthy();

    h.alterados = [{ id: 'ex-1' }];
    fireEvent.click(screen.getByRole('button', { name: /remover rotação de tronco/i }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Removido'));
    expect(screen.queryByText('Rotação de tronco')).toBeNull();
    const apagamentos = h.chamadas.filter((c) => c.op === 'delete');
    expect(apagamentos).toHaveLength(2);
    expect(apagamentos.map((c) => c.filtros)).toEqual([[['id', 'ex-1']], [['id', 'ex-1']]]);
  });

  it('a equipe oculta um exercício liberado: grava aprovado=false só nessa linha', async () => {
    h.exercicios = [ex('ex-1', 'Rotação de tronco', true)];
    render(<MemoryRouter><CatalogoEvidencia /></MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /liberados/i }));
    fireEvent.click(await screen.findByRole('button', { name: /ocultar rotação de tronco/i }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Ocultado'));
    const grav = h.chamadas.find((c) => c.op === 'update');
    expect(grav?.valor).toEqual({ aprovado: false });
    expect(grav?.filtros).toEqual([['id', 'ex-1']]);
  });

  it('erro do banco ao gravar: mostra a mensagem e mantém o exercício como estava', async () => {
    h.erro = 'falha de rede';
    await abrir('Rotação de tronco');
    fireEvent.click(screen.getByRole('button', { name: /liberar rotação de tronco/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erro: falha de rede'));
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText('Rotação de tronco')).toBeTruthy();
  });
});
