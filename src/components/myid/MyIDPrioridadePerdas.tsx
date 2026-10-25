import { cn } from '@/lib/utils';
import type { AnalisePerdas } from '@/utils/myid/prioridadePerdas';

const fmt = (n: number, casas = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

function juntaNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

interface OndeProps {
  analise: AnalisePerdas;
  rotulos: Record<string, string>;
  /** Nota que a tela mostra (0-100), para o teto aparecer ao lado dela. */
  scoreExibido: number;
  /** Quantas dimensões entram no resumo e no teto. */
  maiores?: number;
  /** Quantas barras aparecem. */
  linhas?: number;
}

/** Concentração das perdas: quem tirou mais pontos, quanto isso pesa no total e o teto aritmético de ganho. */
export function MyIDOndeEstaoAsPerdas({ analise, rotulos, scoreExibido, maiores = 3, linhas = 5 }: OndeProps) {
  const { itens, totalPerdas, teto } = analise;
  if (itens.length === 0 || totalPerdas <= 0) return null;

  const nome = (chave: string) => rotulos[chave] ?? chave;
  const principais = itens.slice(0, maiores);
  const pctPrincipais = principais[principais.length - 1].pctAcumulado;
  const maior = itens[0];
  const espalhadas = maior.pctDoTotal < 25 && pctPrincipais < 60;
  const maxPerda = maior.perda;

  return (
    <section aria-label="Onde estão as perdas" className="rounded-lg border border-border/40 bg-background/60 px-3 py-3 space-y-2.5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">Onde estão as perdas</p>

      <p className="text-[12.5px] leading-snug text-foreground/90">
        {principais.length === 1 ? 'A maior perda' : `As ${principais.length} maiores perdas`}
        {' — '}<span className="font-semibold">{juntaNomes(principais.map((i) => nome(i.chave)))}</span>{' — '}
        somam <span className="font-semibold tabular-nums">{fmt(principais.reduce((s, i) => s + i.perda, 0))}</span>
        {' '}dos <span className="font-semibold tabular-nums">{fmt(totalPerdas)}</span> pts perdidos
        {' '}(<span className="font-semibold tabular-nums">{fmt(pctPrincipais, 0)}%</span>).
        {espalhadas && (
          <span className="text-muted-foreground">
            {' '}As perdas estão espalhadas: a maior dimensão responde por {fmt(maior.pctDoTotal, 0)}% do total.
          </span>
        )}
      </p>

      <ul className="space-y-2.5">
        {itens.slice(0, linhas).map((i) => (
          <li key={i.chave} className="text-[12px]">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium text-foreground leading-snug">{nome(i.chave)}</span>
              <span className="tabular-nums whitespace-nowrap shrink-0">
                <span className="font-semibold text-foreground">−{fmt(i.perda)}</span>
                <span className="text-muted-foreground"> · {fmt(i.pctDoTotal, 0)}% do total</span>
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-muted/60 overflow-hidden" aria-hidden="true">
              <div
                className={cn('h-full rounded-full', principais.some((p) => p.chave === i.chave) ? 'bg-destructive/70' : 'bg-muted-foreground/40')}
                style={{ width: `${Math.max(4, (i.perda / maxPerda) * 100)}%` }}
              />
            </div>
            <p className="mt-0.5 text-[10.5px] text-muted-foreground tabular-nums">{fmt(i.pctDoMaximo, 0)}% do máximo da dimensão</p>
          </li>
        ))}
      </ul>
      {itens.length > linhas && (
        <p className="text-[11px] text-muted-foreground">
          As outras {itens.length - linhas} dimensões somam {fmt(itens.slice(linhas).reduce((s, i) => s + i.perda, 0))} pts. A lista completa está logo abaixo.
        </p>
      )}

      {teto && (
        <p className="text-[11.5px] leading-snug text-muted-foreground border-t border-border/40 pt-2">
          <span className="font-semibold text-foreground">Teto aritmético:</span>{' '}
          se só {juntaNomes(teto.chaves.map(nome))} chegassem a perda zero, o MyID iria de{' '}
          <span className="font-semibold tabular-nums text-foreground">{fmt(scoreExibido)}</span> para até{' '}
          <span className="font-semibold tabular-nums text-foreground">{fmt(teto.score)}</span>.
          É o máximo que a tabela de perdas permite, não uma meta clínica.
        </p>
      )}
    </section>
  );
}

interface FechamentoProps {
  analise: AnalisePerdas;
  corDaNota?: string;
}

/** A conta inteira: dimensões + sinais de alerta + medicação = total perdido, e 100 − total = nota. */
export function MyIDFechamentoDaConta({ analise, corDaNota }: FechamentoProps) {
  const { itens, sinaisDeAlerta, medicacaoEAjustes, outrosSemDetalhe, totalPerdas, totalDimensoes, scoreFechado, limitadoEmZero, totalGravado } = analise;
  const linha = (rotulo: string, valor: string, destaque = false) => (
    <p className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className={cn('font-mono tabular-nums', destaque && 'font-semibold text-foreground')}>{valor}</span>
    </p>
  );

  return (
    <div className="mt-3 rounded-lg border border-border/40 bg-background/60 px-3 py-2 text-[12.5px] space-y-0.5" aria-label="Fechamento da conta do MyID">
      {linha(`Dimensões (${itens.length})`, `−${fmt(totalDimensoes)} pts`)}
      {sinaisDeAlerta && sinaisDeAlerta.ativos > 0 && linha(
        `Sinais de alerta (${sinaisDeAlerta.ativos} × 3 pts${sinaisDeAlerta.pontos < sinaisDeAlerta.ativos * 3 ? ', teto de 15' : ''})`,
        `−${fmt(sinaisDeAlerta.pontos)} pts`,
      )}
      {medicacaoEAjustes !== null && medicacaoEAjustes !== 0 && linha(
        medicacaoEAjustes > 0 ? 'Medicação e ajustes' : 'Medicação e ajustes (bônus)',
        `${medicacaoEAjustes > 0 ? '−' : '+'}${fmt(Math.abs(medicacaoEAjustes))} pts`,
      )}
      {outrosSemDetalhe !== 0 && linha(
        'Sinais de alerta e medicação',
        `${outrosSemDetalhe > 0 ? '−' : '+'}${fmt(Math.abs(outrosSemDetalhe))} pts`,
      )}
      <div className="border-t border-border/40 pt-1 mt-1 space-y-0.5">
        {linha('Total perdido', `${fmt(totalPerdas)} pts`, true)}
        <p className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">MyID final</span>
          <span className="inline-flex items-center gap-1.5 font-mono font-bold tabular-nums text-foreground">
            {corDaNota && <span aria-hidden="true" className="h-2 w-2 rounded-full shrink-0" style={{ background: corDaNota }} />}
            100 − {fmt(totalPerdas)} = {limitadoEmZero ? '0' : fmt(scoreFechado)}/100
          </span>
        </p>
      </div>
      {limitadoEmZero && (
        <p className="text-[11px] text-muted-foreground pt-0.5">
          As perdas passam de 100: a nota para em 0 e o excedente de {fmt(totalPerdas - 100)} pts não aparece nela.
        </p>
      )}
      {!totalGravado && (
        <p className="text-[11px] text-muted-foreground pt-0.5">
          Este resultado não traz o total gravado: a conta usa as dimensões{sinaisDeAlerta ? ' e os sinais de alerta' : ''}.
        </p>
      )}
    </div>
  );
}
