import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { agruparPorAno, montarLinhaDoTempo } from '@/lib/resumoClinico/marcos';
import { FAIXA_DE_DURACAO_DO_MYID, MUDANCAS_DO_MYID } from '@/lib/resumoClinico/leitura';
import {
  CAMPO_ORIGEM_DO_RELATO, DETALHE_DATA_LIDA_DO_DOCUMENTO, DETALHE_MYID_CONCLUIDO, DETALHE_MYID_ULTIMO_REGISTRO, FONTES_VAZIAS,
  SELO_CLIENTE, SELO_PROFISSIONAL, TITULO_MYID_CONCLUIDO, TITULO_MYID_ULTIMO_REGISTRO,
} from '@/lib/resumoClinico/tipos';
import type { FontesClinicas, LinhaBruta, Marco } from '@/lib/resumoClinico/tipos';

const HOJE = '2026-11-15';

const fontes = (parcial: Partial<FontesClinicas> = {}): FontesClinicas => ({ ...FONTES_VAZIAS, ...parcial });
const comHistorico = (historico_clinico: unknown, historia_atual: unknown = null): Partial<FontesClinicas> => ({ paciente: { historico_clinico, historia_atual } });
const cirurgias = (...items: unknown[]) => ({ cirurgias: { items } });
const montar = (parcial: Partial<FontesClinicas> = {}, hoje = HOJE) => montarLinhaDoTempo(fontes(parcial), hoje);
const myid = (extra: LinhaBruta = {}): LinhaBruta => ({ id: 'm1', status: 'concluido', created_at: '2026-09-01T12:00:00+00:00', updated_at: '2026-09-02T12:00:00+00:00', ...extra });

describe('cirurgias do histórico clínico (ano que o cliente digitou)', () => {
  it('ano válido vira marco só com o ano: origem cliente, não revisado, natureza fato, texto como o cliente escreveu', () => {
    const { marcos, semData } = montar(comHistorico(cirurgias({ id: 'x', tipo: '  Ligamento do joelho (LCA)  ', ano: ' 2022 ', complicacoes: 'dor ao agachar' })));
    expect(semData).toEqual([]);
    expect(marcos).toHaveLength(1);
    expect(marcos[0]).toMatchObject({
      id: 'historico_clinico:cirurgia:id:x', data: { iso: '2022', precisao: 'ano' }, titulo: 'Ligamento do joelho (LCA)',
      detalhe: 'Complicações: dor ao agachar', tipo: 'cirurgia', fonte: 'historico_clinico', origem: 'cliente', revisado: false, natureza: 'fato',
    });
  });

  it('ano em número também vale', () => {
    expect(montar(comHistorico(cirurgias({ tipo: 'Apêndice', ano: 2019 }))).marcos[0].data).toEqual({ iso: '2019', precisao: 'ano' });
  });

  it.each([
    ['2O22', 'Ano que o cliente escreveu: "2O22"'],
    ['dois mil', 'Ano que o cliente escreveu: "dois mil"'],
    ['há 2 anos', 'Ano que o cliente escreveu: "há 2 anos"'],
    ['20', 'Ano que o cliente escreveu: "20"'],
    ['2099', 'Ano que o cliente escreveu: "2099"'],
    ['1899', 'Ano que o cliente escreveu: "1899"'],
    ['2022-13', 'Ano que o cliente escreveu: "2022-13"'],
    ['2022-05-03', 'Ano que o cliente escreveu: "2022-05-03"'], // data completa no campo do ano: também não
    ['03/05/2022', 'Ano que o cliente escreveu: "03/05/2022"'],
    [20, 'Ano que o cliente escreveu: "20"'],
    ['', 'Ano não informado'],
    ['   ', 'Ano não informado'],
    [null, 'Ano não informado'],
    [undefined, 'Ano não informado'],
    [{ ano: 2022 }, 'Ano não informado'],
    [[2022], 'Ano não informado'],
  ])('ano %j não vira data: vai para "Sem data" e não gera marco', (ano, esperado) => {
    const { marcos, semData } = montar(comHistorico(cirurgias({ id: 'c', tipo: 'Cirurgia no ombro', ano, complicacoes: '' })));
    expect(marcos).toEqual([]);
    expect(semData).toHaveLength(1);
    expect(semData[0]).toMatchObject({ titulo: 'Cirurgia no ombro', fonte: 'historico_clinico', origem: 'cliente', revisado: false });
    expect(semData[0].detalhe).toBe(`Cirurgia ou internação · ${esperado}`);
  });

  it('complicações também aparecem no item sem data', () => {
    const { semData } = montar(comHistorico(cirurgias({ tipo: 'Joelho', ano: 'faz tempo', complicacoes: 'infecção' })));
    expect(semData[0].detalhe).toBe('Cirurgia ou internação · Ano que o cliente escreveu: "faz tempo" · Complicações: infecção');
  });

  it('o ano do limite de cima muda com "hoje"', () => {
    const f = comHistorico(cirurgias({ tipo: 'Joelho', ano: '2026' }));
    expect(montar(f, '2026-11-15').marcos).toHaveLength(1);
    expect(montar(f, '2025-12-31').marcos).toHaveLength(0);
    expect(montar(f, '2025-12-31').semData).toHaveLength(1);
  });

  it('item sem tipo (ou que nem é objeto) é ignorado, mas a posição no array é mantida no id', () => {
    const { marcos } = montar(comHistorico(cirurgias(null, 'texto solto', 42, { tipo: '   ', ano: 2020 }, { tipo: 'Menisco', ano: 2020 })));
    expect(marcos.map((m) => [m.id, m.titulo])).toEqual([['historico_clinico:cirurgia:4', 'Menisco']]);
  });
});

