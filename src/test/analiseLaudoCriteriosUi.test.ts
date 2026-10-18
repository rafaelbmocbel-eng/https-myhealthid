import { describe, expect, it } from 'vitest';
import {
  aceitaLado, criterioVazio, GRANDEZA_TEXTO, ladoDoSeletor, lerValorDigitado, OPERADORES, opcoesDoProtocolo, rotuloAutomatico, valorDaOpcao, valorParaCampo,
} from '../components/angular/video/laudo/criteriosUi';
import { criterioAplicavel, criterioValidoNoProtocolo } from '../lib/angular/movimento/criterios';
import { achadosAvaliaveis, CATALOGO_ACHADOS, PROTOCOLOS, protocoloDo } from '../lib/angular/movimento/protocolos';
import { termoProibido } from '../lib/angular/movimento/vocabulario';

describe('opções de medida do editor de critérios', () => {
  it('só oferece medidas dos achados avaliáveis no plano filmado, e todas são aceitas por criterioValidoNoProtocolo', () => {
    for (const p of PROTOCOLOS) {
      const opcoes = opcoesDoProtocolo(p);
      expect(opcoes.length).toBeGreaterThan(0);
      const avaliaveis = new Set(achadosAvaliaveis(p).map((a) => a.chave));
      for (const o of opcoes) {
        expect(avaliaveis.has(o.chave)).toBe(true);
        expect(o.valor).toBe(valorDaOpcao(o.chave, o.metrica));
        expect(criterioValidoNoProtocolo(criterioVazio(o, 'x'), p)).toBe(true);
      }
      expect(new Set(opcoes.map((o) => o.valor)).size).toBe(opcoes.length);
    }
  });

  it('não oferece achados que exigem o outro plano de câmera', () => {
    const lateral = opcoesDoProtocolo(protocoloDo('agachamento_lateral')).map((o) => o.chave);
    expect(lateral).not.toContain('valgo_dinamico');
    expect(lateral).not.toContain('desvio_lateral_pelve');
    const frontal = opcoesDoProtocolo(protocoloDo('agachamento_frontal')).map((o) => o.chave);
    expect(frontal).toContain('valgo_dinamico');
    expect(frontal).not.toContain('inclinacao_tronco');
    expect(frontal).not.toContain('avanco_joelho');
  });

  it('o grupo de cada opção é o título do achado do catálogo e a grandeza é a dele', () => {
    for (const o of opcoesDoProtocolo(protocoloDo('marcha_lateral'))) {
      expect(o.grupo).toBe(CATALOGO_ACHADOS[o.chave].titulo);
      expect(o.grandeza).toBe(CATALOGO_ACHADOS[o.chave].grandeza);
      expect(GRANDEZA_TEXTO[o.grandeza]).toBeTruthy();
    }
  });
});

describe('critério novo', () => {
  const opcao = opcoesDoProtocolo(protocoloDo('agachamento_lateral'))[0];

  it('nasce desligado, sem valor, sem rótulo e não se aplica', () => {
    const c = criterioVazio(opcao, 'Dra. Teste');
    expect(c.ativo).toBe(false);
    expect(Number.isNaN(c.valor)).toBe(true);
    expect(c.rotulo).toBe('');
    expect(c.definidoPor).toBe('Dra. Teste');
    expect(c.unidade).toBe(opcao.unidade);
    expect(criterioAplicavel({ ...c, ativo: true })).toBe(false);
  });

  it('cada critério novo tem id próprio', () => {
    const ids = new Set(Array.from({ length: 20 }, () => criterioVazio(opcao, '').id));
    expect(ids.size).toBe(20);
  });

  it('o rótulo sugerido descreve a comparação sem juízo', () => {
    const c = { operador: '<=' as const, valor: 5, unidade: '°' };
    const r = rotuloAutomatico(c, { nome: 'Flexão máxima do joelho', grandeza: 'diferenca_entre_lados' });
    expect(r).toBe('Flexão máxima do joelho: diferença entre os lados ≤ 5,0°');
    expect(termoProibido(r)).toBeNull();
    expect(rotuloAutomatico({ ...c, lado: 'D', operador: '>' }, { nome: 'Valgo do joelho', grandeza: 'media_por_lado' })).toContain('(lado direito)');
  });

  it('o seletor de lado só aparece para medidas calculadas por lado', () => {
    expect(aceitaLado({ grandeza: 'media_por_lado', porLado: true })).toBe(true);
    expect(aceitaLado({ grandeza: 'tendencia', porLado: true })).toBe(true);
    expect(aceitaLado({ grandeza: 'diferenca_entre_lados', porLado: true })).toBe(false);
    expect(aceitaLado({ grandeza: 'media_por_lado', porLado: false })).toBe(false);
  });

  it('oferece os quatro operadores e rótulos de lado válidos', () => {
    expect(OPERADORES.map((o) => o.valor).sort()).toEqual(['<', '<=', '>', '>=']);
    expect(ladoDoSeletor('D')).toBe('D');
    expect(ladoDoSeletor('E')).toBe('E');
    expect(ladoDoSeletor('')).toBeUndefined();
    expect(ladoDoSeletor('X')).toBeUndefined();
  });
});

describe('leitura do valor digitado', () => {
  it('aceita vírgula, ponto e sinal', () => {
    expect(lerValorDigitado('5')).toBe(5);
    expect(lerValorDigitado(' 2,5 ')).toBe(2.5);
    expect(lerValorDigitado('2.5')).toBe(2.5);
    expect(lerValorDigitado('-3,25')).toBe(-3.25);
    expect(lerValorDigitado('+4')).toBe(4);
    expect(lerValorDigitado('7,')).toBe(7);
  });

  it('vazio ou lixo volta null: o app nunca presume um valor', () => {
    for (const t of ['', '   ', 'abc', '1,2,3', '1e5', '--1', ',5', '5°', 'NaN', 'Infinity']) expect(lerValorDigitado(t), t).toBeNull();
  });

  it('mostra o número com vírgula no campo e vazio quando não há valor', () => {
    expect(valorParaCampo(2.5)).toBe('2,5');
    expect(valorParaCampo(5)).toBe('5');
    expect(valorParaCampo(Number.NaN)).toBe('');
  });
});
