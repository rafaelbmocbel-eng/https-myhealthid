import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fireEvent, render, renderHook, screen, waitFor, act } from '@testing-library/react';
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
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn(), warning: vi.fn() }) }));
vi.mock('@/components/voice/VoiceAssessment', () => ({ default: () => <div>VoiceAssessment simulado</div> }));

import TestesFuncionaisCard from '@/components/educador/TestesFuncionaisCard';
import DiagnosticosCID10Card from '@/components/medicina/DiagnosticosCID10Card';
import ExamesPresenciaisCard from '@/components/presencial/ExamesPresenciaisCard';
import ImportarExameCard from '@/components/medicina/ImportarExameCard';
import EscalasPsicologiaCard from '@/components/psicologia/EscalasPsicologiaCard';
import AvaliacoesVozHistorico from '@/components/voice/AvaliacoesVozHistorico';
import AvaliacaoVozAtual from '@/components/voice/AvaliacaoVozAtual';
import AvaliacaoSecoesEditaveis from '@/components/voice/AvaliacaoSecoesEditaveis';
import { useHistoriaVidaMutation } from '@/hooks/useTimelineCompleta';
import { invalidarCachesAvaliacaoVoz } from '@/utils/voiceAssessment/reprocessarComplemento';
import { FONTES_VAZIAS } from '@/lib/resumoClinico/tipos';

// Quem GRAVA dado clínico do paciente tem que fazer a Linha do tempo e o Resumo Completo lerem de novo: a consulta
// ['fontes-clinicas', paciente, profissional] fica velha (30 s de staleTime) e o profissional veria o quadro de antes.
// Cada teste põe a consulta real de um paciente no cache e confere que ela fica "invalidada" depois da gravação, sem
// encostar na de outro paciente (nem em "pac-10" quando o paciente é "pac-1").

const CHAVE = ['fontes-clinicas', 'pac-1', 'prof-1'];
const OUTRAS = [['fontes-clinicas', 'pac-2', 'prof-1'], ['fontes-clinicas', 'pac-10', 'prof-1']];

function novoCliente(): QueryClient {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  for (const chave of [CHAVE, ...OUTRAS]) qc.setQueryData(chave, { fontes: FONTES_VAZIAS, falhas: [], cortes: [] });
  return qc;
}
const invalidada = (qc: QueryClient, chave: readonly unknown[]) => qc.getQueryState(chave)?.isInvalidated === true;
const comPaciente = (qc: QueryClient, ui: ReactElement) => render(<QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);

async function esperarInvalidada(qc: QueryClient) {
  await waitFor(() => expect(invalidada(qc, CHAVE)).toBe(true));
  for (const outra of OUTRAS) expect(invalidada(qc, outra), outra.join('/')).toBe(false);
}
// Dá tempo de uma gravação que falhou terminar e confere que nada foi invalidado.
async function esperarSemInvalidar(qc: QueryClient) {
  await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
  expect(invalidada(qc, CHAVE)).toBe(false);
}

function preparar(tabelas: Record<string, Linha[]> = {}) {
  h.falso = criarBancoFalso(tabelas);
  h.banco = envolverBanco(h.falso);
}

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
  h.invocar.mockReset();
  preparar();
  vi.stubGlobal('confirm', () => true);
});

async function escolherNoSelect(nomeDoCombobox: RegExp | string, opcao: RegExp | string) {
  fireEvent.pointerDown(screen.getAllByRole('combobox').find((c) => (typeof nomeDoCombobox === 'string' ? c.textContent === nomeDoCombobox : nomeDoCombobox.test(c.textContent ?? ''))) as HTMLElement, { button: 0, ctrlKey: false, pointerType: 'mouse' });
  fireEvent.click(await screen.findByRole('option', { name: opcao }));
}

