// ── Análise de Demandas de Melhoria ─────────────────────────────────────────
// Analisa scores da avaliação e gera demandas priorizadas + protocolo automático

export interface DemandaMelhoria {
  area: string;
  score: number;
  severidade: 'Crítica' | 'Alta' | 'Moderada';
  descricao: string;
  prioridade: number; // 0 = máxima
  motivo: string;
  acaoRecomendada: string;
  cor: string;
  corBg: string;
}

export interface ExercicioSugerido {
  nome: string;
  categoria: string;
  series: number;
  repeticoes: number | string;
  duracao: string;
  motivo: string;
  descricao: string;
  instrucoes: string[];
}

export interface TecnicaSugerida {
  nome: string;
  descricao: string;
  duracao: string;
  frequencia: string;
  motivo: string;
}

export interface FaseProtocolo {
  numero: number;
  titulo: string;
  semanas: string;
  semanas_inicio: number;
  semanas_fim: number;
  objetivo: string;
  demandasAlvo: string[];
  exercicios: ExercicioSugerido[];
  tecnicas: TecnicaSugerida[];
  frequenciaSemanal: number;
  duracaoSessao: string;
  cor: string;
  corBg: string;
  corBorda: string;
}

export interface ProtocoloAnalise {
  demandasIdentificadas: DemandaMelhoria[];
  fases: FaseProtocolo[];
  prognose: string;
  objetivoGeral: string;
  duracaoTotal: string;
  frequencia: string;
}

