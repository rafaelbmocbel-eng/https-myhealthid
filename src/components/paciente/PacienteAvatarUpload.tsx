import { useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props {
  /** id usado como pasta no bucket: user.id (paciente) ou paciente.id (profissional) */
  folderId: string;
  /** id do registro em public.pacientes a atualizar */
  pacienteId: string;
  avatarUrl?: string | null;
  nome?: string;
  sobrenome?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  editable?: boolean;
  /** Mostra o botão lateral com texto "Adicionar foto / Trocar foto". Default true. */
  showLabel?: boolean;
  onUpdated?: (url: string | null) => void;
}

const sizeMap = {
  sm: 'h-12 w-12 text-sm',
  md: 'h-16 w-16 text-base',
  lg: 'h-20 w-20 text-lg',
  xl: 'h-28 w-28 text-2xl',
};

export default function PacienteAvatarUpload({
  folderId, pacienteId, avatarUrl, nome = '', sobrenome = '',
  size = 'lg', editable = true, onUpdated,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState<string | null>(avatarUrl ?? null);
  const { toast } = useToast();

  const initials = `${nome[0] ?? ''}${sobrenome[0] ?? ''}`.toUpperCase() || '?';

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Arquivo inválido', description: 'Envie uma imagem.', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Imagem grande', description: 'Máximo 5MB.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${folderId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('paciente-avatars')
        .upload(path, file, { upsert: true, cacheControl: '3600' });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('paciente-avatars').getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

      const { error: dbErr } = await supabase
        .from('pacientes')
        .update({ avatar_url: publicUrl })
        .eq('id', pacienteId);
      if (dbErr) throw dbErr;

      setUrl(publicUrl);
      onUpdated?.(publicUrl);
      toast({ title: 'Foto atualizada' });
    } catch (e: any) {
      toast({ title: 'Erro ao enviar', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('pacientes')
        .update({ avatar_url: null })
        .eq('id', pacienteId);
      if (error) throw error;
      setUrl(null);
      onUpdated?.(null);
      toast({ title: 'Foto removida' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0">
        <Avatar className={cn(sizeMap[size], 'ring-2 ring-primary/15')}>
          {url && <AvatarImage src={url} alt={`${nome} ${sobrenome}`} />}
          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        {editable && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center hover:bg-primary/90 active:scale-95 transition"
            aria-label="Alterar foto"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {editable && (
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={loading}>
            <Camera className="h-3.5 w-3.5 mr-1.5" />
            {url ? 'Trocar foto' : 'Adicionar foto'}
          </Button>
          {url && (
            <Button size="sm" variant="ghost" onClick={handleRemove} disabled={loading} className="text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Remover
            </Button>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
