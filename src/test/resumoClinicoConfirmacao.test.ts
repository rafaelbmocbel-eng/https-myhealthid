import { describe, it, expect } from 'vitest';
import { agruparPorAno, montarLinhaDoTempo } from '@/lib/resumoClinico/marcos';
import { chaveDaConfirmacao, montarLinhaDaConfirmacao } from '@/lib/resumoClinico/confirmacao';
import { formatarData } from '@/lib/resumoClinico/datas';
import { FONTES_VAZIAS, MOTIVO_DATA_NAO_VALIDA } from '@/lib/resumoClinico/tipos';
import type { FontesClinicas, LinhaBruta, Marco, PrecisaoDaData, RelatoDaCirurgia } from '@/lib/resumoClinico/tipos';

// O profissional confirma a data real de uma cirurgia que o cliente relatou. A confirmação é UMA linha de
// historia_vida_paciente com a marca no metadata; aqui a linha do tempo lê essa linha como ela chega do banco (com os
// apelidos de useFontesClinicas) e decide o que sai da lista, o que continua e o que aparece como confirmado.

const HOJE = '2026-11-15';
const T = '11111111-1111-4111-8111-111111111111';
const P = '22222222-2222-4222-8222-222222222222';

const fontes = (parcial: Partial<FontesClinicas> = {}): FontesClinicas => ({ ...FONTES_VAZIAS, ...parcial });
const comItens = (...items: unknown[]): Partial<FontesClinicas> => ({ paciente: { historico_clinico: { cirurgias: { items } }, historia_atual: null } });
const montar = (parcial: Partial<FontesClinicas> = {}) => montarLinhaDoTempo(fontes(parcial), HOJE);

const chaveDoId = (id: string) => `historico_clinico:cirurgia:id:${id}`;
const chaveDaPosicao = (indice: number, tipo: string, ano: unknown, complicacoes = '') =>
  chaveDaConfirmacao({ indice, tipo, anoOriginal: ano, complicacoes }, `historico_clinico:cirurgia:${indice}`);

interface Gravada {
  chave: string;
  relato: RelatoDaCirurgia;
  precisao?: PrecisaoDaData;
  texto?: string;
  tipo?: string;
}

// A linha como o banco devolve: o que montarLinhaDaConfirmacao grava, lido pelos apelidos confirmacao_* da leitura.
function gravada(g: Gravada, extra: LinhaBruta = {}): LinhaBruta {
  const precisao = g.precisao ?? 'dia';
  const r = montarLinhaDaConfirmacao({
    terapeutaId: T, pacienteId: P, chave: g.chave, relato: g.relato, tipo: g.tipo ?? 'cirurgia', precisao,
    texto: g.texto ?? (precisao === 'ano' ? '2022' : '2022-06-10'), profissional: { nome: 'Ana', sobrenome: 'Souza', crefito: '12345-F' },
  }, HOJE);
  if (!r.ok) throw new Error(`devia montar: ${r.erro}`);
  const { linha } = r;
  return {
    id: linha.id, data_evento: linha.data_evento, tipo: linha.tipo, titulo: linha.titulo, descricao: linha.descricao, created_at: '2026-10-01T15:00:00+00:00',
    confirmacao_origem: linha.metadata.origem, confirmacao_versao: String(linha.metadata.versao), confirmacao_chave: linha.metadata.chave_cliente,
    confirmacao_precisao: linha.metadata.precisao, confirmacao_relato: linha.metadata.relato_cliente, confirmacao_por: linha.metadata.confirmado_por, ...extra,
  };
}

const LCA = { tipo: 'Ligamento do joelho (LCA)', ano: '2022', complicacoes: 'dor ao agachar' };
const relatoDe = (c: { tipo: string; ano: unknown; complicacoes: string }): RelatoDaCirurgia => ({
  tipo: c.tipo.trim(), ano: typeof c.ano === 'string' ? c.ano.trim() : String(c.ano ?? ''), complicacoes: c.complicacoes.trim(),
});
const idsDosMarcos = (r: { marcos: Marco[] }) => r.marcos.map((m) => m.id);
const confirmado = (r: { marcos: Marco[] }) => r.marcos.find((m) => m.fonte === 'historia_vida' && m.confirmacao);