// ── Mapeamento de exercícios por demanda ──────────────────────────────────────
const EXERCICIOS_POR_DEMANDA: Record<string, ExercicioSugerido[]> = {
  Regulação: [
    {
      nome: 'Respiração Diafragmática',
      categoria: 'Respiração',
      series: 1,
      repeticoes: 10,
      duracao: '10 min',
      motivo: 'Ativa o sistema parassimpático, reduz hiperativação neurovegetativa',
      descricao: 'Respiração abdominal profunda para restaurar equilíbrio do sistema nervoso autônomo.',
      instrucoes: ['Deite-se com joelhos flexionados', 'Mão no abdômen', 'Inspire 4s expandindo abdômen', 'Expire 6s lentamente'],
    },
    {
      nome: 'Relaxamento Muscular Progressivo (Jacobson)',
      categoria: 'Relaxamento',
      series: 1,
      repeticoes: 1,
      duracao: '20 min',
      motivo: 'Reduz tensão muscular crônica associada à desregulação neurovegetativa',
      descricao: 'Contração e relaxamento progressivo de grupos musculares para liberar tensão acumulada.',
      instrucoes: ['Deite-se confortavelmente', 'Contraia cada grupo muscular por 5s', 'Relaxe 30s', 'Progrida dos pés à cabeça'],
    },
    {
      nome: 'Body Scan (Escaneamento Corporal)',
      categoria: 'Relaxamento',
      series: 1,
      repeticoes: 1,
      duracao: '15 min',
      motivo: 'Mindfulness corporal melhora consciência interoceptiva e qualidade do sono',
      descricao: 'Atenção plena ao corpo para redução de tensão e hipervigilância.',
      instrucoes: ['Ambiente silencioso', 'Olhos fechados', 'Leve atenção da cabeça aos pés sem julgamento', 'Respiração natural'],
    },
  ],
  Estrutural: [
    {
      nome: 'Mobilidade Articular Global',
      categoria: 'Mobilidade',
      series: 2,
      repeticoes: 10,
      duracao: '10 min',
      motivo: 'Restaura amplitude articular comprometida pelo score Estrutural elevado',
      descricao: 'Movimentos suaves em todas as direções para recuperar mobilidade funcional.',
      instrucoes: ['Movimentos lentos e controlados', 'Respeite o limiar de dor', 'Cubra todas as articulações', 'Sem força'],
    },
    {
      nome: 'Ativação de Core (Dead Bug)',
      categoria: 'Fortalecimento',
      series: 3,
      repeticoes: 8,
      duracao: '12 min',
      motivo: 'Estabilização espinhal essencial para comprometimento estrutural',
      descricao: 'Ativação profunda do core mantendo coluna neutra para suporte estrutural.',
      instrucoes: ['Deite de costas', 'Joelhos 90° no ar', 'Alterne braço/perna opostos', 'Lombar sempre no chão'],
    },
    {
      nome: 'Ponte de Glúteos',
      categoria: 'Fortalecimento',
      series: 3,
      repeticoes: 12,
      duracao: '10 min',
      motivo: 'Fortalece cadeia posterior, fundamental para estabilização estrutural',
      descricao: 'Exercício fundamental de fortalecimento de glúteos e estabilização lombar.',
      instrucoes: ['De costas, pés apoiados', 'Eleve o quadril lentamente', 'Mantenha 2s no topo', 'Desça controlado'],
    },
    {
      nome: 'Liberação Miofascial com Rolo',
      categoria: 'Mobilidade',
      series: 1,
      repeticoes: '60s por região',
      duracao: '15 min',
      motivo: 'Reduz aderências miofasciais e melhora circulação local em áreas comprometidas',
      descricao: 'Auto-liberação de tensão miofascial para restaurar qualidade tecidual.',
      instrucoes: ['Posicione o rolo na área tensa', 'Pressão moderada', 'Mantenha 60s em pontos de tensão', 'Respire profundamente'],
    },
  ],
  'Psico-comportamental': [
    {
      nome: 'Movimento Gradual Consciente',
      categoria: 'Funcional',
      series: 2,
      repeticoes: 10,
      duracao: '15 min',
      motivo: 'Dessensibilização gradual ao movimento para reduzir cinesiofobia (P elevado)',
      descricao: 'Exposição progressiva ao movimento em ambiente seguro para restaurar confiança motora.',
      instrucoes: ['Comece com amplitudes mínimas', 'Observe e nomeie as sensações sem catastrofizar', 'Progrida conforme tolerância', 'Celebrate cada progresso'],
    },
    {
      nome: 'Caminhada Controlada com Atenção Plena',
      categoria: 'Funcional',
      series: 1,
      repeticoes: '10-15 min',
      duracao: '15 min',
      motivo: 'Reestrutura o padrão de medo ao movimento com evidência de segurança',
      descricao: 'Caminhada consciente para reconectar com o corpo e reduzir comportamentos evitadores.',
      instrucoes: ['Ritmo confortável', 'Atenção às sensações dos pés no chão', 'Respiração natural', 'Sem julgamento das sensações'],
    },
    {
      nome: 'Exercícios de Grounding (Ancoragem)',
      categoria: 'Relaxamento',
      series: 1,
      repeticoes: '5 min',
      duracao: '5 min',
      motivo: 'Técnica de ancoragem no presente reduz hipervigilância e medo antecipatório',
      descricao: 'Técnica 5-4-3-2-1 para reduzir ansiedade antecipatória ao movimento.',
      instrucoes: ['Nomeie 5 coisas que vê', '4 que toca', '3 que ouve', '2 que cheira', '1 que saboreia'],
    },
  ],
  'Dor Percebida': [
    {
      nome: 'Movimento de Baixa Intensidade',
      categoria: 'Funcional',
      series: 2,
      repeticoes: 10,
      duracao: '15 min',
      motivo: 'Movimento suave libera endorfinas naturais e melhora limiar de dor',
      descricao: 'Exercícios muito suaves para modular dor através de mecanismos naturais analgésicos.',
      instrucoes: ['Intensidade máxima 3/10 de esforço', 'Parar se dor aumentar acima de 4/10', 'Focar na qualidade, não quantidade'],
    },
    {
      nome: 'Respiração para Modulação de Dor',
      categoria: 'Respiração',
      series: 1,
      repeticoes: '5 min',
      duracao: '5 min',
      motivo: 'Respiração controlada ativa sistema descendente de inibição da dor',
      descricao: 'Técnica respiratória para ativar vias naturais de controle da dor.',
      instrucoes: ['Inspire 4s', 'Segure 4s', 'Expire 6s', 'Foque na expiração longa'],
    },
    {
      nome: 'Movimentos Agradáveis e Prazerosos',
      categoria: 'Funcional',
      series: 1,
      repeticoes: '10-20 min',
      duracao: '20 min',
      motivo: 'Associação de movimento com prazer quebra o ciclo dor-evitação-mais dor',
      descricao: 'Atividades físicas que o paciente aprecia para criar memórias positivas de movimento.',
      instrucoes: ['Escolha uma atividade agradável', 'Dança suave, jardinagem leve, natação', 'Foco no prazer, não na performance'],
    },
  ],
  Funcionalidade: [
    {
      nome: 'Sentar-Levantar da Cadeira (Sit-to-Stand)',
      categoria: 'Funcional',
      series: 3,
      repeticoes: 10,
      duracao: '10 min',
      motivo: 'Atividade de vida diária fundamental para restaurar funcionalidade básica',
      descricao: 'Exercício que mimetiza atividade cotidiana essencial para independência funcional.',
      instrucoes: ['Cadeira com braços no início', 'Pés na largura dos ombros', 'Incline tronco levemente', 'Movimento controlado'],
    },
    {
      nome: 'Agachamento Assistido',
      categoria: 'Fortalecimento',
      series: 3,
      repeticoes: 10,
      duracao: '12 min',
      motivo: 'Padrão funcional fundamental comprometido pelo baixo EFI',
      descricao: 'Agachamento com apoio para restaurar padrão motor funcional seguro.',
      instrucoes: ['Segure apoio firme', 'Pés afastados', 'Desça controlado até 60°', 'Suba empurrando o chão'],
    },
    {
      nome: 'Treino de Equilíbrio Unipodal',
      categoria: 'Propriocepção',
      series: 3,
      repeticoes: '30s',
      duracao: '10 min',
      motivo: 'Propriocepção comprometida é central na baixa funcionalidade',
      descricao: 'Equilíbrio em apoio único para restaurar controle postural e prevenir quedas.',
      instrucoes: ['Próximo a parede', 'Apoio em um pé', 'Joelho levemente flexionado', 'Progrida: olhos fechados'],
    },
    {
      nome: 'Marcha Funcional Controlada',
      categoria: 'Funcional',
      series: 1,
      repeticoes: '10 min',
      duracao: '10 min',
      motivo: 'Padrão de marcha comprometido é principal limitador da funcionalidade',
      descricao: 'Caminhada com atenção à qualidade do padrão de marcha.',
      instrucoes: ['Ritmo lento e controlado', 'Postura ereta', 'Balanço natural dos braços', 'Passos conscientes'],
    },
  ],
  'Carga Contextual': [
    {
      nome: 'Exercícios de Gestão de Estresse',
      categoria: 'Relaxamento',
      series: 1,
      repeticoes: '10 min',
      duracao: '10 min',
      motivo: 'Carga contextual elevada mantém o sistema nervoso em alerta constante',
      descricao: 'Técnicas de relaxamento e gestão do estresse para reduzir carga alostática.',
      instrucoes: ['Ambiente tranquilo', 'Combine respiração com relaxamento muscular', 'Prática diária por 10 min'],
    },
    {
      nome: 'Orientação Postural no Trabalho',
      categoria: 'Funcional',
      series: 1,
      repeticoes: '5 min',
      duracao: '5 min',
      motivo: 'Contexto laboral é fator de manutenção da disfunção quando carga C é elevada',
      descricao: 'Exercícios de ergonomia e postura adaptados ao ambiente de trabalho do paciente.',
      instrucoes: ['Avalie o posto de trabalho', 'Pausas a cada 45-60 min', 'Micropausas de alongamento', 'Ajuste cadeira e monitor'],
    },
  ],
};

