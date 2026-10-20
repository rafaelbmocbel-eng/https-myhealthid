import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type Usuario = { id: string; email: string; app_metadata: Record<string, unknown>; identities: { provider: string }[]; user_metadata: Record<string, unknown> } | null;

const h = vi.hoisted(() => {
  const loja = {
    user: null as unknown,
    ouvintes: new Set<() => void>(),
    definir(u: unknown) {
      loja.user = u;
      loja.ouvintes.forEach((f) => f());
    },
  };
  return {
    loja,
    rpc: vi.fn(),
    supabaseSignOut: vi.fn(),
    contextoSignOut: vi.fn(),
    toastSuccess: vi.fn(),
  };
});

vi.mock('@/contexts/AuthContext', async () => {
  const React = await import('react');
  return {
    useAuth: () => {
      const user = React.useSyncExternalStore(
        (f) => {
          h.loja.ouvintes.add(f);
          return () => h.loja.ouvintes.delete(f);
        },
        () => h.loja.user,
      );
      return { user, loading: false, signIn: vi.fn(), signUp: vi.fn(), signOut: h.contextoSignOut };
    },
  };
});
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    auth: { signOut: (...a: unknown[]) => h.supabaseSignOut(...a), signInWithOAuth: vi.fn() },
  },
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: (...a: unknown[]) => h.toastSuccess(...a), error: vi.fn() }) }));

import Auth from '@/pages/Auth';

const cliente: Usuario = {
  id: 'cli-1',
  email: 'nicolasviegas57@gmail.com',
  app_metadata: { provider: 'email', providers: ['email'] },
  identities: [{ provider: 'email' }],
  user_metadata: { is_patient: true },
};
const profissional: Usuario = {
  id: 'pro-1',
  email: 'pro@exemplo.com',
  app_metadata: { provider: 'email', providers: ['email'] },
  identities: [{ provider: 'email' }],
  user_metadata: {},
};

function Local() {
  const l = useLocation();
  return <div data-testid="local">{l.pathname + l.search}</div>;
}

