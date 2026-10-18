import type { ForcaEvidencia, Lado, PlanoCamera, SituacaoCriterio } from './tipos';

/*
 * Rótulos e vocabulário da Etapa 3 num lugar só: tela, laudo e PDF dizem as mesmas palavras. O produto descreve e mede;
 * não classifica o corpo da pessoa nem dá nota. Veredito só com critério do profissional ou limite de fonte confirmada.
 */

export const ROTULO_SITUACAO: Record<SituacaoCriterio, string> = {
  dentro_do_criterio: 'dentro do critério',
  no_limite: 'no limite',
  fora_do_criterio: 'fora do critério',
  sem_referencia: 'sem referência',
};

export const ROTULO_FORCA: Record<ForcaEvidencia, string> = {
  revisao_sistematica: 'revisão sistemática',
  meta_analise: 'meta-análise',
  observacional: 'estudo observacional',
  experimental: 'estudo experimental',
  a_confirmar: 'a confirmar',
};

export const ROTULO_LADO: Record<Lado, string> = { D: 'direito', E: 'esquerdo' };

export const ROTULO_PLANO: Record<PlanoCamera, string> = { lateral: 'vista lateral', frontal: 'vista frontal' };

/**
 * Palavras que julgam o corpo ou o desempenho e não podem aparecer em texto gerado ou fixo desta etapa. "normalidade" (palavra
 * inteira diferente) não é barrada: aparece ao dizer que uma referência NÃO é faixa de normalidade.
 */
export const VOCABULARIO_PROIBIDO = /\b(certo|errado|normal|anormal|perfeit[oa]s?|falhas?|bom|ruim)\b/i;

/** A palavra proibida encontrada no texto, ou null. Serve aos testes de quem gera texto (protocolos, laudo, biblioteca). */
export function termoProibido(texto: string): string | null {
  const m = VOCABULARIO_PROIBIDO.exec(texto);
  return m ? m[0] : null;
}
