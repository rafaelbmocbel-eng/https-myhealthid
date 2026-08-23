import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { useAdminMetrics, atualizarPlano } from '@/hooks/useAdminMetrics';
import {
  Loader2, RefreshCw, TrendingUp, Building2, Users, GraduationCap, AlertTriangle, CreditCard, DollarSign,
} from 'lucide-react';

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtInt = (n: number) => n.toLocaleString('pt-BR');

// Cores de série (harmônicas com o tema; a acentuação usa a --primary).
const CORES = ['hsl(190 85% 45%)', 'hsl(213 70% 45%)', 'hsl(160 60% 42%)', 'hsl(35 90% 55%)', 'hsl(280 55% 58%)', 'hsl(0 70% 60%)'];

function Kpi({ icon: Icon, label, valor, sub, tom = 'default' }: {
  icon: any; label: string; valor: string; sub?: string; tom?: 'default' | 'good' | 'warn';
}) {
  const cor = tom === 'good' ? 'text-emerald-600' : tom === 'warn' ? 'text-amber-600' : 'text-primary';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
          <Icon className={`h-4 w-4 ${cor}`} /> {label}
        </div>
        <div className="text-2xl font-black tabular-nums">{valor}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="h-[260px] pt-0">{children}</CardContent>
    </Card>
  );
}

const tooltipStyle = {
  contentStyle: { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 },
  labelStyle: { color: 'hsl(var(--foreground))' },
};

