import { describe, expect, it } from 'vitest';
import {
  DIAS_MAXIMOS_CORTESIA,
  decidirConcessaoPremium,
  decidirRevogacaoPremium,
  emailPareceValido,
  escaparCuringaIlike,
  escolherConta,
  executarPremiumCliente,
  lerDias,
  normalizarEmail,
  type AssinaturaDaConta,
  type PacienteDaConta,
} from '../../supabase/functions/_shared/premium-cliente';

const AGORA = new Date('2026-11-12T15:00:00Z');
const DIA = 86_400_000;

const FREE: PacienteDaConta = { id: 'p1', user_id: 'u1', tipo_conta: 'wellness_free', email: 'cliente@exemplo.com' };
const assinatura = (over: Partial<AssinaturaDaConta> = {}): AssinaturaDaConta => ({ id: 'a1', status: 'ativa', provider: 'manual', ...over });

describe('entradas', () => {
  it('normaliza o e-mail e recusa lixo', () => {
    expect(normalizarEmail('  Cliente@Exemplo.COM ')).toBe('cliente@exemplo.com');
    expect(normalizarEmail(undefined)).toBe('');
    expect(normalizarEmail(42)).toBe('');
    expect(emailPareceValido('a@b.co')).toBe(true);
    expect(emailPareceValido('sem-arroba')).toBe(false);
    expect(emailPareceValido('a b@c.com')).toBe(false);
    expect(emailPareceValido(`${'x'.repeat(250)}@a.co`)).toBe(false);
  });

  it('escapa os curingas do ILIKE', () => {
    expect(escaparCuringaIlike('a_b%c\\d@x.com')).toBe('a\\_b\\%c\\\\d@x.com');
    expect(escaparCuringaIlike('douglas@x.com')).toBe('douglas@x.com');
  });

  it('dias: vazio é sem prazo; só inteiro de 1 até o máximo', () => {
    expect(lerDias(undefined)).toEqual({ ok: true, dias: null });
    expect(lerDias('')).toEqual({ ok: true, dias: null });
    expect(lerDias(30)).toEqual({ ok: true, dias: 30 });
    expect(lerDias('45')).toEqual({ ok: true, dias: 45 });
    expect(lerDias(DIAS_MAXIMOS_CORTESIA)).toEqual({ ok: true, dias: DIAS_MAXIMOS_CORTESIA });
    for (const ruim of [0, -1, 1.5, 'abc', DIAS_MAXIMOS_CORTESIA + 1, Number.NaN, Infinity]) {
      const r = lerDias(ruim);
      expect(r.ok, String(ruim)).toBe(false);
    }
  });
});

describe('escolherConta', () => {
  it('exige login e e-mail exatamente igual (sem diferença de maiúsculas)', () => {
    const linhas: PacienteDaConta[] = [
      { id: 'a', user_id: 'ua', tipo_conta: 'wellness_free', email: 'Cliente@Exemplo.com' },
      { id: 'b', user_id: 'ub', tipo_conta: 'wellness_free', email: 'cliente@exemplo.com.br' },
      { id: 'c', user_id: null, tipo_conta: 'clinico', email: 'cliente@exemplo.com' },
    ];
    const r = escolherConta(linhas, 'cliente@exemplo.com');
    expect('ok' in r).toBe(false);
    expect((r as PacienteDaConta).id).toBe('a');
  });

  it('sem conta: 404; duas contas: 409 sem escolher uma delas', () => {
    const sem = escolherConta([{ id: 'c', user_id: null, tipo_conta: 'clinico', email: 'x@y.com' }], 'x@y.com');
    expect(sem).toMatchObject({ ok: false, status: 404 });
    const duas = escolherConta([
      { id: 'a', user_id: 'ua', tipo_conta: 'wellness_free', email: 'x@y.com' },
      { id: 'b', user_id: 'ub', tipo_conta: 'wellness_free', email: 'X@y.com' },
    ], 'x@y.com');
    expect(duas).toMatchObject({ ok: false, status: 409 });
  });
});

