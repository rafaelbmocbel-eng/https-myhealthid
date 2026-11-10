import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  ajustadasDoItem, algoPreenchido, estadoDaAba, estadoInicial, idsAplicaveis, ordemNaSessao, pacienteDaSessao, previstasEfetivas, proximaPosicao, reducerSessao,
  resumoDoItem, temMarcacao, temNaoSalva, usouSugestao, useSessaoPostural,
  type AcaoSessao, type EstadoSessao, type FotoDaPosicao, type SugestaoGuardada,
} from '@/hooks/useSessaoPostural';
import type { VistaSessao } from '@/lib/angular/tiposSessao';

// Fotos e pontos escritos à mão: a conferência é com a regra (geometria conhecida), não com a fórmula do código.
const fotoFalsa = (url = 'blob:a', w = 1000, h = 1500): FotoDaPosicao => ({ url, w, h, img: document.createElement('img') });
const novo = (): EstadoSessao => estadoInicial('sessao-1', '2026-03-12T13:00:00.000Z');
const rodar = (e: EstadoSessao, ...acoes: AcaoSessao[]) => acoes.reduce(reducerSessao, e);
const sugestao = (extra: Partial<SugestaoGuardada> = {}): SugestaoGuardada => ({ avisos: [], descartados: [], origens: {}, marcadas: 0, ...extra });
// A gravação termina com o estado em que a nota foi montada: o item daquele momento e o id da sessão.
const salva = (e: EstadoSessao, posicao: VistaSessao, notaId: string, pacienteId: string): AcaoSessao => ({ tipo: 'salva', posicao, notaId, pacienteId, sessaoId: e.id, item: e.itens[posicao] });

// Ombros: o primeiro ponto é o direito do paciente; 30 px de queda em 200 px de largura = atan(0,15) = 8,53°.
const OMBROS = [{ x: 100, y: 100 }, { x: 300, y: 130 }];

describe('estado inicial da sessão', () => {
  it('tem as quatro posições vazias, na ordem de fotografar, começando na frente', () => {
    const e = novo();
    expect(e.previstas).toEqual(['frente', 'perfil_d', 'perfil_e', 'costas']);
    expect(e.atual).toBe('frente');
    expect(e.visao).toBe('posicao');
    for (const p of e.previstas) {
      expect(e.itens[p].foto).toBeNull();
      expect(e.itens[p].pontos).toEqual({});
      expect(e.itens[p].notaId).toBeNull();
      expect(e.itens[p].salva).toBe(false);
    }
  });

  it('o "olha para" do perfil direito é a direita da imagem e o do esquerdo a esquerda; frente e costas ficam no padrão', () => {
    const e = novo();
    expect(e.itens.perfil_d.olhaPara).toBe('direita');
    expect(e.itens.perfil_e.olhaPara).toBe('esquerda');
    expect(e.itens.frente.olhaPara).toBe('direita');
    expect(e.itens.costas.olhaPara).toBe('direita');
  });

  it('as previstas são uma cópia: mexer nelas não muda o padrão das próximas sessões', () => {
    const a = novo();
    a.previstas.pop();
    expect(novo().previstas).toHaveLength(4);
  });
});

