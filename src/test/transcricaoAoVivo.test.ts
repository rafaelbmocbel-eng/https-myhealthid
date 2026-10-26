import { describe, it, expect, vi } from 'vitest';
import { PERFIL_CONSULTA, PERFIL_DITADO, Segmentador, TAXA_PCM, TranscritorAoVivo, pareceAlucinacao, type EstadoAoVivo } from '@/lib/transcricaoAoVivo';

// Áudio sintético: um tom de 200 Hz com a amplitude pedida faz o papel da voz; zeros (ou ruído fraco) fazem o de silêncio.
const tom = (seg: number, amplitude = 3000): Int16Array => {
  const n = Math.round(seg * TAXA_PCM);
  const saida = new Int16Array(n);
  for (let i = 0; i < n; i++) saida[i] = Math.round(Math.sin((2 * Math.PI * 200 * i) / TAXA_PCM) * amplitude);
  return saida;
};
const silencio = (seg: number, ruido = 0): Int16Array => {
  const n = Math.round(seg * TAXA_PCM);
  const saida = new Int16Array(n);
  if (ruido) for (let i = 0; i < n; i++) saida[i] = Math.round((Math.sin(i * 12.9898) * 43758.5453 % 1) * ruido);
  return saida;
};
const juntar = (...partes: Int16Array[]): Int16Array => {
  const saida = new Int16Array(partes.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const p of partes) { saida.set(p, pos); pos += p.length; }
  return saida;
};
const segundos = (a: Int16Array) => a.length / TAXA_PCM;
// O microfone entrega blocos de 4096 amostras, não o áudio todo de uma vez.
const emBlocos = (audio: Int16Array, tamanho = 4096) => {
  const blocos: Int16Array[] = [];
  for (let i = 0; i < audio.length; i += tamanho) blocos.push(audio.slice(i, i + tamanho));
  return blocos;
};
const alimentarSegmentador = (seg: Segmentador, audio: Int16Array, tamanho?: number) => emBlocos(audio, tamanho).flatMap((b) => seg.adicionar(b));

