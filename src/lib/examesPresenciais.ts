// Definições dos EXAMES PRESENCIAIS (bioimpedância, teste de pisada, …).
//
// Genérico e extensível: para acrescentar um novo exame, basta adicionar um
// item em EXAMES_PRESENCIAIS — sem migração no banco (a tabela guarda `tipo`
// como texto e `dados` como JSON) e sem mexer no card, que se monta a partir
// daqui. O `resumo` gerado alimenta os motores de IA dos planos.

export type CampoTipo = 'number' | 'text' | 'select' | 'textarea';

export interface CampoExame {
  key: string;
  label: string;
  tipo: CampoTipo;
  unidade?: string;
  opcoes?: string[];        // para tipo 'select'
  placeholder?: string;
  grupo?: string;           // seção para agrupar os campos no formulário
}

export interface TipoExame {
  id: string;               // valor gravado em exames_presenciais.tipo
  nome: string;
  descricao: string;
  campos: CampoExame[];
  destaque?: string[];      // chaves mostradas no resumo curto da lista
  nota?: string;            // aviso mostrado no card (ex.: pedir avaliação presencial)
}

// Bioimpedância no formato dos aparelhos usados na clínica (composição global,
// água, metabolismo e análise segmentar por membro).
const CAMPOS_BIOIMPEDANCIA: CampoExame[] = [
  // Resumo
  { key: 'peso_kg', label: 'Peso', tipo: 'number', unidade: 'kg', grupo: 'Resumo' },
  { key: 'imc', label: 'IMC', tipo: 'number', grupo: 'Resumo' },
  { key: 'gordura_pct', label: '% de gordura', tipo: 'number', unidade: '%', grupo: 'Resumo' },
  { key: 'massa_gorda_kg', label: 'Massa de gordura', tipo: 'number', unidade: 'kg', grupo: 'Resumo' },
  { key: 'massa_livre_gordura_kg', label: 'Massa livre de gordura', tipo: 'number', unidade: 'kg', grupo: 'Resumo' },
  { key: 'massa_muscular_kg', label: 'Massa muscular esquelética', tipo: 'number', unidade: 'kg', grupo: 'Resumo' },
  // Água e nutrientes
  { key: 'agua_corporal_l', label: 'Água corporal', tipo: 'number', unidade: 'L', grupo: 'Água e nutrientes' },
  { key: 'agua_intracelular_l', label: 'Água intracelular', tipo: 'number', unidade: 'L', grupo: 'Água e nutrientes' },
  { key: 'agua_extracelular_l', label: 'Água extracelular', tipo: 'number', unidade: 'L', grupo: 'Água e nutrientes' },
  { key: 'proteina_kg', label: 'Proteína', tipo: 'number', unidade: 'kg', grupo: 'Água e nutrientes' },
  { key: 'minerais_kg', label: 'Minerais', tipo: 'number', unidade: 'kg', grupo: 'Água e nutrientes' },
  // Metabolismo
  { key: 'tmb_kcal', label: 'Taxa metabólica basal', tipo: 'number', unidade: 'kcal', grupo: 'Metabolismo' },
  { key: 'idade_metabolica', label: 'Idade metabólica', tipo: 'number', unidade: 'anos', grupo: 'Metabolismo' },
  { key: 'indice_apendicular', label: 'Índice apendicular', tipo: 'number', unidade: 'kg/m²', grupo: 'Metabolismo' },
  { key: 'gordura_visceral', label: 'Nível de gordura visceral', tipo: 'number', grupo: 'Metabolismo' },
  // Segmentar — massa magra
  { key: 'mm_braco_dir', label: 'Massa magra braço direito', tipo: 'number', unidade: 'kg', grupo: 'Massa magra por região' },
  { key: 'mm_braco_esq', label: 'Massa magra braço esquerdo', tipo: 'number', unidade: 'kg', grupo: 'Massa magra por região' },
  { key: 'mm_tronco', label: 'Massa magra tronco', tipo: 'number', unidade: 'kg', grupo: 'Massa magra por região' },
  { key: 'mm_perna_dir', label: 'Massa magra perna direita', tipo: 'number', unidade: 'kg', grupo: 'Massa magra por região' },
  { key: 'mm_perna_esq', label: 'Massa magra perna esquerda', tipo: 'number', unidade: 'kg', grupo: 'Massa magra por região' },
  // Segmentar — gordura
  { key: 'gd_braco_dir', label: 'Gordura braço direito', tipo: 'number', unidade: 'kg', grupo: 'Gordura por região' },
  { key: 'gd_braco_esq', label: 'Gordura braço esquerdo', tipo: 'number', unidade: 'kg', grupo: 'Gordura por região' },
  { key: 'gd_tronco', label: 'Gordura tronco', tipo: 'number', unidade: 'kg', grupo: 'Gordura por região' },
  { key: 'gd_perna_dir', label: 'Gordura perna direita', tipo: 'number', unidade: 'kg', grupo: 'Gordura por região' },
  { key: 'gd_perna_esq', label: 'Gordura perna esquerda', tipo: 'number', unidade: 'kg', grupo: 'Gordura por região' },
  // Observações
  { key: 'observacoes', label: 'Observações', tipo: 'text', placeholder: 'Aparelho, condições, notas…', grupo: 'Observações' },
];

