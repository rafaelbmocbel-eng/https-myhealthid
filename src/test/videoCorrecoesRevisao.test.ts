import { describe, expect, it } from 'vitest';
import { remapearCapturas, type CapturaManual } from '../lib/angular/analiseVideo/medidaManual';
import { quadroComPontos, sugestoesDePontosAusentes } from '../lib/angular/analiseVideo/marcacoes';
import { cartaoTemAlerta, naturezaDasReferencias, referenciaPrincipal, situacaoDoCartaoTexto, situacaoDoValor, situacaoEhNeutra } from '../lib/angular/analiseVideo/statusReferencia';
import { cartoesDeMetricas } from '../lib/angular/analiseVideo/resultados';
import type { CartaoMetricaUi } from '../lib/angular/analiseVideo/tiposUi';
import { incertezaDoCartaoTexto, notasDasMetricas, referenciaDoCartaoTexto } from '../lib/angular/relatorioVideo';
import { buscarQuadro, calcularLayoutConteudo, itensDeCartoes, tamanhoOriginal, LIMITES_EXPORTACAO } from '../lib/angular/video/exportarVideo';
import { legendaDosAngulos, anguloJoelho, anguloTornozelo } from '../lib/angular/video/angulos';
import { modeloDoGesto } from '../lib/angular/video/modelos';
import { criarTrilha } from '../lib/angular/video/trilha';
import { ehCancelamento, rastrearVideo } from '../lib/angular/video/rastrear';
import { criarVideoFalso } from '../lib/angular/video/videoFalso';
import type { ResultadoMetrica } from '../lib/angular/video/tipos';

const captura = (quadro: number, t: number): CapturaManual => ({ uid: `c${quadro}`, medidaId: 'joelho-d', nome: 'Joelho direito', t, quadro, pontos: [], valor: 40, unidade: 'graus', texto: '40°' });

describe('medidas guardadas acompanham o instante quando a trilha muda de taxa', () => {
  it('vídeo a 60 q/s medido à mão e depois rastreado a 30 q/s: a medida de 1,70 s aponta o quadro 51, não o 103', () => {
    const tempos30 = Array.from({ length: 179 }, (_, i) => i / 30);
    const r = remapearCapturas([captura(103, 1.7)], tempos30);
    expect(r.foraDoTrecho).toBe(0);
    expect(r.capturas[0].quadro).toBe(51);
    expect(tempos30[r.capturas[0].quadro]).toBeCloseTo(1.7, 6);
  });

  it('não mexe nas medidas que já apontam o quadro certo e mantém na lista, sem apagar, as que ficaram fora do trecho rastreado', () => {
    const tempos = Array.from({ length: 31 }, (_, i) => 2 + i / 30);
    const ok = captura(5, 2 + 5 / 30);
    const fora1 = captura(10, 0.5), fora2 = captura(3000, 40);
    const r = remapearCapturas([ok, fora1, fora2], tempos);
    expect(r.capturas).toHaveLength(3);
    expect(r.capturas.find((c) => c.uid === ok.uid)).toBe(ok);
    expect(r.capturas.find((c) => c.uid === fora1.uid)).toBe(fora1);
    expect(r.capturas.find((c) => c.uid === fora2.uid)).toBe(fora2);
    expect(r.foraDoTrecho).toBe(2);
    expect(remapearCapturas([ok], []).foraDoTrecho).toBe(1);
    expect(remapearCapturas([ok], []).capturas).toEqual([ok]);
  });
});

