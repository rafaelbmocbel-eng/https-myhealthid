import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, TrendingUp, TrendingDown, Clock, Target, DollarSign, Radio } from "lucide-react";
import { useOrigemMetrics } from "@/hooks/useOrigemMetrics";

type Stage = "novo" | "qualificado" | "agendado" | "fechado" | "perdido";
const STAGE_LABELS: Record<Stage, string> = {
  novo: "Novo", qualificado: "Qualificado", agendado: "Agendado", fechado: "Fechado", perdido: "Perdido",
};

export default function CrmMetricas({ embedded = false }: { embedded?: boolean } = {}) {
  const { data: origem } = useOrigemMetrics("30");
  const [periodo, setPeriodo] = useState<"7" | "30" | "90">("30");
  const [stats, setStats] = useState<{
    porEstagio: Record<string, number>;
    conversao: { novoQualif: number; qualifAg: number; agFech: number; total: number };
    motivos: { motivo: string; count: number }[];
    tempoMedio: number;
    totalLeads: number;
    totalFechados: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const dataInicio = new Date(Date.now() - parseInt(periodo) * 86400000).toISOString();

      const { data: convs } = await supabase
        .from("whatsapp_conversas")
        .select("pipeline_stage, pipeline_motivo_perda, pipeline_updated_at, created_at")
        .eq("terapeuta_id", user.id)
        .gte("created_at", dataInicio);

      const c = convs || [];
      const porEstagio: Record<string, number> = { novo: 0, qualificado: 0, agendado: 0, fechado: 0, perdido: 0 };
      const motivosMap: Record<string, number> = {};
      let tempoTotal = 0, tempoCount = 0;

      c.forEach(x => {
        const st = (x.pipeline_stage || "novo") as string;
        porEstagio[st] = (porEstagio[st] || 0) + 1;
        if (st === "perdido" && x.pipeline_motivo_perda) {
          motivosMap[x.pipeline_motivo_perda] = (motivosMap[x.pipeline_motivo_perda] || 0) + 1;
        }
        if (st === "fechado" && x.pipeline_updated_at && x.created_at) {
          const t = new Date(x.pipeline_updated_at).getTime() - new Date(x.created_at).getTime();
          tempoTotal += t; tempoCount++;
        }
      });

      const totalLeads = c.length;
      const totalQualif = porEstagio.qualificado + porEstagio.agendado + porEstagio.fechado;
      const totalAg = porEstagio.agendado + porEstagio.fechado;
      const totalFechados = porEstagio.fechado;

      setStats({
        porEstagio,
        conversao: {
          novoQualif: totalLeads ? (totalQualif / totalLeads) * 100 : 0,
          qualifAg: totalQualif ? (totalAg / totalQualif) * 100 : 0,
          agFech: totalAg ? (totalFechados / totalAg) * 100 : 0,
          total: totalLeads ? (totalFechados / totalLeads) * 100 : 0,
        },
        motivos: Object.entries(motivosMap).map(([motivo, count]) => ({ motivo, count })).sort((a, b) => b.count - a.count),
        tempoMedio: tempoCount ? tempoTotal / tempoCount / 86400000 : 0,
        totalLeads, totalFechados,
      });
      setLoading(false);
    })();
  }, [periodo]);

  return (
    <div className={embedded ? 'p-3 sm:p-5' : 'min-h-screen bg-background p-3 sm:p-6 max-w-6xl mx-auto'}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {!embedded && <Link to="/crm?tab=pipeline"><Button variant="ghost" size="icon"><ArrowLeft className="icon-md" /></Button></Link>}
          <div>
            <h1 className="h-page flex items-center gap-2"><TrendingUp className="icon-md text-primary" /> Métricas CRM</h1>
            <p className="text-caption text-muted-foreground">Performance do funil de vendas</p>
          </div>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(["7", "30", "90"] as const).map(p => (
            <Button key={p} size="sm" variant={periodo === p ? "default" : "ghost"} onClick={() => setPeriodo(p)}>
              {p}d
            </Button>
          ))}
        </div>
      </div>

      {loading || !stats ? <div className="text-center py-12 text-muted-foreground">Carregando…</div> : (
        <div className="space-y-6">
          {/* KPIs principais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4">
              <div className="text-caption text-muted-foreground flex items-center gap-1"><Target className="icon-xs" /> Total de leads</div>
              <div className="text-2xl font-bold mt-1">{stats.totalLeads}</div>
            </Card>
            <Card className="p-4">
              <div className="text-caption text-muted-foreground flex items-center gap-1"><DollarSign className="icon-xs" /> Fechados</div>
              <div className="text-2xl font-bold mt-1 text-emerald-600">{stats.totalFechados}</div>
            </Card>
            <Card className="p-4">
              <div className="text-caption text-muted-foreground flex items-center gap-1"><TrendingUp className="icon-xs" /> Conversão total</div>
              <div className="text-2xl font-bold mt-1">{stats.conversao.total.toFixed(1)}%</div>
            </Card>
            <Card className="p-4">
              <div className="text-caption text-muted-foreground flex items-center gap-1"><Clock className="icon-xs" /> Ciclo médio</div>
              <div className="text-2xl font-bold mt-1">{stats.tempoMedio.toFixed(1)}d</div>
            </Card>
          </div>

          {/* Funil */}
          <Card className="p-4 sm:p-6">
            <h2 className="h-section mb-4">Funil de conversão</h2>
            <div className="space-y-3">
              {(["novo", "qualificado", "agendado", "fechado"] as Stage[]).map((st, i, arr) => {
                const count = stats.porEstagio[st];
                const max = Math.max(...arr.map(s => stats.porEstagio[s]), 1);
                const pct = (count / max) * 100;
                return (
                  <div key={st}>
                    <div className="flex justify-between text-caption mb-1">
                      <span className="font-medium">{STAGE_LABELS[st]}</span>
                      <span className="text-muted-foreground">{count} leads</span>
                    </div>
                    <div className="h-8 bg-muted rounded-md overflow-hidden">
                      <div className="h-full bg-primary/80 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-3 mt-6 pt-4 border-t">
              <div className="text-center">
                <div className="text-caption text-muted-foreground">Novo → Qualificado</div>
                <div className="text-lg font-bold">{stats.conversao.novoQualif.toFixed(0)}%</div>
              </div>
              <div className="text-center">
                <div className="text-caption text-muted-foreground">Qualif → Agendado</div>
                <div className="text-lg font-bold">{stats.conversao.qualifAg.toFixed(0)}%</div>
              </div>
              <div className="text-center">
                <div className="text-caption text-muted-foreground">Agendado → Fechado</div>
                <div className="text-lg font-bold">{stats.conversao.agFech.toFixed(0)}%</div>
              </div>
            </div>
          </Card>

          {/* Motivos de perda */}
          <Card className="p-4 sm:p-6">
            <h2 className="h-section mb-4 flex items-center gap-2"><TrendingDown className="icon-sm text-destructive" /> Motivos de perda ({stats.porEstagio.perdido})</h2>
            {stats.motivos.length === 0 ? (
              <p className="text-caption text-muted-foreground">Nenhum motivo registrado no período.</p>
            ) : (
              <div className="space-y-2">
                {stats.motivos.map(m => (
                  <div key={m.motivo} className="flex justify-between items-center p-2 rounded-md bg-muted/40">
                    <span className="text-sm">{m.motivo}</span>
                    <Badge variant="secondary">{m.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
