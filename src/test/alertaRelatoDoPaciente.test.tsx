import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const banco = vi.hoisted(() => ({ linha: null as unknown, filtros: [] as unknown[][] }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => {
      expect(tabela).toBe('avaliacoes_voz');
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.eq = (...a: unknown[]) => { banco.filtros.push(['eq', ...a]); return c; };
      c.filter = (...a: unknown[]) => { banco.filtros.push(['filter', ...a]); return c; };
      c.order = () => c;
      c.limit = () => c;
      c.maybeSingle = () => Promise.resolve({ data: banco.linha, error: null });
      return c;
    },
  },
}));

import AlertaRelatoDoPaciente from '@/components/voice/AlertaRelatoDoPaciente';

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><AlertaRelatoDoPaciente pacienteId="pac-1" /></QueryClientProvider>);
}

beforeEach(() => { banco.linha = null; banco.filtros = []; });

describe('AlertaRelatoDoPaciente', () => {
  it('mostra os sinais de alerta que o paciente relatou, com a data, e diz que ainda não foram confirmados', async () => {
    banco.linha = { created_at: '2026-10-07T23:59:18Z', resultado: { red_flags: ['Dor noturna sem alívio', 'Fraqueza progressiva nas pernas'] } };
    montar();
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toContain('O paciente relatou sinais de alerta no portal');
    expect(alerta.textContent).toContain('Dor noturna sem alívio');
    expect(alerta.textContent).toContain('Fraqueza progressiva nas pernas');
    expect(alerta.textContent).toContain('sem confirmação clínica');
    expect(alerta.textContent).toMatch(/07\/10\/26/);
  });

  it('lê só o relato do paciente: filtra pela origem do portal, do paciente certo', async () => {
    banco.linha = { created_at: '2026-10-07T23:59:18Z', resultado: { red_flags: ['Febre persistente'] } };
    montar();
    await screen.findByRole('alert');
    expect(banco.filtros).toContainEqual(['eq', 'paciente_id', 'pac-1']);
    expect(banco.filtros).toContainEqual(['filter', 'resultado->_meta->>origem', 'in', '(portal_paciente_historia,autocadastro_paciente)']);
  });

  it('não aparece quando não há relato, quando não há alerta ou quando a IA só disse que não há alerta', async () => {
    const { container, rerender } = montar();
    await waitFor(() => expect(banco.filtros.length).toBeGreaterThan(0));
    expect(container).toBeEmptyDOMElement();

    banco.linha = { created_at: '2026-10-07T23:59:18Z', resultado: { red_flags: ['Nenhum red flag identificado'] } };
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    rerender(<QueryClientProvider client={qc}><AlertaRelatoDoPaciente pacienteId="pac-2" /></QueryClientProvider>);
    await waitFor(() => expect(banco.filtros.length).toBeGreaterThan(2));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
