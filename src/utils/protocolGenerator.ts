// Protocol generation engine — Core Axis Pro v9.0
// Analyzes evaluation scores → generates 4-phase therapeutic protocol

export interface Scores {
  E: number; // Estrutural
  P: number; // Psico-comportamental (Kinesiofobia)
  C: number; // Carga Contextual
  F: number; // Fatores Biológicos (Anamnese)
  D: number; // Dor Percebida
  R: number; // Regulação Neurovegetativa
  EFI: number; // Funcionalidade
  idFinal: number;
  classificacao: string;
}

export interface FaseTerapeutica {
  fase: number;
  titulo: string;
  semanas: string;
  semanas_inicio: number;
  semanas_fim: number;
  objetivos: string[];
  categorias_exercicios: string[];
  sessoes_por_semana: number;
  cor: string;
  descricao: string;
}

export interface HierarquiaItem {
  prioridade: number;
  foco: string;
  duracao: string;
  intervencoes: string[];
  motivo: string;
  urgencia: boolean;
}

export interface ProtocoloGerado {
  titulo: string;
  objetivo_geral: string;
  perfil_dominante: string[];
  duracao_total: string;
  frequencia: string;
  hierarquia: HierarquiaItem[];
  fases: FaseTerapeutica[];
  prognose: string;
}

export function identificarPerfilDominante(scores: Scores): string[] {
  const perfil: string[] = [];
  if (scores.R <= 4) perfil.push('REGULACAO_CRITICA');
  if (scores.P >= 7) perfil.push('PSICO_COMPORTAMENTAL');
  if (scores.E >= 7) perfil.push('ESTRUTURAL');
  if (scores.D >= 7) perfil.push('DOR_PERCEBIDA');
  if (scores.C >= 7) perfil.push('CARGA_CONTEXTUAL');
  if (scores.F >= 7) perfil.push('FATORES_BIOLOGICOS');
  if (scores.EFI <= 4) perfil.push('FUNCIONALIDADE_COMPROMETIDA');
  return perfil;
}

function definirFrequencia(scores: Scores): string {
  if (scores.R <= 2 || scores.idFinal >= 35) return '2x por semana (início conservador)';
  if (scores.EFI >= 6) return '3x por semana';
  return '2-3x por semana';
}

function definirPrognose(scores: Scores, perfil: string[]): string {
  if (perfil.length >= 5 || scores.idFinal >= 35) return 'Reservado – múltiplos fatores comprometedores. Aderência essencial.';
  if (perfil.length >= 3) return 'Moderado – melhora esperada em 8-12 semanas com aderência consistente.';
  return 'Bom – potencial de recuperação funcional em 6-10 semanas.';
}

