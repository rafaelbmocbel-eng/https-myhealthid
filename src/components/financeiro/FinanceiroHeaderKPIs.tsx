import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRepasseConfig } from '@/hooks/useRepasseConfig';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { DollarSign, AlertCircle, Percent, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const FALLBACK_PCT = 0.4;

interface AggregatedMonth {
  faturado: number;
  aFaturar: number; // sessões realizadas sem valor
  repasse: number;
  liquido: number;
  sessoes: number;
}

/**
 * Painel-topo do módulo Financeiro: visão imediata do mês.
 * Faturado · A faturar · Repasse devido · Líquido — todos com Δ vs mês anterior.
 * Puramente leitura agregada de controle_sessoes, sem schema novo.
 */
export default function FinanceiroHeaderKPIs() {
  const { user } = useAuth();
  const { getRepasse } = useRepasseConfig();

  const periodos = useMemo(() => {
    const now = new Date();
    const prev = subMonths(now, 1);
    return {
      atualIni: startOfMonth(now).toISOString(),
      atualFim: endOfMonth(now).toISOString(),
      prevIni: startOfMonth(prev).toISOString(),
      prevFim: endOfMonth(prev).toISOString(),
    };
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['financeiro-kpis-topo', user?.id, periodos.atualIni],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('controle_sessoes')
        .select('id, data_sessao, valor_cobrado, convenio_id, agendamentos!agendamento_id(membro_equipe_id)')
        .eq('terapeuta_id', user!.id)
        .eq('status', 'realizada')
        .gte('data_sessao', periodos.prevIni)
        .lte('data_sessao', periodos.atualFim);
      if (error) throw error;
      return data || [];
    },
  });

  const { atual, anterior } = useMemo(() => {
    const repasseOf = (s: any) => {
      const valor = Number(s.valor_cobrado) || 0;
      const membroId = s.agendamentos?.membro_equipe_id;
      if (!membroId) return valor * FALLBACK_PCT;
      const cfg = getRepasse(membroId, s.convenio_id || null);
      if (!cfg) return valor * FALLBACK_PCT;
      if (cfg.valor_fixo != null) return Number(cfg.valor_fixo);
      return valor * (Number(cfg.percentual) / 100);
    };

    const empty = (): AggregatedMonth => ({ faturado: 0, aFaturar: 0, repasse: 0, liquido: 0, sessoes: 0 });
    const atual = empty();
    const anterior = empty();

    (data || []).forEach((s: any) => {
      const d = new Date(s.data_sessao).toISOString();
      const bucket = d >= periodos.atualIni ? atual : anterior;
      const valor = Number(s.valor_cobrado) || 0;
      bucket.sessoes += 1;
      if (valor <= 0) bucket.aFaturar += 1;
      else {
        bucket.faturado += valor;
        bucket.repasse += repasseOf(s);
      }
    });
    atual.liquido = atual.faturado - atual.repasse;
    anterior.liquido = anterior.faturado - anterior.repasse;
    return { atual, anterior };
  }, [data, getRepasse, periodos]);

  const fmt = (v: number) => `R$ ${v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

  const delta = (a: number, b: number) => {
    if (b === 0 && a === 0) return null;
    if (b === 0) return { pct: 100, dir: 'up' as const };
    const diff = ((a - b) / b) * 100;
    return { pct: Math.abs(diff), dir: diff > 0.5 ? 'up' : diff < -0.5 ? 'down' : 'flat' as const };
  };

  const kpis = [
    {
      label: 'Faturado',
      value: fmt(atual.faturado),
      sub: `${atual.sessoes} ${atual.sessoes === 1 ? 'sessão' : 'sessões'}`,
      delta: delta(atual.faturado, anterior.faturado),
      icon: DollarSign,
      tone: 'emerald',
      positiveUp: true,
    },
    {
      label: 'A faturar',
      value: String(atual.aFaturar),
      sub: atual.aFaturar === 1 ? 'sem valor' : 'sessões sem valor',
      delta: null,
      icon: AlertCircle,
      tone: atual.aFaturar > 0 ? 'amber' : 'muted',
      positiveUp: false,
    },
    {
      label: 'Repasse',
      value: fmt(atual.repasse),
      sub: 'a pagar à equipe',
      delta: delta(atual.repasse, anterior.repasse),
      icon: Percent,
      tone: 'blue',
      positiveUp: false, // crescimento de repasse não é necessariamente bom
    },
    {
      label: 'Líquido',
      value: fmt(atual.liquido),
      sub: 'faturado − repasse',
      delta: delta(atual.liquido, anterior.liquido),
      icon: DollarSign,
      tone: 'primary',
      positiveUp: true,
    },
  ];

  const toneClasses: Record<string, string> = {
    emerald: 'border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300',
    amber: 'border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300',
    blue: 'border-blue-500/30 bg-blue-50/60 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300',
    primary: 'border-primary/40 bg-primary/5 text-primary',
    muted: 'border-border/40 bg-muted/30 text-muted-foreground',
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      {kpis.map((k) => {
        const Icon = k.icon;
        const d = k.delta;
        const isGood = d && (k.positiveUp ? d.dir === 'up' : d.dir === 'down');
        const isBad = d && (k.positiveUp ? d.dir === 'down' : d.dir === 'up');
        const DeltaIcon = d?.dir === 'up' ? TrendingUp : d?.dir === 'down' ? TrendingDown : Minus;
        return (
          <div
            key={k.label}
            className={`rounded-xl border p-3 sm:p-4 shadow-xs transition-shadow hover:shadow-sm ${toneClasses[k.tone]}`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase font-semibold tracking-wide opacity-80 flex items-center gap-1">
                <Icon className="icon-xs" />
                {k.label}
              </span>
              {d && d.dir !== 'flat' && (
                <span
                  className={`text-[10px] font-bold flex items-center gap-0.5 ${
                    isGood ? 'text-emerald-600 dark:text-emerald-400' :
                    isBad ? 'text-red-600 dark:text-red-400' : 'opacity-60'
                  }`}
                >
                  <DeltaIcon className="h-3 w-3" />
                  {d.pct.toFixed(0)}%
                </span>
              )}
            </div>
            <p className="text-lg sm:text-xl font-bold leading-tight">
              {isLoading ? '—' : k.value}
            </p>
            <p className="text-[10px] opacity-70 mt-0.5 truncate">{k.sub}</p>
          </div>
        );
      })}
    </div>
  );
}
