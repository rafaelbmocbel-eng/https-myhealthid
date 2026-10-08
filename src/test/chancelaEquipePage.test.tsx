import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({
  user: { id: 'rev-1', email: 'revisor@exemplo.com' },
  ehEquipe: true,
  pode: { treino: true, nutricao: true } as Record<string, boolean>,
  fila: {} as Record<string, unknown[]>,
  pendentes: 0,
  rpcErro: {} as Record<string, string>,
  rpc: vi.fn(),
  invoke: vi.fn(),
  updates: [] as { tabela: string; valor: Record<string, unknown>; filtros: [string, unknown][] }[],
  updateRetorno: [{ id: 'ch-1' }] as unknown[],
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('@/components/AppLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/educador/SeletorExercicios', () => ({ default: () => null }));
vi.mock('@/hooks/usePodeChancelar', () => ({
  usePodeChancelarPlanoCliente: (area: string) => ({
    pode: h.pode[area] ?? false,
    motivo: '',
    loading: false,
    labelExigido: area === 'nutricao' ? 'Nutricionista' : 'Educador Físico ou Fisioterapeuta',
    viaClinica: false,
  }),
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), warning: vi.fn() }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    functions: { invoke: (...a: unknown[]) => h.invoke(...a) },
    from: (tabela: string) => {
      const registro = { tabela, valor: {} as Record<string, unknown>, filtros: [] as [string, unknown][] };
      let modo: 'contagem' | 'update' = 'contagem';
      const b: Record<string, unknown> = {};
      b.select = (_c: string, opcoes?: { head?: boolean }) => {
        if (opcoes?.head) modo = 'contagem';
        return b;
      };
      b.update = (valor: Record<string, unknown>) => {
        modo = 'update';
        registro.valor = valor;
        h.updates.push(registro);
        return b;
      };
      b.eq = (c: string, v: unknown) => {
        registro.filtros.push([c, v]);
        return b;
      };
      b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) =>
        Promise.resolve(modo === 'update' ? { data: h.updateRetorno, error: null } : { count: h.pendentes, error: null }).then(ok, ko);
      return b;
    },
  },
}));

import ChancelaEquipe from '@/pages/ChancelaEquipe';

const GOV_BASE = {
  versao: 1,
  fonte: { tipo: 'ia', modelo: 'gemini-2.5-flash', insumos: ['myid', 'historico_clinico'], parametros: [] },
  triagem: { nivel: 'liberado', motivos: [] },
};

function itemTreino(extra: Record<string, unknown> = {}, govExtra: Record<string, unknown> = {}) {
  return {
    id: 'ch-1', tipo: 'treino', titulo: 'Treino de força', status: 'aguardando', gerado_em: '2026-10-07T12:00:00Z',
    paciente_primeiro_nome: 'Maria', idade: 34, objetivo: 'Ganho de força',
    conteudo: {
      resumo: 'Foco em força geral',
      fases: [{ nome: 'Fase 1', semanas: 4, sessoes: [{ nome: 'Treino A', exercicios: [{ nome: 'Agachamento', series: 3, reps: '10' }] }] }],
      _governanca: { ...GOV_BASE, ...govExtra },
    },
    revisao_seguranca: null, hash_atual: 'h1',
    ...extra,
  };
}

const comRevisao = (risco: 'baixo' | 'alto', hash = 'h1') => ({
  revisao_seguranca: { risco_geral: risco, n_flags_altas: risco === 'alto' ? 1 : 0 },
  hash_atual: 'h1',
  gov: { revisao_seguranca: { risco_geral: risco, n_flags_altas: risco === 'alto' ? 1 : 0, flags: [], hash } },
});

function itemRevisado(risco: 'baixo' | 'alto', hash = 'h1') {
  const r = comRevisao(risco, hash);
  return itemTreino({ revisao_seguranca: r.revisao_seguranca, hash_atual: r.hash_atual }, r.gov);
}

