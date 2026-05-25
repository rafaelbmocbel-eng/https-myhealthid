import { useState } from 'react';
import { useOrigemMetrics, Periodo } from '@/hooks/useOrigemMetrics';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Loader2, TrendingUp, Users, Target } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { EmptyState } from '@/components/ui/empty-state';

const SOURCE_LABELS: Record<string, { label: string; emoji: string }> = {
  instagram: { label: 'Instagram', emoji: '📷' },
  facebook: { label: 'Facebook', emoji: '👍' },
  whatsapp: { label: 'WhatsApp', emoji: '🟢' },
  google: { label: 'Google', emoji: '🔍' },
  youtube: { label: 'YouTube', emoji: '▶️' },
  tiktok: { label: 'TikTok', emoji: '🎵' },
  linkedin: { label: 'LinkedIn', emoji: '💼' },
  direto: { label: 'Direto', emoji: '🔗' },
};

function labelFor(src: string) {
  return SOURCE_LABELS[src] || { label: src, emoji: '🌐' };
}

const PERIODOS: { v: Periodo; l: string }[] = [
  { v: '7', l: '7 dias' },
  { v: '30', l: '30 dias' },
  { v: '90', l: '90 dias' },
];

export default function CrmTrafegoOrigem() {
  const [periodo, setPeriodo] = useState<Periodo>('30');
  const { data, isLoading } = useOrigemMetrics(periodo);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const hasData = (data?.totalLeads ?? 0) > 0;

  return (
    <div className="p-3 sm:p-5 space-y-5">
      {/* Período */}
      <div className="flex gap-1.5">
        {PERIODOS.map((p) => (
          <button
            key={p.v}
            onClick={() => setPeriodo(p.v)}
            className={cn(
              'px-3 py-1 rounded-full text-xs transition-colors',
              periodo === p.v ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted',
            )}
          >
            {p.l}
          </button>
        ))}
      </div>

      {!hasData ? (
        <EmptyState
          illustration="chart"
          title="Ainda sem dados de origem"
          description="Compartilhe seus links públicos (funil, cadastro, eventos) com parâmetros UTM e veja aqui de onde vêm seus leads. Use a aba 'Links UTM' para gerar links rastreáveis."
        />
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Card className="rounded-xl border-border/40 shadow-xs p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-caption">
                <Users className="icon-xs" /> Total de leads
              </div>
              <div className="text-2xl font-semibold mt-1">{data!.totalLeads}</div>
            </Card>
            <Card className="rounded-xl border-border/40 shadow-xs p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-caption">
                <Target className="icon-xs" /> Convertidos
              </div>
              <div className="text-2xl font-semibold mt-1">{data!.totalConvertidos}</div>
            </Card>
            <Card className="rounded-xl border-border/40 shadow-xs p-4 col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 text-muted-foreground text-caption">
                <TrendingUp className="icon-xs" /> Taxa global
              </div>
              <div className="text-2xl font-semibold mt-1">
                {data!.totalLeads ? ((data!.totalConvertidos / data!.totalLeads) * 100).toFixed(1) : '0'}%
              </div>
            </Card>
          </div>

          {/* Canais */}
          <Card className="rounded-xl border-border/40 shadow-xs p-4 sm:p-5">
            <h3 className="h-card mb-3">Leads por canal</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data!.buckets.map((b) => ({ ...b, label: labelFor(b.source).label }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="leads" name="Leads" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="convertidos" name="Convertidos" fill="hsl(var(--primary) / 0.4)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
              {data!.buckets.map((b) => {
                const meta = labelFor(b.source);
                return (
                  <div key={b.source} className="flex items-center justify-between border border-border/40 rounded-lg p-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">{meta.emoji}</span>
                      <span className="text-sm truncate">{meta.label}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-medium">{b.leads}</div>
                      <div className="text-micro text-muted-foreground">{b.taxa.toFixed(0)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Campanhas */}
          {data!.campanhas.length > 0 && (
            <Card className="rounded-xl border-border/40 shadow-xs p-4 sm:p-5">
              <h3 className="h-card mb-3">Campanhas</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground text-caption border-b border-border/40">
                      <th className="py-2 pr-3">Campanha</th>
                      <th className="py-2 pr-3">Canal</th>
                      <th className="py-2 pr-3 text-right">Leads</th>
                      <th className="py-2 pr-3 text-right">Conv.</th>
                      <th className="py-2 text-right">Taxa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.campanhas.map((c, i) => {
                      const meta = labelFor(c.source);
                      return (
                        <tr key={i} className="border-b border-border/20 last:border-0">
                          <td className="py-2 pr-3 truncate max-w-[180px]">{c.campanha}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{meta.emoji} {meta.label}</td>
                          <td className="py-2 pr-3 text-right">{c.leads}</td>
                          <td className="py-2 pr-3 text-right">{c.convertidos}</td>
                          <td className="py-2 text-right">{c.taxa.toFixed(0)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
