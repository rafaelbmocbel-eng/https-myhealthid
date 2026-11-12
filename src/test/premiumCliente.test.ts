import { describe, expect, it } from 'vitest';
import {
  DIAS_MAXIMOS_CORTESIA,
  MAX_PAGINAS_USUARIOS,
  USUARIOS_POR_PAGINA,
  decidirConcessaoPremium,
  decidirRevogacaoPremium,
  emailPareceValido,
  escolherConta,
  executarPremiumCliente,
  lerDias,
  normalizarEmail,
  type AssinaturaDaConta,
  type PacienteDaConta,
  type UsuarioAuth,
} from '../../supabase/functions/_shared/premium-cliente';

const AGORA = new Date('2026-11-12T15:00:00Z');
const DIA = 86_400_000;

const FREE: PacienteDaConta = { id: 'p1', user_id: 'u1', tipo_conta: 'wellness_free' };
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
  it('um cadastro: é ele', () => {
    expect(escolherConta([FREE])).toEqual(FREE);
  });

  it('nenhum cadastro: 404; mais de um: 409 sem escolher um deles', () => {
    expect(escolherConta([])).toMatchObject({ ok: false, status: 404 });
    expect(escolherConta([FREE, { ...FREE, id: 'p2' }])).toMatchObject({ ok: false, status: 409 });
  });
});

