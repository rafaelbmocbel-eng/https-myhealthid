import { describe, it, expect } from 'vitest';
import {
  CODIGOS_PADRAO_FATURAMENTO, MAXIMO_CARACTERES_DO_CODIGO, MAXIMO_CODIGOS_NA_GUIA, brutoDosLancamentos, formatarCodigoOficial, guiasPelaAgenda, lancamentosIguais, limiteDoCodigo, maximoNaGuia,
  mesclarCodigosComPadrao, normalizarLancamentos, ordenarParaLancamento, problemasDosLancamentos, resumoDosLancamentos,
  sessoesDosLancamentos, totalPorCodigo, type CodigoFaturavel, type GuiaLancada,
} from '@/lib/cassiFaturamento';

describe('tabela de códigos que o Rafael passou (25/10/2026)', () => {
  const por = (c: string) => CODIGOS_PADRAO_FATURAMENTO.find((x) => x.codigo === c)!;

  it('seis códigos, com código oficial, valor e limite exatamente como informados', () => {
    expect(CODIGOS_PADRAO_FATURAMENTO.map((c) => c.codigo)).toEqual(['012', '020', '144', '301', '131', '185']);
    expect([por('012').codigo_oficial, por('012').valor]).toEqual(['50000012', 57.7]);
    expect([por('020').codigo_oficial, por('020').valor]).toEqual(['50000020', 57.7]);
    expect([por('144').codigo_oficial, por('144').valor]).toEqual(['50000144', 65.62]);
    expect([por('301').codigo_oficial, por('301').valor]).toEqual(['20103301', 35.55]);
    expect([por('131').codigo_oficial, por('131').valor]).toEqual(['20103131', 67.79]);
    expect([por('185').codigo_oficial, por('185').valor]).toEqual(['31602185', 108.44]);
    expect(por('185').descricao).toBe('Estimulação elétrica transcutânea');
  });

  it('limites: 012, 020, 301 e 185 até 10 por guia; 144 só 1 por guia; 131 até 10 no mês', () => {
    expect(limiteDoCodigo('012')).toEqual({ porGuia: 10, porMes: null });
    expect(limiteDoCodigo('020')).toEqual({ porGuia: 10, porMes: null });
    expect(limiteDoCodigo('301')).toEqual({ porGuia: 10, porMes: null });
    expect(limiteDoCodigo('144')).toEqual({ porGuia: 1, porMes: null });
    expect(limiteDoCodigo('131')).toEqual({ porGuia: null, porMes: 10 });
    expect(limiteDoCodigo('185')).toEqual({ porGuia: 10, porMes: null });
  });

  it('código que não está na tabela (criado em Configurações) segue a guia da CASSI: 10 por guia', () => {
    expect(limiteDoCodigo('160')).toEqual({ porGuia: 10, porMes: null });
  });

  it('o código oficial aparece como o profissional lê', () => {
    expect(formatarCodigoOficial('50000012', '012')).toBe('5.00.00.012');
    expect(formatarCodigoOficial('20103301', '301')).toBe('2.01.03.301');
    expect(formatarCodigoOficial('2.01.03.131', '131')).toBe('2.01.03.131');
    expect(formatarCodigoOficial('31602185', '185')).toBe('3.16.02.185');
    expect(formatarCodigoOficial(undefined, '160')).toBe('160');
    expect(formatarCodigoOficial('  ', '160')).toBe('160');
  });
});

