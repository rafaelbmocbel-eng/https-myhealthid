import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  linha: null as null | { respostas: Record<string, unknown> },
  leituraFalha: false,
  upserts: [] as Record<string, unknown>[],
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('sonner', () => ({ toast: h.toast }));
vi.mock('@/integrations/supabase/client', () => {
  const dados = (tabela: string) => {
    if (tabela === 'nutricao_anamnese') {
      return h.leituraFalha ? { data: null, error: { message: 'rede' } } : { data: h.linha, error: null };
    }
    return { data: null, error: null };
  };
  const construtor = (tabela: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'order', 'limit']) b[m] = () => b;
    b.maybeSingle = () => Promise.resolve(dados(tabela));
    b.upsert = (valor: Record<string, unknown>) => {
      h.upserts.push(valor);
      return Promise.resolve({ error: null });
    };
    return b;
  };
  return { supabase: { from: (t: string) => construtor(t) } };
});

import AnamneseNutricionalCard from '../components/paciente/AnamneseNutricionalCard';

const triagemAntiga = { versao: 1, respondida_em: '2026-09-01T10:00:00Z', gestante_lactante: 'nao' };
const triagemNova = { versao: 1, respondida_em: '2026-10-07T10:00:00Z', gestante_lactante: 'sim' };

beforeEach(() => {
  h.linha = null;
  h.leituraFalha = false;
  h.upserts.length = 0;
  h.toast.success.mockReset();
  h.toast.error.mockReset();
});
afterEach(() => cleanup());

async function abrir() {
  render(<AnamneseNutricionalCard pacienteId="pac-1" />);
  fireEvent.click(await screen.findByText('Perguntas do plano nutricional'));
  return screen.findByRole('button', { name: /Salvar respostas/ });
}

describe('AnamneseNutricionalCard preserva a triagem de segurança', () => {
  it('não conta só a triagem como anamnese respondida', async () => {
    h.linha = { respostas: { triagem: triagemAntiga } };
    render(<AnamneseNutricionalCard pacienteId="pac-1" />);
    expect(await screen.findByText(/Peso, altura, idade e rotina/)).toBeInTheDocument();
  });

  it('relê a linha ao salvar: uma triagem gravada depois que a tela abriu não é apagada nem revertida', async () => {
    h.linha = { respostas: { objetivo: 'perder gordura', triagem: triagemAntiga } };
    const salvar = await abrir();

    // O cliente responde a triagem em outro card enquanto esta tela está aberta.
    h.linha = { respostas: { objetivo: 'perder gordura', triagem: triagemNova } };
    fireEvent.change(screen.getByPlaceholderText('Ex.: 72'), { target: { value: '80' } });
    fireEvent.click(salvar);

    await waitFor(() => expect(h.upserts).toHaveLength(1));
    const respostas = h.upserts[0].respostas as Record<string, unknown>;
    expect(respostas.triagem).toEqual(triagemNova);
    expect(respostas.peso_kg).toBe('80');
    expect(respostas.objetivo).toBe('perder gordura');
    expect(h.upserts[0].paciente_id).toBe('pac-1');
  });

  it('mantém chaves que outra tela gravou e que esta não conhece', async () => {
    h.linha = { respostas: { objetivo: 'x' } };
    const salvar = await abrir();
    h.linha = { respostas: { objetivo: 'x', campo_novo: 'valor', triagem: triagemNova } };
    fireEvent.click(salvar);

    await waitFor(() => expect(h.upserts).toHaveLength(1));
    expect(h.upserts[0].respostas).toMatchObject({ campo_novo: 'valor', triagem: triagemNova });
  });

  it('sem triagem salva, não inventa a chave', async () => {
    h.linha = { respostas: { objetivo: 'x' } };
    const salvar = await abrir();
    fireEvent.click(salvar);
    await waitFor(() => expect(h.upserts).toHaveLength(1));
    expect(h.upserts[0].respostas).not.toHaveProperty('triagem');
  });

  it('se não conseguir reler a linha, não grava (para não apagar a triagem)', async () => {
    h.linha = { respostas: { triagem: triagemAntiga } };
    const salvar = await abrir();
    h.leituraFalha = true;
    fireEvent.click(salvar);

    await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
    expect(h.upserts).toHaveLength(0);
  });
});
