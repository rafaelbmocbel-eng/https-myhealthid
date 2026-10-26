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

  it('estalo de 40 ms em silêncio é descartado; uma palavra de 400 ms vira trecho', () => {
    const estalo = new Segmentador(PERFIL_DITADO);
    alimentarSegmentador(estalo, juntar(silencio(2), tom(0.04), silencio(2)));
    expect(estalo.finalizar()).toBeNull();
    expect(estalo.descartesSuspeitos).toBe(0);
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

  it('legendas inventadas e texto só entre colchetes são descartados mesmo num trecho longo (ruído constante vira "voz")', () => {
    expect(pareceAlucinacao('Legendas pela comunidade Amara.org', 8000)).toBe(true);
    expect(pareceAlucinacao('Inscreva-se no canal!', 8000)).toBe(true);
    expect(pareceAlucinacao('[Música]', 8000)).toBe(true);
    expect(pareceAlucinacao('(silêncio)', 8000)).toBe(true);
    expect(pareceAlucinacao('Paciente refere dor [lombar] há dois meses.', 8000)).toBe(false);
  });
});

// O transcritor recebe PCM e chama `transcrever` por trecho. Aqui o servidor é uma função de mentira.
const falaComPausas = (...frases: number[]) => juntar(...frases.flatMap((s) => [tom(s), silencio(0.7)]));
const alimentar = (t: TranscritorAoVivo, audio: Int16Array) => emBlocos(audio).forEach((b) => t.alimentar(b));
const rapido = { esperaEntreTentativasMs: 1, esperaFinalMs: 2000, caudaMs: 0 };

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
    // sem texto nenhum e com algo descartado, "obrigado" pode ter sido fala de verdade: pede o áudio inteiro
    expect(await curto.encerrar()).toEqual({ texto: '', completo: false });
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


// ---- Achados da revisão independente ----

