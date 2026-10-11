import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  // Objeto estável: o componente recarrega tudo quando a referência de `user` muda.
  user: { id: 'user-1' },
  invoke: vi.fn(),
  escritas: [] as { tabela: string; op: string }[],
  tabelasLidas: [] as string[],
  rpcChamadas: [] as { nome: string; tipo: string }[],
  plano: {} as Record<string, unknown>,
  status: {} as Record<string, unknown>,
  config: { nutricao_premium_ativa: true, prazo_chancela_dias_uteis: 2 } as Record<string, unknown>,
  configFalha: false,
  cancelar: vi.fn(),
  acesso: { isFree: false, isPremium: true, isInTrial: false, isLoading: false },
  terapeutaId: null as string | null,
  anamneseRespostas: null as null | Record<string, unknown>,
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: h.toast }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('@/hooks/useWellnessAccess', () => ({ useWellnessAccess: () => h.acesso }));
vi.mock('@/integrations/supabase/client', () => {
  const dados = (tabela: string) => {
    switch (tabela) {
      case 'pacientes':
        return {
          data: { id: 'pac-1', terapeuta_id: h.terapeutaId, data_nascimento: '1990-05-10', sexo: 'feminino', genero: null },
          error: null,
        };
      case 'nutricao_anamnese':
        return { data: h.anamneseRespostas ? { respostas: h.anamneseRespostas } : null, error: null };
      case 'diretrizes_profissionais':
        return { data: [], error: null };
      default:
        return { data: null, error: null };
    }
  };
  const construtor = (tabela: string) => {
    h.tabelasLidas.push(tabela);
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit']) b[m] = () => b;
    b.maybeSingle = () => Promise.resolve(dados(tabela));
    for (const op of ['upsert', 'insert', 'update', 'delete']) {
      b[op] = () => {
        h.escritas.push({ tabela, op });
        return b;
      };
    }
    b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(dados(tabela)).then(ok, ko);
    return b;
  };
  return {
    supabase: {
      functions: { invoke: (...a: unknown[]) => h.invoke(...a) },
      rpc: (nome: string, args?: { p_tipo: string }) => {
        h.rpcChamadas.push({ nome, tipo: args?.p_tipo ?? '' });
        if (nome === 'plano_cliente_config') {
          return Promise.resolve(h.configFalha
            ? { data: null, error: { message: 'Could not find the function public.plano_cliente_config in the schema cache' } }
            : { data: h.config, error: null });
        }
        if (nome === 'cancelar_pedido_plano_cliente') return Promise.resolve(h.cancelar(args));
        const tipo = args?.p_tipo ?? '';
        const fonte = nome === 'meu_status_plano_cliente' ? h.status : h.plano;
        return Promise.resolve({ data: fonte[tipo] ?? null, error: null });
      },
      from: (t: string) => construtor(t),
    },
  };
});

vi.mock('@/components/paciente/PlanoTreinoInterativo', () => ({
  default: ({ onRegenerarComIncomodo }: { onRegenerarComIncomodo?: (nota: string) => void }) => (
    <div data-testid="treino-interativo">
      {onRegenerarComIncomodo && <button onClick={() => onRegenerarComIncomodo('dor no joelho')}>Senti incômodo</button>}
    </div>
  ),
}));
vi.mock('@/components/planos/TriagemSegurancaCard', () => ({
  default: ({ defaultAberto }: { defaultAberto?: boolean }) => <div data-testid="triagem-card" data-aberto={String(!!defaultAberto)} />,
}));

import { PlanoPersonalizadoSection } from '../pages/paciente/PacientePlanoIA';

const triagemCompleta = {
  versao: 1, respondida_em: '2026-10-01T10:00:00Z',
  gestante_lactante: 'nao', transtorno_alimentar: 'nao', doenca_renal: 'nao',
  diabetes_insulina: 'nao', cardio_pressao: 'nao', cirurgia_lesao_recente: 'nao',
};

const bloqueioCliente = {
  ok: false,
  bloqueio: {
    nivel: 'bloqueia',
    motivos: [{ codigo: 'dado_ausente_triagem', rotulo: 'Triagem de segurança não respondida', detalhe: '', origem: 'dados_ausentes', nivel: 'bloqueia' }],
    dadosAusentes: ['triagem_autodeclarada'],
    pode_prosseguir_profissional: false,
  },
};

