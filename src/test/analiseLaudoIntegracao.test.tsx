import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { baixarBlob } from '@/lib/pdf/entrega';
import { lerAnaliseSalva, serializarAnalise } from '../lib/angular/analiseVideo/persistencia';
import type { VideoCarregado } from '../lib/angular/analiseVideo/carregarVideo';
import type { CriterioProfissional } from '../lib/angular/movimento/tipos';
import { trilhaAgachamentoLateral } from './movimentoMotorSintetico';

const mocks = vi.hoisted(() => ({ ler: vi.fn() }));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: null, profile: null }) }));
vi.mock('@/lib/dosagem/db', () => ({ tabela: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/utils/pdfBranding', () => ({ carregarBrandingClinica: async () => ({}) }));
vi.mock('@/lib/pdf/entrega', () => ({ entregarPdf: vi.fn(), baixarBlob: vi.fn() }));
vi.mock('@/lib/angular/analiseVideo/rascunho', () => ({ apagarRascunho: async () => true, lerRascunho: async () => null, salvarRascunho: async () => true }));
vi.mock('@/lib/angular/analiseVideo/carregarVideo', async (original) => ({
  ...(await original<typeof import('@/lib/angular/analiseVideo/carregarVideo')>()),
  lerMetadadosDoVideo: mocks.ler,
  estimarFps: async () => null,
}));

const { default: AnaliseVideo } = await import('../components/angular/video/AnaliseVideo');

const video = (): VideoCarregado => ({ url: 'blob:a', arquivo: new File(['a'], 'agachamento.mp4', { type: 'video/mp4' }), nome: 'agachamento.mp4', tamanho: 5000, duracao: 17, largura: 640, altura: 480 });

const criterioSalvo: CriterioProfissional = {
  id: 'crit-salvo', chave: 'assimetria_flexao_joelho', metrica: 'flexao_joelho_max', operador: '<=', valor: 5, unidade: '°',
  rotulo: 'Flexão máxima do joelho: diferença entre os lados ≤ 5,0°', definidoPor: 'Dra. Teste', ativo: true,
};

function arquivoDaAnalise(extra: { criterios?: CriterioProfissional[]; protocoloMovimento?: 'agachamento_lateral' | 'agachamento_frontal' } = {}): File {
  const v = video();
  const trilha = trilhaAgachamentoLateral({ reps: 5, ruidoPx: 0.8, flexao: (lado) => (lado === 'D' ? 105 : 92) });
  const texto = serializarAnalise({
    video: { nome: '', tamanho: v.tamanho, duracao: v.duracao, largura: v.largura, altura: v.altura }, modeloId: 'agachamento', fpsVideo: 30,
    intervalo: { inicio: 0, fim: 17 }, trilha, eventos: null, cmPorPx: null, extras: {}, ...extra,
  });
  return new File([texto], 'analise.json', { type: 'application/json' });
}

// O Blob do jsdom não tem .text(): lê pelo FileReader, como o navegador faria ao abrir o arquivo.
const lerBlob = (b: Blob): Promise<string> =>
  new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => falha(r.error);
    r.readAsText(b);
  });

async function retomar(extra?: Parameters<typeof arquivoDaAnalise>[0]) {
  render(<AnaliseVideo paciente={null} entrada="gesto" />);
  fireEvent.change(screen.getByTestId('entrada-analise'), { target: { files: [arquivoDaAnalise(extra)] } });
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Análise aberta/));
  fireEvent.change(screen.getByTestId('entrada-video'), { target: { files: [new File(['a'], 'agachamento.mp4', { type: 'video/mp4' })] } });
  await waitFor(() => expect(screen.getByTestId('analise-video')).toBeInTheDocument());
}

beforeEach(() => {
  mocks.ler.mockReset();
  mocks.ler.mockImplementation(async () => video());
  vi.mocked(baixarBlob).mockReset();
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: vi.fn(() => 'blob:x') });
});
afterEach(cleanup);

