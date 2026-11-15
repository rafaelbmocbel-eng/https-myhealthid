import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

const avisos = vi.hoisted(() => ({ erro: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: avisos.erro, warning: vi.fn(), info: vi.fn() } }));

import {
  algoPreenchido, estadoInicial, estadoInicialLivre, ordemNaSessao, pacienteDaSessao, previstasEfetivas, reducerSessao, resumoDoItem, temNaoSalva,
  useSessaoPostural, type AcaoSessao, type EstadoSessao, type FotoDaPosicao,
} from '@/hooks/useSessaoPostural';
import { montarNotaDaPosicao, useGravarPosicao } from '@/hooks/useSessaoDoPaciente';
import { lerDadosExtras } from '@/lib/angular/sessao';

const fotoFalsa = (url = 'blob:a'): FotoDaPosicao => ({ url, w: 1000, h: 1500, img: document.createElement('img') });
const livre = (id = 'livre-1'): EstadoSessao => estadoInicialLivre(id, '2026-03-12T13:00:00.000Z');
const rodar = (e: EstadoSessao, ...acoes: AcaoSessao[]) => acoes.reduce(reducerSessao, e);
const P = (x: number, y: number) => ({ x, y });
// Tipo Cobb: uma reta horizontal e outra a 45°.
const COBB = [P(0, 100), P(200, 100), P(0, 300), P(200, 500)];
const marcarCobb = (e: EstadoSessao) => COBB.reduce((acc, ponto) => reducerSessao(acc, { tipo: 'marcar', posicao: 'livre', medida: 'cobb', ponto }), e);
const comFoto = (e: EstadoSessao, url = 'blob:l1') => reducerSessao(e, { tipo: 'foto', posicao: 'livre', foto: fotoFalsa(url), inclinacao: null });
const salvaDa = (e: EstadoSessao, notaId = 'nota-1', pacienteId = 'p1'): AcaoSessao => ({ tipo: 'salva', posicao: 'livre', notaId, pacienteId, sessaoId: e.id, item: e.itens.livre });

describe('estado inicial da análise livre', () => {
  it('é uma sessão de uma posição só ("livre"), vazia, com nome em branco', () => {
    const e = livre();
    expect(e.previstas).toEqual(['livre']);
    expect(e.atual).toBe('livre');
    expect(e.visao).toBe('posicao');
    expect(Object.keys(e.itens)).toEqual(['livre']);
    expect(e.itens.livre).toMatchObject({ foto: null, pontos: {}, notaId: null, notaPaciente: null, salva: false, pulada: false });
    expect(e.nomeLivre).toBe('');
    expect(e.compassoRef).toBe('baixo');
    expect(e.unidadePrumo).toBe('graus');
    expect(e.id).toBe('livre-1');
    expect(previstasEfetivas(e)).toEqual(['livre']);
    expect(ordemNaSessao(e, 'livre')).toEqual({ ordem: 1, total: 1 });
  });

  it('a sessão da postura continua com as quatro posições e sem nenhum campo da livre', () => {
    const e = estadoInicial('s', '2026-03-12T13:00:00.000Z');
    expect(e.previstas).toEqual(['frente', 'perfil_d', 'perfil_e', 'costas']);
    expect(Object.keys(e.itens)).toEqual(['frente', 'perfil_d', 'perfil_e', 'costas']);
    expect(e).not.toHaveProperty('nomeLivre');
  });

  it('as previstas da livre são uma cópia própria', () => {
    const a = livre();
    a.previstas.push('frente');
    expect(livre().previstas).toEqual(['livre']);
  });
});

describe('consultas sobre o estado da livre', () => {
  it('algoPreenchido, temNaoSalva e pacienteDaSessao olham a posição livre (e a da postura continua igual)', () => {
    let e = livre();
    expect(algoPreenchido(e)).toBe(false);
    expect(temNaoSalva(e)).toBe(false);
    expect(pacienteDaSessao(e)).toBeNull();
    e = comFoto(e);
    expect(algoPreenchido(e)).toBe(true);
    expect(temNaoSalva(e)).toBe(false);
    e = marcarCobb(e);
    expect(temNaoSalva(e)).toBe(true);
    e = rodar(e, salvaDa(e, 'nota-9', 'p7'));
    expect(temNaoSalva(e)).toBe(false);
    expect(pacienteDaSessao(e)).toBe('p7');
    const postura = reducerSessao(estadoInicial('s', '2026-03-12T13:00:00.000Z'), { tipo: 'foto', posicao: 'costas', foto: fotoFalsa('blob:c'), inclinacao: null });
    expect(algoPreenchido(postura)).toBe(true);
  });
});

