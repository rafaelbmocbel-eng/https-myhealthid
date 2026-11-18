import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';

const h = vi.hoisted(() => ({
  falso: null as unknown as BancoFalso,
  auth: {
    user: { id: 'prof-1' } as { id: string } | null,
    profile: { nome: 'Ana', sobrenome: 'Souza', crefito: '12345-F' } as { id?: string; nome?: string; sobrenome?: string; crefito?: string } | null,
  },
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (t: string) => h.falso.from(t),
    rpc: (nome: string, args?: Record<string, unknown>) => h.falso.rpc(nome, args),
    functions: { invoke: vi.fn() },
  },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => h.auth }));
vi.mock('sonner', () => ({ toast: h.toast }));

import {
  MSG_BANCO_NAO_PREPARADO, MSG_CONFIRMADO, MSG_DESFEITO, MSG_FALHA_AO_CONFIRMAR, MSG_FALHA_AO_DESFAZER, MSG_JA_ESTAVA_CONFIRMADO,
  MSG_JA_EXISTE_SEM_CARREGAR, MSG_JA_NAO_EXISTE, MSG_SEM_PERMISSAO, useConfirmarMarcoClinico,
} from '@/hooks/useConfirmarMarcoClinico';
import { useFontesClinicas } from '@/hooks/useFontesClinicas';
import { ERRO_DO_ANO_CONFIRMADO, ERRO_SEM_IDENTIFICACAO, ERRO_SEM_TIPO_ESCOLHIDO, idDaConfirmacao } from '@/lib/resumoClinico/confirmacao';
import type { CirurgiaDoCliente, DadosDaConfirmacao, Marco } from '@/lib/resumoClinico/tipos';

// O hook é o ÚNICO escritor da confirmação. Aqui ele roda com um banco falso em memória que registra cada escrita, para conferir
// exatamente o que foi gravado, apagado e invalidado. Nenhum fuso nem relógio da máquina entra: o dia de "hoje" é fixado.

const TERAPEUTA = 'prof-1';
const PACIENTE = 'pac-1';
const CHAVE = 'historico_clinico:cirurgia:id:k1';
const CIRURGIA: CirurgiaDoCliente = { chave: CHAVE, tipo: 'Ligamento do joelho (LCA)', ano: '2022', complicacoes: 'dor ao agachar' };
const ID_DA_LINHA = idDaConfirmacao(TERAPEUTA, PACIENTE, CHAVE);
const DIA: DadosDaConfirmacao = { tipo: 'cirurgia', precisao: 'dia', texto: '2022-06-10' };
const SO_ANO: DadosDaConfirmacao = { tipo: 'cirurgia', precisao: 'ano', texto: '2022' };

const HOJE = new Date('2026-11-15T15:00:00-03:00');

const linhaGravada = (extra: Linha = {}): Linha => ({
  id: ID_DA_LINHA, paciente_id: PACIENTE, terapeuta_id: TERAPEUTA, data_evento: '2022-06-10', tipo: 'cirurgia', titulo: CIRURGIA.tipo, descricao: null,
  created_at: '2026-10-01T15:00:00+00:00',
  metadata: {
    versao: 1, origem: 'confirmacao_de_marco', fonte: 'historico_clinico', chave_cliente: CHAVE, precisao: 'dia',
    relato_cliente: { tipo: CIRURGIA.tipo, ano: '2022', complicacoes: 'dor ao agachar' }, confirmado_por: { nome: 'Ana Souza', registro: '12345-F' },
  },
  ...extra,
});

function preparar(inicial: Record<string, Linha[]> = {}) {
  h.falso = criarBancoFalso({ historia_vida_paciente: [], ...inicial });
}

// `null` é "nenhum paciente aberto" (undefined cairia no padrão).
function montar(pacienteAberto: string | null = PACIENTE, nascimento?: string | null) {
  const pacienteId = pacienteAberto ?? undefined;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const invalidar = vi.spyOn(qc, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  const r = renderHook(() => ({ c: useConfirmarMarcoClinico(pacienteId, nascimento), f: useFontesClinicas(pacienteId) }), { wrapper });
  const chavesInvalidadas = () => invalidar.mock.calls.map(([filtro]) => JSON.stringify((filtro as { queryKey: unknown }).queryKey));
  return { ...r, qc, invalidar, chavesInvalidadas };
}
type Montado = ReturnType<typeof montar>;

const escritasNaTabela = () => h.falso.escritas().filter((o) => o.tabela === 'historia_vida_paciente');
const linhasNoBanco = () => h.falso.tabelas.historia_vida_paciente;

async function abrirEConfirmar(m: Montado, dados: DadosDaConfirmacao = DIA): Promise<boolean> {
  act(() => { m.result.current.c.pedirConfirmacao(CIRURGIA); });
  let ok = false;
  await act(async () => { ok = await m.result.current.c.confirmacao.confirmar(dados); });
  return ok;
}

const marcoConfirmado = (idDaLinha = ID_DA_LINHA, titulo = CIRURGIA.tipo): Marco => ({
  id: `historia_vida:${idDaLinha}`, titulo, confirmacao: { idDaLinha, chave: CHAVE, relatoOriginal: { tipo: titulo, ano: '2022', complicacoes: '' }, situacao: 'igual', confirmadoEm: null, por: null },
}) as unknown as Marco;

async function abrirEDesfazer(m: Montado, marco: Marco = marcoConfirmado()): Promise<boolean> {
  act(() => { m.result.current.c.pedirDesfazer(marco); });
  let ok = false;
  await act(async () => { ok = await m.result.current.c.desfazer.desfazer(); });
  return ok;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(HOJE);
  h.auth.user = { id: TERAPEUTA };
  h.auth.profile = { nome: 'Ana', sobrenome: 'Souza', crefito: '12345-F' };
  h.toast.success.mockClear();
  h.toast.error.mockClear();
  h.toast.info.mockClear();
  preparar();
});
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

