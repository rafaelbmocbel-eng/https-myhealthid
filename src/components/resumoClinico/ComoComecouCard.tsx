import { formatarData } from '@/lib/resumoClinico/datas';
import type { ComoComecou, RelatoDoCliente } from '@/lib/resumoClinico/tipos';
import SeloDeOrigem from './SeloDeOrigem';

function Relatos({ nome, itens }: { nome: string; itens: RelatoDoCliente[] }) {
  if (itens.length === 0) return null;
  return (
    <dl aria-label={nome} className="min-w-0 space-y-2">
      {itens.map((relato) => (
        <div key={relato.id} data-fonte={relato.fonte} className="min-w-0 space-y-0.5">
          <dt className="break-words text-xs font-medium text-muted-foreground">{relato.rotulo}</dt>
          <dd className="whitespace-pre-wrap break-words text-sm leading-snug text-foreground">{relato.texto}</dd>
        </div>
      ))}
    </dl>
  );
}

// O que o cliente contou sobre a queixa e o começo do quadro, sempre à vista. Nada aqui é data nem é somado ou comparado:
// se uma resposta diz "mais de 3 anos" e outra "mais de 1 ano", as duas ficam lado a lado. Um selo só, no cabeçalho.
export default function ComoComecouCard({ dados }: { dados: ComoComecou }) {
  const doisGrupos = dados.queixas.length > 0 && dados.inicio.length > 0;
  return (
    <div
      role="group"
      aria-labelledby="como-comecou-titulo"
      aria-describedby="como-comecou-aviso"
      data-bloco="como-comecou"
      className="space-y-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h4 id="como-comecou-titulo" className="text-sm font-semibold text-foreground">Como começou</h4>
        <SeloDeOrigem origem="cliente" />
      </div>
      {/* Quem usa leitor de tela ouve que o bloco inteiro é relato do cliente, e não só o selo visual. */}
      <p id="como-comecou-aviso" className="sr-only">Tudo o que está neste bloco é relato do cliente e não foi revisado pelo profissional.</p>
      {dados.diaDoMyid && <p className="text-xs text-muted-foreground">Respostas do MyID de {formatarData(dados.diaDoMyid)}.</p>}
      <div className={doisGrupos ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-3'}>
        <Relatos nome="Queixa" itens={dados.queixas} />
        <Relatos nome="Começo do quadro" itens={dados.inicio} />
      </div>
    </div>
  );
}
