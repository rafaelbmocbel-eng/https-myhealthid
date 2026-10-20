import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  rpc: vi.fn(),
  signOut: vi.fn(),
  navigate: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    auth: { signOut: (...a: unknown[]) => h.signOut(...a) },
  },
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: (...a: unknown[]) => h.toastSuccess(...a), error: vi.fn() }) }));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => h.navigate,
}));

import ExcluirContaCliente from '@/components/paciente/ExcluirContaCliente';
import { navegador, registrarLimpezaDeCacheDoUsuario } from '@/lib/contaCliente';

const usuarioComSenha = {
  id: 'cli-1',
  email: 'cliente@exemplo.com',
  app_metadata: { provider: 'email', providers: ['email'] },
  identities: [{ provider: 'email' }],
};
const usuarioSoGoogle = {
  id: 'cli-2',
  email: 'google@exemplo.com',
  app_metadata: { provider: 'google', providers: ['google'] },
  identities: [{ provider: 'google' }],
};

let qc: QueryClient;
function renderizar(props: React.ComponentProps<typeof ExcluirContaCliente> = {}) {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ExcluirContaCliente {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function abrirDialogo() {
  fireEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }));
  return screen.findByRole('alertdialog');
}
const campoConfirmacao = () => screen.getByLabelText(/Para confirmar, digite EXCLUIR/);
const campoSenha = () => screen.getByLabelText('Sua senha');
const botaoExcluir = () => screen.getByRole('button', { name: 'Excluir definitivamente' });

function preencher(rotulo: HTMLElement, valor: string) {
  fireEvent.change(rotulo, { target: { value: valor } });
}

beforeEach(() => {
  h.user = usuarioComSenha;
  h.rpc.mockReset();
  h.rpc.mockResolvedValue({ data: { ok: true, pacientes_desvinculados: 0 }, error: null });
  h.signOut.mockReset();
  h.signOut.mockResolvedValue({ error: null });
  h.navigate.mockReset();
  h.toastSuccess.mockReset();
});
afterEach(() => cleanup());

