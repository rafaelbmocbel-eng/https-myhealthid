import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';
import { envolverBanco, type BancoEnvolvido } from './helpers/bancoFalsoLeitura';

const h = vi.hoisted(() => ({ falso: null as unknown as BancoFalso, banco: null as unknown as BancoEnvolvido }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (t: string) => h.banco.from(t), rpc: (n: string, a?: Record<string, unknown>) => h.banco.rpc(n, a) },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'prof-1' } }) }));

import LinhaDoTempoClinica from '@/components/resumoClinico/LinhaDoTempoClinica';

// Tela da Linha do tempo clínica depois do print do celular (390 px): cartão "Como começou", título da cirurgia, filtro por
// tipo, avisos de corte e de registros de fora e a letra do cartão inteiro.

const SELO = 'Relatado pelo cliente, não revisado';

// Os dados do print: cirurgia "Coluna" de 2022 no histórico, "Há quanto tempo começou: Mais de 3 anos" na história atual e,
// no MyID, a faixa "Mais de 1 ano" e o texto escrito. MyID concluído em 07/10/2026 e avaliação presencial em 06/10/2026.
function cenarioDoPrint(): Record<string, Linha[]> {
  return {
    pacientes: [{
      id: 'pac-1',
      historico_clinico: { cirurgias: { items: [{ id: 'c1', tipo: 'Coluna', ano: '2022', complicacoes: '' }] } },
      historia_atual: { queixa: 'Dor lombar do lado direito', inicio: 'Mais de 3 anos' },
    }],
    myid_avaliacoes: [{
      id: 'm1', paciente_id: 'pac-1', status: 'concluido', created_at: '2026-10-07T12:00:00+00:00', updated_at: '2026-10-07T12:00:00+00:00',
      respostas_brutas: {
        bloco_1_queixa: 'Dor nas costas ao acordar',
        bloco_1_duracao: 'gt1y',
        bloco_1_quando_data: 'Os sintomas permanecem mesmo após cirurgia na coluna realizada em junho de 2022',
        bloco_1_quando_desc: 'Carregando uma caixa pesada',
      },
    }],
    avaliacoes_identidade: [{ id: 'ai1', paciente_id: 'pac-1', terapeuta_id: 'prof-1', myid_avaliacao_id: 'm1', created_at: '2026-10-07T12:00:00+00:00' }],
    avaliacoes_voz: [{ id: 'av-1', paciente_id: 'pac-1', terapeuta_id: 'prof-1', created_at: '2026-10-06T12:00:00+00:00', queixa_principal: 'Dor lombar' }],
    historia_vida_paciente: [],
    diagnosticos_paciente: [],
    exames_presenciais: [],
    exames_importados: [],
    testes_funcionais_paciente: [],
    escalas_psicologia: [],
  };
}

function preparar(tabelas: Record<string, Linha[]>) {
  h.falso = criarBancoFalso(tabelas);
  h.banco = envolverBanco(h.falso);
}

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return { qc, ...render(<QueryClientProvider client={qc}><LinhaDoTempoClinica pacienteId="pac-1" /></QueryClientProvider>) };
}

const regiao = () => screen.findByRole('region', { name: 'Linha do tempo clínica' });
const cartao = (r: HTMLElement) => within(r).getByRole('group', { name: 'Como começou' });
const titulosDosMarcos = (r: HTMLElement) =>
  Array.from(r.querySelectorAll('li[data-natureza] p:first-of-type')).map((p) => p.textContent?.replace(/^(Registro no app|Fato clínico): /, ''));
const anosDosMarcos = (r: HTMLElement) => {
  const lista = r.querySelector('#linha-do-tempo-marcos') as HTMLElement;
  return Array.from(lista.querySelectorAll('h4')).map((x) => x.textContent);
};

beforeEach(() => { preparar(cenarioDoPrint()); });

