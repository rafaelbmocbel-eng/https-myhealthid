import { describe, expect, it } from 'vitest';
import {
  compararMedidas, grau, medidasParaComparar, medidasParaExportar, motivoTexto, parearMedidas, sentidoDe,
  sentidoDoTexto, valorParaExportar, variacaoTexto, type MedidaSalva,
} from '@/lib/angular/comparar';
import { ajustarNaCaixa, dataBR, fracaoDeRolagem, hojeISO, posicaoDeRolagem, razaoDaCaixa } from '@/lib/angular/compararLayout';
import { MEDIDAS } from '@/lib/angular/medidas';

const TEXTO_D = 'Linha dos ombros: 3,0° com a horizontal, lado direito mais alto.';
const TEXTO_E = 'Linha dos ombros: 2,0° com a horizontal, lado esquerdo mais alto.';
const m = (id: string, graus: number, extra: Partial<MedidaSalva> = {}): MedidaSalva => ({ id, graus, ...extra });

describe('comparação que já existia (retrocompatibilidade)', () => {
  it('compararMedidas continua dando atual − anterior com uma casa', () => {
    const [l] = compararMedidas([m('ombros', 1.2)], [m('ombros', 3.1)]);
    expect(l.variacao).toBe(-1.9);
    expect(l.nome).toBe('Desnível dos ombros');
  });

  it('registros antigos sem unidade seguem em graus; cm e % ganham sufixo', () => {
    expect(grau(12.34)).toBe('12,3°');
    expect(grau(12.34, 'cm')).toBe('12,3 cm');
    expect(grau(12.34, '%')).toBe('12,3%');
    expect(grau(null)).toBe('—');
    expect(variacaoTexto(-1.8)).toBe('−1,8°');
    expect(variacaoTexto(2, 'cm')).toBe('+2,0 cm');
    expect(variacaoTexto(0)).toBe('0,0°');
  });
});

describe('parearMedidas', () => {
  it('subtrai depois − antes na mesma unidade', () => {
    const [l] = parearMedidas([m('joelho', 170.4)], [m('joelho', 176.1)]);
    expect(l.diferenca).toBe(5.7);
    expect(l.motivo).toBeUndefined();
    expect(l.nome).toBe('Ângulo do joelho');
  });

  it('não vira -0 quando as duas fotos dão o mesmo valor', () => {
    const [l] = parearMedidas([m('joelho', 170)], [m('joelho', 170.04)]);
    expect(Object.is(l.diferenca, 0)).toBe(true);
  });

  it('diz de que foto falta a medida, sem diferença', () => {
    const linhas = parearMedidas([m('ombros', 3)], [m('pelve', 1)]);
    const ombros = linhas.find((l) => l.id === 'ombros')!;
    const pelve = linhas.find((l) => l.id === 'pelve')!;
    expect(ombros.diferenca).toBeNull();
    expect(ombros.motivo).toBe('falta-depois');
    expect(pelve.motivo).toBe('falta-antes');
    expect(motivoTexto(ombros, 'Antes', 'Depois')).toBe('Falta marcar na foto Depois.');
    expect(motivoTexto(pelve, 'Antes', 'Depois')).toBe('Falta marcar na foto Antes.');
  });

  it('nunca mistura unidades com o mesmo id', () => {
    const [l] = parearMedidas([m('regua', 20, { unidade: 'cm' })], [m('regua', 12)]);
    expect(l.diferenca).toBeNull();
    expect(l.motivo).toBe('unidades-diferentes');
    const [ok] = parearMedidas([m('regua', 20, { unidade: 'cm' })], [m('regua', 18.5, { unidade: 'cm' })]);
    expect(ok.diferenca).toBe(-1.5);
    expect(ok.unidade).toBe('cm');
  });

  it('não subtrai desníveis de lados opostos', () => {
    const [l] = parearMedidas([m('ombros', 3, { texto: TEXTO_D })], [m('ombros', 2, { texto: TEXTO_E })]);
    expect(l.diferenca).toBeNull();
    expect(l.motivo).toBe('lado-trocado');
    expect(motivoTexto(l)).toContain('direito mais alto para esquerdo mais alto');
  });

  it('subtrai quando o lado é o mesmo ou quando uma foto está nivelada', () => {
    const [mesmo] = parearMedidas([m('ombros', 3, { texto: TEXTO_D })], [m('ombros', 1, { texto: TEXTO_D.replace('3,0', '1,0') })]);
    expect(mesmo.diferenca).toBe(-2);
    const [nivelada] = parearMedidas([m('ombros', 3, { texto: TEXTO_D })], [m('ombros', 0, { texto: 'Linha dos ombros nivelada (0,0°).' })]);
    expect(nivelada.diferenca).toBe(-3);
    expect(nivelada.sentidoDepois).toBeNull();
  });

  it('ordena como o catálogo de medidas e deixa ids desconhecidos no fim', () => {
    const ids = parearMedidas([m('desconhecida', 1), m('joelho', 170), m('ombros', 2)], []).map((l) => l.id);
    expect(ids).toEqual(['ombros', 'joelho', 'desconhecida']);
    expect(MEDIDAS.findIndex((x) => x.id === 'ombros')).toBeLessThan(MEDIDAS.findIndex((x) => x.id === 'joelho'));
  });
});

