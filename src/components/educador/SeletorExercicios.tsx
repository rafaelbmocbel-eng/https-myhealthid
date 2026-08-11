import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Search, Dumbbell, Plus } from 'lucide-react';
import { classificarExercicio, SEGMENTOS, FUNCOES, type Segmento, type Funcao } from '@/utils/classificarExercicio';

export interface ExercicioEscolhido {
  id?: string;
  nome: string;
  gif_url?: string | null;
  orientacoes?: string | null;
  series?: number;
  reps?: string;
  descanso_s?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (ex: ExercicioEscolhido) => void;
}

// Seletor de exercícios da biblioteca do profissional, organizado por SEGMENTO
// (membros inferiores/superiores, tronco/core, corpo todo) e FUNÇÃO (força,
// mobilidade, funcional, alongamento, cardio, equilíbrio). Para montar/modificar
// o treino vendo os exercícios por categoria.
export default function SeletorExercicios({ open, onOpenChange, onPick }: Props) {
  const { user } = useAuth();
  const [busca, setBusca] = useState('');
  const [segAtivo, setSegAtivo] = useState<Segmento | 'Todos'>('Todos');
  const [funAtivo, setFunAtivo] = useState<Funcao | 'Todas'>('Todas');

  const { data: exercicios = [], isLoading } = useQuery({
    queryKey: ['biblioteca-seletor', user?.id],
    enabled: !!user?.id && open,
    queryFn: async () => {
      // Biblioteca compartilhada: os seus + os compartilhados por outros
      // profissionais (a RLS filtra own OR compartilhado).
      const { data } = await (supabase as any).from('biblioteca_exercicios')
        .select('id, nome, grupo_muscular, gif_url, orientacoes, series_padrao, repeticoes_padrao, descanso_padrao_segundos')
        .eq('ativo', true).order('nome');
      return (data || []).map((e: any) => ({ ...e, ...classificarExercicio(e.nome, e.grupo_muscular) }));
    },
  });

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (exercicios as any[]).filter((e) =>
      (segAtivo === 'Todos' || e.segmento === segAtivo) &&
      (funAtivo === 'Todas' || e.funcao === funAtivo) &&
      (!q || e.nome.toLowerCase().includes(q) || (e.grupo_muscular || '').toLowerCase().includes(q)),
    );
  }, [exercicios, busca, segAtivo, funAtivo]);

  // Agrupa o resultado por segmento para exibir em seções.
  const porSegmento = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const e of filtrados) { (m.get(e.segmento) || m.set(e.segmento, []).get(e.segmento)!).push(e); }
    return [...m.entries()].sort((a, b) => SEGMENTOS.indexOf(a[0] as Segmento) - SEGMENTOS.indexOf(b[0] as Segmento));
  }, [filtrados]);

  const escolher = (e: any) => {
    onPick({
      id: e.id,
      nome: e.nome,
      gif_url: e.gif_url,
      orientacoes: e.orientacoes,
      series: e.series_padrao ?? 3,
      reps: String(e.repeticoes_padrao ?? 12),
      descanso_s: e.descanso_padrao_segundos ?? 45,
    });
    onOpenChange(false);
  };

  const contagem = (exercicios as any[]).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader><DialogTitle className="text-base flex items-center gap-2"><Dumbbell className="h-4 w-4 text-primary" /> Escolher exercício da biblioteca</DialogTitle></DialogHeader>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar por nome ou grupo…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          {/* Filtro por SEGMENTO */}
          <div className="flex flex-wrap gap-1.5">
            {(['Todos', ...SEGMENTOS] as const).map((s) => (
              <button key={s} onClick={() => setSegAtivo(s as any)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${segAtivo === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border/60 text-muted-foreground hover:bg-muted/40'}`}>
                {s}
              </button>
            ))}
          </div>
          {/* Filtro por FUNÇÃO */}
          <div className="flex flex-wrap gap-1.5">
            {(['Todas', ...FUNCOES] as const).map((f) => (
              <button key={f} onClick={() => setFunAtivo(f as any)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${funAtivo === f ? 'bg-accent text-accent-foreground border-accent' : 'border-border/60 text-muted-foreground hover:bg-muted/40'}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto mt-2 space-y-4 pr-1">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : contagem === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sua biblioteca está vazia. Suba seus exercícios (com GIF) em <strong>Biblioteca de Exercícios</strong> para escolher aqui.
            </p>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum exercício com esses filtros.</p>
          ) : (
            porSegmento.map(([seg, lista]) => (
              <div key={seg} className="space-y-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground sticky top-0 bg-background py-1">{seg} ({lista.length})</div>
                {lista.map((e: any) => (
                  <button key={e.id} onClick={() => escolher(e)}
                    className="w-full flex items-center gap-2.5 p-2 rounded-lg border border-border/40 hover:bg-muted/40 text-left transition-colors">
                    {e.gif_url
                      ? <img src={e.gif_url} alt="" loading="lazy" className="h-11 w-11 rounded-md object-cover bg-muted shrink-0" />
                      : <div className="h-11 w-11 rounded-md bg-muted flex items-center justify-center shrink-0"><Dumbbell className="h-4 w-4 text-muted-foreground" /></div>}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{e.nome}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {e.grupo_muscular && <span className="text-[10px] text-muted-foreground truncate">{e.grupo_muscular}</span>}
                        <Badge variant="outline" className="text-[9px] h-4 shrink-0">{e.funcao}</Badge>
                      </div>
                    </div>
                    <Plus className="h-4 w-4 text-primary shrink-0" />
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Exercício fora da biblioteca — adiciona em branco para digitar */}
        <div className="pt-2 border-t border-border/40">
          <Button variant="ghost" size="sm" className="w-full text-[11px] gap-1.5"
            onClick={() => { onPick({ nome: '' }); onOpenChange(false); }}>
            <Plus className="h-3 w-3" /> Adicionar exercício em branco (digitar manualmente)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