describe('reducer na posição livre', () => {
  it('foto e pontos entram na posição livre e dão o resultado da ferramenta (tipo Cobb, 45°)', () => {
    const e = marcarCobb(comFoto(livre()));
    expect(e.itens.livre.pontos.cobb).toEqual(COBB);
    const r = resumoDoItem(e.itens.livre, 'livre', e.compassoRef, e.unidadePrumo);
    expect(r.temResultado).toBe(true);
    expect(r.analise.vista).toBe('livre');
    expect(r.analise).not.toHaveProperty('lado');
    expect(r.medidas.map((x) => x.id)).toEqual(['cobb']);
    expect(r.medidas[0].graus).toBe(45);
  });

  it('trocar a foto apaga os pontos mas guarda a nota já gravada: salvar de novo atualiza a mesma nota', () => {
    let e = marcarCobb(comFoto(livre()));
    e = rodar(e, salvaDa(e, 'nota-1', 'p1'));
    expect(e.itens.livre.salva).toBe(true);
    e = comFoto(e, 'blob:l2');
    expect(e.itens.livre.pontos).toEqual({});
    expect(e.itens.livre.notaId).toBe('nota-1');
    expect(e.itens.livre.notaPaciente).toBe('p1');
    expect(e.itens.livre.salva).toBe(false);
  });

  it('mexer nos pontos depois de salvar tira o "salva"', () => {
    let e = marcarCobb(comFoto(livre()));
    e = rodar(e, salvaDa(e));
    e = rodar(e, { tipo: 'arrastar', posicao: 'livre', medida: 'cobb', indice: 0, ponto: P(5, 100) });
    expect(e.itens.livre.salva).toBe(false);
    expect(e.itens.livre.notaId).toBe('nota-1');
  });

  it('a gravação de outra análise (o id mudou no meio) não vale para a nova', () => {
    const antes = marcarCobb(comFoto(livre('antiga')));
    const acao = salvaDa(antes, 'nota-antiga', 'p1');
    const depois = rodar(livre('nova'), acao);
    expect(depois.itens.livre.notaId).toBeNull();
  });
});

describe('nome da análise livre no estado', () => {
  it('guarda o que foi digitado (sem cortar espaços enquanto se digita) e corta em 80 caracteres', () => {
    let e = rodar(livre(), { tipo: 'nome_livre', nome: 'braço ' });
    expect(e.nomeLivre).toBe('braço ');
    e = rodar(e, { tipo: 'nome_livre', nome: 'x'.repeat(120) });
    expect(e.nomeLivre).toBe('x'.repeat(80));
  });

  it('mudar o nome depois de salva pede nova gravação; sem foto não há o que regravar; igual não muda nada', () => {
    let e = marcarCobb(comFoto(livre()));
    e = rodar(e, salvaDa(e));
    const mudou = rodar(e, { tipo: 'nome_livre', nome: 'ombro direito' });
    expect(mudou.itens.livre.salva).toBe(false);
    expect(mudou.itens.livre.notaId).toBe('nota-1');
    expect(rodar(mudou, { tipo: 'nome_livre', nome: 'ombro direito' })).toBe(mudou);
    const vazio = livre();
    const semFoto = rodar(vazio, { tipo: 'nome_livre', nome: 'antes da foto' });
    expect(semFoto.itens.livre).toBe(vazio.itens.livre);
    expect(semFoto.nomeLivre).toBe('antes da foto');
  });

  it('o nome vai para o título da nota e para os dados', () => {
    const e = rodar(marcarCobb(comFoto(livre())), { tipo: 'nome_livre', nome: '  elevação  do braço direito ' });
    const nota = montarNotaDaPosicao(e, 'livre')!;
    expect(nota.titulo).toBe('Análise angular — análise livre: elevação do braço direito');
    expect(nota.dados_extras.nome_livre).toBe('elevação do braço direito');
  });
});

describe('o nome da livre não existe na sessão da postura', () => {
  it('dispatch de nome numa sessão da postura não muda nada (o estado fica o mesmo objeto)', () => {
    const postura = estadoInicial('s', '2026-03-12T13:00:00.000Z');
    expect(rodar(postura, { tipo: 'nome_livre', nome: 'qualquer' })).toBe(postura);
  });
});

