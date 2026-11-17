import { describe, it, expect } from 'vitest';
import { destinoDoRegistro, montarLinhaDoTempo } from '@/lib/resumoClinico/marcos';
import { textoDoBotaoAbrir } from '@/lib/resumoClinico/exibicao';
import { FONTES_COM_DESTINO, FONTES_VAZIAS, NOME_DA_FONTE_DO_MARCO, TIPOS_DE_MARCO } from '@/lib/resumoClinico/tipos';
import type { FonteDoMarco, FontesClinicas, LinhaBruta, Marco } from '@/lib/resumoClinico/tipos';

// Cada marco que tem onde abrir carrega o destino (fonte + id da linha do banco). Só a avaliação presencial e o diagnóstico
// têm; todo o resto fica sem destino e, na tela, sem botão. O destino nunca é inventado: sem id de verdade, não há destino.

const HOJE = '2026-11-15';
const fontes = (parcial: Partial<FontesClinicas> = {}): FontesClinicas => ({ ...FONTES_VAZIAS, ...parcial });
const montar = (parcial: Partial<FontesClinicas> = {}) => montarLinhaDoTempo(fontes(parcial), HOJE);

const diagnostico = (extra: LinhaBruta = {}): LinhaBruta => ({
  id: 'd1', data_diagnostico: '2024-05-06', cid_codigo: 'M54.5', cid_descricao: 'Dor lombar baixa', created_at: '2026-01-01T12:00:00+00:00', ativo: true, tipo: 'principal', ...extra,
});
const avaliacao = (extra: LinhaBruta = {}): LinhaBruta => ({ id: 'a1', created_at: '2026-10-06T15:00:00+00:00', queixa_principal: 'Dor lombar', ...extra });

// Uma linha de cada fonte que gera marco (com o cliente e o profissional juntos).
const todas = (): Partial<FontesClinicas> => ({
  paciente: {
    historico_clinico: { cirurgias: { items: [{ id: 'c1', tipo: 'Joelho', ano: '2022' }] }, ultimo_envio: '2026-10-02T12:00:00+00:00' },
    historia_atual: { queixa: 'Dor lombar', inicio: 'Há 3 semanas' },
  },
  myidConcluidos: [{ id: 'm1', status: 'concluido', created_at: '2026-09-01T12:00:00+00:00', updated_at: '2026-09-02T12:00:00+00:00' }],
  vinculosMyid: [{ id: 'v1', myid_avaliacao_id: 'm1', created_at: '2026-09-02T12:00:00+00:00' }],
  avaliacoesVoz: [avaliacao()],
  historiaVida: [
    { id: 'h1', data_evento: '2019-03-04', tipo: 'fratura', titulo: 'Fratura de punho', descricao: '' },
    { id: 'h2', data_evento: '2018-02-03', tipo: 'cirurgia', titulo: 'Cirurgia no ombro', descricao: '' },
  ],
  diagnosticos: [diagnostico()],
  examesPresenciais: [{ id: 'e1', tipo: 'bioimpedancia', data_exame: '2026-08-01', resumo: 'Peso 70 kg' }],
  examesImportados: [{ id: 'i1', tipo: 'laboratorial', data_exame: '2026-07-01', created_at: '2026-07-02T12:00:00+00:00', status: 'processado' }],
  testesFuncionais: [{ id: 't1', tipo_teste: 'sentar_levantar_30s', resultado: 14, unidade: 'reps', data_teste: '2026-06-01' }],
  escalas: [{ id: 's1', tipo_escala: 'phq9', pontuacao_total: 7, data_aplicacao: '2026-05-01' }],
});

