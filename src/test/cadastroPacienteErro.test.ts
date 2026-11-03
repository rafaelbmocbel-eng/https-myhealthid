import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  comNomeDoDuplicado,
  nomeDoClienteComMesmoContato,
  traduzirErroCadastroPaciente,
} from '@/lib/erroCadastroPaciente';
import { gerarPortalToken } from '@/lib/portalToken';
import { normalizarContatoPaciente } from '@/lib/contatoPaciente';

const erroBanco = (message: string, code = '23505', extra: Record<string, string> = {}) => ({ message, code, ...extra });

describe('traduzirErroCadastroPaciente — cada critério sozinho', () => {
  it.each([
    ['e-mail repetido', { message: 'duplicate key value violates unique constraint "uniq_pacientes_terapeuta_email"', code: '23505' }, 'email_duplicado'],
    ['CPF repetido', { message: 'duplicate key value violates unique constraint "uniq_pacientes_terapeuta_cpf"', code: '23505' }, 'cpf_duplicado'],
    ['CPF inválido do gatilho (mensagem + código)', { message: 'CPF inválido', code: '22023' }, 'cpf_invalido'],
    ['CPF inválido só pela mensagem', new Error('Cpf Inválido'), 'cpf_invalido'],
    ['RLS de pacientes', { message: 'new row violates row-level security policy for table "pacientes"', code: '42501' }, 'sessao'],
    ['JWT vencido só pela mensagem', { message: 'JWT expired' }, 'sessao'],
    ['PGRST301 sozinho', { message: 'qualquer', code: 'PGRST301' }, 'sessao'],
    ['PGRST303 sozinho', { message: 'qualquer', code: 'PGRST303' }, 'sessao'],
    ['campo longo pelo código', { message: 'qualquer', code: '22001' }, 'campo_longo'],
    ['campo longo pela mensagem', { message: 'value too long for type character varying(20)' }, 'campo_longo'],
    ['vínculo inexistente', { message: 'violates foreign key constraint "pacientes_convenio_id_fkey"', code: '23503' }, 'vinculo'],
    ['Failed to fetch', new TypeError('Failed to fetch'), 'rede'],
    ['Load failed (Safari)', new TypeError('Load failed'), 'rede'],
    ['NetworkError (Firefox)', new TypeError('NetworkError when attempting to fetch resource.'), 'rede'],
    ['Network request failed', new Error('Network request failed'), 'rede'],
    ['operação esgotada no aparelho', new Error('The operation timed out.'), 'rede'],
  ])('%s', (_nome, erro, causa) => {
    expect(traduzirErroCadastroPaciente(erro).causa).toBe(causa);
  });

  it('o texto de e-mail repetido diz o que fazer', () => {
    const r = traduzirErroCadastroPaciente(erroBanco('uniq_pacientes_terapeuta_email'));
    expect(r.descricao).toMatch(/em branco ou use outro/);
  });
});

describe('traduzirErroCadastroPaciente — o que NÃO deve ser mascarado', () => {
  it('permissão negada de função ou tabela mostra a causa real, não "sessão expirada"', () => {
    const r = traduzirErroCadastroPaciente(erroBanco('permission denied for function paciente_por_telefone_norm', '42501'));
    expect(r.causa).toBe('outro');
    expect(r.descricao).toBe('permission denied for function paciente_por_telefone_norm (código 42501)');
  });

  it('outro erro com SQLSTATE 22023 não vira "CPF inválido"', () => {
    const r = traduzirErroCadastroPaciente(erroBanco('cadastro_status inválido: xpto', '22023'));
    expect(r.causa).toBe('outro');
    expect(r.descricao).toContain('cadastro_status inválido');
  });

  it('timeout de comando do banco não vira "sem conexão"', () => {
    const r = traduzirErroCadastroPaciente(erroBanco('canceling statement due to statement timeout', '57014'));
    expect(r.causa).toBe('outro');
    expect(r.descricao).toContain('statement timeout');
  });

  it('erro desconhecido mostra a mensagem real e o código, nunca um texto genérico', () => {
    const r = traduzirErroCadastroPaciente(erroBanco('algo que ninguém previu', '99999'));
    expect(r.causa).toBe('outro');
    expect(r.descricao).toBe('algo que ninguém previu (código 99999)');
  });

  it('lê o erro do Supabase mesmo quando ele não é uma instância de Error', () => {
    const r = traduzirErroCadastroPaciente({ message: 'falha estranha', details: '', hint: '', code: '' });
    expect(r.descricao).toBe('falha estranha');
  });

  it('aceita lixo sem quebrar', () => {
    expect(traduzirErroCadastroPaciente(undefined).descricao).toBe('erro desconhecido');
    expect(traduzirErroCadastroPaciente(null).causa).toBe('outro');
    expect(traduzirErroCadastroPaciente('texto solto').descricao).toBe('texto solto');
  });
});

