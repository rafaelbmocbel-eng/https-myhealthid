import { describe, it, expect } from 'vitest';
import {
  CODIGOS_PADRAO_FATURAMENTO, MAXIMO_CARACTERES_DO_CODIGO, MAXIMO_CODIGOS_NA_GUIA, MODELO_DA_GUIA, brutoDosLancamentos, formatarCodigoOficial, guiaDoModelo, guiasPelaAgenda,
  lancamentosIguais, limiteDoCodigo, maximoNaGuia, mesclarCodigosComPadrao, normalizarLancamentos, ordenarParaLancamento, problemasDosLancamentos, quantidadeDoModelo,
  quantidadeParaMarcar, resumoDosLancamentos, sessoesDosLancamentos, totalPorCodigo, type CodigoFaturavel, type GuiaLancada, type LinhaDoModelo,
} from '@/lib/cassiFaturamento';

describe('tabela de códigos que o Rafael passou (25/10/2026; o 160 entrou em 15/11/2026)', () => {
  const por = (c: string) => CODIGOS_PADRAO_FATURAMENTO.find((x) => x.codigo === c)!;

  it('sete códigos, com código oficial, valor e limite exatamente como informados', () => {
    expect(CODIGOS_PADRAO_FATURAMENTO.map((c) => c.codigo)).toEqual(['012', '020', '144', '301', '131', '185', '160']);
    expect([por('012').codigo_oficial, por('012').valor]).toEqual(['50000012', 57.7]);
    expect([por('020').codigo_oficial, por('020').valor]).toEqual(['50000020', 57.7]);
    expect([por('144').codigo_oficial, por('144').valor]).toEqual(['50000144', 65.62]);
    expect([por('301').codigo_oficial, por('301').valor]).toEqual(['20103301', 35.55]);
    expect([por('131').codigo_oficial, por('131').valor]).toEqual(['20103131', 67.79]);
    expect([por('185').codigo_oficial, por('185').valor]).toEqual(['31602185', 108.44]);
    expect(por('185').descricao).toBe('Estimulação elétrica transcutânea');
    expect([por('160').codigo_oficial, por('160').valor]).toEqual(['50000160', 31.97]);
  });

  it('160: atendimento fisioterapêutico ambulatorial, R$ 31,97, até 10 por guia (a descrição é a do pedido do Rafael)', () => {
    expect(por('160').descricao).toBe('Atendimento fisioterapêutico ambulatorial ao paciente com disfunção decorrente de alterações do sistema músculo-esquelético');
    expect(por('160').valor).toBe(31.97);
    expect(limiteDoCodigo('160')).toEqual({ porGuia: 10, porMes: null });
    expect(formatarCodigoOficial(por('160').codigo_oficial, '160')).toBe('5.00.00.160');
  });

  it('limites: 012, 020, 301, 185 e 160 até 10 por guia; 144 só 1 por guia; 131 até 10 no mês', () => {
    expect(limiteDoCodigo('012')).toEqual({ porGuia: 10, porMes: null });
    expect(limiteDoCodigo('020')).toEqual({ porGuia: 10, porMes: null });
    expect(limiteDoCodigo('301')).toEqual({ porGuia: 10, porMes: null });
    expect(limiteDoCodigo('144')).toEqual({ porGuia: 1, porMes: null });
    expect(limiteDoCodigo('131')).toEqual({ porGuia: null, porMes: 10 });
    expect(limiteDoCodigo('185')).toEqual({ porGuia: 10, porMes: null });
    expect(limiteDoCodigo('160')).toEqual({ porGuia: 10, porMes: null });
  });

  it('código que não está na tabela (criado em Configurações) segue a guia da CASSI: 10 por guia', () => {
    expect(limiteDoCodigo('777')).toEqual({ porGuia: 10, porMes: null });
  });

  it('o código oficial aparece como o profissional lê', () => {
    expect(formatarCodigoOficial('50000012', '012')).toBe('5.00.00.012');
    expect(formatarCodigoOficial('20103301', '301')).toBe('2.01.03.301');
    expect(formatarCodigoOficial('2.01.03.131', '131')).toBe('2.01.03.131');
    expect(formatarCodigoOficial('31602185', '185')).toBe('3.16.02.185');
    expect(formatarCodigoOficial('50000160', '160')).toBe('5.00.00.160');
    expect(formatarCodigoOficial(undefined, '777')).toBe('777');
    expect(formatarCodigoOficial('  ', '777')).toBe('777');
  });
});

