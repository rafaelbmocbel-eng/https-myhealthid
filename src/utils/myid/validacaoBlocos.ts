import type { MyIDResponses } from './calculator';

// Perguntas de escolha que, sem resposta, entravam no cálculo com um valor
// assumido em silêncio (o cliente não sabia que tinha pulado).
const OBRIGATORIAS: Record<number, { campo: string; rotulo: string }[]> = {
  3: [
    { campo: 'bloco_3_work', rotulo: 'Trabalho' },
    { campo: 'bloco_3_home', rotulo: 'Tarefas de casa' },
    { campo: 'bloco_3_exercise', rotulo: 'Exercício' },
    { campo: 'bloco_3_independence', rotulo: 'Independência física' },
    { campo: 'bloco_3_social', rotulo: 'Vida social' },
  ],
  4: [
    { campo: 'bloco_4_fear_movement', rotulo: 'Medo de movimento' },
    { campo: 'bloco_4_belief_damage', rotulo: 'Crença de dano' },
    { campo: 'bloco_4_avoidance', rotulo: 'Evitação' },
    { campo: 'bloco_4_self_efficacy', rotulo: 'Confiança' },
    { campo: 'bloco_4_expectation', rotulo: 'Expectativa de melhora' },
  ],
};

/** Rótulos das perguntas obrigatórias ainda sem resposta no bloco. */
export function pendenciasDoBloco(bloco: number, data: MyIDResponses): string[] {
  const d = data as Record<string, unknown>;
  return (OBRIGATORIAS[bloco] || [])
    .filter(({ campo }) => d[campo] === undefined || d[campo] === null || d[campo] === '')
    .map(({ rotulo }) => rotulo);
}