export const EXAMES_PRESENCIAIS: TipoExame[] = [
  {
    id: 'bioimpedancia',
    nome: 'Bioimpedância',
    descricao: 'Composição corporal — alimenta os planos nutricional, de treino e de saúde. Preencha o que o seu aparelho fornecer.',
    campos: CAMPOS_BIOIMPEDANCIA,
    destaque: ['peso_kg', 'gordura_pct', 'massa_muscular_kg', 'gordura_visceral'],
  },
  {
    id: 'teste_pisada',
    nome: 'Teste de pisada',
    descricao: 'Análise da pisada e do arco plantar — orienta treino e cuidados.',
    campos: [
      { key: 'pisada_direita', label: 'Pisada (pé direito)', tipo: 'select', opcoes: ['pronada', 'neutra', 'supinada'] },
      { key: 'pisada_esquerda', label: 'Pisada (pé esquerdo)', tipo: 'select', opcoes: ['pronada', 'neutra', 'supinada'] },
      { key: 'tipo_arco', label: 'Tipo de arco', tipo: 'select', opcoes: ['normal', 'plano', 'cavo'] },
      { key: 'observacoes', label: 'Observações', tipo: 'text', placeholder: 'Dor, calçado, assimetrias…' },
    ],
    destaque: ['pisada_direita', 'pisada_esquerda', 'tipo_arco'],
    nota: 'Pede interpretação presencial por um profissional (ex.: fisioterapeuta).',
  },
  {
    id: 'dinamometria',
    nome: 'Dinamometria',
    descricao: 'Força muscular (preensão/segmentar). Cole abaixo o texto do resultado.',
    campos: [
      { key: 'resultado', label: 'Resultado', tipo: 'textarea', placeholder: 'Cole aqui o texto do laudo da dinamometria…' },
      { key: 'observacoes', label: 'Observações', tipo: 'text', placeholder: 'Membro dominante, assimetrias…' },
    ],
    destaque: ['resultado'],
    nota: 'Pede avaliação presencial e interpretação por um profissional (ex.: fisioterapeuta).',
  },
  {
    id: 'baropodometria',
    nome: 'Baropodometria',
    descricao: 'Mapa de pressão plantar / distribuição de carga. Cole abaixo o texto do resultado.',
    campos: [
      { key: 'resultado', label: 'Resultado', tipo: 'textarea', placeholder: 'Cole aqui o texto do laudo da baropodometria…' },
      { key: 'observacoes', label: 'Observações', tipo: 'text', placeholder: 'Sobrecargas, assimetrias…' },
    ],
    destaque: ['resultado'],
    nota: 'Pede avaliação presencial e interpretação por um profissional (ex.: fisioterapeuta).',
  },
];

export function tipoExame(id: string): TipoExame | undefined {
  return EXAMES_PRESENCIAIS.find(e => e.id === id);
}

// Grupos de campos na ordem de aparição (para montar o formulário em seções).
export function gruposDoExame(t: TipoExame): { grupo: string; campos: CampoExame[] }[] {
  const ordem: string[] = [];
  const mapa = new Map<string, CampoExame[]>();
  for (const c of t.campos) {
    const g = c.grupo || '';
    if (!mapa.has(g)) { mapa.set(g, []); ordem.push(g); }
    mapa.get(g)!.push(c);
  }
  return ordem.map(g => ({ grupo: g, campos: mapa.get(g)! }));
}

function valorComUnidade(c: CampoExame, v: unknown): string {
  const unidade = c.unidade && c.tipo === 'number' ? ` ${c.unidade}` : '';
  return `${v}${unidade}`;
}

// Frase completa a partir dos dados preenchidos — usada como registro e enviada
// aos motores de IA. Formato: "Bioimpedância: peso 80 kg, % de gordura 22 %, …".
export function resumoExame(tipoId: string, dados: Record<string, unknown>): string {
  const t = tipoExame(tipoId);
  if (!t) return '';
  const partes = t.campos
    .map(c => {
      const v = dados[c.key];
      if (v === undefined || v === null || String(v).trim() === '') return null;
      return `${c.label.toLowerCase()} ${valorComUnidade(c, v)}`;
    })
    .filter(Boolean);
  if (!partes.length) return t.nome;
  return `${t.nome}: ${partes.join(', ')}`;
}

// Resumo CURTO (poucos campos-chave) para a lista do histórico não ficar enorme.
export function resumoCurto(tipoId: string, dados: Record<string, unknown>): string {
  const t = tipoExame(tipoId);
  if (!t) return '';
  const chaves = t.destaque && t.destaque.length ? t.destaque : t.campos.slice(0, 3).map(c => c.key);
  const curto = (s: string) => (s.length > 90 ? `${s.slice(0, 90)}…` : s);
  const partes = chaves
    .map(k => {
      const c = t.campos.find(x => x.key === k);
      const v = dados[k];
      if (!c || v === undefined || v === null || String(v).trim() === '') return null;
      // Textos longos (dinamometria/baropodometria) entram encurtados na lista.
      if (c.tipo === 'textarea') return curto(String(v));
      return `${c.label} ${valorComUnidade(c, v)}`;
    })
    .filter(Boolean);
  return partes.length ? partes.join(' · ') : t.nome;
}
