import { useEffect, useState } from 'react';
import { useTrackingConfig } from '@/hooks/useTrackingConfig';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Crosshair, Loader2, Facebook, BarChart3, ExternalLink, Save } from 'lucide-react';

export default function CrmTrafegoPixels() {
  const { config, isLoading, salvar } = useTrackingConfig();
  const [metaPixel, setMetaPixel] = useState('');
  const [ga4, setGa4] = useState('');
  const [ativos, setAtivos] = useState(true);

  useEffect(() => {
    if (config) {
      setMetaPixel(config.meta_pixel_id || '');
      setGa4(config.ga4_id || '');
      setAtivos(config.ativos);
    }
  }, [config]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const handleSalvar = () => {
    salvar.mutate({
      meta_pixel_id: metaPixel.trim() || null,
      ga4_id: ga4.trim() || null,
      ativos,
    });
  };

  const algumConfigurado = !!(metaPixel.trim() || ga4.trim());

  return (
    <div className="p-3 sm:p-5 space-y-4 max-w-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="h-card flex items-center gap-2">
            <Crosshair className="icon-md text-primary" />
            Pixels de conversão
          </h2>
          <p className="text-caption mt-1">
            Meça anúncios e tráfego nos seus links públicos (Funil, Eventos, MyID).
          </p>
        </div>
        {algumConfigurado && (
          <div className="flex items-center gap-2 shrink-0">
            <Label htmlFor="ativos" className="text-xs text-muted-foreground">
              Ativos
            </Label>
            <Switch id="ativos" checked={ativos} onCheckedChange={setAtivos} />
          </div>
        )}
      </div>

      {/* Meta Pixel */}
      <Card className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#1877F2]/10 flex items-center justify-center">
              <Facebook className="icon-sm text-[#1877F2]" />
            </div>
            <div>
              <div className="text-sm font-semibold">Meta Pixel</div>
              <div className="text-micro text-muted-foreground">Facebook & Instagram Ads</div>
            </div>
          </div>
          {config?.meta_pixel_id && <Badge variant="secondary" className="text-[10px]">Configurado</Badge>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="meta-pixel" className="text-xs">ID do Pixel</Label>
          <Input
            id="meta-pixel"
            placeholder="Ex: 1234567890123456"
            value={metaPixel}
            onChange={(e) => setMetaPixel(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            className="font-mono text-sm"
          />
          <a
            href="https://business.facebook.com/events_manager2"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Encontre seu Pixel ID no Events Manager <ExternalLink className="icon-xs" />
          </a>
        </div>
      </Card>

      {/* GA4 */}
      <Card className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#F9AB00]/10 flex items-center justify-center">
              <BarChart3 className="icon-sm text-[#F9AB00]" />
            </div>
            <div>
              <div className="text-sm font-semibold">Google Analytics 4</div>
              <div className="text-micro text-muted-foreground">GA4 Measurement ID</div>
            </div>
          </div>
          {config?.ga4_id && <Badge variant="secondary" className="text-[10px]">Configurado</Badge>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ga4" className="text-xs">Measurement ID</Label>
          <Input
            id="ga4"
            placeholder="Ex: G-XXXXXXXXXX"
            value={ga4}
            onChange={(e) => setGa4(e.target.value.toUpperCase())}
            className="font-mono text-sm"
          />
          <a
            href="https://analytics.google.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            Encontre seu Measurement ID em Admin → Streams <ExternalLink className="icon-xs" />
          </a>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3 pt-2">
        <p className="text-micro text-muted-foreground max-w-md">
          Os scripts são carregados automaticamente nos links públicos e disparam <code>PageView</code>,{' '}
          <code>Lead</code> e <code>Schedule</code> nos pontos certos.
        </p>
        <Button onClick={handleSalvar} disabled={salvar.isPending} className="gap-1.5">
          {salvar.isPending ? <Loader2 className="icon-sm animate-spin" /> : <Save className="icon-sm" />}
          Salvar
        </Button>
      </div>
    </div>
  );
}
