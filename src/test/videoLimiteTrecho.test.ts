import { describe, expect, it } from 'vitest';
import {
  ajustarIntervalo, DURACAO_SUGERIDA_S, maiorTaxaQueComporta, opcoesDeTaxa, taxaInicial, taxaMaximaParaTrecho, trechoCabeNaTaxa, trechoMaximoPorQuadrosS, trechoMaximoS,
} from '../lib/angular/analiseVideo/tempo';
import { FPS_COMUNS } from '../lib/angular/analiseVideo/carregarVideo';
import { MAX_QUADROS_PADRAO, planejarQuadros } from '../lib/angular/video/rastrear';

const motorReduz = (trechoS: number, taxa: number) => planejarQuadros(trechoS, taxa, MAX_QUADROS_PADRAO).fps < taxa - 1e-9;

describe('trecho máximo para a taxa escolhida', () => {
  it('é floor(1200 ÷ taxa) segundos', () => {
    expect(trechoMaximoPorQuadrosS(30)).toBe(40);
    expect(trechoMaximoPorQuadrosS(60)).toBe(20);
    expect(trechoMaximoPorQuadrosS(120)).toBe(10);
    expect(trechoMaximoPorQuadrosS(24)).toBe(50);
    expect(trechoMaximoPorQuadrosS(50)).toBe(24);
    expect(trechoMaximoPorQuadrosS(7)).toBe(171);
    expect(trechoMaximoPorQuadrosS(240)).toBe(5);
  });

  it('a tela nunca oferece mais que o trecho máximo de produto (30 s), mesmo a taxas baixas', () => {
    expect(trechoMaximoS(30)).toBe(DURACAO_SUGERIDA_S);
    expect(trechoMaximoS(24)).toBe(DURACAO_SUGERIDA_S);
    expect(trechoMaximoS(60)).toBe(20);
    expect(trechoMaximoS(120)).toBe(10);
  });

  it('taxa inválida não quebra o cálculo', () => {
    expect(trechoMaximoS(0)).toBe(DURACAO_SUGERIDA_S);
    expect(trechoMaximoS(Number.NaN)).toBe(DURACAO_SUGERIDA_S);
    expect(trechoMaximoPorQuadrosS(-5)).toBe(1200);
  });

  it('o trecho cabe até o máximo, com a tolerância de ponto flutuante dos controles deslizantes, e nem 0,1 s a mais', () => {
    expect(trechoCabeNaTaxa(20, 60)).toBe(true);
    expect(trechoCabeNaTaxa(22.3 - 2.3, 60)).toBe(true);
    expect(trechoCabeNaTaxa(20.1, 60)).toBe(false);
    expect(trechoCabeNaTaxa(10, 120)).toBe(true);
    expect(trechoCabeNaTaxa(10.1, 120)).toBe(false);
    expect(trechoCabeNaTaxa(30, 30)).toBe(true);
    expect(trechoCabeNaTaxa(30.1, 30)).toBe(false);
  });
});

describe('maior taxa que comporta o trecho', () => {
  it('é floor(1200 ÷ trecho): para 30 s, até 40 q/s', () => {
    expect(taxaMaximaParaTrecho(30)).toBe(40);
    expect(taxaMaximaParaTrecho(20)).toBe(60);
    expect(taxaMaximaParaTrecho(15)).toBe(80);
    expect(taxaMaximaParaTrecho(10)).toBe(120);
    expect(taxaMaximaParaTrecho(5)).toBe(240);
    expect(taxaMaximaParaTrecho(0)).toBe(12000);
  });

  it('a sugestão é a maior taxa oferecida para o vídeo que cabe no limite', () => {
    expect(maiorTaxaQueComporta(30, 240)?.fps).toBe(30);
    expect(maiorTaxaQueComporta(25, 240)?.fps).toBe(30);
    expect(maiorTaxaQueComporta(20, 240)?.fps).toBe(60);
    expect(maiorTaxaQueComporta(15, 240)?.fps).toBe(60);
    expect(maiorTaxaQueComporta(10, 240)?.fps).toBe(120);
    expect(maiorTaxaQueComporta(10, 60)?.fps).toBe(60);
    expect(maiorTaxaQueComporta(30, 24)?.fps).toBe(24);
  });

  it('a sugestão nunca é uma taxa que o motor teria de reduzir (varredura de trechos e vídeos)', () => {
    for (const fpsVideo of FPS_COMUNS) {
      for (let dec = 5; dec <= DURACAO_SUGERIDA_S * 10; dec++) {
        const trecho = dec / 10;
        const s = maiorTaxaQueComporta(trecho, fpsVideo);
        expect(s, `vídeo ${fpsVideo}, trecho ${trecho}`).not.toBeNull();
        expect(motorReduz(trecho, s!.fps), `vídeo ${fpsVideo}, trecho ${trecho} a ${s!.fps}`).toBe(false);
      }
    }
  });
});

