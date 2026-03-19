import { useState, useEffect } from 'react';
import { ArrowLeft, Target, Link2, Copy, MessageCircle, Mail, Plus, Loader2, FileText, Calendar, BarChart3, CalendarDays, Dumbbell, AlignCenter, Fingerprint, UserCircle, ExternalLink, Presentation, Activity, CheckCircle2, ClipboardList, StickyNote, Smartphone, Download, Mic } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLinksAvaliacao } from '@/hooks/useLinksAvaliacao';
import { supabase } from '@/integrations/supabase/client';
import { gerarNotaAvaliacaoProfissional } from '@/utils/prontuarioAutoNotes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { shareAvaliacaoLink, shareAgendaLink } from '@/utils/whatsapp';
import { getAgendaUrl, getBaseUrl } from '@/utils/linkUrls';
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
import VoiceAssessment from '@/components/voice/VoiceAssessment';
import StudioTreinosTab from '@/components/studio/StudioTreinosTab';
import StudioEvolucaoTab from '@/components/studio/StudioEvolucaoTab';
import StudioNotasTab from '@/components/studio/StudioNotasTab';
import PacienteProtocolosTab from './PacienteProtocolosTab';
import { gerarPDFRespostaCompleta } from '@/utils/pdfRespostaCompleta';

interface Paciente {
  id: string;
  nome: string;
  sobrenome: string;
  email?: string | null;
  telefone?: string | null;
  portal_token?: string | null;
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