describe('reiniciar a análise livre', () => {
  it('começa outra análise livre (id novo, nome vazio, foto e pontos limpos) e guarda só as opções de ferramenta', () => {
    let e = marcarCobb(comFoto(livre('a')));
    e = rodar(e, { tipo: 'nome_livre', nome: 'qualquer' }, { tipo: 'opcoes', compassoRef: 'cima', unidadePrumo: 'cm' });
    const novo = rodar(e, { tipo: 'reiniciar', id: 'b', iniciadaEm: '2026-03-13T10:00:00.000Z' });
    expect(novo.id).toBe('b');
    expect(novo.iniciadaEm).toBe('2026-03-13T10:00:00.000Z');
    expect(novo.previstas).toEqual(['livre']);
    expect(novo.atual).toBe('livre');
    expect(Object.keys(novo.itens)).toEqual(['livre']);
    expect(novo.nomeLivre).toBe('');
    expect(novo.itens.livre.foto).toBeNull();
    expect(novo.itens.livre.pontos).toEqual({});
    expect(novo.itens.livre.notaId).toBeNull();
    expect(novo.compassoRef).toBe('cima');
    expect(novo.unidadePrumo).toBe('cm');
  });

  it('reiniciar a sessão da postura continua dando as quatro posições', () => {
    const e = rodar(estadoInicial('a', '2026-03-12T13:00:00.000Z'), { tipo: 'reiniciar', id: 'b', iniciadaEm: '2026-03-13T10:00:00.000Z' });
    expect(e.previstas).toEqual(['frente', 'perfil_d', 'perfil_e', 'costas']);
    expect(Object.keys(e.itens)).toEqual(['frente', 'perfil_d', 'perfil_e', 'costas']);
    expect(e).not.toHaveProperty('nomeLivre');
  });
});

describe('nota do prontuário da análise livre', () => {
  const pronta = (nome = 'elevação do braço direito', id = 'livre-1') => rodar(marcarCobb(comFoto(livre(id))), { tipo: 'nome_livre', nome });

  it('título com o nome, esquema 2, vista livre, o nome limpo, a sessão de uma posição e o id em referencia_id', () => {
    const nota = montarNotaDaPosicao(pronta(), 'livre')!;
    expect(nota.titulo).toBe('Análise angular — análise livre: elevação do braço direito');
    expect(nota.referencia_id).toBe('livre-1');
    expect(nota.dados_extras).toMatchObject({
      vista: 'livre', nome_livre: 'elevação do braço direito', esquema: 2, metodo: 'marcacao_manual',
      sessao: { id: 'livre-1', ordem: 1, previstas: ['livre'], iniciadaEm: '2026-03-12T13:00:00.000Z' },
    });
    expect(nota.dados_extras.medidas.map((x) => x.id)).toEqual(['cobb']);
    expect(nota.dados_extras).not.toHaveProperty('lado_perfil');
    expect(nota.dados_extras).not.toHaveProperty('pontos_ajustados');
  });

  it('sem nome: título sem os dois-pontos e nenhum nome_livre nos dados', () => {
    const nota = montarNotaDaPosicao(pronta('   '), 'livre')!;
    expect(nota.titulo).toBe('Análise angular — análise livre');
    expect(nota.dados_extras).not.toHaveProperty('nome_livre');
  });

  it('a descrição vem da mesma função da posição: medidas, "pontos marcados manualmente", sem detecção automática e sem a foto', () => {
    const { descricao } = montarNotaDaPosicao(pronta(), 'livre')!;
    expect(descricao).toContain('• Ângulo entre as duas retas (tipo Cobb): 45,0°.');
    expect(descricao).toContain('Pontos marcados manualmente.');
    expect(descricao).toContain('A foto não é armazenada.');
    expect(descricao).not.toMatch(/automática|conferid/i);
  });

  it('sem nenhuma medida pronta não há nota; nada da foto vai nos dados', () => {
    expect(montarNotaDaPosicao(comFoto(livre()), 'livre')).toBeNull();
    const nota = montarNotaDaPosicao(pronta(), 'livre')!;
    expect(JSON.stringify(nota)).not.toContain('blob:');
  });

  it('a nota gravada volta pela leitura como livre, com o nome, e nunca como posição da postura', () => {
    const lida = lerDadosExtras(montarNotaDaPosicao(pronta(), 'livre')!.dados_extras);
    expect(lida).toMatchObject({ vista: 'livre', posicao: null, nomeLivre: 'elevação do braço direito', esquema: 2 });
  });
});

