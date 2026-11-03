// Check-in semanal de bem-estar: itens, escalas, leitura da resposta do WhatsApp, textos e comparação.
// Código puro (sem Deno, DOM nem rede): é importado pelas Edge Functions e pelo app, e testado em src/test/checkinSemanal.test.ts.
// Em todos os itens de 1 a 5, quanto MAIOR, melhor.

export const ITENS_CHECKIN = ['fadiga', 'sono', 'dor_muscular', 'estresse', 'humor'] as const;
export type ItemCheckin = (typeof ITENS_CHECKIN)[number];

export interface ValoresCheckin {
  fadiga: number;
  sono: number;
  dor_muscular: number;
  estresse: number;
  humor: number;
  /** Cor da urina de 1 (quase incolor) a 8 (marrom). */
  urina: number | null;
  /** Recuperação percebida do treino, de 0 a 10. */
  psr: number | null;
}

export interface LinhaCheckin extends ValoresCheckin {
  /** Segunda-feira da semana, AAAA-MM-DD (horário de Brasília). */
  semana: string;
}

export const FAIXA_ITEM = { min: 1, max: 5 } as const;
export const FAIXA_URINA = { min: 1, max: 8 } as const;
export const FAIXA_PSR = { min: 0, max: 10 } as const;

/** O alerta compara as duas últimas semanas com a média das primeiras respostas do próprio cliente. */
export const TAMANHO_BASELINE = 4;
export const MIN_RESPOSTAS_ALERTA = TAMANHO_BASELINE + 2;
export const QUEDA_ALERTA = 1;

export type NivelItem = 1 | 2 | 3 | 4 | 5;

export interface RotuloItem {
  titulo: string;
  curto: string;
  niveis: Record<NivelItem, string>;
}

export const ROTULOS_ITEM: Record<ItemCheckin, RotuloItem> = {
  fadiga: {
    titulo: 'Fadiga',
    curto: 'Fadiga',
    niveis: { 5: 'Muito descansado(a)', 4: 'Descansado(a)', 3: 'Normal', 2: 'Mais cansado(a) que o normal', 1: 'Exausto(a), sempre cansado(a)' },
  },
  sono: {
    titulo: 'Qualidade do sono',
    curto: 'Sono',
    niveis: { 5: 'Muito tranquilo', 4: 'Bom', 3: 'Demorei para pegar no sono', 2: 'Sono agitado, acordei várias vezes', 1: 'Insônia' },
  },
  dor_muscular: {
    titulo: 'Dor muscular',
    curto: 'Dor muscular',
    niveis: { 5: 'Sem dor, me sentindo ótimo(a)', 4: 'Me sentindo bem', 3: 'Normal', 2: 'Mais dores musculares que o normal', 1: 'Muito dolorido(a)' },
  },
  estresse: {
    titulo: 'Nível de estresse',
    curto: 'Estresse',
    niveis: { 5: 'Muito relaxado(a)', 4: 'Relaxado(a)', 3: 'Normal', 2: 'Estressado(a)', 1: 'Muito estressado(a)' },
  },
  humor: {
    titulo: 'Humor',
    curto: 'Humor',
    niveis: { 5: 'Muito bom humor', 4: 'Bom humor', 3: 'Normal', 2: 'Desanimado(a), com menos interesse que o normal', 1: 'Muito triste, irritado(a) ou aborrecido(a)' },
  },
};

export interface RotuloUrina {
  nivel: number;
  descricao: string;
  cor: string;
}

export const ESCALA_URINA: readonly RotuloUrina[] = [
  { nivel: 1, descricao: 'Quase incolor', cor: '#FEFDF0' },
  { nivel: 2, descricao: 'Amarelo muito claro', cor: '#FDF6C3' },
  { nivel: 3, descricao: 'Amarelo claro', cor: '#FBEB87' },
  { nivel: 4, descricao: 'Amarelo', cor: '#F7D84A' },
  { nivel: 5, descricao: 'Amarelo escuro', cor: '#F2C230' },
  { nivel: 6, descricao: 'Âmbar', cor: '#E5A323' },
  { nivel: 7, descricao: 'Âmbar escuro', cor: '#C97F14' },
  { nivel: 8, descricao: 'Marrom', cor: '#9A5A0C' },
];