describe('uma posição não mexe nas outras', () => {
  it('foto, pontos e referências ficam só na posição alvo', () => {
    let e = rodar(novo(), { tipo: 'foto', posicao: 'frente', foto: fotoFalsa('blob:f'), inclinacao: null }, { tipo: 'foto', posicao: 'perfil_d', foto: fotoFalsa('blob:pd'), inclinacao: 2 });
    e = rodar(e, { tipo: 'marcar', posicao: 'frente', medida: 'ombros', ponto: OMBROS[0] });
    expect(e.itens.frente.pontos.ombros).toEqual([OMBROS[0]]);
    expect(e.itens.perfil_d.pontos).toEqual({});
    expect(e.itens.perfil_d.inclinacaoCaptura).toBe(2);
    expect(e.itens.frente.inclinacaoCaptura).toBeNull();
    expect(e.itens.costas.foto).toBeNull();
    expect(e.itens.costas.pontos).toEqual({});
    expect(e.itens.perfil_e.foto).toBeNull();
  });

  it('trocar de aba só muda a posição atual e preserva as demais por identidade', () => {
    const base = rodar(novo(), { tipo: 'foto', posicao: 'frente', foto: fotoFalsa(), inclinacao: null }, { tipo: 'marcar', posicao: 'frente', medida: 'ombros', ponto: OMBROS[0] });
    const depois = rodar(base, { tipo: 'ir', posicao: 'costas' });
    expect(depois.atual).toBe('costas');
    expect(depois.itens).toBe(base.itens);
  });

  it('ir para a posição em que já está, na própria posição, não gera estado novo', () => {
    const e = novo();
    expect(rodar(e, { tipo: 'ir', posicao: 'frente' })).toBe(e);
  });

  it('abrir o resumo e voltar para uma posição alternam a visão', () => {
    const e = rodar(novo(), { tipo: 'resumo' });
    expect(e.visao).toBe('resumo');
    expect(rodar(e, { tipo: 'ir', posicao: 'perfil_e' })).toMatchObject({ visao: 'posicao', atual: 'perfil_e' });
  });

  it('trocar a foto apaga só os pontos da posição, mas guarda a nota já gravada para atualizá-la', () => {
    let e = rodar(novo(), { tipo: 'foto', posicao: 'frente', foto: fotoFalsa('blob:1'), inclinacao: null });
    e = rodar(e, { tipo: 'marcar', posicao: 'frente', medida: 'ombros', ponto: OMBROS[0] });
    e = rodar(e, salva(e, 'frente', 'nota-1', 'p1'));
    const outra = rodar(e, { tipo: 'foto', posicao: 'perfil_d', foto: fotoFalsa('blob:2'), inclinacao: null }, { tipo: 'marcar', posicao: 'perfil_d', medida: 'joelho', ponto: OMBROS[1] });
    const trocada = rodar(outra, { tipo: 'foto', posicao: 'frente', foto: fotoFalsa('blob:3'), inclinacao: 1.5 });
    expect(trocada.itens.frente.pontos).toEqual({});
    expect(trocada.itens.frente.foto?.url).toBe('blob:3');
    expect(trocada.itens.frente.inclinacaoCaptura).toBe(1.5);
    expect(trocada.itens.frente.salva).toBe(false);
    expect(trocada.itens.frente.notaId).toBe('nota-1');
    expect(trocada.itens.frente.notaPaciente).toBe('p1');
    expect(trocada.itens.perfil_d.pontos.joelho).toEqual([OMBROS[1]]);
  });

  it('a foto nova tira a posição de "pulada"', () => {
    const e = rodar(novo(), { tipo: 'pular', posicao: 'costas' }, { tipo: 'foto', posicao: 'costas', foto: fotoFalsa(), inclinacao: null });
    expect(e.itens.costas.pulada).toBe(false);
  });
});