// ── Testes funcionais ──────────────────────────────────────────────────────────
describe('Testes funcionais: gravar e apagar invalidam a linha do tempo', () => {
  const teste: Linha = { id: 't1', paciente_id: 'pac-1', tipo_teste: 'tug', resultado: 9, unidade: 'segundos', data_teste: '2026-06-01', classificacao: null };

  it('registrar um teste', async () => {
    const qc = novoCliente();
    const { container } = comPaciente(qc, <TestesFuncionaisCard pacienteId="pac-1" />);
    fireEvent.change(container.querySelector('input[inputmode="decimal"]') as HTMLInputElement, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar/ }));
    await esperarInvalidada(qc);
    expect(h.falso.tabelas.testes_funcionais_paciente).toHaveLength(1);
  });

  it('se o banco recusa o teste, nada é invalidado (nada mudou)', async () => {
    h.falso.falharEscritaQuando((op) => op.tabela === 'testes_funcionais_paciente', 'sem permissão');
    const qc = novoCliente();
    const { container } = comPaciente(qc, <TestesFuncionaisCard pacienteId="pac-1" />);
    fireEvent.change(container.querySelector('input[inputmode="decimal"]') as HTMLInputElement, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar/ }));
    await esperarSemInvalidar(qc);
  });

  it('apagar um teste', async () => {
    preparar({ testes_funcionais_paciente: [teste] });
    const qc = novoCliente();
    const { container } = comPaciente(qc, <TestesFuncionaisCard pacienteId="pac-1" />);
    await screen.findByText('Timed Up and Go');
    fireEvent.click(container.querySelector('button.text-destructive, button svg.text-destructive')?.closest('button') as HTMLElement);
    await esperarInvalidada(qc);
    expect(h.falso.tabelas.testes_funcionais_paciente).toHaveLength(0);
  });
});