describe('taxa pré-selecionada', () => {
  it('a sugerida pelo gesto, ou a maior oferecida que cabe no trecho', () => {
    expect(taxaInicial(60, 30, 60)).toBe(30);
    expect(taxaInicial(60, 20, 60)).toBe(60);
    expect(taxaInicial(120, 5, 240)).toBe(120);
    expect(taxaInicial(120, 15, 240)).toBe(60);
    expect(taxaInicial(30, 30, 240)).toBe(30);
  });

  it('sem taxa oferecida abaixo da desejada, fica com a menor oferecida', () => {
    expect(taxaInicial(15, 30, 120)).toBe(30);
    expect(taxaInicial(15, 30, 24)).toBe(24);
  });

  it('nunca pré-seleciona uma taxa que o motor reduziria', () => {
    for (const fpsVideo of FPS_COMUNS) {
      for (const desejada of [15, 30, 60, 120, 240]) {
        for (let dec = 5; dec <= DURACAO_SUGERIDA_S * 10; dec += 3) {
          const trecho = dec / 10;
          const taxa = taxaInicial(desejada, trecho, fpsVideo);
          expect(opcoesDeTaxa(fpsVideo).map((o) => o.fps)).toContain(taxa);
          expect(motorReduz(trecho, taxa), `vídeo ${fpsVideo}, desejada ${desejada}, trecho ${trecho} -> ${taxa}`).toBe(false);
        }
      }
    }
  });
});

describe('o trecho trava no máximo da taxa', () => {
  it('o lado movido para no limite e o outro fica onde estava', () => {
    expect(ajustarIntervalo({ inicio: 0, fim: 28 }, 40, 'fim', 20)).toEqual({ inicio: 0, fim: 20 });
    expect(ajustarIntervalo({ inicio: 8, fim: 30 }, 40, 'inicio', 20)).toEqual({ inicio: 10, fim: 30 });
    expect(ajustarIntervalo({ inicio: 5, fim: 12 }, 40, 'fim', 20)).toEqual({ inicio: 5, fim: 12 });
  });

  it('em nenhum movimento dos controles, a qualquer taxa oferecida, o trecho passa do que o motor aceita sem reduzir a taxa', () => {
    const duracao = 75;
    for (const taxa of opcoesDeTaxa(240).map((o) => o.fps)) {
      const max = trechoMaximoS(taxa);
      for (let ini = 0; ini <= 60; ini += 3.7) {
        for (let fim = 0.5; fim <= duracao; fim += 4.3) {
          for (const lado of ['inicio', 'fim'] as const) {
            const novo = ajustarIntervalo({ inicio: ini, fim: Math.max(fim, ini + 0.5) }, duracao, lado, max);
            const trecho = novo.fim - novo.inicio;
            expect(trechoCabeNaTaxa(trecho, taxa), `taxa ${taxa}, ${ini}-${fim}, ${lado}: ${trecho}`).toBe(true);
            expect(motorReduz(Math.max(trecho, 0.1), taxa), `taxa ${taxa}: ${trecho}`).toBe(false);
            expect(trecho).toBeGreaterThanOrEqual(0.5 - 1e-9);
          }
        }
      }
    }
  });
});

describe('o motor continua protegido', () => {
  it('planejarQuadros ainda reduz a taxa se alguém passar um trecho longo demais (a tela é que não deixa chegar lá)', () => {
    const p = planejarQuadros(30, 60, MAX_QUADROS_PADRAO);
    expect(p.quadros).toBe(1200);
    expect(p.fps).toBeCloseTo(40, 6);
    expect(trechoCabeNaTaxa(30, 60)).toBe(false);
  });
});
