// Condições SISTÊMICAS (afetam o corpo todo) → o SISTEMA corporal correspondente.
// Usado para não fincar essas condições numa região do avatar: elas viram
// achado com regiao_id='sistemico' e acendem o sistema. Mesma lógica da migração
// 20260719190000 (mantidas em sincronia).
export type SistemaCorporal =
  | 'musculoesqueletico' | 'nervoso' | 'cardiovascular' | 'respiratorio'
  | 'digestorio' | 'endocrino' | 'urinario' | 'reprodutor' | 'tegumentar'
  | 'linfatico' | 'sensorial';

const REGRAS: [RegExp, SistemaCorporal][] = [
  [/ansiedad|depress|ins[oô]nia|enxaqueca|fibromialgia|p[aâ]nico|estresse|transtorno/i, 'nervoso'],
  [/hipertens|press[aã]o alta|dislipidemia|colesterol|arritmia|cardiopat|insufici[eê]ncia card/i, 'cardiovascular'],
  [/diabet|hipotireoid|hipertireoid|tireoid|obesidad|s[ií]ndrome metab/i, 'endocrino'],
  [/asma|dpoc|bronquit|enfisema/i, 'respiratorio'],
  [/refluxo|gastrit|[uú]lcera|c[oó]lon irrit|intestin/i, 'digestorio'],
  [/renal|\brim\b|nefro|urin[aá]ri/i, 'urinario'],
  [/reumat|l[uú]pus|osteoporos|artrite reumat/i, 'musculoesqueletico'],
  [/anemia|leucem|linfom/i, 'linfatico'],
];

// Retorna o sistema se o nome for uma condição sistêmica conhecida; senão null.
export function sistemaDaCondicaoSistemica(nome?: string | null): SistemaCorporal | null {
  const n = (nome || '').toLowerCase();
  for (const [re, sis] of REGRAS) if (re.test(n)) return sis;
  return null;
}

export function ehCondicaoSistemica(nome?: string | null): boolean {
  return sistemaDaCondicaoSistemica(nome) !== null;
}
