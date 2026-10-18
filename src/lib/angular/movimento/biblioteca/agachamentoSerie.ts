import type { EntradaBiblioteca } from '../tipos';
import { FONTES as F } from './fontes';

/*
 * Hipóteses para a mudança de uma medida da primeira para a última repetição. A literatura sobre fadiga é em maior parte de saltos
 * e aterrissagens; para poucas repetições de agachamento não há dado nestas fontes, e a ressalva diz isso. Depois da avaliação metodológica
 * (docs/avaliacao-metodologica-fontes.md) ficou só a revisão registrada e bem conduzida; a revisão de busca em uma única base e o estudo de 10 por
 * grupo saíram.
 */

export const TENDENCIA_NA_SERIE: EntradaBiblioteca = {
  chave: 'tendencia_na_serie',
  titulo: 'Mudança de uma medida da primeira para a última repetição',
  fatores: [
    {
      id: 'fadiga_muscular',
      texto:
        'Fadiga muscular ao longo das repetições pode contribuir para a mudança de uma medida da primeira para a última repetição, mas a evidência disponível é indireta.',
      forca: 'revisao_sistematica',
      fontes: [F.vermeulen2023],
      ressalva:
        'Evidência indireta: a revisão (21 estudos, registrada, cinco bases, qualidade moderada a alta pela lista de Downs e Black) trata de aterrissagens de saltos em pessoas fisicamente ativas e descreve predomínio de mais flexão do tronco depois de fadiga dos membros inferiores; os autores relatam grande heterogeneidade de protocolos de fadiga e de tarefas e não fizeram metanálise. Os protocolos de fadiga são intensos e bem diferentes de poucas repetições de agachamento. Não há dado nesta fonte para uma série curta.',
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
