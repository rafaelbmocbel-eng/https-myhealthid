import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';
import { envolverBanco, type BancoEnvolvido } from './helpers/bancoFalsoLeitura';

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = vi.fn();

const h = vi.hoisted(() => ({ falso: null as unknown as BancoFalso, banco: null as unknown as BancoEnvolvido }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (t: string) => h.banco.from(t),
    rpc: (nome: string, args?: Record<string, unknown>) => h.banco.rpc(nome, args),
    functions: { invoke: vi.fn() },
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1' } }) }));
vi.mock('@/components/voice/VoiceAssessment', () => ({ default: () => <div>VoiceAssessment simulado</div> }));

import LinhaDoTempoClinica from '@/components/resumoClinico/LinhaDoTempoClinica';
import SeloDeOrigem from '@/components/resumoClinico/SeloDeOrigem';
import AvaliacaoSecoesEditaveis from '@/components/voice/AvaliacaoSecoesEditaveis';
import AvaliacaoVozAtual from '@/components/voice/AvaliacaoVozAtual';
import { idDaConfirmacao, montarLinhaDaConfirmacao } from '@/lib/resumoClinico/confirmacao';
import type { EntradaDaConfirmacao } from '@/lib/resumoClinico/confirmacao';
import type { CirurgiaDoCliente, Marco } from '@/lib/resumoClinico/tipos';

// Linha do tempo: o botão "Confirmar com a data real" nos relatos de cirurgia do cliente, o marco confirmado (selo próprio,
// "Confirmado por você em", "ver relato original", notas de alterado e apagado) e o botão "Desfazer". A tela só chama as funções
// que recebe: nada aqui grava.

const TITULO_DA_LINHA = 'Linha do tempo clínica';
const CONFIRMAR = /^Confirmar com a data real/;
const LCA = { tipo: 'Ligamento do joelho (LCA)', ano: '2022', complicacoes: 'dor ao agachar' };
const TITULO_DO_CLIENTE_LCA = 'Cirurgia ou internação: Ligamento do joelho (LCA)';
const SELO_CONFIRMADO = 'Data confirmada pelo profissional · texto do cliente';

const avaliacao = (extra: Linha = {}): Linha => ({
  id: 'av-nova', paciente_id: 'pac-1', terapeuta_id: 'prof-1', created_at: '2026-10-06T15:00:00+00:00', queixa_principal: 'Dor lombar', servico: 'identidade',
  classificacao_severidade: 'Moderada', transcricao: '',
  resultado: { resumo_clinico: 'Paciente com dor lombar crônica.', classificacao_severidade: 'Moderada', queixa_principal: 'Dor lombar crônica', dor: { localizacao: 'Lombar', intensidade_eva: 7 }, _meta: { mode: 'voice', savedAt: 's1' }, _secoes: { confirmadas: ['resumo_clinico', 'dor'], editadas: {} } },
  ...extra,
});

interface ItemDoCliente { id?: string; tipo: string; ano: unknown; complicacoes?: string }
const cirurgiasDoCliente = (...items: ItemDoCliente[]) => ({ cirurgias: { items }, ultimo_envio: '2026-10-02T12:00:00+00:00' });

// Um relato com ano válido (vira marco) e outro com "há 2 anos" (cai em "Sem data"); mais envio, MyID, diagnóstico, diagnóstico
// sem data e um registro do profissional: o que NÃO pode ganhar o botão.
function cenario(extra: Record<string, Linha[]> = {}, itens: ItemDoCliente[] = [{ id: 'c1', ...LCA }, { id: 'c2', tipo: 'Apêndice', ano: 'há 2 anos' }]): Record<string, Linha[]> {
  return {
    pacientes: [{ id: 'pac-1', historico_clinico: cirurgiasDoCliente(...itens), historia_atual: { queixa: 'Dor lombar do lado direito', inicio: 'Há 3 semanas, depois da mudança' } }],
    myid_avaliacoes: [{ id: 'm1', paciente_id: 'pac-1', status: 'concluido', created_at: '2026-09-01T12:00:00+00:00', updated_at: '2026-09-02T12:00:00+00:00', respostas_brutas: { bloco_1_queixa: 'Dor ao sentar' } }],
    avaliacoes_identidade: [],
    avaliacoes_voz: [avaliacao()],
    historia_vida_paciente: [{ id: 'h1', paciente_id: 'pac-1', data_evento: '2019-03-04', tipo: 'fratura', titulo: 'Fratura de punho', descricao: '' }],
    diagnosticos_paciente: [
      { id: 'd1', paciente_id: 'pac-1', data_diagnostico: '2024-05-06', cid_codigo: 'M54.5', cid_descricao: 'Dor lombar baixa', created_at: '2026-01-01T12:00:00+00:00', ativo: true, tipo: 'principal' },
      { id: 'd-sem', paciente_id: 'pac-1', data_diagnostico: null, cid_codigo: 'M51.1', cid_descricao: 'Hérnia de disco', created_at: '2026-01-02T12:00:00+00:00', ativo: true, tipo: 'secundario' },
    ],
    exames_presenciais: [], exames_importados: [], testes_funcionais_paciente: [], escalas_psicologia: [], notas_prontuario: [], eventos_clinicos_anatomicos: [],
    ...extra,
  };
}

// A linha como o app a grava (o mesmo montador que o hook usa), com o created_at que o servidor preencheria.
function confirmacao(parcial: Partial<EntradaDaConfirmacao> = {}, linhaExtra: Linha = {}): Linha {
  const r = montarLinhaDaConfirmacao({
    terapeutaId: 'prof-1', pacienteId: 'pac-1', chave: 'historico_clinico:cirurgia:id:c1', relato: { ...LCA }, tipo: 'cirurgia', precisao: 'dia', texto: '2022-06-10',
    profissional: { nome: 'Ana', sobrenome: 'Souza', crefito: '12345-F' }, ...parcial,
  }, '2026-11-15');
  if (r.erro) throw new Error(r.erro);
  return { ...r.linha, created_at: '2026-10-01T15:00:00+00:00', ...linhaExtra };
}
const comAConfirmacao = (...extras: Linha[]) => cenario({ historia_vida_paciente: [cenario().historia_vida_paciente[0], ...extras] });

function preparar(tabelas: Record<string, Linha[]> = cenario()) {
  h.falso = criarBancoFalso(tabelas);
  h.banco = envolverBanco(h.falso);
}

const cliente = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });

