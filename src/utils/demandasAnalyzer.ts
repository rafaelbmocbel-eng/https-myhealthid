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
    { nome: 'Respiração Diafragmática', categoria: 'Respiração', series: 1, repeticoes: 10, duracao: '10 min', motivo: 'Ativa o sistema parassimpático, reduz hiperativação neurovegetativa', descricao: 'Respiração abdominal profunda para restaurar equilíbrio do SNA.', instrucoes: ['Deite-se com joelhos flexionados', 'Mão no abdômen', 'Inspire 4s expandindo abdômen', 'Expire 6s lentamente'] },
    { nome: 'Respiração 4-7-8', categoria: 'Respiração', series: 1, repeticoes: 4, duracao: '5 min', motivo: 'Técnica de relaxamento profundo com ativação vagal intensa', descricao: 'Inspire 4s, retenha 7s, expire 8s para ativação parassimpática profunda.', instrucoes: ['Expire completamente', 'Inspire pelo nariz 4s', 'Retenha 7s', 'Expire boca 8s'] },
    { nome: 'Relaxamento Muscular Progressivo (Jacobson)', categoria: 'Relaxamento', series: 1, repeticoes: 1, duracao: '20 min', motivo: 'Reduz tensão muscular crônica associada à desregulação neurovegetativa', descricao: 'Contração e relaxamento progressivo de grupos musculares.', instrucoes: ['Deite-se confortavelmente', 'Contraia cada grupo muscular por 5s', 'Relaxe 30s', 'Progrida dos pés à cabeça'] },
    { nome: 'Body Scan (Escaneamento Corporal)', categoria: 'Relaxamento', series: 1, repeticoes: 1, duracao: '15 min', motivo: 'Mindfulness corporal melhora consciência interoceptiva e sono', descricao: 'Atenção plena ao corpo para redução de tensão e hipervigilância.', instrucoes: ['Ambiente silencioso', 'Olhos fechados', 'Atenção da cabeça aos pés sem julgamento', 'Respiração natural'] },
    { nome: 'Coerência Cardíaca (5-5)', categoria: 'Respiração', series: 1, repeticoes: 12, duracao: '5 min', motivo: 'Sincroniza ritmo cardíaco e respiratório melhorando variabilidade da FC', descricao: 'Respiração rítmica 5s inspira / 5s expira para coerência cardíaca.', instrucoes: ['Sente-se confortavelmente', 'Inspire 5s pelo nariz', 'Expire 5s pela boca', '12 ciclos = 2 minutos'] },
    { nome: 'Exercícios de Grounding (Ancoragem)', categoria: 'Relaxamento', series: 1, repeticoes: 1, duracao: '5 min', motivo: 'Ancoragem no presente reduz hipervigilância e dissociação', descricao: 'Técnica 5-4-3-2-1 de ancoragem sensorial.', instrucoes: ['Nomeie 5 coisas que vê', '4 que toca', '3 que ouve', '2 que cheira', '1 que saboreia'] },
    { nome: 'Yoga Restaurativo (Posições Suaves)', categoria: 'Relaxamento', series: 1, repeticoes: 5, duracao: '20 min', motivo: 'Posturas restaurativas promovem ativação parassimpática profunda', descricao: 'Posições suaves mantidas com suporte para restauração neurovegetativa.', instrucoes: ['Use almofadas e blocos', 'Mantenha cada posição 3-5 min', 'Sem esforço muscular', 'Respiração livre'] },
  ],
  Estrutural: [
    { nome: 'Mobilidade Articular Global', categoria: 'Mobilidade', series: 2, repeticoes: 10, duracao: '10 min', motivo: 'Restaura amplitude articular comprometida', descricao: 'Movimentos suaves em todas as direções para recuperar mobilidade funcional.', instrucoes: ['Movimentos lentos e controlados', 'Respeite limiar de dor', 'Cubra todas articulações', 'Sem força'] },
    { nome: 'Ativação de Core (Dead Bug)', categoria: 'Fortalecimento', series: 3, repeticoes: 8, duracao: '12 min', motivo: 'Estabilização espinhal essencial para comprometimento estrutural', descricao: 'Ativação profunda do core mantendo coluna neutra.', instrucoes: ['Deite de costas', 'Joelhos 90° no ar', 'Alterne braço/perna opostos', 'Lombar sempre no chão'] },
    { nome: 'Ponte de Glúteos', categoria: 'Fortalecimento', series: 3, repeticoes: 12, duracao: '10 min', motivo: 'Fortalece cadeia posterior para estabilização estrutural', descricao: 'Fortalecimento de glúteos e estabilização lombar.', instrucoes: ['De costas, pés apoiados', 'Eleve quadril lentamente', 'Mantenha 2s no topo', 'Desça controlado'] },
    { nome: 'Liberação Miofascial com Rolo', categoria: 'Mobilidade', series: 1, repeticoes: '60s por região', duracao: '15 min', motivo: 'Reduz aderências miofasciais e melhora circulação local', descricao: 'Auto-liberação de tensão miofascial para restaurar qualidade tecidual.', instrucoes: ['Posicione rolo na área tensa', 'Pressão moderada', 'Mantenha 60s em pontos de tensão', 'Respire profundamente'] },
    { nome: 'Isométricos Segmentares', categoria: 'Estabilização', series: 3, repeticoes: '10x 10s', duracao: '10 min', motivo: 'Ativação muscular sem carga articular para manter controle motor', descricao: 'Contrações isométricas das unidades comprometidas.', instrucoes: ['Contraia o músculo-alvo por 10s', 'Relaxe 5s', 'Sem movimento articular', 'Intensidade submáxima 50-70%'] },
    { nome: 'Ativação de Core/Multífido', categoria: 'Controle Motor', series: 3, repeticoes: '10x 8s', duracao: '10 min', motivo: 'Estabilização segmentar profunda — evidência nível A para lombalgia', descricao: 'Ativação do multífido e transverso em posição neutra.', instrucoes: ['4 apoios ou decúbito', 'Ative transverso abdominal', 'Mantenha respiração normal', 'Sem compensação lombar'] },
    { nome: 'Mobilidade Neural (Sliders)', categoria: 'Neurodinâmica', series: 2, repeticoes: 15, duracao: '8 min', motivo: 'Restauração da mobilidade neural sem tensionamento agressivo', descricao: 'Deslizamento neural para nervos comprometidos.', instrucoes: ['Movimentos suaves e rítmicos', 'Sem reproduzir dor', 'Flexione um extremo enquanto estende outro', 'Sem manter sustentado'] },
    { nome: 'Alongamento de Cadeia Posterior', categoria: 'Mobilidade', series: 2, repeticoes: '30s hold', duracao: '10 min', motivo: 'Reduz tensão lombar e restaura flexibilidade', descricao: 'Alongamento progressivo de isquiotibiais e paravertebrais.', instrucoes: ['Deite de costas', 'Leve joelho ao peito', 'Mantenha 30s', 'Alterne lados'] },
    { nome: 'Prancha Isométrica Modificada', categoria: 'Fortalecimento', series: 3, repeticoes: '20-30s', duracao: '10 min', motivo: 'Fortalecimento de core com menor demanda de carga', descricao: 'Prancha nos joelhos para estabilizadores centrais.', instrucoes: ['Apoie nos antebraços e joelhos', 'Corpo em linha reta', 'Ative abdômen', 'Progrida para prancha completa'] },
    { nome: 'Mobilização Torácica em Espuma', categoria: 'Mobilidade', series: 1, repeticoes: 5, duracao: '8 min', motivo: 'Restaura extensão torácica e reduz rigidez segmentar', descricao: 'Mobilização da coluna torácica sobre rolo de espuma.', instrucoes: ['Rolo perpendicular à coluna torácica', 'Mãos na nuca', 'Relaxe sobre rolo ao expirar', 'Mova 2-3cm e repita'] },
    { nome: 'Fortalecimento de Rotadores Externos (Clamshell)', categoria: 'Fortalecimento', series: 3, repeticoes: 15, duracao: '10 min', motivo: 'Estabilização pélvica via glúteo médio', descricao: 'Exercício de abertura em concha para rotadores externos do quadril.', instrucoes: ['Deite de lado, joelhos flexionados 45°', 'Pés juntos', 'Abra joelho superior', 'Não rotacione o quadril'] },
    { nome: 'Mobilidade de Quadril em 4 Apoios', categoria: 'Mobilidade', series: 2, repeticoes: 10, duracao: '8 min', motivo: 'Melhora mobilidade do quadril e reduz dor lombar', descricao: 'Círculos de quadril e cat-cow em 4 apoios.', instrucoes: ['Posição de 4 apoios', 'Coluna neutra', 'Círculos com quadril 10x cada lado', 'Cat-cow: arqueie e arredonde'] },
    { nome: 'Flexibilidade Ativa de Cadeias', categoria: 'Mobilidade', series: 3, repeticoes: '30s hold', duracao: '12 min', motivo: 'Restauração do comprimento muscular funcional', descricao: 'Alongamento ativo das cadeias encurtadas identificadas na avaliação.', instrucoes: ['Identifique cadeias encurtadas', 'Contração-relaxamento', 'Mantenha 30s', 'Progrida amplitude'] },
  ],
  'Psico-comportamental': [
    { nome: 'Movimento Gradual Consciente', categoria: 'Funcional', series: 2, repeticoes: 10, duracao: '15 min', motivo: 'Dessensibilização gradual ao movimento para reduzir cinesiofobia', descricao: 'Exposição progressiva ao movimento em ambiente seguro.', instrucoes: ['Amplitudes mínimas', 'Observe sensações sem catastrofizar', 'Progrida conforme tolerância', 'Celebre cada progresso'] },
    { nome: 'Caminhada Controlada com Atenção Plena', categoria: 'Funcional', series: 1, repeticoes: '10-15 min', duracao: '15 min', motivo: 'Reestrutura medo ao movimento com evidência de segurança', descricao: 'Caminhada consciente para reconectar com o corpo.', instrucoes: ['Ritmo confortável', 'Atenção aos pés no chão', 'Respiração natural', 'Sem julgamento'] },
    { nome: 'Exercícios de Grounding (Ancoragem)', categoria: 'Relaxamento', series: 1, repeticoes: 1, duracao: '5 min', motivo: 'Ancoragem no presente reduz hipervigilância e medo antecipatório', descricao: 'Técnica 5-4-3-2-1 para ansiedade antecipatória.', instrucoes: ['Nomeie 5 coisas que vê', '4 que toca', '3 que ouve', '2 que cheira', '1 que saboreia'] },
    { nome: 'Exposição Gradual a Atividades Temidas', categoria: 'Funcional', series: 1, repeticoes: 5, duracao: '20 min', motivo: 'Hierarquia de medo com exposição progressiva — evidência nível A', descricao: 'Realização gradual de atividades na hierarquia de medo.', instrucoes: ['Liste atividades temidas de 0-10', 'Comece pela nota mais baixa', 'Execute com suporte', 'Registre experiência real vs esperada'] },
    { nome: 'Diário de Dor e Atividade', categoria: 'Educação', series: 1, repeticoes: 1, duracao: '5 min', motivo: 'Auto-monitoramento reduz catastrofização e aumenta autoeficácia', descricao: 'Registro diário de dor, atividades e humor.', instrucoes: ['Registre dor 3x/dia', 'Anote atividades realizadas', 'Note humor e pensamentos', 'Revise com o terapeuta'] },
    { nome: 'Treino de Relaxamento Pré-Movimento', categoria: 'Relaxamento', series: 1, repeticoes: 1, duracao: '5 min', motivo: 'Reduz tensão antecipatória antes do exercício terapêutico', descricao: 'Relaxamento breve antes de iniciar exercícios.', instrucoes: ['3 respirações profundas', 'Escaneamento corporal rápido', 'Solte ombros e mandíbula', 'Comece exercício suavemente'] },
  ],
  'Dor Percebida': [
    { nome: 'Movimento de Baixa Intensidade', categoria: 'Funcional', series: 2, repeticoes: 10, duracao: '15 min', motivo: 'Libera endorfinas naturais e melhora limiar de dor', descricao: 'Exercícios suaves para modular dor via analgesia natural.', instrucoes: ['Intensidade máxima 3/10', 'Parar se dor > 4/10', 'Focar na qualidade'] },
    { nome: 'Respiração para Modulação de Dor', categoria: 'Respiração', series: 1, repeticoes: '5 min', duracao: '5 min', motivo: 'Ativa sistema descendente de inibição da dor', descricao: 'Técnica respiratória para vias naturais de controle da dor.', instrucoes: ['Inspire 4s', 'Segure 4s', 'Expire 6s', 'Foque na expiração longa'] },
    { nome: 'Movimentos Agradáveis e Prazerosos', categoria: 'Funcional', series: 1, repeticoes: '10-20 min', duracao: '20 min', motivo: 'Associação de movimento com prazer quebra ciclo dor-evitação', descricao: 'Atividades físicas prazerosas para memórias positivas.', instrucoes: ['Escolha atividade agradável', 'Dança suave, natação', 'Foco no prazer', 'Sem performance'] },
    { nome: 'Hidroterapia / Exercícios Aquáticos', categoria: 'Funcional', series: 2, repeticoes: 10, duracao: '30 min', motivo: 'Flutuabilidade reduz carga articular e permite movimento com menos dor', descricao: 'Exercícios em piscina aquecida.', instrucoes: ['Água 32-34°C', 'Caminhada na piscina', 'Movimentos amplos', 'Sem impacto'] },
    { nome: 'Alongamento Suave e Sustentado', categoria: 'Mobilidade', series: 2, repeticoes: '30s hold', duracao: '10 min', motivo: 'Alongamento de baixa intensidade modula dor', descricao: 'Alongamentos sustentados abaixo do limiar de dor.', instrucoes: ['Abaixo da dor', 'Respire durante', '30s por posição', 'Sem bouncing'] },
    { nome: 'Exercícios de Consciência Corporal', categoria: 'Educação', series: 1, repeticoes: 1, duracao: '10 min', motivo: 'Melhora percepção proprioceptiva e reduz hipervigilância à dor', descricao: 'Exercícios de percepção corporal para recalibrar experiência sensorial.', instrucoes: ['Olhos fechados', 'Perceba cada segmento', 'Diferencie dor de tensão', 'Sem julgamento'] },
  ],
  Funcionalidade: [
    { nome: 'Sentar-Levantar da Cadeira (Sit-to-Stand)', categoria: 'Funcional', series: 3, repeticoes: 10, duracao: '10 min', motivo: 'Atividade de vida diária fundamental', descricao: 'Sentar e levantar para independência funcional.', instrucoes: ['Cadeira com braços', 'Pés na largura dos ombros', 'Incline tronco', 'Movimento controlado'] },
    { nome: 'Agachamento Assistido', categoria: 'Fortalecimento', series: 3, repeticoes: 10, duracao: '12 min', motivo: 'Padrão funcional fundamental para MMII', descricao: 'Agachamento com apoio para padrão motor funcional.', instrucoes: ['Segure apoio firme', 'Pés afastados', 'Desça até 60°', 'Suba empurrando o chão'] },
    { nome: 'Treino de Equilíbrio Unipodal', categoria: 'Propriocepção', series: 3, repeticoes: '30s', duracao: '10 min', motivo: 'Propriocepção é central na restauração funcional', descricao: 'Equilíbrio em apoio único para controle postural.', instrucoes: ['Próximo a parede', 'Apoio em um pé', 'Joelho flexionado', 'Progrida: olhos fechados'] },
    { nome: 'Marcha Funcional Controlada', categoria: 'Funcional', series: 1, repeticoes: '10 min', duracao: '10 min', motivo: 'Padrão de marcha é principal limitador funcional', descricao: 'Caminhada com atenção à qualidade da marcha.', instrucoes: ['Ritmo lento', 'Postura ereta', 'Balanço natural dos braços', 'Passos conscientes'] },
    { nome: 'Subida e Descida de Degrau', categoria: 'Funcional', series: 2, repeticoes: 10, duracao: '10 min', motivo: 'Restauração do padrão motor de escadas', descricao: 'Subir e descer degrau com controle.', instrucoes: ['Degrau baixo 15-20cm', 'Alterne pé líder', 'Controle na descida', 'Corrimão disponível'] },
    { nome: 'Estabilização Dinâmica', categoria: 'Fortalecimento', series: 3, repeticoes: 12, duracao: '12 min', motivo: 'Transição da estabilização estática para dinâmica', descricao: 'Exercícios de estabilização com perturbação controlada.', instrucoes: ['Base estável', 'Perturbações leves', 'Mantenha alinhamento', 'Progrida complexidade'] },
    { nome: 'Fortalecimento Excêntrico', categoria: 'Fortalecimento', series: 3, repeticoes: 10, duracao: '12 min', motivo: 'Remodelamento tecidual e resistência mecânica', descricao: 'Contrações excêntricas dos grupos comprometidos.', instrucoes: ['Fase excêntrica lenta 4-6s', 'Fase concêntrica normal', 'Carga progressiva', 'Sem dor > 3/10'] },
    { nome: 'Propriocepção em Superfícies Instáveis', categoria: 'Sensório-motor', series: 3, repeticoes: '30-60s', duracao: '10 min', motivo: 'Reconexão sensório-motora pós-lesão', descricao: 'Treinamento em bosu, almofada ou disco.', instrucoes: ['Apoio unipodal na superfície instável', 'Mantenha equilíbrio', 'Progrida dificuldade', 'Sempre com segurança'] },
    { nome: 'Cadeia Cinética Integrada', categoria: 'Funcional', series: 2, repeticoes: 10, duracao: '12 min', motivo: 'Integração inter-unitária das conexões corporais', descricao: 'Exercícios em padrão funcional integrando múltiplas unidades.', instrucoes: ['Movimentos multiplanares', 'Integre MMSS e MMII', 'Simule gestos do cotidiano', 'Carga leve a moderada'] },
    { nome: 'Exercícios Funcionais Sport-Specific', categoria: 'Funcional', series: 3, repeticoes: '10-15', duracao: '15 min', motivo: 'Transferência funcional para atividades diárias e esportivas', descricao: 'Treinamento funcional adaptado ao paciente.', instrucoes: ['Simule gestos específicos', 'Carga progressiva', 'Velocidade gradual', 'Ambiente controlado'] },
    { nome: 'HEP (Home Exercise Program)', categoria: 'Auto-gerenciamento', series: 2, repeticoes: 10, duracao: '20 min', motivo: 'Autonomia e manutenção dos ganhos pós-alta', descricao: 'Programa domiciliar com 4-6 exercícios-chave.', instrucoes: ['Selecione exercícios dominados', 'Instrua com vídeo/fotos', 'Defina frequência semanal', 'Reavalie periodicamente'] },
    { nome: 'Treino de Consciência Corporal', categoria: 'Educação', series: 1, repeticoes: 1, duracao: '5 min', motivo: 'Prevenção de recidivas por melhora proprioceptiva', descricao: 'Percepção corporal e automonitoramento.', instrucoes: ['Olhos fechados', 'Escaneie cada segmento', 'Identifique tensões', 'Pratique diariamente'] },
  ],
  'Carga Contextual': [
    { nome: 'Exercícios de Gestão de Estresse', categoria: 'Relaxamento', series: 1, repeticoes: '10 min', duracao: '10 min', motivo: 'Carga contextual mantém sistema em alerta', descricao: 'Técnicas de relaxamento para reduzir carga alostática.', instrucoes: ['Ambiente tranquilo', 'Respiração + relaxamento muscular', 'Prática diária 10 min'] },
    { nome: 'Orientação Postural no Trabalho', categoria: 'Funcional', series: 1, repeticoes: '5 min', duracao: '5 min', motivo: 'Contexto laboral é fator de manutenção', descricao: 'Exercícios de ergonomia adaptados ao trabalho.', instrucoes: ['Avalie posto de trabalho', 'Pausas a cada 45-60 min', 'Micropausas de alongamento', 'Ajuste cadeira e monitor'] },
    { nome: 'Micropausas Ativas no Trabalho', categoria: 'Funcional', series: 1, repeticoes: '3 min', duracao: '3 min a cada hora', motivo: 'Interrupção do ciclo de sobrecarga postural laboral', descricao: 'Exercícios breves de mobilidade a cada hora.', instrucoes: ['A cada hora, levante-se', 'Alongue pescoço e ombros', 'Rotação de tronco', 'Caminhe brevemente'] },
    { nome: 'Técnicas de Mindfulness para Estresse Laboral', categoria: 'Relaxamento', series: 1, repeticoes: 1, duracao: '10 min', motivo: 'Mindfulness reduz cortisol e melhora regulação emocional', descricao: 'Práticas de atenção plena no trabalho.', instrucoes: ['Feche os olhos 1 min', 'Foque na respiração', 'Body scan rápido', 'Retome com presença'] },
  ],
  'Fatores Biológicos': [
    { nome: 'Exercício Aeróbico de Baixa Intensidade', categoria: 'Funcional', series: 1, repeticoes: '15-20 min', duracao: '20 min', motivo: 'Melhora perfil cardiovascular e reduz inflamação', descricao: 'Caminhada ou bicicleta estacionária em intensidade leve.', instrucoes: ['FC alvo: 50-60% da máxima', 'Progrida gradualmente', 'Monitore sintomas', 'Hidratação adequada'] },
    { nome: 'Exercícios de Flexibilidade Geral', categoria: 'Mobilidade', series: 2, repeticoes: '20s hold', duracao: '15 min', motivo: 'Manutenção de amplitude articular com comorbidades', descricao: 'Rotina de alongamentos globais.', instrucoes: ['Todos os grupos principais', 'Mantenha 20s', 'Sem dor', 'Respiração contínua'] },
    { nome: 'Fortalecimento Funcional Leve', categoria: 'Fortalecimento', series: 2, repeticoes: 12, duracao: '15 min', motivo: 'Manutenção de massa muscular com fatores biológicos', descricao: 'Fortalecimento com carga leve e alta repetição.', instrucoes: ['Peso corporal ou elásticos leves', 'Grandes grupos musculares', 'Sem fadiga excessiva', 'Progressão gradual'] },
  ],
};

