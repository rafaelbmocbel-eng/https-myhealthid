import { describe, it, expect } from 'vitest';
import { compararMarcos, montarLinhaDoTempo, tituloParaExibir } from '@/lib/resumoClinico/marcos';
import { lerHistoricoClinico } from '@/lib/resumoClinico/leitura';
import { FONTES_VAZIAS, MOTIVO_DATA_NAO_VALIDA } from '@/lib/resumoClinico/tipos';
import type { FontesClinicas, LinhaBruta, Marco } from '@/lib/resumoClinico/tipos';

const HOJE = '2026-11-15';

const fontes = (parcial: Partial<FontesClinicas> = {}): FontesClinicas => ({ ...FONTES_VAZIAS, ...parcial });
const montar = (parcial: Partial<FontesClinicas> = {}, hoje = HOJE) => montarLinhaDoTempo(fontes(parcial), hoje);
const myid = (extra: LinhaBruta = {}): LinhaBruta => ({ id: 'm1', status: 'concluido', created_at: '2026-09-01T12:00:00+00:00', updated_at: '2026-10-20T12:00:00+00:00', ...extra });
const vinculo = (extra: LinhaBruta = {}): LinhaBruta => ({ id: 'v1', myid_avaliacao_id: 'm1', created_at: '2026-10-07T15:00:00+00:00', ...extra });
const paciente = (historico_clinico: unknown, historia_atual: unknown = null): Partial<FontesClinicas> => ({ paciente: { historico_clinico, historia_atual } });
const cirurgias = (...items: unknown[]) => ({ cirurgias: { items } });
const todosOsRelatos = (r: ReturnType<typeof montar>) => [...(r.comoComecou?.queixas ?? []), ...(r.comoComecou?.inicio ?? [])];

// O caso que o dono mandou na foto do celular.
const CENARIO_DA_FOTO = (): Partial<FontesClinicas> => ({
  ...paciente(cirurgias({ id: 'c1', tipo: 'Coluna', ano: '2022' }), { queixa: 'Dor na coluna', inicio: 'Mais de 3 anos', fatores: '', impacto: '' }),
  myidConcluidos: [myid()],
  vinculosMyid: [vinculo()],
  myidUltimo: myid({
    respostas_brutas: {
      bloco_1_queixa: 'Dor lombar que irradia', bloco_1_duracao: 'gt1y',
      bloco_1_quando_data: 'Os sintomas permanecem mesmo após cirurgia na coluna realizada em junho de 2022',
      bloco_1_quando_desc: 'Carregando uma caixa pesada',
    },
  }),
  avaliacoesVoz: [{ id: 'a1', created_at: '2026-10-06T12:00:00+00:00', queixa_principal: 'Dor lombar' }],
});

