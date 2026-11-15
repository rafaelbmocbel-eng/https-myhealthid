import type { ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { REFS_COMPASSO, type Medida, type RefCompasso } from '@/lib/angular/medidas';
import type { AcoesDaSessao, ItemPosicao } from '@/hooks/useSessaoPostural';
import type { VistaSessao } from '@/lib/angular/tiposSessao';
import { COR_REFERENCIA } from './iconesMedida';
import { GRUPOS } from './gruposDeMedida';

const nf = (n: number, d = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const SETA_REF: Record<RefCompasso, typeof ArrowDown> = { baixo: ArrowDown, cima: ArrowUp, esquerda: ArrowLeft, direita: ArrowRight };

/**
 * Cartão ao lado da foto: a lista de todas as medidas da posição (com o andamento de cada uma) e o que a ferramenta ativa pede
 * (nível, escala, compasso com referência, definição). O que só existe em certas telas (fio de prumo, origem da sugestão) entra em `children`.
 */
export function CartaoDasMedidas({ posicao, item, acoes, disponiveis, medidaAtiva, giro, giroMarcado, giroSensor, cmPorPx, compassoRef, children }: {
  posicao: VistaSessao;
  item: ItemPosicao;
  acoes: AcoesDaSessao;
  disponiveis: Medida[];
  medidaAtiva: Medida;
  giro: number | null;
  giroMarcado: number | null;
  giroSensor: number | null;
  cmPorPx: number | null;
  compassoRef: RefCompasso;
  children?: ReactNode;
}) {
  const pontos = item.pontos;
  const semEscala = medidaAtiva.id === 'regua' && !cmPorPx;
  return (
    <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-3">
      <details className="group rounded-xl border border-border/60 p-2.5">
        <summary className="cursor-pointer text-sm font-semibold">Todas as medidas</summary>
        <div className="mt-2 space-y-3">
          {GRUPOS.map((g) => {
            const itens = disponiveis.filter((m) => m.grupo === g.id);
            if (!itens.length) return null;
            return (
              <div key={g.id} className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.titulo}</p>
                {itens.map((m) => {
                  const n = pontos[m.id]?.length ?? 0;
                  const feita = n >= m.pontos.length;
                  const estadoDaMedida = m.id === 'nivel' && giro !== null ? `${nf(Math.abs(giro))}°`
                    : m.id === 'escala' && cmPorPx ? 'calibrada'
                      : feita ? 'feita' : `${n}/${m.pontos.length}`;
                  return (
                    <button key={m.id} type="button" onClick={() => acoes.ativar(posicao, m.id)} aria-pressed={m.id === medidaAtiva.id}
                      className={cn('flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                        m.id === medidaAtiva.id ? 'border-primary bg-primary/5' : 'border-border/60 hover:bg-muted/50')}>
                      <span className="flex items-center gap-2">
                        {COR_REFERENCIA[m.id] && <span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_REFERENCIA[m.id] }} aria-hidden />}
                        {m.nome}
                      </span>
                      <span className={cn('text-[11px] tabular-nums', feita ? 'font-semibold text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground')}>{estadoDaMedida}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </details>
      <p className="px-0.5 text-xs text-muted-foreground"><strong className="text-foreground">Ferramenta ativa:</strong> {medidaAtiva.nome}</p>
      {medidaAtiva.id === 'nivel' && (
        <div className="space-y-2 rounded-xl bg-muted/40 p-2.5 text-xs">
          {giroMarcado === null && giroSensor !== null ? (
            <>
              <p className="font-medium">{Math.abs(giroSensor) < 0.05 ? 'Foto já está nivelada.' : `Corrigido automaticamente pelo sensor do celular: foto girada ${nf(Math.abs(giroSensor))}°.`}</p>
              <p className="text-muted-foreground">Ligue a grade e confira se as linhas acompanham o chão. Se estiverem tortas para o lado errado, inverta. Para usar outra referência, marque 2 pontos sobre algo reto (chão, rodapé ou fio de prumo).</p>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => acoes.editar(posicao, { inverterSensor: !item.inverterSensor })}>Inverter o sentido</Button>
                <Button size="sm" variant="ghost" onClick={() => acoes.editar(posicao, { inclinacaoCaptura: null })}>Sem correção</Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-muted-foreground">Marque 2 pontos sobre algo que na vida real é reto: o rodapé ou o chão (horizontal), um fio de prumo ou batente de porta (vertical). O app mede o giro da foto e corrige todos os ângulos. Fotos tiradas pelo botão “Tirar a foto no app” já saem corrigidas.</p>
              <div className="grid grid-cols-2 gap-1">
                {(['horizontal', 'vertical'] as const).map((t) => (
                  <button key={t} type="button" aria-pressed={item.nivelTipo === t} onClick={() => acoes.editar(posicao, { nivelTipo: t })}
                    className={cn('rounded-lg border px-2 py-1.5 font-medium capitalize', item.nivelTipo === t ? 'border-primary bg-primary/10' : 'border-border/60')}>{t}</button>
                ))}
              </div>
              {giro !== null && <p className="font-medium">{Math.abs(giro) < 0.05 ? 'Foto já está nivelada.' : `Foto girada ${nf(Math.abs(giro))}°: todos os ângulos já saem corrigidos.`}</p>}
            </>
          )}
        </div>
      )}
      {medidaAtiva.id === 'escala' && (
        <div className="space-y-2 rounded-xl bg-muted/40 p-2.5 text-xs">
          <p className="text-muted-foreground">Marque as pontas de um objeto de tamanho conhecido, no mesmo plano do paciente (fita métrica, régua, marcador no chão), e informe o comprimento.</p>
          <div className="flex items-center gap-2">
            <Input inputMode="decimal" value={item.escalaCm} onChange={(e) => acoes.editar(posicao, { escalaCm: e.target.value })} placeholder="Comprimento" className="h-9 text-[16px] sm:text-sm" aria-label="Comprimento do objeto em centímetros" />
            <span className="shrink-0 font-medium">cm</span>
          </div>
          {cmPorPx && <p className="font-medium">Escala pronta: a régua já mede em centímetros.</p>}
        </div>
      )}
      {semEscala && <p className="rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">Para medir em centímetros, primeiro calibre a escala (em “Referências da foto”).</p>}
      {medidaAtiva.id === 'cobb' && <p className="rounded-xl bg-muted/40 p-2.5 text-xs text-muted-foreground">Marque as duas retas (por exemplo, as linhas das vértebras limite da curva). O app dá o ângulo entre elas. Em foto, é uma estimativa; o Cobb de referência vem da radiografia.</p>}
      {medidaAtiva.definicao && medidaAtiva.desenho !== 'prumo' && medidaAtiva.id !== 'compasso-ref' && (
        <p className="rounded-xl bg-muted/40 p-2.5 text-xs text-muted-foreground" data-testid="definicao-medida"><strong className="text-foreground">Como é medido.</strong> {medidaAtiva.definicao}</p>
      )}
      {medidaAtiva.id === 'compasso-ref' && (
        <div className="space-y-2 rounded-xl bg-muted/40 p-2.5 text-xs" data-testid="cartao-compasso-ref">
          <p className="text-muted-foreground">{medidaAtiva.definicao}</p>
          <p className="font-medium">Medir contra</p>
          <div className="grid grid-cols-2 gap-1.5">
            {REFS_COMPASSO.map((r) => {
              const Seta = SETA_REF[r.id];
              return (
                <button key={r.id} type="button" aria-pressed={compassoRef === r.id} onClick={() => acoes.definirOpcoes({ compassoRef: r.id })}
                  className={cn('flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 py-1.5 text-center font-medium leading-tight', compassoRef === r.id ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/50')}>
                  <Seta className="h-4 w-4 shrink-0" aria-hidden /> {r.nome}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
