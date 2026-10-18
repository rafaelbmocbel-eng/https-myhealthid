import type { TabelaLaudo } from '@/lib/angular/movimento/tipos';

// Tabela do laudo (já em texto) desenhada em cartões: no celular uma tabela larga rolaria para o lado. A primeira coluna vira o título do cartão.
export default function TabelaTexto({ tabela }: { tabela: TabelaLaudo }) {
  const [, ...demais] = tabela.colunas;
  return (
    <div className="space-y-1.5" data-testid="tabela-texto">
      {tabela.titulo && <h5 className="text-xs font-semibold">{tabela.titulo}</h5>}
      <ul className="space-y-2">
        {tabela.linhas.map((linha, i) => (
          <li key={`${i}-${linha[0]}`} className="space-y-1 rounded-xl bg-muted/40 p-2.5">
            <p className="break-words text-xs font-semibold leading-snug">{linha[0]}</p>
            <dl className="space-y-1">
              {demais.map((coluna, j) => (
                <div key={coluna} className="text-[11px] leading-snug">
                  <dt className="inline font-medium text-foreground">{coluna}: </dt>
                  <dd className="inline break-words text-muted-foreground">{linha[j + 1]}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      {tabela.legenda && <p className="text-[11px] leading-snug text-muted-foreground">{tabela.legenda}</p>}
    </div>
  );
}
