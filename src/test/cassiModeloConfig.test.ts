import { describe, it, expect } from 'vitest';
import {
  MODELO_DA_GUIA, mesclarCodigosComPadrao, ordenarParaLancamento, type CodigoFaturavel,
} from '@/lib/cassiFaturamento';
import {
  ConfiguracaoNaoSalva, codigosParaSalvar, escolhaDoModelo, escolhaIgualAoPadrao, escolhasIguais, limiteDaQuantidadePreenchida, modeloDaConfiguracao,
  type EscolhaDoModelo,
} from '@/lib/cassiModeloConfig';

const cod = (codigo: string, extra: Partial<CodigoFaturavel> = {}): CodigoFaturavel => ({ codigo, descricao: `Código ${codigo}`, valor: 10, ...extra });
const catalogo = mesclarCodigosComPadrao([]); // os sete da tabela, sem escolha nenhuma

describe('modeloDaConfiguracao: o que já vem marcado numa guia nova', () => {
  it('ninguém com a escolha gravada: vale o modelo padrão (144 × 1, 012 × 10 e 160 × 10 marcados; depois 185, 131, 301, 020)', () => {
    const m = modeloDaConfiguracao(catalogo);
    expect(m).toEqual(MODELO_DA_GUIA);
    expect(m.filter((l) => l.marcado).map((l) => [l.codigo, l.quantidade])).toEqual([['144', 1], ['012', 10], ['160', 10]]);
    expect(m.filter((l) => !l.marcado).map((l) => l.codigo)).toEqual(['185', '131', '301', '020']);
  });

  it('sem configuração nenhuma (nada, undefined ou lista vazia) não há código no modelo', () => {
    expect(modeloDaConfiguracao(undefined)).toEqual([]);
    expect(modeloDaConfiguracao(null)).toEqual([]);
    expect(modeloDaConfiguracao([])).toEqual([]);
  });

  it('o modelo padrão devolvido é uma cópia: mexer nele não estraga o padrão', () => {
    const m = modeloDaConfiguracao(catalogo);
    m[0].quantidade = 7;
    expect(MODELO_DA_GUIA[0].quantidade).toBe(1);
  });

  it('código do modelo padrão que não está na lista de códigos fica de fora', () => {
    const semOito = catalogo.filter((c) => c.codigo !== '160');
    expect(modeloDaConfiguracao(semOito).map((l) => l.codigo)).toEqual(['144', '012', '185', '131', '301', '020']);
  });

  it('com a escolha em algum código vale o que ele escolheu: marcados na ordem da lista, depois os desmarcados', () => {
    const lista = [
      cod('301', { pre_preenchido: { quantidade: 3 } }),
      cod('012', { pre_preenchido: null }),
      cod('144', { pre_preenchido: { quantidade: 1 } }),
      cod('777'), // sem a chave: não vem marcado
    ];
    expect(modeloDaConfiguracao(lista)).toEqual([
      { codigo: '301', quantidade: 3, marcado: true },
      { codigo: '144', quantidade: 1, marcado: true },
      { codigo: '012', quantidade: 10, marcado: false },
      { codigo: '777', quantidade: 10, marcado: false },
    ]);
  });

  it('a escolha "nenhum marcado" (todos null) é uma escolha: a guia nova vem vazia, não volta ao padrão', () => {
    const lista = catalogo.map((c) => ({ ...c, pre_preenchido: null }));
    expect(modeloDaConfiguracao(lista).some((l) => l.marcado)).toBe(false);
    expect(modeloDaConfiguracao(lista)).toHaveLength(7);
  });

  it('basta UM código ter a chave para valer a escolha (o 160 que entrou depois, sem a chave, não vem marcado)', () => {
    const lista = [cod('144', { pre_preenchido: { quantidade: 1 } }), cod('160')];
    expect(modeloDaConfiguracao(lista).filter((l) => l.marcado).map((l) => l.codigo)).toEqual(['144']);
  });

  it('quantidade acima do limite do código é limitada ao limite (144 só 1; 012 até 10; 131 até 10 no mês)', () => {
    const lista = [
      cod('144', { pre_preenchido: { quantidade: 5 } }), cod('012', { pre_preenchido: { quantidade: 99 } }), cod('131', { pre_preenchido: { quantidade: 30 } }),
      cod('777', { pre_preenchido: { quantidade: 40 } }),
    ];
    expect(modeloDaConfiguracao(lista).map((l) => [l.codigo, l.quantidade])).toEqual([['144', 1], ['012', 10], ['131', 10], ['777', 10]]);
  });

  it('quantidade inválida (zero, negativa, texto, vazia, sem o campo) vira a do padrão do código; decimal é arredondado para baixo', () => {
    const q = (quantidade: unknown) => modeloDaConfiguracao([cod('012', { pre_preenchido: { quantidade } as { quantidade: number } })])[0].quantidade;
    expect(q(0)).toBe(10);
    expect(q(-3)).toBe(10);
    expect(q('abc')).toBe(10);
    expect(q(undefined)).toBe(10);
    expect(q(Number.NaN)).toBe(10);
    expect(q(4.9)).toBe(4);
    expect(q('6')).toBe(6);
    expect(modeloDaConfiguracao([cod('144', { pre_preenchido: { quantidade: 0 } })])[0].quantidade).toBe(1);
    expect(modeloDaConfiguracao([cod('777', { pre_preenchido: {} as { quantidade: number } })])[0].quantidade).toBe(10);
  });

  it('código repetido vale uma vez só (o primeiro) e código em branco é ignorado', () => {
    const lista = [cod('012', { pre_preenchido: { quantidade: 4 } }), cod('012', { pre_preenchido: { quantidade: 9 } }), cod('  '), cod('')];
    expect(modeloDaConfiguracao(lista)).toEqual([{ codigo: '012', quantidade: 4, marcado: true }]);
  });

  it('dado estranho na lista (nulo, texto) não quebra', () => {
    const lista = [null, 'x', cod('012', { pre_preenchido: { quantidade: 2 } })] as unknown as CodigoFaturavel[];
    expect(modeloDaConfiguracao(lista)).toEqual([{ codigo: '012', quantidade: 2, marcado: true }]);
  });

  it('pre_preenchido que não é objeto (true, número, texto) conta como a escolha de não marcar', () => {
    const lista = [cod('012', { pre_preenchido: true as unknown as null }), cod('144', { pre_preenchido: { quantidade: 1 } })];
    expect(modeloDaConfiguracao(lista).map((l) => [l.codigo, l.marcado])).toEqual([['144', true], ['012', false]]);
  });

  it('o limite da quantidade pré-preenchida segue o limite por guia (131: o do mês)', () => {
    expect([limiteDaQuantidadePreenchida('144'), limiteDaQuantidadePreenchida('012'), limiteDaQuantidadePreenchida('160'), limiteDaQuantidadePreenchida('131'), limiteDaQuantidadePreenchida('777')]).toEqual([1, 10, 10, 10, 10]);
  });

  it('o catálogo de lançamento sai na ordem do modelo dele', () => {
    const lista = [cod('301', { pre_preenchido: { quantidade: 3 } }), cod('160', { pre_preenchido: { quantidade: 10 } }), cod('144', { pre_preenchido: null })];
    expect(ordenarParaLancamento(lista, modeloDaConfiguracao(lista)).map((c) => c.codigo)).toEqual(['301', '160', '144']);
  });
});

