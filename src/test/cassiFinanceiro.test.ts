import { describe, it, expect } from 'vitest';
import { agregarFechamento, contarSessoesDoMes, fecharMesPorLancamentos, somarMeses, ultimosMeses, type AgendamentoFinanceiro, type ConfigFinanceira } from '@/lib/cassiFinanceiro';

const cfg: ConfigFinanceira = {
  codigos: [{ codigo: '012', valor: 57.7 }, { codigo: '144', valor: 65.62 }, { codigo: '301', valor: 35.55 }],
  responsaveis: [{ nome: 'Dra. Íris Paiva', percentual: 30 }],
  imposto_por_guia: 0, imposto_percentual: 10, minha_parte_percentual: 50,
};

describe('fechamento do mês pelos lançamentos', () => {
  const clientes = [
    { id: 'a', nome: 'Ana Souza', responsavel: 'dra. iris paiva', guias: [{ '012': 10, '144': 1 }] },
    { id: 'b', nome: 'Bruno Lima', responsavel: '', guias: [{ '012': 6 }, { '012': 4, '301': 2 }] },
    { id: 'c', nome: 'Carla Dias', responsavel: '', guias: [] },
  ];

  it('bruto = quantidade × valor do código; imposto em % do bruto; líquido, sua parte e clínica', () => {
    const r = fecharMesPorLancamentos({ clientes, cfg });
    const ana = r.linhas.find((l) => l.pid === 'a')!;
    expect(ana.bruto).toBeCloseTo(642.62, 8); // 577,00 + 65,62
    expect(ana.imposto).toBe(64.26); // 10% de 642,62 = 64,262, arredondado a centavos em cada cliente
    expect(ana.liquido).toBe(578.36);
    expect(ana.sessoes).toBe(10); // a consulta não é sessão
    const bruno = r.linhas.find((l) => l.pid === 'b')!;
    expect(bruno.bruto).toBeCloseTo(648.1, 8); // 577,00 + 71,10
    expect([bruno.imposto, bruno.liquido]).toEqual([64.81, 583.29]);
    expect(bruno.sessoes).toBe(12);
    expect(bruno.resumo).toBe('012 × 10 · 301 × 2 · 2 guias');
    expect(r.totBruto).toBeCloseTo(1290.72, 8);
    expect(r.totImposto).toBe(129.07);
    expect(r.totLiquido).toBe(1161.65);
    expect(r.suaParte).toBeCloseTo(580.825, 8);
    expect(r.parteClinica).toBeCloseTo(580.825, 8);
    expect(r.totSessoes).toBe(22);
  });

  it('cliente sem nada lançado fica fora da tabela e dos totais; a tabela sai em ordem alfabética', () => {
    const r = fecharMesPorLancamentos({ clientes: [...clientes].reverse(), cfg });
    expect(r.linhas.map((l) => l.nome)).toEqual(['Ana Souza', 'Bruno Lima']);
  });

  it('repasse por responsável casa o nome sem acento nem caixa; quem não tem responsável cai em "Sem responsável"', () => {
    const r = fecharMesPorLancamentos({ clientes, cfg });
    const iris = r.repasses.find((x) => x.nome === 'dra. iris paiva')!;
    expect(iris.pct).toBe(30);
    expect(iris.repasse).toBeCloseTo(578.36 * 0.3, 8);
    expect(r.repasses.find((x) => x.nome === 'Sem responsável')!.pct).toBeNull();
    expect(r.ficaComVoce).toBeCloseTo(r.totLiquido - r.totRepasse, 10);
  });

  it('a soma das linhas que aparecem é o total: imposto arredondado em cada cliente, sem 1 centavo de diferença', () => {
    const tres = ['a', 'b', 'c'].map((id) => ({ id, nome: id, responsavel: '', guias: [{ '012': 1 }] }));
    const r = fecharMesPorLancamentos({ clientes: tres, cfg: { ...cfg, imposto_percentual: 5 } });
    expect(r.linhas.map((l) => l.imposto)).toEqual([2.89, 2.89, 2.89]); // 5% de 57,70 = 2,885
    expect(r.totImposto).toBe(8.67);
    expect(r.totLiquido).toBe(164.43);
    expect(r.totBruto).toBe(173.1);
    expect(r.totBruto - r.totImposto).toBeCloseTo(r.totLiquido, 10);
  });

  it('imposto fixo antigo (sem percentual) vale por guia lançada', () => {
    const r = fecharMesPorLancamentos({ clientes, cfg: { ...cfg, imposto_percentual: 0, imposto_por_guia: 12.5 } });
    expect(r.linhas.find((l) => l.pid === 'a')!.imposto).toBe(12.5);
    expect(r.linhas.find((l) => l.pid === 'b')!.imposto).toBe(25);
  });

  it('o imposto nunca deixa o líquido negativo', () => {
    const r = fecharMesPorLancamentos({ clientes: [{ id: 'a', nome: 'Ana', responsavel: '', guias: [{ '144': 1 }] }], cfg: { ...cfg, imposto_percentual: 0, imposto_por_guia: 500 } });
    expect(r.linhas[0].liquido).toBe(0);
  });

  it('sem configuração (ainda carregando) nada quebra: valores zerados', () => {
    const r = fecharMesPorLancamentos({ clientes, cfg: undefined });
    expect(r.totBruto).toBe(0);
    expect(r.suaParte).toBe(0);
  });

  it('lista vazia não calcula nada', () => {
    const r = fecharMesPorLancamentos({ clientes: [], cfg });
    expect(r.linhas).toEqual([]);
    expect(r.totBruto).toBe(0);
  });

  it('agregarFechamento soma linhas prontas', () => {
    const r = agregarFechamento([
      { pid: '1', nome: 'A', responsavel: '', sessoes: 2, bruto: 100, imposto: 10, liquido: 90 },
      { pid: '2', nome: 'B', responsavel: '', sessoes: 3, bruto: 50, imposto: 5, liquido: 45 },
    ], cfg);
    expect([r.totBruto, r.totImposto, r.totLiquido, r.totSessoes]).toEqual([150, 15, 135, 5]);
    expect(r.suaParte).toBe(67.5);
  });
});

