// Controle da sessão de EMG fora do React: guarda o sinal recente para os gráficos, grava as etapas do
// protocolo guiado e conta o tempo pelas AMOSTRAS recebidas (não pelo relógio), então cada etapa tem a
// duração exata de sinal e, se o módulo parar de mandar dados, a etapa para de andar e é cancelada.
//
// A tela chama aoAmostras() a cada lote do módulo. Nada aqui dispara renderização por amostra: quem
// quer mostrar o estado lê estado() num relógio próprio, e os eventos (ouvir) só saem quando a etapa muda.

import { BufferCircular } from '@/lib/emg/bufferCircular';
import type { LoteDeAmostras } from '@/lib/emg/moduloEmg';
import {
  DURACAO_MAX_ETAPA_S,
  GravadorDeSessao,
  PROTOCOLO_SESSAO,
  type CanalEmg,
  type ResultadoEtapa,
  type TipoEtapa,
} from '@/lib/emg/sessao';

/** Contagem regressiva antes de gravar cada etapa: dá tempo de se posicionar e de o filtro assentar. */
export const PREPARO_S = 3;
export const MAX_TENTATIVAS_CVM = 6;
/** Sem lote por este tempo, a etapa em andamento é cancelada (o módulo parou de mandar ou a conexão caiu). */
export const LIMITE_SEM_DADOS_MS = 2500;

const TAXA_MAXIMA_HZ = 1000;
const CAPACIDADE_SINAL_S = 10;
const CAPACIDADE_BRUTA_S = 2;
const MIN_S_PARA_TAXA_MEDIDA = 2;

const CANAL_INTERNO: CanalEmg = { id: '1', musculo: '', lado: '-' };

export type FaseEtapa = 'parada' | 'preparo' | 'gravando';

export interface EstadoEtapa {
  fase: FaseEtapa;
  tipo: TipoEtapa | null;
  /** Tentativa (CVM) ou ordem entre as etapas do mesmo tipo. */
  numero: number;
  /** Segundos já contados: do preparo, na fase "preparo", ou do que foi gravado, na fase "gravando". */
  decorridoS: number;
  /** Duração da fase em segundos; null na tarefa gravando (dura até o usuário parar). */
  alvoS: number | null;
  /** Quanto falta do descanso sugerido entre tentativas de CVM; null fora do descanso. */
  descansoRestanteS: number | null;
}

export type EventoControlador =
  | { tipo: 'fase'; fase: FaseEtapa; etapa: TipoEtapa | null; numero: number }
  | { tipo: 'etapa-finalizada'; resultado: ResultadoEtapa }
  | { tipo: 'etapas-mudaram' }
  | { tipo: 'aviso'; texto: string };

export interface OpcoesControlador {
  /** Relógio em ms (injetável nos testes). Padrão: Date.now. */
  agora?: () => number;
  preparoS?: number;
  repousoS?: number;
  cvmS?: number;
}

export interface EstatisticaDoSinal {
  amostras: number;
  media: number;
  rms: number;
  min: number;
  max: number;
}

export interface SinalRecente {
  /** Últimos instantes do sinal já filtrado. */
  filtrado: EstatisticaDoSinal | null;
  /** Últimos instantes do sinal bruto, como o módulo mandou: mostra o nível de base e a faixa (unidade e escala). */
  bruto: EstatisticaDoSinal | null;
}

function estatistica(amostras: Float64Array): EstatisticaDoSinal | null {
  let n = 0;
  let soma = 0;
  let somaQuadrados = 0;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < amostras.length; i++) {
    const v = amostras[i];
    if (!Number.isFinite(v)) continue;
    n++;
    soma += v;
    somaQuadrados += v * v;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (n === 0) return null;
  return { amostras: n, media: soma / n, rms: Math.sqrt(somaQuadrados / n), min, max };
}

export class ControladorEmg {
  /** Sinal filtrado recente (µV): alimenta o gráfico, o RMS e o selo de qualidade. */
  readonly bufferVivo = new BufferCircular(TAXA_MAXIMA_HZ * CAPACIDADE_SINAL_S);
  /** Sinal bruto recente: só para o diagnóstico. */
  readonly bufferBruto = new BufferCircular(TAXA_MAXIMA_HZ * CAPACIDADE_BRUTA_S);

  private readonly agora: () => number;
  private readonly preparoS: number;
  private readonly duracaoS: { repouso: number; cvm: number };
  private readonly ouvintes = new Set<(ev: EventoControlador) => void>();

  private taxaHz: number | null = null;
  private fsDaSessao: number | null = null;
  private feitas: ResultadoEtapa[] = [];

