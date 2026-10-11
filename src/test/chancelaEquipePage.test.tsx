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
  rpcHint: {} as Record<string, string>,
  config: { nutricao_premium_ativa: false, prazo_chancela_dias_uteis: 2 } as Record<string, unknown>,
  profissionais: [] as unknown[],
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
  h.rpcHint = {};
  h.user = { id: 'rev-1', email: 'revisor@exemplo.com' };
  h.config = { nutricao_premium_ativa: false, prazo_chancela_dias_uteis: 2 };
  h.profissionais = [];
  h.updates.length = 0;
  h.updateRetorno = [{ id: 'ch-1' }];
  h.invoke.mockReset();
  h.rpc.mockReset();
  h.rpc.mockImplementation(async (nome: string, args?: Record<string, unknown>) => {
    if (h.rpcErro[nome]) return { data: null, error: { message: h.rpcErro[nome], hint: h.rpcHint[nome] ?? null } };
    if (nome === 'eh_equipe_cientifica') return { data: h.ehEquipe, error: null };
    if (nome === 'plano_cliente_config') return { data: h.config, error: null };
    if (nome === 'profissionais_admin') return { data: h.profissionais, error: null };
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

const flagAlta = { severidade: 'alta', titulo: 'Carga alta para o relato de dor', descricao: 'Reduza a carga.', sugestao: 'Menos séries.', onde: 'Fase 1' };

function revisaoDaEdge(risco: 'baixo' | 'alto' = 'baixo', extra: Record<string, unknown> = {}) {
  return {
    data: { resumo: 'Plano coerente com o relato.', risco_geral: risco, flags: risco === 'alto' ? [flagAlta] : [], persistida: true, hash: 'h1', ...extra },
    error: null,
  };
}

const AVISO_ENVIADO = { data: { ok: true, enviado: true }, error: null };

function configurarEdges(revisao: unknown = revisaoDaEdge(), aviso: unknown = AVISO_ENVIADO) {
  h.invoke.mockImplementation(async (nome: string) => (nome === 'revisar-plano-seguranca' ? revisao : aviso));
}

const chamadasDe = (nome: string) => h.invoke.mock.calls.filter(([n]) => n === nome);

async function abrirJanelaDeChancela(titulo: string | RegExp = /Treino de força/) {
  await abrirPlano(titulo);
  fireEvent.click(await screen.findByRole('button', { name: 'Chancelar' }));
}

describe('Fila de chancela: chancelar com revisão de segurança automática', () => {
  beforeEach(() => configurarEdges());

  it('ao abrir, roda a revisão da versão atual; o botão só libera com a revisão pronta, e a RPC vai sem justificativa', async () => {
    let terminar: (v: unknown) => void = () => {};
    h.invoke.mockImplementation((nome: string) => (nome === 'revisar-plano-seguranca'
      ? new Promise((resolve) => { terminar = resolve; })
      : Promise.resolve(AVISO_ENVIADO)));
    renderizar();
    await abrirJanelaDeChancela();

    expect(await screen.findByText(/Rodando a revisão de segurança desta versão/)).toBeInTheDocument();
    expect(h.invoke).toHaveBeenCalledWith('revisar-plano-seguranca', {
      body: { tabela: 'plano_cliente_chancela', tipo: 'treino', plano_id: 'ch-1' },
    });
    const confirmar = screen.getByRole('button', { name: 'Chancelar plano' });
    expect(confirmar).toBeDisabled();

    terminar(revisaoDaEdge('baixo'));
    expect(await screen.findByText(/Revisão de segurança desta versão: risco baixo/)).toBeInTheDocument();
    await waitFor(() => expect(confirmar).toBeEnabled());
    fireEvent.click(confirmar);

    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('chancelar_plano_cliente', {
      p_id: 'ch-1', p_conteudo: null, p_justificativa: null, p_nota_publica: null,
    }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Chancelar plano' })).not.toBeInTheDocument());
  });

  it('depois que a revisão é gravada a fila recarrega para mostrar a revisão no item', async () => {
    renderizar();
    await abrirPlano(/Treino de força/);
    const antes = h.rpc.mock.calls.filter(([n]) => n === 'fila_chancela').length;
    fireEvent.click(await screen.findByRole('button', { name: 'Chancelar' }));
    await screen.findByText(/Revisão de segurança desta versão: risco baixo/);
    await waitFor(() => expect(h.rpc.mock.calls.filter(([n]) => n === 'fila_chancela').length).toBeGreaterThan(antes));
  });

  it('risco alto: mostra os alertas e exige justificativa de 15 caracteres', async () => {
    configurarEdges(revisaoDaEdge('alto'));
    renderizar();
    await abrirJanelaDeChancela();

    expect(await screen.findByText(/risco alto · 1 alerta de severidade alta/)).toBeInTheDocument();
    expect(screen.getByText(/Carga alta para o relato de dor/)).toBeInTheDocument();
    const confirmar = screen.getByRole('button', { name: 'Chancelar plano' });
    expect(confirmar).toBeDisabled();
    const campo = await screen.findByLabelText(/Justificativa para chancelar com risco alto/);
    fireEvent.change(campo, { target: { value: 'curta' } });
    expect(confirmar).toBeDisabled();
    fireEvent.change(campo, { target: { value: 'Ajustei a carga e orientei o cliente.' } });
    expect(confirmar).toBeEnabled();
    fireEvent.click(confirmar);

    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('chancelar_plano_cliente', expect.objectContaining({
      p_id: 'ch-1', p_justificativa: 'Ajustei a carga e orientei o cliente.',
    })));
  });

  it('revisão PARCIAL (plano longo, a IA leu só o início): avisa e só chancela com a justificativa de 15 caracteres', async () => {
    configurarEdges(revisaoDaEdge('baixo', { plano_truncado: true }));
    renderizar();
    await abrirJanelaDeChancela();

    expect(await screen.findByText(/Revisão parcial: o plano é longo e a IA avaliou só o início/)).toBeInTheDocument();
    const confirmar = screen.getByRole('button', { name: 'Chancelar plano' });
    expect(confirmar).toBeDisabled();
    expect(screen.getByText(/A revisão de segurança foi parcial.*registre a justificativa/)).toBeInTheDocument();
    const campo = await screen.findByLabelText(/Justificativa para chancelar com a revisão parcial \(obrigatória\)/);
    fireEvent.change(campo, { target: { value: 'curta' } });
    expect(confirmar).toBeDisabled();
    fireEvent.change(campo, { target: { value: 'Conferi o restante do plano manualmente.' } });
    expect(confirmar).toBeEnabled();
    fireEvent.click(confirmar);

    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('chancelar_plano_cliente', expect.objectContaining({
      p_id: 'ch-1', p_justificativa: 'Conferi o restante do plano manualmente.',
    })));
  });

  it('revisão completa de risco baixo continua sem aviso de parcial e sem justificativa', async () => {
    renderizar();
    await abrirJanelaDeChancela();
    await screen.findByText(/Revisão de segurança desta versão: risco baixo/);
    expect(screen.queryByText(/Revisão parcial/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Justificativa \(opcional\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chancelar plano' })).toBeEnabled();
  });

  it('IA fora do ar: só chancela com o motivo escrito (15+ caracteres), que vai como justificativa', async () => {
    configurarEdges({ data: null, error: { message: 'IA indisponível (sem chave configurada).' } });
    renderizar();
    await abrirJanelaDeChancela();

    expect(await screen.findByText('Não foi possível fazer a revisão de segurança desta versão.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    const confirmar = screen.getByRole('button', { name: 'Chancelar plano' });
    expect(confirmar).toBeDisabled();
    const campo = await screen.findByLabelText(/Motivo para chancelar sem a revisão de segurança \(obrigatório\)/);
    fireEvent.change(campo, { target: { value: 'IA fora do ar' } });
    expect(confirmar).toBeDisabled();
    fireEvent.change(campo, { target: { value: 'A IA ficou fora do ar; li o plano inteiro.' } });
    expect(confirmar).toBeEnabled();
    fireEvent.click(confirmar);

    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('chancelar_plano_cliente', expect.objectContaining({
      p_id: 'ch-1', p_justificativa: 'A IA ficou fora do ar; li o plano inteiro.',
    })));
  });

  it('"Tentar a revisão de novo" refaz a revisão e, se der certo, dispensa o motivo escrito', async () => {
    configurarEdges({ data: null, error: { message: 'Falha temporária.' } });
    renderizar();
    await abrirJanelaDeChancela();
    await screen.findByText('Não foi possível fazer a revisão de segurança desta versão.');

    configurarEdges(revisaoDaEdge('baixo'));
    fireEvent.click(screen.getByRole('button', { name: /Tentar a revisão de novo/ }));

    expect(await screen.findByText(/Revisão de segurança desta versão: risco baixo/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Chancelar plano' })).toBeEnabled());
    expect(chamadasDe('revisar-plano-seguranca')).toHaveLength(2);
  });

  it('revisão que rodou mas não foi gravada no plano não vale: exige o motivo escrito', async () => {
    configurarEdges(revisaoDaEdge('baixo', { persistida: false, hash: undefined, motivo_nao_persistida: 'plano_alterado' }));
    renderizar();
    await abrirJanelaDeChancela();

    expect(await screen.findByText(/O plano mudou durante a revisão, então ela não foi registrada/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chancelar plano' })).toBeDisabled();
    expect(screen.getByLabelText(/Motivo para chancelar sem a revisão de segurança/)).toBeInTheDocument();
  });

  it('recado ao cliente opcional vai na RPC', async () => {
    renderizar();
    await abrirJanelaDeChancela();
    await screen.findByText(/Revisão de segurança desta versão: risco baixo/);
    fireEvent.change(await screen.findByLabelText(/Recado ao cliente/), { target: { value: '  Plano revisado pela equipe.  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Chancelar plano' }));

    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('chancelar_plano_cliente', expect.objectContaining({ p_nota_publica: 'Plano revisado pela equipe.' })));
  });

  it('depois de chancelar, avisa o cliente pela edge (best-effort) com o id do plano', async () => {
    renderizar();
    await abrirJanelaDeChancela();
    await screen.findByText(/Revisão de segurança desta versão: risco baixo/);
    fireEvent.click(screen.getByRole('button', { name: 'Chancelar plano' }));

    await waitFor(() => expect(h.invoke).toHaveBeenCalledWith('notificar-plano-cliente', { body: { plano_id: 'ch-1' } }));
  });

  it('o aviso falhando (edge fora do ar, erro de rede) não desfaz nem trava a chancela', async () => {
    configurarEdges(revisaoDaEdge(), { data: null, error: { message: 'Edge Function returned a non-2xx status code' } });
    renderizar();
    await abrirJanelaDeChancela();
    await screen.findByText(/Revisão de segurança desta versão: risco baixo/);
    fireEvent.click(screen.getByRole('button', { name: 'Chancelar plano' }));

    await waitFor(() => expect(chamadasDe('notificar-plano-cliente')).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Chancelar plano' })).not.toBeInTheDocument());
  });

  it('a edge de aviso lançando exceção também não derruba a chancela', async () => {
    h.invoke.mockImplementation(async (nome: string) => {
      if (nome === 'notificar-plano-cliente') throw new Error('rede caiu');
      return revisaoDaEdge();
    });
    renderizar();
    await abrirJanelaDeChancela();
    await screen.findByText(/Revisão de segurança desta versão: risco baixo/);
    fireEvent.click(screen.getByRole('button', { name: 'Chancelar plano' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Chancelar plano' })).not.toBeInTheDocument());
    expect(h.rpc).toHaveBeenCalledWith('chancelar_plano_cliente', expect.objectContaining({ p_id: 'ch-1' }));
  });

  it('chancela recusada pelo banco: nada de aviso ao cliente', async () => {
    h.rpcErro.chancelar_plano_cliente = 'permission denied';
    renderizar();
    await abrirJanelaDeChancela();
    await screen.findByText(/Revisão de segurança desta versão: risco baixo/);
    fireEvent.click(screen.getByRole('button', { name: 'Chancelar plano' }));

    await screen.findByText(/não tem permissão/);
    expect(chamadasDe('notificar-plano-cliente')).toHaveLength(0);
  });

  it('o banco achando que falta a revisão (HINT revisao_obrigatoria) volta ao fluxo sem revisão, com a mensagem', async () => {
    h.rpcErro.chancelar_plano_cliente = 'Revisão de segurança obrigatória';
    h.rpcHint.chancelar_plano_cliente = 'revisao_obrigatoria';
    renderizar();
    await abrirJanelaDeChancela();
    await screen.findByText(/Revisão de segurança desta versão: risco baixo/);
    fireEvent.click(screen.getByRole('button', { name: 'Chancelar plano' }));

    expect(await screen.findByText(/Este plano precisa da revisão de segurança desta versão/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Motivo para chancelar sem a revisão de segurança/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tentar a revisão de novo/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chancelar plano' })).toBeDisabled();
  });

  it('o banco exigindo a justificativa (HINT justificativa_obrigatoria) passa a pedi-la na tela', async () => {
    h.rpcErro.chancelar_plano_cliente = 'Justificativa obrigatória';
    h.rpcHint.chancelar_plano_cliente = 'justificativa_obrigatoria';
    renderizar();
    await abrirJanelaDeChancela();
    await screen.findByText(/Revisão de segurança desta versão: risco baixo/);
    fireEvent.click(screen.getByRole('button', { name: 'Chancelar plano' }));

    expect(await screen.findByText(/A justificativa é obrigatória para chancelar este plano/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Justificativa \(obrigatória\)/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chancelar plano' })).toBeDisabled();
  });

  it.each([
    ['sem_permissao_area', /não tem permissão para chancelar planos desta área/],
    ['nao_verificado', /ainda não foi verificado pela equipe MyHealthID/],
    ['nutricao_desligada', /nutricional Premium está desligado/],
    ['conflito_interesse', /própria conta/],
  ])('HINT %s do banco aparece em português e o diálogo continua aberto', async (hint, esperado) => {
    h.rpcErro.chancelar_plano_cliente = 'erro técnico do banco';
    h.rpcHint.chancelar_plano_cliente = hint;
    renderizar();
    await abrirJanelaDeChancela();
    await screen.findByText(/Revisão de segurança desta versão: risco baixo/);
    fireEvent.click(screen.getByRole('button', { name: 'Chancelar plano' }));

    expect(await screen.findByText(esperado)).toBeInTheDocument();
    expect(screen.queryByText(/erro técnico do banco/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chancelar plano' })).toBeInTheDocument();
  });

  it('erro de permissão antigo do banco (chancela_negada) aparece e o diálogo continua aberto', async () => {
    h.rpcErro.chancelar_plano_cliente = 'chancela_negada: só Educador Físico ou Fisioterapeuta chancela treino';
    renderizar();
    await abrirJanelaDeChancela();
    await screen.findByText(/Revisão de segurança desta versão: risco baixo/);
    fireEvent.click(screen.getByRole('button', { name: 'Chancelar plano' }));

    expect(await screen.findByText('só Educador Físico ou Fisioterapeuta chancela treino')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chancelar plano' })).toBeInTheDocument();
  });

  it('fechar a janela antes da revisão terminar descarta o resultado (sem erro)', async () => {
    let terminar: (v: unknown) => void = () => {};
    h.invoke.mockImplementation(() => new Promise((resolve) => { terminar = resolve; }));
    renderizar();
    await abrirJanelaDeChancela();
    await screen.findByText(/Rodando a revisão de segurança/);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Chancelar plano' })).not.toBeInTheDocument());
    terminar(revisaoDaEdge('baixo'));
    await waitFor(() => expect(h.rpc.mock.calls.filter(([n]) => n === 'chancelar_plano_cliente')).toHaveLength(0));
  });
});

describe('Fila de chancela: prazo, atraso e permissão por item', () => {
  it('mostra os dias úteis na fila, o selo ATRASADO e o aviso de atrasados; atrasados vêm primeiro', async () => {
    h.fila.aguardando = [
      itemTreino({ id: 'novo', titulo: 'Treino novo', gerado_em: '2026-10-08T09:00:00Z', dias_uteis_na_fila: 0, atrasado: false }),
      itemTreino({ id: 'velho', titulo: 'Treino velho', paciente_primeiro_nome: 'Paulo', gerado_em: '2026-10-05T09:00:00Z', dias_uteis_na_fila: 3, atrasado: true }),
    ];
    renderizar();
    await screen.findByText('Paulo, 34 anos');

    const itens = within(screen.getByRole('list', { name: 'Planos' })).getAllByRole('button');
    expect(itens[0]).toHaveTextContent('Treino velho');
    expect(itens[0]).toHaveTextContent('ATRASADO');
    expect(itens[0]).toHaveTextContent('3 dias úteis na fila');
    expect(itens[1]).toHaveTextContent('Treino novo');
    expect(itens[1]).not.toHaveTextContent('ATRASADO');
    expect(itens[1]).toHaveTextContent('chegou hoje');
    expect(screen.getByText(/1 plano passou do prazo de 2 dias úteis/)).toBeInTheDocument();
  });

  it('o prazo vem da configuração', async () => {
    h.config = { nutricao_premium_ativa: false, prazo_chancela_dias_uteis: 4 };
    renderizar();
    expect(await screen.findByText(/Prazo da equipe: 4 dias úteis para chancelar/)).toBeInTheDocument();
  });

  it('o detalhe repete o atraso', async () => {
    h.fila.aguardando = [itemTreino({ dias_uteis_na_fila: 3, atrasado: true })];
    renderizar();
    await abrirPlano(/Treino de força/);
    await screen.findByText('Foco em força geral');
    expect(screen.getAllByText('ATRASADO').length).toBeGreaterThanOrEqual(2);
  });

  it('pode_chancelar false do banco trava Chancelar e Editar e mostra o motivo na fila e no detalhe, mesmo que o perfil local pareça servir', async () => {
    h.fila.aguardando = [itemTreino({ pode_chancelar: false, motivo_nao_pode: 'Seu perfil ainda não foi verificado pela equipe MyHealthID.' })];
    renderizar();
    await screen.findByText('Maria, 34 anos');
    expect(screen.getByText(/Não pode chancelar: Seu perfil ainda não foi verificado pela equipe MyHealthID\./)).toBeInTheDocument();

    await abrirPlano(/Treino de força/);
    expect(await screen.findByText(/Você não pode chancelar este plano: Seu perfil ainda não foi verificado/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Editar plano/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Recusar/ })).toBeEnabled();
  });

  it('pode_chancelar true do banco vale mais que o perfil local', async () => {
    h.pode = { treino: false, nutricao: false };
    h.fila.aguardando = [itemTreino({ pode_chancelar: true })];
    renderizar();
    await abrirPlano(/Treino de força/);
    await screen.findByText('Foco em força geral');
    expect(screen.getByRole('button', { name: 'Chancelar' })).toBeEnabled();
    expect(screen.queryByText(/Não pode chancelar:/)).not.toBeInTheDocument();
  });

  it('sem pode_chancelar (banco antigo) vale o perfil local e o aviso padrão', async () => {
    h.pode = { treino: true, nutricao: false };
    renderizar();
    await screen.findByText('João, 41 anos');
    expect(screen.getByText(/Não pode chancelar: o seu perfil não habilita nutrição/)).toBeInTheDocument();
  });

  it('as abas Cancelados e Substituídos consultam a fila com o status certo e explicam o estado', async () => {
    h.fila.cancelado = [itemTreino({ id: 'c-1', status: 'cancelado' })];
    h.fila.substituido = [{ ...itemNutricao, id: 's-1', status: 'substituido' }];
    renderizar();
    await screen.findByText('Maria, 34 anos');

    fireEvent.click(screen.getByRole('tab', { name: 'Cancelados' }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('fila_chancela', { p_status: 'cancelado' }));
    await abrirPlano(/Treino de força/);
    expect(await screen.findByText('O cliente cancelou este pedido antes de a equipe decidir.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chancelar' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Substituídos' }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('fila_chancela', { p_status: 'substituido' }));
    await abrirPlano(/Plano alimentar/);
    expect(await screen.findByText(/foi trocado por um plano mais novo/)).toBeInTheDocument();
  });
});

describe('Fila de chancela: aba Administração', () => {
  it('equipe comum não vê a aba Administração', async () => {
    renderizar();
    await screen.findByText('Maria, 34 anos');
    expect(screen.queryByRole('tab', { name: /Administração/ })).not.toBeInTheDocument();
  });

  it('o administrador vê a aba, e abri-la mostra a configuração e os profissionais sem consultar a fila', async () => {
    h.user = { id: 'adm-1', email: 'rafaelbmocbel@gmail.com' };
    h.profissionais = [{
      user_id: 'u-9', nome: 'Ana', sobrenome: 'Souza', email: 'ana@exemplo.com', perfil_profissional: 'nutricionista',
      registro_profissional: 'CRN 12345', verificado: false, verificado_em: null, equipe_cientifica: false, equipe_areas: [], created_at: '2026-09-01T00:00:00Z',
    }];
    renderizar();
    await screen.findByText('Maria, 34 anos');
    const filaAntes = h.rpc.mock.calls.filter(([n]) => n === 'fila_chancela').length;

    fireEvent.click(screen.getByRole('tab', { name: /Administração/ }));
    expect(await screen.findByText('Configuração do plano do cliente')).toBeInTheDocument();
    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Planos' })).not.toBeInTheDocument();
    expect(h.rpc.mock.calls.filter(([n]) => n === 'fila_chancela').length).toBe(filaAntes);

    fireEvent.click(screen.getByRole('tab', { name: 'Aguardando 2' }));
    expect(await screen.findByText('Maria, 34 anos')).toBeInTheDocument();
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

describe('Fila de chancela: aviso ao cliente na recusa', () => {
  it('depois de recusar, avisa o cliente pela edge; falha do aviso não bloqueia', async () => {
    h.invoke.mockResolvedValue({ data: null, error: { message: 'Edge Function returned a non-2xx status code' } });
    renderizar();
    await abrirPlano(/Treino de força/);
    fireEvent.click(await screen.findByRole('button', { name: /Recusar/ }));
    fireEvent.change(await screen.findByLabelText(/Mensagem ao cliente/), { target: { value: 'Precisa de avaliação presencial antes.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recusar plano' }));

    await waitFor(() => expect(h.invoke).toHaveBeenCalledWith('notificar-plano-cliente', { body: { plano_id: 'ch-1' } }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Recusar plano' })).not.toBeInTheDocument());
  });

  it('HINT do banco na recusa (conflito_interesse) aparece em português e não avisa o cliente', async () => {
    h.rpcErro.recusar_plano_cliente = 'erro técnico';
    h.rpcHint.recusar_plano_cliente = 'conflito_interesse';
    renderizar();
    await abrirPlano(/Treino de força/);
    fireEvent.click(await screen.findByRole('button', { name: /Recusar/ }));
    fireEvent.change(await screen.findByLabelText(/Mensagem ao cliente/), { target: { value: 'Precisa de avaliação presencial antes.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recusar plano' }));

    expect(await screen.findByText(/própria conta/)).toBeInTheDocument();
    expect(chamadasDe('notificar-plano-cliente')).toHaveLength(0);
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