describe('o relato do cliente igual ao confirmado sai da lista e fica só o marco confirmado', () => {
  const linha = gravada({ chave: chaveDoId('k1'), relato: relatoDe(LCA) });

  it('item com ano válido: o marco do cliente some e o confirmado traz a data real, o título como gravado e o selo do profissional', () => {
    const r = montar({ ...comItens({ id: 'k1', ...LCA }), historiaVida: [linha] });
    expect(r.marcos).toHaveLength(1);
    expect(r.marcos[0]).toMatchObject({
      id: `historia_vida:${linha.id}`, data: { iso: '2022-06-10', precisao: 'dia' }, titulo: 'Ligamento do joelho (LCA)', tipo: 'cirurgia',
      rotuloTipo: 'Cirurgia', fonte: 'historia_vida', natureza: 'fato', origem: 'profissional', revisado: true,
      confirmacao: {
        idDaLinha: linha.id, chave: chaveDoId('k1'), relatoOriginal: relatoDe(LCA), situacao: 'igual',
        confirmadoEm: { iso: '2026-10-01', precisao: 'dia' }, por: 'Ana Souza · 12345-F',
      },
    });
    expect(r.marcos[0].detalhe).toBeUndefined();
    expect(r.marcos[0].cirurgiaDoCliente).toBeUndefined();
    expect(r.marcos[0].confirmacaoExistente).toBeUndefined();
    expect(idsDosMarcos(r)).not.toContain(chaveDoId('k1'));
    expect(r.semData).toEqual([]);
    expect(r.ignorados).toBe(0);
  });

  it.each([
    ['03/2019'], ['há 2 anos'], ['2O22'], ['dois mil'], ['2099'], ['1899'], ['20'], [''], [null], [undefined], [{ ano: 2022 }],
  ])('item de "Sem data" (ano %j): o item some de lá e o marco confirmado aparece na linha do tempo', (ano) => {
    const cliente = { id: 'k1', tipo: 'Cirurgia no ombro', ano, complicacoes: 'infecção' };
    const gravou = gravada({ chave: chaveDoId('k1'), relato: relatoDe({ tipo: 'Cirurgia no ombro', ano: typeof ano === 'string' ? ano : '', complicacoes: 'infecção' }) });
    const antes = montar(comItens(cliente));
    expect(antes.semData).toHaveLength(1);
    expect(antes.marcos).toEqual([]);
    const r = montar({ ...comItens(cliente), historiaVida: [gravou] });
    expect(r.semData).toEqual([]);
    expect(r.marcos.map((m) => m.id)).toEqual([`historia_vida:${gravou.id}`]);
    expect(r.marcos[0].confirmacao?.situacao).toBe('igual');
  });

  it('o texto guardado vale para comparar, aparado e com o número como texto: espaços e ano em número não fazem o relato "mudar"', () => {
    const r = montar({
      ...comItens({ id: 'k1', tipo: '  Joelho  ', ano: 2022, complicacoes: '  dor  ' }),
      historiaVida: [gravada({ chave: chaveDoId('k1'), relato: { tipo: 'Joelho', ano: '2022', complicacoes: 'dor' } })],
    });
    expect(r.marcos.map((m) => m.origem)).toEqual(['profissional']);
    expect(r.marcos[0].confirmacao?.situacao).toBe('igual');
  });

  it('só some o item da chave confirmada: os outros relatos do cliente continuam, cada um com o seu botão', () => {
    const outra = { id: 'k2', tipo: 'Apêndice', ano: '2010', complicacoes: '' };
    const sem = { id: 'k3', tipo: 'Ombro', ano: 'faz tempo', complicacoes: '' };
    const r = montar({ ...comItens({ id: 'k1', ...LCA }, outra, sem), historiaVida: [linha] });
    expect(idsDosMarcos(r).sort()).toEqual([chaveDoId('k2'), `historia_vida:${linha.id}`].sort());
    expect(r.semData.map((i) => i.id)).toEqual([chaveDoId('k3')]);
    expect(r.marcos.find((m) => m.id === chaveDoId('k2'))?.cirurgiaDoCliente?.chave).toBe(chaveDoId('k2'));
    expect(r.semData[0].cirurgiaDoCliente?.chave).toBe(chaveDoId('k3'));
  });

  it('duas confirmações, de duas cirurgias: cada uma troca o seu relato', () => {
    const a = gravada({ chave: chaveDoId('k1'), relato: relatoDe(LCA), texto: '2022-06-10' });
    const b = gravada({ chave: chaveDoId('k2'), relato: { tipo: 'Apêndice', ano: '2010', complicacoes: '' }, texto: '2010-03-04' });
    const r = montar({ ...comItens({ id: 'k1', ...LCA }, { id: 'k2', tipo: 'Apêndice', ano: '2010', complicacoes: '' }), historiaVida: [a, b] });
    expect(idsDosMarcos(r)).toEqual([`historia_vida:${a.id}`, `historia_vida:${b.id}`]);
    expect(r.marcos.every((m) => m.origem === 'profissional' && m.confirmacao?.situacao === 'igual')).toBe(true);
    expect(r.semData).toEqual([]);
  });

  it('todo marco da lista tem id diferente (o confirmado não repete o id de ninguém)', () => {
    const r = montar({ ...comItens({ id: 'k1', ...LCA }, { id: 'k2', ...LCA }), historiaVida: [linha, { id: 'm1', data_evento: '2020-02-02', tipo: 'outro', titulo: 'x' }] });
    expect(new Set(idsDosMarcos(r)).size).toBe(r.marcos.length);
  });
});

describe('o selo de cada lado nunca se inverte', () => {
  it('confirmado: profissional e revisado. Relato do cliente que continua (texto mudado): cliente e não revisado', () => {
    const linha = gravada({ chave: chaveDoId('k1'), relato: relatoDe(LCA) });
    const r = montar({ ...comItens({ id: 'k1', ...LCA, ano: '2023' }), historiaVida: [linha] });
    const doCliente = r.marcos.find((m) => m.fonte === 'historico_clinico');
    expect(doCliente).toMatchObject({ origem: 'cliente', revisado: false });
    expect(confirmado(r)).toMatchObject({ origem: 'profissional', revisado: true });
  });
});