  private fase: FaseEtapa = 'parada';
  private tipo: TipoEtapa | null = null;
  private numero = 0;
  private preparoAlvo = 0;
  private preparoContadas = 0;
  private alvoAmostras: number | null = null;
  private gravadas = 0;
  private gravador: GravadorDeSessao | null = null;
  private descansoDesde: number | null = null;

  private ultimoLoteEm = 0;
  private primeiroLoteEm: number | null = null;
  private amostrasNoPrimeiro = 0;
  private lotes = 0;
  private amostras = 0;

  constructor(opcoes: OpcoesControlador = {}) {
    this.agora = opcoes.agora ?? Date.now;
    this.preparoS = opcoes.preparoS ?? PREPARO_S;
    this.duracaoS = {
      repouso: opcoes.repousoS ?? PROTOCOLO_SESSAO.repousoS,
      cvm: opcoes.cvmS ?? PROTOCOLO_SESSAO.cvmDuracaoS,
    };
  }

  // -------------------------------------------------------------------------
  // Leitura
  // -------------------------------------------------------------------------

  /** Taxa do último lote recebido; null enquanto nenhum chegou. */
  get fsHz(): number | null {
    return this.taxaHz;
  }

  /** Taxa em que as etapas gravadas foram registradas; null sem etapas. */
  get fsSessao(): number | null {
    return this.fsDaSessao;
  }

  get etapas(): readonly ResultadoEtapa[] {
    return this.feitas.slice();
  }

  quantas(tipo: TipoEtapa): number {
    return this.feitas.filter((e) => e.tipo === tipo).length;
  }

  get lotesRecebidos(): number {
    return this.lotes;
  }

  get amostrasRecebidas(): number {
    return this.amostras;
  }

  estado(): EstadoEtapa {
    const fs = this.taxaHz ?? 0;
    let descansoRestanteS: number | null = null;
    if (this.descansoDesde !== null && this.fase === 'parada') {
      const falta = PROTOCOLO_SESSAO.cvmDescansoSugeridoS - (this.agora() - this.descansoDesde) / 1000;
      if (falta > 0) descansoRestanteS = falta;
    }
    if (this.fase === 'parada' || this.tipo === null || fs <= 0) {
      return { fase: 'parada', tipo: null, numero: 0, decorridoS: 0, alvoS: null, descansoRestanteS };
    }
    if (this.fase === 'preparo') {
      return {
        fase: 'preparo',
        tipo: this.tipo,
        numero: this.numero,
        decorridoS: this.preparoContadas / fs,
        alvoS: this.preparoAlvo / fs,
        descansoRestanteS: null,
      };
    }
    return {
      fase: 'gravando',
      tipo: this.tipo,
      numero: this.numero,
      decorridoS: this.gravadas / fs,
      // A tarefa só tem o teto de 15 min por segurança de memória: para a tela ela dura até o usuário parar.
      alvoS: this.alvoAmostras === null || this.tipo === 'tarefa' ? null : this.alvoAmostras / fs,
      descansoRestanteS: null,
    };
  }

  /** Amostras por segundo de relógio desde o primeiro lote; null com menos de 2 s de dados. */
  taxaMedidaHz(): number | null {
    if (this.primeiroLoteEm === null) return null;
    const decorridoS = (this.ultimoLoteEm - this.primeiroLoteEm) / 1000;
    if (decorridoS < MIN_S_PARA_TAXA_MEDIDA) return null;
    return (this.amostras - this.amostrasNoPrimeiro) / decorridoS;
  }

  sinalRecente(segundos = 2): SinalRecente {
    const fs = this.taxaHz ?? 0;
    if (fs <= 0) return { filtrado: null, bruto: null };
    const n = Math.round(fs * segundos);
    return {
      filtrado: estatistica(this.bufferVivo.ultimas(n)),
      bruto: estatistica(this.bufferBruto.ultimas(n)),
    };
  }

  ouvir(cb: (ev: EventoControlador) => void): () => void {
    this.ouvintes.add(cb);
    return () => {
      this.ouvintes.delete(cb);
    };
  }

  // -------------------------------------------------------------------------
  // Entrada de sinal
  // -------------------------------------------------------------------------

