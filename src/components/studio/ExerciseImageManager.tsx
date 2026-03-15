import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ImagePlus, Trash2, Loader2, Sparkles, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  exercicioId: string;
  exercicioNome: string;
  grupoMuscular?: string;
}

export default function ExerciseImageManager({ exercicioId, exercicioNome, grupoMuscular }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasImage, setHasImage] = useState<boolean | null>(null);

  const storageUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/exercise-images/exercises/${exercicioId}.png`;

  // Check if image exists on mount
  if (hasImage === null) {
    const img = new Image();
    img.onload = () => { setHasImage(true); setImageUrl(storageUrl); };
    img.onerror = () => setHasImage(false);
    img.src = storageUrl;
  }

  const handleGenerateAI = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-exercise-image', {
        body: { exerciseName: exercicioNome, muscleGroup: grupoMuscular || 'Geral', exerciseId: exercicioId },
      });
      if (error) throw error;
      setImageUrl(data.url + '?t=' + Date.now());
      setHasImage(true);
      toast({ title: 'Ilustração gerada!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao gerar imagem', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Apenas imagens', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.storage
        .from('exercise-images')
        .upload(`exercises/${exercicioId}.png`, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      setImageUrl(storageUrl + '?t=' + Date.now());
      setHasImage(true);
      toast({ title: 'Imagem enviada!' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao enviar imagem', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.storage
        .from('exercise-images')
        .remove([`exercises/${exercicioId}.png`]);
      if (error) throw error;
      setImageUrl(null);
      setHasImage(false);
      toast({ title: 'Imagem removida' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao remover', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Preview */}
      <div className="h-12 w-12 rounded-lg bg-muted/50 border border-border overflow-hidden flex items-center justify-center shrink-0">
        {hasImage && imageUrl ? (
          <img src={imageUrl} alt={exercicioNome} className="h-full w-full object-cover" />
        ) : (
          <ImagePlus className="h-4 w-4 text-muted-foreground/40" />
        )}
      </div>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Gerar com IA" onClick={handleGenerateAI}>
            <Sparkles className="h-3 w-3 text-primary" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Upload" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3 w-3 text-muted-foreground" />
          </Button>
          {hasImage && (
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Remover" onClick={handleRemove}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          )}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
    </div>
  );
}