describe('só ano: a data mostra só o ano e a frase "Data aproximada" não se repete no detalhe', () => {
  const chave = chaveDoId('k1');
  const relato = relatoDe(LCA);

  it('precisão "ano" no metadata: o marco tem só o ano e é escrito como "2022", nunca "01/01/2022"', () => {
    const linha = gravada({ chave, relato, precisao: 'ano', texto: '2022' });
    expect(linha.data_evento).toBe('2022-01-01');
    const m = confirmado(montar({ ...comItens({ id: 'k1', ...LCA }), historiaVida: [linha] }));
    expect(m?.data).toEqual({ iso: '2022', precisao: 'ano' });
    expect(formatarData(m!.data)).toBe('2022');
    expect(m?.detalhe).toBeUndefined();
  });

  it('precisão "ano" com a data_evento trazendo o dia: corta para o ano (a tela não mostra mais do que a precisão diz)', () => {
    const linha = gravada({ chave, relato, precisao: 'ano', texto: '2022' }, { data_evento: '2022-06-10' });
    expect(confirmado(montar({ historiaVida: [linha] }))?.data).toEqual({ iso: '2022', precisao: 'ano' });
  });

  it('a frase só é omitida quando é exatamente a do ano do marco; outro texto na descrição aparece', () => {
    const outraFrase = gravada({ chave, relato, precisao: 'ano' }, { descricao: 'Data aproximada: só o ano (2021).' });
    expect(confirmado(montar({ historiaVida: [outraFrase] }))?.detalhe).toBe('Data aproximada: só o ano (2021).');
    const comTexto = gravada({ chave, relato, precisao: 'ano' }, { descricao: 'Reconstrução do ligamento' });
    expect(confirmado(montar({ historiaVida: [comTexto] }))?.detalhe).toBe('Reconstrução do ligamento');
    const comEspacos = gravada({ chave, relato, precisao: 'ano' }, { descricao: '  Data aproximada: só o ano (2022).  ' });
    expect(confirmado(montar({ historiaVida: [comEspacos] }))?.detalhe).toBeUndefined();
  });

  it('precisão "dia": a descrição é mostrada como está e a data é o dia', () => {
    const linha = gravada({ chave, relato, precisao: 'dia', texto: '2022-06-10' }, { descricao: 'Data aproximada: só o ano (2022).' });
    const m = confirmado(montar({ historiaVida: [linha] }));
    expect(m?.data).toEqual({ iso: '2022-06-10', precisao: 'dia' });
    expect(formatarData(m!.data)).toBe('10/06/2022');
    expect(m?.detalhe).toBe('Data aproximada: só o ano (2022).');
  });

  it('só a metadata decide a precisão: 2022-01-01 com precisão "dia", ou com precisão que não é "ano", é o 1º de janeiro de verdade', () => {
    for (const precisao of ['dia', 'Ano', 'ANO', '', null, undefined, 5]) {
      const linha = gravada({ chave, relato, precisao: 'ano' }, { confirmacao_precisao: precisao });
      const m = confirmado(montar({ historiaVida: [linha] }));
      expect(m?.data, String(precisao)).toEqual({ iso: '2022-01-01', precisao: 'dia' });
      expect(formatarData(m!.data)).toBe('01/01/2022');
    }
  });

  it('a precisão sem a marca de confirmação não vale: linha comum fica no dia, mesmo com "ano" no apelido', () => {
    const comum = { id: 'h1', data_evento: '2022-01-01', tipo: 'cirurgia', titulo: 'Menisco', confirmacao_precisao: 'ano' };
    expect(montar({ historiaVida: [comum] }).marcos[0].data).toEqual({ iso: '2022-01-01', precisao: 'dia' });
    const outraOrigem = { ...comum, confirmacao_origem: 'outra_coisa' };
    expect(montar({ historiaVida: [outraOrigem] }).marcos[0].data).toEqual({ iso: '2022-01-01', precisao: 'dia' });
  });
});

describe('o cliente mudou o relato depois da confirmação: os dois aparecem, o confirmado avisa e o relato novo não ganha botão', () => {
  const linha = gravada({ chave: chaveDoId('k1'), relato: relatoDe(LCA) });

  it.each([
    ['o ano', { ano: '2023' }],
    ['as complicações', { complicacoes: 'infecção' }],
    ['as complicações apagadas', { complicacoes: '' }],
    ['o tipo', { tipo: 'Ligamento do ombro' }],
    ['só a caixa do texto', { tipo: 'ligamento do joelho (lca)' }],
    ['o ano passa a não valer', { ano: 'há 2 anos' }],
    ['o ano some', { ano: '' }],
  ])('mudou %s', (_nome, mudanca) => {
    const r = montar({ ...comItens({ id: 'k1', ...LCA, ...mudanca }), historiaVida: [linha] });
    const doCliente = [...r.marcos.filter((m) => m.fonte === 'historico_clinico'), ...r.semData];
    expect(doCliente).toHaveLength(1);
    expect(doCliente[0]).toMatchObject({ origem: 'cliente', revisado: false, confirmacaoExistente: true });
    expect(doCliente[0].cirurgiaDoCliente?.chave).toBe(chaveDoId('k1'));
    const c = confirmado(r);
    expect(c?.confirmacao?.situacao).toBe('alterado');
    expect(c?.confirmacao?.relatoOriginal).toEqual(relatoDe(LCA));
    expect(c).toMatchObject({ origem: 'profissional', revisado: true });
  });

  it('o relato de hoje continua no lugar de onde veio (marco com ano, ou "Sem data")', () => {
    const noAno = montar({ ...comItens({ id: 'k1', ...LCA, ano: '2023' }), historiaVida: [linha] });
    expect(noAno.marcos.find((m) => m.id === chaveDoId('k1'))?.data).toEqual({ iso: '2023', precisao: 'ano' });
    expect(noAno.semData).toEqual([]);
    const semAno = montar({ ...comItens({ id: 'k1', ...LCA, ano: 'há 2 anos' }), historiaVida: [linha] });
    expect(semAno.semData.map((i) => i.id)).toEqual([chaveDoId('k1')]);
    expect(semAno.semData[0].detalhe).toContain('Ano que o cliente escreveu: "há 2 anos"');
  });

  it('voltar o texto ao que era (o cliente desfez a mudança): o relato some de novo e a confirmação volta a "igual"', () => {
    const r = montar({ ...comItens({ id: 'k1', ...LCA }), historiaVida: [linha] });
    expect(confirmado(r)?.confirmacao?.situacao).toBe('igual');
    expect(r.marcos).toHaveLength(1);
  });

  it('o relato do cliente de outro item, mudado, não mexe na confirmação do primeiro', () => {
    const r = montar({ ...comItens({ id: 'k1', ...LCA }, { id: 'k2', tipo: 'Apêndice', ano: '2010', complicacoes: '' }), historiaVida: [linha] });
    expect(confirmado(r)?.confirmacao?.situacao).toBe('igual');
    expect(r.marcos.find((m) => m.id === chaveDoId('k2'))?.confirmacaoExistente).toBeUndefined();
  });
});