const recibo = (id = 'plano-1') => ({ data: { ok: true, em_revisao: true, plano_id: id }, error: null });

const planoChancelado = (extra: Record<string, unknown> = {}) => ({
  id: 'c1',
  titulo: 'Treino chancelado',
  created_at: '2026-10-08T12:00:00Z',
  origem: 'equipe_myhealthid',
  conteudo: {
    fases: [],
    _governanca: { aprovacao: { por_nome: 'Ana Souza', por_perfil: 'educador_fisico', em: '2026-10-08T15:00:00Z', versao: 1 } },
  },
  ...extra,
});

function Rota() {
  return <div data-testid="rota">{useLocation().pathname}</div>;
}

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/paciente/exercicios']}>
        <PlanoPersonalizadoSection />
        <Rota />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  h.invoke.mockReset();
  h.escritas.length = 0;
  h.tabelasLidas.length = 0;
  h.rpcChamadas.length = 0;
  h.plano = {};
  h.status = {};
  h.config = { nutricao_premium_ativa: true, prazo_chancela_dias_uteis: 2 };
  h.configFalha = false;
  h.cancelar.mockReset();
  h.acesso = { isFree: false, isPremium: true, isInTrial: false, isLoading: false };
  h.terapeutaId = null;
  h.anamneseRespostas = null;
  h.toast.success.mockReset();
  h.toast.error.mockReset();
  h.toast.info.mockReset();
});
afterEach(() => cleanup());

