import { describe, expect, it } from 'vitest';
import type { CartaoMetricaUi } from '@/lib/angular/analiseVideo/tiposUi';
import {
  ALTURA_CARTAO_FONTES, CANDIDATOS_MIME, ErroExportacao, LIMITES_EXPORTACAO, MAX_CARTOES_ORIGINAL, MENSAGEM_SEM_GRAVACAO, ORDEM_FORMATOS_VIDEO, VELOCIDADES_EXPORTACAO, ajustarTrecho,
  avaliarSuporteGravacao, avisoDoTipoDeArquivo, bitrateDoVideo, calcularLayoutConteudo, duracaoDaSaida, ehFormatoSocial, erroDeCancelamento, escolherMime, extensaoDoMime,
  FRACAO_FONTE_RODAPE, RODAPE_VIDEO, RODAPE_VIDEO_COM_AVISO, prefixoDaReferencia,
  itensDeCartoes, itensDeLinhas, nomeArquivoVideo, nomeSeguroParaArquivo, par, planejarSaida, progressoDaSaida, quadroNaSaida, quebrarTexto, rotuloTempo, rotuloVelocidade,
  retanguloQueCobre, separarReferencia, tamanhoOriginal, temSobraNaArea, tempoDaFonte, tempoDaSaida, trechoMaximoS, trechoPadrao, truncarTexto, validarExportacao, type EntradaValidacao, type LayoutConteudo,
} from '@/lib/angular/video/exportarVideoPuro';
import { ehCancelamento } from '@/lib/angular/video/rastrear';
import { criarTrilha } from '@/lib/angular/video/trilha';

const trilhaDe = (n: number, fps = 30, t0 = 0) => criarTrilha(fps, 640, 480, Array.from({ length: n }, (_, i) => ({ i, t: t0 + i / fps, pontos: {} })));

describe('tipo de arquivo gravado', () => {
  const so = (...aceitos: string[]) => (m: string) => aceitos.includes(m);

  it('prefere MP4 com H.264 (é o que o Instagram aceita)', () => {
    const e = escolherMime(so('video/mp4;codecs=avc1.640028', 'video/webm;codecs=vp8', 'video/mp4'));
    expect(e).toEqual({ mime: 'video/mp4;codecs=avc1.640028', extensao: 'mp4', aceitoNoInstagram: true });
  });

  it('sem H.264 cai para WebM (VP8 antes de VP9) e avisa que o Instagram não aceita', () => {
    const e = escolherMime(so('video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'));
    expect(e).toEqual({ mime: 'video/webm;codecs=vp8', extensao: 'webm', aceitoNoInstagram: false });
    expect(escolherMime(so('video/webm;codecs=vp9'))?.mime).toBe('video/webm;codecs=vp9');
    expect(escolherMime(so('video/webm'))?.extensao).toBe('webm');
  });

  it('"video/mp4" sem codec só entra se nada melhor existir, e não promete Instagram', () => {
    expect(escolherMime(so('video/mp4', 'video/webm;codecs=vp8'))?.mime).toBe('video/webm;codecs=vp8');
    const so_mp4 = escolherMime(so('video/mp4'));
    expect(so_mp4).toEqual({ mime: 'video/mp4', extensao: 'mp4', aceitoNoInstagram: false });
  });

  it('nada suportado devolve null; erro do navegador conta como não suportado', () => {
    expect(escolherMime(() => false)).toBeNull();
    expect(escolherMime(() => { throw new Error('tipo desconhecido'); })).toBeNull();
    const chamadas: string[] = [];
    escolherMime((m) => { chamadas.push(m); return false; });
    expect(chamadas).toEqual(CANDIDATOS_MIME);
  });

  it('extensão vem do tipo do arquivo', () => {
    expect(extensaoDoMime('video/mp4;codecs=avc1')).toBe('mp4');
    expect(extensaoDoMime('video/webm;codecs=vp8')).toBe('webm');
    expect(extensaoDoMime('VIDEO/MP4')).toBe('mp4');
  });

  it('suporte: sem gravador ou sem captureStream, mensagem clara em português', () => {
    const ok = avaliarSuporteGravacao({ temMediaRecorder: true, temCaptureStream: true, suporta: so('video/webm') });
    expect(ok.ok).toBe(true);
    expect(ok.escolha?.mime).toBe('video/webm');
    for (const amb of [
      { temMediaRecorder: false, temCaptureStream: true, suporta: () => true },
      { temMediaRecorder: true, temCaptureStream: false, suporta: () => true },
      { temMediaRecorder: true, temCaptureStream: true, suporta: () => false },
    ]) {
      const r = avaliarSuporteGravacao(amb);
      expect(r.ok).toBe(false);
      expect(r.motivo).toBe(MENSAGEM_SEM_GRAVACAO);
    }
    expect(MENSAGEM_SEM_GRAVACAO).toMatch(/iOS 14\.3/);
  });

  it('aviso de WebM só aparece nos formatos do Instagram', () => {
    const webm = escolherMime(so('video/webm'))!;
    const mp4 = escolherMime(so('video/mp4;codecs=avc1'))!;
    expect(avisoDoTipoDeArquivo(webm, 'story')).toMatch(/WEBM.*MP4/);
    expect(avisoDoTipoDeArquivo(webm, 'original')).toBeNull();
    expect(avisoDoTipoDeArquivo(mp4, 'story')).toBeNull();
    expect(avisoDoTipoDeArquivo(undefined, 'story')).toBeNull();
  });

  it('nome do arquivo: sem acento, sem dados do paciente, com formato e data', () => {
    expect(nomeSeguroParaArquivo('Elevação do braço')).toBe('elevacao-do-braco');
    expect(nomeSeguroParaArquivo('  Marcha (caminhada)! ')).toBe('marcha-caminhada');
    expect(nomeSeguroParaArquivo('')).toBe('');
    const nome = nomeArquivoVideo('story', 'Aterrissagem de salto', 'mp4', new Date('2026-10-17T15:00:00Z'));
    expect(nome).toBe('analise-aterrissagem-de-salto-story-2026-10-17.mp4');
    expect(nomeArquivoVideo('original', undefined, 'webm', new Date('2026-10-17T15:00:00Z'))).toBe('analise-original-2026-10-17.webm');
  });

  it('bitrate cresce com o quadro mas fica dentro dos limites que o celular grava em tempo real', () => {
    expect(bitrateDoVideo(320, 240)).toBe(LIMITES_EXPORTACAO.bitrateMinimo);
    expect(bitrateDoVideo(1080, 1920)).toBeLessThanOrEqual(LIMITES_EXPORTACAO.bitrateMaximo);
    expect(bitrateDoVideo(1080, 1920)).toBeGreaterThan(bitrateDoVideo(720, 1280));
    expect(bitrateDoVideo(7680, 4320)).toBe(LIMITES_EXPORTACAO.bitrateMaximo);
  });
});

