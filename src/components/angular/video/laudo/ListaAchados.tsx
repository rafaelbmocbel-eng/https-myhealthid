import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { identificadoresDaFonte, TEXTO_SEM_ACHADOS, TEXTO_SEM_BIBLIOTECA, TEXTO_SEM_REFERENCIA_VERIFICADA, textoDaFonte, textoPopulacao, TITULOS } from '@/lib/angular/movimento/frases';
import type { AchadoLaudo, FonteBiblio, LaudoMovimento } from '@/lib/angular/movimento/tipos';
import Disclosure from './Disclosure';

const selo = 'inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium leading-tight';

const marcas = (numeros: readonly number[]) => numeros.map((n) => `[${n}]`).join(' ');

function numerosCitados(a: AchadoLaudo): number[] {
  const todos = [...a.hipoteses.flatMap((h) => h.referencias), ...a.conferir.flatMap((c) => (c.referencia === undefined ? [] : [c.referencia]))];
  return [...new Set(todos)].sort((x, y) => x - y);
}

function Fonte({ numero, fonte }: { numero: number; fonte: FonteBiblio }) {
  const populacao = textoPopulacao(fonte);
  return (
    <li className="space-y-0.5 text-[11px] leading-snug" data-testid="fonte-do-achado">
      <p><strong>[{numero}]</strong> {textoDaFonte(fonte)}</p>
      {populacao && <p className="text-muted-foreground">{populacao}</p>}
      <p className="text-muted-foreground">Trecho do resumo (em inglês): <q lang="en">{fonte.trecho.trim()}</q></p>
      <p className="flex flex-wrap gap-x-3">
        {identificadoresDaFonte(fonte).map((i) => (i.url
          ? <a key={i.rotulo} href={i.url} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-11 items-center gap-1 underline underline-offset-2">{i.rotulo}<ExternalLink className="h-3 w-3" aria-hidden /></a>
          : <span key={i.rotulo} className="inline-flex min-h-11 items-center">{i.rotulo}</span>))}
      </p>
    </li>
  );
}

function Detalhes({ a, laudo }: { a: AchadoLaudo; laudo: LaudoMovimento }) {
  const citados = numerosCitados(a);
  const fontes = laudo.referencias.filter((r) => citados.includes(r.numero));
  return (
    <div className="space-y-3">
      {a.semBiblioteca ? (
        <p className="text-xs leading-snug text-muted-foreground" data-testid="sem-biblioteca">{TEXTO_SEM_BIBLIOTECA}</p>
      ) : (
        <>
          <div className="space-y-1.5">
            <h5 className="text-xs font-semibold">{TITULOS.fatores}</h5>
            <ul className="space-y-2">
              {a.hipoteses.map((h, i) => (
                <li key={`${i}-${h.texto}`} className="space-y-1 rounded-xl bg-muted/40 p-2.5" data-testid="hipotese">
                  <p className="text-xs leading-snug">{h.texto}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className={selo}>Tipo de estudo: {h.forca}</span>
                    {h.referencias.length > 0
                      ? <span>Fontes: {marcas(h.referencias)}</span>
                      : <span className={cn(selo, 'font-normal')}>{TEXTO_SEM_REFERENCIA_VERIFICADA}</span>}
                  </p>
                  <p className="text-[11px] leading-snug text-muted-foreground">Ressalva: {h.ressalva}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-1.5">
            <h5 className="text-xs font-semibold">{TITULOS.conferir}</h5>
            <ul className="space-y-1.5">
              {a.conferir.map((c, i) => (
                <li key={`${i}-${c.texto}`} className="text-xs leading-snug" data-testid="item-conferir">
                  {c.texto}{' '}
                  {c.referencia !== undefined && !c.semReferenciaVerificada
                    ? <span className="text-[11px] text-muted-foreground">{marcas([c.referencia])}</span>
                    : <span className={cn(selo, 'font-normal')}>{TEXTO_SEM_REFERENCIA_VERIFICADA}</span>}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      {a.limitacoes.length > 0 && (
        <div className="space-y-1">
          <h5 className="text-xs font-semibold">{TITULOS.limitacoesDoAchado}</h5>
          <ul className="space-y-1 text-[11px] leading-snug text-muted-foreground">{a.limitacoes.map((l) => <li key={l}>• {l}</li>)}</ul>
        </div>
      )}
      {fontes.length > 0 && (
        <div className="space-y-1">
          <h5 className="text-xs font-semibold">Fontes citadas</h5>
          <ol className="space-y-2">{fontes.map((r) => <Fonte key={r.numero} numero={r.numero} fonte={r.fonte} />)}</ol>
        </div>
      )}
    </div>
  );
}

function CartaoAchado({ a, laudo }: { a: AchadoLaudo; laudo: LaudoMovimento }) {
  const resumo = a.semBiblioteca
    ? 'Sem hipóteses curadas para este achado'
    : `${a.hipoteses.length} ${a.hipoteses.length === 1 ? 'hipótese' : 'hipóteses'} · ${a.conferir.length} ${a.conferir.length === 1 ? 'item' : 'itens'} a conferir`;
  return (
    <li className="space-y-2 rounded-2xl border border-border/60 bg-card p-3" data-testid="achado" data-chave={a.achado.chave} data-gatilho={a.achado.gatilho}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="min-w-0 text-sm font-semibold leading-snug">{a.titulo}</h4>
        <span className={cn(selo, 'shrink-0')} data-testid="situacao-achado">{a.situacao}</span>
      </div>
      <p className="text-sm leading-snug">{a.descricao}</p>
      <p className="text-xs leading-snug text-muted-foreground">{a.medida}</p>
      <p className="text-xs leading-snug text-muted-foreground">{a.incerteza}</p>
      <p className="text-xs leading-snug text-muted-foreground">{a.repeticoes}</p>
      {a.notaCriterio && <p className="rounded-xl bg-muted/50 p-2 text-[11px] leading-snug" data-testid="nota-criterio-debatido">{a.notaCriterio}</p>}
      <Disclosure titulo="Possíveis fatores contribuintes e o que conferir" resumo={resumo} className="bg-muted/20" testid="detalhes-achado">
        <Detalhes a={a} laudo={laudo} />
      </Disclosure>
    </li>
  );
}

// Achados descritos de forma neutra. As hipóteses vêm da biblioteca curada, com o tipo de estudo e as fontes; sem fonte verificada, o texto diz.
export default function ListaAchados({ laudo }: { laudo: LaudoMovimento }) {
  const total = laudo.achados.length;
  return (
    <section className="space-y-2" aria-labelledby="laudo-achados-titulo" data-testid="achados">
      <h3 id="laudo-achados-titulo" className="text-sm font-semibold">{TITULOS.achados} ({total})</h3>
      {total === 0
        ? <p className="rounded-2xl border border-dashed border-border bg-card p-3 text-xs leading-snug text-muted-foreground" data-testid="sem-achados">{TEXTO_SEM_ACHADOS}</p>
        : <ul className="space-y-2">{laudo.achados.map((a) => <CartaoAchado key={a.achado.id} a={a} laudo={laudo} />)}</ul>}
    </section>
  );
}