describe('mesclarCodigosComPadrao', () => {
  it('sem nada configurado, entram os sete com valor (o 160 vale R$ 31,97)', () => {
    const r = mesclarCodigosComPadrao(undefined);
    expect(r.map((c) => [c.codigo, c.valor])).toEqual([['012', 57.7], ['020', 57.7], ['144', 65.62], ['301', 35.55], ['131', 67.79], ['185', 108.44], ['160', 31.97]]);
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
    expect(r.map((c) => c.codigo)).toEqual(['144', '012', '185', '020', '301', '131', '160']);
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
    const r = ordenarParaLancamento([{ codigo: '012', descricao: 'a', valor: 1 }, { codigo: '777', descricao: 'b', valor: 2 }, { codigo: '012', descricao: 'repetido', valor: 9 }]);
    expect(r.map((c) => [c.codigo, c.valor])).toEqual([['012', 1], ['777', 2]]);
  });

  it('para lançar: a ordem do modelo (144, 012, 160, 185, 131, 301, 020), depois os que o profissional criou', () => {
    const r = ordenarParaLancamento(mesclarCodigosComPadrao([{ codigo: '777', descricao: 'Meu código', valor: 60 }, { codigo: '144', descricao: 'x', valor: 1 }]));
    expect(r.map((c) => c.codigo)).toEqual(['144', '012', '160', '185', '131', '301', '020', '777']);
  });

  it('a ordem do modelo vale mesmo com a configuração salva em outra ordem', () => {
    const embaralhado = [{ codigo: '020', descricao: 'a', valor: 1 }, { codigo: '301', descricao: 'b', valor: 1 }, { codigo: '012', descricao: 'c', valor: 1 }];
    expect(ordenarParaLancamento(mesclarCodigosComPadrao(embaralhado)).map((c) => c.codigo)).toEqual(['144', '012', '160', '185', '131', '301', '020']);
  });
});

describe('modelo da guia (pedido do Rafael, 03/11/2026; 144, 012 e 160 no topo desde 15/11/2026)', () => {
  it('ordem, quantidade pronta e o que já vem marcado, exatamente como pedido', () => {
    expect(MODELO_DA_GUIA).toEqual([
      { codigo: '144', quantidade: 1, marcado: true },
      { codigo: '012', quantidade: 10, marcado: true },
      { codigo: '160', quantidade: 10, marcado: true },
      { codigo: '185', quantidade: 10, marcado: false },
      { codigo: '131', quantidade: 10, marcado: false },
      { codigo: '301', quantidade: 10, marcado: false },
      { codigo: '020', quantidade: 10, marcado: false },
    ]);
  });

  it('cobre os mesmos sete códigos da tabela da CASSI, sem repetir nenhum', () => {
    expect(MODELO_DA_GUIA.map((m) => m.codigo).sort()).toEqual(CODIGOS_PADRAO_FATURAMENTO.map((c) => c.codigo).sort());
  });

  it('nenhuma quantidade pronta passa do limite do código por guia ou no mês', () => {
    for (const m of MODELO_DA_GUIA) {
      const { porGuia, porMes } = limiteDoCodigo(m.codigo);
      expect(m.quantidade, m.codigo).toBeLessThanOrEqual(Math.min(porGuia ?? 999, porMes ?? 999));
    }
  });

  it('a guia do modelo traz só os marcados: 144 × 1, 012 × 10 e 160 × 10; e é um objeto novo a cada chamada', () => {
    expect(guiaDoModelo()).toEqual({ '144': 1, '012': 10, '160': 10 });
    const a = guiaDoModelo();
    a['012'] = 3;
    expect(guiaDoModelo()['012']).toBe(10);
    expect(guiaDoModelo()).not.toBe(guiaDoModelo());
  });

  it('a guia do modelo é um lançamento válido (sem problema de limite) e vale R$ 962,32', () => {
    expect(problemasDosLancamentos([guiaDoModelo()])).toEqual([]);
    expect(normalizarLancamentos([guiaDoModelo()])).toEqual([guiaDoModelo()]);
    const valores: Record<string, number> = { '144': 65.62, '012': 57.7, '160': 31.97 };
    expect(brutoDosLancamentos([guiaDoModelo()], (c) => valores[c] ?? 0)).toBe(962.32);
  });

  it('quantidadeDoModelo devolve a quantidade pronta e 0 para código fora do modelo', () => {
    expect(quantidadeDoModelo('144')).toBe(1);
    expect(quantidadeDoModelo('131')).toBe(10);
    expect(quantidadeDoModelo('160')).toBe(10);
    expect(quantidadeDoModelo('777')).toBe(0);
  });

  it('o resumo do lançamento segue a mesma ordem: 144 × 1 · 012 × 10 · 160 × 10', () => {
    expect(resumoDosLancamentos([guiaDoModelo()])).toBe('144 × 1 · 012 × 10 · 160 × 10');
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
    expect(lancamentosIguais([{ '012': 4 }], [{ '020': 4 }])).toBe(false); // mesma quantidade em outro código
    expect(lancamentosIguais([], [])).toBe(true);
    expect(lancamentosIguais([{ '012': 1 }], [])).toBe(false);
  });
});

