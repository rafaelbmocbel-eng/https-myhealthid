import { describe, expect, it } from 'vitest';
import { estimarLargura } from '@/lib/social/fontes';
import {
  FORMATOS, ORDEM_FORMATOS, layoutEfetivo, layoutSugerido, layoutsDisponiveis, margensDoFormato, tituloModoSugerido, zonaSeguraDoTexto,
  type FormatoSocial, type LayoutArte, type Retangulo, type TituloModo,
} from '@/lib/social/formatos';
import {
  ENQUADRAMENTO_PADRAO, PERDA_MAXIMA_PREENCHER, ZOOM_MAX, ajusteSugerido, arrastarEnquadramento, caberNaCaixa, enquadramentoPorRosto, fracaoDaFotoSob, janelaDaImagem, posicaoNaArte, zoomarEnquadramento,
} from '@/lib/social/geometria';
import {
  ALTURA_PILULA, FONTE_NOTA, calcularLayoutSocial, ajustarTitulo, cortarComReticencias, fonteQueCabe, larguraDoTexto, normalizarTitulo, type ParametrosLayout,
} from '@/lib/social/layout';

const medir = estimarLargura;
const sobrepoe = (a: Retangulo, b: Retangulo) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
const dentroDe = (r: Retangulo, w: number, h: number) => r.x >= -0.5 && r.y >= -0.5 && r.x + r.w <= w + 0.5 && r.y + r.h <= h + 0.5;

const base = (o: Partial<ParametrosLayout> = {}): ParametrosLayout => ({
  formato: 'story', layout: 'empilhada', nPaineis: 2, margensStories: true, titulo: 'Pós operatório de SLAP', tituloModo: 'vertical',
  rotulos: ['Pré-Sessão', 'Pós-Sessão'], datas: ['11/10/2026', '25/10/2026'], legenda: '3ª Semana de PO', temAvatar: true, temSelo: true,
  perfis: ['rafaelmocbel', 'myhealthid.app', 'physio.mocbel'], ...o,
});

describe('formatos', () => {
  it('têm 1080 de largura e as alturas de story, feed e quadrado', () => {
    expect(ORDEM_FORMATOS.map((f) => [FORMATOS[f].largura, FORMATOS[f].altura])).toEqual([[1080, 1920], [1080, 1350], [1080, 1080]]);
  });

  it('sugere empilhada no story, lado a lado nos outros e uma foto sozinha quando só há uma', () => {
    expect(layoutSugerido('story', 2)).toBe('empilhada');
    expect(layoutSugerido('feed', 2)).toBe('lado_a_lado');
    expect(layoutSugerido('quadrado', 2)).toBe('lado_a_lado');
    expect(layoutSugerido('story', 1)).toBe('unica');
    expect(layoutsDisponiveis(1)).toEqual(['unica']);
    expect(layoutsDisponiveis(2)).toEqual(['empilhada', 'lado_a_lado']);
  });

  it('com menos de duas fotos qualquer layout vira "unica"; com duas, "unica" vira empilhada', () => {
    expect(layoutEfetivo('lado_a_lado', 1)).toBe('unica');
    expect(layoutEfetivo('unica', 2)).toBe('empilhada');
    expect(layoutEfetivo('lado_a_lado', 2)).toBe('lado_a_lado');
  });

  it('título vertical combina com coluna lateral; lado a lado pede título no topo', () => {
    expect(tituloModoSugerido('empilhada')).toBe('vertical');
    expect(tituloModoSugerido('unica')).toBe('vertical');
    expect(tituloModoSugerido('lado_a_lado')).toBe('horizontal');
  });

  it('as margens de Stories só valem para o story e reservam topo e base para a interface do Instagram', () => {
    const s = margensDoFormato('story', true);
    expect(s.texto.topo).toBeGreaterThanOrEqual(240);
    expect(s.texto.base).toBeGreaterThanOrEqual(300);
    expect(margensDoFormato('story', false).texto.topo).toBeLessThan(100);
    expect(margensDoFormato('feed', true)).toEqual(margensDoFormato('feed', false));
  });
});

