// Definições dos EXAMES PRESENCIAIS (bioimpedância, teste de pisada, …).
//
// Genérico e extensível: para acrescentar um novo exame, basta adicionar um
// item em EXAMES_PRESENCIAIS — sem migração no banco (a tabela guarda `tipo`
// como texto e `dados` como JSON) e sem mexer no card, que se monta a partir
// daqui. O `resumo` gerado alimenta os motores de IA dos planos.

export type CampoTipo = 'number' | 'text' | 'select';

export interface CampoExame {
  key: string;
  label: string;
  tipo: CampoTipo;
  unidade?: string;
  opcoes?: string[];        // para tipo 'select'
  placeholder?: string;
}

export interface TipoExame {
  id: string;               // valor gravado em exames_presenciais.tipo
  nome: string;
  descricao: string;
  campos: CampoExame[];
}

export const EXAMES_PRESENCIAIS: TipoExame[] = [
  {
    id: 'bioimpedancia',
    nome: 'Bioimpedância',
    descricao: 'Composição corporal — alimenta os planos nutricional, de treino e de saúde.',
    campos: [
      { key: 'peso_kg', label: 'Peso', tipo: 'number', unidade: 'kg' },
      { key: 'gordura_pct', label: '% de gordura', tipo: 'number', unidade: '%' },
      { key: 'massa_magra_kg', label: 'Massa magra', tipo: 'number', unidade: 'kg' },
      { key: 'massa_gorda_kg', label: 'Massa gorda', tipo: 'number', unidade: 'kg' },
      { key: 'agua_pct', label: 'Água corporal', tipo: 'number', unidade: '%' },
      { key: 'gordura_visceral', label: 'Gordura visceral', tipo: 'number', unidade: 'nível' },
      { key: 'tmb_kcal', label: 'Metabolismo basal (TMB)', tipo: 'number', unidade: 'kcal' },
      { key: 'massa_ossea_kg', label: 'Massa óssea', tipo: 'number', unidade: 'kg' },
      { key: 'imc', label: 'IMC', tipo: 'number' },
      { key: 'idade_metabolica', label: 'Idade metabólica', tipo: 'number', unidade: 'anos' },
      { key: 'observacoes', label: 'Observações', tipo: 'text', placeholder: 'Aparelho, condições, notas…' },
    ],
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
  },
];

export function tipoExame(id: string): TipoExame | undefined {
  return EXAMES_PRESENCIAIS.find(e => e.id === id);
}

// Frase pronta a partir dos dados preenchidos — usada na exibição e enviada aos
// motores de IA. Formato: "Bioimpedância: peso 80kg, % de gordura 22%, …".
export function resumoExame(tipoId: string, dados: Record<string, unknown>): string {
  const t = tipoExame(tipoId);
  if (!t) return '';
  const partes = t.campos
    .map(c => {
      const v = dados[c.key];
      if (v === undefined || v === null || String(v).trim() === '') return null;
      const unidade = c.unidade && c.tipo === 'number' ? ` ${c.unidade}` : '';
      return `${c.label.toLowerCase()} ${v}${unidade}`;
    })
    .filter(Boolean);
  if (!partes.length) return t.nome;
  return `${t.nome}: ${partes.join(', ')}`;
}
