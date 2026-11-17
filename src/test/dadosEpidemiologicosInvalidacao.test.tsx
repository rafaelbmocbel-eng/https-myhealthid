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
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn(), warning: vi.fn() }) }));
vi.mock('@/components/presencial/Body3DAvatar', () => ({ REGIONS: [], STRUCTURES: {} }));
vi.mock('@/components/presencial/MyIDResumoInline', () => ({ default: () => null }));
vi.mock('@/components/presencial/SafetyBanner', () => ({ default: () => null }));
vi.mock('@/components/presencial/ProtocoloAtivoResumo', () => ({ default: () => null }));
vi.mock('@/components/presencial/FechamentoSessaoForm', () => ({ default: () => null }));

import AvaliacaoVozAtual from '@/components/voice/AvaliacaoVozAtual';
import AvaliacoesVozHistorico from '@/components/voice/AvaliacoesVozHistorico';
import VoiceAssessment from '@/components/voice/VoiceAssessment';
import ResumoConsultaPresencial from '@/components/presencial/ResumoConsultaPresencial';
import { invalidarCachesAvaliacaoVoz } from '@/utils/voiceAssessment/reprocessarComplemento';

// A Home mostra "Dados epidemiológicos" (consulta ['research-data', usuário], 30 s de staleTime) com a contagem de avaliações
// e a severidade. Criar, refazer ou excluir uma avaliação precisa marcar essa consulta como velha; senão o número novo só
// aparece depois de 30 s e com a Home remontada. A chave é pelo prefixo ['research-data'] (quem grava não sabe a chave do
// usuário). Num navegador só existe a consulta de quem está logado; a de outro tipo de dado não pode ser tocada.

const CHAVE = ['research-data', 'prof-1'];
const OUTRAS = [['research-data-outro'], ['pacientes', 'prof-1'], ['fontes-clinicas', 'pac-2', 'prof-1']];

function novoCliente(): QueryClient {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 }, mutations: { retry: false } } });
  for (const chave of [CHAVE, ...OUTRAS]) qc.setQueryData(chave, { dado: 'em cache' });
  return qc;
}
const invalidada = (qc: QueryClient, chave: readonly unknown[]) => qc.getQueryState(chave)?.isInvalidated === true;
async function esperarInvalidada(qc: QueryClient) {
  await waitFor(() => expect(invalidada(qc, CHAVE)).toBe(true));
  for (const outra of OUTRAS) expect(invalidada(qc, outra), outra.join('/')).toBe(false);
}
async function esperarSemInvalidar(qc: QueryClient) {
  await act(async () => { await new Promise((r) => setTimeout(r, 120)); });
  expect(invalidada(qc, CHAVE)).toBe(false);
}
const comPaciente = (qc: QueryClient, ui: ReactElement) => render(<QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);

const resultado = (): Linha => ({
  resumo_clinico: 'Paciente com dor lombar crônica há 6 meses, piora ao sentar.',
  classificacao_severidade: 'Moderada',
  queixa_principal: 'Dor lombar crônica',
  soap: { subjetivo: 'Dor ao sentar.', objetivo: 'Lasègue positivo.', avaliacao: 'Sobrecarga lombar.', plano: 'Exercícios' },
  dor: { localizacao: 'Lombar', intensidade_eva: 7, tipo: 'Mista' },
  _meta: { mode: 'voice', savedAt: 's1' },
  _secoes: { confirmadas: ['resumo_clinico', 'dor'], editadas: {} },
});
const avaliacao = (extra: Linha = {}): Linha => ({
  id: 'av-1', paciente_id: 'pac-1', terapeuta_id: 'prof-1', created_at: '2026-10-05T12:00:00+00:00', queixa_principal: 'Dor lombar', servico: 'identidade',
  classificacao_severidade: 'Moderada', transcricao: 'Relato inicial.', resultado: resultado(), ...extra,
});

function preparar(tabelas: Record<string, Linha[]> = {}) {
  h.falso = criarBancoFalso(tabelas);
  h.banco = envolverBanco(h.falso);
}