describe('Cartão "Como começou"', () => {
  it('vem no topo, antes dos marcos, sempre aberto, com o rótulo exato de cada pergunta e o texto do cliente como ele escreveu', async () => {
    montar();
    const r = await regiao();
    const c = await waitFor(() => cartao(r));
    expect(c).toBeVisible();
    expect(c.closest('details')).toBeNull();
    expect(c.closest('[hidden]')).toBeNull();
    // Antes dos marcos e da faixa "Sem data".
    const marcos = r.querySelector('#linha-do-tempo-marcos') as HTMLElement;
    expect(c.compareDocumentPosition(marcos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const pares = Array.from(c.querySelectorAll('dt')).map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]);
    expect(pares).toEqual([
      ['Queixa principal (história atual)', 'Dor lombar do lado direito'],
      ['Queixa principal (MyID)', 'Dor nas costas ao acordar'],
      ['Há quanto tempo começou (história atual)', 'Mais de 3 anos'],
      ['Quando começou (faixa escolhida no MyID)', 'Mais de 1 ano'],
      ['Quando começou (texto escrito no MyID)', 'Os sintomas permanecem mesmo após cirurgia na coluna realizada em junho de 2022'],
      ['O que estava fazendo quando notou (MyID)', 'Carregando uma caixa pesada'],
    ]);
  });

  it('a divergência fica à vista: "Mais de 3 anos" (história atual) e "Mais de 1 ano" (MyID) aparecem juntas, sem soma nem escolha', async () => {
    montar();
    const r = await regiao();
    const c = await waitFor(() => cartao(r));
    expect(within(c).getByText('Mais de 3 anos')).toBeInTheDocument();
    expect(within(c).getByText('Mais de 1 ano')).toBeInTheDocument();
  });

  it('mostra o dia do MyID de onde vieram as respostas (a data do histórico, 07/10/2026) e nunca como data do começo', async () => {
    montar();
    const r = await regiao();
    const c = await waitFor(() => cartao(r));
    expect(within(c).getByText('Respostas do MyID de 07/10/2026.')).toBeInTheDocument();
  });

  it('sem o vínculo com o histórico não inventa o dia do MyID', async () => {
    preparar({ ...cenarioDoPrint(), avaliacoes_identidade: [] });
    montar();
    const r = await regiao();
    const c = await waitFor(() => cartao(r));
    expect(c.textContent).not.toMatch(/Respostas do MyID de/);
    expect(c.textContent).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('tem UM selo só, no cabeçalho, e o texto do selo não mudou', async () => {
    montar();
    const r = await regiao();
    const c = await waitFor(() => cartao(r));
    const selos = c.querySelectorAll('[data-origem]');
    expect(selos).toHaveLength(1);
    expect(selos[0].textContent).toBe(SELO);
    expect(selos[0].getAttribute('data-origem')).toBe('cliente');
    // No mesmo cabeçalho do título, e não ao lado de cada resposta.
    expect(selos[0].parentElement).toBe(c.querySelector('h4')?.parentElement);
    expect(c.querySelectorAll('dd [data-origem], dt [data-origem]')).toHaveLength(0);
  });

  it('o leitor de tela ouve que o bloco inteiro é relato do cliente não revisado', async () => {
    montar();
    const r = await regiao();
    const c = await waitFor(() => cartao(r));
    const idDoAviso = c.getAttribute('aria-describedby') as string;
    expect(idDoAviso).toBeTruthy();
    const aviso = document.getElementById(idDoAviso) as HTMLElement;
    expect(aviso.textContent).toBe('Tudo o que está neste bloco é relato do cliente e não foi revisado pelo profissional.');
    expect(aviso.className).toContain('sr-only');
    expect(c).toHaveAccessibleDescription(aviso.textContent as string);
  });

  it('as respostas saem da faixa "Sem data" (que fica com o resto) e nada do cartão vira marco ou data', async () => {
    preparar({
      ...cenarioDoPrint(),
      pacientes: [{
        id: 'pac-1',
        historico_clinico: { cirurgias: { items: [{ id: 'c1', tipo: 'Coluna', ano: '2022' }, { id: 'c2', tipo: 'Apêndice', ano: 'há 2 anos' }] } },
        historia_atual: { queixa: 'Dor lombar do lado direito', inicio: 'Mais de 3 anos' },
      }],
    });
    montar();
    const r = await regiao();
    fireEvent.click(await within(r).findByRole('button', { name: /^Sem data/ }));
    const semData = r.querySelector('#linha-do-tempo-sem-data') as HTMLElement;
    expect(semData).toBeVisible();
    expect(semData.textContent).toContain('Apêndice');
    for (const dito of ['Mais de 3 anos', 'Mais de 1 ano', 'Os sintomas permanecem', 'Carregando uma caixa', 'Dor nas costas ao acordar']) {
      expect(semData.textContent, dito).not.toContain(dito);
    }
    expect(within(semData).getAllByRole('listitem')).toHaveLength(1);
    // Nenhum marco nasceu do texto do cliente: o único ano com marco é o da cirurgia e o do MyID/avaliação.
    expect(titulosDosMarcos(r).join('|')).not.toContain('Os sintomas permanecem');
    expect(anosDosMarcos(r)).toEqual(['2026', '2022']);
  });

  it('o cartão não usa corte de texto e quebra linha livre (texto comprido sem espaço não estoura)', async () => {
    const longo = 'Z'.repeat(200);
    preparar({
      ...cenarioDoPrint(),
      pacientes: [{ id: 'pac-1', historico_clinico: null, historia_atual: { queixa: longo, inicio: longo + 'Y' } }],
    });
    montar();
    const r = await regiao();
    const c = await waitFor(() => cartao(r));
    for (const dd of Array.from(c.querySelectorAll('dd, dt'))) {
      expect(dd.className).toContain('break-words');
      expect(dd.className).not.toMatch(/truncate|line-clamp|overflow-hidden|whitespace-nowrap/);
    }
    expect(c.className).not.toMatch(/overflow|truncate|line-clamp/);
    expect(within(c).getByText(longo)).toBeInTheDocument();
    expect(within(c).getByText(longo + 'Y')).toBeInTheDocument();
  });

  it('com só uma queixa (sem resposta de início) o cartão aparece e não mostra o grupo vazio', async () => {
    preparar({
      ...cenarioDoPrint(),
      pacientes: [{ id: 'pac-1', historico_clinico: null, historia_atual: { queixa: 'Só a queixa' } }],
      myid_avaliacoes: [],
      avaliacoes_identidade: [],
    });
    montar();
    const r = await regiao();
    const c = await waitFor(() => cartao(r));
    expect(within(c).getByText('Só a queixa')).toBeInTheDocument();
    expect(c.querySelectorAll('dl')).toHaveLength(1);
  });

  it('sem nada do cliente o cartão não aparece; só com ele e sem marco com data a tela diz isso, sem o estado vazio geral', async () => {
    preparar({ ...cenarioDoPrint(), pacientes: [{ id: 'pac-1', historico_clinico: null, historia_atual: null }], myid_avaliacoes: [], avaliacoes_identidade: [], avaliacoes_voz: [] });
    montar();
    const vazia = await regiao();
    await waitFor(() => expect(within(vazia).getByText(/Ainda não há marcos para mostrar/)).toBeInTheDocument());
    expect(within(vazia).queryByRole('group', { name: 'Como começou' })).toBeNull();
  });

  it('só com o relato do cliente (sem marco com data) mostra o cartão e "Ainda não há marcos com data"', async () => {
    preparar({
      ...cenarioDoPrint(),
      pacientes: [{ id: 'pac-1', historico_clinico: null, historia_atual: { inicio: 'Mais de 3 anos' } }],
      myid_avaliacoes: [], avaliacoes_identidade: [], avaliacoes_voz: [],
    });
    montar();
    const r = await regiao();
    await waitFor(() => cartao(r));
    expect(within(r).getByText('Ainda não há marcos com data para mostrar.')).toBeInTheDocument();
    expect(within(r).queryByText(/Ainda não há marcos para mostrar/)).toBeNull();
  });
});

describe('Título da cirurgia do cliente e rótulo do tipo', () => {
  it('o marco de 2022 vira "Cirurgia ou internação: Coluna" e a linha de baixo não repete o rótulo', async () => {
    montar();
    const r = await regiao();
    await waitFor(() => expect(within(r).getByText('Cirurgia ou internação: Coluna')).toBeInTheDocument());
    const item = within(r).getByText('Cirurgia ou internação: Coluna').closest('li') as HTMLElement;
    const paragrafos = item.querySelectorAll('p');
    expect(paragrafos[1].textContent).toBe('2022');
    expect(item.textContent).not.toMatch(/Cirurgia ou internação.*Cirurgia ou internação/);
    expect(within(r).queryByText('Coluna')).toBeNull();
  });

  it('a cirurgia do cliente com ano que não é ano de verdade também leva o rótulo em "Sem data", sem repetir no detalhe', async () => {
    preparar({
      ...cenarioDoPrint(),
      pacientes: [{ id: 'pac-1', historico_clinico: { cirurgias: { items: [{ id: 'c2', tipo: 'Coluna', ano: 'faz tempo', complicacoes: 'Dor' }] } }, historia_atual: null }],
    });
    montar();
    const r = await regiao();
    fireEvent.click(await within(r).findByRole('button', { name: /^Sem data/ }));
    const item = within(r.querySelector('#linha-do-tempo-sem-data') as HTMLElement).getAllByRole('listitem')[0];
    const paragrafos = item.querySelectorAll('p');
    expect(paragrafos[0].textContent).toBe('Cirurgia ou internação: Coluna');
    expect(paragrafos[1].textContent).toBe('Ano que o cliente escreveu: "faz tempo" · Complicações: Dor');
    expect(item.textContent).toContain(SELO);
  });

  it('o texto do cliente que já abre com "Cirurgia" não ganha o rótulo, e o rótulo do tipo aparece na linha da data', async () => {
    preparar({
      ...cenarioDoPrint(),
      pacientes: [{ id: 'pac-1', historico_clinico: { cirurgias: { items: [{ id: 'c3', tipo: 'Cirurgia no joelho', ano: '2020' }] } }, historia_atual: null }],
    });
    montar();
    const r = await regiao();
    await waitFor(() => expect(within(r).getByText('Cirurgia no joelho')).toBeInTheDocument());
    const item = within(r).getByText('Cirurgia no joelho').closest('li') as HTMLElement;
    // O título já abre com "Cirurgia", mas não com "Cirurgia ou internação": o rótulo do tipo continua na linha da data.
    expect(item.querySelectorAll('p')[1].textContent).toBe('2020 · Cirurgia ou internação');
  });

  it('o marco "MyID concluído" e o da avaliação continuam com o título e a data que o print mostra', async () => {
    montar();
    const r = await regiao();
    await waitFor(() => expect(within(r).getByText('MyID concluído')).toBeInTheDocument());
    const myid = within(r).getByText('MyID concluído').closest('li') as HTMLElement;
    expect(myid.querySelectorAll('p')[1].textContent).toBe('07/10/2026 · registro no app');
    const aval = within(r).getByText('Avaliação presencial registrada').closest('li') as HTMLElement;
    expect(aval.querySelectorAll('p')[1].textContent).toBe('06/10/2026 · registro no app');
  });

  it('o detalhe do "MyID concluído" é curto e verdadeiro, e a frase da montagem na hora continua', async () => {
    montar();
    const r = await regiao();
    await waitFor(() => expect(within(r).getByText('MyID concluído')).toBeInTheDocument());
    const myid = within(r).getByText('MyID concluído').closest('li') as HTMLElement;
    expect(myid.textContent).toContain('Concluído e registrado no histórico do paciente.');
    expect(r.textContent).not.toContain('Data em que a conclusão foi registrada no histórico do paciente.');
    expect(r.textContent).toContain('Montada na hora; não vai para o prontuário.');
  });
});

describe('Letra do cartão inteiro: corpo 14 px e linha de data 12 px', () => {
  const PEQUENAS = /(^|\s)text-\[(9|10|11|12|13)(\.\d+)?px\](\s|$)/;

  it('a aba Completo também não usa letra menor que 12 px (nem text-[10px], [11px], [12px], [12.5px] ou [13px])', () => {
    const fonte = readFileSync(join(process.cwd(), 'src/components/resumoClinico/ResumoCompleto.tsx'), 'utf8');
    const pequenas = fonte.match(/text-\[(9|10|11|12|13)(\.\d+)?px\]/g) ?? [];
    expect(pequenas).toEqual([]);
    expect(fonte).toContain('text-sm leading-relaxed');
  });

  it('nenhuma classe de letra menor que 12 px sobra no cartão (nem text-[10px], [11px], [12px] ou [13px])', async () => {
    const dados = cenarioDoPrint();
    dados.historia_vida_paciente = [{ id: 'h9', paciente_id: 'pac-1', data_evento: '0001-01-01', tipo: 'outro', titulo: 'Data absurda' }];
    dados.diagnosticos_paciente = [{ id: 'd1', paciente_id: 'pac-1', data_diagnostico: null, cid_codigo: 'M54.5', cid_descricao: 'Dor lombar baixa', created_at: '2026-01-01T12:00:00+00:00', ativo: true, tipo: 'principal' }];
    preparar(dados);
    montar();
    const r = await regiao();
    await waitFor(() => cartao(r));
    fireEvent.click(await within(r).findByRole('button', { name: /^Sem data/ }));
    fireEvent.click(within(r).getByRole('button', { name: /de fora/ }));
    const comLetraPequena = Array.from(r.querySelectorAll('[class]')).filter((e) => PEQUENAS.test(e.getAttribute('class') ?? ''));
    expect(comLetraPequena.map((e) => `${e.tagName}.${e.getAttribute('class')}`)).toEqual([]);
  });

  it('título e detalhe do marco são text-sm (14 px), a linha da data e o selo são text-xs (12 px)', async () => {
    montar();
    const r = await regiao();
    await waitFor(() => expect(within(r).getByText('MyID concluído')).toBeInTheDocument());
    const item = within(r).getByText('MyID concluído').closest('li') as HTMLElement;
    const [titulo, linhaDaData, detalhe] = Array.from(item.querySelectorAll('p'));
    expect(titulo.className).toContain('text-sm');
    expect(linhaDaData.className).toContain('text-xs');
    expect(linhaDaData.className).not.toContain('text-sm');
    expect(detalhe.className).toContain('text-sm');
    expect(item.querySelector('[data-origem]')?.className).toContain('text-xs');
    expect(r.querySelector('h3')?.className).toContain('text-sm');
    for (const ano of Array.from(r.querySelectorAll('#linha-do-tempo-marcos h4'))) expect(ano.className).toContain('text-sm');
  });

  it('o cartão "Como começou" usa 14 px no texto do cliente e 12 px no rótulo da pergunta', async () => {
    montar();
    const r = await regiao();
    const c = await waitFor(() => cartao(r));
    for (const dd of Array.from(c.querySelectorAll('dd'))) expect(dd.className).toContain('text-sm');
    for (const dt of Array.from(c.querySelectorAll('dt'))) expect(dt.className).toContain('text-xs');
  });
});

describe('Filtro por tipo de marco', () => {
  const rotuloCompleto = (r: HTMLElement) => within(r).getByRole('group', { name: 'Filtrar os marcos por tipo' });

  function cenarioComMuitosMarcos(): Record<string, Linha[]> {
    return {
      pacientes: [{
        id: 'pac-1',
        historico_clinico: { cirurgias: { items: [{ id: 'a', tipo: 'Ligamento do joelho', ano: '2022' }] } },
        historia_atual: { queixa: 'Dor' },
      }],
      myid_avaliacoes: [{ id: 'm1', paciente_id: 'pac-1', status: 'concluido', created_at: '2026-09-01T12:00:00+00:00', updated_at: '2026-09-01T12:00:00+00:00', respostas_brutas: {} }],
      avaliacoes_identidade: [{ id: 'ai1', paciente_id: 'pac-1', terapeuta_id: 'prof-1', myid_avaliacao_id: 'm1', created_at: '2026-09-02T12:00:00+00:00' }],
      avaliacoes_voz: [],
      historia_vida_paciente: [{ id: 'h1', paciente_id: 'pac-1', data_evento: '2019-03-04', tipo: 'fratura', titulo: 'Fratura de punho', descricao: '' }],
      diagnosticos_paciente: [
        { id: 'd1', paciente_id: 'pac-1', data_diagnostico: '2024-05-06', cid_codigo: 'M54.5', cid_descricao: 'Dor lombar baixa', created_at: '2026-01-01T12:00:00+00:00', ativo: true, tipo: 'principal' },
      ],
      exames_presenciais: [{ id: 'e1', paciente_id: 'pac-1', tipo: 'bioimpedancia', data_exame: '2026-08-01', resumo: 'Peso 70 kg' }],
      exames_importados: [],
      testes_funcionais_paciente: Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, paciente_id: 'pac-1', tipo_teste: 'tug', resultado: 9 + i, unidade: 'segundos', data_teste: `2026-06-0${i + 1}` })),
      escalas_psicologia: [{ id: 's1', paciente_id: 'pac-1', tipo_escala: 'phq9', pontuacao_total: 7, data_aplicacao: '2026-05-01' }],
    };
  }

  it('com muitos marcos e mais de um tipo mostra os chips com contagem, em um grupo com nome, e "Tudo" começa marcado', async () => {
    preparar(cenarioComMuitosMarcos());
    montar();
    const r = await regiao();
    const grupo = await waitFor(() => rotuloCompleto(r));
    const botoes = within(grupo).getAllByRole('button');
    // 12 marcos: MyID, 6 testes + exame + escala, diagnóstico, cirurgia e a fratura (evento de vida).
    expect(botoes.map((b) => b.textContent)).toEqual(['Tudo (12)', 'Cirurgias e diagnósticos (2)', 'Eventos de vida (1)', 'Exames e testes (8)', 'MyID (1)']);
    expect(botoes.map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false', 'false', 'false']);
    for (const b of botoes) {
      expect(b.className, b.textContent ?? '').toContain('min-h-11');
      expect(b.className, b.textContent ?? '').toContain('focus-visible:ring-2');
      expect(document.getElementById(b.getAttribute('aria-controls') as string)).not.toBeNull();
    }
  });

  it('escolher um tipo mostra só ele, troca o aria-pressed, e o corte de 6 e o "Ver todos" valem dentro do filtro', async () => {
    preparar(cenarioComMuitosMarcos());
    montar();
    const r = await regiao();
    const grupo = await waitFor(() => rotuloCompleto(r));
    fireEvent.click(within(grupo).getByRole('button', { name: 'Exames e testes (8)' }));
    expect(within(grupo).getByRole('button', { name: 'Exames e testes (8)' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(grupo).getByRole('button', { name: 'Tudo (12)' })).toHaveAttribute('aria-pressed', 'false');
    expect(titulosDosMarcos(r)).toHaveLength(6);
    expect(titulosDosMarcos(r).join('|')).not.toContain('Dor lombar baixa');
    fireEvent.click(within(r).getByRole('button', { name: 'Ver todos (8)' }));
    expect(titulosDosMarcos(r)).toHaveLength(8);
    expect(titulosDosMarcos(r).every((t) => /Tug|Bioimpedância|PHQ-9/.test(t ?? ''))).toBe(true);
    fireEvent.click(within(grupo).getByRole('button', { name: 'Tudo (12)' }));
    expect(titulosDosMarcos(r)).toHaveLength(12);
  });

  it('"Ver todos" conta só o que o filtro escolhido tem: com 6 ou menos, o botão some, mesmo havendo mais marcos em Tudo', async () => {
    preparar(cenarioComMuitosMarcos());
    montar();
    const r = await regiao();
    const grupo = await waitFor(() => rotuloCompleto(r));
    expect(within(r).getByRole('button', { name: 'Ver todos (12)' })).toBeInTheDocument();
    fireEvent.click(within(grupo).getByRole('button', { name: 'Cirurgias e diagnósticos (2)' }));
    expect(titulosDosMarcos(r)).toHaveLength(2);
    expect(within(r).queryByRole('button', { name: /Ver todos/ })).toBeNull();
  });

  it('se o filtro escolhido deixa de existir depois de gravar (os chips somem), a tela volta para "Tudo" e não fica uma lista vazia sem saída', async () => {
    preparar(cenarioComMuitosMarcos());
    const { qc } = montar();
    const r = await regiao();
    const grupo = await waitFor(() => rotuloCompleto(r));
    fireEvent.click(within(grupo).getByRole('button', { name: 'Exames e testes (8)' }));
    expect(titulosDosMarcos(r)).toHaveLength(6);
    // O profissional apaga os exames, testes e escalas em outra tela; a linha do tempo é invalidada e relê.
    const apagadas: Record<string, Linha[]> = {};
    for (const tabela of ['testes_funcionais_paciente', 'exames_presenciais', 'escalas_psicologia']) {
      apagadas[tabela] = [...h.falso.tabelas[tabela]];
      h.falso.tabelas[tabela].length = 0;
    }
    await act(async () => { await qc.invalidateQueries({ queryKey: ['fontes-clinicas', 'pac-1'] }); });
    await waitFor(() => expect(within(r).queryByRole('group', { name: 'Filtrar os marcos por tipo' })).toBeNull());
    expect(titulosDosMarcos(r)).toHaveLength(4);
    expect(titulosDosMarcos(r)).toContain('[M54.5] Dor lombar baixa');
    // Os registros voltam e os chips também: o filtro de antes NÃO reaparece sozinho, a tela começa de novo em "Tudo".
    for (const tabela of Object.keys(apagadas)) h.falso.tabelas[tabela].push(...apagadas[tabela]);
    await act(async () => { await qc.invalidateQueries({ queryKey: ['fontes-clinicas', 'pac-1'] }); });
    const grupoDeNovo = await waitFor(() => rotuloCompleto(r));
    expect(within(grupoDeNovo).getByRole('button', { name: 'Tudo (12)' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(grupoDeNovo).getByRole('button', { name: 'Exames e testes (8)' })).toHaveAttribute('aria-pressed', 'false');
    expect(titulosDosMarcos(r)).toHaveLength(6);
  });

  it('com um tipo escolhido o "Como começou" continua à vista e "Sem data" não some: a tela diz que o item aparece em Tudo', async () => {
    const dados = cenarioComMuitosMarcos();
    dados.pacientes = [{
      id: 'pac-1',
      historico_clinico: { cirurgias: { items: [{ id: 'a', tipo: 'Ligamento do joelho', ano: '2022' }, { id: 'b', tipo: 'Apêndice', ano: 'há 2 anos' }] } },
      historia_atual: { queixa: 'Dor', inicio: 'Mais de 3 anos' },
    }];
    preparar(dados);
    montar();
    const r = await regiao();
    const grupo = await waitFor(() => rotuloCompleto(r));
    expect(within(r).getByRole('button', { name: /^Sem data/ })).toBeInTheDocument();
    fireEvent.click(within(grupo).getByRole('button', { name: /^MyID/ }));
    expect(cartao(r)).toBeVisible();
    expect(within(cartao(r)).getByText('Mais de 3 anos')).toBeInTheDocument();
    expect(within(r).queryByRole('button', { name: /^Sem data/ })).toBeNull();
    expect(within(r).getByText('1 item sem data aparece em Tudo.')).toBeInTheDocument();
    fireEvent.click(within(grupo).getByRole('button', { name: /^Tudo/ }));
    expect(within(r).getByRole('button', { name: /^Sem data/ })).toBeInTheDocument();
    expect(within(r).queryByText(/aparece em Tudo/)).toBeNull();
  });

  it('a fratura da história de vida tem o seu chip, "Eventos de vida", e só aparece nele e em Tudo', async () => {
    preparar(cenarioComMuitosMarcos());
    montar();
    const r = await regiao();
    const grupo = await waitFor(() => rotuloCompleto(r));
    fireEvent.click(within(grupo).getByRole('button', { name: 'Eventos de vida (1)' }));
    expect(titulosDosMarcos(r)).toEqual(['Fratura de punho']);
    for (const nome of ['Cirurgias e diagnósticos (2)', 'Exames e testes (8)', 'MyID (1)']) {
      fireEvent.click(within(grupo).getByRole('button', { name: nome }));
      expect(titulosDosMarcos(r), nome).not.toContain('Fratura de punho');
    }
    fireEvent.click(within(grupo).getByRole('button', { name: 'Tudo (12)' }));
    fireEvent.click(within(r).getByRole('button', { name: 'Ver todos (12)' }));
    expect(titulosDosMarcos(r)).toContain('Fratura de punho');
  });

  it('um marco sem categoria (o último envio do histórico clínico) aparece em Tudo e em nenhum outro filtro, sem sumir', async () => {
    const dados = cenarioComMuitosMarcos();
    dados.pacientes = [{
      id: 'pac-1',
      historico_clinico: { cirurgias: { items: [{ id: 'a', tipo: 'Ligamento do joelho', ano: '2022' }] }, ultimo_envio: '2026-09-10T12:00:00-03:00' },
      historia_atual: { queixa: 'Dor' },
    }];
    preparar(dados);
    montar();
    const r = await regiao();
    const grupo = await waitFor(() => rotuloCompleto(r));
    fireEvent.click(within(r).getByRole('button', { name: 'Ver todos (13)' }));
    const envio = 'Último envio do histórico clínico (pelo cliente)';
    expect(titulosDosMarcos(r)).toContain(envio);
    for (const nome of ['Cirurgias e diagnósticos (2)', 'Eventos de vida (1)', 'Exames e testes (8)', 'MyID (1)']) {
      fireEvent.click(within(grupo).getByRole('button', { name: nome }));
      expect(titulosDosMarcos(r), nome).not.toContain(envio);
    }
    fireEvent.click(within(grupo).getByRole('button', { name: 'Tudo (13)' }));
    expect(titulosDosMarcos(r)).toHaveLength(13);
    expect(titulosDosMarcos(r)).toContain(envio);
  });

  it('com poucos marcos (até 6) os chips não aparecem, mesmo havendo mais de um tipo', async () => {
    preparar({ ...cenarioComMuitosMarcos(), testes_funcionais_paciente: [], escalas_psicologia: [], exames_presenciais: [], historia_vida_paciente: [] });
    montar();
    const r = await regiao();
    // Cirurgia, MyID e diagnóstico: três marcos em dois tipos.
    await waitFor(() => expect(titulosDosMarcos(r)).toHaveLength(3));
    expect(within(r).queryByRole('group', { name: 'Filtrar os marcos por tipo' })).toBeNull();
  });

  it('com exatamente 6 marcos em vários tipos os chips não aparecem; com 7 aparecem', async () => {
    const seis = { ...cenarioComMuitosMarcos(), testes_funcionais_paciente: cenarioComMuitosMarcos().testes_funcionais_paciente.slice(0, 2), escalas_psicologia: [] };
    // cirurgia + MyID + fratura + diagnóstico + exame + 2 testes = 7
    preparar(seis);
    const sete = montar();
    const r7 = await regiao();
    await waitFor(() => expect(within(r7).getByRole('group', { name: 'Filtrar os marcos por tipo' })).toBeInTheDocument());
    sete.unmount();
    // cirurgia + MyID + diagnóstico + exame + 2 testes = 6
    preparar({ ...seis, historia_vida_paciente: [] });
    montar();
    const r6 = await regiao();
    await waitFor(() => expect(titulosDosMarcos(r6)).toHaveLength(6));
    expect(within(r6).queryByRole('group', { name: 'Filtrar os marcos por tipo' })).toBeNull();
  });

  it('com muitos marcos de um tipo só (uma categoria) os chips não aparecem', async () => {
    const dados = cenarioComMuitosMarcos();
    preparar({
      ...dados,
      pacientes: [{ id: 'pac-1', historico_clinico: null, historia_atual: null }],
      myid_avaliacoes: [], avaliacoes_identidade: [], historia_vida_paciente: [], diagnosticos_paciente: [], exames_presenciais: [], escalas_psicologia: [],
      testes_funcionais_paciente: Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, paciente_id: 'pac-1', tipo_teste: 'tug', resultado: 9, unidade: 'segundos', data_teste: `2026-06-0${i + 1}` })),
    });
    montar();
    const r = await regiao();
    await waitFor(() => expect(within(r).getByRole('button', { name: 'Ver todos (8)' })).toBeInTheDocument());
    expect(within(r).queryByRole('group', { name: 'Filtrar os marcos por tipo' })).toBeNull();
  });
});

describe('Aviso de corte por fonte ("mostrando os N mais recentes")', () => {
  const vidas = (n: number): Linha[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `h${i}`, paciente_id: 'pac-1', data_evento: `2020-01-${String((i % 28) + 1).padStart(2, '0')}`, tipo: 'outro', titulo: `Fato ${i}`, descricao: '',
    }));

  it('passou de 50 na história de vida: avisa que mostra os 50 mais recentes', async () => {
    preparar({ ...cenarioDoPrint(), historia_vida_paciente: vidas(51) });
    montar();
    const r = await regiao();
    await waitFor(() => expect(within(r).getByText('História de vida: mostrando os 50 mais recentes.')).toBeInTheDocument());
    expect(r.querySelector('[data-aviso="cortes"]')).not.toBeNull();
  });

  it('exatamente 50 não é corte: nenhum aviso', async () => {
    preparar({ ...cenarioDoPrint(), historia_vida_paciente: vidas(50) });
    montar();
    const r = await regiao();
    await waitFor(() => expect(titulosDosMarcos(r).length).toBeGreaterThan(0));
    expect(r.querySelector('[data-aviso="cortes"]')).toBeNull();
    expect(within(r).queryByText(/mostrando os/)).toBeNull();
  });

  it('uma frase por fonte cortada, cada uma com o próprio limite', async () => {
    const diag = (n: number): Linha[] =>
      Array.from({ length: n }, (_, i) => ({
        id: `d${i}`, paciente_id: 'pac-1', data_diagnostico: '2020-01-01', cid_codigo: `M${i}`, cid_descricao: `Diag ${i}`, created_at: '2021-01-01T12:00:00+00:00', ativo: true, tipo: 'principal',
      }));
    preparar({ ...cenarioDoPrint(), historia_vida_paciente: vidas(51), diagnosticos_paciente: diag(201) });
    montar();
    const r = await regiao();
    await waitFor(() => expect(within(r).getByText('Diagnósticos: mostrando os 200 mais recentes.')).toBeInTheDocument());
    expect(within(r).getByText('História de vida: mostrando os 50 mais recentes.')).toBeInTheDocument();
    expect(r.querySelectorAll('[data-aviso="cortes"] p')).toHaveLength(2);
  });
});