describe('ajuste do título', () => {
  it('usa uma linha quando o título é curto e a coluna é fina', () => {
    const a = ajustarTitulo('PÓS OPERATÓRIO DE SLAP', medir, { comprimento: 1200, espessuraMax: 150, linhasMax: 3 });
    expect(a.linhas).toHaveLength(1);
    expect(a.comprimento).toBeLessThanOrEqual(1200 + 0.01);
    expect(a.espessura).toBeLessThanOrEqual(150 + 0.01);
  });

  it('quebra em mais linhas quando a largura é curta, sem estourar o comprimento', () => {
    const a = ajustarTitulo('ANTES E DEPOIS DA FISIOTERAPIA NO OMBRO', medir, { comprimento: 700, espessuraMax: 400, fonteMax: 132, linhasMax: 2 });
    expect(a.linhas.length).toBe(2);
    expect(a.comprimento).toBeLessThanOrEqual(700 + 0.01);
    expect(a.linhas.join(' ')).toBe('ANTES E DEPOIS DA FISIOTERAPIA NO OMBRO');
  });

  it('o corpo da fonte nunca passa do máximo e texto vazio não gera linhas', () => {
    expect(ajustarTitulo('OI', medir, { comprimento: 1500, espessuraMax: 500, fonteMax: 100 }).fonte).toBeLessThanOrEqual(100);
    expect(ajustarTitulo('   ', medir, { comprimento: 1500, espessuraMax: 500 }).linhas).toEqual([]);
  });

  it('normaliza o título em caixa alta e sem espaços sobrando', () => {
    expect(normalizarTitulo('  pós   operatório  ')).toBe('PÓS OPERATÓRIO');
    expect(normalizarTitulo(undefined)).toBe('');
  });

  it('reduz o corpo e corta com reticências o texto que não cabe', () => {
    expect(fonteQueCabe(medir, 'x'.repeat(10), 'texto', 34, 1000)).toBe(34);
    expect(fonteQueCabe(medir, 'x'.repeat(100), 'texto', 34, 400, 26)).toBe(26);
    const c = cortarComReticencias(medir, 'Uma legenda bem comprida demais para a pílula', 30, 'texto', 300);
    expect(c.endsWith('…')).toBe(true);
    expect(larguraDoTexto(medir, c, 30, 'texto')).toBeLessThanOrEqual(300);
    expect(cortarComReticencias(medir, 'curta', 30, 'texto', 300)).toBe('curta');
  });
});