describe('pontos e medidas ajustadas à mão', () => {
  const comSugestao = () => rodar(
    novo(),
    { tipo: 'foto', posicao: 'frente', foto: fotoFalsa(), inclinacao: null },
  );
  const aplicarSugestao = (e: EstadoSessao, pontos: Record<string, { x: number; y: number }[]>, modo: 'vazias' | 'todas' | 'substituiveis' = 'vazias'): EstadoSessao =>
    rodar(e, { tipo: 'sugestao', posicao: 'frente', img: e.itens.frente.foto!.img, pontos, modo, sugestao: sugestao() });

  it('arrastar um ponto de medida sugerida marca a medida como ajustada; arrastar medida manual, não', () => {
    let e = aplicarSugestao(comSugestao(), { ombros: OMBROS });
    e = rodar(e, { tipo: 'marcar', posicao: 'frente', medida: 'pelve', ponto: { x: 5, y: 5 } }, { tipo: 'marcar', posicao: 'frente', medida: 'pelve', ponto: { x: 15, y: 5 } });
    expect(e.itens.frente.ajustadas).toEqual([]);
    e = rodar(e, { tipo: 'arrastar', posicao: 'frente', medida: 'pelve', indice: 1, ponto: { x: 20, y: 9 } });
    expect(e.itens.frente.ajustadas).toEqual([]);
    expect(e.itens.frente.pontos.pelve[1]).toEqual({ x: 20, y: 9 });
    e = rodar(e, { tipo: 'arrastar', posicao: 'frente', medida: 'ombros', indice: 0, ponto: { x: 110, y: 100 } });
    expect(e.itens.frente.ajustadas).toEqual(['ombros']);
    expect(e.itens.frente.pontos.ombros).toEqual([{ x: 110, y: 100 }, OMBROS[1]]);
    expect(e.itens.frente.salva).toBe(false);
  });

  it('arrastar de novo a mesma medida não repete o id', () => {
    let e = aplicarSugestao(comSugestao(), { ombros: OMBROS });
    e = rodar(e, { tipo: 'arrastar', posicao: 'frente', medida: 'ombros', indice: 0, ponto: { x: 1, y: 1 } }, { tipo: 'arrastar', posicao: 'frente', medida: 'ombros', indice: 1, ponto: { x: 2, y: 2 } });
    expect(e.itens.frente.ajustadas).toEqual(['ombros']);
  });

  it('completar com um ponto novo uma sugestão parcial não conta como ajuste, mas desfazer e limpar contam', () => {
    let e = aplicarSugestao(comSugestao(), { cva: [{ x: 10, y: 10 }] });
    e = rodar(e, { tipo: 'marcar', posicao: 'frente', medida: 'cva', ponto: { x: 30, y: 12 } });
    expect(e.itens.frente.ajustadas).toEqual([]);
    const desfeito = rodar(e, { tipo: 'desfazer', posicao: 'frente', medida: 'cva' });
    expect(desfeito.itens.frente.ajustadas).toEqual(['cva']);
    expect(desfeito.itens.frente.pontos.cva).toEqual([{ x: 10, y: 10 }]);
    const limpo = rodar(e, { tipo: 'limpar', posicao: 'frente', medida: 'cva' });
    expect(limpo.itens.frente.ajustadas).toEqual(['cva']);
    expect(limpo.itens.frente.pontos.cva).toEqual([]);
  });

  it('ajustadasDoItem só lista medidas ainda com pontos, e limpar tudo faz o método voltar a ser manual', () => {
    let e = aplicarSugestao(comSugestao(), { ombros: OMBROS });
    expect(usouSugestao(e.itens.frente)).toBe(true);
    e = rodar(e, { tipo: 'limpar', posicao: 'frente', medida: 'ombros' });
    expect(ajustadasDoItem(e.itens.frente)).toEqual([]);
    expect(usouSugestao(e.itens.frente)).toBe(false);
    e = rodar(e, { tipo: 'marcar', posicao: 'frente', medida: 'ombros', ponto: OMBROS[0] }, { tipo: 'marcar', posicao: 'frente', medida: 'ombros', ponto: OMBROS[1] });
    // Refeita à mão depois de sugerida: continua contando como sugerida e ajustada.
    expect(usouSugestao(e.itens.frente)).toBe(true);
    expect(ajustadasDoItem(e.itens.frente)).toEqual(['ombros']);
  });

  it('arrastar um ponto que não existe não muda nada', () => {
    const e = aplicarSugestao(comSugestao(), { ombros: OMBROS });
    expect(rodar(e, { tipo: 'arrastar', posicao: 'frente', medida: 'ombros', indice: 5, ponto: { x: 0, y: 0 } })).toBe(e);
    expect(rodar(e, { tipo: 'arrastar', posicao: 'frente', medida: 'pelve', indice: 0, ponto: { x: 0, y: 0 } })).toBe(e);
  });

  it('marcar e editar referências desmarcam "salva"', () => {
    let e = rodar(comSugestao(), { tipo: 'marcar', posicao: 'frente', medida: 'ombros', ponto: OMBROS[0] });
    e = rodar(e, salva(e, 'frente', 'n', 'p'));
    expect(e.itens.frente.salva).toBe(true);
    e = rodar(e, { tipo: 'editar', posicao: 'frente', mudanca: { escalaCm: '50' } });
    expect(e.itens.frente.salva).toBe(false);
    expect(e.itens.frente.notaId).toBe('n');
  });

  it('trocar a medida ativa não desmarca "salva"', () => {
    let e = comSugestao();
    e = rodar(e, salva(e, 'frente', 'n', 'p'));
    e = rodar(e, { tipo: 'ativar', posicao: 'frente', medida: 'pelve' });
    expect(e.itens.frente.salva).toBe(true);
    expect(e.itens.frente.ativa).toBe('pelve');
  });
});