let iaFalha: boolean;
beforeAll(() => {
  class EventoDePonteiro extends MouseEvent {
    pointerType: string; pointerId: number;
    constructor(tipo: string, init: PointerEventInit = {}) { super(tipo, init); this.pointerType = init.pointerType ?? 'mouse'; this.pointerId = init.pointerId ?? 1; }
  }
  Object.defineProperty(window, 'PointerEvent', { configurable: true, writable: true, value: EventoDePonteiro });
  Object.assign(Element.prototype, { hasPointerCapture: () => false, setPointerCapture: () => {}, releasePointerCapture: () => {} });
  Element.prototype.scrollIntoView = vi.fn();
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  iaFalha = false;
  h.invocar.mockReset();
  h.invocar.mockImplementation(async (nome: string) => {
    if (nome === 'voice-assessment') {
      if (iaFalha) return { data: null, error: new Error('IA fora do ar') };
      return { data: { assessment: { ...resultado(), _meta: { mode: 'voice', savedAt: 'IA' }, resumo_clinico: 'Resumo refeito pela IA.' }, avatar_events: [] }, error: null };
    }
    if (nome === 'extract-pain-from-voice') return { data: { findings: [] }, error: null };
    return { data: null, error: null };
  });
  vi.stubGlobal('confirm', () => true);
  preparar({ avaliacoes_voz: [avaliacao()], notas_prontuario: [] });
});

describe('Dados epidemiológicos: o ajudante que as telas de avaliação usam', () => {
  it('invalida a consulta da Home (prefixo, qualquer usuário) e não toca em consulta de outro dado nem de outro paciente', async () => {
    const qc = novoCliente();
    invalidarCachesAvaliacaoVoz(qc, 'pac-1');
    await esperarInvalidada(qc);
  });
});

describe('Dados epidemiológicos: excluir uma avaliação', () => {
  it('pelo histórico de avaliações', async () => {
    preparar({ avaliacoes_voz: [avaliacao(), avaliacao({ id: 'av-2', created_at: '2026-10-06T12:00:00+00:00' })] });
    const qc = novoCliente();
    comPaciente(qc, <AvaliacoesVozHistorico pacienteId="pac-1" patientName="Ana" />);
    fireEvent.click((await screen.findAllByTitle(/Excluir/))[0]);
    await esperarInvalidada(qc);
    expect(h.falso.tabelas.avaliacoes_voz).toHaveLength(1);
  });

  it('pelo histórico, se o banco recusa excluir, nada é invalidado', async () => {
    preparar({ avaliacoes_voz: [avaliacao(), avaliacao({ id: 'av-2', created_at: '2026-10-06T12:00:00+00:00' })] });
    h.falso.falharEscritaQuando((op) => op.tabela === 'avaliacoes_voz', 'sem permissão');
    const qc = novoCliente();
    comPaciente(qc, <AvaliacoesVozHistorico pacienteId="pac-1" patientName="Ana" />);
    fireEvent.click((await screen.findAllByTitle(/Excluir/))[0]);
    await esperarSemInvalidar(qc);
    expect(h.falso.tabelas.avaliacoes_voz).toHaveLength(2);
  });

  it('pela avaliação atual', async () => {
    const qc = novoCliente();
    comPaciente(qc, <AvaliacaoVozAtual pacienteId="pac-1" patientName="Ana" />);
    fireEvent.click(await screen.findByTitle('Excluir esta avaliação'));
    await esperarInvalidada(qc);
    expect(h.falso.tabelas.avaliacoes_voz).toHaveLength(0);
  });

  it('pela avaliação atual, se o banco recusa excluir, nada é invalidado', async () => {
    h.falso.falharEscritaQuando((op) => op.tabela === 'avaliacoes_voz' && op.tipo === 'delete', 'sem permissão');
    const qc = novoCliente();
    comPaciente(qc, <AvaliacaoVozAtual pacienteId="pac-1" patientName="Ana" />);
    fireEvent.click(await screen.findByTitle('Excluir esta avaliação'));
    await esperarSemInvalidar(qc);
    expect(h.falso.tabelas.avaliacoes_voz).toHaveLength(1);
  });
});