describe('layout da arte, como na referência (story empilhada)', () => {
  const l = calcularLayoutSocial(base(), medir);

  it('tem duas fotos do mesmo tamanho, uma sobre a outra, "Pré" em cima e "Pós" embaixo', () => {
    expect(l.paineis).toHaveLength(2);
    expect(l.paineis[0].w).toBeCloseTo(l.paineis[1].w);
    expect(l.paineis[0].h).toBeCloseTo(l.paineis[1].h);
    expect(l.paineis[0].y).toBeLessThan(l.paineis[1].y);
    expect(l.rotulos.map((r) => r.texto)).toEqual(['Pré-Sessão', 'Pós-Sessão']);
  });

  it('põe o título vertical, girado, à esquerda das fotos e dos rótulos', () => {
    expect(l.tituloModo).toBe('vertical');
    expect(l.titulo?.rotacao).toBe(-90);
    expect(l.titulo!.caixa.x + l.titulo!.caixa.w).toBeLessThan(l.paineis[0].x);
    expect(l.rotulosGirados).toBe(true);
    l.rotulos.forEach((r) => {
      expect(r.rotacao).toBe(-90);
      expect(r.caixa.x).toBeGreaterThanOrEqual(l.titulo!.caixa.x + l.titulo!.caixa.w);
      expect(r.caixa.x + r.caixa.w).toBeLessThanOrEqual(l.paineis[0].x);
    });
  });

  it('centraliza cada rótulo girado na altura da sua foto', () => {
    l.rotulos.forEach((r, i) => expect(r.centro.y).toBeCloseTo(l.paineis[i].y + l.paineis[i].h / 2));
  });

  it('põe o selo no canto, acima do título, sem cobrir as fotos', () => {
    expect(l.selo?.sobreFoto).toBe(false);
    expect(l.selo!.cy + l.selo!.r).toBeLessThanOrEqual(l.titulo!.caixa.y);
    l.paineis.forEach((p) => expect(sobrepoe({ x: l.selo!.cx - l.selo!.r, y: l.selo!.cy - l.selo!.r, w: l.selo!.r * 2, h: l.selo!.r * 2 }, p)).toBe(false));
  });

  it('põe a pílula no rodapé esquerdo e os três perfis no rodapé direito, alinhados à direita', () => {
    expect(l.pilula).not.toBeNull();
    expect(l.pilula!.caixa.x).toBeCloseTo(l.margens.texto.esq);
    expect(l.pilula!.avatar).not.toBeNull();
    expect(l.perfis!.linhas.map((x) => x.texto)).toEqual(['@rafaelmocbel', '@myhealthid.app', '@physio.mocbel']);
    l.perfis!.linhas.forEach((p) => expect(p.x).toBeCloseTo(l.largura - l.margens.texto.dir));
    expect(l.perfis!.linhas[0].baseY).toBeLessThan(l.perfis!.linhas[2].baseY);
  });

  it('mantém texto, pílula e perfis fora das faixas que a interface do Instagram cobre', () => {
    const topoSeguro = l.margens.texto.topo, baseSegura = l.altura - l.margens.texto.base;
    expect(l.titulo!.caixa.y).toBeGreaterThanOrEqual(topoSeguro);
    expect(l.selo!.cy - l.selo!.r).toBeGreaterThanOrEqual(topoSeguro);
    expect(l.pilula!.caixa.y + l.pilula!.caixa.h).toBeLessThanOrEqual(baseSegura + 0.5);
    l.perfis!.linhas.forEach((p) => expect(p.baseY + 10).toBeLessThanOrEqual(baseSegura + 0.5));
    l.rotulos.forEach((r) => { expect(r.centro.y).toBeGreaterThanOrEqual(topoSeguro); expect(r.centro.y).toBeLessThanOrEqual(baseSegura); });
  });

  it('sem as margens de Stories as fotos ficam maiores', () => {
    const solto = calcularLayoutSocial(base({ margensStories: false }), medir);
    expect(solto.paineis[0].h).toBeGreaterThan(l.paineis[0].h);
  });
});