// ── Diagnósticos ───────────────────────────────────────────────────────────────
describe('Diagnósticos: adicionar e remover invalidam a linha do tempo', () => {
  const diag: Linha = { id: 'd1', paciente_id: 'pac-1', cid_codigo: 'M54.5', cid_descricao: 'Dor lombar baixa', tipo: 'principal', observacao: null, ativo: true, created_at: '2026-01-01T12:00:00+00:00' };

  it('remover um diagnóstico', async () => {
    preparar({ diagnosticos_paciente: [diag] });
    const qc = novoCliente();
    const { container } = comPaciente(qc, <DiagnosticosCID10Card pacienteId="pac-1" />);
    await screen.findByText('Dor lombar baixa');
    fireEvent.click(container.querySelector('svg.text-destructive')?.closest('button') as HTMLElement);
    await esperarInvalidada(qc);
    expect(h.falso.tabelas.diagnosticos_paciente[0].ativo).toBe(false);
  });

  it('adicionar um diagnóstico', async () => {
    preparar({ cid10_catalogo: [{ codigo: 'M54.5', descricao: 'Dor lombar baixa', categoria: 'Dorsopatias' }] });
    const qc = novoCliente();
    comPaciente(qc, <DiagnosticosCID10Card pacienteId="pac-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }));
    fireEvent.click(screen.getAllByRole('combobox')[0]);
    fireEvent.click(await screen.findByText(/Dor lombar baixa/));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await esperarInvalidada(qc);
    expect(h.falso.tabelas.diagnosticos_paciente).toHaveLength(1);
  });

  it('se o banco recusa remover o diagnóstico, nada é invalidado', async () => {
    preparar({ diagnosticos_paciente: [diag] });
    h.falso.falharEscritaQuando((op) => op.tabela === 'diagnosticos_paciente', 'sem permissão');
    const qc = novoCliente();
    const { container } = comPaciente(qc, <DiagnosticosCID10Card pacienteId="pac-1" />);
    await screen.findByText('Dor lombar baixa');
    fireEvent.click(container.querySelector('svg.text-destructive')?.closest('button') as HTMLElement);
    await esperarSemInvalidar(qc);
    expect(h.falso.tabelas.diagnosticos_paciente[0].ativo).toBe(true);
  });

  it('se o banco recusa adicionar o diagnóstico, nada é invalidado', async () => {
    preparar({ cid10_catalogo: [{ codigo: 'M54.5', descricao: 'Dor lombar baixa', categoria: 'Dorsopatias' }] });
    h.falso.falharEscritaQuando((op) => op.tabela === 'diagnosticos_paciente', 'sem permissão');
    const qc = novoCliente();
    comPaciente(qc, <DiagnosticosCID10Card pacienteId="pac-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Adicionar/ }));
    fireEvent.click(screen.getAllByRole('combobox')[0]);
    fireEvent.click(await screen.findByText(/Dor lombar baixa/));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    await esperarSemInvalidar(qc);
    expect(h.falso.tabelas.diagnosticos_paciente).toHaveLength(0);
  });
});

// ── Exames presenciais ─────────────────────────────────────────────────────────
describe('Exames presenciais: registrar e remover invalidam a linha do tempo', () => {
  const exame: Linha = { id: 'e1', paciente_id: 'pac-1', tipo: 'bioimpedancia', data_exame: '2026-08-01', dados: { peso_kg: 70 }, resumo: 'Peso 70 kg', created_at: '2026-08-01T12:00:00+00:00' };

  it('remover um exame', async () => {
    preparar({ exames_presenciais: [exame] });
    const qc = novoCliente();
    comPaciente(qc, <ExamesPresenciaisCard pacienteId="pac-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Exames presenciais/ }));
    fireEvent.click(await screen.findByTitle('Remover'));
    await esperarInvalidada(qc);
    expect(h.falso.tabelas.exames_presenciais).toHaveLength(0);
  });

  it('registrar um exame', async () => {
    const qc = novoCliente();
    comPaciente(qc, <ExamesPresenciaisCard pacienteId="pac-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Exames presenciais/ }));
    await escolherNoSelect('Escolha o exame', 'Bioimpedância');
    const peso = await screen.findByText(/^Peso/);
    fireEvent.change(peso.parentElement?.querySelector('input') as HTMLInputElement, { target: { value: '70' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar exame/ }));
    await esperarInvalidada(qc);
    expect(h.falso.tabelas.exames_presenciais).toHaveLength(1);
  });

  it('se o banco recusa remover o exame, nada é invalidado', async () => {
    preparar({ exames_presenciais: [exame] });
    h.falso.falharEscritaQuando((op) => op.tabela === 'exames_presenciais', 'sem permissão');
    const qc = novoCliente();
    comPaciente(qc, <ExamesPresenciaisCard pacienteId="pac-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Exames presenciais/ }));
    fireEvent.click(await screen.findByTitle('Remover'));
    await esperarSemInvalidar(qc);
    expect(h.falso.tabelas.exames_presenciais).toHaveLength(1);
  });

  it('se o banco recusa registrar o exame, nada é invalidado', async () => {
    h.falso.falharEscritaQuando((op) => op.tabela === 'exames_presenciais', 'sem permissão');
    const qc = novoCliente();
    comPaciente(qc, <ExamesPresenciaisCard pacienteId="pac-1" />);
    fireEvent.click(screen.getByRole('button', { name: /Exames presenciais/ }));
    await escolherNoSelect('Escolha o exame', 'Bioimpedância');
    const peso = await screen.findByText(/^Peso/);
    fireEvent.change(peso.parentElement?.querySelector('input') as HTMLInputElement, { target: { value: '70' } });
    fireEvent.click(screen.getByRole('button', { name: /Registrar exame/ }));
    await esperarSemInvalidar(qc);
    expect(h.falso.tabelas.exames_presenciais).toHaveLength(0);
  });
});

// ── Exame importado ────────────────────────────────────────────────────────────
describe('Exame importado: importar e apagar invalidam a linha do tempo', () => {
  it('importar um exame (a função do servidor grava e o cartão avisa a linha do tempo)', async () => {
    h.invocar.mockResolvedValue({ data: { ok: true }, error: null });
    const qc = novoCliente();
    const { container } = comPaciente(qc, <ImportarExameCard pacienteId="pac-1" />);
    const arquivo = new File(['x'], 'exame.png', { type: 'image/png' });
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [arquivo] } });
    await esperarInvalidada(qc);
    expect(h.invocar).toHaveBeenCalledWith('import-exame', expect.anything());
  });

  it('se a importação falha, nada é invalidado', async () => {
    h.invocar.mockResolvedValue({ data: null, error: new Error('falhou') });
    const qc = novoCliente();
    const { container } = comPaciente(qc, <ImportarExameCard pacienteId="pac-1" />);
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [new File(['x'], 'exame.png', { type: 'image/png' })] } });
    await waitFor(() => expect(h.invocar).toHaveBeenCalled());
    await esperarSemInvalidar(qc);
  });

  it('apagar um exame importado', async () => {
    preparar({ exames_importados: [{ id: 'i1', paciente_id: 'pac-1', created_at: '2026-07-01T12:00:00+00:00', dados_extraidos: { nome_exame: 'Hemograma' } }] });
    const qc = novoCliente();
    const { container } = comPaciente(qc, <ImportarExameCard pacienteId="pac-1" />);
    await screen.findByText('Hemograma');
    fireEvent.click(container.querySelector('svg.text-destructive')?.closest('button') as HTMLElement);
    await esperarInvalidada(qc);
    expect(h.falso.tabelas.exames_importados).toHaveLength(0);
  });
});

