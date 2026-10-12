import { describe, expect, it } from 'vitest';
import { MEDIDAS, girar, nomeDoResultado, unidadeDoResultadoId, alturaEmPixels, type ContextoMedida, type Ponto } from '../lib/angular/medidas';

const P = (x: number, y: number): Ponto => ({ x, y });
const med = (id: string) => MEDIDAS.find((m) => m.id === id)!;

describe('compasso', () => {
  it('ângulo entre os braços e a inclinação de cada um', () => {
    const r = med('compasso').calcular([P(0, 0), P(0, 100), P(100, 0)])!;
    expect(r.valor).toBeCloseTo(90, 6);
    expect(r.texto).toContain('90,0° entre os braços');
    expect(r.texto).toContain('Braço 1: 0,0° da vertical (90,0° da horizontal)');
    expect(r.texto).toContain('Braço 2: 90,0° da vertical (0,0° da horizontal)');
  });
  it('o vértice é o primeiro ponto e os braços saem dele', () => {
    expect(med('compasso').segmentos).toEqual([[0, 1], [0, 2]]);
    expect(med('compasso').calcular([P(0, 0), P(0, 0), P(100, 0)])).toBeNull();
  });
});

describe('compasso com referência', () => {
  const braco118 = P(100 * Math.sin((118 * Math.PI) / 180), 100 * Math.cos((118 * Math.PI) / 180));
  it('mede contra a vertical para baixo por padrão (como o 118° da referência)', () => {
    expect(med('compasso-ref').calcular([P(0, 0), braco118])!.valor).toBeCloseTo(118, 6);
  });
  it('as quatro referências', () => {
    const r = (ref: 'baixo' | 'cima' | 'esquerda' | 'direita', a: Ponto) => med('compasso-ref').calcular([P(0, 0), a], { cmPorPx: null, refCompasso: ref })!.valor;
    expect(r('baixo', P(0, 50))).toBeCloseTo(0, 6);
    expect(r('baixo', P(50, 0))).toBeCloseTo(90, 6);
    expect(r('cima', P(0, -50))).toBeCloseTo(0, 6);
    expect(r('cima', P(0, 50))).toBeCloseTo(180, 6);
    expect(r('esquerda', P(-50, 0))).toBeCloseTo(0, 6);
    expect(r('direita', P(50, 0))).toBeCloseTo(0, 6);
    expect(r('direita', P(-50, 0))).toBeCloseTo(180, 6);
  });
  it('o texto diz contra qual referência foi medido', () => {
    const t = med('compasso-ref').calcular([P(0, 0), P(0, 50)], { cmPorPx: null, refCompasso: 'esquerda' })!.texto;
    expect(t).toContain('horizontal para a esquerda da imagem');
  });
});

describe('ângulo Q', () => {
  it('é o desvio entre a reta EIAS–patela prolongada e a reta patela–tuberosidade', () => {
    const q = med('angulo-q-d').calcular([P(0, 0), P(0, 100), P(10, 200)])!;
    expect(q.valor).toBeCloseTo((Math.atan(10 / 100) * 180) / Math.PI, 4);
    expect(q.texto).toContain('Ângulo Q direito');
    expect(med('angulo-q-e').calcular([P(0, 0), P(0, 100), P(0, 200)])!.valor).toBeCloseTo(0, 6);
  });
  it('não classifica e traz a definição dos pontos no card', () => {
    expect(med('angulo-q-d').definicao).toMatch(/EIAS/);
    expect(med('angulo-q-d').definicao).toMatch(/sem classificar/i);
    expect(med('angulo-q-d').calcular([P(0, 0), P(0, 100), P(10, 200)])!.texto).not.toMatch(/normal|alterad/i);
  });
});

describe('retropé', () => {
  const perna = [P(50, 0), P(50, 100)];
  it('o pé direito com o calcanhar desviado para a direita da imagem (de costas) é valgo', () => {
    const r = med('retrope-d').calcular([...perna, P(50, 100), P(60, 200)])!;
    expect(r.valor).toBeCloseTo(5.71, 1);
    expect(r.texto).toContain('valgo');
  });
  it('o pé esquerdo com o mesmo desvio é varo; desviado para a esquerda é valgo', () => {
    const e = med('retrope-e').calcular([...perna, P(50, 100), P(60, 200)])!;
    expect(e.valor).toBeCloseTo(-5.71, 1);
    expect(e.texto).toContain('varo');
    expect(med('retrope-e').calcular([...perna, P(50, 100), P(40, 200)])!.valor).toBeCloseTo(5.71, 1);
  });
  it('marcar o calcâneo de baixo para cima dá o mesmo resultado', () => {
    const normal = med('retrope-d').calcular([...perna, P(50, 100), P(60, 200)])!.valor;
    const invertido = med('retrope-d').calcular([...perna, P(60, 200), P(50, 100)])!.valor;
    expect(invertido).toBeCloseTo(normal, 6);
  });
  it('retas alinhadas dão 0,0°', () => {
    expect(med('retrope-d').calcular([...perna, P(50, 100), P(50, 200)])!.texto).toContain('0,0°');
  });
});

