import { describe, expect, it } from 'vitest';
import { configurar, poseSintetica, trilhaSintetica as trilhaDaFigura, type GestoSintetico } from '../lib/angular/video/figuraSintetica';
import { trilhaVazia, MAX_QUADROS_SEM_RASTREIO } from '../lib/angular/analiseVideo/trilhaVazia';
import { landmarksDoRosto } from '../lib/angular/video/rostoPorQuadro';
import {
  LIGACOES_CORPO, marcacaoDoAngulo, marcacoesDoQuadro, pontosDasDefinicoes, pontosParaTela, quadroComPontos, rotuloDoPonto,
} from '../lib/angular/analiseVideo/marcacoes';
import {
  bandasDoGrupo, cartoesDeMetricas, eventoParaUi, formatarMetrica, gruposDeArticulacoes, grupoInicial, marcadoresDeEventos, marcadoresExtras, modeloParaUi, seriesDoGrupo, seriesDoGrupoDaAnalise,
} from '../lib/angular/analiseVideo/resultados';
import { analisarGesto } from '../lib/angular/video/metricas';
import { anguloJoelho, calcularAnguloNoQuadro, elevacaoBraco, inclinacaoTronco } from '../lib/angular/video/angulos';
import { MODELOS_GESTO, modeloDoGesto } from '../lib/angular/video/modelos';
import type { ReferenciaBiomecanica } from '../lib/angular/video/referencias';
import { caixaDoRostoPorLandmarks } from '../lib/social/rosto';
import { corrigirPonto } from '../lib/angular/video/correcao';

const W = 640, H = 480;
const trilhaSintetica = (gesto: GestoSintetico, fps = 30, dur = 6) => trilhaDaFigura(configurar(gesto), fps, dur);
const verdadeEm = (gesto: GestoSintetico, t: number) => poseSintetica(configurar(gesto), t).verdade;

describe('trilha sem rastreio e pontos do rosto', () => {
  it('a trilha vazia tem um quadro por 1/fps dentro do trecho', () => {
    const t = trilhaVazia(30, 2, 5, 640, 480);
    expect(t.quadros).toHaveLength(91);
    expect(t.quadros[0].t).toBe(2);
    expect(t.quadros[90].t).toBeCloseTo(5, 4);
    expect(Object.keys(t.quadros[10].pontos)).toHaveLength(0);
  });

  it('vídeo de 240 q/s por 30 s não passa do limite de quadros', () => {
    const t = trilhaVazia(240, 0, 30, 640, 480);
    expect(t.quadros.length).toBeLessThanOrEqual(MAX_QUADROS_SEM_RASTREIO);
    expect(t.quadros[t.quadros.length - 1].t).toBeCloseTo(30, 1);
  });

  it('os pontos do quadro viram landmarks que o módulo de rosto entende', () => {
    const t = trilhaSintetica('marcha');
    const lm = landmarksDoRosto(t, 10);
    expect(lm).toHaveLength(33);
    const caixa = caixaDoRostoPorLandmarks(lm, W, H);
    expect(caixa).not.toBeNull();
    const nariz = poseSintetica(configurar('marcha'), 10 / 30).landmarks[0];
    expect(Math.abs(caixa!.cx - nariz.x)).toBeLessThan(0.1);
    expect(caixaDoRostoPorLandmarks(landmarksDoRosto(trilhaVazia(30, 0, 1, W, H), 0), W, H)).toBeNull();
  });
});

