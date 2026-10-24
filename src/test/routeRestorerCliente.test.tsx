import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const h = vi.hoisted(() => ({ user: null as Record<string, unknown> | null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: h.user, loading: false, authReady: true }),
}));

import RouteRestorer from '@/components/RouteRestorer';
import AvisoContaExcluida from '@/components/AvisoContaExcluida';

const toastSucesso = vi.hoisted(() => vi.fn());
vi.mock('sonner', () => ({ toast: { success: (...a: unknown[]) => toastSucesso(...a) } }));

const ROTA_PRO = 'myhealthid.last-route.pro';
const cliente = { id: 'cli-1', email: 'cliente@exemplo.com', user_metadata: { is_patient: true } };
const profissional = { id: 'pro-1', email: 'pro@exemplo.com', user_metadata: {} };

function Local() {
  const l = useLocation();
  return <div data-testid="local">{l.pathname + l.search}</div>;
}

function renderizar(entrada: string) {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <RouteRestorer />
      <Routes>
        <Route path="*" element={<Local />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  toastSucesso.mockReset();
});
afterEach(() => cleanup());

describe('RouteRestorer: cliente em /auth não é jogado numa rota de profissional', () => {
  it('cliente logado em /auth?modo=cadastro com uma rota de profissional salva fica em /auth (o cartão precisa aparecer)', async () => {
    window.localStorage.setItem(ROTA_PRO, '/agenda');
    h.user = cliente;
    renderizar('/auth?modo=cadastro');
    await waitFor(() => expect(window.sessionStorage.getItem('myhealthid.route-restored')).toBe('1'));
    expect(screen.getByTestId('local')).toHaveTextContent('/auth?modo=cadastro');
  });

  it('o mesmo vale para /hoje salvo', async () => {
    window.localStorage.setItem(ROTA_PRO, '/hoje');
    h.user = cliente;
    renderizar('/auth');
    await waitFor(() => expect(window.sessionStorage.getItem('myhealthid.route-restored')).toBe('1'));
    expect(screen.getByTestId('local')).toHaveTextContent('/auth');
    expect(screen.getByTestId('local')).not.toHaveTextContent('/hoje');
  });

  it('controle: profissional em /auth continua sendo levado à última rota salva', async () => {
    window.localStorage.setItem(ROTA_PRO, '/agenda');
    h.user = profissional;
    renderizar('/auth');
    await waitFor(() => expect(screen.getByTestId('local')).toHaveTextContent('/agenda'));
  });

  it('controle: o comportamento fora de /auth não muda (landing "/" restaura a rota salva)', async () => {
    window.localStorage.setItem(ROTA_PRO, '/agenda');
    h.user = cliente;
    renderizar('/');
    await waitFor(() => expect(screen.getByTestId('local')).toHaveTextContent('/agenda'));
  });
});

describe('AvisoContaExcluida: aviso que sobrevive ao recarregamento', () => {
  it('mostra o aviso guardado uma única vez e o descarta', async () => {
    window.sessionStorage.setItem('mh_conta_excluida', JSON.stringify({ titulo: 'Conta excluída', descricao: 'Seu login foi apagado.' }));
    const { unmount } = render(<AvisoContaExcluida />);
    await waitFor(() => expect(toastSucesso).toHaveBeenCalledWith('Conta excluída', expect.objectContaining({ description: 'Seu login foi apagado.' })));
    expect(window.sessionStorage.getItem('mh_conta_excluida')).toBeNull();
    unmount();
    render(<AvisoContaExcluida />);
    expect(toastSucesso).toHaveBeenCalledTimes(1);
  });

  it('sem aviso guardado não faz nada', () => {
    render(<AvisoContaExcluida />);
    expect(toastSucesso).not.toHaveBeenCalled();
  });
});