describe('o cliente apagou o item depois da confirmação: só fica o confirmado, marcado como "apagado"', () => {
  const linha = gravada({ chave: chaveDoId('k1'), relato: relatoDe(LCA) });

  it('sem nenhum item do cliente com a chave', () => {
    for (const parcial of [comItens(), comItens({ id: 'k9', tipo: 'Apêndice', ano: '2010' }), { paciente: null }, { paciente: { historico_clinico: null } }]) {
      const r = montar({ ...parcial, historiaVida: [linha] });
      expect(confirmado(r)?.confirmacao?.situacao).toBe('apagado');
      expect(confirmado(r)?.confirmacao?.relatoOriginal).toEqual(relatoDe(LCA));
    }
  });

  it('os outros relatos do cliente continuam com o botão (nenhum ganha confirmacaoExistente)', () => {
    const r = montar({ ...comItens({ id: 'k9', tipo: 'Apêndice', ano: '2010', complicacoes: '' }), historiaVida: [linha] });
    const outro = r.marcos.find((m) => m.id === chaveDoId('k9'));
    expect(outro?.cirurgiaDoCliente).toBeDefined();
    expect(outro?.confirmacaoExistente).toBeUndefined();
  });
});

describe('duas linhas com a mesma chave: vale a mais antiga, a outra aparece como marco comum do profissional', () => {
  const chave = chaveDoId('k1');
  const relato = relatoDe(LCA);
  const antiga = gravada({ chave, relato, texto: '2022-06-10' }, { id: 'bbbbbbbb-0000-4000-8000-000000000001', created_at: '2026-10-01T15:00:00+00:00' });
  const nova = gravada({ chave, relato, texto: '2022-07-20' }, { id: 'aaaaaaaa-0000-4000-8000-000000000002', created_at: '2026-10-05T15:00:00+00:00' });

  it.each([['antiga primeiro', 0], ['nova primeiro', 1]])('%s na lista: a antiga é a confirmação, qualquer que seja a ordem de leitura', (_nome, inverter) => {
    const lista = inverter ? [nova, antiga] : [antiga, nova];
    const r = montar({ ...comItens({ id: 'k1', ...LCA }), historiaVida: lista });
    const c = confirmado(r);
    expect(c?.id).toBe(`historia_vida:${antiga.id}`);
    expect(c?.data.iso).toBe('2022-06-10');
    const outra = r.marcos.find((m) => m.id === `historia_vida:${nova.id}`);
    expect(outra).toMatchObject({ origem: 'profissional', revisado: true, data: { iso: '2022-07-20', precisao: 'dia' }, titulo: 'Ligamento do joelho (LCA)' });
    expect(outra?.confirmacao).toBeUndefined();
    expect(r.marcos.filter((m) => m.fonte === 'historico_clinico')).toEqual([]);
    expect(r.marcos).toHaveLength(2);
  });

  it('empate em created_at: o id menor vale', () => {
    const a: LinhaBruta = { ...antiga, created_at: '2026-10-01T15:00:00+00:00' };
    const b: LinhaBruta = { ...nova, created_at: '2026-10-01T15:00:00+00:00' };
    expect(confirmado(montar({ historiaVida: [a, b] }))?.id).toBe(`historia_vida:${b.id}`);
    expect(confirmado(montar({ historiaVida: [b, a] }))?.id).toBe(`historia_vida:${b.id}`);
  });

  it('a mesma hora escrita com fusos diferentes é o mesmo instante (empate), e não vale o texto da data', () => {
    const a: LinhaBruta = { ...antiga, created_at: '2026-10-01T15:00:00+00:00' };
    const b: LinhaBruta = { ...nova, created_at: '2026-10-01T12:00:00-03:00' };
    expect(confirmado(montar({ historiaVida: [a, b] }))?.id).toBe(`historia_vida:${b.id}`);
  });

  it('created_at que não dá para ler conta como o mais novo: a linha com data legível vale', () => {
    const semHora = { ...antiga, created_at: 'ontem' };
    expect(confirmado(montar({ historiaVida: [semHora, nova] }))?.id).toBe(`historia_vida:${nova.id}`);
    expect(confirmado(montar({ historiaVida: [nova, semHora] }))?.id).toBe(`historia_vida:${nova.id}`);
    const semCampo = { ...antiga, created_at: undefined };
    expect(confirmado(montar({ historiaVida: [semCampo, nova] }))?.id).toBe(`historia_vida:${nova.id}`);
  });

  it('a mais antiga com data inválida não vale: a outra, com data boa, é a confirmação, e a inválida vai para "de fora"', () => {
    const invalida = { ...antiga, data_evento: '2022-02-31' };
    const r = montar({ ...comItens({ id: 'k1', ...LCA }), historiaVida: [invalida, nova] });
    expect(confirmado(r)?.id).toBe(`historia_vida:${nova.id}`);
    expect(r.registrosIgnorados.map((x) => x.id)).toEqual([`historia_vida:${antiga.id}`]);
    expect(r.marcos.filter((m) => m.fonte === 'historico_clinico')).toEqual([]);
  });

  it('a chave de outro item não é duplicata: cada uma vale para o seu item', () => {
    const b = gravada({ chave: chaveDoId('k2'), relato: { tipo: 'Apêndice', ano: '2010', complicacoes: '' }, texto: '2010-03-04' });
    const r = montar({ ...comItens({ id: 'k1', ...LCA }, { id: 'k2', tipo: 'Apêndice', ano: '2010', complicacoes: '' }), historiaVida: [antiga, b] });
    expect(r.marcos.filter((m) => m.confirmacao)).toHaveLength(2);
  });
});

