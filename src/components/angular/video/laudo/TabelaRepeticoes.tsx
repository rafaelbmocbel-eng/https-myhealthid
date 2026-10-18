import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { finito } from '@/lib/angular/movimento/estatistica';
import {
  capitalizar, comPontoFinal, fraseRepeticoesCompletas, INTRO_MEDIDAS, legendaDaMedida, numeroComCasas, ROTULO_SINALIZADOR, rotuloDaRepeticao, TEXTO_MEDIDA_SEM_VALOR,
  TEXTO_NENHUMA_REPETICAO, valorComUnidade,
} from '@/lib/angular/movimento/frases';
import { faseDo } from '@/lib/angular/movimento/protocolos';
import type { AnaliseMovimento, ChaveLado, MedidaPorRepeticao, Protocolo } from '@/lib/angular/movimento/tipos';
import { ROTULO_LADO } from '@/lib/angular/movimento/vocabulario';
import Disclosure from './Disclosure';

interface Props {
  analise: AnaliseMovimento;
  protocolo: Protocolo;
}

const LADOS: ChaveLado[] = ['D', 'E'];
const lados = (m: MedidaPorRepeticao): ChaveLado[] => (m.def.porLado ? LADOS : ['unico']);

function cabecalhoDoLado(l: ChaveLado, marcha: boolean): string {
  if (l === 'unico') return 'Valor';
  return capitalizar(marcha ? `pé ${ROTULO_LADO[l]}` : ROTULO_LADO[l]);
}

/** Valores citados num achado de repetição discrepante ou de primeira/última repetição: "medida:lado:posição". */
function destaquesDosAchados(analise: AnaliseMovimento): Set<string> {
  const s = new Set<string>();
  for (const a of analise.achados) {
    if (a.gatilho !== 'repeticao_discrepante' && a.gatilho !== 'tendencia_primeira_ultima') continue;
    for (const pos of a.repeticoes) s.add(`${a.medida}:${a.lado ?? 'unico'}:${pos}`);
  }
  return s;
}

function resumoDaMedida(analise: AnaliseMovimento, m: MedidaPorRepeticao): string {
  const partes = lados(m).map((l) => {
    const r = analise.resumos[m.def.id]?.[l];
    const media = valorComUnidade(r?.media ?? null, m.def.unidade);
    return l === 'unico' ? `média ${media}` : `${l} ${media}`;
  });
  const n = lados(m).map((l) => analise.resumos[m.def.id]?.[l]?.n ?? 0);
  const textoN = n.length > 1 ? `n ${n.join(' e ')}` : `n ${n[0]}`;
  return `${m.def.porLado ? 'Médias ' : ''}${partes.join(' · ')} · ${textoN}`;
}

