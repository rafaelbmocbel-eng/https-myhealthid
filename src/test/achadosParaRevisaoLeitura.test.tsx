import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { criarBancoFalso, type BancoFalso, type Linha } from './helpers/bancoFalso';
import { envolverBanco, type BancoEnvolvido } from './helpers/bancoFalsoLeitura';
import { filaDeRevisao } from '@/lib/avatar/filaDeRevisao';
import { montarCorteDosAchados } from '@/lib/resumoClinico/cortes';
import { ROTULO_DOS_ACHADOS_DO_HISTORICO } from '@/lib/resumoClinico/tipos';

const h = vi.hoisted(() => ({
  falso: null as unknown as BancoFalso,
  banco: null as unknown as BancoEnvolvido,
  usuario: { id: 'prof-1' } as { id: string } | null,
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (t: string) => h.banco.from(t), rpc: (nome: string, args?: Record<string, unknown>) => h.banco.rpc(nome, args) },
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: h.usuario }) }));

import { lerAchadosParaRevisao, lerFontesClinicas, useAchadosParaRevisao, useFontesClinicas } from '@/hooks/useFontesClinicas';

const TABELA = 'eventos_clinicos_anatomicos';
const DATA_DO_ENVIO = '2026-11-15';
const TEXTO_DO_PACIENTE = 'Resposta do paciente: dor no joelho há dois meses';

let contador = 0;
function achado(tipo: string, extra: Linha = {}): Linha {
  contador += 1;
  return {
    id: `ev-${String(contador).padStart(4, '0')}`, paciente_id: 'pac-1', terapeuta_id: 'prof-1', regiao_id: 'joelho_d', sistema: 'musculoesqueletico',
    origem: 'autocadastro_paciente', tipo_achado: 'Dor no joelho', tipo_diagnostico: tipo, severidade: 2, status: 'ativo',
    data_inicio: DATA_DO_ENVIO, data_resolucao: null, created_at: `${DATA_DO_ENVIO}T12:00:00+00:00`, updated_at: `${DATA_DO_ENVIO}T12:00:00+00:00`,
    notas_clinicas: TEXTO_DO_PACIENTE, visivel_paciente: false,
    metadata: { categoria: 'dor', resposta: TEXTO_DO_PACIENTE, chave_resposta: 'dor|joelho', enviado_em: DATA_DO_ENVIO }, ...extra,
  };
}
const relato = (extra: Linha = {}) => achado('relato_paciente', extra);
const historico = (metadata: Linha = {}, extra: Linha = {}) => achado('historico_relatado', { metadata: { categoria: 'dor', resposta: TEXTO_DO_PACIENTE, ...metadata }, status: 'resolvido', ...extra });
const rejeicoes = (quantas: number) => Array.from({ length: quantas }, (_, i) => ({ terapeuta_id: `p${i}`, data: '2026-11-16T10:00:00Z' }));

function cenario(): Linha[] {
  contador = 0;
  return [
    relato(),                                                                // conta (relato)
    relato({ status: 'resolvido' }),                                         // não: resolvido
    historico(),                                                             // conta
    historico({ revisado_por_ids: ['prof-1'] }),                             // não: já revisei
    historico({ revisado_por_ids: ['prof-2'] }),                             // conta: outro revisou
    historico({ descartado: true, descartado_em: '2026-11-17T10:00:00Z' }),  // não: descartado
    historico({ rejeicoes: rejeicoes(2) }),                                  // conta
    historico({ rejeicoes: rejeicoes(3) }),                                  // não: 3 rejeições
    achado('achado_clinico'),                                                // não: outro tipo (nem é pedido ao banco)
    achado('historico_confirmado'),                                          // não: outro tipo
    relato({ paciente_id: 'pac-2' }),                                        // não: outro paciente
    historico({}, { paciente_id: 'pac-2' }),                                 // não: outro paciente
    relato({ terapeuta_id: 'prof-2' }),                                      // não: outro profissional
    historico({}, { terapeuta_id: 'prof-2' }),                               // não: outro profissional
  ];
}

function preparar(linhas: Linha[] = cenario(), extras: Record<string, Linha[]> = {}) {
  h.falso = criarBancoFalso({ [TABELA]: linhas, ...extras });
  h.banco = envolverBanco(h.falso);
}

const chamadas = (tabela = TABELA) => h.banco.chamadas.filter((c) => c.tabela === tabela);

beforeEach(() => { h.usuario = { id: 'prof-1' }; preparar(); });