describe('texto livre do cliente nunca vira data', () => {
  it('história atual: "há 3 semanas" vai para o cartão "Como começou" (não para "Sem data"), como o cliente escreveu, e não gera marco com a data da atualização', () => {
    const { marcos, semData, comoComecou } = montar(comHistorico(null, { queixa: 'dor lombar', inicio: 'Há 3 semanas, depois da mudança', fatores: '', impacto: '' }));
    expect(semData).toEqual([]);
    expect(comoComecou?.inicio).toEqual([{
      id: 'historia_atual:inicio', rotulo: 'Há quanto tempo começou (história atual)', texto: 'Há 3 semanas, depois da mudança',
      fonte: 'historia_atual', origem: 'cliente', revisado: false,
    }]);
    expect(marcos).toEqual([]);
  });

  it('história atual: a data de atualização (que o autosave do cliente regrava) NUNCA vira marco, nem válida nem inválida', () => {
    for (const atualizado_em of ['2026-10-07T23:59:18+00:00', '2099-01-01T10:00:00Z', 'ontem', null]) {
      const { marcos, semData } = montar(comHistorico(null, { queixa: 'dor lombar', inicio: '', fatores: '', impacto: '', atualizado_em }));
      expect(marcos, String(atualizado_em)).toEqual([]);
      expect(semData, String(atualizado_em)).toEqual([]);
    }
  });

  it('MyID: faixa com o rótulo humano, texto escrito e "o que fazia" vão para o cartão "Como começou" (fora de "Sem data"); nenhum vira marco', () => {
    const respostas = { bloco_1_queixa: 'Dor no joelho', bloco_1_duracao: 'gt1y', bloco_1_quando_data: 'Há 5 anos', bloco_1_quando_desc: 'Corrida no sábado' };
    const { marcos, semData, comoComecou } = montar({ myidConcluidos: [myid()], myidUltimo: myid({ respostas_brutas: respostas }) });
    expect(marcos.map((m) => m.id)).toEqual(['myid:m1']); // só o registro "MyID concluído", com a data da sessão
    expect(semData).toEqual([]);
    expect(comoComecou?.inicio.map((s) => [s.rotulo, s.texto])).toEqual([
      ['Quando começou (faixa escolhida no MyID)', 'Mais de 1 ano'],
      ['Quando começou (texto escrito no MyID)', 'Há 5 anos'],
      ['O que estava fazendo quando notou (MyID)', 'Corrida no sábado'],
    ]);
    expect(comoComecou?.queixas.map((s) => [s.rotulo, s.texto])).toEqual([['Queixa principal (MyID)', 'Dor no joelho']]);
    expect([...(comoComecou?.queixas ?? []), ...(comoComecou?.inicio ?? [])].every((s) => s.origem === 'cliente' && s.revisado === false && s.fonte === 'myid')).toBe(true);
  });

  it.each(Object.entries(FAIXA_DE_DURACAO_DO_MYID))('faixa %s aparece como "%s"', (codigo, rotulo) => {
    const { comoComecou } = montar({ myidUltimo: myid({ respostas_brutas: { bloco_1_duracao: codigo } }) });
    expect(comoComecou?.inicio.map((s) => s.texto)).toEqual([rotulo]);
  });

  it.each([['gt2y'], ['constructor'], ['__proto__'], [''], [null], [7], [{}]])('faixa desconhecida %j não aparece (nada de código cru)', (codigo) => {
    const r = montar({ myidUltimo: myid({ respostas_brutas: { bloco_1_duracao: codigo } }) });
    expect(r.semData).toEqual([]);
    expect(r.comoComecou).toBeNull();
  });

  it('MyID que não está concluído não entra: nem o registro, nem o "Sem data"', () => {
    const pendente = myid({ status: 'em_andamento' });
    const r = montar({ myidConcluidos: [pendente], myidUltimo: { ...pendente, respostas_brutas: { bloco_1_queixa: 'dor', bloco_1_duracao: 'lt6w', bloco_1_quando_data: 'ontem' } } });
    expect(r.marcos).toEqual([]);
    expect(r.semData).toEqual([]);
    expect(r.comoComecou).toBeNull();
  });

  it('os rótulos das faixas e das mudanças são os da tela do cliente (Bloco1.tsx)', () => {
    const tela = readFileSync(join(__dirname, '..', 'components', 'myid', 'steps', 'Bloco1.tsx'), 'utf8');
    for (const [codigo, rotulo] of Object.entries(FAIXA_DE_DURACAO_DO_MYID)) {
      expect(tela).toContain(`{ v: '${codigo}', l: '${rotulo}' }`);
    }
    const rotuloNaTela = (codigo: string) => tela.match(new RegExp(`id="change-${codigo === 'equipment' ? 'equip' : codigo}"[\\s\\S]{0,400}?<Label[^>]*>([^<]+)</Label>`))?.[1];
    expect(Object.keys(MUDANCAS_DO_MYID).map((c) => MUDANCAS_DO_MYID[c])).toEqual(Object.keys(MUDANCAS_DO_MYID).map((c) => rotuloNaTela(c)));
  });
});