describe('confirmação com data inválida: vai para "registros de fora" e o relato do cliente CONTINUA', () => {
  const relato = relatoDe(LCA);

  it.each([
    ['no futuro', '2027-01-01'], ['dia que não existe', '2022-02-31'], ['antes de 1900', '1899-12-31'], ['zerada', '0001-01-01'],
    ['texto', 'abc'], ['vazia', ''], ['nula', null], ['ausente', undefined], ['número', 20220610], ['só o ano', '2022'],
  ])('data_evento %s: o relato continua na lista, com o botão, e a linha fica de fora', (_nome, data) => {
    for (const precisao of ['dia', 'ano'] as const) {
      const linha = gravada({ chave: chaveDoId('k1'), relato, precisao }, { data_evento: data });
      const r = montar({ ...comItens({ id: 'k1', ...LCA }), historiaVida: [linha] });
      expect(r.registrosIgnorados, precisao).toEqual([{ id: `historia_vida:${linha.id}`, fonte: 'historia_vida', rotulo: 'Ligamento do joelho (LCA)', motivo: MOTIVO_DATA_NAO_VALIDA }]);
      expect(r.ignorados).toBe(1);
      expect(idsDosMarcos(r)).toEqual([chaveDoId('k1')]);
      expect(r.marcos[0].cirurgiaDoCliente?.chave).toBe(chaveDoId('k1'));
      expect(r.marcos[0].confirmacaoExistente).toBeUndefined();
      expect(r.marcos[0]).toMatchObject({ origem: 'cliente', revisado: false });
    }
  });

  it('o mesmo no item de "Sem data": o item continua lá, com o botão', () => {
    const cliente = { id: 'k1', tipo: 'Ombro', ano: 'faz tempo', complicacoes: '' };
    const linha = gravada({ chave: chaveDoId('k1'), relato: relatoDe(cliente) }, { data_evento: '2027-01-01' });
    const r = montar({ ...comItens(cliente), historiaVida: [linha] });
    expect(r.semData.map((i) => i.id)).toEqual([chaveDoId('k1')]);
    expect(r.semData[0].cirurgiaDoCliente?.chave).toBe(chaveDoId('k1'));
    expect(r.semData[0].confirmacaoExistente).toBeUndefined();
    expect(r.ignorados).toBe(1);
    expect(r.marcos).toEqual([]);
  });

  it('data válida de novo (depois de corrigida), o relato volta a sair da lista', () => {
    const linha = gravada({ chave: chaveDoId('k1'), relato }, { data_evento: '2022-06-10' });
    const r = montar({ ...comItens({ id: 'k1', ...LCA }), historiaVida: [linha] });
    expect(r.ignorados).toBe(0);
    expect(idsDosMarcos(r)).toEqual([`historia_vida:${linha.id}`]);
  });
});

describe('item do cliente sem id: a chave leva a posição E o texto, então apagar um item acima não esconde o relato errado', () => {
  const A = { tipo: 'Apêndice', ano: '2010', complicacoes: '' };
  const B = { tipo: 'Ombro', ano: 'faz tempo', complicacoes: '' };
  const C = { tipo: 'Joelho', ano: '2022', complicacoes: 'dor' };
  const chaveDeB = chaveDaPosicao(1, B.tipo, B.ano);
  const confirmacaoDeB = gravada({ chave: chaveDeB, relato: relatoDe(B) }, { data_evento: '2019-05-06' });

  const doCliente = (r: ReturnType<typeof montar>) => [...r.marcos.filter((m) => m.fonte === 'historico_clinico'), ...r.semData];

  it('o botão: cada item sem id traz a chave "pos:<posição>:<16 letras do texto>"', () => {
    const r = montar(comItens(A, B, C));
    const chaves = doCliente(r).map((i) => i.cirurgiaDoCliente?.chave);
    expect(chaves).toHaveLength(3);
    for (const chave of chaves) expect(chave).toMatch(/^historico_clinico:cirurgia:pos:[0-2]:[0-9a-f]{16}$/);
    expect(new Set(chaves).size).toBe(3);
    expect(r.semData[0].cirurgiaDoCliente?.chave).toBe(chaveDeB);
  });

  it('o id do marco do relato continua o de antes (por posição), a chave da confirmação é outra coisa', () => {
    const r = montar(comItens(A, B, C));
    expect(r.semData[0].id).toBe('historico_clinico:cirurgia:1');
    expect(r.marcos.map((m) => m.id).sort()).toEqual(['historico_clinico:cirurgia:0', 'historico_clinico:cirurgia:2']);
  });

  it('sem mudar nada: o relato confirmado some e os outros dois continuam', () => {
    const r = montar({ ...comItens(A, B, C), historiaVida: [confirmacaoDeB] });
    expect(r.semData).toEqual([]);
    expect(r.marcos.map((m) => m.id).sort()).toEqual(['historia_vida:' + confirmacaoDeB.id, 'historico_clinico:cirurgia:0', 'historico_clinico:cirurgia:2'].sort());
    expect(confirmado(r)?.confirmacao?.situacao).toBe('igual');
  });

  it('APAGAR O ITEM ACIMA: o item que desceu uma posição continua visível e com o botão; o da posição seguinte NÃO é escondido', () => {
    const r = montar({ ...comItens(B, C), historiaVida: [confirmacaoDeB] });
    const itens = doCliente(r);
    expect(itens).toHaveLength(2);
    for (const item of itens) {
      expect(item.cirurgiaDoCliente).toBeDefined();
      expect(item.confirmacaoExistente).toBeUndefined();
      expect(item.cirurgiaDoCliente?.chave).not.toBe(chaveDeB);
    }
    expect(itens.map((i) => i.titulo).sort()).toEqual(['Joelho', 'Ombro']);
    expect(confirmado(r)?.confirmacao?.situacao).toBe('apagado');
  });

  it('APAGAR O ITEM ACIMA, com um terceiro item que passa a ocupar a posição da confirmação: nenhuma confirmação esconde outra cirurgia', () => {
    const r = montar({ ...comItens(A, C), historiaVida: [confirmacaoDeB] });
    const itens = doCliente(r);
    expect(itens.map((i) => i.titulo).sort()).toEqual(['Apêndice', 'Joelho']);
    expect(itens.every((i) => i.cirurgiaDoCliente && !i.confirmacaoExistente)).toBe(true);
    expect(confirmado(r)?.confirmacao?.situacao).toBe('apagado');
  });

  it('o cliente edita o texto do item: a confirmação antiga vira "apagado" e o relato novo aparece com botão', () => {
    const r = montar({ ...comItens(A, { ...B, complicacoes: 'dor ao levantar o braço' }, C), historiaVida: [confirmacaoDeB] });
    const editado = doCliente(r).find((i) => i.titulo === 'Ombro');
    expect(editado?.cirurgiaDoCliente).toBeDefined();
    expect(editado?.confirmacaoExistente).toBeUndefined();
    expect(confirmado(r)?.confirmacao?.situacao).toBe('apagado');
  });

  it('nunca "alterado" para item sem id: a chave já carrega o texto', () => {
    for (const lista of [[A, { ...B, ano: '2019' }, C], [A, { ...B, tipo: 'Ombro direito' }, C], [A, { ...B, complicacoes: 'x' }, C]]) {
      const situacao = confirmado(montar({ ...comItens(...lista), historiaVida: [confirmacaoDeB] }))?.confirmacao?.situacao;
      expect(situacao).toBe('apagado');
    }
  });

  it('dois itens com o mesmo texto, em posições diferentes: confirmar um não esconde o outro', () => {
    const igual = { tipo: 'Joelho', ano: 'faz tempo', complicacoes: '' };
    const primeira = gravada({ chave: chaveDaPosicao(0, igual.tipo, igual.ano), relato: relatoDe(igual) }, { data_evento: '2015-01-02' });
    const r = montar({ ...comItens(igual, igual), historiaVida: [primeira] });
    expect(r.semData.map((i) => i.id)).toEqual(['historico_clinico:cirurgia:1']);
    expect(r.semData[0].cirurgiaDoCliente).toBeDefined();
    expect(confirmado(r)?.confirmacao?.situacao).toBe('igual');
  });

  it('item sem id e item com id convivem: a confirmação do com id não esconde o sem id', () => {
    const comId = gravada({ chave: chaveDoId('k1'), relato: relatoDe(C) });
    const r = montar({ ...comItens({ id: 'k1', ...C }, A), historiaVida: [comId] });
    expect(r.marcos.map((m) => m.id).sort()).toEqual(['historia_vida:' + comId.id, 'historico_clinico:cirurgia:1'].sort());
  });
});