describe('lerAchadosParaRevisao: só a contagem, do paciente aberto e do profissional logado', () => {
  it('conta os relatos e o histórico que aguardam a revisão, com a regra da fila do Avatar', async () => {
    const r = await lerAchadosParaRevisao('pac-1', 'prof-1');
    expect(r).toEqual({ total: 4, relatosDoPaciente: 1, historicoRelatado: 3 });
  });

  it('só lê da tabela dos achados e só com select: nenhuma escrita, nenhuma outra tabela', async () => {
    await lerAchadosParaRevisao('pac-1', 'prof-1');
    expect([...new Set(h.falso.operacoes.map((o) => o.tabela))]).toEqual([TABELA]);
    expect(new Set(h.falso.operacoes.map((o) => o.tipo))).toEqual(new Set(['select']));
    expect(h.falso.escritas()).toEqual([]);
    for (const c of h.banco.chamadas) expect(['select', 'eq', 'in', 'order', 'limit']).toContain(c.metodo);
  });

  it('pede só as colunas da regra: tipo, status e as três marcas do metadata por caminho JSON (nunca "*", nunca data, nunca o texto do paciente)', async () => {
    await lerAchadosParaRevisao('pac-1', 'prof-1');
    const colunas = String(chamadas().find((c) => c.metodo === 'select')?.args[0]).split(',').map((c) => c.trim());
    expect(colunas).toEqual([
      'tipo_diagnostico',
      'status',
      'revisado_por_ids:metadata->revisado_por_ids',
      'descartado:metadata->descartado',
      'rejeicoes:metadata->rejeicoes',
    ]);
    const pedido = colunas.join(' ');
    expect(pedido).not.toContain('*');
    for (const proibida of ['data_inicio', 'data_resolucao', 'created_at', 'updated_at', 'descartado_em', 'enviado_em', 'notas_clinicas', 'tipo_achado', 'resposta']) {
      expect(pedido, proibida).not.toContain(proibida);
    }
    // Nenhuma coluna de data nem em filtro nem em ordem.
    for (const c of chamadas().filter((x) => x.metodo === 'order' || x.metodo === 'eq' || x.metodo === 'in')) {
      expect(String(c.args[0]), c.metodo).not.toMatch(/data|created_at|updated_at/);
    }
  });

  it('filtra pelo paciente aberto, pelo profissional logado e só pelos dois tipos da fila', async () => {
    await lerAchadosParaRevisao('pac-1', 'prof-1');
    expect(chamadas()).toContainEqual({ tabela: TABELA, metodo: 'eq', args: ['paciente_id', 'pac-1'] });
    expect(chamadas()).toContainEqual({ tabela: TABELA, metodo: 'eq', args: ['terapeuta_id', 'prof-1'] });
    expect(chamadas()).toContainEqual({ tabela: TABELA, metodo: 'in', args: ['tipo_diagnostico', ['relato_paciente', 'historico_relatado']] });
  });

  it('com outro profissional, vale o que é dele e a revisão dele (o que prof-1 revisou volta para prof-2 e vice-versa)', async () => {
    expect(await lerAchadosParaRevisao('pac-1', 'prof-2')).toEqual({ total: 2, relatosDoPaciente: 1, historicoRelatado: 1 });
    expect(await lerAchadosParaRevisao('pac-2', 'prof-1')).toEqual({ total: 2, relatosDoPaciente: 1, historicoRelatado: 1 });
    expect(await lerAchadosParaRevisao('pac-3', 'prof-1')).toEqual({ total: 0, relatosDoPaciente: 0, historicoRelatado: 0 });
  });

  it('devolve só números (e o texto do corte): nenhuma data, nenhum texto do achado, nenhuma linha', async () => {
    const r = await lerAchadosParaRevisao('pac-1', 'prof-1');
    expect(Object.keys(r).sort()).toEqual(['historicoRelatado', 'relatosDoPaciente', 'total']);
    expect(Object.values(r).every((v) => typeof v === 'number')).toBe(true);
    const texto = JSON.stringify(r);
    for (const naoPode of [DATA_DO_ENVIO, '2026-11-16', '2026-11-17', TEXTO_DO_PACIENTE, 'Dor no joelho', 'joelho_d', 'ev-0001']) expect(texto, naoPode).not.toContain(naoPode);
  });

  it('um banco que devolve tudo, sem aplicar o filtro de tipo, não infla a conta (a regra confere o tipo de novo)', async () => {
    const doBanco = cenario().filter((l) => l.paciente_id === 'pac-1' && l.terapeuta_id === 'prof-1');
    expect(doBanco.some((l) => l.tipo_diagnostico === 'achado_clinico')).toBe(true);
    const marca = (l: Linha, chave: string) => (l.metadata as Linha)[chave] ?? null;
    const linhas = doBanco.map((l) => ({ tipo_diagnostico: l.tipo_diagnostico, status: l.status, revisado_por_ids: marca(l, 'revisado_por_ids'), descartado: marca(l, 'descartado'), rejeicoes: marca(l, 'rejeicoes') }));
    const consulta: Record<string, unknown> = {};
    for (const metodo of ['select', 'eq', 'in', 'order', 'limit']) consulta[metodo] = () => consulta;
    consulta.then = (resolver: (v: unknown) => unknown, rejeitar?: (e: unknown) => unknown) => Promise.resolve({ data: linhas, error: null }).then(resolver, rejeitar);
    h.banco = { from: () => consulta, rpc: h.banco.rpc, chamadas: [], falharLeitura: () => {} };
    expect(await lerAchadosParaRevisao('pac-1', 'prof-1')).toEqual({ total: 4, relatosDoPaciente: 1, historicoRelatado: 3 });
  });

  describe('o mesmo número que o Avatar mostra, mesmo com a leitura só das colunas da regra', () => {
    // Gerador fixo (sem acaso do relógio): variações de tipo, status e metadata, inclusive com tipo errado.
    const revisados: unknown[] = [undefined, [], ['prof-1'], ['prof-2'], ['prof-2', 'prof-1'], 'prof-1', 'outro', null, 0];
    const descartados: unknown[] = [undefined, true, false, null, 0, 1, 'sim'];
    const listas: unknown[] = [undefined, [], rejeicoes(1), rejeicoes(2), rejeicoes(3), rejeicoes(4), 'ab', 'abc', 7, { length: 3 }, null];
    const tipos = ['relato_paciente', 'historico_relatado', 'achado_clinico'];
    const status = ['ativo', 'resolvido', 'cronico'];

    it('para centenas de linhas, a contagem lida pelo caminho JSON é igual à regra aplicada nas linhas inteiras', async () => {
      contador = 0;
      const linhas: Linha[] = [];
      let i = 0;
      for (const r of revisados) for (const d of descartados) for (const j of listas) {
        const tipo = tipos[i % tipos.length];
        const st = status[Math.floor(i / tipos.length) % status.length];
        const metadata: Linha = { categoria: 'dor', resposta: TEXTO_DO_PACIENTE, descartado_em: '2026-11-17T10:00:00Z' };
        if (r !== undefined) metadata.revisado_por_ids = r;
        if (d !== undefined) metadata.descartado = d;
        if (j !== undefined) metadata.rejeicoes = j;
        linhas.push(achado(tipo, { status: st, metadata }));
        i += 1;
      }
      preparar(linhas);
      expect(linhas.length).toBeGreaterThan(300);
      const lido = await lerAchadosParaRevisao('pac-1', 'prof-1');
      // O limite é 200: o banco já devolve só os dois tipos da fila, e a leitura fica com os 200 primeiros por id.
      const daFila = linhas.filter((l) => l.tipo_diagnostico !== 'achado_clinico').slice(0, 200);
      const esperada = filaDeRevisao(daFila, 'prof-1');
      expect(lido.relatosDoPaciente).toBe(esperada.relatosDoPaciente.length);
      expect(lido.historicoRelatado).toBe(esperada.historicoRelatado.length);
      expect(lido.total).toBe(esperada.relatosDoPaciente.length + esperada.historicoRelatado.length);
    });

    it('abaixo do limite, o resultado é exatamente o da regra sobre as linhas inteiras', async () => {
      contador = 0;
      const linhas: Linha[] = [];
      for (const r of revisados) for (const d of descartados) {
        linhas.push(achado('historico_relatado', { metadata: { categoria: 'dor', ...(r === undefined ? {} : { revisado_por_ids: r }), ...(d === undefined ? {} : { descartado: d }), rejeicoes: rejeicoes(2) } }));
        linhas.push(achado('relato_paciente', { status: d === true ? 'resolvido' : 'ativo' }));
      }
      expect(linhas.length).toBeLessThan(200);
      preparar(linhas);
      const lido = await lerAchadosParaRevisao('pac-1', 'prof-1');
      const esperada = filaDeRevisao(linhas, 'prof-1');
      expect({ relatos: lido.relatosDoPaciente, historico: lido.historicoRelatado }).toEqual({ relatos: esperada.relatosDoPaciente.length, historico: esperada.historicoRelatado.length });
      expect(lido.corte).toBeUndefined();
    });
  });
});