describe('alças fantasma: onde sugerir os pontos que o detector perdeu', () => {
  const q = (i: number, pontos: Record<string, { x: number; y: number; conf?: number }>) => ({ i, t: i / 30, pontos });
  const trilha = criarTrilha(30, 640, 480, [
    q(0, { joelho_d: { x: 100, y: 200, conf: 0.9 }, tornozelo_d: { x: 100, y: 300, conf: 0.9 } }),
    q(1, { joelho_d: { x: 110, y: 200, conf: 0.9 }, tornozelo_d: { x: 112, y: 300, conf: 0.05 } }),
    q(2, {}),
    q(3, { joelho_d: { x: 130, y: 200, conf: 0.9 } }),
  ]);
  const nomes = ['joelho_d', 'tornozelo_d'];

  it('ponto de baixa confiança sugere o valor bruto do próprio quadro; o utilizável não entra', () => {
    const s = sugestoesDePontosAusentes(trilha, 1, nomes);
    expect(s.joelho_d).toBeUndefined();
    expect(s.tornozelo_d).toEqual({ x: 112, y: 300 });
  });

  it('quadro sem corpo sugere a posição do quadro vizinho mais próximo em que o ponto é utilizável', () => {
    const s = sugestoesDePontosAusentes(trilha, 2, nomes);
    expect(s.joelho_d).toEqual({ x: 110, y: 200 });
    expect(s.tornozelo_d).toEqual({ x: 100, y: 300 });
    expect(sugestoesDePontosAusentes(trilha, 2, nomes, 0)).toEqual({});
    expect(sugestoesDePontosAusentes(trilha, 99, nomes)).toEqual({});
  });

  it('arrastar um ponto que o quadro não tem cria o ponto corrigido na cópia do quadro, sem tocar na trilha', () => {
    const movido = quadroComPontos(trilha.quadros[2], { joelho_d: { x: 120, y: 210 } });
    expect(movido.pontos.joelho_d).toEqual({ x: 120, y: 210, manual: true, conf: 1 });
    expect(trilha.quadros[2].pontos.joelho_d).toBeUndefined();
  });
});

