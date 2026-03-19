import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mic, MicOff, Loader2, AlertTriangle, CheckCircle2, Brain, FileText, Stethoscope, Activity, Shield, Lightbulb, ChevronDown, ChevronUp, Copy, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

type ServiceType = 'identidade' | 'cobzero' | 'studio';

interface VoiceAssessmentProps {
  serviceType: ServiceType;
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

export default function VoiceAssessment({ serviceType, patientName, patientAge, patientSex, onAssessmentComplete }: VoiceAssessmentProps) {
  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [assessment, setAssessment] = useState<any>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    resumo: true, dor: true, funcionalidade: true, psicossocial: false,
    redflags: true, hipoteses: true, plano: true, insights: true,
  });
  const recognitionRef = useRef<any>(null);
  const fullTranscriptRef = useRef('');
  const isListeningRef = useRef(false);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = useCallback(() => {
    if (!isSupported) {
      toast({ title: 'Navegador não suporta reconhecimento de voz', description: 'Use Chrome, Edge ou Safari.', variant: 'destructive' });
      return;
    }

    // Stop any existing recognition first
    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t + ' ';
        } else {
          interimTranscript = t;
        }
      }
      if (finalTranscript) {
        fullTranscriptRef.current += finalTranscript;
      }
      setTranscript(fullTranscriptRef.current + interimTranscript);
    };

    recognition.onerror = (e: any) => {
      console.error('Speech recognition error:', e.error);
      if (e.error === 'not-allowed' || e.error === 'service-not-available') {
        toast({ title: 'Microfone não permitido', description: 'Permita o acesso ao microfone nas configurações do navegador.', variant: 'destructive' });
        isListeningRef.current = false;
        setIsListening(false);
        recognitionRef.current = null;
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        toast({ title: 'Erro no reconhecimento de voz', description: e.error, variant: 'destructive' });
      }
    };

    recognition.onend = () => {
      // Auto-restart if still listening (use ref to avoid stale closure)
      if (isListeningRef.current) {
        try { recognition.start(); } catch {
          isListeningRef.current = false;
          setIsListening(false);
          recognitionRef.current = null;
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      isListeningRef.current = true;
      setIsListening(true);
    } catch (err) {
      console.error('Failed to start recognition:', err);
      toast({ title: 'Erro ao iniciar gravação', description: 'Tente novamente ou use outro navegador.', variant: 'destructive' });
      recognitionRef.current = null;
    }
  }, [isSupported, toast]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setTranscript(fullTranscriptRef.current);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const processTranscript = async () => {
    const text = transcript.trim();
    if (text.length < 20) {
      toast({ title: 'Transcrição muito curta', description: 'Grave pelo menos algumas frases da conversa.', variant: 'destructive' });
      return;
    }
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('voice-assessment', {
        body: { transcript: text, serviceType, patientName, patientAge, patientSex },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAssessment(data.assessment);
      onAssessmentComplete?.(data.assessment);
      toast({ title: '✅ Avaliação gerada!', description: 'Avaliação clínica baseada em evidências pronta.' });
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
    fullTranscriptRef.current = '';
    setAssessment(null);
  };

  // ── Render: Assessment Results ──
  if (assessment) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-lg">Avaliação por Voz</h3>
            <Badge className={cn('text-xs', SEVERITY_COLORS[assessment.classificacao_severidade] || 'bg-muted')}>
              {assessment.classificacao_severidade}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyAssessment}><Copy className="h-4 w-4 mr-1" />Copiar</Button>
            <Button variant="outline" size="sm" onClick={resetAll}>Nova Avaliação</Button>
          </div>
        </div>

        {/* Resumo */}
        <SectionCard icon={FileText} title="Resumo Clínico" sectionKey="resumo" expanded={expandedSections} toggle={toggleSection}>
          <p className="text-sm text-muted-foreground leading-relaxed">{assessment.resumo_clinico}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {assessment.queixa_principal && <Badge variant="secondary">QP: {assessment.queixa_principal}</Badge>}
            {assessment.tempo_evolucao && <Badge variant="outline">⏱ {assessment.tempo_evolucao}</Badge>}
          </div>
        </SectionCard>

        {/* Dor */}
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

        {/* Funcionalidade */}
        <SectionCard icon={Activity} title="Funcionalidade" sectionKey="funcionalidade" expanded={expandedSections} toggle={toggleSection}>
          <Badge className={cn('text-xs mb-2', assessment.funcionalidade?.nivel_impacto === 'Incapacitante' ? 'bg-destructive text-white' : 'bg-secondary')}>
            Impacto: {assessment.funcionalidade?.nivel_impacto}
          </Badge>
          {assessment.funcionalidade?.limitacoes_avds?.length > 0 && (
            <ul className="text-sm text-muted-foreground space-y-1 mt-2">
              {assessment.funcionalidade.limitacoes_avds.map((l: string, i: number) => <li key={i}>• {l}</li>)}
            </ul>
          )}
        </SectionCard>

        {/* Fatores Psicossociais */}
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

        {/* Red Flags */}
        {assessment.red_flags?.length > 0 && (
          <SectionCard icon={AlertTriangle} title="🚨 Red Flags" sectionKey="redflags" expanded={expandedSections} toggle={toggleSection} danger>
            <ul className="space-y-1">
              {assessment.red_flags.map((rf: string, i: number) => (
                <li key={i} className="text-sm text-destructive flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />{rf}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* Hipóteses Diagnósticas */}
        <SectionCard icon={Stethoscope} title="Hipóteses Diagnósticas" sectionKey="hipoteses" expanded={expandedSections} toggle={toggleSection}>
          <div className="space-y-3">
            {assessment.hipoteses_diagnosticas?.map((h: any, i: number) => (
              <div key={i} className="border border-border/50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{h.diagnostico}</span>
                  <Badge variant={h.probabilidade === 'Alta' ? 'default' : 'outline'} className="text-xs">
                    {h.probabilidade}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 italic">📖 {h.evidencia}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Plano de Tratamento */}
        <SectionCard icon={CheckCircle2} title="Plano de Tratamento" sectionKey="plano" expanded={expandedSections} toggle={toggleSection}>
          {assessment.plano_tratamento?.objetivos_curto_prazo?.length > 0 && (
            <div className="mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Curto Prazo</span>
              <ul className="text-sm space-y-1 mt-1">
                {assessment.plano_tratamento.objetivos_curto_prazo.map((o: string, i: number) => <li key={i}>• {o}</li>)}
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

        {/* Insights */}
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

  // ── Render: Recording UI ──
  return (
    <div className="space-y-4">
      <Card className="border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={cn(
              'h-14 w-14 rounded-full flex items-center justify-center transition-all',
              isListening ? 'bg-destructive/10 animate-pulse' : 'bg-primary/10'
            )}>
              {isListening ? <Mic className="h-7 w-7 text-destructive" /> : <MicOff className="h-7 w-7 text-primary" />}
            </div>
            <div>
              <h3 className="font-bold text-lg">Avaliação por Voz</h3>
              <p className="text-sm text-muted-foreground">
                {SERVICE_LABELS[serviceType]} — {isListening ? 'Gravando conversa...' : 'Inicie a gravação e converse com o paciente'}
              </p>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            {!isListening ? (
              <Button onClick={startListening} className="bg-primary text-primary-foreground">
                <Mic className="h-4 w-4 mr-2" />Iniciar Gravação
              </Button>
            ) : (
              <Button onClick={stopListening} variant="destructive">
                <MicOff className="h-4 w-4 mr-2" />Parar Gravação
              </Button>
            )}
            {transcript.length > 20 && !isListening && (
              <Button onClick={processTranscript} disabled={isProcessing} className="bg-accent text-accent-foreground">
                {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analisando...</> : <><Brain className="h-4 w-4 mr-2" />Gerar Avaliação</>}
              </Button>
            )}
          </div>

          {!isSupported && (
            <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />Navegador não suporta reconhecimento de voz. Use Chrome ou Edge.
            </div>
          )}

          <Textarea
            value={transcript}
            onChange={(e) => { setTranscript(e.target.value); fullTranscriptRef.current = e.target.value; }}
            placeholder="A transcrição aparecerá aqui conforme você conversa... Ou cole/digite manualmente."
            className="min-h-[120px] text-sm"
          />
          {transcript.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">{transcript.split(/\s+/).length} palavras</p>
          )}
        </CardContent>
      </Card>

      {isProcessing && (
        <Card className="border-primary/20">
          <CardContent className="p-6 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisando conversa com IA clínica baseada em evidências...</p>
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