describe('registros do app (marcador vazado) e fatos (marcador cheio)', () => {
  const todas = (): Partial<FontesClinicas> => ({
    paciente: { historico_clinico: { ...cirurgias({ id: 'c1', tipo: 'Joelho', ano: '2022' }), ultimo_envio: '2026-10-02T12:00:00+00:00' }, historia_atual: null },
    myidConcluidos: [myid()],
    vinculosMyid: [{ id: 'v1', myid_avaliacao_id: 'm1', created_at: '2026-09-02T12:00:00+00:00' }],
    avaliacoesVoz: [{ id: 'a1', created_at: '2026-10-05T12:00:00+00:00', queixa_principal: 'Dor lombar' }],
    historiaVida: [{ id: 'h1', data_evento: '2019-03-04', tipo: 'fratura', titulo: 'Fratura de punho', descricao: 'Queda de bicicleta' }],
    diagnosticos: [{ id: 'd1', data_diagnostico: '2024-05-06', cid_codigo: 'M54.5', cid_descricao: 'Dor lombar baixa', created_at: '2026-01-01T12:00:00+00:00', ativo: true, tipo: 'principal' }],
    examesPresenciais: [{ id: 'e1', tipo: 'bioimpedancia', data_exame: '2026-08-01', resumo: 'Peso 70 kg' }],
    examesImportados: [{ id: 'i1', tipo: 'laboratorial', data_exame: '2026-07-01', created_at: '2026-07-02T12:00:00+00:00', status: 'processado' }],
    testesFuncionais: [{ id: 't1', tipo_teste: 'sentar_levantar_30s', resultado: 14, unidade: 'reps', data_teste: '2026-06-01' }],
    escalas: [{ id: 's1', tipo_escala: 'phq9', pontuacao_total: 7, data_aplicacao: '2026-05-01' }],
  });

  it('natureza, origem, revisado e fonte de cada tipo de marco', () => {
    const porId = Object.fromEntries(montar(todas()).marcos.map((m) => [m.id, m]));
    const confere = (id: string, esperado: Partial<Marco>) => expect(porId[id], id).toMatchObject(esperado);
    confere('historico_clinico:cirurgia:id:c1', { natureza: 'fato', origem: 'cliente', revisado: false, fonte: 'historico_clinico' });
    confere('historico_clinico:envio', { natureza: 'registro', origem: 'cliente', revisado: false });
    confere('myid:m1', { natureza: 'registro', origem: 'cliente', revisado: false, fonte: 'myid', titulo: 'MyID concluído', data: { iso: '2026-09-02', precisao: 'dia' } });
    confere('avaliacao_voz:a1', { natureza: 'registro', origem: 'profissional', revisado: true, titulo: 'Avaliação presencial registrada', detalhe: 'Queixa principal: Dor lombar' });
    confere('historia_vida:h1', { natureza: 'fato', origem: 'profissional', revisado: true, titulo: 'Fratura de punho', detalhe: 'Queda de bicicleta', rotuloTipo: 'Fratura', tipo: 'evento_de_vida' });
    confere('diagnostico:d1', { natureza: 'fato', origem: 'profissional', revisado: true, titulo: '[M54.5] Dor lombar baixa', data: { iso: '2024-05-06', precisao: 'dia' } });
    confere('exame_presencial:e1', { natureza: 'registro', origem: 'profissional', revisado: true, titulo: 'Bioimpedância', detalhe: 'Peso 70 kg' });
    confere('exame_importado:i1', { natureza: 'registro', origem: 'profissional', revisado: true, titulo: 'Laboratorial', data: { iso: '2026-07-01', precisao: 'dia' }, detalhe: DETALHE_DATA_LIDA_DO_DOCUMENTO });
    confere('teste_funcional:t1', { natureza: 'registro', origem: 'profissional', revisado: true, titulo: 'Sentar levantar 30s', detalhe: 'Resultado: 14 reps' });
    confere('escala:s1', { natureza: 'registro', origem: 'profissional', revisado: true, titulo: 'PHQ-9 (Depressão)', detalhe: 'Pontuação: 7' });
  });

  it('tudo que veio do cliente é "não revisado" e tudo que o profissional registrou é "revisado" (nunca o contrário)', () => {
    const { marcos, semData, comoComecou } = montar({ ...todas(), myidUltimo: myid({ respostas_brutas: { bloco_1_quando_data: 'ontem' } }) });
    for (const m of marcos) expect(m.revisado, m.id).toBe(m.origem === 'profissional');
    for (const s of semData) expect([s.origem, s.revisado]).toEqual(['cliente', false]);
    expect(comoComecou?.inicio).toHaveLength(1);
    for (const r of [...(comoComecou?.queixas ?? []), ...(comoComecou?.inicio ?? [])]) expect([r.origem, r.revisado]).toEqual(['cliente', false]);
    expect(new Set(marcos.map((m) => m.origem))).toEqual(new Set(['cliente', 'profissional']));
  });

  it('os selos têm o texto combinado', () => {
    expect(SELO_CLIENTE).toBe('Relatado pelo cliente, não revisado');
    expect(SELO_PROFISSIONAL).toBe('Registrado pelo profissional');
  });

  it('diagnóstico sem data_diagnostico NÃO vira marco: vai para "Sem data", com o selo do profissional e o dia em que foi gravado no app', () => {
    const r = montar({ diagnosticos: [{ id: 'd2', data_diagnostico: null, cid_codigo: '', cid_descricao: 'Lombalgia', created_at: '2026-02-03T15:00:00+00:00', ativo: true, tipo: 'principal' }] });
    expect(r.marcos).toEqual([]);
    expect(r.ignorados).toBe(0);
    expect(r.semData).toEqual([{
      id: 'diagnostico:d2', titulo: 'Lombalgia', fonte: 'diagnostico', origem: 'profissional', revisado: true,
      detalhe: 'Diagnóstico · A data do diagnóstico não foi informada · Registrado no app em 03/02/2026',
    }]);
  });

  it('diagnóstico com data_diagnostico no futuro ou inválida também vai para "Sem data", com aviso próprio, e nunca usa created_at como data do fato', () => {
    for (const ruim of ['2099-01-01', '2020-02-30', '0000-00-00', 'ano passado']) {
      const r = montar({ diagnosticos: [{ id: 'd3', data_diagnostico: ruim, cid_codigo: 'X', cid_descricao: 'Y', created_at: '2026-02-03T15:00:00+00:00', ativo: true, tipo: 'secundario' }] });
      expect(r.marcos, ruim).toEqual([]);
      expect(r.semData.map((s) => s.detalhe), ruim).toEqual(['Diagnóstico · A data do diagnóstico registrada não é válida · Registrado no app em 03/02/2026']);
    }
  });

  it('"Registrado no app em" usa o dia do Brasil (01:30 UTC ainda é o dia anterior em São Paulo) e some quando created_at não é uma data', () => {
    const base = { id: 'd4', data_diagnostico: null, cid_descricao: 'Lombalgia', ativo: true, tipo: 'principal' };
    expect(montar({ diagnosticos: [{ ...base, created_at: '2026-02-04T01:30:00+00:00' }] }).semData[0].detalhe).toBe('Diagnóstico · A data do diagnóstico não foi informada · Registrado no app em 03/02/2026');
    for (const ruim of [null, undefined, '', 'ontem', '2099-01-01T10:00:00Z']) {
      expect(montar({ diagnosticos: [{ ...base, created_at: ruim }] }).semData[0].detalhe, String(ruim)).toBe('Diagnóstico · A data do diagnóstico não foi informada');
    }
  });

  it('exame importado sem data_exame NÃO vira marco: vai para "Sem data", com o selo do profissional e o dia em que foi importado', () => {
    const r = montar({ examesImportados: [{ id: 'i2', tipo: null, data_exame: null, created_at: '2026-07-02T12:00:00+00:00', status: 'processado' }] });
    expect(r.marcos).toEqual([]);
    expect(r.ignorados).toBe(0);
    expect(r.semData).toEqual([{
      id: 'exame_importado:i2', titulo: 'Exame importado', fonte: 'exame_importado', origem: 'profissional', revisado: true,
      detalhe: 'Exame importado · A data do exame não foi informada · Registrado no app em 02/07/2026',
    }]);
  });

  it('exame importado com data_exame inválida ou no futuro também vai para "Sem data", com aviso próprio', () => {
    for (const ruim of ['2099-12-31', '2026-13-01', 'semana passada']) {
      const r = montar({ examesImportados: [{ id: 'i3', tipo: 'laboratorial', data_exame: ruim, created_at: '2026-07-02T12:00:00+00:00', status: 'processado' }] });
      expect(r.marcos, ruim).toEqual([]);
      expect(r.semData.map((s) => s.detalhe), ruim).toEqual(['Exame importado · A data do exame registrada não é válida · Registrado no app em 02/07/2026']);
    }
  });

  it('item do profissional sem data convive com o do cliente na faixa "Sem data", cada um com o próprio selo', () => {
    const r = montar({
      ...comHistorico(cirurgias({ tipo: 'Joelho', ano: 'há 2 anos' })),
      diagnosticos: [{ id: 'd', data_diagnostico: null, cid_descricao: 'Lombalgia', created_at: '2026-02-03T15:00:00+00:00', ativo: true, tipo: 'principal' }],
    });
    expect(r.semData.map((s) => [s.fonte, s.origem, s.revisado])).toEqual([['historico_clinico', 'cliente', false], ['diagnostico', 'profissional', true]]);
  });

  it('história de vida: tipo conhecido vira rótulo fixo; desconhecido é só formatado; título vazio cai no rótulo; cirurgia é tipo cirurgia', () => {
    const { marcos } = montar({
      historiaVida: [
        { id: '1', data_evento: '2020-01-01', tipo: 'cirurgia', titulo: 'Menisco', descricao: null },
        { id: '2', data_evento: '2020-01-02', tipo: 'inicio_tratamento', titulo: '', descricao: '' },
        { id: '3', data_evento: '2020-01-03', tipo: 'marco_novo', titulo: 'Algo', descricao: '' },
        { id: '4', data_evento: '2020-01-04', tipo: '', titulo: '', descricao: '' },
        { id: '5', data_evento: '2020-01-05', tipo: 'constructor', titulo: 'x', descricao: '' },
      ],
    });
    const por = Object.fromEntries(marcos.map((m) => [m.id, m]));
    expect(por['historia_vida:1']).toMatchObject({ tipo: 'cirurgia', rotuloTipo: 'Cirurgia', detalhe: undefined });
    expect(por['historia_vida:2']).toMatchObject({ titulo: 'Início do tratamento', rotuloTipo: 'Início do tratamento' });
    expect(por['historia_vida:3']).toMatchObject({ rotuloTipo: 'Marco novo', tipo: 'evento_de_vida' });
    expect(por['historia_vida:4']).toMatchObject({ titulo: 'História de vida', rotuloTipo: 'História de vida' });
    expect(por['historia_vida:5']).toMatchObject({ rotuloTipo: 'Constructor' });
  });

  it('escala desconhecida é só formatada; sem pontuação não inventa "0 pontos"', () => {
    const { marcos } = montar({ escalas: [{ id: 'a', tipo_escala: 'beck_ansiedade', pontuacao_total: null, data_aplicacao: '2026-01-02' }, { id: 'b', tipo_escala: 'gad7', pontuacao_total: 0, data_aplicacao: '2026-01-03' }] });
    const por = Object.fromEntries(marcos.map((m) => [m.id, m]));
    expect(por['escala:a']).toMatchObject({ titulo: 'Beck ansiedade', detalhe: undefined });
    expect(por['escala:b']).toMatchObject({ titulo: 'GAD-7 (Ansiedade)', detalhe: 'Pontuação: 0' });
  });

  it('teste funcional sem resultado não inventa resultado; exame presencial de tipo novo é só formatado', () => {
    const { marcos } = montar({
      testesFuncionais: [{ id: 'a', tipo_teste: 'tug', resultado: null, unidade: 'segundos', data_teste: '2026-01-02' }],
      examesPresenciais: [{ id: 'b', tipo: 'exame_novo', data_exame: '2026-01-03', resumo: '  ' }],
    });
    const por = Object.fromEntries(marcos.map((m) => [m.id, m]));
    expect(por['teste_funcional:a'].detalhe).toBeUndefined();
    expect(por['exame_presencial:b']).toMatchObject({ titulo: 'Exame novo', detalhe: undefined });
  });

  it('avaliação presencial: o relato que o paciente fez no portal não conta como avaliação', () => {
    const { marcos } = montar({
      avaliacoesVoz: [
        { id: 'p', created_at: '2026-10-01T12:00:00+00:00', resultado: { _meta: { origem: 'portal_paciente_historia' } } },
        { id: 'q', created_at: '2026-10-02T12:00:00+00:00', resultado: { _meta: { origem: 'autocadastro_paciente' } } },
        { id: 'r', created_at: '2026-10-03T12:00:00+00:00', resultado: { _meta: {} } },
        { id: 's', created_at: '2026-10-04T12:00:00+00:00' },
      ],
    });
    expect(marcos.map((m) => m.id).sort()).toEqual(['avaliacao_voz:r', 'avaliacao_voz:s']);
  });

  it('o relato do paciente é reconhecido só pela origem trazida por caminho JSON (apelido), sem o resultado inteiro', () => {
    const base = { created_at: '2026-10-01T12:00:00+00:00', queixa_principal: 'Dor' };
    const { marcos } = montar({
      avaliacoesVoz: [
        { ...base, id: 'p', [CAMPO_ORIGEM_DO_RELATO]: 'portal_paciente_historia' },
        { ...base, id: 'q', [CAMPO_ORIGEM_DO_RELATO]: 'autocadastro_paciente' },
        { ...base, id: 'r', [CAMPO_ORIGEM_DO_RELATO]: null },
        { ...base, id: 's', [CAMPO_ORIGEM_DO_RELATO]: 'avaliacao_do_profissional' },
        { ...base, id: 't', [CAMPO_ORIGEM_DO_RELATO]: '  portal_paciente_historia  ' },
      ],
    });
    expect(marcos.map((m) => m.id).sort()).toEqual(['avaliacao_voz:r', 'avaliacao_voz:s']);
  });
});

