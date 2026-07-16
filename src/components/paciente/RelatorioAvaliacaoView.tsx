import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Award, ChevronRight } from 'lucide-react';

// Devolutiva da avaliação para o CLIENTE: pontos fortes, o que melhorar (com
// primeiro passo) e próximos passos no app. RLS garante que só aparece o que
// o profissional deixou visível.
export default function RelatorioAvaliacaoView({ pacienteId }: { pacienteId: string }) {
  const [aberto, setAberto] = useState(false);
  const { data: rel } = useQuery({
    queryKey: ['relatorio-avaliacao-view', pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any).from('relatorios_avaliacao')
        .select('conteudo, updated_at').eq('paciente_id', pacienteId)
        .eq('enviado_portal', true).maybeSingle();
      return data;
    },
  });

  const c = rel?.conteudo;
  if (!c) return null;

  return (
    <Card className="overflow-hidden border-amber-500/30">
      <button onClick={() => setAberto(v => !v)} className="w-full text-left p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
          <Award className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{c.titulo || 'Seu Relatório de Avaliação'}</p>
          <p className="text-[11px] text-muted-foreground">
            {(c.pontos_fortes || []).length} pontos fortes · {(c.pontos_a_melhorar || []).length} para evoluir — toque para {aberto ? 'recolher' : 'ler'}
          </p>
        </div>
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${aberto ? 'rotate-90' : ''}`} />
      </button>
      {aberto && (
        <CardContent className="pt-0 space-y-3">
          {c.resumo && <p className="text-sm text-muted-foreground">{c.resumo}</p>}
          {(c.pontos_fortes || []).length > 0 && (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
              <p className="text-xs font-bold mb-2">💪 Seus pontos fortes</p>
              <ul className="space-y-1.5 text-sm">
                {c.pontos_fortes.map((p: any, i: number) => (
                  <li key={i}><span className="font-medium">{p.titulo}</span> — <span className="text-muted-foreground">{p.descricao}</span></li>
                ))}
              </ul>
            </div>
          )}
          {(c.pontos_a_melhorar || []).length > 0 && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
              <p className="text-xs font-bold mb-2">🎯 O que vamos melhorar juntos</p>
              <ul className="space-y-2 text-sm">
                {c.pontos_a_melhorar.map((p: any, i: number) => (
                  <li key={i}>
                    <p className="font-medium">{p.titulo}</p>
                    <p className="text-muted-foreground text-xs">{p.por_que}</p>
                    {p.primeiro_passo && <p className="text-xs mt-0.5">👉 Primeiro passo: {p.primeiro_passo}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(c.proximos_passos || []).length > 0 && (
            <div>
              <p className="text-xs font-bold mb-1">Próximos passos</p>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
                {c.proximos_passos.map((p: string, i: number) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
          {c.mensagem_final && <p className="text-sm font-medium">✨ {c.mensagem_final}</p>}
        </CardContent>
      )}
    </Card>
  );
}
