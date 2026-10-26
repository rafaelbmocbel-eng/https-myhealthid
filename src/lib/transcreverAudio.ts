import { supabase } from '@/integrations/supabase/client';

export function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Manda um áudio curto para a edge function `transcrever-audio` (Whisper) e devolve o texto. Lança erro se falhar. */
export async function transcreverAudio(blob: Blob): Promise<string> {
  const audioBase64 = await blobParaBase64(blob);
  const { data, error } = await supabase.functions.invoke('transcrever-audio', {
    body: { audioBase64, audioMimeType: blob.type },
  });
  if (error || typeof data?.texto !== 'string') throw error || new Error(data?.error || 'Sem texto');
  return data.texto.trim();
}