describe('escolhaDoModelo e comparações', () => {
  it('escolhaDoModelo guarda só os marcados, na ordem', () => {
    expect(escolhaDoModelo(MODELO_DA_GUIA)).toEqual([{ codigo: '144', quantidade: 1 }, { codigo: '012', quantidade: 10 }, { codigo: '160', quantidade: 10 }]);
  });

  it('escolhasIguais compara código, quantidade e ordem', () => {
    const a: EscolhaDoModelo = [{ codigo: '144', quantidade: 1 }, { codigo: '012', quantidade: 10 }];
    expect(escolhasIguais(a, a.map((e) => ({ ...e })))).toBe(true);
    expect(escolhasIguais(a, [a[1], a[0]])).toBe(false);
    expect(escolhasIguais(a, [{ codigo: '144', quantidade: 1 }, { codigo: '012', quantidade: 9 }])).toBe(false);
    expect(escolhasIguais(a, [a[0]])).toBe(false);
    expect(escolhasIguais([], [])).toBe(true);
  });

  it('escolhaIgualAoPadrao: só 144 × 1, 012 × 10 e 160 × 10 nessa ordem', () => {
    expect(escolhaIgualAoPadrao(escolhaDoModelo(MODELO_DA_GUIA))).toBe(true);
    expect(escolhaIgualAoPadrao([{ codigo: '012', quantidade: 10 }, { codigo: '144', quantidade: 1 }, { codigo: '160', quantidade: 10 }])).toBe(false);
    expect(escolhaIgualAoPadrao([{ codigo: '144', quantidade: 1 }, { codigo: '012', quantidade: 10 }, { codigo: '160', quantidade: 9 }])).toBe(false);
    expect(escolhaIgualAoPadrao([])).toBe(false);
  });
});