describe('inclinação pélvica de perfil', () => {
  it('positiva quando a EIAS está mais baixa que a EIPS (anterior), com o lado no texto', () => {
    const ant = med('pelve-perfil').calcular([P(0, 100), P(100, 120)])!;
    expect(ant.valor).toBeCloseTo(11.31, 1);
    expect(ant.texto).toContain('anterior');
    expect(ant.sentido).toBe('anterior');
    const post = med('pelve-perfil').calcular([P(0, 100), P(100, 80)])!;
    expect(post.valor).toBeCloseTo(-11.31, 1);
    expect(post.texto).toContain('posterior');
    expect(med('pelve-perfil').comSinal).toBe(true);
  });
  it('na mesma altura é 0', () => {
    expect(med('pelve-perfil').calcular([P(0, 100), P(100, 100)])!.valor).toBe(0);
  });
});

describe('protração do ombro', () => {
  it('é o ângulo da reta C7–acrômio com a horizontal', () => {
    expect(med('protracao-ombro').calcular([P(0, 0), P(100, 100)])!.valor).toBeCloseTo(45, 6);
    expect(med('protracao-ombro').definicao).toMatch(/C7/);
  });
});

describe('fio de prumo de perfil', () => {
  // apoio embaixo; orelha 30 px à frente (olhando para a direita), joelho 5 px atrás
  const pts = [P(100, 500), P(130, 100), P(120, 200), P(100, 300), P(95, 400)];
  const ctx = (o: Partial<ContextoMedida>): ContextoMedida => ({ cmPorPx: null, ...o });
  const varios = (c: ContextoMedida, p = pts) => med('prumo-perfil').calcularVarios!(p, c);

  it('em cm com escala: positivo à frente do fio, valor por ponto, id com a unidade', () => {
    const r = varios(ctx({ cmPorPx: 0.5, unidadePrumo: 'cm', olhaPara: 'direita' }));
    expect(r.map((x) => x.id)).toEqual(['orelha-cm', 'ombro-cm', 'quadril-cm', 'joelho-cm']);
    expect(r[0].valor).toBeCloseTo(15, 6);
    expect(r[0].unidade).toBe('cm');
    expect(r[0].texto).toContain('15,0 cm à frente do fio');
    expect(r[2].valor).toBeCloseTo(0, 6);
    expect(r[2].texto).toContain('sobre o fio');
    expect(r[3].valor).toBeCloseTo(-2.5, 6);
    expect(r[3].texto).toContain('2,5 cm atrás do fio');
  });
  it('olhando para a esquerda da imagem os sinais se invertem', () => {
    const r = varios(ctx({ cmPorPx: 0.5, unidadePrumo: 'cm', olhaPara: 'esquerda' }));
    expect(r[0].valor).toBeCloseTo(-15, 6);
    expect(r[0].texto).toContain('atrás do fio');
    expect(r[0].texto).toContain('olhando para a esquerda da imagem');
  });
  it('em graus: inclinação da reta apoio–ponto com a vertical, sem precisar de escala', () => {
    const r = varios(ctx({ unidadePrumo: 'graus' }));
    expect(r[0].valor).toBeCloseTo((Math.atan2(30, 400) * 180) / Math.PI, 6);
    expect(r[0].id).toBe('orelha-graus');
    expect(r[0].unidade).toBe('graus');
  });
  it('em % da altura precisa da altura marcada', () => {
    expect(varios(ctx({ unidadePrumo: 'pct' }))).toEqual([]);
    const r = varios(ctx({ unidadePrumo: 'pct', alturaPx: 500 }));
    expect(r[0].valor).toBeCloseTo(6, 6);
    expect(r[0].id).toBe('orelha-pct');
    expect(r[0].unidade).toBe('%');
  });
  it('em cm sem escala não inventa resultado', () => {
    expect(varios(ctx({ unidadePrumo: 'cm' }))).toEqual([]);
    expect(med('prumo-perfil').calcular(pts, ctx({ unidadePrumo: 'cm' }))).toBeNull();
  });
  it('não classifica', () => {
    const t = varios(ctx({ cmPorPx: 0.5, unidadePrumo: 'cm' })).map((x) => x.texto).join(' ');
    expect(t).not.toMatch(/normal|alterad|anormal|patol/i);
  });
  it('o fio é independente do giro: pontos já corrigidos dão o mesmo desvio', () => {
    const giro = 4;
    const tortos = pts.map((p) => girar(p, giro));
    const corrigidos = tortos.map((p) => girar(p, -giro));
    const a = varios(ctx({ unidadePrumo: 'graus' }), pts)[0].valor;
    const b = varios(ctx({ unidadePrumo: 'graus' }), corrigidos)[0].valor;
    expect(b).toBeCloseTo(a, 6);
  });
});