const itemNutricao = {
  id: 'ch-2', tipo: 'nutricao', titulo: 'Plano alimentar', status: 'aguardando', gerado_em: '2026-10-06T12:00:00Z',
  paciente_primeiro_nome: 'João', idade: 41, objetivo: 'Emagrecimento',
  conteudo: {
    calorias_totais: '1800',
    refeicoes: [{ nome: 'Café da manhã', horario: '07:00', itens: [{ alimento: 'Ovos', porcao: '2 un', kcal: '150' }] }],
    _governanca: { ...GOV_BASE },
  },
  revisao_seguranca: null, hash_atual: 'h2',
};

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, refetchInterval: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <ChancelaEquipe />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

async function abrirPlano(titulo: string | RegExp) {
  fireEvent.click(await screen.findByRole('button', { name: titulo }));
}

beforeEach(() => {
  h.ehEquipe = true;
  h.pode = { treino: true, nutricao: true };
  h.fila = { aguardando: [itemTreino(), itemNutricao], chancelado: [], recusado: [] };
  h.pendentes = 2;
  h.rpcErro = {};
  h.updates.length = 0;
  h.updateRetorno = [{ id: 'ch-1' }];
  h.invoke.mockReset();
  h.rpc.mockReset();
  h.rpc.mockImplementation(async (nome: string, args?: Record<string, unknown>) => {
    if (h.rpcErro[nome]) return { data: null, error: { message: h.rpcErro[nome] } };
    if (nome === 'eh_equipe_cientifica') return { data: h.ehEquipe, error: null };
    if (nome === 'fila_chancela') return { data: h.fila[(args?.p_status as string) ?? 'aguardando'] ?? [], error: null };
    if (nome === 'chancelar_plano_cliente') return { data: { status: 'chancelado' }, error: null };
    if (nome === 'recusar_plano_cliente') return { data: null, error: null };
    return { data: null, error: null };
  });
});
afterEach(() => cleanup());