describe('Excluir minha conta (cliente): cartão e diálogo', () => {
  it('mostra um cartão discreto e só abre o diálogo ao tocar', async () => {
    renderizar();
    expect(screen.getByRole('heading', { name: 'Excluir minha conta' })).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await abrirDialogo();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('explica o que é apagado, o que permanece, que é definitivo e que dá para recriar a conta', async () => {
    renderizar();
    const dialogo = await abrirDialogo();
    expect(dialogo).toHaveTextContent('Esta ação é definitiva e não pode ser desfeita.');
    expect(dialogo).toHaveTextContent('O que será apagado');
    expect(dialogo).toHaveTextContent('O seu login');
    expect(dialogo).toHaveTextContent('O seu acesso ao portal do cliente');
    expect(dialogo).toHaveTextContent('O que permanece');
    expect(dialogo).toHaveTextContent('Os registros feitos pelos profissionais que te atendem ficam com eles');
    expect(dialogo).toHaveTextContent('guarda de prontuário');
    expect(dialogo).toHaveTextContent('Você perde o acesso a esses registros');
    expect(dialogo).toHaveTextContent('criar outra conta com o mesmo e-mail, inclusive uma conta de profissional');
  });

  it('leva o foco para o campo de confirmação ao abrir', async () => {
    renderizar();
    await abrirDialogo();
    await waitFor(() => expect(campoConfirmacao()).toHaveFocus());
  });

  it('Esc e Cancelar fecham o diálogo sem chamar a RPC', async () => {
    renderizar();
    await abrirDialogo();
    fireEvent.keyDown(campoConfirmacao(), { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());

    await abrirDialogo();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('o botão destrutivo fica desabilitado até a confirmação ser válida', async () => {
    renderizar();
    await abrirDialogo();
    preencher(campoSenha(), 'minha-senha');
    expect(botaoExcluir()).toBeDisabled();

    preencher(campoConfirmacao(), 'EXCLU');
    expect(botaoExcluir()).toBeDisabled();
    preencher(campoConfirmacao(), 'EXCLUIRR');
    expect(botaoExcluir()).toBeDisabled();
    preencher(campoConfirmacao(), 'apagar');
    expect(botaoExcluir()).toBeDisabled();

    preencher(campoConfirmacao(), 'EXCLUIR');
    expect(botaoExcluir()).toBeEnabled();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('aceita a palavra em minúsculas e com espaços, mas envia EXCLUIR normalizado', async () => {
    renderizar();
    await abrirDialogo();
    preencher(campoConfirmacao(), '  excluir ');
    preencher(campoSenha(), 'minha-senha');
    fireEvent.click(botaoExcluir());
    await waitFor(() => expect(h.rpc).toHaveBeenCalledTimes(1));
    expect(h.rpc).toHaveBeenCalledWith('excluir_minha_conta_cliente', {
      p_confirmacao: 'EXCLUIR',
      p_senha: 'minha-senha',
    });
  });

  it('conta com senha: exige a senha antes de habilitar o botão', async () => {
    renderizar();
    await abrirDialogo();
    preencher(campoConfirmacao(), 'EXCLUIR');
    expect(campoSenha()).toHaveAttribute('type', 'password');
    expect(botaoExcluir()).toBeDisabled();
    preencher(campoSenha(), 'x');
    expect(botaoExcluir()).toBeEnabled();
  });

  it('o botão de olho mostra e oculta a senha', async () => {
    renderizar();
    await abrirDialogo();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(campoSenha()).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(campoSenha()).toHaveAttribute('type', 'password');
  });

  it('conta só Google: não pede senha, avisa que pode ser pedido entrar de novo e envia senha nula', async () => {
    h.user = usuarioSoGoogle;
    renderizar();
    const dialogo = await abrirDialogo();
    expect(screen.queryByLabelText('Sua senha')).not.toBeInTheDocument();
    expect(dialogo).toHaveTextContent('Você entra pelo Google, por isso não pedimos senha');
    expect(dialogo).toHaveTextContent('vamos pedir que você entre de novo');

    preencher(campoConfirmacao(), 'EXCLUIR');
    expect(botaoExcluir()).toBeEnabled();
    fireEvent.click(botaoExcluir());
    await waitFor(() => expect(h.rpc).toHaveBeenCalledTimes(1));
    expect(h.rpc).toHaveBeenCalledWith('excluir_minha_conta_cliente', { p_confirmacao: 'EXCLUIR', p_senha: null });
  });

  it('mostra o estado de carregamento e impede fechar enquanto exclui', async () => {
    let concluir: (v: unknown) => void = () => {};
    h.rpc.mockReturnValue(new Promise((ok) => { concluir = ok; }));
    renderizar();
    await abrirDialogo();
    preencher(campoConfirmacao(), 'EXCLUIR');
    preencher(campoSenha(), 'minha-senha');
    fireEvent.click(botaoExcluir());

    const emAndamento = await screen.findByRole('button', { name: /Excluindo/ });
    expect(emAndamento).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    fireEvent.keyDown(campoConfirmacao(), { key: 'Escape', code: 'Escape' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    await act(async () => {
      concluir({ data: { ok: true, pacientes_desvinculados: 1 }, error: null });
    });
    await waitFor(() => expect(h.navigate).toHaveBeenCalled());
  });
});

describe('Excluir minha conta (cliente): erros da RPC em mensagens humanas', () => {
  async function tentarExcluir() {
    renderizar();
    await abrirDialogo();
    preencher(campoConfirmacao(), 'EXCLUIR');
    preencher(campoSenha(), 'minha-senha');
    fireEvent.click(botaoExcluir());
    return screen.findByRole('alert');
  }

  const casos: [string, RegExp][] = [
    ['confirmacao_invalida', /A confirmação não confere\. Digite EXCLUIR/],
    ['conta_de_profissional', /conta de profissional e não pode ser excluída por aqui\. Fale com o suporte/],
    ['conta_nao_e_de_cliente', /não é de cliente.*fale com o suporte/i],
    ['senha_incorreta', /Senha incorreta/],
  ];

  it.each(casos)('%s', async (codigo, mensagem) => {
    h.rpc.mockResolvedValue({ data: null, error: { message: codigo } });
    const alerta = await tentarExcluir();
    expect(alerta).toHaveTextContent(mensagem);
    expect(alerta).not.toHaveTextContent(codigo);
    expect(h.signOut).not.toHaveBeenCalled();
    expect(h.navigate).not.toHaveBeenCalled();
    // Senha incorreta limpa o campo, então o botão só volta quando a pessoa digita de novo.
    if (codigo === 'senha_incorreta') preencher(campoSenha(), 'outra-senha');
    expect(botaoExcluir()).toBeEnabled();
  });

  it('senha incorreta limpa o campo e devolve o foco a ele', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'senha_incorreta' } });
    await tentarExcluir();
    await waitFor(() => expect(campoSenha()).toHaveFocus());
    expect(campoSenha()).toHaveValue('');
    expect(campoSenha()).toHaveAttribute('aria-invalid', 'true');
  });

  it('senha_obrigatoria numa conta sem metadado de senha revela o campo de senha', async () => {
    h.user = usuarioSoGoogle;
    h.rpc.mockResolvedValue({ data: null, error: { message: 'senha_obrigatoria' } });
    renderizar();
    await abrirDialogo();
    expect(screen.queryByLabelText('Sua senha')).not.toBeInTheDocument();
    preencher(campoConfirmacao(), 'EXCLUIR');
    fireEvent.click(botaoExcluir());
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Digite a sua senha para confirmar a exclusão.');
    expect(campoSenha()).toBeInTheDocument();
    expect(botaoExcluir()).toBeDisabled();
  });

  it.each(['reautenticar', 'nao_autenticado'])('%s oferece sair e entrar de novo', async (codigo) => {
    h.rpc.mockResolvedValue({ data: null, error: { message: codigo } });
    const alerta = await tentarExcluir();
    expect(alerta).toHaveTextContent(/entre de novo/i);
    fireEvent.click(screen.getByRole('button', { name: 'Sair e entrar de novo' }));
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith('/paciente/login', { replace: true }));
    expect(h.signOut).toHaveBeenCalledTimes(1);
  });

  it('erro de rede (exceção) vira mensagem genérica e permite tentar de novo', async () => {
    h.rpc.mockRejectedValue(new TypeError('Failed to fetch'));
    const alerta = await tentarExcluir();
    expect(alerta).toHaveTextContent('Não foi possível excluir a conta agora');
    expect(botaoExcluir()).toBeEnabled();
  });

  it('retorno sem ok:true também não é tratado como sucesso', async () => {
    h.rpc.mockResolvedValue({ data: null, error: null });
    const alerta = await tentarExcluir();
    expect(alerta).toHaveTextContent('Não foi possível excluir a conta agora');
    expect(h.signOut).not.toHaveBeenCalled();
  });
});

describe('Excluir minha conta (cliente): sucesso', () => {
  it('sai da conta, limpa os caches, avisa e vai para a página inicial', async () => {
    const limpezaDoGuarda = vi.fn();
    registrarLimpezaDeCacheDoUsuario(limpezaDoGuarda);
    const onExcluida = vi.fn();
    renderizar({ onExcluida });
    qc.setQueryData(['paciente-portal', 'cli-1'], { id: 'p1' });
    expect(qc.getQueryCache().getAll()).toHaveLength(1);

    await abrirDialogo();
    preencher(campoConfirmacao(), 'EXCLUIR');
    preencher(campoSenha(), 'minha-senha');
    fireEvent.click(botaoExcluir());

    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith('/', { replace: true }));
    expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(qc.getQueryCache().getAll()).toHaveLength(0);
    expect(limpezaDoGuarda).toHaveBeenCalled();
    expect(h.toastSuccess).toHaveBeenCalledWith(
      'Conta excluída',
      expect.objectContaining({ description: expect.stringContaining('login') }),
    );
    expect(onExcluida).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('a ordem é: RPC, depois signOut, depois navegar', async () => {
    const ordem: string[] = [];
    h.rpc.mockImplementation(async () => {
      ordem.push('rpc');
      return { data: { ok: true, pacientes_desvinculados: 3 }, error: null };
    });
    h.signOut.mockImplementation(async () => {
      ordem.push('signOut');
      return { error: null };
    });
    h.navigate.mockImplementation(() => {
      ordem.push('navigate');
    });
    renderizar();
    await abrirDialogo();
    preencher(campoConfirmacao(), 'EXCLUIR');
    preencher(campoSenha(), 'minha-senha');
    fireEvent.click(botaoExcluir());
    await waitFor(() => expect(ordem).toEqual(['rpc', 'signOut', 'navigate']));
  });

  it('respeita destinoAposExcluir e o aviso personalizado', async () => {
    renderizar({
      destinoAposExcluir: '/auth?modo=cadastro',
      avisoSucesso: { titulo: 'Conta de cliente excluída.', descricao: 'Agora você pode criar o perfil profissional com este e-mail.' },
    });
    await abrirDialogo();
    preencher(campoConfirmacao(), 'EXCLUIR');
    preencher(campoSenha(), 'minha-senha');
    fireEvent.click(botaoExcluir());
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith('/auth?modo=cadastro', { replace: true }));
    expect(h.toastSuccess).toHaveBeenCalledWith(
      'Conta de cliente excluída.',
      expect.objectContaining({ description: 'Agora você pode criar o perfil profissional com este e-mail.' }),
    );
  });

  it.each([
    ['lança exceção', () => h.signOut.mockRejectedValue(new Error('sem rede'))],
    ['devolve erro', () => h.signOut.mockResolvedValue({ error: { message: 'Failed to fetch' } })],
  ])('se o logout falhar (%s), apaga a sessão salva e recarrega a página em vez de seguir logado', async (_, falhar) => {
    falhar();
    window.localStorage.setItem('sb-abc123-auth-token', '{"access_token":"x"}');
    window.localStorage.setItem('outra-chave', 'fica');
    const recarregar = vi.spyOn(navegador, 'recarregar').mockImplementation(() => {});
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onExcluida = vi.fn();
    renderizar({ onExcluida, destinoAposExcluir: '/auth?modo=cadastro' });
    qc.setQueryData(['x'], 1);
    await abrirDialogo();
    preencher(campoConfirmacao(), 'EXCLUIR');
    preencher(campoSenha(), 'minha-senha');
    fireEvent.click(botaoExcluir());
    await waitFor(() => expect(recarregar).toHaveBeenCalledWith('/auth?modo=cadastro'));
    expect(window.localStorage.getItem('sb-abc123-auth-token')).toBeNull();
    expect(window.localStorage.getItem('outra-chave')).toBe('fica');
    expect(qc.getQueryCache().getAll()).toHaveLength(0);
    expect(onExcluida).toHaveBeenCalledTimes(1);
    expect(h.navigate).not.toHaveBeenCalled();
    recarregar.mockRestore();
    aviso.mockRestore();
    window.localStorage.removeItem('outra-chave');
  });
});
