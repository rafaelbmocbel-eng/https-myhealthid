import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ShieldCheck, AlertTriangle, Loader2, CheckCircle2, ChevronDown } from 'lucide-react';

// Revisor de segurança do plano (IA). Botão discreto que, sob demanda, manda o
// plano + contexto clínico do paciente para a edge function revisar-plano-seguranca
// e mostra os pontos de atenção (contraindicações, incoerências, red flags).
// Advisório: não bloqueia a liberação — só informa o profissional.

interface Flag {
  severidade?: 'alta' | 'media' | 'baixa';
  titulo?: string;
  descricao?: string;
  sugestao?: string;
  onde?: string;
}
interface Resultado {
  resumo?: string;
  risco_geral?: 'alto' | 'medio' | 'baixo';
  flags?: Flag[];
}

const SEV = {
  alta: { cor: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-900/20', borda: 'border-red-200 dark:border-red-800', rotulo: 'Alta' },
  media: { cor: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-900/20', borda: 'border-amber-200 dark:border-amber-800', rotulo: 'Média' },
  baixa: { cor: 'text-slate-600 dark:text-slate-300', bg: 'bg-muted/40', borda: 'border-border', rotulo: 'Baixa' },
} as const;

export default function RevisorSeguranca({
  pacienteId, tipo, plano,
}: { pacienteId: string; tipo: 'treino' | 'nutricao' | 'clinica'; plano: any }) {
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(true);

  const revisar = async () => {
    setLoading(true); setErro(null); setRes(null);
    try {
      const { data, error } = await supabase.functions.invoke('revisar-plano-seguranca', {
        body: { paciente_id: pacienteId, tipo, plano },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setRes(data as Resultado);
      setAberto(true);
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível revisar agora.');
    } finally {
      setLoading(false);
    }
  };

  const flags = res?.flags || [];
  const risco = res?.risco_geral || (flags.some(f => f.severidade === 'alta') ? 'alto' : flags.length ? 'medio' : 'baixo');

  return (
    <div className="mt-2">
      {!res && (
        <Button size="sm" variant="outline" className="h-8 text-[11px] gap-1.5" onClick={revisar} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
          {loading ? 'Revisando segurança…' : 'Revisar segurança (IA)'}
        </Button>
      )}
      {erro && <p className="text-[11px] text-red-600 mt-1">{erro}</p>}

      {res && (
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <button
            onClick={() => setAberto(a => !a)}
            className="w-full flex items-center gap-2 px-3 py-2 text-left bg-muted/30 hover:bg-muted/50"
          >
            {flags.length === 0
              ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              : <AlertTriangle className={`h-4 w-4 shrink-0 ${risco === 'alto' ? 'text-red-600' : 'text-amber-600'}`} />}
            <span className="text-xs font-semibold flex-1 min-w-0">
              {flags.length === 0 ? 'Revisão de segurança: sem pontos críticos' : `Revisão de segurança: ${flags.length} ponto${flags.length > 1 ? 's' : ''} de atenção`}
            </span>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${risco === 'alto' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : risco === 'medio' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
              risco {risco}
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${aberto ? 'rotate-180' : ''}`} />
          </button>

          {aberto && (
            <div className="p-3 space-y-2">
              {res.resumo && <p className="text-xs text-muted-foreground">{res.resumo}</p>}
              {flags.map((f, i) => {
                const s = SEV[f.severidade || 'baixa'];
                return (
                  <div key={i} className={`rounded-md border ${s.borda} ${s.bg} p-2.5`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[10px] font-bold uppercase ${s.cor}`}>{s.rotulo}</span>
                      <span className="text-xs font-semibold">{f.titulo}</span>
                      {f.onde && <span className="text-[10px] text-muted-foreground ml-auto">{f.onde}</span>}
                    </div>
                    {f.descricao && <p className="text-xs text-foreground/85">{f.descricao}</p>}
                    {f.sugestao && <p className="text-[11px] text-muted-foreground mt-1"><span className="font-semibold">Sugestão:</span> {f.sugestao}</p>}
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-muted-foreground italic">Revisão por IA — apoio à decisão, não substitui seu julgamento clínico.</p>
                <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={revisar} disabled={loading}>
                  {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Revisar de novo'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