describe('Plano do cliente Premium: gera, a equipe chancela, só então chega', () => {
  it('lê planos e status por RPC (nunca direto das tabelas) e não lê planos_ia_cliente', async () => {
    renderizar();
    await screen.findByRole('button', { name: 'Gerar treino' });
    const chamadas = h.rpcChamadas.map((c) => `${c.nome}:${c.tipo}`).sort();
    expect(chamadas).toEqual([
      'meu_plano_liberado:nutricao', 'meu_plano_liberado:treino',
      'meu_status_plano_cliente:nutricao', 'meu_status_plano_cliente:treino',
      'plano_cliente_config:',
    ]);
    expect(h.tabelasLidas).not.toContain('planos_ia_cliente');
    expect(h.tabelasLidas).not.toContain('planos_treino');
    expect(h.tabelasLidas).not.toContain('plano_cliente_chancela');
  });

  it('Premium vê os botões de gerar treino, nutrição e os dois', async () => {
    renderizar();
    expect(await screen.findByRole('button', { name: 'Gerar treino' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Gerar nutrição' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Gerar os dois' })).toBeEnabled();
    expect(screen.getByText('Nenhum plano ainda')).toBeInTheDocument();
  });

  it('gerar treino envia o pedido, mostra "em revisão" e não exibe nem grava nenhum plano', async () => {
    h.invoke.mockImplementation(async () => {
      h.status.treino = { status: 'aguardando', gerado_em: '2026-10-08T12:00:00Z', nota_publica: null };
      return recibo();
    });
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar treino' }));

    expect(await screen.findByText(/Em revisão pela equipe científica MyHealthID — você recebe aqui quando for chancelado/)).toBeInTheDocument();
    expect(screen.getByText(/Pedido enviado em 08\/10\/2026/)).toBeInTheDocument();
    expect(h.toast.success).toHaveBeenCalledWith(expect.stringMatching(/Seu treino foi enviado para a revisão da equipe científica MyHealthID/));
    expect(h.toast.error).not.toHaveBeenCalled();
    expect(h.escritas).toHaveLength(0);
    expect(screen.queryByTestId('treino-interativo')).not.toBeInTheDocument();

    const [funcao, opcoes] = h.invoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(funcao).toBe('gerar-plano-treino');
    expect(opcoes.body).toMatchObject({ paciente_id: 'pac-1', sexo: 'feminino' });
    expect(typeof opcoes.body.idade).toBe('number');
    expect(opcoes.body).not.toHaveProperty('override');

    expect(await screen.findByRole('button', { name: 'Treino em revisão' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Gerar nutrição' })).toBeEnabled();
  });

  it('"Gerar os dois" pede treino e nutrição', async () => {
    h.invoke.mockResolvedValue(recibo());
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar os dois' }));
    await waitFor(() => expect(h.invoke).toHaveBeenCalledTimes(2));
    expect(h.invoke.mock.calls.map((c) => c[0])).toEqual(['gerar-plano-treino', 'gerar-plano-alimentar']);
    expect(h.toast.success).toHaveBeenCalledWith(expect.stringMatching(/Seu treino e seu plano alimentar foram enviados/));
    expect(h.escritas).toHaveLength(0);
  });

  it('um plano bloqueado pela triagem não impede o outro de ir para a revisão', async () => {
    h.invoke
      .mockResolvedValueOnce(recibo())
      .mockResolvedValueOnce({ data: bloqueioCliente, error: null });
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar os dois' }));

    expect(await screen.findByText('Vamos cuidar disso com o seu profissional')).toBeInTheDocument();
    expect(h.toast.success).toHaveBeenCalledWith(expect.stringMatching(/Um dos planos foi enviado para a revisão/));
    expect(h.escritas).toHaveLength(0);
  });

  it('bloqueio da edge: mensagem acolhedora, sem opção de prosseguir; leva à triagem', async () => {
    h.invoke.mockResolvedValue({ data: bloqueioCliente, error: null });
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar treino' }));

    expect(await screen.findByText('Vamos cuidar disso com o seu profissional')).toBeInTheDocument();
    expect(screen.getByText(/Fale com o seu profissional/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gerar mesmo assim/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Estou ciente/)).not.toBeInTheDocument();
    expect(h.escritas).toHaveLength(0);
    expect(h.toast.error).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Abrir a triagem de segurança/ }));
    await waitFor(() => expect(screen.queryByText('Vamos cuidar disso com o seu profissional')).not.toBeInTheDocument());
    expect(screen.getByTestId('triagem-card')).toHaveAttribute('data-aberto', 'true');
  });

  it('se a edge devolver o plano com conteúdo (sem chancela), o portal não o exibe e avisa o erro', async () => {
    h.invoke.mockResolvedValue({ data: { ok: true, plano: { titulo: 'Sem chancela', fases: [] } }, error: null });
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar treino' }));

    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith(expect.stringMatching(/revisão da equipe/)));
    expect(h.toast.success).not.toHaveBeenCalled();
    expect(screen.queryByText('Sem chancela')).not.toBeInTheDocument();
    expect(screen.queryByTestId('treino-interativo')).not.toBeInTheDocument();
    expect(h.escritas).toHaveLength(0);
  });

  it('erro 402 da edge (sem Premium) mostra a mensagem acolhedora do servidor', async () => {
    const mensagem = 'Gerar o seu plano faz parte do Premium. Seu profissional continua podendo montar um para você.';
    h.invoke.mockResolvedValue({ data: null, error: { context: { json: async () => ({ error: mensagem, codigo: 'premium_necessario' }) } } });
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar treino' }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith(mensagem));
  });

  it('409 do servidor (já há treino em revisão, ex.: outra aba): mostra o aviso e passa o botão para "em revisão"', async () => {
    const mensagem = 'Você já tem um treino aguardando a revisão da equipe científica MyHealthID. Assim que for chancelado ele aparece aqui no portal; depois disso você pode gerar um novo.';
    h.invoke.mockImplementation(async () => {
      h.status.treino = { status: 'aguardando', gerado_em: '2026-10-09T12:00:00Z', nota_publica: null };
      return { data: null, error: { context: { json: async () => ({ error: mensagem, codigo: 'plano_em_revisao' }) } } };
    });
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar treino' }));

    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith(mensagem));
    expect(await screen.findByRole('button', { name: 'Treino em revisão' })).toBeDisabled();
  });

  it('"Senti incômodo" no treino chancelado gera novo plano para a fila; o chancelado segue visível', async () => {
    h.plano.treino = planoChancelado();
    h.status.treino = { status: 'chancelado', gerado_em: '2026-10-08T12:00:00Z', nota_publica: null };
    h.invoke.mockImplementation(async () => {
      h.status.treino = { status: 'aguardando', gerado_em: '2026-10-09T12:00:00Z', nota_publica: null };
      return recibo();
    });
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Senti incômodo' }));

    expect(await screen.findByText(/Em revisão pela equipe científica MyHealthID/)).toBeInTheDocument();
    expect(screen.getByText(/O plano abaixo continua valendo até o novo ser chancelado/)).toBeInTheDocument();
    expect(screen.getByTestId('treino-interativo')).toBeInTheDocument();
    expect(screen.getByText(/Chancelado pela equipe científica MyHealthID/)).toBeInTheDocument();

    const [funcao, opcoes] = h.invoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(funcao).toBe('gerar-plano-treino');
    expect(String(opcoes.body.restricoes)).toContain('dor no joelho');
    expect(h.toast.success).toHaveBeenCalledWith(expect.stringMatching(/Recebemos o seu relato.*procure um profissional/));
    expect(h.escritas).toHaveLength(0);
  });

  it('o plano do profissional não oferece "Senti incômodo" (não é o plano gerado pelo app)', async () => {
    h.plano.treino = { titulo: 'Treino do profissional', origem: 'profissional', conteudo: { fases: [] } };
    renderizar();
    expect(await screen.findByTestId('treino-interativo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Senti incômodo' })).not.toBeInTheDocument();
  });
});