describe('ordem e agrupamento por ano', () => {
  const doisAnos = (): Partial<FontesClinicas> => ({
    ...comHistorico(cirurgias({ tipo: 'Cirurgia A', ano: '2022' }, { tipo: 'Cirurgia B', ano: '2018' })),
    historiaVida: [
      { id: 'a', data_evento: '2022-03-10', tipo: 'trauma', titulo: 'Trauma 2022' },
      { id: 'b', data_evento: '2022-11-30', tipo: 'trauma', titulo: 'Trauma tardio 2022' },
      { id: 'c', data_evento: '2025-01-05', tipo: 'trauma', titulo: 'Trauma 2025' },
    ],
  });

  it('mais recente primeiro; dentro do ano, o que tem dia vem antes do que só tem o ano, e o dia mais novo antes', () => {
    expect(montar(doisAnos()).marcos.map((m) => m.titulo)).toEqual(['Trauma 2025', 'Trauma tardio 2022', 'Trauma 2022', 'Cirurgia A', 'Cirurgia B']);
  });

  it('a ordem não depende da ordem em que as fontes chegam', () => {
    const base = doisAnos();
    const invertido: Partial<FontesClinicas> = { ...base, historiaVida: [...(base.historiaVida ?? [])].reverse() };
    expect(montar(invertido).marcos.map((m) => m.id)).toEqual(montar(base).marcos.map((m) => m.id));
  });

  it('empate de data desempata pelo id, sempre igual', () => {
    const f = { historiaVida: [{ id: 'z', data_evento: '2020-01-01', tipo: 'outro', titulo: 'Z' }, { id: 'a', data_evento: '2020-01-01', tipo: 'outro', titulo: 'A' }] };
    expect(montar(f).marcos.map((m) => m.id)).toEqual(['historia_vida:a', 'historia_vida:z']);
  });

  it('agrupa por ano, do mais novo ao mais antigo, mantendo a ordem dentro de cada ano', () => {
    const { porAno } = montar(doisAnos());
    expect(porAno.map((g) => [g.ano, g.marcos.map((m) => m.titulo)])).toEqual([
      ['2025', ['Trauma 2025']],
      ['2022', ['Trauma tardio 2022', 'Trauma 2022', 'Cirurgia A']],
      ['2018', ['Cirurgia B']],
    ]);
  });

  it('agruparPorAno sobre uma lista cortada (os 6 mais recentes) agrupa só o que recebeu', () => {
    const { marcos } = montar(doisAnos());
    expect(agruparPorAno(marcos.slice(0, 2)).map((g) => [g.ano, g.marcos.length])).toEqual([['2025', 1], ['2022', 1]]);
    expect(agruparPorAno([])).toEqual([]);
  });

  it('ids únicos e estáveis entre duas montagens', () => {
    const a = montar(doisAnos()).marcos.map((m) => m.id);
    expect(new Set(a).size).toBe(a.length);
    expect(montar(doisAnos()).marcos.map((m) => m.id)).toEqual(a);
  });

  it('linha sem id usa a posição na lista: continua único e estável', () => {
    const { marcos } = montar({ historiaVida: [{ data_evento: '2020-01-01', tipo: 'outro', titulo: 'A' }, { data_evento: '2020-01-02', tipo: 'outro', titulo: 'B' }] });
    expect(marcos.map((m) => m.id)).toEqual(['historia_vida:i1', 'historia_vida:i0']);
  });
});

describe('nada é inventado: data inválida, ausente ou de "hoje" por engano', () => {
  it('registro do profissional sem data válida fica de fora e é contado em "ignorados" (nunca recebe a data de hoje)', () => {
    const r = montar({
      historiaVida: [
        { id: '1', data_evento: null, tipo: 'outro', titulo: 'Sem data' },
        { id: '2', data_evento: '0000-00-00', tipo: 'outro', titulo: 'Zero' },
        { id: '3', data_evento: '2099-01-01', tipo: 'outro', titulo: 'Futuro' },
        { id: '4', data_evento: '2020-02-30', tipo: 'outro', titulo: 'Dia inexistente' },
        { id: '5', data_evento: 'há 2 anos', tipo: 'outro', titulo: 'Texto' },
      ],
      examesPresenciais: [{ id: 'e', tipo: 'bioimpedancia', data_exame: '0001-01-01' }],
      testesFuncionais: [{ id: 't', tipo_teste: 'tug', data_teste: '' }],
      escalas: [{ id: 's', tipo_escala: 'phq9', data_aplicacao: undefined }],
      avaliacoesVoz: [{ id: 'a', created_at: null }],
    });
    expect(r.marcos).toEqual([]);
    expect(r.ignorados).toBe(9);
  });

  it('MyID sem data usável não ganha a data de hoje nem a de created_at (quando o MyID foi criado, não concluído): é ignorado', () => {
    const r = montar({ myidConcluidos: [myid({ id: 'a', updated_at: null, created_at: null }), myid({ id: 'b', updated_at: 'xx', created_at: '2026-08-09T12:00:00+00:00' })] });
    expect(r.marcos).toEqual([]);
    expect(r.ignorados).toBe(2);
  });

  it('histórico clínico enviado: só marca se ultimo_envio for uma data válida', () => {
    expect(montar(comHistorico({ ultimo_envio: '2026-10-02T12:00:00+00:00' })).marcos.map((m) => m.id)).toEqual(['historico_clinico:envio']);
    for (const ruim of [null, '', 'ontem', 12345, '2099-01-01T00:00:00Z', {}]) {
      expect(montar(comHistorico({ ultimo_envio: ruim })).marcos, JSON.stringify(ruim)).toEqual([]);
    }
  });

  it('"Histórico clínico enviado" vem só de ultimo_envio (envio explícito) e diz isso; o atualizado_em do autosave não vira marco', () => {
    const { marcos } = montar(comHistorico({ ultimo_envio: '2026-10-02T12:00:00+00:00', atualizado_em: '2026-11-10T12:00:00+00:00', ...cirurgias() }));
    expect(marcos).toHaveLength(1);
    expect(marcos[0]).toMatchObject({
      id: 'historico_clinico:envio', titulo: 'Último envio do histórico clínico (pelo cliente)', data: { iso: '2026-10-02', precisao: 'dia' },
      natureza: 'registro', origem: 'cliente', revisado: false, fonte: 'historico_clinico', tipo: 'historico',
    });
    expect(montar(comHistorico({ atualizado_em: '2026-11-10T12:00:00+00:00' })).marcos).toEqual([]);
  });

  it('nenhuma fonte, ou só lixo, não gera marco nenhum (em especial nenhum marco com a data de hoje)', () => {
    expect(montar().marcos).toEqual([]);
    const lixo = montar({
      paciente: { historico_clinico: 'isto não é json', historia_atual: 42 },
      myidConcluidos: [{}, { status: 7 }], myidUltimo: { respostas_brutas: 'lixo' },
      historiaVida: [{}], diagnosticos: [{}], examesPresenciais: [{}], examesImportados: [{}], testesFuncionais: [{}], escalas: [{}], avaliacoesVoz: [{}],
    });
    expect(lixo.marcos).toEqual([]);
    expect(lixo.semData).toEqual([]);
    expect(lixo.marcos.filter((m) => m.data.iso === HOJE)).toEqual([]);
  });

  it('um registro com a data de hoje de verdade é aceito (hoje não é "futuro")', () => {
    const { marcos } = montar({ historiaVida: [{ id: 'h', data_evento: HOJE, tipo: 'outro', titulo: 'Hoje de verdade' }, { id: 'f', data_evento: '2026-11-16', tipo: 'outro', titulo: 'Amanhã' }] });
    expect(marcos.map((m) => m.titulo)).toEqual(['Hoje de verdade']);
  });

  it('eventos clínicos do avatar (histórico relatado, com data = dia do envio) não viram marco, mesmo que cheguem nas fontes', () => {
    const intrusos = {
      eventosClinicosAnatomicos: [
        { id: 'ev1', tipo_diagnostico: 'historico_relatado', origem: 'relato_paciente', data_inicio: HOJE, tipo_achado: 'Dor no joelho' },
        { id: 'ev2', tipo_diagnostico: 'historico_relatado', origem: 'profissional', data_inicio: HOJE, tipo_achado: 'Dor no ombro' },
      ],
    };
    const r = montarLinhaDoTempo({ ...FONTES_VAZIAS, ...intrusos } as unknown as FontesClinicas, HOJE);
    expect(r.marcos).toEqual([]);
    expect(r.semData).toEqual([]);
  });
});