interface PropsDaLinha {
  onConfirmarMarco?: (c: CirurgiaDoCliente) => void;
  onDesfazerMarco?: (m: Marco) => void;
}
function montar(props: PropsDaLinha = {}) {
  return render(<QueryClientProvider client={cliente()}><LinhaDoTempoClinica pacienteId="pac-1" {...props} /></QueryClientProvider>);
}

const regiao = () => screen.findByRole('region', { name: TITULO_DA_LINHA });
async function esperarOsMarcos(r: HTMLElement) {
  await waitFor(() => expect(within(r).getByText('Fratura de punho')).toBeInTheDocument());
}
const abrirSemData = (r: HTMLElement) => fireEvent.click(within(r).getByRole('button', { name: /^Sem data/ }));
const listaSemData = (r: HTMLElement) => r.querySelector('#linha-do-tempo-sem-data') as HTMLElement;
// O título é o primeiro parágrafo do item. O bloco "ver relato original" repete o texto do cliente (escondido), então buscar pelo
// texto sozinho acharia dois elementos.
const tituloDoItem = (li: Element) => (li.querySelector('p')?.textContent ?? '').replace(/^(Fato clínico: |Registro no app: )/, '');
const achar = (r: HTMLElement, titulo: string) => Array.from(r.querySelectorAll('li')).find((li) => tituloDoItem(li) === titulo) as HTMLElement | undefined;
const itemPorTitulo = (r: HTMLElement, titulo: string) => {
  const li = achar(r, titulo);
  if (!li) throw new Error(`nenhum item com o título "${titulo}"`);
  return li;
};
const esperarItem = (r: HTMLElement, titulo: string) => waitFor(() => expect(achar(r, titulo), titulo).toBeDefined());
const botoesConfirmar = (raiz: HTMLElement) => within(raiz).queryAllByRole('button', { name: CONFIRMAR });
const botaoVerRelato = (li: HTMLElement) => within(li).getByRole('button', { name: 'ver relato original' });
const blocoDoRelato = (botao: HTMLElement) => document.getElementById(botao.getAttribute('aria-controls') as string) as HTMLElement;

beforeEach(() => { vi.mocked(Element.prototype.scrollIntoView).mockClear(); preparar(); });