describe('medidas com sinal (inclinação pélvica, retropé, fio de prumo)', () => {
  const r = (id: string, valor: number, sentido?: string, unidade: 'graus' | 'cm' | '%' = 'graus') => ({ id, valor, unidade, texto: `${id} ${valor}`, sentido });

  it('vira medida comparável com o valor sem sinal e o lado à parte', () => {
    expect(medidasParaComparar([r('pelve-perfil', -4.26, 'posterior'), r('prumo-perfil-orelha-cm', 2.04, 'à frente do fio', 'cm'), r('ombros', 3)])).toEqual([
      { id: 'pelve-perfil', graus: 4.3, texto: 'pelve-perfil -4.26', sentido: 'posterior' },
      { id: 'prumo-perfil-orelha-cm', graus: 2, texto: 'prumo-perfil-orelha-cm 2.04', unidade: 'cm', sentido: 'à frente do fio' },
      { id: 'ombros', graus: 3, texto: 'ombros 3' },
    ]);
  });

  it('subtrai os módulos quando o lado é o mesmo', () => {
    const [l] = parearMedidas(medidasParaComparar([r('pelve-perfil', 6, 'anterior')]), medidasParaComparar([r('pelve-perfil', 4, 'anterior')]));
    expect(l.diferenca).toBe(-2);
    expect(l.sentidoAntes?.rotulo).toBe('anterior');
  });

  it('não subtrai quando a inclinação passou de anterior para posterior', () => {
    const [l] = parearMedidas(medidasParaComparar([r('pelve-perfil', 6, 'anterior')]), medidasParaComparar([r('pelve-perfil', -3, 'posterior')]));
    expect(l.diferenca).toBeNull();
    expect(l.motivo).toBe('lado-trocado');
    expect(motivoTexto(l)).toContain('anterior para posterior');
    expect(valorParaExportar(l)).toBe('6,0° (anterior) → 3,0° (posterior)');
  });

  it('valor zero ("sobre o fio") não tem lado e deixa subtrair', () => {
    const zero = { id: 'prumo-perfil-ombro-graus', graus: 0, sentido: 'sobre o fio' };
    expect(sentidoDe(zero)).toBeNull();
    const [l] = parearMedidas([{ id: 'prumo-perfil-ombro-graus', graus: 2, sentido: 'à frente do fio' }], [zero]);
    expect(l.diferenca).toBe(-2);
  });

  it('fio de prumo em unidades diferentes tem ids diferentes e nunca se compara', () => {
    const linhas = parearMedidas(
      medidasParaComparar([r('prumo-perfil-orelha-graus', 3, 'à frente do fio')]),
      medidasParaComparar([r('prumo-perfil-orelha-cm', 2, 'à frente do fio', 'cm')]),
    );
    expect(linhas).toHaveLength(2);
    expect(linhas.every((l) => l.diferenca === null)).toBe(true);
    expect(linhas[0].nome).toBe('Fio de prumo: orelha (graus)');
  });
});