describe('Situação do plano do cliente', () => {
  it('chancelado: mostra o plano com o selo da equipe científica (nome, perfil, data, versão)', async () => {
    h.plano.treino = planoChancelado();
    h.status.treino = { status: 'chancelado', gerado_em: '2026-10-08T12:00:00Z', nota_publica: null };
    renderizar();
    expect(await screen.findByText('Chancelado pela equipe científica MyHealthID · Ana Souza, Educador Físico · 08/10/2026 · v1')).toBeInTheDocument();
    expect(screen.getByTestId('treino-interativo')).toBeInTheDocument();
    expect(screen.queryByText(/Em revisão pela equipe/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Liberado/)).not.toBeInTheDocument();
  });

  it('chancelado de nutrição aparece na seção Nutricional com o selo da equipe', async () => {
    h.plano.nutricao = {
      titulo: 'Plano alimentar', origem: 'equipe_myhealthid', calorias_alvo: 2000,
      conteudo: { refeicoes: [], _governanca: { aprovacao: { por_nome: 'Bia Lima', por_perfil: 'nutricionista', em: '2026-10-08T15:00:00Z', versao: 2 } } },
    };
    renderizar();
    expect(await screen.findByText('Chancelado pela equipe científica MyHealthID · Bia Lima, Nutricionista · 08/10/2026 · v2')).toBeInTheDocument();
    expect(screen.getByText('Plano alimentar')).toBeInTheDocument();
  });

  it('aguardando sem plano anterior: só o status, sem conteúdo', async () => {
    h.status.nutricao = { status: 'aguardando', gerado_em: '2026-10-08T12:00:00Z', nota_publica: null };
    renderizar();
    expect(await screen.findByText(/Em revisão pela equipe científica MyHealthID — você recebe aqui quando for chancelado/)).toBeInTheDocument();
    expect(screen.queryByText(/continua valendo/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nutrição em revisão' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Gerar os dois' })).not.toBeInTheDocument();
  });

  it('recusado: mostra o recado público da equipe e permite gerar de novo', async () => {
    h.status.treino = { status: 'recusado', gerado_em: '2026-10-08T12:00:00Z', nota_publica: 'Precisamos de mais detalhes sobre a sua dor no ombro.' };
    renderizar();
    expect(await screen.findByText('Recusado: Precisamos de mais detalhes sobre a sua dor no ombro')).toBeInTheDocument();
    expect(screen.getByText('Você pode gerar de novo ou procurar um profissional.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar treino de novo' })).toBeEnabled();
  });

  it('plano do profissional tem precedência sobre o chancelado', async () => {
    h.plano.treino = {
      titulo: 'Treino do profissional', origem: 'profissional',
      conteudo: { fases: [], _governanca: { aprovacao: { por_nome: 'Carlos', em: '2026-10-01T15:00:00Z', versao: 3 } } },
    };
    h.status.treino = { status: 'chancelado', gerado_em: '2026-10-08T12:00:00Z', nota_publica: null };
    renderizar();
    expect(await screen.findByText(/Liberado por Carlos em 01\/10\/2026 · v3/)).toBeInTheDocument();
    expect(screen.getByText(/Seu profissional liberou um plano/)).toBeInTheDocument();
    expect(screen.queryByText(/Chancelado pela equipe/)).not.toBeInTheDocument();
  });
});