describe('ângulos desenhados no quadro', () => {
  const t = trilhaSintetica('marcha');

  it('o ângulo do joelho no quadro é a flexão da figura (verdade conhecida)', () => {
    for (const i of [5, 40, 80, 120]) {
      const verdade = verdadeEm('marcha', i / 30);
      expect(calcularAnguloNoQuadro(anguloJoelho('D'), t.quadros[i], 1)!).toBeCloseTo(verdade.joelho_d, 0);
      expect(calcularAnguloNoQuadro(anguloJoelho('E'), t.quadros[i], 1)!).toBeCloseTo(verdade.joelho_e, 0);
    }
  });

  it('a marcação da flexão tem o vértice no joelho e a referência tracejada na continuação da coxa', () => {
    const q = t.quadros[40];
    const g = calcularAnguloNoQuadro(anguloJoelho('D'), q, 1);
    const m = marcacaoDoAngulo(anguloJoelho('D'), q, g)!;
    expect(m.vertice.x).toBeCloseTo(q.pontos.joelho_d.x, 5);
    expect(m.a.x).toBeCloseTo(q.pontos.tornozelo_d.x, 5);
    expect(m.tracejadoB).toBe(true);
    // O braço tracejado é a continuação da coxa: o ângulo entre ele e a perna é a flexão.
    const u = { x: m.a.x - m.vertice.x, y: m.a.y - m.vertice.y }, w = { x: m.b.x - m.vertice.x, y: m.b.y - m.vertice.y };
    const ang = (Math.acos((u.x * w.x + u.y * w.y) / (Math.hypot(u.x, u.y) * Math.hypot(w.x, w.y))) * 180) / Math.PI;
    expect(ang).toBeCloseTo(Math.abs(g!), 1);
  });

  it('sem ponto utilizável não há marcação (nada é inventado)', () => {
    const q = { ...t.quadros[40], pontos: { ...t.quadros[40].pontos } };
    delete q.pontos.joelho_d;
    expect(marcacaoDoAngulo(anguloJoelho('D'), q, 30)).toBeNull();
    expect(marcacaoDoAngulo(anguloJoelho('D'), q, null)).toBeNull();
    expect(marcacoesDoQuadro([anguloJoelho('D'), anguloJoelho('E')], q, 1)).toHaveLength(1);
  });

  it('inclinação do tronco: referência vertical tracejada sobe do quadril', () => {
    const q = t.quadros[10];
    const m = marcacaoDoAngulo(inclinacaoTronco, q, calcularAnguloNoQuadro(inclinacaoTronco, q, 1))!;
    expect(m.b.x).toBeCloseTo(m.vertice.x, 5);
    expect(m.b.y).toBeLessThan(m.vertice.y);
  });

  it('elevação do braço (vista frontal) usa a vertical para baixo', () => {
    const f = trilhaSintetica('ombro');
    const i = 45;
    const m = marcacaoDoAngulo(elevacaoBraco('D'), f.quadros[i], calcularAnguloNoQuadro(elevacaoBraco('D'), f.quadros[i], 1))!;
    expect(m.b.x).toBeCloseTo(m.vertice.x, 5);
    expect(m.b.y).toBeGreaterThan(m.vertice.y);
    const verdade = verdadeEm('ombro', i / 30).elevacao_d;
    expect(m.graus).toBeCloseTo(verdade, 0);
  });

  it('arrastar um ponto muda o ângulo do quadro sem tocar na trilha', () => {
    const q = t.quadros[40];
    const antes = calcularAnguloNoQuadro(anguloJoelho('D'), q, 1)!;
    const tela = pontosParaTela(q)!;
    const movido = quadroComPontos(q, { ...tela, tornozelo_d: { x: tela.tornozelo_d.x + 40, y: tela.tornozelo_d.y } });
    const depois = calcularAnguloNoQuadro(anguloJoelho('D'), movido, 1)!;
    expect(Math.abs(depois - antes)).toBeGreaterThan(5);
    expect(movido.pontos.tornozelo_d.manual).toBe(true);
    expect(q.pontos.tornozelo_d.manual).toBeUndefined();
  });

  it('pontos para a tela marcam os corrigidos à mão', () => {
    const c = corrigirPonto(t, 20, 'joelho_d', { x: 300, y: 300 });
    const tela = pontosParaTela(c.quadros[20])!;
    expect(tela.joelho_d.manual).toBe(true);
    expect(tela.joelho_e.manual).toBeUndefined();
    expect(pontosParaTela({ i: 0, t: 0, pontos: {} })).toBeNull();
  });

  it('ligações do esqueleto e rótulos dos pontos', () => {
    expect(LIGACOES_CORPO.filter((l) => l.lado === 'D').length).toBe(LIGACOES_CORPO.filter((l) => l.lado === 'E').length);
    expect(rotuloDoPonto('joelho_d')).toBe('Joelho direito');
    expect(rotuloDoPonto('pe_e')).toBe('Ponta do pé esquerdo');
    expect(rotuloDoPonto('nariz')).toBe('Nariz');
    const pts = pontosDasDefinicoes([anguloJoelho('D'), inclinacaoTronco]);
    expect(pts).toEqual(expect.arrayContaining(['quadril_d', 'joelho_d', 'tornozelo_d', 'quadril_e', 'ombro_d']));
    expect(pts.some((p) => p.endsWith('_medio'))).toBe(false);
  });
});

