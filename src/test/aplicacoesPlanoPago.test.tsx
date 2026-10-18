import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MODULOS_CATALOGO, MODULOS_FREE } from '@/lib/modulosPlano';

const h = vi.hoisted(() => ({
  plano: null as null | { modulos: string[] },
  carregando: false,
  superAdmin: false,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', email: 'prof@exemplo.com' }, profile: { nome: 'Prof' }, signOut: vi.fn() }),
}));
vi.mock('@/hooks/useIsSuperAdmin', () => ({ useIsSuperAdmin: () => h.superAdmin }));
vi.mock('@/hooks/useAgendamentoNotifications', () => ({ useAgendamentoNotifications: () => ({ pendingCount: 0, clearCount: vi.fn() }) }));
vi.mock('@/hooks/useServicosAtivos', () => ({ useServicosAtivos: () => ({ servicos: {} }) }));
vi.mock('@/hooks/useVitrineNotifications', () => ({ useVitrineNotifications: () => ({ pendingCount: 0 }) }));
vi.mock('@/hooks/useEquipeCientifica', () => ({ useEquipeCientifica: () => ({ ehEquipe: false, loading: false }) }));
vi.mock('@/hooks/useChancelaPendentes', () => ({ useChancelaPendentes: () => 0 }));
// O cliente do Supabase exige variáveis de ambiente que o teste não tem; a regra real de temAcessoModulo vem do módulo original.
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: vi.fn() }, rpc: vi.fn() } }));
// Mantém a regra real de temAcessoModulo; só o plano vem do teste.
vi.mock('@/hooks/usePlanoAtivo', async (importarOriginal) => {
  const original = await importarOriginal<typeof import('@/hooks/usePlanoAtivo')>();
  return { ...original, usePlanoAtivo: () => ({ data: h.plano, isLoading: h.carregando }) };
});

import AppSidebar from '@/components/AppSidebar';
import ModuloGuard from '@/components/planos/ModuloGuard';

function rotaProtegida(rota: string) {
  return render(
    <MemoryRouter initialEntries={[rota]}>
      <Routes>
        <Route path="/aplicacoes" element={<ModuloGuard modulo="aplicacoes"><p>conteúdo das aplicações</p></ModuloGuard>} />
        <Route path="/precos" element={<p>página de preços</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function menu() {
  return render(
    <MemoryRouter initialEntries={['/hoje']}>
      <TooltipProvider>
        <AppSidebar collapsed={false} onToggle={() => {}} />
      </TooltipProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.plano = null;
  h.carregando = false;
  h.superAdmin = false;
});
afterEach(() => cleanup());

describe('Aplicações e laudo só para plano pago', () => {
  it('o módulo existe no catálogo e não faz parte da base grátis', () => {
    expect(MODULOS_CATALOGO.aplicacoes).toMatch(/Aplicações/);
    expect(MODULOS_FREE).not.toContain('aplicacoes');
  });

  it('sem assinatura, a rota das aplicações leva para os preços', () => {
    rotaProtegida('/aplicacoes');
    expect(screen.getByText('página de preços')).toBeInTheDocument();
    expect(screen.queryByText('conteúdo das aplicações')).not.toBeInTheDocument();
  });

  it('plano sem o módulo também leva para os preços', () => {
    h.plano = { modulos: ['agenda', 'pacientes', 'myid'] };
    rotaProtegida('/aplicacoes');
    expect(screen.getByText('página de preços')).toBeInTheDocument();
  });

  it('plano que inclui o módulo abre as aplicações', () => {
    h.plano = { modulos: ['agenda', 'pacientes', 'aplicacoes'] };
    rotaProtegida('/aplicacoes');
    expect(screen.getByText('conteúdo das aplicações')).toBeInTheDocument();
  });

  it('o dono do produto entra mesmo sem plano', () => {
    h.superAdmin = true;
    rotaProtegida('/aplicacoes');
    expect(screen.getByText('conteúdo das aplicações')).toBeInTheDocument();
  });

  it('enquanto carrega o plano, não redireciona nem mostra o conteúdo', () => {
    h.carregando = true;
    rotaProtegida('/aplicacoes');
    expect(screen.queryByText('página de preços')).not.toBeInTheDocument();
    expect(screen.queryByText('conteúdo das aplicações')).not.toBeInTheDocument();
  });

  it('o menu esconde "Aplicações" sem o módulo e mostra com ele', () => {
    const { unmount } = menu();
    expect(screen.queryByRole('link', { name: /Aplicações/ })).not.toBeInTheDocument();
    unmount();

    h.plano = { modulos: ['agenda', 'pacientes', 'aplicacoes'] };
    menu();
    expect(screen.getByRole('link', { name: /Aplicações/ })).toHaveAttribute('href', '/aplicacoes');
  });

  it('o menu mostra "Aplicações" ao dono do produto mesmo sem plano', () => {
    h.superAdmin = true;
    menu();
    expect(screen.getByRole('link', { name: /Aplicações/ })).toBeInTheDocument();
  });

  it('todas as rotas das aplicações passam pela guarda do módulo', () => {
    const app = readFileSync(resolve(__dirname, '../App.tsx'), 'utf8');
    for (const caminho of ['/aplicacoes', '/pacientes/:id/dinamometria', '/pacientes/:id/dinamometria/treino', '/dinamometria', '/dosagem', '/analise-angular']) {
      const linha = app.split('\n').find((l) => l.includes(`path="${caminho}"`));
      expect(linha, `rota ${caminho}`).toBeDefined();
      expect(linha, `rota ${caminho}`).toContain('<ModuloGuard modulo="aplicacoes">');
    }
  });

  it('a migração acrescenta o módulo só aos planos pagos ativos e é idempotente', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/20261018220000_modulo_aplicacoes_planos.sql'), 'utf8');
    expect(sql).toMatch(/update public\.planos/i);
    expect(sql).toMatch(/where ativo/i);
    expect(sql).toMatch(/preco_mensal > 0/);
    expect(sql).toMatch(/not \(modulos \? 'aplicacoes'\)/);
  });
});
