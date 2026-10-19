import { useMemo } from 'react';
import { Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  faixasEmTexto, segundosEmTexto, TEXTO_COMO_CORRIGIR, TEXTO_INTRO_PONTOS_A_CONFERIR, TEXTO_SEM_PONTOS_PERDIDOS, TEXTO_VARIOS_QUADROS, TITULO_PONTOS_A_CONFERIR,
} from '@/lib/angular/movimento/frasesPontosPerdidos';
import { capitalizar } from '@/lib/angular/movimento/frases';
import { agruparItensACorrigir, type ItemACorrigir } from '@/lib/angular/movimento/pontosPerdidos';
import type { ChaveLado, PontosPerdidos, Protocolo } from '@/lib/angular/movimento/tipos';
import { ROTULO_LADO } from '@/lib/angular/movimento/vocabulario';
import Disclosure from './Disclosure';

/** Para onde o profissional vai ao tocar em "Ir ao quadro": o quadro da trilha e o ponto que ele vai arrastar. */
export interface AlvoDeCorrecao {
  /** Índice (0-based) do quadro na trilha. */
  quadro: number;
  /** Nome do ponto na trilha (por exemplo, joelho_e). */
  ponto: string;
}

interface Props {
  pontosPerdidos: PontosPerdidos;
  protocolo: Protocolo;
  /** Leva o player ao quadro e destaca o ponto. Sem ele a lista só informa. */
  aoIrAoQuadro?: (alvo: AlvoDeCorrecao) => void;
}

const botao = 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]';

const ladoNaFrase = (l: ChaveLado, marcha: boolean): string => (l === 'unico' ? '' : ` (${marcha ? 'pé' : 'lado'} ${ROTULO_LADO[l]})`);

function CartaoDoPonto({ item, marcha, aoIr }: { item: ItemACorrigir; marcha: boolean; aoIr?: (alvo: AlvoDeCorrecao) => void }) {
  const quadros = item.quadrosSemPonto === 1 ? 'quadro' : 'quadros';
  const medidas = item.medidas.map((m) => `${m.nome}${ladoNaFrase(m.lado, marcha)}`);
  const ir = (quadro: number) => () => aoIr?.({ quadro, ponto: item.ponto });
  return (
    <li className="space-y-2 rounded-2xl border border-amber-500/50 bg-amber-500/5 p-3" data-testid="ponto-a-conferir" data-ponto={item.ponto} data-quadro={item.quadro}>
      <p className="text-sm font-semibold leading-snug">{item.rotulo}</p>
      <p className="text-xs leading-snug">
        Sem ponto confiável em {item.quadrosSemPonto} {quadros} (quadros {faixasEmTexto(item.faixas)}), perto de {segundosEmTexto(item.tempoS)}.
      </p>
      <p className="text-xs leading-snug text-muted-foreground" data-testid="medidas-sem-valor">
        Medidas sem valor: {medidas.join('; ')}.
      </p>
      {aoIr && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={ir(item.quadro)} data-testid="ir-ao-quadro" className={cn(botao, 'border-primary bg-primary text-primary-foreground hover:bg-primary/92')}>
            <Crosshair className="h-4 w-4" aria-hidden /> Ir ao quadro {item.quadro + 1}
          </button>
          {item.primeiroQuadro !== item.quadro && (
            <button type="button" onClick={ir(item.primeiroQuadro)} data-testid="ir-ao-primeiro-sem-ponto" className={cn(botao, 'border-border/60 bg-card hover:bg-muted/50')}>
              Primeiro quadro sem ponto ({item.primeiroQuadro + 1})
            </button>
          )}
          {item.ultimoQuadro !== item.quadro && item.ultimoQuadro !== item.primeiroQuadro && (
            <button type="button" onClick={ir(item.ultimoQuadro)} data-testid="ir-ao-ultimo-sem-ponto" className={cn(botao, 'border-border/60 bg-card hover:bg-muted/50')}>
              Último quadro sem ponto ({item.ultimoQuadro + 1})
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Onde faltou ponto do corpo e a medida ficou sem valor, para o profissional corrigir à mão com os quadros-chave. Agrupado por repetição;
 * cada item leva o player ao quadro do extremo, com o ponto destacado. Ao corrigir, a análise é refeita e o item some. Nada é preenchido sozinho.
 */
export default function PontosAConferir({ pontosPerdidos, protocolo, aoIrAoQuadro }: Props) {
  const itens = useMemo(() => agruparItensACorrigir(pontosPerdidos), [pontosPerdidos]);
  if (!itens.length) {
    return <p className="px-1 text-[11px] leading-snug text-muted-foreground" role="status" data-testid="sem-pontos-perdidos">{TEXTO_SEM_PONTOS_PERDIDOS}</p>;
  }
  const marcha = protocolo.gesto === 'marcha';
  const numeros = [...new Set(itens.map((i) => i.numero))];
  return (
    <section className="space-y-2" aria-labelledby="laudo-pontos-titulo" data-testid="pontos-a-conferir">
      <h3 id="laudo-pontos-titulo" className="text-sm font-semibold">{TITULO_PONTOS_A_CONFERIR} ({itens.length})</h3>
      <p className="text-xs leading-snug text-muted-foreground">{TEXTO_INTRO_PONTOS_A_CONFERIR}</p>
      {aoIrAoQuadro && (
        <>
          <p className="text-xs leading-snug">{TEXTO_COMO_CORRIGIR}</p>
          <Disclosure titulo="O ponto falta em vários quadros?" testid="varios-quadros">
            <p className="text-xs leading-snug">{TEXTO_VARIOS_QUADROS}</p>
          </Disclosure>
        </>
      )}
      {numeros.map((numero) => (
        <div key={numero} className="space-y-2" role="group" aria-label={`${capitalizar(protocolo.rotuloRepeticao.singular)} ${numero}`} data-testid={`pontos-repeticao-${numero}`}>
          <h4 className="text-xs font-semibold">{capitalizar(protocolo.rotuloRepeticao.singular)} {numero}</h4>
          <ul className="space-y-2">
            {itens.filter((i) => i.numero === numero).map((i) => <CartaoDoPonto key={i.chave} item={i} marcha={marcha} aoIr={aoIrAoQuadro} />)}
          </ul>
        </div>
      ))}
    </section>
  );
}