describe('fio de prumo de frente e costas', () => {
  const pts = [P(500, 900), P(510, 100), P(500, 250), P(490, 500)];
  it('de costas, a direita da imagem é a direita do paciente; de frente, a esquerda', () => {
    const costas = med('prumo-frente').calcularVarios!(pts, { cmPorPx: 1, unidadePrumo: 'cm', vista: 'costas' });
    expect(costas.map((x) => x.id)).toEqual(['cabeca-cm', 'c7-cm', 'pelve-cm']);
    expect(costas[0].valor).toBe(10);
    expect(costas[0].texto).toContain('para a direita do paciente');
    const frente = med('prumo-frente').calcularVarios!(pts, { cmPorPx: 1, unidadePrumo: 'cm', vista: 'frente' });
    expect(frente[0].valor).toBe(-10);
    expect(frente[0].texto).toContain('para a esquerda do paciente');
    expect(frente[2].valor).toBe(10);
  });
  it('sem a vista, fala em lados da imagem', () => {
    const r = med('prumo-frente').calcularVarios!(pts, { cmPorPx: 1, unidadePrumo: 'cm' });
    expect(r[0].texto).toContain('direita da imagem');
  });
});

describe('ids, nomes e unidades', () => {
  it('reconhece os ids compostos do fio de prumo e os das medidas comuns', () => {
    expect(nomeDoResultado('prumo-perfil-orelha-cm')).toBe('Fio de prumo: orelha (cm)');
    expect(nomeDoResultado('prumo-frente-c7-pct')).toBe('Fio de prumo: c7 (% da altura)');
    expect(nomeDoResultado('ombros')).toBe('Desnível dos ombros');
    expect(nomeDoResultado('prumo-perfil-pe-cm')).toBeNull();
    expect(nomeDoResultado('qualquer')).toBeNull();
  });
  it('a unidade do id nunca mistura cm, % e graus', () => {
    expect(unidadeDoResultadoId('prumo-perfil-orelha-cm')).toBe('cm');
    expect(unidadeDoResultadoId('prumo-perfil-orelha-pct')).toBe('%');
    expect(unidadeDoResultadoId('prumo-perfil-orelha-graus')).toBe('graus');
    expect(unidadeDoResultadoId('regua')).toBe('cm');
    expect(unidadeDoResultadoId('ombros')).toBe('graus');
  });
  it('altura em pixels pela vertical', () => {
    expect(alturaEmPixels([P(10, 20), P(50, 520)])).toBe(500);
    expect(alturaEmPixels([P(10, 20)])).toBeNull();
    expect(alturaEmPixels([P(10, 20), P(30, 20)])).toBeNull();
  });
});

describe('toda medida', () => {
  it('retorna null com pontos coincidentes e tem ids únicos', () => {
    for (const m of MEDIDAS) {
      expect(m.pontos.length).toBeGreaterThanOrEqual(2);
      expect(m.calcular(m.pontos.map(() => P(5, 5)))).toBeNull();
      expect(m.calcularVarios?.(m.pontos.map(() => P(5, 5))) ?? []).toEqual([]);
    }
    const ids = MEDIDAS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('as medidas novas existem nas vistas certas', () => {
    const vistas = (id: string) => med(id).vistas;
    expect(vistas('angulo-q-d')).toEqual(['frente']);
    expect(vistas('retrope-e')).toEqual(['costas']);
    expect(vistas('prumo-perfil')).toEqual(['perfil']);
    expect(vistas('pelve-perfil')).toEqual(['perfil']);
    expect(vistas('protracao-ombro')).toEqual(['perfil']);
    expect(vistas('prumo-frente')).toEqual(['frente', 'costas']);
    expect(vistas('compasso')).toEqual(['frente', 'costas', 'perfil']);
  });
  it('as ferramentas de várias retas não ligam pontos em sequência por engano', () => {
    expect(med('prumo-perfil').segmentos).toEqual([]);
    expect(med('retrope-d').segmentos).toEqual([[0, 1], [2, 3]]);
  });
});