describe('Confirmar com a data real: quem ganha o botão', () => {
  it('com a função da página, ganham o botão SÓ o relato de cirurgia com ano válido (marco) e o de "Sem data"', async () => {
    montar({ onConfirmarMarco: vi.fn() });
    const r = await regiao();
    await esperarOsMarcos(r);
    abrirSemData(r);
    expect(botoesConfirmar(r).map((b) => b.getAttribute('aria-label'))).toEqual([
      `Confirmar com a data real: ${TITULO_DO_CLIENTE_LCA}`,
      'Confirmar com a data real: Cirurgia ou internação: Apêndice',
    ]);
    expect(within(itemPorTitulo(r, TITULO_DO_CLIENTE_LCA)).getAllByRole('button')).toHaveLength(1);
    expect(botoesConfirmar(listaSemData(r))).toHaveLength(1);
  });

  it('o botão mostra "Confirmar com a data real" na tela e o resto do nome fica para o leitor de tela', async () => {
    montar({ onConfirmarMarco: vi.fn() });
    const r = await regiao();
    await esperarOsMarcos(r);
    const botao = botoesConfirmar(r)[0];
    expect(botao.textContent?.trim()).toBe('Confirmar com a data real');
    expect(botao.getAttribute('type')).toBe('button');
  });

  it('NÃO ganham o botão: envio do histórico, MyID, diagnóstico (com e sem data), registro do profissional e "Como começou"', async () => {
    montar({ onConfirmarMarco: vi.fn() });
    const r = await regiao();
    await esperarOsMarcos(r);
    abrirSemData(r);
    for (const titulo of ['[M54.5] Dor lombar baixa', 'Fratura de punho']) {
      expect(botoesConfirmar(itemPorTitulo(r, titulo)), titulo).toHaveLength(0);
    }
    for (const li of Array.from(r.querySelectorAll('li'))) {
      const texto = li.textContent ?? '';
      if (/Ligamento do joelho|Apêndice/.test(texto)) continue;
      expect(botoesConfirmar(li as HTMLElement), texto).toHaveLength(0);
    }
    expect(botoesConfirmar(r)).toHaveLength(2);
  });

  it('sem a função da página, nenhum botão aparece (nunca um botão que não leva a lugar nenhum)', async () => {
    montar();
    const r = await regiao();
    await esperarOsMarcos(r);
    abrirSemData(r);
    expect(botoesConfirmar(r)).toHaveLength(0);
    expect(within(r).queryByRole('button', { name: /Desfazer/ })).toBeNull();
  });

  it('item do cliente SEM id também ganha o botão, com a chave por posição e conteúdo', async () => {
    preparar(cenario({}, [{ tipo: 'Coluna', ano: '2020' }]));
    const confirmar = vi.fn();
    montar({ onConfirmarMarco: confirmar });
    const r = await regiao();
    await esperarOsMarcos(r);
    fireEvent.click(botoesConfirmar(r)[0]);
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(confirmar.mock.calls[0][0]).toEqual({ chave: expect.stringMatching(/^historico_clinico:cirurgia:pos:0:[0-9a-f]{16}$/), tipo: 'Coluna', ano: '2020', complicacoes: '' });
  });

  it('clicar chama a função com o item certo (marco e "Sem data"), uma vez por clique, e não grava nada', async () => {
    const confirmar = vi.fn();
    montar({ onConfirmarMarco: confirmar });
    const r = await regiao();
    await esperarOsMarcos(r);
    abrirSemData(r);
    fireEvent.click(botoesConfirmar(r)[0]);
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(confirmar).toHaveBeenLastCalledWith({ chave: 'historico_clinico:cirurgia:id:c1', tipo: LCA.tipo, ano: '2022', complicacoes: 'dor ao agachar' });
    fireEvent.click(botoesConfirmar(r)[1]);
    expect(confirmar).toHaveBeenCalledTimes(2);
    expect(confirmar).toHaveBeenLastCalledWith({ chave: 'historico_clinico:cirurgia:id:c2', tipo: 'Apêndice', ano: 'há 2 anos', complicacoes: '' });
    expect(h.falso.escritas()).toEqual([]);
  });

  it('o relato do cliente continua com o selo "Relatado pelo cliente, não revisado" mesmo com o botão', async () => {
    montar({ onConfirmarMarco: vi.fn() });
    const r = await regiao();
    await esperarOsMarcos(r);
    const selo = itemPorTitulo(r, TITULO_DO_CLIENTE_LCA).querySelector('[data-origem]') as HTMLElement;
    expect(selo.textContent).toBe('Relatado pelo cliente, não revisado');
    expect(selo.getAttribute('data-origem')).toBe('cliente');
    expect(selo.hasAttribute('data-selo')).toBe(false);
  });

  it('item cuja confirmação já existe (texto mudado depois) não ganha o botão de novo', async () => {
    preparar(cenario({ historia_vida_paciente: [confirmacao()] }, [{ id: 'c1', ...LCA, complicacoes: 'dor nova' }]));
    montar({ onConfirmarMarco: vi.fn(), onDesfazerMarco: vi.fn() });
    const r = await regiao();
    await waitFor(() => expect(within(r).getAllByText(TITULO_DO_CLIENTE_LCA, { exact: false }).length).toBeGreaterThan(0));
    expect(botoesConfirmar(r)).toHaveLength(0);
  });
});