describe('Dados epidemiológicos: refazer a avaliação (a severidade pode mudar)', () => {
  async function editarOResumoESalvar() {
    await screen.findByText('Resumo Clínico');
    fireEvent.click(screen.getByTitle('Editar texto'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Resumo reescrito pelo profissional.' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));
  }

  it('editar uma seção refaz o plano com sucesso e a consulta da Home fica velha', async () => {
    const qc = novoCliente();
    comPaciente(qc, <AvaliacaoVozAtual pacienteId="pac-1" patientName="Ana" />);
    await editarOResumoESalvar();
    await esperarInvalidada(qc);
    expect(h.falso.tabelas.avaliacoes_voz[0].resultado._meta.savedAt).not.toBe('s1');
  });

  it('se a IA falha ao refazer o plano, nada mudou na avaliação e nada é invalidado', async () => {
    iaFalha = true;
    const qc = novoCliente();
    comPaciente(qc, <AvaliacaoVozAtual pacienteId="pac-1" patientName="Ana" />);
    await editarOResumoESalvar();
    await waitFor(() => expect(h.invocar).toHaveBeenCalledWith('voice-assessment', expect.anything()));
    await esperarSemInvalidar(qc);
    expect(h.falso.tabelas.avaliacoes_voz[0].resultado._meta.savedAt).toBe('s1');
  });
});

// Criar: o VoiceAssessment grava a avaliação (nova ou a que já existe) e só então avisa quem o chamou; o ResumoConsultaPresencial
// (nova avaliação do perfil) usa o mesmo VoiceAssessment, então o aviso dele já vem do salvamento e não precisa de outro.
describe('Dados epidemiológicos: criar uma avaliação', () => {
  const TEXTO = 'Paciente relata dor lombar há três semanas, piora ao ficar sentado e melhora ao caminhar devagar.';

  async function analisar(qc: QueryClient, ui: ReactElement, esperarGravar = true) {
    comPaciente(qc, ui);
    fireEvent.change(await screen.findByPlaceholderText(/Cole ou digite a transcrição aqui/), { target: { value: TEXTO } });
    fireEvent.click(await screen.findByRole('button', { name: /Revisar antes de processar/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Gerar Avaliação/ }));
    if (esperarGravar) await waitFor(() => expect(h.falso.tabelas.avaliacoes_voz.some((a) => a.id !== 'av-1')).toBe(true), { timeout: 4000 });
    else await waitFor(() => expect(h.invocar).toHaveBeenCalledWith('extract-pain-from-voice', expect.anything()), { timeout: 4000 });
  }
  const sozinho = <VoiceAssessment serviceType="identidade" pacienteId="pac-1" patientName="Ana" mode="voice" />;

  it('o VoiceAssessment grava a avaliação e a consulta da Home fica velha', async () => {
    const qc = novoCliente();
    await analisar(qc, sozinho);
    await esperarInvalidada(qc);
  });

  it('se o banco recusa gravar a avaliação, nada é invalidado', async () => {
    h.falso.falharEscritaQuando((op) => op.tabela === 'avaliacoes_voz', 'sem permissão');
    const qc = novoCliente();
    await analisar(qc, sozinho, false);
    await esperarSemInvalidar(qc);
    expect(h.falso.tabelas.avaliacoes_voz).toHaveLength(1);
  });

  it('nova avaliação pelo perfil (ResumoConsultaPresencial): o salvamento do VoiceAssessment já invalida', async () => {
    preparar({ avaliacoes_voz: [], notas_prontuario: [] });
    const qc = novoCliente();
    await analisar(qc, <ResumoConsultaPresencial pacienteId="pac-1" patientName="Ana" novaAvaliacaoPedida={0} />);
    await esperarInvalidada(qc);
  });
});
