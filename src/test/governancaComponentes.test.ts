import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  anamnese: null as null | { paciente_id: string; respostas: Record<string, unknown>; updated_at: string; terapeuta_id?: string },
  leituras: 0,
  aoLer: null as null | ((n: number) => void),
  invoke: vi.fn(),
  rpc: vi.fn(),
  nota: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'terapeuta-1' } }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => h.invoke(...a) },
    rpc: (...a: unknown[]) => h.rpc(...a),
    from: (tabela: string) => {
      if (tabela === 'notas_prontuario') {
        return { insert: (v: unknown) => { h.nota(v); return Promise.resolve({ error: null }); } };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => {
              h.leituras++;
              const data = h.anamnese ? { respostas: h.anamnese.respostas, updated_at: h.anamnese.updated_at } : null;
              h.aoLer?.(h.leituras);
              return Promise.resolve({ data, error: null });
            },
          }),
        }),
        update: (v: { respostas: Record<string, unknown>; updated_at: string }) => ({
          eq: () => ({
            eq: (_coluna: string, updatedAt: string) => ({
              select: () => {
                if (h.anamnese && h.anamnese.updated_at === updatedAt) {
                  h.anamnese = { ...h.anamnese, respostas: v.respostas, updated_at: v.updated_at };
                  return Promise.resolve({ data: [{ paciente_id: h.anamnese.paciente_id }], error: null });
                }
                return Promise.resolve({ data: [], error: null });
              },
            }),
          }),
        }),
        insert: (v: { paciente_id: string; respostas: Record<string, unknown>; updated_at: string; terapeuta_id?: string }) => {
          if (h.anamnese) return Promise.resolve({ error: { code: '23505', message: 'duplicada' } });
          h.anamnese = { paciente_id: v.paciente_id, respostas: v.respostas, updated_at: v.updated_at, terapeuta_id: v.terapeuta_id };
          return Promise.resolve({ error: null });
        },
      };
    },
  },
}));

import TriagemBloqueioDialog from '../components/planos/TriagemBloqueioDialog';
import LiberarPlanoDialog from '../components/planos/LiberarPlanoDialog';
import TriagemSegurancaCard from '../components/planos/TriagemSegurancaCard';
import type { BloqueioTriagem } from '../lib/governanca';

const motivo = { codigo: 'menor_de_idade', rotulo: 'Menor de 18 anos', detalhe: 'Idade considerada: 15 anos.', origem: 'cadastro', nivel: 'bloqueia' as const };
const bloqueio = (over: Partial<BloqueioTriagem> = {}): BloqueioTriagem => ({
  nivel: 'bloqueia', motivos: [motivo], dadosAusentes: [], pode_prosseguir_profissional: true, ...over,
});

beforeEach(() => {
  h.anamnese = null;
  h.leituras = 0;
  h.aoLer = null;
  h.invoke.mockReset();
  h.rpc.mockReset();
  h.nota.mockReset();
});
afterEach(() => cleanup());