describe('Marco confirmado: a data real no lugar do relato do cliente', () => {
  const comConfirmacaoIgual = () => preparar(comAConfirmacao(confirmacao()));

  it('o relato do cliente sai da lista e o marco confirmado traz o título como gravado, a data real e o tipo', async () => {
    comConfirmacaoIgual();
    montar({ onConfirmarMarco: vi.fn() });
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    expect(within(r).queryByText(TITULO_DO_CLIENTE_LCA)).toBeNull();
    const li = itemPorTitulo(r, LCA.tipo);
    expect(li.getAttribute('data-precisao')).toBe('dia');
    expect(li.textContent).toContain('10/06/2022');
    expect(li.textContent).toContain('Cirurgia');
    expect(li.closest('div')?.querySelector('h4')?.textContent).toBe('2022');
    expect(botoesConfirmar(li)).toHaveLength(0);
  });

  it('selo próprio "Data confirmada pelo profissional · texto do cliente" (e não o de "Registrado pelo profissional")', async () => {
    comConfirmacaoIgual();
    montar();
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    const li = itemPorTitulo(r, LCA.tipo);
    const selos = Array.from(li.querySelectorAll('[data-origem]')) as HTMLElement[];
    const doMarco = selos[0];
    expect(doMarco.textContent).toBe(SELO_CONFIRMADO);
    expect(doMarco.getAttribute('data-selo')).toBe('data-confirmada');
    expect(doMarco.getAttribute('data-origem')).toBe('profissional');
    expect(li.querySelectorAll('[data-selo="data-confirmada"]')).toHaveLength(1);
    expect(within(li).queryByText('Registrado pelo profissional')).toBeNull();
  });

  it('o registro comum do profissional continua com o selo "Registrado pelo profissional" e o do cliente com o dele', async () => {
    comConfirmacaoIgual();
    montar();
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    const fratura = itemPorTitulo(r, 'Fratura de punho').querySelector('[data-origem]') as HTMLElement;
    expect(fratura.textContent).toBe('Registrado pelo profissional');
    expect(fratura.hasAttribute('data-selo')).toBe(false);
    abrirSemData(r);
    const apendice = within(listaSemData(r)).getByText(/Apêndice/).closest('li') as HTMLElement;
    expect((apendice.querySelector('[data-origem]') as HTMLElement).textContent).toBe('Relatado pelo cliente, não revisado');
  });

  it('mostra "Confirmado por você em dd/mm/aaaa" com o dia do Brasil em que foi gravada', async () => {
    comConfirmacaoIgual();
    montar();
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    expect(within(itemPorTitulo(r, LCA.tipo)).getByText('Confirmado por você em 01/10/2026')).toBeInTheDocument();
  });

  it('gravada às 01h UTC do dia 2 (ainda dia 1 em Brasília): mostra o dia 1', async () => {
    preparar(comAConfirmacao(confirmacao({}, { created_at: '2026-10-02T01:30:00+00:00' })));
    montar();
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    expect(within(itemPorTitulo(r, LCA.tipo)).getByText('Confirmado por você em 01/10/2026')).toBeInTheDocument();
  });

  it('created_at ilegível: a frase "Confirmado por você em" some em vez de inventar uma data', async () => {
    preparar(comAConfirmacao(confirmacao({}, { created_at: 'quando foi?' })));
    montar();
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    expect(itemPorTitulo(r, LCA.tipo).textContent).not.toMatch(/Confirmado por você/);
  });

  it('só o ano: mostra "2022" (data-precisao ano) e nunca "01/01/2022"; a frase "Data aproximada" não repete', async () => {
    preparar(comAConfirmacao(confirmacao({ precisao: 'ano', texto: '2022' })));
    montar();
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    const li = itemPorTitulo(r, LCA.tipo);
    expect(li.getAttribute('data-precisao')).toBe('ano');
    expect(li.textContent).toContain('2022 · Cirurgia');
    expect(li.textContent).not.toContain('01/01/2022');
    expect(li.textContent).not.toContain('Data aproximada');
  });

  it('internação confirmada mostra o rótulo "Internação"', async () => {
    preparar(comAConfirmacao(confirmacao({ tipo: 'internacao' })));
    montar();
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    expect(itemPorTitulo(r, LCA.tipo).textContent).toContain('Internação');
  });

  it('o relato de "Sem data" confirmado sai de lá e o marco confirmado aparece na linha do tempo', async () => {
    preparar(comAConfirmacao(confirmacao({ chave: 'historico_clinico:cirurgia:id:c2', relato: { tipo: 'Apêndice', ano: 'há 2 anos', complicacoes: '' }, texto: '2019-03-04' })));
    montar({ onConfirmarMarco: vi.fn() });
    const r = await regiao();
    await esperarItem(r, 'Apêndice');
    abrirSemData(r);
    expect(within(listaSemData(r)).queryByText(/Apêndice/)).toBeNull();
    expect(itemPorTitulo(r, 'Apêndice').textContent).toContain('04/03/2019');
    // Sobram os dois botões do que ainda não foi confirmado: o relato do LCA no marco (a confirmação foi do outro item).
    expect(botoesConfirmar(r).map((b) => b.getAttribute('aria-label'))).toEqual([`Confirmar com a data real: ${TITULO_DO_CLIENTE_LCA}`]);
  });
});