describe('sugestão automática (aplicar com cuidado)', () => {
  const base = () => rodar(novo(), { tipo: 'foto', posicao: 'perfil_d', foto: fotoFalsa('blob:pd'), inclinacao: null });
  const sug = (e: EstadoSessao, pontos: Record<string, { x: number; y: number }[]>, modo: 'vazias' | 'todas' | 'substituiveis', extra: Partial<Extract<AcaoSessao, { tipo: 'sugestao' }>> = {}) =>
    rodar(e, { tipo: 'sugestao', posicao: 'perfil_d', img: e.itens.perfil_d.foto!.img, pontos, modo, sugestao: sugestao({ avisos: ['Confira o lado'] }), ...extra });

  it('o modo "vazias" nunca sobrescreve uma medida que já tem pontos', () => {
    let e = rodar(base(), { tipo: 'marcar', posicao: 'perfil_d', medida: 'joelho', ponto: { x: 1, y: 2 } });
    e = sug(e, { joelho: [{ x: 9, y: 9 }, { x: 8, y: 8 }, { x: 7, y: 7 }], 'tronco-perfil': [{ x: 3, y: 3 }, { x: 4, y: 4 }] }, 'vazias');
    expect(e.itens.perfil_d.pontos.joelho).toEqual([{ x: 1, y: 2 }]);
    expect(e.itens.perfil_d.pontos['tronco-perfil']).toEqual([{ x: 3, y: 3 }, { x: 4, y: 4 }]);
    expect(e.itens.perfil_d.sugeridas).toEqual(['tronco-perfil']);
  });

  it('o modo "todas" troca também as medidas com pontos e zera o ajuste delas', () => {
    let e = sug(base(), { joelho: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }] }, 'vazias');
    e = rodar(e, { tipo: 'arrastar', posicao: 'perfil_d', medida: 'joelho', indice: 0, ponto: { x: 5, y: 5 } });
    expect(e.itens.perfil_d.ajustadas).toEqual(['joelho']);
    e = sug(e, { joelho: [{ x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 30 }] }, 'todas');
    expect(e.itens.perfil_d.pontos.joelho[0]).toEqual({ x: 10, y: 10 });
    expect(e.itens.perfil_d.ajustadas).toEqual([]);
  });

  it('o modo "substituiveis" (inverter D/E) refaz só o que ainda é pura sugestão e preserva o que o profissional ajustou ou marcou', () => {
    let e = sug(base(), { joelho: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }], 'tronco-perfil': [{ x: 1, y: 1 }, { x: 2, y: 2 }] }, 'vazias');
    e = rodar(e, { tipo: 'arrastar', posicao: 'perfil_d', medida: 'joelho', indice: 0, ponto: { x: 5, y: 5 } });
    e = rodar(e, { tipo: 'marcar', posicao: 'perfil_d', medida: 'livre', ponto: { x: 50, y: 50 } });
    e = sug(e, { joelho: [{ x: 100, y: 100 }, { x: 101, y: 101 }, { x: 102, y: 102 }], 'tronco-perfil': [{ x: 7, y: 7 }, { x: 8, y: 8 }], livre: [{ x: 9, y: 9 }, { x: 9, y: 9 }, { x: 9, y: 9 }] }, 'substituiveis', { inverterDE: true });
    expect(e.itens.perfil_d.pontos.joelho[0]).toEqual({ x: 5, y: 5 });
    expect(e.itens.perfil_d.pontos['tronco-perfil']).toEqual([{ x: 7, y: 7 }, { x: 8, y: 8 }]);
    expect(e.itens.perfil_d.pontos.livre).toEqual([{ x: 50, y: 50 }]);
    expect(e.itens.perfil_d.inverterDE).toBe(true);
  });

  it('o resultado de uma foto que já foi trocada é descartado (o estado não muda)', () => {
    const e = base();
    const imgAntiga = e.itens.perfil_d.foto!.img;
    const trocada = rodar(e, { tipo: 'foto', posicao: 'perfil_d', foto: fotoFalsa('blob:nova'), inclinacao: null });
    const depois = rodar(trocada, { tipo: 'sugestao', posicao: 'perfil_d', img: imgAntiga, pontos: { joelho: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }] }, modo: 'vazias', sugestao: sugestao() });
    expect(depois).toBe(trocada);
  });

  it('sem foto na posição a sugestão também é ignorada', () => {
    const e = novo();
    const img = document.createElement('img');
    expect(rodar(e, { tipo: 'sugestao', posicao: 'costas', img, pontos: { ombros: OMBROS }, modo: 'todas' })).toBe(e);
  });

  it('guarda os pontos do modelo, os avisos e quantas medidas foram marcadas; a medida ativa vira a primeira aplicada', () => {
    const lm = [{ x: 0.5, y: 0.5, visibility: 0.9 }];
    const e = sug(base(), { 'tronco-perfil': [{ x: 1, y: 1 }, { x: 2, y: 2 }], joelho: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }] }, 'vazias', { landmarks: lm, ativar: 'joelho', olhaPara: 'esquerda' });
    const it = e.itens.perfil_d;
    expect(it.landmarks).toBe(lm);
    expect(it.sugestao).toMatchObject({ avisos: ['Confira o lado'], marcadas: 2 });
    expect(it.ativa).toBe('joelho');
    expect(it.olhaPara).toBe('esquerda');
    expect(it.salva).toBe(false);
  });

  it('uma sugestão vazia (nada para aplicar) guarda o aviso mas não desmarca "salva" nem muda a medida ativa', () => {
    let e = base();
    e = rodar(e, salva(e, 'perfil_d', 'n', 'p'), { tipo: 'ativar', posicao: 'perfil_d', medida: 'livre' });
    e = sug(e, {}, 'vazias');
    expect(e.itens.perfil_d.salva).toBe(true);
    expect(e.itens.perfil_d.ativa).toBe('livre');
    expect(e.itens.perfil_d.sugestao?.avisos).toEqual(['Confira o lado']);
  });

  it('idsAplicaveis conta igual para a tela e para o reducer', () => {
    let e = sug(base(), { joelho: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }] }, 'vazias');
    e = rodar(e, { tipo: 'marcar', posicao: 'perfil_d', medida: 'livre', ponto: { x: 1, y: 1 } });
    const item = e.itens.perfil_d;
    expect(idsAplicaveis(item, ['joelho', 'livre', 'cva'], 'vazias')).toEqual(['cva']);
    expect(idsAplicaveis(item, ['joelho', 'livre', 'cva'], 'todas')).toEqual(['joelho', 'livre', 'cva']);
    expect(idsAplicaveis(item, ['joelho', 'livre', 'cva'], 'substituiveis')).toEqual(['joelho', 'cva']);
  });
});