// Microfone de mentira: um AudioContext que devolve os nós criados e deixa o teste entregar blocos de áudio.
function criarContextoFalso(opcoes: { resume?: () => Promise<void>; falharGanho?: boolean } = {}) {
  const processadores: Array<{ onaudioprocess: ((ev: unknown) => void) | null; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
  const fonte = { connect: vi.fn(), disconnect: vi.fn() };
  const ctx = {
    sampleRate: TAXA_PCM,
    state: 'running',
    destination: {},
    resume: vi.fn(opcoes.resume ?? (async () => {})),
    close: vi.fn(async () => { ctx.state = 'closed'; }),
    createMediaStreamSource: vi.fn(() => fonte),
    createScriptProcessor: vi.fn(() => {
      const no = { onaudioprocess: null as ((ev: unknown) => void) | null, connect: vi.fn(), disconnect: vi.fn() };
      processadores.push(no);
      return no;
    }),
    createGain: vi.fn(() => {
      if (opcoes.falharGanho) throw new Error('sem ganho');
      return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
    }),
  };
  const entregar = (audio: Int16Array) => {
    const flutuante = Float32Array.from(audio, (v) => v / 32768);
    for (const no of processadores) no.onaudioprocess?.({ inputBuffer: { getChannelData: () => flutuante } });
  };
  return { ctx: ctx as unknown as AudioContext, bruto: ctx, fonte: fonte as unknown as MediaStreamAudioSourceNode, fonteBruta: fonte, processadores, entregar };
}

describe('TranscritorAoVivo: nenhuma fala se perde (captura que falha NÃO vale como silêncio)', () => {
  it('a captura nunca abriu (resume() pendurado) e a pessoa parou: pede o áudio inteiro e fecha o contexto', async () => {
    const falso = criarContextoFalso({ resume: () => new Promise<void>(() => {}) });
    vi.stubGlobal('window', { AudioContext: function () { return falso.ctx; } });
    try {
      const t = new TranscritorAoVivo({ transcrever: async () => 'x', ...rapido });
      void t.anexar({} as MediaStream).catch(() => {});
      const r = await t.encerrar();
      expect(r).toEqual({ texto: '', completo: false });
      expect(falso.bruto.close).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });

  it('a captura ligou mas não chega áudio nenhum durante 20 s: não é silêncio, é falha da captura', async () => {
    let agora = 1_000_000;
    const relogio = vi.spyOn(Date, 'now').mockImplementation(() => agora);
    try {
      const falso = criarContextoFalso();
      const t = new TranscritorAoVivo({ transcrever: async () => 'x', ...rapido });
      t.anexarContexto(falso.ctx, falso.fonte);
      agora += 20_000;
      expect(await t.encerrar()).toEqual({ texto: '', completo: false });
    } finally { relogio.mockRestore(); }
  });

  it('chegou só 5 s de áudio em 60 s de gravação: o texto parcial NÃO vale como completo', async () => {
    let agora = 1_000_000;
    const relogio = vi.spyOn(Date, 'now').mockImplementation(() => agora);
    try {
      const falso = criarContextoFalso();
      const t = new TranscritorAoVivo({ transcrever: async () => 'parte', ...rapido });
      t.anexarContexto(falso.ctx, falso.fonte);
      emBlocos(tom(5)).forEach((b) => falso.entregar(b));
      agora += 60_000;
      const r = await t.encerrar();
      expect(r.completo).toBe(false);
      expect(r.texto).toBe('parte');
    } finally { relogio.mockRestore(); }
  });

  it('captura saudável (o áudio chega na mesma duração da gravação) segue completa', async () => {
    let agora = 1_000_000;
    const relogio = vi.spyOn(Date, 'now').mockImplementation(() => agora);
    try {
      const falso = criarContextoFalso();
      const t = new TranscritorAoVivo({ transcrever: async () => 'texto', ...rapido });
      t.anexarContexto(falso.ctx, falso.fonte);
      emBlocos(tom(8)).forEach((b) => falso.entregar(b));
      agora += 8_300; // 300 ms de folga: latência de abertura e último bloco
      expect(await t.encerrar()).toEqual({ texto: 'texto', completo: true });
    } finally { relogio.mockRestore(); }
  });

  it('a duração real da gravação informada por quem chama também vale (a captura abriu tarde)', async () => {
    const t = new TranscritorAoVivo({ transcrever: async () => 'texto', ...rapido });
    alimentar(t, tom(3));
    expect((await t.encerrar(30_000)).completo).toBe(false);
    const ok = new TranscritorAoVivo({ transcrever: async () => 'texto', ...rapido });
    alimentar(ok, tom(3));
    expect((await ok.encerrar(3_400)).completo).toBe(true);
  });

  it('estalo forte antes da fala não faz a fala sumir (o limiar não sobe junto com o pico do estalo)', async () => {
    const fala = juntar(...[5, 5, 5, 5].flatMap((s) => [tom(s, 1500), silencio(0.7)])); // ≈ -30 dBFS, como no relato do revisor
    const comEstalo = new TranscritorAoVivo({ transcrever: vi.fn(async () => 'frase'), ...rapido });
    alimentar(comEstalo, juntar(tom(0.06, 30000), silencio(1), fala));
    const r = await comEstalo.encerrar();
    expect(r.texto).not.toBe('');
    expect(r.completo).toBe(true);
  });

  it('tosse forte e longa seguida de fala bem baixa: a fala vai para o servidor ou o resultado admite que não está completo (nunca descarta calado)', async () => {
    let enviados = 0;
    const baixa = juntar(...[5, 5, 4].flatMap((s) => [tom(s, 450), silencio(0.7)])); // RMS ≈ 320: acima do ruído de sala, abaixo do teto do limiar
    const t = new TranscritorAoVivo({ transcrever: async (wav) => { enviados += (wav.size - 44) / 2; return 'algum texto'; }, ...rapido });
    alimentar(t, juntar(tom(0.4, 20000), silencio(1), baixa));
    const r = await t.encerrar();
    expect(r.completo === false || enviados >= 12 * TAXA_PCM).toBe(true);
  });

  it('palavra curta (100 ms) sozinha não vira trecho, mas avisa que não está completo (pode ter sido um "sim")', async () => {
    const transcrever = vi.fn(async () => 'x');
    const t = new TranscritorAoVivo({ transcrever, ...rapido });
    alimentar(t, juntar(silencio(2), tom(0.1), silencio(2)));
    const r = await t.encerrar();
    expect(transcrever).not.toHaveBeenCalled();
    expect(r).toEqual({ texto: '', completo: false });
  });

  it('só descartou texto inventado e nada mais: pede o áudio inteiro em vez de entregar vazio', async () => {
    const t = new TranscritorAoVivo({ transcrever: async () => 'Legendas pela comunidade Amara.org', ...rapido });
    alimentar(t, tom(8, 700));
    expect(await t.encerrar()).toEqual({ texto: '', completo: false });
  });
});

describe('TranscritorAoVivo: servidor lento ou pendurado', () => {
  it('chamada que não responde estoura o tempo, conta como falha e a fila segue', async () => {
    let n = 0;
    const transcrever = vi.fn((_wav: Blob, sinal?: AbortSignal) => {
      n++;
      if (n === 1) return new Promise<string>((_r, rej) => sinal?.addEventListener('abort', () => rej(new Error('abortada'))));
      return Promise.resolve('segundo');
    });
    const t = new TranscritorAoVivo({ transcrever, tentativas: 1, timeoutTentativaMs: 30, ...rapido });
    alimentar(t, falaComPausas(5, 4));
    const r = await t.encerrar();
    expect(r).toEqual({ texto: 'segundo', completo: false });
    expect(transcrever.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
  });

  it('servidor pendurado: a fila não cresce sem limite, o ao vivo desiste e a memória não acumula trechos', async () => {
    const estados: EstadoAoVivo[] = [];
    const t = new TranscritorAoVivo({ transcrever: () => new Promise<string>(() => {}), aoAtualizar: (e) => estados.push(e), timeoutTentativaMs: 60_000, maxPendentes: 3, ...rapido, esperaFinalMs: 50 });
    alimentar(t, falaComPausas(5, 5, 5, 5, 5, 5, 5, 5, 5, 5));
    expect(Math.max(...estados.map((e) => e.pendentes))).toBeLessThanOrEqual(3);
    expect(estados.at(-1)!.indisponivel).toBe(true);
    expect((await t.encerrar()).completo).toBe(false);
  });

  it('transcrever que lança na hora (síncrono) não deixa a fila presa', async () => {
    const t = new TranscritorAoVivo({ transcrever: () => { throw new Error('sem rede'); }, tentativas: 1, ...rapido });
    alimentar(t, tom(3));
    const r = await t.encerrar();
    expect(r.completo).toBe(false);
    expect(t.estado.pendentes).toBe(0);
  });
});

describe('TranscritorAoVivo: ciclo de vida da captura', () => {
  it('anexarContexto + cancelar: desliga só a ligação do motor e NÃO fecha o contexto nem derruba os outros ouvintes da fonte', () => {
    const falso = criarContextoFalso();
    const t = new TranscritorAoVivo({ transcrever: async () => 'x', ...rapido });
    t.anexarContexto(falso.ctx, falso.fonte);
    const no = falso.processadores[0];
    t.cancelar();
    expect(falso.fonteBruta.disconnect).toHaveBeenCalledTimes(1);
    expect(falso.fonteBruta.disconnect).toHaveBeenCalledWith(no);
    expect(falso.bruto.close).not.toHaveBeenCalled();
    expect(no.onaudioprocess).toBeNull();
  });

  it('ligação que falha no meio não deixa o nó de áudio órfão chamando o servidor', () => {
    const falso = criarContextoFalso({ falharGanho: true });
    const t = new TranscritorAoVivo({ transcrever: async () => 'x', ...rapido });
    expect(() => t.anexarContexto(falso.ctx, falso.fonte)).toThrow();
    for (const no of falso.processadores) expect(no.onaudioprocess).toBeNull();
    expect(falso.bruto.close).not.toHaveBeenCalled();
  });

  it('cancelar no meio do encerrar não devolve "completo" com trechos faltando', async () => {
    let soltar: (t: string) => void = () => {};
    const t = new TranscritorAoVivo({ transcrever: () => new Promise<string>((r) => { soltar = r; }), ...rapido, esperaFinalMs: 5000 });
    alimentar(t, falaComPausas(5, 4));
    const pendente = t.encerrar();
    await new Promise((r) => setTimeout(r, 20));
    t.cancelar();
    soltar('um');
    const r = await pendente;
    expect(r.completo).toBe(false);
  });

  it('a ponta final da fala (último bloco do microfone) ainda entra: o motor espera um instante antes de soltar a captura', async () => {
    const falso = criarContextoFalso();
    const recebidos: Blob[] = [];
    const t = new TranscritorAoVivo({ transcrever: async (wav) => { recebidos.push(wav); return 'ok'; }, ...rapido, caudaMs: 40 });
    t.anexarContexto(falso.ctx, falso.fonte);
    emBlocos(tom(3)).forEach((b) => falso.entregar(b));
    const fim = t.encerrar();
    falso.entregar(tom(0.2));
    await fim;
    expect(recebidos[0].size).toBe(44 + (3 * TAXA_PCM + Math.round(0.2 * TAXA_PCM)) * 2);
  });
});
