import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';
import { envolverBanco, type BancoEnvolvido } from './helpers/bancoFalsoLeitura';

const h = vi.hoisted(() => ({ falso: null as unknown as BancoFalso, banco: null as unknown as BancoEnvolvido, invocar: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (t: string) => h.banco.from(t),
    rpc: (n: string, a?: Record<string, unknown>) => h.banco.rpc(n, a),
    functions: { invoke: (...a: unknown[]) => h.invocar(...a) },
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'prof-1' } } }) },
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1' } }) }));
vi.mock('@/hooks/useLenteAtiva', async () => {
  const real = await vi.importActual<typeof import('@/hooks/useLenteAtiva')>('@/hooks/useLenteAtiva');
  return { ...real, useLenteAtiva: () => ({ data: { id: 'fisioterapeuta', blocos_ativos: ['voz', 'avatar'] } }) };
});
vi.mock('@/components/presencial/Body3DAvatar', () => ({
  REGIONS: [{ id: 'joelho_d', label: 'Joelho direito', view: 'front' }, { id: 'cavo_d', label: 'Poplíteo direito', view: 'back' }],
  STRUCTURES: {},
}));
vi.mock('@/components/presencial/MyIDResumoInline', () => ({ default: () => null }));
vi.mock('@/components/presencial/SafetyBanner', () => ({ default: () => null }));
vi.mock('@/components/presencial/ProtocoloAtivoResumo', () => ({ default: () => null }));
vi.mock('@/components/presencial/FechamentoSessaoForm', () => ({ default: () => null }));

import ResumoConsultaPresencial from '@/components/presencial/ResumoConsultaPresencial';
import VoiceAssessment from '@/components/voice/VoiceAssessment';

// INVESTIGAÇÃO: a mesma região podia entrar duas vezes no Avatar na mesma análise?
// Sim, quando a nova avaliação é feita pelo ResumoConsultaPresencial. Duas vias gravam em eventos_clinicos_anatomicos:
//  1. ResumoConsultaPresencial.handlePainExtracted grava as regiões de dor que a IA extraiu (VoiceAssessment chamava sem
//     esperar terminar);
//  2. o auto-avatar do VoiceAssessment grava as regiões achadas por palavra-chave ("joelho direito" -> joelho_d + cavo_d).
//     Com onPainExtracted ele deixa de fora as regiões de dor da IA, mas a palavra-chave coincide com elas, e a única defesa
//     é ler as regiões ativas do banco antes de inserir. Essa leitura saía ANTES de a via 1 gravar, não via a região e
//     inseria de novo (a tabela não tem UNIQUE em paciente/região). Agora o VoiceAssessment espera a via 1 terminar.

const TEXTO = 'Paciente relata dor no joelho direito há duas semanas, piora ao descer escadas e ao agachar.';

const regioesGravadas = () => (h.falso.tabelas.eventos_clinicos_anatomicos ?? []).map((e) => e.regiao_id as string).sort();

function preparar(tabelas: Record<string, Linha[]> = {}) {
  h.falso = criarBancoFalso(tabelas);
  h.banco = envolverBanco(h.falso);
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});

beforeEach(() => {
  // O VoiceAssessment guarda rascunho do texto no navegador; o de um teste não pode abrir o do próximo já na revisão.
  localStorage.clear();
  sessionStorage.clear();
  h.invocar.mockReset();
  h.invocar.mockImplementation(async (nome: string) => {
    if (nome === 'voice-assessment') {
      return {
        data: { assessment: { queixa_principal: 'Dor no joelho', resumo_clinico: 'Dor no joelho direito.', classificacao_severidade: 'Moderada', dor: { intensidade_eva: 6 } }, avatar_events: [] },
        error: null,
      };
    }
    if (nome === 'extract-pain-from-voice') {
      return { data: { findings: [{ region_id: 'joelho_d', intensity: 6, structures: ['menisco'] }] }, error: null };
    }
    return { data: null, error: null };
  });
  preparar();
});

