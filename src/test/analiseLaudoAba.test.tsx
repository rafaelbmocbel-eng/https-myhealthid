import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import AbaLaudo from '../components/angular/video/laudo/AbaLaudo';
import ListaAchados from '../components/angular/video/laudo/ListaAchados';
import { AVISO_BETA_LAUDO } from '../components/angular/video/laudo/textosLaudo';
import { useEstadoLaudo, type EstadoLaudo } from '../components/angular/video/laudo/useEstadoLaudo';
import { montarLaudo } from '../lib/angular/movimento/laudo';
import { indisponiveisDoProtocolo, protocoloDo } from '../lib/angular/movimento/protocolos';
import { termoProibido } from '../lib/angular/movimento/vocabulario';
import type { CriterioProfissional, LaudoMovimento } from '../lib/angular/movimento/tipos';
import type { IdGesto } from '../lib/angular/video/modelos';
import type { PlanoCamera } from '../lib/angular/movimento/tipos';
import type { TrilhaPose } from '../lib/angular/video/tipos';
import { trilhaAgachamentoLateral, trilhaMarcha } from './movimentoMotorSintetico';
import { analiseFixa, achado, BIBLIOTECA_FIXA, contexto } from './movimentoLaudoFixtures';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/lib/pdf/entrega', () => ({ entregarPdf: vi.fn(), baixarBlob: vi.fn() }));

// Seis agachamentos: o lado direito flete mais que o esquerdo e a quarta repetição é mais funda que as outras.
const trilhaAssimetrica = (): TrilhaPose =>
  trilhaAgachamentoLateral({ reps: 6, ruidoPx: 0.8, flexao: (lado, r) => (lado === 'D' ? 105 : 92) + (r === 3 ? 14 : 0) });
const trilhaSimetrica = (): TrilhaPose => trilhaAgachamentoLateral({ reps: 6, ruidoPx: 0.8, flexao: () => 100 });

interface TelaProps {
  gesto?: IdGesto;
  vista?: PlanoCamera;
  trilha: TrilhaPose | null;
  foraDoTrecho?: number;
  gerarPdf?: (l: LaudoMovimento) => Promise<Blob>;
  baixar?: (b: Blob, nome: string) => void;
  aoEstado?: (e: EstadoLaudo) => void;
}

function Tela({ gesto = 'agachamento', vista = 'lateral', trilha, foraDoTrecho = 0, gerarPdf, baixar, aoEstado }: TelaProps) {
  const estado = useEstadoLaudo(gesto, vista);
  useEffect(() => { aoEstado?.(estado); }, [estado, aoEstado]);
  return (
    <AbaLaudo
      estado={estado} vistaDeclarada={vista} trilha={trilha} escalaCmPorPixel={null} eventos={null} direcao={1}
      video={{ nome: 'agachamento.mp4', duracaoS: 20, largura: 640, altura: 480 }} quadrosChaveCorrigidos={0} medidasManuaisForaDoTrecho={foraDoTrecho}
      data="2026-10-18" gerarPdf={gerarPdf} baixar={baixar}
    />
  );
}

const textoSemCitacoes = (el: HTMLElement): string => {
  const copia = el.cloneNode(true) as HTMLElement;
  copia.querySelectorAll('q').forEach((q) => q.remove());
  return copia.textContent ?? '';
};

beforeEach(() => {
  vi.mocked(toast.error).mockReset();
  vi.mocked(toast.success).mockReset();
});
afterEach(cleanup);

