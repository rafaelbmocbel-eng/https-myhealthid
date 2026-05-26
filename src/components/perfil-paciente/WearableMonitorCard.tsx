import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Watch, AlertTriangle, TrendingDown, Heart, Moon, WifiOff, CheckCircle2, Footprints } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  pacienteId: string;
  pacienteNome: string;
}

interface Metricas {
  passos_media_7d: number | null;
  passos_media_semana_anterior: number | null;
  fc_repouso_media_7d: number | null;
  ultimo_dia_com_dados: string | null;
  dias_com_dados: number;
}

interface Alerta {
  id: string;
  tipo: string;
  severidade: string;
  titulo: string;
  descricao: string | null;
  lido: boolean;
  detectado_em: string;
}

const TIPO_ICON: Record<string, typeof AlertTriangle> = {
  queda_passos: TrendingDown,
  fc_elevada: Heart,
  sono_baixo: Moon,
  sem_sync: WifiOff,
};

const SEV_COLOR: Record<string, string> = {
  alto: 'border-red-200 bg-red-50 text-red-700',
  medio: 'border-amber-200 bg-amber-50 text-amber-700',
  baixo: 'border-blue-200 bg-blue-50 text-blue-700',
};

export default function WearableMonitorCard({ pacienteId, pacienteNome }: Props) {
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    const [mRes, aRes] = await Promise.all([
      supabase.from('wearable_metricas_semanais').select('*').eq('paciente_id', pacienteId).maybeSingle(),
      supabase.from('wearable_alertas').select('*').eq('paciente_id', pacienteId).order('detectado_em', { ascending: false }).limit(10),
    ]);
    setMetricas(mRes.data as Metricas | null);
    setAlertas((aRes.data ?? []) as Alerta[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [pacienteId]);

  const marcarLido = async (id: string) => {
    await supabase.from('wearable_alertas').update({ lido: true }).eq('id', id);
    fetchAll();
  };

  const variacao = metricas?.passos_media_7d && metricas?.passos_media_semana_anterior
    ? Math.round(((metricas.passos_media_7d - metricas.passos_media_semana_anterior) / metricas.passos_media_semana_anterior) * 100)
    : null;

  return (
    <Card className="rounded-xl border-border/40 shadow-xs">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Watch className="icon-md text-primary" />
            <h3 className="h-card">Monitor Wearable</h3>
          </div>
          {metricas?.ultimo_dia_com_dados ? (
            <Badge variant="outline" className="text-[10px] gap-1 text-emerald-700 border-emerald-200 bg-emerald-50">
              <CheckCircle2 className="icon-xs" /> Ativo
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">Sem dados</Badge>
          )}
        </div>

        {loading ? (
          <p className="text-caption">Carregando…</p>
        ) : !metricas ? (
          <p className="text-caption">{pacienteNome} ainda não sincronizou nenhum wearable.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border/40 p-3 text-center">
                <Footprints className="icon-sm mx-auto text-blue-500 mb-1" />
                <p className="text-sm font-bold text-foreground">{metricas.passos_media_7d?.toLocaleString() ?? '—'}</p>
                <p className="text-micro text-muted-foreground">passos/dia (7d)</p>
                {variacao !== null && (
                  <p className={`text-micro mt-0.5 ${variacao < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {variacao > 0 ? '+' : ''}{variacao}% vs semana anterior
                  </p>
                )}
              </div>
              <div className="rounded-lg border border-border/40 p-3 text-center">
                <Heart className="icon-sm mx-auto text-red-500 mb-1" />
                <p className="text-sm font-bold text-foreground">{metricas.fc_repouso_media_7d ?? '—'}</p>
                <p className="text-micro text-muted-foreground">bpm repouso</p>
              </div>
              <div className="rounded-lg border border-border/40 p-3 text-center">
                <Watch className="icon-sm mx-auto text-purple-500 mb-1" />
                <p className="text-sm font-bold text-foreground">{metricas.dias_com_dados}/7</p>
                <p className="text-micro text-muted-foreground">dias com dados</p>
              </div>
            </div>

            {metricas.ultimo_dia_com_dados && (
              <p className="text-micro text-muted-foreground text-center">
                Última sincronização: {formatDistanceToNow(new Date(metricas.ultimo_dia_com_dados), { addSuffix: true, locale: ptBR })}
              </p>
            )}
          </>
        )}

        {alertas.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/40">
            <p className="text-caption font-semibold text-foreground">Alertas recentes</p>
            {alertas.map(a => {
              const Icon = TIPO_ICON[a.tipo] ?? AlertTriangle;
              return (
                <div key={a.id} className={`rounded-lg border p-3 ${a.lido ? 'opacity-50 border-border/40' : SEV_COLOR[a.severidade] ?? ''}`}>
                  <div className="flex items-start gap-2">
                    <Icon className="icon-sm shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{a.titulo}</p>
                      {a.descricao && <p className="text-micro mt-0.5 opacity-80">{a.descricao}</p>}
                      <p className="text-micro mt-1 opacity-60">
                        {formatDistanceToNow(new Date(a.detectado_em), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    {!a.lido && (
                      <Button size="sm" variant="ghost" className="text-[10px] h-7 px-2" onClick={() => marcarLido(a.id)}>
                        Marcar lido
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