describe('confirmar: o que é gravado', () => {
  it('grava UMA linha em historia_vida_paciente com o payload exato e nenhuma outra escrita', async () => {
    const m = montar();
    expect(await abrirEConfirmar(m)).toBe(true);
    expect(h.falso.escritas()).toHaveLength(1);
    const [escrita] = h.falso.escritas();
    expect(escrita.tabela).toBe('historia_vida_paciente');
    expect(escrita.tipo).toBe('insert');
    expect(escrita.payload).toStrictEqual({
      id: ID_DA_LINHA,
      terapeuta_id: 'prof-1',
      paciente_id: 'pac-1',
      data_evento: '2022-06-10',
      tipo: 'cirurgia',
      titulo: 'Ligamento do joelho (LCA)',
      descricao: null,
      sistema_corporal: null,
      severidade: 0,
      resolvido: true,
      visivel_paciente: false,
      profissional_registro: 'Ana Souza · CREFITO 12345-F',
      metadata: {
        versao: 1,
        origem: 'confirmacao_de_marco',
        fonte: 'historico_clinico',
        chave_cliente: CHAVE,
        relato_cliente: { tipo: 'Ligamento do joelho (LCA)', ano: '2022', complicacoes: 'dor ao agachar' },
        precisao: 'dia',
        confirmado_por: { nome: 'Ana Souza', registro: '12345-F' },
      },
    });
  });

  it('não manda created_at, updated_at nem confirmado_em (o servidor preenche o "quando")', async () => {
    const m = montar();
    await abrirEConfirmar(m);
    const payload = escritasNaTabela()[0].payload as Record<string, unknown>;
    expect(Object.keys(payload)).not.toContain('created_at');
    expect(Object.keys(payload)).not.toContain('updated_at');
    expect(Object.keys(payload.metadata as object)).not.toContain('confirmado_em');
  });

  it('o id é o determinístico (profissional + paciente + chave): confirmar, desfazer e confirmar de novo usa o mesmo id', async () => {
    const m = montar();
    await abrirEConfirmar(m);
    const primeiro = (escritasNaTabela()[0].payload as { id: string }).id;
    expect(primeiro).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    await abrirEDesfazer(m, marcoConfirmado(primeiro));
    expect(linhasNoBanco()).toHaveLength(0);
    await abrirEConfirmar(m);
    const segundo = (escritasNaTabela().filter((o) => o.tipo === 'insert')[1].payload as { id: string }).id;
    expect(segundo).toBe(primeiro);
    expect(linhasNoBanco()).toHaveLength(1);
  });

  it('o terapeuta_id vem de quem está logado e entra no id: outro profissional grava outro id', async () => {
    h.auth.user = { id: 'prof-9' };
    const m = montar();
    await abrirEConfirmar(m);
    const payload = escritasNaTabela()[0].payload as { id: string; terapeuta_id: string };
    expect(payload.terapeuta_id).toBe('prof-9');
    expect(payload.id).toBe(idDaConfirmacao('prof-9', PACIENTE, CHAVE));
    expect(payload.id).not.toBe(ID_DA_LINHA);
  });

  it('o terapeuta_id é o id do LOGIN (user.id), nunca o id da linha de profiles: a regra do banco compara com auth.uid()', async () => {
    h.auth.user = { id: 'login-uid' };
    h.auth.profile = { id: 'linha-de-profiles-diferente', nome: 'Ana', sobrenome: 'Souza', crefito: '12345-F' };
    const m = montar();
    await abrirEConfirmar(m);
    const payload = escritasNaTabela()[0].payload as { id: string; terapeuta_id: string };
    expect(payload.terapeuta_id).toBe('login-uid');
    expect(payload.id).toBe(idDaConfirmacao('login-uid', PACIENTE, CHAVE));
  });

  it('o delete também filtra pelo id do LOGIN, não pelo da linha de profiles', async () => {
    h.auth.user = { id: 'login-uid' };
    h.auth.profile = { id: 'linha-de-profiles-diferente', nome: 'Ana' };
    preparar({ historia_vida_paciente: [linhaGravada({ id: idDaConfirmacao('login-uid', PACIENTE, CHAVE), terapeuta_id: 'login-uid' })] });
    const m = montar();
    await abrirEDesfazer(m, marcoConfirmado(idDaConfirmacao('login-uid', PACIENTE, CHAVE)));
    const [apagar] = h.falso.escritas();
    expect(apagar.filtros).toContainEqual(['eq', 'terapeuta_id', 'login-uid']);
  });

  it('só o ano: data_evento AAAA-01-01, precisao "ano" e a frase na descrição', async () => {
    const m = montar();
    await abrirEConfirmar(m, SO_ANO);
    const payload = escritasNaTabela()[0].payload as { data_evento: string; descricao: string | null; metadata: { precisao: string } };
    expect(payload.data_evento).toBe('2022-01-01');
    expect(payload.descricao).toBe('Data aproximada: só o ano (2022).');
    expect(payload.metadata.precisao).toBe('ano');
  });

  it('internação: grava o tipo "internacao" que o profissional escolheu', async () => {
    const m = montar();
    await abrirEConfirmar(m, { ...DIA, tipo: 'internacao' });
    expect((escritasNaTabela()[0].payload as { tipo: string }).tipo).toBe('internacao');
  });

  it('perfil sem CREFITO: profissional_registro fica nulo (nunca digitado nem inventado)', async () => {
    h.auth.profile = { nome: 'Ana', sobrenome: 'Souza' };
    const m = montar();
    await abrirEConfirmar(m);
    const payload = escritasNaTabela()[0].payload as { profissional_registro: unknown; metadata: { confirmado_por: unknown } };
    expect(payload.profissional_registro).toBeNull();
    expect(payload.metadata.confirmado_por).toEqual({ nome: 'Ana Souza', registro: null });
  });

  it('a data não pode ser antes do nascimento do paciente (o hook confere de novo)', async () => {
    const m = montar(PACIENTE, '2023-01-01');
    expect(await abrirEConfirmar(m)).toBe(false);
    expect(h.falso.escritas()).toEqual([]);
    expect(m.result.current.c.confirmacao.erro).toMatch(/antes do nascimento/);
  });
});

