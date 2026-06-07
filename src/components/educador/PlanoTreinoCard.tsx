import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Dumbbell, Sparkles, Loader2, Eye, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface Props { pacienteId: string; }

export default function PlanoTreinoCard({ pacienteId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [objetivo, setObjetivo] = useState('hipertrofia');
  const [nivel, setNivel] = useState('iniciante');
  const [freq, setFreq] = useState(3);
  const [duracao, setDuracao] = useState(12);
  const [restricoes, setRestricoes] = useState('');
  const [verPlano, setVerPlano] = useState<any | null>(null);

  const { data: planos = [] } = useQuery({
    queryKey: ['planos-treino', pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('planos_treino').select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false }).limit(10);
      return data || [];
    },
  });

  const gerarMut = useMutation({
    mutationFn: async () => {
      // Buscar contexto: paciente + última antropometria + testes
      const [pac, antro, testes] = await Promise.all([
        supabase.from('pacientes').select('nome, sobrenome, data_nascimento, sexo').eq('id', pacienteId).maybeSingle(),
        (supabase as any).from('antropometria').select('peso_kg, altura_cm, imc, gordura_pct').eq('paciente_id', pacienteId).order('data_medicao', { ascending: false }).limit(1).maybeSingle(),
        (supabase as any).from('testes_funcionais_paciente').select('tipo_teste, resultado, unidade, classificacao').eq('paciente_id', pacienteId).order('data_teste', { ascending: false }).limit(8),
      ]);
      const p = pac.data as any;
      const idade = p?.data_nascimento ? Math.floor((Date.now() - new Date(p.data_nascimento).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;

      const { data, error } = await supabase.functions.invoke('gerar-plano-treino', {
        body: {
          objetivo, nivel,
          frequencia_semanal: freq,
          duracao_semanas: duracao,
          restricoes: restricoes || null,
          antropometria: antro.data || null,
          testes: testes.data || [],
          idade, sexo: p?.sexo,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const plano = (data as any).plano;

      const { error: insErr } = await (supabase as any).from('planos_treino').insert({
        terapeuta_id: user!.id,
        paciente_id: pacienteId,
        titulo: plano.titulo || `Plano ${objetivo} ${nivel}`,
        objetivo, nivel,
        frequencia_semanal: freq,
        duracao_semanas: duracao,
        restricoes: restricoes || null,
        estrutura: plano,
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success('Plano gerado e salvo');
      qc.invalidateQueries({ queryKey: ['planos-treino', pacienteId] });
      setRestricoes('');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar plano'),
  });

  const apagar = async (id: string) => {
    if (!confirm('Apagar este plano?')) return;
    await (supabase as any).from('planos_treino').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['planos-treino', pacienteId] });
  };

  return (
    <Card className="rounded-xl border-border/40 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Dumbbell className="icon-sm text-primary" /> Plano de Treino (IA)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Objetivo</label>
            <Select value={objetivo} onValueChange={setObjetivo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hipertrofia">Hipertrofia</SelectItem>
                <SelectItem value="emagrecimento">Emagrecimento</SelectItem>
                <SelectItem value="performance">Performance</SelectItem>
                <SelectItem value="saude">Saúde geral</SelectItem>
                <SelectItem value="reabilitacao">Reabilitação</SelectItem>
                <SelectItem value="forca">Força</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Nível</label>
            <Select value={nivel} onValueChange={setNivel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="iniciante">Iniciante</SelectItem>
                <SelectItem value="intermediario">Intermediário</SelectItem>
                <SelectItem value="avancado">Avançado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Freq./semana</label>
            <Input type="number" min={1} max={7} value={freq} onChange={(e) => setFreq(parseInt(e.target.value) || 3)} />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Duração (sem)</label>
            <Input type="number" min={2} max={52} value={duracao} onChange={(e) => setDuracao(parseInt(e.target.value) || 12)} />
          </div>
        </div>
        <Textarea placeholder="Restrições/lesões (opcional)" rows={2} value={restricoes} onChange={(e) => setRestricoes(e.target.value)} />

        <Button size="sm" onClick={() => gerarMut.mutate()} disabled={gerarMut.isPending} className="w-full">
          {gerarMut.isPending ? <Loader2 className="icon-xs animate-spin mr-2" /> : <Sparkles className="icon-xs mr-2" />}
          {gerarMut.isPending ? 'Gerando plano periodizado...' : 'Gerar plano com IA'}
        </Button>

        {planos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum plano gerado.</p>
        )}

        {planos.map((p: any) => (
          <div key={p.id} className="p-3 rounded-lg border border-border/40 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{p.titulo}</div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString('pt-BR')} · {p.frequencia_semanal}x/sem · {p.duracao_semanas} sem
                  <Badge variant="outline" className="ml-2 text-[10px]">{p.objetivo}</Badge>
                  <Badge variant="outline" className="ml-1 text-[10px]">{p.nivel}</Badge>
                </div>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setVerPlano(p)}><Eye className="icon-xs" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => apagar(p.id)}><Trash2 className="icon-xs text-destructive" /></Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={!!verPlano} onOpenChange={(o) => !o && setVerPlano(null)}>
        <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-base">{verPlano?.titulo}</DialogTitle></DialogHeader>
          {verPlano && (() => {
            const e = verPlano.estrutura || {};
            return (
              <div className="space-y-4 text-sm">
                {e.resumo && <p className="text-foreground/80">{e.resumo}</p>}
                {(e.fases || []).map((fase: any, i: number) => (
                  <div key={i} className="rounded-lg border border-border/40 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{fase.nome}</div>
                      <Badge variant="outline" className="text-[10px]">{fase.semanas} sem</Badge>
                    </div>
                    {fase.objetivo && <p className="text-xs text-muted-foreground">{fase.objetivo}</p>}
                    {(fase.sessoes || []).map((s: any, j: number) => (
                      <div key={j} className="rounded-md bg-muted/20 p-2 space-y-1.5">
                        <div className="font-medium text-sm">{s.nome} {s.duracao_min && <span className="text-muted-foreground text-xs">· {s.duracao_min} min</span>}</div>
                        {s.aquecimento && <div className="text-xs"><span className="text-muted-foreground">Aquecimento: </span>{s.aquecimento}</div>}
                        <table className="w-full text-xs">
                          <thead className="text-muted-foreground"><tr>
                            <th className="text-left p-1">Exercício</th>
                            <th className="text-left p-1">Séries × Reps</th>
                            <th className="text-left p-1">Descanso</th>
                          </tr></thead>
                          <tbody>
                            {(s.exercicios || []).map((ex: any, k: number) => (
                              <tr key={k} className="border-t border-border/30">
                                <td className="p-1 font-medium">{ex.nome}{ex.obs && <div className="text-[10px] text-muted-foreground">{ex.obs}</div>}</td>
                                <td className="p-1">{ex.series} × {ex.reps} {ex.carga && <span className="text-muted-foreground">({ex.carga})</span>}</td>
                                <td className="p-1">{ex.descanso_s ? `${ex.descanso_s}s` : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {s.desaquecimento && <div className="text-xs"><span className="text-muted-foreground">Desaquecimento: </span>{s.desaquecimento}</div>}
                      </div>
                    ))}
                  </div>
                ))}
                {e.observacoes_gerais && (
                  <div className="rounded-md bg-muted/30 p-3 text-xs">
                    <div className="font-semibold mb-1">Observações gerais</div>
                    {e.observacoes_gerais}
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
