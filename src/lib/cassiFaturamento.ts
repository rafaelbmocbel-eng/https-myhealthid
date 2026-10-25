// Faturamento do Controle CASSI: o profissional lança, em cada cliente do mês, os códigos usados e a quantidade
// de cada um; o valor do mês sai disso (quantidade × valor do código). Os códigos, valores e limites vêm da tabela da
// CASSI que o Rafael passou (25/10/2026); o 185 entrou na segunda lista, sem limite informado (vale o da guia: 10).

export interface CodigoFaturavel {
  codigo: string; // curto, como já é usado no resto do controle (012, 144...)
  descricao: string;
  valor: number;
  codigo_oficial?: string; // 50000012 → 5.00.00.012
}

interface PadraoDoCodigo extends CodigoFaturavel {
  maxPorGuia?: number;
  maxPorMes?: number;
}

// Códigos que já nascem no controle. Quem já configurou o código em Configurações mantém o próprio valor;
// o que faltar entra com estes dados (ver mesclarCodigosComPadrao).
export const CODIGOS_PADRAO_FATURAMENTO: PadraoDoCodigo[] = [
  { codigo: '012', descricao: 'Sessão de psicomotricidade individual', valor: 57.7, codigo_oficial: '50000012', maxPorGuia: 10 },
  { codigo: '020', descricao: 'Sessão de psicomotricidade em grupo', valor: 57.7, codigo_oficial: '50000020', maxPorGuia: 10 },
  { codigo: '144', descricao: 'Consulta ambulatorial em fisioterapia', valor: 65.62, codigo_oficial: '50000144', maxPorGuia: 1 },
  { codigo: '301', descricao: 'Infiltração de ponto gatilho (por músculo) ou agulhamento seco (por músculo)', valor: 35.55, codigo_oficial: '20103301', maxPorGuia: 10 },
  { codigo: '131', descricao: 'Biofeedback com EMG', valor: 67.79, codigo_oficial: '20103131', maxPorMes: 10 },
  { codigo: '185', descricao: 'Estimulação elétrica transcutânea', valor: 108.44, codigo_oficial: '31602185', maxPorGuia: 10 },
];

// O código que vem marcado primeiro ao lançar um cliente.
export const CODIGO_PADRAO = '012';
// Código que não está na tabela acima (ex.: um que o profissional criou em Configurações): a guia da CASSI tem 10.
export const MAXIMO_POR_GUIA_SEM_REGRA = 10;
// Teto de guias lançadas para um mesmo cliente no mês (também vale no banco).
export const MAXIMO_GUIAS_NO_MES = 6;
// A consulta (144) não é sessão: fica fora da contagem de sessões.
export const CODIGO_CONSULTA = '144';

export interface LimiteDoCodigo {
  porGuia: number | null;
  porMes: number | null;
}

export function limiteDoCodigo(codigo: string): LimiteDoCodigo {
  const p = CODIGOS_PADRAO_FATURAMENTO.find((x) => x.codigo === codigo);
  if (!p) return { porGuia: MAXIMO_POR_GUIA_SEM_REGRA, porMes: null };
  return { porGuia: p.maxPorGuia ?? null, porMes: p.maxPorMes ?? null };
}

// Códigos de Configurações + os padrões que faltam. O valor que o profissional configurou nunca é trocado.
export function mesclarCodigosComPadrao(configurados: CodigoFaturavel[] | null | undefined): CodigoFaturavel[] {
  const base = (configurados || []).map((c) => ({ ...c }));
  for (const p of CODIGOS_PADRAO_FATURAMENTO) {
    const i = base.findIndex((c) => c.codigo === p.codigo);
    if (i < 0) {
      base.push({ codigo: p.codigo, descricao: p.descricao, valor: p.valor, codigo_oficial: p.codigo_oficial });
      continue;
    }
    if (!base[i].descricao?.trim()) base[i].descricao = p.descricao;
    if (!base[i].codigo_oficial?.trim()) base[i].codigo_oficial = p.codigo_oficial;
  }
  return base;
}

// Ordem de exibição ao lançar: o padrão primeiro, depois os da tabela, depois o que o profissional criou.
export function ordenarParaLancamento(codigos: CodigoFaturavel[]): CodigoFaturavel[] {
  const ordem = [CODIGO_PADRAO, ...CODIGOS_PADRAO_FATURAMENTO.map((p) => p.codigo)];
  const pos = (c: string) => { const i = ordem.indexOf(c); return i < 0 ? ordem.length : i; };
  return codigos.map((c, i) => ({ c, i })).sort((a, b) => pos(a.c.codigo) - pos(b.c.codigo) || a.i - b.i).map((x) => x.c);
}

// 50000012 → 5.00.00.012 (como o profissional lê); sem os 8 dígitos, mostra o que houver.
export function formatarCodigoOficial(oficial: string | undefined, curto: string): string {
  const d = (oficial || '').replace(/\D/g, '');
  if (d.length === 8) return `${d[0]}.${d.slice(1, 3)}.${d.slice(3, 5)}.${d.slice(5)}`;
  return oficial?.trim() || curto;
}

