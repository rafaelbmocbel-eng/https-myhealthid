import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type Linha = Record<string, unknown>;

const h = vi.hoisted(() => ({
  config: { nutricao_premium_ativa: false, prazo_chancela_dias_uteis: 2 } as Record<string, unknown>,
  profissionais: [] as Record<string, unknown>[],
  erros: {} as Record<string, string>,
  rpc: vi.fn(),
  toastErro: vi.fn(),
  toastOk: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'adm-1', email: 'rafaelbmocbel@gmail.com' } }) }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: (...a: unknown[]) => h.toastErro(...a), success: (...a: unknown[]) => h.toastOk(...a) }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...a: unknown[]) => h.rpc(...a), functions: { invoke: vi.fn() } },
}));

import AdministracaoChancela from '@/components/chancela/AdministracaoChancela';

function pessoa(extra: Linha = {}): Linha {
  return {
    user_id: 'u-ana', nome: 'Ana', sobrenome: 'Souza', email: 'ana@exemplo.com', perfil_profissional: 'nutricionista',
    registro_profissional: 'CRN 12345', verificado: false, verificado_em: null, equipe_cientifica: false, equipe_areas: [],
    created_at: '2026-09-01T00:00:00Z',
    ...extra,
  };
}

function renderizar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AdministracaoChancela />
    </QueryClientProvider>,
  );
}

const chamadas = (nome: string) => h.rpc.mock.calls.filter(([n]) => n === nome);

beforeEach(() => {
  h.config = { nutricao_premium_ativa: false, prazo_chancela_dias_uteis: 2 };
  h.profissionais = [];
  h.erros = {};
  h.toastErro.mockReset();
  h.toastOk.mockReset();
  h.rpc.mockReset();
  h.rpc.mockImplementation(async (nome: string, args: Linha = {}) => {
    if (h.erros[nome]) return { data: null, error: { message: h.erros[nome] } };
    if (nome === 'plano_cliente_config') return { data: h.config, error: null };
    if (nome === 'profissionais_admin') return { data: h.profissionais, error: null };
    if (nome === 'definir_config_plano_cliente') {
      h.config = { ...h.config, [args.p_chave as string]: args.p_valor };
      return { data: null, error: null };
    }
    if (nome === 'verificar_profissional') {
      h.profissionais = h.profissionais.map((p) => (p.user_id === args.p_user_id
        ? { ...p, verificado: args.p_verificado, verificado_em: args.p_verificado ? '2026-10-08T12:00:00Z' : null } : p));
      return { data: null, error: null };
    }
    if (nome === 'definir_equipe_cientifica') {
      h.profissionais = h.profissionais.map((p) => (p.email === args.p_email
        ? { ...p, equipe_cientifica: args.p_ativo, equipe_areas: args.p_areas } : p));
      return { data: null, error: null };
    }
    return { data: null, error: null };
  });
});
afterEach(() => cleanup());

