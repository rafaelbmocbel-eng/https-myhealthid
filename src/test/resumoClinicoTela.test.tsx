import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';
import { envolverBanco, type BancoEnvolvido } from './helpers/bancoFalsoLeitura';
import { FILTRO_SO_PROFISSIONAL } from '@/utils/voiceAssessment/origemAvaliacao';

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
Element.prototype.scrollIntoView = vi.fn();

const h = vi.hoisted(() => ({
  falso: null as unknown as BancoFalso,
  banco: null as unknown as BancoEnvolvido,
  invocar: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (t: string) => h.banco.from(t),
    rpc: (nome: string, args?: Record<string, unknown>) => h.banco.rpc(nome, args),
    functions: { invoke: (...a: unknown[]) => h.invocar(...a) },
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1' } }) }));
vi.mock('@/components/voice/VoiceAssessment', () => ({ default: () => <div>VoiceAssessment simulado</div> }));

import LinhaDoTempoClinica from '@/components/resumoClinico/LinhaDoTempoClinica';
import AvaliacaoSecoesEditaveis from '@/components/voice/AvaliacaoSecoesEditaveis';
import AvaliacaoVozAtual from '@/components/voice/AvaliacaoVozAtual';

// ── Cenário ────────────────────────────────────────────────────────────────────
const TITULO_DA_LINHA = 'Linha do tempo clínica';

const historico = {
  cirurgias: { items: [{ id: 'a', tipo: 'Ligamento do joelho', ano: '2022', complicacoes: '' }, { id: 'b', tipo: 'Apêndice', ano: 'há 2 anos', complicacoes: '' }] },
  medicamentos: { items: [{ id: 'c', nome: 'Losartana', dose: '50mg', frequencia: '1x ao dia' }] },
  alergias: { medicamentos: 'dipirona', alimentos: '', outros: '' },
  ultimo_envio: '2026-10-02T12:00:00+00:00',
};

function cenarioCompleto(): Record<string, Linha[]> {
  return {
    pacientes: [{
      id: 'pac-1', nome: 'Ana', sobrenome: 'Souza', telefone: '9199',
      historico_clinico: historico,
      historia_atual: { queixa: 'Dor lombar do lado direito', inicio: 'Há 3 semanas, depois da mudança', fatores: '', impacto: '', atualizado_em: '2026-10-03T12:00:00+00:00' },
    }],
    myid_avaliacoes: [{
      id: 'm1', paciente_id: 'pac-1', status: 'concluido', created_at: '2026-09-01T12:00:00+00:00', updated_at: '2026-09-02T12:00:00+00:00',
      respostas_brutas: { bloco_1_queixa: 'Dor nas costas ao acordar', bloco_1_duracao: 'gt1y', bloco_1_quando_data: 'faz 5 anos', bloco_1_quando_desc: '' },
    }],
    // O histórico gravado pelo complete-myid no mesmo pedido que concluiu o m1: é daqui que vem a data de "MyID concluído".
    avaliacoes_identidade: [{ id: 'ai1', paciente_id: 'pac-1', terapeuta_id: 'prof-1', myid_avaliacao_id: 'm1', created_at: '2026-09-02T12:00:00+00:00' }],
    avaliacoes_voz: [],
    historia_vida_paciente: [
      { id: 'h1', paciente_id: 'pac-1', data_evento: '2019-03-04', tipo: 'fratura', titulo: 'Fratura de punho', descricao: 'Queda de bicicleta' },
      { id: 'h2', paciente_id: 'pac-1', data_evento: '2018-07-01', tipo: 'cirurgia', titulo: 'Cirurgia de menisco', descricao: '' },
    ],
    diagnosticos_paciente: [
      { id: 'd1', paciente_id: 'pac-1', data_diagnostico: '2024-05-06', cid_codigo: 'M54.5', cid_descricao: 'Dor lombar baixa', created_at: '2026-01-01T12:00:00+00:00', ativo: true, tipo: 'principal' },
      { id: 'd2', paciente_id: 'pac-1', data_diagnostico: '2025-01-01', cid_codigo: 'M99', cid_descricao: 'Diagnóstico removido no app', created_at: '2026-01-01T12:00:00+00:00', ativo: false, tipo: 'principal' },
      { id: 'd3', paciente_id: 'pac-1', data_diagnostico: '2025-02-01', cid_codigo: 'M98', cid_descricao: 'Apenas suspeita', created_at: '2026-01-01T12:00:00+00:00', ativo: true, tipo: 'suspeita' },
    ],
    exames_presenciais: [{ id: 'e1', paciente_id: 'pac-1', tipo: 'bioimpedancia', data_exame: '2026-08-01', resumo: 'Peso 70 kg' }],
    exames_importados: [
      { id: 'i-pend', paciente_id: 'pac-1', tipo: 'exame_pendente', data_exame: '2026-07-10', created_at: '2026-07-10T12:00:00+00:00', status: 'pendente' },
      { id: 'i-erro', paciente_id: 'pac-1', tipo: 'exame_com_erro', data_exame: '2026-07-11', created_at: '2026-07-11T12:00:00+00:00', status: 'erro' },
    ],
    testes_funcionais_paciente: [{ id: 't1', paciente_id: 'pac-1', tipo_teste: 'tug', resultado: 9, unidade: 'segundos', data_teste: '2026-06-01' }],
    escalas_psicologia: [{ id: 's1', paciente_id: 'pac-1', tipo_escala: 'phq9', pontuacao_total: 7, data_aplicacao: '2026-05-01' }],
    notas_prontuario: [],
  };
}

const avaliacao = (extra: Linha = {}): Linha => ({
  id: 'av-1', paciente_id: 'pac-1', terapeuta_id: 'prof-1', created_at: '2026-10-05T12:00:00+00:00', queixa_principal: 'Dor lombar', servico: 'identidade',
  classificacao_severidade: 'Moderada', transcricao: '', resultado: resultadoDaAvaliacao(), ...extra,
});

function resultadoDaAvaliacao(extra: Linha = {}): Linha {
  return {
    resumo_clinico: 'Paciente com dor lombar crônica há 6 meses, piora ao sentar.',
    classificacao_severidade: 'Moderada',
    queixa_principal: 'Dor lombar crônica',
    tempo_evolucao: '6 meses',
    soap: { subjetivo: 'Dor ao sentar.', objetivo: 'Lasègue positivo à direita.', avaliacao: 'Sobrecarga lombar.', plano: 'Exercícios' },
    dor: { localizacao: 'Lombar', intensidade_eva: 7, tipo: 'Mista' },
    _meta: { mode: 'voice', savedAt: 's1' },
    _secoes: { confirmadas: ['resumo_clinico', 'dor'], editadas: {} },
    ...extra,
  };
}

function preparar(tabelas: Record<string, Linha[]>) {
  h.falso = criarBancoFalso(tabelas);
  h.banco = envolverBanco(h.falso);
}

function cliente() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
}

const regiao = () => screen.findByRole('region', { name: TITULO_DA_LINHA });

function montarLinha() {
  return render(<QueryClientProvider client={cliente()}><LinhaDoTempoClinica pacienteId="pac-1" /></QueryClientProvider>);
}

function montarSecoes(resultado: Linha = resultadoDaAvaliacao()) {
  return render(
    <QueryClientProvider client={cliente()}>
      <MemoryRouter>
        <AvaliacaoSecoesEditaveis pacienteId="pac-1" avaliacaoId="av-1" resultado={resultado} transcricao="" onReprocessar={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function montarAvaliacaoAtual() {
  return render(
    <QueryClientProvider client={cliente()}>
      <MemoryRouter><AvaliacaoVozAtual pacienteId="pac-1" patientName="Ana Souza" /></MemoryRouter>
    </QueryClientProvider>,
  );
}

// O cartão "Como começou" também tem um título de nível 4: os anos são só os títulos dentro da lista de marcos.
const anosDosMarcos = (raiz: HTMLElement) => within(raiz.querySelector('#linha-do-tempo-marcos') as HTMLElement).getAllByRole('heading', { level: 4 }).map((x) => x.textContent);

const titulosDosMarcos = (raiz: HTMLElement) => Array.from(raiz.querySelectorAll('li[data-natureza] p:first-of-type')).map((p) => p.textContent?.replace(/^(Registro no app|Fato clínico): /, ''));

beforeEach(() => { h.invocar.mockReset(); preparar(cenarioCompleto()); });
afterEach(() => { Reflect.deleteProperty(navigator, 'clipboard'); });

// ── Linha do tempo clínica ─────────────────────────────────────────────────────
describe('Linha do tempo clínica', () => {
  it('mostra os 6 mais recentes, do mais novo ao mais antigo, e "Ver todos" abre o resto agrupado por ano', async () => {
    montarLinha();
    const r = await regiao();
    await waitFor(() => expect(within(r).getByText('MyID concluído')).toBeInTheDocument());
    expect(titulosDosMarcos(r)).toEqual(['Último envio do histórico clínico (pelo cliente)', 'MyID concluído', 'Bioimpedância', 'Tug', 'PHQ-9 (Depressão)', '[M54.5] Dor lombar baixa']);
    expect(anosDosMarcos(r)).toEqual(['2026', '2024']);

    fireEvent.click(within(r).getByRole('button', { name: 'Ver todos (9)' }));
    expect(anosDosMarcos(r)).toEqual(['2026', '2024', '2022', '2019', '2018']);
    // A cirurgia do cliente ganha o rótulo, porque o texto dele ("Ligamento do joelho") sozinho não diz do que se trata.
    expect(titulosDosMarcos(r).slice(6)).toEqual(['Cirurgia ou internação: Ligamento do joelho', 'Fratura de punho', 'Cirurgia de menisco']);

    fireEvent.click(within(r).getByRole('button', { name: 'Ver menos' }));
    expect(titulosDosMarcos(r)).toHaveLength(6);
  });

  it('"Ver todos" só aparece quando há mais de 6 marcos: com exatamente 6 não aparece, com 7 aparece e conta todos', async () => {
    const vida = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `v${i}`, paciente_id: 'pac-1', data_evento: `2020-01-${String(i + 1).padStart(2, '0')}`, tipo: 'outro', titulo: `Fato ${i + 1}` }));
    preparar({ historia_vida_paciente: vida(6) });
    const { unmount } = montarLinha();
    let r = await regiao();
    await waitFor(() => expect(within(r).getByText('Fato 6')).toBeInTheDocument());
    expect(within(r).queryByRole('button', { name: /Ver todos/ })).toBeNull();
    expect(titulosDosMarcos(r)).toHaveLength(6);
    unmount();

    preparar({ historia_vida_paciente: vida(7) });
    montarLinha();
    r = await regiao();
    await waitFor(() => expect(within(r).getByText('Fato 7')).toBeInTheDocument());
    expect(titulosDosMarcos(r)).toEqual(['Fato 7', 'Fato 6', 'Fato 5', 'Fato 4', 'Fato 3', 'Fato 2']);
    expect(within(r).getByRole('button', { name: 'Ver todos (7)' })).toBeInTheDocument();
  });

  it('marcador cheio para fato e vazado para registro, com o rótulo "registro no app" só nos registros', async () => {
    montarLinha();
    const r = await regiao();
    fireEvent.click(await within(r).findByRole('button', { name: /Ver todos/ }));
    const itens = Array.from(r.querySelectorAll('li[data-natureza]')) as HTMLElement[];
    const por = (titulo: string) => itens.find((li) => li.textContent?.includes(titulo))!;

    const fato = por('Fratura de punho');
    expect(fato.dataset.natureza).toBe('fato');
    expect(fato.querySelector('span[aria-hidden="true"]')?.className).toContain('bg-primary');
    expect(fato.textContent).not.toContain('registro no app');
    expect(fato.textContent).toContain('Fato clínico: '); // para quem usa leitor de tela, o marcador não é só desenho

    const registro = por('MyID concluído');
    expect(registro.dataset.natureza).toBe('registro');
    expect(registro.querySelector('span[aria-hidden="true"]')?.className).toContain('bg-background');
    expect(registro.textContent).toContain('registro no app');
    expect(registro.textContent).toContain('Registro no app: ');
    expect(itens.filter((li) => li.dataset.natureza === 'registro').every((li) => li.textContent?.includes('registro no app'))).toBe(true);
  });

  it('cada marco mostra título, data (só o ano quando a precisão é ano), tipo e o selo da origem', async () => {
    montarLinha();
    const r = await regiao();
    fireEvent.click(await within(r).findByRole('button', { name: /Ver todos/ }));
    const itens = Array.from(r.querySelectorAll('li[data-natureza]')) as HTMLElement[];
    const por = (titulo: string) => itens.find((li) => li.textContent?.includes(titulo))!;

    const cirurgiaDoCliente = por('Ligamento do joelho');
    expect(cirurgiaDoCliente.dataset.precisao).toBe('ano');
    // O título já abre com "Cirurgia ou internação": a linha da data não repete o rótulo.
    expect(cirurgiaDoCliente.querySelector('p')?.textContent).toContain('Cirurgia ou internação: Ligamento do joelho');
    expect(cirurgiaDoCliente.querySelectorAll('p')[1].textContent).toBe('2022');
    expect(cirurgiaDoCliente.textContent).not.toMatch(/\d{2}\/\d{2}\/2022/);
    expect(cirurgiaDoCliente.querySelector('[data-origem="cliente"]')?.textContent).toBe('Relatado pelo cliente, não revisado');

    const fratura = por('Fratura de punho');
    expect(fratura.dataset.precisao).toBe('dia');
    // "Fratura de punho" já abre com o tipo ("Fratura"): a linha da data não repete.
    expect(fratura.querySelectorAll('p')[1].textContent).toBe('04/03/2019');
    expect(fratura.textContent).toContain('Queda de bicicleta');
    expect(fratura.querySelector('[data-origem="profissional"]')?.textContent).toBe('Registrado pelo profissional');

    expect(por('MyID concluído').querySelector('[data-origem="cliente"]')).not.toBeNull();
    expect(por('Bioimpedância').querySelector('[data-origem="profissional"]')).not.toBeNull();
    // O título "Bioimpedância" não abre com o tipo: a linha da data o mostra.
    expect(por('Bioimpedância').querySelectorAll('p')[1].textContent).toBe('01/08/2026 · Exame presencial · registro no app');
  });

  it('a faixa "Sem data" vem recolhida; ao abrir mostra o texto exatamente como o cliente escreveu, cada item com o próprio selo', async () => {
    montarLinha();
    const r = await regiao();
    const faixa = await within(r).findByRole('button', { name: /^Sem data/ });
    expect(faixa.textContent).not.toContain('relatado pelo cliente');
    expect(faixa).toHaveAttribute('aria-expanded', 'false');
    const lista = r.querySelector('#linha-do-tempo-sem-data') as HTMLElement;
    expect(lista).toHaveAttribute('hidden');
    expect(lista).not.toBeVisible();

    fireEvent.click(faixa);
    expect(faixa).toHaveAttribute('aria-expanded', 'true');
    expect(lista).toBeVisible();
    expect(lista.textContent).toContain('Apêndice');
    expect(lista.textContent).toContain('Ano que o cliente escreveu: "há 2 anos"');
    // As respostas sobre o começo do quadro saíram de "Sem data" (dado em `comoComecou`; o cartão é da tela nova).
    expect(lista.textContent).not.toContain('Há 3 semanas, depois da mudança');
    expect(lista.textContent).not.toContain('Mais de 1 ano');
    expect(lista.textContent).not.toContain('faz 5 anos');
    expect(lista.querySelectorAll('[data-origem="cliente"]')).toHaveLength(lista.querySelectorAll('li').length);
    expect(r.querySelector('#linha-do-tempo-sem-data')?.closest('section')).toBe(r);
    // O texto digitado nunca virou marco com data.
    expect(titulosDosMarcos(r).join('|')).not.toContain('Apêndice');
  });

  it('diagnóstico e exame importado do profissional sem data vão para "Sem data" com o selo do profissional e "Registrado no app em"; nunca viram marco', async () => {
    h.falso.tabelas.diagnosticos_paciente.push({ id: 'd-sd', paciente_id: 'pac-1', data_diagnostico: null, cid_codigo: 'M17', cid_descricao: 'Gonartrose', created_at: '2026-02-04T01:30:00+00:00', ativo: true, tipo: 'secundario' });
    h.falso.tabelas.exames_importados.push({ id: 'i-ok', paciente_id: 'pac-1', tipo: 'hemograma', data_exame: null, created_at: '2026-07-02T12:00:00+00:00', status: 'processado' });
    montarLinha();
    const r = await regiao();
    fireEvent.click(await within(r).findByRole('button', { name: /^Sem data/ }));
    const lista = r.querySelector('#linha-do-tempo-sem-data') as HTMLElement;
    const item = (texto: string) => Array.from(lista.querySelectorAll('li')).find((li) => li.textContent?.includes(texto)) as HTMLElement;

    const diagnostico = item('[M17] Gonartrose');
    expect(diagnostico.textContent).toContain('Diagnóstico · A data do diagnóstico não foi informada · Registrado no app em 03/02/2026');
    expect(diagnostico.querySelector('[data-origem="profissional"]')?.textContent).toBe('Registrado pelo profissional');
    const exame = item('Hemograma');
    expect(exame.textContent).toContain('Exame importado · A data do exame não foi informada · Registrado no app em 02/07/2026');
    expect(exame.querySelector('[data-origem="profissional"]')?.textContent).toBe('Registrado pelo profissional');
    // O cliente continua com o selo dele na mesma faixa.
    expect(item('Apêndice').querySelector('[data-origem="cliente"]')?.textContent).toBe('Relatado pelo cliente, não revisado');
    // Nenhum virou marco datado: o dia em que foi gravado não é a data do fato.
    fireEvent.click(within(r).getByRole('button', { name: /Ver todos/ }));
    expect(titulosDosMarcos(r).join('|')).not.toMatch(/Gonartrose|Hemograma/);
    expect(r.textContent).not.toContain('Fato clínico: [M17]');
  });

  it('diagnóstico com a data do dia do cadastro (DEFAULT do banco) vai para "Sem data" com "Registrado no app em"; o de data antiga continua marco', async () => {
    h.falso.tabelas.diagnosticos_paciente.push({ id: 'd-hoje', paciente_id: 'pac-1', data_diagnostico: '2026-02-03', cid_codigo: 'M17', cid_descricao: 'Gonartrose', created_at: '2026-02-03T15:00:00+00:00', ativo: true, tipo: 'principal' });
    montarLinha();
    const r = await regiao();
    fireEvent.click(await within(r).findByRole('button', { name: /^Sem data/ }));
    const lista = r.querySelector('#linha-do-tempo-sem-data') as HTMLElement;
    const item = Array.from(lista.querySelectorAll('li')).find((li) => li.textContent?.includes('[M17] Gonartrose')) as HTMLElement;
    expect(item.textContent).toContain('A data do diagnóstico é a do dia do cadastro no app e pode ter sido preenchida pelo sistema · Registrado no app em 03/02/2026');
    expect(item.querySelector('[data-origem="profissional"]')?.textContent).toBe('Registrado pelo profissional');
    fireEvent.click(within(r).getByRole('button', { name: /Ver todos/ }));
    expect(titulosDosMarcos(r).join('|')).not.toContain('Gonartrose');
    expect(titulosDosMarcos(r)).toContain('[M54.5] Dor lombar baixa'); // data de 2024, bem diferente do cadastro: continua marco
  });

  it('exame importado com data mostra o aviso de que a data foi lida automaticamente do documento', async () => {
    h.falso.tabelas.exames_importados.push({ id: 'i-ok', paciente_id: 'pac-1', tipo: 'hemograma', data_exame: '2026-07-01', created_at: '2026-07-02T12:00:00+00:00', status: 'processado' });
    montarLinha();
    const r = await regiao();
    fireEvent.click(await within(r).findByRole('button', { name: /Ver todos/ }));
    const exame = (Array.from(r.querySelectorAll('li[data-natureza]')) as HTMLElement[]).find((li) => li.textContent?.includes('Hemograma')) as HTMLElement;
    expect(exame.textContent).toContain('01/07/2026');
    expect(exame.textContent).toContain('Data lida automaticamente do documento; confira no arquivo.');
    expect(r.textContent?.match(/Data lida automaticamente do documento/g)).toHaveLength(1); // só o importado; o presencial é digitado
  });

  it('MyID sem o histórico ligado: "MyID (último registro)" com o aviso; nunca "MyID concluído"', async () => {
    h.falso.tabelas.avaliacoes_identidade.length = 0;
    montarLinha();
    const r = await regiao();
    await waitFor(() => expect(within(r).getByText('MyID (último registro)')).toBeInTheDocument());
    const item = (Array.from(r.querySelectorAll('li[data-natureza]')) as HTMLElement[]).find((li) => li.textContent?.includes('MyID (último registro)')) as HTMLElement;
    expect(item.textContent).toContain('02/09/2026');
    expect(item.textContent).toContain('Data do último registro; pode ser posterior à conclusão.');
    expect(item.querySelector('[data-origem="cliente"]')?.textContent).toBe('Relatado pelo cliente, não revisado');
    expect(r.textContent).not.toContain('MyID concluído');
  });

  it('se a leitura das datas de conclusão falhar, avisa e o MyID aparece como "último registro" (as outras fontes seguem)', async () => {
    h.banco.falharLeitura('avaliacoes_identidade', 'rejeitar');
    montarLinha();
    const r = await regiao();
    const aviso = await within(r).findByRole('status');
    expect(aviso.textContent).toBe('Não consegui ler as datas de conclusão do MyID. O que aparece aqui pode estar incompleto.');
    await waitFor(() => expect(within(r).getByText('MyID (último registro)')).toBeInTheDocument());
    expect(within(r).getByText('Bioimpedância')).toBeInTheDocument();
    expect(r.textContent).not.toContain('MyID concluído');
  });

  it('diagnóstico removido, suspeita e exame importado pendente ou com erro não aparecem em lugar nenhum da linha do tempo', async () => {
    montarLinha();
    const r = await regiao();
    await waitFor(() => expect(within(r).getByText('Bioimpedância')).toBeInTheDocument());
    fireEvent.click(within(r).getByRole('button', { name: /Ver todos/ }));
    fireEvent.click(within(r).getByRole('button', { name: /^Sem data/ }));
    for (const fora of ['Diagnóstico removido no app', 'Apenas suspeita', 'Exame pendente', 'Exame com erro']) expect(r.textContent, fora).not.toContain(fora);
    expect(r.textContent).toContain('[M54.5] Dor lombar baixa');
  });

  it('o relato que o paciente fez no portal não vira "Avaliação presencial registrada" mesmo que o banco ignore o filtro .or', async () => {
    h.falso.tabelas.avaliacoes_voz.push(
      avaliacao({ id: 'av-portal', queixa_principal: 'Relato do portal', resultado: { _meta: { origem: 'portal_paciente_historia' } } }),
      avaliacao({ id: 'av-auto', queixa_principal: 'Autocadastro', resultado: { _meta: { origem: 'autocadastro_paciente' } } }),
      avaliacao({ id: 'av-prof', queixa_principal: 'Avaliação do profissional' }),
    );
    montarLinha();
    const r = await regiao();
    await within(r).findByText('Avaliação presencial registrada');
    // O banco falso envolvido não aplica o .or(), então as três linhas chegaram; só a do profissional virou marco.
    expect(h.banco.chamadas).toContainEqual({ tabela: 'avaliacoes_voz', metodo: 'or', args: [FILTRO_SO_PROFISSIONAL] });
    expect(within(r).getAllByText('Avaliação presencial registrada')).toHaveLength(1);
    expect(r.textContent).toContain('Queixa principal: Avaliação do profissional');
    expect(r.textContent).not.toContain('Relato do portal');
    expect(r.textContent).not.toContain('Autocadastro');
  });

  it('a faixa "Sem data" fica depois dos marcos datados', async () => {
    montarLinha();
    const r = await regiao();
    await within(r).findByRole('button', { name: /Sem data/ });
    const faixa = within(r).getByRole('button', { name: /Sem data/ });
    const ultimoMarco = r.querySelectorAll('li[data-natureza]')[5];
    expect(ultimoMarco.compareDocumentPosition(faixa) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('estado vazio explica de onde os marcos vêm', async () => {
    preparar({});
    montarLinha();
    const r = await regiao();
    await within(r).findByText(/Ainda não há marcos para mostrar/);
    expect(r.textContent).toMatch(/MyID, o histórico clínico e a história atual/);
    expect(r.textContent).toMatch(/avaliação presencial, um diagnóstico, um exame, um teste ou um fato da história de vida/);
    expect(within(r).queryByRole('button')).toBeNull();
  });

  it('uma fonte que falha só vira aviso discreto; as outras continuam na linha do tempo', async () => {
    h.banco.falharLeitura('myid_avaliacoes', 'rejeitar');
    montarLinha();
    const r = await regiao();
    const aviso = await within(r).findByRole('status');
    expect(aviso.textContent).toBe('Não consegui ler o MyID. O que aparece aqui pode estar incompleto.');
    expect(within(r).getByText('Bioimpedância')).toBeInTheDocument();
    expect(r.textContent).not.toContain('MyID concluído');
    expect(r.textContent).not.toContain('Ainda não há marcos');
  });

  it('com todas as fontes falhando, não mostra o estado vazio como se não houvesse histórico', async () => {
    for (const t of ['pacientes', 'myid_avaliacoes', 'avaliacoes_identidade', 'avaliacoes_voz', 'historia_vida_paciente', 'diagnosticos_paciente', 'exames_presenciais', 'exames_importados', 'testes_funcionais_paciente', 'escalas_psicologia']) h.banco.falharLeitura(t);
    montarLinha();
    const r = await regiao();
    const aviso = await within(r).findByRole('status');
    expect(aviso.textContent).toContain('Não consegui ler o histórico clínico e a história atual do cliente');
    expect(aviso.textContent).toContain(' e as escalas.');
    expect(r.textContent).not.toContain('Ainda não há marcos');
  });

  it('registro do profissional com data inválida fica de fora e a tela avisa quantos', async () => {
    h.falso.tabelas.historia_vida_paciente.push({ id: 'h3', paciente_id: 'pac-1', data_evento: '0001-01-01', tipo: 'outro', titulo: 'Data absurda' });
    montarLinha();
    const r = await regiao();
    await within(r).findByText('1 registro ficou de fora: data ausente, inválida ou no futuro.');
    fireEvent.click(within(r).getByRole('button', { name: /Ver todos/ }));
    // Não virou marco. Só aparece na lista dos que ficaram de fora, que vem recolhida.
    expect(titulosDosMarcos(r).join('|')).not.toContain('Data absurda');
    expect(within(r).getByText('Data absurda')).not.toBeVisible();
  });

  it('nenhum marco ganha a data de hoje: sem MyID/diagnóstico datados, nada aparece com o dia de hoje', async () => {
    preparar({
      pacientes: [{ id: 'pac-1', historico_clinico: { cirurgias: { items: [{ tipo: 'Joelho', ano: 'faz tempo' }] } }, historia_atual: { inicio: 'ontem' } }],
      diagnosticos_paciente: [{ id: 'd', paciente_id: 'pac-1', data_diagnostico: null, created_at: null, cid_descricao: 'Sem data nenhuma' }],
    });
    montarLinha();
    const r = await regiao();
    await within(r).findByRole('button', { name: /Sem data/ });
    expect(r.querySelectorAll('li[data-natureza]')).toHaveLength(0);
    const hoje = new Date().toLocaleDateString('pt-BR');
    expect(r.textContent).not.toContain(hoje);
    expect(r.textContent).not.toContain('Sem data nenhuma');
  });

  it('não escreve nada no banco; lê os achados do avatar só para CONTAR (sem coluna de data) e nunca o prontuário', async () => {
    const hojeIso = new Date().toISOString().slice(0, 10);
    h.falso.tabelas.eventos_clinicos_anatomicos = [{ id: 'ev', paciente_id: 'pac-1', terapeuta_id: 'prof-1', tipo_diagnostico: 'historico_relatado', origem: 'relato_paciente', data_inicio: hojeIso, tipo_achado: 'Dor no joelho do relato', metadata: {} }];
    montarLinha();
    const r = await regiao();
    await waitFor(() => expect(within(r).getByText('Bioimpedância')).toBeInTheDocument());
    await waitFor(() => expect(r.querySelector('[data-aviso="achados-do-historico"]')).not.toBeNull());
    expect(h.falso.escritas()).toEqual([]);
    const lidasDosAchados = h.banco.chamadas.filter((c) => c.tabela === 'eventos_clinicos_anatomicos' && c.metodo === 'select');
    expect(lidasDosAchados).toHaveLength(1);
    expect(String(lidasDosAchados[0].args[0])).not.toMatch(/data_|created_at|updated_at|\*/);
    expect(h.falso.operacoes.map((o) => o.tabela)).not.toContain('notas_prontuario');
    expect(r.textContent).not.toContain('Dor no joelho do relato');
    expect(r.textContent).not.toContain(new Date().toLocaleDateString('pt-BR'));
  });

  it('acessível e sem rolagem lateral: região com nome, alvos de toque de 44 px, foco visível e textos que quebram linha', async () => {
    montarLinha();
    const r = await regiao();
    const botoes = await within(r).findAllByRole('button');
    expect(botoes.length).toBeGreaterThanOrEqual(2);
    for (const b of botoes) {
      expect(b.className, b.textContent ?? '').toContain('min-h-11');
      expect(b.className, b.textContent ?? '').not.toContain('min-h-10');
      expect(b.className, b.textContent ?? '').toContain('focus-visible:ring-2');
    }
    expect(r.querySelector('h3')?.id).toBe('titulo-linha-do-tempo-clinica');
    expect(r.className).not.toMatch(/overflow-x-(auto|scroll)/);
    expect(r.querySelector('.overflow-x-auto, .overflow-x-scroll, .whitespace-nowrap')).toBeNull();
    expect(Array.from(r.querySelectorAll('li[data-natureza] p')).every((p) => !p.className.includes('truncate'))).toBe(true);
  });
});

// ── Cartão Resumo Clínico (aba Clínico) ────────────────────────────────────────
describe('Resumo Clínico: seletor Resumo | Completo', () => {
  const esperarFontes = async () => { await regiao(); await waitFor(() => expect(h.banco.chamadas.some((c) => c.tabela === 'escalas_psicologia')).toBe(true)); };

  it('o Resumo continua igual: texto, severidade, selos Prontuário e Sincronizado e lápis', async () => {
    montarSecoes();
    await screen.findByText('Resumo Clínico');
    expect(screen.getByText('Paciente com dor lombar crônica há 6 meses, piora ao sentar.')).toBeInTheDocument();
    expect(screen.getByText('Moderada')).toBeInTheDocument();
    expect(screen.getByText('Prontuário')).toBeInTheDocument();
    expect(screen.getByText('Sincronizado')).toBeInTheDocument();
    expect(screen.getByTitle('Editar texto')).toBeInTheDocument();
    expect(h.falso.escritas()).toEqual([]);
  });

  it('o seletor "Resumo | Completo" começa em Resumo, com alvos de toque de 44 px', async () => {
    montarSecoes();
    await screen.findByText('Resumo Clínico');
    const seletor = screen.getByRole('group', { name: 'Forma de ver o resumo clínico' });
    expect(within(seletor).getByRole('button', { name: 'Resumo' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(seletor).getByRole('button', { name: 'Completo' })).toHaveAttribute('aria-pressed', 'false');
    for (const b of within(seletor).getAllByRole('button')) {
      expect(b.className).toContain('min-h-11');
      expect(b.className).not.toContain('min-h-10');
      expect(b.className).toContain('focus-visible:ring-2');
    }
    expect(screen.queryByRole('button', { name: 'Copiar' })).toBeNull();
  });

  it('o lápis ainda abre o editor com o texto do resumo; cancelar volta ao cartão sem gravar nada', async () => {
    montarSecoes();
    await screen.findByText('Resumo Clínico');
    fireEvent.click(screen.getByTitle('Editar texto'));
    const caixa = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(caixa.value).toBe('Paciente com dor lombar crônica há 6 meses, piora ao sentar.');
    expect(screen.getByRole('button', { name: /Salvar/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }));
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Paciente com dor lombar crônica há 6 meses, piora ao sentar.')).toBeInTheDocument();
    expect(h.falso.escritas()).toEqual([]);
  });

  it('limite conhecido: com o Completo aberto, o lápis abre o editor do Resumo; o seletor some e, ao fechar, volta em "Resumo"', async () => {
    montarSecoes();
    await esperarFontes();
    fireEvent.click(screen.getByRole('button', { name: 'Completo' }));
    await screen.findByText('Queixa que o cliente escreveu: Dor nas costas ao acordar');
    fireEvent.click(screen.getByTitle('Editar texto'));
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Paciente com dor lombar crônica há 6 meses, piora ao sentar.');
    expect(screen.queryByRole('button', { name: 'Completo' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }));
    expect(screen.getByRole('button', { name: 'Resumo' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Completo' })).toHaveAttribute('aria-pressed', 'false');
    expect(h.falso.escritas()).toEqual([]);
  });

  it('salvar a edição do Resumo continua gravando a avaliação e atualizando a nota do prontuário, como antes', async () => {
    montarSecoes();
    await screen.findByText('Resumo Clínico');
    fireEvent.click(screen.getByTitle('Editar texto'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Resumo reescrito pelo profissional.' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));
    await waitFor(() => expect(h.falso.escritas().length).toBeGreaterThanOrEqual(2));
    const escritas = h.falso.escritas();
    const gravouAvaliacao = escritas.find((o) => o.tabela === 'avaliacoes_voz' && o.tipo === 'update');
    expect((gravouAvaliacao?.payload as { resultado: { _secoes: { editadas: Record<string, string> } } }).resultado._secoes.editadas.resumo_clinico).toBe('Resumo reescrito pelo profissional.');
    expect(escritas.some((o) => o.tabela === 'notas_prontuario' && (o.tipo === 'insert' || o.tipo === 'update'))).toBe(true);
  });

  it('primeira abertura (nada confirmado ainda): a pré-confirmação automática continua enviando ao prontuário, e os selos aparecem', async () => {
    montarSecoes(resultadoDaAvaliacao({ _secoes: undefined }));
    await waitFor(() => expect(h.falso.escritas().some((o) => o.tabela === 'notas_prontuario' && o.tipo === 'insert')).toBe(true));
    expect(h.falso.escritas().some((o) => o.tabela === 'avaliacoes_voz' && o.tipo === 'update')).toBe(true);
    expect(screen.getByText('Prontuário')).toBeInTheDocument();
    expect(screen.getByText('Sincronizado')).toBeInTheDocument();
  });

  it('o Completo é só leitura e calculado na hora: abrir, alternar e copiar NÃO escrevem nada nem mexem na nota do prontuário', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
    montarSecoes();
    await esperarFontes();
    const antes = h.falso.operacoes.length;

    fireEvent.click(screen.getByRole('button', { name: 'Completo' }));
    await screen.findByText('Queixa que o cliente escreveu: Dor nas costas ao acordar');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    await screen.findByText('Copiado.');
    fireEvent.click(screen.getByRole('button', { name: 'Resumo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Completo' }));

    expect(h.falso.escritas()).toEqual([]);
    const depois = h.falso.operacoes.slice(antes);
    expect(depois.every((o) => o.tipo === 'select')).toBe(true);
    expect(depois.filter((o) => o.tabela === 'notas_prontuario' || o.tabela === 'avaliacoes_voz')).toEqual([]);
    // Os selos do cartão não mudaram.
    expect(screen.getByText('Prontuário')).toBeInTheDocument();
    expect(screen.getByText('Sincronizado')).toBeInTheDocument();
  });

  it('o Completo mostra as seções com conteúdo, o aviso fixo, e cada trecho do cliente com o selo "Relatado pelo cliente, não revisado"', async () => {
    montarSecoes();
    await esperarFontes();
    fireEvent.click(screen.getByRole('button', { name: 'Completo' }));
    await screen.findByText('Queixa que o cliente escreveu: Dor nas costas ao acordar');

    expect(screen.getByText('Montado pelo app a partir das respostas; não vai para o prontuário.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Completo' })).toHaveAttribute('aria-pressed', 'true');
    // O texto do Resumo some (volta no seletor Resumo) e não há editor no Completo.
    expect(screen.queryByText('Paciente com dor lombar crônica há 6 meses, piora ao sentar.')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();

    const secoes = Array.from(document.querySelectorAll('section[data-origem]')) as HTMLElement[];
    const doProfissional = secoes.filter((s) => s.dataset.origem === 'profissional');
    const doCliente = secoes.filter((s) => s.dataset.origem === 'cliente');
    expect(doProfissional.map((s) => s.getAttribute('aria-label'))).toEqual(['Queixa e história', 'Dor', 'Exame e avaliação do profissional']);
    expect(doCliente.map((s) => s.getAttribute('aria-label'))).toEqual(['MyID', 'Histórico clínico', 'História atual']);
    for (const s of doCliente) expect(within(s).getByText('Relatado pelo cliente, não revisado')).toBeInTheDocument();
    for (const s of doProfissional) expect(within(s).queryByText('Relatado pelo cliente, não revisado')).toBeNull();

    const historicoTexto = doCliente[1].textContent ?? '';
    expect(historicoTexto).toContain('Cirurgia ou internação: Apêndice (há 2 anos)');
    expect(historicoTexto).toContain('Medicamento: Losartana, 50mg, 1x ao dia');
    expect(historicoTexto).toContain('Alergias a medicamentos: dipirona');
    expect(doCliente[0].textContent).toContain('Quando começou (faixa escolhida): Mais de 1 ano');
    expect(doCliente[2].textContent).toContain('Há quanto tempo começou: Há 3 semanas, depois da mudança');
    expect(document.body.textContent).not.toContain('Exercícios'); // o plano não entra
  });

  it('"Copiar" leva para a área de transferência o texto do Completo, com o aviso e o selo nos trechos do cliente', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    montarSecoes();
    await esperarFontes();
    fireEvent.click(screen.getByRole('button', { name: 'Completo' }));
    await screen.findByText('Queixa que o cliente escreveu: Dor nas costas ao acordar');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    await screen.findByText('Copiado.');
    expect(writeText).toHaveBeenCalledTimes(1);
    const copiado = writeText.mock.calls[0][0] as string;
    expect(copiado).toContain('Queixa e história\nQueixa principal: Dor lombar crônica');
    expect(copiado).toContain('MyID (relatado pelo cliente, não revisado)\nQueixa que o cliente escreveu: Dor nas costas ao acordar');
    expect(copiado.endsWith('Montado pelo app a partir das respostas; não vai para o prontuário.')).toBe(true);
  });

  it.each([
    ['o navegador nega a cópia', () => Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('negado')) }, configurable: true })],
    ['a página não tem área de transferência (sem https)', () => Reflect.deleteProperty(navigator, 'clipboard')],
  ])('"Copiar" que falha porque %s mostra aviso em vez de quebrar', async (_motivo, preparaClipboard) => {
    preparaClipboard();
    montarSecoes();
    await esperarFontes();
    fireEvent.click(screen.getByRole('button', { name: 'Completo' }));
    await screen.findByText('Queixa que o cliente escreveu: Dor nas costas ao acordar');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    await screen.findByText('Não consegui copiar. Selecione o texto e copie à mão.');
    expect(screen.queryByText('Copiado.')).toBeNull();
  });

  it('sem nada para mostrar, o Completo diz isso e o botão Copiar fica desligado', async () => {
    preparar({});
    montarSecoes(resultadoDaAvaliacao({ queixa_principal: undefined, tempo_evolucao: undefined, soap: undefined, dor: undefined }));
    await screen.findByText('Resumo Clínico');
    fireEvent.click(screen.getByRole('button', { name: 'Completo' }));
    await screen.findByText('Ainda não há conteúdo para montar o resumo completo.');
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeDisabled();
  });

  it('se uma fonte falhar, o Completo avisa "Não consegui ler ..." e mostra o resto', async () => {
    h.banco.falharLeitura('myid_avaliacoes');
    montarSecoes();
    await regiao();
    fireEvent.click(screen.getByRole('button', { name: 'Completo' }));
    const avisos = await screen.findAllByText('Não consegui ler o MyID. O que aparece aqui pode estar incompleto.');
    expect(avisos.length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByText('Há quanto tempo começou: Há 3 semanas, depois da mudança')).toBeInTheDocument();
    expect(screen.queryByText(/Queixa que o cliente escreveu/)).toBeNull();
  });

  it('a linha do tempo aparece na aba Clínico, junto do cartão, e some ao trocar de aba', async () => {
    montarSecoes();
    const r = await regiao();
    expect(screen.getByText('Resumo Clínico').compareDocumentPosition(r) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Quadro\/Dx/ }), { button: 0, ctrlKey: false });
    await waitFor(() => expect(screen.queryByRole('region', { name: TITULO_DA_LINHA })).toBeNull());
  });
});

// ── Perfil do paciente: sem avaliação por voz ──────────────────────────────────
describe('Avaliação atual (AvaliacaoVozAtual) com e sem avaliação por voz', () => {
  it('sem nenhuma avaliação por voz, a linha do tempo aparece mesmo assim com o histórico que existe', async () => {
    montarAvaliacaoAtual();
    const r = await regiao();
    await waitFor(() => expect(within(r).getByText('Bioimpedância')).toBeInTheDocument());
    expect(screen.queryByText(/Última avaliação/)).toBeNull();
    expect(screen.getAllByRole('region', { name: TITULO_DA_LINHA })).toHaveLength(1);
    expect(h.falso.escritas()).toEqual([]);
  });

  it('sem avaliação e sem nenhum dado, aparece o estado vazio explicando de onde vêm os marcos', async () => {
    preparar({});
    montarAvaliacaoAtual();
    const r = await regiao();
    await within(r).findByText(/Ainda não há marcos para mostrar/);
  });

  it('com avaliação, o cartão e a linha do tempo aparecem juntos, uma vez só', async () => {
    h.falso.tabelas.avaliacoes_voz.push(avaliacao());
    montarAvaliacaoAtual();
    await screen.findByText(/Última avaliação/);
    await screen.findByText('Resumo Clínico');
    expect(await screen.findAllByRole('region', { name: TITULO_DA_LINHA })).toHaveLength(1);
    expect(screen.getByRole('group', { name: 'Forma de ver o resumo clínico' })).toBeInTheDocument();
  });

  it('com a avaliação do profissional na linha do tempo como registro (vazado)', async () => {
    h.falso.tabelas.avaliacoes_voz.push(avaliacao());
    montarAvaliacaoAtual();
    const r = await regiao();
    const item = (await within(r).findByText('Avaliação presencial registrada')).closest('li') as HTMLElement;
    expect(item.dataset.natureza).toBe('registro');
    expect(item.textContent).toContain('Queixa principal: Dor lombar');
    expect(item.querySelector('[data-origem="profissional"]')).not.toBeNull();
  });

  it('avaliação sem resultado (ainda em andamento): a tela de gravação continua e a linha do tempo aparece abaixo, uma vez só', async () => {
    h.falso.tabelas.avaliacoes_voz.push(avaliacao({ resultado: null }));
    montarAvaliacaoAtual();
    await screen.findByText('VoiceAssessment simulado');
    expect(await screen.findAllByRole('region', { name: TITULO_DA_LINHA })).toHaveLength(1);
  });
});

// ── Texto do cliente inteiro, sem corte e sem estourar a tela ──────────────────
describe('Linha do tempo clínica: texto longo aparece inteiro e quebra linha', () => {
  const seisLinhas = ['Linha 1 do relato', 'Linha 2 do relato', 'Linha 3 do relato', 'Linha 4 do relato', 'Linha 5 do relato', 'Linha 6 do relato'];
  const SEM_CORTE = /line-clamp|truncate|overflow-hidden|text-ellipsis|max-h-/;

  it('detalhe de marco com 6 linhas aparece inteiro, sem corte e sem rolagem escondida', async () => {
    preparar({ historia_vida_paciente: [{ id: 'h1', paciente_id: 'pac-1', data_evento: '2020-01-01', tipo: 'outro', titulo: 'Fato com texto longo', descricao: seisLinhas.join('\n') }] });
    montarLinha();
    const r = await regiao();
    const item = (await within(r).findByText('Fato com texto longo')).closest('li') as HTMLElement;
    const detalhe = Array.from(item.querySelectorAll('p')).find((p) => p.textContent?.includes('Linha 1 do relato')) as HTMLElement;
    expect(detalhe.textContent).toBe(seisLinhas.join('\n'));
    for (const linha of seisLinhas) expect(detalhe.textContent).toContain(linha);
    expect(detalhe.className).not.toMatch(SEM_CORTE);
    expect(detalhe.className).toContain('whitespace-pre-wrap');
    expect(detalhe.className).toContain('break-words');
  });

  it('texto de 6 linhas do cliente na faixa "Sem data" também aparece inteiro, como foi escrito', async () => {
    preparar({
      pacientes: [{ id: 'pac-1', historico_clinico: { cirurgias: { items: [{ tipo: 'Coluna', ano: 'faz tempo', complicacoes: seisLinhas.join('\n') }] } }, historia_atual: null }],
    });
    montarLinha();
    const r = await regiao();
    fireEvent.click(await within(r).findByRole('button', { name: /^Sem data/ }));
    const lista = r.querySelector('#linha-do-tempo-sem-data') as HTMLElement;
    const detalhe = Array.from(lista.querySelectorAll('p')).find((p) => p.textContent?.includes('Linha 1 do relato')) as HTMLElement;
    expect(detalhe.textContent).toContain(seisLinhas.join('\n'));
    expect(detalhe.className).not.toMatch(SEM_CORTE);
    expect(detalhe.className).toContain('whitespace-pre-wrap');
  });

  it('nenhum texto da linha do tempo usa corte (line-clamp, truncate, overflow-hidden) em marcos nem em itens sem data', async () => {
    montarLinha();
    const r = await regiao();
    fireEvent.click(await within(r).findByRole('button', { name: /Ver todos/ }));
    fireEvent.click(within(r).getByRole('button', { name: /^Sem data/ }));
    const textos = Array.from(r.querySelectorAll('li p, li span:not([aria-hidden])'));
    expect(textos.length).toBeGreaterThan(10);
    for (const t of textos) expect(t.className, t.textContent ?? '').not.toMatch(SEM_CORTE);
  });

  it('texto de 200 caracteres sem espaço não estoura: título, detalhe e item sem data têm break-words e nenhum contêiner impede a quebra', async () => {
    const comprido = 'A'.repeat(200);
    const outro = 'B'.repeat(200);
    preparar({
      historia_vida_paciente: [{ id: 'h1', paciente_id: 'pac-1', data_evento: '2020-01-01', tipo: 'outro', titulo: comprido, descricao: outro }],
      pacientes: [{ id: 'pac-1', historico_clinico: { cirurgias: { items: [{ tipo: 'C'.repeat(200), ano: 'D'.repeat(200) }] } }, historia_atual: null }],
    });
    montarLinha();
    const r = await regiao();
    fireEvent.click(await within(r).findByRole('button', { name: /^Sem data/ }));
    for (const letra of ['A', 'B', 'C', 'D']) {
      const p = Array.from(r.querySelectorAll('li p')).find((x) => x.textContent?.includes(letra.repeat(200))) as HTMLElement;
      expect(p, letra).toBeTruthy();
      expect(p.className, letra).toContain('break-words');
      expect(p.textContent, letra).toContain(letra.repeat(200));
      for (let el: HTMLElement | null = p; el && el !== r.parentElement; el = el.parentElement) {
        expect(el.className, `${letra} em ${el.tagName}`).not.toMatch(/whitespace-nowrap|overflow-x-(auto|scroll)|truncate/);
      }
    }
    // O item da lista tem min-w-0: sem isso o texto comprido empurra a largura do cartão.
    const li = Array.from(r.querySelectorAll('li[data-natureza]')).find((x) => x.textContent?.includes('A'.repeat(200))) as HTMLElement;
    expect((li.querySelector(':scope > div') as HTMLElement).className).toContain('min-w-0');
  });

  it('o Completo também quebra linha em texto de 200 caracteres sem espaço, e mostra o texto do cliente por inteiro', async () => {
    const comprido = 'Z'.repeat(200);
    preparar({
      ...cenarioCompleto(),
      myid_avaliacoes: [{ id: 'm1', paciente_id: 'pac-1', status: 'concluido', created_at: '2026-09-01T12:00:00+00:00', updated_at: '2026-09-02T12:00:00+00:00', respostas_brutas: { bloco_1_queixa: comprido, bloco_1_quando_desc: seisLinhas.join('\n') } }],
    });
    montarSecoes();
    await regiao();
    fireEvent.click(screen.getByRole('button', { name: 'Completo' }));
    const p = await screen.findByText(`Queixa que o cliente escreveu: ${comprido}`);
    expect(p.className).toContain('break-words');
    expect(p.className).toContain('whitespace-pre-wrap');
    expect(p.className).not.toMatch(SEM_CORTE);
    const secao = document.querySelector('section[aria-label="MyID"]') as HTMLElement;
    for (const linha of Array.from(secao.querySelectorAll('p'))) expect(linha.className).toContain('break-words');
    expect(secao.textContent).toContain('O que estava fazendo quando notou: Linha 1 do relato');
  });
});

describe('Linha do tempo clínica: carregamento, abrir e fechar', () => {
  it('enquanto lê as fontes mostra "Montando a linha do tempo…" e não o estado vazio; some quando termina', async () => {
    montarLinha();
    const r = screen.getByRole('region', { name: TITULO_DA_LINHA });
    expect(within(r).getByText('Montando a linha do tempo…')).toBeInTheDocument();
    expect(r.textContent).not.toContain('Ainda não há marcos');
    await waitFor(() => expect(within(r).queryByText('Montando a linha do tempo…')).toBeNull());
    expect(within(r).getByText('Bioimpedância')).toBeInTheDocument();
  });

  it('"Ver todos" tem aria-expanded que muda e aria-controls que aponta para um id que existe, fechado e aberto', async () => {
    montarLinha();
    const r = await regiao();
    const botao = await within(r).findByRole('button', { name: /Ver todos/ });
    const alvo = () => document.getElementById(botao.getAttribute('aria-controls') ?? '__nenhum__');

    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(alvo()).not.toBeNull();
    expect(alvo()?.querySelectorAll('li[data-natureza]')).toHaveLength(6);

    fireEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(botao.textContent).toBe('Ver menos');
    expect(alvo()).not.toBeNull();
    expect(alvo()?.querySelectorAll('li[data-natureza]')).toHaveLength(9);

    fireEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(botao.textContent).toBe('Ver todos (9)');
    expect(alvo()).not.toBeNull();
  });

  it('a faixa "Sem data" tem aria-expanded que muda e aria-controls que aponta para um id que EXISTE mesmo fechada', async () => {
    montarLinha();
    const r = await regiao();
    const faixa = await within(r).findByRole('button', { name: /^Sem data/ });
    const alvo = () => document.getElementById(faixa.getAttribute('aria-controls') ?? '__nenhum__');

    expect(faixa).toHaveAttribute('aria-expanded', 'false');
    expect(alvo()).not.toBeNull();
    expect(alvo()).toHaveAttribute('hidden');

    fireEvent.click(faixa);
    expect(faixa).toHaveAttribute('aria-expanded', 'true');
    expect(alvo()).not.toBeNull();
    expect(alvo()).not.toHaveAttribute('hidden');

    fireEvent.click(faixa);
    expect(faixa).toHaveAttribute('aria-expanded', 'false');
    expect(alvo()).toHaveAttribute('hidden');
  });

  it('os ids dos alvos são únicos na página e ficam dentro da região', async () => {
    montarLinha();
    const r = await regiao();
    for (const botao of await within(r).findAllByRole('button')) {
      const id = botao.getAttribute('aria-controls') as string;
      expect(id).toBeTruthy();
      expect(document.querySelectorAll(`#${id}`)).toHaveLength(1);
      expect(r.contains(document.getElementById(id))).toBe(true);
    }
  });
});

// ── Completo: avisos e edições do profissional ─────────────────────────────────
describe('Completo: aviso dos selos do cabeçalho e edições do profissional', () => {
  const abrirCompleto = async () => {
    await regiao();
    fireEvent.click(screen.getByRole('button', { name: 'Completo' }));
    await screen.findByText('Montado pelo app a partir das respostas; não vai para o prontuário.');
  };
  const secaoDor = () => document.querySelector('section[aria-label="Dor"]') as HTMLElement | null;
  const comEdicoes = (editadas: Record<string, string>) => resultadoDaAvaliacao({ _secoes: { confirmadas: ['resumo_clinico', 'dor'], editadas } });

  it('o aviso fixo do Completo diz que os selos Prontuário e Sincronizado valem só para o Resumo', async () => {
    montarSecoes();
    await abrirCompleto();
    expect(screen.getByText('Os selos Prontuário e Sincronizado do cabeçalho valem só para o Resumo.')).toBeInTheDocument();
    expect(screen.getByText('Montado pelo app a partir das respostas; não vai para o prontuário.')).toBeInTheDocument();
    // Os selos do cabeçalho continuam lá, e o aviso não aparece na visão Resumo.
    expect(screen.getByText('Sincronizado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Resumo' }));
    expect(screen.queryByText(/valem só para o Resumo/)).toBeNull();
  });

  it('o botão Copiar tem alvo de toque de 44 px e foco visível', async () => {
    montarSecoes();
    await abrirCompleto();
    const copiar = screen.getByRole('button', { name: 'Copiar' });
    expect(copiar.className).toContain('min-h-11');
    expect(copiar.className).not.toContain('min-h-10');
    expect(copiar.className).toContain('focus-visible:ring-2');
  });

  it('Completo sem edição mostra a dor montada pelos campos (EVA 7/10), sem a marca de editado', async () => {
    montarSecoes();
    await abrirCompleto();
    expect(secaoDor()?.textContent).toContain('Intensidade (EVA): 7/10');
    expect(within(secaoDor() as HTMLElement).queryByText('Editado pelo profissional')).toBeNull();
  });

  it('Completo com a dor editada mostra o texto editado (EVA 4/10) no lugar do dado antigo (EVA 7/10), com a marca "Editado pelo profissional"', async () => {
    montarSecoes(comEdicoes({ dor: 'Localização: Lombar\nEVA: 4/10' }));
    await abrirCompleto();
    const dor = secaoDor() as HTMLElement;
    expect(dor.textContent).toContain('EVA: 4/10');
    expect(dor.textContent).not.toContain('7/10');
    expect(within(dor).getByText('Editado pelo profissional')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Intensidade (EVA): 7/10');
  });

  it('Copiar leva o texto editado (EVA 4/10) e nunca o dado antigo (EVA 7/10)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    montarSecoes(comEdicoes({ dor: 'Localização: Lombar\nEVA: 4/10' }));
    await abrirCompleto();
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    await screen.findByText('Copiado.');
    const copiado = writeText.mock.calls[0][0] as string;
    expect(copiado).toContain('Dor (editado pelo profissional)\nLocalização: Lombar\nEVA: 4/10');
    expect(copiado).not.toContain('7/10');
  });

  it('edição vazia: a seção Dor some do Completo (como na tela da avaliação) e o dado antigo não volta nem é copiado', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    montarSecoes(comEdicoes({ dor: '' }));
    await abrirCompleto();
    expect(secaoDor()).toBeNull();
    expect(document.body.textContent).not.toContain('7/10');
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));
    await screen.findByText('Copiado.');
    expect(writeText.mock.calls[0][0]).not.toContain('EVA');
  });

  it('editar a dor na própria tela e depois abrir o Completo (sem recarregar a avaliação) já mostra o texto novo', async () => {
    montarSecoes();
    await regiao();
    fireEvent.mouseDown(screen.getByRole('tab', { name: /Quadro\/Dx/ }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByTitle('Editar texto'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Localização: Lombar\nEVA: 3/10' } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));
    await waitFor(() => expect(h.falso.escritas().some((o) => o.tabela === 'avaliacoes_voz' && o.tipo === 'update')).toBe(true));

    fireEvent.mouseDown(screen.getByRole('tab', { name: /Clínico/ }), { button: 0, ctrlKey: false });
    await regiao();
    fireEvent.click(await screen.findByRole('button', { name: 'Completo' }));
    await screen.findByText('Montado pelo app a partir das respostas; não vai para o prontuário.');
    const dor = secaoDor() as HTMLElement;
    expect(dor.textContent).toContain('EVA: 3/10');
    expect(dor.textContent).not.toContain('7/10');
    expect(within(dor).getByText('Editado pelo profissional')).toBeInTheDocument();
  });

  it('abrir o Completo com edições não escreve nada nem passa pelo prontuário', async () => {
    montarSecoes(comEdicoes({ dor: 'EVA: 4/10' }));
    await abrirCompleto();
    expect(h.falso.escritas()).toEqual([]);
  });
});

describe('Linha do tempo clínica: o mesmo fato relatado pelo cliente e registrado pelo profissional aparece duas vezes, de propósito', () => {
  it('cirurgia no histórico do cliente e na história de vida do profissional: dois marcos, cada um com o seu selo', async () => {
    preparar({
      pacientes: [{ id: 'pac-1', historico_clinico: { cirurgias: { items: [{ tipo: 'Ligamento do joelho (LCA)', ano: '2022' }] } }, historia_atual: null }],
      historia_vida_paciente: [{ id: 'h1', paciente_id: 'pac-1', data_evento: '2022-03-10', tipo: 'cirurgia', titulo: 'Ligamento do joelho (LCA)', descricao: '' }],
    });
    montarLinha();
    const r = await regiao();
    await waitFor(() => expect(within(r).getAllByText(/Ligamento do joelho \(LCA\)/)).toHaveLength(2));
    expect(within(r).getByText('Cirurgia ou internação: Ligamento do joelho (LCA)')).toBeInTheDocument(); // o do cliente leva o rótulo
    expect(within(r).getByText('Ligamento do joelho (LCA)')).toBeInTheDocument(); // o do profissional fica como ele escreveu
    const itens = Array.from(r.querySelectorAll('li[data-natureza]')) as HTMLElement[];
    expect(itens.map((li) => li.querySelector('[data-origem]')?.getAttribute('data-origem')).sort()).toEqual(['cliente', 'profissional']);
    expect(itens.map((li) => li.dataset.precisao).sort()).toEqual(['ano', 'dia']);
  });
});
