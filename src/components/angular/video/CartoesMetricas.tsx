import { useState } from 'react';
import { ChevronDown, CircleCheck, Info, Minus, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COR_LADO, type CartaoMetricaUi, type ValorMetricaUi } from '@/lib/angular/analiseVideo/tiposUi';
import { cartaoTemAlerta, naturezaDasReferencias, situacaoDoValor, type NaturezaReferencia } from '@/lib/angular/analiseVideo/statusReferencia';

const urlPubMed = (pmid: string) => `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

function Valor({ v, unico, natureza }: { v: ValorMetricaUi; unico: boolean; natureza: NaturezaReferencia }) {
  const situacao = situacaoDoValor(v.status, natureza);
  let Icone = Minus, classe = 'text-muted-foreground';
  if (v.status === 'dentro') { Icone = CircleCheck; classe = 'text-emerald-700 dark:text-emerald-400'; }
  else if (v.status === 'fora' && situacao.alerta) { Icone = TriangleAlert; classe = 'text-amber-700 dark:text-amber-400'; }
  else if (v.status === 'fora') Icone = Info;
  return (
    <div className="min-w-0" data-testid="valor-metrica" data-status={v.status}>
      <p className={cn('font-semibold leading-tight tabular-nums', unico ? 'text-2xl' : 'text-xl')} style={v.lado ? { color: COR_LADO[v.lado] } : undefined}>
        {v.lado && <span className="mr-1 text-xs font-bold opacity-80">{v.lado}</span>}{v.texto}
      </p>
      <p className={cn('mt-0.5 flex items-center gap-1 text-[11px] font-medium', classe)}>
        <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{situacao.texto}</span>
      </p>
      {v.incerteza && <p className="text-[10px] text-muted-foreground">{v.incerteza}</p>}
    </div>
  );
}

const rotuloDaReferencia = (tipo: CartaoMetricaUi['referencias'][number]['tipo']) => (tipo === 'limiar_heuristico' ? 'Limiar' : tipo === 'faixa_de_medias' ? 'Faixa das médias de grupos' : 'Referência');

function Cartao({ c, recolhido }: { c: CartaoMetricaUi; recolhido: boolean }) {
  const natureza = naturezaDasReferencias(c.referencias);
  return (
    <li className={cn('flex-col gap-1.5 rounded-2xl border bg-card p-3', recolhido ? 'hidden min-[420px]:flex' : 'flex', cartaoTemAlerta(c) ? 'border-amber-500/50' : 'border-border/60')} data-testid="cartao-metrica">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{c.titulo}</p>
      <div className={cn('grid gap-2', c.valores.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
        {c.valores.map((v) => <Valor key={v.lado ?? 'unico'} v={v} unico={c.valores.length === 1} natureza={natureza} />)}
      </div>
      {c.detalhe && <p className="text-[11px] leading-snug text-muted-foreground">{c.detalhe}</p>}
      {c.referencias.map((r) => (
        <p key={`ref-${r.faixa}-${r.pmid}`} className="text-[11px] leading-snug text-muted-foreground" data-testid="linha-referencia">
          <span className="font-medium text-foreground">{rotuloDaReferencia(r.tipo)}:</span> {r.faixa} ({r.rotulo ?? r.citacao}{r.pmid ? `, PMID ${r.pmid}` : ''}). {r.nota}
        </p>
      ))}
      {c.referencias.length > 0 && (
        <details className="text-[11px] text-muted-foreground" data-testid="fonte-referencia">
          <summary className="cursor-pointer py-1.5 font-medium text-foreground">Referência e fonte</summary>
          <ul className="space-y-2">
            {c.referencias.map((r) => (
              <li key={`${r.faixa}-${r.pmid}`} className="space-y-0.5 leading-snug">
                <p><strong className="text-foreground">{r.faixa}</strong> — {r.rotulo ?? r.citacao}</p>
                <p>{r.citacao}</p>
                <p>{r.populacao}</p>
                {r.nota && <p className="italic">{r.nota}</p>}
                {r.pmid && <a className="inline-flex min-h-8 items-center underline underline-offset-2" href={urlPubMed(r.pmid)} target="_blank" rel="noreferrer noopener">PubMed {r.pmid}</a>}
              </li>
            ))}
          </ul>
        </details>
      )}
      {c.referencias.length === 0 && c.contexto.length > 0 && (
        <details className="text-[11px] text-muted-foreground" data-testid="contexto-literatura">
          <summary className="cursor-pointer py-1.5 font-medium text-foreground">O que a literatura relata (sem faixa para classificar)</summary>
          <ul className="space-y-2">
            {c.contexto.map((x) => (
              <li key={`${x.pmid}-${x.texto.slice(0, 24)}`} className="space-y-0.5 leading-snug">
                <p>{x.texto}</p>
                <p>{x.citacao}</p>
                {x.pmid && <a className="inline-flex min-h-8 items-center underline underline-offset-2" href={urlPubMed(x.pmid)} target="_blank" rel="noreferrer noopener">PubMed {x.pmid}</a>}
              </li>
            ))}
          </ul>
        </details>
      )}
      {c.formula && (
        <details className="text-[11px] text-muted-foreground">
          <summary className="cursor-pointer py-1.5 font-medium text-foreground">Como é calculado</summary>
          <p className="leading-snug">{c.formula}</p>
        </details>
      )}
      {c.avisos.map((a) => <p key={a} className="text-[11px] leading-snug text-amber-700 dark:text-amber-400">{a}</p>)}
    </li>
  );
}

/** No celular só os primeiros cartões aparecem de início (a lista passa de uma dúzia); em tela larga todos aparecem. */
const CARTOES_INICIAIS_NO_CELULAR = 6;

// Cartões das métricas do gesto: valor (um por lado), se está dentro ou fora da referência (só com fonte verificada) e a fonte.
export default function CartoesMetricas({ cartoes, aviso }: { cartoes: CartaoMetricaUi[]; aviso?: string }) {
  const [todos, setTodos] = useState(false);
  if (!cartoes.length) return <p className="text-xs text-muted-foreground">Sem métricas ainda: faça o rastreio do vídeo.</p>;
  const comReferencia = cartoes.some((c) => c.referencias.length > 0);
  return (
    <div className="space-y-2">
      <ul className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-1">
        {cartoes.map((c, i) => <Cartao key={c.chave} c={c} recolhido={!todos && i >= CARTOES_INICIAIS_NO_CELULAR} />)}
      </ul>
      {!todos && cartoes.length > CARTOES_INICIAIS_NO_CELULAR && (
        <button type="button" onClick={() => setTodos(true)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card text-sm font-semibold min-[420px]:hidden" data-testid="mostrar-todas-metricas">
          Mostrar as outras {cartoes.length - CARTOES_INICIAIS_NO_CELULAR} métricas <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
      )}
      <p className="px-1 text-[11px] leading-snug text-muted-foreground">
        {comReferencia ? 'Referências só aparecem quando há fonte científica verificada (com PMID); as demais métricas ficam “sem referência”. ' : 'Não há valores de referência verificados para estas métricas: o app não inventa limites. Use a comparação entre os lados e entre avaliações. '}
        {aviso}
      </p>
    </div>
  );
}