  // Realtime: auto-refresh when myid_avaliacoes changes for this patient
  useEffect(() => {
    const channel = supabase
      .channel(`myid-realtime-${paciente.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'myid_avaliacoes',
          filter: `paciente_id=eq.${paciente.id}`,
        },
        () => {
          refetchMyID();
          refetchLinksMyID();
          qc.invalidateQueries({ queryKey: ['integrated-myid-link', paciente.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [paciente.id, refetchMyID, refetchLinksMyID, qc]);

  const [iniciandoMyID, setIniciandoMyID] = useState(false);
  const [showStructural, setShowStructural] = useState(false);
  const [structuralData, setStructuralData] = useState<StructuralAssessmentData>(createDefaultAssessment());
  const [expandedStructuralId, setExpandedStructuralId] = useState<string | null>(null);
  const [expandedMyIDId, setExpandedMyIDId] = useState<string | null>(null);
  const [lastSavedData, setLastSavedData] = useState<StructuralAssessmentData | null>(null);
  const [showReport, setShowReport] = useState<{ structural?: StructuralAssessmentData; myid?: any } | null>(null);
  const [gerandoRespostaCompleta, setGerandoRespostaCompleta] = useState(false);

  const handleRespostaCompleta = async () => {
    if (!user) return;
    setGerandoRespostaCompleta(true);
    try {
      // If no MyID data, try fetching the latest evaluation directly
      let latestMyID = ultimaMyID;
      if (!latestMyID) {
        const { data } = await supabase
          .from('avaliacoes_identidade')
          .select('*')
          .eq('paciente_id', paciente.id)
          .not('myid_score', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        latestMyID = data;
      }

      if (!latestMyID) {
        toast({ title: 'Avaliação não encontrada', description: 'Complete uma avaliação MyID antes de gerar o relatório.', variant: 'destructive' });
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('nome, sobrenome')
        .eq('user_id', user.id)
        .maybeSingle();
      const terapeutaNome = profile ? `${profile.nome} ${profile.sobrenome}` : (user.email?.split('@')[0] || 'Terapeuta');

      const avaliacao = {
        resultado: {
          myidScore: latestMyID.myid_score ?? 0,
          componentScores: {
            D: latestMyID.score_d ?? 0,
            EFI: latestMyID.score_efi ?? 0,
            P: latestMyID.score_p ?? 0,
            I: latestMyID.score_i ?? 0,
            R: latestMyID.score_r ?? 0,
            C: latestMyID.score_c ?? 0,
            N: latestMyID.score_n ?? 0,
          },
          redFlagsDetected: !!(latestMyID.red_flags as any)?.detected,
          redFlagAlerts: (latestMyID.red_flags as any)?.alerts || [],
          classificacao: latestMyID.classificacao || '',
        },
      };

      await gerarPDFRespostaCompleta({
        avaliacao: avaliacao as any,
        pacienteId: paciente.id,
        terapeutaNome,
      });
      toast({ title: '📄 PDF Gerado!', description: 'Resposta Completa baixada com sucesso.' });
    } catch (err) {
      console.error('Erro ao gerar PDF Resposta Completa:', err);
      toast({ title: 'Erro', description: 'Não foi possível gerar o PDF.', variant: 'destructive' });
    } finally {
      setGerandoRespostaCompleta(false);
    }
  };

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
          <div className="h-10 w-10 flex-shrink-0 rounded-full bg-identidade flex items-center justify-center text-identidade-foreground font-bold">
            {paciente.nome[0]}{paciente.sobrenome?.[0] || ''}
          </div>
          <div className="flex flex-wrap md:flex-nowrap items-center gap-4 md:gap-8">
            <div>
              <h2 className="text-lg md:text-xl font-bold text-foreground leading-tight">{paciente.nome} {paciente.sobrenome}</h2>
              <p className="text-xs md:text-sm text-muted-foreground">{paciente.telefone || paciente.email || 'Sem contato'}</p>
            </div>

            {/* Botões de Ação Dinâmicos (Ao lado do nome) */}
            <div className="flex items-center gap-4 md:gap-5 pt-1">
              {/* MYID */}
              <div className="flex flex-col flex-shrink-0 items-center justify-center gap-1">
                <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground tracking-wider uppercase">MyID</span>
                <div className="flex gap-1">
                  {linkMyIDAtivo ? (
                    <>
                      <Button size="icon" variant="outline" className="h-[24px] w-[24px] md:h-[28px] md:w-[28px] rounded-lg border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800" onClick={() => copiarMyIDLink(linkMyIDAtivo.token_acesso)} title="Copiar Link MyID">
                        <Copy className="h-3 w-3 md:h-3.5 md:w-3.5" />
                      </Button>
                      {paciente.telefone && (
                        <Button size="icon" className="h-[24px] w-[24px] md:h-[28px] md:w-[28px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => shareAvaliacaoLink(`${paciente.nome} ${paciente.sobrenome}`, paciente.telefone!, `${window.location.origin}/myid/responder/${linkMyIDAtivo.token_acesso}`)} title="Enviar no WhatsApp">
                          <Smartphone className="h-3 w-3 md:h-3.5 md:w-3.5" />
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button size="icon" variant="outline" className="h-[24px] w-[24px] md:h-[28px] md:w-[28px] rounded-lg border-dashed text-primary/80" disabled={gerandoMyIDLink} onClick={gerarLinkMyID} title="Gerar Link MyID">
                      {gerandoMyIDLink ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 md:h-3.5 md:w-3.5" />}
                    </Button>
                  )}
                </div>
              </div>

              {/* AGENDA */}
              <div className="flex flex-col flex-shrink-0 items-center justify-center gap-1">
                <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Agenda</span>
                <div className="flex gap-1">
                  {linkAgendaAtivo ? (
                    <>
                      <Button size="icon" variant="outline" className="h-[24px] w-[24px] md:h-[28px] md:w-[28px] rounded-lg border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800" onClick={() => copiarAgendaLink(linkAgendaAtivo.token)} title="Copiar Link Agenda">
                        <Copy className="h-3 w-3 md:h-3.5 md:w-3.5" />
                      </Button>
                      {paciente.telefone && (
                        <Button size="icon" className="h-[24px] w-[24px] md:h-[28px] md:w-[28px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => shareAgendaLink(`${paciente.nome} ${paciente.sobrenome}`, paciente.telefone!, getAgendaUrl(linkAgendaAtivo.token))} title="Enviar no WhatsApp">
                          <Smartphone className="h-3 w-3 md:h-3.5 md:w-3.5" />
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button size="icon" variant="outline" className="h-[24px] w-[24px] md:h-[28px] md:w-[28px] rounded-lg border-dashed text-accent/80" disabled={gerandoAgenda} onClick={gerarLinkAgenda} title="Gerar Link Agenda">
                      {gerandoAgenda ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 md:h-3.5 md:w-3.5" />}
                    </Button>
                  )}
                </div>
              {/* PORTAL */}
              {paciente.portal_token && (
                <div className="flex flex-col flex-shrink-0 items-center justify-center gap-1">
                  <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Portal</span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="outline" className="h-[24px] w-[24px] md:h-[28px] md:w-[28px] rounded-lg border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800" onClick={() => { navigator.clipboard.writeText(`${getBaseUrl()}/paciente/login?token=${paciente.portal_token}`); toast({ title: 'Link do Portal copiado! 🔗' }); }} title="Copiar Link do Portal">
                      <Copy className="h-3 w-3 md:h-3.5 md:w-3.5" />
                    </Button>
                    {paciente.telefone && (
                      <Button size="icon" className="h-[24px] w-[24px] md:h-[28px] md:w-[28px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => { const url = `${getBaseUrl()}/paciente/login?token=${paciente.portal_token}`; const msg = `Olá ${paciente.nome}! 🩺\n\nAcesse seu Portal do Paciente:\n${url}`; window.open(`https://wa.me/${paciente.telefone!.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank'); }} title="Enviar Portal via WhatsApp">
                        <Smartphone className="h-3 w-3 md:h-3.5 md:w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
             </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Outros botões como perfil e nova avaliação... */}
          <Button variant="outline" size="sm" className="hidden sm:flex gap-2 border-border hover:bg-muted" onClick={() => {/* TODO: perfil */ }}>
            <ExternalLink className="h-4 w-4" />
            Perfil
          </Button>
          <Button onClick={() => setIniciandoMyID(true)} className="hidden sm:flex bg-identidade hover:bg-identidade/90 text-white gap-2">
            <AlignCenter className="h-4 w-4" /> Nova Avaliação
          </Button>
        </div>
      </div>

      {/* Nível 1: Barra Principal de Ferramentas (Studio Mode) */}
      <Tabs defaultValue="avaliacao" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-10 bg-muted/60 mb-6">
          <TabsTrigger value="avaliacao" className="text-xs gap-1 data-[state=active]:bg-identidade data-[state=active]:text-white">
            <ClipboardList className="h-3.5 w-3.5" /> Avaliação
          </TabsTrigger>
          <TabsTrigger value="treinos" className="text-xs gap-1 data-[state=active]:bg-identidade data-[state=active]:text-white">
            <Dumbbell className="h-3.5 w-3.5" /> Treinos
          </TabsTrigger>
          <TabsTrigger value="prontuario" className="text-xs gap-1 data-[state=active]:bg-identidade data-[state=active]:text-white">
            <StickyNote className="h-3.5 w-3.5" /> Evoluções e Prontuário
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
                <Target className="h-4 w-4" /> Diretrizes e Serviços
              </TabsTrigger>
            </TabsList>

            {/* Botão Resposta Completa - após as sub-abas */}
            <div className="flex justify-end mt-2">
              <Button
                size="sm"
                className="gap-1.5 bg-gradient-to-r from-primary to-accent text-primary-foreground"
                onClick={handleRespostaCompleta}
                disabled={gerandoRespostaCompleta}
              >
                {gerandoRespostaCompleta ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Resposta Completa
              </Button>
            </div>

            <TabsContent value="integrada" className="mt-4">
              <PatientIntegratedDashboard pacienteId={paciente.id} serviceType="identidade" />
            </TabsContent>

            <TabsContent value="voz" className="mt-4">
              <VoiceAssessment
                serviceType="identidade"
                pacienteId={paciente.id}
                patientName={`${paciente.nome} ${paciente.sobrenome}`}
              />
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
                        // Auto-generate prontuário note with rehab timeline
                        const { generateRehabInsights, generateEngagementSummary } = await import('@/utils/tissueHealingTimelines');
                        const rehabInsights = generateRehabInsights(sData.units);
                        const rehabSummary = generateEngagementSummary(rehabInsights);
                        
                        gerarNotaAvaliacaoProfissional({
                          pacienteId: paciente.id,
                          terapeutaId: user?.id || '',
                          tipoAvaliacao: 'identidade',
                          resumoScores: { 'Score Estrutural': sData.scoreStructuralGeneral },
                          classificacao: sData.classification || undefined,
                          observacoes: `Avaliação Estrutural (Unidades ID) realizada presencialmente.\n\n${rehabSummary}`,
                        });
                        refetchStructural();
                        toast({ title: 'Avaliação Estrutural salva! ✅', description: `Score geral: ${Number(sData.scoreStructuralGeneral).toFixed(1)}` });
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
                          const score = dados?.scoreStructuralGeneral ?? Number(av.score_e || 0);
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
                                            {cfg?.emoji} <span className={classifyScoreColor(unit.score)}>{Number(unit.score).toFixed(1)}</span>
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
                                  <div className={`text-lg font-black ${classifyScoreColor(score)}`}>{Number(score).toFixed(1)}</div>
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
                    ) : (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
                          <div>
                            <h3 className="font-bold text-lg text-primary">Avaliações MyID</h3>
                            <p className="text-sm text-gray-500">Histórico da impressão digital sistêmica.</p>
                          </div>
                          <Button onClick={() => setIniciandoMyID(true)}>Nova Avaliação</Button>
                        </div>

                        {myidAvaliacoes.length > 0 ? (
                          <div className="space-y-3">
                            {myidAvaliacoes.map((av: any) => {
                              const isExpanded = expandedMyIDId === av.id;
                              const result = av.resultado_processado;
                              return (
                                <div key={av.id} className="rounded-xl border bg-white shadow-sm overflow-hidden">
                                  <div
                                    className={`flex items-center gap-3 p-4 cursor-pointer transition-all hover:bg-slate-50 ${isExpanded ? 'bg-slate-50 border-b' : ''}`}
                                    onClick={() => setExpandedMyIDId(isExpanded ? null : av.id)}
                                  >
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                      <Fingerprint className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold">
                                          {format(new Date(av.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                        </span>
                                        <Badge variant="outline" className="text-[10px] h-4">ID #{av.id.slice(0, 4)}</Badge>
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                        <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${getMyIDSeverityColor(result?.classificacao || '')}`}>
                                          {result?.myidStatus || 'Processando...'}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0 mr-2">
                                      <div className="text-2xl font-black text-primary">
                                        {result?.myidScore?.toFixed(1) || '0.0'}
                                      </div>
                                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">MyID Score</div>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 w-8 p-0"
                                    >
                                      <FileText className={`h-4 w-4 transition-transform ${isExpanded ? 'text-primary' : 'text-muted-foreground'}`} />
                                    </Button>
                                  </div>
                                  {isExpanded && result && (
                                    <div className="p-4 bg-white animate-in fade-in slide-in-from-top-2 duration-300">
                                      <MyIDResult result={result} rawData={av.respostas_brutas} />
                                      <div className="mt-4 flex justify-end">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-xs gap-2"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setShowReport({ myid: result });
                                          }}
                                        >
                                          <FileText className="h-3.5 w-3.5" />
                                          Gerar PDF
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed bg-white/50">
                            <UserCircle className="h-10 w-10 mx-auto mb-3 opacity-30 text-primary" />
                            <p className="font-medium text-lg text-gray-700">Nenhum MyID registrado</p>
                            <p className="text-sm mt-1 mb-6 max-w-md mx-auto">O questionário MyID é a base do Método Identidade para mapear Numerador e Denominador sistêmico.</p>
                            <Button onClick={() => setIniciandoMyID(true)} className="px-8">Preencher Novo MyID</Button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            {/* Aba: Questionários Remotos */}
            <TabsContent value="respostas" className="mt-4">
              <QuestionariosComparacao
                linksAvPaciente={linksAvPaciente}
                respostas={respostas}
                myidAvaliacoes={myidAvaliacoes}
              />
            </TabsContent>

            {/* Aba: Diretrizes e Serviços (Repositório) */}
            <TabsContent value="avaliacoes" className="mt-4">
              <PacienteProtocolosTab
                pacienteId={paciente.id}
                pacienteNome={`${paciente.nome} ${paciente.sobrenome}`}
                tipo="identidade"
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* --- Aba 2: TREINOS --- */}
        <TabsContent value="treinos" className="mt-4">
          <StudioTreinosTab pacienteId={paciente.id} pacienteNome={`${paciente.nome} ${paciente.sobrenome}`} />
        </TabsContent>


        {/* --- Aba 4: EVOLUÇÕES E PRONTUÁRIO --- */}
        <TabsContent value="prontuario" className="mt-4">
          <StudioNotasTab pacienteId={paciente.id} showSummary={true} />
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
