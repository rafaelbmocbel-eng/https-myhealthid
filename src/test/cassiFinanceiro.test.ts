import { describe, it, expect } from 'vitest';
import type { GuiaCassi } from '@/lib/cassiGuias';
import { brutoGuia, contarSessoesDoMes, fecharMes, somarMeses, ultimosMeses, type AgendamentoFinanceiro, type ConfigFinanceira } from '@/lib/cassiFinanceiro';
import { calcOriginal, tendenciaOriginal } from './cassiFinanceiroReferencia';

// Gerador determinístico: o mesmo cenário em toda execução.
function sorteio(semente: number) {
  let s = semente >>> 0;
  const prox = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
  return {
    prox,
    inteiro: (a: number, b: number) => a + Math.floor(prox() * (b - a + 1)),
    escolhe: <T,>(xs: T[]) => xs[Math.floor(prox() * xs.length)],
  };
}

const STATUS = ['confirmado', 'atendido', 'atendido', 'confirmado', 'cancelado', 'faltou', 'bloqueado', 'pendente'];
const RESPONSAVEIS = ['', 'Dra. Íris Paiva', 'dra. iris paiva', 'Dr. João', 'Sem Cadastro'];

function cenario(semente: number) {
  const r = sorteio(semente);
  const pacientes = Array.from({ length: 12 }, (_, i) => ({
    id: `p${i}`,
    nome: r.escolhe(['Ana', 'Álvaro', 'Beatriz', 'Carlos', 'Érica', 'Zélia']) + i,
    sobrenome: r.prox() < 0.3 ? null : r.escolhe(['Souza', 'Lima', 'Dias']),
    codigos_cassi: r.prox() < 0.4 ? [] : r.escolhe([['012'], ['012', '185'], ['144', '012', '185'], ['160']]),
  }));
  // Do mais recente para o mais antigo, como a consulta da tela entrega.
  const guias = [] as GuiaCassi[];
  for (const p of pacientes) {
    if (r.prox() < 0.25) continue;
    for (let k = 0; k < r.inteiro(1, 2); k++) {
      const codigos = r.escolhe([
        [{ codigo: '144', sessoes: 1 }, { codigo: '012', sessoes: 10 }, { codigo: '185', sessoes: 10 }],
        [{ codigo: '144', sessoes: 0 }, { codigo: '012', sessoes: 8 }],
        [{ codigo: '012' }, { codigo: '185', sessoes: 6 }],
        [],
      ]);
      guias.push({
        id: `g${p.id}-${k}`, paciente_id: p.id, matricula: null, numero_guia: null, data_pedido: '2026-01-01', data_resposta: null,
        sessoes_autorizadas: 10, sessoes_realizadas: 0, diagnostico: null, responsavel_tecnico: r.escolhe(RESPONSAVEIS) || null,
        codigos, status: 'ativa', observacoes: null, created_at: '', updated_at: '',
      });
    }
  }
  const agendamentos: AgendamentoFinanceiro[] = Array.from({ length: 260 }, () => ({
    paciente_id: r.prox() < 0.05 ? null : r.prox() < 0.08 ? 'fora-do-cassi' : `p${r.inteiro(0, 11)}`,
    data_inicio: new Date(2026, r.inteiro(4, 10), r.inteiro(1, 28), r.escolhe([0, 8, 10, 14, 23]), r.escolhe([0, 30])).toISOString(),
    status: r.escolhe(STATUS),
    tipo_atendimento: r.prox() < 0.1 ? 'avaliacao' : undefined,
  }));
  const cfg: ConfigFinanceira | undefined = r.escolhe<ConfigFinanceira | undefined>([
    undefined,
    { codigos: [{ codigo: '144', valor: 100 }, { codigo: '012', valor: 55.5 }, { codigo: '185', valor: 33.33 }, { codigo: '160', valor: 70 }], responsaveis: [{ nome: 'Dra. Íris Paiva', percentual: 30 }, { nome: 'Dr. João', percentual: 20 }], imposto_por_guia: 0, imposto_percentual: 15, minha_parte_percentual: 45 },
    { codigos: [{ codigo: '144', valor: 90 }, { codigo: '012', valor: 40 }], responsaveis: [], imposto_por_guia: 12.5, imposto_percentual: 0, minha_parte_percentual: 60 },
    { codigos: [], responsaveis: [], imposto_por_guia: 0, imposto_percentual: 0, minha_parte_percentual: 0 },
  ]);
  return { pacientes, guias, agendamentos, cfg };
}

const AGORA = new Date(2026, 9, 20, 12, 0).getTime();