describe('aba Laudo (beta): estrutura e avisos', () => {
  it('traz o aviso fixo no topo e o título acessível', () => {
    render(<Tela trilha={null} />);
    const aviso = screen.getByTestId('aviso-beta-laudo');
    expect(aviso).toHaveTextContent('Protótipo (beta) · apoio à avaliação do profissional · não é diagnóstico');
    expect(AVISO_BETA_LAUDO).toBe('Protótipo (beta) · apoio à avaliação do profissional · não é diagnóstico');
    expect(aviso).toHaveAttribute('role', 'note');
    expect(screen.getByRole('heading', { level: 2, name: /Laudo de apoio à avaliação do movimento \(beta\)/ })).toBeInTheDocument();
  });

  it('sem rastreio pede o rastreio e não calcula nada', () => {
    render(<Tela trilha={null} />);
    expect(screen.getByTestId('sem-rastreio')).toHaveTextContent(/Rastreie o corpo neste vídeo/);
    expect(screen.queryByTestId('laudo-calculado')).toBeNull();
    expect(screen.queryByTestId('baixar-laudo')).toBeNull();
  });

  it('gesto sem protocolo explica quais gestos têm laudo e não mostra seletor', () => {
    render(<Tela gesto="corrida" trilha={null} />);
    expect(screen.getByTestId('sem-protocolo')).toHaveTextContent(/agachamento .* e a marcha/);
    expect(screen.queryByTestId('seletor-protocolo')).toBeNull();
    expect(screen.getByTestId('aviso-beta-laudo')).toBeInTheDocument();
  });

  it('passar de sem rastreio para com rastreio não quebra a ordem dos hooks', () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(<Tela trilha={null} />);
    rerender(<Tela trilha={trilhaSimetrica()} />);
    expect(screen.getByTestId('laudo-calculado')).toBeInTheDocument();
    rerender(<Tela trilha={null} />);
    expect(screen.getByTestId('sem-rastreio')).toBeInTheDocument();
    const mensagens = erro.mock.calls.map((c) => String(c[0]));
    expect(mensagens.filter((m) => /hook|Rendered (more|fewer)/i.test(m))).toEqual([]);
    erro.mockRestore();
  });
});

describe('seletor de protocolo e plano de câmera', () => {
  it('o padrão é o protocolo da vista declarada e avisa o que fica indisponível', () => {
    render(<Tela trilha={trilhaSimetrica()} />);
    expect(screen.getByTestId('protocolo-agachamento_lateral')).toBeChecked();
    expect(screen.getByTestId('protocolo-agachamento_frontal')).not.toBeChecked();
    expect(screen.queryByTestId('aviso-plano-diferente')).toBeNull();
    const n = indisponiveisDoProtocolo(protocoloDo('agachamento_lateral')).length;
    expect(n).toBeGreaterThan(0);
    expect(screen.getByTestId('aviso-indisponiveis')).toHaveTextContent(new RegExp(`${n} achados ficam indisponíveis`));
    expect(within(screen.getByTestId('achados-indisponiveis')).getAllByTestId('achado-indisponivel')).toHaveLength(n);
  });

  it('o grupo de opções é um radiogroup rotulado e cada opção tem nome acessível', () => {
    render(<Tela trilha={null} />);
    const grupo = screen.getByRole('radiogroup', { name: 'Protocolo do laudo' });
    expect(within(grupo).getAllByRole('radio')).toHaveLength(2);
    expect(within(grupo).getByRole('radio', { name: /Agachamento .*lateral/i })).toBeInTheDocument();
    expect(within(grupo).getByRole('radio', { name: /Agachamento .*frontal/i })).toBeInTheDocument();
  });

  it('escolher o outro plano mostra o aviso de que achados da vista declarada ficam indisponíveis', () => {
    render(<Tela trilha={trilhaSimetrica()} />);
    fireEvent.click(screen.getByTestId('protocolo-agachamento_frontal'));
    expect(screen.getByTestId('protocolo-agachamento_frontal')).toBeChecked();
    const alerta = screen.getByTestId('aviso-plano-diferente');
    expect(alerta).toHaveAttribute('role', 'alert');
    expect(alerta).toHaveTextContent(/Confira o plano de câmera/);
    expect(alerta).toHaveTextContent(/foi preparado em vista lateral, mas este protocolo mede em vista frontal/);
    const n = indisponiveisDoProtocolo(protocoloDo('agachamento_frontal')).length;
    expect(alerta).toHaveTextContent(new RegExp(`${n} achados que exigem a vista lateral ficam indisponíveis`));
    expect(within(screen.getByTestId('achados-indisponiveis')).getAllByTestId('achado-indisponivel')).toHaveLength(n);
  });

  it('a marcha tem um só protocolo, na vista lateral, sem aviso de divergência', () => {
    render(<Tela gesto="marcha" trilha={trilhaMarcha({})} />);
    expect(screen.getByTestId('protocolo-marcha_lateral')).toBeChecked();
    expect(screen.queryByTestId('aviso-plano-diferente')).toBeNull();
    expect(screen.getByTestId('achados-indisponiveis')).toHaveTextContent(/Todos os achados deste protocolo puderam ser avaliados/);
  });
});

