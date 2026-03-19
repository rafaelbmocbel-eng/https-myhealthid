import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Star, TrendingUp, Plus, Loader2, MessageSquare, SmilePlus, Meh, Frown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  pacienteId?: string;
  showDashboard?: boolean;
}

export default function NpsSurveyCard({ pacienteId, showDashboard = false }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nota, setNota] = useState<number | null>(null);
  const [comentario, setComentario] = useState('');
  const [selectedPaciente, setSelectedPaciente] = useState(pacienteId || '');

  const { data: npsData = [], isLoading } = useQuery({
    queryKey: ['pesquisas-nps', user?.id, pacienteId],
    queryFn: async () => {
      let q = (supabase as any).from('pesquisas_nps').select('*, pacientes(nome, sobrenome)').eq('terapeuta_id', user!.id).order('created_at', { ascending: false });
      if (pacienteId) q = q.eq('paciente_id', pacienteId);
      const { data, error } = await q.limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ['pacientes-nps-select', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('pacientes').select('id, nome, sobrenome').eq('terapeuta_id', user!.id).eq('ativo', true).order('nome');
      return data || [];
    },
    enabled: !!user && !pacienteId,
  });

  const registrar = useMutation({
    mutationFn: async () => {
      const pid = pacienteId || selectedPaciente;
      if (!pid || nota === null) throw new Error('Preencha todos os campos');
      const { error } = await (supabase as any).from('pesquisas_nps').insert({
        paciente_id: pid,
        terapeuta_id: user!.id,
        nota,
        comentario: comentario.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pesquisas-nps'] });
      toast({ title: 'NPS registrado! ✅' });
      setOpen(false);
      setNota(null);
      setComentario('');
    },
    onError: (err: any) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  // NPS metrics
  const promotores = npsData.filter((n: any) => n.nota >= 9).length;
  const neutros = npsData.filter((n: any) => n.nota >= 7 && n.nota <= 8).length;
  const detratores = npsData.filter((n: any) => n.nota <= 6).length;
  const total = npsData.length;
  const npsScore = total > 0 ? Math.round(((promotores - detratores) / total) * 100) : null;
  const mediaNotas = total > 0 ? (npsData.reduce((s: number, n: any) => s + n.nota, 0) / total).toFixed(1) : '—';

  const getNpsColor = (score: number) => score >= 50 ? 'text-emerald-600' : score >= 0 ? 'text-amber-600' : 'text-destructive';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            Pesquisa de Satisfação (NPS)
          </CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7">
                <Plus className="h-3 w-3" /> Registrar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-base">Nova Pesquisa NPS</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {!pacienteId && (
                  <Select value={selectedPaciente} onValueChange={setSelectedPaciente}>
                    <SelectTrigger className="text-xs"><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                    <SelectContent>
                      {pacientes.map((p: any) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">{p.nome} {p.sobrenome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <div>
                  <p className="text-xs text-muted-foreground mb-2">De 0 a 10, o quanto recomendaria nosso atendimento?</p>
                  <div className="grid grid-cols-11 gap-1">
                    {Array.from({ length: 11 }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setNota(i)}
                        className={`h-9 w-full rounded-md text-xs font-semibold border transition-all ${
                          nota === i
                            ? i <= 6 ? 'bg-destructive text-destructive-foreground border-destructive'
                              : i <= 8 ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-muted/50 text-muted-foreground border-border hover:bg-accent'
                        }`}
                      >
                        {i}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>Nada provável</span>
                    <span>Muito provável</span>
                  </div>
                </div>
                <Textarea placeholder="Comentário (opcional)" value={comentario} onChange={e => setComentario(e.target.value)} rows={2} className="text-xs" />
                <Button onClick={() => registrar.mutate()} disabled={nota === null || registrar.isPending} className="w-full gap-2">
                  {registrar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                  Registrar NPS
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma pesquisa registrada ainda.</p>
        ) : (
          <div className="space-y-3">
            {/* Score */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className={`text-2xl font-bold ${npsScore !== null ? getNpsColor(npsScore) : ''}`}>
                  {npsScore !== null ? `${npsScore > 0 ? '+' : ''}${npsScore}` : '—'}
                </div>
                <div className="text-[10px] text-muted-foreground">NPS Score</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{mediaNotas}</div>
                <div className="text-[10px] text-muted-foreground">Média</div>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 text-[10px]">
                  <SmilePlus className="h-3 w-3 text-emerald-500" />
                  <span className="text-muted-foreground">Promotores</span>
                  <span className="ml-auto font-semibold">{promotores}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <Meh className="h-3 w-3 text-amber-500" />
                  <span className="text-muted-foreground">Neutros</span>
                  <span className="ml-auto font-semibold">{neutros}</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <Frown className="h-3 w-3 text-destructive" />
                  <span className="text-muted-foreground">Detratores</span>
                  <span className="ml-auto font-semibold">{detratores}</span>
                </div>
              </div>
            </div>

            {/* Recent feedback */}
            {showDashboard && npsData.filter((n: any) => n.comentario).slice(0, 3).map((n: any) => (
              <div key={n.id} className="flex items-start gap-2 text-[11px] border-t pt-2">
                <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">{n.pacientes?.nome}</span>
                    <Badge variant="outline" className={`text-[9px] ${n.nota >= 9 ? 'text-emerald-600 border-emerald-200' : n.nota >= 7 ? 'text-amber-600 border-amber-200' : 'text-destructive border-destructive/30'}`}>
                      {n.nota}/10
                    </Badge>
                    <span className="text-muted-foreground ml-auto text-[9px]">{format(parseISO(n.created_at), 'dd/MM', { locale: ptBR })}</span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 line-clamp-2">"{n.comentario}"</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