describe('decidirConcessaoPremium', () => {
  const dec = (over: Partial<Parameters<typeof decidirConcessaoPremium>[0]> = {}) =>
    decidirConcessaoPremium({ conta: FREE, assinaturas: [], dias: null, agora: AGORA, ...over });

  it('conta gratuita sem prazo: cortesia manual a custo zero, sem próxima cobrança (nenhum vencimento), conta vira Premium', () => {
    expect(dec()).toEqual({
      ok: true, jaPremium: false, tipoNovo: 'wellness_premium',
      assinatura: { id: null, status: 'ativa', provider: 'manual', valor_mensal: 0, data_inicio: AGORA.toISOString(), data_fim: null, proxima_cobranca: null },
    });
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

  it('com uma cortesia cancelada e outra ativa, reaproveita a ATIVA', () => {
    const r = dec({ assinaturas: [assinatura({ id: 'velha', status: 'cancelada' }), assinatura({ id: 'viva', status: 'ativa' })] });
    if (!r.ok || !r.assinatura) throw new Error('esperava assinatura');
    expect(r.assinatura.id).toBe('viva');
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
    expect(rev()).toEqual({ ok: true, assinaturaIds: ['a1'], rebaixar: true });
  });

  it('mais de uma cortesia ativa: cancela todas', () => {
    expect(rev({ assinaturas: [assinatura({ id: 'a1' }), assinatura({ id: 'a2' }), assinatura({ id: 'a3', status: 'cancelada' })] }))
      .toEqual({ ok: true, assinaturaIds: ['a1', 'a2'], rebaixar: true });
  });

  it('execução anterior parou no meio (conta já gratuita, cortesia ainda ativa): só cancela a cortesia', () => {
    expect(rev({ conta: FREE })).toEqual({ ok: true, assinaturaIds: ['a1'], rebaixar: false });
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
// Execução contra um banco de mentira com filtros .eq/.in, retorno de linhas e a API de logins.
// ---------------------------------------------------------------------------

type Linha = Record<string, unknown>;

interface Opcoes {
  /** Nome "tabela:operação" cujas linhas atingidas devem vir vazias (corrida com outra alteração). */
  zeroLinhas?: string[];
  /** Nome "tabela:operação" que devolve erro do banco. */
  erro?: string[];
  /** Roda logo antes da operação (simula outra alteração entre a leitura e a escrita). */
  antes?: Record<string, () => void>;
}

interface Estado {
  pacientes: Linha[];
  wellness_assinaturas: Linha[];
  usuarios: UsuarioAuth[];
}

function bancoFalso(estado: Estado, opcoes: Opcoes = {}) {
  const log: string[] = [];
  const paginasPedidas: number[] = [];
  let seq = 0;
  const from = (tabela: 'pacientes' | 'wellness_assinaturas') => {
    const linhas = estado[tabela];
    const q = {
      op: 'select' as 'select' | 'update' | 'insert' | 'delete',
      filtros: [] as ((l: Linha) => boolean)[],
      patch: {} as Linha,
      novo: {} as Linha,
      select() { return q; },
      eq(col: string, v: unknown) { q.filtros.push((l) => l[col] === v); return q; },
      in(col: string, vs: unknown[]) { q.filtros.push((l) => vs.includes(l[col])); return q; },
      update(patch: Linha) { q.op = 'update'; q.patch = patch; return q; },
      insert(novo: Linha) { q.op = 'insert'; q.novo = novo; return q; },
      delete() { q.op = 'delete'; return q; },
      then(resolve: (v: { data: Linha[] | null; error: unknown }) => void) {
        const nome = `${tabela}:${q.op}`;
        log.push(nome);
        opcoes.antes?.[nome]?.();
        if (opcoes.erro?.includes(nome)) return resolve({ data: null, error: new Error(`falha em ${nome}`) });
        if (q.op === 'select') return resolve({ data: linhas.filter((l) => q.filtros.every((f) => f(l))).map((l) => ({ ...l })), error: null });
        if (q.op === 'insert') {
          if (opcoes.zeroLinhas?.includes(nome)) return resolve({ data: [], error: null });
          const l = { id: `novo${++seq}`, created_at: `2026-11-12T15:00:0${seq}Z`, ...q.novo };
          linhas.push(l);
          return resolve({ data: [{ id: l.id }], error: null });
        }
        const alvo = linhas.filter((l) => q.filtros.every((f) => f(l)));
        if (opcoes.zeroLinhas?.includes(nome)) return resolve({ data: [], error: null });
        if (q.op === 'delete') {
          alvo.forEach((l) => linhas.splice(linhas.indexOf(l), 1));
          return resolve({ data: alvo.map((l) => ({ id: l.id })), error: null });
        }
        alvo.forEach((l) => Object.assign(l, q.patch));
        return resolve({ data: alvo.map((l) => ({ id: l.id })), error: null });
      },
    };
    return q;
  };
  const auth = {
    admin: {
      listUsers: async ({ page, perPage }: { page: number; perPage: number }) => {
        paginasPedidas.push(page);
        return { data: { users: estado.usuarios.slice((page - 1) * perPage, page * perPage) }, error: null };
      },
    },
  };
  return { banco: { from, auth }, log, paginasPedidas };
}

const login = (over: Partial<UsuarioAuth> = {}): UsuarioAuth => ({ id: 'u1', email: 'douglas@exemplo.com.br', email_confirmed_at: '2026-10-01T10:00:00Z', ...over });
const pac = (over: Linha = {}): Linha => ({ id: 'p1', user_id: 'u1', tipo_conta: 'wellness_free', ...over });
const novoEstado = (over: Partial<Estado> = {}): Estado => ({ pacientes: [pac()], wellness_assinaturas: [], usuarios: [login()], ...over });
const EMAIL = { email: 'douglas@exemplo.com.br' };
const escritas = (log: string[]) => log.filter((l) => /update|insert|delete/.test(l));

describe('executarPremiumCliente — achar a conta pelo e-mail do LOGIN', () => {
  it('e-mail com maiúsculas e espaços acha o login; o cadastro é o do user_id dele', async () => {
    const estado = novoEstado({ usuarios: [login({ email: 'Douglas@Exemplo.COM.br' })] });
    const { banco } = bancoFalso(estado);
    const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', { email: ' DOUGLAS@exemplo.com.br ' }, AGORA);
    expect(r.status).toBe(200);
    expect(estado.pacientes[0].tipo_conta).toBe('wellness_premium');
  });

  it('cliente que pôs o e-mail da vítima no próprio cadastro NÃO recebe o Premium: vale o e-mail do login', async () => {
    const estado = novoEstado({
      usuarios: [login({ id: 'uVitima', email: 'vitima@exemplo.com' }), login({ id: 'uAtacante', email: 'atacante@exemplo.com' })],
      pacientes: [pac({ id: 'pV', user_id: 'uVitima', email: 'vitima@exemplo.com' }), pac({ id: 'pA', user_id: 'uAtacante', email: 'vitima@exemplo.com' })],
    });
    const { banco } = bancoFalso(estado);
    const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', { email: 'vitima@exemplo.com' }, AGORA);
    expect(r.status).toBe(200);
    expect(estado.pacientes.find((p) => p.id === 'pV')?.tipo_conta).toBe('wellness_premium');
    expect(estado.pacientes.find((p) => p.id === 'pA')?.tipo_conta).toBe('wellness_free');
  });

  it('login com e-mail diferente do que está no cadastro (por exemplo, entrou com o Google): ainda acha', async () => {
    const estado = novoEstado({ pacientes: [pac({ email: 'outro@exemplo.com' })] });
    const { banco } = bancoFalso(estado);
    expect((await executarPremiumCliente(banco, 'conceder_premium_cliente', EMAIL, AGORA)).status).toBe(200);
  });

  it('procura nas páginas seguintes dos logins', async () => {
    const muitos: UsuarioAuth[] = Array.from({ length: USUARIOS_POR_PAGINA + 5 }, (_, i) => ({ id: `x${i}`, email: `x${i}@exemplo.com`, email_confirmed_at: '2026-01-01T00:00:00Z' }));
    const estado = novoEstado({ usuarios: [...muitos, login()] });
    const { banco, paginasPedidas } = bancoFalso(estado);
    const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', EMAIL, AGORA);
    expect(r.status).toBe(200);
    expect(paginasPedidas).toEqual([1, 2]);
  });

  it('login que não existe: 404 depois de varrer; sem escrever nada', async () => {
    const estado = novoEstado({ usuarios: [login({ email: 'outro@exemplo.com' })] });
    const { banco, log } = bancoFalso(estado);
    const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', EMAIL, AGORA);
    expect(r.status).toBe(404);
    expect(escritas(log)).toEqual([]);
  });

  it('muitos logins: para no teto de páginas em vez de varrer para sempre, e não escreve', async () => {
    const cheio = (pagina: number) => Array.from({ length: USUARIOS_POR_PAGINA }, (_, i) => ({ id: `u${pagina}-${i}`, email: `u${pagina}-${i}@x.com`, email_confirmed_at: 'x' }));
    const paginas: number[] = [];
    const banco = {
      from: () => { throw new Error('não deveria ler o banco'); },
      auth: { admin: { listUsers: async ({ page }: { page: number }) => { paginas.push(page); return { data: { users: cheio(page) }, error: null }; } } },
    };
    const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', EMAIL, AGORA);
    expect(r.status).toBe(500);
    expect(paginas).toHaveLength(MAX_PAGINAS_USUARIOS);
  });

  it('e-mail ainda não confirmado: 409 sem escrever', async () => {
    const estado = novoEstado({ usuarios: [login({ email_confirmed_at: null })] });
    const { banco, log } = bancoFalso(estado);
    const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', EMAIL, AGORA);
    expect(r.status).toBe(409);
    expect(escritas(log)).toEqual([]);
  });

  it('login sem cadastro de cliente: 404; com dois cadastros: 409; sem escrever', async () => {
    for (const [pacientes, status] of [[[], 404], [[pac(), pac({ id: 'p2' })], 409]] as [Linha[], number][]) {
      const estado = novoEstado({ pacientes });
      const { banco, log } = bancoFalso(estado);
      const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', EMAIL, AGORA);
      expect(r.status).toBe(status);
      expect(escritas(log)).toEqual([]);
    }
  });

  it('erro ao listar os logins sobe como exceção', async () => {
    const banco = { from: () => { throw new Error('x'); }, auth: { admin: { listUsers: async () => ({ data: null, error: new Error('falha na API') }) } } };
    await expect(executarPremiumCliente(banco, 'conceder_premium_cliente', EMAIL, AGORA)).rejects.toThrow('falha na API');
  });
});

describe('executarPremiumCliente — conceder', () => {
  it('conta gratuita: grava a cortesia e promove, nessa ordem, e responde ok', async () => {
    const estado = novoEstado();
    const { banco, log } = bancoFalso(estado);
    const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', EMAIL, AGORA);
    expect(r).toEqual({ status: 200, payload: { ok: true, ja_premium: false, ate: null } });
    expect(estado.pacientes[0].tipo_conta).toBe('wellness_premium');
    expect(estado.wellness_assinaturas).toHaveLength(1);
    expect(estado.wellness_assinaturas[0]).toMatchObject({ paciente_id: 'p1', status: 'ativa', provider: 'manual', valor_mensal: 0, data_fim: null, proxima_cobranca: null });
    expect(log.indexOf('wellness_assinaturas:insert')).toBeGreaterThan(-1);
    expect(log.indexOf('wellness_assinaturas:insert')).toBeLessThan(log.indexOf('pacientes:update'));
  });

  it('com dias: devolve a data de fim e grava o mesmo instante na próxima cobrança', async () => {
    const estado = novoEstado();
    const { banco } = bancoFalso(estado);
    const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', { ...EMAIL, dias: 15 }, AGORA);
    const fim = new Date(AGORA.getTime() + 15 * DIA).toISOString();
    expect(r.payload).toEqual({ ok: true, ja_premium: false, ate: fim });
    expect(estado.wellness_assinaturas[0]).toMatchObject({ data_fim: fim, proxima_cobranca: fim });
  });

  it('dias inválido ou e-mail inválido: 400 antes de ler o banco ou os logins', async () => {
    for (const body of [{ ...EMAIL, dias: 0 }, { ...EMAIL, dias: 'x' }, { email: 'sem-arroba' }, {}]) {
      const estado = novoEstado();
      const { banco, log, paginasPedidas } = bancoFalso(estado);
      const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', body, AGORA);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(log).toEqual([]);
      expect(paginasPedidas).toEqual([]);
    }
  });

  it('já Premium com assinatura ativa: responde ja_premium e não escreve nada', async () => {
    const estado = novoEstado({ pacientes: [pac({ tipo_conta: 'wellness_premium' })], wellness_assinaturas: [{ id: 'a1', paciente_id: 'p1', status: 'ativa', provider: 'stripe' }] });
    const { banco, log } = bancoFalso(estado);
    const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', EMAIL, AGORA);
    expect(r).toEqual({ status: 200, payload: { ok: true, ja_premium: true } });
    expect(escritas(log)).toEqual([]);
    expect(estado.wellness_assinaturas[0].provider).toBe('stripe');
  });

  it('recusas não escrevem: clínico e assinatura paga', async () => {
    const casos: { nome: string; pacientes: Linha[]; assinaturas?: Linha[]; status: number }[] = [
      { nome: 'clínico', pacientes: [pac({ tipo_conta: 'clinico' })], status: 409 },
      { nome: 'paga ativa', pacientes: [pac()], assinaturas: [{ id: 'a1', paciente_id: 'p1', status: 'ativa', provider: 'stripe' }], status: 409 },
    ];
    for (const c of casos) {
      const estado = novoEstado({ pacientes: c.pacientes, wellness_assinaturas: c.assinaturas ?? [] });
      const { banco, log } = bancoFalso(estado);
      const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', EMAIL, AGORA);
      expect(r.status, c.nome).toBe(c.status);
      expect(escritas(log), c.nome).toEqual([]);
    }
  });

  it('a troca de tipo só pega conta gratuita: se a conta virou clínica no meio, 409, o tipo não é sobrescrito e a cortesia nova é apagada', async () => {
    const estado = novoEstado();
    const { banco } = bancoFalso(estado, { antes: { 'pacientes:update': () => { estado.pacientes[0].tipo_conta = 'clinico'; } } });
    const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', EMAIL, AGORA);
    expect(r.status).toBe(409);
    expect(r.payload).not.toHaveProperty('ok');
    expect(estado.pacientes[0].tipo_conta).toBe('clinico');
    expect(estado.wellness_assinaturas).toEqual([]);
  });

  it('assinatura que não gravou linha nenhuma: 409 e o tipo da conta nem é tocado', async () => {
    const estado = novoEstado();
    const { banco, log } = bancoFalso(estado, { zeroLinhas: ['wellness_assinaturas:insert'] });
    const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', EMAIL, AGORA);
    expect(r.status).toBe(409);
    expect(log).not.toContain('pacientes:update');
    expect(estado.pacientes[0].tipo_conta).toBe('wellness_free');
  });

  it('erro do banco ao trocar o tipo: sobe como exceção (a função devolve 500) e a cortesia recém-criada é apagada', async () => {
    const estado = novoEstado();
    const { banco } = bancoFalso(estado, { erro: ['pacientes:update'] });
    await expect(executarPremiumCliente(banco, 'conceder_premium_cliente', EMAIL, AGORA)).rejects.toThrow('falha em pacientes:update');
    expect(estado.wellness_assinaturas).toEqual([]);
    expect(estado.pacientes[0].tipo_conta).toBe('wellness_free');
  });

  it('se a troca de tipo falha numa cortesia que JÁ existia, ela não é apagada; repetir conclui sem duplicar', async () => {
    const estado = novoEstado({ wellness_assinaturas: [{ id: 'a1', paciente_id: 'p1', status: 'ativa', provider: 'manual', created_at: '2026-11-01T00:00:00Z' }] });
    const primeira = bancoFalso(estado, { erro: ['pacientes:update'] });
    await expect(executarPremiumCliente(primeira.banco, 'conceder_premium_cliente', EMAIL, AGORA)).rejects.toThrow();
    expect(estado.wellness_assinaturas).toHaveLength(1);
    const segunda = bancoFalso(estado);
    const r = await executarPremiumCliente(segunda.banco, 'conceder_premium_cliente', EMAIL, AGORA);
    expect(r.status).toBe(200);
    expect(estado.wellness_assinaturas).toHaveLength(1);
    expect(segunda.log).not.toContain('wellness_assinaturas:insert');
    expect(estado.pacientes[0].tipo_conta).toBe('wellness_premium');
  });

  it('duas concessões ao mesmo tempo numa conta Premium sem cortesia: fica só a mais antiga ativa', async () => {
    const estado = novoEstado({ pacientes: [pac({ tipo_conta: 'wellness_premium' })] });
    const { banco } = bancoFalso(estado, {
      antes: { 'wellness_assinaturas:insert': () => { estado.wellness_assinaturas.push({ id: 'outra', paciente_id: 'p1', status: 'ativa', provider: 'manual', created_at: '2026-11-12T14:59:59Z' }); } },
    });
    const r = await executarPremiumCliente(banco, 'conceder_premium_cliente', EMAIL, AGORA);
    expect(r.status).toBe(200);
    const ativas = estado.wellness_assinaturas.filter((a) => a.status === 'ativa');
    expect(ativas.map((a) => a.id)).toEqual(['outra']);
    expect(estado.wellness_assinaturas.find((a) => a.id !== 'outra')).toMatchObject({ status: 'cancelada' });
  });
});

describe('executarPremiumCliente — revogar', () => {
  const premiumComCortesia = (): Estado => novoEstado({
    pacientes: [pac({ tipo_conta: 'wellness_premium' })],
    wellness_assinaturas: [{ id: 'a1', paciente_id: 'p1', status: 'ativa', provider: 'manual' }],
  });

  it('rebaixa a conta e cancela a cortesia, nessa ordem', async () => {
    const estado = premiumComCortesia();
    const { banco, log } = bancoFalso(estado);
    const r = await executarPremiumCliente(banco, 'revogar_premium_cliente', EMAIL, AGORA);
    expect(r).toEqual({ status: 200, payload: { ok: true } });
    expect(estado.pacientes[0].tipo_conta).toBe('wellness_free');
    expect(estado.wellness_assinaturas[0]).toMatchObject({ status: 'cancelada', data_fim: AGORA.toISOString() });
    expect(log.indexOf('pacientes:update')).toBeLessThan(log.indexOf('wellness_assinaturas:update'));
  });

  it('cancela todas as cortesias ativas, não só a primeira', async () => {
    const estado = premiumComCortesia();
    estado.wellness_assinaturas.push({ id: 'a2', paciente_id: 'p1', status: 'ativa', provider: 'manual' });
    const { banco } = bancoFalso(estado);
    expect((await executarPremiumCliente(banco, 'revogar_premium_cliente', EMAIL, AGORA)).status).toBe(200);
    expect(estado.wellness_assinaturas.map((a) => a.status)).toEqual(['cancelada', 'cancelada']);
  });

  it('assinatura paga: recusa e não escreve', async () => {
    const estado = novoEstado({ pacientes: [pac({ tipo_conta: 'wellness_premium' })], wellness_assinaturas: [{ id: 'a1', paciente_id: 'p1', status: 'ativa', provider: 'stripe' }] });
    const { banco, log } = bancoFalso(estado);
    const r = await executarPremiumCliente(banco, 'revogar_premium_cliente', EMAIL, AGORA);
    expect(r.status).toBe(409);
    expect(escritas(log)).toEqual([]);
    expect(estado.pacientes[0].tipo_conta).toBe('wellness_premium');
  });

  it('se parou no meio (conta já gratuita, cortesia ativa), repetir cancela só a cortesia', async () => {
    const estado = premiumComCortesia();
    const primeira = bancoFalso(estado, { erro: ['wellness_assinaturas:update'] });
    await expect(executarPremiumCliente(primeira.banco, 'revogar_premium_cliente', EMAIL, AGORA)).rejects.toThrow();
    expect(estado.pacientes[0].tipo_conta).toBe('wellness_free');
    const segunda = bancoFalso(estado);
    const r = await executarPremiumCliente(segunda.banco, 'revogar_premium_cliente', EMAIL, AGORA);
    expect(r.status).toBe(200);
    expect(segunda.log).not.toContain('pacientes:update');
    expect(estado.wellness_assinaturas[0].status).toBe('cancelada');
  });

  it('conta que mudou no meio: 409 sem "ok"; cortesia que mudou: 409', async () => {
    const a = bancoFalso(premiumComCortesia(), { zeroLinhas: ['pacientes:update'] });
    const ra = await executarPremiumCliente(a.banco, 'revogar_premium_cliente', EMAIL, AGORA);
    expect(ra.status).toBe(409);
    expect(ra.payload).not.toHaveProperty('ok');
    const b = bancoFalso(premiumComCortesia(), { zeroLinhas: ['wellness_assinaturas:update'] });
    const rb = await executarPremiumCliente(b.banco, 'revogar_premium_cliente', EMAIL, AGORA);
    expect(rb.status).toBe(409);
    expect(rb.payload).not.toHaveProperty('ok');
  });

  it('se a conta virou clínica entre a leitura e o rebaixamento, ele não passa por cima', async () => {
    const estado = premiumComCortesia();
    const { banco } = bancoFalso(estado, { antes: { 'pacientes:update': () => { estado.pacientes[0].tipo_conta = 'clinico'; } } });
    const r = await executarPremiumCliente(banco, 'revogar_premium_cliente', EMAIL, AGORA);
    expect(r.status).toBe(409);
    expect(estado.pacientes[0].tipo_conta).toBe('clinico');
    expect(estado.wellness_assinaturas[0].status).toBe('ativa');
  });

  it('se a assinatura virou paga entre a leitura e o cancelamento, a cancelação não pega', async () => {
    const estado = premiumComCortesia();
    const { banco } = bancoFalso(estado, { antes: { 'wellness_assinaturas:update': () => { estado.wellness_assinaturas[0].provider = 'stripe'; } } });
    const r = await executarPremiumCliente(banco, 'revogar_premium_cliente', EMAIL, AGORA);
    expect(r.status).toBe(409);
    expect(estado.wellness_assinaturas[0].status).toBe('ativa');
  });

  it('revogar ignora "dias" e valida só o e-mail', async () => {
    const estado = premiumComCortesia();
    const { banco } = bancoFalso(estado);
    expect((await executarPremiumCliente(banco, 'revogar_premium_cliente', { ...EMAIL, dias: 'abc' }, AGORA)).status).toBe(200);
  });
});
