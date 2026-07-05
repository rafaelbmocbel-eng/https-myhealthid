import { useState, useEffect, useRef } from 'react';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Mic, MicOff, Send, Loader2, Sparkles } from 'lucide-react';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface HistoriaAtual {
  queixa: string;
  inicio: string;
  fatores: string;
  impacto: string;
  atualizado_em?: string;
}

const CAMPOS: {
  id: keyof Omit<HistoriaAtual, 'atualizado_em'>;
  label: string;
  hint: string;
  placeholder: string;
}[] = [
  {
    id: 'queixa',
    label: 'Qual é sua queixa principal hoje?',
    hint: 'O que te incomoda mais agora — onde dói, o que você sente.',
    placeholder: 'Ex: Dor lombar do lado direito que irradia para a perna ao me levantar…',
  },
  {
    id: 'inicio',
    label: 'Há quanto tempo começou?',
    hint: 'Como surgiu — de repente ou gradual, e o que estava acontecendo.',
    placeholder: 'Ex: Há 3 semanas, depois de carregar caixas na mudança…',
  },
  {
    id: 'fatores',
    label: 'O que melhora e o que piora?',
    hint: 'Movimentos, posições, horários do dia, repouso, calor, frio…',
    placeholder: 'Ex: Piora ao sentar muito tempo. Melhora deitada de lado com travesseiro entre os joelhos…',
  },
  {
    id: 'impacto',
    label: 'Como isso afeta sua rotina?',
    hint: 'O que você parou de fazer — sono, trabalho, atividades, humor.',
    placeholder: 'Ex: Estou dormindo mal, evitei academia essa semana e fico irritada com a dor constante…',
  },
];

