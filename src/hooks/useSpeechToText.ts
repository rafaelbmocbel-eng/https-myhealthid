import { useState, useRef, useCallback } from 'react';

interface UseSpeechToTextReturn {
  isListening: boolean;
  startListening: (onResult: (text: string) => void) => void;
  stopListening: () => void;
  isSupported: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternative;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function useSpeechToText(): UseSpeechToTextReturn {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = useCallback((onResult: (text: string) => void) => {
    if (!isSupported) return;

    const SpeechRecognitionCtor = (window as unknown as Record<string, new () => SpeechRecognitionLike>).SpeechRecognition || (window as unknown as Record<string, new () => SpeechRecognitionLike>).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = Array.from(event.results)
        .map((result: SpeechRecognitionResultLike) => result[0].transcript)
        .join(' ');
      onResult(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isSupported]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, startListening, stopListening, isSupported };
}
