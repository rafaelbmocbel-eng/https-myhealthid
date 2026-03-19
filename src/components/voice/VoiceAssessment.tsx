import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Mic, MicOff, Loader2, AlertTriangle, CheckCircle2, Brain, FileText, Stethoscope, Activity, Shield, Lightbulb, ChevronDown, ChevronUp, Copy, BookOpen, Save, Edit3, RotateCcw, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type ServiceType = 'identidade' | 'cobzero' | 'studio';

interface VoiceAssessmentProps {
  serviceType: ServiceType;
  pacienteId?: string;
  patientName?: string;
  patientAge?: number;
  patientSex?: string;
  onAssessmentComplete?: (assessment: any) => void;
}

const SERVICE_LABELS: Record<ServiceType, string> = {
  identidade: 'Método Identidade',
  cobzero: 'COB° ZERO',
  studio: 'Studio Personal ID',
};

const SEVERITY_COLORS: Record<string, string> = {
  'Favorável': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Atenção': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Moderado': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'Severo': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'Risco de Cronificação': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

type Step = 'record' | 'review' | 'result';

export default function VoiceAssessment({ serviceType, pacienteId, patientName, patientAge, patientSex, onAssessmentComplete }: VoiceAssessmentProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('record');
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
    resumo: true, dor: true, funcionalidade: true, psicossocial: false,
    redflags: true, hipoteses: true, plano: true, insights: true,
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

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
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const goToReview = () => {
    if (!audioBase64 && transcript.trim().length < 20) {
      toast({ title: 'Conteúdo insuficiente', description: 'Grave áudio ou digite/cole a transcrição.', variant: 'destructive' });
      return;
    }
    setEditedTranscript(transcript.trim());
    setStep('review');
  };

  const processAssessment = async () => {
    const text = editedTranscript.trim();
    if (!audioBase64 && text.length < 20) {
      toast({ title: 'Conteúdo insuficiente', description: 'Adicione mais conteúdo ou grave áudio.', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
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
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAssessment(data.assessment);
      // If Gemini returned a transcription from audio, use it
      if (data.transcricao && (!editedTranscript || editedTranscript.length < 20)) {
        setEditedTranscript(data.transcricao);
      }
      setStep('result');
      onAssessmentComplete?.(data.assessment);
      toast({ title: '✅ Avaliação gerada!', description: 'Revise e salve no prontuário.' });
    } catch (err: any) {
      toast({ title: 'Erro ao processar', description: err.message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const saveAssessment = async () => {
    if (!assessment || !user) return;
    setIsSaving(true);
    try {
      const { error: saveError } = await supabase.from('avaliacoes_voz' as any).insert({
        terapeuta_id: user.id,
        paciente_id: pacienteId || null,
        paciente_nome: patientName || null,
        servico: serviceType,
        transcricao: editedTranscript || 'Avaliação por áudio',
        resultado: assessment,
        classificacao_severidade: assessment.classificacao_severidade,
        queixa_principal: assessment.queixa_principal,
      } as any);
      if (saveError) throw saveError;

      if (pacienteId) {
        const descricao = `${assessment.resumo_clinico}\n\nQueixa: ${assessment.queixa_principal || 'N/I'}\nDor EVA: ${assessment.dor?.intensidade_eva || '?'}/10 — ${assessment.dor?.tipo || 'N/I'}\nClassificação: ${assessment.classificacao_severidade}\n\nHipóteses: ${assessment.hipoteses_diagnosticas?.map((h: any) => h.diagnostico).join(', ') || 'N/I'}`;
        const { error: prontuarioError } = await supabase.from('notas_prontuario').insert({
          paciente_id: pacienteId,
          terapeuta_id: user.id,
          tipo: 'avaliacao_voz',
          titulo: `Avaliação por Voz — ${SERVICE_LABELS[serviceType]}`,
          descricao,
          dados_extras: { assessment, transcricao: editedTranscript },
        });
        if (prontuarioError) throw prontuarioError;
      }

      setIsSaved(true);
      toast({ title: '✅ Avaliação salva!', description: pacienteId ? 'Salva no banco e no prontuário do paciente.' : 'Salva no banco de dados.' });
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
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

Queixa Principal: ${assessment.queixa_principal}
Classificação: ${assessment.classificacao_severidade}

DOR:
- Local: ${assessment.dor?.localizacao}
- EVA: ${assessment.dor?.intensidade_eva}/10
- Tipo: ${assessment.dor?.tipo}

HIPÓTESES:
${assessment.hipoteses_diagnosticas?.map((h: any) => `- ${h.diagnostico} (${h.probabilidade}) — ${h.evidencia}`).join('\n')}

INSIGHTS BASEADOS EM EVIDÊNCIAS:
${assessment.insights_baseados_evidencia?.map((i: any) => `- ${i.insight} (${i.referencia})`).join('\n')}
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
    setStep('record');
  };

  // ‚îÄ‚îÄ Step 3: Assessment Results ‚îÄ‚îÄ
  if (step === 'result' && assessment) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-lg">Avaliação por Voz</h3>
            <Badge className={cn('text-xs', SEVERITY_COLORS[assessment.classificacao_severidade] || 'bg-muted')}>
              {assessment.classificacao_severidade}
            </Badge>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={copyAssessment}><Copy className="h-4 w-4 mr-1" />Copiar</Button>
            {!isSaved ? (
              <Button size="sm" onClick={saveAssessment} disabled={isSaving} className="bg-primary text-primary-foreground">
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

        <SectionCard icon={FileText} title="Resumo Clínico" sectionKey="resumo" expanded={expandedSections} toggle={toggleSection}>
          <p className="text-sm text-muted-foreground leading-relaxed">{assessment.resumo_clinico}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {assessment.queixa_principal && <Badge variant="secondary">QP: {assessment.queixa_principal}</Badge>}
            {assessment.tempo_evolucao && <Badge variant="outline">‚è± {assessment.tempo_evolucao}</Badge>}
          </div>
        </SectionCard>

        <SectionCard icon={Activity} title="Análise da Dor" sectionKey="dor" expanded={expandedSections} toggle={toggleSection}>
