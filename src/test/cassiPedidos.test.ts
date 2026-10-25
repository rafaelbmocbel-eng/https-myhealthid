import { describe, it, expect } from 'vitest';
import type { GuiaCassi } from '@/lib/cassiGuias';
import {
  candidatosDoPedido, itemDoPedido, listaDoPedido, montarTextoPedido, pedidoEmAberto, sugestoesDoPedido,
  type LinhaPedido, type PacientePedido,
} from '@/lib/cassiPedidos';

const paciente = (id: string, nome: string, extra: Partial<PacientePedido> = {}): PacientePedido => ({
  id, nome, sobrenome: null, carteirinha: null, codigos_cassi: [], guias_por_mes: 1,
  guia_solicitada_em: null, cassi_encerrado_em: null, cassi_diagnostico: null, cassi_pedir_guia: false, ...extra,
});
const guia = (extra: Partial<GuiaCassi> = {}): GuiaCassi => ({
  id: 'g', paciente_id: 'x', matricula: null, numero_guia: null, data_pedido: '2026-09-01', data_resposta: '2026-09-05',
  sessoes_autorizadas: 10, sessoes_realizadas: 2, diagnostico: null, responsavel_tecnico: null, codigos: [], status: 'ativa',
  observacoes: null, created_at: '', updated_at: '', ...extra,
});
const linha = (p: PacientePedido, g: GuiaCassi | null = null): LinhaPedido => ({ paciente: p, guia: g });

describe('pedidoEmAberto', () => {
  it('sem solicitação não há pedido aberto', () => {
    expect(pedidoEmAberto(paciente('1', 'A'), guia())).toBe(false);
  });
  it('pedido feito e nenhuma guia nova chegou: aberto', () => {
    expect(pedidoEmAberto(paciente('1', 'A', { guia_solicitada_em: '2026-10-10T12:00:00Z' }), null)).toBe(true);
    expect(pedidoEmAberto(paciente('1', 'A', { guia_solicitada_em: '2026-10-10T12:00:00Z' }), guia({ data_pedido: '2026-09-30' }))).toBe(true);
  });
  it('a guia nova (pedida no dia da solicitação ou depois) fecha o pedido', () => {
    const p = paciente('1', 'A', { guia_solicitada_em: '2026-10-10T12:00:00Z' });
    expect(pedidoEmAberto(p, guia({ data_pedido: '2026-10-10' }))).toBe(false);
    expect(pedidoEmAberto(p, guia({ data_pedido: '2026-10-12' }))).toBe(false);
  });
});

describe('a lista do pedido é do profissional', () => {
  it('só entra quem foi adicionado (cassi_pedir_guia), mesmo que o sistema ache que outro precisa de guia', () => {
    const adicionado = linha(paciente('1', 'Ana', { cassi_pedir_guia: true }), guia({ sessoes_realizadas: 2 }));
    const precisaMasNaoAdicionado = linha(paciente('2', 'Bruno'), guia({ sessoes_realizadas: 10 }));
    const semGuia = linha(paciente('3', 'Carla'), null);
    expect(listaDoPedido([adicionado, precisaMasNaoAdicionado, semGuia]).map((l) => l.paciente.id)).toEqual(['1']);
  });

  it('não entra quem está encerrado nem quem já teve o pedido feito', () => {
    const encerrado = linha(paciente('1', 'Ana', { cassi_pedir_guia: true, cassi_encerrado_em: '2026-10-01T00:00:00Z' }));
    const pedido = linha(paciente('2', 'Bruno', { cassi_pedir_guia: true, guia_solicitada_em: '2026-10-10T00:00:00Z' }), guia({ data_pedido: '2026-09-01' }));
    const ok = linha(paciente('3', 'Carla', { cassi_pedir_guia: true }));
    expect(listaDoPedido([encerrado, pedido, ok]).map((l) => l.paciente.id)).toEqual(['3']);
  });

  it('fica em ordem alfabética, com acento', () => {
    const l = (id: string, nome: string) => linha(paciente(id, nome, { cassi_pedir_guia: true }));
    expect(listaDoPedido([l('1', 'Zélia'), l('2', 'Álvaro'), l('3', 'Beatriz')]).map((x) => x.paciente.nome)).toEqual(['Álvaro', 'Beatriz', 'Zélia']);
  });

  it('cassi_pedir_guia nulo (cadastro antigo) não conta como adicionado', () => {
    expect(listaDoPedido([linha(paciente('1', 'Ana', { cassi_pedir_guia: null }))])).toEqual([]);
  });
});

