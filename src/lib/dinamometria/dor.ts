// Relação dos desequilíbrios com possíveis dores. São associações descritas na
// literatura para orientar o raciocínio clínico, não um diagnóstico.

import { type Analise, type Avaliacao, type Criterios, type Lado, type LSI, type Status, fmt, stLSI, stDesvio } from './analise';
import { type Anel, ARTIC_DA_REGIAO, NOME_ARTIC, PESO, VIZINHAS } from './anatomia';

const RAZAO_DOR: Record<string, string> = {
  joelho: 'Desequilíbrio entre quadríceps e posteriores da coxa está associado a dor no próprio joelho (na frente, em volta da patela) e a maior risco de lesão do ligamento cruzado anterior e dos posteriores da coxa.',
  quadril: 'Adutores fracos em relação aos abdutores estão associados a dor na virilha e no próprio quadril (pubalgia, distensão dos adutores).',
  quadrilRot: 'Desequilíbrio entre os rotadores está associado a dor no próprio quadril e a pior controle do joelho no apoio.',
  ombro: 'Rotadores externos fracos em relação aos internos estão associados a dor no próprio ombro (impacto e tendinopatia do manguito rotador).',
  tornozelo: 'Desequilíbrio entre panturrilha e tibial anterior está associado a dor no próprio tornozelo e na perna (canelite, tendão de Aquiles) e a entorses de repetição.',
  cotovelo: 'Desequilíbrio entre flexores e extensores pode sobrecarregar os tendões do próprio cotovelo (epicondilites).',
};

export const AVISO_DOR = 'Relações com dor são associações descritas na literatura para orientar a avaliação; não são diagnóstico e devem ser confirmadas no exame clínico.';

export interface AchadoDor { regiao: string; tipo: 'unilateral' | 'razao'; st: Status; titulo: string; texto: string; aneis: Anel[] }

const ladoNome = (l: Lado) => (l === 'D' ? 'direito' : 'esquerdo');

export function achadosDor(itens: { av: Avaliacao; A: Analise }[], c: Criterios): AchadoDor[] {
  const out: AchadoDor[] = [];
  for (const { av, A } of itens) {
    const R = A.R;
    const viz = VIZINHAS[av.regiao];
    for (const [nome, L] of [[R.ag, A.lsiAg], [R.an, A.lsiAn]] as [string, LSI | null][]) {
      const st = L ? stLSI(L.v, c) : null;
      if (!L || !st || st[0] === 'ok') continue;
      out.push({
        regiao: av.regiao, tipo: 'unilateral', st,
        titulo: `${R.l} · ${nome}: lado ${ladoNome(L.fraco)} ${fmt(100 - L.v, 0)}% mais fraco`,
        texto: viz
          ? `O lado mais forte tende a compensar o mais fraco. Diferenças assim entre os lados podem sobrecarregar as articulações vizinhas: ${NOME_ARTIC[viz[0]]} (acima) e ${NOME_ARTIC[viz[1]]} (abaixo).`
          : 'O lado mais forte tende a compensar o mais fraco e pode sobrecarregar as articulações vizinhas.',
        aneis: viz ? viz.map(art => ({ art, lado: L.fraco, st })) : [],
      });
    }
    for (const l of ['D', 'E'] as Lado[]) {
      const x = A.razoes[l];
      const st = x && x.desvio != null ? stDesvio(x.desvio, c) : null;
      if (!x || !st || st[0] === 'ok') continue;
      const art = ARTIC_DA_REGIAO[av.regiao];
      out.push({
        regiao: av.regiao, tipo: 'razao', st,
        titulo: `${R.l} · ${R.razaoL} ${ladoNome(l)}: ${fmt(x.r * 100, 0)}% (referência ${x.refTxt})`,
        texto: RAZAO_DOR[av.regiao] || 'Desequilíbrio entre músculos opostos pode gerar dor na própria articulação.',
        aneis: art ? [{ art, lado: l, st }] : [],
      });
    }
  }
  return out.sort((a, b) => PESO[b.st?.[0] ?? 'info'] - PESO[a.st?.[0] ?? 'info']);
}