describe('nomeDoClienteComMesmoContato', () => {
  const clienteComResposta = (data: unknown, falhar = false) => {
    const calls: Array<[string, unknown]> = [];
    const limit = vi.fn(() => (falhar ? Promise.reject(new Error('rede')) : Promise.resolve({ data })));
    const cadeia: Record<string, unknown> = {};
    const eq = vi.fn((coluna: string, valor: unknown) => { calls.push([coluna, valor]); return cadeia; });
    Object.assign(cadeia, { eq, limit });
    const from = vi.fn(() => ({ select: vi.fn(() => cadeia) }));
    return { cliente: { from }, calls, from };
  };

  afterEach(() => { vi.useRealTimers(); });

  it('procura entre os clientes ativos do mesmo profissional, com e-mail em minúsculas', async () => {
    const { cliente, calls, from } = clienteComResposta([{ nome: 'MARIA', sobrenome: 'SILVA' }]);
    const nome = await nomeDoClienteComMesmoContato(cliente, 'prof-1', 'email', '  Maria@Ex.COM ');
    expect(nome).toBe('MARIA SILVA');
    expect(from).toHaveBeenCalledWith('pacientes');
    expect(calls).toEqual([['terapeuta_id', 'prof-1'], ['ativo', true], ['email', 'maria@ex.com']]);
  });

  it('CPF é comparado só com os dígitos', async () => {
    const { cliente, calls } = clienteComResposta([{ nome: 'JOAO', sobrenome: '' }]);
    expect(await nomeDoClienteComMesmoContato(cliente, 'prof-1', 'cpf', '123.456.789-09')).toBe('JOAO');
    expect(calls[2]).toEqual(['cpf', '12345678909']);
  });

  it('sem resultado, valor vazio ou falha na consulta devolve null (a mensagem só fica mais curta)', async () => {
    expect(await nomeDoClienteComMesmoContato(clienteComResposta([]).cliente, 'p', 'email', 'a@b.c')).toBeNull();
    expect(await nomeDoClienteComMesmoContato(clienteComResposta([]).cliente, 'p', 'email', '   ')).toBeNull();
    expect(await nomeDoClienteComMesmoContato(clienteComResposta(null, true).cliente, 'p', 'email', 'a@b.c')).toBeNull();
  });

  it('consulta pendurada não prende o aviso: passado o limite devolve null', async () => {
    vi.useFakeTimers();
    const pendurado = { from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ limit: () => new Promise(() => {}) }) }) }) }) }) };
    let resolvido = false;
    const espera = nomeDoClienteComMesmoContato(pendurado, 'prof-1', 'email', 'a@b.c', 2000).then((r) => { resolvido = true; return r; });
    await vi.advanceTimersByTimeAsync(1999);
    expect(resolvido).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    expect(await espera).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('consulta rápida limpa o relógio (não deixa timer pendente)', async () => {
    vi.useFakeTimers();
    const { cliente } = clienteComResposta([{ nome: 'ANA', sobrenome: 'LIMA' }]);
    expect(await nomeDoClienteComMesmoContato(cliente, 'p', 'email', 'a@b.c')).toBe('ANA LIMA');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('comNomeDoDuplicado', () => {
  it('cita quem já tem o e-mail ou o CPF', () => {
    const email = traduzirErroCadastroPaciente(erroBanco('uniq_pacientes_terapeuta_email'));
    expect(comNomeDoDuplicado(email, 'ANA LIMA').descricao).toContain('ANA LIMA');
    const cpf = traduzirErroCadastroPaciente(erroBanco('uniq_pacientes_terapeuta_cpf'));
    expect(comNomeDoDuplicado(cpf, 'ANA LIMA').descricao).toContain('ANA LIMA');
  });

  it('sem nome, ou com outra causa, não muda nada', () => {
    const email = traduzirErroCadastroPaciente(erroBanco('uniq_pacientes_terapeuta_email'));
    expect(comNomeDoDuplicado(email, null)).toBe(email);
    const rede = traduzirErroCadastroPaciente(new TypeError('Failed to fetch'));
    expect(comNomeDoDuplicado(rede, 'ANA LIMA')).toBe(rede);
  });
});

describe('gerarPortalToken', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('com randomUUID usa os UUIDs do próprio crypto (40 hexadecimais) e não toca em getRandomValues', () => {
    let n = 0;
    vi.stubGlobal('crypto', {
      randomUUID: () => `0000000${++n}-aaaa-4bbb-8ccc-dddddddddddd`,
      getRandomValues: () => { throw new Error('não deveria usar'); },
    });
    expect(gerarPortalToken()).toBe('00000001aaaa4bbb8cccdddddddddddd' + '00000002aaaa4bbb8cccdddddddddddd'.slice(0, 8));
  });

  it('gera tokens diferentes a cada chamada, no formato esperado', () => {
    const a = gerarPortalToken();
    const b = gerarPortalToken();
    expect(a).toMatch(/^[0-9a-f]{40}$/);
    expect(b).toMatch(/^[0-9a-f]{40}$/);
    expect(a).not.toBe(b);
  });

  it('navegador sem randomUUID (WebView antigo) usa getRandomValues com 20 bytes e continua gerando token', () => {
    const tamanhos: number[] = [];
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => { tamanhos.push(arr.length); arr.forEach((_, i) => { arr[i] = (i * 13 + 7) % 256; }); return arr; },
    });
    const t = gerarPortalToken();
    expect(tamanhos).toEqual([20]);
    expect(t).toMatch(/^[0-9a-f]{40}$/);
    expect(t.startsWith('071421')).toBe(true);
  });

  it('sem crypto nenhum, falha com mensagem clara em vez de gerar token previsível', () => {
    vi.stubGlobal('crypto', undefined);
    expect(() => gerarPortalToken()).toThrow(/navegador está desatualizado/);
  });
});

describe('normalizarContatoPaciente', () => {
  it('e-mail e telefone em branco viram null (não string vazia)', () => {
    expect(normalizarContatoPaciente({ email: '', telefone: '' })).toEqual({ email: null, telefone: null });
    expect(normalizarContatoPaciente({ email: '   ', telefone: '  ' })).toEqual({ email: null, telefone: null });
    expect(normalizarContatoPaciente({})).toEqual({ email: null, telefone: null });
    expect(normalizarContatoPaciente({ email: null, telefone: null })).toEqual({ email: null, telefone: null });
  });

  it('e-mail em minúsculas e sem espaços; telefone só sem espaços nas pontas', () => {
    expect(normalizarContatoPaciente({ email: '  Ana@Ex.COM ', telefone: ' (11) 98888-1111 ' }))
      .toEqual({ email: 'ana@ex.com', telefone: '(11) 98888-1111' });
  });

  it('dois clientes sem e-mail geram o mesmo valor null, que o índice único aceita', () => {
    const a = normalizarContatoPaciente({ email: '' }).email;
    const b = normalizarContatoPaciente({ email: undefined }).email;
    expect(a).toBeNull();
    expect(b).toBeNull();
  });
});