function renderizar(entrada: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[entrada]}>
        <Routes>
          <Route path="/auth" element={<><Auth /><Local /></>} />
          <Route path="/paciente/dashboard" element={<div>PORTAL DO CLIENTE</div>} />
          <Route path="/paciente/login" element={<div>LOGIN DO PORTAL</div>} />
          <Route path="/hoje" element={<div>PAINEL /hoje</div>} />
          <Route path="/convite/:id" element={<div>CONVITE</div>} />
          <Route path="/" element={<div>PÁGINA INICIAL</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const DICA = /Já usou este e-mail como cliente\? Para usá-lo como profissional,/;

beforeEach(() => {
  h.loja.definir(null);
  h.rpc.mockReset();
  h.rpc.mockResolvedValue({ data: { ok: true, pacientes_desvinculados: 1 }, error: null });
  h.supabaseSignOut.mockReset();
  h.supabaseSignOut.mockImplementation(async () => {
    h.loja.definir(null);
    return { error: null };
  });
  h.contextoSignOut.mockReset();
  h.contextoSignOut.mockImplementation(async () => {
    h.loja.definir(null);
  });
  h.toastSuccess.mockReset();
  window.history.pushState({}, '', '/auth');
});
afterEach(() => {
  cleanup();
  window.history.pushState({}, '', '/');
});

describe('Auth: cliente logado em /auth?modo=cadastro', () => {
  it('mostra o cartão "Esta conta é de cliente" em vez de redirecionar em silêncio', async () => {
    h.loja.definir(cliente);
    renderizar('/auth?modo=cadastro');
    expect(await screen.findByRole('heading', { name: 'Esta conta é de cliente' })).toBeInTheDocument();
    expect(screen.queryByText('PORTAL DO CLIENTE')).not.toBeInTheDocument();
    expect(screen.getByText('nicolasviegas57@gmail.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar como cliente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Excluir minha conta de cliente e criar perfil profissional' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sair (usar outro e-mail)' })).toBeInTheDocument();
  });

  it('"Continuar como cliente" leva ao portal', async () => {
    h.loja.definir(cliente);
    renderizar('/auth?modo=cadastro');
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar como cliente' }));
    expect(await screen.findByText('PORTAL DO CLIENTE')).toBeInTheDocument();
  });

  it('"Sair" encerra a sessão e mostra o cadastro profissional para usar outro e-mail', async () => {
    h.loja.definir(cliente);
    renderizar('/auth?modo=cadastro');
    fireEvent.click(await screen.findByRole('button', { name: 'Sair (usar outro e-mail)' }));
    expect(await screen.findByRole('heading', { name: 'Criar conta de profissional' })).toBeInTheDocument();
    expect(h.contextoSignOut).toHaveBeenCalledTimes(1);
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('excluir: abre o diálogo, chama a RPC e volta ao cadastro com o e-mail preenchido e o aviso', async () => {
    h.loja.definir(cliente);
    renderizar('/auth?modo=cadastro');
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir minha conta de cliente e criar perfil profissional' }));

    const dialogo = await screen.findByRole('alertdialog');
    expect(dialogo).toHaveTextContent('Esta ação é definitiva');
    fireEvent.change(screen.getByLabelText(/Para confirmar, digite EXCLUIR/), { target: { value: 'EXCLUIR' } });
    fireEvent.change(screen.getByLabelText('Sua senha'), { target: { value: 'minha-senha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir definitivamente' }));

    expect(await screen.findByRole('heading', { name: 'Criar conta de profissional' })).toBeInTheDocument();
    expect(h.rpc).toHaveBeenCalledWith('excluir_minha_conta_cliente', { p_confirmacao: 'EXCLUIR', p_senha: 'minha-senha' });
    expect(h.supabaseSignOut).toHaveBeenCalledTimes(1);
    expect(h.toastSuccess).toHaveBeenCalledWith(
      'Conta de cliente excluída.',
      expect.objectContaining({ description: 'Agora você pode criar o perfil profissional com este e-mail.' }),
    );
    await waitFor(() => expect(screen.getByTestId('local')).toHaveTextContent('/auth?modo=cadastro'));
    expect(screen.getByLabelText('E-mail')).toHaveValue('nicolasviegas57@gmail.com');
    expect(screen.queryByText('PORTAL DO CLIENTE')).not.toBeInTheDocument();
  });

  it('se a RPC recusar (conta de profissional), o cartão continua e o erro aparece no diálogo', async () => {
    h.loja.definir(cliente);
    h.rpc.mockResolvedValue({ data: null, error: { message: 'conta_de_profissional' } });
    renderizar('/auth?modo=cadastro');
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir minha conta de cliente e criar perfil profissional' }));
    await screen.findByRole('alertdialog');
    fireEvent.change(screen.getByLabelText(/Para confirmar, digite EXCLUIR/), { target: { value: 'EXCLUIR' } });
    fireEvent.change(screen.getByLabelText('Sua senha'), { target: { value: 'minha-senha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir definitivamente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('conta de profissional');
    expect(h.supabaseSignOut).not.toHaveBeenCalled();
    expect(h.toastSuccess).not.toHaveBeenCalled();
  });
});

describe('Auth: o comportamento atual não muda nos outros casos', () => {
  it.each(['/auth', '/auth?modo=login', '/auth?modo=outro', '/auth?redirect=/convite/abc'])(
    'cliente logado em %s continua indo ao portal, sem cartão',
    async (entrada) => {
      h.loja.definir(cliente);
      renderizar(entrada);
      expect(await screen.findByText('PORTAL DO CLIENTE')).toBeInTheDocument();
      expect(screen.queryByText('Esta conta é de cliente')).not.toBeInTheDocument();
    },
  );

  it('profissional logado continua indo a /hoje, inclusive com ?modo=cadastro', async () => {
    h.loja.definir(profissional);
    renderizar('/auth');
    expect(await screen.findByText('PAINEL /hoje')).toBeInTheDocument();
    cleanup();
    renderizar('/auth?modo=cadastro');
    expect(await screen.findByText('PAINEL /hoje')).toBeInTheDocument();
    expect(screen.queryByText('Esta conta é de cliente')).not.toBeInTheDocument();
  });

  it('profissional logado preserva ?redirect= interno e ignora o externo', async () => {
    h.loja.definir(profissional);
    window.history.pushState({}, '', '/auth?redirect=/convite/abc');
    renderizar('/auth?redirect=/convite/abc');
    expect(await screen.findByText('CONVITE')).toBeInTheDocument();
    cleanup();

    window.history.pushState({}, '', '/auth?redirect=//evil.com');
    renderizar('/auth?redirect=//evil.com');
    expect(await screen.findByText('PAINEL /hoje')).toBeInTheDocument();
  });

  it('sem login, /auth abre a aba Entrar, sem a dica de cadastro', () => {
    renderizar('/auth');
    expect(screen.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeInTheDocument();
    expect(screen.queryByText(DICA)).not.toBeInTheDocument();
  });
});

describe('Auth: dica estática na aba de cadastro', () => {
  it('aparece na aba Cadastrar, com link para o portal do cliente, sem revelar se o e-mail existe', () => {
    renderizar('/auth?modo=cadastro');
    expect(screen.getByRole('heading', { name: 'Criar conta de profissional' })).toBeInTheDocument();
    const dica = screen.getByText(DICA);
    expect(dica).toHaveTextContent(
      'Já usou este e-mail como cliente? Para usá-lo como profissional, entre pelo portal do cliente e exclua a conta de cliente em Perfil > Excluir minha conta.',
    );
    const link = screen.getByRole('link', { name: 'entre pelo portal do cliente' });
    expect(link).toHaveAttribute('href', '/paciente/login');
  });

  it('aparece ao trocar da aba Entrar para Cadastrar e some ao voltar', () => {
    renderizar('/auth');
    expect(screen.queryByText(DICA)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Cadastrar' })[0]);
    expect(screen.getByText(DICA)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Entrar' })[0]);
    expect(screen.queryByText(DICA)).not.toBeInTheDocument();
  });

  it('o link leva ao login do portal', async () => {
    renderizar('/auth?modo=cadastro');
    fireEvent.click(screen.getByRole('link', { name: 'entre pelo portal do cliente' }));
    expect(await screen.findByText('LOGIN DO PORTAL')).toBeInTheDocument();
  });
});

// Garante que a troca de usuário durante a exclusão não deixa o cartão preso.
describe('Auth: usuário some no meio da exclusão', () => {
  it('não quebra quando o cartão desmonta antes de a navegação terminar', async () => {
    h.loja.definir(cliente);
    renderizar('/auth?modo=cadastro');
    await screen.findByRole('heading', { name: 'Esta conta é de cliente' });
    await act(async () => {
      h.loja.definir(null);
    });
    expect(screen.getByRole('heading', { name: 'Criar conta de profissional' })).toBeInTheDocument();
  });
});