export function gerarProtocolo(scores: Scores, pacienteNome: string): ProtocoloGerado {
  const perfil = identificarPerfilDominante(scores);

  // ── Hierarquia terapêutica (prioridade dinâmica) ──────────────────────────
  const hierarquia: HierarquiaItem[] = [];

  if (perfil.includes('REGULACAO_CRITICA')) {
    hierarquia.push({
      prioridade: hierarquia.length + 1,
      foco: 'Restaurar Regulação Neurovegetativa',
      duracao: 'Semanas 1-3',
      intervencoes: ['Higiene do sono', 'Respiração diafragmática', 'Relaxamento muscular progressivo', 'Educação em neurociência da dor'],
      motivo: `R = ${scores.R.toFixed(1)} (crítico ≤ 4) — base fisiológica para todas outras intervenções`,
      urgencia: true,
    });
  }

  if (perfil.includes('PSICO_COMPORTAMENTAL')) {
    hierarquia.push({
      prioridade: hierarquia.length + 1,
      foco: 'Reduzir Cinesiofobia e Comportamentos Evitadores',
      duracao: 'Semanas 2-5',
      intervencoes: ['Psicoeducação em dor', 'Graded Exposure (exposição gradual)', 'Dessensibilização ao movimento', 'Reestruturação cognitiva'],
      motivo: `P = ${scores.P.toFixed(1)} (kinesiofobia severa ≥ 7)`,
      urgencia: scores.P >= 8,
    });
  }

  if (perfil.includes('ESTRUTURAL') || perfil.includes('FUNCIONALIDADE_COMPROMETIDA')) {
    hierarquia.push({
      prioridade: hierarquia.length + 1,
      foco: 'Restaurar Funcionalidade Estrutural',
      duracao: 'Semanas 4-9',
      intervencoes: ['Mobilidade articular progressiva', 'Fortalecimento estabilizador', 'Propriocepção e equilíbrio', 'Terapia manual'],
      motivo: `E = ${scores.E.toFixed(1)}, EFI = ${scores.EFI.toFixed(1)} — comprometimento estrutural e funcional`,
      urgencia: false,
    });
  }

  if (perfil.includes('CARGA_CONTEXTUAL') || perfil.includes('FATORES_BIOLOGICOS')) {
    hierarquia.push({
      prioridade: hierarquia.length + 1,
      foco: 'Gestão de Fatores Contextuais e Biológicos',
      duracao: 'Semanas 3-8',
      intervencoes: ['Orientação nutricional', 'Gestão do stress', 'Suporte psicossocial', 'Ajuste de atividades laborais'],
      motivo: `C = ${scores.C.toFixed(1)}, F = ${scores.F.toFixed(1)} — sobrecarga contextual e biológica`,
      urgencia: scores.C >= 8,
    });
  }

  // Fase final sempre presente
  hierarquia.push({
    prioridade: hierarquia.length + 1,
    foco: 'Consolidação de Ganhos e Prevenção de Recaídas',
    duracao: 'Semanas 9-12',
    intervencoes: ['Exercícios avançados funcionais', 'Retorno progressivo às atividades', 'Plano de manutenção', 'Estratégias de autogestão'],
    motivo: 'Consolidação de ganhos e prevenção de recaídas a longo prazo',
    urgencia: false,
  });

  // ── 4 Fases do protocolo ─────────────────────────────────────────────────
  const usaRegulacao = perfil.includes('REGULACAO_CRITICA');
  const usaPsico = perfil.includes('PSICO_COMPORTAMENTAL');

  const fases: FaseTerapeutica[] = [
    {
      fase: 1,
      titulo: usaRegulacao ? 'Restauração de Regulação Neurovegetativa' : 'Modulação da Dor e Sensibilização',
      semanas: '1-3',
      semanas_inicio: 1,
      semanas_fim: 3,
      objetivos: usaRegulacao
        ? ['Melhorar qualidade do sono', 'Reduzir ansiedade e hipervigilância', 'Educação em neurociência da dor', 'Estabelecer rotina de relaxamento']
        : ['Reduzir sensibilização central', 'Educação em dor', 'Movimento seguro e controlado', 'Estabilização do sistema nervoso'],
      categorias_exercicios: ['Respiração', 'Relaxamento', 'Mobilidade'],
      sessoes_por_semana: 2,
      cor: '#6366f1',
      descricao: usaRegulacao
        ? 'Foco em restaurar o equilíbrio neurovegetativo como base para as próximas fases. Exercícios de baixa intensidade e alto impacto regulatório.'
        : 'Introdução ao movimento seguro com foco em reduzir o sistema de alarme da dor.',
    },
    {
      fase: 2,
      titulo: usaPsico ? 'Dessensibilização e Retomada do Movimento' : 'Mobilidade e Ativação Progressiva',
      semanas: '4-6',
      semanas_inicio: 4,
      semanas_fim: 6,
      objetivos: usaPsico
        ? ['Aumentar confiança no movimento', 'Reduzir comportamentos de evitação', 'Ampliar repertório motor seguro', 'Dessensibilização gradual']
        : ['Restaurar amplitude de movimento', 'Ativar cadeia muscular estabilizadora', 'Melhorar coordenação motora', 'Aumentar tolerância à atividade'],
      categorias_exercicios: ['Mobilidade', 'Propriocepção', 'Fortalecimento'],
      sessoes_por_semana: 2,
      cor: '#f59e0b',
      descricao: 'Progressão cuidadosa do movimento com atenção ao limiar de dor e medo do movimento.',
    },
    {
      fase: 3,
      titulo: 'Fortalecimento Progressivo e Funcionalidade',
      semanas: '7-9',
      semanas_inicio: 7,
      semanas_fim: 9,
      objetivos: [
        'Aumentar força e resistência muscular',
        'Melhorar propriocepção e equilíbrio',
        'Restaurar padrões de movimento funcional',
        'Aumentar tolerância às atividades de vida diária',
      ],
      categorias_exercicios: ['Fortalecimento', 'Propriocepção', 'Funcional'],
      sessoes_por_semana: 3,
      cor: '#10b981',
      descricao: 'Fase central de fortalecimento com progressão baseada na resposta do paciente. Exercícios com maior demanda funcional.',
    },
    {
      fase: 4,
      titulo: 'Consolidação, Prevenção e Independência',
      semanas: '10-12',
      semanas_inicio: 10,
      semanas_fim: 12,
      objetivos: [
        'Consolidar ganhos de funcionalidade',
        'Desenvolver autonomia e autogestão',
        'Retorno progressivo às atividades desejadas',
        'Estabelecer plano de manutenção de longo prazo',
      ],
      categorias_exercicios: ['Funcional', 'Fortalecimento', 'Propriocepção'],
      sessoes_por_semana: 2,
      cor: '#ef4444',
      descricao: 'Fase de alta com foco em independência, prevenção de recaídas e estratégias de autogestão.',
    },
  ];

  return {
    titulo: `Protocolo Personalizado – ${pacienteNome}`,
    objetivo_geral: `Restaurar funcionalidade e reduzir dor (ID ${scores.idFinal.toFixed(1)} → meta <20) através de intervenção terapêutica multidimensional em 12 semanas`,
    perfil_dominante: perfil,
    duracao_total: '12 semanas',
    frequencia: definirFrequencia(scores),
    hierarquia,
    fases,
    prognose: definirPrognose(scores, perfil),
  };
}