describe('id repetido no histórico do cliente: o segundo cai na chave por posição', () => {
  const X = { tipo: 'Joelho', ano: '2022', complicacoes: '' };
  const Y = { tipo: 'Ombro', ano: '2020', complicacoes: '' };

  it('confirmar o primeiro esconde só o primeiro', () => {
    const linha = gravada({ chave: chaveDoId('k1'), relato: relatoDe(X) });
    const r = montar({ ...comItens({ id: 'k1', ...X }, { id: 'k1', ...Y }), historiaVida: [linha] });
    const restante = r.marcos.filter((m) => m.fonte === 'historico_clinico');
    expect(restante.map((m) => m.titulo)).toEqual(['Ombro']);
    expect(restante[0].cirurgiaDoCliente?.chave).toBe(chaveDaPosicao(1, Y.tipo, Y.ano));
  });

  it('confirmar o segundo (chave por posição) esconde só o segundo', () => {
    const linha = gravada({ chave: chaveDaPosicao(1, Y.tipo, Y.ano), relato: relatoDe(Y) });
    const r = montar({ ...comItens({ id: 'k1', ...X }, { id: 'k1', ...Y }), historiaVida: [linha] });
    const restante = r.marcos.filter((m) => m.fonte === 'historico_clinico');
    expect(restante.map((m) => m.titulo)).toEqual(['Joelho']);
    expect(restante[0].cirurgiaDoCliente?.chave).toBe(chaveDoId('k1'));
  });
});

