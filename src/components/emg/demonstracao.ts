// Modo demonstração: um módulo simulado (simulador.ts) ligado ao mesmo serviço da tela, com um
// "paciente virtual" que contrai quando a etapa pede contração e fica em repouso quando pede repouso.
// Serve para ver a tela funcionando sem o aparelho; os valores NÃO são uma medida.

import { ModuloEmg } from '@/lib/emg/moduloEmg';
import type { TipoEtapa } from '@/lib/emg/sessao';
import type { FaseEtapa } from './controlador';

/** O que o paciente virtual usa do módulo simulado (ModuloSimulado cumpre esta forma). */
export interface AlvoDaDemonstracao {
  readonly tempoS: number;
  contrair(inicioS: number, duracaoS: number, amplitudeUv: number): void;
}

export const DEMO_FS_HZ = 1000;
export const DEMO_AMPLITUDES_CVM_UV = [150, 170, 160];
export const DEMO_AMPLITUDES_TAREFA_UV = [70, 85, 60, 78];
export const DEMO_RAJADA_CVM_S = 4.3;
export const DEMO_RAJADA_TAREFA_S = 1.4;
export const DEMO_PAUSA_TAREFA_S = 1.8;
export const DEMO_RAJADA_OCIOSA = { duracaoS: 1.2, amplitudeUv: 60, intervaloS: 6 };

// O módulo simulado conta o tempo em segundos de sinal desde o início da aquisição, e o paciente virtual
// só agenda rajadas para o futuro dele: por isso o resultado depende do tempo do sinal, não do relógio da página.
export class PacienteVirtual {
  private fase: FaseEtapa = 'parada';
  private tipo: TipoEtapa | null = null;
  private proximaS: number;
  private indice = 0;

  constructor(private readonly alvo: AlvoDaDemonstracao) {
    this.proximaS = alvo.tempoS + 3;
  }

  /** Chamado a cada mudança de fase do protocolo. */
  aoFase(fase: FaseEtapa, tipo: TipoEtapa | null, numero: number): void {
    this.fase = fase;
    this.tipo = tipo;
    const t = this.alvo.tempoS;
    if (fase === 'gravando' && tipo === 'cvm') {
      const amplitude = DEMO_AMPLITUDES_CVM_UV[(Math.max(1, numero) - 1) % DEMO_AMPLITUDES_CVM_UV.length];
      this.alvo.contrair(t + 0.1, DEMO_RAJADA_CVM_S, amplitude);
    } else if (fase === 'gravando' && tipo === 'tarefa') {
      this.proximaS = t + 0.3;
      this.indice = 0;
    } else if (fase === 'parada') {
      // Depois de uma etapa, dá um respiro antes de a rajada ociosa voltar.
      this.proximaS = Math.max(this.proximaS, t + 2.5);
    }
  }

  /** Chamado de tempos em tempos: agenda as rajadas da tarefa e as rajadas ociosas. */
  tick(): void {
    const t = this.alvo.tempoS;
    if (t < this.proximaS) return;
    if (this.fase === 'gravando' && this.tipo === 'tarefa') {
      const amplitude = DEMO_AMPLITUDES_TAREFA_UV[this.indice % DEMO_AMPLITUDES_TAREFA_UV.length];
      this.indice++;
      this.alvo.contrair(t + 0.05, DEMO_RAJADA_TAREFA_S, amplitude);
      this.proximaS = t + DEMO_RAJADA_TAREFA_S + DEMO_PAUSA_TAREFA_S;
    } else if (this.fase === 'parada') {
      const { duracaoS, amplitudeUv, intervaloS } = DEMO_RAJADA_OCIOSA;
      this.alvo.contrair(t + 0.05, duracaoS, amplitudeUv);
      this.proximaS = t + intervaloS;
    }
  }
}

export interface Demonstracao {
  modulo: ModuloEmg;
  aoFase(fase: FaseEtapa, tipo: TipoEtapa | null, numero: number): void;
  /** Para o relógio do módulo simulado. Não desconecta o serviço: quem chamou faz isso. */
  encerrar(): void;
}

const INTERVALO_PACIENTE_MS = 250;

/** O simulador só é carregado quando alguém abre a demonstração (fica fora do código principal da tela). */
export async function criarDemonstracao(): Promise<Demonstracao> {
  const { ModuloSimulado, criarBluetoothSimulado } = await import('@/lib/emg/simulador');
  const simulado = new ModuloSimulado({ fsHz: DEMO_FS_HZ, semente: 20261108, amostrasPorQuadro: 50, mtu: 185, bateriaPct: 82 });
  const bluetooth = criarBluetoothSimulado(simulado, { nome: 'RunE W2 (demonstração)' });
  const paciente = new PacienteVirtual(simulado);
  const modulo = new ModuloEmg({ bluetooth });
  simulado.iniciarRelogio();
  const intervalo = setInterval(() => paciente.tick(), INTERVALO_PACIENTE_MS);
  return {
    modulo,
    aoFase: (fase, tipo, numero) => paciente.aoFase(fase, tipo, numero),
    encerrar: () => {
      clearInterval(intervalo);
      simulado.pararRelogio();
    },
  };
}
