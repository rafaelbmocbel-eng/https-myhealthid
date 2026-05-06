import { useState, useEffect } from 'react';
import { ArrowLeft, Target, Link2, Copy, MessageCircle, Mail, Plus, Loader2, FileText, Calendar, BarChart3, CalendarDays, Dumbbell, AlignCenter, Fingerprint, UserCircle, ExternalLink, Presentation, Activity, CheckCircle2, ClipboardList, StickyNote, Smartphone, Download, Mic, Eye, ChevronDown, Edit3, Save, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useLinksAvaliacao } from '@/hooks/useLinksAvaliacao';
import { supabase } from '@/integrations/supabase/client';
import { gerarNotaAvaliacaoProfissional } from '@/utils/prontuarioAutoNotes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { shareAvaliacaoLink, shareAgendaLink } from '@/utils/whatsapp';
import { getAgendaUrl, getBaseUrl, getPortalUrl } from '@/utils/linkUrls';
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
import PacienteProtocolosTab from './PacienteProtocolosTab';

import { gerarPDFRespostaCompleta } from '@/utils/pdfRespostaCompleta';
import ProntuarioTimeline from './ProntuarioTimeline';
import ResumoProntuario from './ResumoProntuario';
import { useNotasProntuario } from '@/hooks/useNotasProntuario';
import CIFSuggestionPanel from '@/components/cif/CIFSuggestionPanel';
import { generateCIFSuggestions } from '@/utils/cifMapping';
import PacoteBadge from './PacoteBadge';
import LinkActionsBar, { type LinkActionItem } from './LinkActionsBar';

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
  /** Controla qual sub-aba é exibida. 'integrada' | 'historico' | 'myid' | 'avaliacoes'. Default: 'integrada' */
  subTab?: 'integrada' | 'historico' | 'myid' | 'avaliacoes';
}

