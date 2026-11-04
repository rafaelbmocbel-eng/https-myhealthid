import {
  contarCaracteres, ehCodigoJustificavel, CODIGOS_JUSTIFICAVEIS, LIMITE_CARACTERES, limparTextoJustificativa, type CodigoJustificavel,
} from '../../supabase/functions/_shared/cassi-justificativa';

export * from '../../supabase/functions/_shared/cassi-justificativa';

/**
 * Um texto gerado. `assinatura` guarda os dados com que ele nasceu; `editado` vira true quando o profissional mexe no texto.
 * `musculosIA` (só no 301) é a lista que a IA propôs quando o profissional não informou músculos: a tela a mostra como sugestão
 * enquanto o campo ainda for igual a ela.
 */
export interface TextoGerado { texto: string; ajustado: boolean; assinatura: string; editado: boolean; musculosIA?: string }
export type TextosGerados = Partial<Record<CodigoJustificavel, TextoGerado>>;

export interface DadosDaJustificativa { diagnostico: string; musculos: string; achados: string }

export const assinaturaDe = (d: DadosDaJustificativa) => JSON.stringify([d.diagnostico.trim(), d.musculos.trim(), d.achados.trim()]);

/** O texto nasceu de dados que mudaram depois (e o profissional não assumiu o texto editando-o à mão). */
export const textoDesatualizado = (t: TextoGerado, atuais: DadosDaJustificativa) => !t.editado && t.assinatura !== assinaturaDe(atuais);

export type MotivoForaDaMensagem = 'desatualizada' | 'acima do limite';

export interface JustificativasDaMensagem {
  /** Texto limpo de cada código marcado que vai na mensagem. */
  incluidas: Partial<Record<CodigoJustificavel, string>>;
  /** Textos gerados que NÃO vão: o profissional precisa saber, porque o pedido sairia sem a justificativa. */
  deixadas: Array<{ codigo: CodigoJustificavel; motivo: MotivoForaDaMensagem }>;
}

/**
 * Quais justificativas já geradas acompanham o pedido na mensagem (Copiar / WhatsApp). Só os códigos 301/131 que continuam
 * marcados; o mesmo critério do Copiar de cada quadro: texto em dia com o diagnóstico/músculos/achados atuais e dentro de 500
 * caracteres. Código marcado sem texto gerado não entra e não é aviso: o profissional pode não querer justificar.
 */
export function justificativasParaMensagem(
  textos: TextosGerados | undefined,
  item: DadosDaJustificativa & { codigos: string[] },
): JustificativasDaMensagem {
  const saida: JustificativasDaMensagem = { incluidas: {}, deixadas: [] };
  for (const codigo of codigosParaJustificar(item.codigos)) {
    const gerado = textos?.[codigo];
    const limpo = gerado ? limparTextoJustificativa(gerado.texto) : '';
    if (!gerado || !limpo) continue;
    if (textoDesatualizado(gerado, item)) saida.deixadas.push({ codigo, motivo: 'desatualizada' });
    else if (contarCaracteres(limpo) > LIMITE_CARACTERES) saida.deixadas.push({ codigo, motivo: 'acima do limite' });
    else saida.incluidas[codigo] = limpo;
  }
  return saida;
}

/** Dos códigos marcados no card, os que têm justificativa, sempre na ordem 301, 131. */
export function codigosParaJustificar(marcados: string[]): CodigoJustificavel[] {
  return CODIGOS_JUSTIFICAVEIS.filter((c) => marcados.includes(c) && ehCodigoJustificavel(c));
}

/**
 * Aproximação do número de músculos citados, só como lembrete: o 301 é cobrado por músculo e a auditoria cruza a quantidade
 * com o que está no texto. Separa por vírgula, ponto e vírgula, quebra de linha e " e ".
 */
export function contarMusculos(texto: string): number {
  return texto
    .split(/[,;\n]+|\s+e\s+/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 1).length;
}

/** Por que ainda não dá para gerar (null = pode gerar). O diagnóstico basta: sem músculos, a IA sugere os do diagnóstico. */
export function motivoSemGerar(d: { diagnostico: string; codigos: string[] }): string | null {
  if (codigosParaJustificar(d.codigos).length === 0) return 'Marque o código 301 ou o 131 para gerar a justificativa.';
  if (d.diagnostico.trim().length < 3) return 'Preencha o diagnóstico do cliente.';
  return null;
}