describe('mesclarCodigosComPadrao', () => {
  it('sem nada configurado, entram os seis com valor', () => {
    const r = mesclarCodigosComPadrao(undefined);
    expect(r.map((c) => [c.codigo, c.valor])).toEqual([['012', 57.7], ['020', 57.7], ['144', 65.62], ['301', 35.55], ['131', 67.79], ['185', 108.44]]);
  });

  it('o valor que o profissional configurou não é trocado; o que falta entra no fim', () => {
    const cfg: CodigoFaturavel[] = [
      { codigo: '144', descricao: 'Avaliação', valor: 70, codigo_oficial: '50000144' },
      { codigo: '012', descricao: 'Sessão', valor: 58.1, codigo_oficial: '' },
      { codigo: '185', descricao: 'Eletroterapia', valor: 97.73, codigo_oficial: '31602185' },
    ];
    const r = mesclarCodigosComPadrao(cfg);
    expect(r.find((c) => c.codigo === '144')).toMatchObject({ valor: 70, descricao: 'Avaliação' }); // descrição dele fica
    expect(r.find((c) => c.codigo === '012')).toMatchObject({ valor: 58.1, descricao: 'Sessão', codigo_oficial: '50000012' }); // oficial vazio é preenchido
    expect(r.find((c) => c.codigo === '185')).toMatchObject({ valor: 97.73 }); // código só dele continua
    expect(r.map((c) => c.codigo)).toEqual(['144', '012', '185', '020', '301', '131']);
  });

  it('código da tabela com a descrição em branco recebe a da tabela; o 185 sem configuração entra com R$ 108,44', () => {
    const r = mesclarCodigosComPadrao([{ codigo: '185', descricao: '', valor: 97.73 }]);
    expect(r.find((c) => c.codigo === '185')).toMatchObject({ valor: 97.73, descricao: 'Estimulação elétrica transcutânea', codigo_oficial: '31602185' });
    expect(mesclarCodigosComPadrao([{ codigo: '012', descricao: 'x', valor: 1 }]).find((c) => c.codigo === '185')?.valor).toBe(108.44);
  });

  it('não altera a lista recebida', () => {
    const cfg: CodigoFaturavel[] = [{ codigo: '012', descricao: '', valor: 57.7 }];
    mesclarCodigosComPadrao(cfg);
    expect(cfg).toEqual([{ codigo: '012', descricao: '', valor: 57.7 }]);
  });

  it('código repetido em Configurações aparece uma vez só ao lançar (vale o primeiro)', () => {
    const r = ordenarParaLancamento([{ codigo: '012', descricao: 'a', valor: 1 }, { codigo: '160', descricao: 'b', valor: 2 }, { codigo: '012', descricao: 'repetido', valor: 9 }]);
    expect(r.map((c) => [c.codigo, c.valor])).toEqual([['012', 1], ['160', 2]]);
  });

  it('para lançar: 012 primeiro, depois a ordem da tabela, depois os que o profissional criou', () => {
    const r = ordenarParaLancamento(mesclarCodigosComPadrao([{ codigo: '160', descricao: 'Meu código', valor: 60 }, { codigo: '144', descricao: 'x', valor: 1 }]));
    expect(r.map((c) => c.codigo)).toEqual(['012', '020', '144', '301', '131', '185', '160']);
  });
});

describe('normalizarLancamentos (defesa contra dado estranho)', () => {
  it('só aceita lista de objetos código → inteiro positivo', () => {
    expect(normalizarLancamentos(null)).toEqual([]);
    expect(normalizarLancamentos('x')).toEqual([]);
    expect(normalizarLancamentos({ '012': 3 })).toEqual([]);
    expect(normalizarLancamentos([[1, 2], 'a', null, 5])).toEqual([]);
  });

  it('limpa quantidade inválida: negativa, zero, texto, decimal e acima de 999', () => {
    expect(normalizarLancamentos([{ '012': 4.9, '020': -2, '144': 0, '301': 'abc', '131': '7', '185': 5000, ' 160 ': 2 }]))
      .toEqual([{ '012': 4, '131': 7, '185': 999, '160': 2 }]);
  });

  it('os tetos do banco valem no valor exato: código de 12 caracteres passa, de 13 não; 30 códigos por guia passam, o 31º não', () => {
    expect([MAXIMO_CARACTERES_DO_CODIGO, MAXIMO_CODIGOS_NA_GUIA]).toEqual([12, 30]); // os mesmos números do CHECK do banco
    const doze = 'x'.repeat(12);
    expect(normalizarLancamentos([{ [doze]: 2 }])).toEqual([{ [doze]: 2 }]);
    expect(normalizarLancamentos([{ [doze + 'x']: 2, '012': 1 }])).toEqual([{ '012': 1 }]);
    const guia = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, 1]));
    expect(Object.keys(normalizarLancamentos([guia(MAXIMO_CODIGOS_NA_GUIA)])[0])).toHaveLength(MAXIMO_CODIGOS_NA_GUIA);
    expect(Object.keys(normalizarLancamentos([guia(MAXIMO_CODIGOS_NA_GUIA + 1)])[0])).toHaveLength(MAXIMO_CODIGOS_NA_GUIA);
  });

  it('guia sem nada some; no máximo 6 guias por cliente no mês', () => {
    expect(normalizarLancamentos([{ '012': 0 }, {}, { '012': 2 }])).toEqual([{ '012': 2 }]);
    expect(normalizarLancamentos(Array.from({ length: 9 }, () => ({ '012': 1 })))).toHaveLength(6);
  });
});

