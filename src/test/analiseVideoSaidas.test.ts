import { describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/pdfLogoHelper', () => ({ addLogoToDoc: vi.fn(async () => {}) }));

import { configurar, trilhaSintetica } from '../lib/angular/video/figuraSintetica';
import { analisarGesto } from '../lib/angular/video/metricas';
import { modeloDoGesto } from '../lib/angular/video/modelos';
import { anguloJoelho, inclinacaoTronco } from '../lib/angular/video/angulos';
import { contextoDesenho } from '../lib/angular/desenho';
import { ESTILO_INSTAGRAM } from '../lib/angular/estilo';
import { MEDIDAS_VIDEO } from '../lib/angular/medidasVideo';
import { itensDoQuadroAnalisado } from '../lib/angular/analiseVideo/marcacoes';
import { itensManuais, resultadoManual, sugerirDaTrilha, textoDoValor } from '../lib/angular/analiseVideo/medidaManual';
import { cartoesDeMetricas, compararLados, gruposDeArticulacoes, resumoDaSerie } from '../lib/angular/analiseVideo/resultados';
import { canvasDoGrafico } from '../lib/angular/analiseVideo/graficoCanvas';
import { quadrosDosExtremos, resumoEmLinhas } from '../components/angular/video/saidas';
import { cartaoTemValor, gerarRelatorioGesto, referenciaDoCartaoTexto, valorDoCartaoTexto } from '../lib/angular/relatorioVideo';

const trilha = trilhaSintetica(configurar('marcha'), 30, 6);
const modelo = modeloDoGesto('marcha');
const analise = analisarGesto(modelo, trilha);
const cartoes = cartoesDeMetricas(analise.metricas, modelo);
const grupos = gruposDeArticulacoes(modelo.articulacoes);

describe('quadro marcado no estilo escolhido', () => {
  const ctx = contextoDesenho(trilha.largura, trilha.altura, ESTILO_INSTAGRAM);
  const defs = [anguloJoelho('D'), anguloJoelho('E'), inclinacaoTronco];

  it('traz esqueleto, ângulos com rótulo e pontos, com os rótulos por cima', () => {
    const itens = itensDoQuadroAnalisado(trilha.quadros[40], ctx, { defs, direcao: 1 });
    const tipos = new Set(itens.map((i) => i.tipo));
    for (const t of ['reta', 'arco', 'ponto', 'rotulo'] as const) expect(tipos.has(t)).toBe(true);
    const rotulos = itens.filter((i) => i.tipo === 'rotulo');
    expect(rotulos.length).toBe(3);
    const ultimoNaoRotulo = itens.map((i) => i.tipo).lastIndexOf('ponto');
    const primeiroRotulo = itens.findIndex((i) => i.tipo === 'rotulo');
    expect(primeiroRotulo).toBeGreaterThan(ultimoNaoRotulo);
  });

  it('o estilo vale: sem arco e sem rótulo os ângulos somem do desenho', () => {
    const sem = contextoDesenho(trilha.largura, trilha.altura, { ...ESTILO_INSTAGRAM, mostrarArco: false, mostrarRotulo: false });
    const itens = itensDoQuadroAnalisado(trilha.quadros[40], sem, { defs, direcao: 1 });
    expect(itens.some((i) => i.tipo === 'arco' || i.tipo === 'rotulo')).toBe(false);
  });

  it('pode desligar esqueleto ou ângulos, e quadro sem pontos não desenha nada', () => {
    expect(itensDoQuadroAnalisado(trilha.quadros[40], ctx, { defs, direcao: 1, esqueleto: false }).every((i) => i.tipo !== 'ponto')).toBe(true);
    expect(itensDoQuadroAnalisado(trilha.quadros[40], ctx, { defs, direcao: 1, angulos: false }).some((i) => i.tipo === 'rotulo')).toBe(false);
    expect(itensDoQuadroAnalisado({ i: 0, t: 0, pontos: {} }, ctx, { defs, direcao: 1 })).toEqual([]);
    expect(itensDoQuadroAnalisado(undefined, ctx, { defs, direcao: 1 })).toEqual([]);
  });
});

describe('medidas feitas à mão', () => {
  const livre = MEDIDAS_VIDEO.find((m) => m.id === 'livre')!;
  const regua = MEDIDAS_VIDEO.find((m) => m.id === 'regua')!;
  const pts = [{ x: 0, y: 100 }, { x: 0, y: 0 }, { x: 100, y: 0 }];

  it('o valor só sai com todos os pontos e a unidade acompanha a ferramenta', () => {
    expect(resultadoManual(livre, pts.slice(0, 2), null, null)).toBeNull();
    const r = resultadoManual(livre, pts, null, null)!;
    expect(r.valor).toBeCloseTo(90, 5);
    expect(r.unidade).toBe('graus');
    expect(textoDoValor(r.valor, r.unidade, 0)).toBe('90°');
    expect(resultadoManual(regua, [{ x: 0, y: 0 }, { x: 30, y: 40 }], null, 0.5)!.valor).toBeCloseTo(25, 5);
    expect(textoDoValor(25, 'cm')).toBe('25,0 cm');
  });

  it('referências (nível e escala) não geram resultado', () => {
    const nivel = MEDIDAS_VIDEO.find((m) => m.id === 'nivel')!;
    expect(resultadoManual(nivel, [{ x: 0, y: 0 }, { x: 10, y: 1 }], null, null)).toBeNull();
  });

  it('desenha no estilo escolhido: arco e rótulo com o valor', () => {
    const itens = itensManuais(livre, pts, contextoDesenho(640, 480, ESTILO_INSTAGRAM), { giro: null, cmPorPx: null });
    expect(itens.some((i) => i.tipo === 'arco')).toBe(true);
    const rotulo = itens.find((i) => i.tipo === 'rotulo');
    expect(rotulo && rotulo.tipo === 'rotulo' && rotulo.texto).toBe('90°');
    expect(itensManuais(livre, [], contextoDesenho(640, 480, ESTILO_INSTAGRAM), { giro: null, cmPorPx: null })).toEqual([]);
  });

  it('sugere os pontos da articulação pelo rastreio, com o lado certo', () => {
    const q = trilha.quadros[40];
    const d = sugerirDaTrilha('joelho-d', q)!;
    expect(d).toHaveLength(3);
    expect(d[1].x).toBeCloseTo(q.pontos.joelho_d.x, 5);
    const e = sugerirDaTrilha('quadril-e', q)!;
    expect(e[0].x).toBeCloseTo(q.pontos.ombro_e.x, 5);
    expect(sugerirDaTrilha('regua', q)).toBeNull();
    expect(sugerirDaTrilha('joelho-d', { i: 0, t: 0, pontos: {} })).toBeNull();
    expect(sugerirDaTrilha('joelho-d', undefined)).toBeNull();
  });
});

describe('resumos e comparação', () => {
  it('resumo da curva: mínimo, máximo, amplitude e média só das amostras válidas', () => {
    const r = resumoDaSerie({ id: 'a', rotulo: 'D', cor: '#000', pontos: [{ t: 0, v: 10 }, { t: 1, v: null }, { t: 2, v: 30 }] });
    expect(r).toEqual({ min: 10, max: 30, adm: 20, media: 20, n: 2 });
    expect(resumoDaSerie({ id: 'a', rotulo: 'D', cor: '#000', pontos: [{ t: 0, v: null }] }).adm).toBeNull();
  });

  it('compara só as articulações que têm os dois lados, com o índice de assimetria', () => {
    const linhas = compararLados(grupos, analise.series);
    expect(linhas.map((l) => l.grupoId)).toEqual(['quadril', 'joelho', 'tornozelo', 'coxa', 'tibia']);
    const joelho = linhas.find((l) => l.grupoId === 'joelho')!;
    expect(joelho.D.adm).toBeGreaterThan(40);
    expect(joelho.assimetriaAdm).toBeLessThan(5);
  });

  it('os quadros dos extremos da curva vão para o relatório', () => {
    expect(quadrosDosExtremos([1, 5, null, 9, 2])).toEqual([0, 3]);
    expect(quadrosDosExtremos([null, null])).toEqual([]);
    expect(quadrosDosExtremos([4, 4])).toEqual([0]);
  });

  it('o resumo em linhas traz os valores, a fonte da referência e as medidas à mão', () => {
    const linhas = resumoEmLinhas(cartoes, [{ uid: 'u', medidaId: 'livre', nome: 'Ângulo livre (3 pontos)', t: 1.5, quadro: 44, pontos: [], valor: 90, unidade: 'graus', texto: '' }]);
    expect(linhas.find((l) => l.startsWith('• Cadência'))).toMatch(/109 passos\/min \(referência: ≥ 100 passos\/min, Tudor-Locke et al\., 2018, PMID 29858465 — limiar prático, não é faixa de normalidade\)/);
    expect(linhas.find((l) => l.startsWith('• Amplitude do joelho'))).toMatch(/D 55,5° · E 55,5°/);
    expect(linhas[linhas.length - 1]).toBe('• 1,50 s (quadro 45) — Ângulo livre (3 pontos): 90,0°');
  });
});

describe('gráfico em canvas', () => {
  it('sem canvas (testes) devolve null em vez de quebrar', () => {
    const joelho = grupos.find((g) => g.id === 'joelho')!;
    const series = joelho.defs.map((d) => ({ id: d.id, rotulo: d.lado ?? '', cor: '#000', pontos: analise.series[d.id].map((a) => ({ t: a.t, v: a.graus })) }));
    const espia = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(canvasDoGrafico({ series, t0: 0, duracao: 6 }, 360, 190)).toBeNull();
    espia.mockRestore();
  });
});

describe('relatório PDF da análise de gesto', () => {
  const dados = {
    paciente: 'Rosilda Sousa Borges', profissional: 'Dra. Teste · CREFITO 1', data: '12/10/2026',
    modelo: { nome: modelo.nome, vista: 'Vista lateral' }, duracaoS: 6, fpsAnalise: 30, cartoes,
    graficos: [], quadros: [], correcoes: { quadros: 2, pontos: 3 }, eventosEditados: 1, avisoReferencias: 'Aviso das referências.', avisos: ['Aviso do gesto.'],
  };

  it('só entram na tabela as métricas com valor, com a referência e a fonte', () => {
    const comValor = cartoes.filter(cartaoTemValor);
    expect(comValor.length).toBeLessThan(cartoes.length);
    expect(comValor.some((c) => c.chave === 'velocidade_marcha')).toBe(false);
    const cad = cartoes.find((c) => c.chave === 'cadencia')!;
    expect(valorDoCartaoTexto(cad)).toBe('109 passos/min');
    expect(referenciaDoCartaoTexto(cad)).toMatch(/PMID 29858465/);
    expect(referenciaDoCartaoTexto(cartoes.find((c) => c.chave === 'adm_joelho')!)).toBe('sem referência');
    expect(valorDoCartaoTexto(cartoes.find((c) => c.chave === 'adm_joelho')!)).toMatch(/^D 55,5°\s+·\s+E 55,5°$/);
  });

  it('gera o PDF com nome seguro e conteúdo', async () => {
    const { blob, nome } = await gerarRelatorioGesto(dados);
    expect(nome).toBe('Analise_marcha_caminhada__ROSILDA_SOUSA_BORGES_2026-10-12.pdf');
    expect(blob.size).toBeGreaterThan(3000);
    expect(blob.type).toBe('application/pdf');
  });

  it('gera mesmo sem métricas, gráficos e quadros', async () => {
    const { blob } = await gerarRelatorioGesto({ ...dados, cartoes: [], avisos: undefined, correcoes: { quadros: 0, pontos: 0 }, eventosEditados: 0 });
    expect(blob.size).toBeGreaterThan(1500);
  });
});