describe('hook da análise livre (mesmo hook da sessão, outro modo)', () => {
  let revogadas: string[];
  beforeEach(() => {
    revogadas = [];
    vi.stubGlobal('URL', Object.assign(URL, { revokeObjectURL: (u: string) => { revogadas.push(u); }, createObjectURL: () => 'blob:nada' }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('começa livre e o hook da postura, sem argumento, continua com as quatro posições', () => {
    const l = renderHook(() => useSessaoPostural('livre'));
    expect(l.result.current.estado.previstas).toEqual(['livre']);
    expect(l.result.current.resumos.livre).toBeDefined();
    expect(l.result.current.resumo.analise.vista).toBe('livre');
    const p = renderHook(() => useSessaoPostural());
    expect(p.result.current.estado.previstas).toEqual(['frente', 'perfil_d', 'perfil_e', 'costas']);
    expect(p.result.current.estado).not.toHaveProperty('nomeLivre');
  });

  it('reiniciar continua livre, e o nome pode ser mudado pelas ações', () => {
    const { result } = renderHook(() => useSessaoPostural('livre'));
    const primeiro = result.current.estado.id;
    act(() => { result.current.acoes.definirNomeLivre('ombro direito'); });
    expect(result.current.estado.nomeLivre).toBe('ombro direito');
    act(() => { result.current.acoes.reiniciar(); });
    expect(result.current.estado.id).not.toBe(primeiro);
    expect(result.current.estado.previstas).toEqual(['livre']);
    expect(result.current.estado.nomeLivre).toBe('');
  });

  it('revoga a URL da foto trocada, a da foto descartada ao reiniciar e a que sobra ao desmontar', () => {
    const { result, unmount } = renderHook(() => useSessaoPostural('livre'));
    act(() => { result.current.acoes.definirFoto('livre', fotoFalsa('blob:l1')); });
    expect(revogadas).toEqual([]);
    act(() => { result.current.acoes.definirFoto('livre', fotoFalsa('blob:l2')); });
    expect(revogadas).toEqual(['blob:l1']);
    act(() => { result.current.acoes.reiniciar(); });
    expect(revogadas).toEqual(['blob:l1', 'blob:l2']);
    act(() => { result.current.acoes.definirFoto('livre', fotoFalsa('blob:l3')); });
    unmount();
    expect(revogadas.filter((u) => u === 'blob:l3')).toHaveLength(1);
  });

  it('avisa ao fechar a página só enquanto há marcação livre não salva', () => {
    const { result } = renderHook(() => useSessaoPostural('livre'));
    const fechar = () => { const ev = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(ev); return ev.defaultPrevented; };
    expect(fechar()).toBe(false);
    act(() => { result.current.acoes.definirFoto('livre', fotoFalsa('blob:l')); });
    expect(fechar()).toBe(false);
    act(() => { result.current.acoes.marcar('livre', 'cobb', COBB[0]); });
    expect(fechar()).toBe(true);
  });
});

describe('gravar em análise que já é de outro paciente', () => {
  const embrulho = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: new QueryClient() }, children);
  const tentar = async (estado: EstadoSessao, posicao: 'livre' | 'frente') => {
    const acoes = { marcarSalva: vi.fn(), desmarcarSalva: vi.fn() };
    const { result } = renderHook(
      () => useGravarPosicao({ estadoRef: { current: estado }, acoes: acoes as never, paciente: { id: 'p2', nome: 'Ana' }, userId: 'prof-1' }),
      { wrapper: embrulho },
    );
    let retorno: boolean | undefined;
    await act(async () => { retorno = await result.current.salvar(posicao); });
    return { retorno, acoes };
  };

  it('a análise livre recusa com o texto da análise e não grava nem marca nada', async () => {
    avisos.erro.mockReset();
    let e = marcarCobb(comFoto(livre()));
    e = rodar(e, salvaDa(e, 'nota-1', 'p1'));
    const { retorno, acoes } = await tentar(e, 'livre');
    expect(retorno).toBe(false);
    expect(avisos.erro).toHaveBeenCalledWith('Esta análise já foi salva em outro paciente. Comece uma nova análise livre para salvar neste paciente.');
    expect(acoes.marcarSalva).not.toHaveBeenCalled();
  });

  it('a posição da postura continua com o texto de sempre', async () => {
    avisos.erro.mockReset();
    let e = estadoInicial('s', '2026-03-12T13:00:00.000Z');
    e = rodar(e, { tipo: 'foto', posicao: 'frente', foto: fotoFalsa('blob:f'), inclinacao: null });
    e = rodar(e, { tipo: 'marcar', posicao: 'frente', medida: 'ombros', ponto: P(100, 100) }, { tipo: 'marcar', posicao: 'frente', medida: 'ombros', ponto: P(300, 130) });
    e = rodar(e, { tipo: 'salva', posicao: 'frente', notaId: 'nota-f', pacienteId: 'p1', sessaoId: e.id, item: e.itens.frente });
    const { retorno } = await tentar(e, 'frente');
    expect(retorno).toBe(false);
    expect(avisos.erro).toHaveBeenCalledWith('Esta sessão já tem posições salvas de outro paciente. Reinicie a sessão para salvar neste paciente.');
  });
});
