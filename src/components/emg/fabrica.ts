// Como a tela obtém o módulo EMG. A fábrica existe para os testes poderem trocar o Bluetooth; em produção
// a tela usa fabricaPadrao: o módulo de verdade (Bluetooth do ambiente) ou a demonstração.

import { ModuloEmg, bluetoothDoAmbiente, mensagemSemBluetooth } from '@/lib/emg/moduloEmg';
import { criarDemonstracao, type Demonstracao } from './demonstracao';

/**
 * Escolhas que dependem do aparelho real e que a tela deixa trocar sem publicar uma versão nova
 * (ver "Ajustes para o teste" em "Ver dados recebidos"). Valem a partir da próxima conexão.
 */
export interface AjustesDoModulo {
  /** Frequência da rede elétrica, para o filtro de ruído: 60 Hz no Brasil. */
  redeHz: 50 | 60;
  /** O quadro bruto também emite a amostra-base (float32)? Ponto 2 não confirmado da seção 6 da especificação. */
  incluirPrimeiraAmostra: boolean;
}

export const AJUSTES_PADRAO: AjustesDoModulo = { redeHz: 60, incluirPrimeiraAmostra: true };

export interface FabricaDoModulo {
  temBluetooth(): boolean;
  mensagemSemBluetooth(): string;
  /** Módulo com o Bluetooth do ambiente (plugin nativo ou navegador); só conecta de verdade quando chamam conectar(). */
  criarReal(ajustes?: AjustesDoModulo): ModuloEmg;
  criarDemonstracao(): Promise<Demonstracao>;
}

export const fabricaPadrao: FabricaDoModulo = {
  temBluetooth: () => bluetoothDoAmbiente() !== null,
  mensagemSemBluetooth,
  criarReal: (ajustes = AJUSTES_PADRAO) => new ModuloEmg({ redeHz: ajustes.redeHz, incluirPrimeiraAmostra: ajustes.incluirPrimeiraAmostra }),
  criarDemonstracao,
};