describe('quem tem o botão: só o relato estruturado de cirurgia do cliente com chave que cabe no banco', () => {
  it('o marco e o item de "Sem data" levam a chave e o texto aparado como o cliente escreveu', () => {
    const r = montar(comItens(
      { id: 'a1', tipo: '  Joelho ', ano: 2019, complicacoes: ' dor ' },
      { id: 'a2', tipo: 'Ombro', ano: ' 2O22 ', complicacoes: '' },
      { id: 'a3', tipo: 'Quadril', ano: null, complicacoes: '' },
    ));
    expect(r.marcos[0].cirurgiaDoCliente).toEqual({ chave: chaveDoId('a1'), tipo: 'Joelho', ano: '2019', complicacoes: 'dor' });
    expect(r.semData.map((i) => i.cirurgiaDoCliente)).toEqual([
      { chave: chaveDoId('a2'), tipo: 'Ombro', ano: '2O22', complicacoes: '' },
      { chave: chaveDoId('a3'), tipo: 'Quadril', ano: '', complicacoes: '' },
    ]);
  });

  it('nenhum outro marco ganha o botão: envio do histórico, MyID, história de vida, avaliação, diagnóstico, exame', () => {
    const r = montar({
      paciente: { historico_clinico: { ultimo_envio: '2026-08-01', cirurgias: { items: [{ id: 'k1', tipo: 'Joelho', ano: '2022' }] } }, historia_atual: null },
      myidConcluidos: [{ id: 'm1', status: 'concluido', created_at: '2026-09-01T12:00:00+00:00', updated_at: '2026-09-02T12:00:00+00:00' }],
      avaliacoesVoz: [{ id: 'v1', created_at: '2026-10-06T12:00:00+00:00' }],
      historiaVida: [{ id: 'h1', data_evento: '2020-02-02', tipo: 'cirurgia', titulo: 'Menisco' }],
      diagnosticos: [{ id: 'd1', ativo: true, tipo: 'principal', cid_codigo: 'M54.5', data_diagnostico: '2026-10-07', created_at: '2026-12-01T00:00:00+00:00' }],
      examesPresenciais: [{ id: 'e1', tipo: 'outro', data_exame: '2026-09-09' }],
    });
    const comBotao = r.marcos.filter((m) => m.cirurgiaDoCliente).map((m) => m.id);
    expect(comBotao).toEqual([chaveDoId('k1')]);
    expect(r.marcos.length).toBeGreaterThan(4);
    expect(r.marcos.filter((m) => m.confirmacao || m.confirmacaoExistente)).toEqual([]);
  });

  it('chave de até 200 caracteres vale; com 201 o item não ganha o botão (nem no marco nem em "Sem data")', () => {
    const idNoLimite = 'x'.repeat(200 - chaveDoId('').length);
    expect(chaveDoId(idNoLimite)).toHaveLength(200);
    const r = montar(comItens(
      { id: idNoLimite, tipo: 'Joelho', ano: '2022' },
      { id: `${idNoLimite}y`, tipo: 'Ombro', ano: '2021' },
      { id: idNoLimite.slice(1), tipo: 'Quadril', ano: 'faz tempo' },
      { id: `${idNoLimite}z`, tipo: 'Punho', ano: 'faz tempo' },
    ));
    expect(r.marcos.map((m) => [m.titulo, m.cirurgiaDoCliente !== undefined]).sort()).toEqual([['Joelho', true], ['Ombro', false]]);
    expect(r.semData.map((i) => [i.titulo, i.cirurgiaDoCliente !== undefined]).sort()).toEqual([['Punho', false], ['Quadril', true]]);
  });

  it('id com caractere de controle: o item continua na linha do tempo, sem botão', () => {
    const r = montar(comItens({ id: 'a\nb', tipo: 'Joelho', ano: '2022' }, { id: 'c\u0000d', tipo: 'Ombro', ano: 'faz tempo' }));
    expect(r.marcos).toHaveLength(1);
    expect(r.marcos[0].cirurgiaDoCliente).toBeUndefined();
    expect(r.semData).toHaveLength(1);
    expect(r.semData[0].cirurgiaDoCliente).toBeUndefined();
  });

  it('o marco que o profissional confirmou não leva a chave do cliente para confirmar de novo', () => {
    const linha = gravada({ chave: chaveDoId('k1'), relato: relatoDe(LCA) });
    const m = confirmado(montar({ ...comItens({ id: 'k1', ...LCA }), historiaVida: [linha] }));
    expect(m?.cirurgiaDoCliente).toBeUndefined();
  });
});

describe('confirmação que não dá para entender é uma linha comum do profissional e o relato do cliente nunca some por causa dela', () => {
  const relato = relatoDe(LCA);
  const cliente = { id: 'k1', ...LCA };

  it.each([
    ['versão 2', { confirmacao_versao: '2' }],
    ['sem versão', { confirmacao_versao: undefined }],
    ['origem de outro tipo', { confirmacao_origem: 'outra_coisa' }],
    ['sem origem', { confirmacao_origem: undefined }],
    ['chave que não é texto', { confirmacao_chave: 5 }],
    ['chave longa demais', { confirmacao_chave: 'a'.repeat(201) }],
    ['relato que não é objeto', { confirmacao_relato: 'x' }],
    ['relato sem o texto do tipo', { confirmacao_relato: { tipo: '', ano: '2022', complicacoes: '' } }],
    ['relato com ano que não é texto', { confirmacao_relato: { tipo: 'Joelho', ano: 2022, complicacoes: '' } }],
  ])('%s', (_nome, estragos) => {
    const linha = gravada({ chave: chaveDoId('k1'), relato }, estragos);
    const r = montar({ ...comItens(cliente), historiaVida: [linha] });
    const comum = r.marcos.find((m) => m.id === `historia_vida:${linha.id}`);
    expect(comum).toMatchObject({ origem: 'profissional', revisado: true, data: { iso: '2022-06-10', precisao: 'dia' } });
    expect(comum?.confirmacao).toBeUndefined();
    const doCliente = r.marcos.find((m) => m.id === chaveDoId('k1'));
    expect(doCliente).toMatchObject({ origem: 'cliente', revisado: false });
    expect(doCliente?.confirmacaoExistente).toBeUndefined();
    expect(doCliente?.cirurgiaDoCliente).toBeDefined();
  });

  it('a linha comum sem a marca, ilegível, também não lê a precisão "ano": o dia é o dia', () => {
    const linha = gravada({ chave: chaveDoId('k1'), relato, precisao: 'ano' }, { confirmacao_versao: '2' });
    expect(montar({ historiaVida: [linha] }).marcos[0].data).toEqual({ iso: '2022-01-01', precisao: 'dia' });
  });
});