describe('outras disposições', () => {
  it('lado a lado com título no topo: fotos lado a lado, rótulos acima delas e selo no canto direito do topo', () => {
    const l = calcularLayoutSocial(base({ formato: 'feed', layout: 'lado_a_lado', tituloModo: 'horizontal', titulo: 'Antes e depois' }), medir);
    expect(l.paineis[0].y).toBeCloseTo(l.paineis[1].y);
    expect(l.paineis[0].x + l.paineis[0].w).toBeLessThan(l.paineis[1].x);
    expect(l.titulo!.rotacao).toBe(0);
    expect(l.titulo!.caixa.y + l.titulo!.caixa.h).toBeLessThan(l.paineis[0].y);
    expect(l.rotulosGirados).toBe(false);
    l.rotulos.forEach((r, i) => expect(r.caixa.y + r.caixa.h).toBeLessThanOrEqual(l.paineis[i].y + 0.5));
    expect(l.selo!.cx).toBeGreaterThan(l.largura / 2);
  });

  it('com título vertical e lado a lado os rótulos voltam para cima das fotos', () => {
    const l = calcularLayoutSocial(base({ layout: 'lado_a_lado' }), medir);
    expect(l.rotulosGirados).toBe(false);
  });

  it('uma foto só ocupa a região inteira', () => {
    const l = calcularLayoutSocial(base({ layout: 'unica', nPaineis: 1, rotulos: ['Hoje'], datas: [''] }), medir);
    expect(l.paineis).toHaveLength(1);
    expect(l.paineis[0].w).toBeGreaterThan(600);
  });

  it('sem título o selo vai sobre o canto da primeira foto', () => {
    const l = calcularLayoutSocial(base({ titulo: '', tituloModo: 'vertical' }), medir);
    expect(l.titulo).toBeNull();
    expect(l.tituloModo).toBe('nenhum');
    expect(l.selo?.sobreFoto).toBe(true);
    const p = l.paineis[0];
    expect(l.selo!.cx + l.selo!.r).toBeLessThanOrEqual(p.x + p.w);
    expect(l.selo!.cy - l.selo!.r).toBeGreaterThanOrEqual(p.y);
  });

  it('sem legenda, perfis e selo não reserva rodapé e as fotos crescem', () => {
    const com = calcularLayoutSocial(base(), medir);
    const sem = calcularLayoutSocial(base({ legenda: '', perfis: [], temSelo: false }), medir);
    expect(sem.rodape).toBeNull();
    expect(sem.pilula).toBeNull();
    expect(sem.perfis).toBeNull();
    expect(sem.selo).toBeNull();
    expect(sem.paineis[0].h).toBeGreaterThan(com.paineis[0].h);
  });

  it('aceita no máximo três perfis', () => {
    const l = calcularLayoutSocial(base({ perfis: ['a', 'b', 'c', 'd', 'e'] }), medir);
    expect(l.perfis!.linhas).toHaveLength(3);
  });

  it('legenda comprida é reduzida e cortada para caber ao lado dos perfis', () => {
    const l = calcularLayoutSocial(base({ legenda: 'Uma legenda muito mas muito comprida que não cabe na pílula do rodapé de jeito nenhum' }), medir);
    const maiorPerfil = Math.max(...l.perfis!.linhas.map((p) => p.largura));
    expect(l.pilula!.caixa.x + l.pilula!.caixa.w).toBeLessThan(l.largura - l.margens.texto.dir - maiorPerfil);
    expect(l.pilula!.texto.endsWith('…')).toBe(true);
    expect(l.pilula!.caixa.h).toBe(ALTURA_PILULA);
  });

  it('rótulo só com data ou só com texto continua com posição', () => {
    const l = calcularLayoutSocial(base({ rotulos: ['', 'Pós'], datas: ['11/10/2026', ''] }), medir);
    expect(l.rotulos).toHaveLength(2);
    expect(l.rotulos[0].texto).toBe('');
    expect(l.rotulos[1].data).toBe('');
  });
});