describe('mapeamento de tempo (câmera lenta)', () => {
  const trecho = { inicio: 1, fim: 5 };

  it('a duração do arquivo é o trecho dividido pela velocidade', () => {
    expect(duracaoDaSaida(trecho, 1)).toBe(4);
    expect(duracaoDaSaida(trecho, 0.5)).toBe(8);
    expect(duracaoDaSaida(trecho, 0.25)).toBe(16);
    expect(duracaoDaSaida(trecho, 0.1)).toBeCloseTo(40, 9);
    expect(duracaoDaSaida({ inicio: 3, fim: 3 }, 1)).toBe(0);
    expect(duracaoDaSaida({ inicio: 5, fim: 3 }, 1)).toBe(0);
  });

  it('o instante do vídeo no arquivo anda mais devagar, começa no início do trecho e nunca passa do fim', () => {
    expect(tempoDaFonte(0, trecho, 0.25)).toBe(1);
    expect(tempoDaFonte(4, trecho, 0.25)).toBeCloseTo(2, 9);
    expect(tempoDaFonte(16, trecho, 0.25)).toBe(5);
    expect(tempoDaFonte(999, trecho, 0.25)).toBe(5);
    expect(tempoDaFonte(-3, trecho, 1)).toBe(1);
  });

  it('ida e volta: tempoDaSaida desfaz tempoDaFonte dentro do trecho', () => {
    for (const v of VELOCIDADES_EXPORTACAO) {
      for (const t of [0, 0.37, 1.5, 3.99]) {
        expect(tempoDaSaida(tempoDaFonte(t, trecho, v), trecho, v)).toBeCloseTo(Math.min(t, duracaoDaSaida(trecho, v)), 9);
      }
    }
    expect(tempoDaSaida(0, trecho, 0.5)).toBe(0);
    expect(tempoDaSaida(9, trecho, 0.5)).toBe(8);
  });

  it('o quadro da trilha avança quadro a quadro: em câmera lenta cada quadro aparece por mais tempo e em ordem', () => {
    const trilha = trilhaDe(150, 30);
    const v = 0.25;
    const duracao = duracaoDaSaida({ inicio: 0, fim: 4 }, v);
    const vistos: number[] = [];
    for (let k = 0; k < Math.round(duracao * 30); k++) vistos.push(quadroNaSaida(trilha, k / 30, { inicio: 0, fim: 4 }, v));
    expect(vistos[0]).toBe(0);
    expect(vistos[vistos.length - 1]).toBe(119);
    for (let i = 1; i < vistos.length; i++) expect(vistos[i]).toBeGreaterThanOrEqual(vistos[i - 1]);
    // 30 q/s da trilha a 0,25× e 30 q/s do arquivo: cada quadro da trilha aparece 4 vezes.
    const repeticoes = vistos.filter((q) => q === 40).length;
    expect(repeticoes).toBe(4);
    expect(new Set(vistos).size).toBe(120);
  });

  it('trilha que começa depois do início do vídeo continua mapeada', () => {
    const trilha = trilhaDe(60, 30, 2);
    expect(quadroNaSaida(trilha, 0, { inicio: 2, fim: 4 }, 1)).toBe(0);
    expect(quadroNaSaida(trilha, 1, { inicio: 2, fim: 4 }, 1)).toBe(30);
    expect(quadroNaSaida(trilha, 50, { inicio: 2, fim: 4 }, 1)).toBe(59);
  });

  it('plano: quadros do arquivo, quadros da trilha e repetições por quadro', () => {
    const p = planejarSaida({ intervalo: { inicio: 0, fim: 4 }, velocidade: 0.25, fpsRastreio: 30 });
    expect(p.duracaoSaidaS).toBe(16);
    expect(p.quadrosSaida).toBe(480);
    expect(p.quadrosFonte).toBe(120);
    expect(p.repeticoesPorQuadro).toBeCloseTo(4, 9);
    expect(planejarSaida({ intervalo: { inicio: 0, fim: 2 }, velocidade: 1, fpsRastreio: 60 }).repeticoesPorQuadro).toBeCloseTo(0.5, 9);
  });

  it('progresso fica entre 0 e 1', () => {
    expect(progressoDaSaida(0, 10)).toBe(0);
    expect(progressoDaSaida(5, 10)).toBe(0.5);
    expect(progressoDaSaida(11, 10)).toBe(1);
    expect(progressoDaSaida(3, 0)).toBe(1);
  });

  it('trecho máximo e trecho de partida respeitam o limite de duração do arquivo', () => {
    expect(trechoMaximoS(1)).toBe(LIMITES_EXPORTACAO.duracaoMaximaSaidaS);
    expect(trechoMaximoS(0.25)).toBe(LIMITES_EXPORTACAO.duracaoMaximaSaidaS / 4);
    expect(trechoPadrao({ inicio: 0, fim: 10 }, 0.1)).toEqual({ inicio: 0, fim: 9 });
    expect(trechoPadrao({ inicio: 2, fim: 6 }, 1)).toEqual({ inicio: 2, fim: 6 });
  });

  it('ajustar o trecho: o lado movido manda, o outro cede, nunca sai dos limites nem passa do máximo', () => {
    const lim = { inicio: 0, fim: 20 };
    expect(ajustarTrecho({ inicio: 8, fim: 6 }, lim, 'inicio', 90)).toEqual({ inicio: 5.5, fim: 6 });
    expect(ajustarTrecho({ inicio: 3, fim: 2.9 }, lim, 'fim', 90)).toEqual({ inicio: 3, fim: 3.5 });
    expect(ajustarTrecho({ inicio: -4, fim: 99 }, lim, 'fim', 90)).toEqual({ inicio: 0, fim: 20 });
    expect(ajustarTrecho({ inicio: 0, fim: 20 }, lim, 'fim', 9)).toEqual({ inicio: 11, fim: 20 });
    expect(ajustarTrecho({ inicio: 0, fim: 20 }, lim, 'inicio', 9)).toEqual({ inicio: 0, fim: 9 });
    // Limites mais curtos que o mínimo: não inventa trecho maior que o vídeo.
    expect(ajustarTrecho({ inicio: 0, fim: 0.3 }, { inicio: 0, fim: 0.3 }, 'fim', 90)).toEqual({ inicio: 0, fim: 0.3 });
  });

  it('rótulos em português', () => {
    expect(rotuloVelocidade(0.25)).toBe('0,25×');
    expect(rotuloVelocidade(1)).toBe('1×');
    expect(rotuloTempo(1.5)).toBe('1,50 s');
    expect(rotuloTempo(12.34, 1)).toBe('12,3 s');
  });
});