describe('"Como começou": o começo do quadro sai de "Sem data" e vai junto, sem virar data', () => {
  it('o caso da foto: os 4 itens de início NÃO ficam em "Sem data"; ficam em comoComecou com o rótulo exato da pergunta, o texto do cliente e a fonte', () => {
    const r = montar(CENARIO_DA_FOTO());
    expect(r.semData).toEqual([]);
    expect(r.comoComecou?.inicio).toEqual([
      { id: 'historia_atual:inicio', rotulo: 'Há quanto tempo começou (história atual)', texto: 'Mais de 3 anos', fonte: 'historia_atual', origem: 'cliente', revisado: false },
      { id: 'myid:m1:duracao', rotulo: 'Quando começou (faixa escolhida no MyID)', texto: 'Mais de 1 ano', fonte: 'myid', origem: 'cliente', revisado: false },
      {
        id: 'myid:m1:quando', rotulo: 'Quando começou (texto escrito no MyID)', texto: 'Os sintomas permanecem mesmo após cirurgia na coluna realizada em junho de 2022',
        fonte: 'myid', origem: 'cliente', revisado: false,
      },
      { id: 'myid:m1:o_que_fazia', rotulo: 'O que estava fazendo quando notou (MyID)', texto: 'Carregando uma caixa pesada', fonte: 'myid', origem: 'cliente', revisado: false },
    ]);
  });

  it('as queixas do cliente (história atual e MyID) vêm juntas, cada uma com a sua fonte', () => {
    const r = montar(CENARIO_DA_FOTO());
    expect(r.comoComecou?.queixas).toEqual([
      { id: 'historia_atual:queixa', rotulo: 'Queixa principal (história atual)', texto: 'Dor na coluna', fonte: 'historia_atual', origem: 'cliente', revisado: false },
      { id: 'myid:m1:queixa', rotulo: 'Queixa principal (MyID)', texto: 'Dor lombar que irradia', fonte: 'myid', origem: 'cliente', revisado: false },
    ]);
  });

  it('a divergência (3 anos na história atual, 1 ano na faixa do MyID) fica à vista: as duas aparecem, nada é somado, comparado ou escolhido', () => {
    const textos = montar(CENARIO_DA_FOTO()).comoComecou?.inicio.map((i) => i.texto) ?? [];
    expect(textos).toContain('Mais de 3 anos');
    expect(textos).toContain('Mais de 1 ano');
    expect(textos).toHaveLength(4);
  });

  it('nenhuma resposta vira data: o texto "junho de 2022" não cria marco, e só os marcos reais da foto existem', () => {
    const r = montar(CENARIO_DA_FOTO());
    expect(r.marcos.map((m) => [m.titulo, m.data.iso])).toEqual([
      ['MyID concluído', '2026-10-07'],
      ['Avaliação presencial registrada', '2026-10-06'],
      ['Coluna', '2022'],
    ]);
  });

  it('todas as respostas continuam do cliente e não revisadas', () => {
    const relatos = todosOsRelatos(montar(CENARIO_DA_FOTO()));
    expect(relatos).toHaveLength(6);
    for (const rel of relatos) expect([rel.origem, rel.revisado], rel.id).toEqual(['cliente', false]);
  });

  it('o texto passa como o cliente escreveu: só sem espaços nas pontas; quebras de linha e número ficam', () => {
    const r = montar({
      ...paciente(null, { queixa: '  Dor\nnas costas  ', inicio: 3 }),
      myidUltimo: myid({ respostas_brutas: { bloco_1_quando_data: '  Faz   tempo  ', bloco_1_quando_desc: 'linha 1\nlinha 2' } }),
    });
    expect(todosOsRelatos(r).map((x) => x.texto)).toEqual(['Dor\nnas costas', '3', 'Faz   tempo', 'linha 1\nlinha 2']);
  });

  it('mesma queixa dita nos dois lugares aparece duas vezes (nada é juntado nem deduplicado)', () => {
    const r = montar({ ...paciente(null, { queixa: 'Dor no joelho' }), myidUltimo: myid({ respostas_brutas: { bloco_1_queixa: 'Dor no joelho' } }) });
    expect(r.comoComecou?.queixas.map((q) => [q.fonte, q.texto])).toEqual([['historia_atual', 'Dor no joelho'], ['myid', 'Dor no joelho']]);
  });

  it('só a queixa, sem resposta de início, também gera o cartão; resposta vazia ou só de espaços não gera item', () => {
    const r = montar(paciente(null, { queixa: 'Dor no ombro', inicio: '   ', fatores: 'x' }));
    expect(r.comoComecou?.queixas).toHaveLength(1);
    expect(r.comoComecou?.inicio).toEqual([]);
  });

  it('sem nada (ou só lixo): comoComecou é nulo e "Sem data" fica vazio', () => {
    expect(montar().comoComecou).toBeNull();
    expect(montar(paciente(null, { queixa: '', inicio: '' })).comoComecou).toBeNull();
    const lixo = montar({ paciente: { historico_clinico: 'x', historia_atual: 42 }, myidUltimo: { status: 'concluido', respostas_brutas: 'lixo' } });
    expect(lixo.comoComecou).toBeNull();
    expect(lixo.semData).toEqual([]);
  });

  it('MyID que não está concluído não entra; sobra só a história atual', () => {
    const r = montar({ ...paciente(null, { inicio: 'Há 2 meses' }), myidUltimo: myid({ status: 'em_andamento', respostas_brutas: { bloco_1_queixa: 'x', bloco_1_quando_data: 'y' } }) });
    expect(todosOsRelatos(r).map((x) => x.fonte)).toEqual(['historia_atual']);
    expect(r.comoComecou?.diaDoMyid).toBeNull();
  });

  it('a faixa do MyID com código desconhecido não aparece (nada de código cru)', () => {
    const r = montar({ myidUltimo: myid({ respostas_brutas: { bloco_1_duracao: 'gt9y', bloco_1_queixa: 'dor' } }) });
    expect(r.comoComecou?.inicio).toEqual([]);
  });
});