describe('o que "dentro" e "fora" querem dizer', () => {
  it('faixa de médias de grupos e limiar prático não geram alerta; faixa de normalidade gera', () => {
    expect(naturezaDasReferencias([])).toBe('normalidade');
    expect(naturezaDasReferencias([{ tipo: 'faixa_de_medias' }, { tipo: 'faixa_de_medias' }])).toBe('faixa_de_medias');
    expect(naturezaDasReferencias([{ tipo: 'limiar_heuristico' }])).toBe('limiar_heuristico');
    expect(naturezaDasReferencias([{ tipo: 'faixa_de_medias' }, {}])).toBe('normalidade');
    expect(situacaoDoValor('fora', 'normalidade')).toEqual({ texto: 'fora da referência', alerta: true });
    expect(situacaoDoValor('fora', 'faixa_de_medias')).toEqual({ texto: 'fora da faixa das médias do estudo', alerta: false });
    expect(situacaoDoValor('fora', 'limiar_heuristico').alerta).toBe(false);
    expect(situacaoDoValor('dentro', 'faixa_de_medias').texto).toBe('dentro da faixa das médias do estudo');
    expect(situacaoDoValor('sem_referencia', 'normalidade').texto).toBe('sem referência');
  });

  const bohannon11 = { rotulo: 'Bohannon e Andrews, 2011', citacao: 'Bohannon RW, Williams Andrews A.' };
  const bohannon97 = { rotulo: 'Bohannon, 1997', citacao: 'Bohannon RW.' };
  const tudor = { rotulo: 'Tudor-Locke et al., 2018', citacao: 'Tudor-Locke C, et al.', limiteMin: '100 passos/min' };

  it('faixa de médias: dentro e fora são o mesmo texto neutro, sempre com o rótulo da fonte', () => {
    expect(situacaoDoValor('dentro', 'faixa_de_medias', [bohannon11])).toEqual({ texto: 'dentro da faixa das médias do estudo (Bohannon e Andrews, 2011)', alerta: false });
    expect(situacaoDoValor('fora', 'faixa_de_medias', [bohannon11])).toEqual({ texto: 'fora da faixa das médias do estudo (Bohannon e Andrews, 2011)', alerta: false });
    expect(situacaoDoValor('fora', 'faixa_de_medias', [bohannon97, bohannon11]).texto).toBe('fora da faixa das médias do estudo (Bohannon, 1997; Bohannon e Andrews, 2011)');
    expect(situacaoEhNeutra('faixa_de_medias')).toBe(true);
    expect(situacaoEhNeutra('limiar_heuristico')).toBe(true);
    expect(situacaoEhNeutra('normalidade')).toBe(false);
  });

  it('limiar: acima/abaixo do limiar de <valor><unidade>, nunca dentro/fora, com a fonte', () => {
    expect(situacaoDoValor('dentro', 'limiar_heuristico', [tudor])).toEqual({ texto: 'acima do limiar de 100 passos/min (Tudor-Locke et al., 2018)', alerta: false });
    expect(situacaoDoValor('fora', 'limiar_heuristico', [tudor])).toEqual({ texto: 'abaixo do limiar de 100 passos/min (Tudor-Locke et al., 2018)', alerta: false });
    expect(situacaoDoValor('dentro', 'limiar_heuristico', [{ ...tudor, limiteMin: undefined, limiteMax: '8 s' }]).texto).toBe('abaixo do limiar de 8 s (Tudor-Locke et al., 2018)');
    for (const status of ['dentro', 'fora'] as const) expect(situacaoDoValor(status, 'limiar_heuristico', [tudor]).texto).not.toMatch(/dentro|fora/);
    expect(situacaoDoValor('fora', 'limiar_heuristico').texto).toBe('abaixo do limiar');
  });

  it('o cartão da cadência (limiar) diz acima/abaixo do limiar de 100 passos/min, vindo da tabela de referências', () => {
    const cadencia = (v: number): ResultadoMetrica => ({ id: 'cadencia', metrica: 'cadencia', nome: 'Cadência', valor: v, unidade: 'passos/min', lado: null, avisos: [] });
    const acima = cartoesDeMetricas([cadencia(109)], modeloDoGesto('marcha'))[0];
    const abaixo = cartoesDeMetricas([cadencia(90)], modeloDoGesto('marcha'))[0];
    expect(acima.referencias[0].limiteMin).toBe('100 passos/min');
    expect(situacaoDoCartaoTexto(acima)).toBe('acima do limiar de 100 passos/min (Tudor-Locke et al., 2018)');
    expect(situacaoDoCartaoTexto(abaixo)).toBe('abaixo do limiar de 100 passos/min (Tudor-Locke et al., 2018)');
    expect(cartaoTemAlerta(abaixo)).toBe(false);
  });

  it('a situação de um lado só cita as faixas que o valor satisfaz; fora, cita todas', () => {
    const c = (v: number) => cartoesDeMetricas([{ id: 'velocidade_marcha', metrica: 'velocidade_marcha', nome: 'Velocidade da marcha', valor: v, unidade: 'cm/s', lado: null, avisos: [] }], modeloDoGesto('marcha'))[0];
    expect(situacaoDoCartaoTexto(c(100))).toBe('dentro da faixa das médias do estudo (Bohannon e Andrews, 2011)');
    expect(situacaoDoCartaoTexto(c(135))).toBe('dentro da faixa das médias do estudo (Bohannon, 1997; Bohannon e Andrews, 2011)');
    expect(situacaoDoCartaoTexto(c(150))).toBe('fora da faixa das médias do estudo (Bohannon, 1997; Bohannon e Andrews, 2011)');
  });

  it('lados com situações diferentes dividem a frase: "D dentro · E fora da faixa … (fonte)"', () => {
    const base = cartoesDeMetricas([{ id: 'velocidade_marcha', metrica: 'velocidade_marcha', nome: 'Velocidade da marcha', valor: 100, unidade: 'cm/s', lado: null, avisos: [] }], modeloDoGesto('marcha'))[0];
    const refs = base.referencias.filter((r) => r.pmid === '21820535');
    const duplo: CartaoMetricaUi = {
      ...base, referencias: refs,
      valores: [{ lado: 'D', texto: '100 cm/s', status: 'dentro', dentroDe: [refs[0].chave as string] }, { lado: 'E', texto: '150 cm/s', status: 'fora' }],
    };
    expect(situacaoDoCartaoTexto(duplo)).toBe('D dentro · E fora da faixa das médias do estudo (Bohannon e Andrews, 2011)');
  });
});

const velocidade = (valor: number): ResultadoMetrica => ({ id: 'velocidade_marcha', metrica: 'velocidade_marcha', nome: 'Velocidade da marcha', valor, unidade: 'cm/s', lado: null, avisos: [] });
const cartaoDaVelocidade = (v: number): CartaoMetricaUi => cartoesDeMetricas([velocidade(v)], modeloDoGesto('marcha'))[0];

