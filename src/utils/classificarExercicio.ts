// Classifica um exercício da biblioteca em dois eixos, para o profissional
// navegar ao montar/modificar o treino:
//   - segmento: onde atua no corpo (membros inferiores/superiores, tronco, geral)
//   - funcao: o tipo de trabalho (força, mobilidade, funcional, alongamento...)
// Heurística por palavras-chave (PT + EN) no nome e no grupo_muscular, porque a
// biblioteca só tem grupo_muscular em texto livre.

export type Segmento =
  | 'Membros inferiores'
  | 'Membros superiores'
  | 'Tronco / Core'
  | 'Corpo todo'
  | 'Outros';

export type Funcao =
  | 'Força'
  | 'Mobilidade'
  | 'Alongamento'
  | 'Funcional'
  | 'Cardio'
  | 'Equilíbrio';

export const SEGMENTOS: Segmento[] = ['Membros inferiores', 'Membros superiores', 'Tronco / Core', 'Corpo todo', 'Outros'];
export const FUNCOES: Funcao[] = ['Força', 'Mobilidade', 'Alongamento', 'Funcional', 'Cardio', 'Equilíbrio'];

const SEG_RULES: [RegExp, Segmento][] = [
  [/burpee|thruster|clean|snatch|corpo todo|full[ -]?body|swing|polichinelo|arranco|levantamento ol[ií]mpico/i, 'Corpo todo'],
  [/squat|lunge|\bleg\b|calf|glut|hip|deadlift|agachamen|afundo|avanço|passada|perna|panturril|gl[uú]te|quadril|coxa|posterior|adutor|abdutor|joelho|tornozelo|terra|stiff|extensora|flexora|leg[ -]?press|cadeira (extensora|flexora|abdutora|adutora)|elevaç[aã]o de quadril|elevaç[aã]o p[eé]lvica|ponte de gl[uú]te/i, 'Membros inferiores'],
  [/push[ -]?up|bench|chest|\bdip\b|pull[ -]?up|chin[ -]?up|\brow\b|\bback\b|\blat\b|shoulder|overhead|raise|curl|bicep|tricep|supino|rosca|ombro|peito|costas|tr[ií]ceps|b[ií]ceps|remada|puxada|desenvolvimento|punho|cotovelo|flex[aã]o de bra[çc]o|mergulho|barra fixa|barra supinada|elevaç[aã]o lateral|elevaç[aã]o frontal|crucifixo|voador|paralelas|face[ -]?pull|encolhimento|trap[eé]zio/i, 'Membros superiores'],
  [/plank|crunch|sit[ -]?up|\bab\b|core|twist|mountain|prancha|abdômen|abdominal|abdomin|lombar|obl[ií]quo|tronco|coluna|cervical|paravertebr|escalador|abdominal russa|\brussa\b|superman/i, 'Tronco / Core'],
];

const FUN_RULES: [RegExp, Funcao][] = [
  [/stretch|along|flexibil/i, 'Alongamento'],
  [/mobil|mobility|articular|amplitude|adm\b/i, 'Mobilidade'],
  [/balance|equil[ií]br|proprio|unipodal|bosu|instab|prancha lateral/i, 'Equilíbrio'],
  [/cardio|jump|\brun\b|running|burpee|jack|high[ -]?knee|corrida|pular|salto|aer[óo]b|hiit|escada|polichinelo|escalador|corda/i, 'Cardio'],
  [/functional|funcional|carry|farmer|agilidad|kettlebell|swing|arremesso|arrast|carreg/i, 'Funcional'],
];

export interface ClassificacaoExercicio { segmento: Segmento; funcao: Funcao }

export function classificarExercicio(nome?: string | null, grupoMuscular?: string | null): ClassificacaoExercicio {
  const base = `${nome || ''} ${grupoMuscular || ''}`;

  // Segmento: o grupo_muscular costuma já dizer "membros inferiores/superiores".
  let segmento: Segmento = 'Outros';
  if (/inferior/i.test(grupoMuscular || '')) segmento = 'Membros inferiores';
  else if (/superior/i.test(grupoMuscular || '')) segmento = 'Membros superiores';
  else segmento = SEG_RULES.find(([re]) => re.test(base))?.[1] || 'Outros';

  // Função: padrão é Força quando nada específico bate.
  const funcao: Funcao = FUN_RULES.find(([re]) => re.test(base))?.[1] || 'Força';

  return { segmento, funcao };
}
