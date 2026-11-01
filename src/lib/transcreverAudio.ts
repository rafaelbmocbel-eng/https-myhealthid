import { supabase } from '@/integrations/supabase/client';
import { blobParaBase64 } from '@/lib/audioParaWav';

/** Manda um áudio para a edge function `transcrever-audio` (Whisper) e devolve o texto. Lança erro se falhar ou passar de 2 min. */
export async function transcreverAudio(blob: Blob, sinal?: AbortSignal): Promise<string> {
  const audioBase64 = await blobParaBase64(blob);
  // Com `timeout`, o invoke só repassa o aborto de um sinal que ainda vai abortar: um sinal já abortado seguiria até o fim.
  if (sinal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const { data, error } = await supabase.functions.invoke('transcrever-audio', {
    body: { audioBase64, audioMimeType: blob.type },
    signal: sinal,
    timeout: 120_000,
  });
  if (error || typeof data?.texto !== 'string') throw error || new Error(data?.error || 'Sem texto');
  return data.texto.trim();
}
