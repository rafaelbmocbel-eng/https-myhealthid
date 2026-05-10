import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ShieldCheck, Lock, Activity } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import LogoIcon from '@/components/LogoIcon';

interface Resultado {
  id: string;
  paciente_nome: string;
  data_conclusao: string;
  resultado_processado: any;
  myid_score: number | null;
}

export default function MyIDView() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) {
        setError('Link inválido');
        setLoading(false);
        return;
      }
      try {
        const { data: rows, error: rpcErr } = await supabase.rpc('get_myid_concluido_publico', {
          p_token: token,
        });
        if (rpcErr) throw rpcErr;
        const row = Array.isArray(rows) ? rows[0] : rows;
        if (!row) {
          setError('MyID não encontrado ou ainda não concluído.');
        } else {
          setData(row as Resultado);
        }
      } catch (e: any) {
        setError(e?.message || 'Erro ao carregar MyID.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-6 text-center">
        <Lock className="h-10 w-10 text-muted-foreground mb-3" />
        <h1 className="text-base font-semibold mb-1">MyID indisponível</h1>
        <p className="text-sm text-muted-foreground max-w-sm">{error || 'Link expirado ou inválido.'}</p>
      </div>
    );
  }

  const r = data.resultado_processado || {};
  const scores = r.componentScores || r.scores || {};
  const score = data.myid_score ?? r.myidScore ?? 0;
  const classificacao = r.classificacao || r.classification || '—';
  const narrativa = r.narrativa || r.narrative || r.resumo || null;
  const redFlags = r.red_flags_detected || r.redFlags;

  const dimMap: Array<{ key: string; label: string }> = [
    { key: 'D', label: 'Dor' },
    { key: 'EFI', label: 'Funcionalidade' },
    { key: 'P', label: 'Psicológico' },
    { key: 'I', label: 'Inércia' },
    { key: 'R', label: 'Regulação' },
    { key: 'C', label: 'Contexto' },
    { key: 'N', label: 'Ruído sistêmico' },
  ];

  return (
    <div className="min-h-[100dvh] bg-background pb-12">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogoIcon className="h-6 w-6" />
            <span className="text-sm font-bold">MY HEALTH ID</span>
          </div>
          <Badge variant="outline" className="gap-1 text-[10px]">
            <ShieldCheck className="h-3 w-3" /> Visualização read-only
          </Badge>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Patient + score */}
        <Card className="rounded-xl border-border/40 shadow-xs">
          <CardContent className="p-5">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Identidade de Saúde</p>
            <h1 className="text-xl font-bold mb-1">{data.paciente_nome}</h1>
            <p className="text-xs text-muted-foreground">
              MyID concluído em {format(parseISO(data.data_conclusao), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>

            <div className="mt-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">MyID Score</p>
                <p className="text-5xl font-black tracking-tight leading-none">{Number(score).toFixed(1)}</p>
                <p className="text-xs text-muted-foreground mt-1">de 100</p>
              </div>
              <Badge className="text-xs px-3 py-1">{classificacao}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Red flags */}
        {redFlags && (
          <Card className="rounded-xl border-destructive/40 bg-destructive/5">
            <CardContent className="p-4 flex gap-2 items-start">
              <Activity className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-destructive">Sinais de alerta detectados</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Encaminhamento para avaliação médica recomendado. Consulte detalhes com seu profissional.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dimensions */}
        <Card className="rounded-xl border-border/40 shadow-xs">
          <CardContent className="p-5">
            <h2 className="text-sm font-bold mb-3">Dimensões avaliadas</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {dimMap.map((d) => {
                const v = Number(scores[d.key] ?? 0);
                const pct = Math.min(100, Math.max(0, (v / 10) * 100));
                const tone =
                  v <= 3 ? 'bg-emerald-500' : v <= 6 ? 'bg-amber-500' : v <= 8 ? 'bg-orange-500' : 'bg-destructive';
                return (
                  <div key={d.key} className="rounded-lg border border-border/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {d.label}
                      </span>
                      <span className="text-sm font-bold">{v.toFixed(1)}</span>
                    </div>
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Narrative */}
        {narrativa && (
          <Card className="rounded-xl border-border/40 shadow-xs">
            <CardContent className="p-5">
              <h2 className="text-sm font-bold mb-2">Resumo clínico</h2>
              <p className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">
                {typeof narrativa === 'string' ? narrativa : JSON.stringify(narrativa, null, 2)}
              </p>
            </CardContent>
          </Card>
        )}

        <p className="text-[10px] text-center text-muted-foreground pt-2">
          Esta é uma visualização compartilhada da identidade de saúde. Dados confidenciais.
        </p>
      </main>
    </div>
  );
}