describe('destino do marco: só a avaliação presencial e o diagnóstico têm onde abrir', () => {
  it('a lista das fontes com destino é exatamente estas duas', () => {
    expect([...FONTES_COM_DESTINO].sort()).toEqual(['avaliacao_voz', 'diagnostico']);
  });

  it('a avaliação presencial leva a fonte e o id da avaliação', () => {
    const marco = montar({ avaliacoesVoz: [avaliacao({ id: 'av-77' })] }).marcos[0];
    expect(marco.destino).toEqual({ fonte: 'avaliacao_voz', id: 'av-77' });
  });

  it('o diagnóstico leva a fonte e o id do diagnóstico', () => {
    const marco = montar({ diagnosticos: [diagnostico({ id: 'dx-9' })] }).marcos[0];
    expect(marco.destino).toEqual({ fonte: 'diagnostico', id: 'dx-9' });
  });

  it('o destino só tem fonte e id (nada de data, texto de saúde ou outro campo da linha)', () => {
    for (const m of montar(todas()).marcos.filter((x) => x.destino)) {
      expect(Object.keys(m.destino ?? {}).sort(), m.id).toEqual(['fonte', 'id']);
    }
  });

  it('o id do destino é o mesmo que a chave estável do marco carrega', () => {
    for (const m of montar(todas()).marcos.filter((x) => x.destino)) {
      expect(m.id, m.id).toBe(`${m.destino?.fonte}:${m.destino?.id}`);
    }
  });

  it('em uma linha do tempo com um marco de cada fonte, só os dois marcos acima têm destino', () => {
    const { marcos } = montar(todas());
    expect(new Set(marcos.map((m) => m.fonte))).toEqual(new Set(['historico_clinico', 'myid', 'avaliacao_voz', 'historia_vida', 'diagnostico', 'exame_presencial', 'exame_importado', 'teste_funcional', 'escala']));
    const comDestino = marcos.filter((m) => m.destino);
    expect(comDestino.map((m) => m.fonte).sort()).toEqual(['avaliacao_voz', 'diagnostico']);
    for (const m of marcos.filter((x) => x.fonte !== 'avaliacao_voz' && x.fonte !== 'diagnostico')) {
      expect(m.destino, m.id).toBeUndefined();
      expect(m.rotuloDoDestino, m.id).toBeUndefined();
      expect('destino' in m, m.id).toBe(false);
    }
  });

  it('cada tipo de marco: só o tipo "avaliacao" e o tipo "diagnostico" aparecem com destino', () => {
    const { marcos } = montar({ ...todas(), myidConcluidos: [...(todas().myidConcluidos ?? []), { id: 'm2', status: 'concluido', created_at: '2026-08-01T12:00:00+00:00', updated_at: '2026-08-02T12:00:00+00:00' }] });
    const tiposComDestino = new Set(marcos.filter((m) => m.destino).map((m) => m.tipo));
    expect(tiposComDestino).toEqual(new Set(['avaliacao', 'diagnostico']));
    const tiposSemDestino = new Set(marcos.filter((m) => !m.destino).map((m) => m.tipo));
    expect(tiposSemDestino).toEqual(new Set(TIPOS_DE_MARCO.filter((t) => t !== 'avaliacao' && t !== 'diagnostico')));
  });

  it('uma cirurgia e um diagnóstico da história de vida (tipo "diagnostico" da história) não ganham destino: a fonte decide, não o tipo', () => {
    const { marcos } = montar({
      historiaVida: [
        { id: 'h-dx', data_evento: '2020-01-02', tipo: 'diagnostico', titulo: 'Hérnia de disco', descricao: '' },
        { id: 'h-cx', data_evento: '2018-02-03', tipo: 'cirurgia', titulo: 'Cirurgia no ombro', descricao: '' },
      ],
    });
    expect(marcos).toHaveLength(2);
    for (const m of marcos) expect(m.destino, m.id).toBeUndefined();
  });

  it('o MyID, concluído ou "último registro", não tem destino', () => {
    const base = { id: 'm1', status: 'concluido', created_at: '2026-09-01T12:00:00+00:00', updated_at: '2026-09-02T12:00:00+00:00' };
    const concluido = montar({ myidConcluidos: [base], vinculosMyid: [{ id: 'v', myid_avaliacao_id: 'm1', created_at: '2026-09-02T12:00:00+00:00' }] });
    const ultimo = montar({ myidConcluidos: [base] });
    expect(concluido.marcos[0].titulo).toBe('MyID concluído');
    expect(ultimo.marcos[0].titulo).toBe('MyID (último registro)');
    expect(concluido.marcos[0].destino).toBeUndefined();
    expect(ultimo.marcos[0].destino).toBeUndefined();
  });

  it('o item de "Sem data" (diagnóstico sem a data do fato) não tem destino nem botão', () => {
    const r = montar({ diagnosticos: [diagnostico({ id: 'dx-sem', data_diagnostico: null })] });
    expect(r.marcos).toEqual([]);
    expect(r.semData).toHaveLength(1);
    expect(r.semData[0].fonte).toBe('diagnostico');
    expect('destino' in r.semData[0]).toBe(false);
    expect('rotuloDoDestino' in r.semData[0]).toBe(false);
  });

  it('o cartão "Como começou" não tem destino', () => {
    const { comoComecou } = montar(todas());
    expect(comoComecou).not.toBeNull();
    for (const r of [...(comoComecou?.queixas ?? []), ...(comoComecou?.inicio ?? [])]) expect('destino' in r, r.id).toBe(false);
  });
});

