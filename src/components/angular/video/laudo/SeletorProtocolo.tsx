import { Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { achadosAvaliaveis, indisponiveisDoProtocolo } from '@/lib/angular/movimento/protocolos';
import type { PlanoCamera, Protocolo } from '@/lib/angular/movimento/tipos';
import { ROTULO_PLANO } from '@/lib/angular/movimento/vocabulario';

interface Props {
  protocolos: Protocolo[];
  protocoloId: string | null;
  /** Vista que o profissional declarou ao escolher o gesto. */
  vistaDeclarada: PlanoCamera;
  aoEscolher: (id: Protocolo['id']) => void;
}

const iniciais = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Escolha do protocolo (padrão: o da vista declarada) e o aviso do plano de câmera. A medida 2D só vale no plano filmado: o que exige
// o outro plano não é calculado, e a tela diz quais achados ficam de fora e como obtê-los.
export default function SeletorProtocolo({ protocolos, protocoloId, vistaDeclarada, aoEscolher }: Props) {
  const escolhido = protocolos.find((p) => p.id === protocoloId) ?? null;
  const indisponiveis = escolhido ? indisponiveisDoProtocolo(escolhido) : [];
  const diverge = !!escolhido && escolhido.planoFilmado !== vistaDeclarada;

  return (
    <section className="space-y-2" aria-labelledby="laudo-protocolo-titulo" data-testid="seletor-protocolo">
      <h3 id="laudo-protocolo-titulo" className="text-sm font-semibold">Protocolo do laudo</h3>
      <div role="radiogroup" aria-labelledby="laudo-protocolo-titulo" className="grid gap-2">
        {protocolos.map((p) => {
          const marcado = p.id === protocoloId;
          return (
            <label key={p.id} className={cn('relative flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border bg-card px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-ring', marcado ? 'border-primary bg-primary/5' : 'border-border/60 hover:bg-muted/50')}>
              <input type="radio" name="protocolo-do-laudo" value={p.id} checked={marcado} onChange={() => aoEscolher(p.id)} className="h-5 w-5 shrink-0 accent-primary" data-testid={`protocolo-${p.id}`} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold leading-snug">{p.nome}</span>
                <span className="block text-xs leading-snug text-muted-foreground">
                  {iniciais(ROTULO_PLANO[p.planoFilmado])} · {p.medidas.length} medidas · {achadosAvaliaveis(p).length} achados avaliáveis
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {escolhido && (
        <p className="text-xs leading-snug text-muted-foreground" data-testid="plano-do-protocolo">
          Plano de câmera deste protocolo: <strong className="text-foreground">{ROTULO_PLANO[escolhido.planoFilmado]}</strong>. Plano declarado ao escolher o gesto: <strong className="text-foreground">{ROTULO_PLANO[vistaDeclarada]}</strong>. A medida em duas dimensões só vale no plano em que o vídeo foi gravado.
        </p>
      )}

      {diverge && escolhido && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-500/60 bg-amber-500/10 p-3 text-xs leading-snug" role="alert" data-testid="aviso-plano-diferente">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong>Confira o plano de câmera.</strong> O gesto foi preparado em {ROTULO_PLANO[vistaDeclarada]}, mas este protocolo mede em {ROTULO_PLANO[escolhido.planoFilmado]}. Se o vídeo foi gravado em {ROTULO_PLANO[vistaDeclarada]}, escolha o protocolo de {ROTULO_PLANO[vistaDeclarada]}: a medida em duas dimensões de um protocolo não vale no outro plano. Se foi gravado em {ROTULO_PLANO[escolhido.planoFilmado]}, siga com este protocolo; nesse caso {indisponiveis.length === 1 ? '1 achado que exige' : `${indisponiveis.length} achados que exigem`} a {ROTULO_PLANO[vistaDeclarada]} {indisponiveis.length === 1 ? 'fica indisponível' : 'ficam indisponíveis'}.
          </span>
        </div>
      )}

      {escolhido && indisponiveis.length > 0 && (
        <div className="flex items-start gap-2 rounded-2xl bg-muted/50 p-3 text-xs leading-snug" data-testid="aviso-indisponiveis">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            Com o vídeo em {ROTULO_PLANO[escolhido.planoFilmado]}, {indisponiveis.length === 1 ? '1 achado fica indisponível' : `${indisponiveis.length} achados ficam indisponíveis`}: eles exigem a {ROTULO_PLANO[indisponiveis[0].planoExigido]}. A lista está mais abaixo, com o que gravar para obtê-los.
          </span>
        </div>
      )}
    </section>
  );
}
