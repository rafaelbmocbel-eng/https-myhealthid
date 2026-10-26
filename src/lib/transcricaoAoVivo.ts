// Transcrição AO VIVO: enquanto a pessoa fala, o áudio é cortado nas pausas da fala e cada trecho vai para a
// transcrição do servidor (edge function `transcrever-audio`, Whisper), em ordem. O texto vai aparecendo trecho a trecho.
//
// Por que cortar em pausas e não em intervalos fixos: cortar no meio de uma palavra faz o Whisper errar as duas
// metades. Por que pular trechos sem voz: o Whisper "inventa" frases ("Obrigado.", legendas) quando recebe silêncio.
//
// O motor não depende de rede nem de navegador para a parte de decisão: `Segmentador` e `TranscritorAoVivo.alimentar`
// recebem amostras PCM 16 kHz mono e podem ser testados sem microfone. A captura (AudioContext) fica em `anexar`.
import { encodeWav16k } from '@/lib/pcmRecorder';

export const TAXA_PCM = 16000;
const QUADRO = 320; // 20 ms a 16 kHz
const QUADROS_POR_SEGUNDO = 50;
// Abaixo disso é ruído de sala (≈ -42 dBFS); acima dele, o limiar acompanha o pico recente da voz.
const LIMIAR_MINIMO = 250;
const FRACAO_DO_PICO = 0.12;
// Voz de menos de 160 ms (um estalo, uma tosse) não vira trecho: o Whisper responderia com texto inventado.
const QUADROS_DE_VOZ_MINIMOS = 8;
const FOLGA_QUADROS = 10; // 200 ms de silêncio mantidos antes e depois da voz

export interface PerfilDeCorte {
  /** Só corta numa pausa depois de acumular pelo menos isto (s). */
  minSeg: number;
  /** Corta mesmo sem pausa ao chegar a isto (s), no ponto mais silencioso dos últimos 1,5 s. */
  maxSeg: number;
  /** Pausa (ms) que conta como fim de frase. */
  pausaMs: number;
}

/** Ditado curto (botão "Ditar"): texto aparece a cada frase. */
export const PERFIL_DITADO: PerfilDeCorte = { minSeg: 4, maxSeg: 14, pausaMs: 450 };
/** Consulta longa (avaliação por voz): trechos maiores, menos chamadas ao servidor. */
export const PERFIL_CONSULTA: PerfilDeCorte = { minSeg: 12, maxSeg: 28, pausaMs: 600 };

export interface Trecho {
  amostras: Int16Array;
  /** Quanto do trecho tem voz (ms): usado para descartar texto inventado em trechos quase mudos. */
  vozMs: number;
}

function rms(quadro: Int16Array): number {
  let soma = 0;
  for (let i = 0; i < quadro.length; i++) soma += quadro[i] * quadro[i];
  return Math.sqrt(soma / Math.max(1, quadro.length));
}

function juntar(partes: Int16Array[]): Int16Array {
  const total = partes.reduce((s, p) => s + p.length, 0);
  const saida = new Int16Array(total);
  let pos = 0;
  for (const p of partes) { saida.set(p, pos); pos += p.length; }
  return saida;
}

/** Decide onde cortar o fluxo de áudio. Puro: recebe PCM 16 kHz mono, devolve trechos prontos para transcrever. */
export class Segmentador {
  private quadros: Int16Array[] = [];
  private energias: number[] = [];
  private resto: Int16Array = new Int16Array(0);
  private pico = 0;
  private silencioSeguido = 0;

  constructor(private perfil: PerfilDeCorte) {}

  private limiar(): number {
    return Math.max(LIMIAR_MINIMO, this.pico * FRACAO_DO_PICO);
  }

  private zerar() {
    this.quadros = [];
    this.energias = [];
    this.silencioSeguido = 0;
  }

