// Textos e listas fixas da tela de EMG (fora dos arquivos de componente, que só exportam componentes).

import type { StatusModulo } from '@/lib/emg/moduloEmg';

export const ROTULO_ESTADO: Record<StatusModulo['estado'], string> = {
  desconectado: 'Desconectado',
  conectando: 'Conectando…',
  conectado: 'Conectado',
  adquirindo: 'Lendo o sinal',
  reconectando: 'Religando…',
};

/** Sugestões de músculos comuns; o campo aceita qualquer texto. */
export const MUSCULOS_SUGERIDOS = [
  'Bíceps braquial',
  'Tríceps braquial',
  'Deltoide',
  'Trapézio superior',
  'Peitoral maior',
  'Extensores do punho',
  'Flexores do punho',
  'Reto abdominal',
  'Paravertebrais lombares',
  'Glúteo máximo',
  'Glúteo médio',
  'Reto femoral',
  'Vasto medial',
  'Vasto lateral',
  'Bíceps femoral',
  'Semitendíneo',
  'Tibial anterior',
  'Gastrocnêmio medial',
  'Gastrocnêmio lateral',
  'Sóleo',
  'Masseter',
];
