export type Modalidade = 'laser' | 'ultrassom' | 'ondas_choque' | 'tens' | 'nmes' | 'russa' | 'interferencial';

/** Modalidades que têm aparelho cadastrável (potência, ERA, área focal…). */
export type ModalidadeAparelho = 'laser' | 'ultrassom' | 'ondas_choque';

export type GrupoModalidade = 'luz_ondas' | 'correntes';

export interface InfoModalidade {
  id: Modalidade;
  nome: string;
  curto: string;
  grupo: GrupoModalidade;
  /** Uma linha para o cartão de escolha. */
  resumo: string;
}

export const MODALIDADES: InfoModalidade[] = [
  { id: 'laser', nome: 'Laser (fotobiomodulação)', curto: 'Laser', grupo: 'luz_ondas', resumo: 'Energia por ponto e densidade de energia' },
  { id: 'ultrassom', nome: 'Ultrassom terapêutico', curto: 'Ultrassom', grupo: 'luz_ondas', resumo: 'Intensidade, tempo e aquecimento' },
  { id: 'ondas_choque', nome: 'Ondas de choque (ESWT)', curto: 'Ondas de choque', grupo: 'luz_ondas', resumo: 'EFD, impulsos e sessões' },
  { id: 'tens', nome: 'TENS', curto: 'TENS', grupo: 'correntes', resumo: 'Frequência, pulso e intensidade' },
  { id: 'nmes', nome: 'FES / NMES', curto: 'FES / NMES', grupo: 'correntes', resumo: 'Contração: on/off, rampa e torque' },
  { id: 'russa', nome: 'Corrente russa', curto: 'Russa', grupo: 'correntes', resumo: 'Portadora kHz em bursts' },
  { id: 'interferencial', nome: 'Corrente interferencial', curto: 'Interferencial', grupo: 'correntes', resumo: 'Portadoras e batimento' },
];

export const MODALIDADES_APARELHO = MODALIDADES.filter((m) => m.grupo === 'luz_ondas') as (InfoModalidade & { id: ModalidadeAparelho })[];
export const GRUPOS: { id: GrupoModalidade; titulo: string }[] = [
  { id: 'luz_ondas', titulo: 'Luz e ondas' },
  { id: 'correntes', titulo: 'Correntes elétricas' },
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
  tipo: ModalidadeAparelho;
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