describe('"Como começou": o dia do MyID de onde vieram as respostas', () => {
  const comMyid = (extra: Partial<FontesClinicas> = {}) => montar({
    myidConcluidos: [myid()], myidUltimo: myid({ respostas_brutas: { bloco_1_quando_data: 'Há 5 anos' } }), vinculosMyid: [vinculo()], ...extra,
  });

  it('com o vínculo, é o dia da conclusão registrada no histórico (dia do Brasil), a mesma data do marco "MyID concluído"', () => {
    const r = comMyid();
    expect(r.comoComecou?.diaDoMyid).toEqual({ iso: '2026-10-07', precisao: 'dia' });
    expect(r.marcos.find((m) => m.id === 'myid:m1')?.data).toEqual(r.comoComecou?.diaDoMyid);
  });

  it('o dia é o do Brasil: 01:00 UTC de 08/10 ainda é 07/10 em São Paulo', () => {
    expect(comMyid({ vinculosMyid: [vinculo({ created_at: '2026-10-08T01:00:00+00:00' })] }).comoComecou?.diaDoMyid?.iso).toBe('2026-10-07');
  });

  it('sem o vínculo não há data confiável: fica nulo, mesmo com updated_at e created_at válidos (nunca updated_at)', () => {
    const r = comMyid({ vinculosMyid: [] });
    expect(r.comoComecou?.diaDoMyid).toBeNull();
    // O marco "último registro" usa o updated_at com aviso; o cartão não.
    expect(r.marcos.find((m) => m.id === 'myid:m1')?.data.iso).toBe('2026-10-20');
  });

  it('vínculo de outro MyID não vale', () => {
    expect(comMyid({ vinculosMyid: [vinculo({ myid_avaliacao_id: 'outro' })] }).comoComecou?.diaDoMyid).toBeNull();
  });

  it.each([[null], [undefined], [''], ['ontem'], ['2099-01-01T10:00:00+00:00'], [12345]])('vínculo com created_at %j não é data: nulo', (ruim) => {
    expect(comMyid({ vinculosMyid: [vinculo({ created_at: ruim })] }).comoComecou?.diaDoMyid).toBeNull();
  });

  it('o dia é o do MyID mais recente (o das respostas), não o de outro MyID concluído', () => {
    const r = montar({
      myidConcluidos: [myid({ id: 'm1' }), myid({ id: 'm2' })],
      myidUltimo: myid({ id: 'm2', respostas_brutas: { bloco_1_quando_data: 'x' } }),
      vinculosMyid: [vinculo({ myid_avaliacao_id: 'm1', created_at: '2026-03-01T12:00:00+00:00' }), vinculo({ id: 'v2', myid_avaliacao_id: 'm2', created_at: '2026-08-01T12:00:00+00:00' })],
    });
    expect(r.comoComecou?.diaDoMyid?.iso).toBe('2026-08-01');
  });

  it('só respostas da história atual (sem MyID): não há dia, mesmo havendo vínculos', () => {
    const r = montar({ ...paciente(null, { inicio: 'Há 2 anos' }), vinculosMyid: [vinculo()], myidConcluidos: [myid()] });
    expect(r.comoComecou?.diaDoMyid).toBeNull();
  });

  it('MyID sem nenhuma resposta de texto: o dia não é carregado sozinho', () => {
    const r = montar({ ...paciente(null, { inicio: 'Há 2 anos' }), myidUltimo: myid({ respostas_brutas: {} }), vinculosMyid: [vinculo()] });
    expect(r.comoComecou?.diaDoMyid).toBeNull();
  });
});

