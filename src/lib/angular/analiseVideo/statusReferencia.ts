import type { CartaoMetricaUi, ReferenciaUi, StatusReferencia } from './tiposUi';

/*
 * O que "dentro" e "fora" querem dizer depende do tipo da faixa. Só uma faixa de normalidade autoriza tratar "fora" como alerta;
 * a faixa entre médias de grupos (menor a maior média por sexo e década) e o limiar prático de intensidade não são intervalos
 * individuais: estar fora deles é comum em quem está saudável.
 */
export type NaturezaReferencia = 'normalidade' | 'faixa_de_medias' | 'limiar_heuristico';

/** Natureza das referências de um cartão: qualquer faixa sem tipo é de normalidade; senão vale a faixa de médias, depois o limiar. */
export function naturezaDasReferencias(refs: readonly Pick<ReferenciaUi, 'tipo'>[]): NaturezaReferencia {
  if (!refs.length || refs.some((r) => !r.tipo)) return 'normalidade';
  return refs.some((r) => r.tipo === 'faixa_de_medias') ? 'faixa_de_medias' : 'limiar_heuristico';
}

export interface SituacaoDoValor {
  texto: string;
  /** Só um "fora" de faixa de normalidade chama atenção (triângulo âmbar); os outros ficam em tom neutro. */
  alerta: boolean;
}

export function situacaoDoValor(status: StatusReferencia, natureza: NaturezaReferencia): SituacaoDoValor {
  if (status === 'sem_referencia') return { texto: 'sem referência', alerta: false };
  const dentro = status === 'dentro';
  if (natureza === 'faixa_de_medias') return { texto: dentro ? 'dentro da faixa das médias de grupos' : 'fora da faixa das médias de grupos', alerta: false };
  if (natureza === 'limiar_heuristico') return { texto: dentro ? 'dentro do limiar' : 'fora do limiar', alerta: false };
  return { texto: dentro ? 'dentro da referência' : 'fora da referência', alerta: !dentro };
}

/** Algum valor do cartão está fora de uma faixa de normalidade (o único caso que merece alerta)? */
export const cartaoTemAlerta = (c: Pick<CartaoMetricaUi, 'valores' | 'referencias'>): boolean => {
  const natureza = naturezaDasReferencias(c.referencias);
  return c.valores.some((v) => situacaoDoValor(v.status, natureza).alerta);
};

/**
 * A referência que o cartão do vídeo mostra (cabe uma só): a primeira cuja faixa contém algum valor, que é a que explica o "dentro";
 * se nenhum valor está dentro de faixa nenhuma, qualquer uma explica o "fora", e vale a primeira.
 */
export function referenciaPrincipal(c: Pick<CartaoMetricaUi, 'valores' | 'referencias'>): ReferenciaUi | null {
  if (!c.referencias.length) return null;
  const dentro = new Set(c.valores.flatMap((v) => v.dentroDe ?? []));
  return c.referencias.find((r) => r.chave !== undefined && dentro.has(r.chave)) ?? c.referencias[0];
}
