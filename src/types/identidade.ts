// Tipos para Método Identidade
export interface RegiaoDor {
  id: string;
  nome: string;
  intensidade: number;
  tipos: string[];
  irradiacao: boolean;
  irradiacaoPara: string[];
  frequencia: string;
  fatoresPiora: string[];
  fatoresMelhora: string[];
}

export interface Bloco1Data {
  queixaPrincipal: string;
  duracao: string;
  eventoPrecipitante: boolean;
  eventoPrecipitanteDescricao: string;
  historicoMedico: string[];
  historicoFamiliar: boolean;
  historicoFamiliarDescricao: string;
  metasTerapeuticas: string[];
  profissao: string;
  horasSedentario: number;
  atividadeFisica: string;
  qualidadeSono: number;
  tabagismo: boolean;
  alcool: string;
  litrosAgua: number;
  impactoQualidadeVida: number;
  interferenciaTrbalho: number;
  quantidadeComorbidades: number;
  historicoFamiliarPeso: number;
  scoreF: number;
}

export interface Bloco2Data {
  regioes: RegiaoDor[];
  scoreD: number;
}

export interface Bloco3Data {
  trabalho: number;
  domesticas: number;
  exercicio: number;
  independencia: number;
  vidaSocial: number;
  scoreEFI: number;
}

export interface Bloco4Data {
  respostas: number[];
  scoreP: number;
}

export interface Bloco5Data {
  // Sono R1
  qualidadeSono: number;
  horasSono: number;
  acordaNaNoite: number;
  dorAfetaSono: number;
  descansadoAoAcordar: number;
  scoreR1: number;
  // Energia R2
  energiaAoAcordar: number;
  fadigaDia: number;
  precisaCochiblar: number;
  motivacao: number;
  resistenciaFisica: number;
  scoreR2: number;
  // Psicológico R3
  nivelStress: number;
  humorGeral: number;
  concentracao: number;
  preocupacaoSaude: number;
  sensacaoControle: number;
  scoreR3: number;
  // Carga C
  cargaLaboral: number;
  relacionamentos: number;
  situacaoFinanceira: number;
  eventosEstressantes: number;
  scoreC: number;
  scoreR: number;
}

export interface UnidadeCorporal {
  id: string;
  nome: string;
  score: number;
  checklist: Record<string, boolean>;
  observacoes: string;
}

export interface Bloco6Data {
  unidades: UnidadeCorporal[];
  scoreE: number;
}

export interface AvaliacaoIdentidade {
  id?: string;
  pacienteNome: string;
  pacienteIdade: number;
  terapeutaNome: string;
  dataAvaliacao: string;
  bloco1: Bloco1Data;
  bloco2: Bloco2Data;
  bloco3: Bloco3Data;
  bloco4: Bloco4Data;
  bloco5: Bloco5Data;
  bloco6: Bloco6Data;
  idFinal: number;
  classificacao: string;
  blocoAtual: number;
  concluido: boolean;
}

export type ClassificacaoID = 'LEVE' | 'MODERADO' | 'SEVERO' | 'CRÍTICO' | 'EXTREMO';