describe('confirmar: valida de novo na hora de salvar, com o dia de hoje lido ali', () => {
  it('"hoje" é lido dentro do salvar: a mesma data é recusada num dia e aceita no seguinte', async () => {
    const m = montar();
    act(() => { m.result.current.c.pedirConfirmacao(CIRURGIA); });
    const amanha: DadosDaConfirmacao = { tipo: 'cirurgia', precisao: 'dia', texto: '2026-11-16' };
    let ok = true;
    await act(async () => { ok = await m.result.current.c.confirmacao.confirmar(amanha); });
    expect(ok).toBe(false);
    expect(h.falso.escritas()).toEqual([]);
    expect(m.result.current.c.confirmacao.erro).toMatch(/não pode ser no futuro/);

    vi.setSystemTime(new Date('2026-11-16T15:00:00-03:00'));
    await act(async () => { ok = await m.result.current.c.confirmacao.confirmar(amanha); });
    expect(ok).toBe(true);
    expect(escritasNaTabela()).toHaveLength(1);
    expect((escritasNaTabela()[0].payload as { data_evento: string }).data_evento).toBe('2026-11-16');
  });

  it('o "hoje" é o dia do Brasil: às 22h de Brasília (já amanhã em UTC) o dia ainda é o de Brasília', async () => {
    vi.setSystemTime(new Date('2026-11-15T22:30:00-03:00'));
    const m = montar();
    expect(await abrirEConfirmar(m, { tipo: 'cirurgia', precisao: 'dia', texto: '2026-11-15' })).toBe(true);
    expect((escritasNaTabela()[0].payload as { data_evento: string }).data_evento).toBe('2026-11-15');
  });

  it('ano inválido ("2O22"), tipo não escolhido: nenhuma operação, erro na tela e aviso', async () => {
    const m = montar();
    expect(await abrirEConfirmar(m, { tipo: 'cirurgia', precisao: 'ano', texto: '2O22' })).toBe(false);
    expect(m.result.current.c.confirmacao.erro).toBe(ERRO_DO_ANO_CONFIRMADO);
    expect(await abrirEConfirmar(m, { tipo: '', precisao: 'dia', texto: '2022-06-10' })).toBe(false);
    expect(m.result.current.c.confirmacao.erro).toBe(ERRO_SEM_TIPO_ESCOLHIDO);
    expect(h.falso.escritas()).toEqual([]);
    expect(h.toast.error).toHaveBeenCalledWith(ERRO_SEM_TIPO_ESCOLHIDO);
    expect(m.result.current.c.confirmacao.alvo).not.toBeNull();
  });
});

describe('confirmar: sem usuário ou sem paciente não há operação nenhuma', () => {
  it('sem usuário logado', async () => {
    h.auth.user = null;
    const m = montar();
    expect(await abrirEConfirmar(m)).toBe(false);
    expect(h.falso.escritas()).toEqual([]);
    expect(m.result.current.c.confirmacao.erro).toBe(ERRO_SEM_IDENTIFICACAO);
    expect(m.chavesInvalidadas()).toEqual([]);
  });

  it('sem paciente aberto', async () => {
    const m = montar(null);
    expect(await abrirEConfirmar(m)).toBe(false);
    expect(h.falso.escritas()).toEqual([]);
    expect(m.result.current.c.confirmacao.erro).toBe(ERRO_SEM_IDENTIFICACAO);
  });

  it('chamar confirmar sem ter pedido a confirmação de um item não faz nada', async () => {
    const m = montar();
    let ok = true;
    await act(async () => { ok = await m.result.current.c.confirmacao.confirmar(DIA); });
    expect(ok).toBe(false);
    expect(h.falso.escritas()).toEqual([]);
  });
});