describe('análise do agachamento com a trilha sintética', () => {
  it('lista os achados com texto neutro, sem referência e sem termo de juízo', async () => {
    render(<Tela trilha={trilhaAssimetrica()} />);
    const achados = await screen.findAllByTestId('achado');
    expect(achados.length).toBeGreaterThanOrEqual(2);
    const chaves = achados.map((a) => a.getAttribute('data-chave'));
    expect(chaves).toContain('assimetria_flexao_joelho');
    for (const a of achados) {
      expect(within(a).getByTestId('situacao-achado')).toHaveTextContent('sem referência');
      expect(termoProibido(textoSemCitacoes(a))).toBeNull();
    }
    expect(termoProibido(textoSemCitacoes(screen.getByTestId('aba-laudo-conteudo')))).toBeNull();
  });

  it('o texto do achado de assimetria traz as médias por lado, o gatilho e a incerteza do vídeo', async () => {
    render(<Tela trilha={trilhaAssimetrica()} />);
    const a = (await screen.findAllByTestId('achado')).find((x) => x.getAttribute('data-chave') === 'assimetria_flexao_joelho') as HTMLElement;
    expect(a).toHaveTextContent(/lado direito/);
    expect(a).toHaveTextContent(/lado esquerdo/);
    expect(a).toHaveTextContent(/Média por lado: D .* · E /);
    expect(a).toHaveTextContent(/Gatilho: diferença entre os lados/);
    expect(a).toHaveTextContent(/Incerteza estimada para este valor: ± /);
    expect(a).toHaveTextContent(/Repetições envolvidas: 1 a 6/);
  });

  it('expandir um achado mostra hipóteses com força da evidência, fontes ou "sem referência verificada", e itens a conferir', async () => {
    render(<Tela trilha={trilhaAssimetrica()} />);
    const a = (await screen.findAllByTestId('achado')).find((x) => x.getAttribute('data-chave') === 'assimetria_flexao_joelho') as HTMLElement;
    expect(within(a).queryByTestId('hipotese')).toBeNull();
    const botao = within(a).getByRole('button', { name: /Possíveis fatores contribuintes e o que conferir/ });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');

    const hipoteses = within(a).getAllByTestId('hipotese');
    expect(hipoteses.length).toBeGreaterThan(0);
    for (const h of hipoteses) {
      expect(h).toHaveTextContent(/Tipo de estudo: /);
      expect(h).toHaveTextContent(/Ressalva: /);
      expect(h.textContent).toMatch(/Fontes: \[\d+\]|sem referência verificada/);
    }
    const itens = within(a).getAllByTestId('item-conferir');
    expect(itens.length).toBeGreaterThan(0);
    for (const i of itens) expect(i.textContent).toMatch(/\[\d+\]|sem referência verificada/);

    const fontes = within(a).queryAllByTestId('fonte-do-achado');
    for (const f of fontes) {
      expect(f).toHaveTextContent(/PMID \d+/);
      expect(f.querySelector('q')).not.toBeNull();
      for (const link of Array.from(f.querySelectorAll('a'))) {
        expect(link.getAttribute('href')).toMatch(/^https:\/\//);
        expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
      }
    }
    expect(within(a).getByText('Limitações deste achado')).toBeInTheDocument();
  });

  it('a tabela por repetição e por lado tem uma linha por repetição e colunas D e E', async () => {
    render(<Tela trilha={trilhaAssimetrica()} />);
    const bloco = await screen.findByTestId('medida-flexao_joelho_max');
    const abrir = within(bloco).getByRole('button', { name: /Flexão máxima do joelho/ });
    if (abrir.getAttribute('aria-expanded') === 'false') fireEvent.click(abrir);
    const tabela = within(bloco).getByRole('table');
    expect(within(tabela).getByRole('columnheader', { name: 'Direito' })).toBeInTheDocument();
    expect(within(tabela).getByRole('columnheader', { name: 'Esquerdo' })).toBeInTheDocument();
    expect(within(tabela).getAllByTestId('linha-repeticao')).toHaveLength(6);
    for (const rotulo of ['Média', 'Desvio-padrão', 'n', 'Incerteza de um valor']) {
      expect(within(tabela).getByRole('rowheader', { name: rotulo })).toBeInTheDocument();
    }
  });

  it('realça a repetição discrepante sem cor de aprovação ou de alerta, e explica o realce', async () => {
    const { container } = render(<Tela trilha={trilhaAssimetrica()} />);
    const achados = await screen.findAllByTestId('achado');
    const discrepante = achados.find((a) => a.getAttribute('data-gatilho') === 'repeticao_discrepante');
    expect(discrepante).toBeDefined();
    expect(discrepante).toHaveTextContent(/Repetição discrepante: 4/);

    const destacadas = Array.from(container.querySelectorAll('[data-destaque="true"]'));
    expect(destacadas.length).toBeGreaterThan(0);
    for (const td of destacadas) {
      expect(td.className).not.toMatch(/(green|red|emerald|amber|rose|orange|lime|destructive|success|warning)/);
      expect(td).toHaveTextContent(/citado em um achado/);
    }
    const linhaDaQuarta = destacadas[0].closest('tr') as HTMLElement;
    expect(within(linhaDaQuarta).getByRole('rowheader')).toHaveTextContent(/^4$/);
    expect(screen.getByTestId('medidas-por-repeticao')).toHaveTextContent(/não indica aprovação nem alerta/);
  });

  it('as repetições identificadas mostram marcos, duração e como são segmentadas', async () => {
    render(<Tela trilha={trilhaSimetrica()} />);
    const bloco = await screen.findByTestId('repeticoes-identificadas');
    fireEvent.click(within(bloco).getByRole('button'));
    expect(within(bloco).getAllByRole('row')).toHaveLength(7);
    expect(bloco).toHaveTextContent(/Ponto mais baixo/);
    expect(bloco).toHaveTextContent(/Como são identificadas/);
    expect(bloco).toHaveTextContent(/Confira os marcos de cada repetição/);
  });

  it('recalcula quando a trilha muda e a assimetria some', async () => {
    const { rerender } = render(<Tela trilha={trilhaAssimetrica()} />);
    await waitFor(() => expect(screen.getAllByTestId('achado').some((a) => a.getAttribute('data-chave') === 'assimetria_flexao_joelho')).toBe(true));
    rerender(<Tela trilha={trilhaSimetrica()} />);
    await waitFor(() => expect(screen.queryAllByTestId('achado').some((a) => a.getAttribute('data-chave') === 'assimetria_flexao_joelho')).toBe(false));
    expect(screen.getByTestId('laudo-calculado')).toHaveAttribute('aria-busy', 'false');
  });

  it('as limitações ficam sempre visíveis, sem precisar abrir nada', async () => {
    render(<Tela trilha={trilhaSimetrica()} />);
    const lim = await screen.findByTestId('limitacoes-do-laudo');
    expect(lim).toBeVisible();
    expect(within(lim).getAllByRole('listitem').length).toBeGreaterThanOrEqual(3);
    expect(lim).toHaveTextContent(/duas dimensões|plano/i);
    expect(screen.getByRole('heading', { name: /Limitações/ })).toBeInTheDocument();
    const medidas = screen.getByTestId('medidas-por-repeticao');
    expect(lim.compareDocumentPosition(medidas) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('o método traz a fórmula da incerteza e as regras dos gatilhos, recolhido por padrão', async () => {
    render(<Tela trilha={trilhaSimetrica()} />);
    const metodo = await screen.findByTestId('metodo-do-laudo');
    expect(within(metodo).queryByText(/raiz\(/)).toBeNull();
    fireEvent.click(within(metodo).getByRole('button', { name: /Método/ }));
    expect(metodo.textContent).toMatch(/raiz\(/);
    expect(metodo).toHaveTextContent(/Iglewicz/);
  });

  it('nota que as medidas manuais fora do trecho não entram no laudo', async () => {
    const { rerender } = render(<Tela trilha={trilhaSimetrica()} foraDoTrecho={0} />);
    await screen.findByTestId('laudo-calculado');
    expect(screen.queryByTestId('nota-medidas-fora')).toBeNull();
    rerender(<Tela trilha={trilhaSimetrica()} foraDoTrecho={2} />);
    expect(screen.getByTestId('nota-medidas-fora')).toHaveTextContent('2 medidas guardadas em instantes fora do trecho analisado não entraram neste relatório.');
  });

  it('a marcha mostra a tabela por passada e por pé', async () => {
    render(<Tela gesto="marcha" trilha={trilhaMarcha({})} />);
    const bloco = await screen.findByTestId('medida-tempo_apoio');
    fireEvent.click(within(bloco).getByRole('button', { name: /Tempo de apoio/ }));
    expect(within(bloco).getByRole('columnheader', { name: 'Pé direito' })).toBeInTheDocument();
    expect(within(bloco).getByRole('columnheader', { name: 'Pé esquerdo' })).toBeInTheDocument();
    const linhas = within(bloco).getAllByTestId('linha-repeticao');
    expect(linhas.length).toBeGreaterThanOrEqual(6);
    expect(linhas[0].querySelector('th')?.textContent).toMatch(/^1 · pé (direito|esquerdo)$/);
    expect(within(bloco).getByRole('columnheader', { name: 'Passada' })).toBeInTheDocument();
  });
});

describe('critérios do profissional na aba', () => {
  const abrirComCriterio = async () => {
    let estado: EstadoLaudo | undefined;
    render(<Tela trilha={trilhaAssimetrica()} aoEstado={(e) => { estado = e; }} />);
    await screen.findByTestId('laudo-calculado');
    fireEvent.click(screen.getByTestId('adicionar-criterio'));
    return () => estado as EstadoLaudo;
  };

  it('um critério novo nasce desligado, sem valor e sem veredito', async () => {
    const estado = await abrirComCriterio();
    expect(screen.queryByTestId('sem-criterios')).toBeNull();
    const c = estado().criterios[0];
    expect(c.ativo).toBe(false);
    expect(Number.isNaN(c.valor)).toBe(true);
    const chave = screen.getByTestId('ligar-criterio');
    expect(chave).toHaveAttribute('role', 'switch');
    expect(chave).toHaveAttribute('aria-checked', 'false');
    expect(chave).toBeDisabled();
    expect(screen.getByTestId('estado-criterio')).toHaveTextContent('Desligado: não gera veredito.');
    expect(screen.getAllByTestId('achado').some((a) => a.getAttribute('data-gatilho') === 'criterio_profissional')).toBe(false);
  });

  it('só liga com valor e responsável; ligado dá o veredito e aparece como achado do critério', async () => {
    const estado = await abrirComCriterio();
    fireEvent.change(screen.getByLabelText(/Valor do limite/), { target: { value: '5' } });
    expect(screen.getByTestId('ligar-criterio')).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Definido por/), { target: { value: 'Dra. Teste' } });
    const chave = screen.getByTestId('ligar-criterio');
    expect(chave).toBeEnabled();
    fireEvent.click(chave);

    await waitFor(() => expect(screen.getByTestId('estado-criterio')).toHaveTextContent(/Ligado\. Resultado neste vídeo:/));
    expect(screen.getByTestId('estado-criterio')).toHaveTextContent(/Diferença entre os lados: .* fora do critério\./);
    const c: CriterioProfissional = estado().criterios[0];
    expect(c).toMatchObject({ ativo: true, valor: 5, definidoPor: 'Dra. Teste', operador: '<=' });
    expect(c.rotulo).toMatch(/≤ 5,0°/);

    const doCriterio = (await screen.findAllByTestId('achado')).find((a) => a.getAttribute('data-gatilho') === 'criterio_profissional') as HTMLElement;
    expect(doCriterio).toHaveTextContent(/Critério do profissional/);
    expect(within(doCriterio).getByTestId('situacao-achado')).toHaveTextContent('fora do critério');
  });

  it('um limite folgado dá "dentro do critério"', async () => {
    await abrirComCriterio();
    fireEvent.change(screen.getByLabelText(/Valor do limite/), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText(/Definido por/), { target: { value: 'Dr. Teste' } });
    fireEvent.click(screen.getByTestId('ligar-criterio'));
    await waitFor(() => expect(screen.getByTestId('estado-criterio')).toHaveTextContent(/dentro do critério\./));
  });

  it('apagar o valor ou o responsável desliga o critério em vez de deixá-lo ligado sem efeito', async () => {
    const estado = await abrirComCriterio();
    fireEvent.change(screen.getByLabelText(/Valor do limite/), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/Definido por/), { target: { value: 'Dra. Teste' } });
    fireEvent.click(screen.getByTestId('ligar-criterio'));
    await waitFor(() => expect(estado().criterios[0].ativo).toBe(true));

    fireEvent.change(screen.getByLabelText(/Definido por/), { target: { value: '   ' } });
    await waitFor(() => expect(estado().criterios[0].ativo).toBe(false));
    expect(screen.getByTestId('ligar-criterio')).toHaveAttribute('aria-checked', 'false');

    fireEvent.change(screen.getByLabelText(/Definido por/), { target: { value: 'Dra. Teste' } });
    fireEvent.click(screen.getByTestId('ligar-criterio'));
    await waitFor(() => expect(estado().criterios[0].ativo).toBe(true));
    fireEvent.change(screen.getByLabelText(/Valor do limite/), { target: { value: '' } });
    await waitFor(() => expect(estado().criterios[0].ativo).toBe(false));
  });

  it('aceita vírgula decimal e remove o critério', async () => {
    const estado = await abrirComCriterio();
    fireEvent.change(screen.getByLabelText(/Valor do limite/), { target: { value: '2,5' } });
    expect(estado().criterios[0].valor).toBe(2.5);
    fireEvent.click(screen.getByRole('button', { name: 'Remover o critério 1' }));
    expect(estado().criterios).toHaveLength(0);
    expect(screen.getByTestId('sem-criterios')).toBeInTheDocument();
  });

  it('o critério de uma medida de outro protocolo fica guardado, mas não se aplica', async () => {
    const estado = await abrirComCriterio();
    fireEvent.change(screen.getByLabelText(/Valor do limite/), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/Definido por/), { target: { value: 'Dra. Teste' } });
    fireEvent.click(screen.getByTestId('ligar-criterio'));
    await waitFor(() => expect(estado().criterios[0].ativo).toBe(true));
    act(() => estado().escolherProtocolo('agachamento_frontal'));
    await waitFor(() => expect(screen.getByTestId('estado-criterio')).toHaveTextContent(/Guardado, mas não aplicado neste protocolo/));
    expect(screen.queryByTestId('ligar-criterio')).toBeNull();
    expect(estado().criterios).toHaveLength(1);
  });

  it('o avanço do joelho, critério debatido na literatura, mostra a nota e não vem com valor presumido', async () => {
    const estado = await abrirComCriterio();
    const seletor = screen.getByLabelText('Medida avaliada') as HTMLSelectElement;
    const opcao = Array.from(seletor.options).find((o) => o.value.startsWith('avanco_joelho::')) as HTMLOptionElement;
    expect(opcao).toBeDefined();
    fireEvent.change(seletor, { target: { value: opcao.value } });
    expect(screen.getByTestId('nota-criterio-debatido-editor')).toBeInTheDocument();
    const c = estado().criterios[0];
    expect(c.chave).toBe('avanco_joelho');
    expect(c.ativo).toBe(false);
    expect(Number.isNaN(c.valor)).toBe(true);
    expect((screen.getByLabelText(/Valor do limite/) as HTMLInputElement).value).toBe('');
  });
});

describe('saídas do laudo', () => {
  it('baixa o PDF com o nome do protocolo e da data, gerado sob demanda e sem rede', async () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    const gerarPdf = vi.fn(async (_: LaudoMovimento) => blob);
    const baixar = vi.fn();
    render(<Tela trilha={trilhaSimetrica()} gerarPdf={gerarPdf} baixar={baixar} />);
    fireEvent.click(await screen.findByRole('button', { name: /Baixar laudo \(PDF\)/ }));
    await waitFor(() => expect(baixar).toHaveBeenCalledTimes(1));
    expect(baixar).toHaveBeenCalledWith(blob, 'laudo-agachamento-lateral-2026-10-18.pdf');
    const laudo = gerarPdf.mock.calls[0][0];
    expect(laudo.protocolo).toBe('agachamento_lateral');
    expect(laudo.rodape).toBe('Estimativa por vídeo · não é diagnóstico');
    expect(laudo.cabecalho.etiqueta).toBe('beta');
    expect(toast.success).toHaveBeenCalledWith('Laudo em PDF gerado.');
  });

  it('o laudo do PDF leva os critérios ligados e deixa o responsável pela revisão em branco', async () => {
    let estado: EstadoLaudo | undefined;
    const gerarPdf = vi.fn(async (_: LaudoMovimento) => new Blob(['x']));
    render(<Tela trilha={trilhaAssimetrica()} gerarPdf={gerarPdf} baixar={vi.fn()} aoEstado={(e) => { estado = e; }} />);
    await screen.findByTestId('laudo-calculado');
    fireEvent.click(screen.getByTestId('adicionar-criterio'));
    fireEvent.change(screen.getByLabelText(/Valor do limite/), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/Definido por/), { target: { value: 'Dra. Teste' } });
    fireEvent.click(screen.getByTestId('ligar-criterio'));
    await waitFor(() => expect(estado?.criterios[0].ativo).toBe(true));
    await waitFor(() => expect(screen.getByTestId('baixar-laudo')).toBeEnabled());
    fireEvent.click(screen.getByTestId('baixar-laudo'));
    await waitFor(() => expect(gerarPdf).toHaveBeenCalled());
    const laudo = gerarPdf.mock.calls[0][0];
    expect(laudo.achados.some((a) => a.achado.gatilho === 'criterio_profissional' && a.situacao === 'fora do critério')).toBe(true);
    const responsavel = laudo.cabecalho.linhas.find((l) => l.rotulo === 'Responsável pela revisão');
    expect(responsavel?.valor.trim() ?? '').toBe('');
  });

  it('mostra erro e libera o botão quando o PDF falha', async () => {
    const gerarPdf = vi.fn(async (_: LaudoMovimento): Promise<Blob> => { throw new Error('falha de teste'); });
    const baixar = vi.fn();
    render(<Tela trilha={trilhaSimetrica()} gerarPdf={gerarPdf} baixar={baixar} />);
    const botao = await screen.findByTestId('baixar-laudo');
    fireEvent.click(botao);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não consegui gerar o PDF do laudo.'));
    expect(baixar).not.toHaveBeenCalled();
    expect(botao).toBeEnabled();
  });

  it('copia o resumo em texto, com os avisos fixos e as limitações', async () => {
    const escrever = vi.fn(async (_: string) => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: escrever } });
    render(<Tela trilha={trilhaAssimetrica()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Copiar resumo/ }));
    await waitFor(() => expect(escrever).toHaveBeenCalledTimes(1));
    const texto = escrever.mock.calls[0][0];
    expect(texto).toContain('Laudo de apoio à avaliação do movimento (beta)');
    expect(texto).toContain('Estimativa por vídeo · não é diagnóstico');
    expect(texto).toMatch(/Limitações/);
    expect(termoProibido(texto)).toBeNull();
    expect(toast.success).toHaveBeenCalledWith('Resumo copiado.');
  });

  it('avisa quando a área de transferência não está disponível', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    render(<Tela trilha={trilhaSimetrica()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Copiar resumo/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Não consegui copiar.'));
  });

  it('declara que tudo roda no aparelho e que nenhum modelo de linguagem escreve o laudo', async () => {
    render(<Tela trilha={trilhaSimetrica()} />);
    const aba = await screen.findByTestId('laudo-calculado');
    expect(aba).toHaveTextContent(/calculado neste aparelho/);
    expect(aba).toHaveTextContent(/nenhum modelo de linguagem escreve o laudo/);
  });
});

