import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';
import { transcreverAudio } from '@/lib/transcreverAudio';
import { PERFIL_DITADO, TranscritorAoVivo, textoInventado } from '@/lib/transcricaoAoVivo';

interface UseSpeechToTextReturn {
  isListening: boolean;
  isTranscribing: boolean;
  startListening: (onResult: (text: string) => void) => void;
  stopListening: () => void;
  isSupported: boolean;
  /** O que já foi transcrito enquanto ainda grava (aparece trecho a trecho, a cada pausa da fala). */
  liveText: string;
  /** O ao vivo não está rodando (navegador sem Web Audio ou servidor sem responder): o texto completo sai ao parar. */
  liveIndisponivel: boolean;
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
  const [liveIndisponivel, setLiveIndisponivel] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const aoVivoRef = useRef<TranscritorAoVivo | null>(null);
  const finalizandoRef = useRef<TranscritorAoVivo | null>(null); // motor esperando o último trecho depois do Parar
  const iniciandoRef = useRef(false); // pedido de permissão do microfone em andamento
  const montadoRef = useRef(true);
  const inicioRef = useRef(0);

  const isSupported = typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;

  const finalizar = useCallback(async (blob: Blob, aoVivo: TranscritorAoVivo | null, duracaoMs: number, onResult: (text: string) => void) => {
    setIsTranscribing(true);
    finalizandoRef.current = aoVivo;
    let parcial = '';
    try {
      let texto = '';
      let ouviuTudo = false;
      if (aoVivo) {
        const resultado = await aoVivo.encerrar(duracaoMs);
        parcial = resultado.texto.trim();
        if (resultado.completo) { texto = resultado.texto; ouviuTudo = true; }
      }
      if (!ouviuTudo) {
        // Sem ao vivo, ou algum trecho falhou: transcreve o áudio inteiro.
        if (blob.size < 1000) return;
        const inteiro = await transcreverAudio(blob);
        texto = textoInventado(inteiro) ? '' : inteiro;
        if (!texto.trim()) texto = parcial; // o áudio inteiro só trouxe invenção do Whisper: vale o que apareceu ao vivo
      }
      if (!montadoRef.current) return; // saiu da tela: ninguém espera este texto
      if (texto.trim()) onResult(texto.trim());
      else toast({ title: 'Não ouvi nenhuma fala', description: 'Fale mais perto do microfone e tente de novo.' });
    } catch (err) {
      console.error('Falha ao transcrever ditado:', err);
      if (!montadoRef.current) return;
      if (parcial) {
        // O que a pessoa viu aparecer enquanto falava não pode sumir só porque o áudio inteiro também falhou.
        onResult(parcial);
        toast({ title: 'Parte do áudio não foi transcrita', description: 'Confira o texto e complete o que faltar.' });
      } else {
        toast({ title: 'Não consegui transcrever', description: 'Tente gravar de novo ou digite sua resposta.', variant: 'destructive' });
      }
    } finally {
      if (finalizandoRef.current === aoVivo) finalizandoRef.current = null;
      setIsTranscribing(false);
      setLiveText('');
      setLiveIndisponivel(false);
    }
  }, []);

  const startListening = useCallback(async (onResult: (text: string) => void) => {
    if (!isSupported || recorderRef.current || iniciandoRef.current) return;
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
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      const microfone = stream;

      // O ao vivo é um complemento: se o navegador não tiver Web Audio, segue só com a gravação inteira.
      const aoVivo = new TranscritorAoVivo({
        transcrever: transcreverAudio,
        perfil: PERFIL_DITADO,
        aoAtualizar: (estado) => { setLiveText(estado.texto); setLiveIndisponivel(estado.indisponivel); },
      });
      aoVivoRef.current = aoVivo;
      setLiveIndisponivel(false);
      aoVivo.anexar(microfone).catch((err) => {
        console.warn('Transcrição ao vivo indisponível (segue com a gravação inteira):', err);
        aoVivo.cancelar();
        if (aoVivoRef.current === aoVivo) aoVivoRef.current = null;
        if (montadoRef.current) setLiveIndisponivel(true);
      });

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        microfone.getTracks().forEach((t) => t.stop());
        recorderRef.current = null;
        setIsListening(false);
        const usado = aoVivoRef.current;
        aoVivoRef.current = null;
        void finalizar(new Blob(chunks, { type: recorder.mimeType.split(';')[0] }), usado, Date.now() - inicioRef.current, onResult);
      };

      recorderRef.current = recorder;
      setLiveText('');
      recorder.start(1000);
      inicioRef.current = Date.now();
      setIsListening(true);
    } catch (err) {
      console.error('Falha ao acessar microfone:', err);
      stream?.getTracks().forEach((t) => t.stop());
      aoVivoRef.current?.cancelar();
      aoVivoRef.current = null;
      recorderRef.current = null;
      if (montadoRef.current) {
        toast({ title: 'Erro ao acessar microfone', description: 'Permita o acesso ao microfone nas configurações do aparelho.', variant: 'destructive' });
      }
    } finally {
      iniciandoRef.current = false;
    }
  }, [isSupported, finalizar]);

  const stopListening = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  }, []);

  // Ao sair da tela, solta o microfone sem transcrever.
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      aoVivoRef.current?.cancelar();
      aoVivoRef.current = null;
      finalizandoRef.current?.cancelar();
      finalizandoRef.current = null;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        recorder.stop();
        recorder.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return { isListening, isTranscribing, startListening, stopListening, isSupported, liveText, liveIndisponivel };
}