describe('Administração: verificação dos profissionais', () => {
  it('lista quem aguarda verificação primeiro, com o registro informado, e filtra por padrão nos pendentes', async () => {
    h.profissionais = [
      pessoa({ user_id: 'u-v', nome: 'Zeca', sobrenome: 'Verificado', email: 'zeca@exemplo.com', verificado: true, registro_profissional: 'CRN 1' }),
      pessoa(),
    ];
    renderizar();
    expect(await screen.findByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('CRN 12345')).toBeInTheDocument();
    expect(screen.getByText('Aguardando verificação', { selector: 'div' })).toBeInTheDocument();
    expect(screen.queryByText('Zeca Verificado')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Todos/ }));
    const itens = within(screen.getByRole('list', { name: 'Lista de profissionais' })).getAllByRole('listitem');
    expect(itens[0]).toHaveTextContent('Ana Souza');
    expect(itens[1]).toHaveTextContent('Zeca Verificado');
  });

  it('Verificar pede confirmação e chama verificar_profissional com a nota', async () => {
    h.profissionais = [pessoa()];
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /^Verificar$/ }));

    expect(await screen.findByText(/Confirme que você conferiu o registro CRN 12345/)).toBeInTheDocument();
    expect(chamadas('verificar_profissional')).toHaveLength(0);
    fireEvent.change(screen.getByLabelText(/Nota \(opcional\)/), { target: { value: '  conferido no site do CRN  ' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Verificar' }).at(-1) as HTMLElement);

    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('verificar_profissional', {
      p_user_id: 'u-ana', p_verificado: true, p_nota: 'conferido no site do CRN', p_registro_visto: 'CRN 12345',
    }));
    await waitFor(() => expect(h.toastOk).toHaveBeenCalledWith('Ana Souza foi verificado(a).'));
  });

  it('sem registro informado não dá para verificar', async () => {
    h.profissionais = [pessoa({ registro_profissional: null })];
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /^Todos/ }));
    expect(await screen.findByRole('button', { name: /^Verificar$/ })).toBeDisabled();
    expect(screen.getByText(/precisa informar o registro/)).toBeInTheDocument();
  });

  it('Remover verificação explica a consequência e chama a RPC com p_verificado false', async () => {
    h.profissionais = [pessoa({ verificado: true, verificado_em: '2026-10-01T12:00:00Z' })];
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /^Todos/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Remover verificação/ }));

    expect(await screen.findByText(/deixa de poder gerar planos por IA.*sai da equipe científica/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Remover verificação' }).at(-1) as HTMLElement);
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('verificar_profissional', {
      p_user_id: 'u-ana', p_verificado: false, p_nota: null,
    }));
  });

  it('erro do banco aparece como aviso em português', async () => {
    h.profissionais = [pessoa()];
    h.erros.verificar_profissional = 'Apenas o administrador MyHealthID';
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /^Verificar$/ }));
    fireEvent.click((await screen.findAllByRole('button', { name: 'Verificar' })).at(-1) as HTMLElement);

    await waitFor(() => expect(h.toastErro).toHaveBeenCalledWith('Apenas o administrador MyHealthID pode fazer esta alteração.'));
    expect(h.toastOk).not.toHaveBeenCalled();
  });

  it('a conta do administrador não tem botões de verificação nem de equipe', async () => {
    h.profissionais = [pessoa({ user_id: 'u-rafael', nome: 'Rafael', sobrenome: 'Mocbel', email: 'rafaelbmocbel@gmail.com', verificado: true, equipe_cientifica: true })];
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /^Todos/ }));
    expect(await screen.findByText(/Conta do administrador/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remover verificação/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: /Equipe científica/ })).not.toBeInTheDocument();
  });

  it('a busca filtra por nome, e-mail ou registro', async () => {
    h.profissionais = [pessoa(), pessoa({ user_id: 'u-b', nome: 'Bruno', sobrenome: 'Lima', email: 'bruno@exemplo.com', registro_profissional: 'CREF 777' })];
    renderizar();
    await screen.findByText('Ana Souza');
    fireEvent.change(screen.getByLabelText('Buscar profissional'), { target: { value: 'cref 777' } });
    expect(await screen.findByText('Bruno Lima')).toBeInTheDocument();
    expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument();
  });

  it('falha ao carregar a lista mostra o erro', async () => {
    h.erros.profissionais_admin = 'Apenas o administrador MyHealthID';
    renderizar();
    expect(await screen.findByText('Não consegui carregar os profissionais.')).toBeInTheDocument();
    expect(screen.getByText(/Apenas o administrador MyHealthID pode/)).toBeInTheDocument();
  });
});