describe('nota fixa no pé da arte (ex.: "Estimativa por vídeo · não é diagnóstico")', () => {
  const NOTA = 'Estimativa por vídeo · não é diagnóstico · * ver ressalvas no PDF';

  it('sem nota nada muda: não há faixa de nota', () => {
    expect(calcularLayoutSocial(base(), medir).nota).toBeNull();
    expect(calcularLayoutSocial(base({ nota: '   ' }), medir).nota).toBeNull();
  });

  it('no story fica dentro da zona que o Instagram não cobre (14% de cima e 20% de baixo), com ou sem as margens de Stories', () => {
    const zona = zonaSeguraDoTexto('story');
    expect(zona).toEqual({ topo: 269, base: 1536 });
    for (const margensStories of [true, false]) {
      for (const legenda of ['3ª Semana de PO', '']) {
        const l = calcularLayoutSocial(base({ nota: NOTA, margensStories, nPaineis: 1, layout: 'unica', legenda, perfis: legenda ? ['rafael'] : [] }), medir);
        expect(l.nota, `${margensStories} ${legenda}`).not.toBeNull();
        const n = l.nota!;
        expect(n.caixa.y).toBeGreaterThanOrEqual(zona.topo);
        expect(n.caixa.y + n.caixa.h).toBeLessThanOrEqual(zona.base);
        expect(n.baseY).toBeLessThanOrEqual(zona.base);
        expect(dentroDe(n.caixa, 1080, 1920)).toBe(true);
      }
    }
  });

  it('nos outros formatos fica longe da borda e nunca sobre as fotos, a pílula ou os perfis', () => {
    for (const formato of ['story', 'feed', 'quadrado'] as FormatoSocial[]) {
      const l = calcularLayoutSocial(base({ formato, nota: NOTA, nPaineis: 1, layout: 'unica', tituloModo: 'horizontal' }), medir);
      const n = l.nota!;
      expect(FORMATOS[formato].altura - (n.caixa.y + n.caixa.h)).toBeGreaterThanOrEqual(48);
      for (const painel of l.paineis) expect(sobrepoe(n.caixa, painel), formato).toBe(false);
      if (l.pilula) expect(sobrepoe(n.caixa, l.pilula.caixa), formato).toBe(false);
      if (l.rodape) expect(sobrepoe(n.caixa, l.rodape), formato).toBe(false);
    }
  });

  it('o texto é proporcional ao quadro (2,4% da largura), legível no celular, e nunca é cortado: se não couber, o corpo encolhe', () => {
    const l = calcularLayoutSocial(base({ nota: NOTA, nPaineis: 1, layout: 'unica' }), medir);
    expect(l.nota!.texto).toBe(NOTA);
    expect(l.nota!.fonte).toBeGreaterThanOrEqual(20);
    expect(larguraDoTexto(medir, NOTA, l.nota!.fonte, 'texto')).toBeLessThanOrEqual(l.nota!.caixa.w + 0.5);
    const curta = calcularLayoutSocial(base({ nota: 'Estimativa por vídeo · não é diagnóstico', nPaineis: 1, layout: 'unica' }), medir);
    expect(curta.nota!.fonte).toBe(FONTE_NOTA);
    expect(FONTE_NOTA / 1080).toBeGreaterThan(0.023);
  });

  it('a nota é centralizada na largura da arte', () => {
    const l = calcularLayoutSocial(base({ nota: NOTA, nPaineis: 1, layout: 'unica' }), medir);
    expect(l.nota!.centroX).toBe(540);
  });
});

