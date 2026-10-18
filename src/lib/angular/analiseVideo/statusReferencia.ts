import type { CartaoMetricaUi, ReferenciaUi, StatusReferencia, ValorMetricaUi } from './tiposUi';

/*
 * O que "dentro" e "fora" querem dizer depende do tipo da faixa. Só uma faixa de normalidade autoriza tratar "fora" como alerta;
 * a faixa entre médias de grupos (menor a maior média por sexo e década) e o limiar prático de intensidade não são intervalos
 * individuais: estar fora deles é comum em quem está saudável. Nesses dois tipos os dois lados dizem a mesma coisa, em texto neutro
 * e com o mesmo peso (sem ícone de aprovação, sem alerta), sempre com o rótulo da fonte.
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

/** Faixa de médias e limiar só informam: dentro e fora têm o mesmo tom e o mesmo ícone (nem aprovação verde, nem alerta âmbar). */
export const situacaoEhNeutra = (natureza: NaturezaReferencia): boolean => natureza !== 'normalidade';

export type FonteDaSituacao = Pick<ReferenciaUi, 'rotulo' | 'citacao' | 'limiteMin' | 'limiteMax'>;

const rotuloDaFonte = (f: FonteDaSituacao): string => f.rotulo ?? f.citacao;

/**
 * Texto da situação do valor. `fontes` são as referências que explicam o resultado (veja `referenciasDoValor`): o rótulo delas fecha
 * o texto e, no limiar, o valor do limite entra por extenso ("acima do limiar de 100 passos/min"). Limiar nunca é dito "dentro/fora".
 */
export function situacaoDoValor(status: StatusReferencia, natureza: NaturezaReferencia, fontes: readonly FonteDaSituacao[] = []): SituacaoDoValor {
  if (status === 'sem_referencia') return { texto: 'sem referência', alerta: false };
  const dentro = status === 'dentro';
  const comFonte = (texto: string, usadas: readonly FonteDaSituacao[]) => {
    const rotulos = [...new Set(usadas.map(rotuloDaFonte))];
    return rotulos.length ? `${texto} (${rotulos.join('; ')})` : texto;
  };
  if (natureza === 'faixa_de_medias') return { texto: comFonte(`${dentro ? 'dentro' : 'fora'} da faixa das médias do estudo`, fontes), alerta: false };
  if (natureza === 'limiar_heuristico') {
    const f = fontes[0];
    // O limiar só tem um lado: com mínimo, "dentro" é estar acima dele; com máximo, é estar abaixo.
    const soMaximo = !!f && f.limiteMax !== undefined && f.limiteMin === undefined;
    const acima = soMaximo ? !dentro : dentro;
    const limite = f ? (soMaximo ? f.limiteMax : f.limiteMin) : undefined;
    return { texto: comFonte(`${acima ? 'acima' : 'abaixo'} do limiar${limite ? ` de ${limite}` : ''}`, f ? [f] : []), alerta: false };
  }
  return { texto: dentro ? 'dentro da referência' : 'fora da referência', alerta: !dentro };
}

/**
 * Referências que explicam a situação de um valor: se está dentro, as faixas que o contêm; se está fora, todas as do mesmo tipo
 * (fora de todas). Assim o rótulo da fonte nunca aponta uma faixa que o valor não satisfaz ao lado de um "dentro".
 */
export function referenciasDoValor(c: Pick<CartaoMetricaUi, 'referencias'>, v: Pick<ValorMetricaUi, 'status' | 'dentroDe'>): ReferenciaUi[] {
  const natureza = naturezaDasReferencias(c.referencias);
  const doTipo = natureza === 'normalidade' ? c.referencias : c.referencias.filter((r) => r.tipo === natureza);
  const lista = doTipo.length ? doTipo : c.referencias;
  if (v.status === 'dentro' && v.dentroDe?.length) {
    const contem = lista.filter((r) => r.chave !== undefined && v.dentroDe!.includes(r.chave));
    if (contem.length) return contem;
  }
  return [...lista];
}

export function situacaoDoCartaoValor(c: Pick<CartaoMetricaUi, 'referencias'>, v: Pick<ValorMetricaUi, 'status' | 'dentroDe'>): SituacaoDoValor {
  return situacaoDoValor(v.status, naturezaDasReferencias(c.referencias), referenciasDoValor(c, v));
}

/** Situação do cartão numa frase: uma só quando todos os valores dizem o mesmo; senão, uma por lado ("D … · E …"). */
export function situacaoDoCartaoTexto(c: Pick<CartaoMetricaUi, 'valores' | 'referencias'>): string {
  const textos = c.valores.map((v) => situacaoDoCartaoValor(c, v).texto);
  if (new Set(textos).size <= 1) return textos[0] ?? 'sem referência';
  // Lados que só diferem na primeira palavra ("dentro"/"fora", "acima"/"abaixo") dividem o resto: "D dentro · E fora da faixa … (fonte)".
  const partes = textos.map((t) => [t.slice(0, Math.max(0, t.indexOf(' '))), t.slice(t.indexOf(' ') + 1)] as const);
  if (c.valores.every((v) => v.lado) && partes.every((p) => p[0] && p[1] === partes[0][1])) {
    return `${c.valores.map((v, k) => `${v.lado} ${partes[k][0]}`).join(' · ')} ${partes[0][1]}`;
  }
  return c.valores.map((v, k) => (v.lado ? `${v.lado} ${textos[k]}` : textos[k])).join(' · ');
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