describe('destino: linha sem id de verdade não tem destino (nada inventado)', () => {
  it.each([
    ['sem a coluna id', {}],
    ['id vazio', { id: '' }],
    ['id só com espaços', { id: '   ' }],
    ['id nulo', { id: null }],
    ['id objeto', { id: { x: 1 } }],
    ['id lista', { id: ['a'] }],
    ['id booleano', { id: true }],
    ['id número que não é finito', { id: Number.NaN }],
  ])('avaliação %s: o marco existe, mas sem destino, e a chave cai na posição', (_nome, extra) => {
    const { marcos } = montar({ avaliacoesVoz: [{ created_at: '2026-10-06T15:00:00+00:00', ...extra }] });
    expect(marcos).toHaveLength(1);
    expect(marcos[0].id).toBe('avaliacao_voz:i0');
    expect(marcos[0].destino).toBeUndefined();
    expect(marcos[0].rotuloDoDestino).toBeUndefined();
    expect(textoDoBotaoAbrir(marcos[0])).toBeNull();
  });

  it.each([
    ['sem a coluna id', {}],
    ['id vazio', { id: '' }],
    ['id nulo', { id: null }],
  ])('diagnóstico %s: o marco existe, mas sem destino', (_nome, extra) => {
    const { marcos } = montar({ diagnosticos: [{ ...diagnostico(), id: undefined, ...extra }] });
    expect(marcos).toHaveLength(1);
    expect(marcos[0].id).toBe('diagnostico:i0');
    expect(marcos[0].destino).toBeUndefined();
    expect(textoDoBotaoAbrir(marcos[0])).toBeNull();
  });

  it('o id número vira texto (a chave do marco também o escreve assim) e as pontas sem espaço', () => {
    expect(destinoDoRegistro('avaliacao_voz', { id: 42 })).toEqual({ fonte: 'avaliacao_voz', id: '42' });
    expect(destinoDoRegistro('diagnostico', { id: '  dx-1  ' })).toEqual({ fonte: 'diagnostico', id: 'dx-1' });
  });

  it('uma avaliação sem id não derruba as outras: cada uma segue com o destino do próprio id', () => {
    const { marcos } = montar({ avaliacoesVoz: [avaliacao({ id: 'a1', created_at: '2026-10-06T15:00:00+00:00' }), { created_at: '2026-10-05T15:00:00+00:00' }, avaliacao({ id: 'a3', created_at: '2026-10-04T15:00:00+00:00' })] });
    expect(marcos.map((m) => m.destino?.id)).toEqual(['a1', undefined, 'a3']);
  });
});

describe('destinoDoRegistro: a função pura, fonte por fonte', () => {
  const linha: LinhaBruta = { id: 'r-1' };

  it.each(Object.keys(NOME_DA_FONTE_DO_MARCO) as FonteDoMarco[])('fonte %s', (fonte) => {
    const esperado = fonte === 'avaliacao_voz' || fonte === 'diagnostico' ? { fonte, id: 'r-1' } : undefined;
    expect(destinoDoRegistro(fonte, linha)).toEqual(esperado);
  });

  it('só duas das fontes conhecidas têm destino', () => {
    const fontesConhecidas = Object.keys(NOME_DA_FONTE_DO_MARCO) as FonteDoMarco[];
    expect(fontesConhecidas.filter((f) => destinoDoRegistro(f, linha)).sort()).toEqual(['avaliacao_voz', 'diagnostico']);
  });
});

describe('destino: o que fica de fora continua de fora', () => {
  it('diagnóstico removido ou suspeita não gera marco, logo não gera destino', () => {
    const r = montar({ diagnosticos: [diagnostico({ id: 'x1', ativo: false }), diagnostico({ id: 'x2', tipo: 'suspeita' }), diagnostico({ id: 'x3', tipo: 'secundario' })] });
    expect(r.marcos.map((m) => m.destino?.id)).toEqual(['x3']);
    expect(r.semData).toEqual([]);
  });

  it('o relato que o paciente fez no portal não é avaliação presencial: sem marco, sem destino', () => {
    const r = montar({ avaliacoesVoz: [avaliacao({ id: 'portal-1', origem_do_relato: 'portal_paciente_historia' }), avaliacao({ id: 'pro-1', origem_do_relato: null })] });
    expect(r.marcos.map((m) => m.destino?.id)).toEqual(['pro-1']);
  });

  it('avaliação com data inválida fica fora (registros ignorados) e não ganha destino', () => {
    const r = montar({ avaliacoesVoz: [avaliacao({ id: 'a-ruim', created_at: 'ontem' })] });
    expect(r.marcos).toEqual([]);
    expect(r.ignorados).toBe(1);
  });
});

