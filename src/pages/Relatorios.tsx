import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import PacientesSubNav from '@/components/PacientesSubNav';
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
  Activity, CalendarDays, Loader2, ExternalLink, MessageCircle, Mail,
  ChevronDown, ChevronUp, Star,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { usePacientes } from '@/hooks/usePacientes';
import { shareAvaliacaoLink, shareAgendaLink } from '@/utils/whatsapp';

import { getAvaliacaoUrl as getLinkUrl, getAgendaUrl } from '@/utils/linkUrls';
import NpsSurveyCard from '@/components/nps/NpsSurveyCard';

function NpsDashboard() {
  return <NpsSurveyCard showDashboard />;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status, expiracao }: { status: string; expiracao: string }) {
  const expirado = new Date(expiracao) < new Date();
  if (status === 'cancelado') return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Cancelado</Badge>;
  if (expirado) return <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-xs">Expirado</Badge>;
  if (status === 'ativo') return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Ativo</Badge>;
  return <Badge variant="outline" className="text-xs">{status}</Badge>;
}

// ── Aba 1: Todos os Links (Avaliação + Agenda) ────────────────────────────────
function TodosOsLinks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { allPacientes } = usePacientes();
  const [search, setSearch] = useState('');
  const [gerando, setGerando] = useState<{ id: string; tipo: string } | null>(null);
  const [enviandoEmail, setEnviandoEmail] = useState<string | null>(null);

  // Busca links de avaliação
  const { data: linksAvaliacao = [], isLoading: loadingAv } = useQuery({
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

  // Busca links de agenda
  const { data: linksAgenda = [], isLoading: loadingAg } = useQuery({
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

  const isLoading = loadingAv || loadingAg;

  const getNome = (pid: string) => {
    const p = allPacientes.find(p => p.id === pid);
    return p ? `${p.nome} ${p.sobrenome}` : 'Paciente';
  };

  const getLinkAtivoAv = (pacienteId: string) =>
    linksAvaliacao.find(l => l.paciente_id === pacienteId && l.status === 'ativo' && new Date(l.data_expiracao!) > new Date());

  const getLinkAtivoAg = (pacienteId: string) =>
    linksAgenda.find(l => l.paciente_id === pacienteId && l.status === 'ativo' && new Date(l.data_expiracao!) > new Date());

  const gerarLinkAvaliacao = async (pacienteId: string) => {
    if (!user) return;
    setGerando({ id: pacienteId, tipo: 'av' });
    try {
      const dataExpiracao = new Date();
      dataExpiracao.setDate(dataExpiracao.getDate() + 30);
      const { error } = await supabase.from('links_avaliacao').insert({
        paciente_id: pacienteId,
        terapeuta_id: user.id,
        data_expiracao: dataExpiracao.toISOString(),
        blocos_inclusos: [1, 2, 3, 4, 5, 6],
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['links-avaliacao-relatorio'] });
      toast({ title: 'Link de avaliação gerado! (30 dias)' });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar link', description: e.message, variant: 'destructive' });
    } finally {
      setGerando(null);
    }
  };

  const gerarLinkAgenda = async (pacienteId: string) => {
    if (!user) return;
    setGerando({ id: pacienteId, tipo: 'ag' });
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
      toast({ title: 'Erro ao gerar link', description: e.message, variant: 'destructive' });
    } finally {
      setGerando(null);
    }
  };

  const cancelarAvMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('links_avaliacao').update({ status: 'cancelado' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['links-avaliacao-relatorio'] });
      toast({ title: 'Link cancelado' });
    },
  });

  const cancelarAgMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('links_agenda_paciente').update({ status: 'cancelado' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['links-agenda-relatorio'] });
      toast({ title: 'Link cancelado' });
    },
  });

  const copiar = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: `${label} copiado! 📋` });
  };

  const whatsApp = (pacienteId: string, url: string, tipo: 'avaliacao' | 'agenda') => {
    const paciente = allPacientes.find(p => p.id === pacienteId);
    if (!paciente?.telefone) {
      toast({ title: 'Paciente sem telefone cadastrado', variant: 'destructive' });
      return;
    }
    if (tipo === 'avaliacao') {
      shareAvaliacaoLink(`${paciente.nome} ${paciente.sobrenome}`, paciente.telefone, url);
    } else {
      shareAgendaLink(`${paciente.nome} ${paciente.sobrenome}`, paciente.telefone, url);
    }
  };

  const enviarEmail = async (linkId: string, pacienteId: string, url: string, tipo: 'avaliacao' | 'agenda') => {
    const paciente = allPacientes.find(p => p.id === pacienteId);
    if (!paciente?.email) {
      toast({ title: 'Paciente sem email', description: 'Cadastre o email primeiro.', variant: 'destructive' });
      return;
    }
    setEnviandoEmail(linkId);
    try {
      const { data, error } = await supabase.functions.invoke('enviar-link-email', {
        body: {
          patientName: `${paciente.nome} ${paciente.sobrenome}`,
          patientEmail: paciente.email,
          linkUrl: url,
          linkType: tipo,
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

  const pacientesFiltrados = allPacientes.filter(p =>
    `${p.nome} ${p.sobrenome}`.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar paciente..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-primary" /> Avaliação (30 dias)</span>
        <span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-amber-500" /> Agenda (90 dias)</span>
        <span className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5 text-[#25D366]" /> WhatsApp</span>
        <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-blue-500" /> Email</span>
      </div>

      {/* Lista de pacientes */}
      {pacientesFiltrados.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm border rounded-xl border-dashed">
          Nenhum paciente encontrado.
        </div>
      ) : (
        <div className="space-y-3">
          {pacientesFiltrados.map(p => {
            const avAtivo = getLinkAtivoAv(p.id);
            const agAtivo = getLinkAtivoAg(p.id);

            return (
              <div key={p.id} className="border rounded-xl overflow-hidden">
                {/* Cabeçalho do paciente */}
                <div className="flex items-center gap-3 p-4 bg-card">
                  <div className="h-9 w-9 rounded-full bg-gradient-primary flex items-center justify-center shrink-0 text-white font-bold text-sm">
                    {p.nome[0]}{p.sobrenome?.[0] || ''}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{p.nome} {p.sobrenome}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.email || p.telefone || 'Sem contato cadastrado'}
                    </div>
                  </div>
                </div>

                {/* Linha: Link de Avaliação */}
                <div className="border-t px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2 min-w-[140px]">
                    <Activity className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="text-xs font-medium text-foreground">Avaliação</span>
                    {avAtivo
                      ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs ml-1">{differenceInDays(new Date(avAtivo.data_expiracao!), new Date())}d restantes</Badge>
                      : <Badge variant="outline" className="text-xs ml-1 text-muted-foreground">Sem link</Badge>
                    }
                  </div>

                  {avAtivo && (
                    <div className="flex-1 text-xs text-muted-foreground font-mono truncate hidden sm:block">
                      {getLinkUrl(avAtivo.token).replace(/^https?:\/\//, '')}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                    {avAtivo ? (
                      <>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => copiar(getLinkUrl(avAtivo.token), 'Link')}>
                          <Copy className="h-3 w-3" /> Copiar
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-[#25D366] hover:border-[#25D366]" title="WhatsApp" onClick={() => whatsApp(p.id, getLinkUrl(avAtivo.token), 'avaliacao')}>
                          <MessageCircle className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-blue-500 hover:border-blue-400" title="Email" disabled={enviandoEmail === avAtivo.id} onClick={() => enviarEmail(avAtivo.id, p.id, getLinkUrl(avAtivo.token), 'avaliacao')}>
                          {enviandoEmail === avAtivo.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Abrir" onClick={() => window.open(getLinkUrl(avAtivo.token), '_blank')}>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" title="Cancelar" onClick={() => cancelarAvMutation.mutate(avAtivo.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1 bg-gradient-primary text-white"
                        onClick={() => gerarLinkAvaliacao(p.id)}
                        disabled={gerando?.id === p.id && gerando?.tipo === 'av'}
                      >
                        {gerando?.id === p.id && gerando?.tipo === 'av' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Gerar Link
                      </Button>
                    )}
                  </div>
                </div>

                {/* Linha: Link de Agenda */}
                <div className="border-t px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 bg-amber-50/30">
                  <div className="flex items-center gap-2 min-w-[140px]">
                    <CalendarDays className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="text-xs font-medium text-foreground">Agenda</span>
                    {agAtivo
                      ? <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs ml-1">{differenceInDays(new Date(agAtivo.data_expiracao!), new Date())}d restantes</Badge>
                      : <Badge variant="outline" className="text-xs ml-1 text-muted-foreground">Sem link</Badge>
                    }
                  </div>

                  {agAtivo && (
                    <div className="flex-1 text-xs text-muted-foreground font-mono truncate hidden sm:block">
                      {getAgendaUrl(agAtivo.token).replace(/^https?:\/\//, '')}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                    {agAtivo ? (
                      <>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={() => copiar(getAgendaUrl(agAtivo.token), 'Link')}>
                          <Copy className="h-3 w-3" /> Copiar
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-[#25D366] hover:border-[#25D366]" title="WhatsApp" onClick={() => whatsApp(p.id, getAgendaUrl(agAtivo.token), 'agenda')}>
                          <MessageCircle className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-blue-500 hover:border-blue-400" title="Email" disabled={enviandoEmail === agAtivo.id} onClick={() => enviarEmail(agAtivo.id, p.id, getAgendaUrl(agAtivo.token), 'agenda')}>
                          {enviandoEmail === agAtivo.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Abrir" onClick={() => window.open(getAgendaUrl(agAtivo.token), '_blank')}>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" title="Cancelar" onClick={() => cancelarAgMutation.mutate(agAtivo.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 border-amber-300 text-amber-700 hover:bg-amber-50"
                        onClick={() => gerarLinkAgenda(p.id)}
                        disabled={gerando?.id === p.id && gerando?.tipo === 'ag'}
                      >
                        {gerando?.id === p.id && gerando?.tipo === 'ag' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Gerar Link
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Aba 2: Respostas e Relatórios ─────────────────────────────────────────────
function RespostasERelatorios() {
  const { user } = useAuth();
  const { allPacientes } = usePacientes();
  const [expandido, setExpandido] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['links-com-respostas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('links_avaliacao')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('data_ultimo_acesso', { ascending: false, nullsFirst: false });
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

  // Filtra apenas links que têm respostas
  const linksComRespostas = links.filter(link => {
    const temRespostas = respostas.some(r => r.link_id === link.id);
    const nome = getNome(link.paciente_id).toLowerCase();
    return temRespostas && nome.includes(search.toLowerCase());
  });

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar paciente..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {linksComRespostas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed">
          <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma resposta recebida ainda</p>
          <p className="text-sm mt-1">Quando um paciente preencher o questionário, aparecerá aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {linksComRespostas.map(link => {
            const respostasLink = respostas.filter(r => r.link_id === link.id);
            const blocosRecebidos = [...new Set(respostasLink.map(r => r.bloco_numero))].sort();
            const isOpen = expandido === link.id;
            const completo = blocosRecebidos.length >= 6;

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
                      {link.data_ultimo_acesso && ` · ${format(parseISO(link.data_ultimo_acesso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Indicadores de blocos */}
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <div
                          key={n}
                          className={`h-2 w-5 rounded-sm ${blocosRecebidos.includes(n) ? 'bg-emerald-500' : 'bg-muted'}`}
                          title={BLOCOS[n - 1]}
                        />
                      ))}
                    </div>
                    {completo && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs hidden sm:flex">Completo</Badge>}
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t bg-muted/20 p-4 space-y-3">
                    {blocosRecebidos.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Link acessado mas nenhum bloco salvo ainda.</p>
                    ) : (
                      <>
                        {/* Scores resumidos */}
                        {(() => {
                          const todosScores: Record<string, number> = {};
                          blocosRecebidos.forEach(blocoNum => {
                            const resp = respostasLink
                              .filter(r => r.bloco_numero === blocoNum)
                              .sort((a, b) => (b.numero_tentativa || 1) - (a.numero_tentativa || 1))[0];
                            if (resp?.dados_respostas) {
                              const dados = resp.dados_respostas as Record<string, any>;
                              Object.entries(dados)
                                .filter(([k]) => k.startsWith('score'))
                                .forEach(([k, v]) => { if (typeof v === 'number') todosScores[k] = v; });
                            }
                          });
                          return Object.keys(todosScores).length > 0 ? (
                            <div className="bg-primary/5 border border-primary/15 rounded-lg p-3">
                              <div className="text-xs font-semibold text-foreground mb-2">📊 Scores calculados</div>
                              <div className="flex gap-2 flex-wrap">
                                {Object.entries(todosScores).map(([k, v]) => (
                                  <span key={k} className="bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs font-bold">
                                    {k.replace('score', '').toUpperCase()}: {v.toFixed(1)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {/* Detalhes por bloco */}
                        {blocosRecebidos.map(blocoNum => {
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
                                  {resp.data_preenchimento ? format(parseISO(resp.data_preenchimento), "dd/MM 'às' HH:mm", { locale: ptBR }) : ''}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground space-y-1 max-h-44 overflow-y-auto pr-1">
                                {dados && Object.entries(dados)
                                  .filter(([k]) => !k.startsWith('score'))
                                  .slice(0, 10)
                                  .map(([key, val]) => (
                                    <div key={key} className="flex gap-2">
                                      <span className="font-medium capitalize min-w-[130px] text-foreground/70">
                                        {key.replace(/([A-Z])/g, ' $1').trim()}:
                                      </span>
                                      <span className="truncate">
                                        {Array.isArray(val) ? val.join(', ') || '—' : String(val) || '—'}
                                      </span>
                                    </div>
                                  ))
                                }
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
      <div className="container py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Relatórios e Links</h1>
            <p className="text-muted-foreground text-sm">Gerencie links de acesso e visualize respostas dos pacientes</p>
          </div>
        </div>

        <Tabs defaultValue="links">
          <TabsList className="mb-6 h-10 bg-secondary p-1 rounded-xl">
            <TabsTrigger value="links" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm flex-1">
              <Link2 className="h-4 w-4" />
              Links
            </TabsTrigger>
            <TabsTrigger value="respostas" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm flex-1">
              <CheckCircle2 className="h-4 w-4" />
              Respostas
            </TabsTrigger>
            <TabsTrigger value="nps" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm flex-1">
              <Star className="h-4 w-4" />
              NPS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="links">
            <div className="mb-4 p-4 rounded-xl bg-muted/40 border text-sm text-muted-foreground">
              Busque um paciente e gere ou envie seus links de <strong className="text-foreground">Avaliação</strong> (30 dias) e <strong className="text-foreground">Agenda</strong> (90 dias) via WhatsApp ou Email.
            </div>
            <TodosOsLinks />
          </TabsContent>

          <TabsContent value="respostas">
            <div className="mb-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-300/30 text-sm text-muted-foreground">
              Pacientes que preencheram o questionário remotamente. Expanda para ver respostas e scores calculados.
            </div>
            <RespostasERelatorios />
          </TabsContent>

          <TabsContent value="nps">
            <NpsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
