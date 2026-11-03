import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

type Registro = Record<string, unknown>;
type ErroBanco = { code?: string; message: string };

const h = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  paciente: { id: 'pac-1', terapeuta_id: 'prof-1', nome: 'Ana', sobrenome: 'Lima', email: null, telefone: null, data_nascimento: null, avatar_url: null } as Registro | null,
  serie: [] as Registro[],
  serieErro: null as ErroBanco | null,
  preferencia: null as { whatsapp_ativo: boolean } | null,
  preferenciaErro: null as ErroBanco | null,
  myidConcluidos: 0,
  myidMigrados: 0,
  myidErro: false,
  consultas: [] as { tabela: string; colunas?: string; filtros: [string, unknown][]; ordem?: unknown[]; limite?: number }[],
  servidor: { semana: '2026-11-02', devolveSemana: true },
  segurarSerie: null as Promise<void> | null,
  rpc: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('@/components/paciente/PacienteLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/paciente/ProtectedPatientRoute', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('react-router-dom', async (importar) => ({
  ...(await importar<typeof import('react-router-dom')>()),
  useNavigate: () => h.navigate,
}));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ data, children }: { data: unknown[]; children: React.ReactNode }) => (
    <div data-testid="grafico" data-pontos={data.length}>{children}</div>
  ),
  Line: ({ dataKey }: { dataKey: string }) => <span data-testid="linha" data-chave={dataKey} />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    from: (tabela: string) => {
      const q = { tabela, colunas: undefined as string | undefined, filtros: [] as [string, unknown][], ordem: undefined as unknown[] | undefined, limite: undefined as number | undefined };
      h.consultas.push(q);
      const b: Record<string, unknown> = {};
      b.select = (colunas: string) => { q.colunas = colunas; return b; };
      b.eq = (c: string, v: unknown) => { q.filtros.push([c, v]); return b; };
      b.order = (...a: unknown[]) => { q.ordem = a; return b; };
      b.limit = (n: number) => { q.limite = n; return b; };
      const resolver = () => {
        if (tabela === 'pacientes') return { data: h.paciente, error: null };
        if (tabela === 'checkins_semanais') {
          if (h.serieErro) return { data: null, error: h.serieErro };
          const desc = [...h.serie].sort((x, y) => String(y.semana).localeCompare(String(x.semana)));
          return { data: desc.slice(0, q.limite ?? desc.length), error: null };
        }
        if (tabela === 'checkin_preferencias') {
          if (h.preferenciaErro) return { data: null, error: h.preferenciaErro };
          return { data: h.preferencia, error: null };
        }
        if (tabela === 'myid_avaliacoes') {
          if (h.myidErro) return { count: null, error: { message: 'Failed to fetch' } };
          return { count: h.myidConcluidos, error: null };
        }
        if (tabela === 'avaliacoes_identidade') return { count: h.myidMigrados, error: null };
        return { data: null, error: null };
      };
      b.maybeSingle = () => Promise.resolve(resolver());
      b.then = (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => {
        const espera = tabela === 'checkins_semanais' ? h.segurarSerie : null;
        return Promise.resolve(espera).then(resolver).then(ok, ko);
      };
      return b;
    },
  },
}));

import PacienteCheckin from '@/pages/paciente/PacienteCheckin';
import { respostaContaNestaSemana, useCheckinSemanal } from '@/hooks/useCheckinSemanal';
import CheckinSemanalForm from '@/components/paciente/CheckinSemanalForm';
import CheckinEvolucaoCliente from '@/components/paciente/CheckinEvolucaoCliente';
import {
  ESCALA_URINA,
  ITENS_CHECKIN,
  ROTULOS_ITEM,
  type ItemCheckin,
  type LinhaCheckin,
  type NivelItem,
  type ValoresCheckin,
} from '@/lib/checkinSemanal';

// Quarta-feira, 04/11/2026 (12h em Brasília): a semana atual começa na segunda 02/11.
const AGORA = '2026-11-04T15:00:00Z';
const SEMANA = '2026-11-02';
const SEMANA_ANTERIOR = '2026-10-26';

const linha = (semana: string, v: Partial<LinhaCheckin> & Registro = {}): LinhaCheckin & Registro => ({
  semana, fadiga: 4, sono: 4, dor_muscular: 4, estresse: 4, humor: 4, urina: null, psr: null, ...v,
});