export default function Admin() {
  const isSuper = useIsSuperAdmin();
  const { data, isLoading, error, refetch, isFetching } = useAdminMetrics();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [precos, setPrecos] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<string | null>(null);

  if (!isSuper) return <Navigate to="/hoje" replace />;

  const salvarPlano = async (id: string, ativoAtual: boolean, novoAtivo?: boolean) => {
    setSalvando(id);
    try {
      const patch: any = { id };
      if (precos[id] != null && precos[id] !== '') patch.preco_mensal = Number(precos[id].replace(',', '.'));
      if (novoAtivo != null) patch.ativo = novoAtivo;
      await atualizarPlano(patch);
      await qc.invalidateQueries({ queryKey: ['admin-metrics'] });
      setPrecos((p) => { const n = { ...p }; delete n[id]; return n; });
      toast({ title: 'Plano atualizado' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' });
    } finally {
      setSalvando(null);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-24 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando painel…</div>;
  }
  if (error || !data) {
    return (
      <div className="max-w-md mx-auto py-24 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground mb-4">Não foi possível carregar o painel administrativo.</p>
        <Button onClick={() => refetch()} variant="outline"><RefreshCw className="h-4 w-4 mr-2" /> Tentar de novo</Button>
      </div>
    );
  }

  const r = data.resumo;
  const especialidadeData = data.profissionais.por_especialidade.map((e) => ({ nome: e.especialidade, total: e.total }));
  const planoData = data.assinaturas_profissionais.por_plano.map((p) => ({ nome: p.nome, mrr: p.mrr, ativas: p.ativas }));
  const formaData = data.vendas.por_forma_pagamento.map((f) => ({ nome: f.forma, valor: f.valor }));

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2"><TrendingUp className="h-6 w-6 text-primary" /> Painel Administrativo</h1>
          <p className="text-sm text-muted-foreground">Vendas, uso e assinaturas do app · atualizado {new Date(data.gerado_em).toLocaleString('pt-BR')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={DollarSign} label="MRR total" valor={fmtBRL(r.mrr_total)} sub={`Pro ${fmtBRL(r.mrr_profissionais)} · Alunos ${fmtBRL(r.mrr_alunos)}`} tom="good" />
        <Kpi icon={Building2} label="Clínicas ativas" valor={fmtInt(r.clinicas_ativas)} sub={`${fmtInt(r.clinicas_total)} no total`} />
        <Kpi icon={Users} label="Profissionais ativos" valor={fmtInt(r.profissionais_ativos)} sub={`${fmtInt(r.profissionais_total)} cadastrados`} />
        <Kpi icon={GraduationCap} label="Alunos ativos" valor={fmtInt(r.alunos_ativos)} sub={`${fmtInt(r.alunos_total)} no total`} />
        <Kpi icon={AlertTriangle} label="Inadimplentes" valor={fmtInt(r.inadimplentes)} sub="assinaturas de alunos" tom={r.inadimplentes > 0 ? 'warn' : 'default'} />
        <Kpi icon={CreditCard} label="Vendas (12m)" valor={fmtBRL(r.receita_vendas_12m)} sub="registradas por profissionais" />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Novas assinaturas por mês">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.evolucao_mensal} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} tickFormatter={(m) => m.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="profissionais" name="Profissionais" stroke={CORES[1]} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="alunos" name="Alunos" stroke={CORES[0]} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Profissionais por especialidade">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={especialidadeData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="nome" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="total" name="Profissionais" radius={[4, 4, 0, 0]}>
                {especialidadeData.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="MRR por plano (profissionais)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={planoData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="nome" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
              <Tooltip {...tooltipStyle} formatter={(v: any, n: any) => n === 'mrr' ? fmtBRL(Number(v)) : v} />
              <Bar dataKey="mrr" name="MRR" radius={[4, 4, 0, 0]}>
                {planoData.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Vendas por forma de pagamento (12m)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formaData} layout="vertical" margin={{ top: 8, right: 12, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
              <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={80} />
              <Tooltip {...tooltipStyle} formatter={(v: any) => fmtBRL(Number(v))} />
              <Bar dataKey="valor" name="Valor" radius={[0, 4, 4, 0]}>
                {formaData.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Planos (gerenciar preço/ativo) */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Planos e preços</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Plano</th>
                  <th className="py-2 pr-3">Preço mensal (R$)</th>
                  <th className="py-2 pr-3">Ativas</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.planos.map((p) => {
                  const ativas = data.assinaturas_profissionais.por_plano.find((x) => x.nome === p.nome)?.ativas ?? 0;
                  return (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-medium">{p.nome}</td>
                      <td className="py-2 pr-3">
                        <Input
                          className="h-8 w-28 tabular-nums"
                          value={precos[p.id] ?? String(p.preco_mensal)}
                          onChange={(e) => setPrecos((s) => ({ ...s, [p.id]: e.target.value }))}
                        />
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{fmtInt(ativas)}</td>
                      <td className="py-2 pr-3">
                        <Badge variant={p.ativo ? 'default' : 'secondary'}>{p.ativo ? 'Ativo' : 'Inativo'}</Badge>
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <Button size="sm" variant="outline" className="h-8 text-xs" disabled={salvando === p.id} onClick={() => salvarPlano(p.id, p.ativo)}>
                          {salvando === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Salvar preço'}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 text-xs ml-1" disabled={salvando === p.id} onClick={() => salvarPlano(p.id, p.ativo, !p.ativo)}>
                          {p.ativo ? 'Desativar' : 'Ativar'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {data.planos.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-muted-foreground text-xs">Nenhum plano cadastrado.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Clínicas */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Clínicas ({fmtInt(data.clinicas.ativas)} ativas)</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-1.5 pr-3">Clínica</th><th className="py-1.5 pr-3">Profissionais</th><th className="py-1.5 pr-3">Status</th>
                </tr></thead>
                <tbody>
                  {data.clinicas.lista.map((c) => (
                    <tr key={c.id} className="border-b border-border/40">
                      <td className="py-1.5 pr-3">{c.nome}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{c.profissionais}/{c.limite}</td>
                      <td className="py-1.5 pr-3"><Badge variant={c.ativa ? 'default' : 'secondary'} className="text-[10px]">{c.ativa ? 'Ativa' : 'Inativa'}</Badge></td>
                    </tr>
                  ))}
                  {data.clinicas.lista.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-muted-foreground text-xs">Nenhuma clínica.</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Formas de pagamento em uso */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Formas de pagamento em uso</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.formas_pagamento.map((f) => <Badge key={f} variant="outline" className="text-xs">{f}</Badge>)}
              {data.formas_pagamento.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma forma registrada ainda.</p>}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              Detectadas automaticamente de assinaturas, wellness e vendas (ex.: <code>assinatura:manual</code>, <code>wellness:stripe</code>, <code>venda:pix</code>). Para conectar um provedor novo (Stripe Checkout, PIX, Mercado Pago), é uma etapa à parte — me avise quando quiser.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