describe('tolerância ao que vem no jsonb do cliente', () => {
  it.each([
    [null], [undefined], [''], ['isto não é json'], [42], [true], [[]], [[1, 2]], [{}],
    [{ cirurgias: 'x' }], [{ cirurgias: { items: 'x' } }], [{ cirurgias: { items: { 0: { tipo: 'a' } } } }], [{ cirurgias: null }],
    [{ doencas_cronicas: 'x', medicamentos: 5, alergias: [], saude_mental: null, historico_familiar: 'y' }],
  ])('historico_clinico %j não derruba nem gera marco', (historico) => {
    expect(() => montar(comHistorico(historico))).not.toThrow();
    const r = montar(comHistorico(historico));
    expect([r.marcos, r.semData]).toEqual([[], []]);
  });

  it('historico_clinico gravado como texto JSON também é lido', () => {
    const texto = JSON.stringify(cirurgias({ tipo: 'Joelho', ano: '2021' }));
    expect(montar(comHistorico(texto)).marcos.map((m) => m.titulo)).toEqual(['Joelho']);
  });

  it('paciente ausente ou sem as colunas não derruba', () => {
    expect(() => montar({ paciente: null })).not.toThrow();
    expect(() => montar({ paciente: {} })).not.toThrow();
  });

  it.each([[null], ['lixo'], [7], [[]], [{ bloco_1_changes: 'x', bloco_1_duracao: {}, bloco_1_quando_data: [], bloco_1_quando_desc: 3 }]])('respostas do MyID %j não derrubam', (respostas) => {
    expect(() => montar({ myidUltimo: myid({ respostas_brutas: respostas }) })).not.toThrow();
  });

  it('número em texto do cliente é aceito como texto ("3"), objeto não', () => {
    const { comoComecou } = montar({ myidUltimo: myid({ respostas_brutas: { bloco_1_quando_data: 3, bloco_1_quando_desc: { a: 1 } } }) });
    expect(comoComecou?.inicio.map((s) => s.texto)).toEqual(['3']);
  });
});

describe('diagnósticos: só entram os ativos, principais ou secundários (fato clínico firmado)', () => {
  const diag = (extra: LinhaBruta): LinhaBruta => ({ id: 'd', data_diagnostico: '2024-05-06', cid_codigo: 'M54.5', cid_descricao: 'Dor lombar baixa', created_at: '2026-01-01T12:00:00+00:00', ativo: true, tipo: 'principal', ...extra });
  const idsDosMarcos = (linha: LinhaBruta) => montar({ diagnosticos: [linha] }).marcos.map((m) => m.id);

  it.each([['principal'], ['secundario']])('ativo e do tipo %s vira marco "Diagnóstico" (fato, profissional)', (tipo) => {
    const { marcos } = montar({ diagnosticos: [diag({ tipo })] });
    expect(marcos).toHaveLength(1);
    expect(marcos[0]).toMatchObject({ id: 'diagnostico:d', natureza: 'fato', origem: 'profissional', revisado: true, tipo: 'diagnostico', rotuloTipo: 'Diagnóstico', titulo: '[M54.5] Dor lombar baixa' });
  });

  it('diagnóstico removido no app (ativo = false) não vira marco, em nenhum tipo, nem vai para "Sem data"', () => {
    for (const tipo of ['principal', 'secundario', 'suspeita']) {
      const r = montar({ diagnosticos: [diag({ ativo: false, tipo }), diag({ ativo: false, tipo, data_diagnostico: null })] });
      expect(r.marcos, tipo).toEqual([]);
      expect(r.semData, tipo).toEqual([]);
      expect(r.ignorados, tipo).toBe(0);
    }
  });

  it('"suspeita" é hipótese, não diagnóstico: fica de fora, com ou sem data', () => {
    const r = montar({ diagnosticos: [diag({ tipo: 'suspeita' }), diag({ id: 'd2', tipo: 'suspeita', data_diagnostico: null })] });
    expect(r.marcos).toEqual([]);
    expect(r.semData).toEqual([]);
  });

  it.each([[null], [undefined], [''], ['   '], ['provavel'], ['PRINCIPAL'], ['Principal'], ['principal2'], ['secundaria'], ['principal,secundario'], [7], [{}], [['principal']]])('tipo %j (nulo ou desconhecido) não afirma diagnóstico', (tipo) => {
    expect(idsDosMarcos(diag({ tipo }))).toEqual([]);
  });

  it.each([[null], [undefined], ['true'], [1], ['']])('ativo %j que não é exatamente true não entra (a coluna é NOT NULL DEFAULT true: vazio só vem se a leitura não trouxe a coluna)', (ativo) => {
    expect(idsDosMarcos(diag({ ativo }))).toEqual([]);
    const semColuna = diag({});
    delete semColuna.ativo;
    expect(idsDosMarcos(semColuna)).toEqual([]);
  });

  it('só o ativo e firmado entra no meio de uma lista mista, e o removido não ocupa nem "Sem data" nem "ignorados"', () => {
    const r = montar({
      diagnosticos: [
        diag({ id: 'a', cid_descricao: 'Ativo principal' }),
        diag({ id: 'b', cid_descricao: 'Removido', ativo: false }),
        diag({ id: 'c', cid_descricao: 'Suspeita', tipo: 'suspeita' }),
        diag({ id: 'e', cid_descricao: 'Ativo secundário', tipo: 'secundario', data_diagnostico: '2023-02-01' }),
        diag({ id: 'f', cid_descricao: 'Sem tipo', tipo: null }),
        diag({ id: 'g', cid_descricao: 'Ativo sem data', data_diagnostico: null }),
      ],
    });
    expect(r.marcos.map((m) => m.titulo)).toEqual(['[M54.5] Ativo principal', '[M54.5] Ativo secundário']);
    expect(r.semData.map((s) => s.titulo)).toEqual(['[M54.5] Ativo sem data']);
    expect(r.ignorados).toBe(0);
  });
});

