import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2, FileCheck } from 'lucide-react';

interface UploadComprovanteProps {
  pagamentoId: string;
  userId: string;
  onUploaded?: () => void;
}

export default function UploadComprovante({ pagamentoId, userId, onUploaded }: UploadComprovanteProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({ title: 'Arquivo muito grande', description: 'Máximo 5MB.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${userId}/${pagamentoId}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('comprovantes')
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from('comprovantes')
        .getPublicUrl(path);

      const { error: updateErr } = await supabase
        .from('pagamentos_paciente')
        .update({ comprovante_url: urlData.publicUrl })
        .eq('id', pagamentoId);
      if (updateErr) throw updateErr;

      setDone(true);
      toast({ title: 'Comprovante enviado! 📎' });
      onUploaded?.();
    } catch (err: any) {
      toast({ title: 'Erro ao enviar', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-600">
        <FileCheck className="h-4 w-4" /> Comprovante enviado
      </div>
    );
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleUpload} />
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="gap-1 text-xs"
      >
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
        Enviar comprovante
      </Button>
    </>
  );
}