describe('"ver relato original": o texto GUARDADO na confirmação', () => {
  it('é um botão recolhível: aria-expanded e aria-controls apontam para um bloco que sempre existe e começa escondido', async () => {
    preparar(comAConfirmacao(confirmacao()));
    montar();
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    const botao = botaoVerRelato(itemPorTitulo(r, LCA.tipo));
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    const bloco = blocoDoRelato(botao);
    expect(bloco).not.toBeNull();
    expect(bloco.hidden).toBe(true);

    fireEvent.click(botao);
    expect(botao.getAttribute('aria-expanded')).toBe('true');
    expect(bloco.hidden).toBe(false);
    expect(within(bloco).getByText('Relato do cliente (não revisado)')).toBeInTheDocument();
    expect(within(bloco).getByText('Relatado pelo cliente, não revisado')).toBeInTheDocument();
    expect(within(bloco).getByText(LCA.tipo)).toBeInTheDocument();
    expect(within(bloco).getByText('Ano que o cliente escreveu: "2022"')).toBeInTheDocument();
    expect(within(bloco).getByText('Complicações: dor ao agachar')).toBeInTheDocument();

    fireEvent.click(botao);
    expect(botao.getAttribute('aria-expanded')).toBe('false');
    expect(bloco.hidden).toBe(true);
  });

  it('mostra o ano exatamente como o cliente escreveu ("2O22" com letra O) e as complicações com as quebras de linha', async () => {
    preparar(cenario({ historia_vida_paciente: [confirmacao({ relato: { tipo: LCA.tipo, ano: '2O22', complicacoes: 'dor\nforte' }, precisao: 'ano', texto: '2022' })] }, [{ id: 'c1', tipo: LCA.tipo, ano: '2O22', complicacoes: 'dor\nforte' }]));
    montar();
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    const bloco = blocoDoRelato(botaoVerRelato(itemPorTitulo(r, LCA.tipo)));
    expect(within(bloco).getByText('Ano que o cliente escreveu: "2O22"')).toBeInTheDocument();
    const complicacoes = within(bloco).getByText(/Complicações:/);
    expect(complicacoes.textContent).toBe('Complicações: dor\nforte');
    expect(complicacoes.className).toContain('whitespace-pre-wrap');
  });

  it('o ano escrito pelo cliente aparece INTEIRO, mesmo quando é uma frase ("no verão de 2019"): nada é cortado nem reescrito', async () => {
    const frase = 'no verão de 2019, mais ou menos';
    preparar(cenario({ historia_vida_paciente: [confirmacao({ relato: { tipo: LCA.tipo, ano: frase, complicacoes: '' }, precisao: 'ano', texto: '2019' })] }, [{ id: 'c1', tipo: LCA.tipo, ano: frase }]));
    montar();
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    const bloco = blocoDoRelato(botaoVerRelato(itemPorTitulo(r, LCA.tipo)));
    expect(within(bloco).getByText(`Ano que o cliente escreveu: "${frase}"`)).toBeInTheDocument();
  });

  it('mostra o texto guardado, nunca o dado vivo: se o cliente mudou o item depois, o bloco ainda traz o original', async () => {
    preparar(cenario({ historia_vida_paciente: [confirmacao()] }, [{ id: 'c1', tipo: LCA.tipo, ano: '2021', complicacoes: 'texto novo do cliente' }]));
    montar();
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    const bloco = blocoDoRelato(botaoVerRelato(itemPorTitulo(r, LCA.tipo)));
    expect(bloco.textContent).toContain('Ano que o cliente escreveu: "2022"');
    expect(bloco.textContent).toContain('Complicações: dor ao agachar');
    expect(bloco.textContent).not.toContain('texto novo do cliente');
    expect(bloco.textContent).not.toContain('2021');
  });

  it('cada marco confirmado tem o próprio bloco e o próprio id', async () => {
    preparar(comAConfirmacao(
      confirmacao(),
      confirmacao({ chave: 'historico_clinico:cirurgia:id:c2', relato: { tipo: 'Apêndice', ano: '2019', complicacoes: '' }, texto: '2019-03-04' }),
    ));
    montar();
    const r = await regiao();
    await esperarItem(r, 'Apêndice');
    const a = botaoVerRelato(itemPorTitulo(r, LCA.tipo));
    const b = botaoVerRelato(itemPorTitulo(r, 'Apêndice'));
    expect(a.getAttribute('aria-controls')).not.toBe(b.getAttribute('aria-controls'));
    fireEvent.click(a);
    expect(blocoDoRelato(a).hidden).toBe(false);
    expect(blocoDoRelato(b).hidden).toBe(true);
  });
});

