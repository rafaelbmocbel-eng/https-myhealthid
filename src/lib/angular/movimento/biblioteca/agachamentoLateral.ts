import type { EntradaBiblioteca } from '../tipos';
import { FONTES as F } from './fontes';

/*
 * Hipóteses para os achados do agachamento filmado de lado que não são diferença entre os lados. O avanço do joelho é só observação
 * medida: o limite é debatido na literatura e o sistema não define critério; as fontes abaixo mostram por que o debate existe.
 * Depois da avaliação metodológica (docs/avaliacao-metodologica-fontes.md) saíram a fonte que associava a dorsiflexão ao tronco sem isolá-la
 * (Honda) e o estudo de 7 participantes sobre a restrição do avanço do joelho (Fry): o fator da restrição ficou "a confirmar". da Costa fica só
 * como evidência contrária (a dorsiflexão passiva não se associou ao tronco), porque fonte que contradiz o fator não é omitida.
 */

export const INCLINACAO_TRONCO: EntradaBiblioteca = {
  chave: 'inclinacao_tronco',
  titulo: 'Inclinação do tronco no ponto mais baixo (agachamento)',
  fatores: [
    {
      id: 'dorsiflexao_e_tronco',
      texto:
        'Elevar o calcanhar de quem tem dorsiflexão restrita reduziu a inclinação do tronco para a frente no agachamento com carga; a limitação de dorsiflexão pode contribuir para a inclinação medida.',
      forca: 'experimental',
      fontes: [F.cai2026, F.daCosta2021],
      ressalva:
        'Cai: 30 homens saudáveis com dorsiflexão restrita, agachamento com carga, seis alturas de calcanhar (0 a 5 cm) e análise tridimensional. O estudo não incluiu um grupo com dorsiflexão não restrita: não mostra quanto da inclinação existiria sem a restrição. Evidência contrária: da Costa (30 adultos sem lesão, amostra de conveniência, agachamento unipodal, análise 3D, estudo transversal) associou a dorsiflexão passiva à rotação interna da coxa (r = -0,38) e, no resumo, não a associou ao tronco; a flexão menor do tronco se associou à dorsiflexão dinâmica, medida durante o próprio agachamento (r = 0,59), que é parte do movimento e não uma mobilidade independente. Ou seja, o único estudo observacional encontrado não sustenta a ligação do tronco com a mobilidade passiva. Não é possível separar a dorsiflexão de outros fatores em uma pessoa.',
    },
    {
      id: 'restricao_do_avanco_do_joelho',
      texto: 'Manter os joelhos atrás da ponta dos pés, por instrução ou por estratégia, pode contribuir para a inclinação do tronco medida.',
      forca: 'a_confirmar',
      fontes: [],
      ressalva:
        'Sem referência verificada com qualidade metodológica suficiente: o único estudo encontrado que mediu a inclinação do tronco com o avanço dos joelhos restrito teve 7 participantes e foi retirado na avaliação metodológica das fontes. Confirme no exame presencial.',
    },
  ],
  conferir: [
    {
      texto: 'Medir a dorsiflexão em carga (teste de avanço em carga) nos dois lados.',
      fonte: F.dill2014,
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
        '30 homens saudáveis com dorsiflexão restrita, agachamento com carga e análise tridimensional, sem grupo com dorsiflexão não restrita. O estudo mediu a progressão da tíbia e não a posição do joelho em relação à ponta do pé, e não define limite nem critério.',
    },
    {
      id: 'instrucao_de_execucao',
      texto:
        'A forma de executar o agachamento, em especial a instrução de manter os joelhos atrás da ponta dos pés, alterou o ângulo do joelho, o movimento do tronco e o estresse patelofemoral estimado; a técnica usada pode contribuir para o avanço observado.',
      forca: 'experimental',
      fontes: [F.list2013, F.kernozek2018],
      ressalva:
        'O efeito do avanço do joelho é debatido e não há limite definido. Kernozek (25 mulheres saudáveis, estimativa por modelo musculoesquelético e não medida) calculou maior estresse patelofemoral quando os joelhos passam dos pés; List (30 pessoas, agachamento com barra e carga de 0 a 50% do peso corporal, captura 3D) descreveu menor ângulo do joelho e maior movimento entre os segmentos lombar e torácico quando o avanço é restringido, e conclui de forma prescritiva além do que mediu. A restrição, portanto, muda o padrão do tronco e do joelho. Por isso o avanço é só observação medida, sem critério ativado.',
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
        'As fontes relacionam a profundidade com a mobilidade: Kim (101 adultos jovens, fotografia sagital, regressão por etapas), Gomes (20 adultos, vídeo 2D, agachamento com barra; só a dorsiflexão no teste de avanço se associou) e Walker (72 adultos, com cálculo amostral, agachamento unipodal por câmera única 3D, correlações baixas de 0,22 a 0,37 que explicam 5% e 14% da variância, testes unicaudais e associação maior só em análise post hoc de quem se exercita mais). Em Walker, o resultado do lado direito (r = 0,223; p = 0,030) é unicaudal e deixa de ser significativo em teste bicaudal (p cerca de 0,06, calculado a partir de r e de n = 72; não consta no artigo), enquanto o do lado esquerdo seguiria significativo. Nenhuma estudou a variação da profundidade entre repetições, então a ligação com a variação é uma inferência. Walker não encontrou associação da força dos abdutores do quadril com a profundidade.',
    },
    {
      id: 'elevacao_do_calcanhar',
      texto:
        'Elevar o calcanhar aumentou a flexão do joelho e do quadril no agachamento de homens com dorsiflexão restrita; mudanças de calçado ou de apoio entre as repetições podem contribuir para a variação da profundidade.',
      forca: 'experimental',
      fontes: [F.cai2026],
      ressalva: 'Um estudo com 30 homens saudáveis com dorsiflexão restrita; o apoio era igual em cada condição, e a variação entre repetições não foi o desfecho.',
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