describe('confirmar: só o sucesso invalida o que mostra a confirmação', () => {
  it('sucesso: fecha o diálogo, avisa e invalida a linha do tempo e o Avatar DESTE paciente (e só eles)', async () => {
    const m = montar();
    expect(await abrirEConfirmar(m)).toBe(true);
    expect(m.result.current.c.confirmacao.alvo).toBeNull();
    expect(m.result.current.c.confirmacao.erro).toBeNull();
    expect(h.toast.success).toHaveBeenCalledWith(MSG_CONFIRMADO);
    expect(m.chavesInvalidadas().sort()).toEqual([JSON.stringify(['fontes-clinicas', 'pac-1']), JSON.stringify(['historia-vida-avatar', 'pac-1'])].sort());
    expect(m.chavesInvalidadas().join('')).not.toMatch(/pac-2|pac-10/);
  });

  it('banco recusa: o erro aparece, o diálogo continua aberto com o item e NADA é invalidado', async () => {
    h.falso.falharEscritaQuando((op) => op.tipo === 'insert', 'falha de rede');
    const m = montar();
    expect(await abrirEConfirmar(m)).toBe(false);
    expect(m.result.current.c.confirmacao.erro).toBe(MSG_FALHA_AO_CONFIRMAR);
    expect(m.result.current.c.confirmacao.alvo).toEqual(CIRURGIA);
    expect(h.toast.error).toHaveBeenCalledWith(MSG_FALHA_AO_CONFIRMAR);
    expect(h.toast.success).not.toHaveBeenCalled();
    expect(m.chavesInvalidadas()).toEqual([]);
    expect(linhasNoBanco()).toHaveLength(0);
  });

  it('o erro some quando o profissional tenta de novo e dá certo', async () => {
    h.falso.falharEscritaQuando((op) => op.tipo === 'insert', 'falha');
    const m = montar();
    await abrirEConfirmar(m);
    expect(m.result.current.c.confirmacao.erro).not.toBeNull();
    h.falso.falharEscritaQuando(null);
    await act(async () => { await m.result.current.c.confirmacao.confirmar(DIA); });
    expect(m.result.current.c.confirmacao.erro).toBeNull();
    expect(m.result.current.c.confirmacao.alvo).toBeNull();
    expect(linhasNoBanco()).toHaveLength(1);
  });

  it('o client que LANÇA em vez de devolver o erro (sem rede) vira a mesma frase, sem invalidar', async () => {
    h.falso.antesDeEscrever(() => { throw new Error('Failed to fetch'); });
    const m = montar();
    expect(await abrirEConfirmar(m)).toBe(false);
    expect(m.result.current.c.confirmacao.erro).toBe(MSG_FALHA_AO_CONFIRMAR);
    expect(m.chavesInvalidadas()).toEqual([]);
  });
});

describe('confirmar: o banco ainda não está pronto, sem permissão', () => {
  it.each([['PGRST204'], ['42703']])('código %s (coluna que não existe) vira "o banco ainda não está preparado", sem mandar tentar de novo', async (codigo) => {
    h.falso.falharEscritaQuando((op) => op.tipo === 'insert', 'Could not find the metadata column', codigo);
    const m = montar();
    expect(await abrirEConfirmar(m)).toBe(false);
    expect(m.result.current.c.confirmacao.erro).toBe(MSG_BANCO_NAO_PREPARADO);
    expect(MSG_BANCO_NAO_PREPARADO).toMatch(/o banco ainda não está preparado para esta confirmação/i);
    expect(MSG_BANCO_NAO_PREPARADO).not.toMatch(/tent/i);
    expect(m.chavesInvalidadas()).toEqual([]);
  });

  it('código 42501 (a regra do banco não deixou) tem a própria frase', async () => {
    h.falso.falharEscritaQuando((op) => op.tipo === 'insert', 'permission denied', '42501');
    const m = montar();
    expect(await abrirEConfirmar(m)).toBe(false);
    expect(m.result.current.c.confirmacao.erro).toBe(MSG_SEM_PERMISSAO);
  });
});

describe('confirmar: 23505 (a confirmação já existe)', () => {
  it('a confirmação aparece na lista depois de reler: é sucesso, avisa que já estava e não grava uma segunda linha', async () => {
    const m = montar();
    await waitFor(() => expect(m.result.current.f.data).toBeDefined());
    // Outra aba confirmou este item depois que esta tela leu a lista.
    h.falso.tabelas.historia_vida_paciente.push(linhaGravada());

    expect(await abrirEConfirmar(m)).toBe(true);
    expect(h.toast.info).toHaveBeenCalledWith(MSG_JA_ESTAVA_CONFIRMADO);
    expect(h.toast.success).not.toHaveBeenCalled();
    expect(m.result.current.c.confirmacao.alvo).toBeNull();
    expect(linhasNoBanco()).toHaveLength(1);
    expect(m.chavesInvalidadas()).toContain(JSON.stringify(['fontes-clinicas', 'pac-1']));
    expect(m.result.current.f.data?.fontes.historiaVida.map((l) => l.id)).toEqual([ID_DA_LINHA]);
  });

  it('a linha existe no banco mas a lista não a traz: "já existe, mas a tela não conseguiu carregá-la", diálogo aberto', async () => {
    const m = montar();
    await waitFor(() => expect(m.result.current.f.data).toBeDefined());
    // Mesmo id, mas de outro paciente: o insert bate na chave e a lista deste paciente não a mostra; o select por id acha.
    h.falso.tabelas.historia_vida_paciente.push(linhaGravada({ paciente_id: 'pac-outro' }));

    expect(await abrirEConfirmar(m)).toBe(false);
    expect(m.result.current.c.confirmacao.erro).toBe(MSG_JA_EXISTE_SEM_CARREGAR);
    expect(MSG_JA_EXISTE_SEM_CARREGAR).toBe('Já existe uma confirmação para este item, mas a tela não conseguiu carregá-la.');
    expect(m.result.current.c.confirmacao.alvo).toEqual(CIRURGIA);
    expect(h.toast.error).toHaveBeenCalledWith(MSG_JA_EXISTE_SEM_CARREGAR);
    expect(linhasNoBanco()).toHaveLength(1);
  });

  it('o select por id também não acha a linha (a regra do banco a esconde): falha comum, sem fingir sucesso', async () => {
    h.falso.falharEscritaQuando((op) => op.tipo === 'insert', 'duplicate key value', '23505');
    const m = montar();
    await waitFor(() => expect(m.result.current.f.data).toBeDefined());
    expect(await abrirEConfirmar(m)).toBe(false);
    expect(m.result.current.c.confirmacao.erro).toBe(MSG_FALHA_AO_CONFIRMAR);
    expect(h.toast.success).not.toHaveBeenCalled();
    expect(h.toast.info).not.toHaveBeenCalled();
  });

  it('o 23505 manda reler a lista deste paciente (a invalidação acontece mesmo sem gravar)', async () => {
    h.falso.tabelas.historia_vida_paciente.push(linhaGravada({ paciente_id: 'pac-outro' }));
    const m = montar();
    await waitFor(() => expect(m.result.current.f.data).toBeDefined());
    await abrirEConfirmar(m);
    expect(m.chavesInvalidadas()).toContain(JSON.stringify(['fontes-clinicas', 'pac-1']));
  });

  describe('sem a lista no cache (ninguém a observa: ela não foi lida ou já foi descartada)', () => {
    // O hook não pode depender de a página ter lido a lista: sem ela, quem diz se a linha existe é o select por id.
    function montarSoOHook() {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
      const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
      return { qc, ...renderHook(() => useConfirmarMarcoClinico(PACIENTE), { wrapper }) };
    }

    it('a linha existe no banco: "já existe, mas a tela não conseguiu carregá-la", e nada é gravado de novo', async () => {
      h.falso.tabelas.historia_vida_paciente.push(linhaGravada());
      const m = montarSoOHook();
      expect(m.qc.getQueryData(['fontes-clinicas', PACIENTE, TERAPEUTA])).toBeUndefined();
      act(() => { m.result.current.pedirConfirmacao(CIRURGIA); });
      let ok = true;
      await act(async () => { ok = await m.result.current.confirmacao.confirmar(DIA); });
      expect(ok).toBe(false);
      expect(m.result.current.confirmacao.erro).toBe(MSG_JA_EXISTE_SEM_CARREGAR);
      expect(h.toast.info).not.toHaveBeenCalled();
      expect(linhasNoBanco()).toHaveLength(1);
    });

    it('a linha não existe para este profissional (a regra do banco a esconde): falha comum, sem fingir sucesso', async () => {
      h.falso.falharEscritaQuando((op) => op.tipo === 'insert', 'duplicate key value', '23505');
      const m = montarSoOHook();
      act(() => { m.result.current.pedirConfirmacao(CIRURGIA); });
      let ok = true;
      await act(async () => { ok = await m.result.current.confirmacao.confirmar(DIA); });
      expect(ok).toBe(false);
      expect(m.result.current.confirmacao.erro).toBe(MSG_FALHA_AO_CONFIRMAR);
      expect(h.toast.success).not.toHaveBeenCalled();
      expect(h.toast.info).not.toHaveBeenCalled();
    });
  });
});