export default function PacienteDashboardIdentidade({ paciente, onBack, subTab }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { links, gerarLink, copiarLink, getLinkUrl, gerando } = useLinksAvaliacao();
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [gerandoAgenda, setGerandoAgenda] = useState(false);
  const { notas: notasProntuario, isLoading: loadingNotas } = useNotasProntuario(paciente.id);

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
    const url = `${getBaseUrl()}/myid/responder/${token}`;
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

  // Auto-sync MyID results to prontuário (online e presencial)
  useEffect(() => {
    if (!user || myidAvaliacoes.length === 0) return;
    const syncMyIDNotes = async () => {
      const ids = myidAvaliacoes.filter((av: any) => av.resultado_processado).map((av: any) => av.id);
      if (ids.length === 0) return;

      const { data: existing } = await supabase
        .from('notas_prontuario')
        .select('referencia_id')
        .eq('paciente_id', paciente.id)
        .eq('tipo', 'myid_resposta')
        .in('referencia_id', ids);

      const existingIds = new Set((existing || []).map((n: any) => n.referencia_id));
      const missing = myidAvaliacoes.filter((av: any) => av.resultado_processado && !existingIds.has(av.id));

      for (const av of missing) {
        const result = (av.resultado_processado || {}) as any;
        const scores = result.componentScores || result.component_scores || {};
        const myidScoreRaw = result.myidScore ?? result.MyID_score ?? result.myid_100?.score ?? result.myid_100?.myid_score ?? 0;
        const classificacao = result.classificacao || result.myidStatus || result.myid_100?.classificacao || 'N/A';
        const redFlagsDetected = result.redFlagsDetected ?? result.red_flags_detected ?? false;
        const redFlagsList = result.redFlagAlerts || result.red_flag_alerts || result.red_flags || [];

        const scoreD = Number(scores.D ?? scores.D_pain ?? 0).toFixed(1);
        const scoreEFI = Number(scores.EFI ?? scores.EFI_functionality ?? 0).toFixed(1);
        const scoreP = Number(scores.P ?? scores.P_psychological ?? 0).toFixed(1);
        const scoreI = Number(scores.I ?? scores.I_inertia ?? 0).toFixed(1);
        const scoreN = Number(scores.N ?? scores.N_noise ?? 0).toFixed(1);
        const scoreR = Number(scores.R ?? scores.R_regulation ?? 0).toFixed(1);
        const scoreC = Number(scores.C ?? scores.C_context ?? 0).toFixed(1);

        const flagsText = redFlagsDetected && redFlagsList.length > 0
          ? `\n⚠️ Red Flags: ${redFlagsList.join(', ')}`
          : '';

        // Generate CIF codes from available data
        const cifResult = generateCIFSuggestions(
          { component_scores: scores },
          voiceAvaliacoes.length > 0 ? voiceAvaliacoes[0] : null,
          (() => {
            if (structuralAvaliacoes.length === 0) return null;
            const dados = (structuralAvaliacoes[0] as any).dados_avaliacao;
            return dados?._type === 'structural' ? dados : null;
          })(),
        );
        const cifText = cifResult.codes.length > 0
          ? `\n\n📋 CIF (Classificação Internacional de Funcionalidade):\n${cifResult.codes.slice(0, 10).map(c => `• ${c.code}.${c.qualifier} — ${c.description}`).join('\n')}`
          : '';

        const descricao = `🧬 MyID (online/presencial)\n\n🎯 Score MyID-100: ${Number(myidScoreRaw).toFixed(1)}/100 — ${classificacao}${flagsText}\n\n📊 Componentes:\n• Dor (D): ${scoreD}/10\n• Funcionalidade (EFI): ${scoreEFI}/10\n• Psicológico (P): ${scoreP}/10\n• Demanda (I): ${scoreI}/10\n• Ruído (N): ${scoreN}/10\n• Regulação (R): ${scoreR}/10\n• Contexto (C): ${scoreC}/10${cifText}`;

        try {
          await (supabase as any).from('notas_prontuario').insert({
            paciente_id: paciente.id,
            terapeuta_id: user.id,
            tipo: 'myid_resposta',
            titulo: `MyID — Score ${Number(myidScoreRaw).toFixed(1)}/100 (${classificacao})`,
            descricao,
            dados_extras: { myid_score: myidScoreRaw, classificacao, scores, cif_codes: cifResult.codes.map(c => ({ code: c.code, qualifier: c.qualifier, description: c.description, source: c.source })) },
            referencia_id: av.id,
          });
        } catch (err) {
          console.warn('Erro ao sincronizar MyID no prontuário:', err);
        }
      }

      if (missing.length > 0) {
        qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
      }
    };

    syncMyIDNotes();
  }, [user, myidAvaliacoes, paciente.id, qc]);

  const [iniciandoMyID, setIniciandoMyID] = useState(false);
  const [expandedMyIDId, setExpandedMyIDId] = useState<string | null>(null);
  const [deletingMyIDId, setDeletingMyIDId] = useState<string | null>(null);

  const handleDeleteMyID = async (id: string) => {
    setDeletingMyIDId(id);
    try {
      const { error } = await supabase
        .from('myid_avaliacoes')
        .delete()
        .eq('id', id)
        .eq('terapeuta_id', user!.id);
      if (error) throw error;

      // Limpa também a avaliação salva e nota de prontuário vinculada (se houver)
      await supabase
        .from('avaliacoes_identidade')
        .delete()
        .eq('paciente_id', paciente.id)
        .eq('terapeuta_id', user!.id)
        .filter('dados_avaliacao->>id', 'eq', id);

      toast({ title: '🗑️ MyID excluído', description: 'Resultado removido do histórico.' });
      if (expandedMyIDId === id) setExpandedMyIDId(null);
      refetchMyID();
      qc.invalidateQueries({ queryKey: ['avaliacoes-identidade'] });
      qc.invalidateQueries({ queryKey: ['evolucao-paciente'] });
      qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' });
    } finally {
      setDeletingMyIDId(null);
    }
  };

  const [showStructural, setShowStructural] = useState(false);
  const [structuralData, setStructuralData] = useState<StructuralAssessmentData>(createDefaultAssessment());
  const [expandedStructuralId, setExpandedStructuralId] = useState<string | null>(null);
  // expandedMyIDId já declarado acima junto com handleDeleteMyID
  const [expandedVoiceId, setExpandedVoiceId] = useState<string | null>(null);
  const [editingVoiceId, setEditingVoiceId] = useState<string | null>(null);
  const [editingVoiceText, setEditingVoiceText] = useState('');
  const [savingVoiceEdit, setSavingVoiceEdit] = useState(false);
  const [addingVoiceToId, setAddingVoiceToId] = useState<string | null>(null);
  const [lastSavedData, setLastSavedData] = useState<StructuralAssessmentData | null>(null);
  const [showReport, setShowReport] = useState<{ structural?: StructuralAssessmentData; myid?: any } | null>(null);
  const [gerandoRespostaCompleta, setGerandoRespostaCompleta] = useState(false);
  
  const [subTabInterna, setSubTabInterna] = useState<'integrada' | 'historico' | 'myid' | 'avaliacoes'>(subTab || 'integrada');
  // Sincroniza quando o pai controla a sub-aba
  useEffect(() => { if (subTab) setSubTabInterna(subTab); }, [subTab]);
  const subTabAtiva = subTabInterna;
  const setSubTabAtiva = setSubTabInterna;

  // Save voice edit and reprocess with AI
  const handleSaveVoiceEdit = async (avId: string, extraAudioBase64?: string, extraAudioMimeType?: string) => {
    setSavingVoiceEdit(true);
    try {
      // 1. Update transcription text
      const { error } = await (supabase as any).from('avaliacoes_voz').update({ transcricao: editingVoiceText }).eq('id', avId);
      if (error) throw error;

      // 2. Reprocess with AI using correct parameter name
      const av = voiceAvaliacoes.find((a: any) => a.id === avId);
      if (av) {
        const body: any = {
          transcript: editingVoiceText,
          serviceType: av.servico || 'identidade',
          patientName: patientName,
        };
        // If new audio was captured, include it for richer analysis
        if (extraAudioBase64) {
          body.audioBase64 = extraAudioBase64;
          body.audioMimeType = extraAudioMimeType || 'audio/webm';
        }

        toast({ title: '🧠 Reprocessando avaliação...', description: 'A IA está reanalisando com os dados atualizados.' });

        const { data, error: fnErr } = await supabase.functions.invoke('voice-assessment', { body });
        if (fnErr) throw fnErr;
        if (data?.error) throw new Error(data.error);

        if (data?.assessment) {
          const resultado = data.assessment;
          const cleanResult = JSON.parse(JSON.stringify(resultado));
          // Update transcription with AI-generated one if it returned more content
          const finalTranscript = data.transcricao && data.transcricao.length > editingVoiceText.length
            ? data.transcricao
            : editingVoiceText;

          await (supabase as any).from('avaliacoes_voz').update({
            resultado: cleanResult,
            transcricao: finalTranscript,
            queixa_principal: resultado.queixa_principal || av.queixa_principal,
            classificacao_severidade: resultado.classificacao_severidade || av.classificacao_severidade,
          }).eq('id', avId);
        }
      }

      // 3. Sync to prontuário
      if (user && av) {
        try {
          await (supabase as any).from('notas_prontuario').insert({
            paciente_id: paciente.id,
            terapeuta_id: user.id,
            tipo: 'avaliacao_voz',
            titulo: `Avaliação por Voz atualizada — ${av.classificacao_severidade || 'N/A'}`,
            descricao: `📝 Transcrição editada e reprocessada.\n\n${editingVoiceText.slice(0, 500)}`,
            dados_extras: { voice_assessment_id: avId },
            referencia_id: avId,
          });
        } catch {}
      }

      qc.invalidateQueries({ queryKey: ['avaliacoes-voz-presencial'] });
      qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
      qc.invalidateQueries({ queryKey: ['evolucao-paciente'] });
      setEditingVoiceId(null);
      toast({ title: 'Avaliação atualizada! ✅', description: 'Dados clínicos reprocessados pela IA com sucesso.' });
    } catch (e: any) {
      toast({ title: 'Erro ao reprocessar', description: e.message, variant: 'destructive' });
    } finally {
      setSavingVoiceEdit(false);
    }
  };

  // Sync existing voice assessment to prontuário
  const handleSyncVoiceToProntuario = async (av: any) => {
    if (!user) return;
    try {
      const resultado = av.resultado as any;

      // Generate CIF codes including voice data
      const cifResult = generateCIFSuggestions(
        ultimaMyID ? {
          component_scores: {
            D: ultimaMyID.score_d ?? 0, EFI: ultimaMyID.score_efi ?? 0,
            P: ultimaMyID.score_p ?? 0, I: ultimaMyID.score_i ?? 0,
            R: ultimaMyID.score_r ?? 0, C: ultimaMyID.score_c ?? 0,
          },
        } : null,
        av,
        (() => {
          if (structuralAvaliacoes.length === 0) return null;
          const dados = (structuralAvaliacoes[0] as any).dados_avaliacao;
          return dados?._type === 'structural' ? dados : null;
        })(),
      );
      const cifText = cifResult.codes.length > 0
        ? `\n\n📋 CIF:\n${cifResult.codes.slice(0, 8).map(c => `• ${c.code}.${c.qualifier} — ${c.description}`).join('\n')}`
        : '';

      await (supabase as any).from('notas_prontuario').insert({
        paciente_id: paciente.id,
        terapeuta_id: user.id,
        tipo: 'avaliacao_voz',
        titulo: `Avaliação por Voz — ${av.classificacao_severidade || 'N/A'} — ${format(new Date(av.created_at), 'dd/MM/yyyy', { locale: ptBR })}`,
        descricao: `🎙️ AVALIAÇÃO POR VOZ\n\n📋 Resumo: ${resultado?.resumo_clinico || 'N/A'}\n🩹 Dor EVA: ${resultado?.dor?.intensidade_eva || 'N/A'}/10\n📍 Local: ${resultado?.dor?.localizacao || 'N/A'}${cifText}\n\n📝 Transcrição:\n${av.transcricao?.slice(0, 500) || ''}`,
        dados_extras: { voice_assessment_id: av.id, resultado: resultado, cif_codes: cifResult.codes.map(c => ({ code: c.code, qualifier: c.qualifier, description: c.description, source: c.source })) },
        referencia_id: av.id,
      });
      qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
      toast({ title: 'Adicionado ao prontuário! ✅' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    }
  };

  const patientName = `${paciente.nome} ${paciente.sobrenome}`;

  // Buscar avaliações por voz do paciente
  const { data: voiceAvaliacoes = [], refetch: refetchVoice } = useQuery({
    queryKey: ['avaliacoes-voz-presencial', user?.id, paciente.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_voz')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .eq('paciente_id', paciente.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

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
      {/* Botão grande e destacado: Avaliação Presencial */}
      {subTabAtiva !== 'myid' && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Button
            size="lg"
            className="gap-2 bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-md hover:shadow-lg transition-all w-full sm:w-auto"
            onClick={() => setSubTabAtiva('myid')}
          >
            <Presentation className="h-5 w-5" />
            Iniciar Avaliação Presencial
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleRespostaCompleta}
            disabled={gerandoRespostaCompleta}
          >
            {gerandoRespostaCompleta ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Resposta Completa
          </Button>
        </div>
      )}

      {subTabAtiva === 'myid' && (
        <div className="flex items-center justify-between gap-3">
          <Button size="sm" variant="ghost" className="gap-2" onClick={() => setSubTabAtiva('integrada')}>
            <ArrowLeft className="h-4 w-4" /> Voltar à Visão Integrada
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleRespostaCompleta}
            disabled={gerandoRespostaCompleta}
          >
            {gerandoRespostaCompleta ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Resposta Completa
          </Button>
        </div>
      )}

      <Tabs value={subTabAtiva} onValueChange={(v) => setSubTabAtiva(v as typeof subTabAtiva)}>
            
            <TabsContent value="integrada" className="mt-4">
              <PatientIntegratedDashboard pacienteId={paciente.id} serviceType="identidade" />
            </TabsContent>




            <TabsContent value="myid" className="mt-4">
              <div className="space-y-6">
                {/* ── Avaliação por Voz — Estrutural ── */}
                <div className="clinical-card">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
                      <Mic className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">Avaliação por Voz — Estrutural</h3>
                      <p className="text-xs text-muted-foreground">Grave a anamnese estrutural e receba insights baseados em evidências sobre as 8 Unidades Corporais</p>
                    </div>
                  </div>
                  <VoiceAssessment
                    serviceType="identidade"
                    pacienteId={paciente.id}
                    patientName={`${paciente.nome} ${paciente.sobrenome}`}
                    onAssessmentComplete={() => {
                      refetchVoice();
                      qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
                    }}
                  />
                </div>

                {/* ── Avaliação Escrita (mesmo motor, sem áudio) ── */}
                <div className="rounded-2xl border bg-card p-4 mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">Avaliação Escrita — Estrutural</h3>
                      <p className="text-xs text-muted-foreground">Descreva o caso por escrito; a IA monta as seções editáveis (igual à avaliação por voz)</p>
                    </div>
                  </div>
                  <VoiceAssessment
                    mode="written"
                    serviceType="identidade"
                    pacienteId={paciente.id}
                    patientName={`${paciente.nome} ${paciente.sobrenome}`}
                    onAssessmentComplete={() => {
                      refetchVoice();
                      qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
                    }}
                  />
                </div>

                {/* Avaliação Estrutural removida — substituída pela aba "Presencial" (Avatar 3D + Voz/Áudio/Escrita) */}

                {!showStructural && !lastSavedData && (
                  <>
                    {iniciandoMyID ? (
                      <div className="bg-card rounded-xl shadow-sm border p-4 relative">
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
                      <div className="space-y-4">
                        <div className="flex justify-between items-center bg-card p-4 rounded-xl border shadow-sm">
                          <div>
                            <h3 className="font-bold text-lg text-primary">Avaliação MyID Presencial</h3>
                            <p className="text-sm text-muted-foreground">Preencha um novo MyID durante a sessão.</p>
                          </div>
                          <Button onClick={() => setIniciandoMyID(true)}>Nova Avaliação</Button>
                        </div>
                        <p className="text-xs text-muted-foreground">O histórico completo fica na aba "Histórico de Avaliações".</p>
                      </div>
                    )}
                  </>
                )}

              </div>
            </TabsContent>

            {/* Aba: Histórico de Avaliações */}
            <TabsContent value="historico" className="mt-4 space-y-6">
              <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl border border-dashed border-primary/20">
                <div>
                  <h3 className="text-sm font-black text-foreground tracking-tight uppercase">Histórico de Avaliações</h3>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">MyID · Estrutural · Voz · Questionários</p>
                </div>
                <Button
                  size="sm"
                  className="bg-identidade hover:bg-identidade/90 text-white gap-2 font-bold px-4 h-9 shadow-lg transition-all rounded-xl"
                  onClick={() => setSubTabAtiva('avaliacoes')}
                >
                  <Target className="h-4 w-4" /> Criar Diretriz
                </Button>
              </div>

              {/* CIF Suggestion Panel */}
              <CIFSuggestionPanel
                myidResult={(() => {
                  if (!ultimaMyID) return null;
                  return {
                    component_scores: {
                      D: ultimaMyID.score_d ?? 0,
                      EFI: ultimaMyID.score_efi ?? 0,
                      P: ultimaMyID.score_p ?? 0,
                      I: ultimaMyID.score_i ?? 0,
                      R: ultimaMyID.score_r ?? 0,
                      C: ultimaMyID.score_c ?? 0,
                      N: ultimaMyID.score_n ?? 0,
                      AF: (ultimaMyID.dados_avaliacao as any)?.component_scores?.AF ?? 0,
                      ERG: (ultimaMyID.dados_avaliacao as any)?.component_scores?.ERG ?? 0,
                    },
                  };
                })()}
                voiceAssessment={voiceAvaliacoes.length > 0 ? voiceAvaliacoes[0] : null}
                structuralAssessment={(() => {
                  if (structuralAvaliacoes.length === 0) return null;
                  const latest = structuralAvaliacoes[0];
                  const dados = latest.dados_avaliacao as any;
                  return dados?._type === 'structural' ? dados : null;
                })()}
              />
              <div className="clinical-card">
                <div className="flex items-center gap-2 mb-3">
                  <Fingerprint className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">MyID (Online e Presencial)</h3>
                </div>
                {myidAvaliacoes.length > 0 ? (
                  <div className="space-y-3">
                    {myidAvaliacoes.map((av: any) => {
                      const isExpanded = expandedMyIDId === av.id;
                      const result = av.resultado_processado;
                      return (
                        <div key={av.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                          <div
                            className={`flex items-center gap-3 p-4 cursor-pointer transition-all hover:bg-muted/40 ${isExpanded ? 'bg-muted/40 border-b' : ''}`}
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
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={deletingMyIDId === av.id}
                                  title="Excluir avaliação MyID"
                                >
                                  {deletingMyIDId === av.id
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Trash2 className="h-4 w-4" />}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir esta avaliação MyID?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. O resultado de {format(new Date(av.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} (Score {result?.myidScore?.toFixed(1) || '—'}) será removido permanentemente do histórico do paciente, do prontuário e da evolução.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => handleDeleteMyID(av.id)}
                                  >
                                    Sim, excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={(e) => { e.stopPropagation(); setExpandedMyIDId(isExpanded ? null : av.id); }}
                            >
                              <FileText className={`h-4 w-4 transition-transform ${isExpanded ? 'text-primary' : 'text-muted-foreground'}`} />
                            </Button>
                          </div>
                          {isExpanded && result && (
                            <div className="p-4 bg-card animate-in fade-in slide-in-from-top-2 duration-300">
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
                  <div className="text-center py-6 text-muted-foreground">
                    <Fingerprint className="h-8 w-8 mx-auto mb-2 opacity-30 text-primary" />
                    <p className="text-sm">Nenhum MyID registrado</p>
                    <p className="text-xs mt-1">As respostas online e presenciais aparecerão aqui.</p>
                  </div>
                )}
              </div>

              <div className="clinical-card">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  <h3 className="font-semibold text-sm">Avaliações Estruturais</h3>
                </div>
                {structuralAvaliacoes.length > 0 ? (
                  <div className="space-y-3">
                    {structuralAvaliacoes.slice(0, 5).map((av: any) => {
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
                              {isExpanded ? 'Fechar' : 'Ver Resultados'}
                            </Button>
                          </div>
                          {isExpanded && (
                            <div className="p-3 pt-0">
                              <StructuralResultsSummary data={dados} pacienteId={paciente.id} terapeutaId={user?.id} pacienteNome={patientName} readOnly onNavigateDiretrizes={() => setSubTabAtiva('avaliacoes')} />
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
                  </div>
                )}
              </div>

              <div className="clinical-card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
                    <Mic className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Histórico de Avaliações por Voz</h3>
                    <p className="text-xs text-muted-foreground">{voiceAvaliacoes.length} avaliação(ões) registrada(s)</p>
                  </div>
                </div>

                {voiceAvaliacoes.length > 0 ? (
                  <div className="space-y-3">
                    {voiceAvaliacoes.map((av: any) => {
                      const resultado = av.resultado as any;
                      const isExpanded = expandedVoiceId === av.id;
                      return (
                        <div key={av.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                          <button
                            type="button"
                            className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                            onClick={() => setExpandedVoiceId(isExpanded ? null : av.id)}
                          >
                            <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                              <Mic className="h-5 w-5 text-violet-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold">
                                  {format(new Date(av.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </span>
                                {av.classificacao_severidade && (
                                  <Badge variant="outline" className="text-[10px] h-4 py-0">
                                    {av.classificacao_severidade}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5 truncate">
                                {av.queixa_principal ? `Queixa: ${av.queixa_principal}` : 'Sem queixa registrada'}
                              </div>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>

                          {isExpanded && (
                            <div className="p-4 pt-0 space-y-3">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-[10px]">{av.servico || 'identidade'}</Badge>
                                  {resultado?.classificacao_severidade && (
                                    <Badge variant="outline" className="text-[10px] h-4">{resultado.classificacao_severidade}</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs gap-1"
                                    onClick={() => {
                                      setEditingVoiceId(av.id);
                                      setEditingVoiceText(av.transcricao || '');
                                    }}
                                  >
                                    <Edit3 className="h-3 w-3" /> Editar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs gap-1"
                                    onClick={() => setAddingVoiceToId(av.id)}
                                  >
                                    <Mic className="h-3 w-3" /> Adicionar Áudio
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs gap-1"
                                    onClick={() => handleSyncVoiceToProntuario(av)}
                                  >
                                    <Save className="h-3 w-3" /> Prontuário
                                  </Button>
                                </div>
                              </div>

                              {editingVoiceId === av.id ? (
                                <div className="space-y-2">
                                  <Textarea
                                    value={editingVoiceText}
                                    onChange={(e) => setEditingVoiceText(e.target.value)}
                                    className="min-h-[120px] text-sm"
                                    placeholder="Edite a transcrição..."
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      className="gap-1"
                                      onClick={() => handleSaveVoiceEdit(av.id)}
                                      disabled={savingVoiceEdit}
                                    >
                                      {savingVoiceEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                      Salvar
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setEditingVoiceId(null)}>Cancelar</Button>
                                  </div>
                                </div>
                              ) : (
                              <div className="space-y-3">
                                  {/* Queixa Principal & Classificação */}
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-background rounded-lg p-2 border">
                                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Queixa Principal</p>
                                      <p className="text-sm text-foreground">{resultado?.queixa_principal || 'N/I'}</p>
                                    </div>
                                    <div className="bg-background rounded-lg p-2 border">
                                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Classificação</p>
                                      <p className="text-sm text-foreground">{resultado?.classificacao_severidade || 'N/I'}</p>
                                    </div>
                                  </div>

                                  {/* Dor */}
                                  {resultado?.dor && (
                                    <div className="bg-background rounded-lg p-2 border">
                                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">🩹 Dor</p>
                                      <div className="text-xs text-foreground space-y-0.5">
                                        <p>📍 Local: {resultado.dor.localizacao || 'N/I'}</p>
                                        <p>📊 EVA: {resultado.dor.intensidade_eva || '?'}/10 — {resultado.dor.tipo || 'N/I'}</p>
                                        {resultado.dor.padroes_agravamento && <p>⚡ Padrões: {resultado.dor.padroes_agravamento}</p>}
                                      </div>
                                    </div>
                                  )}

                                  {/* Resumo Clínico */}
                                  <div className="bg-background rounded-lg p-2 border">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">📋 Resumo Clínico</p>
                                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{resultado?.resumo_clinico || 'N/A'}</p>
                                  </div>

                                  {/* Hipóteses Diagnósticas */}
                                  {resultado?.hipoteses_diagnosticas?.length > 0 && (
                                    <div className="bg-background rounded-lg p-2 border">
                                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">🔍 Hipóteses Diagnósticas</p>
                                      <div className="space-y-1.5">
                                        {resultado.hipoteses_diagnosticas.map((h: any, idx: number) => (
                                          <div key={idx} className="text-xs border-l-2 border-primary/30 pl-2">
                                            <span className="font-semibold text-foreground">{h.diagnostico}</span>
                                            {h.probabilidade && <Badge variant="outline" className="ml-1.5 text-[9px] h-4">{h.probabilidade}</Badge>}
                                            {h.evidencia && <p className="text-muted-foreground mt-0.5 italic">{h.evidencia}</p>}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Insights Baseados em Evidências */}
                                  {resultado?.insights_baseados_evidencia?.length > 0 && (
                                    <div className="bg-background rounded-lg p-2 border">
                                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">📚 Insights Baseados em Evidências</p>
                                      <div className="space-y-1.5">
                                        {resultado.insights_baseados_evidencia.map((i: any, idx: number) => (
                                          <div key={idx} className="text-xs border-l-2 border-violet-300 pl-2">
                                            <p className="text-foreground">{i.insight}</p>
                                            {i.referencia && <p className="text-muted-foreground text-[10px] italic mt-0.5">📖 {i.referencia}</p>}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Red Flags */}
                                  {resultado?.red_flags?.length > 0 && (
                                    <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-2 border border-red-200 dark:border-red-800">
                                      <p className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider mb-1">⚠️ Red Flags</p>
                                      <ul className="text-xs text-red-600 dark:text-red-400 space-y-0.5">
                                        {resultado.red_flags.map((rf: string, idx: number) => (
                                          <li key={idx}>• {rf}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Funcionalidade */}
                                  {resultado?.funcionalidade && (
                                    <div className="bg-background rounded-lg p-2 border">
                                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">🏃 Funcionalidade</p>
                                      <div className="text-xs text-foreground space-y-0.5">
                                        {resultado.funcionalidade.nivel_impacto && <p>Impacto: {resultado.funcionalidade.nivel_impacto}</p>}
                                        {resultado.funcionalidade.limitacoes_avds?.length > 0 && (
                                          <p>Limitações: {resultado.funcionalidade.limitacoes_avds.join(', ')}</p>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Plano / Conduta */}
                                  {resultado?.plano_conduta && (
                                    <div className="bg-background rounded-lg p-2 border">
                                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">🎯 Plano de Conduta</p>
                                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                                        {typeof resultado.plano_conduta === 'string' ? resultado.plano_conduta : JSON.stringify(resultado.plano_conduta, null, 2)}
                                      </p>
                                    </div>
                                  )}

                                  {/* Transcrição (colapsada) */}
                                  {av.transcricao && (
                                    <details className="bg-background rounded-lg p-2 border">
                                      <summary className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider cursor-pointer">📝 Transcrição</summary>
                                      <p className="text-muted-foreground whitespace-pre-wrap text-xs mt-1 max-h-32 overflow-y-auto">
                                        {av.transcricao}
                                      </p>
                                    </details>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <Mic className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhuma avaliação por voz registrada</p>
                    <p className="text-xs mt-1">Use a ferramenta de avaliação por voz para registrar.</p>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Questionários Remotos Recebidos</h3>
                </div>
                <QuestionariosComparacao
                  linksAvPaciente={linksAvPaciente}
                  respostas={respostas}
                  myidAvaliacoes={myidAvaliacoes}
                />
              </div>
            </TabsContent>

            {/* Aba: Diretrizes e Tratamentos (Repositório) */}
            <TabsContent value="avaliacoes" className="mt-4">
              <PacienteProtocolosTab
                pacienteId={paciente.id}
                pacienteNome={`${paciente.nome} ${paciente.sobrenome}`}
                tipo="identidade"
              />
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
