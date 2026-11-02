import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type Operacao = { tabela: string; op: 'update' | 'delete'; valor?: Record<string, unknown>; filtros: [string, unknown][] };

const h = vi.hoisted(() => ({
  operacoes: [] as Operacao[],
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    from: (tabela: string) => {
      const o: Operacao = { tabela, op: 'update', filtros: [] };
      const b: Record<string, unknown> = {};
      b.update = (valor: Record<string, unknown>) => { o.op = 'update'; o.valor = valor; h.operacoes.push(o); return b; };
      b.delete = () => { o.op = 'delete'; h.operacoes.push(o); return b; };
      b.eq = (c: string, v: unknown) => { o.filtros.push([c, v]); return b; };
      b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(ok, ko);
      return b;
    },
  },
}));

import ProntuarioEstruturado from '@/components/paciente/ProntuarioEstruturado';
import ProntuarioTimeline from '@/components/paciente/ProntuarioTimeline';
import type { NotaProntuario } from '@/hooks/useNotasProntuario';

const nota = (id: string, tipo: string, titulo: string, descricao: string, created_at: string): NotaProntuario => ({
  id, paciente_id: 'pac-1', terapeuta_id: 'ter-1', tipo, titulo, descricao, dados_extras: null, referencia_id: null, created_at,
});

const VIVA = nota('n-viva', 'checkin_semanal', 'Check-in semanal (autorrelato do cliente)', 'Fadiga 4 · Sono 3 · texto da nota viva', '2026-11-02T12:00:00Z');
const ALERTA = nota('n-alerta', 'checkin_alerta', 'Check-in semanal: atenção', 'texto do alerta recente', '2026-10-30T12:00:00Z');
const ALERTA_ANTIGO = nota('n-alerta-antigo', 'checkin_alerta', 'Check-in semanal: atenção (antigo)', 'texto do alerta antigo', '2026-10-05T12:00:00Z');
const EVOLUCAO = nota('n-evol', 'evolucao', 'Evolução da sessão 5', 'texto da evolução do profissional', '2026-10-25T12:00:00Z');
const AVALIACAO = nota('n-aval', 'avaliacao_profissional', 'Avaliação inicial', 'texto da avaliação', '2026-09-01T12:00:00Z');

