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
  'Favor√°vel': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Atenção': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Aten√ß√£o': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Moderado': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'Severo': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'Risco de Cronificação': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'Risco de Cronifica√ß√£o': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
};

type Step = 'record' | 'review' | 'result';

export default function VoiceAssessment({ serviceType, pacienteId, patientName, patientAge, patientSex, onAssessmentComplete }: VoiceAssessmentProps) {
  const { toast } = useToast();
  const { user } = useAuth();
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
        const descricao = `${assessmentToSave.resumo_clinico}\n\nQueixa: ${assessmentToSave.queixa_principal || 'N/I'}\nDor EVA: ${assessmentToSave.dor?.intensidade_eva || '?'}/10 — ${assessmentToSave.dor?.tipo || 'N/I'}\nClassificação: ${assessmentToSave.classificacao_severidade}\n\nHipóteses: ${assessmentToSave.hipoteses_diagnosticas?.map((h: any) => h.diagnostico).join(', ') || 'N/I'}`;

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
      if (error) throw error;
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
      toast({ title: 'Erro ao processar', description: err.message, variant: 'destructive' });
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
            <Button variant="outline" size="sm" onClick={() => setIsEditingTranscript(prev => !prev)}>
              <Edit3 className="h-4 w-4 mr-1" />{isEditingTranscript ? 'Fechar Editor' : 'Ver/Editar Texto'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setTranscript(editedTranscript); setStep('record'); }}>
              <Mic className="h-4 w-4 mr-1" />Adicionar Áudio
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
                <Button size="sm" variant="outline" onClick={() => { setTranscript(editedTranscript); setStep('record'); }}>
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

        <SectionCard icon={FileText} title="Resumo Clínico" sectionKey="resumo" expanded={expandedSections} toggle={toggleSection}>
          <p className="text-sm text-muted-foreground leading-relaxed">{assessment.resumo_clinico}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {assessment.queixa_principal && <Badge variant="secondary">QP: {assessment.queixa_principal}</Badge>}
            {assessment.tempo_evolucao && <Badge variant="outline">⏱ {assessment.tempo_evolucao}</Badge>}
          </div>
        </SectionCard>

        <SectionCard icon={Activity} title="Análise da Dor" sectionKey="dor" expanded={expandedSections} toggle={toggleSection}>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Local:</span> <strong>{assessment.dor?.localizacao}</strong></div>
            <div><span className="text-muted-foreground">EVA:</span> <strong className="text-lg">{assessment.dor?.intensidade_eva}/10</strong></div>
            <div><span className="text-muted-foreground">Tipo:</span> <strong>{assessment.dor?.tipo}</strong></div>
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
          <Badge className={cn('text-xs mb-2', assessment.funcionalidade?.nivel_impacto === 'Incapacitante' ? 'bg-destructive text-white' : 'bg-secondary')}>
            Impacto: {assessment.funcionalidade?.nivel_impacto}
          </Badge>
          {assessment.funcionalidade?.limitacoes_avds?.length > 0 && (
            <ul className="text-sm text-muted-foreground space-y-1 mt-2">
              {assessment.funcionalidade.limitacoes_avds.map((l: any, i: number) => <li key={i}>• {typeof l === 'string' ? l : JSON.stringify(l)}</li>)}
            </ul>
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

        {assessment.red_flags?.length > 0 && (
          <SectionCard icon={AlertTriangle} title="🚨 Red Flags" sectionKey="redflags" expanded={expandedSections} toggle={toggleSection} danger>
            <ul className="space-y-1">
              {assessment.red_flags.map((rf: any, i: number) => (
                <li key={i} className="text-sm text-destructive flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />{typeof rf === 'string' ? rf : (rf?.diagnostico || rf?.descricao || JSON.stringify(rf))}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        <SectionCard icon={Stethoscope} title="Hipóteses Diagnósticas" sectionKey="hipoteses" expanded={expandedSections} toggle={toggleSection}>
          <div className="space-y-3">
            {assessment.hipoteses_diagnosticas?.map((h: any, i: number) => (
              <div key={i} className="border border-border/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{typeof h.diagnostico === 'string' ? h.diagnostico : JSON.stringify(h.diagnostico)}</span>
                  <Badge variant={h.probabilidade === 'Alta' ? 'default' : 'outline'} className="text-xs">
                    {typeof h.probabilidade === 'string' ? h.probabilidade : JSON.stringify(h.probabilidade)}
                  </Badge>
                </div>
                {h.unidade_relacionada && <p className="text-xs text-muted-foreground mt-0.5">UC: {typeof h.unidade_relacionada === 'string' ? h.unidade_relacionada : JSON.stringify(h.unidade_relacionada)}</p>}
                <p className="text-xs text-muted-foreground mt-1 italic">📖 {typeof h.evidencia === 'string' ? h.evidencia : JSON.stringify(h.evidencia)}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard icon={CheckCircle2} title="Plano de Tratamento" sectionKey="plano" expanded={expandedSections} toggle={toggleSection}>
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
              <p className="text-sm text-muted-foreground">
                {audioBase64 ? 'Transcrevendo áudio e analisando com IA clínica...' : 'Analisando conversa com IA clínica baseada em evidências...'}
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                <Badge variant="outline" className="text-xs">Magee (2021)</Badge>
                <Badge variant="outline" className="text-xs">O'Sullivan (2018)</Badge>
                <Badge variant="outline" className="text-xs">Butler & Moseley</Badge>
                <Badge variant="outline" className="text-xs">Cook (2014)</Badge>
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
            {(audioBase64 || transcript.trim().length > 20) && !isRecording && (
              <Button onClick={goToReview} className="bg-accent text-accent-foreground">
                <Edit3 className="h-4 w-4 mr-2" />Revisar e Processar
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
