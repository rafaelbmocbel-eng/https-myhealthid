// Contrato compartilhado da sessão de avaliação postural em foto: quatro posições.
// Só tipos, rótulos e conversões puras. A sessão (sessao.ts), as medidas (medidas.ts), a tela e o PDF
// importam daqui, para ninguém depender do arquivo de outro.

export type LadoPerfil = 'D' | 'E';

/** Vista do banco e das medidas (já existente). O perfil só existe com lado na sessão nova. */
export type VistaBase = 'frente' | 'perfil' | 'costas';

/** As quatro posições de uma sessão. A ordem é a ordem sugerida de fotografar. */
export type VistaSessao = 'frente' | 'perfil_d' | 'perfil_e' | 'costas';

export const VISTAS_DA_SESSAO: readonly VistaSessao[] = ['frente', 'perfil_d', 'perfil_e', 'costas'];

export const ROTULO_VISTA_SESSAO: Record<VistaSessao, string> = {
  frente: 'Frente',
  perfil_d: 'Perfil direito',
  perfil_e: 'Perfil esquerdo',
  costas: 'Costas',
};

/** Lado do paciente voltado para a câmera em cada perfil: no perfil direito vê-se o lado direito do paciente. */
export function vistaBaseDaSessao(v: VistaSessao): { vista: VistaBase; lado?: LadoPerfil } {
  if (v === 'perfil_d') return { vista: 'perfil', lado: 'D' };
  if (v === 'perfil_e') return { vista: 'perfil', lado: 'E' };
  return { vista: v };
}

/** Inverso de vistaBaseDaSessao. Perfil sem lado (nota antiga) não tem posição na sessão: devolve null. */
export function vistaDaSessao(vista: VistaBase, lado?: LadoPerfil | null): VistaSessao | null {
  if (vista === 'frente' || vista === 'costas') return vista;
  if (lado === 'D') return 'perfil_d';
  if (lado === 'E') return 'perfil_e';
  return null;
}

/** Dados do bloco `dados_extras.sessao` gravado em cada nota da sessão (esquema 2, só campos novos). */
export interface SessaoGravada {
  /** uuid da sessão; também vai para `referencia_id` da nota. */
  id: string;
  /** Posição desta nota na ordem prevista (1, 2, 3...). */
  ordem: number;
  /** Posições previstas ao iniciar a sessão (guia: o profissional pode pular). */
  previstas: VistaSessao[];
  /** ISO de quando a sessão começou. */
  iniciadaEm: string;
}

export const ESQUEMA_ANALISE_FOTO = 2;

// ---------------------------------------------------------------------------
// Direito x esquerdo dentro da mesma avaliação (aritmética; não classifica).
// ---------------------------------------------------------------------------

export interface MedidaDaSessao {
  id: string;
  graus: number;
  unidade?: 'cm' | '%';
}

export interface ParDireitoEsquerdo<M extends MedidaDaSessao = MedidaDaSessao> {
  /** Id sem o sufixo de lado: "cotovelo" para "cotovelo-d" e "cotovelo-e". */
  base: string;
  direito: M | null;
  esquerdo: M | null;
  /** direito − esquerdo, em graus (ou na unidade da medida) com uma casa; null se faltar um lado ou se as unidades diferirem. */
  diferenca: number | null;
}

/**
 * Agrupa as medidas cujo id termina em "-d" ou "-e" em pares D/E, na ordem em que o primeiro lado de cada par aparece.
 * A diferença é só aritmética (D − E) e não diz qual lado está melhor ou pior.
 */
export function paresDireitoEsquerdo<M extends MedidaDaSessao>(medidas: readonly M[]): ParDireitoEsquerdo<M>[] {
  const pares = new Map<string, ParDireitoEsquerdo<M>>();
  for (const m of medidas) {
    const achou = /^(.+)-(d|e)$/.exec(m.id);
    if (!achou) continue;
    const base = achou[1];
    const par = pares.get(base) ?? { base, direito: null, esquerdo: null, diferenca: null };
    if (achou[2] === 'd') par.direito = m;
    else par.esquerdo = m;
    pares.set(base, par);
  }
  for (const par of pares.values()) {
    const { direito, esquerdo } = par;
    if (direito && esquerdo && direito.unidade === esquerdo.unidade) {
      par.diferenca = Math.round((direito.graus - esquerdo.graus) * 10) / 10;
    }
  }
  return [...pares.values()];
}
