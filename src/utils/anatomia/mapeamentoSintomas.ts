
export type SistemaCorporal =
  | 'musculoesqueletico'
  | 'nervoso'
  | 'digestorio'
  | 'circulatorio'
  | 'respiratorio'
  | 'endocrino'
  | 'urinario'
  | 'reprodutor'
  | 'tegumentar'
  | 'linfatico'
  | 'sensorial';

export interface MapeamentoSintoma {
  keywords: string[];
  regioes: string[];
  sistema: SistemaCorporal;
}

export const MAPEAMENTO_SINTOMAS: MapeamentoSintoma[] = [
  // --- MUSCULOESQUELÉTICO & NERVOUS (Common overlaps) ---
  {
    keywords: ['cervical', 'pescoço', 'pescoco', 'cervicalgia', 'sporting', 'spurling'],
    regioes: ['cervical', 'pescoco'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['lombar', 'lumbago', 'dor nas costas', 'bancaria', 'sentada', 'lombo', 'sacro'],
    regioes: ['lombar', 'gluteos'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['irradiação', 'irradiacao', 'neural', 'formigamento', 'dormencia', 'dormência', 'choque', 'nervo', 'comprometimento neural', 'radiculopatia'],
    regioes: ['nervo_mediano_d', 'nervo_mediano_e', 'nervo_ciatico_p', 'plexo_braquial_d', 'plexo_braquial_e', 'plexo_lombosacro_d', 'plexo_lombosacro_e'],
    sistema: 'nervoso'
  },

  {
    keywords: ['mãos', 'maos', 'mão', 'mao', 'punho', 'dedos', 'membros superiores'],
    regioes: ['mao_d', 'mao_e', 'antebraco_d', 'antebraco_e', 'plexo_braquial_d', 'plexo_braquial_e', 'nervo_mediano_d', 'nervo_mediano_e'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['pés', 'pes', 'pé', 'pe', 'tornozelo', 'membros inferiores', 'pé esquerdo', 'pe esquerdo', 'pernas'],
    regioes: ['pe_d', 'pe_e', 'canela_d', 'canela_e', 'nervo_ciatico_p', 'plexo_lombosacro_d', 'plexo_lombosacro_e'],
    sistema: 'musculoesqueletico'
  },

  {
    keywords: ['cabeça', 'cabeca', 'cefaleia', 'enxaqueca', 'dor de cabeça', 'crânio', 'cranio'],
    regioes: ['cabeca', 'cerebro'],
    sistema: 'nervoso'
  },
  {
    keywords: ['insônia', 'insonia', 'sono', 'estresse', 'ansiedade', 'psicossocial', 'substâncias', 'substancias'],
    regioes: ['cabeca', 'cerebro', 'coracao'],
    sistema: 'nervoso'
  },

  // --- DIGESTIVE ---
  {
    keywords: ['refluxo', 'azia', 'queimação', 'esofago', 'esôfago'],
    regioes: ['esofago'],
    sistema: 'digestorio'
  },
  {
    keywords: ['estômago', 'estomago', 'gastrite', 'bariátrica', 'bariatrica', 'digestão', 'digestao', 'sobrepeso'],
    regioes: ['estomago', 'abdomen'],
    sistema: 'digestorio'
  },
  {
    keywords: ['intestino', 'gases', 'estufamento', 'bloating', 'constipação', 'diarreia'],
    regioes: ['intestino_delgado', 'intestino_grosso'],
    sistema: 'digestorio'
  },

  // --- RESPIRATORY ---
  {
    keywords: ['falta de ar', 'dispneia', 'pulmão', 'pulmao', 'tosse', 'respiratório'],
    regioes: ['pulmao_d', 'pulmao_e', 'traqueia'],
    sistema: 'respiratorio'
  },

  // --- CIRCULATORY ---
  {
    keywords: ['coração', 'coracao', 'palpitação', 'pressão', 'hipertensão', 'circulação'],
    regioes: ['coracao', 'aorta_abdominal'],
    sistema: 'circulatorio'
  }
];

export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function encontrarSintomasEmTexto(texto: string): { regiao_id: string; sistema: SistemaCorporal; termo: string }[] {
  const textoNormalizado = normalizarTexto(texto);
  const resultados: { regiao_id: string; sistema: SistemaCorporal; termo: string }[] = [];

  MAPEAMENTO_SINTOMAS.forEach(mapeamento => {
    mapeamento.keywords.forEach(keyword => {
      const keywordNormalizada = normalizarTexto(keyword);
      if (textoNormalizado.includes(keywordNormalizada)) {
        mapeamento.regioes.forEach(regId => {
          resultados.push({
            regiao_id: regId,
            sistema: mapeamento.sistema,
            termo: keyword
          });
        });
      }
    });
  });

  return resultados;
}

export function extrairTextoDeObjeto(obj: any): string {
  let texto = '';
  if (typeof obj === 'string') return obj;
  if (typeof obj !== 'object' || obj === null) return '';

  Object.values(obj).forEach(val => {
    if (typeof val === 'string') {
      texto += ' ' + val;
    } else if (typeof val === 'object') {
      texto += ' ' + extrairTextoDeObjeto(val);
    }
  });

  return texto;
}
