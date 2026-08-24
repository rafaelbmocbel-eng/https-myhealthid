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
import { useAdminMetrics, atualizarPlano, removerPlano, concederPlano, revogarCortesia, grandfatherTodos } from '@/hooks/useAdminMetrics';
import { MODULOS_CATALOGO, MODULOS_KEYS } from '@/lib/modulosPlano';
import {
  Loader2, RefreshCw, TrendingUp, Building2, Users, GraduationCap, AlertTriangle, CreditCard, DollarSign, Trash2, Layers, Check, Gift, X,
} from 'lucide-react';

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtInt = (n: number) => n.toLocaleString('pt-BR');

// Cores de série (harmônicas com o tema; a acentuação usa a --primary).
const CORES = ['hsl(190 85% 45%)', 'hsl(213 70% 45%)', 'hsl(160 60% 42%)', 'hsl(35 90% 55%)', 'hsl(280 55% 58%)', 'hsl(0 70% 60%)'];

const ESPECIALIDADE_LABEL: Record<string, string> = {
  fisioterapeuta: 'Fisioterapeuta', educador_fisico: 'Educador Físico', nutricionista: 'Nutricionista',
  psicologo: 'Psicólogo', medico: 'Médico', dentista: 'Dentista', terapeuta_ocupacional: 'Terapeuta Ocupacional',
};
const labelEsp = (e: string) => ESPECIALIDADE_LABEL[e] || (e ? e.charAt(0).toUpperCase() + e.slice(1).replace(/_/g, ' ') : '—');

