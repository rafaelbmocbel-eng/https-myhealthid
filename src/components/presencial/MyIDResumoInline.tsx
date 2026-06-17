import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Fingerprint, ChevronRight, AlertTriangle, ArrowDown, ArrowUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Props {
  pacienteId: string;
}

const DIMS: Array<{ key: string; label: string; full: string }> = [
  { key: 'score_d',   label: 'D',   full: 'Dor' },
  { key: 'score_efi', label: 'EFI', full: 'Funcional' },
  { key: 'score_p',   label: 'P',   full: 'Psicológico' },
  { key: 'score_i',   label: 'I',   full: 'Demanda' },
  { key: 'score_r',   label: 'R',   full: 'Regulação' },
  { key: 'score_c',   label: 'C',   full: 'Contexto' },
  { key: 'score_n',   label: 'N',   full: 'Ruído' },
];

// Cores semânticas — quanto maior a perda, mais crítico.
function severityClass(v: number) {
  if (v >= 7) return 'bg-rose-100 text-rose-700 border-rose-200';
  if (v >= 5) return 'bg-amber-100 text-amber-700 border-amber-200';
  if (v >= 3) return 'bg-yellow-50 text-yellow-700 border-yellow-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

export default function MyIDResumoInline({ pacienteId }: Props) {
  const navigate = useNavigate();

  // Busca as 2 últimas avaliações com score para poder mostrar a evolução (antes/depois)
  // direto na tela de atendimento, sem precisar abrir o dashboard de evolução em outra aba.
  const { data: historico, isLoading } = useQuery({
    queryKey: ['avaliacao-presencial-myid-hist', pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_identidade')
        .select('*')
        .eq('paciente_id', pacienteId)
        .not('myid_score', 'is', null)
        .order('created_at', { ascending: false })
        .limit(2);
      return data || [];
    },
  });

  if (isLoading) return null;

  const ultima = historico?.[0];
  const anterior = historico?.[1];

  // Sem MyID ainda — CTA para gerar/pedir
  if (!ultima) {
    return (
      <Card className="border-dashed border-primary/30 bg-primary/5">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Fingerprint className="icon-sm text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Sem MyID respondido</p>
            <p className="text-micro text-muted-foreground">
              Peça ao paciente para responder o MyID — os scores aparecem aqui automaticamente.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1 shrink-0"
            onClick={() => navigate(`/pacientes/${pacienteId}?tab=identidade&sub=myid`)}
          >
            Gerar link <ChevronRight className="icon-xs" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  const score = Number(ultima.myid_score ?? 0);
  const classificacao = (ultima as any).classificacao || '—';
  const dados: any = ultima.dados_avaliacao || {};
  const driver = dados?.primary_driver?.dimension || dados?.primaryDriver;
  const redFlags = !!dados?.red_flags_detected;
  const when = ultima.created_at
    ? format(parseISO(ultima.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })
    : '';

  // Score MyID: maior = melhor. Dimensões (D/EFI/P/I/R/C/N): maior = mais perda/pior.
  const deltaScore = anterior ? score - Number(anterior.myid_score ?? 0) : null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-3 sm:p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Fingerprint className="icon-md text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                MyID do paciente
              </p>
              <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
                Score {score.toFixed(0)}/100 · {classificacao}
                {deltaScore !== null && deltaScore !== 0 && (
                  <span className={cn(
                    'inline-flex items-center gap-0.5 text-[11px] font-bold',
                    deltaScore > 0 ? 'text-emerald-600' : 'text-rose-600',
                  )}>
                    {deltaScore > 0 ? <ArrowUp className="icon-xs" /> : <ArrowDown className="icon-xs" />}
                    {Math.abs(deltaScore).toFixed(0)}
                  </span>
                )}
              </p>
              <p className="text-micro text-muted-foreground">
                Última resposta {when}
                {anterior && ' · comparado com a avaliação anterior'}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/pacientes/${pacienteId}?tab=identidade&sub=integrada`)}
            className="text-[11px] font-semibold text-primary inline-flex items-center gap-0.5 shrink-0"
          >
            Detalhes <ChevronRight className="icon-xs" />
          </button>
        </div>

        {/* Red flag */}
        {redFlags && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200">
            <AlertTriangle className="icon-xs text-rose-600 shrink-0" />
            <span className="text-[11px] font-semibold text-rose-700">
              Red flag detectada — revisar antes de prescrever exercícios.
            </span>
          </div>
        )}

        {/* Dimensões em chips */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          {DIMS.map(d => {
            const v = Number((ultima as any)[d.key] ?? 0);
            const isDriver = driver && (driver === d.label || String(driver).toUpperCase() === d.label);
            const vAnterior = anterior ? Number((anterior as any)[d.key] ?? 0) : null;
            const deltaDim = vAnterior !== null ? v - vAnterior : null;
            // Dimensão é "perda" — diminuir é melhora.
            return (
              <div
                key={d.key}
                title={`${d.full}: ${v.toFixed(1)}/10${deltaDim !== null ? ` (era ${vAnterior!.toFixed(1)})` : ''}`}
                className={cn(
                  'rounded-lg border px-1.5 py-1 flex flex-col items-center justify-center',
                  severityClass(v),
                  isDriver && 'ring-2 ring-primary/60',
                )}
              >
                <span className="text-[9px] font-bold uppercase opacity-70">{d.label}</span>
                <span className="text-sm font-black leading-none mt-0.5">{v.toFixed(1)}</span>
                {deltaDim !== null && Math.abs(deltaDim) >= 0.1 && (
                  <span className={cn(
                    'inline-flex items-center text-[9px] font-bold leading-none mt-0.5',
                    deltaDim < 0 ? 'text-emerald-700' : 'text-rose-700',
                  )}>
                    {deltaDim < 0 ? <ArrowDown className="icon-xs" /> : <ArrowUp className="icon-xs" />}
                    {Math.abs(deltaDim).toFixed(1)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-micro text-muted-foreground">
          Combine estes dados com a avaliação presencial para montar exercícios direcionados às maiores perdas.
        </p>
      </CardContent>
    </Card>
  );
}
