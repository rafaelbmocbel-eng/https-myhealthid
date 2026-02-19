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
  Activity, CalendarDays, Loader2, ExternalLink, Users, Mail, MessageCircle,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { usePacientes } from '@/hooks/usePacientes';


// ── Helpers ──────────────────────────────────────────────────────────────────
function getLinkUrl(token: string) {
  return `${window.location.origin}/avaliacao/${token}`;
}

function getAgendaUrl(token: string) {
  return `${window.location.origin}/agenda/${token}`;
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
  const [enviandoEmail, setEnviandoEmail] = useState<string | null>(null);

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
      const { error } = await supabase.from('links_avaliacao').insert({
        paciente_id: pacienteId,
        terapeuta_id: user.id,
        data_expiracao: dataExpiracao.toISOString(),
        blocos_inclusos: [1, 2, 3, 4, 5],
      });
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

  const handleEnviarEmail = async (linkId: string, pacienteId: string, token: string) => {
    const paciente = allPacientes.find(p => p.id === pacienteId);
    if (!paciente?.email) {
      toast({ title: 'Paciente sem email', description: 'Cadastre o email do paciente primeiro.', variant: 'destructive' });
      return;
    }
    setEnviandoEmail(linkId);
    try {
      const { data, error } = await supabase.functions.invoke('enviar-link-email', {
        body: {
          patientName: `${paciente.nome} ${paciente.sobrenome}`,
          patientEmail: paciente.email,
          linkUrl: getLinkUrl(token),
          linkType: 'avaliacao',
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Email não enviado', description: data.error, variant: 'destructive' });
      } else {
        toast({ title: '✉️ Email enviado!', description: `Para ${paciente.email}` });
      }
    } catch (e: any) {
      toast({ title: 'Erro ao enviar email', description: e.message, variant: 'destructive' });
    } finally {
      setEnviandoEmail(null);
    }
  };

  const handleWhatsApp = (pacienteId: string, token: string) => {
    const paciente = allPacientes.find(p => p.id === pacienteId);
    if (!paciente?.telefone) {
      toast({ title: 'Paciente sem telefone', description: 'Cadastre o telefone do paciente primeiro.', variant: 'destructive' });
      return;
    }
    // Abre diretamente para evitar bloqueio de popup do browser
    const nome = `${paciente.nome} ${paciente.sobrenome}`;
    const link = getLinkUrl(token);
    const msg = `Olá ${nome}! 👋\n\n📋 Seu terapeuta enviou um questionário de avaliação para você preencher antes da próxima sessão.\n\nLeva cerca de 30-40 minutos e pode ser feito de onde estiver.\n\n🔗 Link: ${link}`;
    const phone = paciente.telefone.replace(/\D/g, '');
    const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
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
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Copiar link" onClick={() => copiarLink(l.token)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Abrir link" onClick={() => window.open(getLinkUrl(l.token), '_blank')}>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0 text-[#25D366] hover:border-[#25D366] hover:bg-[#25D366]/10"
                        title="Enviar via WhatsApp"
                        onClick={() => handleWhatsApp(l.paciente_id, l.token)}
                      >
                        <MessageCircle className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0 text-blue-500 hover:border-blue-400 hover:bg-blue-50"
                        title="Enviar por Email"
                        disabled={enviandoEmail === l.id}
                        onClick={() => handleEnviarEmail(l.id, l.paciente_id, l.token)}
                      >
                        {enviandoEmail === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
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
  const [enviandoEmail, setEnviandoEmail] = useState<string | null>(null);

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
    navigator.clipboard.writeText(getAgendaUrl(token));
    toast({ title: 'Link copiado!' });
  };

  const handleWhatsApp = (pacienteId: string, token: string) => {
    const paciente = allPacientes.find(p => p.id === pacienteId);
    if (!paciente?.telefone) {
      toast({ title: 'Paciente sem telefone', description: 'Cadastre o telefone do paciente primeiro.', variant: 'destructive' });
      return;
    }
    const nome = `${paciente.nome} ${paciente.sobrenome}`;
    const link = getAgendaUrl(token);
    const msg = `Olá ${nome}! 👋\n\n📅 Aqui está seu link personalizado para agendar suas sessões de fisioterapia.\n\n🔗 Link: ${link}`;
    const phone = paciente.telefone.replace(/\D/g, '');
    const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;
    window.open(`https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleEnviarEmail = async (linkId: string, pacienteId: string, token: string) => {
    const paciente = allPacientes.find(p => p.id === pacienteId);
    if (!paciente?.email) {
      toast({ title: 'Paciente sem email', description: 'Cadastre o email do paciente primeiro.', variant: 'destructive' });
      return;
    }
    setEnviandoEmail(linkId);
    try {
      const { data, error } = await supabase.functions.invoke('enviar-link-email', {
        body: {
          patientName: `${paciente.nome} ${paciente.sobrenome}`,
          patientEmail: paciente.email,
          linkUrl: getAgendaUrl(token),
          linkType: 'agenda',
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Email não enviado', description: data.error, variant: 'destructive' });
      } else {
        toast({ title: '✉️ Email enviado!', description: `Para ${paciente.email}` });
      }
    } catch (e: any) {
      toast({ title: 'Erro ao enviar email', description: e.message, variant: 'destructive' });
    } finally {
      setEnviandoEmail(null);
    }
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
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Copiar link" onClick={() => copiarLink(l.token)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0 text-[#25D366] hover:border-[#25D366] hover:bg-[#25D366]/10"
                        title="Enviar via WhatsApp"
                        onClick={() => handleWhatsApp(l.paciente_id, l.token)}
                      >
                        <MessageCircle className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0 text-blue-500 hover:border-blue-400 hover:bg-blue-50"
                        title="Enviar por Email"
                        disabled={enviandoEmail === l.id}
                        onClick={() => handleEnviarEmail(l.id, l.paciente_id, l.token)}
                      >
                        {enviandoEmail === l.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
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

// ── Seção: Respostas Recebidas ────────────────────────────────────────────────
function RespostasRecebidas() {
  const { user } = useAuth();
  const { allPacientes } = usePacientes();
  const [expandido, setExpandido] = useState<string | null>(null);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['links-com-respostas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('links_avaliacao')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .gt('acessos_totais', 0)
        .order('data_ultimo_acesso', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: respostas = [] } = useQuery({
    queryKey: ['respostas-pacientes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('respostas_avaliacao_paciente')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const getNome = (pid: string) => {
    const p = allPacientes.find(p => p.id === pid);
    return p ? `${p.nome} ${p.sobrenome}` : 'Paciente';
  };

  const BLOCOS = ['Anamnese', 'Dor', 'Funcionalidade', 'Cinesiofobia', 'Regulação'];

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (links.length === 0) return (
    <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed">
      <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p className="font-medium">Nenhuma resposta recebida ainda</p>
      <p className="text-sm mt-1">Quando um paciente preencher o questionário, as respostas aparecerão aqui.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {links.map(link => {
        const respostasLink = respostas.filter(r => r.link_id === link.id);
        const blocosRecebidos = [...new Set(respostasLink.map(r => r.bloco_numero))].sort();
        const isOpen = expandido === link.id;

        return (
          <div key={link.id} className="border rounded-xl overflow-hidden">
            <button
              className="w-full flex items-center gap-3 p-4 hover:bg-accent/5 transition-colors text-left"
              onClick={() => setExpandido(isOpen ? null : link.id)}
            >
              <div className="h-9 w-9 rounded-full bg-gradient-primary flex items-center justify-center shrink-0 text-white font-bold text-sm">
                {getNome(link.paciente_id)[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{getNome(link.paciente_id)}</div>
                <div className="text-xs text-muted-foreground">
                  {blocosRecebidos.length}/5 blocos respondidos
                  {link.data_ultimo_acesso && ` · Último acesso: ${format(parseISO(link.data_ultimo_acesso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <div
                      key={n}
                      className={`h-2 w-2 rounded-full ${blocosRecebidos.includes(n) ? 'bg-emerald-500' : 'bg-muted'}`}
                      title={BLOCOS[n - 1]}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">{isOpen ? '▲' : '▼'}</span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t bg-muted/20 p-4 space-y-3">
                {blocosRecebidos.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Link acessado mas nenhum bloco foi salvo ainda.</p>
                ) : (
                  blocosRecebidos.map(blocoNum => {
                    const resp = respostasLink
                      .filter(r => r.bloco_numero === blocoNum)
                      .sort((a, b) => (b.numero_tentativa || 1) - (a.numero_tentativa || 1))[0];
                    if (!resp) return null;
                    const dados = resp.dados_respostas as Record<string, any>;
                    return (
                      <div key={blocoNum} className="bg-background rounded-lg p-3 border">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="font-semibold text-sm">Bloco {blocoNum} — {BLOCOS[blocoNum - 1]}</span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {resp.data_preenchimento ? format(parseISO(resp.data_preenchimento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ''}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1 max-h-40 overflow-y-auto">
                          {dados && Object.entries(dados)
                            .filter(([k]) => !k.startsWith('score'))
                            .slice(0, 8)
                            .map(([key, val]) => (
                              <div key={key} className="flex gap-2">
                                <span className="font-medium capitalize min-w-[120px]">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                <span className="truncate">{Array.isArray(val) ? val.join(', ') : String(val)}</span>
                              </div>
                            ))
                          }
                          {dados && Object.keys(dados).filter(k => k.startsWith('score')).length > 0 && (
                            <div className="flex gap-2 flex-wrap mt-2 pt-2 border-t">
                              {Object.entries(dados)
                                .filter(([k]) => k.startsWith('score'))
                                .map(([k, v]) => (
                                  <span key={k} className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs font-semibold">
                                    {k.toUpperCase()}: {typeof v === 'number' ? v.toFixed(1) : v}
                                  </span>
                                ))
                              }
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
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

        {/* Info badges */}
        <div className="flex flex-wrap gap-2 mb-6">
          <div className="flex items-center gap-1.5 text-xs bg-[#25D366]/10 text-[#25D366] border border-[#25D366]/20 rounded-full px-3 py-1 font-medium">
            <MessageCircle className="h-3 w-3" /> WhatsApp disponível
          </div>
          <div className="flex items-center gap-1.5 text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-3 py-1 font-medium">
            <Mail className="h-3 w-3" /> Email disponível
          </div>
        </div>

        <Tabs defaultValue="links-avaliacao">
          <TabsList className="mb-6 h-auto flex flex-wrap gap-1 bg-secondary p-1 rounded-xl">
            <TabsTrigger value="links-avaliacao" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Activity className="h-4 w-4" />
              Links de Avaliação
            </TabsTrigger>
            <TabsTrigger value="respostas" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <CheckCircle2 className="h-4 w-4" />
              Respostas Recebidas
            </TabsTrigger>
            <TabsTrigger value="links-agenda" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <CalendarDays className="h-4 w-4" />
              Links de Agenda
            </TabsTrigger>
          </TabsList>

          <TabsContent value="links-avaliacao">
            <div className="mb-4 p-4 rounded-xl bg-primary/5 border border-primary/20 text-sm text-muted-foreground">
              <strong className="text-foreground">Links de Avaliação</strong> — Envie ao paciente para preencher os 5 blocos do Método Identidade remotamente. Válidos por <strong>30 dias</strong>.
              <span className="ml-2 text-xs">Use os ícones <MessageCircle className="h-3 w-3 inline text-[#25D366]" /> e <Mail className="h-3 w-3 inline text-blue-500" /> para compartilhar diretamente.</span>
            </div>
            <LinksAvaliacao />
          </TabsContent>

          <TabsContent value="respostas">
            <div className="mb-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-300/30 text-sm text-muted-foreground">
              <strong className="text-foreground">Respostas Recebidas</strong> — Visualize os questionários preenchidos pelos pacientes. Clique em cada card para expandir as respostas.
            </div>
            <RespostasRecebidas />
          </TabsContent>

          <TabsContent value="links-agenda">
            <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-300/30 text-sm text-muted-foreground">
              <strong className="text-foreground">Links de Agenda</strong> — Permita que o paciente visualize e solicite horários diretamente. Válidos por <strong>90 dias</strong>.
              <span className="ml-2 text-xs">Use os ícones <MessageCircle className="h-3 w-3 inline text-[#25D366]" /> e <Mail className="h-3 w-3 inline text-blue-500" /> para compartilhar diretamente.</span>
            </div>
            <LinksAgenda />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