describe('salvar, pular e andar pela sessão', () => {
  it('"salva" guarda a nota e o paciente; mexer depois desmarca "salva" mas mantém a nota', () => {
    let e = rodar(novo(), { tipo: 'foto', posicao: 'costas', foto: fotoFalsa(), inclinacao: null }, { tipo: 'marcar', posicao: 'costas', medida: 'ombros', ponto: OMBROS[0] });
    expect(estadoDaAba(e.itens.costas)).toBe('marcando');
    e = rodar(e, salva(e, 'costas', 'nota-9', 'paciente-3'));
    expect(estadoDaAba(e.itens.costas)).toBe('salva');
    expect(pacienteDaSessao(e)).toBe('paciente-3');
    e = rodar(e, { tipo: 'marcar', posicao: 'costas', medida: 'ombros', ponto: OMBROS[1] });
    expect(estadoDaAba(e.itens.costas)).toBe('marcando');
    expect(e.itens.costas.notaId).toBe('nota-9');
  });

  it('"salva" de uma gravação que começou em outra sessão não vale: o estado fica como está, sem a nota na sessão nova', () => {
    const antiga = rodar(novo(), { tipo: 'foto', posicao: 'frente', foto: fotoFalsa(), inclinacao: null }, { tipo: 'marcar', posicao: 'frente', medida: 'ombros', ponto: OMBROS[0] });
    const gravacao = salva(antiga, 'frente', 'nota-antiga', 'p1');
    const nova = rodar(antiga, { tipo: 'reiniciar', id: 'sessao-2', iniciadaEm: '2026-03-13T10:00:00.000Z' });
    expect(rodar(nova, gravacao)).toBe(nova);
    const comFoto = rodar(nova, { tipo: 'foto', posicao: 'frente', foto: fotoFalsa('blob:n'), inclinacao: null });
    const depois = rodar(comFoto, gravacao);
    expect(depois).toBe(comFoto);
    expect(depois.itens.frente.notaId).toBeNull();
    expect(pacienteDaSessao(depois)).toBeNull();
  });

  it('"salva" de uma gravação em que o item mudou no meio guarda a nota (para o próximo "Atualizar" não duplicar), mas a posição segue não salva', () => {
    let e = rodar(novo(), { tipo: 'foto', posicao: 'frente', foto: fotoFalsa(), inclinacao: null }, { tipo: 'marcar', posicao: 'frente', medida: 'ombros', ponto: OMBROS[0] });
    const gravacao = salva(e, 'frente', 'nota-1', 'p1');
    e = rodar(e, { tipo: 'marcar', posicao: 'frente', medida: 'ombros', ponto: OMBROS[1] });
    e = rodar(e, gravacao);
    expect(e.itens.frente.salva).toBe(false);
    expect(e.itens.frente.notaId).toBe('nota-1');
    expect(e.itens.frente.notaPaciente).toBe('p1');
    expect(estadoDaAba(e.itens.frente)).toBe('marcando');
    expect(temNaoSalva(e)).toBe(true);
    expect(pacienteDaSessao(e)).toBe('p1');
    expect(e.itens.frente.pontos.ombros).toEqual(OMBROS);
  });

  it('"salva" com o item como foi gravado marca a posição como salva; a gravação de outra posição não interfere', () => {
    let e = rodar(novo(), { tipo: 'foto', posicao: 'frente', foto: fotoFalsa(), inclinacao: null }, { tipo: 'foto', posicao: 'costas', foto: fotoFalsa('blob:c'), inclinacao: null });
    e = rodar(e, { tipo: 'marcar', posicao: 'frente', medida: 'ombros', ponto: OMBROS[0] }, { tipo: 'marcar', posicao: 'costas', medida: 'ombros', ponto: OMBROS[1] });
    const frente = salva(e, 'frente', 'nota-f', 'p1');
    e = rodar(e, { tipo: 'marcar', posicao: 'costas', medida: 'ombros', ponto: OMBROS[0] }, frente);
    expect(e.itens.frente.salva).toBe(true);
    expect(e.itens.costas.salva).toBe(false);
    expect(e.itens.costas.notaId).toBeNull();
  });

  it('"nao_salva" tira a marca de salva da posição (e só dela), mantendo a nota; de outra sessão é ignorada', () => {
    let e = rodar(novo(), { tipo: 'foto', posicao: 'frente', foto: fotoFalsa(), inclinacao: null }, { tipo: 'marcar', posicao: 'frente', medida: 'ombros', ponto: OMBROS[0] });
    e = rodar(e, salva(e, 'frente', 'n', 'p'));
    expect(rodar(e, { tipo: 'nao_salva', posicao: 'frente', sessaoId: 'outra' })).toBe(e);
    expect(rodar(e, { tipo: 'nao_salva', posicao: 'costas', sessaoId: e.id })).toBe(e);
    const depois = rodar(e, { tipo: 'nao_salva', posicao: 'frente', sessaoId: e.id });
    expect(depois.itens.frente.salva).toBe(false);
    expect(depois.itens.frente.notaId).toBe('n');
    expect(temNaoSalva(depois)).toBe(true);
  });

  it('estado das abas: sem foto, marcando, salva e pulada', () => {
    const e = rodar(novo(), { tipo: 'foto', posicao: 'frente', foto: fotoFalsa(), inclinacao: null }, { tipo: 'pular', posicao: 'costas' });
    expect(estadoDaAba(e.itens.frente)).toBe('marcando');
    expect(estadoDaAba(e.itens.perfil_d)).toBe('sem_foto');
    expect(estadoDaAba(e.itens.costas)).toBe('pulada');
  });

  it('não dá para pular uma posição que já tem foto', () => {
    const e = rodar(novo(), { tipo: 'foto', posicao: 'frente', foto: fotoFalsa(), inclinacao: null });
    expect(rodar(e, { tipo: 'pular', posicao: 'frente' })).toBe(e);
  });

  it('a próxima posição é a seguinte da ordem sem foto e sem pulo, voltando ao início se preciso', () => {
    let e = novo();
    expect(proximaPosicao(e)).toBe('perfil_d');
    e = rodar(e, { tipo: 'foto', posicao: 'perfil_d', foto: fotoFalsa(), inclinacao: null });
    expect(proximaPosicao(e, 'frente')).toBe('perfil_e');
    e = rodar(e, { tipo: 'pular', posicao: 'perfil_e' });
    expect(proximaPosicao(e, 'frente')).toBe('costas');
    expect(proximaPosicao(e, 'costas')).toBe('frente');
    e = rodar(e, { tipo: 'foto', posicao: 'frente', foto: fotoFalsa('blob:f'), inclinacao: null });
    expect(proximaPosicao(e, 'frente')).toBe('costas');
    e = rodar(e, { tipo: 'foto', posicao: 'costas', foto: fotoFalsa('blob:c'), inclinacao: null });
    expect(proximaPosicao(e, 'costas')).toBeNull();
  });

  it('a próxima posição ignora as que estão com a foto ainda sendo preparada', () => {
    const e = novo();
    expect(proximaPosicao(e, 'frente', ['perfil_d'])).toBe('perfil_e');
    expect(proximaPosicao(e, 'frente', ['perfil_d', 'perfil_e', 'costas'])).toBeNull();
  });

  it('a numeração "n de total" pula as posições puladas', () => {
    const e = rodar(novo(), { tipo: 'pular', posicao: 'perfil_e' });
    expect(previstasEfetivas(e)).toEqual(['frente', 'perfil_d', 'costas']);
    expect(ordemNaSessao(e, 'costas')).toEqual({ ordem: 3, total: 3 });
    expect(ordemNaSessao(novo(), 'perfil_d')).toEqual({ ordem: 2, total: 4 });
    const so = rodar(novo(), { tipo: 'pular', posicao: 'perfil_d' }, { tipo: 'pular', posicao: 'perfil_e' }, { tipo: 'pular', posicao: 'costas' });
    expect(ordemNaSessao(so, 'frente')).toEqual({ ordem: 1, total: 1 });
  });

  it('há marcação não salva só com foto e pontos ainda não gravados', () => {
    let e = rodar(novo(), { tipo: 'foto', posicao: 'frente', foto: fotoFalsa(), inclinacao: null });
    expect(algoPreenchido(e)).toBe(true);
    expect(temNaoSalva(e)).toBe(false);
    e = rodar(e, { tipo: 'marcar', posicao: 'frente', medida: 'ombros', ponto: OMBROS[0] });
    expect(temMarcacao(e.itens.frente)).toBe(true);
    expect(temNaoSalva(e)).toBe(true);
    e = rodar(e, salva(e, 'frente', 'n', 'p'));
    expect(temNaoSalva(e)).toBe(false);
  });

  it('reiniciar começa outra sessão: novo id e data, nada das fotos, e as opções de compasso e fio continuam', () => {
    let e = rodar(novo(), { tipo: 'foto', posicao: 'frente', foto: fotoFalsa(), inclinacao: null }, { tipo: 'opcoes', compassoRef: 'cima', unidadePrumo: 'cm' });
    e = rodar(e, salva(e, 'frente', 'n', 'p'));
    e = rodar(e, { tipo: 'reiniciar', id: 'sessao-2', iniciadaEm: '2026-03-13T10:00:00.000Z' });
    expect(e.id).toBe('sessao-2');
    expect(e.iniciadaEm).toBe('2026-03-13T10:00:00.000Z');
    expect(e.atual).toBe('frente');
    expect(algoPreenchido(e)).toBe(false);
    expect(pacienteDaSessao(e)).toBeNull();
    expect(e.compassoRef).toBe('cima');
    expect(e.unidadePrumo).toBe('cm');
  });
});