function comProvider(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const regiaoAutorrelato = () => screen.getByRole('region', { name: 'Autorrelato do cliente' });
const secaoSessoes = () => screen.getByRole('heading', { name: 'Sessões' }).closest('section') as HTMLElement;

beforeEach(() => {
  h.operacoes = [];
});
afterEach(cleanup);

describe('ProntuarioEstruturado: autorrelato do check-in semanal', () => {
  const todas = [VIVA, ALERTA, ALERTA_ANTIGO, EVOLUCAO, AVALIACAO];

  it('os dois tipos novos aparecem com o rótulo de cada um', () => {
    comProvider(<ProntuarioEstruturado notas={todas} />);
    const regiao = regiaoAutorrelato();
    expect(within(regiao).getByText('Check-in semanal')).toBeInTheDocument();
    expect(within(regiao).getAllByText('Atenção no check-in')).toHaveLength(2);
    expect(within(regiao).getByText('Check-in semanal (autorrelato do cliente)')).toBeInTheDocument();
    expect(within(regiao).getByText('Check-in semanal: atenção')).toBeInTheDocument();
  });

  it('a nota viva e os alertas ficam na seção "Autorrelato do cliente", com aviso de que não é evolução do profissional', () => {
    comProvider(<ProntuarioEstruturado notas={todas} />);
    const regiao = regiaoAutorrelato();
    expect(within(regiao).getByText(/texto da nota viva/)).toBeInTheDocument();
    expect(within(regiao).getByText(/texto do alerta recente/)).toBeInTheDocument();
    expect(within(regiao).getByText(/Não é evolução do profissional/)).toBeInTheDocument();
  });

  it('a nota viva NÃO aparece em Sessões nem em Avaliação atual; a evolução NÃO aparece no autorrelato', () => {
    comProvider(<ProntuarioEstruturado notas={todas} />);
    const sessoes = secaoSessoes();
    expect(within(sessoes).queryByText(/texto da nota viva/)).toBeNull();
    expect(within(sessoes).queryByText(/texto do alerta/)).toBeNull();
    expect(within(sessoes).queryByText('Check-in semanal')).toBeNull();
    expect(within(sessoes).getByText(/texto da evolução do profissional/)).toBeInTheDocument();

    const avaliacao = screen.getByRole('heading', { name: 'Avaliação atual' }).closest('section') as HTMLElement;
    expect(within(avaliacao).queryByText(/nota viva/)).toBeNull();
    expect(within(avaliacao).getByText('Avaliação inicial')).toBeInTheDocument();

    expect(within(regiaoAutorrelato()).queryByText(/texto da evolução/)).toBeNull();
    expect(within(regiaoAutorrelato()).queryByText('Avaliação inicial')).toBeNull();
  });

  it('mais recente primeiro dentro do autorrelato', () => {
    comProvider(<ProntuarioEstruturado notas={[ALERTA_ANTIGO, VIVA, ALERTA]} />);
    const texto = regiaoAutorrelato().textContent || '';
    const viva = texto.indexOf('texto da nota viva');
    const recente = texto.indexOf('texto do alerta recente');
    const antigo = texto.indexOf('texto do alerta antigo');
    expect(viva).toBeGreaterThan(-1);
    expect(viva).toBeLessThan(recente);
    expect(recente).toBeLessThan(antigo);
  });

  it('sem notas de check-in, a seção não aparece', () => {
    comProvider(<ProntuarioEstruturado notas={[EVOLUCAO, AVALIACAO]} />);
    expect(screen.queryByRole('region', { name: 'Autorrelato do cliente' })).toBeNull();
    expect(screen.queryByText('Autorrelato do cliente')).toBeNull();
  });

  it('só com notas de check-in: mostra o autorrelato e não inventa sessões', () => {
    comProvider(<ProntuarioEstruturado notas={[VIVA]} />);
    expect(regiaoAutorrelato()).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sessões' })).toBeNull();
    expect(screen.getByText('Nenhuma avaliação registrada ainda.')).toBeInTheDocument();
  });

  it('não há botão de editar nas notas de check-in (viva e alerta), mas há o de excluir', () => {
    comProvider(<ProntuarioEstruturado notas={todas} />);
    const regiao = regiaoAutorrelato();
    expect(within(regiao).queryAllByTitle('Editar')).toHaveLength(0);
    expect(within(regiao).getAllByTitle('Excluir')).toHaveLength(3);
  });

  it('evolução do profissional continua editável', () => {
    comProvider(<ProntuarioEstruturado notas={todas} />);
    expect(within(secaoSessoes()).getByTitle('Editar')).toBeInTheDocument();
    expect(within(secaoSessoes()).getByTitle('Excluir')).toBeInTheDocument();
  });

  it('editar uma evolução ainda grava só a descrição', async () => {
    comProvider(<ProntuarioEstruturado notas={todas} />);
    fireEvent.click(within(secaoSessoes()).getByTitle('Editar'));
    const campo = screen.getByDisplayValue('texto da evolução do profissional');
    fireEvent.change(campo, { target: { value: 'texto corrigido' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));
    await waitFor(() => expect(h.operacoes).toHaveLength(1));
    expect(h.operacoes[0]).toMatchObject({ tabela: 'notas_prontuario', op: 'update', valor: { descricao: 'texto corrigido' }, filtros: [['id', 'n-evol']] });
  });

  it('excluir a nota viva continua funcionando, com confirmação', async () => {
    comProvider(<ProntuarioEstruturado notas={[VIVA]} />);
    fireEvent.click(within(regiaoAutorrelato()).getByTitle('Excluir'));
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(h.operacoes).toHaveLength(1));
    expect(h.operacoes[0]).toMatchObject({ tabela: 'notas_prontuario', op: 'delete', filtros: [['id', 'n-viva']] });
  });
});

describe('ProntuarioTimeline (registro cronológico): check-in semanal', () => {
  const todas = [VIVA, ALERTA, EVOLUCAO];

  it('os dois tipos aparecem com rótulo e ícone próprios (não caem em "Nota")', () => {
    comProvider(<ProntuarioTimeline notas={todas} />);
    const viva = screen.getByText('Check-in semanal');
    const alerta = screen.getByText('Atenção no check-in');
    expect(viva.parentElement!.querySelector('svg')).not.toBeNull();
    expect(alerta.parentElement!.querySelector('svg')).not.toBeNull();
    expect(screen.queryByText('Nota')).toBeNull();
  });

  it('marca as duas notas como autorrelato do cliente, e a evolução não', () => {
    comProvider(<ProntuarioTimeline notas={todas} />);
    expect(screen.getAllByText('Autorrelato do cliente')).toHaveLength(2);
  });

  it('o profissional não edita as notas de check-in, mas edita a evolução e pode excluir todas', () => {
    comProvider(<ProntuarioTimeline notas={todas} />);
    expect(screen.getAllByTitle('Editar resumo')).toHaveLength(1);
    expect(screen.getAllByTitle('Excluir registro')).toHaveLength(3);
  });

  it('excluir a nota viva pelo registro cronológico continua funcionando, com confirmação', async () => {
    comProvider(<ProntuarioTimeline notas={[VIVA]} />);
    fireEvent.click(screen.getByTitle('Excluir registro'));
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }));
    await waitFor(() => expect(h.operacoes).toHaveLength(1));
    expect(h.operacoes[0]).toMatchObject({ tabela: 'notas_prontuario', op: 'delete', filtros: [['id', 'n-viva']] });
  });

  it('o texto da nota viva aparece no registro', () => {
    comProvider(<ProntuarioTimeline notas={[VIVA]} />);
    expect(screen.getByText(/texto da nota viva/)).toBeInTheDocument();
    expect(screen.getByText('Check-in semanal (autorrelato do cliente)')).toBeInTheDocument();
  });
});
