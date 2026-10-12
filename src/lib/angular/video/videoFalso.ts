/**
 * Elemento de vídeo falso para testes (jsdom não toca mídia): imita busca de tempo com o evento `seeked`, as dimensões e,
 * opcionalmente, a duração desconhecida (Infinity) dos WebM gravados pelo navegador.
 */
export interface OpcoesVideoFalso {
  duracao?: number;
  largura?: number;
  altura?: number;
  /** Imita o WebM do MediaRecorder: a duração só aparece depois de ir ao fim do arquivo. */
  semDuracao?: boolean;
  /** Atraso (ms) do evento `seeked`. */
  atrasoBuscaMs?: number;
  /** Instantes pedidos pelo rastreio, na ordem (para o teste conferir). */
  buscas?: number[];
}

export function criarVideoFalso(op: OpcoesVideoFalso = {}): HTMLVideoElement {
  const real = op.duracao ?? 5;
  const alvo = new EventTarget() as EventTarget & Record<string, unknown>;
  let tempo = 0;
  let duracao = op.semDuracao ? Infinity : real;
  Object.defineProperties(alvo, {
    currentTime: {
      get: () => tempo,
      set: (v: number) => {
        op.buscas?.push(v);
        tempo = Math.min(v, real);
        if (v > real && !Number.isFinite(duracao)) {
          duracao = real;
          setTimeout(() => { alvo.dispatchEvent(new Event('durationchange')); alvo.dispatchEvent(new Event('timeupdate')); }, 0);
          return;
        }
        setTimeout(() => alvo.dispatchEvent(new Event('seeked')), op.atrasoBuscaMs ?? 0);
      },
    },
    duration: { get: () => duracao },
    videoWidth: { get: () => op.largura ?? 640 },
    videoHeight: { get: () => op.altura ?? 480 },
    readyState: { get: () => 4 },
    seeking: { get: () => false },
    paused: { get: () => true },
  });
  alvo.pause = () => undefined;
  return alvo as unknown as HTMLVideoElement;
}