describe('todas as combinações cabem na arte sem sobreposição', () => {
  const formatos: FormatoSocial[] = ['story', 'feed', 'quadrado'];
  const layouts: LayoutArte[] = ['unica', 'empilhada', 'lado_a_lado'];
  const modos: TituloModo[] = ['vertical', 'horizontal', 'nenhum'];
  for (const formato of formatos) {
    for (const layout of layouts) {
      for (const tituloModo of modos) {
        for (const margensStories of [true, false]) {
          for (const extras of [true, false]) {
            const nome = `${formato} / ${layout} / título ${tituloModo} / margens ${margensStories} / ${extras ? 'com' : 'sem'} extras`;
            it(nome, () => {
              const n = layout === 'unica' ? 1 : 2;
              const l = calcularLayoutSocial(base({
                formato, layout, nPaineis: n, tituloModo, margensStories,
                legenda: extras ? '3ª Semana de PO' : '', perfis: extras ? ['rafaelmocbel', 'myhealthid.app', 'physio.mocbel'] : [], temSelo: extras, temAvatar: extras,
              }), medir);
              const { largura: W, altura: H } = FORMATOS[formato];
              expect(l.largura).toBe(W);
              expect(l.altura).toBe(H);
              l.paineis.forEach((p) => { expect(dentroDe(p, W, H)).toBe(true); expect(p.w).toBeGreaterThan(150); expect(p.h).toBeGreaterThan(150); });
              if (l.paineis.length === 2) expect(sobrepoe(l.paineis[0], l.paineis[1])).toBe(false);
              if (l.titulo) {
                expect(dentroDe(l.titulo.caixa, W, H)).toBe(true);
                l.paineis.forEach((p) => expect(sobrepoe(l.titulo!.caixa, p)).toBe(false));
              }
              l.rotulos.forEach((r) => {
                expect(dentroDe(r.caixa, W, H)).toBe(true);
                l.paineis.forEach((p) => expect(sobrepoe(r.caixa, p)).toBe(false));
                if (l.titulo) expect(sobrepoe(r.caixa, l.titulo.caixa)).toBe(false);
              });
              if (l.selo && !l.selo.sobreFoto) {
                const caixaSelo = { x: l.selo.cx - l.selo.r, y: l.selo.cy - l.selo.r, w: l.selo.r * 2, h: l.selo.r * 2 };
                expect(dentroDe(caixaSelo, W, H)).toBe(true);
                if (l.titulo) expect(sobrepoe(caixaSelo, l.titulo.caixa)).toBe(false);
                l.paineis.forEach((p) => expect(sobrepoe(caixaSelo, p)).toBe(false));
              }
              if (l.pilula) {
                expect(dentroDe(l.pilula.caixa, W, H)).toBe(true);
                l.paineis.forEach((p) => expect(sobrepoe(l.pilula!.caixa, p)).toBe(false));
              }
              if (l.pilula && l.perfis) {
                const menorX = Math.min(...l.perfis.linhas.map((p) => p.x - p.largura));
                expect(l.pilula.caixa.x + l.pilula.caixa.w).toBeLessThanOrEqual(menorX);
              }
              if (margensStories && formato === 'story') {
                if (l.pilula) expect(l.pilula.caixa.y + l.pilula.caixa.h).toBeLessThanOrEqual(H - 340 + 0.5);
                if (l.titulo) expect(l.titulo.caixa.y).toBeGreaterThanOrEqual(250 - 0.5);
              }
            });
          }
        }
      }
    }
  }
});

