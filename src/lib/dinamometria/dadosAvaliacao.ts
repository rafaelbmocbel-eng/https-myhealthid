export type LadoDin = 'D' | 'E';

// Dados do paciente nesta avaliação, preenchidos logo depois de escolher o cliente (tela de início)
// e lidos pelo teste de força. Ficam na sessão do navegador, por paciente.
export interface DadosAvaliacao {
  /** aaaa-mm-dd */
  data: string;
  idade: string;
  sexo: 'M' | 'F';
  peso: string;
  dominante: LadoDin;
  acometido: LadoDin | 'N';
  modalidade: string;
  sintomas: string;
}

const chave = (pacienteId: string) => `mh.din.avaliacao.${pacienteId}`;

const texto = (v: unknown, max = 2000) => (typeof v === 'string' ? v.slice(0, max) : undefined);

/** Aceita só valores válidos de cada campo; o resto é descartado. */
export function sanitizarDadosAvaliacao(bruto: unknown): Partial<DadosAvaliacao> {
  if (!bruto || typeof bruto !== 'object') return {};
  const o = bruto as Record<string, unknown>;
  const out: Partial<DadosAvaliacao> = {};
  if (typeof o.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.data)) out.data = o.data;
  if (typeof o.idade === 'string' && /^\d{0,3}$/.test(o.idade)) out.idade = o.idade;
  if (o.sexo === 'M' || o.sexo === 'F') out.sexo = o.sexo;
  if (typeof o.peso === 'string' && /^\d{0,3}([.,]\d{0,2})?$/.test(o.peso)) out.peso = o.peso;
  if (o.dominante === 'D' || o.dominante === 'E') out.dominante = o.dominante;
  if (o.acometido === 'D' || o.acometido === 'E' || o.acometido === 'N') out.acometido = o.acometido;
  const m = texto(o.modalidade, 120); if (m !== undefined) out.modalidade = m;
  const s = texto(o.sintomas); if (s !== undefined) out.sintomas = s;
  return out;
}

export function salvarDadosAvaliacao(pacienteId: string, dados: DadosAvaliacao) {
  try { window.sessionStorage.setItem(chave(pacienteId), JSON.stringify(dados)); }
  catch { /* sem armazenamento da sessão (aba anônima): o teste usa o cadastro e a última avaliação */ }
}

export function lerDadosAvaliacao(pacienteId: string): Partial<DadosAvaliacao> | null {
  try {
    const bruto = window.sessionStorage.getItem(chave(pacienteId));
    if (!bruto) return null;
    const d = sanitizarDadosAvaliacao(JSON.parse(bruto));
    return Object.keys(d).length ? d : null;
  } catch {
    // Conteúdo corrompido ou armazenamento bloqueado: ignora.
    return null;
  }
}