describe('textos', () => {
  const medir = (t: string) => t.length * 10;

  it('truncar termina em reticências e cabe na largura', () => {
    expect(truncarTexto('curto', 100, medir)).toBe('curto');
    const t = truncarTexto('uma frase bem comprida para o cartão', 120, medir);
    expect(t.endsWith('…')).toBe(true);
    expect(medir(t)).toBeLessThanOrEqual(120);
    expect(truncarTexto('qualquer coisa', 5, medir)).toBe('');
  });

  it('quebrar por palavras, cortar palavra maior que a linha e limitar linhas', () => {
    expect(quebrarTexto('um dois três quatro', 90, medir)).toEqual(['um dois', 'três', 'quatro']);
    expect(quebrarTexto('abcdefghijklmnop', 50, medir)).toEqual(['abcde', 'fghij', 'klmno', 'p']);
    const limitado = quebrarTexto('um dois três quatro cinco seis sete', 90, medir, 2);
    expect(limitado).toHaveLength(2);
    expect(limitado[1].endsWith('…')).toBe(true);
    expect(quebrarTexto('', 90, medir)).toEqual([]);
  });

  it('separar a referência da linha de resumo', () => {
    expect(separarReferencia('• Cadência: 109 passos/min (referência: ≥ 100 passos/min, Tudor-Locke et al., 2018, PMID 123)')).toEqual({
      principal: 'Cadência: 109 passos/min', referencia: '≥ 100 passos/min, Tudor-Locke et al., 2018, PMID 123',
    });
    expect(separarReferencia('• Tempo do passo: D 0,55 s · E 0,55 s')).toEqual({ principal: 'Tempo do passo: D 0,55 s · E 0,55 s', referencia: null });
    expect(separarReferencia('• A: 1 (referência: x; y)').referencia).toBe('x · y');
  });

  it('linhas viram cartões: título, valores por lado e referência só quando a linha traz', () => {
    const itens = itensDeLinhas([
      '• Cadência: 109 passos/min (referência: ≥ 100 passos/min, Tudor-Locke et al., 2018)',
      '• Tempo do passo: D 0,55 s · E 0,57 s',
      '• 0,53 s (quadro 16) — Distância: 12 cm',
      '',
    ]);
    expect(itens).toHaveLength(3);
    expect(itens[0]).toEqual({ titulo: 'Cadência', valores: [{ lado: null, texto: '109 passos/min', status: 'desconhecido' }], referencia: '≥ 100 passos/min, Tudor-Locke et al., 2018' });
    expect(itens[1].valores).toEqual([{ lado: 'D', texto: '0,55 s', status: 'desconhecido' }, { lado: 'E', texto: '0,57 s', status: 'desconhecido' }]);
    expect(itens[1].referencia).toBeNull();
    expect(itens[2].titulo).toBe('0,53 s (quadro 16) — Distância');
  });

  it('cartões da tela viram cartões do vídeo, com o símbolo e a fonte; sem referência confirmada não inventa nenhuma', () => {
    const cartoes: CartaoMetricaUi[] = [
      {
        chave: 'cadencia', titulo: 'Cadência', valores: [{ lado: null, texto: '109 passos/min', status: 'dentro' }],
        referencias: [{ faixa: '≥ 100 passos/min', populacao: 'Adultos', citacao: 'Tudor-Locke C, et al. 2018', rotulo: 'Tudor-Locke et al., 2018', pmid: '30000001' }], contexto: [], avisos: [],
      },
      { chave: 'passo', titulo: 'Tempo do passo', valores: [{ lado: 'D', texto: '0,55 s', status: 'sem_referencia' }, { lado: 'E', texto: '0,56 s', status: 'sem_referencia' }], referencias: [], contexto: [], avisos: [] },
      { chave: 'vazio', titulo: 'Sem valor', valores: [{ lado: null, texto: '—', status: 'sem_referencia' }], referencias: [], contexto: [], avisos: [] },
    ];
    const itens = itensDeCartoes(cartoes);
    expect(itens.map((i) => i.titulo)).toEqual(['Cadência', 'Tempo do passo']);
    expect(itens[0].referencia).toBe('≥ 100 passos/min · Tudor-Locke et al., 2018 · PMID 30000001');
    expect(itens[0].valores[0].status).toBe('dentro');
    expect(itens[1].referencia).toBeNull();
    // sem faixa de médias nem limiar não há situação em texto: o cartão segue só com o símbolo
    expect(itens[0].situacao).toBeUndefined();
    expect(itens[1].situacao).toBeUndefined();
  });

  it('limiar e faixa de médias: o mesmo símbolo neutro dos dois lados e a situação em texto com a fonte; a referência diz o que é', () => {
    const limiar = (valor: number, status: 'dentro' | 'fora'): CartaoMetricaUi => ({
      chave: 'cadencia', titulo: 'Cadência', valores: [{ lado: null, texto: `${valor} passos/min`, status, ...(status === 'dentro' ? { dentroDe: ['cadencia.tudor2018'] } : {}) }],
      referencias: [{ chave: 'cadencia.tudor2018', faixa: '≥ 100 passos/min', populacao: 'Adultos', citacao: 'Tudor-Locke C, et al. 2018', rotulo: 'Tudor-Locke et al., 2018', pmid: '29858465', tipo: 'limiar_heuristico', limiteMin: '100 passos/min' }],
      contexto: [], avisos: [],
    });
    const [dentro] = itensDeCartoes([limiar(109, 'dentro')]);
    const [fora] = itensDeCartoes([limiar(90, 'fora')]);
    expect(dentro.valores[0].status).toBe('neutro');
    expect(fora.valores[0].status).toBe('neutro');
    expect(dentro.situacao).toBe('acima do limiar de 100 passos/min (Tudor-Locke et al., 2018)');
    expect(fora.situacao).toBe('abaixo do limiar de 100 passos/min (Tudor-Locke et al., 2018)');
    expect(prefixoDaReferencia(dentro.natureza)).toBe('Limiar: ');
    expect(prefixoDaReferencia('faixa_de_medias')).toBe('Médias do estudo: ');
    expect(prefixoDaReferencia('normalidade')).toBe('Ref.: ');
  });

});

