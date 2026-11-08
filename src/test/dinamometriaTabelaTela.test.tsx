import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';

const h = vi.hoisted(() => ({ banco: null as unknown as BancoFalso }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (t: string) => h.banco.from(t), rpc: (n: string, a?: Record<string, unknown>) => h.banco.rpc(n, a), functions: { invoke: vi.fn() } } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1' }, profile: { nome: 'Rafael' } }) }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn(), warning: vi.fn() }) }));

// O jsdom não tem ResizeObserver (os gráficos da página precisam dele).
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

import Dinamometria from '@/pages/Dinamometria';
import { analisarCurva, curvaSimulada, CRITERIOS_PADRAO, SLOTS, type Slot } from '@/lib/dinamometria/analise';

// Os picos do laudo do Rafael: quadríceps D 51,2 e E 65,7; posteriores D 51,3 e E 39,9 (esquerdo acometido).
const PICOS: Record<Slot, number> = { agD: 51.2, agE: 65.7, anD: 51.3, anE: 39.9 };

function sessao(ausentes: Slot[] = []) {
  const slots: Record<string, unknown> = {};
  SLOTS.forEach((k, j) => {
    if (ausentes.includes(k)) return;
    const c = curvaSimulada(PICOS[k], 8, 999 + j * 31);
    const res = analisarCurva(c.t, c.f, CRITERIOS_PADRAO.platoMin);
    if ('metricas' in res) slots[k] = { arquivo: `exemplo_${k}.xlsx (simulado)`, metricas: res.metricas, curva: res.curva };
  });
  return {
    versao: 2,
    sujeito: { idade: 24, sexo: 'M', peso: 87, dominante: 'E', acometido: 'E', modalidade: 'Futebol', sintomas: '' },
    movimentos: [{ regiao: 'joelho', braco: 36, slots }],
  };
}

async function abrirResultado(ausentes: Slot[] = []) {
  h.banco = criarBancoFalso({
    pacientes: [{ id: 'p1', nome: 'Gustavo', sobrenome: 'Souza Mello', data_nascimento: '2002-01-01', sexo: 'M', genero: null } as Linha],
    exames_presenciais: [{ id: 'e1', paciente_id: 'p1', tipo: 'dinamometria', data_exame: '2026-10-05', created_at: '2026-10-05T10:00:00Z', dados: { analise: sessao(ausentes), observacoes: '' } } as Linha],
  } as never);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <MemoryRouter initialEntries={['/dinamometria/p1?exame=e1']}>
          <Routes><Route path="/dinamometria/:id" element={<Dinamometria />} /></Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole('button', { name: /Ver detalhes técnicos/ }));
  const titulo = await screen.findByText(/^Métricas · Joelho/);
  const tabela = (titulo.closest('div.p-4, [class*="p-4"]') as HTMLElement).querySelector('table') as HTMLTableElement;
  expect(tabela).toBeTruthy();
  return tabela;
}

const linhasDoCorpo = (t: HTMLTableElement) => Array.from(t.querySelectorAll('tbody tr')) as HTMLTableRowElement[];
// A coluna da razão é a 4ª (índice 3) nas linhas que a têm; nas linhas cobertas por um espaço de duas linhas ela não existe.
const celulaDaRazao = (tr: HTMLTableRowElement, nCelulasCompleta: number) => (tr.cells.length === nCelulasCompleta ? tr.cells[3] : null);

describe('dinamometria (tela): coluna da razão antagonista/agonista com um espaço para cada lado', () => {
  it('com os dois lados: o D ocupa as duas primeiras linhas e o E as duas últimas', async () => {
    const t = await abrirResultado();
    const linhas = linhasDoCorpo(t);
    expect(linhas).toHaveLength(4);
    const completa = Math.max(...linhas.map((l) => l.cells.length));
    // Quadríceps D e Posteriores D abrem um espaço de duas linhas; Quadríceps E e Posteriores E ficam sem a célula da razão.
    expect(linhas.map((l) => l.cells.length)).toEqual([completa, completa - 1, completa, completa - 1]);
    const d = celulaDaRazao(linhas[0], completa)!;
    const e = celulaDaRazao(linhas[2], completa)!;
    expect(d.rowSpan).toBe(2);
    expect(e.rowSpan).toBe(2);
    expect(within(d).getByText('Direito')).toBeTruthy();
    expect(within(e).getByText('Esquerdo')).toBeTruthy();
    expect(within(d).getByText(/^\d+%$/)).toBeTruthy();
    expect(within(e).getByText(/^\d+%$/)).toBeTruthy();
    // O D fica acima do E na ordem do documento.
    expect(d.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('o que cada espaço mostra é a razão do próprio lado (D ≈ 100%, E ≈ 61%, como no laudo)', async () => {
    const t = await abrirResultado();
    const linhas = linhasDoCorpo(t);
    const completa = Math.max(...linhas.map((l) => l.cells.length));
    const pct = (td: HTMLElement) => Number((within(td).getByText(/^\d+%$/).textContent || '').replace('%', ''));
    expect(pct(celulaDaRazao(linhas[0], completa)!)).toBeGreaterThanOrEqual(95);
    expect(pct(celulaDaRazao(linhas[2], completa)!)).toBeGreaterThanOrEqual(58);
    expect(pct(celulaDaRazao(linhas[2], completa)!)).toBeLessThanOrEqual(64);
  });

  it('com razão só de um lado (antagonista esquerdo não medido), o D ocupa as três linhas e não há espaço do E', async () => {
    const t = await abrirResultado(['anE']);
    const linhas = linhasDoCorpo(t);
    expect(linhas).toHaveLength(3);
    const completa = Math.max(...linhas.map((l) => l.cells.length));
    expect(linhas.map((l) => l.cells.length)).toEqual([completa, completa - 1, completa - 1]);
    const d = celulaDaRazao(linhas[0], completa)!;
    expect(d.rowSpan).toBe(3);
    expect(within(d).getByText('Direito')).toBeTruthy();
    expect(within(t).queryByText('Esquerdo')).toBeNull();
  });

  it('sem razão em nenhum lado (agonistas não medidos), as linhas do antagonista mostram "—" e todas têm o mesmo número de células', async () => {
    const t = await abrirResultado(['agD', 'agE']);
    const linhas = linhasDoCorpo(t);
    expect(linhas).toHaveLength(2);
    expect(new Set(linhas.map((l) => l.cells.length)).size).toBe(1);
    for (const l of linhas) {
      expect(l.cells[3].rowSpan).toBe(1);
      expect(l.cells[3].textContent).toBe('—');
    }
  });
});
