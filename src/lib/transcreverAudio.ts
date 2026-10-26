import { supabase } from '@/integrations/supabase/client';
import { blobParaBase64 } from '@/lib/audioParaWav';
import { textoInventado } from '@/lib/transcricaoAoVivo';

/** Manda um áudio curto para a edge function `transcrever-audio` (Whisper) e devolve o texto. Lança erro se falhar. */
export async function transcreverAudio(blob: Blob, sinal?: AbortSignal): Promise<string> {
  const audioBase64 = await blobParaBase64(blob);
  const { data, error } = await supabase.functions.invoke('transcrever-audio', {
    body: { audioBase64, audioMimeType: blob.type },
    signal: sinal,
  });
  if (error || typeof data?.texto !== 'string') throw error || new Error(data?.error || 'Sem texto');
  const texto = data.texto.trim();
  return textoInventado(texto) ? '' : texto; // o Whisper devolve legendas inventadas para áudio sem fala
}