describe('Administração: equipe científica e áreas', () => {
  it('quem não foi verificado não entra na equipe', async () => {
    h.profissionais = [pessoa()];
    renderizar();
    const chave = await screen.findByRole('switch', { name: /Equipe científica: Ana Souza/ });
    expect(chave).toBeDisabled();
    expect(screen.getByText(/Verifique o profissional antes de incluí-lo/)).toBeInTheDocument();
  });

  it('incluir na equipe manda as áreas que o perfil habilita (nutricionista = nutrição)', async () => {
    h.profissionais = [pessoa({ verificado: true })];
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /^Todos/ }));
    fireEvent.click(await screen.findByRole('switch', { name: /Equipe científica: Ana Souza/ }));

    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('definir_equipe_cientifica', {
      p_email: 'ana@exemplo.com', p_ativo: true, p_areas: ['nutricao'],
    }));
    expect(await screen.findByRole('checkbox', { name: /Nutrição: Ana Souza/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Treino: Ana Souza/ })).not.toBeChecked();
  });

  it('marcar e desmarcar áreas grava a lista inteira', async () => {
    h.profissionais = [pessoa({ perfil_profissional: 'fisioterapeuta', verificado: true, equipe_cientifica: true, equipe_areas: ['treino'] })];
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /^Todos/ }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /Nutrição: Ana Souza/ }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('definir_equipe_cientifica', {
      p_email: 'ana@exemplo.com', p_ativo: true, p_areas: ['treino', 'nutricao'],
    }));

    fireEvent.click(await screen.findByRole('checkbox', { name: /Treino: Ana Souza/ }));
    await waitFor(() => expect(h.rpc).toHaveBeenLastCalledWith('definir_equipe_cientifica', {
      p_email: 'ana@exemplo.com', p_ativo: true, p_areas: ['nutricao'],
    }));
  });

  it('avisa quando a área marcada não combina com o perfil, e quando não há área nenhuma', async () => {
    h.profissionais = [pessoa({ perfil_profissional: 'fisioterapeuta', verificado: true, equipe_cientifica: true, equipe_areas: ['nutricao'] })];
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /^Todos/ }));
    expect(await screen.findByText(/Nutrição exige Nutricionista, e o perfil desta pessoa não habilita/)).toBeInTheDocument();

    cleanup();
    h.profissionais = [pessoa({ verificado: true, equipe_cientifica: true, equipe_areas: [] })];
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /^Todos/ }));
    expect(await screen.findByText(/Sem nenhuma área marcada/)).toBeInTheDocument();
  });

  it('tirar da equipe limpa as áreas', async () => {
    h.profissionais = [pessoa({ verificado: true, equipe_cientifica: true, equipe_areas: ['nutricao'] })];
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /^Todos/ }));
    fireEvent.click(await screen.findByRole('switch', { name: /Equipe científica: Ana Souza/ }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('definir_equipe_cientifica', {
      p_email: 'ana@exemplo.com', p_ativo: false, p_areas: [],
    }));
  });

  it('o banco recusando (ex.: alvo sem verificação) mostra a mensagem dele', async () => {
    h.profissionais = [pessoa({ verificado: true })];
    h.erros.definir_equipe_cientifica = 'O profissional precisa estar verificado para integrar a equipe.';
    renderizar();
    fireEvent.click(await screen.findByRole('button', { name: /^Todos/ }));
    fireEvent.click(await screen.findByRole('switch', { name: /Equipe científica: Ana Souza/ }));
    await waitFor(() => expect(h.toastErro).toHaveBeenCalledWith('O profissional precisa estar verificado para integrar a equipe.'));
  });
});

