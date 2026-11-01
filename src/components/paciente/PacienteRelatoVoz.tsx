import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Mic, Square, Loader2, Send, Sparkles, RotateCcw, CheckCircle2, Clock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { TextoAoVivo } from '@/components/voice/TextoAoVivo';
import { PERFIL_DITADO, TranscritorAoVivo, semInvencao } from '@/lib/transcricaoAoVivo';
import { transcreverAudio } from '@/lib/transcreverAudio';
import { REGIONS, STRUCTURES } from '@/components/presencial/Body3DAvatar';

const PAIN_CATALOG = {
  regions: REGIONS.map((r) => ({ id: r.id, label: `${r.label} (${r.view === 'back' ? 'posterior' : 'anterior'})` })),
  catalog: Object.fromEntries(
    Object.entries(STRUCTURES).map(([rid, cats]) => [rid, { categories: cats as Record<string, string[]> }])
  ),
};

const regionLabel = (id: string) => REGIONS.find((r) => r.id === id)?.label || id;

type Step = 'idle' | 'recording' | 'processing' | 'done';

interface Props {
  pacienteId: string;
}

interface RelatoVozRow {
  id: string;
  created_at: string;
  queixa_principal: string | null;
  classificacao_severidade: string | null;
  resultado: unknown;
}