describe('conta financeira do mês: a conta nova com todos os clientes na lista dá o mesmo resultado da antiga', () => {
  for (let semente = 1; semente <= 40; semente++) {
    it(`cenário ${semente}: cálculo do mês`, () => {
      const { pacientes, guias, agendamentos, cfg } = cenario(semente);
      const mes = '2026-09';
      const [ano, m] = mes.split('-').map(Number);
      const todos = new Set(pacientes.map((p) => p.id));
      const novo = fecharMes({ sessoesPorPac: contarSessoesDoMes(agendamentos, ano, m, todos, AGORA), pacientes, guias, cfg });
      const antigo = calcOriginal({ mes, pacientes, guias, agendamentos, cfg, agora: AGORA });
      expect(novo).toEqual(antigo);
    });

    it(`cenário ${semente}: "sua parte" dos 6 meses da tendência`, () => {
      const { pacientes, guias, agendamentos, cfg } = cenario(semente);
      const mes = '2026-10';
      const todos = new Set(pacientes.map((p) => p.id));
      const antigo = tendenciaOriginal({ mes, pacientes, guias, agsTrend: agendamentos, cfg, agora: AGORA });
      const novo = ultimosMeses(mes, 6).map((mm) => {
        const [y, mo] = mm.split('-').map(Number);
        return fecharMes({ sessoesPorPac: contarSessoesDoMes(agendamentos, y, mo, todos, AGORA), pacientes, guias, cfg }).suaParte;
      });
      expect(novo).toHaveLength(antigo.length);
      novo.forEach((v, i) => expect(v).toBeCloseTo(antigo[i].suaParte, 8));
    });
  }

  it('os cenários não são triviais (têm sessões e valores de verdade)', () => {
    let comValor = 0;
    for (let semente = 1; semente <= 40; semente++) {
      const { pacientes, guias, agendamentos, cfg } = cenario(semente);
      const todos = new Set(pacientes.map((p) => p.id));
      const r = fecharMes({ sessoesPorPac: contarSessoesDoMes(agendamentos, 2026, 9, todos, AGORA), pacientes, guias, cfg });
      if (r.totBruto > 0 && r.linhas.length >= 3) comValor++;
    }
    expect(comValor).toBeGreaterThan(10);
  });
});

describe('a lista do mês escolhe QUEM entra, não COMO se calcula', () => {
  const pacientes = [
    { id: 'a', nome: 'Ana', sobrenome: 'Souza', codigos_cassi: ['012'] },
    { id: 'b', nome: 'Bruno', sobrenome: null, codigos_cassi: ['012'] },
    { id: 'c', nome: 'Carla', sobrenome: 'Dias', codigos_cassi: ['012'] },
  ];
  const cfg: ConfigFinanceira = { codigos: [{ codigo: '012', valor: 50 }], responsaveis: [], imposto_por_guia: 0, imposto_percentual: 10, minha_parte_percentual: 50 };
  const sessao = (id: string, dia: number): AgendamentoFinanceiro => ({ paciente_id: id, data_inicio: new Date(2026, 8, dia, 10).toISOString(), status: 'atendido' });
  const ags = [...[1, 2, 3, 4].map((d) => sessao('a', d)), ...[1, 2].map((d) => sessao('b', d)), sessao('c', 5)];

  it('só conta as sessões de quem está na lista', () => {
    const sess = contarSessoesDoMes(ags, 2026, 9, new Set(['a', 'c']), AGORA);
    expect([...sess.entries()]).toEqual([['a', 4], ['c', 1]]);
  });

  it('o total da lista é a soma dos clientes dela, com a mesma conta de cada um', () => {
    const so = (ids: string[]) => fecharMes({ sessoesPorPac: contarSessoesDoMes(ags, 2026, 9, new Set(ids), AGORA), pacientes, guias: [], cfg });
    const a = so(['a']); const c = so(['c']); const ac = so(['a', 'c']);
    expect(a.totBruto).toBe(200);
    expect(a.totLiquido).toBe(180);
    expect(a.suaParte).toBe(90);
    expect(ac.totBruto).toBe(a.totBruto + c.totBruto);
    expect(ac.totLiquido).toBeCloseTo(a.totLiquido + c.totLiquido, 10);
    expect(ac.linhas.map((l) => l.nome)).toEqual(['Ana Souza', 'Carla Dias']);
  });

  it('lista vazia não calcula nada', () => {
    const r = fecharMes({ sessoesPorPac: contarSessoesDoMes(ags, 2026, 9, new Set(), AGORA), pacientes, guias: [], cfg });
    expect(r.linhas).toEqual([]);
    expect(r.totBruto).toBe(0);
    expect(r.suaParte).toBe(0);
  });
});

describe('contarSessoesDoMes', () => {
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

describe('brutoGuia', () => {
  const valorDe = (c: string) => ({ '144': 100, '012': 50, '185': 30 } as Record<string, number>)[c] ?? 0;
  it('avaliação (144) cobra uma vez; os de tratamento, por sessão até o limite autorizado do código', () => {
    expect(brutoGuia([{ codigo: '144', sessoes: 1 }, { codigo: '012', sessoes: 10 }, { codigo: '185', sessoes: 6 }], 8, valorDe)).toBe(100 + 8 * 50 + 6 * 30);
  });
  it('sem sessão no mês não cobra a avaliação', () => {
    expect(brutoGuia([{ codigo: '144', sessoes: 1 }], 0, valorDe)).toBe(0);
  });
  it('código sem quantidade própria usa as sessões do mês', () => {
    expect(brutoGuia([{ codigo: '012' }], 7, valorDe)).toBe(350);
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