describe('tituloParaExibir: a cirurgia do cliente ganha o rótulo fixo, sem reescrever o texto dele', () => {
  const cirurgiaDoCliente = (tipo: string) => {
    const r = montar(paciente(cirurgias({ id: 'c', tipo, ano: '2022' })));
    return r.marcos[0];
  };
  const cirurgiaSemData = (tipo: string) => montar(paciente(cirurgias({ id: 'c', tipo, ano: 'há 2 anos' }))).semData[0];

  it('o caso da foto: "Coluna" vira "Cirurgia ou internação: Coluna", e marco.titulo continua "Coluna"', () => {
    const marco = cirurgiaDoCliente('Coluna');
    expect(tituloParaExibir(marco)).toBe('Cirurgia ou internação: Coluna');
    expect(marco.titulo).toBe('Coluna');
  });

  it('o item de "Sem data" da cirurgia também ganha o rótulo, e o titulo dele não muda', () => {
    const item = cirurgiaSemData('Coluna');
    expect(tituloParaExibir(item)).toBe('Cirurgia ou internação: Coluna');
    expect(item.titulo).toBe('Coluna');
  });

  it.each([
    ['Cirurgia no joelho'], ['cirurgia no joelho'], ['CIRURGIA DE COLUNA'], ['Cirurgias de coluna'], ['Cirurgia'],
    ['Internação por pneumonia'], ['internacao por pneumonia'], ['INTERNAÇÃO'], ['Internações no ano'], ['Cirurgia: apêndice'],
  ])('o texto "%s" já começa com o rótulo: não repete', (tipo) => {
    expect(tituloParaExibir(cirurgiaDoCliente(tipo))).toBe(tipo);
    expect(tituloParaExibir(cirurgiaSemData(tipo))).toBe(tipo);
  });

  it.each([['Apêndice'], ['Cirurgião ortopédico cortou o tendão'], ['Pré-cirurgia'], ['Minha cirurgia no ombro'], ['Cirurgiaa'], ['Internacional']])('o texto "%s" não começa com o rótulo: ganha o rótulo', (tipo) => {
    expect(tituloParaExibir(cirurgiaDoCliente(tipo))).toBe(`Cirurgia ou internação: ${tipo}`);
  });

  it('o texto do cliente nunca é reescrito: caixa, espaços internos e pontuação ficam como estão', () => {
    expect(tituloParaExibir(cirurgiaDoCliente('lca  (joelho) -- 2x'))).toBe('Cirurgia ou internação: lca  (joelho) -- 2x');
  });

  it('o resto não muda: cirurgia do profissional, diagnóstico, MyID, avaliação e outros itens de "Sem data" mostram o próprio título', () => {
    const r = montar({
      historiaVida: [{ id: 'h', data_evento: '2020-01-01', tipo: 'cirurgia', titulo: 'Menisco', descricao: '' }],
      diagnosticos: [
        { id: 'd1', data_diagnostico: '2019-03-04', cid_codigo: 'M54.5', cid_descricao: 'Lombalgia', created_at: '2026-01-01T12:00:00+00:00', ativo: true, tipo: 'principal' },
        { id: 'd2', data_diagnostico: null, cid_codigo: '', cid_descricao: 'Sem data', created_at: '2026-01-01T12:00:00+00:00', ativo: true, tipo: 'principal' },
      ],
      myidConcluidos: [myid()], vinculosMyid: [vinculo()],
      avaliacoesVoz: [{ id: 'a', created_at: '2026-10-05T12:00:00+00:00' }],
    });
    for (const item of [...r.marcos, ...r.semData]) expect(tituloParaExibir(item), item.id).toBe(item.titulo);
    expect(r.marcos.find((m) => m.id === 'historia_vida:h')?.tipo).toBe('cirurgia');
  });

  it('só a cirurgia que o cliente relatou: sem o tipo, ou de outra origem, o título não é mexido', () => {
    expect(tituloParaExibir({ titulo: 'Coluna', fonte: 'historico_clinico', origem: 'cliente' })).toBe('Coluna');
    expect(tituloParaExibir({ titulo: 'Coluna', fonte: 'historico_clinico', origem: 'cliente', tipo: 'historico' })).toBe('Coluna');
    expect(tituloParaExibir({ titulo: 'Coluna', fonte: 'historico_clinico', origem: 'profissional', tipo: 'cirurgia' })).toBe('Coluna');
    expect(tituloParaExibir({ titulo: 'Coluna', fonte: 'historia_vida', origem: 'cliente', tipo: 'cirurgia' })).toBe('Coluna');
  });

  it('o marco de envio do histórico (que também é do cliente e do histórico clínico) não ganha o rótulo da cirurgia', () => {
    const r = montar(paciente({ ultimo_envio: '2026-10-02T12:00:00+00:00' }));
    expect(tituloParaExibir(r.marcos[0])).toBe('Último envio do histórico clínico (pelo cliente)');
  });
});

