import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hojeLocalISO } from '@/lib/dataLocal';
import {
  LIMIAR_DOR_PADRAO_APP, SEMANAS_JANELA_PADRAO, alertasDor, faixaDor, formatarDiaMes, formatarNota,
  inicioDaJanela, resumoJanela, resumoSemanal, rotuloSemana, rotuloSessao, textoRegistro,
  type RegistroTreinoFeito,
} from '@/lib/acompanhamento';

interface Props {
  pacienteId: string;
  semanas?: number;
}

const MAX_ALERTAS = 5;
const MAX_ULTIMOS = 6;

function corDor(dor: number | null): string {
  const faixa = faixaDor(dor);
  if (faixa === 'alta') return 'text-red-600 dark:text-red-400 font-semibold';
  if (faixa === 'atencao') return 'text-amber-600 dark:text-amber-400';
  return 'text-foreground';
}

function Indicador({ rotulo, valor, detalhe, className }: { rotulo: string; valor: string; detalhe?: string; className?: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{rotulo}</p>
      <p className={cn('text-lg font-bold leading-tight', className)}>{valor}</p>
      {detalhe && <p className="text-[10px] text-muted-foreground">{detalhe}</p>}
    </div>
  );
}

// Visão do profissional sobre o treino do plano de IA que o cliente marca como feito
// (plano_ia_treino_feito, leitura liberada pela política pitf_terapeuta_read).
export default function AcompanhamentoPlanoCard({ pacienteId, semanas = SEMANAS_JANELA_PADRAO }: Props) {
  const hoje = hojeLocalISO();
  const inicio = inicioDaJanela(hoje, semanas);

  const { data: registros, isLoading, isError } = useQuery({
    queryKey: ['acompanhamento-plano-ia-treino', pacienteId, inicio],
    enabled: !!pacienteId && !!inicio,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('plano_ia_treino_feito')
        .select('sessao_key, data, rpe, dor, observacao')
        .eq('paciente_id', pacienteId).gte('data', inicio)
        .order('data', { ascending: false });
      if (error) throw error;
      return (data || []) as RegistroTreinoFeito[];
    },
  });

  const resumo = useMemo(() => {
    const lista = registros || [];
    return {
      janela: resumoJanela(lista, hoje, semanas),
      porSemana: resumoSemanal(lista, hoje, semanas),
      alertas: alertasDor(lista),
      ultimos: [...lista].sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0)).slice(0, MAX_ULTIMOS),
    };
  }, [registros, hoje, semanas]);

  const { janela, porSemana, alertas, ultimos } = resumo;
  const totalTreinos = janela?.treinos ?? 0;

  return (
    <Card className="rounded-xl border-border/40 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
          <Activity className="icon-sm text-primary" /> Acompanhamento do treino
          <Badge variant="outline" className="text-[10px] font-normal">últimas {semanas} semanas</Badge>
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Treinos do plano de IA que o cliente marcou como feitos. Esforço e dor são opcionais e informados por ele.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="icon-xs animate-spin" /> Carregando acompanhamento…
          </div>
        )}

        {isError && (
          <p className="text-xs text-destructive">Não foi possível carregar o acompanhamento agora. Tente de novo em instantes.</p>
        )}

        {!isLoading && !isError && totalTreinos === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum treino marcado nas últimas {semanas} semanas.
          </p>
        )}

        {!isLoading && !isError && janela && totalTreinos > 0 && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Indicador rotulo="Treinos feitos" valor={String(janela.treinos)} detalhe={`${janela.comRegistro} com esforço ou dor informados`} />
              <Indicador rotulo="Esforço médio" valor={janela.rpeMedio === null ? '—' : `${formatarNota(janela.rpeMedio)}/10`} detalhe="percebido pelo cliente" />
              <Indicador
                rotulo="Dor média"
                valor={janela.dorMedia === null ? '—' : `${formatarNota(janela.dorMedia)}/10`}
                detalhe={janela.dorMaxima === null ? undefined : `máxima ${formatarNota(janela.dorMaxima)}/10`}
                className={corDor(janela.dorMedia === null ? null : Math.round(janela.dorMedia))}
              />
              <Indicador
                rotulo="Dor acima do limite"
                valor={String(alertas.length)}
                detalhe={`acima de ${LIMIAR_DOR_PADRAO_APP}/10 (padrão do app)`}
                className={alertas.length > 0 ? 'text-red-600 dark:text-red-400' : undefined}
              />
            </div>

            {alertas.length > 0 && (
              <div role="alert" className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 px-3 py-2 space-y-1.5">
                <p className="text-xs font-semibold text-red-800 dark:text-red-300 flex items-center gap-1.5">
                  <AlertTriangle className="icon-xs shrink-0" />
                  {alertas.length === 1
                    ? '1 treino com dor acima do limite de alerta do app'
                    : `${alertas.length} treinos com dor acima do limite de alerta do app`}
                </p>
                <ul className="space-y-1">
                  {alertas.slice(0, MAX_ALERTAS).map((a) => (
                    <li key={`${a.data}-${a.sessao_key}`} className="text-[11px] text-red-900 dark:text-red-200">
                      <span className="font-medium">{formatarDiaMes(a.data)}</span> · {rotuloSessao(a.sessao_key)} · dor {a.dor}/10
                      {a.observacao && <span className="block text-red-800/80 dark:text-red-300/80">“{a.observacao}”</span>}
                    </li>
                  ))}
                </ul>
                {alertas.length > MAX_ALERTAS && (
                  <p className="text-[11px] text-red-800 dark:text-red-300">e mais {alertas.length - MAX_ALERTAS} no período.</p>
                )}
                <p className="text-[11px] text-red-800 dark:text-red-300">Vale conferir com o cliente antes de seguir com o plano.</p>
              </div>
            )}

            <div className="rounded-lg border border-border/40 divide-y divide-border/40">
              {porSemana.map((w, i) => (
                <div key={w.inicio} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">
                      {rotuloSemana(w.inicio)}{i === 0 && <span className="text-muted-foreground font-normal"> · semana atual</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {w.treinos === 0 ? 'Nenhum treino marcado' : `${w.treinos} treino${w.treinos !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  {w.treinos > 0 && (
                    <div className="text-right text-[11px] shrink-0">
                      <p>Esforço <span className="font-medium">{formatarNota(w.rpeMedio)}</span></p>
                      <p>
                        Dor <span className={cn('font-medium', corDor(w.dorMedia === null ? null : Math.round(w.dorMedia)))}>{formatarNota(w.dorMedia)}</span>
                        {w.dorMaxima !== null && <span className="text-muted-foreground"> (máx. {w.dorMaxima})</span>}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {ultimos.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Últimos treinos</p>
                {ultimos.map((r) => {
                  const detalhe = textoRegistro(r);
                  return (
                    <div key={`${r.data}-${r.sessao_key}`} className="text-[11px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">
                          <span className="font-medium">{formatarDiaMes(r.data)}</span> · {rotuloSessao(r.sessao_key)}
                        </span>
                        <span className={cn('shrink-0', faixaDor(r.dor ?? null) === 'alta' ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-muted-foreground')}>
                          {detalhe || 'sem registro'}
                        </span>
                      </div>
                      {r.observacao && <p className="text-muted-foreground">“{r.observacao}”</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {!isLoading && !isError && (
          <p className="text-[10px] text-muted-foreground border-t border-border/40 pt-2">
            Sem registro de dor não significa ausência de dor: o cliente pode ter pulado a pergunta. Este painel é um sinal de
            acompanhamento e não substitui a sua avaliação.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