export default function PacienteHistoria() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [historia, setHistoria] = useState<HistoriaAtual>({ queixa: '', inicio: '', fatores: '', impacto: '' });
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [enviando, setEnviando] = useState(false);
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [activeVoice, setActiveVoice] = useState<keyof Omit<HistoriaAtual, 'atualizado_em'> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isListening, startListening, stopListening, isSupported } = useSpeechToText();

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('pacientes')
        .select('id, queixa_principal, historia_atual')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setPacienteId(data.id);
        const ha = data.historia_atual as HistoriaAtual | null;
        setHistoria({
          queixa: ha?.queixa || data.queixa_principal || '',
          inicio: ha?.inicio || '',
          fatores: ha?.fatores || '',
          impacto: ha?.impacto || '',
          atualizado_em: ha?.atualizado_em,
        });
      }
      setLoading(false);
      setLoaded(true);
    })();
  }, [user]);

  // Auto-save debounced: atualiza pacientes diretamente
  useEffect(() => {
    if (!loaded || !pacienteId) return;

    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      try {
        const now = new Date().toISOString();
        const payload: HistoriaAtual = {
          queixa: historia.queixa.trim(),
          inicio: historia.inicio.trim(),
          fatores: historia.fatores.trim(),
          impacto: historia.impacto.trim(),
          atualizado_em: now,
        };
        await (supabase as any)
          .from('pacientes')
          .update({
            queixa_principal: historia.queixa.trim() || null,
            historia_atual: payload,
          })
          .eq('id', pacienteId);
        setHistoria(h => ({ ...h, atualizado_em: now }));
        setSaveStatus('saved');
        savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
      } catch {
        setSaveStatus('idle');
      }
    }, 2500);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historia.queixa, historia.inicio, historia.fatores, historia.impacto]);

  const updateCampo = (campo: keyof Omit<HistoriaAtual, 'atualizado_em'>, valor: string) => {
    setHistoria(h => ({ ...h, [campo]: valor }));
  };

  const handleVoice = (campo: keyof Omit<HistoriaAtual, 'atualizado_em'>) => {
    if (isListening && activeVoice === campo) {
      stopListening();
      setActiveVoice(null);
      return;
    }
    if (isListening) stopListening();
    setActiveVoice(campo);
    startListening((text) => {
      updateCampo(campo, ((historia[campo] || '') + ' ' + text).trim());
    });
  };

  const enviar = async () => {
    const preenchidos = CAMPOS.filter(c => historia[c.id].trim().length >= 3);
    if (preenchidos.length < 2) {
      toast({ title: 'Conte um pouco mais', description: 'Responda pelo menos 2 campos para enviar ao profissional.' });
      return;
    }
    setEnviando(true);
    try {
      const answers = CAMPOS
        .map(c => ({ pergunta: c.label, resposta: historia[c.id].trim() }))
        .filter(a => a.resposta.length >= 3);
      const { data, error } = await supabase.functions.invoke('historia-paciente', { body: { answers } });
      if (error) throw error;
      const tipo = (data as any)?.tipo;
      toast({
        title: tipo === 'inicial' ? '✅ História enviada' : '✅ Atualização enviada',
        description: 'Seu profissional foi notificado e vai revisar antes da consulta.',
      });
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('24h') || msg.includes('Você já enviou')) {
        toast({ title: 'Já enviado hoje', description: 'Você pode reenviar amanhã. Suas edições continuam sendo salvas.' });
      } else {
        toast({ title: 'Não foi possível enviar', description: msg || 'Tente novamente em instantes.', variant: 'destructive' });
      }
    } finally {
      setEnviando(false);
    }
  };

  const ultimaAtualizacao = historia.atualizado_em
    ? new Date(historia.atualizado_em).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      })
    : null;

  if (loading) {
    return (
      <ProtectedPatientRoute>
        <PacienteLayout>
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </PacienteLayout>
      </ProtectedPatientRoute>
    );
  }

  const camposPreenchidos = CAMPOS.filter(c => historia[c.id].trim().length >= 3).length;

  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">

          {/* Cabeçalho */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="h-page flex items-center gap-2">
                <Sparkles className="icon-md text-primary" /> História da Doença Atual
              </h1>
              <p className="text-caption mt-0.5">
                Suas respostas são salvas automaticamente. Edite quando quiser.
              </p>
              {ultimaAtualizacao && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Última atualização: {ultimaAtualizacao}
                </p>
              )}
            </div>
            <div className="shrink-0 pt-1">
              {saveStatus === 'saving' && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <span className="animate-pulse">●</span> Salvando…
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="text-[11px] text-emerald-600 flex items-center gap-1">
                  ✓ Salvo
                </span>
              )}
            </div>
          </div>

          {/* Campos editáveis */}
          {CAMPOS.map((campo, i) => {
            const valor = historia[campo.id];
            const isVoiceActive = isListening && activeVoice === campo.id;
            const preenchido = valor.trim().length >= 3;

            return (
              <Card
                key={campo.id}
                className={`transition-shadow ${preenchido ? 'border-primary/20' : ''}`}
              >
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <Badge
                      variant={preenchido ? 'default' : 'outline'}
                      className="text-[10px] h-4 px-1.5 mt-0.5 shrink-0"
                    >
                      {i + 1}
                    </Badge>
                    <div>
                      <p className="text-sm font-bold text-foreground leading-tight">{campo.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{campo.hint}</p>
                    </div>
                  </div>

                  <div className="relative">
                    <Textarea
                      value={valor}
                      onChange={e => updateCampo(campo.id, e.target.value)}
                      placeholder={campo.placeholder}
                      rows={3}
                      className="resize-none pr-12"
                      style={{ fontSize: '16px' }}
                    />
                    {isSupported && (
                      <Button
                        type="button"
                        variant={isVoiceActive ? 'destructive' : 'ghost'}
                        size="sm"
                        onClick={() => handleVoice(campo.id)}
                        className="absolute bottom-2 right-2 h-8 w-8 p-0 rounded-full"
                        title={isVoiceActive ? 'Parar gravação' : 'Usar voz'}
                      >
                        {isVoiceActive
                          ? <MicOff className="h-3.5 w-3.5" />
                          : <Mic className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    {isVoiceActive && (
                      <span className="text-[11px] text-destructive animate-pulse flex items-center gap-1">
                        ● Gravando…
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {valor.length} caracteres
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Enviar ao profissional */}
          <div className="pt-2 pb-4 space-y-2 flex flex-col items-center">
            <Button
              onClick={enviar}
              disabled={enviando || camposPreenchidos < 2}
              className="w-full sm:w-auto gap-2"
              size="lg"
            >
              {enviando
                ? <Loader2 className="icon-sm animate-spin" />
                : <Send className="icon-sm" />}
              {enviando ? 'Enviando…' : 'Enviar para meu profissional'}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center max-w-xs">
              {camposPreenchidos < 2
                ? 'Preencha pelo menos 2 campos para enviar.'
                : 'Seu profissional recebe uma notificação e pode revisar antes da consulta.'}
            </p>
          </div>

        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