describe('enquadramento da foto na caixa', () => {
  const caixa: Retangulo = { x: 100, y: 200, w: 800, h: 600 };

  it('"inteira" mostra a foto toda, centralizada, sem distorcer', () => {
    const j = janelaDaImagem(caixa, 1200, 1600, 'inteira');
    expect(j.origem).toEqual({ x: 0, y: 0, w: 1200, h: 1600 });
    expect(j.destino.h).toBeCloseTo(600);
    expect(j.destino.w / j.destino.h).toBeCloseTo(1200 / 1600);
    expect(j.destino.x + j.destino.w / 2).toBeCloseTo(caixa.x + caixa.w / 2);
  });

  it('"preencher" cobre a caixa inteira cortando o excesso', () => {
    const j = janelaDaImagem(caixa, 1200, 1600, 'preencher');
    expect(j.destino).toEqual({ x: 100, y: 200, w: 800, h: 600 });
    expect(j.origem.w).toBeCloseTo(1200);
    expect(j.origem.h).toBeCloseTo(900);
    expect(j.origem.y).toBeCloseTo(350);
  });

  it('o zoom corta mais e o centro nunca sai da foto', () => {
    const j = janelaDaImagem(caixa, 1200, 1600, 'preencher', { zoom: 2, cx: 0, cy: 0 });
    expect(j.origem.x).toBeCloseTo(0);
    expect(j.origem.y).toBeCloseTo(0);
    expect(j.origem.w).toBeCloseTo(600);
    const fim = janelaDaImagem(caixa, 1200, 1600, 'preencher', { zoom: 2, cx: 1, cy: 1 });
    expect(fim.origem.x + fim.origem.w).toBeCloseTo(1200);
    expect(fim.origem.y + fim.origem.h).toBeCloseTo(1600);
  });

  it('limita o zoom e tolera valores inválidos e caixas vazias', () => {
    const j = janelaDaImagem(caixa, 1200, 1600, 'preencher', { zoom: 99, cx: NaN, cy: 0.5 });
    expect(j.escala).toBeCloseTo(janelaDaImagem(caixa, 1200, 1600, 'preencher').escala * ZOOM_MAX);
    expect(janelaDaImagem({ x: 0, y: 0, w: 0, h: 10 }, 100, 100, 'inteira').escala).toBe(0);
  });

  it('arrastar leva a foto junto com o dedo (o centro anda no sentido oposto)', () => {
    const e0 = { zoom: 2, cx: 0.5, cy: 0.5 };
    const e1 = arrastarEnquadramento(e0, 40, -30, caixa, 1200, 1600, 'preencher');
    expect(e1.cx).toBeLessThan(0.5);
    expect(e1.cy).toBeGreaterThan(0.5);
    expect(e1.zoom).toBe(2);
    const e2 = arrastarEnquadramento(e0, -4000, 4000, caixa, 1200, 1600, 'preencher');
    expect(e2.cx).toBeLessThanOrEqual(1);
    expect(e2.cy).toBeGreaterThanOrEqual(0);
  });

  it('o zoom da pinça mantém parado o ponto da foto sob os dedos', () => {
    const e0 = { zoom: 1, cx: 0.5, cy: 0.5 };
    const foco = { x: 300, y: 350 };
    const antes = janelaDaImagem(caixa, 1200, 1600, 'preencher', e0);
    const sob0 = fracaoDaFotoSob(antes, 1200, 1600, caixa, foco.x, foco.y);
    const e1 = zoomarEnquadramento(e0, 2, caixa, 1200, 1600, 'preencher', foco);
    const depois = janelaDaImagem(caixa, 1200, 1600, 'preencher', e1);
    const sob1 = fracaoDaFotoSob(depois, 1200, 1600, caixa, foco.x, foco.y);
    expect(e1.zoom).toBe(2);
    expect(sob1.x).toBeCloseTo(sob0.x, 3);
    expect(sob1.y).toBeCloseTo(sob0.y, 3);
  });

  it('posicaoNaArte e fracaoDaFotoSob são inversas', () => {
    const j = janelaDaImagem(caixa, 1200, 1600, 'preencher', { zoom: 1.5, cx: 0.4, cy: 0.35 });
    const p = posicaoNaArte(j, 1200, 1600, 0.45, 0.3, caixa);
    const f = fracaoDaFotoSob(j, 1200, 1600, caixa, p.x, p.y);
    expect(f.x).toBeCloseTo(0.45);
    expect(f.y).toBeCloseTo(0.3);
  });

  it('sugere preencher quando o corte é pequeno e foto inteira quando seria grande', () => {
    expect(ajusteSugerido(480, 900, 1200, 1600)).toBe('preencher');
    expect(ajusteSugerido(800, 600, 1200, 1600)).toBe('inteira');
    expect(1 - 0.75 / (800 / 600)).toBeGreaterThan(PERDA_MAXIMA_PREENCHER);
    expect(ajusteSugerido(0, 0, 10, 10)).toBe('inteira');
  });

  it('o enquadramento por rosto sobe a janela até o rosto ficar perto do alto da caixa', () => {
    const e = enquadramentoPorRosto(caixa, 1200, 1600, 'preencher', 1, { cx: 0.5, cy: 0.15 });
    const j = janelaDaImagem(caixa, 1200, 1600, 'preencher', e);
    const rosto = posicaoNaArte(j, 1200, 1600, 0.5, 0.15, caixa);
    expect((rosto.y - caixa.y) / caixa.h).toBeLessThan(0.4);
    expect(enquadramentoPorRosto(caixa, 1200, 1600, 'preencher', 1, null)).toEqual(ENQUADRAMENTO_PADRAO);
  });

  it('caberNaCaixa mantém a proporção', () => {
    const r = caberNaCaixa(500, 500, 1000, 2000);
    expect(r.h).toBeCloseTo(500);
    expect(r.w).toBeCloseTo(250);
    expect(caberNaCaixa(0, 5, 1, 1)).toEqual({ w: 0, h: 0 });
  });
});