// ── Técnicas por demanda ───────────────────────────────────────────────────────
const TECNICAS_POR_DEMANDA: Record<string, TecnicaSugerida[]> = {
  Regulação: [
    { nome: 'Educação em Neurociência do Sono', descricao: 'Orientação sobre higiene do sono, ritmo circadiano e impacto na regulação neurovegetativa.', duracao: '30 min', frequencia: 'Sessão 1', motivo: 'R baixo frequentemente associado a distúrbios do sono' },
    { nome: 'Treinamento de Respiração Guiada', descricao: 'Protocolo estruturado de técnicas respiratórias para ativação parassimpática.', duracao: '15 min/dia', frequencia: '2x por semana', motivo: 'Respiração é o recurso mais direto para modular o sistema nervoso autônomo' },
  ],
  Estrutural: [
    { nome: 'Terapia Manual Articular', descricao: 'Mobilização e manipulação articular para restaurar movimento normal e reduzir dor.', duracao: '20-30 min', frequencia: '1-2x por semana', motivo: 'Score E elevado indica comprometimento tecidual que responde à terapia manual' },
    { nome: 'Educação em Movimento Seguro', descricao: 'Orientação sobre biomecânica e padrões de movimento seguros para reduzir sobrecarga.', duracao: '20 min', frequencia: 'Primeiras 2 semanas', motivo: 'Evitar padrões compensatórios que perpetuam o comprometimento estrutural' },
  ],
  'Psico-comportamental': [
    { nome: 'Educação em Neurofisiologia da Dor (PNE)', descricao: 'Explicação do modelo biopsicossocial de dor e desmistificação do medo ao movimento.', duracao: '45 min', frequencia: 'Sessões 1-2', motivo: 'Psicoeducação é o primeiro passo para reduzir kinesiofobia (score P ≥ 7)' },
    { nome: 'Graded Exposure (Exposição Gradual)', descricao: 'Protocolo de exposição progressiva aos movimentos temidos com hierarquia de medo.', duracao: '30 min', frequencia: '2x por semana', motivo: 'Evidência A para redução de kinesiofobia e comportamentos evitadores' },
  ],
  'Dor Percebida': [
    { nome: 'Educação em Neurofisiologia da Dor', descricao: 'Compreensão do mecanismo da dor para reduzir catastrofização e aumentar autoeficácia.', duracao: '45 min', frequencia: 'Primeiras 2 sessões', motivo: 'Entender a dor é o primeiro passo para modulá-la' },
    { nome: 'Modulação Sensorial (TENS/Calor/Frio)', descricao: 'Recursos físicos para modulação da dor como facilitador do exercício.', duracao: '20 min', frequencia: 'Conforme necessidade', motivo: 'Controle de dor permite maior tolerância ao exercício terapêutico' },
  ],
  Funcionalidade: [
    { nome: 'Reabilitação Funcional Progressiva', descricao: 'Protocolo de restauração funcional baseado em tarefas e atividades significativas para o paciente.', duracao: '45 min', frequencia: '2-3x por semana', motivo: 'Funcionalidade comprometida (EFI baixo) requer abordagem funcional específica' },
    { nome: 'Adaptação de Atividades de Vida Diária', descricao: 'Identificação e adaptação de atividades cotidianas para reduzir sobrecarga e manter função.', duracao: '30 min', frequencia: 'Sessão inicial', motivo: 'Manter participação funcional enquanto reabilitação progride' },
  ],
  'Carga Contextual': [
    { nome: 'Gestão do Estresse e Mindfulness', descricao: 'Técnicas de redução de estresse baseadas em mindfulness para reduzir carga alostática.', duracao: '20 min', frequencia: 'Diário (prática domiciliar)', motivo: 'Carga contextual elevada perpetua sensibilização central e dor' },
    { nome: 'Orientação Ergonômica e Postural', descricao: 'Avaliação do ambiente de trabalho e orientações para reduzir sobrecarga física e cognitiva.', duracao: '45 min', frequencia: '1 sessão + follow-up', motivo: 'Contexto laboral mantém o sistema em alerta quando não é modificado' },
  ],
};