describe('grupos, curvas e bandas do gráfico', () => {
  const t = trilhaSintetica('marcha');
  const modelo = modeloDoGesto('marcha');
  const grupos = gruposDeArticulacoes(modelo.articulacoes);

  it('agrupa direito e esquerdo na mesma articulação', () => {
    expect(grupos.map((g) => g.id)).toEqual(['quadril', 'joelho', 'tornozelo', 'coxa', 'tibia', 'tronco']);
    expect(grupos.find((g) => g.id === 'joelho')!.defs).toHaveLength(2);
    expect(grupos.find((g) => g.id === 'joelho')!.nome).toBe('Joelho');
    expect(grupos.find((g) => g.id === 'tronco')!.defs).toHaveLength(1);
    expect(grupoInicial(modelo, grupos)).toBe('joelho');
  });

  it('a curva do joelho acompanha a verdade da figura e não altera a trilha', () => {
    const joelho = grupos.find((g) => g.id === 'joelho')!;
    const copia = JSON.stringify(t.quadros[30]);
    const s = seriesDoGrupo(t, joelho, 1, { suavizarS: null });
    expect(s).toHaveLength(2);
    expect(s[0].lado).toBe('D');
    expect(s[0].pontos).toHaveLength(t.quadros.length);
    const i = 52;
    expect(s[0].pontos[i].v!).toBeCloseTo(verdadeEm('marcha', i / 30).joelho_d, 0);
    const suave = seriesDoGrupo(t, joelho, 1);
    const maxSuave = Math.max(...suave[0].pontos.map((p) => p.v ?? -Infinity));
    const maxBruto = Math.max(...s[0].pontos.map((p) => p.v ?? -Infinity));
    expect(maxSuave).toBeLessThanOrEqual(maxBruto + 1e-6);
    expect(maxSuave).toBeGreaterThan(maxBruto - 5);
    expect(JSON.stringify(t.quadros[30])).toBe(copia);
  });

  it('eventos viram marcadores do gráfico e itens da lista', () => {
    const e = { id: 'D-contato-10', lado: 'D' as const, tipo: 'contato' as const, i: 10, t: 0.33, sugerido: true };
    expect(marcadoresDeEventos([e])).toEqual([{ id: 'D-contato-10', t: 0.33, tipo: 'contato', lado: 'D' }]);
    expect(eventoParaUi(e).origem).toBe('auto');
    expect(eventoParaUi({ ...e, sugerido: false }).origem).toBe('manual');
  });

  it('banda de referência só existe com referência confirmada, em graus, para o gesto e o grupo', () => {
    const base: ReferenciaBiomecanica = { chave: 'x', metrica: 'flexao_joelho_max', populacao: 'p', faixa: { min: 100, max: 140 }, fonte: { citacao: 'Autor, 2020', rotulo: 'Autor, 2020', pmid: '1' }, estatuto: 'confirmada', unidade: '°', aplicaA: ['agachamento'] };
    const sem: ReferenciaBiomecanica = { ...base, chave: 'y', estatuto: 'sem_referencia', faixa: {} };
    expect(bandasDoGrupo('joelho', 'agachamento', [base])).toHaveLength(1);
    expect(bandasDoGrupo('joelho', 'agachamento', [base])[0].rotulo).toMatch(/PMID 1/);
    expect(bandasDoGrupo('joelho', 'marcha', [base])).toHaveLength(0);
    expect(bandasDoGrupo('quadril', 'agachamento', [base])).toHaveLength(0);
    expect(bandasDoGrupo('joelho', 'agachamento', [sem])).toHaveLength(0);
    expect(bandasDoGrupo('joelho', 'agachamento', [{ ...base, unidade: 'cm/s' }])).toHaveLength(0);
  });

  it('com a tabela real do motor, nenhum gráfico de ângulo ganha banda sem fonte', () => {
    for (const m of MODELOS_GESTO) for (const g of gruposDeArticulacoes(m.articulacoes)) {
      for (const b of bandasDoGrupo(g.id, m.id)) expect(b.rotulo).toMatch(/PMID \d+/);
    }
  });

  it('o modelo vira o cartão de escolha com a vista e o que mede', () => {
    const ui = modeloParaUi(modelo);
    expect(ui.vista).toBe('Vista lateral');
    expect(ui.comEventos).toBe(true);
    expect(ui.itens.length).toBeGreaterThan(2);
    expect(modeloParaUi(modeloDoGesto('salto')).vista).toBe('Vista frontal');
    expect(modeloParaUi(modeloDoGesto('agachamento')).comEventos).toBe(false);
  });
});

