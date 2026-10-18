import { describe, expect, it } from 'vitest';
import { instanteNoTrecho, notaMedidasForaDoTrecho, remapearCapturas, situarCapturas, trechoDaTrilha, type CapturaManual } from '../lib/angular/analiseVideo/medidaManual';
import { lerAnaliseSalva, serializarAnalise } from '../lib/angular/analiseVideo/persistencia';
import { trilhaVazia } from '../lib/angular/analiseVideo/trilhaVazia';
import { resumoEmLinhas } from '../components/angular/video/saidas';

const captura = (uid: string, quadro: number, t: number): CapturaManual => ({
  uid, medidaId: 'joelho-d', nome: 'Joelho direito', t, quadro, pontos: [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }], valor: 40, unidade: 'graus', texto: '40°',
});
const temposDe = (inicio: number, fim: number, fps: number) => Array.from({ length: Math.floor((fim - inicio) * fps + 1e-6) }, (_, i) => inicio + i / fps);

describe('trecho coberto pela trilha atual', () => {
  it('vai do primeiro ao último quadro, com o passo entre quadros', () => {
    const t = trechoDaTrilha(temposDe(2, 5, 30));
    expect(t?.inicio).toBe(2);
    expect(t?.fim).toBeCloseTo(2 + 89 / 30, 9);
    expect(t?.passo).toBeCloseTo(1 / 30, 9);
  });

  it('sem quadros não há trecho; com um quadro só, o passo vem da taxa', () => {
    expect(trechoDaTrilha([])).toBeNull();
    expect(trechoDaTrilha([3], 10)).toEqual({ inicio: 3, fim: 3, passo: 0.1 });
    expect(trechoDaTrilha([3])?.passo).toBeCloseTo(1 / 30, 9);
  });

  it('o instante vale dentro do trecho e até um quadro além de cada ponta', () => {
    const trecho = trechoDaTrilha(temposDe(2, 5, 30));
    expect(instanteNoTrecho(2, trecho)).toBe(true);
    expect(instanteNoTrecho(3.5, trecho)).toBe(true);
    expect(instanteNoTrecho(2 - 1 / 30, trecho)).toBe(true);
    expect(instanteNoTrecho(2 - 1.5 / 30, trecho)).toBe(false);
    expect(instanteNoTrecho(5, trecho)).toBe(true);
    expect(instanteNoTrecho(5.1, trecho)).toBe(false);
    expect(instanteNoTrecho(0.5, trecho)).toBe(false);
    expect(instanteNoTrecho(0.5, null)).toBe(false);
  });
});

describe('medidas guardadas dentro e fora do trecho (derivado na leitura, nada é apagado)', () => {
  const dentro = captura('dentro', 14, 2.4);
  const antes = captura('antes', 3, 0.1);
  const depois = captura('depois', 200, 7);
  const todas = [antes, dentro, depois];

  it('separa pelo instante t e pelo trecho da trilha atual, sem alterar a lista nem os objetos', () => {
    const copia = JSON.stringify(todas);
    const r = situarCapturas(todas, temposDe(2, 5, 30));
    expect(r.dentro.map((c) => c.uid)).toEqual(['dentro']);
    expect(r.fora.map((c) => c.uid)).toEqual(['antes', 'depois']);
    expect(r.fora[0]).toBe(antes);
    expect(r.fora[1]).toBe(depois);
    expect(JSON.stringify(todas)).toBe(copia);
  });

  it('as de dentro apontam o quadro mais perto do instante na trilha atual (também quando a taxa mudou)', () => {
    const r = situarCapturas(todas, temposDe(2, 5, 30));
    expect(r.dentro[0].quadro).toBe(12);
    expect(2 + r.dentro[0].quadro / 30).toBeCloseTo(2.4, 9);
    const r60 = situarCapturas(todas, temposDe(2, 5, 60));
    expect(r60.dentro[0].quadro).toBe(24);
  });

  it('a medida volta a valer quando um trecho novo inclui o instante dela, sem nenhuma ação', () => {
    let lista: CapturaManual[] = todas;
    const trechoA = temposDe(2, 5, 30);
    const trechoB = temposDe(6, 9, 30);
    expect(situarCapturas(lista, trechoA).dentro.map((c) => c.uid)).toEqual(['dentro']);
    lista = remapearCapturas(lista, trechoB).capturas;
    expect(situarCapturas(lista, trechoB).dentro.map((c) => c.uid)).toEqual(['depois']);
    expect(situarCapturas(lista, trechoB).fora.map((c) => c.uid)).toEqual(['antes', 'dentro']);
    lista = remapearCapturas(lista, trechoA).capturas;
    expect(situarCapturas(lista, trechoA).dentro.map((c) => c.uid)).toEqual(['dentro']);
    const volta = situarCapturas(lista, temposDe(0, 8, 30));
    expect(volta.dentro.map((c) => c.uid)).toEqual(['antes', 'dentro', 'depois']);
    expect(volta.fora).toEqual([]);
    expect(volta.dentro.map((c) => c.t)).toEqual([0.1, 2.4, 7]);
  });

  it('um quadro "guardado" que por acaso coincide com um índice da trilha nova não faz a medida de fora aparecer ali', () => {
    const naoAparece = captura('fora', 10, 0.3);
    const r = situarCapturas([naoAparece], temposDe(2, 5, 30));
    expect(r.dentro).toEqual([]);
    expect(r.fora).toEqual([naoAparece]);
  });

  it('sem trilha (nenhum quadro), tudo é "fora" e nada se perde', () => {
    const r = situarCapturas(todas, []);
    expect(r.dentro).toEqual([]);
    expect(r.fora).toEqual(todas);
  });

  it('remapearCapturas devolve a lista inteira, ordenada pelo instante, e conta quantas ficaram fora', () => {
    const r = remapearCapturas([depois, dentro, antes], temposDe(2, 5, 30), 30);
    expect(r.capturas.map((c) => c.uid)).toEqual(['antes', 'dentro', 'depois']);
    expect(r.foraDoTrecho).toBe(2);
    expect(r.capturas.find((c) => c.uid === 'dentro')?.quadro).toBe(12);
    expect(r.capturas.find((c) => c.uid === 'antes')).toBe(antes);
    expect(remapearCapturas([], temposDe(2, 5, 30))).toEqual({ capturas: [], foraDoTrecho: 0 });
  });

  it('o PDF, o resumo e a nota do prontuário usam só as de dentro', () => {
    const r = situarCapturas(todas, temposDe(2, 5, 30));
    const linhas = resumoEmLinhas([], r.dentro);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatch(/2,40 s \(quadro 13\) — Joelho direito: 40,0°/);
    expect(resumoEmLinhas([], r.fora)).toHaveLength(2);
  });

  it('a nota das medidas deixadas de fora concorda em número e diz de qual saída elas ficaram de fora', () => {
    expect(notaMedidasForaDoTrecho(0, 'registro')).toBeUndefined();
    expect(notaMedidasForaDoTrecho(1, 'relatório')).toBe('1 medida guardada em instante fora do trecho analisado não entrou neste relatório.');
    expect(notaMedidasForaDoTrecho(2, 'resumo')).toBe('2 medidas guardadas em instantes fora do trecho analisado não entraram neste resumo.');
    expect(notaMedidasForaDoTrecho(3, 'registro')).toMatch(/neste registro\.$/);
  });
});