// ── Escalas ────────────────────────────────────────────────────────────────────
describe('Escalas: salvar invalida a linha do tempo', () => {
  it('salvar um PHQ-9 completo', async () => {
    // O banco de verdade preenche data_aplicacao sozinho (DEFAULT); o banco falso não, e a tela lê essa data ao reler a lista.
    h.falso.antesDeEscrever((op) => { if (op.tabela === 'escalas_psicologia') (op.payload as Linha).data_aplicacao = '2026-10-01'; });
    const qc = novoCliente();
    comPaciente(qc, <EscalasPsicologiaCard pacienteId="pac-1" />);
    fireEvent.click(screen.getAllByRole('button', { name: '' })[0]);
    const radios = await screen.findAllByRole('radio');
    radios.filter((_, i) => i % 4 === 0).forEach((r) => fireEvent.click(r));
    fireEvent.click(screen.getByRole('button', { name: /Salvar avaliação/ }));
    await esperarInvalidada(qc);
    expect(h.falso.tabelas.escalas_psicologia).toHaveLength(1);
  });

  it('se o banco recusa salvar a escala, nada é invalidado', async () => {
    h.falso.falharEscritaQuando((op) => op.tabela === 'escalas_psicologia', 'sem permissão');
    const qc = novoCliente();
    comPaciente(qc, <EscalasPsicologiaCard pacienteId="pac-1" />);
    fireEvent.click(screen.getAllByRole('button', { name: '' })[0]);
    const radios = await screen.findAllByRole('radio');
    radios.filter((_, i) => i % 4 === 0).forEach((r) => fireEvent.click(r));
    fireEvent.click(screen.getByRole('button', { name: /Salvar avaliação/ }));
    await esperarSemInvalidar(qc);
    expect(h.falso.tabelas.escalas_psicologia).toHaveLength(0);
  });
});