// ── Técnicas por demanda ───────────────────────────────────────────────────────
const TECNICAS_POR_DEMANDA: Record<string, TecnicaSugerida[]> = {
  Regulação: [
    { nome: 'Educação em Neurociência do Sono', descricao: 'Orientação sobre higiene do sono, ritmo circadiano e impacto na regulação neurovegetativa.', duracao: '30 min', frequencia: 'Sessão 1', motivo: 'R baixo frequentemente associado a distúrbios do sono' },
    { nome: 'Treinamento de Respiração Guiada', descricao: 'Protocolo estruturado de técnicas respiratórias para ativação parassimpática.', duracao: '15 min/dia', frequencia: '2x por semana', motivo: 'Respiração é recurso mais direto para modular SNA' },
    { nome: 'Liberação Diafragmática', descricao: 'Técnicas de liberação do diafragma e pilares diafragmáticos para restaurar função respiratória.', duracao: '5-8 min', frequencia: '1-2x por semana', motivo: 'Diafragma é elo entre regulação e estrutura' },
    { nome: 'Terapia Visceral', descricao: 'Mobilização visceral para restauração de mobilidade fascial visceral e regulação.', duracao: '10 min', frequencia: '1x por semana', motivo: 'Restrições viscerais contribuem para desregulação' },
  ],
  Estrutural: [
    { nome: 'Liberação Miofascial', descricao: 'Liberação de aderências e trigger points nos tecidos restritos. Evidência A.', duracao: '10-15 min', frequencia: '1-2x por semana', motivo: 'Comprometimento tecidual requer liberação manual' },
    { nome: 'Mobilização Articular Grau I-II', descricao: 'Mobilização oscilatória dentro da amplitude livre para modulação de dor. Evidência A.', duracao: '5-10 min', frequencia: '2x por semana', motivo: 'Restauração da artrocinemática comprometida' },
    { nome: 'Mobilização Articular Grau III-IV', descricao: 'Mobilização oscilatória até o end-feel para restaurar amplitude. Evidência A.', duracao: '5-10 min', frequencia: '1-2x por semana', motivo: 'Restauração de amplitude em hipomobilidades' },
    { nome: 'Dry Needling', descricao: 'Agulhamento seco em trigger points ativos para desativação neural. Evidência B.', duracao: '5-10 min', frequencia: '1x por semana', motivo: 'Desativação de pontos gatilho miofasciais persistentes' },
    { nome: 'Manipulação HVLA', descricao: 'Thrust de alta velocidade e baixa amplitude em segmentos hipomóveis. Evidência A.', duracao: '2-3 min', frequencia: 'Conforme necessidade', motivo: 'Restauração de mobilidade segmentar' },
    { nome: 'Técnica de Energia Muscular (MET)', descricao: 'Contração isométrica contra resistência para restauração articular. Evidência B.', duracao: '5-8 min', frequencia: '2x por semana', motivo: 'Restauração de comprimento muscular e mobilidade' },
    { nome: 'Neurodinâmica (Tensioners)', descricao: 'Tensionamento neural progressivo para restauração de mobilidade neural. Evidência B.', duracao: '5 min', frequencia: '2x por semana', motivo: 'Restauração de mobilidade neural' },
    { nome: 'Educação em Movimento Seguro', descricao: 'Orientação sobre biomecânica e padrões de movimento seguros.', duracao: '20 min', frequencia: 'Primeiras 2 semanas', motivo: 'Evitar padrões compensatórios' },
    { nome: 'Terapia Visceral', descricao: 'Mobilização visceral para restauração de mobilidade fascial visceral. Evidência C.', duracao: '10 min', frequencia: '1x por semana', motivo: 'Conexões fasciais viscerais impactam estrutura' },
  ],
  'Psico-comportamental': [
    { nome: 'Educação em Neurofisiologia da Dor (PNE)', descricao: 'Modelo biopsicossocial de dor e desmistificação do medo ao movimento.', duracao: '45 min', frequencia: 'Sessões 1-2', motivo: 'Psicoeducação é primeiro passo para reduzir kinesiofobia' },
    { nome: 'Graded Exposure (Exposição Gradual)', descricao: 'Exposição progressiva aos movimentos temidos com hierarquia de medo. Evidência A.', duracao: '30 min', frequencia: '2x por semana', motivo: 'Evidência A para redução de kinesiofobia' },
    { nome: 'Reestruturação Cognitiva', descricao: 'Identificação e modificação de pensamentos catastróficos sobre dor e movimento.', duracao: '20 min', frequencia: '1x por semana', motivo: 'Catastrofização é fator de manutenção' },
    { nome: 'Dessensibilização ao Toque', descricao: 'Exposição gradual ao toque em regiões com alodinia ou hiperalgesia.', duracao: '10 min', frequencia: '2x por semana', motivo: 'Reduz hiperalgesia secundária e medo do toque' },
  ],
  'Dor Percebida': [
    { nome: 'Educação em Neurofisiologia da Dor', descricao: 'Compreensão do mecanismo da dor para reduzir catastrofização.', duracao: '45 min', frequencia: 'Primeiras 2 sessões', motivo: 'Entender a dor é o primeiro passo para modulá-la' },
    { nome: 'TENS (Eletroterapia)', descricao: 'Estimulação elétrica transcutânea para controle álgico via gate control. Evidência B.', duracao: '20-30 min', frequencia: 'Conforme necessidade', motivo: 'Modulação de dor pela teoria das comportas' },
    { nome: 'Crioterapia', descricao: 'Aplicação de frio para vasoconstrição, redução de edema e analgesia. Evidência B.', duracao: '10-15 min', frequencia: 'Conforme necessidade', motivo: 'Analgesia local e controle inflamatório' },
    { nome: 'Termoterapia', descricao: 'Aplicação de calor para vasodilatação, relaxamento muscular e analgesia.', duracao: '15-20 min', frequencia: 'Conforme necessidade', motivo: 'Relaxamento muscular e circulação local' },
    { nome: 'Modulação Sensorial (Calor/Frio Alternado)', descricao: 'Alternância de recursos térmicos para modulação sensorial e analgesia.', duracao: '20 min', frequencia: '1-2x por semana', motivo: 'Contraste térmico modula input nociceptivo' },
    { nome: 'Taping Funcional / Kinesiotaping', descricao: 'Bandagem funcional para feedback proprioceptivo e redução de dor. Evidência C.', duracao: '5 min', frequencia: 'Conforme necessidade', motivo: 'Feedback proprioceptivo e suporte biomecânico' },
  ],
  Funcionalidade: [
    { nome: 'Reabilitação Funcional Progressiva', descricao: 'Protocolo de restauração funcional baseado em tarefas significativas.', duracao: '45 min', frequencia: '2-3x por semana', motivo: 'EFI baixo requer abordagem funcional específica' },
    { nome: 'Adaptação de AVDs', descricao: 'Identificação e adaptação de atividades cotidianas para reduzir sobrecarga.', duracao: '30 min', frequencia: 'Sessão inicial', motivo: 'Manter participação funcional durante reabilitação' },
    { nome: 'Reeducação Postural Global (RPG)', descricao: 'Posturas globais para reequilíbrio das cadeias musculares. Evidência B.', duracao: '15-20 min', frequencia: '1-2x por semana', motivo: 'Reequilíbrio global das cadeias miofasciais' },
    { nome: 'Pilates Clínico', descricao: 'Exercícios de controle motor com foco nas unidades comprometidas. Evidência A.', duracao: '30 min', frequencia: '2x por semana', motivo: 'Controle motor e estabilização em ambiente seguro' },
    { nome: 'Plano de Manutenção Individual', descricao: 'Programa de exercícios autônomo para manutenção dos ganhos.', duracao: '30 min', frequencia: '2x por semana (domiciliar)', motivo: 'Autogestão é objetivo final do tratamento' },
    { nome: 'Educação para Prevenção de Recaídas', descricao: 'Estratégias de identificação precoce de sinais de alarme e plano de ação.', duracao: '30 min', frequencia: '1 sessão', motivo: 'Prevenção de recaída reduz cronificação' },
  ],
  'Carga Contextual': [
    { nome: 'Gestão do Estresse e Mindfulness', descricao: 'Técnicas de redução de estresse baseadas em mindfulness.', duracao: '20 min', frequencia: 'Diário (domiciliar)', motivo: 'Carga contextual elevada perpetua sensibilização central' },
    { nome: 'Orientação Ergonômica e Postural', descricao: 'Avaliação do ambiente de trabalho e orientações para reduzir sobrecarga.', duracao: '45 min', frequencia: '1 sessão + follow-up', motivo: 'Contexto laboral mantém alerta quando não modificado' },
    { nome: 'Treino de Habilidades de Coping', descricao: 'Ensino de estratégias de enfrentamento ativo para lidar com estresse.', duracao: '30 min', frequencia: '2-3 sessões', motivo: 'Coping ativo reduz impacto do estresse na dor' },
  ],
  'Fatores Biológicos': [
    { nome: 'Orientação Nutricional Anti-inflamatória', descricao: 'Orientações sobre alimentação anti-inflamatória e hábitos alimentares.', duracao: '30 min', frequencia: '1-2 sessões', motivo: 'Nutrição modula estado inflamatório sistêmico' },
    { nome: 'Orientação sobre Atividade Física Regular', descricao: 'Prescrição de atividade física aeróbica adaptada às condições do paciente.', duracao: '20 min', frequencia: '1 sessão + follow-up', motivo: 'Sedentarismo agrava fatores biológicos de risco' },
  ],
};
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