function StatusAssinatura({ status }: { status: string }) {
  const map: Record<string, string> = {
    ativa: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    trial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    cancelada: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };
  const cls = map[status] || 'bg-muted text-muted-foreground';
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
}

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
  const [confirmarRemover, setConfirmarRemover] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroEsp, setFiltroEsp] = useState<string>('todas');
  // Editor de funcionalidades por plano
  const [funcPlanoId, setFuncPlanoId] = useState<string | null>(null);
  const [modulosEdit, setModulosEdit] = useState<string[]>([]);
  const [salvandoFunc, setSalvandoFunc] = useState(false);
  // Liberar plano por e-mail (cortesia / parceiros)
  const [cortesiaEmail, setCortesiaEmail] = useState('');
  const [cortesiaPlano, setCortesiaPlano] = useState('');
  const [cortesiaDias, setCortesiaDias] = useState('');
  const [liberando, setLiberando] = useState(false);
  // Grandfather em massa
  const [gfPlano, setGfPlano] = useState('');
  const [gfConfirmar, setGfConfirmar] = useState(false);
  const [gfRodando, setGfRodando] = useState(false);

  if (!isSuper) return <Navigate to="/hoje" replace />;

  const liberarCortesia = async () => {
    if (!cortesiaEmail.trim() || !cortesiaPlano) { toast({ title: 'Informe e-mail e plano', variant: 'destructive' }); return; }
    setLiberando(true);
    try {
      await concederPlano({ email: cortesiaEmail.trim(), plano_id: cortesiaPlano, dias: cortesiaDias ? Number(cortesiaDias) : undefined });
      await qc.invalidateQueries({ queryKey: ['admin-metrics'] });
      toast({ title: 'Plano liberado! 🎁', description: cortesiaEmail.trim() });
      setCortesiaEmail(''); setCortesiaDias('');
    } catch (e: any) {
      toast({ title: 'Não consegui liberar', description: e?.message, variant: 'destructive' });
    } finally {
      setLiberando(false);
    }
  };
  const rodarGrandfather = async () => {
    if (!gfPlano) { toast({ title: 'Selecione o plano', variant: 'destructive' }); return; }
    setGfRodando(true);
    try {
      const res = await grandfatherTodos({ plano_id: gfPlano });
      await qc.invalidateQueries({ queryKey: ['admin-metrics'] });
      toast({ title: 'Grandfather concluído 🎁', description: `${res.concedidos} profissional(is) sem assinatura receberam o plano.` });
      setGfConfirmar(false); setGfPlano('');
    } catch (e: any) {
      toast({ title: 'Não consegui aplicar', description: e?.message, variant: 'destructive' });
    } finally {
      setGfRodando(false);
    }
  };
  const revogar = async (c: { user_id: string; plano_id: string; email: string }) => {
    try {
      await revogarCortesia({ user_id: c.user_id, plano_id: c.plano_id });
      await qc.invalidateQueries({ queryKey: ['admin-metrics'] });
      toast({ title: 'Cortesia revogada', description: c.email });
    } catch (e: any) {
      toast({ title: 'Erro ao revogar', description: e?.message, variant: 'destructive' });
    }
  };

  const abrirFunc = (p: { id: string; modulos: string[] }) => {
    setFuncPlanoId(p.id);
    setModulosEdit(Array.isArray(p.modulos) ? [...p.modulos] : []);
  };
  const toggleMod = (k: string) =>
    setModulosEdit((m) => m.includes(k) ? m.filter((x) => x !== k) : [...m, k]);
  const salvarFunc = async () => {
    if (!funcPlanoId) return;
    setSalvandoFunc(true);
    try {
      await atualizarPlano({ id: funcPlanoId, modulos: modulosEdit });
      await qc.invalidateQueries({ queryKey: ['admin-metrics'] });
      toast({ title: 'Funcionalidades atualizadas' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' });
    } finally {
      setSalvandoFunc(false);
    }
  };

  const removerPlanoHandler = async (id: string) => {
    setSalvando(id);
    try {
      await removerPlano(id);
      await qc.invalidateQueries({ queryKey: ['admin-metrics'] });
      toast({ title: 'Plano removido' });
    } catch (e: any) {
      toast({ title: 'Não foi possível remover', description: e?.message, variant: 'destructive' });
    } finally {
      setSalvando(null);
      setConfirmarRemover(null);
    }
  };

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

  const buscaLower = busca.trim().toLowerCase();
  const profFiltrados = data.profissionais_lista.filter((p) => {
    if (filtroEsp !== 'todas' && p.especialidade !== filtroEsp) return false;
    if (!buscaLower) return true;
    return [p.nome, p.email, p.cidade, p.uf, p.clinica, p.telefone].some((v) => (v || '').toLowerCase().includes(buscaLower));
  });

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

      {/* Profissionais — quem são, de onde são, plano/status */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Profissionais ({fmtInt(profFiltrados.length)}{filtroEsp !== 'todas' || busca ? ` de ${fmtInt(data.profissionais_lista.length)}` : ''})</CardTitle>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, e-mail, cidade…" className="h-8 w-full sm:w-64 text-sm" />
          </div>
          {/* Filtro por valência (especialidade) */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <button onClick={() => setFiltroEsp('todas')} className={`text-[11px] px-2.5 py-1 rounded-full border ${filtroEsp === 'todas' ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>Todas ({fmtInt(data.profissionais_lista.length)})</button>
            {data.profissionais.por_especialidade.map((e) => (
              <button key={e.especialidade} onClick={() => setFiltroEsp(e.especialidade)} className={`text-[11px] px-2.5 py-1 rounded-full border ${filtroEsp === e.especialidade ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                {labelEsp(e.especialidade)} ({fmtInt(e.total)})
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="sticky top-0 bg-card">
                <tr className="text-left text-xs text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Profissional</th>
                  <th className="py-2 pr-3">Valência</th>
                  <th className="py-2 pr-3">De onde</th>
                  <th className="py-2 pr-3">Plano</th>
                  <th className="py-2 pr-3">Assinatura</th>
                  <th className="py-2 pr-3">Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {profFiltrados.map((p) => (
                  <tr key={p.id} className="border-b border-border/50 align-top">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{p.nome}</div>
                      <div className="text-[11px] text-muted-foreground">{p.email || '—'}{p.telefone ? ` · ${p.telefone}` : ''}</div>
                      {p.crefito && <div className="text-[10px] text-muted-foreground">{p.crefito}</div>}
                    </td>
                    <td className="py-2 pr-3">{labelEsp(p.especialidade)}</td>
                    <td className="py-2 pr-3">
                      {p.cidade || p.uf ? <span>{[p.cidade, p.uf].filter(Boolean).join(' / ')}</span> : <span className="text-muted-foreground">—</span>}
                      {p.clinica && <div className="text-[11px] text-muted-foreground">{p.clinica}</div>}
                    </td>
                    <td className="py-2 pr-3">{p.plano}</td>
                    <td className="py-2 pr-3"><StatusAssinatura status={p.status_assinatura} /></td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground whitespace-nowrap">{p.cadastrado_em ? new Date(p.cadastrado_em).toLocaleDateString('pt-BR') : '—'}</td>
                  </tr>
                ))}
                {profFiltrados.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground text-xs">Nenhum profissional encontrado.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">"De onde" vem da configuração da clínica (cidade/UF) de cada profissional — fica vazio para quem ainda não preencheu.</p>
        </CardContent>
      </Card>

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
                        {confirmarRemover === p.id ? (
                          <>
                            <Button size="sm" variant="destructive" className="h-8 text-xs ml-1" disabled={salvando === p.id} onClick={() => removerPlanoHandler(p.id)}>
                              {salvando === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirmar'}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 text-xs ml-1" disabled={salvando === p.id} onClick={() => setConfirmarRemover(null)}>Cancelar</Button>
                          </>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 ml-1 text-muted-foreground hover:text-destructive" title="Remover plano" onClick={() => setConfirmarRemover(p.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
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

      {/* Funcionalidades por plano — o que cada assinatura libera */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> Funcionalidades por plano</CardTitle>
          <p className="text-[11px] text-muted-foreground mt-1">Escolha um plano e marque o que ele libera. Vale para o gating do app (o que cada assinatura acessa) e para a página de Preços.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Seletor de plano */}
          <div className="flex flex-wrap gap-1.5">
            {data.planos.map((p) => (
              <button key={p.id} onClick={() => abrirFunc(p)}
                className={`text-[11px] px-2.5 py-1 rounded-full border ${funcPlanoId === p.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                {p.nome} ({fmtInt((p.modulos || []).length)})
              </button>
            ))}
          </div>

          {funcPlanoId ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {MODULOS_KEYS.map((k) => {
                  const on = modulosEdit.includes(k);
                  return (
                    <button key={k} type="button" onClick={() => toggleMod(k)}
                      className={`flex items-start gap-2 text-left rounded-lg border px-2.5 py-2 transition-colors ${on ? 'border-primary/50 bg-primary/5' : 'border-border/60 hover:bg-muted/40'}`}>
                      <span className={`mt-0.5 h-4 w-4 rounded flex items-center justify-center shrink-0 border ${on ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0">
                        <span className="text-xs font-medium block">{MODULOS_CATALOGO[k]}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{k}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-muted-foreground">{fmtInt(modulosEdit.length)} de {fmtInt(MODULOS_KEYS.length)} liberadas</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setFuncPlanoId(null)} disabled={salvandoFunc}>Cancelar</Button>
                  <Button size="sm" className="h-8 text-xs gap-1.5" onClick={salvarFunc} disabled={salvandoFunc}>
                    {salvandoFunc ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    Salvar funcionalidades
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Selecione um plano acima para ver e editar o que ele libera.</p>
          )}
        </CardContent>
      </Card>

      {/* Liberar plano por e-mail — cortesias / parceiros */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Gift className="h-4 w-4 text-primary" /> Liberar plano por e-mail (parceiros / cortesias)</CardTitle>
          <p className="text-[11px] text-muted-foreground mt-1">Dê um plano a um e-mail específico — parceiros de vendas, afiliados, ou para manter um profissional atual com acesso total (grandfather). A pessoa precisa já ter uma conta.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2 items-end">
            <div>
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">E-mail</label>
              <Input type="email" value={cortesiaEmail} onChange={(e) => setCortesiaEmail(e.target.value)} placeholder="parceiro@email.com" className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Plano</label>
              <select value={cortesiaPlano} onChange={(e) => setCortesiaPlano(e.target.value)}
                className="h-9 text-sm rounded-md border border-input bg-background px-2 w-full sm:w-44">
                <option value="">Selecione…</option>
                {data.planos.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Dias (opcional)</label>
              <Input type="number" inputMode="numeric" value={cortesiaDias} onChange={(e) => setCortesiaDias(e.target.value)} placeholder="∞" className="h-9 text-sm w-full sm:w-24" />
            </div>
            <Button size="sm" className="h-9 gap-1.5" onClick={liberarCortesia} disabled={liberando}>
              {liberando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />} Liberar
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Sem "dias" = acesso sem prazo. Com dias, expira automaticamente.</p>

          {/* Grandfather em massa — mantém profissionais atuais com acesso total */}
          <div className="border-t border-border/50 pt-3">
            <p className="text-[11px] font-semibold text-muted-foreground mb-1">Grandfather em massa</p>
            <p className="text-[10px] text-muted-foreground mb-2">Dá o plano escolhido, sem prazo, a <b>todos os profissionais que ainda não têm assinatura ativa</b>. Quem já paga ou já tem cortesia não é tocado. Use para não travar seus usuários atuais quando as funcionalidades por plano forem ativadas.</p>
            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Plano</label>
                <select value={gfPlano} onChange={(e) => { setGfPlano(e.target.value); setGfConfirmar(false); }}
                  className="h-9 text-sm rounded-md border border-input bg-background px-2 w-full sm:w-44 block">
                  <option value="">Selecione…</option>
                  {data.planos.filter((p) => p.ativo).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              {!gfConfirmar ? (
                <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={() => { if (!gfPlano) { toast({ title: 'Selecione o plano', variant: 'destructive' }); return; } setGfConfirmar(true); }}>
                  <Gift className="h-4 w-4" /> Aplicar a todos
                </Button>
              ) : (
                <div className="flex gap-2 items-center">
                  <span className="text-[11px] text-amber-600 font-medium">Confirmar?</span>
                  <Button size="sm" className="h-9 gap-1.5" onClick={rodarGrandfather} disabled={gfRodando}>
                    {gfRodando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />} Sim, aplicar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-9" onClick={() => setGfConfirmar(false)} disabled={gfRodando}>Cancelar</Button>
                </div>
              )}
            </div>
          </div>

          {/* Cortesias ativas */}
          {data.cortesias.length > 0 && (
            <div className="border-t border-border/50 pt-2">
              <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">Liberados por cortesia ({fmtInt(data.cortesias.length)})</p>
              <div className="space-y-1 max-h-56 overflow-y-auto">
                {data.cortesias.map((c) => (
                  <div key={`${c.user_id}-${c.plano_id}`} className="flex items-center gap-2 text-sm rounded-md border border-border/40 px-2.5 py-1.5">
                    <span className="min-w-0 flex-1 truncate">{c.email}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">{c.plano}</span>
                    {c.data_fim && <span className="text-[10px] text-muted-foreground shrink-0">até {new Date(c.data_fim).toLocaleDateString('pt-BR')}</span>}
                    <button onClick={() => revogar(c)} title="Revogar" className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
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