describe('ordem dos marcos: empate de data desempata pelo id em ordem natural, e id igual é empate (0)', () => {
  const marco = (id: string, iso = '2022'): Marco => ({
    id, data: { iso, precisao: iso.length === 4 ? 'ano' : 'dia' }, titulo: id, tipo: 'evento_de_vida', rotuloTipo: 'x', fonte: 'historia_vida', origem: 'profissional', revisado: true, natureza: 'fato',
  });

  it('id igual devolve 0 (nunca 1)', () => {
    expect(compararMarcos(marco('historia_vida:a'), marco('historia_vida:a'))).toBe(0);
    const m = marco('historia_vida:a');
    expect(compararMarcos(m, m)).toBe(0);
  });

  it('é antissimétrico: trocar os lados troca o sinal', () => {
    for (const [a, b] of [['x:2', 'x:10'], ['x:a', 'x:b'], ['x:1', 'x:01'], ['a', 'a:1']]) {
      expect(Math.sign(compararMarcos(marco(a), marco(b))), `${a} x ${b}`).toBe(-Math.sign(compararMarcos(marco(b), marco(a))));
      expect(compararMarcos(marco(a), marco(b)), `${a} x ${b}`).not.toBe(0);
    }
  });

  it('números dentro do id valem pelo valor: 2 antes de 10, e não "10" antes de "2"', () => {
    expect(compararMarcos(marco('historico_clinico:cirurgia:2'), marco('historico_clinico:cirurgia:10'))).toBeLessThan(0);
    expect(compararMarcos(marco('historico_clinico:cirurgia:10'), marco('historico_clinico:cirurgia:2'))).toBeGreaterThan(0);
    expect(compararMarcos(marco('a9b'), marco('a10b'))).toBeLessThan(0);
  });

  it('ids longos de números (uuid) comparam sem perder precisão', () => {
    const a = `x:${'1'.repeat(30)}1`;
    const b = `x:${'1'.repeat(30)}2`;
    expect(compararMarcos(marco(a), marco(b))).toBeLessThan(0);
    expect(compararMarcos(marco(b), marco(a))).toBeGreaterThan(0);
  });

  it('a data manda primeiro: mais recente antes, qualquer que seja o id', () => {
    expect(compararMarcos(marco('z', '2025-01-01'), marco('a', '2024-01-01'))).toBeLessThan(0);
    expect(compararMarcos(marco('a', '2022'), marco('z', '2022-05-03'))).toBeGreaterThan(0);
  });

  it('na linha do tempo: cirurgias do mesmo ano, sem id gravado, saem na ordem das posições (2 antes de 10), sempre igual', () => {
    const itens = Array.from({ length: 12 }, (_, i) => ({ tipo: `Cirurgia ${i}`, ano: '2020' }));
    const ids = montar(paciente(cirurgias(...itens))).marcos.map((m) => m.id);
    expect(ids).toEqual(Array.from({ length: 12 }, (_, i) => `historico_clinico:cirurgia:${i}`));
    const invertido = montar(paciente(cirurgias(...itens))).marcos.map((m) => m.id);
    expect(invertido).toEqual(ids);
  });

  it('linhas com o mesmo id e a mesma data não trocam de lugar entre montagens (empate estável)', () => {
    const linhas = [
      { id: 'dup', data_evento: '2020-01-01', tipo: 'outro', titulo: 'Primeira' },
      { id: 'dup', data_evento: '2020-01-01', tipo: 'outro', titulo: 'Segunda' },
    ];
    expect(montar({ historiaVida: linhas }).marcos.map((m) => m.titulo)).toEqual(['Primeira', 'Segunda']);
  });
});