describe('TriagemBloqueioDialog', () => {
  it('cliente só recebe a orientação de falar com o profissional, sem como sobrepor', () => {
    const abrir = vi.fn();
    render(createElement(TriagemBloqueioDialog, {
      bloqueio: bloqueio({ pode_prosseguir_profissional: false }), chamador: 'cliente', onCancelar: vi.fn(), onProsseguir: vi.fn(), onAbrirTriagem: abrir,
    }));
    expect(screen.getByText(/Fale com o seu profissional/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Gerar/ })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Abrir a triagem de segurança/ }));
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  it('profissional não pode sobrepor se o servidor não permitiu', () => {
    render(createElement(TriagemBloqueioDialog, {
      bloqueio: bloqueio({ pode_prosseguir_profissional: false }), chamador: 'profissional', onCancelar: vi.fn(), onProsseguir: vi.fn(),
    }));
    expect(screen.queryByRole('button', { name: /Gerar/ })).toBeNull();
  });

  it('bloqueia: exige justificativa de 15 caracteres e a ciência antes de prosseguir', () => {
    const prosseguir = vi.fn();
    render(createElement(TriagemBloqueioDialog, {
      bloqueio: bloqueio(), chamador: 'profissional', onCancelar: vi.fn(), onProsseguir: prosseguir,
    }));
    const botao = screen.getByRole('button', { name: 'Gerar mesmo assim' }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);

    fireEvent.click(screen.getByRole('checkbox'));
    expect(botao.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/Justificativa/), { target: { value: 'curta' } });
    expect(botao.disabled).toBe(true);

    const justificativa = 'Paciente acompanhada pelo pediatra.';
    fireEvent.change(screen.getByLabelText(/Justificativa/), { target: { value: `  ${justificativa}  ` } });
    expect(botao.disabled).toBe(false);
    fireEvent.click(botao);
    expect(prosseguir).toHaveBeenCalledWith({ justificativa, ciente: true });
  });

  it('confirmar: só a ciência basta, e a observação é opcional', () => {
    const prosseguir = vi.fn();
    render(createElement(TriagemBloqueioDialog, {
      bloqueio: bloqueio({ nivel: 'confirmar', motivos: [{ ...motivo, codigo: 'idoso', rotulo: 'Pessoa idosa', nivel: 'confirmar' }] }),
      chamador: 'profissional', onCancelar: vi.fn(), onProsseguir: prosseguir,
    }));
    const botao = screen.getByRole('button', { name: 'Gerar plano' }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(botao.disabled).toBe(false);
    fireEvent.click(botao);
    expect(prosseguir).toHaveBeenCalledWith({ justificativa: '', ciente: true });
  });

  it('mostra que o servidor recusou uma sobreposição anterior', () => {
    render(createElement(TriagemBloqueioDialog, {
      bloqueio: bloqueio({ override_recusado: 'justificativa_curta' }), chamador: 'profissional', onCancelar: vi.fn(), onProsseguir: vi.fn(),
    }));
    expect(screen.getByText(/não aceitou a justificativa/)).toBeTruthy();
  });

  it('sem bloqueio não mostra nada', () => {
    render(createElement(TriagemBloqueioDialog, { bloqueio: null, chamador: 'profissional', onCancelar: vi.fn(), onProsseguir: vi.fn() }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('LiberarPlanoDialog', () => {
  const props = (over: Record<string, unknown> = {}) => ({
    tipo: 'treino' as const, planoId: 'plano-1', pacienteId: 'pac-1', open: true,
    onOpenChange: vi.fn(), onLiberado: vi.fn(), tituloPlano: 'Treino A', ...over,
  });
  const revisao = (over: Record<string, unknown> = {}) => ({
    data: { resumo: 'Revisão feita.', risco_geral: 'baixo', flags: [], persistida: true, hash: 'h', ...over }, error: null,
  });
  const govRpc = { aprovacao: { por_nome: 'Ana', em: '2026-10-07T15:00:00.000Z', versao: 1, risco_geral: 'alto' } };

  it('pede a revisão do plano salvo (por plano_id), sem mandar o conteúdo', async () => {
    h.invoke.mockResolvedValue(revisao());
    render(createElement(LiberarPlanoDialog, props()));
    await waitFor(() => expect(h.invoke).toHaveBeenCalledTimes(1));
    expect(h.invoke).toHaveBeenCalledWith('revisar-plano-seguranca', { body: { paciente_id: 'pac-1', tipo: 'treino', plano_id: 'plano-1' } });
    expect(await screen.findByText(/sem pontos críticos/)).toBeTruthy();
  });

  it('risco baixo: libera pelo RPC, sem justificativa, e registra a nota no prontuário', async () => {
    h.invoke.mockResolvedValue(revisao());
    h.rpc.mockResolvedValue({ data: { aprovacao: { por_nome: 'Ana', em: '2026-10-07T15:00:00.000Z', versao: 1, risco_geral: 'baixo' } }, error: null });
    const p = props();
    render(createElement(LiberarPlanoDialog, p));
    const botao = await screen.findByRole('button', { name: /Liberar para o paciente/ });
    await waitFor(() => expect((botao as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(botao);
    await waitFor(() => expect(p.onLiberado).toHaveBeenCalledTimes(1));
    expect(h.rpc).toHaveBeenCalledWith('liberar_plano', { p_tabela: 'planos_treino', p_id: 'plano-1', p_justificativa: null });
    expect(h.nota).toHaveBeenCalledTimes(1);
    expect(h.nota.mock.calls[0][0]).toMatchObject({
      paciente_id: 'pac-1', terapeuta_id: 'terapeuta-1',
      dados_extras: { area: 'treino', plano_id: 'plano-1', evento: 'plano_liberado', versao: 1, risco_geral: 'baixo' },
    });
    expect(p.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('plano alimentar usa a tabela planos_alimentares', async () => {
    h.invoke.mockResolvedValue(revisao());
    h.rpc.mockResolvedValue({ data: {}, error: null });
    render(createElement(LiberarPlanoDialog, props({ tipo: 'nutricao' })));
    const botao = await screen.findByRole('button', { name: /Liberar para o paciente/ });
    await waitFor(() => expect((botao as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(botao);
    await waitFor(() => expect(h.rpc).toHaveBeenCalled());
    expect(h.rpc.mock.calls[0][1]).toMatchObject({ p_tabela: 'planos_alimentares' });
  });

  it('risco alto: só libera com justificativa de 15 caracteres e a envia ao RPC', async () => {
    h.invoke.mockResolvedValue(revisao({
      risco_geral: 'alto',
      flags: [{ severidade: 'alta', titulo: 'Carga alta com lesão ativa', descricao: 'd', sugestao: 's', onde: 'Fase 1' }],
    }));
    h.rpc.mockResolvedValue({ data: govRpc, error: null });
    const p = props();
    render(createElement(LiberarPlanoDialog, p));
    const campo = await screen.findByLabelText(/Justificativa para liberar com risco alto/);
    const botao = screen.getByRole('button', { name: /Liberar para o paciente/ }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);

    fireEvent.change(campo, { target: { value: 'muito curta' } });
    expect(botao.disabled).toBe(true);

    const texto = 'Reduzi a carga e o paciente tem alta do médico.';
    fireEvent.change(campo, { target: { value: texto } });
    expect(botao.disabled).toBe(false);
    fireEvent.click(botao);
    await waitFor(() => expect(p.onLiberado).toHaveBeenCalledTimes(1));
    expect(h.rpc).toHaveBeenCalledWith('liberar_plano', { p_tabela: 'planos_treino', p_id: 'plano-1', p_justificativa: texto });
    expect(h.nota.mock.calls[0][0].dados_extras).toMatchObject({ risco_geral: 'alto', justificativa: texto });
  });

  it('flag alta exige justificativa mesmo que a IA tenha dito risco baixo', async () => {
    h.invoke.mockResolvedValue(revisao({ risco_geral: 'baixo', flags: [{ severidade: 'alta', titulo: 'X', descricao: '', sugestao: '', onde: '' }] }));
    render(createElement(LiberarPlanoDialog, props()));
    expect(await screen.findByLabelText(/Justificativa para liberar com risco alto/)).toBeTruthy();
  });

  it('revisão indisponível: avisa e deixa liberar sem revisão registrada', async () => {
    h.invoke.mockResolvedValue({ data: null, error: new Error('IA fora do ar') });
    h.rpc.mockResolvedValue({ data: { aprovacao: { em: '2026-10-07T15:00:00.000Z', versao: 1, sem_revisao: true } }, error: null });
    const p = props();
    render(createElement(LiberarPlanoDialog, p));
    expect(await screen.findByText(/Revisão automática indisponível — liberando sem revisão registrada/)).toBeTruthy();
    const botao = screen.getByRole('button', { name: /Liberar para o paciente/ }) as HTMLButtonElement;
    expect(botao.disabled).toBe(false);
    fireEvent.click(botao);
    await waitFor(() => expect(p.onLiberado).toHaveBeenCalledTimes(1));
    expect(h.nota.mock.calls[0][0].dados_extras).toMatchObject({ sem_revisao: true });
  });

  it('resposta de revisão sem conteúdo aproveitável conta como revisão indisponível', async () => {
    h.invoke.mockResolvedValue({ data: {}, error: null });
    render(createElement(LiberarPlanoDialog, props()));
    expect(await screen.findByText(/Revisão automática indisponível/)).toBeTruthy();
  });

  it('sem permissão: não chama a IA, mostra o motivo e não deixa liberar', async () => {
    render(createElement(LiberarPlanoDialog, props({ podeLiberar: false, motivoBloqueio: 'Só um Educador Físico pode liberar.' })));
    expect(screen.getByText('Só um Educador Físico pode liberar.')).toBeTruthy();
    expect((screen.getByRole('button', { name: /Liberar para o paciente/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(h.invoke).not.toHaveBeenCalled();
  });

  it('se o banco recusar por falta de justificativa, mostra o campo e não conclui', async () => {
    h.invoke.mockResolvedValue(revisao());
    h.rpc.mockResolvedValue({ data: null, error: { message: 'Justificativa obrigatória para liberar plano de risco alto' } });
    const p = props();
    render(createElement(LiberarPlanoDialog, p));
    const botao = await screen.findByRole('button', { name: /Liberar para o paciente/ });
    await waitFor(() => expect((botao as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(botao);
    expect(await screen.findByLabelText(/Justificativa para liberar com risco alto/)).toBeTruthy();
    expect(screen.getByText(/risco alto: registre a sua justificativa/)).toBeTruthy();
    expect(p.onLiberado).not.toHaveBeenCalled();
    expect(h.nota).not.toHaveBeenCalled();
  });

  it('erro do RPC (ex.: sem chancela) aparece na tela e não registra nota', async () => {
    h.invoke.mockResolvedValue(revisao());
    h.rpc.mockResolvedValue({ data: null, error: { message: 'Liberação negada: só Educador Físico.' } });
    const p = props();
    render(createElement(LiberarPlanoDialog, p));
    const botao = await screen.findByRole('button', { name: /Liberar para o paciente/ });
    await waitFor(() => expect((botao as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(botao);
    expect(await screen.findByText('Liberação negada: só Educador Físico.')).toBeTruthy();
    expect(p.onLiberado).not.toHaveBeenCalled();
    expect(h.nota).not.toHaveBeenCalled();
  });
});

describe('TriagemSegurancaCard', () => {
  async function responderTudoNao() {
    const radios = await screen.findAllByRole('radio', { name: 'Não' });
    expect(radios).toHaveLength(6);
    radios.forEach((r) => fireEvent.click(r));
  }

  it('só habilita salvar com as seis respostas', async () => {
    render(createElement(TriagemSegurancaCard, { pacienteId: 'pac-1', defaultAberto: true }));
    const radios = await screen.findAllByRole('radio', { name: 'Não' });
    const salvar = screen.getByRole('button', { name: /Salvar triagem/ }) as HTMLButtonElement;
    expect(salvar.disabled).toBe(true);
    fireEvent.click(radios[0]);
    expect(screen.getByText(/1 de 6 respondidas/)).toBeTruthy();
    expect(salvar.disabled).toBe(true);
  });

  it('salva a triagem mesclando com as respostas que já existiam', async () => {
    h.anamnese = { paciente_id: 'pac-1', respostas: { peso_kg: '72', objetivo: 'emagrecer' }, updated_at: '2026-10-01T10:00:00.000000+00:00' };
    const onSalvo = vi.fn();
    render(createElement(TriagemSegurancaCard, { pacienteId: 'pac-1', defaultAberto: true, onSalvo }));
    await responderTudoNao();
    fireEvent.click(screen.getByRole('button', { name: /Salvar triagem/ }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalledTimes(1));
    expect(h.anamnese?.respostas).toMatchObject({ peso_kg: '72', objetivo: 'emagrecer' });
    expect(h.anamnese?.respostas.triagem).toMatchObject({
      versao: 1, gestante_lactante: 'nao', transtorno_alimentar: 'nao', doenca_renal: 'nao',
      diabetes_insulina: 'nao', cardio_pressao: 'nao', cirurgia_lesao_recente: 'nao',
    });
    expect(onSalvo.mock.calls[0][0].respondida_em).toEqual(expect.any(String));
  });

  it('se a anamnese mudar entre a leitura e a gravação, relê e não perde a alteração', async () => {
    h.anamnese = { paciente_id: 'pac-1', respostas: { peso_kg: '72' }, updated_at: '2026-10-01T10:00:00.000000+00:00' };
    const onSalvo = vi.fn();
    render(createElement(TriagemSegurancaCard, { pacienteId: 'pac-1', defaultAberto: true, onSalvo }));
    await responderTudoNao();
    // A 1ª leitura do salvamento devolve o estado antigo e, logo depois, outra tela
    // salva a anamnese: a gravação com o updated_at antigo tem de falhar e reler.
    const original = h.anamnese!;
    h.leituras = 0;
    h.aoLer = (n) => {
      if (n === 1) {
        h.anamnese = { ...original, respostas: { ...original.respostas, objetivo: 'ganhar massa' }, updated_at: '2026-10-07T12:00:00.000000+00:00' };
      }
    };
    fireEvent.click(screen.getByRole('button', { name: /Salvar triagem/ }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalledTimes(1));
    expect(h.leituras).toBeGreaterThanOrEqual(2);
    expect(h.anamnese?.respostas).toMatchObject({ peso_kg: '72', objetivo: 'ganhar massa' });
    expect(h.anamnese?.respostas.triagem).toBeTruthy();
  });

  it('cria a anamnese quando ela ainda não existe, com o terapeuta informado', async () => {
    const onSalvo = vi.fn();
    render(createElement(TriagemSegurancaCard, { pacienteId: 'pac-1', terapeutaId: 'ter-9', defaultAberto: true, onSalvo }));
    await responderTudoNao();
    fireEvent.click(screen.getByRole('button', { name: /Salvar triagem/ }));
    await waitFor(() => expect(onSalvo).toHaveBeenCalledTimes(1));
    expect(h.anamnese?.terapeuta_id).toBe('ter-9');
    expect(h.anamnese?.respostas.triagem).toBeTruthy();
  });

  it('carrega as respostas já salvas', async () => {
    h.anamnese = {
      paciente_id: 'pac-1', updated_at: '2026-10-01T10:00:00.000000+00:00',
      respostas: { triagem: { versao: 1, respondida_em: '2026-10-01T12:00:00.000Z', gestante_lactante: 'sim', transtorno_alimentar: 'nao', doenca_renal: 'nao', diabetes_insulina: 'nao', cardio_pressao: 'nao', cirurgia_lesao_recente: 'nao' } },
    };
    render(createElement(TriagemSegurancaCard, { pacienteId: 'pac-1', defaultAberto: true }));
    const sim = await screen.findAllByRole('radio', { name: 'Sim' });
    await waitFor(() => expect(sim[0].getAttribute('aria-checked')).toBe('true'));
    expect(screen.getByText(/Respondida em 01\/10\/2026/)).toBeTruthy();
  });
});