describe('Fila de chancela: acesso', () => {
  it('quem não é da equipe vê "acesso restrito" e a fila nem é consultada', async () => {
    h.ehEquipe = false;
    renderizar();
    expect(await screen.findByText('Acesso restrito à equipe científica')).toBeInTheDocument();
    expect(h.rpc.mock.calls.some(([nome]) => nome === 'fila_chancela')).toBe(false);
  });

  it('equipe vê a fila de aguardando com paciente (primeiro nome e idade), tipo e contador', async () => {
    renderizar();
    expect(await screen.findByText('Fila de chancela MyHealthID')).toBeInTheDocument();
    expect(await screen.findByText('Maria, 34 anos')).toBeInTheDocument();
    expect(screen.getByText('João, 41 anos')).toBeInTheDocument();
    expect(h.rpc).toHaveBeenCalledWith('fila_chancela', { p_status: 'aguardando' });
    await waitFor(() => expect(screen.getByRole('tab', { name: /Aguardando/ })).toHaveTextContent('2'));
    expect(screen.getByText(/2 planos aguardando a sua chancela/)).toBeInTheDocument();
  });

  it('o mais antigo aparece primeiro', async () => {
    renderizar();
    await screen.findByText('Maria, 34 anos');
    const itens = within(screen.getByRole('list', { name: 'Planos' })).getAllByRole('button');
    expect(itens[0]).toHaveTextContent('João, 41 anos');
    expect(itens[1]).toHaveTextContent('Maria, 34 anos');
  });

  it('as abas Chancelados e Recusados consultam a fila com o status certo', async () => {
    h.fila.chancelado = [{
      ...itemTreino({ id: 'ch-9', status: 'chancelado', revisor_nome: 'Ana Souza', revisor_perfil: 'educador_fisico', revisado_em: '2026-10-08T10:00:00Z' }),
    }];
    h.fila.recusado = [{ ...itemNutricao, id: 'ch-8', status: 'recusado', nota_publica: 'Procure um profissional.' }];
    renderizar();
    await screen.findByText('Maria, 34 anos');

    fireEvent.click(screen.getByRole('tab', { name: 'Chancelados' }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('fila_chancela', { p_status: 'chancelado' }));
    expect(await screen.findByText(/Chancelado por Ana Souza, Educador Físico/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Recusados' }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('fila_chancela', { p_status: 'recusado' }));
    await abrirPlano(/Plano alimentar/);
    expect(await screen.findByText(/Mensagem ao cliente: Procure um profissional\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chancelar' })).not.toBeInTheDocument();
  });

  it('falha ao carregar mostra o erro', async () => {
    h.rpcErro.fila_chancela = 'Could not find the function public.fila_chancela in the schema cache';
    renderizar();
    expect(await screen.findByText('Não consegui carregar a fila.')).toBeInTheDocument();
  });
});

describe('Fila de chancela: leitura do plano', () => {
  it('abre o plano com insumos, triagem e o conteúdo como o cliente verá', async () => {
    renderizar();
    await abrirPlano(/Treino de força/);

    expect(await screen.findByText('Foco em força geral')).toBeInTheDocument();
    expect(screen.getByText('Agachamento')).toBeInTheDocument();
    expect(screen.getByText('MyID')).toBeInTheDocument();
    expect(screen.getByText('Histórico clínico')).toBeInTheDocument();
    expect(screen.getByText(/nenhum fator de atenção apontado/)).toBeInTheDocument();
    expect(screen.getByText('ainda não revisado')).toBeInTheDocument();
  });

  it('sem registro de governança avisa o revisor', async () => {
    h.fila.aguardando = [itemTreino({ conteudo: { fases: [] } })];
    renderizar();
    await abrirPlano(/Treino de força/);
    expect(await screen.findByText(/não traz o registro de governança/)).toBeInTheDocument();
  });

  it('mesmo que o servidor mande sobrenome, e-mail ou telefone, a tela só mostra primeiro nome e idade', async () => {
    h.fila.aguardando = [{ ...itemTreino(), paciente_sobrenome: 'Silva', email: 'maria@exemplo.com', telefone: '11999990000' }];
    renderizar();
    await abrirPlano(/Treino de força/);
    await screen.findByText('Foco em força geral');
    expect(document.body.textContent).toContain('Maria, 34 anos');
    expect(document.body.textContent).not.toMatch(/Silva|maria@exemplo\.com|11999990000/);
  });

  it('revisão de versão anterior é sinalizada', async () => {
    h.fila.aguardando = [itemRevisado('baixo', 'h0')];
    renderizar();
    await abrirPlano(/Treino de força/);
    expect(await screen.findByText('de versão anterior')).toBeInTheDocument();
    expect(screen.getByText(/Revise de novo antes de chancelar/)).toBeInTheDocument();
  });
});

describe('Fila de chancela: perfil exigido', () => {
  it('sem perfil para nutrição: avisa claramente e bloqueia chancelar e editar, mas deixa recusar', async () => {
    h.pode = { treino: true, nutricao: false };
    renderizar();
    await abrirPlano(/Plano alimentar/);

    expect(await screen.findByText(/Você não tem o perfil para chancelar nutrição/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Editar plano/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Recusar/ })).toBeEnabled();
  });

  it('com o perfil, não aparece o aviso e Chancelar fica disponível', async () => {
    renderizar();
    await abrirPlano(/Plano alimentar/);
    await screen.findByText('Ovos');
    expect(screen.queryByText(/Você não tem o perfil/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chancelar' })).toBeEnabled();
  });
});

describe('Fila de chancela: chancelar', () => {
  it('revisão válida de risco baixo: chancela direto pela RPC, sem justificativa', async () => {
    h.fila.aguardando = [itemRevisado('baixo')];
    renderizar();
    await abrirPlano(/Treino de força/);
    fireEvent.click(await screen.findByRole('button', { name: 'Chancelar' }));

    const confirmar = await screen.findByRole('button', { name: 'Chancelar plano' });
    expect(confirmar).toBeEnabled();
    fireEvent.click(confirmar);

    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('chancelar_plano_cliente', {
      p_id: 'ch-1', p_conteudo: null, p_justificativa: null, p_nota_publica: null,
    }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Chancelar plano' })).not.toBeInTheDocument());
  });

  it('risco alto numa revisão válida exige justificativa de 15 caracteres', async () => {
    h.fila.aguardando = [itemRevisado('alto')];
    renderizar();
    await abrirPlano(/Treino de força/);
    fireEvent.click(await screen.findByRole('button', { name: 'Chancelar' }));

    const confirmar = await screen.findByRole('button', { name: 'Chancelar plano' });
    expect(confirmar).toBeDisabled();
    const campo = screen.getByLabelText(/Justificativa para chancelar com risco alto/);
    fireEvent.change(campo, { target: { value: 'curta' } });
    expect(confirmar).toBeDisabled();
    fireEvent.change(campo, { target: { value: 'Ajustei a carga e orientei o cliente.' } });
    expect(confirmar).toBeEnabled();
    fireEvent.click(confirmar);

    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('chancelar_plano_cliente', expect.objectContaining({
      p_id: 'ch-1', p_justificativa: 'Ajustei a carga e orientei o cliente.',
    })));
  });

  it('plano editado depois de uma revisão de risco alto: a justificativa continua obrigatória', async () => {
    h.fila.aguardando = [itemRevisado('alto', 'h0')];
    renderizar();
    await abrirPlano(/Treino de força/);
    fireEvent.click(await screen.findByRole('button', { name: 'Chancelar' }));

    const confirmar = await screen.findByRole('button', { name: 'Chancelar plano' });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(confirmar).toBeDisabled();
    const campo = screen.getByLabelText(/Justificativa para chancelar com risco alto/);
    fireEvent.change(campo, { target: { value: 'Ajustei a carga e orientei o cliente.' } });
    expect(confirmar).toBeEnabled();
    fireEvent.click(confirmar);

    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('chancelar_plano_cliente', expect.objectContaining({
      p_id: 'ch-1', p_justificativa: 'Ajustei a carga e orientei o cliente.',
    })));
  });

  it('sem revisão válida o revisor precisa confirmar a ciência', async () => {
    renderizar();
    await abrirPlano(/Treino de força/);
    fireEvent.click(await screen.findByRole('button', { name: 'Chancelar' }));

    const confirmar = await screen.findByRole('button', { name: 'Chancelar plano' });
    expect(confirmar).toBeDisabled();
    expect(screen.getByText('Este plano ainda não passou pela revisão de segurança.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(confirmar).toBeEnabled();
  });

  it('recado ao cliente opcional vai na RPC', async () => {
    h.fila.aguardando = [itemRevisado('baixo')];
    renderizar();
    await abrirPlano(/Treino de força/);
    fireEvent.click(await screen.findByRole('button', { name: 'Chancelar' }));
    fireEvent.change(await screen.findByLabelText(/Recado ao cliente/), { target: { value: '  Plano revisado pela equipe.  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Chancelar plano' }));

    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('chancelar_plano_cliente', expect.objectContaining({ p_nota_publica: 'Plano revisado pela equipe.' })));
  });

  it('o banco recusando por falta de justificativa passa a exigi-la na tela', async () => {
    h.fila.aguardando = [itemRevisado('baixo')];
    h.rpcErro.chancelar_plano_cliente = 'Justificativa obrigatória para liberar plano de risco alto';
    renderizar();
    await abrirPlano(/Treino de força/);
    fireEvent.click(await screen.findByRole('button', { name: 'Chancelar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Chancelar plano' }));

    expect(await screen.findByText('Este plano tem risco alto: registre a sua justificativa para chancelar.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Justificativa para chancelar com risco alto/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chancelar plano' })).toBeDisabled();
  });

  it('erro de permissão do banco aparece e o diálogo continua aberto', async () => {
    h.fila.aguardando = [itemRevisado('baixo')];
    h.rpcErro.chancelar_plano_cliente = 'chancela_negada: só Educador Físico ou Fisioterapeuta chancela treino';
    renderizar();
    await abrirPlano(/Treino de força/);
    fireEvent.click(await screen.findByRole('button', { name: 'Chancelar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Chancelar plano' }));

    expect(await screen.findByText('só Educador Físico ou Fisioterapeuta chancela treino')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chancelar plano' })).toBeInTheDocument();
  });
});

describe('Fila de chancela: recusar', () => {
  it('exige a mensagem ao cliente e chama a RPC com a nota pública e a interna', async () => {
    renderizar();
    await abrirPlano(/Treino de força/);
    fireEvent.click(await screen.findByRole('button', { name: /Recusar/ }));

    const confirmar = await screen.findByRole('button', { name: 'Recusar plano' });
    expect(confirmar).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Mensagem ao cliente/), { target: { value: 'curta' } });
    expect(confirmar).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Mensagem ao cliente/), { target: { value: 'Precisa de avaliação presencial antes.' } });
    fireEvent.change(screen.getByLabelText(/Nota interna/), { target: { value: 'Carga alta para o relato de dor.' } });
    expect(confirmar).toBeEnabled();
    fireEvent.click(confirmar);

    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('recusar_plano_cliente', {
      p_id: 'ch-1', p_nota_publica: 'Precisa de avaliação presencial antes.', p_nota_interna: 'Carga alta para o relato de dor.',
    }));
  });
});

describe('Fila de chancela: edição e revisão de segurança', () => {
  it('Editar abre o editor existente; salvar grava na linha da equipe (sem tocar planos_treino) e atualiza a fila', async () => {
    renderizar();
    await abrirPlano(/Treino de força/);
    fireEvent.click(await screen.findByRole('button', { name: /Editar plano/ }));

    expect(await screen.findByText('Editar treino antes de chancelar')).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('Agachamento'), { target: { value: 'Agachamento livre' } });
    const chamadasAntes = h.rpc.mock.calls.filter(([n]) => n === 'fila_chancela').length;
    fireEvent.click(screen.getByRole('button', { name: 'Salvar edição' }));

    await waitFor(() => expect(h.updates).toHaveLength(1));
    expect(h.updates[0].tabela).toBe('plano_cliente_chancela');
    expect(h.updates[0].filtros).toEqual([['id', 'ch-1'], ['status', 'aguardando']]);
    const salvo = h.updates[0].valor.conteudo as { fases: { sessoes: { exercicios: { nome: string }[] }[] }[]; _governanca: unknown };
    expect(salvo.fases[0].sessoes[0].exercicios[0].nome).toBe('Agachamento livre');
    expect(salvo._governanca).toBeTruthy();
    expect(h.updates[0].valor.titulo).toBe('Treino de força');
    await waitFor(() => expect(h.rpc.mock.calls.filter(([n]) => n === 'fila_chancela').length).toBeGreaterThan(chamadasAntes));
    await waitFor(() => expect(screen.queryByText('Editar treino antes de chancelar')).not.toBeInTheDocument());
  });

  it('nutrição abre o editor de plano alimentar', async () => {
    renderizar();
    await abrirPlano(/Plano alimentar/);
    fireEvent.click(await screen.findByRole('button', { name: /Editar plano/ }));
    expect(await screen.findByText('Editar plano alimentar antes de chancelar')).toBeInTheDocument();
  });

  it('edição que não achou a linha (já chancelada por outro revisor) mostra erro e não fecha', async () => {
    h.updateRetorno = [];
    renderizar();
    await abrirPlano(/Treino de força/);
    fireEvent.click(await screen.findByRole('button', { name: /Editar plano/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Salvar edição' }));
    await waitFor(() => expect(h.updates).toHaveLength(1));
    expect(screen.getByText('Editar treino antes de chancelar')).toBeInTheDocument();
  });

  it('Revisar segurança chama a edge com a tabela nova e o id do plano, sem paciente_id', async () => {
    h.invoke.mockResolvedValue({ data: { resumo: 'ok', risco_geral: 'baixo', flags: [], persistida: true }, error: null });
    renderizar();
    await abrirPlano(/Treino de força/);
    fireEvent.click(await screen.findByRole('button', { name: /Revisar segurança/ }));

    await waitFor(() => expect(h.invoke).toHaveBeenCalledWith('revisar-plano-seguranca', {
      body: { tabela: 'plano_cliente_chancela', tipo: 'treino', plano_id: 'ch-1' },
    }));
    expect(await screen.findByText(/sem pontos críticos/)).toBeInTheDocument();
    await waitFor(() => expect(h.rpc.mock.calls.filter(([n]) => n === 'fila_chancela').length).toBeGreaterThan(1));
  });
});