describe('Administração: configuração do plano do cliente', () => {
  it('mostra o efeito do interruptor desligado (nutrição em breve) e o prazo atual', async () => {
    renderizar();
    const chave = await screen.findByRole('switch', { name: /Plano nutricional Premium/ });
    await waitFor(() => expect(chave).toBeEnabled());
    expect(chave).not.toBeChecked();
    expect(screen.getByText(/estará disponível em breve/)).toBeInTheDocument();
    expect(screen.getByText(/nem chancelado por você/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Prazo para a equipe chancelar/)).toHaveValue(2);
    expect(screen.getByText(/ATRASADO/)).toBeInTheDocument();
  });

  it('ligar a nutrição pede confirmação e só então grava', async () => {
    renderizar();
    const chave = await screen.findByRole('switch', { name: /Plano nutricional Premium/ });
    await waitFor(() => expect(chave).toBeEnabled());
    fireEvent.click(chave);

    expect(await screen.findByText('Ligar o plano nutricional Premium?')).toBeInTheDocument();
    expect(chamadas('definir_config_plano_cliente')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Ligar plano nutricional' }));

    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('definir_config_plano_cliente', { p_chave: 'nutricao_premium_ativa', p_valor: true }));
    await waitFor(() => expect(screen.getByRole('switch', { name: /Plano nutricional Premium/ })).toBeChecked());
    expect(await screen.findByText(/Ligado: clientes Premium podem gerar o plano alimentar/)).toBeInTheDocument();
  });

  it('cancelar a confirmação não grava nada', async () => {
    renderizar();
    const chave = await screen.findByRole('switch', { name: /Plano nutricional Premium/ });
    await waitFor(() => expect(chave).toBeEnabled());
    fireEvent.click(chave);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByText('Ligar o plano nutricional Premium?')).not.toBeInTheDocument());
    expect(chamadas('definir_config_plano_cliente')).toHaveLength(0);
  });

  it('desligar grava na hora, sem confirmação', async () => {
    h.config = { nutricao_premium_ativa: true, prazo_chancela_dias_uteis: 2 };
    renderizar();
    const chave = await screen.findByRole('switch', { name: /Plano nutricional Premium/ });
    await waitFor(() => expect(chave).toBeChecked());
    fireEvent.click(chave);
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('definir_config_plano_cliente', { p_chave: 'nutricao_premium_ativa', p_valor: false }));
  });

  it('avisa quando a nutrição está ligada e não há nutricionista verificado na equipe', async () => {
    h.config = { nutricao_premium_ativa: true, prazo_chancela_dias_uteis: 2 };
    h.profissionais = [pessoa({ verificado: true, equipe_cientifica: true, equipe_areas: ['treino'] })];
    renderizar();
    expect(await screen.findByText(/nenhum nutricionista verificado está na equipe/)).toBeInTheDocument();

    cleanup();
    h.profissionais = [pessoa({ verificado: true, equipe_cientifica: true, equipe_areas: ['nutricao'] })];
    renderizar();
    await screen.findByText(/Ligado: clientes Premium podem gerar/);
    await screen.findByText('Ana Souza');
    expect(screen.queryByText(/nenhum nutricionista verificado está na equipe/)).not.toBeInTheDocument();
  });

  it('prazo: só inteiros de 1 a 10; salva pela RPC com o número', async () => {
    renderizar();
    const campo = await screen.findByLabelText(/Prazo para a equipe chancelar/);
    await waitFor(() => expect(campo).toBeEnabled());
    const salvar = screen.getByRole('button', { name: 'Salvar prazo' });
    expect(salvar).toBeDisabled();

    fireEvent.change(campo, { target: { value: '11' } });
    expect(salvar).toBeDisabled();
    expect(screen.getByText(/Informe um número inteiro de 1 a 10 dias úteis/)).toBeInTheDocument();
    fireEvent.change(campo, { target: { value: '' } });
    expect(salvar).toBeDisabled();
    fireEvent.change(campo, { target: { value: '3' } });
    expect(salvar).toBeEnabled();
    fireEvent.click(salvar);

    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('definir_config_plano_cliente', { p_chave: 'prazo_chancela_dias_uteis', p_valor: 3 }));
    await waitFor(() => expect(h.toastOk).toHaveBeenCalledWith('Prazo de chancela: 3 dias úteis.'));
  });

  it('erro do banco ao gravar aparece na tela', async () => {
    h.erros.definir_config_plano_cliente = 'Apenas o administrador MyHealthID';
    renderizar();
    const campo = await screen.findByLabelText(/Prazo para a equipe chancelar/);
    await waitFor(() => expect(campo).toBeEnabled());
    fireEvent.change(campo, { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar prazo' }));
    expect(await screen.findByText('Apenas o administrador MyHealthID pode fazer esta alteração.')).toBeInTheDocument();
  });

  it('se não conseguiu ler a configuração, trava os controles para não gravar às cegas', async () => {
    h.erros.plano_cliente_config = 'Could not find the function public.plano_cliente_config in the schema cache';
    renderizar();
    expect(await screen.findByText(/Não consegui ler a configuração atual/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: /Plano nutricional Premium/ })).toBeDisabled();
    expect(screen.getByLabelText(/Prazo para a equipe chancelar/)).toBeDisabled();
  });
});
