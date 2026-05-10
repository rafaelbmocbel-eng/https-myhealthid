import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useHealthSync, HealthSyncResult } from '@/hooks/useHealthSync';
import { Watch, Heart, Footprints, Flame, RefreshCw, Loader2, Smartphone } from 'lucide-react';

interface HealthSyncCardProps {
  onSyncComplete?: (data: HealthSyncResult) => void;
}

export default function HealthSyncCard({ onSyncComplete }: HealthSyncCardProps) {
  const {
    isNative,
    isAvailable,
    hasPermission,
    syncing,
    lastSync,
    error,
    requestPermission,
    syncHealthData,
  } = useHealthSync();

  // Don't render on web
  if (!isNative) {
    return (
      <Card className="border-dashed border-muted-foreground/20 bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Smartphone className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold text-muted-foreground">Smartwatch</p>
              <p className="text-[10px] text-muted-foreground/60">
                Baixe o app nativo para sincronizar dados do seu smartwatch automaticamente
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isAvailable) {
    return (
      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Watch className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xs font-bold text-foreground">Health Connect indisponível</p>
              <p className="text-[10px] text-muted-foreground">
                Instale o Google Health Connect ou ative o HealthKit no seu dispositivo
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSync = async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return;
    }
    const data = await syncHealthData();
    if (data && onSyncComplete) {
      onSyncComplete(data);
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Watch className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold text-foreground">Smartwatch</span>
          </div>
          {lastSync && (
            <Badge variant="outline" className="text-[9px] text-green-600 border-green-200 bg-green-50">
              Sincronizado
            </Badge>
          )}
        </div>

        {lastSync && (
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded-lg bg-background">
              <Footprints className="icon-sm mx-auto text-blue-500 mb-0.5" />
              <span className="text-sm font-black text-foreground block">
                {lastSync.steps.toLocaleString()}
              </span>
              <span className="text-[8px] text-muted-foreground">passos</span>
            </div>
            <div className="text-center p-2 rounded-lg bg-background">
              <Heart className="icon-sm mx-auto text-red-500 mb-0.5" />
              <span className="text-sm font-black text-foreground block">
                {lastSync.heartRate ? `${Math.round(lastSync.heartRate)}` : '—'}
              </span>
              <span className="text-[8px] text-muted-foreground">bpm</span>
            </div>
            <div className="text-center p-2 rounded-lg bg-background">
              <Flame className="icon-sm mx-auto text-orange-500 mb-0.5" />
              <span className="text-sm font-black text-foreground block">
                {lastSync.calories ? Math.round(lastSync.calories) : '—'}
              </span>
              <span className="text-[8px] text-muted-foreground">kcal</span>
            </div>
          </div>
        )}

        {error && (
          <p className="text-[10px] text-red-500">{error}</p>
        )}

        <Button
          variant={lastSync ? 'outline' : 'default'}
          size="sm"
          className="w-full text-xs gap-2"
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? (
            <Loader2 className="icon-sm animate-spin" />
          ) : (
            <RefreshCw className="icon-sm" />
          )}
          {!hasPermission ? 'Conectar Smartwatch' : lastSync ? 'Atualizar dados' : 'Sincronizar agora'}
        </Button>
      </CardContent>
    </Card>
  );
}
