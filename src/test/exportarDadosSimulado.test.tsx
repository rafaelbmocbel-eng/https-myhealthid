// Exportar todos os dados (src/pages/ExportarDados.tsx): as linhas 'simulado' de agente_disparos são ensaio do motor de
// mensagens (nenhuma mensagem saiu) e não podem entrar no backup. Banco falso, JSZip falso: nada vai à rede.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

type Linha = Record<string, unknown>;

const h = vi.hoisted(() => ({
  tabelas: {} as Record<string, Array<Record<string, unknown>>>,
  arquivos: {} as Record<string, string>,
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'T1', email: 'prof@exemplo.com' }, loading: false }) }));
vi.mock('@/components/AppLayout', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (tabela: string) => ({
      select: () => ({
        range: (de: number, ate: number) => Promise.resolve({ data: (h.tabelas[tabela] ?? []).slice(de, ate + 1), error: null }),
      }),
    }),
  },
}));
vi.mock('jszip', () => ({
  default: class {
    folder() {
      return { file: (nome: string, conteudo: string) => { h.arquivos[nome] = conteudo; } };
    }
    generateAsync() {
      return Promise.resolve(new Blob(['zip']));
    }
  },
}));

import ExportarDados from '@/pages/ExportarDados';

// A página percorre as ~120 tabelas uma a uma; com a suíte inteira rodando em paralelo isso passa dos 5 s padrão.
vi.setConfig({ testTimeout: 30_000 });

const disparo = (id: string, status: string, gatilho = 'aniversario'): Linha => ({ id, gatilho, status, conteudo: `texto ${id}` });

async function exportar() {
  render(<MemoryRouter><ExportarDados /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: /Exportar tudo/ }));
  await screen.findByText('Concluído', {}, { timeout: 10_000 });
}

beforeEach(() => {
  h.tabelas = {};
  h.arquivos = {};
  URL.createObjectURL = vi.fn(() => 'blob:falso');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ExportarDados e as linhas simuladas de agente_disparos', () => {
  it('o CSV de agente_disparos não leva as linhas "simulado", só as que de fato saíram ou falharam', async () => {
    h.tabelas.agente_disparos = [
      disparo('d1', 'enviado'),
      disparo('d2', 'simulado', 'simulado:aniversario'),
      disparo('d3', 'erro', 'myid_vencido'),
      disparo('d4', 'simulado', 'simulado:reengajamento'),
      disparo('d5', 'enviando', 'broadcast'),
    ];
    await exportar();
    const csv = h.arquivos['agente_disparos.csv'];
    const linhas = csv.replace('﻿', '').split('\n');
    expect(linhas).toHaveLength(4);
    expect(csv).toContain('texto d1');
    expect(csv).toContain('texto d3');
    expect(csv).toContain('texto d5');
    expect(csv).not.toContain('texto d2');
    expect(csv).not.toContain('texto d4');
    expect(csv).not.toContain('simulado');
  });

  it('a contagem do manifesto e da tela também descontam as simuladas', async () => {
    h.tabelas.agente_disparos = [disparo('d1', 'enviado'), disparo('d2', 'simulado'), disparo('d3', 'simulado')];
    await exportar();
    const manifesto = JSON.parse(h.arquivos['_manifest.json']) as { tables: Array<{ table: string; rows: number }>; total_rows: number };
    expect(manifesto.tables.find((t) => t.table === 'agente_disparos')?.rows).toBe(1);
    expect(manifesto.total_rows).toBe(1);
    expect(screen.getByText('agente_disparos').parentElement?.parentElement).toHaveTextContent('1 linhas');
  });

  it('só com linhas simuladas a tabela não gera arquivo', async () => {
    h.tabelas.agente_disparos = [disparo('d1', 'simulado'), disparo('d2', 'simulado')];
    await exportar();
    expect(h.arquivos).not.toHaveProperty('agente_disparos.csv');
    const manifesto = JSON.parse(h.arquivos['_manifest.json']) as { tables: Array<{ table: string; rows: number }> };
    expect(manifesto.tables.find((t) => t.table === 'agente_disparos')?.rows).toBe(0);
  });

  it('outras tabelas seguem inteiras, mesmo com a palavra "simulado" no status', async () => {
    h.tabelas.agente_broadcasts = [{ id: 'b1', status: 'simulado', titulo: 'Campanha' }];
    h.tabelas.pacientes = [{ id: 'p1', nome: 'Marina' }];
    await exportar();
    expect(h.arquivos['agente_broadcasts.csv']).toContain('Campanha');
    expect(h.arquivos['pacientes.csv']).toContain('Marina');
  });
});
