import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
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
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn(), warning: vi.fn() }) }));
vi.mock('@/components/voice/VoiceAssessment', () => ({ default: () => <div>VoiceAssessment simulado</div> }));
vi.mock('@/components/presencial/Body3DAvatar', () => ({ REGIONS: [], STRUCTURES: {} }));

import AvaliacaoVozAtual from '@/components/voice/AvaliacaoVozAtual';
import AvaliacaoSecoesEditaveis from '@/components/voice/AvaliacaoSecoesEditaveis';

// Depois que o profissional edita uma seção, a avaliação é refeita (o plano muda) e o savedAt novo faz as seções remontarem
// (key do AvaliacaoVozAtual). O aviso "A avaliação mudou: Atualizar abas / Atualizar tratamento" ficava dentro das seções e
// sumia junto, justo quando o plano era refeito com sucesso. Agora a oferta fica no AvaliacaoVozAtual (que não remonta) e
// só sai quando o profissional aplica, dispensa ou muda de avaliação.

const AVISO = 'A avaliação mudou';

const resultado = (savedAt = 's1'): Linha => ({
  resumo_clinico: 'Paciente com dor lombar crônica há 6 meses, piora ao sentar.',
  classificacao_severidade: 'Moderada',
  queixa_principal: 'Dor lombar crônica',
  soap: { subjetivo: 'Dor ao sentar.', objetivo: 'Lasègue positivo.', avaliacao: 'Sobrecarga lombar.', plano: 'Exercícios' },
  dor: { localizacao: 'Lombar', intensidade_eva: 7, tipo: 'Mista' },
  _meta: { mode: 'voice', savedAt },
  _secoes: { confirmadas: ['resumo_clinico', 'dor'], editadas: {} },
});
const avaliacao = (extra: Linha = {}): Linha => ({
  id: 'av-1', paciente_id: 'pac-1', terapeuta_id: 'prof-1', created_at: '2026-10-05T12:00:00+00:00', queixa_principal: 'Dor lombar', servico: 'identidade',
  classificacao_severidade: 'Moderada', transcricao: 'Relato inicial do paciente.', resultado: resultado(), ...extra,
});

let qc: QueryClient;
// Segura a resposta da IA que refaz o plano até o teste liberar; assim o teste sabe o que a tela mostrava ANTES da remontagem.
let liberarIA: () => void;
let iaFalha: boolean;

function preparar(tabelas: Record<string, Linha[]>) {
  h.falso = criarBancoFalso(tabelas);
  h.banco = envolverBanco(h.falso);
}
function configurarFuncoes() {
  h.invocar.mockImplementation(async (nome: string) => {
    if (nome === 'voice-assessment') {
      if (iaFalha) return { data: null, error: new Error('IA fora do ar') };
      await new Promise<void>((ok) => { liberarIA = ok; });
      return { data: { assessment: { ...resultado('IA'), resumo_clinico: 'Resumo refeito pela IA.' } }, error: null };
    }
    if (nome === 'extract-pain-from-voice') return { data: { findings: [] }, error: null };
    if (nome === 'gerar-diretriz-clinica') {
      return { data: { ok: true, diretriz: { titulo: 'Plano novo', objetivo: 'Reduzir a dor lombar', fases: [] } }, error: null };
    }
    return { data: null, error: null };
  });
}
function montar(ui = <AvaliacaoVozAtual pacienteId="pac-1" patientName="Ana" />) {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
}

async function editarOResumoESalvar() {
  await screen.findByText('Resumo Clínico');
  fireEvent.click(screen.getByTitle('Editar texto'));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Resumo reescrito pelo profissional.' } });
  fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));
}
// O plano refeito grava o savedAt novo e a consulta da avaliação relê: a tela remonta e o texto do aviso vira outro nó do DOM.
async function terminarOReprocessamento() {
  await waitFor(() => expect(liberarIA).toBeTypeOf('function'));
  await act(async () => { liberarIA(); });
  await waitFor(() => expect(h.falso.tabelas.avaliacoes_voz[0].resultado._meta.savedAt).not.toBe('s1'));
}
const aviso = () => screen.queryByText(AVISO);