describe('aviso fixo do vídeo', () => {
  it('é o mesmo texto em todo lugar e o aviso de ressalvas só o acrescenta', () => {
    expect(RODAPE_VIDEO).toBe('Estimativa por vídeo · não é diagnóstico');
    expect(RODAPE_VIDEO_COM_AVISO.startsWith(RODAPE_VIDEO)).toBe(true);
    expect(RODAPE_VIDEO_COM_AVISO).toMatch(/ressalvas no PDF/);
  });
});

const arredondaPar = (n: number) => n % 2 === 0;

function confere(l: LayoutConteudo, vw: number, vh: number) {
  expect(arredondaPar(l.largura)).toBe(true);
  expect(arredondaPar(l.altura)).toBe(true);
  const dentro = (r: { x: number; y: number; w: number; h: number }) => {
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.w).toBeLessThanOrEqual(l.largura);
    expect(r.y + r.h).toBeLessThanOrEqual(l.altura);
  };
  [l.barra, l.areaVideo, l.video].forEach(dentro);
  expect(l.video.x).toBeGreaterThanOrEqual(l.areaVideo.x);
  expect(l.video.y).toBeGreaterThanOrEqual(l.areaVideo.y);
  expect(l.video.x + l.video.w).toBeLessThanOrEqual(l.areaVideo.x + l.areaVideo.w);
  expect(l.video.y + l.video.h).toBeLessThanOrEqual(l.areaVideo.y + l.areaVideo.h);
  // O vídeo nunca é esticado: a proporção é a do original (até o arredondamento do pixel).
  expect(Math.abs(l.video.w / l.video.h - vw / vh) / (vw / vh)).toBeLessThan(0.02 + 2 / Math.min(l.video.w, l.video.h));
  // A faixa do topo fica acima do vídeo; os painéis, abaixo, sem se sobrepor.
  expect(l.barra.y + l.barra.h).toBeLessThanOrEqual(l.areaVideo.y);
  let fim = l.areaVideo.y + l.areaVideo.h;
  for (const r of [l.grafico, l.cartoes]) {
    if (!r) continue;
    dentro(r);
    expect(r.y).toBeGreaterThanOrEqual(fim);
    fim = r.y + r.h;
  }
}