describe('lista de achados com a biblioteca de fixtures (hipóteses sem fonte)', () => {
  const laudo = (): LaudoMovimento => {
    const p = protocoloDo('agachamento_lateral');
    const analise = analiseFixa('agachamento_lateral', [
      achado('assimetria_flexao_joelho', p, { lado: 'D', valoresPorLado: { D: 98.2, E: 91 } }),
      achado('valgo_dinamico', { ...p, achados: p.achados }, { gatilho: 'variacao_entre_repeticoes', lado: null }),
    ]);
    return montarLaudo(analise, contexto(), BIBLIOTECA_FIXA);
  };

  it('hipótese sem fonte vira "a confirmar" e diz "sem referência verificada"; achado sem entrada diz que não há hipóteses curadas', () => {
    render(<ListaAchados laudo={laudo()} />);
    const cartoes = screen.getAllByTestId('achado');
    expect(cartoes).toHaveLength(2);

    fireEvent.click(within(cartoes[0]).getByRole('button', { name: /Possíveis fatores contribuintes/ }));
    const hipoteses = within(cartoes[0]).getAllByTestId('hipotese');
    expect(hipoteses).toHaveLength(3);
    expect(hipoteses[0]).toHaveTextContent('Tipo de estudo: estudo observacional');
    expect(hipoteses[0]).toHaveTextContent(/Fontes: \[1\] \[2\]/);
    expect(hipoteses[1]).toHaveTextContent('Tipo de estudo: a confirmar');
    expect(hipoteses[1]).toHaveTextContent('sem referência verificada');
    expect(hipoteses[2]).toHaveTextContent('Tipo de estudo: a confirmar');
    expect(hipoteses[2]).not.toHaveTextContent('experimental');
    expect(hipoteses[2]).toHaveTextContent('sem referência verificada');

    const itens = within(cartoes[0]).getAllByTestId('item-conferir');
    expect(itens[0]).toHaveTextContent(/\[1\]/);
    expect(itens[1]).toHaveTextContent('sem referência verificada');

    const fontes = within(cartoes[0]).getAllByTestId('fonte-do-achado');
    expect(fontes).toHaveLength(2);
    expect(fontes[0]).toHaveTextContent('PMID 11111111');
    expect(fontes[0].querySelector('q')?.textContent).toBe('In this sample, the measured value was associated with the outcome.');
    expect(fontes[0].querySelector('a[href="https://pubmed.ncbi.nlm.nih.gov/11111111/"]')).not.toBeNull();

    fireEvent.click(within(cartoes[1]).getByRole('button', { name: /Possíveis fatores contribuintes/ }));
    expect(within(cartoes[1]).getByTestId('sem-biblioteca')).toBeInTheDocument();
    expect(within(cartoes[1]).queryAllByTestId('hipotese')).toHaveLength(0);
  });

  it('sem achados mostra a frase de que a medida segue na tabela como observação', () => {
    const p = protocoloDo('agachamento_lateral');
    const vazio = montarLaudo(analiseFixa(p.id, []), contexto(), BIBLIOTECA_FIXA);
    render(<ListaAchados laudo={vazio} />);
    expect(screen.getByTestId('sem-achados')).toBeInTheDocument();
    expect(screen.queryAllByTestId('achado')).toHaveLength(0);
  });
});
