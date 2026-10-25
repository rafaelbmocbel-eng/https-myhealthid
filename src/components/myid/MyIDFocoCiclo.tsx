import { Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ComparacaoFoco } from '@/utils/myid/focoCiclo';

const fmt = (n: number, casas = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

function juntaNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

interface Props {
  /** Dimensões do ciclo aberto; null = nenhum foco escolhido. */
  dimensoes: string[] | null;
  comparacao: ComparacaoFoco | null;
  rotulos: Record<string, string>;
  /** Data em que o ciclo começou (já formatada) e a nota do MyID-base, se houver. */
  inicio: string | null;
  /** O MyID de início do ciclo não está mais disponível (apagado ou de outro formato). */
  baseAusente: boolean;
  /** Já existe um MyID mais novo que o de início do ciclo. */
  retesteDisponivel: boolean;
  ocupado?: boolean;
  /** Ainda lendo o ciclo do banco, ou a leitura falhou: não mostra "sem foco" como se soubéssemos. */
  carregando?: boolean;
  erroAoCarregar?: boolean;
  onEncerrar: () => void;
  onReiniciar: () => void;
}

/** Foco do ciclo: 1 a 3 dimensões que o profissional trabalha e quanto cada uma variou no reteste. */
export function MyIDFocoCiclo({ dimensoes, comparacao, rotulos, inicio, baseAusente, retesteDisponivel, ocupado, carregando, erroAoCarregar, onEncerrar, onReiniciar }: Props) {
  const nome = (chave: string) => rotulos[chave] ?? chave;

  const acoes = (reiniciar: boolean) => (
    <div className="flex flex-wrap gap-2 pt-1">
      {reiniciar && (
        <Button type="button" size="sm" variant="outline" disabled={ocupado} onClick={onReiniciar}>
          Reiniciar a partir deste MyID
        </Button>
      )}
      <Button type="button" size="sm" variant="ghost" disabled={ocupado} onClick={onEncerrar}>
        Encerrar ciclo
      </Button>
    </div>
  );

  return (
    <section aria-label="Foco do ciclo" className="rounded-lg border border-border/40 bg-background/60 px-3 py-3 space-y-2">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
        <Target className="h-3 w-3" aria-hidden="true" />
        Foco do ciclo
      </p>

      {erroAoCarregar ? (
        <p role="status" className="text-[12px] text-muted-foreground">Não foi possível carregar o foco do ciclo. Recarregue a aba.</p>
      ) : carregando ? (
        <p role="status" className="text-[12px] text-muted-foreground">Carregando o foco do ciclo…</p>
      ) : !dimensoes || dimensoes.length === 0 ? (
        <p className="text-[12.5px] leading-snug text-muted-foreground">
          Escolha de 1 a 3 dimensões para trabalhar neste ciclo, com o botão <Target className="inline h-3 w-3 align-[-1px]" aria-hidden="true" /> ao lado
          de cada item da lista abaixo. No próximo MyID, o app mostra aqui quanto cada uma variou em pontos.
        </p>
      ) : (
        <>
          <p className="text-[12.5px] leading-snug text-foreground/90">
            Foco: <span className="font-semibold">{juntaNomes(dimensoes.map(nome))}</span>
            {inicio && <span className="text-muted-foreground"> · ciclo iniciado em {inicio}</span>}
          </p>

          {baseAusente ? (
            <>
              <p className="text-[12px] text-muted-foreground">
                O MyID de início deste ciclo não está mais disponível. Reinicie a partir do MyID atual para voltar a comparar.
              </p>
              {acoes(true)}
            </>
          ) : !retesteDisponivel ? (
            <>
              <p className="text-[12px] text-muted-foreground">No próximo MyID, a variação em pontos de cada uma aparece aqui.</p>
              {acoes(false)}
            </>
          ) : !comparacao ? (
            <>
              <p className="text-[12px] text-muted-foreground">
                Não foi possível comparar: um dos dois MyID não traz as perdas por dimensão.
              </p>
              {acoes(true)}
            </>
          ) : (
            <>
              <ul className="space-y-1.5">
                {comparacao.linhas.map((l) => (
                  <li key={l.chave} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                    <span className="font-medium text-foreground">
                      {nome(l.chave)}
                      {l.gravidadeAntes !== null && l.gravidadeAgora !== null && (
                        <span className="block text-[10.5px] font-normal text-muted-foreground tabular-nums">
                          gravidade {fmt(l.gravidadeAntes)} → {fmt(l.gravidadeAgora)} (0 a 10)
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums whitespace-nowrap text-right">
                      <span className="text-muted-foreground">{fmt(l.antes)} → {fmt(l.agora)} pts perdidos · </span>
                      <span
                        className={cn(
                          'font-semibold',
                          l.sentido === 'melhorou' && 'text-emerald-700 dark:text-emerald-400',
                          l.sentido === 'piorou' && 'text-destructive',
                          l.sentido === 'igual' && 'text-muted-foreground',
                        )}
                      >
                        {l.sentido === 'igual' ? 'igual' : `${l.sentido === 'melhorou' ? 'melhorou' : 'piorou'} ${fmt(Math.abs(l.variacao))} pts`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              {comparacao.linhas.some((l) => l.chave === 'D') && (
                <p className="text-[11px] text-muted-foreground">
                  Na Dor, a perda inclui um ajuste pelo tempo de dor que o paciente informou; a gravidade (0 a 10) não tem esse ajuste.
                </p>
              )}
              {comparacao.regraDeRCDiferente && comparacao.semDado.some((c) => c === 'R' || c === 'C') && (
                <p className="text-[11px] text-muted-foreground">
                  Sono e energia e Vida pessoal não entram na comparação: um dos dois MyID foi calculado com a regra anterior a 06/10/2026.
                </p>
              )}
              {comparacao.semDado.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Sem dado para comparar: {juntaNomes(comparacao.semDado.map(nome))}.
                </p>
              )}
              {comparacao.scoreAntes !== null && comparacao.scoreAgora !== null && (
                <p className="text-[12px] text-muted-foreground tabular-nums border-t border-border/40 pt-1.5">
                  MyID: {fmt(comparacao.scoreAntes)} → <span className="font-semibold text-foreground">{fmt(comparacao.scoreAgora)}</span>
                </p>
              )}
              {comparacao.pioraramForaDoFoco.length > 0 && (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[11.5px] leading-snug text-amber-800 dark:text-amber-300">
                  Fora do foco, perdeu mais pontos:{' '}
                  {comparacao.pioraramForaDoFoco.map((d) => `${nome(d.chave)} (+${fmt(d.variacao)} pts)`).join(', ')}.
                </p>
              )}
              {acoes(true)}
            </>
          )}
        </>
      )}
    </section>
  );
}

interface BotaoProps {
  rotulo: string;
  ativo: boolean;
  desabilitado?: boolean;
  onAlternar: () => void;
}

/** Botão de alvo ao lado de cada item da lista: marca ou desmarca a dimensão como foco do ciclo. */
export function BotaoFocoDoCiclo({ rotulo, ativo, desabilitado, onAlternar }: BotaoProps) {
  return (
    <button
      type="button"
      onClick={onAlternar}
      disabled={desabilitado}
      aria-pressed={ativo}
      aria-label={ativo ? `Tirar ${rotulo} do foco do ciclo` : `Marcar ${rotulo} como foco do ciclo`}
      title={ativo ? 'Tirar do foco do ciclo' : 'Marcar como foco do ciclo'}
      className={cn(
        'shrink-0 h-6 w-6 inline-flex items-center justify-center rounded-md border text-muted-foreground transition',
        'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        ativo && 'border-primary bg-primary/10 text-primary',
      )}
    >
      <Target className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}