describe('aba Laudo (beta) dentro da análise em vídeo', () => {
  it('aparece ao lado das abas existentes, rotulada beta', async () => {
    await retomar();
    const abas = within(screen.getByRole('tablist', { name: 'Painel da análise' })).getAllByRole('tab');
    expect(abas.map((a) => a.getAttribute('data-testid'))).toEqual(['aba-metricas', 'aba-eventos', 'aba-lados', 'aba-medir', 'aba-laudo', 'aba-exportar']);
    expect(screen.getByTestId('aba-laudo')).toHaveAccessibleName('Laudo (beta)');
  });

  it('abre o laudo com a trilha atual, o protocolo do gesto e o aviso fixo', async () => {
    await retomar();
    fireEvent.click(screen.getByTestId('aba-laudo'));
    expect(await screen.findByTestId('aviso-beta-laudo')).toHaveTextContent('Protótipo (beta) · apoio à avaliação do profissional · não é diagnóstico');
    expect(await screen.findByTestId('laudo-calculado')).toBeInTheDocument();
    expect(screen.getByTestId('protocolo-agachamento_lateral')).toBeChecked();
    const achados = await screen.findAllByTestId('achado');
    expect(achados.some((a) => a.getAttribute('data-chave') === 'assimetria_flexao_joelho')).toBe(true);
    expect(screen.getByTestId('medida-flexao_joelho_max')).toBeInTheDocument();
  });

  it('restaura os critérios e o protocolo guardados no arquivo da análise', async () => {
    await retomar({ criterios: [criterioSalvo], protocoloMovimento: 'agachamento_frontal' });
    fireEvent.click(screen.getByTestId('aba-laudo'));
    await screen.findByTestId('laudo-calculado');
    expect(screen.getByTestId('protocolo-agachamento_frontal')).toBeChecked();
    expect(screen.getByTestId('aviso-plano-diferente')).toBeInTheDocument();
    // O critério é de uma medida da vista lateral: continua guardado, mas não se aplica no protocolo frontal.
    expect(screen.getAllByTestId('criterio')).toHaveLength(1);
    expect(screen.getByTestId('estado-criterio')).toHaveTextContent(/Guardado, mas não aplicado neste protocolo/);

    fireEvent.click(screen.getByTestId('protocolo-agachamento_lateral'));
    await waitFor(() => expect(screen.getByTestId('estado-criterio')).toHaveTextContent(/Ligado\. Resultado neste vídeo:/));
    expect((screen.getByLabelText(/Valor do limite/) as HTMLInputElement).value).toBe('5');
    expect(screen.getByTestId('ligar-criterio')).toHaveAttribute('aria-checked', 'true');
  });

  it('o critério criado na aba e o protocolo escolhido vão para o arquivo salvo e voltam ao abrir', async () => {
    await retomar();
    fireEvent.click(screen.getByTestId('aba-laudo'));
    await screen.findByTestId('laudo-calculado');
    fireEvent.click(screen.getByTestId('adicionar-criterio'));
    fireEvent.change(screen.getByLabelText(/Valor do limite/), { target: { value: '7,5' } });
    fireEvent.change(screen.getByLabelText(/Definido por/), { target: { value: 'Dr. Teste' } });
    fireEvent.click(screen.getByTestId('ligar-criterio'));
    fireEvent.click(screen.getByTestId('protocolo-agachamento_frontal'));

    fireEvent.click(screen.getByTestId('aba-exportar'));
    fireEvent.click(screen.getByTestId('salvar-analise'));
    expect(baixarBlob).toHaveBeenCalledTimes(1);
    const [blob, nome] = vi.mocked(baixarBlob).mock.calls[0];
    expect(nome).toMatch(/^analise-video-agachamento-\d{4}-\d{2}-\d{2}\.json$/);
    const lida = lerAnaliseSalva(await lerBlob(blob));
    expect(lida.ok).toBe(true);
    if (!lida.ok) return;
    expect(lida.analise.protocoloMovimento).toBe('agachamento_frontal');
    expect(lida.analise.criterios).toHaveLength(1);
    expect(lida.analise.criterios?.[0]).toMatchObject({ chave: 'assimetria_flexao_joelho', metrica: 'flexao_joelho_max', operador: '<=', valor: 7.5, definidoPor: 'Dr. Teste', ativo: true });
  });

  it('sem critério nem escolha de protocolo, o arquivo salvo não leva os campos novos', async () => {
    await retomar();
    fireEvent.click(screen.getByTestId('aba-exportar'));
    fireEvent.click(screen.getByTestId('salvar-analise'));
    const [blob] = vi.mocked(baixarBlob).mock.calls[0];
    const texto = await lerBlob(blob);
    expect(texto).not.toContain('criterios');
    expect(texto).not.toContain('protocoloMovimento');
  });
});