describe('confirmar: duplo toque', () => {
  it('dois toques no mesmo instante gravam UMA vez: o segundo volta falso sem escrever', async () => {
    const m = montar();
    act(() => { m.result.current.c.pedirConfirmacao(CIRURGIA); });
    const { confirmar } = m.result.current.c.confirmacao;
    let resultados: boolean[] = [];
    await act(async () => { resultados = await Promise.all([confirmar(DIA), confirmar(DIA)]); });
    expect(resultados).toEqual([true, false]);
    expect(escritasNaTabela()).toHaveLength(1);
    expect(linhasNoBanco()).toHaveLength(1);
  });

  it('com a primeira gravação ainda em andamento, um segundo toque não escreve nada e o botão fica "salvando"', async () => {
    let liberar: () => void = () => {};
    h.falso.antesDeEscrever(() => new Promise<void>((resolver) => { liberar = resolver; }));
    const m = montar();
    act(() => { m.result.current.c.pedirConfirmacao(CIRURGIA); });
    let primeira!: Promise<boolean>;
    act(() => { primeira = m.result.current.c.confirmacao.confirmar(DIA); });
    await waitFor(() => expect(m.result.current.c.confirmacao.salvando).toBe(true));

    let segunda = true;
    await act(async () => { segunda = await m.result.current.c.confirmacao.confirmar(DIA); });
    expect(segunda).toBe(false);

    await act(async () => { liberar(); await primeira; });
    expect(escritasNaTabela()).toHaveLength(1);
    expect(m.result.current.c.confirmacao.salvando).toBe(false);
  });

  it('cancelar não fecha o diálogo enquanto grava', async () => {
    let liberar: () => void = () => {};
    h.falso.antesDeEscrever(() => new Promise<void>((resolver) => { liberar = resolver; }));
    const m = montar();
    act(() => { m.result.current.c.pedirConfirmacao(CIRURGIA); });
    let primeira!: Promise<boolean>;
    act(() => { primeira = m.result.current.c.confirmacao.confirmar(DIA); });
    await waitFor(() => expect(m.result.current.c.confirmacao.salvando).toBe(true));
    act(() => { m.result.current.c.confirmacao.cancelar(); });
    expect(m.result.current.c.confirmacao.alvo).toEqual(CIRURGIA);
    await act(async () => { liberar(); await primeira; });
  });

  it('cancelar fora do salvar fecha e limpa o erro', async () => {
    h.falso.falharEscritaQuando((op) => op.tipo === 'insert', 'falha');
    const m = montar();
    await abrirEConfirmar(m);
    expect(m.result.current.c.confirmacao.erro).not.toBeNull();
    act(() => { m.result.current.c.confirmacao.cancelar(); });
    expect(m.result.current.c.confirmacao.alvo).toBeNull();
    expect(m.result.current.c.confirmacao.erro).toBeNull();
  });
});