describe('layout do quadro composto', () => {
  const videos: [number, number][] = [[1920, 1080], [1080, 1920], [640, 480], [720, 720], [3840, 2160], [480, 854]];

  it('formato original: o vídeo ocupa a largura toda e os painéis vêm embaixo; nunca passa de 1080×1920', () => {
    for (const [vw, vh] of videos) {
      for (const grafico of [true, false]) {
        for (const n of [0, 1, 3, 8, 15]) {
          const l = tamanhoOriginal(vw, vh, grafico, n);
          confere(l, vw, vh);
          expect(l.largura).toBeLessThanOrEqual(LIMITES_EXPORTACAO.larguraMaxima);
          expect(l.altura).toBeLessThanOrEqual(LIMITES_EXPORTACAO.alturaMaxima);
          expect(l.video).toEqual(l.areaVideo);
          expect(Boolean(l.grafico)).toBe(grafico);
          expect(Boolean(l.cartoes)).toBe(n > 0);
          expect(l.cartoesVisiveis).toBe(Math.min(n, MAX_CARTOES_ORIGINAL));
        }
      }
    }
  });

  it('vídeo vertical alto com tudo ligado encolhe para caber, em vez de passar de 1920', () => {
    const l = tamanhoOriginal(1080, 1920, true, 8);
    expect(l.altura).toBeLessThanOrEqual(1920);
    expect(l.largura).toBeLessThan(1080);
    confere(l, 1080, 1920);
  });

  it('sem gráfico nem cartões o quadro é a faixa do topo, o vídeo e a faixa do aviso no pé', () => {
    const l = tamanhoOriginal(1280, 720, false, 0);
    expect(l.largura).toBe(1080);
    expect(l.grafico).toBeNull();
    expect(l.cartoes).toBeNull();
    expect(l.rodape).not.toBeNull();
    expect(l.areaVideo.h).toBe(par((1080 * 720) / 1280));
    expect(l.altura).toBe(par(l.barra.h + l.areaVideo.h + (l.rodape?.h ?? 0)));
  });

  it('formato original: o aviso tem faixa própria abaixo de tudo, proporcional ao quadro e longe da borda de baixo', () => {
    for (const [vw, vh] of videos) {
      for (const grafico of [true, false]) {
        for (const n of [0, 3, 12]) {
          const l = tamanhoOriginal(vw, vh, grafico, n, n > 0);
          const r = l.rodape;
          expect(r).not.toBeNull();
          if (!r) continue;
          let fim = l.areaVideo.y + l.areaVideo.h;
          for (const painel of [l.grafico, l.cartoes]) if (painel) fim = Math.max(fim, painel.y + painel.h);
          expect(r.y).toBeGreaterThanOrEqual(fim);
          expect(r.y + r.h).toBeLessThanOrEqual(l.altura);
          expect(r.w).toBe(l.largura);
          // corpo ~2,4% da largura (9 pt num celular de 390 pt com o quadro de 1080 px na tela toda)
          expect(l.fonteRodape).toBeGreaterThanOrEqual(Math.round(l.largura * FRACAO_FONTE_RODAPE) - 1);
          expect(l.fonteRodape).toBeGreaterThanOrEqual(10);
          // linha de base do texto, no centro da faixa: longe do pé do quadro (mais de uma altura de letra)
          expect(l.altura - (r.y + r.h / 2)).toBeGreaterThan(l.fonteRodape * 1.2);
        }
      }
    }
  });

  it('nos formatos sociais o aviso vai na moldura da arte, não no conteúdo', () => {
    const l = calcularLayoutConteudo({ larguraVideo: 1280, alturaVideo: 720, largura: 972, altura: 1300, grafico: true, nCartoes: 4 });
    expect(l.rodape).toBeNull();
  });

  it('cartões com a linha da situação ficam mais altos, e o quadro continua cabendo no limite', () => {
    const normal = calcularLayoutConteudo({ larguraVideo: 1280, alturaVideo: 720, largura: 972, altura: 1300, grafico: true, nCartoes: 4 });
    const alto = calcularLayoutConteudo({ larguraVideo: 1280, alturaVideo: 720, largura: 972, altura: 1300, grafico: true, nCartoes: 4, cartaoAlto: true });
    expect(alto.alturaCartao).toBeGreaterThan(normal.alturaCartao);
    confere(alto, 1280, 720);
    const original = tamanhoOriginal(1080, 1920, true, 8, true);
    expect(original.altura).toBeLessThanOrEqual(LIMITES_EXPORTACAO.alturaMaxima);
    confere(original, 1080, 1920);
  });

  it('com a situação em duas linhas o cartão ganha mais uma linha, em qualquer formato, e tudo continua cabendo', () => {
    const uma = calcularLayoutConteudo({ larguraVideo: 1280, alturaVideo: 720, largura: 972, altura: 1300, grafico: true, nCartoes: 4, cartaoAlto: true });
    const duas = calcularLayoutConteudo({ larguraVideo: 1280, alturaVideo: 720, largura: 972, altura: 1300, grafico: true, nCartoes: 4, cartaoAlto: true, situacaoEmDuasLinhas: true });
    expect(duas.alturaCartao).toBeGreaterThan(uma.alturaCartao);
    expect(duas.alturaCartao).toBeCloseTo(duas.fonte * ALTURA_CARTAO_FONTES.comSituacaoEmDuasLinhas, 0);
    confere(duas, 1280, 720);
    // sem o cartão alto a segunda linha não vale nada: o cartão comum não muda
    const comum = calcularLayoutConteudo({ larguraVideo: 1280, alturaVideo: 720, largura: 972, altura: 1300, grafico: true, nCartoes: 4, situacaoEmDuasLinhas: true });
    expect(comum.alturaCartao).toBe(calcularLayoutConteudo({ larguraVideo: 1280, alturaVideo: 720, largura: 972, altura: 1300, grafico: true, nCartoes: 4 }).alturaCartao);
    const original = tamanhoOriginal(1080, 1920, true, 8, true, true);
    expect(original.altura).toBeLessThanOrEqual(LIMITES_EXPORTACAO.alturaMaxima);
    confere(original, 1080, 1920);
  });

  it('nas caixas fixas da arte (story, feed, quadrado) a segunda linha da situação não tira cartões: aparecem tantos quanto com uma linha', () => {
    const caixas = [{ largura: 845, altura: 1148 }, { largura: 857, altura: 1036 }, { largura: 857, altura: 766 }];
    for (const c of caixas) {
      for (const grafico of [false, true]) {
        const base = { larguraVideo: 960, alturaVideo: 540, largura: c.largura, altura: c.altura, grafico, nCartoes: 6, cartaoAlto: true };
        const uma = calcularLayoutConteudo(base);
        const duas = calcularLayoutConteudo({ ...base, situacaoEmDuasLinhas: true });
        expect(duas.cartoesVisiveis, `${c.largura}x${c.altura} grafico ${grafico}`).toBe(uma.cartoesVisiveis);
        confere(duas, 960, 540);
      }
    }
  });

  it('caixa fixa da arte (story, feed, quadrado): tudo cabe nela e o vídeo cede espaço aos painéis', () => {
    const caixas = [{ largura: 972, altura: 1520 }, { largura: 984, altura: 1230 }, { largura: 984, altura: 984 }, { largura: 1080, altura: 1920 }];
    for (const [vw, vh] of videos) {
      for (const c of caixas) {
        for (const grafico of [true, false]) {
          for (const n of [0, 2, 9, 30]) {
            const l = calcularLayoutConteudo({ larguraVideo: vw, alturaVideo: vh, largura: c.largura, altura: c.altura, grafico, nCartoes: n });
            confere(l, vw, vh);
            expect(l.largura).toBe(par(c.largura));
            expect(l.altura).toBe(par(c.altura));
            expect(l.cartoesVisiveis).toBeLessThanOrEqual(n);
            if (n > 0) expect(l.cartoesVisiveis).toBeGreaterThan(0);
            if (n > 0 && l.cartoes) {
              expect(l.cartoes.h).toBeLessThanOrEqual(c.altura * 0.3 + l.alturaCartao);
            }
          }
        }
      }
    }
  });

  it('com muitas métricas o último espaço vira o aviso "+N métricas no PDF" (menos espaços que métricas)', () => {
    const l = calcularLayoutConteudo({ larguraVideo: 1920, alturaVideo: 1080, largura: 984, altura: 984, grafico: true, nCartoes: 20 });
    expect(l.cartoesVisiveis).toBeLessThan(20);
    expect(l.colunas).toBe(2);
  });

  it('largura estreita usa uma coluna de cartões', () => {
    expect(calcularLayoutConteudo({ larguraVideo: 640, alturaVideo: 480, largura: 480, grafico: false, nCartoes: 3 }).colunas).toBe(1);
  });

  it('o vídeo não fica minúsculo: o gráfico cede antes do vídeo', () => {
    const l = calcularLayoutConteudo({ larguraVideo: 1080, alturaVideo: 1920, largura: 984, altura: 984, grafico: true, nCartoes: 6 });
    expect(l.areaVideo.h).toBeGreaterThanOrEqual(984 * 0.2);
    confere(l, 1080, 1920);
  });

  it('dimensões inválidas viram erro claro', () => {
    expect(() => calcularLayoutConteudo({ larguraVideo: 0, alturaVideo: 480, largura: 640, grafico: false, nCartoes: 0 })).toThrow(/inválidas/);
    expect(() => calcularLayoutConteudo({ larguraVideo: 640, alturaVideo: 480, largura: 0, grafico: false, nCartoes: 0 })).toThrow();
  });

  it('formatos: o original e os três do Instagram', () => {
    expect(ORDEM_FORMATOS_VIDEO).toEqual(['original', 'story', 'feed', 'quadrado']);
    expect(ehFormatoSocial('original')).toBe(false);
    expect(ehFormatoSocial('story')).toBe(true);
    expect(par(7)).toBe(8);
    expect(par(1)).toBe(2);
  });
});