// ── Identificar demandas ──────────────────────────────────────────────────────
export function identificarDemandas(scores: {
  E: number; P: number; C: number; F: number; D: number; R: number; EFI: number;
}): DemandaMelhoria[] {
  const demandas: DemandaMelhoria[] = [];

  if (scores.R <= 4) {
    demandas.push({
      area: 'Regulação',
      score: scores.R,
      severidade: 'Crítica',
      descricao: 'Regulação neurovegetativa comprometida — base fisiológica para todas as intervenções',
      prioridade: 0,
      motivo: `Score R = ${scores.R.toFixed(1)} (limiar crítico ≤ 4). A regulação neurovegetativa é a fundação do tratamento — sem restaurá-la, outras intervenções têm eficácia reduzida.`,
      acaoRecomendada: 'Restaurar equilíbrio do sistema nervoso autônomo',
      cor: '#dc2626',
      corBg: '#fef2f2',
    });
  }

  if (scores.EFI <= 4) {
    demandas.push({
      area: 'Funcionalidade',
      score: scores.EFI,
      severidade: 'Crítica',
      descricao: 'Funcionalidade severamente comprometida em atividades cotidianas',
      prioridade: 1,
      motivo: `Score EFI = ${scores.EFI.toFixed(1)} (crítico ≤ 4). Incapacidade funcional grave limita participação em todas as áreas de vida.`,
      acaoRecomendada: 'Restaurar capacidade funcional básica',
      cor: '#dc2626',
      corBg: '#fef2f2',
    });
  }

  if (scores.E >= 7) {
    demandas.push({
      area: 'Estrutural',
      score: scores.E,
      severidade: 'Alta',
      descricao: 'Comprometimento estrutural significativo identificado na avaliação',
      prioridade: 2,
      motivo: `Score E = ${scores.E.toFixed(1)} (alto ≥ 7). Disfunção estrutural nas unidades corporais requer intervenção direta.`,
      acaoRecomendada: 'Mobilizar, fortalecer e estabilizar estruturas comprometidas',
      cor: '#ea580c',
      corBg: '#fff7ed',
    });
  }

  if (scores.P >= 7) {
    demandas.push({
      area: 'Psico-comportamental',
      score: scores.P,
      severidade: 'Alta',
      descricao: 'Kinesiofobia e comportamentos evitadores comprometendo recuperação',
      prioridade: 3,
      motivo: `Score P = ${scores.P.toFixed(1)} (kinesiofobia alta ≥ 7 na TSK-11). Medo do movimento perpetua ciclo dor-evitação.`,
      acaoRecomendada: 'Reduzir medo ao movimento e comportamentos evitadores',
      cor: '#d97706',
      corBg: '#fffbeb',
    });
  }

  if (scores.D >= 7) {
    demandas.push({
      area: 'Dor Percebida',
      score: scores.D,
      severidade: 'Alta',
      descricao: 'Dor percebida alta com impacto significativo na qualidade de vida',
      prioridade: 4,
      motivo: `Score D = ${scores.D.toFixed(1)} (alto ≥ 7). Dor intensa interfere diretamente na participação e funcionalidade.`,
      acaoRecomendada: 'Modular dor e restaurar tolerância à atividade',
      cor: '#9333ea',
      corBg: '#faf5ff',
    });
  }

  if (scores.C >= 5) {
    demandas.push({
      area: 'Carga Contextual',
      score: scores.C,
      severidade: scores.C >= 7 ? 'Alta' : 'Moderada',
      descricao: 'Fatores contextuais (trabalho, estresse, relações) mantendo a disfunção',
      prioridade: 5,
      motivo: `Score C = ${scores.C.toFixed(1)} (moderado-alto). Contexto desfavorável é fator de manutenção e perpetuação da disfunção.`,
      acaoRecomendada: 'Otimizar contexto e reduzir fatores de manutenção',
      cor: '#2563eb',
      corBg: '#eff6ff',
    });
  }

  if (scores.F >= 6 && demandas.length === 0) {
    demandas.push({
      area: 'Fatores Biológicos',
      score: scores.F,
      severidade: 'Moderada',
      descricao: 'Fatores biológicos e comorbidades impactando a recuperação',
      prioridade: 6,
      motivo: `Score F = ${scores.F.toFixed(1)}. Fatores biológicos como comorbidades, sedentarismo e hábitos de vida modulam a resposta ao tratamento.`,
      acaoRecomendada: 'Endereçar fatores biológicos modificáveis',
      cor: '#059669',
      corBg: '#ecfdf5',
    });
  }

  return demandas.sort((a, b) => a.prioridade - b.prioridade);
}