describe('lancamentosIguais', () => {
  it('compara guia a guia por código e quantidade, sem depender da ordem em que as chaves foram digitadas', () => {
    expect(lancamentosIguais([{ '012': 4, '020': 2 }], [{ '020': 2, '012': 4 }])).toBe(true);
    expect(lancamentosIguais([{ '012': 4 }], [{ '012': 5 }])).toBe(false);
    expect(lancamentosIguais([{ '012': 4 }, { '144': 1 }], [{ '144': 1 }, { '012': 4 }])).toBe(false); // a ordem das GUIAS importa
    expect(lancamentosIguais([], [])).toBe(true);
    expect(lancamentosIguais([{ '012': 1 }], [])).toBe(false);
  });
});

describe('limites por guia e por mês', () => {
  it('quantidade dentro do limite não gera problema', () => {
    expect(problemasDosLancamentos([{ '012': 10, '144': 1, '301': 10 }, { '131': 10 }])).toEqual([]);
  });

  it('acima do limite da guia: 012 com 11, 144 com 2, 185 com 11, código sem regra com 11', () => {
    const p = problemasDosLancamentos([{ '012': 11, '144': 2, '185': 11, '160': 11 }]);
    expect(p.map((x) => [x.tipo, x.codigo, x.informado, x.limite]).sort()).toEqual([
      ['guia', '012', 11, 10], ['guia', '144', 2, 1], ['guia', '185', 11, 10], ['guia', '160', 11, 10],
    ].sort());
  });

  it('o limite POR GUIA vale em todas as guias, não só na primeira', () => {
    expect(problemasDosLancamentos([{ '012': 5 }, { '012': 11 }]).map((p) => [p.tipo, p.guia, p.codigo])).toEqual([['guia', 1, '012']]);
    expect(maximoNaGuia([{ '012': 3 }, {}], 1, '012')).toBe(10);
    expect(maximoNaGuia([{ '144': 1 }, {}], 1, '144')).toBe(1);
  });

  it('131 vale no mês, somando as guias: 6 + 5 passa de 10; 6 + 4 não', () => {
    expect(problemasDosLancamentos([{ '131': 6 }, { '131': 5 }])).toEqual([{ tipo: 'mes', codigo: '131', informado: 11, limite: 10 }]);
    expect(problemasDosLancamentos([{ '131': 6 }, { '131': 4 }])).toEqual([]);
  });

  it('012 em duas guias pode passar de 10 no total (cada guia tem o seu limite)', () => {
    expect(problemasDosLancamentos([{ '012': 10 }, { '012': 10 }])).toEqual([]);
  });

  it('maximoNaGuia diz quanto ainda cabe', () => {
    expect(maximoNaGuia([{}], 0, '012')).toBe(10);
    expect(maximoNaGuia([{}], 0, '144')).toBe(1);
    expect(maximoNaGuia([{ '185': 4 }], 0, '185')).toBe(10);
    expect(maximoNaGuia([{ '131': 4 }, {}], 1, '131')).toBe(6);
    expect(maximoNaGuia([{ '131': 4 }, { '131': 3 }], 1, '131')).toBe(6); // a própria guia não conta contra si mesma
    expect(maximoNaGuia([{ '131': 10 }, {}], 1, '131')).toBe(0);
    expect(maximoNaGuia([{}], 0, '999')).toBe(10);
  });
});