describe('Quem não é Premium', () => {
  it('free vê o convite Premium e nenhum botão de gerar; o teste grátis não dá direito', async () => {
    h.acesso = { isFree: true, isPremium: false, isInTrial: true, isLoading: false };
    renderizar();
    expect(await screen.findByText('Monte seu treino e nutrição sob medida')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gerar/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Gerar meu treino e plano nutricional')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Assinar o Premium/ }));
    expect(screen.getByTestId('rota')).toHaveTextContent('/paciente/plano');
    expect(h.invoke).not.toHaveBeenCalled();
  });

  it('cliente de profissional (clínico) não vê o convite Premium nem o gerador', async () => {
    h.acesso = { isFree: false, isPremium: false, isInTrial: false, isLoading: false };
    h.terapeutaId = 'ter-1';
    renderizar();
    expect(await screen.findByText(/assim que for liberado/i)).toBeInTheDocument();
    expect(screen.queryByText('Monte seu treino e nutrição sob medida')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gerar/ })).not.toBeInTheDocument();
  });

  it('o status em revisão não mostra botões de gerar para quem deixou de ser Premium', async () => {
    h.acesso = { isFree: true, isPremium: false, isInTrial: false, isLoading: false };
    h.status.treino = { status: 'aguardando', gerado_em: '2026-10-08T12:00:00Z', nota_publica: null };
    renderizar();
    expect(await screen.findByText(/Em revisão pela equipe científica MyHealthID/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Treino em revisão|Gerar treino/ })).not.toBeInTheDocument();
  });
});

