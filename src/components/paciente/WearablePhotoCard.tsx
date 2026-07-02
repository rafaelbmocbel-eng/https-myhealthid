import { useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  pacienteId: string;
  onSaved?: () => void;
}

type ExtractedData = {
  steps: number | null;
  heart_rate_avg: number | null;
  calories: number | null;
  sleep_hours: number | null;
  spo2: number | null;
  confidence: string;
  notas: string;
};

export default function WearablePhotoCard({ pacienteId, onSaved }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<ExtractedData | null>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx 8MB). Reduza a resolução.');
      return;
    }
    setProcessing(true);
    setLastResult(null);

    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const file_base64 = btoa(bin);

      const { data, error } = await supabase.functions.invoke('parse-wearable-photo', {
        body: { paciente_id: pacienteId, file_base64, mime: file.type || 'image/jpeg' },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const d = data?.dados as ExtractedData | undefined;
      if (!d) throw new Error('Resposta inválida da IA');

      const anyValue = d.steps || d.heart_rate_avg || d.calories || d.sleep_hours || d.spo2;
      if (!anyValue) {
        toast.warning('Não consegui identificar métricas nesta imagem. Tente uma foto mais nítida do painel do relógio.');
      } else {
        setLastResult(d);
        toast.success('Métricas extraídas e salvas!');
        onSaved?.();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao processar imagem';
      toast.error(msg);
    } finally {
      setProcessing(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-purple-500/5 via-primary/5 to-transparent">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-foreground">Foto do smartwatch</span>
          <Badge variant="outline" className="text-[9px] ml-auto">IA</Badge>
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Tire uma foto ou envie um print do seu relógio / app (Apple Health, Mi Fit, Google Fit, Fitbit, Garmin...).
          A IA extrai passos, FC, calorias e sono automaticamente.
        </p>

        {lastResult && (
          <div className="rounded-lg bg-background/60 p-2.5 space-y-1.5 border border-primary/10">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              <span className="text-[10px] font-bold text-foreground">Extraído (confiança: {lastResult.confidence})</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              {lastResult.steps != null && <span>👟 {lastResult.steps.toLocaleString()} passos</span>}
              {lastResult.heart_rate_avg != null && <span>❤️ {lastResult.heart_rate_avg} bpm</span>}
              {lastResult.calories != null && <span>🔥 {lastResult.calories} kcal</span>}
              {lastResult.sleep_hours != null && <span>💤 {lastResult.sleep_hours}h sono</span>}
              {lastResult.spo2 != null && <span>🫁 {lastResult.spo2}% SpO₂</span>}
            </div>
            {lastResult.notas && <p className="text-[9px] text-muted-foreground italic">{lastResult.notas}</p>}
          </div>
        )}

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="default"
            size="sm"
            className="text-xs gap-2"
            onClick={() => cameraRef.current?.click()}
            disabled={processing}
          >
            {processing ? <Loader2 className="icon-sm animate-spin" /> : <Camera className="icon-sm" />}
            Tirar foto
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-2"
            onClick={() => galleryRef.current?.click()}
            disabled={processing}
          >
            {processing ? <Loader2 className="icon-sm animate-spin" /> : <Sparkles className="icon-sm" />}
            Enviar print
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