// Digita o relato, vai para a revisão e pede a avaliação; espera a avaliação ser salva (é o último passo do processamento).
async function analisar(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
  fireEvent.change(await screen.findByPlaceholderText(/Cole ou digite a transcrição aqui/), { target: { value: TEXTO } });
  fireEvent.click(await screen.findByRole('button', { name: /Revisar antes de processar/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Gerar Avaliação/ }));
  await waitFor(() => expect(h.falso.tabelas.avaliacoes_voz ?? []).toHaveLength(1), { timeout: 4000 });
  await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
  return qc;
}
const viaResumo = <ResumoConsultaPresencial pacienteId="pac-1" patientName="Ana" />;
const viaVoz = <VoiceAssessment serviceType="identidade" pacienteId="pac-1" patientName="Ana" mode="voice" />;

describe('Avatar: a mesma região não entra duas vezes na mesma análise', () => {
  it('pelo Resumo da consulta presencial (dois caminhos gravam): joelho_d uma vez só, e o poplíteo que só a palavra-chave achou entra', async () => {
    await analisar(viaResumo);
    expect(regioesGravadas()).toEqual(['cavo_d', 'joelho_d']);
  });

  it('mesmo com a gravação das regiões de dor demorando mais que a leitura (rede lenta)', async () => {
    h.falso.antesDeEscrever(async (op) => { if (op.tabela === 'eventos_clinicos_anatomicos') await new Promise((r) => setTimeout(r, 60)); });
    await analisar(viaResumo);
    expect(regioesGravadas()).toEqual(['cavo_d', 'joelho_d']);
  });

  it('o achado de dor da IA é o que fica para joelho_d (entra pendente de revisão, como relato do paciente)', async () => {
    await analisar(viaResumo);
    const joelho = (h.falso.tabelas.eventos_clinicos_anatomicos ?? []).filter((e) => e.regiao_id === 'joelho_d');
    expect(joelho).toHaveLength(1);
    expect(joelho[0]).toMatchObject({ origem: 'voz_ia', tipo_diagnostico: 'relato_paciente', status: 'ativo', visivel_paciente: false });
    expect(joelho[0].estrutura).toBe('menisco');
  });

  it('região que já tem achado ATIVO no Avatar não é gravada de novo por nenhuma das duas vias', async () => {
    preparar({
      eventos_clinicos_anatomicos: [{ id: 'ev-0', paciente_id: 'pac-1', regiao_id: 'joelho_d', status: 'ativo', sistema: 'musculoesqueletico' }],
    });
    await analisar(viaResumo);
    expect(regioesGravadas()).toEqual(['cavo_d', 'joelho_d']);
    expect((h.falso.tabelas.eventos_clinicos_anatomicos ?? []).filter((e) => e.regiao_id === 'joelho_d')).toHaveLength(1);
  });

  it('região RESOLVIDA volta como UM achado novo (resolvido não conta como duplicata, mas a análise também não duplica)', async () => {
    preparar({
      eventos_clinicos_anatomicos: [{ id: 'ev-0', paciente_id: 'pac-1', regiao_id: 'joelho_d', status: 'resolvido', sistema: 'musculoesqueletico' }],
    });
    await analisar(viaResumo);
    const joelho = (h.falso.tabelas.eventos_clinicos_anatomicos ?? []).filter((e) => e.regiao_id === 'joelho_d');
    expect(joelho.map((e) => e.status).sort()).toEqual(['ativo', 'resolvido']);
  });

  it('se gravar a região de dor falha, o auto-avatar ainda grava joelho_d (quem falhou não deixa a região sem achado)', async () => {
    h.falso.falharEscritaQuando((op) => op.tabela === 'eventos_clinicos_anatomicos' && Array.isArray(op.payload) === false, 'sem permissão');
    await analisar(viaResumo);
    expect(regioesGravadas()).toEqual(['cavo_d', 'joelho_d']);
  });

  it('pelo VoiceAssessment sozinho (sem onPainExtracted): a região de dor e a palavra-chave se juntam, joelho_d uma vez só', async () => {
    await analisar(viaVoz);
    expect(regioesGravadas()).toEqual(['cavo_d', 'joelho_d']);
  });
});