describe('compatibilidade com análises .json já salvas', () => {
  it('a marca "fora do trecho" não é gravada: a lista salva é a mesma de antes, campo por campo', () => {
    const original = [captura('a', 14, 2.4), captura('b', 3, 0.1)];
    const trilha = trilhaVazia(30, 2, 5, 640, 480);
    const { dentro, fora } = situarCapturas(original, trilha.quadros.map((q) => q.t));
    const texto = serializarAnalise({
      video: { nome: '', tamanho: 1, duracao: 6, largura: 640, altura: 480 }, modeloId: 'marcha', fpsVideo: 30, intervalo: { inicio: 2, fim: 5 },
      trilha, eventos: null, cmPorPx: null, extras: { capturas: [...dentro, ...fora] },
    });
    const lido = lerAnaliseSalva(texto);
    expect(lido.ok).toBe(true);
    if (!lido.ok) return;
    const salvas = lido.analise.extras.capturas as CapturaManual[];
    expect(salvas).toHaveLength(2);
    for (const c of salvas) expect(Object.keys(c).sort()).toEqual(['medidaId', 'nome', 'pontos', 'quadro', 'texto', 'uid', 'unidade', 't', 'valor'].sort());
  });

  it('um arquivo antigo, sem nenhuma marca, abre e as medidas se separam pelo instante', () => {
    const antigo = JSON.stringify({
      app: 'myhealthid-analise-video', versao: 1, salvoEm: '2026-01-01T00:00:00.000Z', video: { nome: '', tamanho: 1, duracao: 6, largura: 640, altura: 480 }, modeloId: 'marcha', fpsVideo: 30,
      intervalo: { inicio: 2, fim: 5 }, trilha: JSON.parse(serializarAnalise({ video: { nome: '', tamanho: 1, duracao: 6, largura: 640, altura: 480 }, modeloId: 'marcha', fpsVideo: 30, intervalo: { inicio: 2, fim: 5 }, trilha: trilhaVazia(30, 2, 5, 640, 480), eventos: null, cmPorPx: null, extras: {} })).trilha,
      eventos: null, cmPorPx: null, extras: { capturas: [captura('a', 14, 2.4), captura('b', 3, 0.1)] },
    });
    const lido = lerAnaliseSalva(antigo);
    expect(lido.ok).toBe(true);
    if (!lido.ok) return;
    const r = situarCapturas(lido.analise.extras.capturas as CapturaManual[], lido.analise.trilha.quadros.map((q) => q.t), lido.analise.trilha.fps);
    expect(r.dentro.map((c) => c.uid)).toEqual(['a']);
    expect(r.fora.map((c) => c.uid)).toEqual(['b']);
  });
});
