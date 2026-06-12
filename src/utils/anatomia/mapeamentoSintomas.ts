
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
  // ============= MUSCULOESQUELÉTICO — AXIAL =============
  {
    keywords: ['cervical', 'pescoço', 'pescoco', 'cervicalgia', 'spurling', 'sporting', 'rigidez cervical', 'cervicobraquialgia'],
    regioes: ['cervical', 'pescoco'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['lombar', 'lumbago', 'lombalgia', 'dor nas costas', 'bancaria', 'postura sentada', 'sentada', 'lombo', 'sacro', 'sacroiliaca', 'lasegue'],
    regioes: ['lombar', 'gluteos'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['dorsal', 'torácica', 'toracica', 'dorso', 'interescapular', 'entre as escapulas'],
    regioes: ['dorsal', 'trapezio_d', 'trapezio_e'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['trapezio', 'trapézio', 'ombro tenso', 'tensão cervical', 'cervicogenica'],
    regioes: ['trapezio_d', 'trapezio_e', 'cervical'],
    sistema: 'musculoesqueletico'
  },

  // ============= MUSCULOESQUELÉTICO — MEMBROS SUPERIORES =============
  {
    keywords: ['ombro direito', 'ombro d', 'manguito direito'],
    regioes: ['ombro_d', 'trapezio_d'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['ombro esquerdo', 'ombro e', 'manguito esquerdo'],
    regioes: ['ombro_e', 'trapezio_e'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['ombro', 'manguito rotador', 'impacto subacromial', 'tendinopatia ombro', 'capsulite'],
    regioes: ['ombro_d', 'ombro_e'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['cotovelo', 'epicondilite', 'tenista', 'golfista'],
    regioes: ['cotovelo_d', 'cotovelo_e'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['mãos', 'maos', 'mão', 'mao direita', 'mao esquerda', 'punho', 'dedos', 'membros superiores', 'phalen', 'tinel', 'tunel do carpo'],
    regioes: ['mao_d', 'mao_e', 'antebraco_d', 'antebraco_e'],
    sistema: 'musculoesqueletico'
  },

  // ============= MUSCULOESQUELÉTICO — MEMBROS INFERIORES =============
  {
    keywords: ['quadril', 'coxofemoral', 'trocanter', 'piriforme'],
    regioes: ['coxa_d', 'coxa_e', 'gluteos'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['joelho', 'patela', 'condromalacia', 'menisco', 'ligamento cruzado', 'lca', 'lcp'],
    regioes: ['joelho_d', 'joelho_e'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['joelho direito', 'joelho d'],
    regioes: ['joelho_d'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['joelho esquerdo', 'joelho e'],
    regioes: ['joelho_e'],
    sistema: 'musculoesqueletico'
  },
  {
    keywords: ['pés', 'pes', 'pé direito', 'pe direito', 'pé esquerdo', 'pe esquerdo', 'tornozelo', 'membros inferiores', 'pernas', 'fascite plantar', 'aquiles'],
    regioes: ['pe_d', 'pe_e', 'canela_d', 'canela_e', 'calc_d', 'calc_e'],
    sistema: 'musculoesqueletico'
  },

  // ============= NEUROLÓGICO =============
  {
    keywords: ['irradiação', 'irradiacao', 'neural', 'formigamento', 'dormencia', 'dormência', 'choque', 'nervo', 'comprometimento neural', 'radiculopatia', 'ciatalgia', 'ciatica', 'parestesia'],
    regioes: ['cervical', 'lombar'],
    sistema: 'nervoso'
  },
  {
    keywords: ['cabeça', 'cabeca', 'cefaleia', 'enxaqueca', 'dor de cabeça', 'crânio', 'cranio', 'tcm', 'concussao'],
    regioes: ['cabeca'],
    sistema: 'nervoso'
  },
  {
    keywords: ['insônia', 'insonia', 'sono', 'estresse', 'ansiedade', 'psicossocial', 'substâncias', 'substancias', 'depressao', 'depressão'],
    regioes: ['cabeca', 'cervical'],
    sistema: 'nervoso'
  },
  {
    keywords: ['atm', 'bruxismo', 'mandibula', 'mandíbula', 'temporomandibular'],
    regioes: ['cabeca'],
    sistema: 'musculoesqueletico'
  },

  // ============= DIGESTÓRIO =============
  {
    keywords: ['refluxo', 'azia', 'queimação', 'queimacao', 'esofago', 'esôfago', 'pirose'],
    regioes: ['peitoral', 'abdomen'],
    sistema: 'digestorio'
  },
  {
    keywords: ['estômago', 'estomago', 'gastrite', 'bariátrica', 'bariatrica', 'digestão', 'digestao', 'sobrepeso', 'obesidade'],
    regioes: ['abdomen'],
    sistema: 'digestorio'
  },
  {
    keywords: ['intestino', 'gases', 'estufamento', 'bloating', 'constipação', 'constipacao', 'diarreia', 'ibs', 'colon irritavel'],
    regioes: ['abdomen', 'pelve'],
    sistema: 'digestorio'
  },

  // ============= RESPIRATÓRIO =============
  {
    keywords: ['falta de ar', 'dispneia', 'pulmão', 'pulmao', 'tosse', 'respiratório', 'respiratorio', 'asma'],
    regioes: ['peitoral'],
    sistema: 'respiratorio'
  },

  // ============= CIRCULATÓRIO =============
  {
    keywords: ['coração', 'coracao', 'palpitação', 'palpitacao', 'taquicardia', 'pressão alta', 'hipertensão', 'hipertensao', 'circulação'],
    regioes: ['peitoral'],
    sistema: 'circulatorio'
  },
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

  // Mapeamento de dimensões do MyID para sistemas/regiões
  if (textoNormalizado.includes('score_d')) {
    // Se houver score de dor, podemos marcar regiões genéricas se não houver keyword específica
  }

  MAPEAMENTO_SINTOMAS.forEach(mapeamento => {
    mapeamento.keywords.forEach(keyword => {
      const keywordNormalizada = normalizarTexto(keyword);
      // Use regex to find whole words for keywords like 'D' or 'EFI' if they were present, 
      // but here we use simple inclusion for longer keywords
      if (textoNormalizado.includes(keywordNormalizada)) {
        mapeamento.regioes.forEach(regId => {
          // Evitar duplicatas de região
          if (!resultados.find(r => r.regiao_id === regId)) {
            resultados.push({
              regiao_id: regId,
              sistema: mapeamento.sistema,
              termo: keyword
            });
          }
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

  // Handle specific MyID fields if passed directly
  if (obj.myid_score !== undefined) {
    texto += ` MyID Score: ${obj.myid_score}.`;
  }

  Object.entries(obj).forEach(([key, val]) => {
    // Include the key if it's a score field to give context to the number
    if (key.startsWith('score_') && typeof val === 'number') {
      texto += ` ${key.replace('score_', '')}: ${val}/10.`;
    }
    
    if (typeof val === 'string') {
      texto += ' ' + val;
    } else if (typeof val === 'object') {
      texto += ' ' + extrairTextoDeObjeto(val);
    }
  });

  return texto;
}