describe('limites por guia e por mês', () => {
  it('quantidade dentro do limite não gera problema', () => {
    expect(problemasDosLancamentos([{ '012': 10, '144': 1, '301': 10 }, { '131': 10 }])).toEqual([]);
  });

  it('acima do limite da guia: 012 com 11, 144 com 2, 185 com 11, 160 com 11, código sem regra com 11', () => {
    const p = problemasDosLancamentos([{ '012': 11, '144': 2, '185': 11, '160': 11, '777': 11 }]);
    expect(p.map((x) => [x.tipo, x.codigo, x.informado, x.limite]).sort()).toEqual([
      ['guia', '012', 11, 10], ['guia', '144', 2, 1], ['guia', '185', 11, 10], ['guia', '160', 11, 10], ['guia', '777', 11, 10],
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
  const valorDe = (c: string) => ({ '012': 57.7, '020': 57.7, '144': 65.62, '301': 35.55, '131': 67.79, '185': 108.44, '160': 31.97 } as Record<string, number>)[c] ?? 0;

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

describe('código 160 (5.00.00.160): R$ 31,97, até 10 sessões por guia', () => {
  const valorDe = (c: string) => mesclarCodigosComPadrao([]).find((x) => x.codigo === c)?.valor ?? 0;

  it('10 sessões valem R$ 319,70 e 3 valem R$ 95,91, sem ruído de ponto flutuante', () => {
    expect(brutoDosLancamentos([{ '160': 10 }], valorDe)).toBe(319.7);
    expect(brutoDosLancamentos([{ '160': 3 }], valorDe)).toBe(95.91);
    expect(brutoDosLancamentos([{ '160': 7 }, { '160': 10 }], valorDe)).toBe(543.49);
  });

  it('conta como sessão (só a consulta 144 não conta)', () => {
    expect(sessoesDosLancamentos([{ '160': 10, '144': 1 }])).toBe(10);
    expect(sessoesDosLancamentos([{ '160': 4 }, { '160': 6 }])).toBe(10);
  });

  it('o limite é 10 por guia, em todas as guias: 10 passa, 11 não; cabe 10 e não cabe mais', () => {
    expect(problemasDosLancamentos([{ '160': 10 }, { '160': 10 }])).toEqual([]);
    expect(problemasDosLancamentos([{ '160': 10 }, { '160': 11 }])).toEqual([{ tipo: 'guia', guia: 1, codigo: '160', informado: 11, limite: 10 }]);
    expect(maximoNaGuia([{ '160': 3 }, {}], 1, '160')).toBe(10);
  });

  it('entra na lista de códigos mesmo para quem nunca o configurou, com o valor da tabela e o código oficial 5.00.00.160', () => {
    const c = mesclarCodigosComPadrao([{ codigo: '012', descricao: 'x', valor: 1 }]).find((x) => x.codigo === '160')!;
    expect(c.valor).toBe(31.97);
    expect(formatarCodigoOficial(c.codigo_oficial, c.codigo)).toBe('5.00.00.160');
  });
});

describe('valor da tabela como reserva (código da tabela sem valor positivo configurado)', () => {
  const valorDoCodigo = (cfg: CodigoFaturavel[], codigo: string) => mesclarCodigosComPadrao(cfg).find((c) => c.codigo === codigo)?.valor;

  it.each([
    ['zero', 0], ['negativo', -5], ['NaN', Number.NaN], ['infinito', Number.POSITIVE_INFINITY],
    ['ausente', undefined], ['nulo', null], ['texto', 'abc'], ['texto vazio', ''],
  ])('valor %s no código da tabela usa o valor da tabela (160 → R$ 31,97)', (_nome, valor) => {
    expect(valorDoCodigo([{ codigo: '160', descricao: 'Sessão 160', valor: valor as unknown as number }], '160')).toBe(31.97);
  });

  it('vale para qualquer código da tabela: 012 sem valor volta a R$ 57,70', () => {
    expect(valorDoCodigo([{ codigo: '012', descricao: 'Sessão', valor: 0 }], '012')).toBe(57.7);
  });

  it('valor positivo configurado NUNCA é trocado, mesmo diferente da tabela (160 com 60 continua 60)', () => {
    expect(valorDoCodigo([{ codigo: '160', descricao: 'Sessão 160', valor: 60 }], '160')).toBe(60);
    expect(valorDoCodigo([{ codigo: '160', descricao: 'x', valor: 0.01 }], '160')).toBe(0.01);
    expect(valorDoCodigo([{ codigo: '160', descricao: 'x', valor: 31.97 }], '160')).toBe(31.97);
  });

  it('valor positivo que veio como texto numérico vira número (e não é trocado pelo da tabela)', () => {
    expect(valorDoCodigo([{ codigo: '160', descricao: 'x', valor: '45.5' as unknown as number }], '160')).toBe(45.5);
  });

  it('valor escrito com vírgula decimal vale como o número que o profissional quis (nunca é trocado pelo da tabela)', () => {
    expect(valorDoCodigo([{ codigo: '301', descricao: 'x', valor: '40,00' as unknown as number }], '301')).toBe(40);
    expect(valorDoCodigo([{ codigo: '301', descricao: 'x', valor: '1.234,50' as unknown as number }], '301')).toBe(1234.5);
    expect(valorDoCodigo([{ codigo: '301', descricao: 'x', valor: '0,00' as unknown as number }], '301')).toBe(35.55);
    expect(valorDoCodigo([{ codigo: '301', descricao: 'x', valor: '1,5,5' as unknown as number }], '301')).toBe(35.55);
  });

  it('código FORA da tabela segue como está, mesmo com valor zero', () => {
    expect(valorDoCodigo([{ codigo: '777', descricao: 'Meu código', valor: 0 }], '777')).toBe(0);
    expect(valorDoCodigo([{ codigo: '777', descricao: 'Meu código', valor: -1 }], '777')).toBe(-1);
  });

  it('só o valor muda: descrição dele, oficial dele e a escolha de pré-preenchimento ficam', () => {
    const r = mesclarCodigosComPadrao([{ codigo: '160', descricao: 'Minha descrição', valor: 0, codigo_oficial: '99', pre_preenchido: { quantidade: 4 } }]).find((c) => c.codigo === '160');
    expect(r).toEqual({ codigo: '160', descricao: 'Minha descrição', valor: 31.97, codigo_oficial: '99', pre_preenchido: { quantidade: 4 } });
  });
});

describe('160 salvo com a descrição errada do catálogo antigo do "Pedir guias" ("Sessão de psicomotricidade")', () => {
  const descricaoDo = (cfg: CodigoFaturavel[], codigo: string) => mesclarCodigosComPadrao(cfg).find((c) => c.codigo === codigo)?.descricao;
  const OFICIAL = 'Atendimento fisioterapêutico ambulatorial ao paciente com disfunção decorrente de alterações do sistema músculo-esquelético';

  it.each([
    'Sessão de psicomotricidade', 'sessão de psicomotricidade', 'SESSÃO DE PSICOMOTRICIDADE', 'Sessao de psicomotricidade',
    '  Sessão   de psicomotricidade  ', 'Sessão de psicomotricidade.',
  ])('o texto antigo "%s" no 160 passa a ser o oficial, e o valor zero cai no da tabela', (antigo) => {
    const r = mesclarCodigosComPadrao([{ codigo: '160', descricao: antigo, valor: 0 }]).find((c) => c.codigo === '160');
    expect(r?.descricao).toBe(OFICIAL);
    expect(r?.valor).toBe(31.97);
  });

  it('um texto que o profissional escreveu (qualquer outro) NÃO é trocado', () => {
    expect(descricaoDo([{ codigo: '160', descricao: 'Fisioterapia musculoesquelética', valor: 0 }], '160')).toBe('Fisioterapia musculoesquelética');
    expect(descricaoDo([{ codigo: '160', descricao: 'Sessão de psicomotricidade individual', valor: 0 }], '160')).toBe('Sessão de psicomotricidade individual');
  });

  it('só o 160 tem essa troca: o 012 com o mesmo texto antigo fica como o profissional salvou', () => {
    expect(descricaoDo([{ codigo: '012', descricao: 'Sessão de psicomotricidade', valor: 57.7 }], '012')).toBe('Sessão de psicomotricidade');
  });

  it('a troca não mexe no valor positivo que ele escolheu, no oficial nem na escolha de pré-preenchimento', () => {
    const r = mesclarCodigosComPadrao([{ codigo: '160', descricao: 'Sessão de psicomotricidade', valor: 60, codigo_oficial: '99', pre_preenchido: { quantidade: 4 } }]).find((c) => c.codigo === '160');
    expect(r).toEqual({ codigo: '160', descricao: OFICIAL, valor: 60, codigo_oficial: '99', pre_preenchido: { quantidade: 4 } });
  });
});

describe('modelo da guia como argumento (o profissional pode escolher outro)', () => {
  const meu: LinhaDoModelo[] = [
    { codigo: '301', quantidade: 3, marcado: true },
    { codigo: '144', quantidade: 1, marcado: true },
    { codigo: '012', quantidade: 10, marcado: false },
  ];

  it('guiaDoModelo traz só os marcados do modelo dele, com as quantidades dele', () => {
    expect(guiaDoModelo(meu)).toEqual({ '301': 3, '144': 1 });
    expect(guiaDoModelo([])).toEqual({});
  });

  it('quantidadeDoModelo e quantidadeParaMarcar usam o modelo dele', () => {
    expect(quantidadeDoModelo('301', meu)).toBe(3);
    expect(quantidadeDoModelo('160', meu)).toBe(0);
    expect(quantidadeParaMarcar('301', meu)).toBe(3);
    expect(quantidadeParaMarcar('012', meu)).toBe(10); // no modelo, mesmo desmarcado
  });

  it('quantidadeParaMarcar fora do modelo: 10, ou o limite por guia do código (144 só 1; 131 pelo mês: 10; código criado: 10)', () => {
    expect(quantidadeParaMarcar('144', [])).toBe(1);
    expect(quantidadeParaMarcar('131', [])).toBe(10);
    expect(quantidadeParaMarcar('160', [])).toBe(10);
    expect(quantidadeParaMarcar('777', [])).toBe(10);
    expect(quantidadeParaMarcar('777')).toBe(10);
  });

  it('ordenarParaLancamento põe primeiro a ordem do modelo dele, depois o resto da tabela (na ordem da tabela), depois os que ele criou', () => {
    const lista = mesclarCodigosComPadrao([{ codigo: '777', descricao: 'Meu', valor: 5 }]);
    expect(ordenarParaLancamento(lista, meu).map((c) => c.codigo)).toEqual(['301', '144', '012', '020', '131', '185', '160', '777']);
  });

  it('o resumo pode seguir o modelo dele; sem ele segue o padrão', () => {
    const guias: GuiaLancada[] = [{ '144': 1, '012': 10, '301': 3 }];
    expect(resumoDosLancamentos(guias, meu)).toBe('301 × 3 · 144 × 1 · 012 × 10');
    expect(resumoDosLancamentos(guias)).toBe('144 × 1 · 012 × 10 · 301 × 3');
  });
});
