import { useState } from 'react';
import { ArrowLeft, Link2, Copy, MessageCircle, Mail, Plus, Loader2, FileText, Calendar, BarChart3, CalendarDays, Dumbbell, AlignCenter, Fingerprint, UserCircle, ExternalLink, Presentation, Activity, CheckCircle2, ClipboardList, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLinksAvaliacao } from '@/hooks/useLinksAvaliacao';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays, format } from 'date-fns';
import { shareAvaliacaoLink, shareAgendaLink } from '@/utils/whatsapp';
import { getAgendaUrl } from '@/utils/linkUrls';
import QuestionariosComparacao from './QuestionariosComparacao';
import MyIDFingerprint from '@/components/myid/MyIDFingerprint';
import { getMyIDFingerprintData, getMyIDSeverityColor } from '@/utils/myidCalculations';
import type { MyIDResult as MyIDResultType } from '@/types/myid';
import { MyIDWizard } from '../myid/MyIDWizard';
import PatientIntegratedDashboard from './PatientIntegratedDashboard';
import { MyIDResult } from '../myid/MyIDResult';
import StructuralWizard from '../structural/StructuralWizard';
import StructuralResultsSummary from '../structural/StructuralResultsSummary';
import StructuralConnectionMap from '../structural/StructuralConnectionMap';
import TreatmentReportPDF from '../reports/TreatmentReportPDF';
import { StructuralAssessmentData, createDefaultAssessment, classifyScore, classifyScoreColor, UNIT_CONFIGS } from '@/types/structural';
import StudioTreinosTab from '@/components/studio/StudioTreinosTab';
import StudioEvolucaoTab from '@/components/studio/StudioEvolucaoTab';
import StudioNotasTab from '@/components/studio/StudioNotasTab';

interface Paciente {
  id: string;
  nome: string;
  sobrenome: string;
  email?: string | null;
  telefone?: string | null;
}

interface RespostasPrecarga {
  bloco1?: any;
  bloco2?: any;
  bloco3?: any;
  bloco4?: any;
  bloco5?: any;
}

interface Props {
  paciente: Paciente;
  onBack: () => void;
  onIniciarAvaliacao: (precarga?: RespostasPrecarga) => void;
  onVerRelatorio: (avaliacao: any) => void;
  onEditarAvaliacao?: (avaliacao: any) => void;
}