describe('lerAchadosParaRevisao: limite e aviso de corte (limite + 1, como as outras fontes)', () => {
  const muitos = (quantos: number) => { contador = 0; return Array.from({ length: quantos }, () => relato()); };

  it('pede UMA linha a mais que o limite de 200, e em ordem fixa (por id, sem data)', async () => {
    await lerAchadosParaRevisao('pac-1', 'prof-1');
    expect(chamadas().filter((c) => c.metodo === 'limit').map((c) => c.args[0])).toEqual([201]);
    expect(chamadas().find((c) => c.metodo === 'order')?.args).toEqual(['id', { ascending: true }]);
  });

  it('exatamente 200 linhas não é corte', async () => {
    preparar(muitos(200));
    expect(await lerAchadosParaRevisao('pac-1', 'prof-1')).toEqual({ total: 200, relatosDoPaciente: 200, historicoRelatado: 0 });
  });

  it('201 linhas: conta só as 200 (a extra é descartada) e avisa que a contagem pode estar menor', async () => {
    preparar(muitos(201));
    const r = await lerAchadosParaRevisao('pac-1', 'prof-1');
    expect(r.total).toBe(200);
    expect(r.corte).toEqual({ limite: 200, texto: 'Achados do histórico: contei só os 200 primeiros; pode haver mais aguardando a sua revisão.' });
    expect(r.corte).toEqual(montarCorteDosAchados(200));
  });

  it('o texto do corte não diz "mais recentes" (nenhuma data é lida para ordenar)', () => {
    expect(montarCorteDosAchados(200).texto).not.toMatch(/recentes/);
  });
});

