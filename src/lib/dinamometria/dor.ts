// Relação dos desequilíbrios com possíveis dores. São associações descritas na
// literatura para orientar o raciocínio clínico, não um diagnóstico.

import { type Analise, type Avaliacao, type Criterios, type Lado, type LSI, type Status, fmt, stLSI, stDesvio } from './analise';
import { type Anel, ARTIC_DA_REGIAO, NOME_ARTIC, PESO, VIZINHAS } from './anatomia';

// Texto e referências (ids de referencias.ts). Sem referência = hipótese clínica.
const RAZAO_DOR: Record<string, { texto: string; refs: string[] }> = {
  joelho: { texto: 'Quadríceps fraco é fator de risco para dor na frente do joelho (patelofemoral). Razão I/Q baixa (posteriores relativamente fracos) foi associada a lesão do LCA, e a força dos posteriores a lesão muscular dos posteriores.', refs: ['neal', 'taketomi', 'green'] },
  quadril: { texto: 'Adutores fracos em relação aos abdutores aumentam o risco de lesão e de dor na virilha e no quadril; abaixo de 80% da força de abdução o risco sobe.', refs: ['tyler', 'whittaker', 'mosler'] },
  quadrilRot: { texto: 'Desequilíbrio entre os rotadores pode alterar o controle do quadril e do joelho no apoio (hipótese clínica; evidência direta com dor ainda limitada).', refs: [] },
  ombro: { texto: 'Rotadores externos fracos e razão RE/RI baixa foram associados a lesão e dor no ombro (manguito rotador).', refs: ['byram', 'kwan'] },
  tornozelo: { texto: 'Déficits de força ao redor do tornozelo aparecem na instabilidade crônica e nas entorses de repetição.', refs: ['khalaj'] },
  cotovelo: { texto: 'Desequilíbrio entre flexores e extensores pode sobrecarregar os tendões do próprio cotovelo (hipótese clínica; evidência direta limitada).', refs: [] },
};

const UNILATERAL_DOR: Record<string, { texto: string; refs: string[] }> = {
  joelho: { texto: 'Após lesão do joelho, simetria do quadríceps abaixo de 90% está associada a mais relesão.', refs: ['grindem', 'kyritsis'] },
  quadril: { texto: 'Fraqueza do quadril aparece em pessoas com dor lombar.', refs: ['desousa', 'pizol'] },
  quadrilRot: { texto: 'Fraqueza do quadril aparece em pessoas com dor lombar.', refs: ['desousa', 'pizol'] },
  tornozelo: { texto: 'Na instabilidade do tornozelo, a fraqueza se estende ao joelho e ao quadril.', refs: ['khalaj'] },
};

export const AVISO_DOR = 'Relações com dor são associações descritas na literatura (referências conferidas no PubMed) ou hipóteses clínicas, indicadas no texto; não são diagnóstico e devem ser confirmadas no exame clínico.';

export interface AchadoDor { regiao: string; tipo: 'unilateral' | 'razao'; st: Status; titulo: string; texto: string; refs: string[]; aneis: Anel[] }

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
        texto: `${viz
          ? `O lado mais forte tende a compensar o mais fraco, o que pode sobrecarregar as articulações vizinhas: ${NOME_ARTIC[viz[0]]} (acima) e ${NOME_ARTIC[viz[1]]} (abaixo).`
          : 'O lado mais forte tende a compensar o mais fraco e pode sobrecarregar as articulações vizinhas.'}${UNILATERAL_DOR[av.regiao] ? ` ${UNILATERAL_DOR[av.regiao].texto}` : ''}`,
        refs: [...(UNILATERAL_DOR[av.regiao]?.refs ?? []), 'parkinson'],
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
        texto: RAZAO_DOR[av.regiao]?.texto || 'Desequilíbrio entre músculos opostos pode gerar dor na própria articulação (hipótese clínica).',
        refs: RAZAO_DOR[av.regiao]?.refs ?? [],
        aneis: art ? [{ art, lado: l, st }] : [],
      });
    }
  }
  return out.sort((a, b) => PESO[b.st?.[0] ?? 'info'] - PESO[a.st?.[0] ?? 'info']);
}