// ── Avaliação por voz ──────────────────────────────────────────────────────────
describe('Avaliação por voz: excluir e editar invalidam a linha do tempo', () => {
  const avaliacao = (extra: Linha = {}): Linha => ({
    id: 'av-1', paciente_id: 'pac-1', terapeuta_id: 'prof-1', created_at: '2026-10-05T12:00:00+00:00', queixa_principal: 'Dor lombar', servico: 'identidade',
    classificacao_severidade: 'Moderada', transcricao: '', resultado: resultadoDaAvaliacao(), ...extra,
  });

  it('excluir pelo histórico de avaliações', async () => {
    preparar({ avaliacoes_voz: [avaliacao(), avaliacao({ id: 'av-2', created_at: '2026-10-06T12:00:00+00:00' })] });
    const qc = novoCliente();
    comPaciente(qc, <AvaliacoesVozHistorico pacienteId="pac-1" patientName="Ana" />);
    const botoes = await screen.findAllByTitle(/Excluir/);
    fireEvent.click(botoes[0]);
    await esperarInvalidada(qc);
    expect(h.falso.tabelas.avaliacoes_voz).toHaveLength(1);
  });

  it('excluir a avaliação atual', async () => {
    preparar({ avaliacoes_voz: [avaliacao()] });
    const qc = novoCliente();
    comPaciente(qc, <AvaliacaoVozAtual pacienteId="pac-1" patientName="Ana" />);
    fireEvent.click(await screen.findByTitle('Excluir esta avaliação'));
    await esperarInvalidada(qc);
    expect(h.falso.tabelas.avaliacoes_voz).toHaveLength(0);
  });

  it('salvar a edição de uma seção NÃO relê a linha do tempo: só muda o resultado, que ela não lê (o Completo relê pela consulta da avaliação)', async () => {
    preparar({ avaliacoes_voz: [avaliacao()], notas_prontuario: [] });
    const qc = novoCliente();
    comPaciente(qc, <AvaliacaoSecoesEditaveis pacienteId="pac-1" avaliacaoId="av-1" resultado={resultadoDaAvaliacao()} transcricao="" onReprocessar={vi.fn()} />);
    await screen.findByText('Resumo Clínico');
    fireEvent.click(screen.getByTitle('Editar texto'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Resumo reescrito pelo profissional.' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));
    await waitFor(() => expect(h.falso.tabelas.avaliacoes_voz[0].resultado).not.toEqual(resultadoDaAvaliacao()));
    await esperarSemInvalidar(qc);
  });

  it('o ajudante que a reprocessagem, a exclusão e o salvamento usam invalida só o paciente certo', async () => {
    const qc = novoCliente();
    invalidarCachesAvaliacaoVoz(qc, 'pac-1');
    await esperarInvalidada(qc);
  });
});

// ── História de vida ───────────────────────────────────────────────────────────
describe('História de vida: adicionar e remover invalidam a linha do tempo', () => {
  function usar(qc: QueryClient) {
    return renderHook(() => useHistoriaVidaMutation('pac-1'), { wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider> });
  }

  it('adicionar um fato', async () => {
    const qc = novoCliente();
    const { result } = usar(qc);
    await act(async () => { await result.current.adicionar.mutateAsync({ data_evento: '2020-01-01', tipo: 'cirurgia', titulo: 'Apêndice' }); });
    await esperarInvalidada(qc);
    expect(h.falso.tabelas.historia_vida_paciente).toHaveLength(1);
  });

  it('remover um fato', async () => {
    preparar({ historia_vida_paciente: [{ id: 'h1', paciente_id: 'pac-1', data_evento: '2020-01-01', tipo: 'cirurgia', titulo: 'Apêndice' }] });
    const qc = novoCliente();
    const { result } = usar(qc);
    await act(async () => { await result.current.remover.mutateAsync('h1'); });
    await esperarInvalidada(qc);
    expect(h.falso.tabelas.historia_vida_paciente).toHaveLength(0);
  });

  it('se o banco recusa, nada é invalidado', async () => {
    h.falso.falharEscritaQuando((op) => op.tabela === 'historia_vida_paciente');
    const qc = novoCliente();
    const { result } = usar(qc);
    await act(async () => { await result.current.adicionar.mutateAsync({ data_evento: '2020-01-01', tipo: 'cirurgia', titulo: 'x' }).catch(() => undefined); });
    await esperarSemInvalidar(qc);
  });
});

function resultadoDaAvaliacao(): Linha {
  return {
    resumo_clinico: 'Paciente com dor lombar crônica há 6 meses, piora ao sentar.',
    classificacao_severidade: 'Moderada',
    queixa_principal: 'Dor lombar crônica',
    tempo_evolucao: '6 meses',
    soap: { subjetivo: 'Dor ao sentar.', objetivo: 'Lasègue positivo.', avaliacao: 'Sobrecarga lombar.', plano: 'Exercícios' },
    dor: { localizacao: 'Lombar', intensidade_eva: 7, tipo: 'Mista' },
    _meta: { mode: 'voice', savedAt: 's1' },
    _secoes: { confirmadas: ['resumo_clinico', 'dor'], editadas: {} },
  };
}

// ── Telas pesadas (voz ao vivo, dinamometria): guarda estática ─────────────────
// Estas telas dependem de microfone, Bluetooth ou do navegador inteiro e não montam num teste de unidade sem esforço
// desproporcional. Este teste NÃO executa a tela: só impede que alguém tire a chamada sem perceber. Os pontos que dá para
// montar estão acima, com o efeito real no cache. A Eletromiografia é testada em eletromiografiaPagina.test.tsx.
describe('Guarda estática: telas pesadas que gravam fontes da linha do tempo', () => {
  const ler = (arquivo: string) => readFileSync(`${process.cwd()}/${arquivo}`, 'utf8');
  const chamadas = (fonte: string) => (fonte.match(/invalidarFontesClinicas\(/g) ?? []).length;

  it('VoiceAssessment avisa a linha do tempo depois de gravar a avaliação, dentro do bloco que já invalida o paciente', () => {
    const fonte = ler('src/components/voice/VoiceAssessment.tsx');
    expect(fonte).toMatch(/import \{ invalidarFontesClinicas \} from '@\/hooks\/useFontesClinicas'/);
    expect(fonte).toMatch(/queryKey: \['alerta-relato-paciente', pacienteId\] \}\);\s*invalidarFontesClinicas\(queryClient, pacienteId\);/);
  });

  it('Dinamometria avisa a linha do tempo nas 4 gravações em exames_presenciais (relato, laudo atualizado, salvar e excluir)', () => {
    const fonte = ler('src/pages/Dinamometria.tsx');
    expect(chamadas(fonte)).toBe(4);
    expect((fonte.match(/invalidarFontesClinicas\(qc, id\)/g) ?? []).length).toBe(4);
  });

  it('DinamometriaInicio avisa só quando o item excluído é um exame (teste), e não quando é um treino', () => {
    const fonte = ler('src/pages/DinamometriaInicio.tsx');
    expect(fonte).toMatch(/if \(excluir\.tipo === 'teste'\) invalidarFontesClinicas\(qc, pacId \?\? undefined\);/);
    expect(chamadas(fonte)).toBe(1);
  });

  it('PacienteDashboardIdentidade avisa depois de excluir um MyID e o histórico ligado a ele', () => {
    const fonte = ler('src/components/paciente/PacienteDashboardIdentidade.tsx');
    expect(fonte).toMatch(/queryKey: \['notas-prontuario'\] \}\);\s*invalidarFontesClinicas\(qc, paciente\.id\);/);
    expect(chamadas(fonte)).toBe(1);
  });
});