describe('situação da confirmação: igual, alterado, apagado', () => {
  const NOTA_ALTERADO = 'O cliente mudou este item depois da confirmação; o relato atual também aparece na lista.';
  const NOTA_APAGADO = 'O cliente apagou este item depois da confirmação.';

  it('igual: sem nota nenhuma', async () => {
    preparar(comAConfirmacao(confirmacao()));
    montar();
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    expect(r.textContent).not.toContain(NOTA_ALTERADO);
    expect(r.textContent).not.toContain(NOTA_APAGADO);
  });

  it('alterado: a nota aparece no marco confirmado e o relato atual do cliente continua na lista, sem botão de confirmar', async () => {
    preparar(cenario({ historia_vida_paciente: [confirmacao()] }, [{ id: 'c1', ...LCA, complicacoes: 'dor nova' }, { id: 'c2', tipo: 'Apêndice', ano: 'há 2 anos' }]));
    montar({ onConfirmarMarco: vi.fn(), onDesfazerMarco: vi.fn() });
    const r = await regiao();
    await waitFor(() => expect(within(r).getByText(TITULO_DO_CLIENTE_LCA)).toBeInTheDocument());
    const confirmado = itemPorTitulo(r, LCA.tipo);
    expect(within(confirmado).getByText(NOTA_ALTERADO)).toBeInTheDocument();
    expect(confirmado.querySelector('[data-situacao="alterado"]')).not.toBeNull();
    const doCliente = itemPorTitulo(r, TITULO_DO_CLIENTE_LCA);
    expect(doCliente).not.toBe(confirmado);
    expect(doCliente.textContent).toContain('Complicações: dor nova');
    expect(botoesConfirmar(doCliente)).toHaveLength(0);
    expect((doCliente.querySelector('[data-origem]') as HTMLElement).textContent).toBe('Relatado pelo cliente, não revisado');
    // O outro item (nunca confirmado) segue com o botão.
    abrirSemData(r);
    expect(botoesConfirmar(r)).toHaveLength(1);
  });

  it('apagado: o cliente apagou o item; só o marco confirmado fica, com a nota', async () => {
    preparar(cenario({ historia_vida_paciente: [confirmacao()] }, [{ id: 'c9', tipo: 'Outra cirurgia', ano: '2015' }]));
    montar();
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    const confirmado = itemPorTitulo(r, LCA.tipo);
    expect(within(confirmado).getByText(NOTA_APAGADO)).toBeInTheDocument();
    expect(confirmado.querySelector('[data-situacao="apagado"]')).not.toBeNull();
    expect(within(r).queryByText(TITULO_DO_CLIENTE_LCA)).toBeNull();
  });

  it('as notas usam o par claro/escuro (nada de cor fixa)', async () => {
    preparar(cenario({ historia_vida_paciente: [confirmacao()] }, []));
    montar();
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    const nota = r.querySelector('[data-situacao="apagado"]') as HTMLElement;
    expect(nota.className).toContain('text-amber-800');
    expect(nota.className).toContain('dark:text-amber-300');
    const selo = r.querySelector('[data-selo="data-confirmada"]') as HTMLElement;
    expect(selo.className).toContain('dark:text-teal-300');
  });
});

describe('Desfazer', () => {
  it('com a função, o marco confirmado ganha "Desfazer" (e só ele), com o nome acessível do marco', async () => {
    preparar(comAConfirmacao(confirmacao()));
    montar({ onDesfazerMarco: vi.fn() });
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    const botoes = within(r).getAllByRole('button', { name: /Desfazer/ });
    expect(botoes).toHaveLength(1);
    expect(botoes[0].textContent?.trim()).toBe('Desfazer');
    expect(botoes[0].getAttribute('aria-label')).toBe(`Desfazer a confirmação de ${LCA.tipo}`);
    expect(within(itemPorTitulo(r, LCA.tipo)).getByRole('button', { name: /Desfazer/ })).toBe(botoes[0]);
  });

  it('clicar chama a função com o marco confirmado (o id da linha vem dele) e não grava nada', async () => {
    preparar(comAConfirmacao(confirmacao()));
    const desfazer = vi.fn();
    montar({ onDesfazerMarco: desfazer });
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    fireEvent.click(within(r).getByRole('button', { name: /Desfazer/ }));
    expect(desfazer).toHaveBeenCalledTimes(1);
    const marco = desfazer.mock.calls[0][0] as Marco;
    expect(marco.titulo).toBe(LCA.tipo);
    expect(marco.confirmacao?.idDaLinha).toBe(idDaConfirmacao('prof-1', 'pac-1', 'historico_clinico:cirurgia:id:c1'));
    expect(h.falso.escritas()).toEqual([]);
  });

  it('sem a função, o marco confirmado não ganha "Desfazer" mas continua com "ver relato original"', async () => {
    preparar(comAConfirmacao(confirmacao()));
    montar({ onConfirmarMarco: vi.fn() });
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    expect(within(r).queryByRole('button', { name: /Desfazer/ })).toBeNull();
    expect(botaoVerRelato(itemPorTitulo(r, LCA.tipo))).toBeInTheDocument();
  });

  it('nenhum outro marco ganha "Desfazer" (só o que tem confirmação)', async () => {
    preparar(comAConfirmacao(confirmacao()));
    montar({ onDesfazerMarco: vi.fn(), onConfirmarMarco: vi.fn() });
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    expect(within(itemPorTitulo(r, 'Fratura de punho')).queryByRole('button', { name: /Desfazer/ })).toBeNull();
    expect(within(itemPorTitulo(r, '[M54.5] Dor lombar baixa')).queryByRole('button', { name: /Desfazer/ })).toBeNull();
  });
});