describe('desfazer', () => {
  const seed = () => preparar({
    historia_vida_paciente: [
      linhaGravada(),
      { id: 'manual-1', paciente_id: PACIENTE, terapeuta_id: TERAPEUTA, data_evento: '2019-03-04', tipo: 'fratura', titulo: 'Fratura de punho', metadata: {} },
    ],
  });

  it('apaga com TODAS as condições (id, paciente, profissional e marca de origem) e só a linha da confirmação', async () => {
    seed();
    const m = montar();
    expect(await abrirEDesfazer(m)).toBe(true);
    const apagar = h.falso.escritas().filter((o) => o.tipo === 'delete');
    expect(apagar).toHaveLength(1);
    expect(h.falso.escritas()).toHaveLength(1);
    expect(apagar[0].tabela).toBe('historia_vida_paciente');
    expect(apagar[0].filtros).toEqual([
      ['eq', 'id', ID_DA_LINHA],
      ['eq', 'paciente_id', 'pac-1'],
      ['eq', 'terapeuta_id', 'prof-1'],
      ['eq', 'metadata->>origem', 'confirmacao_de_marco'],
    ]);
    expect(linhasNoBanco().map((l) => l.id)).toEqual(['manual-1']);
  });

  it('usa o uuid cru da linha (sem o prefixo "historia_vida:") e mostra o título no pedido', async () => {
    seed();
    const m = montar();
    act(() => { m.result.current.c.pedirDesfazer(marcoConfirmado(ID_DA_LINHA, 'Joelho')); });
    expect(m.result.current.c.desfazer.alvo).toEqual({ idDaLinha: ID_DA_LINHA, titulo: 'Joelho' });
  });

  it('não apaga registro de história de vida feito à mão, mesmo com o id certo: a marca de origem protege', async () => {
    preparar({ historia_vida_paciente: [linhaGravada({ metadata: { origem: 'manual' } })] });
    const m = montar();
    expect(await abrirEDesfazer(m)).toBe(true);
    expect(linhasNoBanco()).toHaveLength(1);
    expect(h.toast.info).toHaveBeenCalledWith(MSG_JA_NAO_EXISTE);
    expect(h.toast.success).not.toHaveBeenCalled();
  });

  it('não apaga a confirmação de outro paciente ou de outro profissional', async () => {
    preparar({ historia_vida_paciente: [linhaGravada({ paciente_id: 'pac-2' })] });
    const m1 = montar();
    await abrirEDesfazer(m1);
    expect(linhasNoBanco()).toHaveLength(1);
    m1.unmount();

    preparar({ historia_vida_paciente: [linhaGravada({ terapeuta_id: 'prof-9' })] });
    const m2 = montar();
    await abrirEDesfazer(m2);
    expect(linhasNoBanco()).toHaveLength(1);
  });

  it('1 linha apagada: "desfeito", fecha o diálogo e invalida a linha do tempo e o Avatar deste paciente', async () => {
    seed();
    const m = montar();
    expect(await abrirEDesfazer(m)).toBe(true);
    expect(h.toast.success).toHaveBeenCalledWith(MSG_DESFEITO);
    expect(h.toast.info).not.toHaveBeenCalled();
    expect(m.result.current.c.desfazer.alvo).toBeNull();
    expect(m.chavesInvalidadas().sort()).toEqual([JSON.stringify(['fontes-clinicas', 'pac-1']), JSON.stringify(['historia-vida-avatar', 'pac-1'])].sort());
  });

  it('0 linhas apagadas NÃO é erro, mas a frase é "a confirmação já não existe" (nunca "desfeito") e a tela relê', async () => {
    preparar({ historia_vida_paciente: [] });
    const m = montar();
    expect(await abrirEDesfazer(m)).toBe(true);
    expect(h.toast.info).toHaveBeenCalledWith('A confirmação já não existe.');
    expect(MSG_JA_NAO_EXISTE).toBe('A confirmação já não existe.');
    expect(h.toast.success).not.toHaveBeenCalled();
    expect(h.toast.error).not.toHaveBeenCalled();
    expect(m.result.current.c.desfazer.erro).toBeNull();
    expect(m.result.current.c.desfazer.alvo).toBeNull();
    expect(m.chavesInvalidadas()).toContain(JSON.stringify(['fontes-clinicas', 'pac-1']));
  });

  it('erro do banco: a frase aparece, o diálogo continua aberto e NADA é invalidado', async () => {
    seed();
    h.falso.falharEscritaQuando((op) => op.tipo === 'delete', 'falha de rede');
    const m = montar();
    expect(await abrirEDesfazer(m)).toBe(false);
    expect(m.result.current.c.desfazer.erro).toBe(MSG_FALHA_AO_DESFAZER);
    expect(m.result.current.c.desfazer.alvo).not.toBeNull();
    expect(h.toast.error).toHaveBeenCalledWith(MSG_FALHA_AO_DESFAZER);
    expect(m.chavesInvalidadas()).toEqual([]);
    expect(linhasNoBanco()).toHaveLength(2);
  });

  it('o client que lança (sem rede) vira a mesma frase, sem invalidar', async () => {
    seed();
    h.falso.antesDeEscrever(() => { throw new Error('Failed to fetch'); });
    const m = montar();
    expect(await abrirEDesfazer(m)).toBe(false);
    expect(m.result.current.c.desfazer.erro).toBe(MSG_FALHA_AO_DESFAZER);
    expect(m.chavesInvalidadas()).toEqual([]);
  });

  it('sem usuário ou sem paciente não há operação', async () => {
    seed();
    h.auth.user = null;
    const m1 = montar();
    expect(await abrirEDesfazer(m1)).toBe(false);
    expect(m1.result.current.c.desfazer.erro).toBe(ERRO_SEM_IDENTIFICACAO);
    m1.unmount();
    h.auth.user = { id: TERAPEUTA };
    const m2 = montar(null);
    expect(await abrirEDesfazer(m2)).toBe(false);
    expect(h.falso.escritas()).toEqual([]);
  });

  it('só marco com confirmação pode ser desfeito: outro marco não abre o pedido', () => {
    seed();
    const m = montar();
    act(() => { m.result.current.c.pedirDesfazer({ id: 'historia_vida:x', titulo: 'Fratura' } as unknown as Marco); });
    expect(m.result.current.c.desfazer.alvo).toBeNull();
  });

  it('dois toques no mesmo instante apagam UMA vez', async () => {
    seed();
    const m = montar();
    act(() => { m.result.current.c.pedirDesfazer(marcoConfirmado()); });
    const { desfazer } = m.result.current.c.desfazer;
    let resultados: boolean[] = [];
    await act(async () => { resultados = await Promise.all([desfazer(), desfazer()]); });
    expect(resultados).toEqual([true, false]);
    expect(h.falso.escritas().filter((o) => o.tipo === 'delete')).toHaveLength(1);
  });

  it('cancelar não fecha o aviso enquanto apaga', async () => {
    seed();
    let liberar: () => void = () => {};
    h.falso.antesDeEscrever(() => new Promise<void>((resolver) => { liberar = resolver; }));
    const m = montar();
    act(() => { m.result.current.c.pedirDesfazer(marcoConfirmado()); });
    let primeira!: Promise<boolean>;
    act(() => { primeira = m.result.current.c.desfazer.desfazer(); });
    await waitFor(() => expect(m.result.current.c.desfazer.salvando).toBe(true));
    act(() => { m.result.current.c.desfazer.cancelar(); });
    expect(m.result.current.c.desfazer.alvo).toEqual({ idDaLinha: ID_DA_LINHA, titulo: CIRURGIA.tipo });
    await act(async () => { liberar(); await primeira; });
    expect(m.result.current.c.desfazer.alvo).toBeNull();
  });

  it('cancelar fecha e limpa o erro', async () => {
    seed();
    h.falso.falharEscritaQuando((op) => op.tipo === 'delete', 'falha');
    const m = montar();
    await abrirEDesfazer(m);
    act(() => { m.result.current.c.desfazer.cancelar(); });
    expect(m.result.current.c.desfazer.alvo).toBeNull();
    expect(m.result.current.c.desfazer.erro).toBeNull();
  });
});

