import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, AlertTriangle, ChevronDown } from 'lucide-react';
import { format, parseISO } from '@/lib/dateSafe';
import { cn } from '@/lib/utils';
import { INSTRUMENTOS, CLASSIFICACAO_LABEL, type InstrumentoId } from '@/lib/instrumentosClinicos';

// Visão do PROFISSIONAL: últimos escores dos questionários clínicos do
// paciente, com destaque para o que exige atenção (PAR-Q+ positivo, alto
// risco no START Back, PHQ-4/ISI graves).
const ATENCAO = new Set(['requer_atencao', 'alto_risco', 'insonia_grave', 'insonia_moderada', 'moderado', 'grave', 'funcao_reduzida']);

export default function QuestionariosClinicosCard({ pacienteId }: { pacienteId: string }) {
  const { data: itens = [] } = useQuery({
    queryKey: ['questionarios-clinicos-pro', pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any).from('questionarios_clinicos')
        .select('instrumento, escore, classificacao, respostas, created_at')
        .eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(40);
      const ultimos = new Map<string, any>();
      (data || []).forEach((r: any) => { if (!ultimos.has(r.instrumento)) ultimos.set(r.instrumento, r); });
      return [...ultimos.values()];
    },
  });

  const [aberto, setAberto] = useState(false);   // recolhido por padrão (economiza espaço)

  if (itens.length === 0) return null;

  const atencaoCount = itens.filter((r: any) => ATENCAO.has(r.classificacao)).length;

  return (
    <Card className="border-border/40 shadow-xs">
      <CardHeader className="pb-3">
        <button
          type="button"
          onClick={() => setAberto(a => !a)}
          className="flex items-center gap-2 w-full text-left"
          title={aberto ? 'Fechar' : 'Abrir para ver os questionários'}
        >
          <ClipboardCheck className="icon-sm text-violet-600 shrink-0" />
          <span className="text-base font-semibold truncate">Questionários clínicos</span>
          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold shrink-0">
            {itens.length}
          </span>
          {atencaoCount > 0 && (
            <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold shrink-0">
              <AlertTriangle className="h-3 w-3" /> {atencaoCount}
            </span>
          )}
          <ChevronDown className={cn('icon-sm text-muted-foreground shrink-0 ml-auto transition-transform', aberto && 'rotate-180')} />
        </button>
        {!aberto && (
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Toque no título para abrir e ver {itens.length} {itens.length === 1 ? 'questionário respondido' : 'questionários respondidos'} no portal
            {atencaoCount > 0 ? ` · ${atencaoCount} com atenção` : ''}.
          </p>
        )}
      </CardHeader>
      {aberto && (
      <CardContent className="space-y-2 pt-0">
        {itens.map((r: any) => {
          const inst = INSTRUMENTOS[r.instrumento as InstrumentoId];
          const atencao = ATENCAO.has(r.classificacao);
          const metas = r.respostas?.atividades as { nome: string; nota: number }[] | undefined;
          return (
            <div key={r.instrumento} className="p-2.5 rounded-lg border border-border/40 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium flex-1 min-w-0">
                  {inst?.sigla || r.instrumento}
                  <span className="text-xs text-muted-foreground font-normal"> · {format(parseISO(r.created_at), 'dd/MM/yyyy')}</span>
                </p>
                <span className="text-xs font-bold tabular-nums">{Number(r.escore).toLocaleString('pt-BR')}</span>
                <Badge variant={atencao ? 'destructive' : 'secondary'} className="text-[10px] gap-1">
                  {atencao && <AlertTriangle className="h-3 w-3" />}
                  {CLASSIFICACAO_LABEL[r.classificacao] || r.classificacao}
                </Badge>
              </div>
              {metas && (
                <p className="text-[11px] text-muted-foreground">
                  Metas do paciente: {metas.map(a => `${a.nome} (${a.nota}/10)`).join(' · ')}
                </p>
              )}
            </div>
          );
        })}
        <p className="text-[10px] text-muted-foreground">
          Instrumentos validados respondidos no portal. PAR-Q+ com atenção = avaliar antes de liberar treino.
        </p>
      </CardContent>
      )}
    </Card>
  );
}