describe('decidirConcessaoPremium', () => {
  const dec = (over: Partial<Parameters<typeof decidirConcessaoPremium>[0]> = {}) =>
    decidirConcessaoPremium({ conta: FREE, assinaturas: [], dias: null, agora: AGORA, ...over });

  it('conta gratuita sem prazo: cortesia manual a custo zero, próxima cobrança 100 anos adiante, conta vira Premium', () => {
    const r = dec();
    expect(r).toMatchObject({
      ok: true, jaPremium: false, tipoNovo: 'wellness_premium',
      assinatura: { id: null, status: 'ativa', provider: 'manual', valor_mensal: 0, data_inicio: AGORA.toISOString(), data_fim: null },
    });
    if (!r.ok || !r.assinatura) throw new Error('esperava assinatura');
    expect(r.assinatura.proxima_cobranca.slice(0, 16)).toBe('2126-11-12T15:00');
  });

  it('com dias: fim e próxima cobrança no mesmo instante, exatamente dias depois', () => {
    const r = dec({ dias: 30 });
    if (!r.ok || !r.assinatura) throw new Error('esperava assinatura');
    const fim = new Date(AGORA.getTime() + 30 * DIA).toISOString();
    expect(r.assinatura.data_fim).toBe(fim);
    expect(r.assinatura.proxima_cobranca).toBe(fim);
  });

  it('já Premium com assinatura ativa: não muda nada (nem a paga)', () => {
    for (const provider of ['manual', 'stripe', 'paddle', null]) {
      const r = dec({ conta: { ...FREE, tipo_conta: 'wellness_premium' }, assinaturas: [assinatura({ provider })] });
      expect(r).toEqual({ ok: true, jaPremium: true, assinatura: null, tipoNovo: null });
    }
  });

  it('Premium sem assinatura ativa (por exemplo, cortesia vencida): regrava a cortesia reaproveitando a linha manual e não troca o tipo', () => {
    const r = dec({
      conta: { ...FREE, tipo_conta: 'wellness_premium' },
      assinaturas: [assinatura({ id: 'velha', status: 'cancelada', provider: 'manual' }), assinatura({ id: 'paga', status: 'cancelada', provider: 'stripe' })],
    });
    if (!r.ok || !r.assinatura) throw new Error('esperava assinatura');
    expect(r.assinatura.id).toBe('velha');
    expect(r.tipoNovo).toBeNull();
  });

  it('conta gratuita com assinatura paga ativa: recusa para não mexer na cobrança', () => {
    for (const provider of ['stripe', 'paddle', null]) {
      expect(dec({ assinaturas: [assinatura({ provider })] })).toMatchObject({ ok: false, status: 409 });
    }
  });

  it('assinatura paga antiga (cancelada) nunca é reaproveitada: insere uma nova', () => {
    const r = dec({ assinaturas: [assinatura({ id: 'paga', status: 'cancelada', provider: 'stripe' })] });
    if (!r.ok || !r.assinatura) throw new Error('esperava assinatura');
    expect(r.assinatura.id).toBeNull();
  });

  it('paciente clínico ou tipo desconhecido: recusa sem tocar', () => {
    for (const tipo of ['clinico', null, 'qualquer']) {
      expect(dec({ conta: { ...FREE, tipo_conta: tipo } })).toMatchObject({ ok: false, status: 409 });
    }
  });
});

describe('decidirRevogacaoPremium', () => {
  const rev = (over: Partial<Parameters<typeof decidirRevogacaoPremium>[0]> = {}) =>
    decidirRevogacaoPremium({ conta: { ...FREE, tipo_conta: 'wellness_premium' }, assinaturas: [assinatura()], ...over });

  it('Premium com cortesia ativa: rebaixa e cancela a cortesia', () => {
    expect(rev()).toEqual({ ok: true, assinaturaId: 'a1', rebaixar: true });
  });

  it('execução anterior parou no meio (conta já gratuita, cortesia ainda ativa): só cancela a cortesia', () => {
    expect(rev({ conta: FREE })).toEqual({ ok: true, assinaturaId: 'a1', rebaixar: false });
  });

  it('assinatura paga ativa: recusa, mesmo havendo cortesia junto', () => {
    expect(rev({ assinaturas: [assinatura({ provider: 'stripe' })] })).toMatchObject({ ok: false, status: 409 });
    expect(rev({ assinaturas: [assinatura(), assinatura({ id: 'a2', provider: 'paddle' })] })).toMatchObject({ ok: false, status: 409 });
  });

  it('Premium sem cortesia ativa, gratuita sem cortesia e clínico: recusa', () => {
    expect(rev({ assinaturas: [] })).toMatchObject({ ok: false, status: 409 });
    expect(rev({ conta: FREE, assinaturas: [] })).toMatchObject({ ok: false, status: 409 });
    expect(rev({ conta: { ...FREE, tipo_conta: 'clinico' } })).toMatchObject({ ok: false, status: 409 });
  });
});

