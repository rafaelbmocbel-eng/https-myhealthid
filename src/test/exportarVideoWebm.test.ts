import { describe, expect, it } from 'vitest';
import { BYTES_DO_CABECALHO, corrigirDuracaoDoBlob, lerDuracaoWebm, planejarDuracaoWebm } from '@/lib/angular/video/webmDuracao';

// ---------- construtor mínimo de WebM (EBML) para os testes ----------

const concat = (...partes: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
};

const idBytes = (id: number): Uint8Array => {
  const b: number[] = [];
  let v = id;
  while (v > 0) { b.unshift(v & 0xff); v = Math.floor(v / 256); }
  return Uint8Array.from(b);
};

function tamanhoBytes(n: number, len: number): Uint8Array {
  const out = new Uint8Array(len);
  let resto = n;
  for (let i = len - 1; i >= 0; i--) { out[i] = resto % 256; resto = Math.floor(resto / 256); }
  out[0] |= 0x80 >> (len - 1);
  return out;
}

const DESCONHECIDO = Uint8Array.from([0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

const el = (id: number, payload: Uint8Array, lenTamanho = 1): Uint8Array => concat(idBytes(id), tamanhoBytes(payload.length, lenTamanho), payload);
const uint = (id: number, valor: number, len: number): Uint8Array => {
  const p = new Uint8Array(len);
  let r = valor;
  for (let i = len - 1; i >= 0; i--) { p[i] = r % 256; r = Math.floor(r / 256); }
  return el(id, p);
};
const texto = (id: number, t: string) => el(id, new TextEncoder().encode(t));
const float64 = (id: number, v: number) => { const p = new Uint8Array(8); new DataView(p.buffer).setFloat64(0, v); return el(id, p); };

const ID = { ebml: 0x1a45dfa3, segment: 0x18538067, seekHead: 0x114d9b74, seek: 0x4dbb, seekId: 0x53ab, seekPos: 0x53ac, info: 0x1549a966, escala: 0x2ad7b1, duracao: 0x4489, vazio: 0xec, tracks: 0x1654ae6b, cluster: 0x1f43b675, timecode: 0xe7, bloco: 0xa3 };

const cabecalhoEbml = () => el(ID.ebml, concat(uint(0x4286, 1, 1), uint(0x42f7, 1, 1), texto(0x4282, 'webm')));
const info = (extra: Uint8Array = new Uint8Array(0), escala = 1_000_000) => el(ID.info, concat(uint(ID.escala, escala, 3), texto(0x4d80, 'Chrome'), texto(0x5741, 'Chrome'), extra));
const tracks = () => el(ID.tracks, texto(0xae, 'faixa-de-video'));
const cluster = () => el(ID.cluster, concat(uint(ID.timecode, 0, 1), el(ID.bloco, new Uint8Array(300).fill(7), 2)), 4);

interface Opcoes { seekHead?: boolean; vazio?: number; segmentoConhecido?: boolean; extraInfo?: Uint8Array; escala?: number }

/** Arquivo no formato do MediaRecorder: SeekHead (posições a partir do início do Segment), espaço vazio, Info, Tracks e Cluster. */
function montarWebm(o: Opcoes = {}): { bytes: Uint8Array; inicioSegment: number } {
  const pedacos = (posInfo: number, posTracks: number, posCluster: number) => {
    const seekHead = o.seekHead
      ? el(ID.seekHead, concat(
        el(ID.seek, concat(el(ID.seekId, idBytes(ID.info)), uint(ID.seekPos, posInfo, 2))),
        el(ID.seek, concat(el(ID.seekId, idBytes(ID.tracks)), uint(ID.seekPos, posTracks, 2))),
        el(ID.seek, concat(el(ID.seekId, idBytes(ID.cluster)), uint(ID.seekPos, posCluster, 2))),
      ))
      : new Uint8Array(0);
    const vazio = o.vazio ? el(ID.vazio, new Uint8Array(o.vazio)) : new Uint8Array(0);
    return { seekHead, vazio, info: info(o.extraInfo, o.escala), tracks: tracks(), cluster: cluster() };
  };
  const p0 = pedacos(0, 0, 0);
  const posInfo = p0.seekHead.length + p0.vazio.length;
  const posTracks = posInfo + p0.info.length;
  const posCluster = posTracks + p0.tracks.length;
  const p = pedacos(posInfo, posTracks, posCluster);
  const corpo = concat(p.seekHead, p.vazio, p.info, p.tracks, p.cluster);
  const cab = cabecalhoEbml();
  const segmento = concat(idBytes(ID.segment), o.segmentoConhecido ? tamanhoBytes(corpo.length, 8) : DESCONHECIDO, corpo);
  return { bytes: concat(cab, segmento), inicioSegment: cab.length + 4 + 8 };
}

/** Posições do SeekHead resolvidas para os IDs que estão de fato nelas. */
function posicoesDoIndice(b: Uint8Array, inicioSegment: number): Record<string, string> {
  const hex = (x: ArrayLike<number>) => Array.from(x).map((n) => n.toString(16).padStart(2, '0')).join('');
  const alvos: Record<string, number[]> = { info: [0x15, 0x49, 0xa9, 0x66], tracks: [0x16, 0x54, 0xae, 0x6b], cluster: [0x1f, 0x43, 0xb6, 0x75] };
  const out: Record<string, string> = {};
  // O SeekHead vem logo depois do ID (4 bytes) e do tamanho (1 byte) do seu cabeçalho; cada entrada tem 15 bytes e termina com a posição em 2 bytes.
  let p = inicioSegment + 5;
  for (const nome of ['info', 'tracks', 'cluster']) {
    const posicao = b[p + 13] * 256 + b[p + 14];
    const achado = hex(b.slice(inicioSegment + posicao, inicioSegment + posicao + 4));
    out[nome] = achado === hex(alvos[nome]) ? 'ok' : `errado:${achado}`;
    p += 15;
  }
  return out;
}

const dur = (b: Uint8Array) => lerDuracaoWebm(b.slice(0, BYTES_DO_CABECALHO));

describe('duração dentro do WebM', () => {
  it('sem índice de posições (Segment de tamanho desconhecido): acrescenta a duração no Info e o resto do arquivo fica igual', () => {
    const { bytes } = montarWebm();
    expect(dur(bytes)).toBeNull();
    const plano = planejarDuracaoWebm(bytes.slice(0, BYTES_DO_CABECALHO), 4.25);
    expect(plano).not.toBeNull();
    const novo = concat(plano!.novo, bytes.slice(plano!.ate));
    expect(novo.length).toBe(bytes.length + 11);
    expect(dur(novo)).toBeCloseTo(4.25, 6);
    // Tracks e Cluster seguem intactos, na mesma ordem, depois do Info maior.
    const cauda = bytes.slice(bytes.length - (tracks().length + cluster().length));
    expect(Array.from(novo.slice(novo.length - cauda.length))).toEqual(Array.from(cauda));
  });

  it('Segment de tamanho conhecido: o tamanho do Segment cresce junto', () => {
    const { bytes, inicioSegment } = montarWebm({ segmentoConhecido: true });
    const plano = planejarDuracaoWebm(bytes.slice(0, BYTES_DO_CABECALHO), 2);
    const novo = concat(plano!.novo, bytes.slice(plano!.ate));
    const tamanho = (b: Uint8Array) => {
      let v = b[inicioSegment - 8] & 0x00;
      for (let i = inicioSegment - 7; i < inicioSegment; i++) v = v * 256 + b[i];
      return v;
    };
    expect(tamanho(novo)).toBe(tamanho(bytes) + 11);
    expect(tamanho(novo)).toBe(novo.length - inicioSegment);
    expect(dur(novo)).toBeCloseTo(2, 6);
  });

  it('com SeekHead e espaço vazio antes do Info (formato do Chrome): o espaço paga os bytes novos e as posições seguem certas', () => {
    const { bytes, inicioSegment } = montarWebm({ seekHead: true, vazio: 30, segmentoConhecido: true });
    expect(posicoesDoIndice(bytes, inicioSegment)).toEqual({ info: 'ok', tracks: 'ok', cluster: 'ok' });
    const plano = planejarDuracaoWebm(bytes.slice(0, BYTES_DO_CABECALHO), 6.5);
    expect(plano).not.toBeNull();
    const novo = concat(plano!.novo, bytes.slice(plano!.ate));
    expect(novo.length).toBe(bytes.length);
    expect(dur(novo)).toBeCloseTo(6.5, 6);
    expect(posicoesDoIndice(novo, inicioSegment)).toEqual({ info: 'ok', tracks: 'ok', cluster: 'ok' });
  });

  it('com índice mas sem espaço vazio suficiente: deixa o arquivo como está', () => {
    expect(planejarDuracaoWebm(montarWebm({ seekHead: true, vazio: 5 }).bytes, 3)).toBeNull();
    expect(planejarDuracaoWebm(montarWebm({ seekHead: true }).bytes, 3)).toBeNull();
  });

  it('arquivo que já tem duração coerente não é mexido', () => {
    const { bytes } = montarWebm({ extraInfo: float64(ID.duracao, 4000) });
    expect(dur(bytes)).toBeCloseTo(4, 6);
    expect(planejarDuracaoWebm(bytes, 4.05)).toBeNull();
    expect(planejarDuracaoWebm(bytes, 3.5)).toBeNull();
  });

  it('duração provisória de 1 ms (Chrome que fechou o cabeçalho cedo) ou zerada é trocada no mesmo lugar', () => {
    for (const provisoria of [1, 0]) {
      const { bytes } = montarWebm({ extraInfo: float64(ID.duracao, provisoria) });
      const plano = planejarDuracaoWebm(bytes, 3.5);
      expect(plano).not.toBeNull();
      expect(plano!.novo.length).toBe(plano!.ate);
      expect(dur(concat(plano!.novo, bytes.slice(plano!.ate)))).toBeCloseTo(3.5, 6);
    }
  });

  it('duração em 4 bytes (float32, como o Chrome grava) também é trocada no mesmo lugar', () => {
    const f32 = (v: number) => { const p = new Uint8Array(4); new DataView(p.buffer).setFloat32(0, v); return el(ID.duracao, p); };
    const { bytes } = montarWebm({ extraInfo: f32(1) });
    const plano = planejarDuracaoWebm(bytes, 2.5);
    expect(plano).not.toBeNull();
    expect(dur(concat(plano!.novo, bytes.slice(plano!.ate)))).toBeCloseTo(2.5, 3);
  });

  it('lixo, arquivo cortado e duração inválida voltam sem correção', () => {
    expect(planejarDuracaoWebm(new Uint8Array(64).fill(3), 2)).toBeNull();
    expect(planejarDuracaoWebm(new Uint8Array(0), 2)).toBeNull();
    const { bytes } = montarWebm();
    expect(planejarDuracaoWebm(bytes.slice(0, 20), 2)).toBeNull();
    expect(planejarDuracaoWebm(bytes, 0)).toBeNull();
    expect(planejarDuracaoWebm(bytes, Number.NaN)).toBeNull();
    expect(planejarDuracaoWebm(bytes, -1)).toBeNull();
    expect(lerDuracaoWebm(new Uint8Array(10))).toBeNull();
  });

  it('respeita outra escala de tempo do arquivo', () => {
    // 1 µs por tick (1000 ns): 2 s são 2.000.000 ticks, e a leitura (que usa a mesma escala) devolve 2 s.
    const { bytes } = montarWebm({ escala: 1000 });
    const plano = planejarDuracaoWebm(bytes, 2);
    expect(plano).not.toBeNull();
    const novo = concat(plano!.novo, bytes.slice(plano!.ate));
    expect(dur(novo)).toBeCloseTo(2, 9);
    const padrao = montarWebm();
    const p2 = planejarDuracaoWebm(padrao.bytes, 2);
    expect(dur(concat(p2!.novo, padrao.bytes.slice(p2!.ate)))).toBeCloseTo(2, 9);
  });

  it('corrigirDuracaoDoBlob: WebM sem duração ganha a duração; outros tipos e arquivos fora do padrão voltam como vieram', async () => {
    const { bytes } = montarWebm();
    const lido = (b: Blob) => new Promise<Uint8Array>((ok) => { const r = new FileReader(); r.onload = () => ok(new Uint8Array(r.result as ArrayBuffer)); r.readAsArrayBuffer(b); });
    const corrigido = await corrigirDuracaoDoBlob(new Blob([bytes], { type: 'video/webm;codecs=vp8' }), 5.5);
    expect(corrigido.type).toBe('video/webm;codecs=vp8');
    expect(dur(await lido(corrigido))).toBeCloseTo(5.5, 6);

    const mp4 = new Blob([bytes], { type: 'video/mp4' });
    expect(await corrigirDuracaoDoBlob(mp4, 5)).toBe(mp4);
    const lixo = new Blob([new Uint8Array(100)], { type: 'video/webm' });
    expect(await corrigirDuracaoDoBlob(lixo, 5)).toBe(lixo);
    const jaTem = new Blob([montarWebm({ extraInfo: float64(ID.duracao, 5000) }).bytes], { type: 'video/webm' });
    expect(await corrigirDuracaoDoBlob(jaTem, 5)).toBe(jaTem);
  });
});