describe('contarSessoesDoMes (a agenda é só referência)', () => {
  const AGORA = new Date(2026, 9, 20, 12, 0).getTime();
  const ids = new Set(['a']);
  const ag = (extra: Partial<AgendamentoFinanceiro>): AgendamentoFinanceiro => ({ paciente_id: 'a', data_inicio: new Date(2026, 8, 10, 10).toISOString(), status: 'atendido', ...extra });

  it('ignora avaliação, cancelado, faltou, bloqueado e pendente', () => {
    const ags = [ag({}), ag({ tipo_atendimento: 'avaliacao' }), ag({ status: 'cancelado' }), ag({ status: 'faltou' }), ag({ status: 'bloqueado' }), ag({ status: 'pendente' })];
    expect(contarSessoesDoMes(ags, 2026, 9, ids, AGORA).get('a')).toBe(1);
  });

  it('ignora o que ainda não aconteceu e o que é de outro mês', () => {
    const futura = ag({ data_inicio: new Date(2026, 9, 25, 10).toISOString() });
    const outroMes = ag({ data_inicio: new Date(2026, 7, 31, 23, 30).toISOString() });
    expect(contarSessoesDoMes([futura, outroMes], 2026, 10, ids, AGORA).size).toBe(0);
    expect(contarSessoesDoMes([futura, outroMes], 2026, 9, ids, AGORA).size).toBe(0);
  });

  it('ignora quem não está nos ids e agendamento sem cliente', () => {
    expect(contarSessoesDoMes([ag({ paciente_id: 'z' }), ag({ paciente_id: null })], 2026, 9, ids, AGORA).size).toBe(0);
  });

  it('o mês é o local: sessão às 23h30 do último dia conta no mês dela', () => {
    const noite = ag({ data_inicio: new Date(2026, 8, 30, 23, 30).toISOString() });
    expect(contarSessoesDoMes([noite], 2026, 9, ids, AGORA).get('a')).toBe(1);
    expect(contarSessoesDoMes([noite], 2026, 10, ids, AGORA).size).toBe(0);
  });
});

describe('meses', () => {
  it('somarMeses atravessa o ano nos dois sentidos', () => {
    expect(somarMeses('2026-12', 1)).toBe('2027-01');
    expect(somarMeses('2026-01', -1)).toBe('2025-12');
    expect(somarMeses('2026-10', 0)).toBe('2026-10');
  });
  it('ultimosMeses devolve os n meses terminando no informado', () => {
    expect(ultimosMeses('2026-02', 6)).toEqual(['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']);
    expect(ultimosMeses('2026-10', 1)).toEqual(['2026-10']);
  });
});
