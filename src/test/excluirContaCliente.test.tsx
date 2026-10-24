import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const h = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  premium: false,
  rpc: vi.fn(),
  remove: vi.fn(),
  signOut: vi.fn(),
  navigate: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock('@/hooks/useWellnessAccess', () => ({ useWellnessAccess: () => ({ isPremium: h.premium }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    auth: { signOut: (...a: unknown[]) => h.signOut(...a) },
    storage: { from: () => ({ remove: (...a: unknown[]) => h.remove(...a) }) },
  },
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: (...a: unknown[]) => h.toastSuccess(...a), error: vi.fn() }) }));
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router-dom')>()),
  useNavigate: () => h.navigate,
}));

// O Checkbox do Radix mede o elemento com ResizeObserver, que o jsdom não tem.
class ResizeObserverFalso {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverFalso);

import ExcluirContaCliente from '@/components/paciente/ExcluirContaCliente';
import { navegador, registrarLimpezaDeCacheDoUsuario, TEMPO_LIMITE_EXCLUSAO_MS } from '@/lib/contaCliente';

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
  h.premium = false;
  h.rpc.mockReset();
  h.rpc.mockResolvedValue({ data: { ok: true, pacientes_desvinculados: 0 }, error: null });
  h.remove.mockReset();
  h.remove.mockResolvedValue({ data: [], error: null });
  window.sessionStorage.clear();
  h.signOut.mockReset();
  h.signOut.mockResolvedValue({ error: null });
  h.navigate.mockReset();
  h.toastSuccess.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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
    expect(dialogo).toHaveTextContent('A sua foto de perfil, se você enviou uma');
    expect(screen.queryByText('Seu plano Premium será encerrado')).not.toBeInTheDocument();
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
      p_aceita_perder_premium: false,
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
    expect(h.rpc).toHaveBeenCalledWith('excluir_minha_conta_cliente', {
      p_confirmacao: 'EXCLUIR',
      p_senha: null,
      p_aceita_perder_premium: false,
    });
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
    ['tente_novamente', /exclusão em andamento/],
    ['muitas_tentativas', /Muitas tentativas.*15 minutos/],
    ['cadastro_precisa_correcao', /CPF.*corrigir/],
    ['falha_ao_excluir', /problema no servidor e nada foi alterado/],
  ];

  it.each(casos)('%s', async (codigo, mensagem) => {
    h.rpc.mockResolvedValue({ data: null, error: { message: codigo } });
    const alerta = await tentarExcluir();
    expect(alerta).toHaveTextContent(mensagem);
    expect(alerta).not.toHaveTextContent(codigo);
    expect(h.signOut).not.toHaveBeenCalled();
    expect(h.navigate).not.toHaveBeenCalled();
    expect(botaoExcluir()).toBeEnabled();
  });

  it('o servidor responde senha errada como retorno {ok:false}: mensagem com tentativas restantes, campo limpo e com o foco', async () => {
    h.rpc.mockResolvedValue({ data: { ok: false, erro: 'senha_incorreta', tentativas_restantes: 3 }, error: null });
    const alerta = await tentarExcluir();
    expect(alerta).toHaveTextContent('Senha incorreta. Restam 3 tentativas antes de um bloqueio de 15 minutos.');
    await waitFor(() => expect(campoSenha()).toHaveFocus());
    expect(campoSenha()).toHaveValue('');
    expect(campoSenha()).toHaveAttribute('aria-invalid', 'true');
    expect(h.signOut).not.toHaveBeenCalled();
    expect(h.remove).not.toHaveBeenCalled();
    preencher(campoSenha(), 'outra-senha');
    expect(botaoExcluir()).toBeEnabled();
  });

  it('mensagens que mandam falar com o suporte trazem o e-mail como link', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'falha_ao_excluir' } });
    const alerta = await tentarExcluir();
    const link = within(alerta).getByRole('link', { name: /contato@myhealthid\.com\.br/ });
    expect(link).toHaveAttribute('href', expect.stringMatching(/^mailto:contato@myhealthid\.com\.br\?subject=/));
  });

  it('erros sem campo próprio levam o foco ao aviso (leitor de tela e teclado não ficam perdidos)', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'falha_ao_excluir' } });
    const alerta = await tentarExcluir();
    await waitFor(() => expect(alerta).toHaveFocus());
  });

  it('senha errada não conta como "sem resposta": a sessão perdida depois continua sendo só "sessão expirada"', async () => {
    h.rpc.mockResolvedValueOnce({ data: { ok: false, erro: 'senha_incorreta', tentativas_restantes: 4 }, error: null });
    await tentarExcluir();
    preencher(campoSenha(), 'outra');
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'nao_autenticado' } });
    fireEvent.click(botaoExcluir());
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Sua sessão expirou'));
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
    // Depois do login a pessoa volta ao Perfil (de onde se exclui), não ao painel.
    await waitFor(() =>
      expect(h.navigate).toHaveBeenCalledWith('/paciente/login?proxima=%2Fpaciente%2Fperfil', { replace: true }),
    );
    expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'global' });
  });

  it('o retorno depois do login pode ser outro (o cartão do /auth volta ao cadastro profissional)', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'reautenticar' } });
    renderizar({ retornoAposLogin: '/auth?modo=cadastro' });
    await abrirDialogo();
    preencher(campoConfirmacao(), 'EXCLUIR');
    preencher(campoSenha(), 'minha-senha');
    fireEvent.click(botaoExcluir());
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Sair e entrar de novo' }));
    await waitFor(() =>
      expect(h.navigate).toHaveBeenCalledWith('/paciente/login?proxima=%2Fauth%3Fmodo%3Dcadastro', { replace: true }),
    );
  });

  it('se o logout global falhar (ex.: a conta já foi apagada), apaga a sessão salva e recarrega no login em vez de seguir logado', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'reautenticar' } });
    h.signOut.mockRejectedValue(new Error('sem rede'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    window.localStorage.setItem('sb-abc123-auth-token', '{"access_token":"x"}');
    const recarregar = vi.spyOn(navegador, 'recarregar').mockImplementation(() => {});
    renderizar();
    await abrirDialogo();
    preencher(campoConfirmacao(), 'EXCLUIR');
    preencher(campoSenha(), 'minha-senha');
    fireEvent.click(botaoExcluir());
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Sair e entrar de novo' }));
    await waitFor(() => expect(recarregar).toHaveBeenCalledWith('/paciente/login?proxima=%2Fpaciente%2Fperfil'));
    expect(window.localStorage.getItem('sb-abc123-auth-token')).toBeNull();
    expect(h.navigate).not.toHaveBeenCalled();
    recarregar.mockRestore();
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
    // O recarregamento apaga o aviso de sucesso: ele fica guardado na sessão para a próxima carga (e o e-mail
    // também, porque o destino é o cadastro).
    expect(JSON.parse(window.sessionStorage.getItem('mh_conta_excluida') ?? 'null')).toEqual({
      titulo: 'Conta excluída',
      descricao: 'Seu login e o acesso ao portal foram apagados.',
    });
    expect(window.sessionStorage.getItem('mh_conta_excluida_email')).toBe('cliente@exemplo.com');
    recarregar.mockRestore();
    aviso.mockRestore();
    window.localStorage.removeItem('outra-chave');
  });

  it('no plano B com destino fora do cadastro, o e-mail da conta apagada não é guardado', async () => {
    h.signOut.mockResolvedValue({ error: { message: 'Failed to fetch' } });
    const recarregar = vi.spyOn(navegador, 'recarregar').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderizar();
    await abrirDialogo();
    preencher(campoConfirmacao(), 'EXCLUIR');
    preencher(campoSenha(), 'minha-senha');
    fireEvent.click(botaoExcluir());
    await waitFor(() => expect(recarregar).toHaveBeenCalledWith('/'));
    expect(window.sessionStorage.getItem('mh_conta_excluida')).not.toBeNull();
    expect(window.sessionStorage.getItem('mh_conta_excluida_email')).toBeNull();
    recarregar.mockRestore();
  });
});