describe('exames importados: só entram os que a importação terminou com sucesso', () => {
  const exame = (extra: LinhaBruta): LinhaBruta => ({ id: 'i', tipo: 'laboratorial', data_exame: '2026-07-01', created_at: '2026-07-02T12:00:00+00:00', status: 'processado', ...extra });
  const montarExames = (linhas: LinhaBruta[]) => montar({ examesImportados: linhas });

  it('status "processado" (o que a edge function import-exame grava ao terminar) vira marco', () => {
    const { marcos } = montarExames([exame({})]);
    expect(marcos.map((m) => [m.id, m.titulo, m.data.iso])).toEqual([['exame_importado:i', 'Laboratorial', '2026-07-01']]);
  });

  it.each([['pendente'], ['erro'], ['falhou'], ['processando'], ['PROCESSADO'], [''], [null], [undefined], [1], [true], [{}]])('status %j não entra: nem marco nem "Sem data" nem "ignorados"', (status) => {
    for (const linha of [exame({ status }), exame({ status, data_exame: null })]) {
      const r = montarExames([linha]);
      expect(r.marcos).toEqual([]);
      expect(r.semData).toEqual([]);
      expect(r.ignorados).toBe(0);
    }
  });

  it('linha sem a coluna status (leitura que não a trouxe) não entra', () => {
    const linha = exame({});
    delete linha.status;
    expect(montarExames([linha]).marcos).toEqual([]);
  });

  it('numa lista mista só o processado aparece, e o processado sem data vai para "Sem data"', () => {
    const r = montarExames([
      exame({ id: 'ok', tipo: 'hemograma' }),
      exame({ id: 'pend', tipo: 'pendente_x', status: 'pendente' }),
      exame({ id: 'err', tipo: 'erro_x', status: 'erro' }),
      exame({ id: 'sd', tipo: 'urina', data_exame: null }),
    ]);
    expect(r.marcos.map((m) => m.titulo)).toEqual(['Hemograma']);
    expect(r.semData.map((s) => s.titulo)).toEqual(['Urina']);
  });
});

describe('diagnóstico: data igual ao dia do cadastro é o DEFAULT CURRENT_DATE do banco, não a data do fato', () => {
  // diagnosticos_paciente.data_diagnostico é `date DEFAULT CURRENT_DATE` (migração 20260607211619) e, até o corte de
  // 18/11/2026, o insert do app (DiagnosticosCID10Card) não a enviava: o banco a preenchia com o dia do cadastro, em UTC. Essa
  // data não prova que o profissional a informou. Limite assumido: uma data real que coincida por acaso com o dia do cadastro
  // de uma linha ANTERIOR ao corte também vai para "Sem data". Depois do corte, a regra é outra
  // (resumoClinicoDataExplicitaDoDiagnostico.test.ts); as linhas daqui são de antes do corte ou têm created_at que não vale.
  const NOTA = 'A data do diagnóstico é a do dia do cadastro no app e pode ter sido preenchida pelo sistema';
  const diag = (extra: LinhaBruta): LinhaBruta => ({ id: 'd', data_diagnostico: '2019-03-04', cid_codigo: 'M54.5', cid_descricao: 'Dor lombar baixa', created_at: '2026-02-03T15:00:00+00:00', ativo: true, tipo: 'principal', ...extra });
  const semDataDe = (linha: LinhaBruta) => montar({ diagnosticos: [linha] });

  it('igual ao dia do cadastro em UTC: não vira marco; vai para "Sem data" com "Registrado no app em" e o selo do profissional', () => {
    const r = semDataDe(diag({ data_diagnostico: '2026-02-03' }));
    expect(r.marcos).toEqual([]);
    expect(r.ignorados).toBe(0);
    expect(r.semData).toEqual([{
      id: 'diagnostico:d', titulo: '[M54.5] Dor lombar baixa', fonte: 'diagnostico', origem: 'profissional', revisado: true,
      detalhe: `Diagnóstico · ${NOTA} · Registrado no app em 03/02/2026`,
    }]);
  });

  it('o mesmo vale para o diagnóstico secundário', () => {
    const r = semDataDe(diag({ tipo: 'secundario', data_diagnostico: '2026-02-03' }));
    expect(r.marcos).toEqual([]);
    expect(r.semData).toHaveLength(1);
  });

  it('virada de dia: 01:00 UTC de 16/11 ainda é 22:00 de 15/11 no Brasil, e as DUAS datas (a de UTC e a do Brasil) são tidas como do cadastro', () => {
    const criado = '2026-11-16T01:00:00+00:00';
    const doBrasil = semDataDe(diag({ created_at: criado, data_diagnostico: '2026-11-15' }));
    expect(doBrasil.marcos).toEqual([]);
    expect(doBrasil.semData.map((s) => s.detalhe)).toEqual([`Diagnóstico · ${NOTA} · Registrado no app em 15/11/2026`]);
    // 16/11 é amanhã para o Brasil (HOJE = 15/11): ainda assim é a data que o banco preencheu, e o aviso diz isso, não "inválida".
    const deUtc = semDataDe(diag({ created_at: criado, data_diagnostico: '2026-11-16' }));
    expect(deUtc.marcos).toEqual([]);
    expect(deUtc.semData.map((s) => s.detalhe)).toEqual([`Diagnóstico · ${NOTA} · Registrado no app em 15/11/2026`]);
  });

  it('virada de dia no sentido contrário: cadastro às 22:30 do Brasil (01:30 UTC do dia seguinte) coincide com os dois dias', () => {
    const criado = '2026-02-04T01:30:00+00:00';
    for (const dia of ['2026-02-03', '2026-02-04']) {
      const r = semDataDe(diag({ created_at: criado, data_diagnostico: dia }));
      expect(r.marcos, dia).toEqual([]);
      expect(r.semData.map((s) => s.detalhe), dia).toEqual([`Diagnóstico · ${NOTA} · Registrado no app em 03/02/2026`]);
    }
    expect(semDataDe(diag({ created_at: criado, data_diagnostico: '2026-02-02' })).marcos).toHaveLength(1);
  });

  it('o dia em UTC sai do instante, não do texto: 23:30 com fuso -03:00 de 03/02 já é 04/02 em UTC', () => {
    const r = semDataDe(diag({ created_at: '2026-02-03T23:30:00-03:00', data_diagnostico: '2026-02-04' }));
    expect(r.marcos).toEqual([]);
    expect(r.semData.map((s) => s.detalhe)).toEqual([`Diagnóstico · ${NOTA} · Registrado no app em 03/02/2026`]);
  });

  it('data bem diferente do dia do cadastro continua sendo marco "fato" (2019-03-04 em registro de 2026)', () => {
    const r = semDataDe(diag({}));
    expect(r.semData).toEqual([]);
    expect(r.marcos).toHaveLength(1);
    expect(r.marcos[0]).toMatchObject({ id: 'diagnostico:d', natureza: 'fato', origem: 'profissional', revisado: true, data: { iso: '2019-03-04', precisao: 'dia' } });
  });

  it('só a data IGUAL é descartada: o dia anterior e o seguinte ao cadastro continuam sendo marco', () => {
    for (const dia of ['2026-02-02', '2026-02-04']) {
      const r = semDataDe(diag({ data_diagnostico: dia }));
      expect(r.semData, dia).toEqual([]);
      expect(r.marcos.map((m) => m.data.iso), dia).toEqual([dia]);
    }
  });

  it('data nula continua em "Sem data" com o aviso de que não foi informada', () => {
    const r = semDataDe(diag({ data_diagnostico: null }));
    expect(r.marcos).toEqual([]);
    expect(r.semData.map((s) => s.detalhe)).toEqual(['Diagnóstico · A data do diagnóstico não foi informada · Registrado no app em 03/02/2026']);
  });

  it('created_at nulo ou inválido: sem o dia do cadastro não há com o que comparar, então só a data válida decide (ela vira marco; a inválida segue em "Sem data")', () => {
    // created_at é NOT NULL timestamptz: vazio só vem se a leitura não trouxe a coluna. Descartar a data nesse caso perderia
    // uma data que o profissional pode ter digitado, e a regra estrita de data (válida, não futura) continua valendo.
    for (const ruim of [null, undefined, '', 'ontem', '2099-01-01T10:00:00Z', 12345]) {
      const r = semDataDe(diag({ created_at: ruim, data_diagnostico: '2026-02-03' }));
      expect(r.marcos.map((m) => m.data.iso), String(ruim)).toEqual(['2026-02-03']);
      expect(r.semData, String(ruim)).toEqual([]);
      const invalida = semDataDe(diag({ created_at: ruim, data_diagnostico: '2020-02-30' }));
      expect(invalida.marcos, String(ruim)).toEqual([]);
      expect(invalida.semData.map((s) => s.detalhe), String(ruim)).toEqual(['Diagnóstico · A data do diagnóstico registrada não é válida']);
    }
    const semColuna = diag({});
    delete semColuna.created_at;
    expect(semDataDe({ ...semColuna, data_diagnostico: '2026-02-03' }).marcos).toHaveLength(1);
  });

  it('removido e suspeita continuam fora, mesmo com a data do cadastro (nem marco nem "Sem data")', () => {
    for (const extra of [{ ativo: false }, { tipo: 'suspeita' }]) {
      const r = semDataDe(diag({ ...extra, data_diagnostico: '2026-02-03' }));
      expect(r.marcos).toEqual([]);
      expect(r.semData).toEqual([]);
    }
  });
});