describe('validação e consentimento', () => {
  const base: EntradaValidacao = { formato: 'original', velocidade: 1, intervalo: { inicio: 0, fim: 4 }, nQuadros: 120, modoRosto: 'desfoque', autorizadoMoldura: false };

  it('original com o rosto coberto não exige autorização', () => {
    expect(validarExportacao(base)).toBeNull();
    expect(validarExportacao({ ...base, modoRosto: 'tarja' })).toBeNull();
  });

  it('formatos do Instagram exigem a autorização do paciente', () => {
    for (const f of ['story', 'feed', 'quadrado'] as const) {
      const e = validarExportacao({ ...base, formato: f });
      expect(e).toBeInstanceOf(ErroExportacao);
      expect(e?.codigo).toBe('consentimento');
      expect(validarExportacao({ ...base, formato: f, autorizadoMoldura: true })).toBeNull();
    }
  });

  it('mostrar o rosto exige autorização em qualquer formato (a do paciente, marcada)', () => {
    expect(validarExportacao({ ...base, modoRosto: 'nenhum' })?.codigo).toBe('consentimento');
    expect(validarExportacao({ ...base, modoRosto: 'nenhum', autorizado: true })).toBeNull();
    expect(validarExportacao({ ...base, formato: 'story', modoRosto: 'nenhum', autorizadoMoldura: true })).toBeNull();
    expect(validarExportacao({ ...base, formato: 'story', modoRosto: 'nenhum', autorizado: true })?.codigo).toBe('consentimento');
  });

  it('trilha curta, velocidade fora da faixa, trecho curto e vídeo longo demais', () => {
    expect(validarExportacao({ ...base, nQuadros: 1 })?.codigo).toBe('trilha');
    expect(validarExportacao({ ...base, velocidade: 0 })?.codigo).toBe('velocidade');
    expect(validarExportacao({ ...base, velocidade: 3 })?.codigo).toBe('velocidade');
    expect(validarExportacao({ ...base, intervalo: { inicio: 1, fim: 1.2 } })?.codigo).toBe('trecho');
    expect(validarExportacao({ ...base, intervalo: { inicio: 2, fim: Number.NaN } })?.codigo).toBe('trecho');
    const longo = validarExportacao({ ...base, velocidade: 0.1, intervalo: { inicio: 0, fim: 10 } });
    expect(longo?.codigo).toBe('duracao');
    expect(longo?.message).toMatch(/100 s.*90 s.*9 s/);
    expect(validarExportacao({ ...base, velocidade: 0.1, intervalo: { inicio: 0, fim: 9 } })).toBeNull();
    expect(validarExportacao({ ...base, velocidade: 1, intervalo: { inicio: 0, fim: 90 } })).toBeNull();
    expect(validarExportacao({ ...base, velocidade: 1, intervalo: { inicio: 0, fim: 91 } })?.codigo).toBe('duracao');
  });

  it('cancelar tem o mesmo nome do cancelamento do rastreio, então o app trata os dois igual', () => {
    const e = erroDeCancelamento();
    expect(e.name).toBe('AbortError');
    expect(ehCancelamento(e)).toBe(true);
    expect(e.message).toBe('Gravação cancelada.');
  });
});

describe('fundo das faixas sobrantes', () => {
  it('temSobraNaArea: só quando o vídeo não ocupa a área toda', () => {
    const area = { x: 0, y: 100, w: 800, h: 700 };
    expect(temSobraNaArea({ x: 0, y: 285, w: 800, h: 450 }, area)).toBe(true);
    expect(temSobraNaArea({ x: 0, y: 100, w: 800, h: 700 }, area)).toBe(false);
    expect(temSobraNaArea({ x: 0, y: 100, w: 799.5, h: 700 }, area)).toBe(false);
  });

  it('retanguloQueCobre: cobre o destino sem distorcer e centraliza', () => {
    const r = retanguloQueCobre(960, 540, 40, 38);
    expect(r.h).toBeCloseTo(38, 6);
    expect(r.w / r.h).toBeCloseTo(960 / 540, 6);
    expect(r.x).toBeCloseTo((40 - r.w) / 2, 6);
    expect(r.y).toBeCloseTo(0, 6);
    const retrato = retanguloQueCobre(540, 960, 40, 38);
    expect(retrato.w).toBeCloseTo(40, 6);
    expect(retrato.y).toBeLessThan(0);
  });
});
