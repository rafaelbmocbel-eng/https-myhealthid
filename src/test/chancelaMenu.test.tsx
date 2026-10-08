import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

const h = vi.hoisted(() => ({ ehEquipe: false, pendentes: 0 }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', email: 'prof@exemplo.com' }, profile: { nome: 'Prof' }, signOut: vi.fn() }),
}));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => false }));
vi.mock('@/hooks/useAgendamentoNotifications', () => ({ useAgendamentoNotifications: () => ({ pendingCount: 0, clearCount: vi.fn() }) }));
vi.mock('@/hooks/useServicosAtivos', () => ({ useServicosAtivos: () => ({ servicos: {} }) }));
vi.mock('@/hooks/useVitrineNotifications', () => ({ useVitrineNotifications: () => ({ pendingCount: 0 }) }));
vi.mock('@/hooks/usePlanoAtivo', () => ({ usePlanoAtivo: () => ({ data: null }), temAcessoModulo: () => true }));
vi.mock('@/hooks/useEquipeCientifica', () => ({ useEquipeCientifica: () => ({ ehEquipe: h.ehEquipe, loading: false }) }));
vi.mock('@/hooks/useChancelaPendentes', () => ({ useChancelaPendentes: () => (h.ehEquipe ? h.pendentes : 0) }));

import AppSidebar from '@/components/AppSidebar';

function renderizar(rota = '/hoje') {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <TooltipProvider>
        <AppSidebar collapsed={false} onToggle={() => {}} />
      </TooltipProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.ehEquipe = false;
  h.pendentes = 0;
});
afterEach(() => cleanup());

describe('Menu: Chancela só para a equipe científica', () => {
  it('profissional comum não vê o item', () => {
    renderizar();
    expect(screen.queryByRole('link', { name: /Chancela/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Configurações/ })).toBeInTheDocument();
  });

  it('equipe vê o item apontando para /chancela, antes de Configurações', () => {
    h.ehEquipe = true;
    renderizar();
    const link = screen.getByRole('link', { name: /Chancela/ });
    expect(link).toHaveAttribute('href', '/chancela');
    const links = screen.getAllByRole('link').map((l) => l.textContent);
    expect(links.findIndex((t) => t?.includes('Chancela'))).toBeLessThan(links.findIndex((t) => t?.includes('Configurações')));
  });

  it('contador de pendentes aparece no item e some quando não há nenhum', () => {
    h.ehEquipe = true;
    h.pendentes = 3;
    const { unmount } = renderizar();
    expect(screen.getByLabelText('3 aguardando chancela')).toHaveTextContent('3');
    unmount();

    h.pendentes = 0;
    renderizar();
    expect(screen.queryByLabelText(/aguardando chancela/)).not.toBeInTheDocument();
  });

  it('muitos pendentes viram 9+', () => {
    h.ehEquipe = true;
    h.pendentes = 14;
    renderizar();
    expect(screen.getByLabelText('14 aguardando chancela')).toHaveTextContent('9+');
  });

  it('o item fica ativo na rota /chancela', () => {
    h.ehEquipe = true;
    renderizar('/chancela');
    expect(screen.getByRole('link', { name: /Chancela/ }).getAttribute('style') ?? '').toContain('box-shadow');
  });
});