describe('o texto do botão Abrir (para o leitor de tela)', () => {
  it('avaliação: "Abrir a avaliação de 06/10/2026" (o dia do Brasil, não o de UTC)', () => {
    const [m] = montar({ avaliacoesVoz: [avaliacao({ created_at: '2026-10-06T15:00:00+00:00' })] }).marcos;
    expect(m.rotuloDoDestino).toBe('a avaliação de 06/10/2026');
    expect(textoDoBotaoAbrir(m)).toBe('Abrir a avaliação de 06/10/2026');
    // 01:30 UTC de 07/10 ainda é noite de 06/10 no Brasil.
    const [tarde] = montar({ avaliacoesVoz: [avaliacao({ created_at: '2026-10-07T01:30:00+00:00' })] }).marcos;
    expect(textoDoBotaoAbrir(tarde)).toBe('Abrir a avaliação de 06/10/2026');
  });

  it('diagnóstico: "Abrir o diagnóstico M54.5"', () => {
    const [m] = montar({ diagnosticos: [diagnostico()] }).marcos;
    expect(m.rotuloDoDestino).toBe('o diagnóstico M54.5');
    expect(textoDoBotaoAbrir(m)).toBe('Abrir o diagnóstico M54.5');
  });

  it('diagnóstico sem o código do CID: usa o nome; sem nada, só "o diagnóstico"', () => {
    const semCodigo = montar({ diagnosticos: [diagnostico({ cid_codigo: '' })] }).marcos[0];
    expect(textoDoBotaoAbrir(semCodigo)).toBe('Abrir o diagnóstico Dor lombar baixa');
    const semNada = montar({ diagnosticos: [diagnostico({ cid_codigo: null, cid_descricao: null })] }).marcos[0];
    expect(textoDoBotaoAbrir(semNada)).toBe('Abrir o diagnóstico');
  });

  it('dois diagnósticos têm dois nomes diferentes (o leitor de tela distingue um botão do outro)', () => {
    const { marcos } = montar({ diagnosticos: [diagnostico({ id: 'a', cid_codigo: 'M54.5' }), diagnostico({ id: 'b', cid_codigo: 'M54.2', data_diagnostico: '2023-01-02' })] });
    expect(new Set(marcos.map((m) => textoDoBotaoAbrir(m))).size).toBe(2);
  });

  it('marco sem destino não tem texto de botão, e destino sem o texto também não (nunca um botão sem nome)', () => {
    const base: Marco = { id: 'x', data: { iso: '2026-01-01', precisao: 'dia' }, titulo: 't', tipo: 'exame', rotuloTipo: 'Exame', fonte: 'exame_presencial', origem: 'profissional', revisado: true, natureza: 'registro' };
    expect(textoDoBotaoAbrir(base)).toBeNull();
    expect(textoDoBotaoAbrir({ ...base, rotuloDoDestino: 'o exame' })).toBeNull();
    expect(textoDoBotaoAbrir({ ...base, destino: { fonte: 'diagnostico', id: 'd' } })).toBeNull();
    expect(textoDoBotaoAbrir({ ...base, destino: { fonte: 'diagnostico', id: 'd' }, rotuloDoDestino: '' })).toBeNull();
  });
});

describe('o destino não muda o que a linha do tempo já mostrava', () => {
  it('título, data, detalhe e natureza continuam os mesmos (o destino só se soma)', () => {
    const r = montar(todas());
    expect(r.marcos.find((m) => m.id === 'avaliacao_voz:a1')).toMatchObject({ titulo: 'Avaliação presencial registrada', detalhe: 'Queixa principal: Dor lombar', data: { iso: '2026-10-06', precisao: 'dia' } });
    expect(r.marcos.find((m) => m.id === 'diagnostico:d1')).toMatchObject({ titulo: '[M54.5] Dor lombar baixa', data: { iso: '2024-05-06', precisao: 'dia' }, natureza: 'fato' });
  });
});