describe('sentidoDoTexto', () => {
  it('lê o lado do desnível e o desvio do tronco', () => {
    expect(sentidoDoTexto(TEXTO_D)).toMatchObject({ categoria: 'alto', lado: 'direito', rotulo: 'direito mais alto' });
    expect(sentidoDoTexto('Tronco a 2,0° da vertical, pescoço desviado para a esquerda da imagem.')).toMatchObject({ categoria: 'desvio', lado: 'esquerda da imagem' });
    expect(sentidoDoTexto('Reta a 10,0° da horizontal (80,0° da vertical), sobe para a direita da imagem.')).toMatchObject({ categoria: 'sobe' });
    expect(sentidoDoTexto('Ângulo medido: 90,0°.')).toBeNull();
    expect(sentidoDoTexto(undefined)).toBeNull();
  });
});

describe('exportação da comparação', () => {
  it('monta "antes → depois (diferença)" só para medidas das duas fotos', () => {
    const linhas = parearMedidas([m('joelho', 170), m('ombros', 3)], [m('joelho', 176.5), m('pelve', 1)]);
    expect(medidasParaExportar(linhas)).toEqual([{ nome: 'Ângulo do joelho', valor: '170,0° → 176,5° (+6,5°)' }]);
  });

  it('com unidade em cm mantém cm nos três números', () => {
    const [l] = parearMedidas([m('regua', 20, { unidade: 'cm' })], [m('regua', 18.5, { unidade: 'cm' })]);
    expect(valorParaExportar(l)).toBe('20,0 cm → 18,5 cm (−1,5 cm)');
  });

  it('se o lado mudou, mostra os dois valores sem diferença', () => {
    const [l] = parearMedidas([m('ombros', 3, { texto: TEXTO_D })], [m('ombros', 2, { texto: TEXTO_E })]);
    expect(valorParaExportar(l)).toBe('3,0° (direito mais alto) → 2,0° (esquerdo mais alto)');
  });
});

describe('layout das duas fotos', () => {
  it('a caixa usa a proporção da primeira foto, dentro de limites', () => {
    expect(razaoDaCaixa([null, 0.75])).toBe(0.75);
    expect(razaoDaCaixa([undefined, null])).toBeCloseTo(0.75);
    expect(razaoDaCaixa([0.1])).toBe(0.55);
    expect(razaoDaCaixa([9])).toBe(1.6);
    expect(razaoDaCaixa([Number.NaN, 1])).toBe(1);
  });

  it('ajusta a imagem inteira dentro da caixa sem distorcer', () => {
    expect(ajustarNaCaixa(300, 400, 1500, 2000)).toEqual({ w: 300, h: 400 });
    expect(ajustarNaCaixa(300, 400, 2000, 1000)).toEqual({ w: 300, h: 150 });
    expect(ajustarNaCaixa(300, 200, 1000, 2000)).toEqual({ w: 100, h: 200 });
    expect(ajustarNaCaixa(0, 400, 10, 10)).toEqual({ w: 0, h: 0 });
  });

  it('rolagem sincronizada vai e volta pela fração', () => {
    expect(fracaoDeRolagem(150, 600, 300)).toBeCloseTo(0.5);
    expect(posicaoDeRolagem(0.5, 900, 300)).toBe(300);
    expect(fracaoDeRolagem(10, 300, 300)).toBe(0);
    expect(posicaoDeRolagem(1.7, 900, 300)).toBe(600);
  });

  it('data em português sem deslocar o dia pelo fuso', () => {
    expect(dataBR('2026-10-11')).toBe('11/10/2026');
    expect(dataBR('')).toBe('');
    expect(dataBR('11/10/2026')).toBe('');
    expect(hojeISO(new Date('2026-10-12T02:30:00Z'))).toBe('2026-10-11');
  });
});