describe('lerAchadosParaRevisao: falha isolada', () => {
  it('erro devolvido pelo banco: a leitura lança, e quem chama isola', async () => {
    h.banco.falharLeitura(TABELA, 'erro');
    await expect(lerAchadosParaRevisao('pac-1', 'prof-1')).rejects.toThrow('leitura falhou');
  });

  it('as outras fontes não dependem dela: lerFontesClinicas nunca toca a tabela dos achados (nem falha, nem espera)', async () => {
    h.banco.falharLeitura(TABELA, 'rejeitar');
    const { falhas } = await lerFontesClinicas('pac-1', 'prof-1');
    expect(falhas).toEqual([]);
    expect(h.banco.chamadas.map((c) => c.tabela)).not.toContain(TABELA);
  });
});

function envolver(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
const clienteNovo = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('useAchadosParaRevisao', () => {
  it('lê a contagem, e a chave começa por ["eventos-anatomicos", paciente]: o que o Avatar já invalida ao confirmar ou rejeitar refaz a contagem', async () => {
    const client = clienteNovo();
    const { result } = renderHook(() => useAchadosParaRevisao('pac-1'), { wrapper: envolver(client) });
    await waitFor(() => expect(result.current.data?.total).toBe(4));

    const consulta = client.getQueryCache().findAll({ queryKey: ['eventos-anatomicos', 'pac-1'] })[0];
    expect(consulta?.queryKey).toEqual(['eventos-anatomicos', 'pac-1', 'fila-de-revisao', 'prof-1']);

    // O profissional revisa um achado no Avatar: o banco muda e o Avatar invalida ['eventos-anatomicos', paciente].
    h.falso.tabelas[TABELA][2].metadata = { ...(h.falso.tabelas[TABELA][2].metadata as Linha), revisado_por_ids: ['prof-1'] };
    await client.invalidateQueries({ queryKey: ['eventos-anatomicos', 'pac-1'] });
    await waitFor(() => expect(result.current.data?.total).toBe(3));
  });

  it('a invalidação de outro paciente não refaz esta contagem', async () => {
    const client = clienteNovo();
    const { result } = renderHook(() => useAchadosParaRevisao('pac-1'), { wrapper: envolver(client) });
    await waitFor(() => expect(result.current.data?.total).toBe(4));
    const antes = h.banco.chamadas.filter((c) => c.metodo === 'select').length;
    await client.invalidateQueries({ queryKey: ['eventos-anatomicos', 'pac-2'] });
    expect(h.banco.chamadas.filter((c) => c.metodo === 'select').length).toBe(antes);
  });

  it('não guarda a resposta depois de sair da tela: voltar do Avatar lê de novo, nunca mostra a contagem de antes da revisão', async () => {
    const client = clienteNovo();
    const primeira = renderHook(() => useAchadosParaRevisao('pac-1'), { wrapper: envolver(client) });
    await waitFor(() => expect(primeira.result.current.data?.total).toBe(4));
    primeira.unmount();
    await waitFor(() => expect(client.getQueryCache().findAll({ queryKey: ['eventos-anatomicos', 'pac-1'] })).toHaveLength(0));
    const segunda = renderHook(() => useAchadosParaRevisao('pac-1'), { wrapper: envolver(client) });
    expect(segunda.result.current.data).toBeUndefined();
    await waitFor(() => expect(segunda.result.current.data?.total).toBe(4));
  });

  it('é uma leitura à parte da linha do tempo: a chave não está em fontes-clinicas, e a linha do tempo pronta não espera por ela', async () => {
    const client = clienteNovo();
    const achados = renderHook(() => useAchadosParaRevisao('pac-1'), { wrapper: envolver(client) });
    const fontes = renderHook(() => useFontesClinicas('pac-1'), { wrapper: envolver(client) });
    await waitFor(() => expect(fontes.result.current.data).toBeDefined());
    await waitFor(() => expect(achados.result.current.data).toBeDefined());
    expect(client.getQueryCache().findAll().map((q) => q.queryKey[0]).sort()).toEqual(['eventos-anatomicos', 'fontes-clinicas']);
  });

  it('a falha desta leitura fica só nela: a linha do tempo continua e o nome da falha é "os achados do histórico"', async () => {
    h.banco.falharLeitura(TABELA, 'erro');
    const client = clienteNovo();
    const achados = renderHook(() => useAchadosParaRevisao('pac-1'), { wrapper: envolver(client) });
    const fontes = renderHook(() => useFontesClinicas('pac-1'), { wrapper: envolver(client) });
    await waitFor(() => expect(achados.result.current.isError).toBe(true));
    await waitFor(() => expect(fontes.result.current.data).toBeDefined());
    expect(fontes.result.current.isError).toBe(false);
    expect(fontes.result.current.data?.falhas).toEqual([]);
    expect(ROTULO_DOS_ACHADOS_DO_HISTORICO).toBe('os achados do histórico');
  });

  it('sem paciente ou sem profissional logado, não lê nada', async () => {
    const semPaciente = renderHook(() => useAchadosParaRevisao(undefined), { wrapper: envolver(clienteNovo()) });
    h.usuario = null;
    const semUsuario = renderHook(() => useAchadosParaRevisao('pac-1'), { wrapper: envolver(clienteNovo()) });
    await new Promise((r) => setTimeout(r, 20));
    expect(semPaciente.result.current.fetchStatus).toBe('idle');
    expect(semUsuario.result.current.fetchStatus).toBe('idle');
    // "pending" e não "error": a leitura nem tentou rodar (sem isto, sem usuário ela lançaria e a tela diria que não conseguiu ler).
    expect(semPaciente.result.current.status).toBe('pending');
    expect(semUsuario.result.current.status).toBe('pending');
    expect(h.falso.operacoes).toEqual([]);
  });
});

describe('o código da leitura dos achados', () => {
  const fonte = readFileSync(join(__dirname, '..', 'hooks', 'useFontesClinicas.ts'), 'utf8');
  const trecho = fonte.slice(fonte.indexOf('// ── Contagem dos achados'));

  it('não escreve, não chama função do banco e não lê coluna de data dos achados', () => {
    expect(trecho.length).toBeGreaterThan(500);
    expect(trecho).not.toMatch(/\.(insert|update|upsert|delete|rpc)\s*\(/);
    expect(trecho).not.toMatch(/functions\s*\.\s*invoke/);
    expect(trecho).not.toMatch(/data_inicio|data_resolucao|created_at|updated_at|descartado_em/);
    expect(trecho).not.toMatch(/select\(\s*['"`]\*/);
  });

  it('usa a regra da fila do Avatar e não escreve a regra de novo', () => {
    expect(trecho).toMatch(/filaDeRevisao\(/);
    expect(trecho).not.toMatch(/'resolvido'|"resolvido"|rejeicoes\??\.length|revisado_por_ids\s*\|\|/);
  });
});