describe('Convite para procurar um profissional', () => {
  it.each([
    ['premium', { isFree: false, isPremium: true, isInTrial: false, isLoading: false }],
    ['free', { isFree: true, isPremium: false, isInTrial: false, isLoading: false }],
    ['clínico', { isFree: false, isPremium: false, isInTrial: false, isLoading: false }],
  ])('sempre aparece (%s), sem profissional: leva a /paciente/profissionais', async (_nome, acesso) => {
    h.acesso = acesso;
    renderizar();
    expect(await screen.findByText('Para um treino e plano nutricional ainda melhores, procure um profissional que use o MyHealthID')).toBeInTheDocument();
    expect(screen.queryByText(/pode refinar e acompanhar este plano/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Encontrar um profissional/ }));
    expect(screen.getByTestId('rota')).toHaveTextContent('/paciente/profissionais');
  });

  it('com profissional no MyHealthID, o texto muda e há atalho para conversar com ele', async () => {
    h.terapeutaId = 'ter-1';
    renderizar();
    expect(await screen.findByText('Seu profissional no MyHealthID pode refinar e acompanhar este plano')).toBeInTheDocument();
    expect(screen.queryByText(/procure um profissional que use o MyHealthID/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver profissionais' }));
    expect(screen.getByTestId('rota')).toHaveTextContent('/paciente/profissionais');
  });
});

describe('Triagem de segurança do cliente', () => {
  it('sem triagem completa, o cartão da triagem aparece aberto', async () => {
    renderizar();
    const card = await screen.findByTestId('triagem-card');
    expect(card).toHaveAttribute('data-aberto', 'true');
  });

  it('com a triagem completa, o cartão fica recolhido', async () => {
    h.anamneseRespostas = { triagem: triagemCompleta };
    renderizar();
    const card = await screen.findByTestId('triagem-card');
    expect(card).toHaveAttribute('data-aberto', 'false');
  });
});

const PRAZO_FUTURO = '2026-10-13T02:59:59Z';

describe('Prazo da equipe, atraso e cancelamento do pedido', () => {
  it('aguardando dentro do prazo: mostra a previsão (data de Brasília), o botão de cancelar e o gerar desligado', async () => {
    h.status.treino = {
      status: 'aguardando', gerado_em: '2026-10-08T12:00:00Z', nota_publica: null,
      prazo_previsto: PRAZO_FUTURO, atrasado: false, pode_regenerar: false,
    };
    renderizar();
    expect(await screen.findByText('Previsão: até 12/10/2026.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar pedido do treino' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Treino em revisão' })).toBeDisabled();
    expect(screen.queryByText(/Sentimos muito/)).not.toBeInTheDocument();
  });

  it('o servidor decide: pode_regenerar=false mantém o botão desligado mesmo sem prazo na resposta', async () => {
    h.status.nutricao = { status: 'aguardando', gerado_em: '2026-10-08T12:00:00Z', nota_publica: null, atrasado: false, pode_regenerar: false };
    renderizar();
    expect(await screen.findByRole('button', { name: 'Nutrição em revisão' })).toBeDisabled();
    expect(screen.queryByText(/Previsão: até/)).not.toBeInTheDocument();
  });

  it('atrasado: recado acolhedor com a previsão que era, e dá para pedir de novo ou cancelar', async () => {
    h.status.treino = {
      status: 'aguardando', gerado_em: '2026-10-05T12:00:00Z', nota_publica: null,
      prazo_previsto: '2026-10-08T02:59:59Z', atrasado: true, pode_regenerar: true,
    };
    h.invoke.mockResolvedValue(recibo());
    renderizar();
    expect(await screen.findByText(/Sentimos muito: a revisão do seu pedido está levando mais tempo do que o previsto \(a previsão era até 07\/10\/2026\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Previsão: até/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar pedido do treino' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Gerar treino de novo' }));
    await waitFor(() => expect(h.invoke).toHaveBeenCalledTimes(1));
    expect(h.invoke.mock.calls[0][0]).toBe('gerar-plano-treino');
  });

  it('cancelar pede confirmação, chama a RPC do tipo certo e libera o gerar de novo', async () => {
    h.status.treino = {
      status: 'aguardando', gerado_em: '2026-10-08T12:00:00Z', nota_publica: null,
      prazo_previsto: PRAZO_FUTURO, atrasado: false, pode_regenerar: false,
    };
    h.cancelar.mockReturnValue({
      data: { status: 'cancelado', gerado_em: '2026-10-08T12:00:00Z', nota_publica: null, prazo_previsto: null, atrasado: false, pode_regenerar: true },
      error: null,
    });
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar pedido do treino' }));

    expect(await screen.findByText('Cancelar o pedido do treino?')).toBeInTheDocument();
    expect(h.cancelar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar pedido' }));

    await waitFor(() => expect(h.cancelar).toHaveBeenCalledWith({ p_tipo: 'treino' }));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith('Pedido cancelado. Quando quiser, é só pedir de novo.'));
    expect(screen.queryByText(/Em revisão pela equipe/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar treino' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Gerar os dois' })).toBeEnabled();
    expect(h.toast.error).not.toHaveBeenCalled();
  });

  it('"Manter o pedido" fecha a confirmação sem cancelar nada', async () => {
    h.status.nutricao = { status: 'aguardando', gerado_em: '2026-10-08T12:00:00Z', nota_publica: null, prazo_previsto: PRAZO_FUTURO, atrasado: false, pode_regenerar: false };
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar pedido do plano alimentar' }));
    expect(await screen.findByText('Cancelar o pedido do plano alimentar?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Manter o pedido' }));
    await waitFor(() => expect(screen.queryByText('Cancelar o pedido do plano alimentar?')).not.toBeInTheDocument());
    expect(h.cancelar).not.toHaveBeenCalled();
    expect(screen.getByText(/Em revisão pela equipe/)).toBeInTheDocument();
  });

  it('a equipe decidiu antes do cancelamento: avisa e mostra a situação atualizada', async () => {
    h.status.treino = { status: 'aguardando', gerado_em: '2026-10-08T12:00:00Z', nota_publica: null, prazo_previsto: PRAZO_FUTURO, atrasado: false, pode_regenerar: false };
    h.plano.treino = undefined;
    h.cancelar.mockImplementation(() => {
      h.status.treino = { status: 'recusado', gerado_em: '2026-10-08T12:00:00Z', nota_publica: 'Falta o histórico.', atrasado: false, pode_regenerar: true };
      return { data: null, error: { message: 'Este pedido já foi decidido pela equipe e não pode mais ser cancelado.', hint: 'pedido_ja_decidido' } };
    });
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar pedido do treino' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar pedido' }));

    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith(expect.stringMatching(/A equipe acabou de decidir este pedido/)));
    expect(await screen.findByText('Recusado: Falta o histórico')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar pedido do treino' })).not.toBeInTheDocument();
  });

  it('falha de rede ao cancelar não apaga a situação: o pedido segue aguardando', async () => {
    h.status.treino = { status: 'aguardando', gerado_em: '2026-10-08T12:00:00Z', nota_publica: null, prazo_previsto: PRAZO_FUTURO, atrasado: false, pode_regenerar: false };
    h.cancelar.mockReturnValue({ data: null, error: { message: 'Failed to fetch' } });
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar pedido do treino' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar pedido' }));

    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('Não consegui cancelar o pedido agora. Tente de novo em instantes.'));
    expect(screen.getByText(/Em revisão pela equipe/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Treino em revisão' })).toBeDisabled();
  });

  it('pedido cancelado antes: não aparece aviso e o gerar volta ao normal', async () => {
    h.status.treino = { status: 'cancelado', gerado_em: '2026-10-08T12:00:00Z', nota_publica: null, atrasado: false, pode_regenerar: true };
    renderizar();
    expect(await screen.findByRole('button', { name: 'Gerar treino' })).toBeEnabled();
    expect(screen.queryByText(/Em revisão pela equipe/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancelar pedido/ })).not.toBeInTheDocument();
    expect(screen.getByText('Nenhum plano ainda')).toBeInTheDocument();
  });

  it('"Senti incômodo" some enquanto há um pedido dentro do prazo (o servidor recusaria com 409)', async () => {
    h.plano.treino = planoChancelado();
    h.status.treino = { status: 'aguardando', gerado_em: '2026-10-09T12:00:00Z', nota_publica: null, prazo_previsto: PRAZO_FUTURO, atrasado: false, pode_regenerar: false };
    renderizar();
    expect(await screen.findByTestId('treino-interativo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Senti incômodo' })).not.toBeInTheDocument();
  });
});

