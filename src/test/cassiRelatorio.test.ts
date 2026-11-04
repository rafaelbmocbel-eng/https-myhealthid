import { describe, expect, it } from 'vitest';
import { relatorioDosLancamentos, type ConfigDoRelatorio } from '@/lib/cassiRelatorio';
import { fecharMesPorLancamentos, type ClienteParaFechar } from '@/lib/cassiFinanceiro';

const codigos = [
  { codigo: '144', descricao: 'Consulta', valor: 65, codigo_oficial: '50000144' },
  { codigo: '012', descricao: 'Sessão', valor: 57.7, codigo_oficial: '50000012' },
  { codigo: '185', descricao: 'Estimulação elétrica', valor: 108.44, codigo_oficial: '31602185' },
  { codigo: '131', descricao: 'Biofeedback com EMG', valor: 67.79, codigo_oficial: '20103131' },
  { codigo: '301', descricao: 'Agulhamento seco', valor: 35.55, codigo_oficial: '20103301' },
  { codigo: '020', descricao: 'Sessão em grupo', valor: 57.7, codigo_oficial: '50000020' },
];
const cfg: ConfigDoRelatorio = { codigos, responsaveis: [], imposto_por_guia: 0, imposto_percentual: 14, minha_parte_percentual: 40 };

const cliente = (id: string, nome: string, guias: Array<Record<string, number>>): ClienteParaFechar => ({ id, nome, responsavel: '', guias });
const modelo = { '144': 1, '012': 10, '185': 10 };
const modeloCom131e301 = { ...modelo, '131': 10, '301': 10 };