describe('o item pedido fica guardado só para o diálogo se desenhar durante a animação de saída', () => {
  const seed = () => preparar({ historia_vida_paciente: [linhaGravada()] });

  it('cancelar: o alvo some (diálogo fechado) mas o item continua disponível para exibição', () => {
    const m = montar();
    act(() => { m.result.current.c.pedirConfirmacao(CIRURGIA); });
    expect(m.result.current.c.confirmacao.exibido).toEqual(CIRURGIA);
    act(() => { m.result.current.c.confirmacao.cancelar(); });
    expect(m.result.current.c.confirmacao.alvo).toBeNull();
    expect(m.result.current.c.confirmacao.exibido).toEqual(CIRURGIA);
  });

  it('confirmar com sucesso: o alvo some e o item continua disponível para exibição', async () => {
    const m = montar();
    await abrirEConfirmar(m);
    expect(m.result.current.c.confirmacao.alvo).toBeNull();
    expect(m.result.current.c.confirmacao.exibido).toEqual(CIRURGIA);
  });

  it('abrir de novo vale o item NOVO, nunca o velho', () => {
    const m = montar();
    const outra: CirurgiaDoCliente = { chave: 'historico_clinico:cirurgia:id:k9', tipo: 'Apêndice', ano: '2010', complicacoes: '' };
    act(() => { m.result.current.c.pedirConfirmacao(CIRURGIA); });
    act(() => { m.result.current.c.confirmacao.cancelar(); });
    act(() => { m.result.current.c.pedirConfirmacao(outra); });
    expect(m.result.current.c.confirmacao.alvo).toEqual(outra);
    expect(m.result.current.c.confirmacao.exibido).toEqual(outra);
  });

  it('sem pedido nenhum não há o que exibir', () => {
    const m = montar();
    expect(m.result.current.c.confirmacao.exibido).toBeNull();
    expect(m.result.current.c.desfazer.exibido).toBeNull();
  });

  it('com o diálogo fechado, confirmar não grava nada: o item guardado não é um pedido aberto', async () => {
    const m = montar();
    act(() => { m.result.current.c.pedirConfirmacao(CIRURGIA); });
    act(() => { m.result.current.c.confirmacao.cancelar(); });
    let ok = true;
    await act(async () => { ok = await m.result.current.c.confirmacao.confirmar(DIA); });
    expect(ok).toBe(false);
    expect(h.falso.escritas()).toEqual([]);
  });

  it('desfazer: cancelar fecha o alvo mas o título continua disponível para exibição', () => {
    seed();
    const m = montar();
    act(() => { m.result.current.c.pedirDesfazer(marcoConfirmado()); });
    act(() => { m.result.current.c.desfazer.cancelar(); });
    expect(m.result.current.c.desfazer.alvo).toBeNull();
    expect(m.result.current.c.desfazer.exibido).toEqual({ idDaLinha: ID_DA_LINHA, titulo: CIRURGIA.tipo });
  });

  it('desfazer com sucesso: o alvo some e o título continua disponível para exibição', async () => {
    seed();
    const m = montar();
    await abrirEDesfazer(m);
    expect(m.result.current.c.desfazer.alvo).toBeNull();
    expect(m.result.current.c.desfazer.exibido).toEqual({ idDaLinha: ID_DA_LINHA, titulo: CIRURGIA.tipo });
  });

  it('com o aviso fechado, desfazer não apaga nada', async () => {
    seed();
    const m = montar();
    act(() => { m.result.current.c.pedirDesfazer(marcoConfirmado()); });
    act(() => { m.result.current.c.desfazer.cancelar(); });
    let ok = true;
    await act(async () => { ok = await m.result.current.c.desfazer.desfazer(); });
    expect(ok).toBe(false);
    expect(h.falso.escritas()).toEqual([]);
  });

  it('abrir o aviso de novo vale o marco novo', () => {
    seed();
    const m = montar();
    act(() => { m.result.current.c.pedirDesfazer(marcoConfirmado()); });
    act(() => { m.result.current.c.desfazer.cancelar(); });
    act(() => { m.result.current.c.pedirDesfazer(marcoConfirmado('outra-linha', 'Apêndice')); });
    expect(m.result.current.c.desfazer.alvo).toEqual({ idDaLinha: 'outra-linha', titulo: 'Apêndice' });
    expect(m.result.current.c.desfazer.exibido).toEqual({ idDaLinha: 'outra-linha', titulo: 'Apêndice' });
  });
});