describe('valores do lançamento', () => {
  const valorDe = (c: string) => ({ '012': 57.7, '020': 57.7, '144': 65.62, '301': 35.55, '131': 67.79, '185': 108.44 } as Record<string, number>)[c] ?? 0;

  it('10 sessões de 012 valem R$ 577,00 (sem ruído de ponto flutuante)', () => {
    expect(brutoDosLancamentos([{ '012': 10 }], valorDe)).toBe(577);
  });

  it('soma código a código em todas as guias', () => {
    // 012 × (10 + 4) + 144 × 1 + 301 × 2 = 807,80 + 65,62 + 71,10
    expect(brutoDosLancamentos([{ '012': 10, '144': 1 }, { '012': 4, '301': 2 }], valorDe)).toBe(944.52);
  });

  it('a soma é em centavos: 3 × 67,79 = 203,37 e 3 × 35,55 = 106,65, sem ruído de ponto flutuante', () => {
    expect(brutoDosLancamentos([{ '131': 3 }], () => 67.79)).toBe(203.37);
    expect(brutoDosLancamentos([{ '301': 3 }], () => 35.55)).toBe(106.65);
  });

  it('185 vale R$ 108,44 por sessão: 3 sessões = R$ 325,32', () => {
    expect(brutoDosLancamentos([{ '185': 3 }], valorDe)).toBe(325.32);
  });

  it('código sem valor cadastrado vale zero; lista vazia vale zero', () => {
    expect(brutoDosLancamentos([{ '777': 3 }], valorDe)).toBe(0);
    expect(brutoDosLancamentos([], valorDe)).toBe(0);
  });

  it('sessões = soma das quantidades menos a consulta (144)', () => {
    expect(sessoesDosLancamentos([{ '012': 10, '144': 1 }, { '301': 2, '131': 3 }])).toBe(15);
  });

  it('totais por código e resumo legível', () => {
    const guias: GuiaLancada[] = [{ '301': 2, '012': 10 }, { '012': 4 }];
    expect(totalPorCodigo(guias)).toEqual({ '301': 2, '012': 14 });
    expect(resumoDosLancamentos(guias)).toBe('012 × 14 · 301 × 2 · 2 guias');
    expect(resumoDosLancamentos([{ '131': 3, '144': 1 }])).toBe('144 × 1 · 131 × 3');
    expect(resumoDosLancamentos([])).toBe('');
  });
});

describe('guiasPelaAgenda', () => {
  it('sessões da agenda viram guias de até 10 do código padrão', () => {
    expect(guiasPelaAgenda(0)).toEqual([]);
    expect(guiasPelaAgenda(-3)).toEqual([]);
    expect(guiasPelaAgenda(7)).toEqual([{ '012': 7 }]);
    expect(guiasPelaAgenda(10)).toEqual([{ '012': 10 }]);
    expect(guiasPelaAgenda(14)).toEqual([{ '012': 10 }, { '012': 4 }]);
    expect(guiasPelaAgenda(20)).toEqual([{ '012': 10 }, { '012': 10 }]);
  });

  it('cabem 6 guias de 10 por mês: acima de 60 sessões o excedente fica de fora (a tela avisa)', () => {
    const soma = (gs: GuiaLancada[]) => gs.reduce((t, g) => t + (g['012'] || 0), 0);
    expect(guiasPelaAgenda(60)).toHaveLength(6);
    expect(soma(guiasPelaAgenda(60))).toBe(60);
    expect(guiasPelaAgenda(70)).toHaveLength(6);
    expect(soma(guiasPelaAgenda(70))).toBe(60);
  });

  it('o resultado sempre respeita os limites', () => {
    for (const n of [1, 9, 10, 11, 19, 20, 21, 35, 60]) expect(problemasDosLancamentos(guiasPelaAgenda(n))).toEqual([]);
  });
});