// Uma guia lançada: quantidade usada de cada código.
export type GuiaLancada = Record<string, number>;

const inteiro = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(999, Math.max(0, Math.floor(n)));
};

const guiaVazia = (g: GuiaLancada) => !Object.values(g).some((q) => q > 0);

// Lê o que veio do banco (ou de um rascunho) com defesa: só objetos {código: inteiro 1..999}; guia vazia some.
export function normalizarLancamentos(valor: unknown): GuiaLancada[] {
  if (!Array.isArray(valor)) return [];
  const guias: GuiaLancada[] = [];
  for (const g of valor) {
    if (!g || typeof g !== 'object' || Array.isArray(g)) continue;
    const limpa: GuiaLancada = {};
    for (const [codigo, q] of Object.entries(g as Record<string, unknown>)) {
      const n = inteiro(q);
      if (codigo.trim() && n > 0) limpa[codigo.trim()] = n;
    }
    if (!guiaVazia(limpa)) guias.push(limpa);
  }
  return guias.slice(0, MAXIMO_GUIAS_NO_MES);
}

export function totalPorCodigo(guias: GuiaLancada[]): Record<string, number> {
  const t: Record<string, number> = {};
  for (const g of guias) for (const [c, q] of Object.entries(g)) if (q > 0) t[c] = (t[c] || 0) + q;
  return t;
}

export interface ProblemaDoLancamento {
  tipo: 'guia' | 'mes';
  guia?: number; // posição (0 = primeira) quando tipo = 'guia'
  codigo: string;
  informado: number;
  limite: number;
}

// Quantidades acima do que a CASSI aceita (por guia, ou no mês somando as guias do cliente).
export function problemasDosLancamentos(guias: GuiaLancada[]): ProblemaDoLancamento[] {
  const problemas: ProblemaDoLancamento[] = [];
  guias.forEach((g, i) => {
    for (const [codigo, q] of Object.entries(g)) {
      const { porGuia } = limiteDoCodigo(codigo);
      if (porGuia != null && q > porGuia) problemas.push({ tipo: 'guia', guia: i, codigo, informado: q, limite: porGuia });
    }
  });
  const totais = totalPorCodigo(guias);
  for (const [codigo, q] of Object.entries(totais)) {
    const { porMes } = limiteDoCodigo(codigo);
    if (porMes != null && q > porMes) problemas.push({ tipo: 'mes', codigo, informado: q, limite: porMes });
  }
  return problemas;
}

// Quanto ainda cabe de um código numa guia, dado o que já está nas outras (respeita o limite do mês).
export function maximoNaGuia(guias: GuiaLancada[], posicao: number, codigo: string): number {
  const { porGuia, porMes } = limiteDoCodigo(codigo);
  let max = porGuia ?? 999;
  if (porMes != null) {
    const nasOutras = guias.reduce((s, g, i) => (i === posicao ? s : s + (g[codigo] || 0)), 0);
    max = Math.min(max, Math.max(0, porMes - nasOutras));
  }
  return max;
}

// Valor em reais, somando em centavos para não carregar ruído de ponto flutuante (57,7 × 10 = 577,00).
export function brutoDosLancamentos(guias: GuiaLancada[], valorDe: (codigo: string) => number): number {
  let centavos = 0;
  for (const [codigo, q] of Object.entries(totalPorCodigo(guias))) centavos += Math.round(valorDe(codigo) * 100) * q;
  return centavos / 100;
}

export function sessoesDosLancamentos(guias: GuiaLancada[]): number {
  return Object.entries(totalPorCodigo(guias)).reduce((s, [c, q]) => (c === CODIGO_CONSULTA ? s : s + q), 0);
}

// "012 × 10 · 301 × 2" (com "· 2 guias" quando há mais de uma).
export function resumoDosLancamentos(guias: GuiaLancada[]): string {
  const totais = totalPorCodigo(guias);
  const ordem = ordenarParaLancamento(Object.keys(totais).map((codigo) => ({ codigo, descricao: '', valor: 0 })));
  const partes = ordem.map((c) => `${c.codigo} × ${totais[c.codigo]}`);
  if (guias.length > 1) partes.push(`${guias.length} guias`);
  return partes.join(' · ');
}

// Sessões da agenda viram guias de até 10 sessões do código padrão (14 sessões → 10 + 4).
export function guiasPelaAgenda(sessoes: number, codigo: string = CODIGO_PADRAO): GuiaLancada[] {
  const n = Math.floor(sessoes);
  if (!(n > 0)) return [];
  const por = limiteDoCodigo(codigo).porGuia ?? MAXIMO_POR_GUIA_SEM_REGRA;
  return Array.from({ length: Math.min(MAXIMO_GUIAS_NO_MES, Math.ceil(n / por)) }, (_, i) => ({ [codigo]: Math.min(por, n - por * i) }));
}