// ── Gerar protocolo baseado em demandas ──────────────────────────────────────
export function gerarProtocoloAutomatico(
  scores: { E: number; P: number; C: number; F: number; D: number; R: number; EFI: number; idFinal: number; classificacao: string },
  demandas: DemandaMelhoria[]
): ProtocoloAnalise {
  const demandasCriticas = demandas.filter(d => d.severidade === 'Crítica');
  const demandasAltas = demandas.filter(d => d.severidade === 'Alta');

  // Selecionar exercícios para cada fase
  function getExercicios(areas: string[], quantidade: number): ExercicioSugerido[] {
    const todos: ExercicioSugerido[] = [];
    areas.forEach(area => {
      const exs = EXERCICIOS_POR_DEMANDA[area] || [];
      todos.push(...exs);
    });
    return todos.slice(0, quantidade);
  }

  function getTecnicas(areas: string[]): TecnicaSugerida[] {
    const todas: TecnicaSugerida[] = [];
    areas.forEach(area => {
      const techs = TECNICAS_POR_DEMANDA[area] || [];
      todas.push(...techs.slice(0, 1));
    });
    return todas.slice(0, 3);
  }

  const temRegulacao = demandas.some(d => d.area === 'Regulação');
  const temPsico = demandas.some(d => d.area === 'Psico-comportamental');
  const areasCriticas = demandasCriticas.map(d => d.area);
  const areasAltas = demandasAltas.map(d => d.area);

  const fases: FaseProtocolo[] = [
    {
      numero: 1,
      titulo: temRegulacao ? 'Restauração de Regulação Neurovegetativa' : 'Modulação e Estabilização',
      semanas: '1-3',
      semanas_inicio: 1,
      semanas_fim: 3,
      objetivo: temRegulacao
        ? 'Restaurar equilíbrio neurovegetativo como base para intervenções subsequentes'
        : 'Estabilizar o sistema nervoso e reduzir sensibilização central',
      demandasAlvo: temRegulacao ? ['Regulação'] : areasCriticas.length > 0 ? [areasCriticas[0]] : ['Dor Percebida'],
      exercicios: getExercicios(temRegulacao ? ['Regulação'] : areasCriticas, 3),
      tecnicas: getTecnicas(temRegulacao ? ['Regulação'] : areasCriticas),
      frequenciaSemanal: 3,
      duracaoSessao: '20-30 minutos',
      cor: '#6366f1',
      corBg: '#eef2ff',
      corBorda: '#a5b4fc',
    },
    {
      numero: 2,
      titulo: temPsico ? 'Dessensibilização e Retomada do Movimento' : 'Ativação e Mobilidade Progressiva',
      semanas: '4-6',
      semanas_inicio: 4,
      semanas_fim: 6,
      objetivo: temPsico
        ? 'Reduzir kinesiofobia e reconquistar confiança no movimento com segurança'
        : 'Restaurar amplitude de movimento e iniciar ativação muscular progressiva',
      demandasAlvo: temPsico ? ['Psico-comportamental', 'Dor Percebida'] : ['Estrutural', 'Funcionalidade'],
      exercicios: getExercicios(temPsico ? ['Psico-comportamental', 'Dor Percebida'] : ['Estrutural', 'Funcionalidade'], 4),
      tecnicas: getTecnicas(temPsico ? ['Psico-comportamental'] : ['Estrutural']),
      frequenciaSemanal: 3,
      duracaoSessao: '30-45 minutos',
      cor: '#f59e0b',
      corBg: '#fffbeb',
      corBorda: '#fcd34d',
    },
    {
      numero: 3,
      titulo: 'Fortalecimento Progressivo e Restauração Funcional',
      semanas: '7-9',
      semanas_inicio: 7,
      semanas_fim: 9,
      objetivo: 'Aumentar força, resistência e funcionalidade em atividades cotidianas e laborais',
      demandasAlvo: ['Estrutural', 'Funcionalidade', 'Carga Contextual'].filter(a => demandas.some(d => d.area === a)),
      exercicios: getExercicios(['Estrutural', 'Funcionalidade'], 5),
      tecnicas: getTecnicas(['Funcionalidade', 'Carga Contextual']),
      frequenciaSemanal: 3,
      duracaoSessao: '40-50 minutos',
      cor: '#10b981',
      corBg: '#ecfdf5',
      corBorda: '#6ee7b7',
    },
    {
      numero: 4,
      titulo: 'Consolidação, Independência e Prevenção de Recaídas',
      semanas: '10-12',
      semanas_inicio: 10,
      semanas_fim: 12,
      objetivo: 'Consolidar ganhos, desenvolver autonomia e estabelecer plano de manutenção de longo prazo',
      demandasAlvo: demandas.map(d => d.area),
      exercicios: getExercicios([...areasAltas, 'Funcionalidade'], 5),
      tecnicas: [
        { nome: 'Plano de Manutenção Individual', descricao: 'Programa de exercícios autônomo para manutenção dos ganhos', duracao: '30 min', frequencia: '2x por semana (domiciliar)', motivo: 'Autogestão é o objetivo final do tratamento' },
        { nome: 'Educação para Prevenção de Recaídas', descricao: 'Estratégias de identificação precoce de sinal de alarme e plano de ação', duracao: '30 min', frequencia: '1 sessão', motivo: 'Prevenção de recaída reduz cronificação a longo prazo' },
      ],
      frequenciaSemanal: 2,
      duracaoSessao: '45-60 minutos',
      cor: '#ef4444',
      corBg: '#fef2f2',
      corBorda: '#fca5a5',
    },
  ];

  // Prognose
  let prognose = 'Bom – potencial de recuperação funcional em 6-10 semanas com aderência ao tratamento.';
  if (demandasCriticas.length >= 2 || scores.idFinal >= 35) {
    prognose = 'Reservado – múltiplos fatores comprometedores. Aderência essencial e avaliação contínua necessária.';
  } else if (demandas.length >= 3) {
    prognose = 'Moderado – melhora esperada em 8-12 semanas com aderência consistente ao protocolo.';
  }

  return {
    demandasIdentificadas: demandas,
    fases,
    prognose,
    objetivoGeral: `Restaurar funcionalidade e reduzir dor (ID ${scores.idFinal.toFixed(1)} → meta <20) através de intervenção terapêutica multidimensional em 12 semanas`,
    duracaoTotal: '12 semanas',
    frequencia: scores.R <= 2 || scores.idFinal >= 35 ? '2x por semana (início conservador)' : '2-3x por semana',
  };
}
