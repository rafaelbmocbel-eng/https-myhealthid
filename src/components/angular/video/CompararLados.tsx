import { COR_LADO } from '@/lib/angular/analiseVideo/tiposUi';
import type { LinhaLados, ResumoSerie } from '@/lib/angular/analiseVideo/resultados';

const nf = (v: number | null, c = 1) => (v === null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }));

function Barra({ valor, maximo, cor }: { valor: number | null; maximo: number; cor: string }) {
  const pct = valor === null || maximo <= 0 ? 0 : Math.max(2, Math.min(100, (Math.abs(valor) / maximo) * 100));
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor }} />
    </div>
  );
}

function Coluna({ lado, r, maximo }: { lado: 'D' | 'E'; r: ResumoSerie; maximo: number }) {
  return (
    <div className="space-y-1.5" data-testid={`lado-${lado}`}>
      <p className="text-xs font-bold" style={{ color: COR_LADO[lado] }}>{lado === 'D' ? 'Direito' : 'Esquerdo'}</p>
      <p className="text-xl font-semibold tabular-nums" style={{ color: COR_LADO[lado] }}>{nf(r.adm)}°<span className="ml-1 text-[11px] font-normal text-muted-foreground">amplitude</span></p>
      <Barra valor={r.adm} maximo={maximo} cor={COR_LADO[lado]} />
      <p className="text-[11px] tabular-nums text-muted-foreground">máx. {nf(r.max)}° · mín. {nf(r.min)}°</p>
    </div>
  );
}

// Direito × esquerdo: amplitude, pico e mínimo de cada articulação e o índice de assimetria (com a fórmula).
export default function CompararLados({ linhas, formula }: { linhas: LinhaLados[]; formula: string }) {
  if (!linhas.length) return <p className="text-xs text-muted-foreground">Esta análise não tem ângulos dos dois lados para comparar.</p>;
  return (
    <div className="space-y-3">
      {linhas.map((l) => {
        const maximo = Math.max(l.D.adm ?? 0, l.E.adm ?? 0);
        return (
          <section key={l.grupoId} className="space-y-2 rounded-2xl border border-border/60 bg-card p-3" aria-label={`${l.nome}: direito e esquerdo`} data-testid="comparacao-lados">
            <h4 className="text-sm font-semibold">{l.nome}</h4>
            <div className="grid grid-cols-2 gap-3">
              <Coluna lado="D" r={l.D} maximo={maximo} />
              <Coluna lado="E" r={l.E} maximo={maximo} />
            </div>
            <p className="text-xs">
              <span className="text-muted-foreground">Assimetria da amplitude: </span>
              <strong className="tabular-nums">{nf(l.assimetriaAdm)}%</strong>
            </p>
          </section>
        );
      })}
      <details className="rounded-xl border border-border/60 p-2.5 text-[11px] text-muted-foreground">
        <summary className="cursor-pointer py-1 text-xs font-medium text-foreground">Como a assimetria é calculada</summary>
        <p className="leading-snug">{formula}. Usa a amplitude (maior − menor ângulo) de cada lado, medida no vídeo. Sem faixa de referência verificada para esta assimetria, o valor serve para comparar o lado direito com o esquerdo e uma avaliação com a outra.</p>
      </details>
    </div>
  );
}