describe('cartão do vídeo mostra a faixa que explica o "dentro"', () => {
  it('100 cm/s está dentro de Bohannon e Andrews (2011), não de Bohannon (1997): o cartão mostra a de 2011', () => {
    const c = cartaoDaVelocidade(100);
    expect(c.valores[0].status).toBe('dentro');
    expect(c.referencias.map((r) => r.pmid)).toEqual(['9143432', '21820535']);
    const [item] = itensDeCartoes([c]);
    expect(item.referencia).toBe('94,3 a 143,4 cm/s · Bohannon e Andrews, 2011 · PMID 21820535');
    expect(item.natureza).toBe('faixa_de_medias');
    // dentro e fora têm o mesmo símbolo neutro (nada de aprovação verde); quem diferencia é o texto, com a fonte
    expect(item.valores[0].status).toBe('neutro');
    expect(item.situacao).toBe('dentro da faixa das médias do estudo (Bohannon e Andrews, 2011)');
    expect(item.referencia).not.toBeNull();
  });

  it('145 cm/s só está na faixa de 1997 e o cartão mostra essa; 135 está nas duas e mostra a primeira', () => {
    expect(itensDeCartoes([cartaoDaVelocidade(145)])[0].referencia).toMatch(/Bohannon, 1997 · PMID 9143432$/);
    expect(itensDeCartoes([cartaoDaVelocidade(135)])[0].referencia).toMatch(/Bohannon, 1997/);
    expect(referenciaPrincipal(cartaoDaVelocidade(100))?.rotulo).toBe('Bohannon e Andrews, 2011');
  });

  it('150 cm/s (acima das duas faixas de médias) não vira alerta: fora tem o mesmo símbolo neutro do dentro, no vídeo e no cartão', () => {
    const c = cartaoDaVelocidade(150);
    expect(c.valores[0].status).toBe('fora');
    expect(cartaoTemAlerta(c)).toBe(false);
    const [item] = itensDeCartoes([c]);
    const [dentro] = itensDeCartoes([cartaoDaVelocidade(100)]);
    expect(item.valores[0].status).toBe('neutro');
    expect(item.valores[0].status).toBe(dentro.valores[0].status);
    expect(item.situacao).toBe('fora da faixa das médias do estudo (Bohannon, 1997; Bohannon e Andrews, 2011)');
    expect(item.referencia).toMatch(/PMID 9143432$/);
  });

  it('o cartão da cadência no vídeo diz acima/abaixo do limiar e tem o mesmo símbolo neutro dos dois lados', () => {
    const cadencia = (v: number): ResultadoMetrica => ({ id: 'cadencia', metrica: 'cadencia', nome: 'Cadência', valor: v, unidade: 'passos/min', lado: null, avisos: [] });
    const [acima] = itensDeCartoes(cartoesDeMetricas([cadencia(109)], modeloDoGesto('marcha')));
    const [abaixo] = itensDeCartoes(cartoesDeMetricas([cadencia(90)], modeloDoGesto('marcha')));
    expect(acima.valores[0].status).toBe('neutro');
    expect(abaixo.valores[0].status).toBe('neutro');
    expect(acima.situacao).toBe('acima do limiar de 100 passos/min (Tudor-Locke et al., 2018)');
    expect(abaixo.situacao).toBe('abaixo do limiar de 100 passos/min (Tudor-Locke et al., 2018)');
  });

  it('a nota de Bohannon e Andrews traz a ressalva de distância curta e curva', () => {
    const nota = cartaoDaVelocidade(100).referencias.find((r) => r.pmid === '21820535')?.nota ?? '';
    expect(nota).toMatch(/distâncias curtas/);
    expect(nota).toMatch(/curva/);
  });

  it('o PDF diz o que cada faixa é', () => {
    const texto = referenciaDoCartaoTexto(cartaoDaVelocidade(100));
    expect(texto).toMatch(/médias do estudo/);
    expect(texto).toMatch(/PMID 21820535/);
  });
});