describe('o que se calcula de cada posição', () => {
  const comPontos = (posicao: 'frente' | 'perfil_d', pontos: Record<string, { x: number; y: number }[]>, extra: Partial<Extract<AcaoSessao, { tipo: 'editar' }>['mudanca']> = {}) => {
    let e = rodar(novo(), { tipo: 'foto', posicao, foto: fotoFalsa('blob:x', 1000, 1500), inclinacao: null });
    for (const [medida, lista] of Object.entries(pontos)) for (const ponto of lista) e = rodar(e, { tipo: 'marcar', posicao, medida, ponto });
    if (Object.keys(extra).length) e = rodar(e, { tipo: 'editar', posicao, mudanca: extra });
    return { e, resumo: resumoDoItem(e.itens[posicao], posicao, e.compassoRef, e.unidadePrumo) };
  };

  it('os ombros marcados viram a medida de 8,5° com o lado direito mais alto', () => {
    const { resumo } = comPontos('frente', { ombros: OMBROS });
    const m = resumo.medidas.find((x) => x.id === 'ombros');
    expect(m?.graus).toBe(8.5);
    expect(m?.texto).toMatch(/direito mais alto/);
    expect(resumo.temResultado).toBe(true);
    expect(resumo.temMarcacao).toBe(true);
    expect(resumo.usouIA).toBe(false);
  });

  it('a análise do perfil direito leva o lado D; a de frente não leva lado', () => {
    const pd = comPontos('perfil_d', { 'tronco-perfil': [{ x: 100, y: 100 }, { x: 110, y: 200 }] }).resumo;
    expect(pd.analise.vista).toBe('perfil');
    expect(pd.analise.lado).toBe('D');
    expect(pd.analise.opcoes.olhaPara).toBe('direita');
    const fr = comPontos('frente', { ombros: OMBROS }).resumo;
    expect(fr.analise.vista).toBe('frente');
    expect('lado' in fr.analise).toBe(false);
  });

  it('o sensor do celular dá a correção de nível e o sentido pode ser invertido', () => {
    const a = comPontos('frente', { ombros: OMBROS }, { inclinacaoCaptura: 3 }).resumo;
    expect(a.giro).toBe(-3);
    expect(a.giroSensor).toBe(-3);
    expect(a.giroMarcado).toBeNull();
    expect(a.notaNivel).toContain('correção de 3,0°');
    expect(a.notaNivel).toContain('Foto nivelada pelo sensor do celular ao fotografar (correção de 3,0°)');
    expect(a.notaNivel).not.toMatch(/\bpor o\b/);
    const b = comPontos('frente', { ombros: OMBROS }, { inclinacaoCaptura: 3, inverterSensor: true }).resumo;
    expect(b.giro).toBe(3);
  });

  it('uma referência de nível marcada na foto vale mais que o sensor (reta de 100 px por 10 px = 5,7°)', () => {
    const r = comPontos('frente', { ombros: OMBROS, nivel: [{ x: 0, y: 0 }, { x: 100, y: 10 }] }, { inclinacaoCaptura: 3 }).resumo;
    expect(r.giroMarcado).toBeCloseTo(5.7106, 3);
    expect(r.giro).toBeCloseTo(5.7106, 3);
    expect(r.notaNivel).toContain('Foto nivelada por uma referência marcada na foto (correção de 5,7°)');
    expect(r.notaNivel).toContain('correção de 5,7°');
  });

  it('sem correção a nota de nível não existe', () => {
    expect(comPontos('frente', { ombros: OMBROS }).resumo.notaNivel).toBeUndefined();
  });

  it('a escala em cm usa os pontos da própria foto e aceita vírgula decimal (50 cm em 100 px = 0,5 cm/px)', () => {
    const escala = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    expect(comPontos('frente', { ombros: OMBROS, escala }, { escalaCm: '50' }).resumo.cmPorPx).toBe(0.5);
    expect(comPontos('frente', { ombros: OMBROS, escala }, { escalaCm: '50,5' }).resumo.cmPorPx).toBe(0.505);
    expect(comPontos('frente', { ombros: OMBROS, escala }, { escalaCm: '' }).resumo.cmPorPx).toBeNull();
    expect(comPontos('frente', { ombros: OMBROS, escala }, { escalaCm: 'abc' }).resumo.cmPorPx).toBeNull();
  });

  it('com a escala, o desnível dos ombros também sai em cm (30 px de queda a 0,5 cm/px = 15 cm... em módulo)', () => {
    const escala = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const r = comPontos('frente', { ombros: OMBROS, escala }, { escalaCm: '50' }).resumo;
    const cm = r.medidas.find((m) => m.id === 'ombros-cm');
    expect(cm).toMatchObject({ unidade: 'cm', graus: 15 });
  });

  it('o resultado é guardado por posição: o mesmo item devolve o mesmo objeto, e um item novo é recalculado', () => {
    const { e, resumo } = comPontos('frente', { ombros: OMBROS });
    expect(resumoDoItem(e.itens.frente, 'frente', e.compassoRef, e.unidadePrumo)).toBe(resumo);
    const outro = rodar(e, { tipo: 'marcar', posicao: 'frente', medida: 'pelve', ponto: { x: 1, y: 1 } });
    expect(resumoDoItem(outro.itens.frente, 'frente', e.compassoRef, e.unidadePrumo)).not.toBe(resumo);
    expect(resumoDoItem(e.itens.frente, 'frente', 'cima', e.unidadePrumo)).not.toBe(resumo);
  });

  it('a posição sem medida completa não tem resultado', () => {
    const { resumo } = comPontos('frente', { ombros: [OMBROS[0]] });
    expect(resumo.temResultado).toBe(false);
    expect(resumo.temMarcacao).toBe(true);
  });
});