describe('o foco depois de fechar', () => {
  const titulo = () => {
    const el = document.createElement('h3');
    el.id = 'titulo-linha-do-tempo-clinica';
    document.body.appendChild(el);
    return el;
  };
  // O botão da lista que o profissional tocou: o diálogo do Radix sem gatilho não sabe devolver o foco a ele.
  const botaoQueAbriu = () => {
    const el = document.createElement('button');
    document.body.appendChild(el);
    el.focus();
    return el;
  };
  const fechar = (m: Montado) => {
    const evento = new Event('focus', { cancelable: true });
    m.result.current.c.devolverOFoco(evento);
    return evento;
  };

  it('depois de confirmar com sucesso o foco vai ao título da seção (o botão que abriu o diálogo deixou de existir)', async () => {
    const alvo = titulo();
    const botao = botaoQueAbriu();
    const m = montar();
    await abrirEConfirmar(m);
    const evento = fechar(m);
    expect(evento.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(alvo);
    expect(document.activeElement).not.toBe(botao);
    expect(alvo).toHaveAttribute('tabindex', '-1');
  });

  it('depois de desfazer com sucesso também', async () => {
    const alvo = titulo();
    botaoQueAbriu();
    preparar({ historia_vida_paciente: [linhaGravada()] });
    const m = montar();
    await abrirEDesfazer(m);
    const evento = fechar(m);
    expect(evento.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(alvo);
  });

  it('ao cancelar o foco volta ao botão que abriu o diálogo, e não ao título', () => {
    const alvo = titulo();
    const botao = botaoQueAbriu();
    const m = montar();
    act(() => { m.result.current.c.pedirConfirmacao(CIRURGIA); });
    (document.activeElement as HTMLElement).blur();
    act(() => { m.result.current.c.confirmacao.cancelar(); });
    const evento = fechar(m);
    expect(evento.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(botao);
    expect(document.activeElement).not.toBe(alvo);
  });

  it('o mesmo vale para o pedido de desfazer cancelado', () => {
    const alvo = titulo();
    const botao = botaoQueAbriu();
    const m = montar();
    act(() => { m.result.current.c.pedirDesfazer(marcoConfirmado()); });
    (document.activeElement as HTMLElement).blur();
    act(() => { m.result.current.c.desfazer.cancelar(); });
    fechar(m);
    expect(document.activeElement).toBe(botao);
    expect(document.activeElement).not.toBe(alvo);
  });

  it('se o botão que abriu já não está na página, o foco vai ao título (nunca se perde no corpo da página)', () => {
    const alvo = titulo();
    const botao = botaoQueAbriu();
    const m = montar();
    act(() => { m.result.current.c.pedirConfirmacao(CIRURGIA); });
    botao.remove();
    act(() => { m.result.current.c.confirmacao.cancelar(); });
    fechar(m);
    expect(document.activeElement).toBe(alvo);
  });

  it('se ninguém tinha o foco quando o diálogo foi pedido (navegador que não foca botão ao tocar), vai ao título', () => {
    const alvo = titulo();
    const m = montar();
    act(() => { m.result.current.c.pedirConfirmacao(CIRURGIA); });
    act(() => { m.result.current.c.confirmacao.cancelar(); });
    fechar(m);
    expect(document.activeElement).toBe(alvo);
  });

  it('com erro ao salvar o diálogo continua aberto: o foco não vai ao título', async () => {
    const alvo = titulo();
    const botao = botaoQueAbriu();
    h.falso.falharEscritaQuando((op) => op.tipo === 'insert', 'falha');
    const m = montar();
    await abrirEConfirmar(m);
    expect(m.result.current.c.confirmacao.alvo).not.toBeNull();
    // Só quando ele fechar (cancelando) é que o evento chega: aí o foco volta ao botão.
    act(() => { m.result.current.c.confirmacao.cancelar(); });
    fechar(m);
    expect(document.activeElement).toBe(botao);
    expect(document.activeElement).not.toBe(alvo);
  });

  it('o pedido de foco no título vale uma vez só: o fechamento seguinte (cancelando) devolve o foco ao botão', async () => {
    const alvo = titulo();
    botaoQueAbriu();
    const m = montar();
    await abrirEConfirmar(m);
    fechar(m);
    expect(document.activeElement).toBe(alvo);
    const outro = botaoQueAbriu();
    act(() => { m.result.current.c.pedirConfirmacao(CIRURGIA); });
    (document.activeElement as HTMLElement).blur();
    act(() => { m.result.current.c.confirmacao.cancelar(); });
    fechar(m);
    expect(document.activeElement).toBe(outro);
  });
});
