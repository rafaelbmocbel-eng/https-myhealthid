import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Mic, MicOff, Send, Loader2, Check, Sparkles } from 'lucide-react';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const PERGUNTAS = [
  { id: 'queixa', label: 'Onde dói ou o que você está sentindo?', placeholder: 'Ex: Dor lombar do lado direito que irradia para a perna…' },
  { id: 'inicio', label: 'Como e quando começou?', placeholder: 'Ex: Há 3 semanas, depois de levantar um peso…' },
  { id: 'caracteristica', label: 'Como é essa dor? (pontada, queimação, peso, formigamento…)', placeholder: 'Descreva o tipo de dor…' },
  { id: 'fatores', label: 'O que melhora e o que piora?', placeholder: 'Ex: Piora ao sentar muito tempo, melhora caminhando…' },
  { id: 'mudancas', label: 'Algo mudou nas últimas semanas? (rotina, sono, humor, trabalho)', placeholder: 'Conte o que mudou…' },
  { id: 'impacto', label: 'Como isso afeta seu dia a dia?', placeholder: 'Ex: Estou dormindo mal, evitando subir escada…' },
];

export default function PacienteHistoria() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const { isListening, startListening, stopListening, isSupported } = useSpeechToText();

  const totalSteps = PERGUNTAS.length;
  const isReview = step === totalSteps;
  const current = PERGUNTAS[step];
  const currentValue = current ? answers[current.id] || '' : '';

  const setAnswer = (id: string, value: string) => setAnswers(prev => ({ ...prev, [id]: value }));

  const handleVoice = () => {
    if (!current) return;
    if (isListening) { stopListening(); return; }
    startListening((text) => {
      setAnswer(current.id, ((answers[current.id] || '') + ' ' + text).trim());
    });
  };

  const goNext = () => {
    if (isListening) stopListening();
    if (currentValue.trim().length < 3) {
      toast({ title: 'Conte um pouco mais', description: 'Use voz ou texto para responder antes de avançar.' });
      return;
    }
    setStep(s => Math.min(s + 1, totalSteps));
  };

  const goBack = () => {
    if (isListening) stopListening();
    setStep(s => Math.max(0, s - 1));
  };

  const enviar = async () => {
    const filled = PERGUNTAS
      .map(p => ({ pergunta: p.label, resposta: (answers[p.id] || '').trim() }))
      .filter(a => a.resposta.length >= 3);
    if (filled.length < 2) {
      toast({ title: 'Falta um pouco', description: 'Responda pelo menos 2 perguntas.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('historia-paciente', {
        body: { answers: filled },
      });
      if (error) throw error;
      const tipo = (data as any)?.tipo;
      toast({
        title: tipo === 'inicial' ? '✅ História enviada — avaliação inicial registrada' : '✅ Atualização enviada',
        description: 'Seu profissional foi notificado e vai revisar.',
      });
      navigate('/paciente/dashboard');
    } catch (e: any) {
      toast({
        title: 'Não foi possível enviar',
        description: e?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filledCount = PERGUNTAS.filter(p => (answers[p.id] || '').trim().length >= 3).length;

  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="h-page flex items-center gap-2">
                <Sparkles className="icon-md text-primary" /> Conte sua história
              </h1>
              <p className="text-caption mt-0.5">
                Use a voz ou escreva. Vamos passar pelas perguntas juntos.
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              {isReview ? 'Revisão' : `${step + 1}/${totalSteps}`}
            </Badge>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((isReview ? totalSteps : step) / totalSteps) * 100}%` }}
            />
          </div>

          {/* Question card OR Review */}
          {!isReview && current && (
            <Card>
              <CardContent className="p-4 sm:p-5 space-y-4">
                <h2 className="h-section">{current.label}</h2>

                <Textarea
                  value={currentValue}
                  onChange={e => setAnswer(current.id, e.target.value)}
                  placeholder={current.placeholder}
                  rows={5}
                  className="text-base resize-none"
                  style={{ fontSize: '16px' }}
                />

                <div className="flex items-center justify-between gap-2">
                  {isSupported ? (
                    <Button
                      type="button"
                      variant={isListening ? 'destructive' : 'secondary'}
                      onClick={handleVoice}
                      className="gap-2 flex-1 sm:flex-none"
                    >
                      {isListening ? <MicOff className="icon-sm" /> : <Mic className="icon-sm" />}
                      {isListening ? 'Parar' : 'Falar'}
                    </Button>
                  ) : (
                    <span className="text-caption">Voz indisponível neste navegador — pode escrever.</span>
                  )}
                  <span className="text-micro text-muted-foreground">
                    {currentValue.length} caracteres
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {isReview && (
            <Card>
              <CardContent className="p-4 sm:p-5 space-y-4">
                <h2 className="h-section flex items-center gap-2">
                  <Check className="icon-sm text-primary" /> Confira antes de enviar
                </h2>
                <div className="space-y-3">
                  {PERGUNTAS.map((p, i) => {
                    const v = (answers[p.id] || '').trim();
                    return (
                      <div key={p.id} className="space-y-1">
                        <button
                          onClick={() => setStep(i)}
                          className="text-xs text-muted-foreground hover:text-foreground text-left"
                        >
                          {p.label} <span className="underline ml-1">editar</span>
                        </button>
                        <p className={cn(
                          'text-sm rounded-lg border border-border/40 p-2',
                          v ? 'text-foreground bg-muted/30' : 'text-muted-foreground italic'
                        )}>
                          {v || 'Não respondida'}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <p className="text-micro text-muted-foreground">
                  Sua resposta vira uma avaliação estruturada para o seu profissional revisar.
                  {filledCount < 2 && ' Responda ao menos 2 perguntas para enviar.'}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Nav buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={goBack}
              disabled={step === 0 || submitting}
              className="gap-1"
            >
              <ChevronLeft className="icon-sm" /> Voltar
            </Button>
            <div className="flex-1" />
            {!isReview ? (
              <Button onClick={goNext} className="gap-1">
                {step === totalSteps - 1 ? 'Revisar' : 'Próxima'}
                <ChevronRight className="icon-sm" />
              </Button>
            ) : (
              <Button onClick={enviar} disabled={submitting || filledCount < 2} className="gap-2">
                {submitting ? <Loader2 className="icon-sm animate-spin" /> : <Send className="icon-sm" />}
                {submitting ? 'Enviando…' : 'Enviar para meu profissional'}
              </Button>
            )}
          </div>
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
