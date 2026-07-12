import { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { toast } from 'sonner';
import { Loader2, Sparkles, Trash2, ChevronDown, ChevronUp, BookOpen, ShieldAlert, Check } from 'lucide-react';

interface Ex {
  id: string;
  nome: string;
  categoria: string | null;
  descricao: string | null;
  instrucoes: any;
  precaucoes: any;
  perfis_indicados: any;
  evidencia: any;
  nivel_dificuldade: string | null;
  tempo_duracao: string | null;
  aprovado: boolean;
  gerado_por_ia: boolean;
}

const asArr = (v: any): any[] => (Array.isArray(v) ? v : []);

export default function CatalogoEvidencia() {
  const [lista, setLista] = useState<Ex[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'rascunho' | 'aprovado' | 'todos'>('rascunho');
  const [aberto, setAberto] = useState<string | null>(null);

  const carregar = async () => {
    const { data } = await supabase
      .from('exercicios_biblioteca')
      .select('id, nome, categoria, descricao, instrucoes, precaucoes, perfis_indicados, evidencia, nivel_dificuldade, tempo_duracao, aprovado, gerado_por_ia')
      .order('created_at', { ascending: false })
      .limit(500);
    setLista((data || []) as Ex[]);
    setLoading(false);
  };
  useEffect(() => { carregar(); }, []);

  const filtradas = useMemo(() => lista.filter(e =>
    filtro === 'todos' ? true : filtro === 'aprovado' ? e.aprovado : !e.aprovado
  ), [lista, filtro]);

  const contagem = useMemo(() => ({
    rascunho: lista.filter(e => !e.aprovado).length,
    aprovado: lista.filter(e => e.aprovado).length,
  }), [lista]);

  const setAprovado = async (id: string, aprovado: boolean) => {
    const { error } = await supabase.from('exercicios_biblioteca').update({ aprovado }).eq('id', id);
    if (error) return toast.error('Erro: ' + error.message);
    setLista(l => l.map(e => e.id === id ? { ...e, aprovado } : e));
    toast.success(aprovado ? 'Liberado para os pacientes' : 'Ocultado');
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from('exercicios_biblioteca').delete().eq('id', id);
    if (error) return toast.error('Erro: ' + error.message);
    setLista(l => l.filter(e => e.id !== id));
    toast.success('Removido');
  };

  const TABS: [typeof filtro, string, number][] = [
    ['rascunho', 'Rascunhos', contagem.rascunho],
    ['aprovado', 'Liberados', contagem.aprovado],
    ['todos', 'Todos', lista.length],
  ];

  return (
    <AppLayout>
      <div className="container max-w-3xl py-6 space-y-4">
        <PageHeader back title="Catálogo de Evidência (IA)" subtitle="Revise e libere os exercícios/dicas gerados a partir das meta-análises. Só os liberados aparecem para os pacientes." />

        <div className="flex gap-1.5">
          {TABS.map(([k, label, n]) => (
            <button key={k} onClick={() => setFiltro(k)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${filtro === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground'}`}>
              {label}{n > 0 && <span className="opacity-70">{n}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtradas.length === 0 ? (
          <Card><CardContent className="p-10 text-center">
            <Sparkles className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {filtro === 'rascunho' ? 'Nenhum rascunho para revisar' : 'Nada aqui'}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">Gere exercícios na Base Científica (botão ✨ por área).</p>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {filtradas.map(e => {
              const open = aberto === e.id;
              const evid = asArr(e.evidencia);
              return (
                <Card key={e.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{e.nome}</span>
                          {e.categoria && <Badge variant="outline" className="text-[10px]">{e.categoria}</Badge>}
                          {e.aprovado
                            ? <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Liberado</Badge>
                            : <Badge variant="outline" className="text-[10px]">Rascunho</Badge>}
                          {e.gerado_por_ia && <Badge variant="outline" className="text-[10px] gap-1"><Sparkles className="h-2.5 w-2.5" /> IA</Badge>}
                        </div>
                        {e.descricao && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{e.descricao}</p>}
                        <button onClick={() => setAberto(open ? null : e.id)} className="text-[11px] text-primary flex items-center gap-0.5 mt-1">
                          {open ? <>Menos <ChevronUp className="h-3 w-3" /></> : <>Ver detalhes e evidência <ChevronDown className="h-3 w-3" /></>}
                        </button>
                      </div>
                    </div>

                    {open && (
                      <div className="px-3 pb-3 space-y-2.5 text-xs border-t border-border/40 pt-2.5">
                        {asArr(e.instrucoes).length > 0 && (
                          <div>
                            <p className="font-semibold text-foreground mb-1">Como fazer</p>
                            <ol className="list-decimal pl-4 space-y-0.5 text-muted-foreground">
                              {asArr(e.instrucoes).map((s, i) => <li key={i}>{String(s)}</li>)}
                            </ol>
                          </div>
                        )}
                        {asArr(e.precaucoes).length > 0 && (
                          <div>
                            <p className="font-semibold text-foreground mb-1 flex items-center gap-1"><ShieldAlert className="h-3.5 w-3.5 text-amber-600" /> Precauções</p>
                            <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                              {asArr(e.precaucoes).map((s, i) => <li key={i}>{String(s)}</li>)}
                            </ul>
                          </div>
                        )}
                        {asArr(e.perfis_indicados).length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {asArr(e.perfis_indicados).map((p, i) => <Badge key={i} variant="secondary" className="text-[9px]">{String(p)}</Badge>)}
                          </div>
                        )}
                        {evid.length > 0 && (
                          <div>
                            <p className="font-semibold text-foreground mb-1 flex items-center gap-1"><BookOpen className="h-3.5 w-3.5 text-primary" /> Evidência</p>
                            <ul className="space-y-1">
                              {evid.map((r: any, i: number) => (
                                <li key={i} className="text-[11px] text-muted-foreground">
                                  {r.titulo || 'Referência'}{r.nivel ? ` · ${r.nivel}` : ''}
                                  {r.doi && <span className="text-primary"> · DOI: {r.doi}</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 px-3 py-2 border-t border-border/40 bg-muted/20">
                      {e.aprovado ? (
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setAprovado(e.id, false)}>Ocultar</Button>
                      ) : (
                        <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setAprovado(e.id, true)}><Check className="h-3.5 w-3.5" /> Liberar</Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive hover:text-destructive ml-auto" onClick={() => remover(e.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