// Troca o resultado gravado e manda a tela reler (como fazem o complemento ou o plano refeito por outro caminho).
async function reprocessadoPorFora(savedAt: string) {
  const antes = screen.getByText('Resumo Clínico');
  h.falso.tabelas.avaliacoes_voz[0].resultado = resultado(savedAt);
  await act(async () => { await qc.invalidateQueries({ queryKey: ['avaliacao-voz-latest'] }); });
  await waitFor(() => expect(screen.getByText('Resumo Clínico')).not.toBe(antes));
}

const rolar = vi.fn();
beforeAll(() => {
  class EventoDePonteiro extends MouseEvent {
    pointerType: string; pointerId: number;
    constructor(tipo: string, init: PointerEventInit = {}) { super(tipo, init); this.pointerType = init.pointerType ?? 'mouse'; this.pointerId = init.pointerId ?? 1; }
  }
  Object.defineProperty(window, 'PointerEvent', { configurable: true, writable: true, value: EventoDePonteiro });
  Object.assign(Element.prototype, { hasPointerCapture: () => false, setPointerCapture: () => {}, releasePointerCapture: () => {} });
  Element.prototype.scrollIntoView = rolar;
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});
beforeEach(() => {
  h.invocar.mockReset();
  rolar.mockReset();
  iaFalha = false;
  liberarIA = undefined as unknown as () => void;
  configurarFuncoes();
  preparar({ avaliacoes_voz: [avaliacao()], notas_prontuario: [] });
});