describe('linha de história de vida SEM a marca continua exatamente como era antes', () => {
  const comum = { id: 'h1', data_evento: '2022-03-10', tipo: 'cirurgia', titulo: 'Ligamento do joelho (LCA)', descricao: 'Reconstrução' };

  it('mesmo marco de antes, campo por campo, sem nenhum campo da confirmação', () => {
    const { marcos } = montar({ historiaVida: [comum] });
    expect(marcos).toEqual([{
      id: 'historia_vida:h1', data: { iso: '2022-03-10', precisao: 'dia' }, titulo: 'Ligamento do joelho (LCA)', detalhe: 'Reconstrução',
      tipo: 'cirurgia', rotuloTipo: 'Cirurgia', fonte: 'historia_vida', natureza: 'fato', origem: 'profissional', revisado: true,
    }]);
    for (const campo of ['confirmacao', 'confirmacaoExistente', 'cirurgiaDoCliente']) expect(campo in marcos[0], campo).toBe(false);
  });

  it('o relato do cliente do mesmo fato continua em DOIS marcos, sem marca (a duplicidade é de propósito)', () => {
    const r = montar({ ...comItens({ tipo: 'Ligamento do joelho (LCA)', ano: '2022' }), historiaVida: [comum] });
    expect(r.marcos.map((m) => [m.fonte, m.origem])).toEqual([['historia_vida', 'profissional'], ['historico_clinico', 'cliente']]);
    expect(r.marcos.find((m) => m.fonte === 'historico_clinico')?.confirmacaoExistente).toBeUndefined();
  });

  it('a mesma linha COM a marca e o mesmo texto troca o relato por um só marco; com o texto diferente, mostra os dois', () => {
    const gravou = gravada({ chave: chaveDoId('k1'), relato: relatoDe(LCA) }, { id: 'h1' });
    const igual = montar({ ...comItens({ id: 'k1', ...LCA }), historiaVida: [gravou] });
    expect(igual.marcos).toHaveLength(1);
    const diferente = montar({ ...comItens({ id: 'k1', ...LCA, complicacoes: 'outra' }), historiaVida: [gravou] });
    expect(diferente.marcos.map((m) => m.fonte).sort()).toEqual(['historia_vida', 'historico_clinico']);
  });

  it('história de vida do tipo internação, com a marca, continua sendo um evento de vida com o rótulo "Internação"', () => {
    const gravou = gravada({ chave: chaveDoId('k1'), relato: relatoDe(LCA), tipo: 'internacao' });
    const m = confirmado(montar({ ...comItens({ id: 'k1', ...LCA }), historiaVida: [gravou] }));
    expect(m).toMatchObject({ tipo: 'evento_de_vida', rotuloTipo: 'Internação', origem: 'profissional', revisado: true });
    expect(m?.confirmacao?.situacao).toBe('igual');
  });
});

describe('confirmado em: o dia do Brasil em que a linha foi gravada', () => {
  const linha = (extra: LinhaBruta) => gravada({ chave: chaveDoId('k1'), relato: relatoDe(LCA) }, extra);

  it('instante com fuso vira o dia no Brasil, não o dia em UTC', () => {
    const m = confirmado(montar({ historiaVida: [linha({ created_at: '2026-10-01T02:00:00+00:00' })] }));
    expect(m?.confirmacao?.confirmadoEm).toEqual({ iso: '2026-09-30', precisao: 'dia' });
    const mais = confirmado(montar({ historiaVida: [linha({ created_at: '2026-10-01T03:00:00+00:00' })] }));
    expect(mais?.confirmacao?.confirmadoEm).toEqual({ iso: '2026-10-01', precisao: 'dia' });
  });

  it.each([['ilegível', 'ontem'], ['ausente', undefined], ['nulo', null], ['no futuro', '2027-01-01T12:00:00+00:00'], ['número', 5]])(
    'created_at %s: o marco aparece do mesmo jeito e a data da confirmação fica nula (nada é inventado)', (_nome, valor) => {
      const m = confirmado(montar({ historiaVida: [linha({ created_at: valor })] }));
      expect(m?.confirmacao?.confirmadoEm).toBeNull();
      expect(m?.confirmacao?.situacao).toBe('apagado');
      expect(m?.data.iso).toBe('2022-06-10');
    },
  );

  it('quem confirmou vem do metadata: nome e registro, só um deles ou nenhum', () => {
    expect(confirmado(montar({ historiaVida: [linha({})] }))?.confirmacao?.por).toBe('Ana Souza · 12345-F');
    expect(confirmado(montar({ historiaVida: [linha({ confirmacao_por: { nome: 'Bia', registro: null } })] }))?.confirmacao?.por).toBe('Bia');
    expect(confirmado(montar({ historiaVida: [linha({ confirmacao_por: null })] }))?.confirmacao?.por).toBeNull();
  });
});

describe('ordem e agrupamento: o confirmado só com o ano fica no mesmo lugar do relato que ele trocou', () => {
  const dia = { id: 'h-dia', data_evento: '2022-06-10', tipo: 'outro', titulo: 'Entorse' };
  const fim = { id: 'h-fim', data_evento: '2021-12-31', tipo: 'outro', titulo: 'Fratura' };
  const cliente = { id: 'k1', ...LCA };

  it('2022-06-10, depois 2022 (só o ano), depois 2021-12-31', () => {
    const linha = gravada({ chave: chaveDoId('k1'), relato: relatoDe(LCA), precisao: 'ano', texto: '2022' });
    const r = montar({ ...comItens(cliente), historiaVida: [fim, linha, dia] });
    expect(r.marcos.map((m) => m.data.iso)).toEqual(['2022-06-10', '2022', '2021-12-31']);
    expect(r.marcos[1].id).toBe(`historia_vida:${linha.id}`);
    expect(r.porAno.map((g) => [g.ano, g.marcos.length])).toEqual([['2022', 2], ['2021', 1]]);
  });

  it('o confirmado fica na posição exata em que estava o relato do cliente com o mesmo ano', () => {
    const linha = gravada({ chave: chaveDoId('k1'), relato: relatoDe(LCA), precisao: 'ano', texto: '2022' });
    const antes = montar({ ...comItens(cliente), historiaVida: [fim, dia] });
    const depois = montar({ ...comItens(cliente), historiaVida: [fim, dia, linha] });
    expect(antes.marcos.findIndex((m) => m.id === chaveDoId('k1'))).toBe(1);
    expect(depois.marcos.findIndex((m) => m.id === `historia_vida:${linha.id}`)).toBe(1);
    expect(depois.marcos).toHaveLength(antes.marcos.length);
  });

  it('confirmado com o dia entra pela data do dia, e agruparPorAno junta pelo ano da data', () => {
    const linha = gravada({ chave: chaveDoId('k1'), relato: relatoDe(LCA), precisao: 'dia', texto: '2021-03-04' });
    const r = montar({ ...comItens(cliente), historiaVida: [dia, linha] });
    expect(r.marcos.map((m) => m.data.iso)).toEqual(['2022-06-10', '2021-03-04']);
    expect(agruparPorAno(r.marcos).map((g) => g.ano)).toEqual(['2022', '2021']);
  });
});