describe('Nutrição Premium desligada: só o treino é oferecido', () => {
  beforeEach(() => {
    h.config = { nutricao_premium_ativa: false, prazo_chancela_dias_uteis: 2 };
  });

  it('troca o botão da nutrição por "em breve" e esconde "Gerar os dois"', async () => {
    renderizar();
    expect(await screen.findByRole('button', { name: 'Gerar treino' })).toBeEnabled();
    expect(screen.getByText('Plano nutricional Premium: em breve')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gerar nutrição' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gerar os dois' })).not.toBeInTheDocument();
    expect(screen.getByText('Gerar meu treino')).toBeInTheDocument();
    expect(screen.queryByText('Gerar meu treino e plano nutricional')).not.toBeInTheDocument();
    expect(screen.getByText(/Toque em "Gerar treino" acima/)).toBeInTheDocument();
  });

  it('gerar o treino pede só o treino à edge', async () => {
    h.invoke.mockResolvedValue(recibo());
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar treino' }));
    await waitFor(() => expect(h.invoke).toHaveBeenCalledTimes(1));
    expect(h.invoke.mock.calls.map((c) => c[0])).toEqual(['gerar-plano-treino']);
    expect(h.toast.success).toHaveBeenCalledWith(expect.stringMatching(/^Seu treino foi enviado/));
  });

  it('se a leitura da configuração falha, vale o padrão seguro: nutrição em breve', async () => {
    h.config = { nutricao_premium_ativa: true, prazo_chancela_dias_uteis: 2 };
    h.configFalha = true;
    renderizar();
    expect(await screen.findByText('Plano nutricional Premium: em breve')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gerar nutrição' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar treino' })).toBeEnabled();
  });

  it('o plano alimentar já chancelado continua visível; só o gerar some', async () => {
    h.plano.nutricao = {
      titulo: 'Plano alimentar', origem: 'equipe_myhealthid', calorias_alvo: 2000,
      conteudo: { refeicoes: [], _governanca: { aprovacao: { por_nome: 'Bia Lima', por_perfil: 'nutricionista', em: '2026-10-08T15:00:00Z', versao: 2 } } },
    };
    renderizar();
    expect(await screen.findByText('Plano alimentar')).toBeInTheDocument();
    expect(screen.getByText('Plano nutricional Premium: em breve')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Gerar nov[ao] nutrição/ })).not.toBeInTheDocument();
  });

  it('um pedido de nutrição que já estava na fila continua podendo ser cancelado', async () => {
    h.status.nutricao = { status: 'aguardando', gerado_em: '2026-10-08T12:00:00Z', nota_publica: null, prazo_previsto: PRAZO_FUTURO, atrasado: false, pode_regenerar: false };
    renderizar();
    expect(await screen.findByRole('button', { name: 'Cancelar pedido do plano alimentar' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Nutrição em revisão' })).not.toBeInTheDocument();
  });

  it('o convite Premium do free não promete a nutrição agora', async () => {
    h.acesso = { isFree: true, isPremium: false, isInTrial: false, isLoading: false };
    renderizar();
    expect(await screen.findByText('Monte seu treino sob medida')).toBeInTheDocument();
    expect(screen.getByText(/O plano nutricional Premium estará disponível em breve/)).toBeInTheDocument();
    expect(screen.queryByText('Monte seu treino e nutrição sob medida')).not.toBeInTheDocument();
  });

  it('com a nutrição ligada o card volta a oferecer os dois', async () => {
    h.config = { nutricao_premium_ativa: true, prazo_chancela_dias_uteis: 2 };
    renderizar();
    expect(await screen.findByRole('button', { name: 'Gerar nutrição' })).toBeEnabled();
    expect(screen.getByText('Gerar meu treino e plano nutricional')).toBeInTheDocument();
    expect(screen.queryByText('Plano nutricional Premium: em breve')).not.toBeInTheDocument();
  });
});

describe('403 das edges de geração', () => {
  const erro403 = (error: string, codigo: string) => ({ data: null, error: { context: { json: async () => ({ error, codigo }), status: 403 } } });

  it('nutricao_em_breve com a tela desatualizada: avisa com gentileza e troca o botão por "em breve"', async () => {
    h.invoke.mockResolvedValue(erro403('O plano nutricional Premium estará disponível em breve.', 'nutricao_em_breve'));
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar nutrição' }));

    await waitFor(() => expect(h.toast.info).toHaveBeenCalledWith('O plano nutricional Premium estará disponível em breve.'));
    expect(h.toast.error).not.toHaveBeenCalled();
    expect(await screen.findByText('Plano nutricional Premium: em breve')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gerar nutrição' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerar treino' })).toBeEnabled();
  });

  it('"Gerar os dois": o treino vai para a revisão e a nutrição "em breve" é avisada sem erro', async () => {
    h.invoke
      .mockResolvedValueOnce(recibo())
      .mockResolvedValueOnce(erro403('O plano nutricional Premium estará disponível em breve.', 'nutricao_em_breve'));
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar os dois' }));

    await waitFor(() => expect(h.toast.info).toHaveBeenCalledWith('O plano nutricional Premium estará disponível em breve.'));
    expect(h.toast.success).toHaveBeenCalledWith(expect.stringMatching(/^Seu treino foi enviado/));
    expect(h.toast.error).not.toHaveBeenCalled();
    expect(await screen.findByText('Plano nutricional Premium: em breve')).toBeInTheDocument();
  });

  it('profissional_nao_verificado vira a mensagem acolhedora, não o texto cru do servidor', async () => {
    h.invoke.mockResolvedValue(erro403('Seu perfil profissional ainda não foi verificado pela equipe MyHealthID', 'profissional_nao_verificado'));
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Gerar treino' }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith(expect.stringMatching(/ainda não foi verificado pela equipe MyHealthID.*poderá gerar planos/)));
    expect(h.toast.info).not.toHaveBeenCalled();
  });
});

