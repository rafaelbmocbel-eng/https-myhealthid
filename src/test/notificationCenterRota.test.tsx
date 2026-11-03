import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  marcarLida: vi.fn(),
  notificacoes: [] as Record<string, unknown>[],
}));

vi.mock('react-router-dom', async (importar) => ({
  ...(await importar<typeof import('react-router-dom')>()),
  useNavigate: () => h.navigate,
}));
vi.mock('@/hooks/useNotificacoes', () => ({
  useNotificacoes: () => ({
    notificacoes: h.notificacoes,
    naoLidas: h.notificacoes.length,
    marcarLida: { mutate: h.marcarLida },
    marcarTodasLidas: { mutate: vi.fn() },
    gerarAlertas: { mutate: vi.fn() },
  }),
}));

import NotificationCenter from '@/components/NotificationCenter';

const notificacao = (id: string, tipo: string, titulo: string, rota: string | null) => ({
  id, tipo, titulo, descricao: 'descrição', lida: false, rota, metadata: {}, created_at: new Date().toISOString(),
});

const abrirEClicar = (titulo: string) => {
  render(<MemoryRouter><NotificationCenter /></MemoryRouter>);
  fireEvent.click(screen.getAllByRole('button')[0]);
  fireEvent.click(screen.getByText(titulo).closest('button')!);
};

describe('NotificationCenter: para onde o clique leva', () => {
  beforeEach(() => { h.navigate.mockClear(); h.marcarLida.mockClear(); });
  afterEach(cleanup);

  it('o alerta do check-in leva ao perfil do cliente (/pacientes/<id>) e marca como lida', () => {
    h.notificacoes = [notificacao('n1', 'checkin_alerta', 'Check-in: atenção com Ana', '/pacientes/abc-123')];
    abrirEClicar('Check-in: atenção com Ana');
    expect(h.marcarLida).toHaveBeenCalledWith('n1');
    expect(h.navigate).toHaveBeenCalledWith('/pacientes/abc-123');
  });

  it('rota com consulta no perfil do cliente (/pacientes/<id>?tab=...) também vale', () => {
    h.notificacoes = [notificacao('n2', 'geral', 'Cliente contou o caso', '/pacientes/abc-123?tab=acompanhamento')];
    abrirEClicar('Cliente contou o caso');
    expect(h.navigate).toHaveBeenCalledWith('/pacientes/abc-123?tab=acompanhamento');
  });

  it('rotas do PORTAL do cliente (/paciente/...) continuam barradas: o profissional vai para o destino padrão do tipo', () => {
    h.notificacoes = [notificacao('n3', 'consulta', 'Consulta amanhã', '/paciente/diario')];
    abrirEClicar('Consulta amanhã');
    expect(h.navigate).toHaveBeenCalledWith('/agenda');
    expect(h.navigate).not.toHaveBeenCalledWith('/paciente/diario');
  });

  it('rota do portal sem destino padrão: marca como lida e não navega', () => {
    h.notificacoes = [notificacao('n4', 'checkin_alerta', 'Alerta sem rota boa', '/paciente')];
    abrirEClicar('Alerta sem rota boa');
    expect(h.marcarLida).toHaveBeenCalledWith('n4');
    expect(h.navigate).not.toHaveBeenCalled();
  });
});