describe('hook da sessão', () => {
  let revogadas: string[];
  beforeEach(() => {
    revogadas = [];
    vi.stubGlobal('URL', Object.assign(URL, { revokeObjectURL: (u: string) => { revogadas.push(u); }, createObjectURL: () => 'blob:nada' }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('revoga a URL da foto trocada, a de todas ao reiniciar e as que sobram ao desmontar', () => {
    const { result, unmount } = renderHook(() => useSessaoPostural());
    act(() => { result.current.acoes.definirFoto('frente', fotoFalsa('blob:f1')); });
    act(() => { result.current.acoes.definirFoto('costas', fotoFalsa('blob:c1')); });
    expect(revogadas).toEqual([]);
    act(() => { result.current.acoes.definirFoto('frente', fotoFalsa('blob:f2')); });
    expect(revogadas).toEqual(['blob:f1']);
    act(() => { result.current.acoes.reiniciar(); });
    expect([...revogadas].sort()).toEqual(['blob:c1', 'blob:f1', 'blob:f2']);
    act(() => { result.current.acoes.definirFoto('perfil_d', fotoFalsa('blob:pd')); });
    unmount();
    expect(revogadas).toContain('blob:pd');
    expect(revogadas.filter((u) => u === 'blob:pd')).toHaveLength(1);
  });

  it('avisa ao fechar a página só enquanto há marcação não salva', () => {
    const { result } = renderHook(() => useSessaoPostural());
    const fechar = () => { const ev = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(ev); return ev.defaultPrevented; };
    expect(fechar()).toBe(false);
    act(() => { result.current.acoes.definirFoto('frente', fotoFalsa('blob:f')); });
    expect(fechar()).toBe(false);
    act(() => { result.current.acoes.marcar('frente', 'ombros', OMBROS[0]); });
    expect(fechar()).toBe(true);
    act(() => { result.current.acoes.marcarSalva({ posicao: 'frente', notaId: 'nota-1', pacienteId: 'p1', sessaoId: result.current.estado.id, item: result.current.estado.itens.frente }); });
    expect(fechar()).toBe(false);
    act(() => { result.current.acoes.marcar('frente', 'ombros', OMBROS[1]); });
    expect(fechar()).toBe(true);
  });

  it('tira o aviso de fechar a página ao desmontar', () => {
    const { result, unmount } = renderHook(() => useSessaoPostural());
    act(() => { result.current.acoes.definirFoto('frente', fotoFalsa('blob:f')); result.current.acoes.marcar('frente', 'ombros', OMBROS[0]); });
    unmount();
    const ev = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('cada sessão nova tem id próprio e o hook entrega o resultado da posição atual e de todas', () => {
    const { result } = renderHook(() => useSessaoPostural());
    const primeiro = result.current.estado.id;
    expect(primeiro).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    act(() => { result.current.acoes.definirFoto('perfil_e', fotoFalsa('blob:pe')); result.current.acoes.ir('perfil_e'); });
    for (const p of ['frente', 'perfil_d', 'perfil_e', 'costas'] as const) expect(result.current.resumos[p]).toBeDefined();
    expect(result.current.resumo.analise.lado).toBe('E');
    act(() => { result.current.acoes.reiniciar(); });
    expect(result.current.estado.id).not.toBe(primeiro);
  });
});