describe('incerteza, avisos e fórmula chegam ao PDF e ao vídeo', () => {
  const assimetria: ResultadoMetrica = {
    id: 'assimetria_tempo_passo', metrica: 'assimetria_tempo_passo', nome: 'Assimetria do tempo do passo', valor: 3, unidade: '%', lado: null, incerteza: 6.2, n: 8, dp: 1.1,
    formula: 'IS = |D − E| ÷ ((D + E) ÷ 2) × 100 (0% = simetria perfeita)', avisos: ['A diferença entre os lados é menor que o erro de um quadro do vídeo (cerca de 6,2%): pode ser só a resolução do vídeo.'],
  };
  const cartao = cartoesDeMetricas([assimetria], modeloDoGesto('marcha'))[0];

  it('o valor leva o erro de um quadro e o cartão do vídeo marca a ressalva', () => {
    expect(cartao.valores[0].incertezaCurta).toMatch(/^± 6,2/);
    expect(incertezaDoCartaoTexto(cartao)).toMatch(/^± 6,2/);
    const [item] = itensDeCartoes([cartao]);
    expect(item.valores[0].incerteza).toMatch(/^± 6,2/);
    expect(item.comAviso).toBe(true);
  });

  it('as ressalvas do PDF juntam fórmula, desvio-padrão, erro e aviso da métrica', () => {
    const [nota] = notasDasMetricas([cartao]);
    expect(nota).toMatch(/^Assimetria do tempo de passo/);
    expect(nota).toMatch(/Cálculo: IS = \|D − E\|/);
    expect(nota).toMatch(/desvio-padrão/);
    expect(nota).toMatch(/resolução do vídeo/);
    expect(nota).toMatch(/menor que o erro de um quadro/);
    expect(notasDasMetricas([{ ...cartao, detalhe: undefined, formula: undefined, avisos: [], valores: [{ lado: null, texto: '1', status: 'sem_referencia' }] }])).toEqual([]);
  });
});

describe('sentido do sinal dos ângulos', () => {
  it('a legenda junta as descrições sem repetir e explica o neutro do tornozelo', () => {
    expect(legendaDosAngulos([anguloJoelho('D'), anguloJoelho('E')])).toBe('Flexão do joelho (0° = estendido).');
    const tornozelo = legendaDosAngulos([anguloTornozelo('D')]);
    expect(tornozelo).toMatch(/0° = neutro/);
    expect(tornozelo).toMatch(/medida manual do tornozelo o neutro é 90°/);
    expect(legendaDosAngulos([])).toBe('');
  });
});

describe('altura do quadro do vídeo original nunca passa de 1920', () => {
  it('vídeos verticais de celular, com e sem gráfico, de 0 a 30 métricas', () => {
    for (const [vw, vh] of [[1080, 1920], [720, 1280], [2160, 3840], [1080, 2340]] as const) {
      for (const grafico of [false, true]) {
        for (let n = 0; n <= 30; n++) {
          const l = tamanhoOriginal(vw, vh, grafico, n);
          expect(l.altura, `${vw}x${vh} grafico=${grafico} n=${n}`).toBeLessThanOrEqual(LIMITES_EXPORTACAO.alturaMaxima);
          expect(l.altura % 2).toBe(0);
          expect(l.largura % 2).toBe(0);
        }
      }
    }
  });

  it('o caso que travava: 1080×1920 sem gráfico e com 5 métricas', () => {
    expect(tamanhoOriginal(1080, 1920, false, 5).altura).toBeLessThanOrEqual(1920);
    expect(calcularLayoutConteudo({ larguraVideo: 1080, alturaVideo: 1920, largura: 1080, grafico: false, nCartoes: 6 }).altura).toBeLessThanOrEqual(1920);
  });
});

describe('cancelar não espera o que não responde', () => {
  it('o rastreio devolve o controle na hora se o detector está baixando o modelo e o profissional cancela', async () => {
    const ctrl = new AbortController();
    const fases: boolean[] = [];
    const detectorTravado = () => new Promise<never>(() => undefined);
    const inicio = Date.now();
    const p = rastrearVideo(criarVideoFalso({ duracao: 3 }), { fps: 10, detector: detectorTravado, sinal: ctrl.signal, onPreparando: (x) => fases.push(x) });
    setTimeout(() => ctrl.abort(), 30);
    const erro = await p.catch((e) => e);
    expect(ehCancelamento(erro)).toBe(true);
    expect(Date.now() - inicio).toBeLessThan(1500);
    expect(fases).toEqual([true, false]);
  });

  it('buscarQuadro rejeita com cancelamento assim que o sinal dispara, sem esperar o limite de 4 s', async () => {
    const ctrl = new AbortController();
    const video = criarVideoFalso({ duracao: 5, atrasoBuscaMs: 60_000 });
    const inicio = Date.now();
    const p = buscarQuadro(video, 2, 4000, ctrl.signal);
    setTimeout(() => ctrl.abort(), 20);
    const erro = await p.catch((e) => e);
    expect(ehCancelamento(erro)).toBe(true);
    expect(Date.now() - inicio).toBeLessThan(1000);
    await expect(buscarQuadro(video, 3, 4000, ctrl.signal)).rejects.toMatchObject({ name: 'AbortError' });
  });
});