describe('registros ignorados: o aviso diz quais foram e por quê', () => {
  const todos = (): Partial<FontesClinicas> => ({
    myidConcluidos: [myid({ id: 'mx', updated_at: null })],
    avaliacoesVoz: [{ id: 'a1', created_at: null }],
    historiaVida: [{ id: 'h1', data_evento: '0000-00-00', tipo: 'cirurgia', titulo: 'Menisco do joelho' }, { id: 'h2', data_evento: null, tipo: 'fratura', titulo: '' }],
    examesPresenciais: [{ id: 'e1', tipo: 'bioimpedancia', data_exame: '0001-01-01' }],
    testesFuncionais: [{ id: 't1', tipo_teste: 'sentar_levantar_30s', data_teste: '' }],
    escalas: [{ id: 's1', tipo_escala: 'phq9', data_aplicacao: '2099-01-01' }],
  });

  it('cada registro de fora traz a fonte, um rótulo curto para reconhecer e o motivo; o contador continua igual ao tamanho da lista', () => {
    const r = montar(todos());
    expect(r.ignorados).toBe(7);
    expect(r.registrosIgnorados).toHaveLength(r.ignorados);
    expect(r.registrosIgnorados.map((x) => [x.fonte, x.rotulo])).toEqual([
      ['myid', 'MyID'],
      ['avaliacao_voz', 'Avaliação presencial'],
      ['historia_vida', 'Menisco do joelho'],
      ['historia_vida', 'Fratura'],
      ['exame_presencial', 'Bioimpedância'],
      ['teste_funcional', 'Sentar levantar 30s'],
      ['escala', 'PHQ-9 (Depressão)'],
    ]);
    for (const x of r.registrosIgnorados) expect(x.motivo).toBe('data ausente, inválida ou no futuro');
    expect(MOTIVO_DATA_NAO_VALIDA).toBe('data ausente, inválida ou no futuro');
  });

  it('o id do registro ignorado é o mesmo que o marco teria (fonte + id da linha)', () => {
    expect(montar(todos()).registrosIgnorados.map((x) => x.id)).toEqual([
      'myid:mx', 'avaliacao_voz:a1', 'historia_vida:h1', 'historia_vida:h2', 'exame_presencial:e1', 'teste_funcional:t1', 'escala:s1',
    ]);
  });

  it('sem registro de fora, a lista é vazia e o contador é 0', () => {
    const r = montar({ historiaVida: [{ id: 'h', data_evento: '2020-01-01', tipo: 'outro', titulo: 'ok' }] });
    expect([r.ignorados, r.registrosIgnorados]).toEqual([0, []]);
  });

  it('diagnóstico e exame importado sem data (que vão para "Sem data") e o relato do portal não entram na lista de ignorados', () => {
    const r = montar({
      diagnosticos: [{ id: 'd', data_diagnostico: null, cid_descricao: 'Lombalgia', created_at: '2026-02-03T15:00:00+00:00', ativo: true, tipo: 'principal' }],
      examesImportados: [{ id: 'i', tipo: 'laboratorial', data_exame: null, created_at: '2026-07-02T12:00:00+00:00', status: 'processado' }],
      avaliacoesVoz: [{ id: 'p', created_at: null, resultado: { _meta: { origem: 'portal_paciente_historia' } } }],
    });
    expect(r.semData).toHaveLength(2);
    expect(r.registrosIgnorados).toEqual([]);
    expect(r.ignorados).toBe(0);
  });

  it('o registro com data de verdade não entra na lista', () => {
    const r = montar({ historiaVida: [{ id: 'bom', data_evento: '2020-01-01', tipo: 'outro', titulo: 'ok' }, { id: 'ruim', data_evento: '2099-01-01', tipo: 'outro', titulo: 'futuro' }] });
    expect(r.registrosIgnorados.map((x) => x.id)).toEqual(['historia_vida:ruim']);
    expect(r.marcos.map((m) => m.id)).toEqual(['historia_vida:bom']);
  });
});