  /** Vira trecho só se tiver voz de verdade; apara o silêncio das pontas (deixa 200 ms de folga para não comer consoante). */
  private emitir(quadros: Int16Array[], energias: number[], saida: Trecho[]) {
    const limiar = this.limiar();
    let primeiro = -1;
    let ultimo = -1;
    let comVoz = 0;
    for (let i = 0; i < energias.length; i++) {
      if (energias[i] >= limiar) { if (primeiro < 0) primeiro = i; ultimo = i; comVoz++; }
    }
    if (comVoz < QUADROS_DE_VOZ_MINIMOS) return; // sem voz: descarta
    const de = Math.max(0, primeiro - FOLGA_QUADROS);
    const ate = Math.min(quadros.length, ultimo + 1 + FOLGA_QUADROS);
    saida.push({ amostras: juntar(quadros.slice(de, ate)), vozMs: comVoz * 20 });
  }

  /** Cortar à força: no quadro mais quieto dos últimos 1,5 s, para não partir uma palavra ao meio. */
  private cortarNoMaisQuieto(saida: Trecho[]) {
    const janela = Math.min(this.energias.length, Math.round(1.5 * QUADROS_POR_SEGUNDO));
    const inicio = this.energias.length - janela;
    let melhor = this.energias.length - 1;
    for (let i = this.energias.length - 1; i >= inicio; i--) if (this.energias[i] < this.energias[melhor]) melhor = i;
    const corte = melhor + 1;
    const sobra = this.quadros.slice(corte);
    const energiasSobra = this.energias.slice(corte);
    this.emitir(this.quadros.slice(0, corte), this.energias.slice(0, corte), saida);
    this.zerar();
    for (let i = 0; i < sobra.length; i++) this.empurrar(sobra[i], energiasSobra[i]);
  }

  private empurrar(quadro: Int16Array, energia: number) {
    this.quadros.push(quadro);
    this.energias.push(energia);
    if (energia >= this.limiar()) this.silencioSeguido = 0; else this.silencioSeguido++;
  }

  /** Alimenta com PCM novo; devolve os trechos que ficaram prontos. */
  adicionar(pcm: Int16Array): Trecho[] {
    const saida: Trecho[] = [];
    const entrada = this.resto.length ? juntar([this.resto, pcm]) : pcm;
    const inteiros = Math.floor(entrada.length / QUADRO);
    for (let q = 0; q < inteiros; q++) {
      const quadro = entrada.slice(q * QUADRO, (q + 1) * QUADRO);
      const energia = rms(quadro);
      this.pico = Math.max(energia, this.pico * 0.9995); // o pico "esquece" devagar: a voz pode ficar mais baixa
      this.empurrar(quadro, energia);
      const duracaoSeg = this.quadros.length / QUADROS_POR_SEGUNDO;
      const pausaOk = this.silencioSeguido * 20 >= this.perfil.pausaMs;
      if (duracaoSeg >= this.perfil.minSeg && pausaOk) {
        this.emitir(this.quadros, this.energias, saida);
        this.zerar();
      } else if (duracaoSeg >= this.perfil.maxSeg) {
        this.cortarNoMaisQuieto(saida);
      }
    }
    this.resto = entrada.slice(inteiros * QUADRO);
    return saida;
  }

  /** Fim da gravação: devolve o que sobrou (se tiver voz). */
  finalizar(): Trecho | null {
    const saida: Trecho[] = [];
    const quadros = this.resto.length ? [...this.quadros, this.resto] : this.quadros;
    const energias = this.resto.length ? [...this.energias, rms(this.resto)] : this.energias;
    this.emitir(quadros, energias, saida);
    this.zerar();
    this.resto = new Int16Array(0);
    return saida[0] ?? null;
  }
}

// Frases que o Whisper devolve para áudio quase mudo. Só são descartadas em trechos com pouca voz.
const ALUCINACOES = /^(obrigad[oa]s?|tchau|até (a )?próxima|legendas? (pela|por) .*|amara\.org.*|inscreva-se.*|\.+)[\s.!]*$/i;

export function pareceAlucinacao(texto: string, vozMs: number): boolean {
  return vozMs < 1200 && ALUCINACOES.test(texto.trim());
}

export interface EstadoAoVivo {
  /** Tudo que já foi transcrito, na ordem da fala. */
  texto: string;
  /** Trechos esperando ou em transcrição. */
  pendentes: number;
  /** Trechos que não foram transcritos mesmo com nova tentativa. */
  falhas: number;
  /** Várias falhas seguidas: o ao vivo parou de tentar (a transcrição final cobre). */
  indisponivel: boolean;
}