export type ClasseUrina = 'boa' | 'atencao' | 'desidratacao';

/** 1 a 3: hidratação boa; 4 e 5: atenção; 6 a 8: sinal de pouca água. */
export function classeUrina(nivel: number): ClasseUrina {
  if (nivel <= 3) return 'boa';
  if (nivel <= 5) return 'atencao';
  return 'desidratacao';
}

/** As 4 opções da cor da urina que o MyID (bloco 5F) já usa. */
export function urinaParaMyID(nivel: number): 'clear' | 'yellow_clear' | 'dark' | 'very_dark' {
  if (nivel <= 2) return 'clear';
  if (nivel <= 4) return 'yellow_clear';
  if (nivel <= 6) return 'dark';
  return 'very_dark';
}

export function rotuloPsr(nivel: number): string {
  if (nivel <= 1) return 'Nada recuperado(a)';
  if (nivel <= 3) return 'Pouco recuperado(a)';
  if (nivel <= 5) return 'Recuperação razoável';
  if (nivel <= 7) return 'Bem recuperado(a)';
  if (nivel <= 9) return 'Muito bem recuperado(a)';
  return 'Totalmente recuperado(a)';
}

/** Em que dimensão do MyID cada pergunta conversa (o humor não tem dimensão própria hoje). */
export const DIMENSAO_MYID_DO_ITEM: Record<ItemCheckin | 'urina' | 'psr', string | null> = {
  fadiga: 'R',
  sono: 'R',
  estresse: 'R',
  dor_muscular: 'D',
  humor: null,
  urina: 'HID',
  psr: 'R',
};

/** Soma dos 5 itens (5 a 25), como no questionário de bem-estar de Hooper. */
export function indiceBemEstar(v: Pick<ValoresCheckin, ItemCheckin>): number {
  return ITENS_CHECKIN.reduce((soma, item) => soma + v[item], 0);
}

/** Converte um item de 1 a 5 para a escala de 0 a 10 do MyID. */
export function paraEscala10(nivel: number): number {
  return Math.round(((nivel - 1) / 4) * 100) / 10;
}

// ───────────── Datas (Brasília, UTC−3 fixo) ─────────────

const OFFSET_BR_MS = 3 * 3600000;
const DIA_MS = 86400000;

/** Segunda-feira (AAAA-MM-DD) da semana de `agora`, no horário de Brasília. */
export function inicioDaSemanaBR(agora: Date = new Date()): string {
  const br = new Date(agora.getTime() - OFFSET_BR_MS);
  const voltar = (br.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate() - voltar)).toISOString().slice(0, 10);
}

/** Dias entre duas datas AAAA-MM-DD (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA_MS);
}

/** 27/10 a partir de 2026-10-27. */
export function dataCurta(semana: string): string {
  const [, mes, dia] = semana.split('-');
  return `${dia}/${mes}`;
}

// ───────────── Leitura da resposta do WhatsApp ─────────────

export type MotivoRecusa = 'nao_numerico' | 'quantidade' | 'fora_da_faixa' | 'ambiguo';

export type ResultadoLeitura =
  | { ok: true; valores: ValoresCheckin }
  | { ok: false; motivo: MotivoRecusa; detalhe: string };

const SO_NUMEROS_E_SEPARADORES = /^[\d\s,;.\-/]+$/;

function limpar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, ' ')
    .toLowerCase()
    .replace(/\s+e\s+/g, ' ')
    .trim();
}

type Separacao = { tipo: 'numeros'; partes: string[] } | { tipo: 'ambiguo' } | { tipo: 'texto' };