describe('Aviso "Atualizar tratamento" depois de editar uma seção', () => {
  it('continua à vista quando o plano é refeito com sucesso e a tela remonta (savedAt novo)', async () => {
    montar();
    await editarOResumoESalvar();
    const antes = await screen.findByText(AVISO);
    await terminarOReprocessamento();

    // Remontou: o aviso é outro nó do DOM, e os dois botões continuam lá.
    await waitFor(() => expect(screen.getByText(AVISO)).not.toBe(antes));
    expect(screen.getByRole('button', { name: /Atualizar abas/ })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Atualizar tratamento/ })).toBeInTheDocument();
    expect(h.falso.tabelas.avaliacoes_voz[0].resultado._meta.savedAt).not.toBe('s1');
  });

  it('o aviso que sobrevive à remontagem não rola a tela de novo (só rola quando aparece depois de uma edição)', async () => {
    montar();
    await editarOResumoESalvar();
    const antes = await screen.findByText(AVISO);
    await waitFor(() => expect(rolar).toHaveBeenCalledTimes(1));
    await terminarOReprocessamento();
    await waitFor(() => expect(screen.getByText(AVISO)).not.toBe(antes));
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(rolar).toHaveBeenCalledTimes(1);
  });

  it('com a IA fora do ar o aviso continua (como antes) e "Atualizar abas" refaz o plano; aí o aviso também continua', async () => {
    iaFalha = true;
    montar();
    await editarOResumoESalvar();
    await screen.findByText(AVISO);
    await waitFor(() => expect(h.invocar).toHaveBeenCalledWith('voice-assessment', expect.anything()));
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(aviso()).toBeInTheDocument();
    expect(h.falso.tabelas.avaliacoes_voz[0].resultado._meta.savedAt).toBe('s1');

    iaFalha = false;
    fireEvent.click(screen.getByRole('button', { name: /Atualizar abas/ }));
    const antes = screen.getByText(AVISO);
    await terminarOReprocessamento();
    await waitFor(() => expect(screen.getByText(AVISO)).not.toBe(antes));
    expect(screen.getByRole('button', { name: /Atualizar tratamento/ })).toBeInTheDocument();
  });

  it('dispensar ("Agora não") fecha o aviso, e ele não volta quando o plano é refeito depois', async () => {
    montar();
    await editarOResumoESalvar();
    await screen.findByText(AVISO);
    await terminarOReprocessamento();
    await waitFor(() => expect(screen.getByRole('button', { name: /Atualizar tratamento/ })).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Agora não'));
    expect(aviso()).toBeNull();

    await reprocessadoPorFora('s3');
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(aviso()).toBeNull();
  });

  it('aplicar ao plano fecha o aviso, grava a diretriz e ele não volta quando o plano é refeito depois', async () => {
    montar();
    await editarOResumoESalvar();
    await screen.findByText(AVISO);
    await terminarOReprocessamento();

    fireEvent.click(await screen.findByRole('button', { name: /Atualizar tratamento/ }));
    expect(await screen.findByText('Sugestão a partir da avaliação')).toBeInTheDocument();
    expect(h.invocar).toHaveBeenCalledWith('gerar-diretriz-clinica', { body: { paciente_id: 'pac-1', area: 'fisioterapia', preview: true } });
    fireEvent.click(screen.getByRole('button', { name: /Aplicar ao plano/ }));

    await waitFor(() => expect(h.falso.tabelas.diretrizes_profissionais).toHaveLength(1));
    await waitFor(() => expect(aviso()).toBeNull());

    await reprocessadoPorFora('s3');
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(aviso()).toBeNull();
  });

  it('descartar a sugestão no diálogo NÃO fecha o aviso (o profissional ainda não decidiu)', async () => {
    montar();
    await editarOResumoESalvar();
    await screen.findByText(AVISO);
    await terminarOReprocessamento();

    fireEvent.click(await screen.findByRole('button', { name: /Atualizar tratamento/ }));
    await screen.findByText('Sugestão a partir da avaliação');
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(screen.queryByText('Sugestão a partir da avaliação')).toBeNull());
    expect(aviso()).toBeInTheDocument();
    expect(h.falso.tabelas.diretrizes_profissionais ?? []).toHaveLength(0);
  });

  it('outra avaliação na tela não herda o aviso, nem quando a anterior volta depois', async () => {
    iaFalha = true;
    montar();
    await editarOResumoESalvar();
    await screen.findByText(AVISO);

    // Chega uma avaliação mais nova: ela vira a "última" e o aviso da antiga não vai junto.
    h.falso.tabelas.avaliacoes_voz.push(avaliacao({ id: 'av-2', created_at: '2026-10-06T12:00:00+00:00', resultado: resultado('n1') }));
    await act(async () => { await qc.invalidateQueries({ queryKey: ['avaliacao-voz-latest'] }); });
    await waitFor(() => expect(aviso()).toBeNull());

    // A mais nova é excluída e a antiga volta a ser a última: o aviso de antes não ressuscita.
    h.falso.tabelas.avaliacoes_voz = h.falso.tabelas.avaliacoes_voz.filter((a) => a.id !== 'av-2');
    await act(async () => { await qc.invalidateQueries({ queryKey: ['avaliacao-voz-latest'] }); });
    await screen.findByText('Resumo Clínico');
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(aviso()).toBeNull();
  });

  it('as seções usadas sozinhas (sem quem guarde a oferta) continuam mostrando e fechando o aviso por conta própria', async () => {
    montar(<AvaliacaoSecoesEditaveis pacienteId="pac-1" avaliacaoId="av-1" resultado={resultado()} transcricao="" onReprocessar={vi.fn()} />);
    await editarOResumoESalvar();
    await screen.findByText(AVISO);
    fireEvent.click(screen.getByTitle('Agora não'));
    expect(aviso()).toBeNull();
  });
});

// A key com savedAt é o que faz as seções releiam o resultado novo (Resumo, Quadro/Dx, Tratamento...). Não pode sair daí
// só para o aviso sobreviver: este teste trava a key.
describe('Guarda estática: a key com savedAt fica (as seções precisam remontar para ler o resultado refeito)', () => {
  it('AvaliacaoVozAtual remonta as seções quando o savedAt muda e guarda a oferta fora delas', () => {
    const fonte = readFileSync(join(process.cwd(), 'src/components/voice/AvaliacaoVozAtual.tsx'), 'utf8');
    expect(fonte).toMatch(/key=\{`\$\{latest\.id\}:\$\{\(latest as any\)\.resultado\?\._meta\?\.savedAt \|\| ''\}`\}/);
    expect(fonte).toMatch(/ofertaTratamentoInicial=\{ofertaTratamentoDe === latest\.id\}/);
  });
});