describe('Excluir minha conta (cliente): foto de perfil no Storage', () => {
  async function excluirComSucesso() {
    renderizar();
    await abrirDialogo();
    preencher(campoConfirmacao(), 'EXCLUIR');
    preencher(campoSenha(), 'minha-senha');
    fireEvent.click(botaoExcluir());
  }

  it('remove a foto do próprio cliente DEPOIS da RPC e ANTES de encerrar a sessão (a policy exige a sessão)', async () => {
    const ordem: string[] = [];
    h.rpc.mockImplementation(async () => {
      ordem.push('rpc');
      return { data: { ok: true, pacientes_desvinculados: 0 }, error: null };
    });
    h.remove.mockImplementation(async () => {
      ordem.push('remove');
      return { data: [], error: null };
    });
    h.signOut.mockImplementation(async () => {
      ordem.push('signOut');
      return { error: null };
    });
    h.navigate.mockImplementation(() => {
      ordem.push('navigate');
    });
    await excluirComSucesso();
    await waitFor(() => expect(ordem).toEqual(['rpc', 'remove', 'signOut', 'navigate']));
    expect(h.remove).toHaveBeenCalledWith(['cli-1/avatar.jpg']);
  });

  it('se a RPC recusar, a foto NÃO é apagada (senha errada não pode custar a foto)', async () => {
    h.rpc.mockResolvedValue({ data: { ok: false, erro: 'senha_incorreta', tentativas_restantes: 2 }, error: null });
    await excluirComSucesso();
    await screen.findByRole('alert');
    expect(h.remove).not.toHaveBeenCalled();
  });

  it('falha ao remover a foto não trava a exclusão: a sessão encerra e a navegação acontece', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.remove.mockRejectedValue(new Error('storage fora do ar'));
    await excluirComSucesso();
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith('/', { replace: true }));
    expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(h.toastSuccess).toHaveBeenCalled();
  });
});

