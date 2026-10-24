import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

const h = vi.hoisted(() => ({ rpc: vi.fn(), remove: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...a: unknown[]) => h.rpc(...a),
    storage: {
      from: (...a: unknown[]) => {
        h.from(...a);
        return { remove: (...r: unknown[]) => h.remove(...r) };
      },
    },
  },
}));

import {
  EMAIL_SUPORTE,
  MENSAGEM_ERRO_EXCLUSAO,
  TEMPO_LIMITE_EXCLUSAO_MS,
  confirmacaoValida,
  contaTemSenha,
  descartarAvisoContaExcluida,
  descartarEmailContaExcluida,
  excluirMinhaContaCliente,
  exigeNovoLogin,
  guardarAvisoContaExcluida,
  interpretarErroExclusao,
  lerAvisoContaExcluida,
  lerEmailContaExcluida,
  limparCachesDoUsuario,
  mensagemDoErroExclusao,
  registrarLimpezaDeCacheDoUsuario,
  removerFotoDoCliente,
  sugereSuporte,
} from '@/lib/contaCliente';

beforeEach(() => {
  h.rpc.mockReset();
  h.remove.mockReset();
  h.from.mockReset();
  window.sessionStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('contaCliente: confirmação', () => {
  it.each([
    ['EXCLUIR', true],
    ['excluir', true],
    ['  Excluir  ', true],
    ['EXCLUI', false],
    ['EXCLUIRR', false],
    ['', false],
    ['EXCLUIR conta', false],
  ])('confirmacaoValida(%j) = %s', (texto, esperado) => {
    expect(confirmacaoValida(texto)).toBe(esperado);
  });
});

describe('contaCliente: login por senha', () => {
  it('provider email conta como senha', () => {
    expect(contaTemSenha({ app_metadata: { providers: ['email', 'google'] } })).toBe(true);
    expect(contaTemSenha({ app_metadata: { provider: 'email' } })).toBe(true);
    expect(contaTemSenha({ app_metadata: {}, identities: [{ provider: 'email' }] })).toBe(true);
    expect(contaTemSenha({ app_metadata: { senha_definida: true } })).toBe(true);
  });
  it('conta só do Google não tem senha', () => {
    expect(contaTemSenha({ app_metadata: { provider: 'google', providers: ['google'] }, identities: [{ provider: 'google' }] })).toBe(false);
    expect(contaTemSenha(null)).toBe(false);
  });
});

describe('contaCliente: mapa de erros', () => {
  it.each([
    'nao_autenticado',
    'confirmacao_invalida',
    'tente_novamente',
    'conta_de_profissional',
    'conta_nao_e_de_cliente',
    'premium_requer_aceite',
    'senha_obrigatoria',
    'senha_incorreta',
    'muitas_tentativas',
    'reautenticar',
    'cadastro_precisa_correcao',
    'falha_ao_excluir',
  ])('reconhece %s e tem mensagem humana', (codigo) => {
    expect(interpretarErroExclusao({ message: codigo })).toBe(codigo);
    expect(interpretarErroExclusao({ message: `ERROR: ${codigo}`, details: null })).toBe(codigo);
    const mensagem = MENSAGEM_ERRO_EXCLUSAO[codigo as keyof typeof MENSAGEM_ERRO_EXCLUSAO];
    expect(mensagem).toMatch(/[a-zà-ú]{4}/i);
    expect(mensagem).not.toContain('_');
  });

  it('JWT vencido vira nao_autenticado; o resto é desconhecido', () => {
    expect(interpretarErroExclusao({ message: 'JWT expired' })).toBe('nao_autenticado');
    expect(interpretarErroExclusao({ message: 'algo inesperado' })).toBe('desconhecido');
    expect(interpretarErroExclusao(new TypeError('Failed to fetch'))).toBe('desconhecido');
    expect(interpretarErroExclusao(null)).toBe('desconhecido');
    expect(interpretarErroExclusao('texto')).toBe('desconhecido');
  });

  it('só reautenticar, nao_autenticado e conta_possivelmente_excluida pedem novo login', () => {
    expect(exigeNovoLogin('reautenticar')).toBe(true);
    expect(exigeNovoLogin('nao_autenticado')).toBe(true);
    expect(exigeNovoLogin('conta_possivelmente_excluida')).toBe(true);
    expect(exigeNovoLogin('senha_incorreta')).toBe(false);
    expect(exigeNovoLogin('conta_de_profissional')).toBe(false);
    expect(exigeNovoLogin('tempo_esgotado')).toBe(false);
  });

  it('as mensagens que mandam falar com o suporte vêm com o canal; falha do servidor não diz "confira sua conexão"', () => {
    for (const codigo of ['conta_de_profissional', 'conta_nao_e_de_cliente', 'cadastro_precisa_correcao', 'falha_ao_excluir', 'desconhecido'] as const) {
      expect(sugereSuporte(codigo)).toBe(true);
    }
    for (const codigo of ['senha_incorreta', 'reautenticar', 'tempo_esgotado', 'premium_requer_aceite'] as const) {
      expect(sugereSuporte(codigo)).toBe(false);
    }
    expect(EMAIL_SUPORTE).toBe('contato@myhealthid.com.br');
    expect(MENSAGEM_ERRO_EXCLUSAO.falha_ao_excluir).toMatch(/nada foi alterado/);
    expect(MENSAGEM_ERRO_EXCLUSAO.falha_ao_excluir).not.toMatch(/conexão/);
    expect(MENSAGEM_ERRO_EXCLUSAO.desconhecido).toMatch(/conexão/);
  });

  it('a senha incorreta informa as tentativas restantes antes do bloqueio', () => {
    expect(mensagemDoErroExclusao('senha_incorreta', 4)).toBe('Senha incorreta. Restam 4 tentativas antes de um bloqueio de 15 minutos.');
    expect(mensagemDoErroExclusao('senha_incorreta', 1)).toBe('Senha incorreta. Resta 1 tentativa antes de um bloqueio de 15 minutos.');
    expect(mensagemDoErroExclusao('senha_incorreta', 0)).toMatch(/bloqueadas por 15 minutos/);
    expect(mensagemDoErroExclusao('senha_incorreta')).toBe(MENSAGEM_ERRO_EXCLUSAO.senha_incorreta);
    expect(mensagemDoErroExclusao('muitas_tentativas', 3)).toBe(MENSAGEM_ERRO_EXCLUSAO.muitas_tentativas);
  });
});

describe('contaCliente: chamada da RPC', () => {
  it('envia confirmação normalizada e senha (ou nulo) e devolve o número de vínculos desfeitos', async () => {
    h.rpc.mockResolvedValue({ data: { ok: true, pacientes_desvinculados: 2 }, error: null });
    await expect(excluirMinhaContaCliente({ confirmacao: ' excluir ', senha: 'abc12345' })).resolves.toEqual({ ok: true, desvinculados: 2 });
    expect(h.rpc).toHaveBeenLastCalledWith('excluir_minha_conta_cliente', {
      p_confirmacao: 'EXCLUIR',
      p_senha: 'abc12345',
      p_aceita_perder_premium: false,
    });

    await excluirMinhaContaCliente({ confirmacao: 'EXCLUIR', senha: '' });
    expect(h.rpc).toHaveBeenLastCalledWith('excluir_minha_conta_cliente', {
      p_confirmacao: 'EXCLUIR',
      p_senha: null,
      p_aceita_perder_premium: false,
    });
  });

  it('o aceite da perda do Premium só vai como true quando é exatamente true', async () => {
    h.rpc.mockResolvedValue({ data: { ok: true, pacientes_desvinculados: 0 }, error: null });
    await excluirMinhaContaCliente({ confirmacao: 'EXCLUIR', senha: 'x', aceitaPerderPremium: true });
    expect(h.rpc).toHaveBeenLastCalledWith('excluir_minha_conta_cliente', expect.objectContaining({ p_aceita_perder_premium: true }));
    await excluirMinhaContaCliente({ confirmacao: 'EXCLUIR', senha: 'x', aceitaPerderPremium: undefined });
    expect(h.rpc).toHaveBeenLastCalledWith('excluir_minha_conta_cliente', expect.objectContaining({ p_aceita_perder_premium: false }));
  });

  it('erro da RPC vira código; exceção vira desconhecido', async () => {
    h.rpc.mockResolvedValueOnce({ data: null, error: { message: 'muitas_tentativas' } });
    await expect(excluirMinhaContaCliente({ confirmacao: 'EXCLUIR', senha: 'x' })).resolves.toEqual({ ok: false, codigo: 'muitas_tentativas' });
    h.rpc.mockRejectedValueOnce(new Error('boom'));
    await expect(excluirMinhaContaCliente({ confirmacao: 'EXCLUIR' })).resolves.toEqual({ ok: false, codigo: 'desconhecido' });
    h.rpc.mockResolvedValueOnce({ data: { ok: false }, error: null });
    await expect(excluirMinhaContaCliente({ confirmacao: 'EXCLUIR' })).resolves.toEqual({ ok: false, codigo: 'desconhecido' });
  });

  it('senha errada chega como retorno {ok:false, erro:senha_incorreta} (não como exceção) com as tentativas restantes', async () => {
    h.rpc.mockResolvedValueOnce({ data: { ok: false, erro: 'senha_incorreta', tentativas_restantes: 3 }, error: null });
    await expect(excluirMinhaContaCliente({ confirmacao: 'EXCLUIR', senha: 'x' })).resolves.toEqual({
      ok: false,
      codigo: 'senha_incorreta',
      tentativasRestantes: 3,
    });
    h.rpc.mockResolvedValueOnce({ data: { ok: false, erro: 'senha_incorreta' }, error: null });
    await expect(excluirMinhaContaCliente({ confirmacao: 'EXCLUIR', senha: 'x' })).resolves.toEqual({ ok: false, codigo: 'senha_incorreta' });
    h.rpc.mockResolvedValueOnce({ data: { ok: false, erro: 'erro_que_nao_conheco' }, error: null });
    await expect(excluirMinhaContaCliente({ confirmacao: 'EXCLUIR', senha: 'x' })).resolves.toEqual({ ok: false, codigo: 'desconhecido' });
  });

  it('sem resposta dentro do limite vira tempo_esgotado em vez de prender a pessoa', async () => {
    vi.useFakeTimers();
    h.rpc.mockReturnValue(new Promise(() => {}));
    const resultado = excluirMinhaContaCliente({ confirmacao: 'EXCLUIR', senha: 'x' });
    await vi.advanceTimersByTimeAsync(TEMPO_LIMITE_EXCLUSAO_MS - 1);
    let terminou = false;
    void resultado.then(() => {
      terminou = true;
    });
    await Promise.resolve();
    expect(terminou).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    await expect(resultado).resolves.toEqual({ ok: false, codigo: 'tempo_esgotado' });
  });

  it('resposta que chega antes do limite cancela o relógio', async () => {
    vi.useFakeTimers();
    h.rpc.mockResolvedValue({ data: { ok: true, pacientes_desvinculados: 0 }, error: null });
    await expect(excluirMinhaContaCliente({ confirmacao: 'EXCLUIR', senha: 'x' })).resolves.toEqual({ ok: true, desvinculados: 0 });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('contaCliente: foto no Storage', () => {
  it('remove a foto do próprio cliente (pasta com o id do usuário) no bucket público de avatares', async () => {
    h.remove.mockResolvedValue({ data: [], error: null });
    await expect(removerFotoDoCliente('cli-1')).resolves.toBe(true);
    expect(h.from).toHaveBeenCalledWith('paciente-avatars');
    expect(h.remove).toHaveBeenCalledWith(['cli-1/avatar.jpg']);
  });

  it('é melhor esforço: erro, exceção ou demora só devolvem false, nunca lançam', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.remove.mockResolvedValueOnce({ data: null, error: { message: 'negado' } });
    await expect(removerFotoDoCliente('cli-1')).resolves.toBe(false);
    h.remove.mockRejectedValueOnce(new Error('sem rede'));
    await expect(removerFotoDoCliente('cli-1')).resolves.toBe(false);

    vi.useFakeTimers();
    h.remove.mockReturnValueOnce(new Promise(() => {}));
    const demorada = removerFotoDoCliente('cli-1');
    await vi.advanceTimersByTimeAsync(5_001);
    await expect(demorada).resolves.toBe(false);
  });
});

describe('contaCliente: aviso que sobrevive ao recarregamento', () => {
  it('guarda, lê e descarta o aviso; o e-mail fica numa chave à parte', () => {
    expect(lerAvisoContaExcluida()).toBeNull();
    guardarAvisoContaExcluida({ titulo: 'Conta excluída', descricao: 'Seu login foi apagado.' }, 'a@b.com');
    expect(lerAvisoContaExcluida()).toEqual({ titulo: 'Conta excluída', descricao: 'Seu login foi apagado.' });
    expect(lerEmailContaExcluida()).toBe('a@b.com');
    descartarAvisoContaExcluida();
    expect(lerAvisoContaExcluida()).toBeNull();
    expect(lerEmailContaExcluida()).toBe('a@b.com');
    descartarEmailContaExcluida();
    expect(lerEmailContaExcluida()).toBe('');
  });

  it('sem e-mail não grava a chave do e-mail; valor corrompido é ignorado', () => {
    guardarAvisoContaExcluida({ titulo: 'Oi' });
    expect(window.sessionStorage.getItem('mh_conta_excluida_email')).toBeNull();
    window.sessionStorage.setItem('mh_conta_excluida', '{quebrado');
    expect(lerAvisoContaExcluida()).toBeNull();
    window.sessionStorage.setItem('mh_conta_excluida', JSON.stringify({ descricao: 'sem título' }));
    expect(lerAvisoContaExcluida()).toBeNull();
  });

  it('com o storage bloqueado nada lança', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => guardarAvisoContaExcluida({ titulo: 'x' }, 'a@b.com')).not.toThrow();
    expect(lerAvisoContaExcluida()).toBeNull();
    expect(lerEmailContaExcluida()).toBe('');
    expect(() => descartarAvisoContaExcluida()).not.toThrow();
    expect(() => descartarEmailContaExcluida()).not.toThrow();
  });
});

describe('contaCliente: limpeza de caches', () => {
  it('limpa o React Query e roda as limpezas registradas, mesmo se uma falhar', () => {
    const qc = new QueryClient();
    qc.setQueryData(['x'], 1);
    const boa = vi.fn();
    registrarLimpezaDeCacheDoUsuario(() => {
      throw new Error('falha de teste');
    });
    registrarLimpezaDeCacheDoUsuario(boa);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    limparCachesDoUsuario(qc);
    expect(qc.getQueryCache().getAll()).toHaveLength(0);
    expect(boa).toHaveBeenCalled();
  });
});