// ── Biblioteca de exercícios (seed data) ───────────────────────────────────
export const EXERCICIOS_SEED = [
  // RESPIRAÇÃO
  { nome: 'Respiração Diafragmática', categoria: 'Respiração', regiao_corporal: ['Geral'], nivel_dificuldade: 'Iniciante', tipo: 'Sem equipamento', descricao: 'Técnica de respiração abdominal para ativação do sistema parassimpático e redução da ansiedade.', instrucoes: ['Deite-se de costas com joelhos flexionados', 'Coloque uma mão no peito e outra no abdômen', 'Inspire pelo nariz por 4 tempos, expandindo o abdômen', 'Expire lentamente pela boca por 6 tempos', 'Repita 10 vezes'], tempo_duracao: '5-10 minutos', precaucoes: ['Não forçar a respiração', 'Parar se sentir tontura'], perfis_indicados: ['REGULACAO_CRITICA', 'PSICO_COMPORTAMENTAL'], series: 1, repeticoes: 10 },
  { nome: 'Respiração 4-7-8', categoria: 'Respiração', regiao_corporal: ['Geral'], nivel_dificuldade: 'Iniciante', tipo: 'Sem equipamento', descricao: 'Técnica respiratória de relaxamento profundo: inspire 4s, retenha 7s, expire 8s.', instrucoes: ['Sente-se ou deite-se confortavelmente', 'Expire completamente pela boca', 'Feche a boca e inspire pelo nariz por 4 segundos', 'Retenha a respiração por 7 segundos', 'Expire completamente pela boca por 8 segundos'], tempo_duracao: '5 minutos', precaucoes: ['Iniciantes: máximo 4 ciclos', 'Interrompa se sentir tontura'], perfis_indicados: ['REGULACAO_CRITICA', 'PSICO_COMPORTAMENTAL'], series: 1, repeticoes: 4 },

  // RELAXAMENTO
  { nome: 'Relaxamento Muscular Progressivo (Jacobson)', categoria: 'Relaxamento', regiao_corporal: ['Geral'], nivel_dificuldade: 'Iniciante', tipo: 'Sem equipamento', descricao: 'Técnica de contração e relaxamento progressivo de grupos musculares para reduzir tensão crônica.', instrucoes: ['Deite-se em posição confortável', 'Contraia o pé direito por 5 segundos', 'Relaxe completamente por 30 segundos', 'Siga subindo: panturrilha, coxa, glúteo, abdômen, mãos, braços, ombros, rosto', 'Total de 15-20 grupos musculares'], tempo_duracao: '20-30 minutos', precaucoes: ['Não contrair áreas dolorosas com força', 'Ambiente silencioso'], perfis_indicados: ['REGULACAO_CRITICA', 'DOR_PERCEBIDA'], series: 1, repeticoes: 1 },
  { nome: 'Body Scan (Escaneamento Corporal)', categoria: 'Relaxamento', regiao_corporal: ['Geral'], nivel_dificuldade: 'Iniciante', tipo: 'Sem equipamento', descricao: 'Técnica mindfulness de atenção plena ao corpo para redução de tensão e melhora do sono.', instrucoes: ['Deite-se confortavelmente', 'Feche os olhos e respire profundamente', 'Leve sua atenção para os pés, observe as sensações sem julgamento', 'Suba progressivamente: tornozelos, pernas, joelhos, coxas, quadril, abdômen, peito, ombros, braços, pescoço, cabeça'], tempo_duracao: '15-20 minutos', precaucoes: ['Pode ser feito com áudio guiado', 'Não adormecer se for sessão formal'], perfis_indicados: ['REGULACAO_CRITICA', 'PSICO_COMPORTAMENTAL', 'DOR_PERCEBIDA'], series: 1, repeticoes: 1 },

  // MOBILIDADE
  { nome: 'Mobilidade Cervical Suave', categoria: 'Mobilidade', regiao_corporal: ['Cabeça/Pescoço'], nivel_dificuldade: 'Iniciante', tipo: 'Sem equipamento', descricao: 'Movimentos suaves e controlados do pescoço para restaurar amplitude e reduzir tensão muscular.', instrucoes: ['Sente-se ereto com ombros relaxados', 'Incline a cabeça para o lado direito, mantendo 5 segundos', 'Retorne ao centro e repita para o esquerdo', 'Rotação: gire suavemente a cabeça para cada lado', 'Flexão/extensão: queixo ao peito e cabeça para trás suavemente'], tempo_duracao: '5-8 minutos', precaucoes: ['Movimentos LENTOS, sem força', 'Parar se sentir tontura ou dor irradiada para o braço'], perfis_indicados: ['ESTRUTURAL', 'DOR_PERCEBIDA'], series: 2, repeticoes: 10 },
  { nome: 'Mobilização Torácica em Espuma', categoria: 'Mobilidade', regiao_corporal: ['Coluna Torácica'], nivel_dificuldade: 'Iniciante', tipo: 'Com rolo de espuma', descricao: 'Mobilização da coluna torácica sobre rolo de espuma para restaurar extensão e reduzir rigidez.', instrucoes: ['Posicione o rolo perpendicular à coluna, na região torácica', 'Apoie a cabeça nas mãos entrelaçadas', 'Inspire profundamente', 'Ao expirar, relaxe sobre o rolo por 30-60 segundos', 'Mova o rolo 2-3cm e repita'], tempo_duracao: '5-10 minutos', precaucoes: ['NÃO usar em região lombar aguda', 'Movimentos muito lentos'], perfis_indicados: ['ESTRUTURAL'], series: 1, repeticoes: 5 },
  { nome: 'Mobilidade de Quadril em 4 Apoios', categoria: 'Mobilidade', regiao_corporal: ['Coluna Lombar', 'Quadril'], nivel_dificuldade: 'Iniciante', tipo: 'Sem equipamento', descricao: 'Movimentos circulares de quadril em posição de 4 apoios para melhorar mobilidade e reduzir dor lombar.', instrucoes: ['Posicione-se em 4 apoios (joelhos e mãos no chão)', 'Mantenha coluna neutra (nem fletida nem estendida)', 'Faça círculos com o quadril, 10x para cada lado', 'Cat-cow: arqueie e arredonde a coluna alternadamente'], tempo_duracao: '5-8 minutos', precaucoes: ['Coluna neutra durante toda a execução', 'Evitar hiperextensão lombar'], perfis_indicados: ['ESTRUTURAL', 'FUNCIONALIDADE_COMPROMETIDA'], series: 2, repeticoes: 10 },
  { nome: 'Alongamento de Cadeia Posterior', categoria: 'Mobilidade', regiao_corporal: ['Coluna Lombar', 'Isquiotibiais'], nivel_dificuldade: 'Iniciante', tipo: 'Sem equipamento', descricao: 'Alongamento progressivo da cadeia posterior para reduzir tensão lombar e restaurar flexibilidade.', instrucoes: ['Deite-se de costas', 'Leve o joelho direito ao peito, segurando com ambas as mãos', 'Mantenha por 30 segundos', 'Alterne as pernas', 'Versão avançada: estenda o joelho para alongar isquiotibiais'], tempo_duracao: '8-10 minutos', precaucoes: ['Não forçar além do ponto de desconforto', 'Respirar durante o alongamento'], perfis_indicados: ['ESTRUTURAL', 'DOR_PERCEBIDA'], series: 2, repeticoes: 30 },

  // FORTALECIMENTO
  { nome: 'Ativação de Core em Decúbito (Dead Bug)', categoria: 'Fortalecimento', regiao_corporal: ['Coluna Lombar', 'Abdômen'], nivel_dificuldade: 'Iniciante', tipo: 'Sem equipamento', descricao: 'Exercício de ativação profunda do core mantendo coluna neutra, ideal para início de fortalecimento lombar.', instrucoes: ['Deite de costas, joelhos a 90° no ar, braços para cima', 'Ative o abdômen (pressione lombar contra o chão)', 'Estenda o braço direito e a perna esquerda simultaneamente', 'Retorne e alterne os lados', 'Mantenha a lombar em contato com o chão durante todo o exercício'], tempo_duracao: '10-15 minutos', precaucoes: ['Lombar SEMPRE em contato com o chão', 'Iniciar com amplitudes pequenas'], perfis_indicados: ['ESTRUTURAL', 'FUNCIONALIDADE_COMPROMETIDA'], series: 3, repeticoes: 8 },
  { nome: 'Ponte de Glúteos', categoria: 'Fortalecimento', regiao_corporal: ['Coluna Lombar', 'Quadril', 'Glúteos'], nivel_dificuldade: 'Iniciante', tipo: 'Sem equipamento', descricao: 'Exercício fundamental de fortalecimento de glúteos e estabilização da coluna lombar.', instrucoes: ['Deite-se de costas com os joelhos flexionados e pés apoiados no chão', 'Ative o abdômen e glúteos', 'Levante o quadril até formar uma linha reta entre joelhos e ombros', 'Mantenha por 2 segundos no topo', 'Abaixe lentamente'], tempo_duracao: '12-15 minutos', precaucoes: ['Não deixar o quadril torcer', 'Não hiperextender a lombar'], perfis_indicados: ['ESTRUTURAL', 'FUNCIONALIDADE_COMPROMETIDA'], series: 3, repeticoes: 12 },
  { nome: 'Prancha Isométrica Modificada', categoria: 'Fortalecimento', regiao_corporal: ['Abdômen', 'Coluna Lombar', 'Ombros'], nivel_dificuldade: 'Iniciante', tipo: 'Sem equipamento', descricao: 'Variação de prancha com apoio nos joelhos para fortalecimento de core com menor demanda de carga.', instrucoes: ['Apoie-se nos antebraços e joelhos', 'Mantenha o corpo em linha reta da cabeça ao joelho', 'Ative o abdômen fortemente', 'Mantenha por 20-30 segundos', 'Progrida para prancha completa conforme tolerância'], tempo_duracao: '10 minutos', precaucoes: ['Não deixar o quadril elevar ou afundar', 'Parar se sentir dor cervical'], perfis_indicados: ['ESTRUTURAL', 'FUNCIONALIDADE_COMPROMETIDA'], series: 3, repeticoes: 1 },
  { nome: 'Agachamento Assistido', categoria: 'Fortalecimento', regiao_corporal: ['Quadril', 'Joelho', 'Coluna Lombar'], nivel_dificuldade: 'Iniciante', tipo: 'Sem equipamento', descricao: 'Agachamento funcional com apoio para fortalecimento de membros inferiores e restauração do padrão motor.', instrucoes: ['Fique de frente para uma cadeira ou mesa (apoio)', 'Pés na largura dos ombros, dedos levemente para fora', 'Segure o apoio e desça lentamente dobrando os joelhos', 'Desça até 60° de flexão (ou conforme tolerância)', 'Suba empurrando o chão com os pés'], tempo_duracao: '10-12 minutos', precaucoes: ['Joelhos alinhados com os pés', 'Não deixar joelhos ultrapassar muito os pés'], perfis_indicados: ['FUNCIONALIDADE_COMPROMETIDA', 'ESTRUTURAL'], series: 3, repeticoes: 10 },
  { nome: 'Fortalecimento de Rotadores Externos (Clamshell)', categoria: 'Fortalecimento', regiao_corporal: ['Quadril', 'Glúteos'], nivel_dificuldade: 'Iniciante', tipo: 'Sem equipamento', descricao: 'Exercício de fortalecimento de glúteo médio e rotadores externos do quadril para estabilização pélvica.', instrucoes: ['Deite de lado com joelhos flexionados a 45°', 'Pés alinhados, quadril empilhado', 'Mantenha os pés juntos e abra o joelho de cima como uma concha', 'Retorne lentamente', 'Não deixar o quadril rotacionar para trás'], tempo_duracao: '10 minutos', precaucoes: ['Movimento no quadril, não na lombar', 'Progressão com band elástica'], perfis_indicados: ['ESTRUTURAL', 'FUNCIONALIDADE_COMPROMETIDA'], series: 3, repeticoes: 15 },

  // PROPRIOCEPÇÃO
  { nome: 'Equilíbrio Unipodal', categoria: 'Propriocepção', regiao_corporal: ['Tornozelo', 'Joelho', 'Quadril'], nivel_dificuldade: 'Iniciante', tipo: 'Sem equipamento', descricao: 'Treinamento de equilíbrio em apoio unipodal para melhorar propriocepção e estabilidade articular.', instrucoes: ['Fique próximo a uma parede para segurança', 'Apoie-se em um pé, joelho levemente flexionado', 'Mantenha o equilíbrio por 20-30 segundos', 'Progrida: olhos fechados, superfície instável', 'Alterne os pés'], tempo_duracao: '10-12 minutos', precaucoes: ['Sempre próximo a apoio', 'Não bloquear o joelho'], perfis_indicados: ['ESTRUTURAL', 'FUNCIONALIDADE_COMPROMETIDA'], series: 3, repeticoes: 30 },
  { nome: 'Propriocepção de Ombro (Pêndulo de Codman)', categoria: 'Propriocepção', regiao_corporal: ['Ombro'], nivel_dificuldade: 'Iniciante', tipo: 'Sem equipamento', descricao: 'Exercício de propriocepção e mobilidade passiva do ombro para reduzir dor e restaurar função.', instrucoes: ['Incline-se para frente apoiando o braço saudável em uma mesa', 'Deixe o braço afetado pendurado livremente', 'Faça movimentos suaves de pêndulo: frente/trás, lados, e circular', 'Deixe o peso do braço criar o movimento (sem forçar)'], tempo_duracao: '5-8 minutos', precaucoes: ['Movimento PASSIVO pelo peso do braço', 'Não elevar o ombro'], perfis_indicados: ['ESTRUTURAL'], series: 2, repeticoes: 30 },

  // FUNCIONAL
  { nome: 'Marcha Controlada com Braços', categoria: 'Funcional', regiao_corporal: ['Geral'], nivel_dificuldade: 'Iniciante', tipo: 'Sem equipamento', descricao: 'Caminhada consciente e controlada para restaurar padrão de marcha e aumentar tolerância à atividade.', instrucoes: ['Caminhe em ritmo lento e controlado', 'Atenção à postura: cabeça erguida, ombros relaxados', 'Balanço natural dos braços em oposição às pernas', 'Passos normais, sem arrastar os pés', 'Iniciar 5-10 minutos e progredir'], tempo_duracao: '10-20 minutos', precaucoes: ['Superfície plana e segura', 'Calçado adequado'], perfis_indicados: ['FUNCIONALIDADE_COMPROMETIDA', 'PSICO_COMPORTAMENTAL'], series: 1, repeticoes: 1 },
  { nome: 'Sentar-Levantar da Cadeira (Sit-to-Stand)', categoria: 'Funcional', regiao_corporal: ['Quadril', 'Joelho', 'Coluna Lombar'], nivel_dificuldade: 'Iniciante', tipo: 'Sem equipamento', descricao: 'Exercício funcional que mimetiza atividade de vida diária e fortalece membros inferiores e core.', instrucoes: ['Sente-se na metade da cadeira', 'Pés na largura dos ombros', 'Incline levemente o tronco para frente', 'Empurre com os pés e levante', 'Desça controladamente'], tempo_duracao: '8-10 minutos', precaucoes: ['Usar cadeira com apoio de braços no início', 'Movimento lento e controlado'], perfis_indicados: ['FUNCIONALIDADE_COMPROMETIDA'], series: 3, repeticoes: 10 },
  { nome: 'Subida e Descida de Degrau', categoria: 'Funcional', regiao_corporal: ['Joelho', 'Quadril', 'Tornozelo'], nivel_dificuldade: 'Intermediário', tipo: 'Sem equipamento', descricao: 'Exercício funcional em degrau para restaurar padrão motor de escadas e fortalecer membros inferiores.', instrucoes: ['Use um degrau baixo (15-20cm) ou caixa estável', 'Suba o pé direito no degrau', 'Empurre o degrau e suba o pé esquerdo', 'Desça com controle', 'Alterne o pé líder'], tempo_duracao: '10 minutos', precaucoes: ['Corrimão disponível para segurança', 'Degrau estável e antiderrapante'], perfis_indicados: ['FUNCIONALIDADE_COMPROMETIDA', 'ESTRUTURAL'], series: 2, repeticoes: 10 },
];