/** Vírgula ou ponto colados nos dígitos numa lista separada por espaços ("4,5 3 5 4 4 2") podem ser meio ponto: não dá para saber. */
function separarEmNumeros(texto: string): Separacao {
  const t = limpar(texto);
  if (!SO_NUMEROS_E_SEPARADORES.test(t)) return { tipo: 'texto' };
  if (/\s/.test(t) && /\d[.,]\d/.test(t)) return { tipo: 'ambiguo' };
  if (/^\d+$/.test(t) && t.length >= 5 && t.length <= 7) return { tipo: 'numeros', partes: t.split('') };
  return { tipo: 'numeros', partes: t.split(/[^\d]+/).filter(Boolean) };
}

/** Texto com letras no meio, mas que começa com cinco números de 1 a 5 ("Oi! 4 3 5 4 4 2", "1) 4 2) 3 ..."): parece resposta ao check-in. */
function pareceRespostaMista(texto: string): boolean {
  const numeros = limpar(texto).match(/(?<!\d)\d{1,2}(?!\d)/g);
  if (!numeros || numeros.length < 5) return false;
  return numeros.slice(0, 5).every((n) => {
    const v = parseInt(n, 10);
    return v >= FAIXA_ITEM.min && v <= FAIXA_ITEM.max;
  });
}

/**
 * Texto que se parece com uma resposta ao check-in: de 4 a 8 números de até 2 dígitos ou 5 a 7 dígitos colados, ou texto misturado
 * que começa com cinco números de 1 a 5. Fica de fora o que costuma aparecer numa conversa normal: ano, hora, data, telefone e CPF.
 */
export function pareceTentativaDeCheckin(texto: string): boolean {
  const sep = separarEmNumeros(texto);
  if (sep.tipo === 'ambiguo') return true;
  if (sep.tipo === 'texto') return pareceRespostaMista(texto);
  const partes = sep.partes;
  if (partes.length === 1) return partes[0].length >= 5 && partes[0].length <= 7;
  return partes.length >= 4 && partes.length <= 8 && partes.every((p) => p.length <= 2);
}

export function interpretarRespostaCheckin(texto: string): ResultadoLeitura {
  const sep = separarEmNumeros(texto);
  if (sep.tipo === 'texto') return { ok: false, motivo: 'nao_numerico', detalhe: 'a resposta tem letras ou símbolos' };
  if (sep.tipo === 'ambiguo') return { ok: false, motivo: 'ambiguo', detalhe: 'vírgula ou ponto junto dos números pode ser meio ponto' };
  const partes = sep.partes;
  if (partes.length < 5 || partes.length > 7) {
    return { ok: false, motivo: 'quantidade', detalhe: `${partes.length} números em vez de 5 a 7` };
  }
  const n = partes.map((p) => parseInt(p, 10));
  for (let i = 0; i < ITENS_CHECKIN.length; i++) {
    if (n[i] < FAIXA_ITEM.min || n[i] > FAIXA_ITEM.max) {
      return { ok: false, motivo: 'fora_da_faixa', detalhe: `${ROTULOS_ITEM[ITENS_CHECKIN[i]].curto} precisa ser de 1 a 5 (veio ${n[i]})` };
    }
  }
  const urina = n.length >= 6 ? n[5] : null;
  if (urina !== null && (urina < FAIXA_URINA.min || urina > FAIXA_URINA.max)) {
    return { ok: false, motivo: 'fora_da_faixa', detalhe: `a cor da urina precisa ser de 1 a 8 (veio ${urina})` };
  }
  const psr = n.length === 7 ? n[6] : null;
  if (psr !== null && (psr < FAIXA_PSR.min || psr > FAIXA_PSR.max)) {
    return { ok: false, motivo: 'fora_da_faixa', detalhe: `a recuperação do treino precisa ser de 0 a 10 (veio ${psr})` };
  }
  return {
    ok: true,
    valores: { fadiga: n[0], sono: n[1], dor_muscular: n[2], estresse: n[3], humor: n[4], urina, psr },
  };
}

