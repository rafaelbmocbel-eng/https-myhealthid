export type Modalidade = 'laser' | 'ultrassom' | 'ondas_choque';

export const MODALIDADES: { id: Modalidade; nome: string; curto: string }[] = [
  { id: 'laser', nome: 'Laser (fotobiomodulação)', curto: 'Laser' },
  { id: 'ultrassom', nome: 'Ultrassom terapêutico', curto: 'Ultrassom' },
  { id: 'ondas_choque', nome: 'Ondas de choque (ESWT)', curto: 'Ondas de choque' },
];

// Especificações guardadas em equipamentos_fisio.specs, por modalidade.
export interface SpecsLaser {
  comprimento_onda_nm?: number;
  modo?: 'continuo' | 'pulsado';
  potencia_media_mw?: number;
  /** Potência medida com power meter; quando existe, a calculadora usa esta. */
  potencia_medida_mw?: number;
  potencia_pico_mw?: number;
  area_feixe_cm2?: number;
}
export interface SpecsUltrassom {
  frequencia_mhz?: 1 | 3;
  era_cm2?: number;
  bnr?: number;
  potencia_max_w?: number;
  ciclos_pulsado_pct?: number[];
}
export interface SpecsOndasChoque {
  tipo?: 'focal' | 'radial';
  area_focal_mm2?: number;
  frequencia_max_hz?: number;
  pressao_max_bar?: number;
  efd_max_mj_mm2?: number;
}

export interface EquipamentoFisio {
  id: string;
  tipo: Modalidade;
  nome: string;
  fabricante: string | null;
  modelo: string | null;
  specs: SpecsLaser & SpecsUltrassom & SpecsOndasChoque;
  ultima_calibracao: string | null;
  observacoes: string | null;
  ativo: boolean;
}

/** O que a calculadora entrega para o registro no prontuário. */
export interface DoseRegistrada {
  modalidade: Modalidade;
  condicao: string;
  titulo: string;
  linhas: string[];
  parametros: Record<string, unknown>;
  equipamento?: string;
  referencias: string[];
}