// n semanas seguidas, terminando em `ultima`, da mais antiga para a mais recente.
function semanasAte(ultima: string, n: number): string[] {
  const fim = Date.parse(`${ultima}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(fim - (n - 1 - i) * 7 * 86400000).toISOString().slice(0, 10));
}

const responder = (item: ItemCheckin, nivel: NivelItem) => {
  const grupo = screen.getByRole('radiogroup', { name: ROTULOS_ITEM[item].titulo });
  fireEvent.click(within(grupo).getByRole('radio', { name: `${nivel} ${ROTULOS_ITEM[item].niveis[nivel]}` }));
};

const responderTudo = () => {
  responder('fadiga', 4);
  responder('sono', 3);
  responder('dor_muscular', 5);
  responder('estresse', 2);
  responder('humor', 4);
};

const botaoEnviar = () => screen.getByRole('button', { name: /^Envi/ });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(AGORA));
  h.user = { id: 'user-1' };
  h.paciente = { id: 'pac-1', terapeuta_id: 'prof-1', nome: 'Ana', sobrenome: 'Lima', email: null, telefone: null, data_nascimento: null, avatar_url: null };
  h.serie = [];
  h.serieErro = null;
  h.preferencia = null;
  h.preferenciaErro = null;
  h.myidConcluidos = 0;
  h.myidMigrados = 0;
  h.myidErro = false;
  h.consultas = [];
  h.servidor = { semana: SEMANA, devolveSemana: true };
  h.segurarSerie = null;
  h.navigate.mockReset();
  h.rpc.mockReset();
  h.rpc.mockImplementation(async (nome: string, args: Record<string, unknown>) => {
    if (nome === 'registrar_checkin_semanal') {
      const semana = h.servidor.semana;
      h.serie = h.serie.filter((r) => r.semana !== semana);
      h.serie.push({
        semana, updated_at: new Date().toISOString(), fadiga: args.p_fadiga, sono: args.p_sono, dor_muscular: args.p_dor_muscular,
        estresse: args.p_estresse, humor: args.p_humor, urina: args.p_urina, psr: args.p_psr,
      });
      const devolvida = h.servidor.devolveSemana ? { semana } : {};
      return { data: { ...devolvida, indice: 18, respostas: 1, alertas: ['fadiga', 'sono'] }, error: null };
    }
    return { data: true, error: null };
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <PacienteCheckin />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const abrirFormulario = async () => {
  const r = renderizar();
  await screen.findByRole('form', { name: 'Check-in da semana' });
  return r;
};

describe('CheckinSemanalForm', () => {
  const montar = (props: Partial<React.ComponentProps<typeof CheckinSemanalForm>> = {}) => {
    const onEnviar = vi.fn();
    render(<CheckinSemanalForm onEnviar={onEnviar} {...props} />);
    return { onEnviar };
  };

  it('"Enviar" só habilita com os 5 itens respondidos, e diz quantos faltam', () => {
    const { onEnviar } = montar();
    expect(botaoEnviar()).toBeDisabled();
    expect(screen.getByText(/0 de 5/)).toBeInTheDocument();

    responder('fadiga', 4);
    responder('sono', 3);
    responder('dor_muscular', 5);
    responder('estresse', 2);
    expect(botaoEnviar()).toBeDisabled();
    expect(screen.getByText(/4 de 5/)).toBeInTheDocument();

    fireEvent.submit(screen.getByRole('form', { name: 'Check-in da semana' }));
    expect(onEnviar).not.toHaveBeenCalled();

    responder('humor', 4);
    expect(botaoEnviar()).toBeEnabled();
    expect(screen.queryByText(/de 5\)/)).toBeNull();
  });

  it('cada pergunta tem 5 opções do melhor (5) ao pior (1), com os rótulos do cliente, e deixa claro que 5 é o melhor', () => {
    montar();
    expect(screen.getByText(/Em todas, 5 é o melhor e 1 é o pior/)).toBeInTheDocument();
    expect(screen.getAllByText('5 = melhor · 1 = pior')).toHaveLength(5);
    for (const item of ITENS_CHECKIN) {
      const grupo = screen.getByRole('radiogroup', { name: ROTULOS_ITEM[item].titulo });
      const radios = within(grupo).getAllByRole('radio');
      expect(radios.map((r) => r.getAttribute('value'))).toEqual(['5', '4', '3', '2', '1']);
      for (const nivel of [5, 4, 3, 2, 1] as NivelItem[]) {
        expect(within(grupo).getByRole('radio', { name: `${nivel} ${ROTULOS_ITEM[item].niveis[nivel]}` })).toBeInTheDocument();
      }
    }
  });

  it('sem urina nem treino, envia só os 5 itens e os opcionais vão como null', () => {
    const { onEnviar } = montar();
    responderTudo();
    fireEvent.click(botaoEnviar());
    expect(onEnviar).toHaveBeenCalledTimes(1);
    expect(onEnviar).toHaveBeenCalledWith({ fadiga: 4, sono: 3, dor_muscular: 5, estresse: 2, humor: 4, urina: null, psr: null });
  });

  it('cor da urina: 8 cores com número e nome, "Pular" marcado por padrão; escolher envia o nível e voltar a pular devolve null', () => {
    const { onEnviar } = montar();
    const grupo = screen.getByRole('radiogroup', { name: 'Cor da urina (opcional)' });
    expect(within(grupo).getByRole('radio', { name: 'Pular esta pergunta' })).toBeChecked();
    expect(within(grupo).getAllByRole('radio')).toHaveLength(ESCALA_URINA.length + 1);
    for (const cor of ESCALA_URINA) {
      expect(within(grupo).getByRole('radio', { name: `${cor.nivel} ${cor.descricao}` })).toBeInTheDocument();
    }

    responderTudo();
    fireEvent.click(within(grupo).getByRole('radio', { name: '6 Âmbar' }));
    expect(within(grupo).getByRole('radio', { name: 'Pular esta pergunta' })).not.toBeChecked();
    fireEvent.click(botaoEnviar());
    expect(onEnviar).toHaveBeenLastCalledWith(expect.objectContaining({ urina: 6 }));

    fireEvent.click(within(grupo).getByRole('radio', { name: 'Pular esta pergunta' }));
    fireEvent.click(botaoEnviar());
    expect(onEnviar).toHaveBeenLastCalledWith(expect.objectContaining({ urina: null }));
  });

  it('a recuperação de 0 a 10 usa 4 colunas no celular (6 só a partir de sm) para as 11 opções caberem em 360 px', () => {
    montar();
    fireEvent.click(screen.getByRole('radio', { name: 'Sim' }));
    const grupo = screen.getByRole('radiogroup', { name: 'Recuperação do treino (opcional)' });
    const grade = grupo.querySelector('.grid');
    expect(grade).not.toBeNull();
    expect(grade!.className).toContain('grid-cols-4');
    expect(grade!.className).toContain('sm:grid-cols-6');
    expect(grade!.className).not.toMatch(/(^|\s)grid-cols-6/);
  });

  it('"Treinou esta semana?" abre a recuperação de 0 a 10; só vale se treinou', () => {
    const { onEnviar } = montar();
    expect(screen.getByRole('radio', { name: 'Não' })).toBeChecked();
    expect(screen.queryByRole('radiogroup', { name: 'Recuperação do treino (opcional)' })).toBeNull();

    responderTudo();
    fireEvent.click(screen.getByRole('radio', { name: 'Sim' }));
    const grupo = screen.getByRole('radiogroup', { name: 'Recuperação do treino (opcional)' });
    expect(within(grupo).getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);

    fireEvent.click(within(grupo).getByRole('radio', { name: '7: Bem recuperado(a)' }));
    expect(screen.getByText('7: Bem recuperado(a)')).toBeInTheDocument();
    fireEvent.click(botaoEnviar());
    expect(onEnviar).toHaveBeenLastCalledWith(expect.objectContaining({ psr: 7 }));

    fireEvent.click(screen.getByRole('radio', { name: 'Não' }));
    expect(screen.queryByRole('radiogroup', { name: 'Recuperação do treino (opcional)' })).toBeNull();
    fireEvent.click(botaoEnviar());
    expect(onEnviar).toHaveBeenLastCalledWith(expect.objectContaining({ psr: null }));
  });

  it('treinou mas pulou a recuperação: envia psr null, e recuperação 0 é uma resposta válida (não vira null)', () => {
    const { onEnviar } = montar();
    responderTudo();
    fireEvent.click(screen.getByRole('radio', { name: 'Sim' }));
    fireEvent.click(botaoEnviar());
    expect(onEnviar).toHaveBeenLastCalledWith(expect.objectContaining({ psr: null }));

    fireEvent.click(screen.getByRole('radio', { name: '0: Nada recuperado(a)' }));
    fireEvent.click(botaoEnviar());
    expect(onEnviar).toHaveBeenLastCalledWith(expect.objectContaining({ psr: 0 }));
  });

  it('ao corrigir, abre preenchido com as respostas da semana (urina e treino inclusos) e já pode enviar', () => {
    const inicial: ValoresCheckin = { fadiga: 2, sono: 3, dor_muscular: 4, estresse: 5, humor: 1, urina: 3, psr: 8 };
    const { onEnviar } = montar({ inicial });
    expect(screen.getByRole('radio', { name: `2 ${ROTULOS_ITEM.fadiga.niveis[2]}` })).toBeChecked();
    expect(screen.getByRole('radio', { name: `1 ${ROTULOS_ITEM.humor.niveis[1]}` })).toBeChecked();
    expect(screen.getByRole('radio', { name: '3 Amarelo claro' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Sim' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '8: Muito bem recuperado(a)' })).toBeChecked();
    expect(botaoEnviar()).toBeEnabled();
    fireEvent.click(botaoEnviar());
    expect(onEnviar).toHaveBeenCalledWith(inicial);
  });

  it('enquanto envia, o botão fica desabilitado; o erro aparece com role alert; "Cancelar" só existe quando há onCancelar', () => {
    const onCancelar = vi.fn();
    const { rerender } = render(<CheckinSemanalForm inicial={linha(SEMANA)} enviando erro="Deu ruim" onEnviar={vi.fn()} onCancelar={onCancelar} />);
    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Deu ruim');
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancelar).not.toHaveBeenCalled();

    rerender(<CheckinSemanalForm inicial={linha(SEMANA)} onEnviar={vi.fn()} onCancelar={onCancelar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancelar).toHaveBeenCalledTimes(1);

    rerender(<CheckinSemanalForm onEnviar={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
  });
});

describe('CheckinEvolucaoCliente', () => {
  it('com menos de 2 respostas mostra um estado vazio amigável, sem gráfico', () => {
    const { rerender } = render(<CheckinEvolucaoCliente linhas={[]} />);
    expect(screen.getByText(/Depois do seu primeiro check-in/)).toBeInTheDocument();
    expect(screen.queryByTestId('grafico')).toBeNull();

    rerender(<CheckinEvolucaoCliente linhas={[linha(SEMANA)]} />);
    expect(screen.getByText(/Falta só mais um check-in/)).toBeInTheDocument();
    expect(screen.queryByTestId('grafico')).toBeNull();
  });

  it('compara a última resposta com a anterior em linguagem simples: melhorou, igual, piorou', () => {
    render(
      <CheckinEvolucaoCliente
        linhas={[
          linha('2026-10-26', { fadiga: 3, sono: 4, dor_muscular: 4, estresse: 2, humor: 5 }),
          linha(SEMANA, { fadiga: 4, sono: 4, dor_muscular: 3, estresse: 2, humor: 3 }),
        ]}
      />,
    );
    const linhaDe = (rotulo: string) => within(screen.getByText(`${rotulo}:`).closest('li')!);
    expect(linhaDe('Fadiga').getByText('melhorou 1 ponto')).toBeInTheDocument();
    expect(linhaDe('Sono').getByText('igual')).toBeInTheDocument();
    expect(linhaDe('Dor muscular').getByText('piorou 1 ponto')).toBeInTheDocument();
    expect(linhaDe('Estresse').getByText('igual')).toBeInTheDocument();
    expect(linhaDe('Humor').getByText('piorou 2 pontos')).toBeInTheDocument();
    expect(screen.getByText('Desde a sua resposta de 26/10')).toBeInTheDocument();
  });

  it('ordena por semana mesmo que cheguem fora de ordem, e o gráfico leva só as últimas 12 semanas com as 5 linhas', () => {
    const semanas = semanasAte(SEMANA, 15);
    const linhas = semanas.map((s, i) => linha(s, { sono: ((i % 5) + 1) as number }));
    render(<CheckinEvolucaoCliente linhas={[...linhas].reverse()} />);
    expect(screen.getByTestId('grafico')).toHaveAttribute('data-pontos', '12');
    expect(screen.getAllByTestId('linha').map((l) => l.getAttribute('data-chave'))).toEqual([...ITENS_CHECKIN]);
    // a última (SEMANA) tem sono 5 e a anterior sono 4: melhorou 1 ponto
    expect(screen.getByText('Sono:').closest('li')!.textContent).toContain('melhorou 1 ponto');
    expect(screen.getByText(`Desde a sua resposta de ${semanas[13].slice(8)}/${semanas[13].slice(5, 7)}`)).toBeInTheDocument();
  });

  it('o gráfico tem descrição em texto para leitor de tela e nenhuma palavra de alerta', () => {
    const { container } = render(
      <CheckinEvolucaoCliente linhas={[linha('2026-10-26', { fadiga: 5 }), linha(SEMANA, { fadiga: 1, humor: 1 })]} />,
    );
    expect(screen.getByRole('img', { name: /Gráfico com as suas últimas 2 respostas/ })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/alert/i);
  });
});

describe('PacienteCheckin: MyID primeiro, mas sem travar o check-in', () => {
  it('com o MyID pendente: cartão fixo "Seu primeiro passo é o MyID" leva ao MyID, e o formulário continua disponível', async () => {
    await abrirFormulario();
    const cartao = screen.getByRole('region', { name: 'Seu primeiro passo é o MyID' });
    fireEvent.click(within(cartao).getByRole('button', { name: 'Começar meu MyID' }));
    expect(h.navigate).toHaveBeenCalledWith('/paciente/questionarios');

    responderTudo();
    expect(botaoEnviar()).toBeEnabled();
  });

  it('depois de enviar, o cartão do MyID continua no topo e a confirmação repete o pedido', async () => {
    await abrirFormulario();
    responderTudo();
    fireEvent.click(botaoEnviar());

    expect(await screen.findByText('Check-in registrado')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Seu primeiro passo é o MyID' })).toBeInTheDocument();
    expect(screen.getByText('Falta o seu MyID, que é o primeiro passo.')).toBeInTheDocument();
    const botoes = screen.getAllByRole('button', { name: 'Começar meu MyID' });
    expect(botoes).toHaveLength(2);
    fireEvent.click(botoes[1]);
    expect(h.navigate).toHaveBeenCalledWith('/paciente/questionarios');
  });

  it('com o MyID concluído, o cartão e o pedido da confirmação somem', async () => {
    h.myidConcluidos = 1;
    await abrirFormulario();
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Seu primeiro passo é o MyID' })).toBeNull());
    responderTudo();
    fireEvent.click(botaoEnviar());
    expect(await screen.findByText('Check-in registrado')).toBeInTheDocument();
    expect(screen.queryByText(/MyID/)).toBeNull();
  });

  it('MyID só no cadastro migrado (avaliacoes_identidade) também conta como concluído', async () => {
    h.myidMigrados = 1;
    await abrirFormulario();
    await waitFor(() => expect(h.consultas.some((c) => c.tabela === 'avaliacoes_identidade')).toBe(true));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Seu primeiro passo é o MyID' })).toBeNull());
  });

  it('se não der para saber se o MyID foi concluído (erro de rede), o pedido do MyID continua aparecendo', async () => {
    h.myidErro = true;
    await abrirFormulario();
    expect(await screen.findByRole('region', { name: 'Seu primeiro passo é o MyID' })).toBeInTheDocument();
  });
});

describe('PacienteCheckin: envio', () => {
  it('chama registrar_checkin_semanal com os 7 parâmetros (urina e recuperação preenchidas)', async () => {
    await abrirFormulario();
    responderTudo();
    fireEvent.click(within(screen.getByRole('radiogroup', { name: 'Cor da urina (opcional)' })).getByRole('radio', { name: '6 Âmbar' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Sim' }));
    fireEvent.click(screen.getByRole('radio', { name: '7: Bem recuperado(a)' }));
    fireEvent.click(botaoEnviar());

    await screen.findByText('Check-in registrado');
    expect(h.rpc).toHaveBeenCalledTimes(1);
    expect(h.rpc).toHaveBeenCalledWith('registrar_checkin_semanal', {
      p_fadiga: 4, p_sono: 3, p_dor_muscular: 5, p_estresse: 2, p_humor: 4, p_urina: 6, p_psr: 7,
    });
  });

  it('opcionais vazios vão como null (e não como undefined nem 0)', async () => {
    await abrirFormulario();
    responderTudo();
    fireEvent.click(botaoEnviar());
    await screen.findByText('Check-in registrado');
    const [, args] = h.rpc.mock.calls[0];
    expect(args.p_urina).toBeNull();
    expect(args.p_psr).toBeNull();
    expect(Object.keys(args).sort()).toEqual(['p_dor_muscular', 'p_estresse', 'p_fadiga', 'p_humor', 'p_psr', 'p_sono', 'p_urina']);
  });

  it('se a releitura da série falhar DEPOIS de enviar, a confirmação e o pedido do MyID continuam na tela (nada de tela de erro)', async () => {
    await abrirFormulario();
    responderTudo();
    h.serieErro = { message: 'Failed to fetch' };
    fireEvent.click(botaoEnviar());

    expect(await screen.findByText('Check-in registrado')).toBeInTheDocument();
    await waitFor(() => expect(h.consultas.filter((q) => q.tabela === 'checkins_semanais').length).toBeGreaterThan(1));
    expect(screen.queryByText(/Não consegui carregar o seu check-in/)).toBeNull();
    expect(screen.getByText('Falta o seu MyID, que é o primeiro passo.')).toBeInTheDocument();
  });
  it('depois de enviar, o foco vai para o título da confirmação (o formulário some e o foco não se perde)', async () => {
    await abrirFormulario();
    responderTudo();
    fireEvent.click(botaoEnviar());
    const titulo = await screen.findByRole('heading', { name: 'Check-in registrado' });
    await waitFor(() => expect(titulo).toHaveFocus());
  });

  it('a confirmação mostra o que foi enviado e a evolução; com 1 resposta, o estado vazio amigável', async () => {
    await abrirFormulario();
    responderTudo();
    fireEvent.click(botaoEnviar());
    await screen.findByText('Check-in registrado');
    expect(screen.getByText(`5 · ${ROTULOS_ITEM.dor_muscular.niveis[5]}`)).toBeInTheDocument();
    expect(screen.getByText(/Falta só mais um check-in/)).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Check-in da semana' })).toBeNull();
  });

  it('depois de enviar com respostas anteriores, mostra a evolução e as variações', async () => {
    h.myidConcluidos = 1;
    h.serie = [linha(SEMANA_ANTERIOR, { fadiga: 2, sono: 3, dor_muscular: 5, estresse: 2, humor: 4 })];
    await abrirFormulario();
    responderTudo();
    fireEvent.click(botaoEnviar());
    await screen.findByText('Check-in registrado');
    await screen.findByText('Desde a sua resposta de 26/10');
    expect(screen.getByText('Fadiga:').closest('li')!.textContent).toContain('melhorou 2 pontos');
    expect(screen.getByText('Sono:').closest('li')!.textContent).toContain('igual');
  });

  it('erro ao enviar: mensagem amigável, o formulário continua com as respostas e nada de "registrado"', async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'checkin_valor_invalido' } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await abrirFormulario();
    responderTudo();
    fireEvent.click(botaoEnviar());
    expect(await screen.findByRole('alert')).toHaveTextContent('Alguma resposta ficou fora do esperado');
    expect(screen.queryByText('Check-in registrado')).toBeNull();
    expect(screen.getByRole('radio', { name: `4 ${ROTULOS_ITEM.fadiga.niveis[4]}` })).toBeChecked();
    expect(botaoEnviar()).toBeEnabled();
  });
});

describe('PacienteCheckin: já respondeu nesta semana', () => {
  beforeEach(() => {
    h.serie = [linha(SEMANA, { fadiga: 4, sono: 4, dor_muscular: 4, estresse: 4, humor: 4, urina: 3, psr: 6 })];
  });

  it('mostra "Você já respondeu esta semana" com os valores e sem o formulário', async () => {
    renderizar();
    expect(await screen.findByText('Você já respondeu esta semana')).toBeInTheDocument();
    expect(screen.getByText(`4 · ${ROTULOS_ITEM.fadiga.niveis[4]}`)).toBeInTheDocument();
    expect(screen.getByText('3 · Amarelo claro')).toBeInTheDocument();
    expect(screen.getByText('6 · Bem recuperado(a)')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Check-in da semana' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Corrigir minhas respostas' })).toBeInTheDocument();
  });

  it('"Corrigir minhas respostas" reabre o formulário preenchido; reenviar manda os valores corrigidos', async () => {
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Corrigir minhas respostas' }));
    expect(await screen.findByRole('form', { name: 'Check-in da semana' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: `4 ${ROTULOS_ITEM.fadiga.niveis[4]}` })).toBeChecked();
    expect(screen.getByRole('radio', { name: '3 Amarelo claro' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '6: Bem recuperado(a)' })).toBeChecked();

    responder('fadiga', 2);
    fireEvent.click(botaoEnviar());
    await screen.findByText('Check-in registrado');
    expect(h.rpc).toHaveBeenCalledWith('registrar_checkin_semanal', {
      p_fadiga: 2, p_sono: 4, p_dor_muscular: 4, p_estresse: 4, p_humor: 4, p_urina: 3, p_psr: 6,
    });
  });

  it('"Cancelar" volta ao resumo sem enviar nada', async () => {
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Corrigir minhas respostas' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(await screen.findByText('Você já respondeu esta semana')).toBeInTheDocument();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('depois de enviar uma correção, dá para corrigir de novo a partir da confirmação', async () => {
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Corrigir minhas respostas' }));
    responder('humor', 1);
    fireEvent.click(botaoEnviar());
    await screen.findByText('Check-in registrado');
    fireEvent.click(screen.getByRole('button', { name: 'Corrigir minhas respostas' }));
    expect(await screen.findByRole('radio', { name: `1 ${ROTULOS_ITEM.humor.niveis[1]}` })).toBeChecked();
  });
});

describe('PacienteCheckin: semana de Brasília', () => {
  it('a resposta da semana passada não conta como "já respondeu": o formulário aparece', async () => {
    h.serie = [linha(SEMANA_ANTERIOR)];
    await abrirFormulario();
    expect(screen.queryByText('Você já respondeu esta semana')).toBeNull();
  });

  it('domingo 23h30 em Brasília (segunda 02h30 em UTC) ainda é a mesma semana', async () => {
    vi.setSystemTime(new Date('2026-11-09T02:30:00Z'));
    h.serie = [linha(SEMANA)];
    renderizar();
    expect(await screen.findByText('Você já respondeu esta semana')).toBeInTheDocument();
  });

  it('segunda 00h30 em Brasília começa outra semana', async () => {
    vi.setSystemTime(new Date('2026-11-09T03:30:00Z'));
    h.serie = [linha(SEMANA)];
    await abrirFormulario();
    expect(screen.queryByText('Você já respondeu esta semana')).toBeNull();
    expect(screen.getByText(/semana de 09\/11 a 15\/11/)).toBeInTheDocument();
  });
});

describe('PacienteCheckin: nada alarmista para o cliente', () => {
  it('mesmo com queda nas respostas e alertas devolvidos pelo servidor, a tela não tem a palavra alerta', async () => {
    const antigas = semanasAte(SEMANA_ANTERIOR, 6);
    h.serie = antigas.map((s, i) => linha(s, i < 4 ? {} : { fadiga: 2, sono: 2, dor_muscular: 2, estresse: 2, humor: 2 }));
    const { container } = await abrirFormulario();
    expect(container.textContent).not.toMatch(/alert/i);

    ITENS_CHECKIN.forEach((item) => responder(item, 1));
    fireEvent.click(botaoEnviar());
    await screen.findByText('Check-in registrado');
    await screen.findByText('Desde a sua resposta de 26/10');
    expect(h.rpc.mock.results[0].type).toBe('return');
    expect(container.textContent).not.toMatch(/alert/i);
    expect(container.textContent).toMatch(/piorou/);
  });

  it('traz o aviso discreto de que o check-in não é para urgências', async () => {
    await abrirFormulario();
    expect(screen.getByText(/Este check-in não é para urgências\./)).toBeInTheDocument();
  });
});

describe('PacienteCheckin: falha suave quando a migração ainda não está no banco', () => {
  it.each([
    ['tabela inexistente (42P01)', { code: '42P01', message: 'relation "public.checkins_semanais" does not exist' }],
    ['tabela inexistente (42P01) com mensagem em português', { code: '42P01', message: 'a relação "public.checkins_semanais" não existe' }],
    ['tabela fora do cache (PGRST205)', { code: 'PGRST205', message: 'Could not find the table' }],
    ['função fora do cache (PGRST202)', { code: 'PGRST202', message: 'Could not find the function' }],
    ['mensagem "does not exist" sem código', { message: 'relation does not exist' }],
    ['mensagem "schema cache" sem código', { message: 'Could not find it in the schema cache' }],
  ])('%s: aviso neutro, sem formulário e sem quebrar a tela', async (_nome, erro) => {
    h.serieErro = erro;
    renderizar();
    expect(await screen.findByText('O check-in ainda não está disponível')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Check-in da semana', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Check-in da semana' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.getByText(/Este check-in não é para urgências/)).toBeInTheDocument();
  });

  it('o pedido do MyID continua aparecendo mesmo com o check-in indisponível', async () => {
    h.serieErro = { code: '42P01', message: 'does not exist' };
    renderizar();
    await screen.findByText('O check-in ainda não está disponível');
    expect(screen.getByRole('region', { name: 'Seu primeiro passo é o MyID' })).toBeInTheDocument();
  });

  it('um erro qualquer (rede, permissão) NÃO é "indisponível": mostra o erro com "Tentar novamente"', async () => {
    h.serieErro = { code: '500', message: 'boom' };
    renderizar();
    expect(await screen.findByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    expect(screen.queryByText('O check-in ainda não está disponível')).toBeNull();
  });

  it('a tabela de preferências ausente só esconde a chave do WhatsApp; o formulário segue', async () => {
    h.preferenciaErro = { code: '42P01', message: 'does not exist' };
    await abrirFormulario();
    await waitFor(() => expect(h.consultas.some((c) => c.tabela === 'checkin_preferencias')).toBe(true));
    expect(screen.queryByRole('switch')).toBeNull();
  });
});

describe('PacienteCheckin: lembrete pelo WhatsApp', () => {
  it('sem linha de preferência, nasce ligado e mostra o texto de ajuda', async () => {
    await abrirFormulario();
    const chave = await screen.findByRole('switch', { name: 'Lembrete pelo WhatsApp' });
    expect(chave).toBeChecked();
    expect(screen.getByText('Se o seu profissional usa o WhatsApp para isso, escolha aqui se quer receber o lembrete')).toBeInTheDocument();
  });

  it('desligar chama definir_checkin_whatsapp com p_ativo false e a chave fica desligada', async () => {
    await abrirFormulario();
    fireEvent.click(await screen.findByRole('switch', { name: 'Lembrete pelo WhatsApp' }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('definir_checkin_whatsapp', { p_ativo: false }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Lembrete pelo WhatsApp' })).not.toBeChecked());
  });

  it('com a preferência salva como desligada, nasce desligado; ligar manda p_ativo true', async () => {
    h.preferencia = { whatsapp_ativo: false };
    await abrirFormulario();
    const chave = await screen.findByRole('switch', { name: 'Lembrete pelo WhatsApp' });
    await waitFor(() => expect(chave).not.toBeChecked());
    fireEvent.click(chave);
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('definir_checkin_whatsapp', { p_ativo: true }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Lembrete pelo WhatsApp' })).toBeChecked());
  });

  it('se não conseguir salvar, avisa e a chave volta ao que estava', async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'falhou' } });
    await abrirFormulario();
    fireEvent.click(await screen.findByRole('switch', { name: 'Lembrete pelo WhatsApp' }));
    expect(await screen.findByText('Não consegui salvar a sua escolha. Tente de novo.')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Lembrete pelo WhatsApp' })).toBeChecked();
  });
});

describe('PacienteCheckin: consulta e vínculo', () => {
  it('lê só as últimas 26 semanas do próprio paciente, da mais nova para a mais antiga, e exibe em ordem crescente', async () => {
    h.serie = semanasAte(SEMANA_ANTERIOR, 30).map((s) => linha(s));
    await abrirFormulario();
    const consulta = h.consultas.find((c) => c.tabela === 'checkins_semanais')!;
    expect(consulta.filtros).toContainEqual(['paciente_id', 'pac-1']);
    expect(consulta.ordem).toEqual(['semana', { ascending: false }]);
    expect(consulta.limite).toBe(26);
    expect(screen.getByTestId('grafico')).toHaveAttribute('data-pontos', '12');
  });

  it('sem registro de paciente, convida a se conectar a um profissional em vez de mostrar o formulário', async () => {
    h.paciente = null;
    renderizar();
    expect(await screen.findByText('Conecte-se a um profissional')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Check-in da semana' })).toBeNull();
  });
});

// Segunda-feira, 09/11/2026 (12h em Brasília): a semana atual começa hoje. O pedido de domingo (08/11, à noite) é da
// semana de 02/11, e o servidor grava a resposta de segunda nela.
const SEGUNDA = '2026-11-09T15:00:00Z';
const SEMANA_NOVA = '2026-11-09';
const SEGUNDA_MEIA_NOITE_BR = '2026-11-09T03:00:00Z';
const DOMINGO_ANTES_DA_MEIA_NOITE_BR = '2026-11-09T02:59:59Z';

describe('respostaContaNestaSemana', () => {
  const agora = new Date(SEGUNDA);

  it('a linha da semana atual conta, com ou sem horário de gravação', () => {
    expect(respostaContaNestaSemana({ semana: SEMANA_NOVA }, agora)).toBe(true);
    expect(respostaContaNestaSemana({ semana: SEMANA_NOVA, updated_at: null }, agora)).toBe(true);
    expect(respostaContaNestaSemana({ semana: SEMANA_NOVA, updated_at: '2026-11-01T10:00:00Z' }, agora)).toBe(true);
  });

  it('a linha da semana anterior só conta se foi gravada a partir da meia-noite de segunda (Brasília), inclusive', () => {
    expect(respostaContaNestaSemana({ semana: SEMANA, updated_at: SEGUNDA_MEIA_NOITE_BR }, agora)).toBe(true);
    expect(respostaContaNestaSemana({ semana: SEMANA, updated_at: '2026-11-09T03:00:01Z' }, agora)).toBe(true);
    expect(respostaContaNestaSemana({ semana: SEMANA, updated_at: DOMINGO_ANTES_DA_MEIA_NOITE_BR }, agora)).toBe(false);
    expect(respostaContaNestaSemana({ semana: SEMANA, updated_at: '2026-11-08T23:00:00Z' }, agora)).toBe(false);
  });

  it('entende o formato do Postgres (microssegundos e deslocamento) e o fuso de Brasília', () => {
    expect(respostaContaNestaSemana({ semana: SEMANA, updated_at: '2026-11-09T13:10:00.123456+00:00' }, agora)).toBe(true);
    expect(respostaContaNestaSemana({ semana: SEMANA, updated_at: '2026-11-09T00:00:00-03:00' }, agora)).toBe(true);
    expect(respostaContaNestaSemana({ semana: SEMANA, updated_at: '2026-11-08T23:59:59-03:00' }, agora)).toBe(false);
  });

  it('sem horário de gravação, ou com horário inválido, a semana anterior não conta', () => {
    expect(respostaContaNestaSemana({ semana: SEMANA }, agora)).toBe(false);
    expect(respostaContaNestaSemana({ semana: SEMANA, updated_at: null }, agora)).toBe(false);
    expect(respostaContaNestaSemana({ semana: SEMANA, updated_at: '' }, agora)).toBe(false);
    expect(respostaContaNestaSemana({ semana: SEMANA, updated_at: 'ontem' }, agora)).toBe(false);
  });

  it('usa a data de hoje quando não recebe uma', () => {
    vi.setSystemTime(new Date(SEGUNDA));
    expect(respostaContaNestaSemana({ semana: SEMANA_NOVA })).toBe(true);
    expect(respostaContaNestaSemana({ semana: SEMANA, updated_at: '2026-11-09T13:10:00Z' })).toBe(true);
    expect(respostaContaNestaSemana({ semana: SEMANA })).toBe(false);
  });

  it('virada de semana: quarta ainda é a semana de 02/11; segunda 00h30 em Brasília já é a de 09/11', () => {
    const quarta = new Date('2026-11-04T15:00:00Z');
    expect(respostaContaNestaSemana({ semana: SEMANA, updated_at: '2026-11-04T12:00:00Z' }, quarta)).toBe(true);
    const segundaMadrugada = new Date('2026-11-09T03:30:00Z');
    expect(respostaContaNestaSemana({ semana: SEMANA, updated_at: '2026-11-04T12:00:00Z' }, segundaMadrugada)).toBe(false);
    expect(respostaContaNestaSemana({ semana: SEMANA, updated_at: '2026-11-09T03:10:00Z' }, segundaMadrugada)).toBe(true);
  });
});

describe('PacienteCheckin: pedido de domingo respondido na segunda (o servidor grava na semana anterior)', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(SEGUNDA));
    h.servidor.semana = SEMANA;
  });

  it('ao recarregar, a resposta de segunda gravada na semana anterior conta: mostra "já respondeu" e não pede de novo', async () => {
    h.serie = [linha(SEMANA, { fadiga: 2, updated_at: '2026-11-09T13:10:00+00:00' })];
    renderizar();
    expect(await screen.findByText('Você já respondeu esta semana')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Check-in da semana' })).toBeNull();
    expect(screen.getByText(/semana de 09\/11 a 15\/11/)).toBeInTheDocument();
    expect(screen.getByText(`2 · ${ROTULOS_ITEM.fadiga.niveis[2]}`)).toBeInTheDocument();
  });

  it('fluxo completo: responde pelo portal na segunda, o servidor grava na semana anterior, e depois de recarregar não pergunta de novo', async () => {
    const primeira = await abrirFormulario();
    responderTudo();
    fireEvent.click(botaoEnviar());
    await screen.findByText('Check-in registrado');
    expect(h.serie).toHaveLength(1);
    expect(h.serie[0].semana).toBe(SEMANA);
    primeira.unmount();

    renderizar();
    expect(await screen.findByText('Você já respondeu esta semana')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Check-in da semana' })).toBeNull();
  });

  it('"Corrigir minhas respostas" corrige a linha que conta (a da semana anterior): abre preenchido com ela e reenvia', async () => {
    h.serie = [linha(SEMANA, { fadiga: 2, sono: 3, dor_muscular: 5, estresse: 1, humor: 4, urina: 3, updated_at: '2026-11-09T13:10:00Z' })];
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: 'Corrigir minhas respostas' }));
    expect(await screen.findByRole('radio', { name: `2 ${ROTULOS_ITEM.fadiga.niveis[2]}` })).toBeChecked();
    expect(screen.getByRole('radio', { name: `1 ${ROTULOS_ITEM.estresse.niveis[1]}` })).toBeChecked();
    expect(screen.getByRole('radio', { name: '3 Amarelo claro' })).toBeChecked();

    responder('humor', 5);
    fireEvent.click(botaoEnviar());
    await screen.findByText('Check-in registrado');
    expect(h.rpc).toHaveBeenCalledWith('registrar_checkin_semanal', {
      p_fadiga: 2, p_sono: 3, p_dor_muscular: 5, p_estresse: 1, p_humor: 5, p_urina: 3, p_psr: null,
    });
    expect(h.serie).toHaveLength(1);
    expect(h.serie[0]).toMatchObject({ semana: SEMANA, humor: 5 });
  });

  it('resposta da semana anterior feita um segundo ANTES de segunda 00h (Brasília) não conta: o formulário aparece', async () => {
    h.serie = [linha(SEMANA, { updated_at: DOMINGO_ANTES_DA_MEIA_NOITE_BR })];
    await abrirFormulario();
    expect(screen.queryByText('Você já respondeu esta semana')).toBeNull();
  });

  it('feita exatamente à meia-noite de segunda (Brasília) já conta', async () => {
    h.serie = [linha(SEMANA, { updated_at: SEGUNDA_MEIA_NOITE_BR })];
    renderizar();
    expect(await screen.findByText('Você já respondeu esta semana')).toBeInTheDocument();
  });

  it('sem horário de gravação, a semana anterior não conta', async () => {
    h.serie = [linha(SEMANA)];
    await abrirFormulario();
    expect(screen.queryByText('Você já respondeu esta semana')).toBeNull();
  });

  it('com a linha da semana atual e a da anterior gravada hoje, vale a da semana atual', async () => {
    h.serie = [
      linha(SEMANA, { fadiga: 1, updated_at: '2026-11-09T13:10:00Z' }),
      linha(SEMANA_NOVA, { fadiga: 5, updated_at: '2026-11-09T14:00:00Z' }),
    ];
    renderizar();
    expect(await screen.findByText('Você já respondeu esta semana')).toBeInTheDocument();
    expect(screen.getByText(`5 · ${ROTULOS_ITEM.fadiga.niveis[5]}`)).toBeInTheDocument();
    expect(screen.queryByText(`1 · ${ROTULOS_ITEM.fadiga.niveis[1]}`)).toBeNull();
  });

  it('virada de semana: a resposta de quarta (semana de 02/11) deixa de contar na segunda 00h30 (Brasília)', async () => {
    vi.setSystemTime(new Date('2026-11-09T03:30:00Z'));
    h.serie = [linha(SEMANA, { updated_at: '2026-11-04T15:00:00Z' })];
    await abrirFormulario();
    expect(screen.queryByText('Você já respondeu esta semana')).toBeNull();
  });

  it('virada de semana: gravada em segunda 00h10 (Brasília) na semana anterior, conta às 00h30', async () => {
    vi.setSystemTime(new Date('2026-11-09T03:30:00Z'));
    h.serie = [linha(SEMANA, { updated_at: '2026-11-09T03:10:00Z' })];
    renderizar();
    expect(await screen.findByText('Você já respondeu esta semana')).toBeInTheDocument();
  });
});

describe('useCheckinSemanal: semana devolvida pela função ao registrar', () => {
  const valores: ValoresCheckin = { fadiga: 4, sono: 3, dor_muscular: 5, estresse: 2, humor: 4, urina: null, psr: null };

  function montarHook() {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const hook = renderHook(() => useCheckinSemanal(), { wrapper });
    return { qc, ...hook };
  }

  beforeEach(() => {
    vi.setSystemTime(new Date(SEGUNDA));
    h.servidor.semana = SEMANA;
  });

  it('a resposta já conta no cache assim que a função responde, antes de a lista ser recarregada (semana anterior incluída)', async () => {
    const { qc, result } = montarHook();
    await waitFor(() => expect(result.current.serie.disponivel).toBe(true));
    expect(result.current.serie.respondeuEstaSemana).toBe(false);

    h.segurarSerie = new Promise<void>(() => {});
    act(() => { result.current.registrar.mutate(valores); });
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('registrar_checkin_semanal', expect.anything()));
    await waitFor(() => expect(result.current.serie.respondeuEstaSemana).toBe(true));

    expect(result.current.serie.linhaDaSemana).toMatchObject({ semana: SEMANA, fadiga: 4, sono: 3, dor_muscular: 5, estresse: 2, humor: 4 });
    const cache = qc.getQueryData<{ linhas: { semana: string; updated_at: string }[] }>(['checkin-semanal', 'serie', 'pac-1']);
    expect(cache!.linhas).toHaveLength(1);
    expect(Date.parse(cache!.linhas[0].updated_at)).toBe(Date.parse(SEGUNDA));
  });

  it('a linha da mesma semana é trocada, não duplicada, e a lista continua em ordem crescente', async () => {
    h.serie = [linha('2026-10-26'), linha(SEMANA, { fadiga: 1, updated_at: '2026-11-04T12:00:00Z' })];
    const { qc, result } = montarHook();
    await waitFor(() => expect(result.current.serie.linhas).toHaveLength(2));

    h.segurarSerie = new Promise<void>(() => {});
    act(() => { result.current.registrar.mutate(valores); });
    await waitFor(() => expect(result.current.serie.linhaDaSemana?.fadiga).toBe(4));

    const semanas = qc.getQueryData<{ linhas: { semana: string }[] }>(['checkin-semanal', 'serie', 'pac-1'])!.linhas.map((l) => l.semana);
    expect(semanas).toEqual(['2026-10-26', SEMANA]);
  });

  it('se a função não devolver a semana, o cache não é alterado: só recarrega a lista', async () => {
    h.servidor.devolveSemana = false;
    const { result } = montarHook();
    await waitFor(() => expect(result.current.serie.disponivel).toBe(true));

    h.segurarSerie = new Promise<void>(() => {});
    act(() => { result.current.registrar.mutate(valores); });
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('registrar_checkin_semanal', expect.anything()));
    await act(async () => { await new Promise((r) => setTimeout(r, 40)); });
    expect(result.current.serie.respondeuEstaSemana).toBe(false);
    expect(result.current.serie.linhas).toHaveLength(0);
  });

  it('semana devolvida em formato de data com hora também é lida (só AAAA-MM-DD)', async () => {
    h.rpc.mockResolvedValueOnce({ data: { semana: `${SEMANA}T00:00:00+00:00` }, error: null });
    const { result } = montarHook();
    await waitFor(() => expect(result.current.serie.disponivel).toBe(true));

    h.segurarSerie = new Promise<void>(() => {});
    act(() => { result.current.registrar.mutate(valores); });
    await waitFor(() => expect(result.current.serie.linhaDaSemana?.semana).toBe(SEMANA));
  });
});