describe('exame importado: a data é lida do documento por IA e o marco avisa', () => {
  // exames_importados.data_exame vem do JSON que o Gemini extrai do arquivo (supabase/functions/import-exame), não é digitada.
  const exame = (extra: LinhaBruta): LinhaBruta => ({ id: 'i', tipo: 'laboratorial', data_exame: '2026-07-01', created_at: '2026-07-02T12:00:00+00:00', status: 'processado', ...extra });

  it('o marco continua "registro" com a data do documento e traz o aviso para conferir no arquivo', () => {
    const { marcos } = montar({ examesImportados: [exame({})] });
    expect(marcos).toHaveLength(1);
    expect(marcos[0]).toMatchObject({ natureza: 'registro', origem: 'profissional', data: { iso: '2026-07-01', precisao: 'dia' }, detalhe: 'Data lida automaticamente do documento; confira no arquivo.' });
  });

  it('só o exame importado leva esse aviso: o presencial (digitado) não, e o sem data não tem data para avisar', () => {
    const r = montar({
      examesImportados: [exame({}), exame({ id: 'sd', data_exame: null })],
      examesPresenciais: [{ id: 'e1', tipo: 'bioimpedancia', data_exame: '2026-08-01', resumo: 'Peso 70 kg' }],
    });
    expect(r.marcos.filter((m) => m.detalhe === DETALHE_DATA_LIDA_DO_DOCUMENTO).map((m) => m.id)).toEqual(['exame_importado:i']);
    expect(r.marcos.find((m) => m.id === 'exame_presencial:e1')?.detalhe).toBe('Peso 70 kg');
    expect(r.semData.map((s) => s.detalhe)).toEqual(['Exame importado · A data do exame não foi informada · Registrado no app em 02/07/2026']);
  });
});

describe('MyID: "concluído" só com a data do histórico; sem ela, "último registro" com aviso', () => {
  // myid_avaliacoes.updated_at é mudado por QUALQUER update (trg_myid_avaliacoes_updated_at), até pelo backfill-myid-efi meses
  // depois. A data confiável é o created_at da avaliacoes_identidade que o complete-myid grava no mesmo pedido que conclui o MyID.
  const vinculo = (extra: LinhaBruta = {}): LinhaBruta => ({ id: 'v1', myid_avaliacao_id: 'm1', created_at: '2026-09-02T12:00:00+00:00', ...extra });
  const reescrito = myid({ updated_at: '2026-10-20T12:00:00+00:00' });

  it('com o vínculo: "MyID concluído" na data do histórico, não na do updated_at reescrito depois', () => {
    const { marcos } = montar({ myidConcluidos: [reescrito], vinculosMyid: [vinculo()] });
    expect(marcos).toHaveLength(1);
    expect(marcos[0]).toMatchObject({
      id: 'myid:m1', titulo: TITULO_MYID_CONCLUIDO, detalhe: DETALHE_MYID_CONCLUIDO, natureza: 'registro', origem: 'cliente', revisado: false,
      data: { iso: '2026-09-02', precisao: 'dia' },
    });
    expect(TITULO_MYID_CONCLUIDO).toBe('MyID concluído');
  });

  it('o dia da conclusão é o do Brasil (01:00 UTC de 03/09 ainda é 02/09)', () => {
    const { marcos } = montar({ myidConcluidos: [reescrito], vinculosMyid: [vinculo({ created_at: '2026-09-03T01:00:00+00:00' })] });
    expect(marcos[0].data.iso).toBe('2026-09-02');
  });

  it('sem o vínculo (não ligado, de outro profissional pela RLS ou leitura que falhou): "MyID (último registro)" com updated_at e o aviso, sem a palavra "concluído"', () => {
    const { marcos } = montar({ myidConcluidos: [reescrito] });
    expect(marcos).toHaveLength(1);
    expect(marcos[0]).toMatchObject({
      id: 'myid:m1', titulo: 'MyID (último registro)', detalhe: 'Data do último registro; pode ser posterior à conclusão.', natureza: 'registro',
      origem: 'cliente', revisado: false, data: { iso: '2026-10-20', precisao: 'dia' },
    });
    expect(TITULO_MYID_ULTIMO_REGISTRO).toBe('MyID (último registro)');
    expect(DETALHE_MYID_ULTIMO_REGISTRO).toBe('Data do último registro; pode ser posterior à conclusão.');
    expect(`${marcos[0].titulo} ${marcos[0].detalhe}`).not.toContain('concluído');
  });

  it('vínculo de OUTRO MyID não vale para este', () => {
    const { marcos } = montar({ myidConcluidos: [reescrito], vinculosMyid: [vinculo({ myid_avaliacao_id: 'outro' })] });
    expect(marcos[0].titulo).toBe(TITULO_MYID_ULTIMO_REGISTRO);
    expect(marcos[0].data.iso).toBe('2026-10-20');
  });

  it.each([[null], [undefined], [''], ['ontem'], ['0000-00-00T00:00:00Z'], ['2099-01-01T10:00:00+00:00'], [12345]])('vínculo com created_at %j não é data: cai em "último registro"', (ruim) => {
    const { marcos } = montar({ myidConcluidos: [reescrito], vinculosMyid: [vinculo({ created_at: ruim })] });
    expect(marcos).toHaveLength(1);
    expect(marcos[0]).toMatchObject({ titulo: TITULO_MYID_ULTIMO_REGISTRO, data: { iso: '2026-10-20' } });
  });

  it('MyID sem id não casa com vínculo sem myid_avaliacao_id (vazio com vazio não é vínculo)', () => {
    for (const vazio of [undefined, null, '']) {
      const { marcos } = montar({ myidConcluidos: [myid({ id: vazio })], vinculosMyid: [vinculo({ myid_avaliacao_id: vazio })] });
      expect(marcos.map((m) => m.titulo), String(vazio)).toEqual([TITULO_MYID_ULTIMO_REGISTRO]);
    }
  });

  it('numa lista com os dois casos, cada MyID leva o título da sua própria evidência', () => {
    const { marcos } = montar({
      myidConcluidos: [myid({ id: 'm1', updated_at: '2026-10-20T12:00:00+00:00' }), myid({ id: 'm2', updated_at: '2026-06-10T12:00:00+00:00' })],
      vinculosMyid: [vinculo({ myid_avaliacao_id: 'm2', created_at: '2026-06-09T12:00:00+00:00' })],
    });
    expect(marcos.map((m) => [m.id, m.titulo, m.data.iso])).toEqual([
      ['myid:m1', TITULO_MYID_ULTIMO_REGISTRO, '2026-10-20'],
      ['myid:m2', TITULO_MYID_CONCLUIDO, '2026-06-09'],
    ]);
  });

  it('MyID que não está concluído continua sem marco, mesmo com vínculo', () => {
    const { marcos } = montar({ myidConcluidos: [myid({ status: 'em_andamento' })], vinculosMyid: [vinculo()] });
    expect(marcos).toEqual([]);
  });

  it('sem updated_at utilizável e sem vínculo: ignorado e contado, nunca a data de hoje nem a de created_at', () => {
    const r = montar({ myidConcluidos: [myid({ updated_at: 'xx' })] });
    expect(r.marcos).toEqual([]);
    expect(r.ignorados).toBe(1);
  });
});