describe('Selo do plano chancelado pelo administrador na própria conta', () => {
  const carimboAutochancela = (extra: Record<string, unknown> = {}) => planoChancelado({
    conteudo: {
      fases: [],
      _governanca: {
        aprovacao: {
          por_nome: 'Rafael', por_perfil: 'super_admin', em: '2026-10-08T15:00:00Z', versao: 1, autochancela: true, ...extra,
        },
      },
    },
  });

  it('mostra "Autochancela (teste interno)" e nunca fala de revisão automática', async () => {
    h.plano.treino = carimboAutochancela({ sem_revisao: true, motivo_sem_revisao: 'IA fora do ar, conferi o plano à mão' });
    h.status.treino = { status: 'chancelado', gerado_em: '2026-10-08T12:00:00Z', nota_publica: null, atrasado: false, pode_regenerar: true };
    const { container } = renderizar();
    expect(await screen.findByText(/Chancelado pela equipe científica MyHealthID · Rafael, Administrador\(a\) · 08\/10\/2026 · v1 · Autochancela \(teste interno\)/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/sem revisão|revisão automática|revisão de segurança/i);
    expect(container.textContent).not.toContain('IA fora do ar');
  });

  it('sem autochancela o selo não traz esse texto', async () => {
    h.plano.treino = planoChancelado();
    renderizar();
    expect(await screen.findByText(/Chancelado pela equipe científica MyHealthID · Ana Souza/)).toBeInTheDocument();
    expect(screen.queryByText(/Autochancela \(teste interno\)/)).not.toBeInTheDocument();
  });
});
