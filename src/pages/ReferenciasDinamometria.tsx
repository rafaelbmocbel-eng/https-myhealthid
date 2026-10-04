import { ExternalLink } from 'lucide-react';
import { REFERENCIAS } from '@/lib/dinamometria/referencias';

// Página pública com as referências usadas na dinamometria. O laudo em PDF
// aponta para cá em vez de imprimir uma página inteira de referências.
export default function ReferenciasDinamometria() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">My Health ID · Dinamometria</p>
          <h1 className="text-2xl font-bold">Referências científicas</h1>
          <p className="text-sm text-muted-foreground">
            Base dos critérios, das normas por idade e sexo e da relação com dores usados nos laudos de dinamometria isométrica.
            Todas conferidas no PubMed.
          </p>
        </header>
        <ol className="space-y-3">
          {REFERENCIAS.map((r, i) => (
            <li key={r.id} className="rounded-xl border border-border/60 bg-card p-4 space-y-1.5">
              <p className="text-sm leading-relaxed"><span className="font-semibold mr-1">{i + 1}.</span>{r.completa}</p>
              <p className="text-xs text-muted-foreground">{r.uso}</p>
              <div className="flex flex-wrap gap-3 text-xs">
                <a className="inline-flex items-center gap-1 text-primary underline" href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`} target="_blank" rel="noreferrer">
                  PubMed {r.pmid} <ExternalLink className="h-3 w-3" />
                </a>
                {r.doi && (
                  <a className="inline-flex items-center gap-1 text-primary underline" href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">
                    doi:{r.doi} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
