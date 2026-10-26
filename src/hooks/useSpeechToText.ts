import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface UseSpeechToTextReturn {
  isListening: boolean;
  isTranscribing: boolean;
  startListening: (onResult: (text: string) => void) => void;
  stopListening: () => void;
  isSupported: boolean;
}

// Grava o ditado e transcreve no servidor (Whisper, edge function
// `transcrever-audio`). O reconhecimento de voz do navegador não funciona no
// app (WebView do iOS/Android) nem no Firefox, e erra muito termo clínico.
// O texto chega uma vez, ao parar a gravação.
export function useSpeechToText(): UseSpeechToTextReturn {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const isSupported = typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  const transcrever = useCallback(async (blob: Blob, onResult: (text: string) => void) => {
    if (blob.size < 1000) return;
    setIsTranscribing(true);
    try {
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      const { data, error } = await supabase.functions.invoke('transcrever-audio', {
        body: { audioBase64, audioMimeType: blob.type },
      });
      if (error || !data?.texto) throw error || new Error(data?.error);
      onResult(String(data.texto).trim());
    } catch (err) {
      console.error('Falha ao transcrever ditado:', err);
      toast({ title: 'Não consegui transcrever', description: 'Tente gravar de novo ou digite sua resposta.', variant: 'destructive' });
    } finally {
      setIsTranscribing(false);
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
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        recorderRef.current = null;
        setIsListening(false);
        void transcrever(new Blob(chunks, { type: recorder.mimeType.split(';')[0] }), onResult);
      };

      recorderRef.current = recorder;
      recorder.start(1000);
      setIsListening(true);
    } catch (err) {
      console.error('Falha ao acessar microfone:', err);
      toast({ title: 'Erro ao acessar microfone', description: 'Permita o acesso ao microfone nas configurações do aparelho.', variant: 'destructive' });
    }
  }, [isSupported, transcrever]);

  const stopListening = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  }, []);

  // Ao sair da tela, solta o microfone sem transcrever.
  useEffect(() => () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
    }
  }, []);

  return { isListening, isTranscribing, startListening, stopListening, isSupported };
}
