import { beforeEach, describe, expect, it, vi } from 'vitest';
import { desenharArteSocial, desenharMolduraSocial, layoutDaArte, prepararPaineis, type OpcoesArte, type PainelPronto } from '@/lib/social/desenhar';

interface Chamada { nome: string; args: unknown[]; fillStyle?: unknown }

/** Contexto 2D que só anota o que foi pedido: o jsdom não tem canvas, e aqui interessa o QUE é desenhado. */
function contextoGravador(largura = 1080, altura = 1920) {
  const chamadas: Chamada[] = [];
  const estado: Record<string, unknown> = { fillStyle: '#000' };
  const canvas = { width: largura, height: altura };
  const gradiente = { addColorStop: vi.fn() };
  const alvo = { canvas } as Record<string, unknown>;
  const ctx = new Proxy(alvo, {
    get(t, prop: string) {
      if (prop in t) return t[prop];
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradiente;
      if (prop === 'measureText') return (s: string) => ({ width: s.length * 10 });
      return (...args: unknown[]) => { chamadas.push({ nome: prop, args, fillStyle: estado.fillStyle }); };
    },
    set(t, prop: string, v) {
      t[prop] = v;
      if (prop === 'fillStyle') estado.fillStyle = v;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, chamadas, canvas };
}

const foto = (w = 1200, h = 1600): PainelPronto => ({ fonte: { width: w, height: h } as unknown as CanvasImageSource, largura: w, altura: h });

const opcoes = (o: Partial<OpcoesArte> = {}): OpcoesArte => ({
  formato: 'story', layout: 'empilhada', tituloModo: 'vertical', titulo: 'Pós operatório de SLAP', legenda: '3ª Semana de PO',
  perfis: ['rafaelmocbel', 'myhealthid.app'], rotulos: ['Pré-Sessão', 'Pós-Sessão'], datas: ['11/10/2026', '25/10/2026'], margensStories: true, ...o,
});

const textos = (cs: Chamada[]) => cs.filter((c) => c.nome === 'fillText').map((c) => c.args[0]);

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

describe('desenharArteSocial', () => {
  it('escreve título em caixa alta, rótulos com data, legenda e perfis com @', () => {
    const { ctx, chamadas } = contextoGravador();
    desenharArteSocial(ctx, opcoes(), [foto(), foto()], {}, 1);
    const t = textos(chamadas);
    expect(t).toContain('PÓS OPERATÓRIO DE SLAP');
    expect(t).toContain('Pré-Sessão');
    expect(t).toContain('Pós-Sessão');
    expect(t).toContain('11/10/2026');
    expect(t).toContain('25/10/2026');
    expect(t).toContain('3ª Semana de PO');
    expect(t).toContain('@rafaelmocbel');
    expect(t).toContain('@myhealthid.app');
  });

  it('desenha cada foto uma vez, sem distorcer (proporção da origem igual à do destino)', () => {
    const { ctx, chamadas } = contextoGravador();
    desenharArteSocial(ctx, opcoes({ modoAjuste: 'preencher' }), [foto(), foto()], {}, 1);
    const fotos = chamadas.filter((c) => c.nome === 'drawImage');
    expect(fotos).toHaveLength(2);
    for (const f of fotos) {
      const [, sx, sy, sw, sh, dx, dy, dw, dh] = f.args as number[];
      expect(sw / sh).toBeCloseTo(dw / dh, 3);
      expect(dw).toBeGreaterThan(0);
      void sx; void sy; void dx; void dy;
    }
  });

  it('com o rosto em tarja pinta a tarja opaca, e sem proteção não pinta', () => {
    const rosto = { cx: 0.5, cy: 0.15, w: 0.2, h: 0.12 };
    const com = contextoGravador();
    desenharArteSocial(com.ctx, opcoes({ modoRosto: 'tarja', rostos: [rosto, rosto] }), [foto(), foto()], {}, 1);
    expect(com.chamadas.filter((c) => c.nome === 'fill' && c.fillStyle === '#080c16')).toHaveLength(2);
    const sem = contextoGravador();
    desenharArteSocial(sem.ctx, opcoes({ modoRosto: 'nenhum', rostos: [rosto, rosto] }), [foto(), foto()], {}, 1);
    expect(sem.chamadas.filter((c) => c.nome === 'fill' && c.fillStyle === '#080c16')).toHaveLength(0);
  });

  it('com camadas, esconde o rosto na foto limpa e só depois pinta as marcações por cima', () => {
    const rosto = { cx: 0.5, cy: 0.15, w: 0.2, h: 0.12 };
    const limpa = { width: 1200, height: 1600, id: 'limpa' } as unknown as CanvasImageSource;
    const marcas = { width: 1200, height: 1600, id: 'marcas' } as unknown as CanvasImageSource;
    const painel: PainelPronto = { ...foto(), camadas: { foto: limpa, marcacoes: marcas } };
    const { ctx, chamadas } = contextoGravador();
    desenharArteSocial(ctx, opcoes({ layout: 'unica', modoRosto: 'tarja', rostos: [rosto], modoAjuste: 'preencher' }), [painel], {}, 1);
    const ordem = chamadas.filter((c) => (c.nome === 'drawImage' && (c.args[0] === limpa || c.args[0] === marcas)) || (c.nome === 'fill' && c.fillStyle === '#080c16'));
    expect(ordem.map((c) => (c.nome === 'fill' ? 'tarja' : (c.args[0] as { id: string }).id))).toEqual(['limpa', 'tarja', 'marcas']);
    // a imagem já marcada não é usada: o rosto nunca fica por baixo das marcações sem proteção
    expect(chamadas.some((c) => c.nome === 'drawImage' && c.args[0] === painel.fonte)).toBe(false);
  });

  it('só aceita as camadas quando têm o tamanho da imagem marcada; senão vale a imagem já marcada', async () => {
    const cv = (w: number, h: number) => ({ width: w, height: h }) as unknown as HTMLCanvasElement;
    const arte = (camadas: { foto: HTMLCanvasElement; marcacoes: HTMLCanvasElement }) => ({
      paineis: [{ rotulo: '', imagem: cv(1200, 1600), largura: 1200, altura: 1600, camadas }], medidas: [],
    });
    const [ok] = await prepararPaineis(arte({ foto: cv(1200, 1600), marcacoes: cv(1200, 1600) }));
    expect(ok.camadas).toBeDefined();
    const [torta] = await prepararPaineis(arte({ foto: cv(1200, 1600), marcacoes: cv(600, 800) }));
    expect(torta.camadas).toBeUndefined();
  });

  it('as marcações usam o mesmo recorte e destino da foto, sem deslocar', () => {
    const limpa = { width: 1200, height: 1600 } as unknown as CanvasImageSource;
    const marcas = { width: 1200, height: 1600 } as unknown as CanvasImageSource;
    const { ctx, chamadas } = contextoGravador();
    desenharArteSocial(ctx, opcoes({ layout: 'unica', modoAjuste: 'preencher' }), [{ ...foto(), camadas: { foto: limpa, marcacoes: marcas } }], {}, 1);
    const f = chamadas.find((c) => c.nome === 'drawImage' && c.args[0] === limpa)!;
    const m = chamadas.find((c) => c.nome === 'drawImage' && c.args[0] === marcas)!;
    expect(m.args.slice(1)).toEqual(f.args.slice(1));
  });

  it('sem região de rosto definida usa a caixa padrão do alto da foto: o rosto não fica à mostra por omissão', () => {
    const { ctx, chamadas } = contextoGravador();
    desenharArteSocial(ctx, opcoes({ modoRosto: 'tarja' }), [foto(), foto()], {}, 1);
    expect(chamadas.filter((c) => c.nome === 'fill' && c.fillStyle === '#080c16')).toHaveLength(2);
  });

  it('sem modoRosto o padrão é esconder (desfoque); só "nenhum" explícito mostra o rosto', () => {
    const rodar = (o: Partial<OpcoesArte>) => {
      const gravado = contextoGravador();
      const original = document.createElement.bind(document);
      let criados = 0;
      vi.spyOn(document, 'createElement').mockImplementation((tag: string, opts?: ElementCreationOptions) => {
        if (tag === 'canvas') criados++;
        return original(tag, opts);
      });
      desenharArteSocial(gravado.ctx, opcoes({ modoAjuste: 'preencher', ...o }), [foto(), foto()], {}, 1);
      vi.mocked(document.createElement).mockRestore();
      return criados;
    };
    // o desfoque monta canvases temporários para cada rosto; "nenhum" não monta nenhum
    expect(rodar({})).toBeGreaterThanOrEqual(2);
    expect(rodar({ modoRosto: 'nenhum' })).toBe(0);
  });

  it('o fundo desfocado da foto "inteira" é montado uma vez por tamanho de caixa e reaproveitado nos redesenhos; a moldura do vídeo nunca reaproveita', () => {
    const fake2d = () => ({ drawImage: vi.fn(), imageSmoothingEnabled: true, imageSmoothingQuality: 'high' }) as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(fake2d as never);
    const original = document.createElement.bind(document);
    let criados = 0;
    vi.spyOn(document, 'createElement').mockImplementation((tag: string, opts?: ElementCreationOptions) => {
      if (tag === 'canvas') criados++;
      return original(tag, opts);
    });
    const paineis = [foto(), foto()];
    const desenhar = (o: Partial<OpcoesArte>) => {
      criados = 0;
      desenharArteSocial(contextoGravador().ctx, opcoes({ modoRosto: 'nenhum', ...o }), paineis, {}, 1);
      return criados;
    };
    expect(desenhar({})).toBeGreaterThan(0);
    expect(desenhar({})).toBe(0);
    expect(desenhar({ formato: 'feed', layout: 'lado_a_lado' })).toBeGreaterThan(0);
    // quadro de vídeo: o painel é novo a cada chamada, então um canvas reaproveitado com outro quadro nunca mostra o fundo do anterior
    const quadro = { width: 720, height: 1280 } as unknown as CanvasImageSource;
    criados = 0;
    desenharMolduraSocial(contextoGravador(10, 10).ctx, 'quadrado', { modoRosto: 'nenhum' }, quadro);
    const primeiro = criados;
    criados = 0;
    desenharMolduraSocial(contextoGravador(10, 10).ctx, 'quadrado', { modoRosto: 'nenhum' }, quadro);
    expect(primeiro).toBeGreaterThan(0);
    expect(criados).toBe(primeiro);
  });

  it('a moldura do vídeo também esconde o rosto por omissão (caixa padrão), a menos que se peça o contrário', () => {
    const quadro = { width: 720, height: 1280 } as unknown as CanvasImageSource;
    const padrao = contextoGravador(10, 10);
    desenharMolduraSocial(padrao.ctx, 'story', { modoRosto: 'tarja' }, quadro);
    expect(padrao.chamadas.filter((c) => c.nome === 'fill' && c.fillStyle === '#080c16')).toHaveLength(1);
    const mostrando = contextoGravador(10, 10);
    desenharMolduraSocial(mostrando.ctx, 'story', { modoRosto: 'nenhum' }, quadro);
    expect(mostrando.chamadas.filter((c) => c.nome === 'fill' && c.fillStyle === '#080c16')).toHaveLength(0);
  });

  it('a sombra da foto acompanha a escala: prévia e arquivo final saem com a mesma proporção', () => {
    const sombra = (escala: number) => {
      const { ctx } = contextoGravador(1080 * escala, 1920 * escala);
      const blur: number[] = [];
      const alvo = ctx as unknown as Record<string, unknown>;
      let atual = 0;
      Object.defineProperty(alvo, 'shadowBlur', { get: () => atual, set: (v: number) => { atual = v; blur.push(v); }, configurable: true });
      desenharArteSocial(ctx, opcoes(), [foto(), foto()], {}, escala);
      return blur[0];
    };
    expect(sombra(1)).toBe(38);
    expect(sombra(0.6)).toBeCloseTo(38 * 0.6, 6);
  });

  it('aplica a escala da prévia sobre o sistema de coordenadas', () => {
    const { ctx, chamadas } = contextoGravador(648, 1152);
    desenharArteSocial(ctx, opcoes(), [foto(), foto()], {}, 0.6);
    expect(chamadas.find((c) => c.nome === 'setTransform')?.args).toEqual([0.6, 0, 0, 0.6, 0, 0]);
  });

  it('com uma foto só desenha uma foto, mesmo que o layout peça duas', () => {
    const { ctx, chamadas } = contextoGravador();
    const layout = desenharArteSocial(ctx, opcoes({ layout: 'lado_a_lado', rotulos: ['Hoje'], datas: [''] }), [foto()], {}, 1);
    expect(layout.layout).toBe('unica');
    expect(chamadas.filter((c) => c.nome === 'drawImage')).toHaveLength(1);
    expect(textos(chamadas)).toContain('Hoje');
  });

  it('com duas fotos o layout "unica" vira empilhada em vez de descartar uma foto', () => {
    const { ctx, chamadas } = contextoGravador();
    const layout = desenharArteSocial(ctx, opcoes({ layout: 'unica' }), [foto(), foto()], {}, 1);
    expect(layout.layout).toBe('empilhada');
    expect(chamadas.filter((c) => c.nome === 'drawImage')).toHaveLength(2);
  });

  it('desenha o selo e o avatar quando existem, e não quando faltam', () => {
    const imagem = { width: 256, height: 256 } as unknown as CanvasImageSource;
    const com = contextoGravador();
    desenharArteSocial(com.ctx, opcoes(), [foto(), foto()], { selo: { imagem, tipo: 'marca' }, avatar: imagem }, 1);
    expect(com.chamadas.filter((c) => c.nome === 'drawImage')).toHaveLength(4);
    const sem = contextoGravador();
    desenharArteSocial(sem.ctx, opcoes(), [foto(), foto()], {}, 1);
    expect(sem.chamadas.filter((c) => c.nome === 'drawImage')).toHaveLength(2);
  });

  it('o layout calculado para a prévia é o mesmo usado para pintar', () => {
    const { ctx } = contextoGravador();
    const o = opcoes();
    expect(desenharArteSocial(ctx, o, [foto(), foto()], {}, 1)).toEqual(layoutDaArte(o, 2, {}));
  });

  it('a nota é escrita inteira, centralizada, na zona que o Instagram não cobre, sem sobrepor a pílula nem os perfis', () => {
    const { ctx, chamadas } = contextoGravador();
    const nota = 'Estimativa por vídeo · não é diagnóstico';
    const layout = desenharArteSocial(ctx, opcoes({ nota, layout: 'unica' }), [foto()], {}, 1);
    expect(textos(chamadas)).toContain(nota);
    const n = layout.nota!;
    expect(n.baseY).toBeLessThanOrEqual(1536);
    expect(n.caixa.y).toBeGreaterThanOrEqual(269);
    expect(layout.pilula!.caixa.y + layout.pilula!.caixa.h).toBeLessThanOrEqual(n.caixa.y);
    const desenho = chamadas.find((c) => c.nome === 'fillText' && c.args[0] === nota)!;
    expect(desenho.args.slice(1)).toEqual([540, n.baseY]);
  });

  it('sem nota nada é escrito além do que já era', () => {
    const { ctx, chamadas } = contextoGravador();
    desenharArteSocial(ctx, opcoes(), [foto(), foto()], {}, 1);
    expect(textos(chamadas).join('|')).not.toMatch(/diagnóstico/);
  });
});

describe('desenharMolduraSocial (etapa do vídeo)', () => {
  it('ajusta o canvas ao formato e põe o conteúdo, como uma foto só, dentro da moldura', () => {
    const { ctx, chamadas, canvas } = contextoGravador(10, 10);
    const quadro = { width: 720, height: 1280 } as unknown as CanvasImageSource;
    const layout = desenharMolduraSocial(ctx, 'story', { titulo: 'Marcha', tituloModo: 'vertical', legenda: 'Fase de apoio', perfis: ['rafaelmocbel'], margensStories: true }, quadro);
    expect([canvas.width, canvas.height]).toEqual([1080, 1920]);
    expect(layout.layout).toBe('unica');
    expect(layout.paineis).toHaveLength(1);
    expect(chamadas.filter((c) => c.nome === 'drawImage')).toHaveLength(1);
    expect(textos(chamadas)).toEqual(expect.arrayContaining(['MARCHA', 'Fase de apoio', '@rafaelmocbel']));
  });

  it('respeita a escala ao dimensionar o canvas', () => {
    const { ctx, canvas } = contextoGravador(10, 10);
    desenharMolduraSocial(ctx, 'quadrado', {}, { width: 100, height: 100 } as unknown as CanvasImageSource, {}, 0.5);
    expect([canvas.width, canvas.height]).toEqual([540, 540]);
  });
});