export default function PacienteDashboardIdentidade({ paciente, onBack }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { links, gerarLink, copiarLink, getLinkUrl, gerando } = useLinksAvaliacao();
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [gerandoAgenda, setGerandoAgenda] = useState(false);

  const linkAtivo = links.find(l => l.paciente_id === paciente.id && l.status === 'ativo' && new Date(l.data_expiracao) > new Date());

  // Links de agenda para este paciente
  const { data: linksAgenda = [] } = useQuery({
    queryKey: ['links-agenda-dashboard', user?.id, paciente.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('links_agenda_paciente')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .eq('paciente_id', paciente.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const linkAgendaAtivo = linksAgenda.find((l: any) => l.status === 'ativo' && new Date(l.data_expiracao) > new Date());

  const gerarLinkAgenda = async () => {
    if (!user) return;
    setGerandoAgenda(true);
    try {
      await supabase
        .from('links_agenda_paciente')
        .update({ status: 'cancelado' })
        .eq('paciente_id', paciente.id)
        .eq('terapeuta_id', user.id)
        .eq('status', 'ativo');

      const dataExpiracao = new Date();
      dataExpiracao.setDate(dataExpiracao.getDate() + 90);
      const { error } = await supabase.from('links_agenda_paciente').insert({
        paciente_id: paciente.id,
        terapeuta_id: user.id,
        data_expiracao: dataExpiracao.toISOString(),
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['links-agenda-dashboard'] });
      toast({ title: 'Link de agenda gerado! ✅', description: 'Válido por 90 dias.' });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar link', description: e.message, variant: 'destructive' });
    } finally {
      setGerandoAgenda(false);
    }
  };

  const copiarAgendaLink = (token: string) => {
    navigator.clipboard.writeText(getAgendaUrl(token));
    toast({ title: 'Link de agenda copiado! 📋' });
  };

  // Link MyID para este paciente
  const [gerandoMyIDLink, setGerandoMyIDLink] = useState(false);
  const { data: linksMyID = [], refetch: refetchLinksMyID } = useQuery({
    queryKey: ['links-myid-dashboard', user?.id, paciente.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('myid_avaliacoes')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .eq('paciente_id', paciente.id)
        .eq('status', 'pendente')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const linkMyIDAtivo = linksMyID[0]; // Pega o mais recente pendente

  const gerarLinkMyID = async () => {
    if (!user) return;
    setGerandoMyIDLink(true);
    try {
      const token = Math.random().toString(36).substring(2, 12);
      const { error } = await supabase.from('myid_avaliacoes').insert({
        terapeuta_id: user.id,
        paciente_id: paciente.id,
        token_acesso: token,
        status: 'pendente'
      });
      if (error) throw error;
      refetchLinksMyID();
      toast({ title: 'Link MyID gerado! ✅' });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar link MyID', description: e.message, variant: 'destructive' });
    } finally {
      setGerandoMyIDLink(false);
    }
  };

  const copiarMyIDLink = (token: string) => {
    const url = `${window.location.origin}/myid/responder/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link MyID copiado! 📋' });
  };

  // Respostas remotas para este paciente
  const { data: linksAvPaciente = [] } = useQuery({
    queryKey: ['links-av-paciente', user?.id, paciente.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('links_avaliacao')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .eq('paciente_id', paciente.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: respostas = [] } = useQuery({
    queryKey: ['respostas-paciente', paciente.id],
    queryFn: async () => {
      const linkIds = linksAvPaciente.map(l => l.id);
      if (linkIds.length === 0) return [];
      const { data, error } = await supabase
        .from('respostas_avaliacao_paciente')
        .select('*')
        .in('link_id', linkIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: linksAvPaciente.length > 0,
  });

  // Buscar dados de outros serviços para integração (COB e Studio)
  const { data: ultimaCob } = useQuery({
    queryKey: ['dashboard-ultima-cob', paciente.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_cob_zero')
        .select('*')
        .eq('paciente_id', paciente.id)
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
  });

  const { data: ultimaMedidaStudio } = useQuery({
    queryKey: ['dashboard-ultima-medida-studio', paciente.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('studio_medidas')
        .select('*')
        .eq('paciente_id', paciente.id)
        .order('data_medida', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
  });

  // Buscar última avaliação MyID
  const { data: ultimaMyID } = useQuery({
    queryKey: ['dashboard-ultima-myid', paciente.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_identidade')
        .select('*')
        .eq('paciente_id', paciente.id)
        .not('myid_score', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
  });

  const enviarEmail = async () => {
    if (!paciente.email || !linkAtivo) return;
    setEnviandoEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('enviar-link-email', {
        body: {
          patientName: `${paciente.nome} ${paciente.sobrenome}`,
          patientEmail: paciente.email,
          linkUrl: getLinkUrl(linkAtivo.token),
          linkType: 'avaliacao',
        },
      });
      if (error) throw error;
      if (data?.error) toast({ title: 'Email não enviado', description: data.error, variant: 'destructive' });
      else toast({ title: '✉️ Email enviado!', description: `Para ${paciente.email}` });
    } catch (e: any) {
      toast({ title: 'Erro ao enviar email', description: e.message, variant: 'destructive' });
    } finally {
      setEnviandoEmail(false);
    }
  };

  const { data: myidAvaliacoes = [], refetch: refetchMyID } = useQuery({
    queryKey: ['myid-avaliacoes', paciente.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('myid_avaliacoes')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .eq('paciente_id', paciente.id)
        .eq('status', 'concluido')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const [iniciandoMyID, setIniciandoMyID] = useState(false);
  const [showStructural, setShowStructural] = useState(false);
  const [structuralData, setStructuralData] = useState<StructuralAssessmentData>(createDefaultAssessment());
  const [expandedStructuralId, setExpandedStructuralId] = useState<string | null>(null);
  const [lastSavedData, setLastSavedData] = useState<StructuralAssessmentData | null>(null);
  const [showReport, setShowReport] = useState<{ structural?: StructuralAssessmentData; myid?: any } | null>(null);

  // Buscar avaliações estruturais salvas
  const { data: structuralAvaliacoes = [], refetch: refetchStructural } = useQuery({
    queryKey: ['structural-avaliacoes', paciente.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_identidade')
        .select('*')
        .eq('paciente_id', paciente.id)
        .not('score_e', 'is', null)
        .is('myid_score', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      {/* Header Unificado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-10 w-10 rounded-full bg-identidade flex items-center justify-center shrink-0 text-identidade-foreground font-bold">
            {paciente.nome[0]}{paciente.sobrenome?.[0] || ''}
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{paciente.nome} {paciente.sobrenome}</h2>
            <p className="text-sm text-muted-foreground">{paciente.email || paciente.telefone || 'Sem contato'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 border-border hover:bg-muted" onClick={() => {/* TODO: perfil */ }}>
            <ExternalLink className="h-4 w-4" />
            Perfil
          </Button>
          <Button onClick={() => setIniciandoMyID(true)} className="bg-identidade hover:bg-identidade/90 text-white gap-2">
            <AlignCenter className="h-4 w-4" /> Nova Avaliação
          </Button>
        </div>
      </div>

      {/* Links Compactos */}
      <div className="clinical-card !p-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Link Agenda */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <CalendarDays className="h-4 w-4 text-accent shrink-0" />
            <span className="text-xs font-semibold shrink-0">Agenda</span>
            {linkAgendaAtivo ? (
              <>
                <div className="h-2 w-2 rounded-full bg-success animate-pulse shrink-0" />
                <span className="text-[10px] text-success shrink-0">{differenceInDays(new Date(linkAgendaAtivo.data_expiracao), new Date())}d</span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copiarAgendaLink(linkAgendaAtivo.token)}>
                  <Copy className="h-3 w-3" />
                </Button>
                {paciente.telefone && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-success"
                    onClick={() => shareAgendaLink(`${paciente.nome} ${paciente.sobrenome}`, paciente.telefone!, getAgendaUrl(linkAgendaAtivo.token))}>
                    <MessageCircle className="h-3 w-3" />
                  </Button>
                )}
              </>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-accent" disabled={gerandoAgenda}
                onClick={gerarLinkAgenda}>
                {gerandoAgenda ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Gerar
              </Button>
            )}
          </div>

          <div className="h-6 w-px bg-border shrink-0" />

          {/* Link MyID (Novo) */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Fingerprint className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-semibold shrink-0 text-primary">MyID (Novo)</span>
            {linkMyIDAtivo ? (
              <>
                <div className="h-2 w-2 rounded-full bg-success animate-pulse shrink-0" />
                <span className="text-[10px] text-success shrink-0">Pendente</span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copiarMyIDLink(linkMyIDAtivo.token_acesso)}>
                  <Copy className="h-3 w-3" />
                </Button>
                {paciente.telefone && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-success"
                    onClick={() => shareAvaliacaoLink(`${paciente.nome} ${paciente.sobrenome}`, paciente.telefone!, `${window.location.origin}/myid/responder/${linkMyIDAtivo.token_acesso}`)}>
                    <MessageCircle className="h-3 w-3" />
                  </Button>
                )}
              </>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-primary" disabled={gerandoMyIDLink}
                onClick={gerarLinkMyID}>
                {gerandoMyIDLink ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Gerar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Nível 1: Barra Principal de Ferramentas (Studio Mode) */}
      <Tabs defaultValue="avaliacao" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-10 bg-muted/60 mb-6">
          <TabsTrigger value="avaliacao" className="text-xs gap-1 data-[state=active]:bg-identidade data-[state=active]:text-white">
            <ClipboardList className="h-3.5 w-3.5" /> Avaliação
          </TabsTrigger>
          <TabsTrigger value="treinos" className="text-xs gap-1 data-[state=active]:bg-identidade data-[state=active]:text-white">
            <Dumbbell className="h-3.5 w-3.5" /> Treinos
          </TabsTrigger>
          <TabsTrigger value="evolucao" className="text-xs gap-1 data-[state=active]:bg-identidade data-[state=active]:text-white">
            <BarChart3 className="h-3.5 w-3.5" /> Evolução
          </TabsTrigger>
          <TabsTrigger value="notas" className="text-xs gap-1 data-[state=active]:bg-identidade data-[state=active]:text-white">
            <StickyNote className="h-3.5 w-3.5" /> Notas
          </TabsTrigger>
        </TabsList>

        {/* --- Aba 1: AVALIAÇÃO (Contém a interface antiga Inteira) --- */}
        <TabsContent value="avaliacao" className="mt-0">
          <Tabs defaultValue="integrada">
            <TabsList className="bg-secondary p-1 rounded-xl flex-wrap h-auto min-h-11">
              <TabsTrigger value="integrada" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-identidade">
                <Fingerprint className="h-4 w-4" /> Visão Integrada
              </TabsTrigger>
              <TabsTrigger value="respostas" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-identidade">
                <FileText className="h-4 w-4" /> Avaliação Remota & Agenda
              </TabsTrigger>
              <TabsTrigger value="myid" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-identidade">
                <Presentation className="h-4 w-4" /> Avaliação Presencial
              </TabsTrigger>
              <TabsTrigger value="avaliacoes" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-identidade">
                <Target className="h-4 w-4" /> Protocolos & Serviços
              </TabsTrigger>
            </TabsList>

            <TabsContent value="integrada" className="mt-4">
              <PatientIntegratedDashboard pacienteId={paciente.id} serviceType="identidade" />
            </TabsContent>

            <TabsContent value="myid" className="mt-4">
              <div className="space-y-6">
                {/* ── Avaliação Estrutural (Unidades Corporais) ── */}
                {showStructural ? (
                  <StructuralWizard
                    initialData={structuralData}
                    onComplete={async (sData) => {
                      setStructuralData(sData);
                      setShowStructural(false);
                      setLastSavedData(sData); // Show results immediately from memory
                      // Salvar no Supabase
                      const { error } = await (supabase as any).from('avaliacoes_identidade').insert({
                        paciente_id: paciente.id,
                        terapeuta_id: user?.id,
                        dados_avaliacao: { _type: 'structural', ...sData } as any,
                        paciente_nome: `${paciente.nome} ${paciente.sobrenome}`,
                        score_e: sData.scoreStructuralGeneral,
                        data_avaliacao: new Date().toLocaleDateString('pt-BR'),
                        classificacao: sData.classification || null,
                      });
                      if (error) {
                        console.error('Erro ao salvar avaliação estrutural:', error);
                        toast({ title: 'Erro ao salvar no banco', description: error.message, variant: 'destructive' });
                      } else {
                        refetchStructural();
                        toast({ title: 'Avaliação Estrutural salva! ✅', description: `Score geral: ${sData.scoreStructuralGeneral.toFixed(1)}` });
                      }
                    }}
                    onBack={() => setShowStructural(false)}
                  />
                ) : lastSavedData ? (
                  /* Show results directly from memory after saving */
                  <div className="space-y-4">
                    <div className="clinical-card bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                            <CheckCircle2 className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm text-emerald-800">Avaliação Estrutural Salva</h3>
                            <p className="text-xs text-emerald-600">Resultados completos e Cardápio de Técnicas</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => setShowReport({ structural: lastSavedData, myid: myidAvaliacoes[0]?.resultado_processado })}>
                            <FileText className="h-3 w-3" /> Gerar PDF
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => { setLastSavedData(null); setShowStructural(true); }}>
                            <Activity className="h-3 w-3" /> Nova Avaliação
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => setLastSavedData(null)}>
                            Fechar
                          </Button>
                        </div>
                      </div>
                    </div>
                    <StructuralResultsSummary data={lastSavedData} />
                  </div>
                ) : (
                  <div className="clinical-card">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                          <Activity className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm">Avaliação Estrutural — Unidades ID</h3>
                          <p className="text-xs text-muted-foreground">8 Unidades Funcionais · Testes baseados em evidências</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => setShowStructural(true)}
                        className="bg-identidade hover:bg-identidade/90 text-white gap-2"
                      >
                        <Activity className="h-4 w-4" />
                        {structuralAvaliacoes.length > 0 ? 'Nova Avaliação' : 'Iniciar Avaliação'}
                      </Button>
                    </div>

                    {structuralAvaliacoes.length > 0 ? (
                      <div className="space-y-3">
                        {structuralAvaliacoes.slice(0, 3).map((av: any) => {
                          const dados = av.dados_avaliacao as any as StructuralAssessmentData | null;
                          if (!dados) return null;
                          const score = dados?.scoreStructuralGeneral ?? Number(av.score_e) ?? 0;
                          const isExpanded = expandedStructuralId === av.id;
                          return (
                            <div key={av.id} className="rounded-lg border bg-muted/20">
                              <div className="flex items-center gap-3 p-3">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                  <div className="min-w-0">
                                    <span className="text-sm font-medium">{av.data_avaliacao || 'Avaliação'}</span>
                                    <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                                      {dados.units && Object.entries(dados.units).slice(0, 4).map(([unitId, unit]: [string, any]) => {
                                        const cfg = UNIT_CONFIGS.find(c => c.id === unitId);
                                        return (
                                          <span key={unitId} className="flex items-center gap-0.5">
                                            {cfg?.emoji} <span className={classifyScoreColor(unit.score)}>{unit.score.toFixed(1)}</span>
                                          </span>
                                        );
                                      })}
                                      {dados.units && Object.keys(dados.units).length > 4 && (
                                        <span className="text-muted-foreground">+{Object.keys(dados.units).length - 4}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right shrink-0 mr-2">
                                  <div className={`text-lg font-black ${classifyScoreColor(score)}`}>{score.toFixed(1)}</div>
                                  <div className="text-[10px] text-muted-foreground">{classifyScore(score)}</div>
                                </div>
                                <Button
                                  size="sm"
                                  variant={isExpanded ? 'outline' : 'default'}
                                  className={isExpanded ? 'gap-1 text-xs' : 'bg-identidade hover:bg-identidade/90 text-white gap-1 text-xs'}
                                  onClick={() => setExpandedStructuralId(isExpanded ? null : av.id)}
                                >
                                  <FileText className="h-3 w-3" />
                                  {isExpanded ? 'Fechar' : 'Resultados & Diretriz'}
                                </Button>
                              </div>
                              {isExpanded && (
                                <div className="p-3 pt-0">
                                  <StructuralResultsSummary data={dados} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Nenhuma avaliação estrutural registrada</p>
                        <p className="text-xs mt-1">Avalie as 8 unidades corporais do paciente individualmente.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── MyID Presencial ── */}
                {!showStructural && (
                  <>
                    {iniciandoMyID ? (
                      <div className="bg-white rounded-xl shadow-sm border p-4 relative">
                        <Button variant="ghost" className="mb-4 absolute top-2 right-2" size="sm" onClick={() => setIniciandoMyID(false)}>Voltar</Button>
                        <MyIDWizard onComplete={async (result, rawData) => {
                          await supabase.from('myid_avaliacoes').insert({
                            terapeuta_id: user?.id,
                            paciente_id: paciente.id,
                            status: 'concluido',
                            respostas_brutas: rawData,
                            resultado_processado: result,
                          });
                          refetchMyID();
                          setIniciandoMyID(false);
                          toast({ title: 'MyID Salvo!', description: 'Avaliação registrada com sucesso.' });
                        }} />
                      </div>
                    ) : myidAvaliacoes.length > 0 ? (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
                          <div>
                            <h3 className="font-bold text-lg text-primary">Último MyID ({format(new Date(myidAvaliacoes[0].created_at), 'dd/MM/yyyy')})</h3>
                            <p className="text-sm text-gray-500">Resultado da impressão digital sistêmica.</p>
                          </div>
                          <Button onClick={() => setIniciandoMyID(true)}>Refazer Avaliação</Button>
                        </div>
                        {myidAvaliacoes[0].resultado_processado && (
                          <div className="bg-white p-4 rounded-xl border shadow-sm">
                            <MyIDResult result={myidAvaliacoes[0].resultado_processado} />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed bg-white/50">
                        <UserCircle className="h-10 w-10 mx-auto mb-3 opacity-30 text-primary" />
                        <p className="font-medium text-lg text-gray-700">Nenhum MyID registrado</p>
                        <p className="text-sm mt-1 mb-6 max-w-md mx-auto">O questionário MyID é a base do Método Identidade para mapear Numerador e Denominador sistêmico.</p>
                        <Button onClick={() => setIniciandoMyID(true)} className="px-8">Preencher Novo MyID</Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            {/* Aba: Questionários Remotos */}
            <TabsContent value="respostas" className="mt-4">
              <QuestionariosComparacao linksAvPaciente={linksAvPaciente} respostas={respostas} />
            </TabsContent>

            {/* Aba: Avaliações de Serviços */}
            <TabsContent value="avaliacoes" className="mt-4">
              {(ultimaCob || ultimaMedidaStudio || structuralAvaliacoes.length > 0) ? (
                <div className="space-y-4">
                  {/* Structural evaluations */}
                  {structuralAvaliacoes.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-orange-500" />
                        <h3 className="font-semibold text-sm">Avaliações Estruturais</h3>
                        <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">{structuralAvaliacoes.length}</Badge>
                      </div>
                      {structuralAvaliacoes.slice(0, 3).map((av: any) => {
                        const dados = av.dados_estruturais as StructuralAssessmentData | null;
                        if (!dados) return null;
                        const score = dados.scoreStructuralGeneral || 0;
                        const isOpen = expandedStructuralId === `proto-${av.id}`;
                        return (
                          <div key={av.id} className="clinical-card border-l-4 border-orange-400">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                                <Activity className="h-4 w-4 text-orange-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-medium">{av.data_avaliacao || 'Avaliação Estrutural'}</span>
                                <div className="text-[10px] text-muted-foreground">
                                  Score: <span className={classifyScoreColor(score)}>{score.toFixed(1)}</span> · {classifyScore(score)}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant={isOpen ? 'outline' : 'default'}
                                className={isOpen ? 'gap-1 text-xs' : 'bg-identidade hover:bg-identidade/90 text-white gap-1 text-xs'}
                                onClick={() => setExpandedStructuralId(isOpen ? null : `proto-${av.id}`)}
                              >
                                <FileText className="h-3 w-3" />
                                {isOpen ? 'Fechar' : 'Resultados & Diretriz'}
                              </Button>
                            </div>
                            {isOpen && (
                              <div className="mt-3 pt-3 border-t">
                                <StructuralResultsSummary data={dados} />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* COB + Studio cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {ultimaCob && (
                      <div className="clinical-card border-l-4 border-l-blue-500 bg-blue-50/30">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
                            <AlignCenter className="h-4 w-4 text-white" />
                          </div>
                          <h4 className="font-bold text-xs text-blue-900">Exame COB° ZERO</h4>
                          <Badge variant="outline" className="ml-auto text-[10px] bg-white">{ultimaCob.data_avaliacao}</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-white/60 rounded-lg p-2 border border-blue-100">
                            <div className="text-xs font-black text-blue-700">{ultimaCob.cobb_angle}°</div>
                            <div className="text-[10px] text-muted-foreground">Ângulo</div>
                          </div>
                          <div className="bg-white/60 rounded-lg p-2 border border-blue-100">
                            <div className="text-xs font-black text-blue-700">{ultimaCob.risco_percentage}%</div>
                            <div className="text-[10px] text-muted-foreground">Risco</div>
                          </div>
                          <div className="bg-white/60 rounded-lg p-2 border border-blue-100">
                            <div className="text-xs font-black text-blue-700">{ultimaCob.score_e || '—'}</div>
                            <div className="text-[10px] text-muted-foreground">Score E</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {ultimaMedidaStudio && (
                      <div className="clinical-card border-l-4 border-l-studio bg-studio-light/10">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-7 w-7 rounded-lg bg-studio flex items-center justify-center">
                            <Dumbbell className="h-4 w-4 text-white" />
                          </div>
                          <h4 className="font-bold text-xs text-studio-foreground">Studio Personal ID</h4>
                          <Badge variant="outline" className="ml-auto text-[10px] bg-white">{format(new Date(ultimaMedidaStudio.data_medida), 'dd/MM/yy')}</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-white/60 rounded-lg p-2 border border-studio/10">
                            <div className="text-xs font-black text-studio">{ultimaMedidaStudio.peso}kg</div>
                            <div className="text-[10px] text-muted-foreground">Peso</div>
                          </div>
                          <div className="bg-white/60 rounded-lg p-2 border border-studio/10">
                            <div className="text-xs font-black text-studio">{ultimaMedidaStudio.percentual_gordura}%</div>
                            <div className="text-[10px] text-muted-foreground">% Gord.</div>
                          </div>
                          <div className="bg-white/60 rounded-lg p-2 border border-studio/10">
                            <div className="text-xs font-black text-studio">{ultimaMedidaStudio.imc || '—'}</div>
                            <div className="text-[10px] text-muted-foreground">IMC</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed">
                  <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Nenhuma avaliação de serviços</p>
                  <p className="text-sm mt-1">As avaliações de serviços aparecerão aqui quando disponíveis.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* --- Aba 2: TREINOS --- */}
        <TabsContent value="treinos" className="mt-4">
          <StudioTreinosTab pacienteId={paciente.id} pacienteNome={`${paciente.nome} ${paciente.sobrenome}`} />
        </TabsContent>

        {/* --- Aba 3: EVOLUÇÃO --- */}
        <TabsContent value="evolucao" className="mt-4">
          <StudioEvolucaoTab pacienteId={paciente.id} />
        </TabsContent>

        {/* --- Aba 4: NOTAS --- */}
        <TabsContent value="notas" className="mt-4">
          <StudioNotasTab pacienteId={paciente.id} />
        </TabsContent>
      </Tabs>

      {/* PDF Report Modal */}
      {showReport && (
        <TreatmentReportPDF
          pacienteNome={`${paciente.nome} ${paciente.sobrenome}`}
          terapeutaNome={user?.user_metadata?.nome || 'Terapeuta'}
          dataAvaliacao={new Date().toLocaleDateString('pt-BR')}
          myidResult={showReport.myid}
          structuralData={showReport.structural}
          onClose={() => setShowReport(null)}
        />
      )}
    </div>
  );
}