describe('Segmentador: onde cortar a fala', () => {
  it('fala contínua sem pausa não é cortada antes do fim (só no limite do perfil ou ao encerrar)', () => {
    const seg = new Segmentador(PERFIL_DITADO);
    const prontos = alimentarSegmentador(seg, tom(10));
    expect(prontos).toHaveLength(0);
    const resto = seg.finalizar();
    expect(segundos(resto!.amostras)).toBeCloseTo(10, 1);
    expect(resto!.vozMs).toBeGreaterThan(9000);
  });

  it('corta na pausa de frase quando já há o mínimo acumulado, e o que vem depois vira outro trecho', () => {
    const seg = new Segmentador(PERFIL_DITADO);
    const prontos = alimentarSegmentador(seg, juntar(tom(5), silencio(0.6), tom(3)));
    expect(prontos).toHaveLength(1);
    expect(segundos(prontos[0].amostras)).toBeGreaterThan(5);
    expect(segundos(prontos[0].amostras)).toBeLessThan(5.5); // 5 s de voz + só 200 ms de folga do silêncio
    expect(segundos(seg.finalizar()!.amostras)).toBeCloseTo(3.15, 1); // a fala seguinte, com os 150 ms de silêncio que sobraram do corte
  });

  it('apara o silêncio das pontas: deixa só 200 ms antes e depois da voz', () => {
    const seg = new Segmentador(PERFIL_DITADO);
    const prontos = alimentarSegmentador(seg, juntar(silencio(1), tom(2), silencio(1)));
    const trecho = prontos[0] ?? seg.finalizar()!; // 4 s com pausa no fim já sai no corte da pausa
    expect(segundos(trecho.amostras)).toBeCloseTo(2.4, 1);
    expect(trecho.vozMs).toBeGreaterThan(1900);
  });

  it('pausa curta (0,3 s) no meio da frase não corta', () => {
    const seg = new Segmentador(PERFIL_DITADO);
    expect(alimentarSegmentador(seg, juntar(tom(5), silencio(0.3), tom(3)))).toHaveLength(0);
  });

  it('pausa antes do mínimo (2 s de fala) não corta: o trecho fica maior para o Whisper ter contexto', () => {
    const seg = new Segmentador(PERFIL_DITADO);
    expect(alimentarSegmentador(seg, juntar(tom(2), silencio(1), tom(1)))).toHaveLength(0);
  });

  it('silêncio puro (ou só ruído de sala) não gera trecho nenhum: nada de texto inventado', () => {
    const seg = new Segmentador(PERFIL_DITADO);
    expect(alimentarSegmentador(seg, silencio(20, 80))).toHaveLength(0);
    expect(seg.finalizar()).toBeNull();
  });

  it('estalo de 100 ms em silêncio é descartado; uma palavra de 400 ms vira trecho', () => {
    const estalo = new Segmentador(PERFIL_DITADO);
    alimentarSegmentador(estalo, juntar(silencio(2), tom(0.1), silencio(2)));
    expect(estalo.finalizar()).toBeNull();
    const palavra = new Segmentador(PERFIL_DITADO);
    alimentarSegmentador(palavra, juntar(silencio(1), tom(0.4), silencio(1)));
    expect(palavra.finalizar()).not.toBeNull();
  });

  it('silêncio inicial longo antes de falar é descartado e a fala seguinte vira seu próprio trecho', () => {
    const seg = new Segmentador(PERFIL_DITADO);
    const prontos = alimentarSegmentador(seg, juntar(silencio(6), tom(5), silencio(0.7)));
    expect(prontos).toHaveLength(1);
    expect(segundos(prontos[0].amostras)).toBeGreaterThan(4.9);
    expect(segundos(prontos[0].amostras)).toBeLessThan(5.6); // sem os segundos de silêncio antes da voz
  });

  it('voz baixa (amplitude 600) continua sendo voz; ruído de 100 não', () => {
    const baixa = new Segmentador(PERFIL_DITADO);
    expect(alimentarSegmentador(baixa, juntar(tom(5, 600), silencio(0.6)))).toHaveLength(1);
    const ruido = new Segmentador(PERFIL_DITADO);
    expect(alimentarSegmentador(ruido, juntar(tom(5, 100), silencio(0.6)))).toHaveLength(0);
  });

  it('fala contínua além do limite (14 s) é cortada à força no ponto mais quieto dos últimos 1,5 s, não no meio de uma palavra', () => {
    const seg = new Segmentador(PERFIL_DITADO);
    // 13 s de voz, uma queda curta de volume (60 ms, ainda acima do limiar) aos 13 s, e mais voz.
    const audio = juntar(tom(13), tom(0.06, 500), tom(7));
    const prontos = alimentarSegmentador(seg, audio);
    expect(prontos).toHaveLength(1);
    expect(segundos(prontos[0].amostras)).toBeGreaterThan(12.9);
    expect(segundos(prontos[0].amostras)).toBeLessThan(13.4); // no vale, e não aos 14 s redondos
    const resto = seg.finalizar();
    expect(segundos(prontos[0].amostras) + segundos(resto!.amostras)).toBeCloseTo(20.06, 1); // nada se perde
  });

  it('o resultado não depende do tamanho dos blocos que o microfone entrega', () => {
    const audio = juntar(tom(5), silencio(0.7), tom(6), silencio(0.7), tom(2));
    const cortar = (tamanho: number) => {
      const seg = new Segmentador(PERFIL_DITADO);
      const prontos = alimentarSegmentador(seg, audio, tamanho);
      const resto = seg.finalizar();
      return [...prontos, ...(resto ? [resto] : [])].map((t) => t.amostras.length);
    };
    const referencia = cortar(4096);
    expect(referencia).toHaveLength(3);
    for (const tamanho of [1000, 333, 8192, 100000]) expect(cortar(tamanho)).toEqual(referencia);
  });

  it('perfil de consulta: trechos mínimos de 12 s (menos chamadas ao servidor)', () => {
    const seg = new Segmentador(PERFIL_CONSULTA);
    expect(alimentarSegmentador(seg, juntar(tom(10), silencio(0.8), tom(1)))).toHaveLength(0);
    const seg2 = new Segmentador(PERFIL_CONSULTA);
    expect(alimentarSegmentador(seg2, juntar(tom(13), silencio(0.8), tom(1)))).toHaveLength(1);
  });
});