function semCortesias(texto: string): string {
  return limpar(texto)
    .replace(/\b(por favor|pf|pfv|obrigad[oa]|vlw|valeu)\b/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pedido de saída: a palavra sozinha (parar, pare, sair, stop, descadastrar) ou "não quero mais receber", com cortesia e emoji à vontade. */
export function reconheceParar(texto: string): boolean {
  return /^(parar|pare|sair|stop|descadastrar|nao quero mais receber( mensagens| isso| o check in| o checkin)?)$/.test(semCortesias(texto));
}

export function reconheceVoltar(texto: string): boolean {
  return /^(voltar|volto|quero voltar)$/.test(semCortesias(texto));
}

// ───────────── Textos do WhatsApp ─────────────

export interface OpcoesPedido {
  nome?: string | null;
  /** Inclui a pergunta opcional de recuperação do treino (só para quem treina). */
  comPsr?: boolean;
  /** Quando o cliente ainda não concluiu o MyID: link para começar por ele. */
  linkMyID?: string | null;
}

function primeiroNome(nome?: string | null): string {
  return (nome || '').trim().split(/\s+/)[0] || '';
}

export function montarPedidoCheckin(opcoes: OpcoesPedido = {}): string {
  const nome = primeiroNome(opcoes.nome);
  const quantos = opcoes.comPsr ? 'até 7' : '6';
  const exemplo = opcoes.comPsr ? '4 3 5 4 4 2 7' : '4 3 5 4 4 2';
  const linhas = [
    nome ? `Oi ${nome}! 🌿 Check-in da semana (30 segundos).` : 'Oi! 🌿 Check-in da semana (30 segundos).',
    `Responda com ${quantos} números, na ordem, separados por espaço. Nos itens de 1 a 5, quanto MAIOR, melhor:`,
    '1) Fadiga (5 = muito descansado, 1 = sempre cansado)',
    '2) Sono (5 = muito tranquilo, 1 = insônia)',
    '3) Dor muscular (5 = sem dor, 1 = muito dolorido)',
    '4) Estresse (5 = muito relaxado, 1 = muito estressado)',
    '5) Humor (5 = muito bom humor, 1 = muito triste ou irritado)',
    '6) Cor da urina, de 1 (quase incolor) a 8 (marrom)',
    opcoes.comPsr ? '7) Opcional: recuperação do treino, de 0 (nada recuperado) a 10 (totalmente recuperado)' : null,
    `Exemplo: ${exemplo}`,
    opcoes.linkMyID ? `\n👉 Seu primeiro passo continua sendo o MyID: ${opcoes.linkMyID}` : null,
    '\nPara não receber mais, responda PARAR. Se for urgente, procure atendimento: este canal não é acompanhado em tempo real.',
  ];
  return linhas.filter((l): l is string => l !== null).join('\n');
}

export function montarConfirmacaoCheckin(valores: ValoresCheckin, linkMyID?: string | null): string {
  const partes = [
    `Fadiga ${valores.fadiga}`,
    `Sono ${valores.sono}`,
    `Dor muscular ${valores.dor_muscular}`,
    `Estresse ${valores.estresse}`,
    `Humor ${valores.humor}`,
  ];
  if (valores.urina !== null) partes.push(`Urina ${valores.urina}`);
  if (valores.psr !== null) partes.push(`Recuperação ${valores.psr}`);
  const linhas = [
    `Anotei sua semana ✅ ${partes.join(' · ')}.`,
    'Algum número errado? É só mandar os números de novo que eu corrijo. Obrigado!',
    linkMyID ? `\n👉 Falta o seu MyID, o primeiro passo: ${linkMyID}` : null,
  ];
  return linhas.filter((l): l is string => l !== null).join('\n');
}

export function montarAjudaCheckin(motivo: MotivoRecusa, detalhe: string): string {
  const base = 'Não consegui ler sua resposta do check-in';
  if (motivo === 'quantidade') {
    return `${base}: mandei ${detalhe}. Envie 6 números (ou 7), de 1 a 5 nos cinco primeiros, na ordem fadiga, sono, dor muscular, estresse e humor. Exemplo: 4 3 5 4 4 2`;
  }
  if (motivo === 'fora_da_faixa') {
    return `${base}: ${detalhe}. Confira os números e envie de novo. Exemplo: 4 3 5 4 4 2`;
  }
  if (motivo === 'ambiguo') {
    return `${base}: vírgula ou ponto junto dos números pode ser meio ponto, e eu só aceito números inteiros. Envie de novo só com espaços entre eles. Exemplo: 4 3 5 4 4 2`;
  }
  return `${base}. Envie só números separados por espaço. Exemplo: 4 3 5 4 4 2`;
}

export function montarConfirmacaoParar(): string {
  return 'Pronto, você não vai mais receber o check-in semanal por aqui. Se quiser voltar, responda VOLTAR. Você também pode responder pelo app quando quiser. 💙';
}

export function montarConfirmacaoVoltar(): string {
  return 'Combinado! Você volta a receber o check-in semanal por aqui. 💙';
}

// ───────────── Comparação e alertas ─────────────

export type Sentido = 'melhorou' | 'piorou' | 'igual';

/** Maior é melhor nos 5 itens e na recuperação; na urina, menor é melhor. */
export function sentidoDaVariacao(delta: number, menorEhMelhor = false): Sentido {
  if (delta === 0) return 'igual';
  const subiu = delta > 0;
  return subiu === menorEhMelhor ? 'piorou' : 'melhorou';
}

export interface Variacao {
  delta: number;
  sentido: Sentido;
}

export type ChaveComparavel = ItemCheckin | 'urina' | 'psr';

export function variacaoDoItem(chave: ChaveComparavel, atual: LinhaCheckin, anterior: LinhaCheckin | null): Variacao | null {
  if (!anterior) return null;
  const a = atual[chave];
  const b = anterior[chave];
  if (a === null || b === null) return null;
  const delta = a - b;
  return { delta, sentido: sentidoDaVariacao(delta, chave === 'urina') };
}

export type Baseline = Record<ItemCheckin, number>;

function ordenar(serie: readonly LinhaCheckin[]): LinhaCheckin[] {
  return [...serie].sort((x, y) => x.semana.localeCompare(y.semana));
}

function mediaDasPrimeiras(ordenada: readonly LinhaCheckin[]): Baseline | null {
  if (ordenada.length < TAMANHO_BASELINE) return null;
  const base = ordenada.slice(0, TAMANHO_BASELINE);
  const media = {} as Baseline;
  for (const item of ITENS_CHECKIN) {
    media[item] = base.reduce((s, l) => s + l[item], 0) / TAMANHO_BASELINE;
  }
  return media;
}

/** Média das primeiras 4 respostas do cliente, com uma casa decimal. Sem respostas suficientes, não há linha de base. */
export function calcularBaseline(serie: readonly LinhaCheckin[]): Baseline | null {
  const media = mediaDasPrimeiras(ordenar(serie));
  if (!media) return null;
  const arredondada = {} as Baseline;
  for (const item of ITENS_CHECKIN) arredondada[item] = Math.round(media[item] * 10) / 10;
  return arredondada;
}

/**
 * Itens em alerta: as duas últimas respostas (de semanas seguidas) estão, as duas, pelo menos 1 ponto abaixo da média
 * das primeiras 4 respostas do próprio cliente. Exige 6 respostas no total: as 4 da linha de base não entram na comparação.
 * O banco (função checkin_alertas) aplica a mesma regra, e os dois lados usam os mesmos casos de teste.
 */
export function calcularAlertas(serie: readonly LinhaCheckin[]): ItemCheckin[] {
  const ordenada = ordenar(serie);
  if (ordenada.length < MIN_RESPOSTAS_ALERTA) return [];
  const media = mediaDasPrimeiras(ordenada);
  if (!media) return [];
  const penultima = ordenada[ordenada.length - 2];
  const ultima = ordenada[ordenada.length - 1];
  if (diasEntre(penultima.semana, ultima.semana) !== 7) return [];
  return ITENS_CHECKIN.filter(
    (item) => penultima[item] <= media[item] - QUEDA_ALERTA && ultima[item] <= media[item] - QUEDA_ALERTA,
  );
}