describe('sugestões do sistema (nada entra sozinho)', () => {
  it('sugere sem guia, guia usada e poucas sessões; não sugere guia com sessões de sobra', () => {
    const semGuia = linha(paciente('1', 'Ana'), null);
    const usada = linha(paciente('2', 'Bruno'), guia({ sessoes_realizadas: 10 }));
    const poucas = linha(paciente('3', 'Carla'), guia({ sessoes_realizadas: 8 }));
    const folga = linha(paciente('4', 'Davi'), guia({ sessoes_realizadas: 2 }));
    expect(sugestoesDoPedido([semGuia, usada, poucas, folga]).map((s) => s.id)).toEqual(['1', '2', '3']);
  });

  it('não repete quem já está na lista, nem quem foi encerrado, nem quem já pediu', () => {
    const naLista = linha(paciente('1', 'Ana', { cassi_pedir_guia: true }), null);
    const encerrado = linha(paciente('2', 'Bruno', { cassi_encerrado_em: '2026-10-01T00:00:00Z' }), null);
    const pedido = linha(paciente('3', 'Carla', { guia_solicitada_em: '2026-10-10T00:00:00Z' }), guia({ data_pedido: '2026-09-01', sessoes_realizadas: 10 }));
    expect(sugestoesDoPedido([naLista, encerrado, pedido])).toEqual([]);
  });

  it('diz o motivo: situação da guia, ou "cliente 2/mês"', () => {
    const s = sugestoesDoPedido([
      linha(paciente('1', 'Ana'), null),
      linha(paciente('2', 'Bruno', { guias_por_mes: 2 }), guia({ sessoes_realizadas: 10 })),
      linha(paciente('3', 'Carla'), guia({ sessoes_realizadas: 9 })),
    ]);
    expect(s.map((x) => [x.nome, x.motivo])).toEqual([['Ana', 'Sem guia'], ['Bruno', 'cliente 2/mês'], ['Carla', 'Pedir nova guia']]);
  });
});

describe('candidatos da busca', () => {
  it('traz todos os CASSI, inclusive encerrados, menos quem já tem pedido em aberto', () => {
    const guiaDe = (id: string) => (id === '3' ? guia({ data_pedido: '2026-09-01' }) : null);
    const candidatos = candidatosDoPedido([
      paciente('1', 'Ana'),
      paciente('2', 'Bruno', { cassi_encerrado_em: '2026-10-01T00:00:00Z' }),
      paciente('3', 'Carla', { guia_solicitada_em: '2026-10-10T00:00:00Z' }),
    ], guiaDe);
    expect(candidatos.map((c) => c.paciente.id)).toEqual(['1', '2']);
  });
});

describe('item do pedido', () => {
  it('pré-preenche do cadastro; sem carteirinha no cadastro usa a matrícula da guia', () => {
    const doCadastro = itemDoPedido(linha(paciente('1', 'Ana', { sobrenome: 'Souza', carteirinha: '111', cassi_diagnostico: 'Lombalgia', codigos_cassi: ['012', '185'] }), guia({ matricula: '999', diagnostico: 'outro', codigos: [{ codigo: '160' }] })));
    expect(doCadastro).toEqual({ id: '1', nome: 'Ana Souza', sel: true, carteirinha: '111', diagnostico: 'Lombalgia', codigos: ['012', '185'] });
    const daGuia = itemDoPedido(linha(paciente('2', 'Bruno'), guia({ matricula: '999', diagnostico: 'Cervicalgia', codigos: [{ codigo: '012' }, { codigo: '185' }] })));
    expect(daGuia).toMatchObject({ carteirinha: '999', diagnostico: 'Cervicalgia', codigos: ['012', '185'] });
  });

  it('no máximo 3 códigos por pedido', () => {
    const item = itemDoPedido(linha(paciente('1', 'Ana', { codigos_cassi: ['144', '012', '160', '185'] })));
    expect(item.codigos).toEqual(['144', '012', '160']);
  });

  it('cliente sem nada fica com campos vazios (a mensagem mostra "—")', () => {
    expect(itemDoPedido(linha(paciente('1', 'Ana')))).toMatchObject({ carteirinha: '', diagnostico: '', codigos: [] });
  });
});

describe('mensagem do pedido (formato que já ia para a CASSI não mudou)', () => {
  it('um cliente, no singular', () => {
    expect(montarTextoPedido([{ nome: 'Ana Souza', carteirinha: '111', codigos: ['012', '185'], diagnostico: 'Lombalgia' }])).toBe(
      '*Solicitação de novas guias CASSI* (1 cliente)\n\n1. *Ana Souza*\nCarteirinha: 111\nCódigos: 012, 185\nDiagnóstico: Lombalgia',
    );
  });

  it('vários clientes, no plural e numerados; campo vazio vira "—"', () => {
    expect(montarTextoPedido([
      { nome: 'Ana Souza', carteirinha: '111', codigos: ['012'], diagnostico: 'Lombalgia' },
      { nome: 'Bruno', carteirinha: '', codigos: [], diagnostico: '' },
    ])).toBe(
      '*Solicitação de novas guias CASSI* (2 clientes)\n\n1. *Ana Souza*\nCarteirinha: 111\nCódigos: 012\nDiagnóstico: Lombalgia\n2. *Bruno*\nCarteirinha: —\nCódigos: —\nDiagnóstico: —',
    );
  });

  it('lista vazia gera só o cabeçalho', () => {
    expect(montarTextoPedido([])).toBe('*Solicitação de novas guias CASSI* (0 clientes)\n');
  });
});
