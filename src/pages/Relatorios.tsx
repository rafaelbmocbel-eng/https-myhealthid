import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText, Link2, Copy, Trash2, Plus, Search, Clock, CheckCircle2,
  XCircle, Activity, AlignCenter, CalendarDays, Loader2, ExternalLink,
  RefreshCw, Users, ClipboardList,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { usePacientes } from '@/hooks/usePacientes';

// ── Helpers ──────────────────────────────────────────────────────────────────
function getLinkUrl(token: string) {
  return `${window.location.origin}/avaliacao/${token}`;
}

function StatusBadge({ status, expiracao }: { status: string; expiracao: string }) {
  const expirado = new Date(expiracao) < new Date();
  if (status === 'cancelado') return <Badge className="bg-red-100 text-red-700 border-red-200">Cancelado</Badge>;
  if (expirado) return <Badge className="bg-slate-100 text-slate-600 border-slate-200">Expirado</Badge>;
  if (status === 'ativo') return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Ativo</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

// ── Seção: Links de Avaliação ─────────────────────────────────────────────────
function LinksAvaliacao() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { allPacientes } = usePacientes();
  const [search, setSearch] = useState('');
  const [gerando, setGerando] = useState<string | null>(null);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['links-avaliacao-relatorio', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('links_avaliacao')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const cancelarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('links_avaliacao').update({ status: 'cancelado' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['links-avaliacao-relatorio'] });
      toast({ title: 'Link cancelado' });
    },
  });

  const gerarNovoLink = async (pacienteId: string) => {
    if (!user) return;
    setGerando(pacienteId);
    try {
      const dataExpiracao = new Date();
      dataExpiracao.setDate(dataExpiracao.getDate() + 30);
      const { data, error } = await supabase.from('links_avaliacao').insert({
        paciente_id: pacienteId,
        terapeuta_id: user.id,
        data_expiracao: dataExpiracao.toISOString(),
        blocos_inclusos: [1, 2, 3, 4, 5],
      }).select().single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['links-avaliacao-relatorio'] });
      toast({ title: 'Link gerado!', description: 'Copie e envie ao paciente.' });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar link', description: e.message, variant: 'destructive' });
    } finally {
      setGerando(null);
    }
  };

  const copiarLink = (token: string) => {
    navigator.clipboard.writeText(getLinkUrl(token));
    toast({ title: 'Link copiado!' });
  };

  const getNomePaciente = (pid: string) => {
    const p = allPacientes.find(p => p.id === pid);
    return p ? `${p.nome} ${p.sobrenome}` : 'Paciente';
  };

  const filtered = links.filter(l => {
    const nome = getNomePaciente(l.paciente_id).toLowerCase();
    return nome.includes(search.toLowerCase());
  });

  const ativos = filtered.filter(l => l.status === 'ativo' && new Date(l.data_expiracao!) > new Date());
  const historico = filtered.filter(l => l.status !== 'ativo' || new Date(l.data_expiracao!) <= new Date());

  return (
    <div className="space-y-6">
      {/* Gerar novo link por paciente */}
      <div className="clinical-card">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Gerar Link de Avaliação para Paciente
        </h3>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar paciente..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {allPacientes.filter(p => `${p.nome} ${p.sobrenome}`.toLowerCase().includes(search.toLowerCase())).map(p => {
            const linkAtivo = links.find(l => l.paciente_id === p.id && l.status === 'ativo' && new Date(l.data_expiracao!) > new Date());
            return (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg border hover:border-primary/30 hover:bg-accent/10 transition-all">
                <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center shrink-0 text-white font-bold text-xs">
                  {p.nome[0]}{p.sobrenome?.[0] || ''}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{p.nome} {p.sobrenome}</div>
                  {linkAtivo && (
                    <div className="text-xs text-emerald-600">
                      Link ativo · {differenceInDays(new Date(linkAtivo.data_expiracao!), new Date())} dias restantes
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {linkAtivo && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => copiarLink(linkAtivo.token)}>
                      <Copy className="h-3 w-3" /> Copiar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1 bg-gradient-primary text-white"
                    onClick={() => gerarNovoLink(p.id)}
                    disabled={gerando === p.id}
                  >
                    {gerando === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    {linkAtivo ? 'Renovar' : 'Gerar'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Links ativos */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Links Ativos ({ativos.length})
            </h3>
            {ativos.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm border rounded-xl border-dashed">
                Nenhum link ativo. Gere um acima.
              </div>
            ) : (
              <div className="space-y-2">
                {ativos.map(l => (
                  <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50/50">
                    <Link2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{getNomePaciente(l.paciente_id)}</div>
                      <div className="text-xs text-muted-foreground">
                        Expira em {differenceInDays(new Date(l.data_expiracao!), new Date())} dias · {l.acessos_totais || 0} acessos
                      </div>
                      <div className="text-xs text-emerald-700 font-mono truncate mt-0.5">{getLinkUrl(l.token)}</div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => copiarLink(l.token)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => window.open(getLinkUrl(l.token), '_blank')}>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:border-red-300"
                        onClick={() => cancelarMutation.mutate(l.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Histórico */}
          {historico.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Histórico ({historico.length})
              </h3>
              <div className="space-y-2">
                {historico.map(l => (
                  <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl border bg-muted/20 opacity-70">
                    <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{getNomePaciente(l.paciente_id)}</div>
                      <div className="text-xs text-muted-foreground">
                        Criado em {l.data_criacao ? format(parseISO(l.data_criacao), "dd/MM/yyyy", { locale: ptBR }) : '—'} · {l.acessos_totais || 0} acessos
                      </div>
                    </div>
                    <StatusBadge status={l.status || 'expirado'} expiracao={l.data_expiracao || ''} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Seção: Links de Agenda ────────────────────────────────────────────────────
function LinksAgenda() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { allPacientes } = usePacientes();
  const [search, setSearch] = useState('');
  const [gerando, setGerando] = useState<string | null>(null);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['links-agenda-relatorio', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('links_agenda_paciente')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const gerarLink = async (pacienteId: string) => {
    if (!user) return;
    setGerando(pacienteId);
    try {
      const dataExpiracao = new Date();
      dataExpiracao.setDate(dataExpiracao.getDate() + 90);
      const { error } = await supabase.from('links_agenda_paciente').insert({
        paciente_id: pacienteId,
        terapeuta_id: user.id,
        data_expiracao: dataExpiracao.toISOString(),
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['links-agenda-relatorio'] });
      toast({ title: 'Link de agenda gerado! (90 dias)' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setGerando(null);
    }
  };

  const cancelarLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('links_agenda_paciente').update({ status: 'cancelado' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['links-agenda-relatorio'] }),
  });

  const copiarLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/agenda/${token}`);
    toast({ title: 'Link copiado!' });
  };

  const getNome = (pid: string) => {
    const p = allPacientes.find(p => p.id === pid);
    return p ? `${p.nome} ${p.sobrenome}` : 'Paciente';
  };

  const ativos = links.filter(l => l.status === 'ativo' && new Date(l.data_expiracao!) > new Date());
  const historico = links.filter(l => l.status !== 'ativo' || new Date(l.data_expiracao!) <= new Date());

  const pacientesFiltrados = allPacientes.filter(p =>
    `${p.nome} ${p.sobrenome}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="clinical-card">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-amber-600" />
          Gerar Link de Agenda para Paciente (90 dias)
        </h3>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar paciente..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {pacientesFiltrados.map(p => {
            const linkAtivo = links.find(l => l.paciente_id === p.id && l.status === 'ativo' && new Date(l.data_expiracao!) > new Date());
            return (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg border hover:border-amber-300 hover:bg-amber-50/50 transition-all">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0 text-white font-bold text-xs">
                  {p.nome[0]}{p.sobrenome?.[0] || ''}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{p.nome} {p.sobrenome}</div>
                  {linkAtivo && (
                    <div className="text-xs text-emerald-600">
                      Link ativo · {differenceInDays(new Date(linkAtivo.data_expiracao!), new Date())} dias restantes
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {linkAtivo && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => copiarLink(linkAtivo.token)}>
                      <Copy className="h-3 w-3" /> Copiar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1 text-white"
                    style={{ background: 'linear-gradient(135deg, hsl(40 96% 52%), hsl(25 95% 53%))' }}
                    onClick={() => gerarLink(p.id)}
                    disabled={gerando === p.id}
                  >
                    {gerando === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    {linkAtivo ? 'Renovar' : 'Gerar'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
          {ativos.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Links Ativos ({ativos.length})
              </h3>
              <div className="space-y-2">
                {ativos.map(l => (
                  <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/50">
                    <CalendarDays className="h-4 w-4 text-amber-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{getNome(l.paciente_id)}</div>
                      <div className="text-xs text-muted-foreground">
                        Expira em {differenceInDays(new Date(l.data_expiracao!), new Date())} dias · {l.acessos_totais || 0} acessos
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => copiarLink(l.token)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0 text-red-500"
                        onClick={() => cancelarLink.mutate(l.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {historico.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3 text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" /> Histórico ({historico.length})
              </h3>
              <div className="space-y-2">
                {historico.map(l => (
                  <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl border bg-muted/20 opacity-70">
                    <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{getNome(l.paciente_id)}</div>
                      <div className="text-xs text-muted-foreground">{l.acessos_totais || 0} acessos</div>
                    </div>
                    <StatusBadge status={l.status || 'expirado'} expiracao={l.data_expiracao || ''} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────
export default function Relatorios() {
  const { user, loading } = useAuth();

  if (!loading && !user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <div className="container py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatórios e Links</h1>
            <p className="text-muted-foreground text-sm">Gerencie links de avaliação e agenda dos seus pacientes</p>
          </div>
        </div>

        <Tabs defaultValue="links-avaliacao">
          <TabsList className="mb-6 h-auto flex flex-wrap gap-1 bg-secondary p-1 rounded-xl">
            <TabsTrigger value="links-avaliacao" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Activity className="h-4 w-4" />
              Links de Avaliação
            </TabsTrigger>
            <TabsTrigger value="links-agenda" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <CalendarDays className="h-4 w-4" />
              Links de Agenda
            </TabsTrigger>
          </TabsList>

          <TabsContent value="links-avaliacao">
            <div className="mb-4 p-4 rounded-xl bg-primary/5 border border-primary/20 text-sm text-muted-foreground">
              <strong className="text-foreground">Links de Avaliação</strong> — Envie ao paciente para preencher os 5 blocos do Método Identidade remotamente. Válidos por <strong>30 dias</strong>.
            </div>
            <LinksAvaliacao />
          </TabsContent>

          <TabsContent value="links-agenda">
            <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-300/30 text-sm text-muted-foreground">
              <strong className="text-foreground">Links de Agenda</strong> — Permita que o paciente visualize e solicite horários diretamente. Válidos por <strong>90 dias</strong>.
            </div>
            <LinksAgenda />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