  /** Um lote do módulo (ModuloEmg.onAmostras). Nunca lança. */
  readonly aoAmostras = (lote: LoteDeAmostras): void => {
    const n = lote.filtradas.length;
    if (n === 0) return;
    const agora = this.agora();
    this.taxaHz = lote.fsHz;
    this.ultimoLoteEm = agora;
    if (this.primeiroLoteEm === null) {
      this.primeiroLoteEm = agora;
      this.amostrasNoPrimeiro = n;
    }
    this.lotes++;
    this.amostras += n;
    this.bufferVivo.empurrar(lote.filtradas);
    this.bufferBruto.empurrar(lote.brutas);

    if (this.fsDaSessao !== null && lote.fsHz !== this.fsDaSessao && (this.feitas.length > 0 || this.fase === 'gravando')) {
      this.reiniciarSessao(
        'A taxa de amostragem do módulo mudou durante a sessão. As etapas gravadas foram descartadas: refaça o protocolo.',
      );
    }

    let restante: Float64Array = lote.filtradas;
    if (this.fase === 'preparo') {
      const falta = this.preparoAlvo - this.preparoContadas;
      if (n < falta) {
        this.preparoContadas += n;
        return;
      }
      this.preparoContadas = this.preparoAlvo;
      restante = lote.filtradas.subarray(falta);
      this.comecarGravacao(lote.fsHz);
    }
    if (this.fase === 'gravando' && restante.length > 0) this.gravar(restante);
  };

  // -------------------------------------------------------------------------
  // Etapas
  // -------------------------------------------------------------------------

  /** Começa a contagem regressiva da etapa; a gravação começa sozinha quando ela acaba. */
  iniciarEtapa(tipo: TipoEtapa): void {
    if (this.fase !== 'parada') throw new Error('Já há uma etapa em andamento: espere ou cancele.');
    const fs = this.taxaHz;
    if (fs === null || fs <= 0) throw new Error('Ainda não chegou sinal do módulo.');
    if (tipo === 'cvm' && this.quantas('cvm') >= MAX_TENTATIVAS_CVM) {
      throw new Error(`O limite é de ${MAX_TENTATIVAS_CVM} tentativas de CVM: refaça a última.`);
    }
    this.tipo = tipo;
    this.numero = this.quantas(tipo) + 1;
    this.fase = 'preparo';
    this.preparoAlvo = Math.round(fs * this.preparoS);
    this.preparoContadas = 0;
    this.descansoDesde = null;
    this.ultimoLoteEm = this.agora();
    this.emitir({ tipo: 'fase', fase: 'preparo', etapa: tipo, numero: this.numero });
    if (this.preparoAlvo === 0) this.comecarGravacao(fs);
  }

  /** Termina a tarefa livre e guarda o que foi gravado. Em outra etapa ou sem sinal gravado, só cancela. */
  finalizarTarefa(): void {
    if (this.tipo !== 'tarefa' || this.fase === 'parada') return;
    if (this.fase === 'gravando' && this.gravadas > 0) {
      this.finalizar();
      return;
    }
    this.cancelarEtapa();
  }

  /** Abandona a etapa em andamento sem guardar nada. */
  cancelarEtapa(motivo?: string): void {
    if (this.fase === 'parada') return;
    this.zerarEtapa();
    this.emitir({ tipo: 'fase', fase: 'parada', etapa: null, numero: 0 });
    if (motivo) this.emitir({ tipo: 'aviso', texto: motivo });
  }

  /**
   * Tira etapas já gravadas para refazê-las: repouso e tarefa saem por inteiro; da CVM sai só a última
   * tentativa. Devolve quantas saíram.
   */
  descartarParaRefazer(tipo: TipoEtapa): number {
    if (this.fase !== 'parada') throw new Error('Cancele a etapa em andamento antes de refazer.');
    const antes = this.feitas.length;
    if (tipo === 'cvm') {
      for (let i = this.feitas.length - 1; i >= 0; i--) {
        if (this.feitas[i].tipo === 'cvm') {
          this.feitas.splice(i, 1);
          break;
        }
      }
    } else {
      this.feitas = this.feitas.filter((e) => e.tipo !== tipo);
    }
    this.renumerar();
    this.descansoDesde = null;
    if (this.feitas.length === 0) this.fsDaSessao = null;
    const tiradas = antes - this.feitas.length;
    if (tiradas > 0) this.emitir({ tipo: 'etapas-mudaram' });
    return tiradas;
  }

  /** Esquece todas as etapas (nova sessão ou mudança de taxa). */
  reiniciarSessao(aviso?: string): void {
    const emAndamento = this.fase !== 'parada';
    this.zerarEtapa();
    this.feitas = [];
    this.fsDaSessao = null;
    this.descansoDesde = null;
    if (emAndamento) this.emitir({ tipo: 'fase', fase: 'parada', etapa: null, numero: 0 });
    this.emitir({ tipo: 'etapas-mudaram' });
    if (aviso) this.emitir({ tipo: 'aviso', texto: aviso });
  }

