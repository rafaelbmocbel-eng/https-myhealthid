import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { transcreverAudio } from '@/lib/transcreverAudio';
import { PERFIL_DITADO, TranscritorAoVivo } from '@/lib/transcricaoAoVivo';

interface UseSpeechToTextReturn {
  isListening: boolean;
  isTranscribing: boolean;
  startListening: (onResult: (text: string) => void) => void;
  stopListening: () => void;
  isSupported: boolean;
  /** O que já foi transcrito enquanto ainda grava (aparece trecho a trecho, a cada pausa da fala). */
  liveText: string;
}

// Grava o ditado e transcreve no servidor (Whisper, edge function `transcrever-audio`). O reconhecimento de voz do
// navegador não funciona no app (WebView do iOS/Android) nem no Firefox, e erra muito termo clínico.
//
// AO VIVO: enquanto grava, o áudio é cortado nas pausas e cada trecho é transcrito na hora (`liveText`). Ao parar, só
// falta o último trecho. Se algum trecho falhar, a transcrição do áudio inteiro (como antes) cobre: nada se perde.
export function useSpeechToText(): UseSpeechToTextReturn {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [liveText, setLiveText] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const aoVivoRef = useRef<TranscritorAoVivo | null>(null);

  const isSupported = typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  const finalizar = useCallback(async (blob: Blob, aoVivo: TranscritorAoVivo | null, onResult: (text: string) => void) => {
    setIsTranscribing(true);
    try {
      let texto = '';
      let ouviuTudo = false;
      if (aoVivo) {
        const resultado = await aoVivo.encerrar();
        if (resultado.completo) { texto = resultado.texto; ouviuTudo = true; }
      }
      if (!ouviuTudo) {
        // Sem ao vivo, ou algum trecho falhou: transcreve o áudio inteiro.
        if (blob.size < 1000) return;
        texto = await transcreverAudio(blob);
      }
      if (texto.trim()) onResult(texto.trim());
      else toast({ title: 'Não ouvi nenhuma fala', description: 'Fale mais perto do microfone e tente de novo.' });
    } catch (err) {
      console.error('Falha ao transcrever ditado:', err);
      toast({ title: 'Não consegui transcrever', description: 'Tente gravar de novo ou digite sua resposta.', variant: 'destructive' });
    } finally {
      setIsTranscribing(false);
      setLiveText('');
    }
  }, []);

  const startListening = useCallback(async (onResult: (text: string) => void) => {
    if (!isSupported || recorderRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];

      // O ao vivo é um complemento: se o navegador não tiver Web Audio, segue só com a gravação inteira.
      const aoVivo = new TranscritorAoVivo({
        transcrever: transcreverAudio,
        perfil: PERFIL_DITADO,
        aoAtualizar: (estado) => setLiveText(estado.texto),
      });
      aoVivoRef.current = aoVivo;
      aoVivo.anexar(stream).catch((err) => {
        console.warn('Transcrição ao vivo indisponível (segue com a gravação inteira):', err);
        aoVivo.cancelar();
        if (aoVivoRef.current === aoVivo) aoVivoRef.current = null;
      });

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        recorderRef.current = null;
        setIsListening(false);
        const usado = aoVivoRef.current;
        aoVivoRef.current = null;
        void finalizar(new Blob(chunks, { type: recorder.mimeType.split(';')[0] }), usado, onResult);
      };

      recorderRef.current = recorder;
      setLiveText('');
      recorder.start(1000);
      setIsListening(true);
    } catch (err) {
      console.error('Falha ao acessar microfone:', err);
      toast({ title: 'Erro ao acessar microfone', description: 'Permita o acesso ao microfone nas configurações do aparelho.', variant: 'destructive' });
    }
  }, [isSupported, finalizar]);

  const stopListening = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  }, []);

  // Ao sair da tela, solta o microfone sem transcrever.
  useEffect(() => () => {
    aoVivoRef.current?.cancelar();
    aoVivoRef.current = null;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
    }
  }, []);

  return { isListening, isTranscribing, startListening, stopListening, isSupported, liveText };
}