describe('codigosParaSalvar: a lista que vai para cassi_config.codigos', () => {
  const doBanco = [
    { codigo: '144', descricao: 'Consulta', valor: 70, codigo_oficial: '50000144' },
    { codigo: '012', descricao: 'Sessão', valor: 58.1, codigo_oficial: '50000012' },
    { codigo: '185', descricao: 'Eletro', valor: 97.73, codigo_oficial: '31602185' },
    { codigo: '160', descricao: 'Sessão 160', valor: 60 },
  ];

  it('marcados primeiro, na ordem escolhida, com { quantidade }; os demais, na ordem atual, com null', () => {
    const r = codigosParaSalvar(doBanco, [{ codigo: '185', quantidade: 4 }, { codigo: '144', quantidade: 1 }], catalogo) as Array<{ codigo: string }>;
    expect(r).toEqual([
      { codigo: '185', descricao: 'Eletro', valor: 97.73, codigo_oficial: '31602185', pre_preenchido: { quantidade: 4 } },
      { codigo: '144', descricao: 'Consulta', valor: 70, codigo_oficial: '50000144', pre_preenchido: { quantidade: 1 } },
      { codigo: '012', descricao: 'Sessão', valor: 58.1, codigo_oficial: '50000012', pre_preenchido: null },
      { codigo: '160', descricao: 'Sessão 160', valor: 60, pre_preenchido: null },
    ]);
  });

  it('NADA mais muda: valor, descrição, oficial e campos que não conhecemos ficam como estão, e a lista recebida não é alterada', () => {
    const original = JSON.parse(JSON.stringify(doBanco));
    const comExtra = [...doBanco, { codigo: '777', descricao: 'x', valor: 0, campo_novo: { a: 1 } }];
    const r = codigosParaSalvar(comExtra, [{ codigo: '777', quantidade: 2 }], catalogo) as Array<Record<string, unknown>>;
    expect(r[0]).toEqual({ codigo: '777', descricao: 'x', valor: 0, campo_novo: { a: 1 }, pre_preenchido: { quantidade: 2 } });
    expect(r.slice(1).map((c) => [c.codigo, c.valor, c.descricao])).toEqual(doBanco.map((c) => [c.codigo, c.valor, c.descricao]));
    expect(doBanco).toEqual(original);
  });

  it('ida e volta: o que foi escolhido é exatamente o que o modelo lê depois', () => {
    const escolhas: EscolhaDoModelo[] = [
      [{ codigo: '185', quantidade: 4 }, { codigo: '144', quantidade: 1 }],
      [{ codigo: '160', quantidade: 3 }],
      [{ codigo: '160', quantidade: 10 }, { codigo: '012', quantidade: 10 }, { codigo: '144', quantidade: 1 }], // as mesmas do padrão, em outra ordem
      [],
    ];
    for (const escolha of escolhas) {
      const salvo = codigosParaSalvar(doBanco, escolha, catalogo) as CodigoFaturavel[];
      expect(escolhaDoModelo(modeloDaConfiguracao(salvo)), JSON.stringify(escolha)).toEqual(escolha);
    }
  });

  it('o JSON gravado e relido (jsonb) dá o mesmo modelo', () => {
    const escolha: EscolhaDoModelo = [{ codigo: '301', quantidade: 2 }, { codigo: '144', quantidade: 1 }];
    const salvo = JSON.parse(JSON.stringify(codigosParaSalvar(doBanco, escolha, catalogo))) as CodigoFaturavel[];
    expect(escolhaDoModelo(modeloDaConfiguracao(salvo))).toEqual(escolha);
  });

  it('marcar um código da tabela que nunca foi salvo em Configurações o coloca na lista, com os dados da tabela (160 = R$ 31,97)', () => {
    const r = codigosParaSalvar([{ codigo: '012', descricao: 'Sessão', valor: 58.1 }], [{ codigo: '160', quantidade: 10 }, { codigo: '012', quantidade: 10 }], catalogo);
    expect(r).toEqual([
      {
        codigo: '160', descricao: 'Atendimento fisioterapêutico ambulatorial ao paciente com disfunção decorrente de alterações do sistema músculo-esquelético',
        valor: 31.97, codigo_oficial: '50000160', pre_preenchido: { quantidade: 10 },
      },
      { codigo: '012', descricao: 'Sessão', valor: 58.1, pre_preenchido: { quantidade: 10 } },
    ]);
  });

  it('marcar um código que não existe nem no banco nem na lista é ignorado (não inventa código)', () => {
    const r = codigosParaSalvar(doBanco, [{ codigo: '999', quantidade: 2 }, { codigo: '144', quantidade: 1 }], catalogo) as Array<{ codigo: string }>;
    expect(r.map((c) => c.codigo)).toEqual(['144', '012', '185', '160']);
  });

  it('a quantidade gravada é sempre válida: acima do limite vira o limite, e 144 nunca passa de 1', () => {
    const r = codigosParaSalvar(doBanco, [{ codigo: '144', quantidade: 8 }, { codigo: '012', quantidade: 50 }, { codigo: '185', quantidade: 0 }], catalogo) as Array<{ pre_preenchido: { quantidade: number } | null }>;
    expect(r.slice(0, 3).map((c) => c.pre_preenchido)).toEqual([{ quantidade: 1 }, { quantidade: 10 }, { quantidade: 10 }]);
  });

  it('"Voltar ao padrão" (null) ou uma escolha igual ao padrão TIRA a chave de todos: volta a valer o modelo padrão e a ordem não muda', () => {
    const personalizado = codigosParaSalvar(doBanco, [{ codigo: '185', quantidade: 4 }], catalogo);
    const semChave = codigosParaSalvar(personalizado, null, catalogo) as Array<Record<string, unknown>>;
    expect(semChave.some((c) => 'pre_preenchido' in c)).toBe(false);
    expect(semChave.map((c) => c.codigo)).toEqual(['185', '144', '012', '160']);
    expect(semChave.find((c) => c.codigo === '012')).toEqual({ codigo: '012', descricao: 'Sessão', valor: 58.1, codigo_oficial: '50000012' });
    const igualAoPadrao = codigosParaSalvar(personalizado, escolhaDoModelo(MODELO_DA_GUIA), catalogo) as Array<Record<string, unknown>>;
    expect(igualAoPadrao).toEqual(semChave);
    expect(modeloDaConfiguracao(mesclarCodigosComPadrao(semChave as unknown as CodigoFaturavel[]))).toEqual([...MODELO_DA_GUIA]);
  });

  it('"nenhum marcado" num banco com códigos: todos com null (a escolha fica gravada)', () => {
    const r = codigosParaSalvar(doBanco, [], catalogo) as Array<{ pre_preenchido: unknown }>;
    expect(r.every((c) => c.pre_preenchido === null)).toBe(true);
  });

  it('"nenhum marcado" num banco SEM códigos: leva os da lista, todos com null, para a escolha não se perder', () => {
    const r = codigosParaSalvar([], [], catalogo) as Array<{ codigo: string; pre_preenchido: unknown }>;
    expect(r).toHaveLength(7);
    expect(r.every((c) => c.pre_preenchido === null)).toBe(true);
    expect(modeloDaConfiguracao(r as unknown as CodigoFaturavel[]).some((l) => l.marcado)).toBe(false);
  });

  it('banco com coluna vazia, nula ou de outro tipo não quebra', () => {
    expect(codigosParaSalvar(null, null, catalogo)).toEqual([]);
    expect(codigosParaSalvar('lixo', null, catalogo)).toEqual([]);
    expect((codigosParaSalvar(undefined, [{ codigo: '144', quantidade: 1 }, { codigo: '012', quantidade: 5 }], catalogo) as Array<{ codigo: string }>).map((c) => c.codigo)).toEqual(['144', '012']);
  });

  it('item da lista que não é código (nulo, texto) é mantido como está, sem receber a chave', () => {
    const r = codigosParaSalvar([null, 'x', { codigo: '012', descricao: 's', valor: 1 }], [{ codigo: '144', quantidade: 1 }], catalogo) as unknown[];
    expect(r).toContain(null);
    expect(r).toContain('x');
    expect(r[0]).toMatchObject({ codigo: '144', pre_preenchido: { quantidade: 1 } });
  });

  it('código repetido no banco: só o primeiro leva a escolha, o repetido fica com null', () => {
    const r = codigosParaSalvar([{ codigo: '012', descricao: 'a', valor: 1 }, { codigo: '012', descricao: 'b', valor: 2 }], [{ codigo: '012', quantidade: 3 }], catalogo) as Array<Record<string, unknown>>;
    expect(r.map((c) => [c.descricao, c.pre_preenchido])).toEqual([['a', { quantidade: 3 }], ['b', null]]);
  });
});

describe('ConfiguracaoNaoSalva', () => {
  it('a mensagem é a que a tela mostra', () => {
    expect(new ConfiguracaoNaoSalva().message).toBe('Salve primeiro as Configurações CASSI.');
    expect(new ConfiguracaoNaoSalva()).toBeInstanceOf(Error);
  });
});