  /** Nova conexão: o sinal e os contadores recomeçam; as etapas já gravadas ficam. */
  novaConexao(): void {
    if (this.fase !== 'parada') this.cancelarEtapa();
    this.bufferVivo.limpar();
    this.bufferBruto.limpar();
    this.taxaHz = null;
    this.primeiroLoteEm = null;
    this.amostrasNoPrimeiro = 0;
    this.lotes = 0;
    this.amostras = 0;
    this.ultimoLoteEm = 0;
  }

  /** Cancela a etapa em andamento se o módulo parou de mandar sinal; true se cancelou. */
  verificarSemDados(): boolean {
    if (this.fase === 'parada') return false;
    if (this.agora() - this.ultimoLoteEm <= LIMITE_SEM_DADOS_MS) return false;
    this.cancelarEtapa('O sinal parou de chegar durante a etapa, que foi descartada. Confira a conexão e refaça.');
    return true;
  }

  destruir(): void {
    this.ouvintes.clear();
    this.zerarEtapa();
  }

  // -------------------------------------------------------------------------
  // Interno
  // -------------------------------------------------------------------------

  private comecarGravacao(fs: number): void {
    const tipo = this.tipo;
    if (tipo === null) return;
    this.gravador = new GravadorDeSessao({ fsHz: fs, canal: CANAL_INTERNO });
    this.gravador.iniciarEtapa(tipo);
    this.gravadas = 0;
    this.fase = 'gravando';
    if (tipo === 'tarefa') this.alvoAmostras = Math.floor(fs * DURACAO_MAX_ETAPA_S);
    else this.alvoAmostras = Math.round(fs * this.duracaoS[tipo]);
    this.emitir({ tipo: 'fase', fase: 'gravando', etapa: tipo, numero: this.numero });
  }

  private gravar(amostras: Float64Array): void {
    const gravador = this.gravador;
    if (!gravador || this.alvoAmostras === null) return;
    const cabem = Math.min(amostras.length, this.alvoAmostras - this.gravadas);
    if (cabem > 0) {
      gravador.receber(cabem === amostras.length ? amostras : amostras.subarray(0, cabem));
      this.gravadas += cabem;
    }
    if (this.gravadas >= this.alvoAmostras) {
      const tarefa = this.tipo === 'tarefa';
      // O alvo da tarefa é o teto do gravador e aqui nada passa dele, então só o controlador sabe que cortou.
      if (tarefa) gravador.marcarCortada();
      this.finalizar();
      if (tarefa) {
        this.emitir({ tipo: 'aviso', texto: `A tarefa chegou ao limite de ${DURACAO_MAX_ETAPA_S / 60} minutos e foi encerrada.` });
      }
    }
  }

  private finalizar(): void {
    const gravador = this.gravador;
    const tipo = this.tipo;
    const fs = this.taxaHz;
    if (!gravador || tipo === null || fs === null) {
      this.cancelarEtapa();
      return;
    }
    const bruto = gravador.finalizarEtapa();
    const resultado: ResultadoEtapa = { ...bruto, numero: this.quantas(tipo) + 1 };
    this.feitas.push(resultado);
    this.fsDaSessao = gravador.fsHz;
    const cvm = tipo === 'cvm';
    this.zerarEtapa();
    if (cvm && this.quantas('cvm') < PROTOCOLO_SESSAO.cvmTentativas) this.descansoDesde = this.agora();
    this.emitir({ tipo: 'fase', fase: 'parada', etapa: null, numero: 0 });
    this.emitir({ tipo: 'etapa-finalizada', resultado });
    this.emitir({ tipo: 'etapas-mudaram' });
  }

  private zerarEtapa(): void {
    this.fase = 'parada';
    this.tipo = null;
    this.numero = 0;
    this.preparoAlvo = 0;
    this.preparoContadas = 0;
    this.alvoAmostras = null;
    this.gravadas = 0;
    this.gravador = null;
  }

  private renumerar(): void {
    const contagem: Record<string, number> = {};
    this.feitas = this.feitas.map((e) => {
      contagem[e.tipo] = (contagem[e.tipo] ?? 0) + 1;
      return { ...e, numero: contagem[e.tipo] };
    });
  }

  private emitir(ev: EventoControlador): void {
    for (const ouvinte of Array.from(this.ouvintes)) {
      try {
        ouvinte(ev);
      } catch (erro) {
        console.error('[emg] ouvinte do controlador lançou um erro', erro);
      }
    }
  }
}
