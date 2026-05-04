import { useState, useRef, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Mic, MicOff, Loader2, AlertTriangle, CheckCircle2, Brain, FileText, Stethoscope, Activity, Shield, Lightbulb, ChevronDown, ChevronUp, Copy, BookOpen, Save, Edit3, RotateCcw, Clock, Sparkles, Tag, Layers, Users, Wand2, Target, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { clearDraft, readDraft, writeDraft } from '@/lib/draftStorage';
import { useNotasProntuario } from '@/hooks/useNotasProntuario';
import { buildSoapFromVoice } from '@/components/prontuario/SoapNoteForm';

type ServiceType = 'identidade' | 'cobzero' | 'studio';

interface VoiceAssessmentProps {
  serviceType: ServiceType;
  pacienteId?: string;
  patientName?: string;
  patientAge?: number;
  patientSex?: string;
  onAssessmentComplete?: (assessment: any) => void;
  /** When true, only captures audio/text and returns via onAppendCapture without saving a new record */
  appendMode?: boolean;
  onAppendCapture?: (capturedText: string, capturedAudioBase64?: string, capturedAudioMimeType?: string) => void;
}

const SERVICE_LABELS: Record<ServiceType, string> = {
  identidade: 'Método Identidade',
  cobzero: 'COB° ZERO',
  studio: 'Studio Personal ID',
};

const SEVERITY_COLORS: Record<string, string> = {
  'Favorável': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Favor√°vel': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Atenção': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Aten√ß√£o': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Moderado': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'Severo': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'Risco de Cronificação': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'Risco de Cronifica√ß√£o': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

type Step = 'record' | 'review' | 'result';

const VOICE_DRAFT_VERSION = 1;

export default function VoiceAssessment({ serviceType, pacienteId, patientName, patientAge, patientSex, onAssessmentComplete, appendMode, onAppendCapture }: VoiceAssessmentProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('record');
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [editedTranscript, setEditedTranscript] = useState('');
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string>('audio/webm');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [assessment, setAssessment] = useState<any>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    soap: true, resumo: true, dor: true, funcionalidade: true, psicossocial: true,
    redflags: true, multi: true, hipoteses: true, cif: true, diretriz: true,
    plano: true, insights: true,
  });
  const [hiddenSections, setHiddenSections] = useState<Record<string, boolean>>({});
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editFieldValue, setEditFieldValue] = useState('');
  const [savingSoapNote, setSavingSoapNote] = useState(false);
  const [soapNoteSaved, setSoapNoteSaved] = useState(false);
  const [creatingDiretriz, setCreatingDiretriz] = useState(false);
  const [diretrizCreatedId, setDiretrizCreatedId] = useState<string | null>(null);
  const { adicionar: adicionarNotaProntuario } = useNotasProntuario(pacienteId || '');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const hasRestoredDraftRef = useRef(false);

  const draftKey = `voice:${serviceType}:${pacienteId ?? 'sem-paciente'}:${user?.id ?? 'anon'}`;

  // Wake Lock helpers
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      }
    } catch (e) {
      console.warn('Wake Lock não disponível:', e);
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release();
    wakeLockRef.current = null;
  }, []);

  useEffect(() => {
    if (!user || appendMode || hasRestoredDraftRef.current) return;

    hasRestoredDraftRef.current = true;

    void readDraft<{
      step: Step;
      transcript: string;
      editedTranscript: string;
      audioBase64: string | null;
      audioMimeType: string;
      recordingTime: number;
      assessment: any;
      expandedSections: Record<string, boolean>;
      isSaved: boolean;
    }>(draftKey, VOICE_DRAFT_VERSION).then((draft) => {
      if (!draft) return;

      setStep(draft.step ?? 'record');
      setTranscript(draft.transcript ?? '');
      setEditedTranscript(draft.editedTranscript ?? '');
      setAudioBase64(draft.audioBase64 ?? null);
      setAudioMimeType(draft.audioMimeType ?? 'audio/webm');
      setRecordingTime(draft.recordingTime ?? 0);
      setAssessment(draft.assessment ?? null);
      setExpandedSections(draft.expandedSections ?? {
        soap: true, resumo: true, dor: true, funcionalidade: true, psicossocial: true,
        redflags: true, multi: true, hipoteses: true, cif: true, diretriz: true,
        plano: true, insights: true,
      });
      setIsSaved(Boolean(draft.isSaved));

      toast({
        title: 'Rascunho restaurado',
        description: 'Recuperamos sua avaliação em andamento após o descanso do aparelho.',
      });
    });
  }, [appendMode, draftKey, toast, user]);

  useEffect(() => {
    if (!user || appendMode) return;

    const hasMeaningfulDraft = Boolean(
      transcript.trim() ||
      editedTranscript.trim() ||
      audioBase64 ||
      assessment ||
      step !== 'record'
    );

    if (!hasMeaningfulDraft) {
      void clearDraft(draftKey);
      return;
    }

    void writeDraft(
      draftKey,
      {
        step,
        transcript,
        editedTranscript,
        audioBase64,
        audioMimeType,
        recordingTime,
        assessment,
        expandedSections,
        isSaved,
      },
      VOICE_DRAFT_VERSION,
    );
  }, [appendMode, assessment, audioBase64, audioMimeType, draftKey, editedTranscript, expandedSections, isSaved, recordingTime, step, transcript, user]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick best supported format
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = ''; // let browser decide
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          setAudioBase64(base64);
          setAudioMimeType(recorder.mimeType.split(';')[0]);
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // collect chunks every second
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
      await requestWakeLock();
    } catch (err) {
      console.error('Failed to start recording:', err);
      toast({ title: 'Erro ao acessar microfone', description: 'Permita o acesso ao microfone nas configurações do navegador.', variant: 'destructive' });
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
    releaseWakeLock();
  }, [releaseWakeLock]);

  // Re-acquire wake lock when page becomes visible again during recording
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && isRecording) {
        stopRecording();
        return;
      }

      if (document.visibilityState === 'visible' && isRecording) {
        requestWakeLock();
      }
    };

    const handlePageHide = () => {
      if (isRecording) stopRecording();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [isRecording, requestWakeLock, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      releaseWakeLock();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [releaseWakeLock, stopRecording]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const goToReview = () => {
    if (!audioBase64 && transcript.trim().length < 20 && editedTranscript.trim().length < 20) {
      toast({ title: 'Conteúdo insuficiente', description: 'Grave áudio ou digite/cole a transcrição.', variant: 'destructive' });
      return;
    }

    // In append mode, just return the captured data without processing
    if (appendMode && onAppendCapture) {
      const combinedText = [editedTranscript.trim(), transcript.trim()].filter(Boolean).join('\n\n');
      onAppendCapture(combinedText, audioBase64 || undefined, audioMimeType);
      return;
    }

    // Append new typed text to existing edited transcript (don't duplicate)
    const newText = transcript.trim();
    if (newText && editedTranscript && newText !== editedTranscript.trim()) {
      setEditedTranscript(prev => prev + '\n\n' + newText);
    } else if (newText && !editedTranscript) {
      setEditedTranscript(newText);
    }
    setTranscript('');
    setStep('review');
  };

  const normalizeJson = (value: unknown) => JSON.parse(JSON.stringify(value ?? null));

  const saveAssessment = async (
    assessmentToSave = assessment,
    transcriptToSave = editedTranscript,
    options?: { silent?: boolean }
  ) => {
    if (!assessmentToSave || !user || isSaving) return { saved: false, noteWarning: null };

    setIsSaving(true);
    try {
      const payload = {
        terapeuta_id: user.id,
        paciente_id: pacienteId || null,
        paciente_nome: patientName || null,
        servico: serviceType,
        transcricao: transcriptToSave || 'Avaliação por áudio',
        resultado: normalizeJson(assessmentToSave),
        classificacao_severidade: assessmentToSave.classificacao_severidade || null,
        queixa_principal: assessmentToSave.queixa_principal || null,
      };

      const { error: saveError } = await supabase
        .from('avaliacoes_voz')
        .insert(payload)
        .select('id')
        .single();

      if (saveError) throw saveError;

      let noteWarning: string | null = null;

      if (pacienteId) {
        const hipoteses = assessmentToSave.hipoteses_diagnosticas?.slice(0, 3).map((h: any) => h.diagnostico).join(', ') || 'N/I';
        const descricao = `Avaliação por Voz — ${SERVICE_LABELS[serviceType]}
Queixa: ${assessmentToSave.queixa_principal || 'N/I'}
Dor EVA: ${assessmentToSave.dor?.intensidade_eva || '?'}/10 — ${assessmentToSave.dor?.tipo || 'N/I'}
Classificação: ${assessmentToSave.classificacao_severidade || 'N/I'}
Hipóteses: ${hipoteses}
${assessmentToSave.resumo_clinico?.substring(0, 200) || ''}
Detalhes completos no Histórico de Avaliações.`;

        const { error: noteError } = await supabase.from('notas_prontuario').insert({
          paciente_id: pacienteId,
          terapeuta_id: user.id,
          tipo: 'avaliacao_voz',
          titulo: `Avaliação por Voz — ${SERVICE_LABELS[serviceType]}`,
          descricao,
          dados_extras: normalizeJson({ assessment: assessmentToSave, transcricao: transcriptToSave }),
        });

        if (noteError) {
          console.error('Erro ao salvar nota de prontuário da avaliação por voz:', noteError);
          noteWarning = noteError.message;
        }
      }

      setIsSaved(true);
      // Invalidate prontuário & evolução queries so data appears immediately
      queryClient.invalidateQueries({ queryKey: ['notas-prontuario'] });
      queryClient.invalidateQueries({ queryKey: ['avaliacoes-voz'] });
      queryClient.invalidateQueries({ queryKey: ['prontuario'] });
      queryClient.invalidateQueries({ queryKey: ['evolucao'] });
      onAssessmentComplete?.(assessmentToSave);

      if (!options?.silent) {
        toast({
          title: noteWarning ? 'Avaliação salva com aviso' : '💾 Avaliação salva!',
          description: noteWarning
            ? 'A avaliação foi salva no histórico, mas a nota do prontuário não pôde ser criada agora.'
            : pacienteId
              ? 'Salva no histórico e no prontuário do paciente.'
              : 'Salva no histórico com sucesso.',
        });
      }

      await clearDraft(draftKey);

      return { saved: true, noteWarning };
    } catch (err: any) {
      if (!options?.silent) {
        toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
      }
      return { saved: false, noteWarning: null };
    } finally {
      setIsSaving(false);
    }
  };

  const processAssessment = async () => {
    const text = editedTranscript.trim();
    if (!audioBase64 && text.length < 20) {
      toast({ title: 'Conteúdo insuficiente', description: 'Adicione mais conteúdo ou grave áudio.', variant: 'destructive' });
      return;
    }

    // Hard guard: avoid sending huge payloads that the AI gateway will reject (413)
    // ~20MB base64 ≈ 15MB raw audio. Opus 64kbps ≈ ~30 min.
    if (audioBase64 && audioBase64.length > 20 * 1024 * 1024) {
      toast({
        title: 'Áudio muito longo',
        description: 'Grave trechos menores (até ~25 min) ou divida a consulta em partes.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setIsSaved(false);

    try {
      const body: any = { serviceType, patientName, patientAge, patientSex };

      if (audioBase64) {
        body.audioBase64 = audioBase64;
        body.audioMimeType = audioMimeType;
      }
      if (text.length >= 20) {
        body.transcript = text;
      }

      const { data, error } = await supabase.functions.invoke('voice-assessment', { body });
      if (error) {
        // supabase-js wraps non-2xx as FunctionsHttpError — try to read the JSON body for the real message
        let serverMessage = error.message;
        try {
          // @ts-ignore - context is present on FunctionsHttpError
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const errBody = await ctx.json();
            if (errBody?.error) serverMessage = errBody.error;
          }
        } catch { /* ignore */ }
        throw new Error(serverMessage);
      }
      if (data?.error) throw new Error(data.error);

      const generatedAssessment = data.assessment;
      const generatedTranscript = data.transcricao && text.length < 20 ? data.transcricao : text;

      setAssessment(generatedAssessment);
      setEditedTranscript(generatedTranscript);

      const saveResult = await saveAssessment(generatedAssessment, generatedTranscript, { silent: true });

      setStep('result');
      toast({
        title: saveResult.saved ? '✅ Avaliação gerada e salva!' : '✅ Avaliação gerada!',
        description: saveResult.saved
          ? 'Ela já foi adicionada automaticamente ao histórico.'
          : 'Não consegui salvar automaticamente; use o botão para tentar novamente.',
      });
    } catch (err: any) {
      console.error('[VoiceAssessment] processAssessment error:', err);
      toast({
        title: 'Erro ao processar',
        description: err?.message || 'Falha desconhecida. Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyAssessment = () => {
    if (!assessment) return;
    const text = `AVALIAÇÃO CLÍNICA POR VOZ — ${SERVICE_LABELS[serviceType]}
Paciente: ${patientName || 'N/I'}

${assessment.resumo_clinico}

Queixa Principal: ${assessment.queixa_principal || 'N/I'}
Classificação: ${assessment.classificacao_severidade || 'N/I'}

DOR:
- Local: ${assessment.dor?.localizacao || 'N/I'}
- EVA: ${assessment.dor?.intensidade_eva || 'N/I'}/10
- Tipo: ${assessment.dor?.tipo || 'N/I'}

HIPÓTESES:
${assessment.hipoteses_diagnosticas?.map((h: any) => `- ${h.diagnostico} (${h.probabilidade}) — ${h.evidencia}`).join('\n') || 'Sem hipóteses registradas.'}

INSIGHTS BASEADOS EM EVIDÊNCIAS:
${assessment.insights_baseados_evidencia?.map((i: any) => `- ${i.insight} (${i.referencia})`).join('\n') || 'Sem insights registrados.'}
`;
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado!' });
  };

  const resetAll = () => {
    setTranscript('');
    setEditedTranscript('');
    setAudioBase64(null);
    setAssessment(null);
    setIsSaved(false);
    setRecordingTime(0);
    setEditingField(null);
    setStep('record');
    void clearDraft(draftKey);
  };

  // ── Cria uma Diretriz Oficial a partir da diretriz_tratamento gerada pela IA ──
  const criarDiretrizDaVoz = async () => {
    if (!user || !assessment?.diretriz_tratamento || !pacienteId) {
      toast({
        title: 'Não foi possível criar a diretriz',
        description: !pacienteId
          ? 'Esta avaliação não está vinculada a um paciente.'
          : 'A IA não gerou uma diretriz nesta análise.',
        variant: 'destructive',
      });
      return;
    }

    setCreatingDiretriz(true);
    try {
      const diretriz = assessment.diretriz_tratamento;
      const queixa = assessment.queixa_principal || 'Avaliação por voz';
      const classif = assessment.classificacao_severidade || 'N/I';

      const fasesConfig = [
        { numero: 1, key: 'fase_1_alivio', titulo: 'Fase 1 — Alívio & Proteção', semanas_inicio: 1, semanas_fim: 2 },
        { numero: 2, key: 'fase_2_carga', titulo: 'Fase 2 — Carga Progressiva', semanas_inicio: 3, semanas_fim: 6 },
        { numero: 3, key: 'fase_3_retorno', titulo: 'Fase 3 — Retorno Funcional', semanas_inicio: 7, semanas_fim: 12 },
      ];

      // Snapshot compatível com o sistema de diretrizes (ProtocoloViewer / getDiretrizSnapshotFromScores)
      const diretrizSnapshot = {
        versao: 1,
        createdAt: new Date().toISOString(),
        origem: 'avaliacao_voz',
        fases: fasesConfig.map((cfg) => {
          const fase = diretriz?.[cfg.key] || {};
          const tecnicas = Array.isArray(fase.tecnicas) ? fase.tecnicas : [];
          return {
            numero: cfg.numero,
            titulo: cfg.titulo,
            semanas: `${cfg.semanas_inicio}-${cfg.semanas_fim}`,
            semanas_inicio: cfg.semanas_inicio,
            semanas_fim: cfg.semanas_fim,
            objetivo: (fase.objetivos || [])[0] || 'Conduta terapêutica planejada.',
            demandasAlvo: (fase.objetivos || []).slice(1),
            frequenciaSemanal: 0,
            duracaoSessao: fase.duracao_semanas || '',
            exercicios: [],
            tecnicas: tecnicas.map((t: any) => ({
              nome: t.tecnica || 'Técnica',
              descricao: t.justificativa || '',
              duracao: '',
              frequencia: diretriz.frequencia_sugerida || '',
              motivo: t.justificativa || '',
              categoria: t.lente_clinica || 'referencia',
            })),
          };
        }),
      };

      const objetivoGeral = `Plano clínico em 3 fases para "${queixa}" — gerado a partir de avaliação por voz (${classif}).`;

      // 1) Cria o registro principal de protocolo
      const { data: prot, error: protErr } = await (supabase as any)
        .from('protocolos')
        .insert({
          terapeuta_id: user.id,
          paciente_id: pacienteId,
          titulo: `Diretriz — ${queixa}`,
          descricao: assessment.resumo_clinico || null,
          objetivo_geral: objetivoGeral,
          duracao_total: '12 semanas',
          frequencia: diretriz.frequencia_sugerida || '2-3x por semana',
          status: 'ativo',
          scores_avaliacao: {
            origem: 'avaliacao_voz',
            classificacao: classif,
            queixa_principal: queixa,
            prognostico: diretriz.prognostico || null,
            criterios_alta: diretriz.criterios_alta || [],
            diretriz_snapshot: diretrizSnapshot,
          },
        })
        .select('id')
        .single();

      if (protErr) throw protErr;
      const protocoloId = prot.id;

      // 2) Cria as 3 fases
      const fasesPayload = fasesConfig.map((cfg) => {
        const fase = diretriz?.[cfg.key] || {};
        return {
          protocolo_id: protocoloId,
          numero_fase: cfg.numero,
          titulo: cfg.titulo,
          semanas_inicio: cfg.semanas_inicio,
          semanas_fim: cfg.semanas_fim,
          objetivos: Array.isArray(fase.objetivos) ? fase.objetivos : [],
          sessoes_por_semana: 2,
        };
      });

      const { error: fasesErr } = await (supabase as any)
        .from('protocolo_fases')
        .insert(fasesPayload);
      if (fasesErr) throw fasesErr;

      // 3) Nota no prontuário
      const resumoTecnicas = fasesConfig
        .map((cfg) => {
          const fase = diretriz?.[cfg.key] || {};
          const tecs = (fase.tecnicas || []).map((t: any) => `• ${t.tecnica}`).join('\n');
          return `${cfg.titulo}${fase.duracao_semanas ? ` (${fase.duracao_semanas})` : ''}\n${tecs || '• (sem técnicas registradas)'}`;
        })
        .join('\n\n');

      const descricao = `🎯 DIRETRIZ DE TRATAMENTO REGISTRADA (a partir de Avaliação por Voz)

Queixa principal: ${queixa}
Classificação: ${classif}
Frequência sugerida: ${diretriz.frequencia_sugerida || 'N/I'}
Prognóstico: ${diretriz.prognostico || 'N/I'}

${resumoTecnicas}`;

      await adicionarNotaProntuario({
        pacienteId,
        tipo: 'conduta_diretriz',
        titulo: `Diretriz — ${queixa}`,
        descricao,
        referenciaId: protocoloId,
        dadosExtras: {
          protocolo_id: protocoloId,
          origem: 'avaliacao_voz',
          classificacao: classif,
          queixa_principal: queixa,
        },
      });

      setDiretrizCreatedId(protocoloId);
      queryClient.invalidateQueries({ queryKey: ['protocolos-paciente'] });
      queryClient.invalidateQueries({ queryKey: ['notas-prontuario'] });
      queryClient.invalidateQueries({ queryKey: ['evolucao-paciente'] });

      toast({
        title: '✅ Diretriz criada!',
        description: 'Diretriz oficial registrada no paciente e no prontuário.',
      });
    } catch (err: any) {
      console.error('Erro ao criar diretriz a partir da voz:', err);
      toast({
        title: 'Erro ao criar diretriz',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setCreatingDiretriz(false);
    }
  };

  // Inline edit helpers for AI fields
  const startEditField = (field: string, currentValue: string) => {
    setEditingField(field);
    setEditFieldValue(currentValue);
  };

  const saveFieldEdit = (field: string) => {
    if (!assessment) return;
    const updated = { ...assessment };

    if (field === 'resumo_clinico') {
      updated.resumo_clinico = editFieldValue;
    } else if (field === 'dor_localizacao') {
      updated.dor = { ...updated.dor, localizacao: editFieldValue };
    } else if (field === 'dor_eva') {
      updated.dor = { ...updated.dor, intensidade_eva: editFieldValue };
    } else if (field === 'dor_tipo') {
      updated.dor = { ...updated.dor, tipo: editFieldValue };
    } else if (field === 'funcionalidade_impacto') {
      updated.funcionalidade = { ...updated.funcionalidade, nivel_impacto: editFieldValue };
    } else if (field === 'funcionalidade_limitacoes') {
      updated.funcionalidade = { ...updated.funcionalidade, limitacoes_avds: editFieldValue.split('\n').filter(Boolean) };
    } else if (field === 'red_flags') {
      updated.red_flags = editFieldValue.split('\n').filter(Boolean);
    } else if (field === 'hipoteses') {
      // Parse "diagnostico | probabilidade | evidencia" per line
      updated.hipoteses_diagnosticas = editFieldValue.split('\n').filter(Boolean).map((line: string) => {
        const parts = line.split('|').map((p: string) => p.trim());
        return { diagnostico: parts[0] || line, probabilidade: parts[1] || 'Média', evidencia: parts[2] || '' };
      });
    } else if (field === 'classificacao') {
      updated.classificacao_severidade = editFieldValue;
    } else if (field === 'queixa_principal') {
      updated.queixa_principal = editFieldValue;
    }

    setAssessment(updated);
    setIsSaved(false);
    setEditingField(null);
  };

  const EditableInline = ({ field, value, multiline }: { field: string; value: string; multiline?: boolean }) => {
    if (editingField === field) {
      return (
        <div className="space-y-1">
          {multiline ? (
            <Textarea value={editFieldValue} onChange={e => setEditFieldValue(e.target.value)} className="text-sm min-h-[80px]" autoFocus />
          ) : (
            <input value={editFieldValue} onChange={e => setEditFieldValue(e.target.value)}
              className="w-full text-sm border rounded px-2 py-1 bg-background" autoFocus
              onKeyDown={e => { if (e.key === 'Enter' && !multiline) saveFieldEdit(field); }}
            />
          )}
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => saveFieldEdit(field)}>
              <CheckCircle2 className="h-3 w-3 mr-1" />OK
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingField(null)}>Cancelar</Button>
          </div>
        </div>
      );
    }
    return (
      <span className="cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors group inline-flex items-center gap-1"
        onClick={() => startEditField(field, value)}>
        {value}
        <Edit3 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </span>
    );
  };

  // ‚îÄ‚îÄ Step 3: Assessment Results ‚îÄ‚îÄ
  if (step === 'result' && assessment) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Stethoscope className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-lg">Avaliação por Voz</h3>
            <Badge variant="outline" className="text-[10px] border-primary/40 text-primary gap-1">
              <Sparkles className="h-3 w-3" />Multidisciplinar IA
            </Badge>
            <Badge className={cn('text-xs', SEVERITY_COLORS[assessment.classificacao_severidade] || 'bg-muted')}>
              {assessment.classificacao_severidade}
            </Badge>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setIsEditingTranscript(prev => !prev)}>
              <Edit3 className="h-4 w-4 mr-1" />{isEditingTranscript ? 'Fechar Editor' : 'Ver/Editar Texto'}
            </Button>
            <Button variant="outline" size="sm" onClick={copyAssessment}><Copy className="h-4 w-4 mr-1" />Copiar</Button>
            {!isSaved ? (
              <Button size="sm" onClick={() => saveAssessment()} disabled={isSaving} className="bg-primary text-primary-foreground">
                {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                {isSaving ? 'Salvando...' : 'Salvar no Prontuário'}
              </Button>
            ) : (
              <Badge variant="outline" className="text-green-600 border-green-300 py-1.5 px-3">
                <CheckCircle2 className="h-4 w-4 mr-1" />Salvo
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={resetAll}><RotateCcw className="h-4 w-4 mr-1" />Nova</Button>
          </div>
        </div>

        {isEditingTranscript && (
          <Card className="border-primary/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Transcrição / Texto Base</span>
                </div>
                <p className="text-xs text-muted-foreground">{editedTranscript.split(/\s+/).filter(Boolean).length} palavras</p>
              </div>
              <Textarea
                value={editedTranscript}
                onChange={(e) => { setEditedTranscript(e.target.value); setIsSaved(false); }}
                className="min-h-[160px] text-sm"
                placeholder="Texto da transcrição..."
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setAudioBase64(null); setTranscript(''); setRecordingTime(0); setStep('record'); }}>
                  <Mic className="h-4 w-4 mr-1" />Gravar Mais Áudio
                </Button>
                <Button
                  size="sm"
                  onClick={() => { setIsSaved(false); processAssessment(); }}
                  disabled={isProcessing || editedTranscript.trim().length < 20}
                  className="bg-primary text-primary-foreground"
                >
                  {isProcessing ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Reprocessando...</> : <><Brain className="h-4 w-4 mr-1" />Reprocessar com IA</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── SOAP — estrutura padrão de prontuário ── */}
        {assessment.soap && (
          <SectionCard icon={Layers} title="📋 SOAP — Prontuário Estruturado" sectionKey="soap" expanded={expandedSections} toggle={toggleSection}>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-wide">S — Subjetivo</span>
                <p className="text-muted-foreground leading-relaxed mt-0.5">{assessment.soap.subjetivo}</p>
              </div>
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-wide">O — Objetivo</span>
                <p className="text-muted-foreground leading-relaxed mt-0.5">{assessment.soap.objetivo}</p>
              </div>
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-wide">A — Avaliação</span>
                <p className="text-muted-foreground leading-relaxed mt-0.5">{assessment.soap.avaliacao}</p>
              </div>
              <div>
                <span className="text-xs font-bold text-primary uppercase tracking-wide">P — Plano</span>
                <p className="text-muted-foreground leading-relaxed mt-0.5">{assessment.soap.plano}</p>
              </div>

              {pacienteId && (
                <div className="pt-2 mt-2 border-t border-border">
                  <Button
                    size="sm"
                    variant={soapNoteSaved ? 'outline' : 'default'}
                    disabled={savingSoapNote || soapNoteSaved}
                    onClick={async () => {
                      try {
                        setSavingSoapNote(true);
                        const filled = buildSoapFromVoice(assessment, transcript);
                        const subjetivo = assessment.soap?.subjetivo || filled.subjectivo;
                        const objetivo = assessment.soap?.objetivo || filled.objetivo;
                        const avaliacao = assessment.soap?.avaliacao || filled.avaliacao;
                        const plano = assessment.soap?.plano || filled.plano;
                        const descricao = `📝 S — SUBJETIVO\n${subjetivo}\n\n🔍 O — OBJETIVO\n${objetivo}\n\n🧠 A — AVALIAÇÃO\n${avaliacao}\n\n📋 P — PLANO\n${plano}`;
                        const titulo = `Nota SOAP — Avaliação por Voz — ${new Date().toLocaleDateString('pt-BR')}`;
                        await adicionarNotaProntuario({
                          pacienteId,
                          tipo: 'soap_note',
                          titulo,
                          descricao,
                          dadosExtras: { subjetivo, objetivo, avaliacao, plano, origem: 'avaliacao_voz' },
                        });
                        setSoapNoteSaved(true);
                        toast({ title: '✅ Nota SOAP salva no prontuário' });
                      } catch (err: any) {
                        toast({ title: 'Erro ao salvar nota SOAP', description: err?.message, variant: 'destructive' });
                      } finally {
                        setSavingSoapNote(false);
                      }
                    }}
                    className="w-full gap-1.5 h-8 text-xs"
                  >
                    {savingSoapNote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                    {soapNoteSaved ? 'Nota SOAP salva no prontuário' : 'Salvar como nota SOAP no prontuário'}
                  </Button>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        <SectionCard icon={FileText} title="Resumo Clínico" sectionKey="resumo" expanded={expandedSections} toggle={toggleSection}>
          <div className="text-sm text-muted-foreground leading-relaxed">
            <EditableInline field="resumo_clinico" value={assessment.resumo_clinico || 'N/I'} multiline />
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {assessment.queixa_principal && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => startEditField('queixa_principal', assessment.queixa_principal)}>
                QP: {editingField === 'queixa_principal' ? '' : assessment.queixa_principal}
                {editingField === 'queixa_principal' && (
                  <input value={editFieldValue} onChange={e => setEditFieldValue(e.target.value)}
                    className="ml-1 bg-transparent border-b text-xs w-32" autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') saveFieldEdit('queixa_principal'); }}
                    onBlur={() => saveFieldEdit('queixa_principal')} />
                )}
              </Badge>
            )}
            {assessment.tempo_evolucao && <Badge variant="outline">⏱ {assessment.tempo_evolucao}</Badge>}
          </div>
          <div className="mt-2">
            <span className="text-xs text-muted-foreground">Classificação: </span>
            <EditableInline field="classificacao" value={assessment.classificacao_severidade || 'N/I'} />
          </div>
        </SectionCard>

        <SectionCard icon={Activity} title="Análise da Dor" sectionKey="dor" expanded={expandedSections} toggle={toggleSection}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Local:</span> <strong><EditableInline field="dor_localizacao" value={assessment.dor?.localizacao || 'N/I'} /></strong></div>
            <div><span className="text-muted-foreground">EVA:</span> <strong className="text-lg"><EditableInline field="dor_eva" value={String(assessment.dor?.intensidade_eva ?? 'N/I')} />/10</strong></div>
            <div><span className="text-muted-foreground">Tipo:</span> <strong><EditableInline field="dor_tipo" value={assessment.dor?.tipo || 'N/I'} /></strong></div>
            <div><span className="text-muted-foreground">Padrão:</span> <strong>{assessment.dor?.padrao_temporal || 'N/I'}</strong></div>
          </div>
          {assessment.dor?.fatores_agravantes?.length > 0 && (
            <div className="mt-2">
              <span className="text-xs text-muted-foreground">Agravantes:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {assessment.dor.fatores_agravantes.map((f: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs border-destructive/30 text-destructive">{f}</Badge>
                ))}
              </div>
            </div>
          )}
          {assessment.dor?.fatores_atenuantes?.length > 0 && (
            <div className="mt-2">
              <span className="text-xs text-muted-foreground">Atenuantes:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {assessment.dor.fatores_atenuantes.map((f: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs border-green-500/30 text-green-700">{f}</Badge>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard icon={Activity} title="Funcionalidade" sectionKey="funcionalidade" expanded={expandedSections} toggle={toggleSection}>
          <div className="mb-2">
            <span className="text-xs text-muted-foreground">Impacto: </span>
            <EditableInline field="funcionalidade_impacto" value={assessment.funcionalidade?.nivel_impacto || 'N/I'} />
          </div>
          {assessment.funcionalidade?.limitacoes_avds?.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Limitações AVDs:</span>
                <Button variant="ghost" size="sm" className="h-5 text-[10px] text-primary"
                  onClick={() => startEditField('funcionalidade_limitacoes', assessment.funcionalidade.limitacoes_avds.map((l: any) => typeof l === 'string' ? l : JSON.stringify(l)).join('\n'))}>
                  <Edit3 className="h-3 w-3 mr-1" />Editar
                </Button>
              </div>
              {editingField === 'funcionalidade_limitacoes' ? (
                <div className="space-y-1">
                  <Textarea value={editFieldValue} onChange={e => setEditFieldValue(e.target.value)} className="text-sm min-h-[60px]" autoFocus placeholder="Uma limitação por linha" />
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => saveFieldEdit('funcionalidade_limitacoes')}><CheckCircle2 className="h-3 w-3 mr-1" />OK</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingField(null)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <ul className="text-sm text-muted-foreground space-y-1">
                  {assessment.funcionalidade.limitacoes_avds.map((l: any, i: number) => <li key={i}>• {typeof l === 'string' ? l : JSON.stringify(l)}</li>)}
                </ul>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard icon={Brain} title="Fatores Psicossociais" sectionKey="psicossocial" expanded={expandedSections} toggle={toggleSection}>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Catastrofização: <strong>{assessment.fatores_psicossociais?.catastrofizacao}</strong></div>
            <div>Medo-evitação: <strong>{assessment.fatores_psicossociais?.medo_evitacao}</strong></div>
            <div>Sono: <strong>{assessment.fatores_psicossociais?.qualidade_sono || 'N/I'}</strong></div>
            <div>Estresse: <strong>{assessment.fatores_psicossociais?.estresse || 'N/I'}</strong></div>
          </div>
          {assessment.fatores_psicossociais?.observacoes && (
            <p className="text-xs text-muted-foreground mt-2 italic">{assessment.fatores_psicossociais.observacoes}</p>
          )}
        </SectionCard>

        <SectionCard icon={AlertTriangle} title="🚨 Red Flags" sectionKey="redflags" expanded={expandedSections} toggle={toggleSection} danger>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">{assessment.red_flags?.length || 0} red flag(s)</span>
            <Button variant="ghost" size="sm" className="h-5 text-[10px] text-primary"
              onClick={() => startEditField('red_flags', (assessment.red_flags || []).map((rf: any) => typeof rf === 'string' ? rf : (rf?.descricao || JSON.stringify(rf))).join('\n'))}>
              <Edit3 className="h-3 w-3 mr-1" />Editar
            </Button>
          </div>
          {editingField === 'red_flags' ? (
            <div className="space-y-1">
              <Textarea value={editFieldValue} onChange={e => setEditFieldValue(e.target.value)} className="text-sm min-h-[60px]" autoFocus placeholder="Uma red flag por linha" />
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => saveFieldEdit('red_flags')}><CheckCircle2 className="h-3 w-3 mr-1" />OK</Button>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingField(null)}>Cancelar</Button>
              </div>
            </div>
          ) : assessment.red_flags?.length > 0 ? (
            <ul className="space-y-1">
              {assessment.red_flags.map((rf: any, i: number) => (
                <li key={i} className="text-sm text-destructive flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />{typeof rf === 'string' ? rf : (rf?.diagnostico || rf?.descricao || JSON.stringify(rf))}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground italic">Nenhuma red flag identificada</p>
          )}
        </SectionCard>

        <SectionCard icon={Stethoscope} title="Hipóteses Diagnósticas" sectionKey="hipoteses" expanded={expandedSections} toggle={toggleSection}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">{assessment.hipoteses_diagnosticas?.length || 0} hipótese(s)</span>
            <Button variant="ghost" size="sm" className="h-5 text-[10px] text-primary"
              onClick={() => startEditField('hipoteses', (assessment.hipoteses_diagnosticas || []).map((h: any) => `${h.diagnostico} | ${h.probabilidade} | ${h.evidencia || ''}`).join('\n'))}>
              <Edit3 className="h-3 w-3 mr-1" />Editar
            </Button>
          </div>
          {editingField === 'hipoteses' ? (
            <div className="space-y-1">
              <Textarea value={editFieldValue} onChange={e => setEditFieldValue(e.target.value)} className="text-sm min-h-[80px]" autoFocus
                placeholder="Formato: Diagnóstico | Probabilidade | Evidência (uma por linha)" />
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => saveFieldEdit('hipoteses')}><CheckCircle2 className="h-3 w-3 mr-1" />OK</Button>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setEditingField(null)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {assessment.hipoteses_diagnosticas?.map((h: any, i: number) => (
                <div key={i} className="border border-border/50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{typeof h.diagnostico === 'string' ? h.diagnostico : JSON.stringify(h.diagnostico)}</span>
                    <Badge variant={h.probabilidade === 'Alta' ? 'default' : 'outline'} className="text-xs">
                      {typeof h.probabilidade === 'string' ? h.probabilidade : JSON.stringify(h.probabilidade)}
                    </Badge>
                  </div>
                  {h.lente_clinica && (
                    <Badge variant="outline" className="text-[10px] mt-1 border-primary/30 text-primary">
                      <Sparkles className="h-2.5 w-2.5 mr-1" />{h.lente_clinica}
                    </Badge>
                  )}
                  {h.unidade_relacionada && <p className="text-xs text-muted-foreground mt-0.5">UC: {typeof h.unidade_relacionada === 'string' ? h.unidade_relacionada : JSON.stringify(h.unidade_relacionada)}</p>}
                  <p className="text-xs text-muted-foreground mt-1 italic">📖 {typeof h.evidencia === 'string' ? h.evidencia : JSON.stringify(h.evidencia)}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* ── RACIOCÍNIO MULTIDISCIPLINAR ── */}
        {assessment.raciocinio_multidisciplinar && (
          <SectionCard icon={Users} title="🧠 Raciocínio Multidisciplinar" sectionKey="multi" expanded={expandedSections} toggle={toggleSection}>
            <p className="text-xs text-muted-foreground mb-3 italic">A visão de cada especialidade sobre este caso.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {Object.entries({
                fisioterapia_musculoesqueletica: '🦴 Fisioterapia Musculoesquelética',
                neurociencia_da_dor: '🧬 Neurociência da Dor',
                reabilitacao_esportiva: '🏃 Reabilitação Esportiva',
                osteopatia: '🌿 Osteopatia',
                quiropraxia: '⚙️ Quiropraxia',
                posturologia: '📐 Posturologia',
              }).map(([key, label]) => {
                const value = assessment.raciocinio_multidisciplinar?.[key];
                if (!value) return null;
                return (
                  <div key={key} className="rounded-lg border border-border/50 bg-muted/30 p-3">
                    <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{value}</p>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* ── CIF (ICF) ── */}
        {assessment.cif_codes?.length > 0 && (
          <SectionCard icon={Tag} title="🏷️ Mapeamento CIF (ICF)" sectionKey="cif" expanded={expandedSections} toggle={toggleSection}>
            <p className="text-xs text-muted-foreground mb-2 italic">Classificação Internacional de Funcionalidade — qualificador 0 (sem problema) a 4 (completo).</p>
            <div className="space-y-1.5">
              {assessment.cif_codes.map((c: any, i: number) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-md border border-border/50 hover:bg-muted/30 transition-colors">
                  <Badge variant="outline" className="text-[10px] font-mono shrink-0 mt-0.5">{c.codigo}</Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{c.descricao}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {c.categoria === 'b' ? 'Função' : c.categoria === 's' ? 'Estrutura' : c.categoria === 'd' ? 'Atividade' : 'Ambiental'}
                      </span>
                      <span className="text-[10px] font-medium text-foreground">Q{c.qualificador}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ── DIRETRIZ DE TRATAMENTO EM 3 FASES ── */}
        {assessment.diretriz_tratamento && (
          <SectionCard icon={CheckCircle2} title="🎯 Diretriz de Tratamento — 3 Fases" sectionKey="diretriz" expanded={expandedSections} toggle={toggleSection}>
            <div className="space-y-4">
              {[
                { key: 'fase_1_alivio', label: 'FASE 1 — Alívio & Proteção', color: 'border-l-amber-500' },
                { key: 'fase_2_carga', label: 'FASE 2 — Carga Progressiva', color: 'border-l-blue-500' },
                { key: 'fase_3_retorno', label: 'FASE 3 — Retorno Funcional', color: 'border-l-emerald-500' },
              ].map(({ key, label, color }) => {
                const fase = assessment.diretriz_tratamento?.[key];
                if (!fase) return null;
                return (
                  <div key={key} className={cn('border-l-4 pl-3 py-1', color)}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
                      {fase.duracao_semanas && <Badge variant="outline" className="text-[10px]">{fase.duracao_semanas}</Badge>}
                    </div>
                    {fase.objetivos?.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Objetivos</p>
                        <ul className="text-xs text-muted-foreground space-y-0.5">
                          {fase.objetivos.map((o: string, i: number) => <li key={i}>• {o}</li>)}
                        </ul>
                      </div>
                    )}
                    {fase.tecnicas?.length > 0 && (
                      <div className="space-y-1.5">
                        {fase.tecnicas.map((t: any, i: number) => (
                          <div key={i} className="bg-muted/40 rounded-md p-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-medium text-xs">{t.tecnica}</span>
                              <div className="flex items-center gap-1">
                                {t.lente_clinica && <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">{t.lente_clinica}</Badge>}
                                <Badge variant="outline" className="text-[9px]">N{t.nivel_evidencia}</Badge>
                              </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{t.justificativa}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {assessment.diretriz_tratamento.frequencia_sugerida && (
                <p className="text-xs"><strong>Frequência:</strong> {assessment.diretriz_tratamento.frequencia_sugerida}</p>
              )}
              {assessment.diretriz_tratamento.prognostico && (
                <p className="text-xs"><strong>Prognóstico:</strong> {assessment.diretriz_tratamento.prognostico}</p>
              )}
              {assessment.diretriz_tratamento.criterios_alta?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5">Critérios de Alta</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {assessment.diretriz_tratamento.criterios_alta.map((c: string, i: number) => <li key={i}>✓ {c}</li>)}
                  </ul>
                </div>
              )}

              {/* CTA — transformar em Diretriz Oficial */}
              {pacienteId && (
                <div className="pt-3 mt-3 border-t border-border">
                  {diretrizCreatedId ? (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Diretriz oficial criada e disponível na aba Diretrizes do paciente.</span>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={criarDiretrizDaVoz}
                      disabled={creatingDiretriz || !isSaved}
                      className="w-full gap-1.5 h-9 bg-primary text-primary-foreground"
                    >
                      {creatingDiretriz ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Target className="h-3.5 w-3.5" />
                      )}
                      {creatingDiretriz ? 'Criando diretriz…' : 'Criar Diretriz Oficial a partir desta análise'}
                    </Button>
                  )}
                  {!isSaved && !diretrizCreatedId && (
                    <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                      Salve a avaliação primeiro para criar a diretriz oficial.
                    </p>
                  )}
                </div>
              )}
            </div>
          </SectionCard>
        )}

        <SectionCard icon={CheckCircle2} title="Plano de Tratamento (resumo)" sectionKey="plano" expanded={expandedSections} toggle={toggleSection}>
          {assessment.plano_tratamento?.objetivos_curto_prazo?.length > 0 && (
            <div className="mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Curto Prazo</span>
              <ul className="text-sm space-y-1 mt-1">
                {assessment.plano_tratamento.objetivos_curto_prazo.map((o: any, i: number) => <li key={i}>• {typeof o === 'string' ? o : JSON.stringify(o)}</li>)}
              </ul>
            </div>
          )}
          {assessment.plano_tratamento?.tecnicas_recomendadas?.length > 0 && (
            <div className="mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Técnicas Recomendadas</span>
              <div className="space-y-2 mt-1">
                {assessment.plano_tratamento.tecnicas_recomendadas.map((t: any, i: number) => (
                  <div key={i} className="bg-secondary/50 rounded-lg p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{t.tecnica}</span>
                      <Badge variant="outline" className="text-xs">Nível {t.nivel_evidencia}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{t.justificativa}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-sm"><strong>Prognóstico:</strong> {assessment.plano_tratamento?.prognostico}</p>
        </SectionCard>

        <SectionCard icon={Lightbulb} title="Insights Baseados em Evidências" sectionKey="insights" expanded={expandedSections} toggle={toggleSection}>
          <div className="space-y-3">
            {assessment.insights_baseados_evidencia?.map((ins: any, i: number) => (
              <div key={i} className="border-l-2 border-primary/40 pl-3">
                <p className="text-sm font-medium">{ins.insight}</p>
                <div className="flex items-center gap-2 mt-1">
                  <BookOpen className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground italic">{ins.referencia}</span>
                  <Badge variant="outline" className="text-xs ml-auto">{ins.relevancia_clinica}</Badge>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    );
  }

  // ── Step 2: Review & Edit Transcript ──
  if (step === 'review') {
    return (
      <div className="space-y-4">
        <Card className="border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-14 w-14 rounded-full flex items-center justify-center bg-accent/10">
                <Edit3 className="h-7 w-7 text-accent-foreground" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Revisar Transcrição</h3>
                <p className="text-sm text-muted-foreground">
                  {audioBase64
                    ? 'Áudio capturado! Adicione contexto ou anotações extras (opcional). A IA transcreverá o áudio automaticamente.'
                    : 'Corrija erros, adicione informações ou complete trechos antes de gerar a avaliação.'}
                </p>
              </div>
            </div>

            {audioBase64 && (
              <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm">
                <CheckCircle2 className="h-4 w-4" />
                <span>Áudio gravado ({formatTime(recordingTime)}) — será transcrito e analisado pela IA</span>
              </div>
            )}

            <Textarea
              value={editedTranscript}
              onChange={(e) => setEditedTranscript(e.target.value)}
              placeholder={audioBase64 ? "Notas adicionais (opcional)..." : "Revise e edite a transcrição..."}
              className="min-h-[200px] text-sm"
            />
            {editedTranscript && <p className="text-xs text-muted-foreground mt-1">{editedTranscript.split(/\s+/).filter(Boolean).length} palavras</p>}

            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => setStep('record')}>
                <RotateCcw className="h-4 w-4 mr-2" />Voltar
              </Button>
              <Button
                onClick={processAssessment}
                disabled={isProcessing || (!audioBase64 && editedTranscript.trim().length < 20)}
                className="bg-primary text-primary-foreground"
              >
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analisando...</> : <><Brain className="h-4 w-4 mr-2" />Gerar Avaliação</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {isProcessing && (
          <Card className="border-primary/20">
            <CardContent className="p-6 flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground text-center">
                {audioBase64 ? 'Transcrevendo áudio e cruzando 6 lentes clínicas...' : 'Cruzando 6 lentes clínicas com base em evidências...'}
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center max-w-md">
                <Badge variant="outline" className="text-[10px]">🦴 Fisio (Magee)</Badge>
                <Badge variant="outline" className="text-[10px]">🧬 Neurociência (Moseley)</Badge>
                <Badge variant="outline" className="text-[10px]">🏃 Esporte (Cook)</Badge>
                <Badge variant="outline" className="text-[10px]">🌿 Osteopatia (Greenman)</Badge>
                <Badge variant="outline" className="text-[10px]">⚙️ Quiropraxia (Bergmann)</Badge>
                <Badge variant="outline" className="text-[10px]">📐 Posturologia (Souchard)</Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ── Step 1: Recording UI ──
  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={cn(
              'h-14 w-14 rounded-full flex items-center justify-center transition-all',
              isRecording ? 'bg-destructive/10 animate-pulse' : 'bg-primary/10'
            )}>
              {isRecording ? <Mic className="h-7 w-7 text-destructive" /> : <MicOff className="h-7 w-7 text-primary" />}
            </div>
            <div>
              <h3 className="font-bold text-lg">Avaliação por Voz</h3>
              <p className="text-sm text-muted-foreground">
                {SERVICE_LABELS[serviceType]} — {isRecording ? 'Gravando áudio...' : 'Grave a consulta ou digite/cole a transcrição'}
              </p>
            </div>
          </div>

          {editedTranscript.trim().length > 0 && !isRecording && (
            <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-muted text-muted-foreground text-sm">
              <FileText className="h-4 w-4 flex-shrink-0" />
              <span>Texto existente: {editedTranscript.split(/\s+/).filter(Boolean).length} palavras — grave mais áudio ou adicione texto para complementar.</span>
            </div>
          )}

          <div className="flex gap-2 items-center mb-4">
            {!isRecording ? (
              <Button onClick={startRecording} className="bg-primary text-primary-foreground">
                <Mic className="h-4 w-4 mr-2" />Iniciar Gravação
              </Button>
            ) : (
              <>
                <Button onClick={stopRecording} variant="destructive">
                  <MicOff className="h-4 w-4 mr-2" />Parar Gravação
                </Button>
                <div className="flex items-center gap-1.5 text-sm text-destructive font-mono">
                  <Clock className="h-4 w-4" />
                  {formatTime(recordingTime)}
                </div>
              </>
            )}
            {(audioBase64 || transcript.trim().length > 20 || editedTranscript.trim().length > 20) && !isRecording && (
              <Button onClick={goToReview} className="bg-accent text-accent-foreground">
                <Edit3 className="h-4 w-4 mr-2" />{appendMode ? 'Capturar e Adicionar' : 'Revisar e Processar'}
              </Button>
            )}
          </div>

          {audioBase64 && !isRecording && (
            <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>Áudio capturado ({formatTime(recordingTime)}) — pronto para processar</span>
            </div>
          )}

          <div className="relative">
            <p className="text-xs text-muted-foreground mb-1">Ou cole/digite a transcrição manualmente:</p>
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Cole ou digite a transcrição aqui (alternativa ao áudio)..."
              className="min-h-[100px] text-sm"
            />
          </div>
          {transcript.length > 0 && (
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-muted-foreground">{transcript.split(/\s+/).filter(Boolean).length} palavras</p>
              {!isRecording && transcript.trim().length > 20 && (
                <Button variant="ghost" size="sm" onClick={goToReview} className="text-xs text-primary">
                  Revisar antes de processar →
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Collapsible Section Card ──
function SectionCard({ icon: Icon, title, sectionKey, expanded, toggle, children, danger }: {
  icon: any; title: string; sectionKey: string;
  expanded: Record<string, boolean>; toggle: (k: string) => void;
  children: React.ReactNode; danger?: boolean;
}) {
  const isOpen = expanded[sectionKey];
  return (
    <Card className={cn('transition-all', danger && 'border-destructive/30 bg-destructive/5')}>
      <button onClick={() => toggle(sectionKey)} className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', danger ? 'text-destructive' : 'text-primary')} />
          <span className="font-semibold text-sm">{title}</span>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {isOpen && <CardContent className="pt-0 pb-4 px-4">{children}</CardContent>}
    </Card>
  );
}