describe('os botões e o texto do cliente no celular e no modo escuro', () => {
  it('Confirmar, "ver relato original" e Desfazer têm 44 px (min-h-11 e min-w-11)', async () => {
    preparar(comAConfirmacao(confirmacao()));
    montar({ onConfirmarMarco: vi.fn(), onDesfazerMarco: vi.fn() });
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    abrirSemData(r);
    const botoes = [
      ...botoesConfirmar(r),
      botaoVerRelato(itemPorTitulo(r, LCA.tipo)),
      within(r).getByRole('button', { name: /^Desfazer/ }),
    ];
    expect(botoes).toHaveLength(3);
    for (const b of botoes) {
      expect(b.className, b.textContent ?? '').toContain('min-h-11');
      expect(b.className, b.textContent ?? '').toContain('min-w-11');
    }
  });

  it('o texto do cliente nunca é cortado: nada de truncate, line-clamp, reticências, nowrap nem overflow escondido', async () => {
    const longo = 'dor '.repeat(300).trim();
    preparar(cenario({ historia_vida_paciente: [confirmacao({ relato: { tipo: LCA.tipo, ano: '2022', complicacoes: longo } })] }, [{ id: 'c1', tipo: LCA.tipo, ano: '2022', complicacoes: longo }]));
    montar({ onConfirmarMarco: vi.fn(), onDesfazerMarco: vi.fn() });
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    const li = itemPorTitulo(r, LCA.tipo);
    fireEvent.click(botaoVerRelato(li));
    expect(li.innerHTML).not.toMatch(/truncate|line-clamp|text-ellipsis|whitespace-nowrap|overflow-hidden/);
    expect(within(blocoDoRelato(botaoVerRelato(li))).getByText(`Complicações: ${longo}`)).toBeInTheDocument();
    const bloco = blocoDoRelato(botaoVerRelato(li));
    expect(bloco.className).toContain('min-w-0');
    for (const p of Array.from(bloco.querySelectorAll('p')).filter((el) => /Complicações|Ano que|Ligamento/.test(el.textContent ?? ''))) {
      expect(p.className).toMatch(/break-words/);
    }
  });

  it('só usa as cores do tema e pares claro/escuro: nada de branco, preto ou cinza fixo nos blocos novos', async () => {
    preparar(comAConfirmacao(confirmacao()));
    montar({ onConfirmarMarco: vi.fn(), onDesfazerMarco: vi.fn() });
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    const li = itemPorTitulo(r, LCA.tipo);
    expect(li.innerHTML).not.toMatch(/\b(bg|text|border)-(white|black|gray|slate|zinc|neutral|stone)(-\d+)?\b|#[0-9a-fA-F]{3,6}\b/);
  });
});

describe('o botão chega da página até a linha do tempo nas três formas da aba Avaliação', () => {
  const montarAvaliacaoAtual = (props: PropsDaLinha) => render(
    <QueryClientProvider client={cliente()}>
      <MemoryRouter><AvaliacaoVozAtual pacienteId="pac-1" patientName="Ana Souza" {...props} /></MemoryRouter>
    </QueryClientProvider>,
  );

  it('com avaliação (abas editáveis): Confirmar chega ao relato do cliente e Desfazer ao marco confirmado', async () => {
    preparar(comAConfirmacao(confirmacao({ chave: 'historico_clinico:cirurgia:id:c2', relato: { tipo: 'Apêndice', ano: 'há 2 anos', complicacoes: '' }, texto: '2019-03-04' })));
    const confirmar = vi.fn();
    const desfazer = vi.fn();
    montarAvaliacaoAtual({ onConfirmarMarco: confirmar, onDesfazerMarco: desfazer });
    const r = await regiao();
    await esperarItem(r, 'Apêndice');
    fireEvent.click(botoesConfirmar(r)[0]);
    expect(confirmar).toHaveBeenCalledWith(expect.objectContaining({ chave: 'historico_clinico:cirurgia:id:c1' }));
    fireEvent.click(within(r).getByRole('button', { name: /^Desfazer/ }));
    expect((desfazer.mock.calls[0][0] as Marco).titulo).toBe('Apêndice');
  });

  it('avaliação ainda sem resultado (tela de gravação): a linha do tempo também recebe as funções', async () => {
    preparar(comAConfirmacao(confirmacao()));
    h.falso.tabelas.avaliacoes_voz = [avaliacao({ resultado: null })];
    const confirmar = vi.fn();
    const desfazer = vi.fn();
    montarAvaliacaoAtual({ onConfirmarMarco: confirmar, onDesfazerMarco: desfazer });
    const r = await regiao();
    await esperarItem(r, LCA.tipo);
    fireEvent.click(within(r).getByRole('button', { name: /^Desfazer/ }));
    expect(desfazer).toHaveBeenCalledTimes(1);
  });

  it('sem avaliação por voz do profissional: a linha do tempo sozinha também recebe as funções', async () => {
    preparar(cenario({ avaliacoes_voz: [] }));
    const confirmar = vi.fn();
    montarAvaliacaoAtual({ onConfirmarMarco: confirmar });
    const r = await regiao();
    await esperarOsMarcos(r);
    expect(screen.getAllByRole('region', { name: TITULO_DA_LINHA })).toHaveLength(1);
    fireEvent.click(botoesConfirmar(r)[0]);
    expect(confirmar).toHaveBeenCalledTimes(1);
  });

  it('sem as funções, nenhuma das formas mostra botão de confirmar nem de desfazer', async () => {
    for (const avaliacoes of [[], [avaliacao()], [avaliacao({ resultado: null })]]) {
      preparar(comAConfirmacao(confirmacao()));
      h.falso.tabelas.avaliacoes_voz = avaliacoes;
      const { unmount } = montarAvaliacaoAtual({});
      const r = await regiao();
      await esperarItem(r, LCA.tipo);
      abrirSemData(r);
      expect(botoesConfirmar(r)).toHaveLength(0);
      expect(within(r).queryByRole('button', { name: /^Desfazer/ })).toBeNull();
      unmount();
    }
  });

  it('AvaliacaoSecoesEditaveis sozinha leva as funções para a linha do tempo da aba Clínico', async () => {
    preparar(comAConfirmacao(confirmacao({ chave: 'historico_clinico:cirurgia:id:c2', relato: { tipo: 'Apêndice', ano: 'há 2 anos', complicacoes: '' }, texto: '2019-03-04' })));
    const confirmar = vi.fn();
    const desfazer = vi.fn();
    render(
      <QueryClientProvider client={cliente()}>
        <MemoryRouter>
          <AvaliacaoSecoesEditaveis pacienteId="pac-1" avaliacaoId="av-nova" resultado={avaliacao().resultado} transcricao="" onReprocessar={vi.fn()} onConfirmarMarco={confirmar} onDesfazerMarco={desfazer} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Clínico/ }), { button: 0, ctrlKey: false });
    const r = await regiao();
    await esperarItem(r, 'Apêndice');
    fireEvent.click(botoesConfirmar(r)[0]);
    fireEvent.click(within(r).getByRole('button', { name: /^Desfazer/ }));
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(desfazer).toHaveBeenCalledTimes(1);
  });
});