describe('relatorioDosLancamentos', () => {
  it('uma guia lançada vira uma linha com a quantidade de cada código e a soma (os números do Faturamento)', () => {
    const r = relatorioDosLancamentos({ clientes: [cliente('1', 'Aida', [modelo])], cfg });
    expect(r.colunas.map((c) => c.codigo)).toEqual(['144', '012', '185']);
    expect(r.linhas).toEqual([{ nome: 'Aida', q: [1, 10, 10], soma: 1726.4 }]);
    expect(r.clientes).toBe(1);
    expect(r.guias).toBe(1);
  });

  it('com 131 e 301 lançados a soma é a do print (R$ 2.759,80) e as colunas seguem a ordem do lançamento', () => {
    const r = relatorioDosLancamentos({ clientes: [cliente('1', 'Antonio', [modeloCom131e301])], cfg });
    expect(r.colunas.map((c) => c.codigo)).toEqual(['144', '012', '185', '131', '301']);
    expect(r.linhas[0]).toEqual({ nome: 'Antonio', q: [1, 10, 10, 10, 10], soma: 2759.8 });
  });

  it('só viram coluna os códigos realmente lançados (020 sem uso não aparece; quantidade zero não conta)', () => {
    const r = relatorioDosLancamentos({ clientes: [cliente('1', 'Aida', [{ '012': 10, '020': 0, '301': 0 }])], cfg });
    expect(r.colunas.map((c) => c.codigo)).toEqual(['012']);
  });

  it('a consulta (144) tem o rótulo "Avaliação"; os demais, "Código"; o código oficial vem da configuração', () => {
    const r = relatorioDosLancamentos({ clientes: [cliente('1', 'Aida', [modelo])], cfg });
    expect(r.colunas).toEqual([
      { codigo: '144', oficial: '50000144', label: 'Avaliação' },
      { codigo: '012', oficial: '50000012', label: 'Código' },
      { codigo: '185', oficial: '31602185', label: 'Código' },
    ]);
  });

  it('sem código oficial na configuração, o cabeçalho usa o código curto', () => {
    const semOficial: ConfigDoRelatorio = { ...cfg, codigos: [{ codigo: '012', descricao: 'Sessão', valor: 57.7 }] };
    const r = relatorioDosLancamentos({ clientes: [cliente('1', 'Aida', [{ '012': 10 }])], cfg: semOficial });
    expect(r.colunas[0].oficial).toBe('012');
  });

  it('clientes em ordem alfabética (pt-BR, sem ligar para acento), independentemente da ordem da lista', () => {
    const r = relatorioDosLancamentos({
      clientes: [cliente('3', 'Élida', [{ '012': 1 }]), cliente('1', 'Bruno', [{ '012': 2 }]), cliente('2', 'Aida', [{ '012': 3 }])],
      cfg,
    });
    expect(r.linhas.map((l) => l.nome)).toEqual(['Aida', 'Bruno', 'Élida']);
  });

  it('cliente com duas guias no mês ocupa duas linhas, na ordem lançada, e conta como um cliente', () => {
    const r = relatorioDosLancamentos({
      clientes: [cliente('1', 'Aida', [{ '012': 6 }, { '012': 4, '301': 2 }])],
      cfg,
    });
    expect(r.colunas.map((c) => c.codigo)).toEqual(['012', '301']);
    expect(r.linhas).toEqual([
      { nome: 'Aida', q: [6, 0], soma: 346.2 },
      { nome: 'Aida', q: [4, 2], soma: 301.9 },
    ]);
    expect(r.clientes).toBe(1);
    expect(r.guias).toBe(2);
  });

  it('cliente sem lançamento e guia vazia ficam de fora', () => {
    const r = relatorioDosLancamentos({
      clientes: [cliente('1', 'Aida', []), cliente('2', 'Bruno', [{}]), cliente('3', 'Carla', [{ '012': 0 }]), cliente('4', 'Davi', [{ '012': 5 }])],
      cfg,
    });
    expect(r.linhas.map((l) => l.nome)).toEqual(['Davi']);
    expect(r.clientes).toBe(1);
  });

  it('nada lançado: relatório vazio, sem colunas e com totais zerados', () => {
    const r = relatorioDosLancamentos({ clientes: [cliente('1', 'Aida', [])], cfg });
    expect(r).toMatchObject({ colunas: [], linhas: [], clientes: 0, guias: 0, totBruto: 0, totLiquido: 0, suaParte: 0 });
  });

  it('código lançado que saiu da configuração aparece no fim, com valor zero, para a quantidade não sumir', () => {
    const r = relatorioDosLancamentos({ clientes: [cliente('1', 'Aida', [{ '012': 10, '999': 3 }])], cfg });
    expect(r.colunas.map((c) => c.codigo)).toEqual(['012', '999']);
    expect(r.colunas[1]).toEqual({ codigo: '999', oficial: '999', label: 'Código' });
    expect(r.linhas[0]).toEqual({ nome: 'Aida', q: [10, 3], soma: 577 });
  });

  it('totais: imposto e sua parte pela mesma conta do fechamento do mês (arredondados por cliente)', () => {
    const r = relatorioDosLancamentos({ clientes: [cliente('1', 'Aida', [modelo])], cfg });
    // bruto 1726,40; 14% = 241,696 → 241,70; líquido 1484,70; 40% = 593,88
    expect(r).toMatchObject({ totBruto: 1726.4, impostoPct: 14, totImposto: 241.7, totLiquido: 1484.7, minhaPct: 40, suaParte: 593.88 });
  });

  it('é exatamente o fechamento da tela: mesmos totais e a soma das linhas fecha com o bruto', () => {
    const clientes = [
      cliente('1', 'Aida', [modelo]),
      cliente('2', 'Antonio', [modeloCom131e301]),
      cliente('3', 'Beatriz', [{ '012': 7, '301': 3 }, { '012': 3 }]),
    ];
    const r = relatorioDosLancamentos({ clientes, cfg });
    const f = fecharMesPorLancamentos({ clientes, cfg });
    expect(r.totBruto).toBe(f.totBruto);
    expect(r.totLiquido).toBe(f.totLiquido);
    expect(r.totImposto).toBe(f.totImposto);
    expect(r.suaParte).toBe(f.suaParte);
    const somaDasLinhas = Math.round(r.linhas.reduce((s, l) => s + Math.round(l.soma * 100), 0)) / 100;
    expect(somaDasLinhas).toBe(r.totBruto);
  });

  it('sem configuração carregada não quebra: valores zerados e as quantidades continuam no relatório', () => {
    const r = relatorioDosLancamentos({ clientes: [cliente('1', 'Aida', [{ '012': 10 }])], cfg: undefined });
    expect(r.linhas).toEqual([{ nome: 'Aida', q: [10], soma: 0 }]);
    expect(r.colunas.map((c) => c.codigo)).toEqual(['012']);
    expect(r).toMatchObject({ totBruto: 0, totLiquido: 0, suaParte: 0, impostoPct: 0, minhaPct: 0 });
  });

  it('não altera a lista recebida (a tela reaproveita o mesmo array)', () => {
    const clientes = [cliente('2', 'Bruno', [{ '012': 1 }]), cliente('1', 'Aida', [{ '012': 2 }])];
    relatorioDosLancamentos({ clientes, cfg });
    expect(clientes.map((c) => c.nome)).toEqual(['Bruno', 'Aida']);
  });
});