describe('Registros que ficaram de fora', () => {
  const absurdo: Linha = { id: 'h-ruim', paciente_id: 'pac-1', data_evento: '0001-01-01', tipo: 'outro', titulo: 'Data absurda', descricao: '' };

  it('o aviso fala em "data ausente, inválida ou no futuro" e o texto antigo não existe mais', async () => {
    preparar({ ...cenarioDoPrint(), historia_vida_paciente: [absurdo] });
    montar();
    const r = await regiao();
    await within(r).findByText('1 registro ficou de fora: data ausente, inválida ou no futuro.');
    expect(r.textContent).not.toContain('a data não é válida');
  });

  it('a área vem recolhida: botão de 44 px com aria-expanded e aria-controls para um id que existe, com a lista sempre montada', async () => {
    preparar({ ...cenarioDoPrint(), historia_vida_paciente: [absurdo] });
    montar();
    const r = await regiao();
    const botao = await within(r).findByRole('button', { name: /de fora/ });
    expect(botao.className).toContain('min-h-11');
    expect(botao.className).toContain('focus-visible:ring-2');
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    const id = botao.getAttribute('aria-controls') as string;
    const lista = document.getElementById(id) as HTMLElement;
    expect(lista).not.toBeNull();
    expect(r.contains(lista)).toBe(true);
    expect(lista).not.toBeVisible();
    expect(lista.textContent).toContain('Data absurda');
  });

  it('ao abrir, diz QUAL registro ficou de fora e o motivo; ao fechar, esconde de novo', async () => {
    preparar({
      ...cenarioDoPrint(),
      historia_vida_paciente: [absurdo, { ...absurdo, id: 'h-ruim-2', titulo: 'Outra data absurda' }],
      exames_presenciais: [{ id: 'e-ruim', paciente_id: 'pac-1', tipo: 'bioimpedancia', data_exame: '0001-01-01', resumo: '' }],
    });
    montar();
    const r = await regiao();
    const botao = await within(r).findByRole('button', { name: /de fora/ });
    expect(botao.textContent).toContain('3 registros ficaram de fora: data ausente, inválida ou no futuro.');
    fireEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    const lista = document.getElementById(botao.getAttribute('aria-controls') as string) as HTMLElement;
    expect(lista).toBeVisible();
    const itens = within(lista).getAllByRole('listitem');
    expect(itens).toHaveLength(3);
    expect(lista.textContent).toContain('Data absurda');
    expect(lista.textContent).toContain('Outra data absurda');
    expect(within(lista).getAllByText(/data ausente, inválida ou no futuro/)).toHaveLength(3);
    expect(lista.textContent).toContain('História de vida · data ausente, inválida ou no futuro');
    // Nenhum deles virou marco.
    expect(titulosDosMarcos(r).join('|')).not.toContain('Data absurda');
    fireEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(lista).not.toBeVisible();
  });

  it('sem registros de fora não há botão nem lista', async () => {
    montar();
    const r = await regiao();
    await waitFor(() => expect(within(r).getByText('MyID concluído')).toBeInTheDocument());
    expect(within(r).queryByRole('button', { name: /de fora/ })).toBeNull();
    expect(r.querySelector('#linha-do-tempo-fora')).toBeNull();
  });

  it('os ids dos alvos (marcos, sem data, de fora, cartão) são únicos e ficam dentro da região', async () => {
    preparar({ ...cenarioDoPrint(), historia_vida_paciente: [absurdo] });
    montar();
    const r = await regiao();
    await waitFor(() => cartao(r));
    await within(r).findByRole('button', { name: /de fora/ });
    const ids = Array.from(r.querySelectorAll('[id]')).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const botao of within(r).getAllByRole('button')) {
      const alvo = botao.getAttribute('aria-controls');
      if (alvo) expect(document.querySelectorAll(`#${alvo}`)).toHaveLength(1);
    }
  });
});

describe('A tela continua só de leitura', () => {
  it('abrir, filtrar e abrir as áreas recolhidas não escreve nada no banco', async () => {
    const dados = cenarioDoPrint();
    dados.historia_vida_paciente = [{ id: 'h-ruim', paciente_id: 'pac-1', data_evento: '0001-01-01', tipo: 'outro', titulo: 'Data absurda', descricao: '' }];
    preparar(dados);
    montar();
    const r = await regiao();
    fireEvent.click(await within(r).findByRole('button', { name: /de fora/ }));
    expect(h.falso.escritas()).toEqual([]);
  });
});