describe('chave estável da cirurgia do cliente: o id que o formulário grava, com a posição só de reserva', () => {
  const ids = (historico: unknown) => {
    const r = montar(paciente(historico));
    return [...r.marcos, ...r.semData].map((m) => m.id).sort();
  };

  it('com id gravado, a chave usa o id do item e não a posição (marco e item sem data)', () => {
    expect(ids(cirurgias({ id: 'k3j9x2ab', tipo: 'Joelho', ano: '2022' }, { id: 'p0o9i8u7', tipo: 'Ombro', ano: 'faz tempo' }))).toEqual([
      'historico_clinico:cirurgia:id:k3j9x2ab', 'historico_clinico:cirurgia:id:p0o9i8u7',
    ]);
  });

  it('apagar uma cirurgia mais acima na lista não muda a chave das outras', () => {
    const a = { id: 'aaa', tipo: 'Joelho', ano: '2022' };
    const b = { id: 'bbb', tipo: 'Ombro', ano: '2021' };
    const c = { id: 'ccc', tipo: 'Coluna', ano: 'faz tempo' };
    expect(ids(cirurgias(a, b, c))).toEqual(expect.arrayContaining(['historico_clinico:cirurgia:id:bbb', 'historico_clinico:cirurgia:id:ccc']));
    expect(ids(cirurgias(b, c))).toEqual(['historico_clinico:cirurgia:id:bbb', 'historico_clinico:cirurgia:id:ccc']);
  });

  it('item antigo, sem id (ou com id vazio ou que não é texto), cai na posição no array', () => {
    expect(ids(cirurgias({ tipo: 'A', ano: '2020' }, { id: '', tipo: 'B', ano: '2021' }, { id: { x: 1 }, tipo: 'C', ano: '2022' }, { id: '   ', tipo: 'D', ano: 'faz tempo' }))).toEqual([
      'historico_clinico:cirurgia:0', 'historico_clinico:cirurgia:1', 'historico_clinico:cirurgia:2', 'historico_clinico:cirurgia:3',
    ]);
  });

  it('a posição de reserva conta itens-lixo do meio, como antes', () => {
    expect(ids(cirurgias(null, { id: 'zz', tipo: 'Com id', ano: '2020' }, 'lixo', { tipo: 'Sem id', ano: '2021' }))).toEqual([
      'historico_clinico:cirurgia:3', 'historico_clinico:cirurgia:id:zz',
    ]);
  });

  it('id só de números não colide com a posição de outro item (o id leva o prefixo "id:")', () => {
    const lista = ids(cirurgias({ id: '1', tipo: 'Com id numérico', ano: '2020' }, { tipo: 'Sem id, posição 1', ano: '2021' }));
    expect(lista).toEqual(['historico_clinico:cirurgia:1', 'historico_clinico:cirurgia:id:1']);
  });

  it('id em número também vale (vira texto)', () => {
    expect(ids(cirurgias({ id: 77, tipo: 'Joelho', ano: '2020' }))).toEqual(['historico_clinico:cirurgia:id:77']);
  });

  it('id repetido não gera chave repetida: o segundo cai na posição', () => {
    const lista = ids(cirurgias({ id: 'igual', tipo: 'A', ano: '2020' }, { id: 'igual', tipo: 'B', ano: '2021' }));
    expect(lista).toEqual(['historico_clinico:cirurgia:1', 'historico_clinico:cirurgia:id:igual']);
    expect(new Set(lista).size).toBe(2);
  });

  it('a chave é a mesma entre duas montagens', () => {
    const h = cirurgias({ id: 'a', tipo: 'A', ano: '2020' }, { tipo: 'B', ano: 'x' });
    expect(ids(h)).toEqual(ids(h));
  });

  it('a leitura devolve o id de cada cirurgia (vazio quando o item não tem)', () => {
    const lidas = lerHistoricoClinico(cirurgias({ id: ' abc ', tipo: 'A', ano: '2020' }, { tipo: 'B', ano: '2021' })).cirurgias;
    expect(lidas.map((c) => [c.id, c.indice])).toEqual([['abc', 0], ['', 1]]);
  });
});
