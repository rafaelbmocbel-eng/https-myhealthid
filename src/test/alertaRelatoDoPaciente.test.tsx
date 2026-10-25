import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const banco = vi.hoisted(() => ({
  linhas: [] as Array<{ resultado: unknown; created_at: string }>,
  erro: null as { message: string } | null,
  chamadas: 0,
  filtros: [] as unknown[][],
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => {
      expect(tabela).toBe('avaliacoes_voz');
      banco.chamadas += 1;
      const c: Record<string, unknown> = {};
      c.select = () => c;
      c.eq = (...a: unknown[]) => { banco.filtros.push(['eq', ...a]); return c; };
      c.filter = (...a: unknown[]) => { banco.filtros.push(['filter', ...a]); return c; };
      c.order = (...a: unknown[]) => { banco.filtros.push(['order', ...a]); return c; };
      c.limit = (...a: unknown[]) => { banco.filtros.push(['limit', ...a]); return Promise.resolve({ data: banco.erro ? null : banco.linhas, error: banco.erro }); };
      return c;
    },
  },
}));

import AlertaRelatoDoPaciente from '@/components/voice/AlertaRelatoDoPaciente';

function montar(pacienteId = 'pac-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><AlertaRelatoDoPaciente pacienteId={pacienteId} /></QueryClientProvider>);
}

beforeEach(() => { banco.linhas = []; banco.erro = null; banco.chamadas = 0; banco.filtros = []; });

describe('AlertaRelatoDoPaciente', () => {
  it('mostra os sinais de alerta que o paciente relatou, com a data de cada relato, e diz que ainda não foram confirmados', async () => {
    banco.linhas = [{ created_at: '2026-10-07T23:59:18Z', resultado: { red_flags: ['Dor noturna sem alívio', 'Fraqueza progressiva nas pernas'] } }];
    montar();
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toContain('O paciente relatou sinais de alerta no portal');
    expect(alerta.textContent).toContain('Dor noturna sem alívio');
    expect(alerta.textContent).toContain('Fraqueza progressiva nas pernas');
    expect(alerta.textContent).toContain('sem confirmação clínica');
    expect(alerta.textContent).toMatch(/07\/10\/26/);
    expect(alerta.textContent).toContain('Prontuário > Histórico de avaliações por voz');
  });

  it('lê só relatos do paciente, do paciente certo, os 20 mais recentes', async () => {
    banco.linhas = [{ created_at: '2026-10-07T23:59:18Z', resultado: { red_flags: ['Febre persistente'] } }];
    montar();
    await screen.findByRole('alert');
    expect(banco.filtros).toContainEqual(['eq', 'paciente_id', 'pac-1']);
    expect(banco.filtros).toContainEqual(['filter', 'resultado->_meta->>origem', 'in', '(portal_paciente_historia,autocadastro_paciente)']);
    expect(banco.filtros).toContainEqual(['order', 'created_at', { ascending: false }]);
    expect(banco.filtros).toContainEqual(['limit', 20]);
  });

  it('um relato mais novo SEM alerta não apaga o alerta de um relato anterior', async () => {
    banco.linhas = [
      { created_at: '2026-10-09T10:00:00Z', resultado: { red_flags: [] } },
      { created_at: '2026-10-07T10:00:00Z', resultado: { red_flags: ['Perda de peso sem causa aparente'] } },
    ];
    montar();
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toContain('Perda de peso sem causa aparente');
    expect(alerta.textContent).toMatch(/07\/10\/26/);
  });

  it('o mesmo alerta em dois relatos aparece uma vez, com a data do mais recente', async () => {
    banco.linhas = [
      { created_at: '2026-10-09T10:00:00Z', resultado: { red_flags: ['Febre persistente'] } },
      { created_at: '2026-10-07T10:00:00Z', resultado: { red_flags: ['Febre persistente', 'Dor noturna'] } },
    ];
    montar();
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent?.match(/Febre persistente/g)).toHaveLength(1);
    expect(alerta.textContent).toMatch(/Febre persistente.*09\/10\/26/);
    expect(alerta.textContent).toMatch(/Dor noturna.*07\/10\/26/);
  });

  it('lê o relato do "Histórico clínico", que guarda a resposta da IA aninhada em assessment', async () => {
    banco.linhas = [{ created_at: '2026-10-07T23:59:18Z', resultado: { assessment: { red_flags: ['Fraqueza grave progressiva'] }, _meta: { origem: 'portal_paciente_historia' } } }];
    montar();
    expect((await screen.findByRole('alert')).textContent).toContain('Fraqueza grave progressiva');
  });

  it('não aparece sem relato, sem alerta, ou quando a IA só disse que não há alerta', async () => {
    banco.linhas = [
      { created_at: '2026-10-07T10:00:00Z', resultado: { red_flags: ['Nenhum red flag identificado'] } },
      { created_at: '2026-10-06T10:00:00Z', resultado: { red_flags: ['Não há sinais de alerta'] } },
    ];
    const { container } = montar();
    await waitFor(() => expect(banco.chamadas).toBeGreaterThan(0));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('erro ao ler o relato não vira "sem alerta": o profissional é avisado de que não deu para verificar', async () => {
    banco.erro = { message: 'boom' };
    montar();
    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('Não foi possível verificar');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
