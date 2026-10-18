import type { EntradaBiblioteca } from '../tipos';
import { FONTES as F } from './fontes';

/*
 * Hipóteses para os achados do agachamento filmado de lado que não são diferença entre os lados. O avanço do joelho é só observação
 * medida: o limite é debatido na literatura e o sistema não define critério; as fontes abaixo mostram por que o debate existe.
 */

export const INCLINACAO_TRONCO: EntradaBiblioteca = {
  chave: 'inclinacao_tronco',
  titulo: 'Inclinação do tronco no ponto mais baixo (agachamento)',
  fatores: [
    {
      id: 'dorsiflexao_e_tronco',
      texto:
        'Menor dorsiflexão do tornozelo foi associada a maior flexão do tronco no agachamento, e elevar o calcanhar de quem tem dorsiflexão restrita reduziu a inclinação do tronco para a frente; a limitação de dorsiflexão pode contribuir para a inclinação medida.',
      forca: 'experimental',
      fontes: [F.cai2026, F.dacosta2021, F.honda2022],
      ressalva:
        'Cai: 30 homens saudáveis com dorsiflexão restrita, agachamento com carga. Da Costa: 30 adultos, agachamento unipodal; a associação foi com a dorsiflexão dinâmica e não com a passiva. Honda: idosos agacharam com menor dorsiflexão e maior flexão do tronco do que adultos jovens, mas os grupos diferem também em idade. Não é possível separar a dorsiflexão de outros fatores em uma pessoa.',
    },
    {
      id: 'restricao_do_avanco_do_joelho',
      texto:
        'Quando o avanço dos joelhos foi restringido durante o agachamento, houve mais inclinação do tronco e da perna para a frente; manter os joelhos atrás dos pés, por instrução ou por estratégia, pode contribuir para a inclinação medida.',
      forca: 'experimental',
      fontes: [F.fry2003],
      ressalva:
        '7 homens treinados, agachamento com barra com carga igual ao peso corporal, filmado em vídeo: amostra pequena e população de pessoas treinadas.',
    },
  ],
  conferir: [
    {
      texto: 'Medir a dorsiflexão passiva em carga nos dois lados e compará-la com a dorsiflexão alcançada no agachamento.',
      fonte: F.dacosta2021,
    },
    {
      texto: 'No exame presencial, observar se a inclinação do tronco muda quando se eleva o calcanhar; se mudar, a dorsiflexão passa a ser um candidato.',
      fonte: F.cai2026,
    },
    { texto: 'Comparar o comprimento do fêmur com o do tronco da pessoa.', semReferenciaVerificada: true },
    {
      texto: 'Observar a curvatura da coluna no exame presencial: o vídeo mede a reta quadril–ombro e não a curvatura lombar.',
      semReferenciaVerificada: true,
    },
  ],
};

export const AVANCO_JOELHO: EntradaBiblioteca = {
  chave: 'avanco_joelho',
  titulo: 'Avanço do joelho em relação à ponta do pé (observação medida)',
  fatores: [
    {
      id: 'dorsiflexao_e_elevacao_do_calcanhar',
      texto:
        'Elevar o calcanhar aumentou o avanço da tíbia e a flexão do joelho no agachamento de homens com dorsiflexão restrita; a mobilidade de dorsiflexão e o apoio do calcanhar podem contribuir para o avanço medido.',
      forca: 'experimental',
      fontes: [F.cai2026],
      ressalva:
        '30 homens saudáveis com dorsiflexão restrita, agachamento com carga e análise tridimensional. O estudo mediu a progressão da tíbia e não a posição do joelho em relação à ponta do pé, e não define limite nem critério.',
    },
    {
      id: 'instrucao_de_execucao',
      texto:
        'A forma de executar o agachamento, em especial a instrução de manter os joelhos atrás da ponta dos pés, alterou o avanço e a distribuição do esforço entre joelho, quadril e tronco; a técnica usada pode contribuir para o avanço observado.',
      forca: 'experimental',
      fontes: [F.fry2003, F.list2013, F.kernozek2018],
      ressalva:
        'O efeito do avanço do joelho é debatido e não há limite definido. Kernozek (25 mulheres saudáveis, estimativa por modelo) calculou maior estresse patelofemoral quando os joelhos passam dos pés; Fry (7 homens treinados) e List (30 pessoas) descreveram mais inclinação do tronco e mais movimento da coluna torácica quando o avanço é restringido. A restrição, portanto, redistribui o esforço. Por isso o avanço é só observação medida, sem critério ativado.',
    },
  ],
  conferir: [
    { texto: 'Medir a dorsiflexão em carga em cada lado e compará-la com o avanço observado.', fonte: F.dill2014 },
    { texto: 'Perguntar sobre dor anterior no joelho (região da patela) ao interpretar o avanço medido.', fonte: F.kernozek2018 },
    {
      texto: 'Conferir se a ponta do pé marcada pelo detector corresponde ao calçado usado e se os pés mudaram de posição entre as repetições.',
      semReferenciaVerificada: true,
    },
    {
      texto: 'Decidir se o avanço será usado como critério: o sistema não define limite, e só o profissional pode ativar um critério.',
      semReferenciaVerificada: true,
    },
  ],
};

export const VARIACAO_PROFUNDIDADE: EntradaBiblioteca = {
  chave: 'variacao_profundidade',
  titulo: 'Variação da profundidade entre as repetições (agachamento)',
  fatores: [
    {
      id: 'mobilidade_dorsiflexao_e_quadril',
      texto:
        'A mobilidade de dorsiflexão do tornozelo (e, em homens, a de flexão do quadril) foi associada à profundidade alcançada no agachamento e pode contribuir para a profundidade medida.',
      forca: 'observacional',
      fontes: [F.gomes2020, F.kim2015, F.walker2026],
      ressalva:
        'As fontes relacionam a profundidade com a mobilidade (101 adultos em Kim; 20 em Gomes, com vídeo bidimensional; 72 em Walker, com correlação baixa); nenhuma estudou a variação da profundidade entre repetições, então a ligação com a variação é uma inferência. Walker não encontrou associação da força dos abdutores do quadril com a profundidade.',
    },
    {
      id: 'elevacao_do_calcanhar',
      texto:
        'Elevar o calcanhar aumentou a flexão do joelho e do quadril no agachamento de homens com dorsiflexão restrita; mudanças de calçado ou de apoio entre as repetições podem contribuir para a variação da profundidade.',
      forca: 'experimental',
      fontes: [F.cai2026],
      ressalva: 'Um estudo com 30 homens saudáveis; o apoio era igual em cada condição, e a variação entre repetições não foi o desfecho.',
    },
    {
      id: 'referencia_de_profundidade_e_ritmo',
      texto:
        'A referência de profundidade usada (marca, banco ou instrução) e o ritmo da execução podem contribuir para variar a profundidade entre as repetições.',
      forca: 'a_confirmar',
      fontes: [],
      ressalva:
        'Sem referência verificada nesta biblioteca: decorre da forma de coletar o vídeo e deve ser confirmado com quem acompanhou a gravação.',
    },
  ],
  conferir: [
    { texto: 'Medir a dorsiflexão em carga e a flexão passiva do quadril de cada lado.', fonte: F.kim2015 },
    {
      texto: 'Confirmar se havia a mesma referência de profundidade (banco, marca ou instrução) em todas as repetições.',
      semReferenciaVerificada: true,
    },
    { texto: 'Conferir os marcos do ponto mais baixo de cada repetição antes de interpretar a variação.', semReferenciaVerificada: true },
  ],
};