export interface ResultadoAoVivo {
  texto: string;
  /** Verdadeiro se todo trecho com voz foi transcrito; falso pede a transcrição do áudio inteiro. */
  completo: boolean;
}

export interface OpcoesTranscritor {
  /** Transcreve um trecho (WAV 16 kHz mono). Deve lançar erro se falhar. */
  transcrever: (wav: Blob) => Promise<string>;
  perfil?: PerfilDeCorte;
  aoAtualizar?: (estado: EstadoAoVivo) => void;
  /** Tentativas por trecho (padrão 2). */
  tentativas?: number;
  esperaEntreTentativasMs?: number;
  /** Falhas seguidas para desistir do ao vivo (padrão 3). */
  desistirApos?: number;
  /** Tempo máximo esperando os trechos pendentes ao encerrar (padrão 60 s). */
  esperaFinalMs?: number;
}

const espera = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class TranscritorAoVivo {
  private segmentador: Segmentador;
  private textos: string[] = [];
  private falhou: boolean[] = [];
  private fila: Array<{ indice: number; trecho: Trecho }> = [];
  private proximoIndice = 0;
  private processando: Promise<void> | null = null;
  private falhasSeguidas = 0;
  private indisponivel = false;
  private cancelado = false;
  private encerrado = false; // parar/cancelar já foi pedido: uma captura que ainda estava abrindo não deve ligar
  // captura
  private ctx: AudioContext | null = null;
  private donoDoContexto = false; // só fecha o AudioContext que ele mesmo criou
  private fonte: MediaStreamAudioSourceNode | null = null;
  private no: ScriptProcessorNode | null = null;
  private mudo: GainNode | null = null;
  private carry = 0;

  constructor(private opcoes: OpcoesTranscritor) {
    this.segmentador = new Segmentador(opcoes.perfil ?? PERFIL_DITADO);
  }

  get estado(): EstadoAoVivo {
    return {
      texto: this.textos.filter(Boolean).join(' ').trim(),
      pendentes: this.fila.length, // o trecho em transcrição continua na fila até terminar
      falhas: this.falhou.filter(Boolean).length,
      indisponivel: this.indisponivel,
    };
  }

  private avisar() {
    if (!this.cancelado) this.opcoes.aoAtualizar?.(this.estado);
  }

  /** Recebe PCM 16 kHz mono (Int16). A captura do microfone chama isto; os testes também. */
  alimentar(pcm: Int16Array) {
    if (this.cancelado || this.encerrado) return;
    for (const trecho of this.segmentador.adicionar(pcm)) this.enfileirar(trecho);
  }

  private enfileirar(trecho: Trecho) {
    if (this.cancelado) return;
    const indice = this.proximoIndice++;
    this.textos[indice] = '';
    this.falhou[indice] = false;
    if (this.indisponivel) { this.falhou[indice] = true; this.avisar(); return; } // sem tentar: a transcrição final cobre
    this.fila.push({ indice, trecho });
    this.avisar();
    this.processando ??= this.processar();
  }

  private async processar(): Promise<void> {
    const tentativas = this.opcoes.tentativas ?? 2;
    const desistirApos = this.opcoes.desistirApos ?? 3;
    while (this.fila.length > 0 && !this.cancelado) {
      const { indice, trecho } = this.fila[0];
      let ok = false;
      for (let t = 0; t < tentativas && !this.cancelado; t++) {
        try {
          const texto = (await this.opcoes.transcrever(encodeWav16k([trecho.amostras], trecho.amostras.length))).trim();
          this.textos[indice] = pareceAlucinacao(texto, trecho.vozMs) ? '' : texto;
          ok = true;
          break;
        } catch {
          // falha de rede ou do servidor: tenta de novo e, se continuar, registra o trecho como não transcrito
          if (t < tentativas - 1) await espera(this.opcoes.esperaEntreTentativasMs ?? 700);
        }
      }
      this.fila.shift();
      if (ok) this.falhasSeguidas = 0;
      else {
        this.falhou[indice] = true;
        this.falhasSeguidas++;
        if (this.falhasSeguidas >= desistirApos) {
          this.indisponivel = true;
          for (const pendente of this.fila) this.falhou[pendente.indice] = true; // não insiste: o áudio inteiro cobre
          this.fila = [];
        }
      }
      this.avisar();
    }
    this.processando = null;
  }

  /** Liga o microfone (já aberto pelo chamador) ao motor. Lança erro se o navegador não tiver Web Audio. */
  async anexar(stream: MediaStream): Promise<void> {
    const Contexto = (typeof window !== 'undefined' ? (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined);
    if (!Contexto) throw new Error('Web Audio indisponível');
    const ctx = new Contexto();
    this.ctx = ctx;
    this.donoDoContexto = true;
    try { await ctx.resume(); } catch { /* alguns WebViews já nascem ativos e recusam resume(): segue */ }
    if (this.encerrado || this.cancelado) { // pararam antes de a captura abrir: não deixa o microfone ligado
      this.ctx = null;
      if (ctx.state !== 'closed') void ctx.close().catch(() => { /* já fechado */ });
      return;
    }
    this.ligar(ctx, ctx.createMediaStreamSource(stream));
  }

  /** Para quem já tem AudioContext e fonte (a avaliação por voz): pendura o motor na mesma fonte, sem abrir outro contexto. */
  anexarContexto(ctx: AudioContext, fonte: MediaStreamAudioSourceNode) {
    this.ctx = ctx;
    this.donoDoContexto = false;
    this.ligar(ctx, fonte);
  }

  private ligar(ctx: AudioContext, fonte: MediaStreamAudioSourceNode) {
    const razao = (ctx.sampleRate || 48000) / TAXA_PCM;
    const no = ctx.createScriptProcessor(4096, 1, 1);
    no.onaudioprocess = (ev) => {
      const entrada = ev.inputBuffer.getChannelData(0);
      const saida: number[] = [];
      let pos = this.carry;
      while (pos < entrada.length) {
        const i = Math.floor(pos);
        const frac = pos - i;
        const s0 = entrada[i];
        const s1 = i + 1 < entrada.length ? entrada[i + 1] : s0;
        const s = s0 + (s1 - s0) * frac; // interpolação linear, como no pcmRecorder
        const c = s < -1 ? -1 : s > 1 ? 1 : s;
        saida.push(c < 0 ? c * 0x8000 : c * 0x7fff);
        pos += razao;
      }
      this.carry = pos - entrada.length;
      if (saida.length) this.alimentar(Int16Array.from(saida));
    };
    fonte.connect(no);
    // ScriptProcessor só roda ligado ao destino em alguns navegadores; o ganho zero impede som nos alto-falantes.
    const mudo = ctx.createGain();
    mudo.gain.value = 0;
    no.connect(mudo);
    mudo.connect(ctx.destination);
    this.fonte = fonte; this.no = no; this.mudo = mudo;
  }

  private soltarCaptura() {
    if (this.no) this.no.onaudioprocess = null;
    for (const n of [this.no, this.mudo, this.fonte]) { try { n?.disconnect(); } catch { /* já desconectado */ } }
    const ctx = this.ctx;
    this.no = this.mudo = this.fonte = null;
    this.ctx = null;
    if (ctx && this.donoDoContexto && ctx.state !== 'closed') void ctx.close().catch(() => { /* já fechado */ });
  }

  /** Termina: corta o que sobrou, espera a fila e devolve o texto. */
  async encerrar(): Promise<ResultadoAoVivo> {
    this.encerrado = true;
    this.soltarCaptura();
    const resto = this.segmentador.finalizar();
    if (resto) this.enfileirar(resto);
    const limite = Date.now() + (this.opcoes.esperaFinalMs ?? 60_000);
    while (this.processando && Date.now() < limite) {
      await Promise.race([this.processando, espera(250)]);
    }
    const semResposta = this.processando !== null; // passou do tempo: o que faltou conta como falha
    const estado = this.estado;
    this.cancelado = true; // depois de encerrar nada mais chega à tela (nem trecho atrasado)
    this.fila = [];
    return { texto: estado.texto, completo: !semResposta && estado.falhas === 0 && !estado.indisponivel };
  }

  /** Para tudo sem devolver nada (saiu da tela). */
  cancelar() {
    this.cancelado = true;
    this.encerrado = true;
    this.fila = [];
    this.soltarCaptura();
  }
}
