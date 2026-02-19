// Tipos para COB° ZERO
export type LenkeType = '1' | '2' | '3' | '4' | '5' | '6';
export type LumbarModifier = 'A' | 'B' | 'C';
export type SagittalModifier = '-' | 'N' | '+';
export type RisserStage = 0 | 1 | 2 | 3 | 4 | 5;

export interface UnidadeCobZero {
  id: string;
  nome: string;
  score: number;
  checklist: Record<string, boolean>;
  observacoes: string;
}

export interface EtapaBasica {
  queixaPrincipal: string;
  duracaoMeses: number;
  aindaCrescendo: boolean;
  tannerStage: number;
  metasTerapeuticas: string[];
  atividadeFisica: string;
  historicEscoliose: boolean;
}

export interface EtapaAntropometrica {
  altura: number;
  peso: number;
  circumferenceCintura: number;
  testeAdam: number;
  atr: number;
  romCervical: number;
  romToracica: number;
  romLombar: number;
  fotosUrls: string[];
}

export interface EtapaLenke {
  cobbAngle: number;
  lenkeType: LenkeType;
  lumbarModifier: LumbarModifier;
  sagittalModifier: SagittalModifier;
  risserStage: RisserStage;
  verticalRotation: number;
  radiographDate: string;
  aguardandoRadiografia: boolean;
}

export interface EtapaRisco {
  riskPercentage: number;
  riskLevel: 'BAIXO' | 'MODERADO' | 'ALTO';
  risserAdjustment: number;
}

export interface EtapaSRS {
  funcaoAtividade: number[];
  aparencia: number[];
  dor: number[];
  saudeMental: number[];
  satisfacaoTratamento: number[];
  scoreSRS22r: number;
}

export interface RedFlags {
  dorNoturna: boolean;
  progressaoRapida: boolean;
  deficitNeurologico: boolean;
  sintomasSistemicos: boolean;
  coletePrevio: boolean;
  cirurgiaPrevia: boolean;
  terapiaAnterior: boolean;
}

export interface AvaliacaoCobZero {
  id?: string;
  pacienteNome: string;
  pacienteIdade: number;
  pacienteSexo: 'M' | 'F';
  terapeutaNome: string;
  dataAvaliacao: string;
  etapaBasica: EtapaBasica;
  etapaAntropometrica: EtapaAntropometrica;
  etapaLenke: EtapaLenke;
  etapaRisco: EtapaRisco;
  unidades: UnidadeCobZero[];
  scoreE: number;
  etapaSRS: EtapaSRS;
  redFlags: RedFlags;
  diagnosticoIA: string;
  metodoRecomendado: string;
  prognostico: string;
  faseAtual: 0 | 1 | 2 | 3 | 4;
  etapaAtual: number;
  concluido: boolean;
}

export interface ExercicioCatalogo {
  codigo: string;
  nome: string;
  metodo: 'Schroth' | 'SEAS' | 'Lyon' | 'Pilates' | 'Funcional';
  fase: 0 | 1 | 2 | 3;
  intensidade: 1 | 2 | 3 | 4 | 5;
  lenkeAplicavel: LenkeType[];
  videoUrl?: string;
  instrucoes: string[];
  dicas: string[];
  errosComuns: string[];
  progressoes: string[];
  regressoes: string[];
  tags: string[];
  duracaoMinutos: number;
}
