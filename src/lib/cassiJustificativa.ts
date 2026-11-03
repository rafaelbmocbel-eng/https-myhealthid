import { ehCodigoJustificavel, CODIGOS_JUSTIFICAVEIS, type CodigoJustificavel } from '../../supabase/functions/_shared/cassi-justificativa';

export * from '../../supabase/functions/_shared/cassi-justificativa';

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

/** Por que ainda não dá para gerar (null = pode gerar). */
export function motivoSemGerar(d: { diagnostico: string; musculos: string; codigos: string[] }): string | null {
  const gerar = codigosParaJustificar(d.codigos);
  if (gerar.length === 0) return 'Marque o código 301 ou o 131 para gerar a justificativa.';
  if (d.diagnostico.trim().length < 3) return 'Preencha o diagnóstico do cliente.';
  if (gerar.includes('301') && d.musculos.trim() === '') return 'Informe os músculos tratados para a justificativa do 301.';
  return null;
}