describe('SeloDeOrigem: os três visuais, cada um com o seu par claro e escuro', () => {
  const selo = (props: { origem: 'cliente' | 'profissional'; dataConfirmada?: boolean }) => {
    const { container, unmount } = render(<SeloDeOrigem {...props} />);
    const el = container.firstElementChild as HTMLElement;
    return { el, unmount };
  };

  it('cliente: "Relatado pelo cliente, não revisado", âmbar, sem a marca de data confirmada', () => {
    const { el } = selo({ origem: 'cliente' });
    expect(el.textContent).toBe('Relatado pelo cliente, não revisado');
    expect(el.getAttribute('data-origem')).toBe('cliente');
    expect(el.hasAttribute('data-selo')).toBe(false);
    expect(el.className).toContain('text-amber-800');
    expect(el.className).toContain('dark:text-amber-300');
    expect(el.className).toContain('border-amber-500/30');
    expect(el.className).not.toMatch(/emerald|teal/);
  });

  it('profissional: "Registrado pelo profissional", verde, sem a marca de data confirmada', () => {
    const { el } = selo({ origem: 'profissional' });
    expect(el.textContent).toBe('Registrado pelo profissional');
    expect(el.getAttribute('data-origem')).toBe('profissional');
    expect(el.hasAttribute('data-selo')).toBe(false);
    expect(el.className).toContain('text-emerald-800');
    expect(el.className).toContain('dark:text-emerald-300');
    expect(el.className).not.toMatch(/amber|teal/);
  });

  it('data confirmada: o texto próprio, a marca data-selo e o tom azul-esverdeado com par escuro', () => {
    const { el } = selo({ origem: 'profissional', dataConfirmada: true });
    expect(el.textContent).toBe(SELO_CONFIRMADO);
    expect(el.getAttribute('data-selo')).toBe('data-confirmada');
    expect(el.getAttribute('data-origem')).toBe('profissional');
    expect(el.className).toContain('text-teal-800');
    expect(el.className).toContain('dark:text-teal-300');
    expect(el.className).not.toMatch(/amber|emerald/);
  });

  it('os três quebram linha no celular (break-words, max-w-full) e nenhum corta o texto', () => {
    for (const props of [{ origem: 'cliente' as const }, { origem: 'profissional' as const }, { origem: 'profissional' as const, dataConfirmada: true }]) {
      const { el, unmount } = selo(props);
      expect(el.className).toContain('break-words');
      expect(el.className).toContain('max-w-full');
      expect(el.className).not.toMatch(/truncate|line-clamp|whitespace-nowrap|overflow-hidden/);
      unmount();
    }
  });
});