describe('pareceAlucinacao', () => {
  it('"Obrigado." e legendas num trecho quase mudo são invenção do Whisper; numa fala longa são texto de verdade', () => {
    expect(pareceAlucinacao('Obrigado.', 500)).toBe(true);
    expect(pareceAlucinacao('Legendas pela comunidade Amara.org', 800)).toBe(true);
    expect(pareceAlucinacao('Obrigado.', 6000)).toBe(false);
    expect(pareceAlucinacao('Obrigada pelo atendimento, doutor.', 500)).toBe(false);
  });
});

// O transcritor recebe PCM e chama `transcrever` por trecho. Aqui o servidor é uma função de mentira.
const falaComPausas = (...frases: number[]) => juntar(...frases.flatMap((s) => [tom(s), silencio(0.7)]));
const alimentar = (t: TranscritorAoVivo, audio: Int16Array) => emBlocos(audio).forEach((b) => t.alimentar(b));
const rapido = { esperaEntreTentativasMs: 1, esperaFinalMs: 2000 };

describe('TranscritorAoVivo', () => {
  it('transcreve cada trecho em ordem e o texto vai crescendo; ao encerrar devolve tudo, completo', async () => {
    const respostas = ['primeira frase', 'segunda frase', 'terceira frase'];
    let n = 0;
    const transcrever = vi.fn(async () => respostas[n++]);
    const estados: EstadoAoVivo[] = [];
    const t = new TranscritorAoVivo({ transcrever, aoAtualizar: (e) => estados.push(e), ...rapido });
    alimentar(t, falaComPausas(5, 5, 3));
    const r = await t.encerrar();
    expect(r).toEqual({ texto: 'primeira frase segunda frase terceira frase', completo: true });
    expect(transcrever).toHaveBeenCalledTimes(3);
    const textos = estados.map((e) => e.texto);
    expect(textos).toContain('primeira frase');
    expect(textos).toContain('primeira frase segunda frase');
    expect(Math.max(...estados.map((e) => e.pendentes))).toBeGreaterThan(0);
  });

  it('manda um trecho de cada vez, na ordem da fala, mesmo que o servidor demore mais num e menos noutro', async () => {
    const emAndamento = { atual: 0, maximo: 0 };
    const respostas = ['um', 'dois', 'tres'];
    let n = 0;
    const transcrever = async () => {
      const minha = respostas[n++];
      emAndamento.atual++;
      emAndamento.maximo = Math.max(emAndamento.maximo, emAndamento.atual);
      await new Promise((r) => setTimeout(r, minha === 'um' ? 30 : 1));
      emAndamento.atual--;
      return minha;
    };
    const t = new TranscritorAoVivo({ transcrever, ...rapido });
    alimentar(t, falaComPausas(5, 5, 3));
    const r = await t.encerrar();
    expect(r.texto).toBe('um dois tres');
    expect(emAndamento.maximo).toBe(1);
  });

  it('fala curta (3 s) sem pausa longa vira UMA chamada só, ao encerrar (igual ao ditado de antes)', async () => {
    const transcrever = vi.fn(async () => 'dor no joelho');
    const t = new TranscritorAoVivo({ transcrever, ...rapido });
    alimentar(t, tom(3));
    expect(transcrever).not.toHaveBeenCalled();
    expect(await t.encerrar()).toEqual({ texto: 'dor no joelho', completo: true });
    expect(transcrever).toHaveBeenCalledTimes(1);
  });

  it('o trecho vai para o servidor como WAV 16 kHz mono com a duração certa', async () => {
    const recebidos: Blob[] = [];
    const t = new TranscritorAoVivo({ transcrever: async (wav) => { recebidos.push(wav); return 'ok'; }, ...rapido });
    alimentar(t, tom(3));
    await t.encerrar();
    expect(recebidos).toHaveLength(1);
    expect(recebidos[0].type).toBe('audio/wav');
    expect(recebidos[0].size).toBe(44 + 3 * TAXA_PCM * 2);
  });

  it('falha de um trecho: tenta de novo e, dando certo, segue completo', async () => {
    let chamadas = 0;
    const transcrever = vi.fn(async () => { chamadas++; if (chamadas === 1) throw new Error('rede'); return 'texto'; });
    const t = new TranscritorAoVivo({ transcrever, ...rapido });
    alimentar(t, tom(3));
    expect(await t.encerrar()).toEqual({ texto: 'texto', completo: true });
    expect(transcrever).toHaveBeenCalledTimes(2);
  });

  it('trecho que falha mesmo com nova tentativa: o resto continua, e o resultado diz que NÃO está completo (o áudio inteiro cobre)', async () => {
    let n = 0;
    const transcrever = vi.fn(async () => {
      n++;
      if (n <= 2) throw new Error('servidor'); // as 2 tentativas do primeiro trecho
      return 'segundo trecho';
    });
    const t = new TranscritorAoVivo({ transcrever, ...rapido });
    alimentar(t, falaComPausas(5, 4));
    const r = await t.encerrar();
    expect(r).toEqual({ texto: 'segundo trecho', completo: false });
  });

  it('três trechos seguidos falhando: o ao vivo desiste, para de chamar o servidor e avisa que está indisponível', async () => {
    const transcrever = vi.fn(async () => { throw new Error('limite de uso'); });
    const estados: EstadoAoVivo[] = [];
    const t = new TranscritorAoVivo({ transcrever, aoAtualizar: (e) => estados.push(e), tentativas: 1, ...rapido });
    alimentar(t, falaComPausas(5, 5, 5, 5, 5));
    const r = await t.encerrar();
    expect(r.completo).toBe(false);
    expect(transcrever.mock.calls.length).toBeLessThanOrEqual(4); // 3 falhas e (no máximo) o que já estava em andamento: não insiste nos outros
    expect(estados.at(-1)!.indisponivel).toBe(true);
  });

  it('"Obrigado." devolvido para um trecho quase mudo é descartado; numa fala longa é mantido', async () => {
    const curto = new TranscritorAoVivo({ transcrever: async () => 'Obrigado.', ...rapido });
    alimentar(curto, juntar(silencio(1), tom(0.5), silencio(1)));
    expect(await curto.encerrar()).toEqual({ texto: '', completo: true });
    const longo = new TranscritorAoVivo({ transcrever: async () => 'Obrigado.', ...rapido });
    alimentar(longo, tom(5));
    expect((await longo.encerrar()).texto).toBe('Obrigado.');
  });

  it('silêncio puro não chama o servidor nenhuma vez', async () => {
    const transcrever = vi.fn(async () => 'não deveria');
    const t = new TranscritorAoVivo({ transcrever, ...rapido });
    alimentar(t, silencio(15, 60));
    expect(await t.encerrar()).toEqual({ texto: '', completo: true });
    expect(transcrever).not.toHaveBeenCalled();
  });

  it('servidor que nunca responde: encerrar não trava, passa do tempo e pede a transcrição do áudio inteiro', async () => {
    const t = new TranscritorAoVivo({ transcrever: () => new Promise<string>(() => {}), ...rapido, esperaFinalMs: 60 });
    alimentar(t, tom(3));
    const r = await t.encerrar();
    expect(r.completo).toBe(false);
  });

  it('cancelar (saiu da tela) para tudo: nenhum aviso depois, nenhuma chamada nova', async () => {
    const transcrever = vi.fn(async () => 'texto');
    const aoAtualizar = vi.fn();
    const t = new TranscritorAoVivo({ transcrever, aoAtualizar, ...rapido });
    alimentar(t, tom(3));
    t.cancelar();
    alimentar(t, falaComPausas(5, 5));
    await new Promise((r) => setTimeout(r, 30));
    expect(transcrever).not.toHaveBeenCalled();
    expect(aoAtualizar).not.toHaveBeenCalled();
  });

  it('depois de encerrar, um trecho que chegasse atrasado não mexe mais na tela', async () => {
    let soltar: (t: string) => void = () => {};
    const aoAtualizar = vi.fn();
    const t = new TranscritorAoVivo({ transcrever: () => new Promise<string>((r) => { soltar = r; }), aoAtualizar, ...rapido, esperaFinalMs: 40 });
    alimentar(t, tom(3));
    await t.encerrar();
    const chamadasAntes = aoAtualizar.mock.calls.length;
    soltar('atrasado');
    await new Promise((r) => setTimeout(r, 30));
    expect(aoAtualizar.mock.calls.length).toBe(chamadasAntes);
  });
});
