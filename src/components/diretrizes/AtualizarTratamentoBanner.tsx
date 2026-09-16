import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLenteAtiva } from '@/hooks/useLenteAtiva';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RefreshCw, Loader2, Check, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import { erroDaFuncao } from '@/lib/fnError';
import { PlanoConteudo } from './DiretrizAreaCard';

// Área clínica (gerar-diretriz-clinica) por perfil da lente. Lentes sem diretriz
// clínica (ex.: nutricionista/educador) retornam undefined → o aviso não aparece.
const AREA_POR_PERFIL: Record<string, { area: string; nome: string }> = {
  fisioterapeuta: { area: 'fisioterapia', nome: 'Plano Fisioterápico' },
  medico: { area: 'medicina', nome: 'Diretriz Médica' },
  psicologo: { area: 'psicologia', nome: 'Plano Terapêutico' },
  terapeuta_ocupacional: { area: 'terapia_ocupacional', nome: 'Plano Ocupacional' },
  dentista: { area: 'odontologia', nome: 'Plano Odontológico' },
};

// Aviso "a avaliação mudou — atualizar o tratamento?" mostrado DENTRO da avaliação
// depois que o profissional edita a parte clínica. Roda o mesmo fluxo do botão
// "Atualizar com a avaliação" do card de diretriz: preview (sem salvar) → revisar
// → aplicar (preservando o estado do portal). Não é automático — o profissional
// confirma. `onDone` é chamado ao aplicar ou dispensar.
export default function AtualizarTratamentoBanner({ pacienteId, onDone, onAtualizarAbas, atualizandoAbas }: {
  pacienteId: string;
  onDone?: () => void;
  // Reprocessa a avaliação e atualiza as abas (Quadro/Dx e Tratamento). Opcional.
  onAtualizarAbas?: () => void;
  atualizandoAbas?: boolean;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: lente } = useLenteAtiva();
  const cfg = lente ? AREA_POR_PERFIL[lente.id] : undefined;
  const area = cfg?.area;
  const [sugestao, setSugestao] = useState<any | null>(null);
  const [revisar, setRevisar] = useState(false);

  const { data: diretriz } = useQuery({
    queryKey: ['diretriz-prof', area, pacienteId],
    enabled: !!area,
    queryFn: async () => {
      const { data } = await (supabase as any).from('diretrizes_profissionais')
        .select('*').eq('paciente_id', pacienteId).eq('area', area)
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const atualizar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('gerar-diretriz-clinica', {
        body: { paciente_id: pacienteId, area, preview: true },
      });
      if (error) throw await erroDaFuncao(error);
      const d = data as any;
      if (!d?.ok || !d?.diretriz) throw new Error(d?.error || 'Falha ao gerar');
      return d.diretriz;
    },
    onSuccess: (d) => { setSugestao(d); setRevisar(true); },
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar'),
  });

  const aplicar = useMutation({
    mutationFn: async () => {
      if (!sugestao || !area) return;
      if (diretriz?.id) {
        // Atualiza só o conteúdo, PRESERVANDO enviada_portal/status.
        const { error } = await (supabase as any).from('diretrizes_profissionais').update({
          titulo: sugestao.titulo || diretriz.titulo,
          objetivo: sugestao.objetivo ?? diretriz.objetivo ?? null,
          conteudo: sugestao,
          updated_at: new Date().toISOString(),
        }).eq('id', diretriz.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('diretrizes_profissionais').insert({
          terapeuta_id: user?.id, paciente_id: pacienteId, area,
          titulo: sugestao.titulo || 'Diretriz de tratamento',
          objetivo: sugestao.objetivo || null,
          status: 'rascunho', conteudo: sugestao, enviada_portal: false,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(diretriz?.enviada_portal
        ? 'Tratamento atualizado — já refletido no portal'
        : 'Tratamento atualizado com a avaliação');
      setRevisar(false); setSugestao(null);
      qc.invalidateQueries({ queryKey: ['diretriz-prof', area, pacienteId] });
      onDone?.();
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao aplicar'),
  });

  if (!area && !onAtualizarAbas) return null;

  return (
    <>
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-start gap-3 flex-wrap">
        <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">A avaliação mudou</p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Atualize as outras abas e o tratamento com o que você acrescentou{area ? ' — o tratamento você revisa antes de aplicar' : ''}.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {onAtualizarAbas && (
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => onAtualizarAbas()} disabled={!!atualizandoAbas}>
              {atualizandoAbas ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {atualizandoAbas ? 'Atualizando…' : 'Atualizar abas'}
            </Button>
          )}
          {area && (
            <Button size="sm" variant={onAtualizarAbas ? 'outline' : 'default'} className="h-8 gap-1.5 text-xs" onClick={() => atualizar.mutate()} disabled={atualizar.isPending}>
              {atualizar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {atualizar.isPending ? 'Gerando…' : 'Atualizar tratamento'}
            </Button>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8" title="Agora não" onClick={() => onDone?.()}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={revisar} onOpenChange={(o) => { setRevisar(o); if (!o) setSugestao(null); }}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
          {sugestao && (
            <>
              <DialogHeader><DialogTitle>Sugestão a partir da avaliação</DialogTitle></DialogHeader>
              <p className="text-xs text-muted-foreground -mt-1">
                Gerada com o que você acrescentou. O plano atual
                {diretriz?.enviada_portal ? ' (que está no portal)' : ''} só muda quando você aplicar.
              </p>
              <div className="space-y-4">
                <PlanoConteudo c={sugestao} />
                <div className="flex gap-2 sticky bottom-0 bg-background pt-2 -mx-6 px-6 border-t border-border/40">
                  <Button variant="outline" className="flex-1" disabled={aplicar.isPending}
                    onClick={() => { setRevisar(false); setSugestao(null); }}>
                    Descartar
                  </Button>
                  <Button className="flex-1" onClick={() => aplicar.mutate()} disabled={aplicar.isPending}>
                    {aplicar.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                    Aplicar ao plano
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