describe('o que não é data real não vira marco (casos que faltavam)', () => {
  it('exame importado com o status "processado" com espaços nas pontas conta (a camada apara o texto, como no resto); outra caixa não', () => {
    // A leitura filtra por .eq('status', 'processado') exato, que é o que a edge function import-exame grava; este é o segundo
    // portão e fica tolerante a espaço, como o tipo do diagnóstico e o resto da camada.
    const exame = (status: unknown): LinhaBruta => ({ id: 'i', tipo: 'laboratorial', data_exame: '2026-07-01', created_at: '2026-07-02T12:00:00+00:00', status });
    expect(montar({ examesImportados: [exame(' processado ')] }).marcos.map((m) => m.id)).toEqual(['exame_importado:i']);
    expect(montar({ examesImportados: [exame('\tprocessado\n')] }).marcos.map((m) => m.id)).toEqual(['exame_importado:i']);
    for (const fora of ['Processado', ' PROCESSADO ', 'processado.', 'processa do']) {
      const r = montar({ examesImportados: [exame(fora)] });
      expect(r.marcos, fora).toEqual([]);
      expect(r.semData, fora).toEqual([]);
    }
  });

  it('história de vida com data_evento inválida NÃO usa o created_at válido: sem marco, fica de fora e é contada', () => {
    for (const ruim of [null, undefined, '', '   ', 'ontem', '0000-00-00', '2020-02-30', '2099-01-01', '1899-12-31']) {
      const r = montar({ historiaVida: [{ id: 'h', data_evento: ruim, tipo: 'cirurgia', titulo: 'Menisco', created_at: '2026-02-03T15:00:00+00:00' }] });
      expect(r.marcos, String(ruim)).toEqual([]);
      expect(r.semData, String(ruim)).toEqual([]);
      expect(r.ignorados, String(ruim)).toBe(1);
    }
  });
});

describe('ids estáveis dos itens do MyID', () => {
  const respostas = { bloco_1_duracao: 'lt6w', bloco_1_quando_data: 'ontem', bloco_1_quando_desc: 'corrida' };

  it('o marco "MyID concluído" tem id "myid:" + id da linha; sem id usa a posição na lista', () => {
    const r = montar({ myidConcluidos: [myid({ id: 'abc' }), myid({ id: undefined }), myid({ id: '' }), myid({ id: 77 })] });
    expect(r.marcos.map((m) => m.id).sort()).toEqual(['myid:77', 'myid:abc', 'myid:i1', 'myid:i2']);
    expect(r.marcos.every((m) => m.fonte === 'myid')).toBe(true);
  });

  const idsDoComoComecou = (r: ReturnType<typeof montar>) => [...(r.comoComecou?.queixas ?? []), ...(r.comoComecou?.inicio ?? [])].map((s) => s.id);

  it('cada resposta do MyID no "Como começou" leva o id do MyID mais recente + o campo de onde veio', () => {
    const r = montar({ myidUltimo: myid({ id: 'm9', respostas_brutas: { ...respostas, bloco_1_queixa: 'dor' } }) });
    expect(idsDoComoComecou(r)).toEqual(['myid:m9:queixa', 'myid:m9:duracao', 'myid:m9:quando', 'myid:m9:o_que_fazia']);
  });

  it('MyID mais recente sem id usa a posição 0 e continua único e estável', () => {
    const a = idsDoComoComecou(montar({ myidUltimo: myid({ id: undefined, respostas_brutas: respostas }) }));
    expect(a).toEqual(['myid:i0:duracao', 'myid:i0:quando', 'myid:i0:o_que_fazia']);
    expect(idsDoComoComecou(montar({ myidUltimo: myid({ id: undefined, respostas_brutas: respostas }) }))).toEqual(a);
  });

  it('o id do marco e o dos itens do MyID não colidem entre si, nem com os de outras fontes', () => {
    const r = montar({
      myidConcluidos: [myid({ id: 'm1' })], myidUltimo: myid({ id: 'm1', respostas_brutas: respostas }),
      ...comHistorico(cirurgias({ tipo: 'Joelho', ano: '2020' }, { tipo: 'Ombro', ano: 'faz tempo' })),
      historiaVida: [{ id: 'm1', data_evento: '2020-01-01', tipo: 'outro', titulo: 'x' }],
    });
    const ids = [...r.marcos.map((m) => m.id), ...r.semData.map((s) => s.id), ...idsDoComoComecou(r)];
    expect(ids).toHaveLength(7);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('myid:m1');
    expect(ids).toContain('historia_vida:m1');
  });
});

describe('o mesmo fato relatado pelo cliente e registrado pelo profissional continua em DOIS marcos (de propósito)', () => {
  // O profissional precisa enxergar a divergência: o cliente escreveu um ano, o profissional registrou uma data. Juntar
  // os dois esconderia justamente o que ele deve conferir; por isso não há deduplicação e cada marco leva o próprio selo.
  it('cirurgia do histórico clínico (cliente) e da história de vida (profissional) aparecem as duas, com origens diferentes', () => {
    const { marcos, porAno } = montar({
      ...comHistorico(cirurgias({ tipo: 'Ligamento do joelho (LCA)', ano: '2022' })),
      historiaVida: [{ id: 'h1', data_evento: '2022-03-10', tipo: 'cirurgia', titulo: 'Ligamento do joelho (LCA)', descricao: 'Reconstrução' }],
    });
    expect(marcos).toHaveLength(2);
    expect(marcos.map((m) => [m.fonte, m.origem, m.revisado, m.data.precisao])).toEqual([['historia_vida', 'profissional', true, 'dia'], ['historico_clinico', 'cliente', false, 'ano']]);
    expect(new Set(marcos.map((m) => m.titulo)).size).toBe(1);
    expect(porAno).toHaveLength(1);
    expect(porAno[0].marcos).toHaveLength(2);
  });

  it('mesmo com o MESMO ano e o mesmo texto, nada é juntado', () => {
    const { marcos } = montar({
      ...comHistorico(cirurgias({ tipo: 'Menisco', ano: '2020' })),
      historiaVida: [{ id: 'h1', data_evento: '2020-01-01', tipo: 'cirurgia', titulo: 'Menisco' }],
    });
    expect(marcos.map((m) => m.origem).sort()).toEqual(['cliente', 'profissional']);
  });
});