export default function PacienteRelatoVoz({ pacienteId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('idle');
  const [transcript, setTranscript] = useState('');
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState('audio/webm');
  // A última gravação não virou texto na caixa (transcrição falhou): o áudio dela precisa ser transcrito no envio,
  // mesmo que a caixa já tenha texto, senão o servidor usa só o texto e a fala some sem aviso.
  const [audioSemTexto, setAudioSemTexto] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  // Transcrição ao vivo: o texto aparece enquanto a pessoa fala e, ao parar, vai para a caixa de texto para ela conferir.
  const [aoVivoTexto, setAoVivoTexto] = useState('');
  const [aoVivoIndisponivel, setAoVivoIndisponivel] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const aoVivoRef = useRef<TranscritorAoVivo | null>(null);
  const finalizandoRef = useRef<TranscritorAoVivo | null>(null); // motor esperando o último trecho depois do Parar
  const iniciandoRef = useRef(false); // pedido de permissão do microfone em andamento
  const montadoRef = useRef(true);
  const inicioRef = useRef(0);
  const inteirosRef = useRef(new Set<AbortController>()); // transcrições do áudio inteiro em andamento
  const [resultado, setResultado] = useState<{ queixa: string | null; regioes: string[] } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: historico = [] } = useQuery({
    queryKey: ['relatos-voz-paciente', pacienteId],
    queryFn: async (): Promise<RelatoVozRow[]> => {
      const { data } = await supabase
        .from('avaliacoes_voz')
        .select('id, created_at, queixa_principal, classificacao_severidade, resultado')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false })
        .limit(5);
      return (data || [] as RelatoVozRow[]).filter(
        (d) => (d.resultado as { _meta?: { origem?: string } } | null)?._meta?.origem === 'autocadastro_paciente'
      );
    },
    enabled: !!pacienteId,
  });

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // Depois de parar: o texto do ao vivo (ou, se algum trecho falhou, o do áudio inteiro) entra na caixa de texto.
  // Se nada disso funcionar, o áudio segue para ser transcrito no envio, como sempre foi.
  const finalizarTranscricao = useCallback(async (blob: Blob, aoVivo: TranscritorAoVivo | null, duracaoMs: number) => {
    setFinalizando(true);
    finalizandoRef.current = aoVivo;
    const controle = new AbortController();
    inteirosRef.current.add(controle);
    try {
      let texto = '';
      let parcial = '';
      let ouviuTudo = false;
      let vozMs: number | undefined;
      if (aoVivo) {
        const r = await aoVivo.encerrar(duracaoMs);
        if (!montadoRef.current) return; // saiu da tela: ninguém espera este texto, e o áudio inteiro nem é enviado
        parcial = r.texto;
        vozMs = r.vozMs;
        if (r.completo) { texto = r.texto; ouviuTudo = true; }
      }
      if (!ouviuTudo && blob.size >= 1000) {
        try {
          const inteiro = await transcreverAudio(blob, controle.signal);
          texto = semInvencao(inteiro, vozMs) || parcial; // só invenção do Whisper: vale o que apareceu ao vivo
        } catch { /* sem texto aqui: o texto parcial NÃO entra (valeria no lugar do áudio); o áudio inteiro é transcrito no envio */ }
      }
      if (!montadoRef.current) return;
      if (texto.trim()) {
        setTranscript((atual) => (atual.trim() ? `${atual.trim()}\n${texto.trim()}` : texto.trim()));
        setAudioSemTexto(false);
      } else {
        // Gravação que não foi dada como silêncio e não virou texto: o áudio dela segue para o envio, que o transcreve.
        setAudioSemTexto(!ouviuTudo && blob.size >= 1000);
      }
    } finally {
      inteirosRef.current.delete(controle);
      if (finalizandoRef.current === aoVivo) finalizandoRef.current = null;
      setFinalizando(false);
      setAoVivoTexto('');
      setAoVivoIndisponivel(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (iniciandoRef.current || mediaRecorderRef.current) return;
    iniciandoRef.current = true;
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      if (!montadoRef.current) { // saiu da tela enquanto a permissão estava aberta: não liga nada
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const microfone = stream;
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = []; // por gravação: o onstop de uma gravação não pode pegar os dados da seguinte
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      // O ao vivo é um complemento: sem Web Audio, grava e envia como antes.
      const aoVivo = new TranscritorAoVivo({
        transcrever: transcreverAudio,
        perfil: PERFIL_DITADO,
        aoAtualizar: (estado) => { setAoVivoTexto(estado.texto); setAoVivoIndisponivel(estado.indisponivel); },
      });
      aoVivoRef.current = aoVivo;
      setAoVivoIndisponivel(false);
      aoVivo.anexar(microfone).catch((err) => {
        console.warn('Transcrição ao vivo indisponível (segue com a gravação):', err);
        aoVivo.cancelar();
        if (aoVivoRef.current === aoVivo) aoVivoRef.current = null;
        if (montadoRef.current) setAoVivoIndisponivel(true);
      });
      setAoVivoTexto('');

      recorder.onstop = () => {
        microfone.getTracks().forEach((t) => t.stop());
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        if (mediaRecorderRef.current === recorder) mediaRecorderRef.current = null; // parou sozinho (permissão revogada, ligação): a tela não fica "gravando"
        setStep((atual) => (atual === 'recording' ? 'idle' : atual));
        const blob = new Blob(chunks, { type: recorder.mimeType });
        if (aoVivoRef.current === aoVivo) aoVivoRef.current = null;
        void finalizarTranscricao(blob, aoVivo, Date.now() - inicioRef.current);
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          setAudioBase64(base64);
          setAudioMimeType(recorder.mimeType.split(';')[0]);
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      inicioRef.current = Date.now();
      setRecordingTime(0);
      setStep('recording');
      timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch (err) {
      console.error('Falha ao acessar microfone:', err);
      stream?.getTracks().forEach((t) => t.stop());
      aoVivoRef.current?.cancelar();
      aoVivoRef.current = null;
      mediaRecorderRef.current = null;
      if (montadoRef.current) {
        toast({ title: 'Erro ao acessar microfone', description: 'Permita o acesso ao microfone nas configurações do navegador.', variant: 'destructive' });
      }
    } finally {
      iniciandoRef.current = false;
    }
  }, [toast, finalizarTranscricao]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    // O gravador só é liberado no onstop: um novo toque em "Gravar" antes disso não abre uma segunda gravação por cima.
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    setStep('idle');
  }, []);

  useEffect(() => {
    montadoRef.current = true;
    const inteiros = inteirosRef.current;
    return () => {
      montadoRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      aoVivoRef.current?.cancelar();
      aoVivoRef.current = null;
      finalizandoRef.current?.cancelar();
      finalizandoRef.current = null;
      inteiros.forEach((c) => c.abort());
      const rec = mediaRecorderRef.current;
      if (rec && rec.state !== 'inactive') {
        rec.onstop = null; // saiu da tela: não transcreve nada, só solta o microfone
        rec.stop();
        rec.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const enviarRelato = async () => {
    if (!audioBase64 && transcript.trim().length < 10) {
      toast({ title: 'Conte um pouco mais', description: 'Grave um áudio ou escreva pelo menos algumas palavras sobre o que você está sentindo.', variant: 'destructive' });
      return;
    }

    setStep('processing');
    try {
      // Com texto na caixa o servidor ignora o áudio; se a última gravação não virou texto, ele é somado ao texto.
      const somarAudio = audioSemTexto && !!audioBase64 && transcript.trim().length >= 20;
      const { data: assessData, error: assessError } = await supabase.functions.invoke('voice-assessment', {
        body: {
          serviceType: 'identidade',
          ...(audioBase64 ? { audioBase64, audioMimeType } : {}),
          ...(transcript.trim().length >= 20 ? { transcript: transcript.trim() } : {}),
          ...(somarAudio ? { appendAudio: true } : {}),
        },
      });
      if (assessError) throw new Error(assessError.message);
      if (assessData?.error) throw new Error(assessData.error);

      const generatedTranscript: string = assessData?.transcricao && (transcript.trim().length < 20 || somarAudio)
        ? assessData.transcricao
        : transcript.trim();
      const assessment = assessData?.assessment || {};
      // AI-classified avatar events (surgical history, chronic conditions, neurological findings, etc.)
      const aiAvatarEvents: Array<{ regiao_id: string; sistema: string; tipo_diagnostico: string; tipo_achado: string; severidade: number; estrutura?: string }> =
        Array.isArray(assessData?.avatar_events) ? assessData.avatar_events : [];

      let findings: Array<{ region_id: string; intensity: number; structures: string[] }> = [];
      if (generatedTranscript) {
        const { data: painData } = await supabase.functions.invoke('extract-pain-from-voice', {
          body: { transcript: generatedTranscript, regions: PAIN_CATALOG.regions, catalog: PAIN_CATALOG.catalog },
        });
        findings = painData?.findings || [];
      }

      const { data: saveData, error: saveError } = await supabase.functions.invoke('patient-self-report', {
        body: {
          transcript: generatedTranscript,
          queixa_principal: assessment.queixa_principal || null,
          classificacao_severidade: assessment.classificacao_severidade || null,
          resultado: assessment,
          findings,
          avatar_events: aiAvatarEvents,
        },
      });
      if (saveError) throw new Error(saveError.message);
      if (saveData?.error) throw new Error(saveData.error);

      const allRegioes = [
        ...findings.map((f) => f.region_id),
        ...aiAvatarEvents.map((ev) => ev.regiao_id).filter(rid => !findings.some(f => f.region_id === rid)),
      ];
      setResultado({ queixa: assessment.queixa_principal || null, regioes: allRegioes });
      setStep('done');
      qc.invalidateQueries({ queryKey: ['relatos-voz-paciente', pacienteId] });
      toast({ title: '✅ Relato enviado', description: 'Seu profissional vai revisar e confirmar os achados.' });
    } catch (err: unknown) {
      console.error('[PacienteRelatoVoz] erro ao enviar relato:', err);
      const message = err instanceof Error ? err.message : 'Tente novamente em instantes.';
      toast({ title: 'Erro ao enviar relato', description: message, variant: 'destructive' });
      setStep('idle');
    }
  };

  const resetar = () => {
    setTranscript('');
    setAoVivoTexto('');
    setAudioBase64(null);
    setAudioSemTexto(false);
    setRecordingTime(0);
    setResultado(null);
    setStep('idle');
  };

  if (step === 'done' && resultado) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/10">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Relato enviado!</p>
          </div>
          {resultado.queixa && <p className="text-xs text-muted-foreground">Entendemos que você relatou: <strong>{resultado.queixa}</strong></p>}
          {resultado.regioes.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {resultado.regioes.map((rid) => (
                <Badge key={rid} variant="outline" className="text-[10px] border-emerald-300 text-emerald-700">{regionLabel(rid)}</Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Não identificamos uma região específica do corpo neste relato.</p>
          )}
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            Este relato aparece como pendente no Avatar Clínico até seu profissional revisar e confirmar.
          </p>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={resetar}>
            <RotateCcw className="h-3.5 w-3.5" /> Enviar outro relato
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
            Conte como você está se sentindo. A IA organiza seu relato e ele fica pendente no Avatar Clínico até seu profissional confirmar.
          </p>

          {step === 'recording' ? (
            <div className="flex items-center justify-center gap-3 py-4">
              <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-lg font-mono font-bold">{formatTime(recordingTime)}</span>
              <Button size="sm" variant="destructive" className="gap-1.5" onClick={stopRecording}>
                <Square className="h-3.5 w-3.5" /> Parar
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full gap-2" onClick={startRecording} disabled={step === 'processing' || finalizando}>
              <Mic className="h-4 w-4" /> Gravar áudio
            </Button>
          )}

          <TextoAoVivo ouvindo={step === 'recording'} transcrevendo={finalizando} texto={aoVivoTexto} indisponivel={aoVivoIndisponivel} />

          {audioBase64 && step === 'idle' && !audioSemTexto && (
            <p className="text-[11px] text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Áudio gravado — pronto para enviar.</p>
          )}
          {audioBase64 && step === 'idle' && audioSemTexto && !finalizando && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              Não consegui transcrever o áudio agora. Ele será transcrito quando você enviar. Se gravar de novo, este áudio será substituído.
            </p>
          )}

          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Ou escreva aqui: onde dói, desde quando, como começou..."
            className="text-sm min-h-[90px]"
            disabled={step === 'processing'}
          />

          <Button className="w-full gap-2" onClick={enviarRelato} disabled={step === 'processing' || step === 'recording' || finalizando}>
            {step === 'processing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {step === 'processing' ? 'Enviando relato...' : 'Enviar relato'}
          </Button>
        </CardContent>
      </Card>

      {historico.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
            <Clock className="h-3 w-3" /> Seus relatos recentes
          </p>
          {historico.map((h: RelatoVozRow) => (
            <Card key={h.id}>
              <CardContent className="p-2.5">
                <p className="text-[11px] text-muted-foreground">{new Date(h.created_at).toLocaleDateString('pt-BR')}</p>
                <p className="text-xs font-medium">{h.queixa_principal || 'Relato registrado'}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