// O CSS global do app põe `table { display: block }` no celular, o que encolhe as colunas: a classe `table` das tabelas daqui restaura o layout.
function BlocoMedida({ analise, protocolo, m, destaques, aberto }: { analise: AnaliseMovimento; protocolo: Protocolo; m: MedidaPorRepeticao; destaques: Set<string>; aberto: boolean }) {
  const def = m.def;
  const marcha = protocolo.gesto === 'marcha';
  const ls = lados(m);
  const fase = faseDo(protocolo, def.fase);
  const celula = (v: number | null | undefined) => (finito(v) ? numeroComCasas(v, def.unidade) : TEXTO_MEDIDA_SEM_VALOR);
  const rodape: { rotulo: string; valor: (l: ChaveLado) => string }[] = [
    { rotulo: 'Média', valor: (l) => celula(analise.resumos[def.id]?.[l]?.media) },
    { rotulo: 'Desvio-padrão', valor: (l) => celula(analise.resumos[def.id]?.[l]?.dp) },
    { rotulo: 'n', valor: (l) => String(analise.resumos[def.id]?.[l]?.n ?? 0) },
    { rotulo: 'Incerteza de um valor', valor: (l) => (finito(m.incerteza[l]) ? `± ${numeroComCasas(m.incerteza[l], def.unidade)}` : TEXTO_MEDIDA_SEM_VALOR) },
  ];
  return (
    <Disclosure titulo={`${def.nome} (${def.unidade})`} resumo={resumoDaMedida(analise, m)} iniciaAberto={aberto} testid={`medida-${def.id}`}>
      <div className="overflow-hidden rounded-xl border border-border/60">
        <table className="table w-full table-fixed text-xs tabular-nums">
          <caption className="sr-only">{def.nome} ({def.unidade}) por {protocolo.rotuloRepeticao.singular}{def.porLado ? ' e por lado' : ''}</caption>
          <thead className="bg-muted/60">
            <tr>
              <th scope="col" className="w-[46%] px-2 py-2 text-left font-semibold">{capitalizar(protocolo.rotuloRepeticao.singular)}</th>
              {ls.map((l) => <th key={l} scope="col" className="px-2 py-2 text-right font-semibold">{cabecalhoDoLado(l, marcha)}</th>)}
            </tr>
          </thead>
          <tbody>
            {analise.repeticoes.map((r, i) => (
              <tr key={r.numero} className="border-t border-border/60" data-testid="linha-repeticao">
                <th scope="row" className={cn('break-words px-2 py-2 text-left font-medium', r.sinalizadores.length > 0 && 'italic text-muted-foreground')}>
                  {rotuloDaRepeticao(r.numero, r.lado && marcha ? ROTULO_LADO[r.lado] : null, r.sinalizadores)}
                </th>
                {ls.map((l) => {
                  const destacado = destaques.has(`${def.id}:${l}:${i}`);
                  return (
                    <td key={l} data-destaque={destacado ? 'true' : undefined}
                      className={cn('px-2 py-2 text-right', destacado && 'bg-muted font-bold underline decoration-dotted underline-offset-4 ring-1 ring-inset ring-foreground/30')}>
                      {celula(m.valores[l]?.[i])}
                      {destacado && <span className="sr-only"> (citado em um achado)</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-border/80 bg-muted/30">
            {rodape.map((linha) => (
              <tr key={linha.rotulo} className="border-t border-border/40">
                <th scope="row" className="break-words px-2 py-1.5 text-left font-medium text-muted-foreground">{linha.rotulo}</th>
                {ls.map((l) => <td key={l} className="px-2 py-1.5 text-right">{linha.valor(l)}</td>)}
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
      {m.avisos.length > 0 && <ul className="space-y-1 text-[11px] leading-snug text-muted-foreground">{m.avisos.map((a) => <li key={a}>• {comPontoFinal(a)}</li>)}</ul>}
      <p className="text-[11px] leading-snug text-muted-foreground">
        <strong className="text-foreground">Como é calculada.</strong> {legendaDaMedida(fase ? `${fase.nome} (${fase.descricao.replace(/\.$/, '')})` : def.fase, def.extracao, def.formula, [])}
      </p>
    </Disclosure>
  );
}

function RepeticoesIdentificadas({ analise, protocolo }: Props) {
  const rot = protocolo.rotuloRepeticao;
  const marcha = protocolo.gesto === 'marcha';
  const completas = analise.repeticoes.filter((r) => !r.sinalizadores.includes('incompleta')).length;
  return (
    <Disclosure titulo={`${capitalizar(rot.plural)} identificadas`} resumo={`${fraseRepeticoesCompletas(rot.singular, rot.plural, completas, analise.repeticoes.length)} · tempos no vídeo`} testid="repeticoes-identificadas">
      <div className="overflow-hidden rounded-xl border border-border/60">
        <table className="table w-full table-fixed text-xs tabular-nums">
          <caption className="sr-only">{capitalizar(rot.plural)} identificadas e seus marcos de tempo no vídeo</caption>
          <thead className="bg-muted/60">
            <tr>
              <th scope="col" className="w-[22%] px-1.5 py-2 text-left font-semibold">{capitalizar(rot.singular)}</th>
              <th scope="col" className="px-1.5 py-2 text-right font-semibold">Início</th>
              <th scope="col" className="px-1.5 py-2 text-right font-semibold">{marcha ? 'Saída do pé' : 'Ponto mais baixo'}</th>
              <th scope="col" className="px-1.5 py-2 text-right font-semibold">Fim</th>
              <th scope="col" className="px-1.5 py-2 text-right font-semibold">Duração</th>
            </tr>
          </thead>
          <tbody>
            {analise.repeticoes.map((r) => (
              <tr key={r.numero} className="border-t border-border/60">
                <th scope="row" className="px-1.5 py-2 text-left font-medium">{r.numero}{r.lado && marcha ? ` · ${r.lado}` : ''}</th>
                <td className="px-1.5 py-2 text-right">{numeroComCasas(r.inicioT, 's')}</td>
                <td className="px-1.5 py-2 text-right">{numeroComCasas(r.fundoT, 's')}</td>
                <td className="px-1.5 py-2 text-right">{numeroComCasas(r.fimT, 's')}</td>
                <td className="px-1.5 py-2 text-right">{numeroComCasas(r.duracao, 's')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {analise.repeticoes.some((r) => r.sinalizadores.length > 0) && (
        <ul className="space-y-0.5 text-[11px] leading-snug text-muted-foreground">
          {analise.repeticoes.filter((r) => r.sinalizadores.length > 0).map((r) => (
            <li key={r.numero}>• {capitalizar(rot.singular)} {r.numero}: {r.sinalizadores.map((s) => ROTULO_SINALIZADOR[s]).join('; ')}.</li>
          ))}
        </ul>
      )}
      <p className="text-[11px] leading-snug text-muted-foreground"><strong className="text-foreground">Como são identificadas.</strong> {comPontoFinal(protocolo.segmentacao)} Tempos em segundos, no vídeo. Confira os marcos de cada {rot.singular} antes de ler as medidas.</p>
    </Disclosure>
  );
}

// Medidas por repetição e por lado. O realce é neutro (fundo cinza e negrito): marca o valor citado num achado, sem cor de aprovação nem de alerta.
export default function TabelaRepeticoes({ analise, protocolo }: Props) {
  const destaques = useMemo(() => destaquesDosAchados(analise), [analise]);
  const comAchado = useMemo(() => new Set(analise.achados.map((a) => a.medida)), [analise]);
  return (
    <section className="space-y-2" aria-labelledby="laudo-medidas-titulo" data-testid="medidas-por-repeticao">
      <h3 id="laudo-medidas-titulo" className="text-sm font-semibold">Medidas por {protocolo.rotuloRepeticao.singular} e por lado</h3>
      <p className="text-xs leading-snug text-muted-foreground">{INTRO_MEDIDAS}</p>
      {analise.repeticoes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card p-3 text-xs leading-snug text-muted-foreground" data-testid="sem-repeticoes">{TEXTO_NENHUMA_REPETICAO}</p>
      ) : (
        <>
          <RepeticoesIdentificadas analise={analise} protocolo={protocolo} />
          {analise.medidas.map((m) => (
            <BlocoMedida key={m.def.id} analise={analise} protocolo={protocolo} m={m} destaques={destaques} aberto={comAchado.has(m.def.id)} />
          ))}
          <p className="text-[11px] leading-snug text-muted-foreground">Fundo cinza e negrito: valor citado num achado de {protocolo.rotuloRepeticao.singular} discrepante ou de primeira e última {protocolo.rotuloRepeticao.singular}. O realce marca o que conferir; não indica aprovação nem alerta.</p>
        </>
      )}
    </section>
  );
}