describe('cartões das métricas', () => {
  const t = trilhaSintetica('marcha');
  const modelo = modeloDoGesto('marcha');
  const analise = analisarGesto(modelo, t);
  const cartoes = cartoesDeMetricas(analise.metricas, modelo);
  const por = (chave: string) => cartoes.find((c) => c.chave === chave)!;

  it('uma métrica por cartão, com os dois lados juntos e o nome sem o lado', () => {
    expect(new Set(cartoes.map((c) => c.chave)).size).toBe(cartoes.length);
    const adm = por('adm_joelho');
    expect(adm.titulo).toBe('Amplitude do joelho');
    expect(adm.valores.map((v) => v.lado)).toEqual(['D', 'E']);
    expect(adm.valores[0].texto).toMatch(/^\d+,\d°$/);
    expect(por('inclinacao_tronco').valores).toHaveLength(1);
    expect(por('inclinacao_tronco').valores[0].lado).toBeNull();
  });

  it('só a cadência tem referência confirmada, com fonte e PMID; as demais ficam sem referência', () => {
    const cad = por('cadencia');
    expect(cad.referencias).toHaveLength(1);
    expect(cad.referencias[0].pmid).toBe('29858465');
    expect(cad.referencias[0].faixa).toMatch(/≥ 100/);
    expect(cad.valores[0].status).toBe('dentro');
    for (const c of cartoes.filter((x) => x.chave !== 'cadencia' && x.chave !== 'velocidade_marcha')) {
      expect(c.referencias).toHaveLength(0);
      for (const v of c.valores) expect(v.status).toBe('sem_referencia');
    }
  });

  it('a literatura sem faixa aparece como contexto, não como referência', () => {
    const adm = por('adm_joelho');
    expect(adm.referencias).toHaveLength(0);
    expect(adm.contexto.length).toBeGreaterThan(0);
    expect(adm.contexto[0].pmid).toBe('32491153');
  });

  it('a velocidade sem escala fica sem valor (nada é inventado)', () => {
    const v = por('velocidade_marcha');
    expect(v.valores[0].texto).toBe('—');
    expect(v.valores[0].status).toBe('sem_referencia');
  });

  it('formata cada unidade como o profissional lê', () => {
    expect(formatarMetrica(62.34, '°')).toBe('62,3°');
    expect(formatarMetrica(1.1, 's')).toBe('1,10 s');
    expect(formatarMetrica(230.4, 'ms')).toBe('230 ms');
    expect(formatarMetrica(109.2, 'passos/min')).toBe('109 passos/min');
    expect(formatarMetrica(48.55, '% do ciclo')).toBe('48,6% do ciclo');
    expect(formatarMetrica(2, '')).toBe('2');
    expect(formatarMetrica(0.987, 'razão')).toBe('0,99 razão');
    expect(formatarMetrica(null, '°')).toBe('—');
    expect(formatarMetrica(NaN, 's')).toBe('—');
  });

  it('as curvas do gráfico vêm das mesmas séries da análise (um ponto por quadro)', () => {
    const joelho = gruposDeArticulacoes(modelo.articulacoes).find((g) => g.id === 'joelho')!;
    const s = seriesDoGrupoDaAnalise(joelho, analise.series);
    expect(s.map((x) => x.lado)).toEqual(['D', 'E']);
    expect(s[0].pontos).toHaveLength(t.quadros.length);
    expect(seriesDoGrupoDaAnalise(joelho, {})).toEqual([]);
  });

  it('repetições e aterrissagem viram marcas do gráfico', () => {
    const agach = trilhaSintetica('agachamento');
    const a = analisarGesto('agachamento', agach);
    const m = marcadoresExtras(agach, a.repeticoes, null);
    expect(m).toHaveLength(2);
    expect(m[0].tipo).toBe('outro');
    expect(marcadoresExtras(agach, [], 10)[0].rotulo).toBe('Aterrissagem');
    expect(marcadoresExtras(agach, [9999], 9999)).toEqual([]);
  });
});
