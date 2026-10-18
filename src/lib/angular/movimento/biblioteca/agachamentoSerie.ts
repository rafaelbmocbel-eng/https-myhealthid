import type { EntradaBiblioteca } from '../tipos';
import { FONTES as F } from './fontes';

/*
 * Hipóteses para a mudança de uma medida da primeira para a última repetição. A literatura sobre fadiga é em maior parte de saltos
 * e aterrissagens; para poucas repetições de agachamento não há dado nestas fontes, e a ressalva diz isso.
 */

export const TENDENCIA_NA_SERIE: EntradaBiblioteca = {
  chave: 'tendencia_na_serie',
  titulo: 'Mudança de uma medida da primeira para a última repetição',
  fatores: [
    {
      id: 'fadiga_muscular',
      texto:
        'Fadiga muscular ao longo das repetições pode contribuir para a mudança de uma medida da primeira para a última repetição, mas a evidência é inconsistente.',
      forca: 'revisao_sistematica',
      fontes: [F.barberwestin2017, F.vermeulen2023, F.webster2014],
      ressalva:
        'Evidência inconsistente: a revisão de 37 estudos (806 atletas saudáveis) não encontrou consistência quanto aos efeitos da fadiga nos ângulos do quadril, do joelho e do tornozelo; a de 21 estudos descreve predomínio de mais flexão do tronco na aterrissagem depois de fadiga dos membros inferiores. A maior parte dos estudos usa saltos e protocolos de fadiga intensos, bem diferentes de poucas repetições de agachamento; no agachamento, Webster (10 homens após reconstrução do ligamento cruzado anterior) viu a carga ficar mais simétrica com a fadiga. Não há dado nestas fontes para uma série curta.',
    },
    {
      id: 'familiarizacao_e_ritmo',
      texto: 'A adaptação ao movimento nas primeiras repetições e a mudança de ritmo ao longo da série podem contribuir para a mudança observada.',
      forca: 'a_confirmar',
      fontes: [],
      ressalva:
        'Sem referência verificada nesta biblioteca: confira a duração das repetições e se a mudança aparece em mais de uma medida antes de atribuí-la a um fator.',
    },
  ],
  conferir: [
    { texto: 'Verificar se a duração da repetição mudou ao longo da série e se a mudança aparece em mais de uma medida.', semReferenciaVerificada: true },
    {
      texto: 'Confirmar no vídeo se os pés, a câmera ou o enquadramento mudaram entre a primeira e a última repetição.',
      semReferenciaVerificada: true,
    },
    { texto: 'Perguntar sobre cansaço ou dor que apareceu durante a série e sobre aquecimento antes da gravação.', semReferenciaVerificada: true },
  ],
};