// ---------------------------------------------------------------------------
// Execução contra um banco de mentira que respeita ILIKE (com escape), filtros .eq e retorno de linhas.
// ---------------------------------------------------------------------------

type Linha = Record<string, unknown>;

function ilikeParaRegex(padrao: string): RegExp {
  let re = '';
  for (let i = 0; i < padrao.length; i++) {
    const c = padrao[i];
    if (c === '\\' && i + 1 < padrao.length) { re += padrao[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); continue; }
    if (c === '%') re += '.*';
    else if (c === '_') re += '.';
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
}

interface Opcoes {
  /** Nome "tabela:operação" cujas linhas atingidas devem vir vazias (corrida com outra alteração). */
  zeroLinhas?: string[];
  /** Nome "tabela:operação" que devolve erro do banco. */
  erro?: string[];
  /** Roda logo antes da operação (simula outra alteração entre a leitura e a escrita). */
  antes?: Record<string, () => void>;
}

function bancoFalso(estado: { pacientes: Linha[]; wellness_assinaturas: Linha[] }, opcoes: Opcoes = {}) {
  const log: string[] = [];
  const padroesIlike: string[] = [];
  let seq = 0;
  const from = (tabela: 'pacientes' | 'wellness_assinaturas') => {
    const linhas = estado[tabela];
    const q = {
      op: 'select' as 'select' | 'update' | 'insert',
      filtros: [] as ((l: Linha) => boolean)[],
      patch: {} as Linha,
      novo: {} as Linha,
      select() { return q; },
      ilike(col: string, padrao: string) { padroesIlike.push(padrao); const re = ilikeParaRegex(padrao); q.filtros.push((l) => re.test(String(l[col] ?? ''))); return q; },
      eq(col: string, v: unknown) { q.filtros.push((l) => l[col] === v); return q; },
      update(patch: Linha) { q.op = 'update'; q.patch = patch; return q; },
      insert(novo: Linha) { q.op = 'insert'; q.novo = novo; return q; },
      then(resolve: (v: { data: Linha[] | null; error: unknown }) => void) {
        const nome = `${tabela}:${q.op}`;
        log.push(nome);
        opcoes.antes?.[nome]?.();
        if (opcoes.erro?.includes(nome)) return resolve({ data: null, error: new Error(`falha em ${nome}`) });
        if (q.op === 'select') return resolve({ data: linhas.filter((l) => q.filtros.every((f) => f(l))).map((l) => ({ ...l })), error: null });
        if (q.op === 'insert') {
          if (opcoes.zeroLinhas?.includes(nome)) return resolve({ data: [], error: null });
          const l = { id: `novo${++seq}`, ...q.novo };
          linhas.push(l);
          return resolve({ data: [{ id: l.id }], error: null });
        }
        const alvo = linhas.filter((l) => q.filtros.every((f) => f(l)));
        if (opcoes.zeroLinhas?.includes(nome)) return resolve({ data: [], error: null });
        alvo.forEach((l) => Object.assign(l, q.patch));
        return resolve({ data: alvo.map((l) => ({ id: l.id })), error: null });
      },
    };
    return q;
  };
  return { banco: { from }, log, padroesIlike };
}

const pac = (over: Linha = {}): Linha => ({ id: 'p1', user_id: 'u1', tipo_conta: 'wellness_free', email: 'douglas@exemplo.com.br', ...over });

describe('executarPremiumCliente — conceder', () => {
  it('conta gratuita: grava a cortesia e promove, nessa ordem, e responde ok', async () => {
    const estado = { pacientes: [pac()], wellness_assinaturas: [] as Linha[] };
    const { banco, log } = bancoFalso(estado);
    const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', { email: ' Douglas@Exemplo.com.br ' }, AGORA);
    expect(r).toEqual({ status: 200, payload: { ok: true, ja_premium: false, ate: null } });
    expect(estado.pacientes[0].tipo_conta).toBe('wellness_premium');
    expect(estado.wellness_assinaturas).toHaveLength(1);
    expect(estado.wellness_assinaturas[0]).toMatchObject({ paciente_id: 'p1', status: 'ativa', provider: 'manual', valor_mensal: 0, data_fim: null });
    expect(log.indexOf('wellness_assinaturas:insert')).toBeGreaterThan(-1);
    expect(log.indexOf('wellness_assinaturas:insert')).toBeLessThan(log.indexOf('pacientes:update'));
  });

  it('com dias: devolve a data de fim e grava o mesmo instante na próxima cobrança', async () => {
    const estado = { pacientes: [pac()], wellness_assinaturas: [] as Linha[] };
    const { banco } = bancoFalso(estado);
    const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', { email: 'douglas@exemplo.com.br', dias: 15 }, AGORA);
    const fim = new Date(AGORA.getTime() + 15 * DIA).toISOString();
    expect(r.payload).toEqual({ ok: true, ja_premium: false, ate: fim });
    expect(estado.wellness_assinaturas[0]).toMatchObject({ data_fim: fim, proxima_cobranca: fim });
  });

  it('dias inválido ou e-mail inválido: 400 antes de ler o banco', async () => {
    for (const body of [{ email: 'douglas@exemplo.com.br', dias: 0 }, { email: 'douglas@exemplo.com.br', dias: 'x' }, { email: 'sem-arroba' }, {}]) {
      const estado = { pacientes: [pac()], wellness_assinaturas: [] as Linha[] };
      const { banco, log } = bancoFalso(estado);
      const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', body, AGORA);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(log).toEqual([]);
    }
  });

  it('o "_" do e-mail não vira curinga: a_b@x.com não pega aXb@x.com', async () => {
    const estado = {
      pacientes: [pac({ id: 'p1', email: 'aXb@x.com' }), pac({ id: 'p2', user_id: 'u2', email: 'a_b@x.com' })],
      wellness_assinaturas: [] as Linha[],
    };
    const { banco } = bancoFalso(estado);
    const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', { email: 'a_b@x.com' }, AGORA);
    expect(r.status).toBe(200);
    expect(estado.pacientes.find((p) => p.id === 'p2')?.tipo_conta).toBe('wellness_premium');
    expect(estado.pacientes.find((p) => p.id === 'p1')?.tipo_conta).toBe('wellness_free');
  });

  it('manda para o banco o padrão com os curingas escapados', async () => {
    const estado = { pacientes: [pac({ email: 'a_b%c@x.com' })], wellness_assinaturas: [] as Linha[] };
    const { banco, padroesIlike } = bancoFalso(estado);
    await executarPremiumCliente(banco, 'conceder_premium_cliente', { email: 'a_b%c@x.com' }, AGORA);
    expect(padroesIlike).toEqual(['a\\_b\\%c@x.com']);
  });

  it('se a conta virou clínica entre a leitura e a escrita, a troca não passa por cima', async () => {
    const estado = { pacientes: [pac()], wellness_assinaturas: [] as Linha[] };
    const { banco } = bancoFalso(estado, { antes: { 'pacientes:update': () => { estado.pacientes[0].tipo_conta = 'clinico'; } } });
    const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', { email: 'douglas@exemplo.com.br' }, AGORA);
    expect(r.status).toBe(409);
    expect(estado.pacientes[0].tipo_conta).toBe('clinico');
  });

  it('e-mail guardado com outras maiúsculas ainda acha a conta', async () => {
    const estado = { pacientes: [pac({ email: 'Douglas@Exemplo.COM.br' })], wellness_assinaturas: [] as Linha[] };
    const { banco } = bancoFalso(estado);
    expect((await executarPremiumCliente(banco, 'conceder_premium_cliente', { email: 'douglas@exemplo.com.br' }, AGORA)).status).toBe(200);
  });

  it('já Premium com assinatura ativa: responde ja_premium e não escreve nada', async () => {
    const estado = { pacientes: [pac({ tipo_conta: 'wellness_premium' })], wellness_assinaturas: [{ id: 'a1', paciente_id: 'p1', status: 'ativa', provider: 'stripe' }] as Linha[] };
    const { banco, log } = bancoFalso(estado);
    const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', { email: 'douglas@exemplo.com.br' }, AGORA);
    expect(r).toEqual({ status: 200, payload: { ok: true, ja_premium: true } });
    expect(log.filter((l) => /update|insert/.test(l))).toEqual([]);
    expect(estado.wellness_assinaturas[0].provider).toBe('stripe');
  });

  it('recusas não escrevem: clínico, assinatura paga, sem login, sem conta, duas contas', async () => {
    const casos: { nome: string; pacientes: Linha[]; assinaturas?: Linha[]; status: number }[] = [
      { nome: 'clínico', pacientes: [pac({ tipo_conta: 'clinico' })], status: 409 },
      { nome: 'paga ativa', pacientes: [pac()], assinaturas: [{ id: 'a1', paciente_id: 'p1', status: 'ativa', provider: 'stripe' }], status: 409 },
      { nome: 'sem login', pacientes: [pac({ user_id: null })], status: 404 },
      { nome: 'sem conta', pacientes: [], status: 404 },
      { nome: 'duas contas', pacientes: [pac(), pac({ id: 'p2', user_id: 'u2' })], status: 409 },
    ];
    for (const c of casos) {
      const estado = { pacientes: c.pacientes, wellness_assinaturas: (c.assinaturas ?? []) as Linha[] };
      const { banco, log } = bancoFalso(estado);
      const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', { email: 'douglas@exemplo.com.br' }, AGORA);
      expect(r.status, c.nome).toBe(c.status);
      expect(log.filter((l) => /update|insert/.test(l)), c.nome).toEqual([]);
    }
  });

  it('a troca de tipo só pega conta gratuita: se a conta mudou no meio, 409 e nada de "ok"', async () => {
    const estado = { pacientes: [pac()], wellness_assinaturas: [] as Linha[] };
    const { banco } = bancoFalso(estado, { zeroLinhas: ['pacientes:update'] });
    const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', { email: 'douglas@exemplo.com.br' }, AGORA);
    expect(r.status).toBe(409);
    expect(r.payload).not.toHaveProperty('ok');
  });

  it('assinatura que não gravou linha nenhuma: 409 e o tipo da conta nem é tocado', async () => {
    const estado = { pacientes: [pac()], wellness_assinaturas: [] as Linha[] };
    const { banco, log } = bancoFalso(estado, { zeroLinhas: ['wellness_assinaturas:insert'] });
    const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', { email: 'douglas@exemplo.com.br' }, AGORA);
    expect(r.status).toBe(409);
    expect(log).not.toContain('pacientes:update');
    expect(estado.pacientes[0].tipo_conta).toBe('wellness_free');
  });

  it('erro do banco sobe como exceção (a função devolve 500), sem declarar sucesso', async () => {
    const estado = { pacientes: [pac()], wellness_assinaturas: [] as Linha[] };
    const { banco } = bancoFalso(estado, { erro: ['pacientes:update'] });
    await expect(executarPremiumCliente(banco, 'conceder_premium_cliente', { email: 'douglas@exemplo.com.br' }, AGORA)).rejects.toThrow('falha em pacientes:update');
  });

  it('se parou no meio (cortesia gravada, conta ainda gratuita), repetir conclui sem duplicar a cortesia', async () => {
    const estado = { pacientes: [pac()], wellness_assinaturas: [] as Linha[] };
    const primeira = bancoFalso(estado, { erro: ['pacientes:update'] });
    await expect(executarPremiumCliente(primeira.banco, 'conceder_premium_cliente', { email: 'douglas@exemplo.com.br' }, AGORA)).rejects.toThrow();
    expect(estado.wellness_assinaturas).toHaveLength(1);
    const segunda = bancoFalso(estado);
    const r = await executarPremiumCliente(segunda.banco, 'conceder_premium_cliente', { email: 'douglas@exemplo.com.br' }, AGORA);
    expect(r.status).toBe(200);
    expect(estado.wellness_assinaturas).toHaveLength(1);
    expect(segunda.log).toContain('wellness_assinaturas:update');
    expect(segunda.log).not.toContain('wellness_assinaturas:insert');
    expect(estado.pacientes[0].tipo_conta).toBe('wellness_premium');
  });
});

describe('executarPremiumCliente — revogar', () => {
  const premiumComCortesia = () => ({
    pacientes: [pac({ tipo_conta: 'wellness_premium' })],
    wellness_assinaturas: [{ id: 'a1', paciente_id: 'p1', status: 'ativa', provider: 'manual' }] as Linha[],
  });

  it('rebaixa a conta e cancela a cortesia, nessa ordem', async () => {
    const estado = premiumComCortesia();
    const { banco, log } = bancoFalso(estado);
    const r = await executarPremiumCliente(banco, 'revogar_premium_cliente', { email: 'douglas@exemplo.com.br' }, AGORA);
    expect(r).toEqual({ status: 200, payload: { ok: true } });
    expect(estado.pacientes[0].tipo_conta).toBe('wellness_free');
    expect(estado.wellness_assinaturas[0]).toMatchObject({ status: 'cancelada', data_fim: AGORA.toISOString() });
    expect(log.indexOf('pacientes:update')).toBeLessThan(log.indexOf('wellness_assinaturas:update'));
  });

  it('assinatura paga: recusa e não escreve', async () => {
    const estado = { pacientes: [pac({ tipo_conta: 'wellness_premium' })], wellness_assinaturas: [{ id: 'a1', paciente_id: 'p1', status: 'ativa', provider: 'stripe' }] as Linha[] };
    const { banco, log } = bancoFalso(estado);
    const r = await executarPremiumCliente(banco, 'revogar_premium_cliente', { email: 'douglas@exemplo.com.br' }, AGORA);
    expect(r.status).toBe(409);
    expect(log.filter((l) => /update|insert/.test(l))).toEqual([]);
    expect(estado.pacientes[0].tipo_conta).toBe('wellness_premium');
  });

  it('se parou no meio (conta já gratuita, cortesia ativa), repetir cancela só a cortesia', async () => {
    const estado = premiumComCortesia();
    const primeira = bancoFalso(estado, { erro: ['wellness_assinaturas:update'] });
    await expect(executarPremiumCliente(primeira.banco, 'revogar_premium_cliente', { email: 'douglas@exemplo.com.br' }, AGORA)).rejects.toThrow();
    expect(estado.pacientes[0].tipo_conta).toBe('wellness_free');
    const segunda = bancoFalso(estado);
    const r = await executarPremiumCliente(segunda.banco, 'revogar_premium_cliente', { email: 'douglas@exemplo.com.br' }, AGORA);
    expect(r.status).toBe(200);
    expect(segunda.log).not.toContain('pacientes:update');
    expect(estado.wellness_assinaturas[0].status).toBe('cancelada');
  });

  it('conta que mudou no meio: 409 sem "ok"; cortesia que mudou: 409', async () => {
    const a = bancoFalso(premiumComCortesia(), { zeroLinhas: ['pacientes:update'] });
    const ra = await executarPremiumCliente(a.banco, 'revogar_premium_cliente', { email: 'douglas@exemplo.com.br' }, AGORA);
    expect(ra.status).toBe(409);
    expect(ra.payload).not.toHaveProperty('ok');
    const b = bancoFalso(premiumComCortesia(), { zeroLinhas: ['wellness_assinaturas:update'] });
    const rb = await executarPremiumCliente(b.banco, 'revogar_premium_cliente', { email: 'douglas@exemplo.com.br' }, AGORA);
    expect(rb.status).toBe(409);
    expect(rb.payload).not.toHaveProperty('ok');
  });

  it('se a conta virou clínica entre a leitura e o rebaixamento, ele não passa por cima', async () => {
    const estado = premiumComCortesia();
    const { banco } = bancoFalso(estado, { antes: { 'pacientes:update': () => { estado.pacientes[0].tipo_conta = 'clinico'; } } });
    const r = await executarPremiumCliente(banco, 'revogar_premium_cliente', { email: 'douglas@exemplo.com.br' }, AGORA);
    expect(r.status).toBe(409);
    expect(estado.pacientes[0].tipo_conta).toBe('clinico');
    expect(estado.wellness_assinaturas[0].status).toBe('ativa');
  });

  it('se a assinatura virou paga entre a leitura e o cancelamento, a cancelação não pega', async () => {
    const estado = premiumComCortesia();
    const { banco } = bancoFalso(estado, { antes: { 'wellness_assinaturas:update': () => { estado.wellness_assinaturas[0].provider = 'stripe'; } } });
    const r = await executarPremiumCliente(banco, 'revogar_premium_cliente', { email: 'douglas@exemplo.com.br' }, AGORA);
    expect(r.status).toBe(409);
    expect(estado.wellness_assinaturas[0].status).toBe('ativa');
  });

  it('revogar ignora "dias" e valida só o e-mail', async () => {
    const estado = premiumComCortesia();
    const { banco } = bancoFalso(estado);
    expect((await executarPremiumCliente(banco, 'revogar_premium_cliente', { email: 'douglas@exemplo.com.br', dias: 'abc' }, AGORA)).status).toBe(200);
  });
});
