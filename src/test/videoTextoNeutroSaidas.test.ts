import { describe, expect, it } from 'vitest';
import { resumoEmLinhas } from '../components/angular/video/saidas';
import { cartoesDeMetricas } from '../lib/angular/analiseVideo/resultados';
import type { CartaoMetricaUi } from '../lib/angular/analiseVideo/tiposUi';
import { notasDasMetricas } from '../lib/angular/relatorioVideo';
import { modeloDoGesto } from '../lib/angular/video/modelos';
import type { ResultadoMetrica } from '../lib/angular/video/tipos';

const metrica = (id: string, nome: string, valor: number, unidade: string): ResultadoMetrica => ({ id, metrica: id, nome, valor, unidade, lado: null, avisos: [] });
const cartoesDe = (velocidade: number, cadencia: number): CartaoMetricaUi[] =>
  cartoesDeMetricas([metrica('velocidade_marcha', 'Velocidade da marcha', velocidade, 'cm/s'), metrica('cadencia', 'Cadência', cadencia, 'passos/min')], modeloDoGesto('marcha'));
const velocidade = (v: number) => cartoesDe(v, 100)[0];
const cadencia = (v: number) => cartoesDe(100, v)[1];
const T = velocidade(100).titulo;

describe('resumo copiado e nota do prontuário dizem o que a referência é', () => {
  it('faixa de médias: "não é intervalo individual" uma só vez, no fim da lista de referências', () => {
    const c = velocidade(100);
    const [linha] = resumoEmLinhas([c], []);
    expect(linha).toBe(`• ${c.titulo}: ${c.valores[0].texto} (referência: 127,2 a 146,2 cm/s, Bohannon, 1997, PMID 9143432; 94,3 a 143,4 cm/s, Bohannon e Andrews, 2011, PMID 21820535 — faixa das médias do estudo, não é intervalo individual)`);
    const [duas] = resumoEmLinhas([velocidade(135)], []);
    expect(duas.match(/faixa das médias do estudo/g)).toHaveLength(1);
    expect(duas).toMatch(/Bohannon, 1997, PMID 9143432; .*Bohannon e Andrews, 2011, PMID 21820535 — faixa das médias/);
  });

  it('limiar de cadência: "limiar prático, não é faixa de normalidade", acima e abaixo', () => {
    for (const v of [88, 109]) {
      const [linha] = resumoEmLinhas([cadencia(v)], []);
      expect(linha, String(v)).toMatch(/\(referência: ≥ 100 passos\/min, Tudor-Locke et al\., 2018, PMID 29858465 — limiar prático, não é faixa de normalidade\)$/);
      expect(linha).not.toMatch(/normal(?!idade)|anormal|errado|certo/i);
    }
  });

  it('faixa de normalidade (sem tipo) e métrica sem referência não ganham rótulo', () => {
    const c = velocidade(100);
    const normalidade: CartaoMetricaUi = { ...c, referencias: c.referencias.map((r) => ({ ...r, tipo: undefined })) };
    expect(resumoEmLinhas([normalidade], [])[0]).not.toContain(' — ');
    expect(resumoEmLinhas([{ ...c, referencias: [] }], [])[0]).toBe(`• ${c.titulo}: ${c.valores[0].texto}`);
  });
});

describe('PDF: "Como ler cada métrica" traz a ressalva da fonte que classificou o valor', () => {
  it('100 cm/s (dentro só de Bohannon e Andrews, 2011): a ressalva dos autores sobre trecho curto, comando "vá" e curva vem junto', () => {
    const notas = notasDasMetricas([velocidade(100)]);
    expect(T).toBeTruthy();
    const nota = notas.find((n) => n.startsWith(`${T}, Bohannon e Andrews, 2011:`));
    expect(nota).toBeDefined();
    expect(nota).toMatch(/Os autores ressalvam que os dados podem não servir de padrão de normalidade se a velocidade for medida em distâncias curtas a partir do comando "vá", ou se houver curva\./);
    expect(nota).toMatch(/provavelmente se aplica/);
    expect(notas.some((n) => n.includes('Bohannon, 1997'))).toBe(false);
  });

  it('fora de todas as faixas (150 cm/s) ou dentro das duas (135): as duas fontes vêm, cada uma com a sua nota', () => {
    for (const v of [135, 150]) {
      const notas = notasDasMetricas([velocidade(v)]);
      expect(notas.some((n) => n.startsWith(`${T}, Bohannon, 1997:`)), String(v)).toBe(true);
      expect(notas.some((n) => n.startsWith(`${T}, Bohannon e Andrews, 2011:`)), String(v)).toBe(true);
    }
  });

  it('limiar de cadência: a nota diz que andar abaixo não indica alteração por si só', () => {
    const [nota] = notasDasMetricas([cadencia(88)]);
    expect(nota).toMatch(/^Cadência, Tudor-Locke et al\., 2018: Limiar prático de intensidade moderada/);
    expect(nota).toMatch(/não indica alteração por si só\.$/);
  });

  it('métrica sem referência não ganha nota de fonte, e valor sem referência não puxa a nota', () => {
    const c = velocidade(100);
    expect(notasDasMetricas([{ ...c, referencias: [], detalhe: undefined, formula: undefined, avisos: [] }])).toEqual([]);
    const semStatus: CartaoMetricaUi = { ...c, detalhe: undefined, formula: undefined, avisos: [], valores: c.valores.map((v) => ({ ...v, status: 'sem_referencia' as const })) };
    expect(notasDasMetricas([semStatus])).toEqual([]);
  });
});