describe('Excluir minha conta (cliente): plano Premium ativo', () => {
  it('avisa com destaque que o plano será encerrado e os dias restantes não são reembolsados, e exige a ciência', async () => {
    h.premium = true;
    renderizar();
    const dialogo = await abrirDialogo();
    expect(within(dialogo).getByRole('heading', { name: 'Seu plano Premium será encerrado' })).toBeInTheDocument();
    expect(dialogo).toHaveTextContent('Seu plano Premium ativo será encerrado junto com a conta e os dias restantes não são reembolsados.');

    preencher(campoConfirmacao(), 'EXCLUIR');
    preencher(campoSenha(), 'minha-senha');
    const ciencia = screen.getByRole('checkbox', { name: /Entendo que perco o plano Premium/ });
    expect(ciencia).not.toBeChecked();
    expect(botaoExcluir()).toBeDisabled();
    fireEvent.click(ciencia);
    expect(ciencia).toBeChecked();
    expect(botaoExcluir()).toBeEnabled();
    fireEvent.click(ciencia);
    expect(botaoExcluir()).toBeDisabled();
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('com a ciência marcada, envia p_aceita_perder_premium = true', async () => {
    h.premium = true;
    renderizar();
    await abrirDialogo();
    preencher(campoConfirmacao(), 'EXCLUIR');
    preencher(campoSenha(), 'minha-senha');
    fireEvent.click(screen.getByRole('checkbox', { name: /Entendo que perco o plano Premium/ }));
    fireEvent.click(botaoExcluir());
    await waitFor(() => expect(h.rpc).toHaveBeenCalledTimes(1));
    expect(h.rpc).toHaveBeenCalledWith('excluir_minha_conta_cliente', {
      p_confirmacao: 'EXCLUIR',
      p_senha: 'minha-senha',
      p_aceita_perder_premium: true,
    });
  });

  it('sem Premium não aparece aviso nem caixa, e o aceite vai como false', async () => {
    renderizar();
    const dialogo = await abrirDialogo();
    expect(within(dialogo).queryByRole('checkbox')).not.toBeInTheDocument();
    preencher(campoConfirmacao(), 'EXCLUIR');
    preencher(campoSenha(), 'minha-senha');
    fireEvent.click(botaoExcluir());
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith('excluir_minha_conta_cliente', expect.objectContaining({ p_aceita_perder_premium: false })));
  });

  it('se a tela não sabia do Premium mas o servidor sabe (premium_requer_aceite), a caixa aparece e o reenvio leva o aceite', async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'premium_requer_aceite' } });
    renderizar();
    const dialogo = await abrirDialogo();
    preencher(campoConfirmacao(), 'EXCLUIR');
    preencher(campoSenha(), 'minha-senha');
    fireEvent.click(botaoExcluir());
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Seu plano Premium ativo será encerrado junto com a conta');
    expect(within(dialogo).getByRole('heading', { name: 'Seu plano Premium será encerrado' })).toBeInTheDocument();
    expect(botaoExcluir()).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /Entendo que perco o plano Premium/ }));
    fireEvent.click(botaoExcluir());
    await waitFor(() => expect(h.rpc).toHaveBeenCalledTimes(2));
    expect(h.rpc).toHaveBeenLastCalledWith('excluir_minha_conta_cliente', expect.objectContaining({ p_aceita_perder_premium: true }));
  });

  it('a ciência é desmarcada ao fechar e reabrir o diálogo', async () => {
    h.premium = true;
    renderizar();
    await abrirDialogo();
    fireEvent.click(screen.getByRole('checkbox', { name: /Entendo que perco o plano Premium/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await abrirDialogo();
    expect(screen.getByRole('checkbox', { name: /Entendo que perco o plano Premium/ })).not.toBeChecked();
  });
});

describe('Excluir minha conta (cliente): foco e rede lenta', () => {
  it('ao fechar (Cancelar ou Esc) o foco volta ao botão "Excluir minha conta"', async () => {
    renderizar();
    await abrirDialogo();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Excluir minha conta' })).toHaveFocus());

    await abrirDialogo();
    fireEvent.keyDown(campoConfirmacao(), { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Excluir minha conta' })).toHaveFocus());
  });

  it('sem resposta da RPC, depois do limite o diálogo é liberado e a mensagem diz que a conta pode já ter sido excluída', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    h.rpc.mockReturnValue(new Promise(() => {}));
    renderizar();
    await abrirDialogo();
    preencher(campoConfirmacao(), 'EXCLUIR');
    preencher(campoSenha(), 'minha-senha');
    fireEvent.click(botaoExcluir());
    expect(await screen.findByRole('button', { name: /Excluindo/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(TEMPO_LIMITE_EXCLUSAO_MS + 100);
    });
    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('A resposta demorou demais. Sua conta pode já ter sido excluída.');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
    expect(botaoExcluir()).toBeEnabled();
    expect(h.signOut).not.toHaveBeenCalled();
    expect(h.remove).not.toHaveBeenCalled();
  });

  it('depois de uma tentativa sem resposta, "sessão expirada" vira "a conta pode já ter sido excluída" com saída para o login', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    h.rpc.mockReturnValueOnce(new Promise(() => {}));
    renderizar();
    await abrirDialogo();
    preencher(campoConfirmacao(), 'EXCLUIR');
    preencher(campoSenha(), 'minha-senha');
    fireEvent.click(botaoExcluir());
    await screen.findByRole('button', { name: /Excluindo/ });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TEMPO_LIMITE_EXCLUSAO_MS + 100);
    });
    await screen.findByRole('alert');

    h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'nao_autenticado' } });
    fireEvent.click(botaoExcluir());
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('sua conta pode já ter sido excluída'));
    expect(screen.getByRole('alert')).not.toHaveTextContent('Sua sessão expirou');
    expect(screen.getByRole('button', { name: 'Sair e entrar de novo' })).toBeInTheDocument();
  });

  it('erro de rede (exceção) também conta como "sem resposta"', async () => {
    h.rpc.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderizar();
    await abrirDialogo();
    preencher(campoConfirmacao(), 'EXCLUIR');
    preencher(campoSenha(), 'minha-senha');
    fireEvent.click(botaoExcluir());
    await screen.findByRole('alert');
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'nao_autenticado' } });
    fireEvent.click(botaoExcluir());
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('sua conta pode já ter sido excluída'));
  });
});
