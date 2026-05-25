import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Gift, Sparkles, Loader2, Check, Clock, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useRecompensasPaciente, usePacienteXP, NIVEIS_ORDEM, NIVEL_LABEL, NIVEL_COR,
  NIVEL_LIMITES, proximoNivel
} from '@/hooks/useRecompensas';
import { cn } from '@/lib/utils';

export default function PacienteRecompensas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [pacienteId, setPacienteId] = useState<string>();

  useEffect(() => {
    if (!user) return;
    supabase.from('pacientes').select('id').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => data && setPacienteId(data.id));
  }, [user]);

  const { data: xpData } = usePacienteXP(pacienteId);
  const { catalogo, meusResgates, isLoading, resgatar, resgatando } = useRecompensasPaciente(pacienteId);

  const xp = xpData?.xp_total ?? 0;
  const nivel = xpData?.nivel_atual ?? 'bronze';
  const { proximo, faltam } = proximoNivel(xp);
  const nivelIdx = NIVEIS_ORDEM.indexOf(nivel);

  const handleResgate = async (id: string, custo: number, titulo: string) => {
    if (xp < custo) {
      toast({ title: 'XP insuficiente', description: `Você tem ${xp} XP, faltam ${custo - xp}.`, variant: 'destructive' });
      return;
    }
    try {
      await resgatar(id);
      toast({ title: '🎉 Resgate solicitado!', description: `Você resgatou: ${titulo}` });
    } catch (e: any) {
      toast({ title: 'Erro no resgate', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="space-y-6 pb-24">
          <div>
            <h1 className="h-page">Recompensas</h1>
            <p className="text-caption mt-1">Troque seu XP por benefícios reais</p>
          </div>

          {/* Card de nível */}
          <Card className="overflow-hidden">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', NIVEL_COR[nivel])}>
                  <Trophy className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <div className="text-caption">Seu nível</div>
                  <div className="text-xl font-bold">{NIVEL_LABEL[nivel]}</div>
                </div>
                <div className="text-right">
                  <div className="text-caption">XP</div>
                  <div className="text-xl font-bold text-primary">{xp}</div>
                </div>
              </div>

              {proximo && (
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Para {NIVEL_LABEL[proximo]}</span>
                    <span className="font-semibold">{faltam} XP</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all"
                      style={{ width: `${Math.min(100, ((xp - NIVEL_LIMITES[nivel]) / (NIVEL_LIMITES[proximo] - NIVEL_LIMITES[nivel])) * 100)}%` }} />
                  </div>
                </div>
              )}

              {/* Trilha de níveis */}
              <div className="flex justify-between pt-2">
                {NIVEIS_ORDEM.map((n, i) => (
                  <div key={n} className="flex flex-col items-center gap-1">
                    <div className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2',
                      i <= nivelIdx ? 'border-primary bg-primary text-primary-foreground' : 'border-muted bg-background text-muted-foreground'
                    )}>
                      {i <= nivelIdx ? <Check className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{NIVEL_LABEL[n]}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Catálogo */}
          <section>
            <h2 className="h-section mb-3 flex items-center gap-2"><Gift className="w-4 h-4" /> Catálogo</h2>
            {isLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : catalogo.length === 0 ? (
              <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">
                Seu profissional ainda não cadastrou recompensas.
              </CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {catalogo.map(r => {
                  const nivelOk = NIVEIS_ORDEM.indexOf(r.nivel_minimo) <= nivelIdx;
                  const podeResgatar = nivelOk && xp >= r.xp_custo && (r.estoque === null || r.estoque > 0);
                  return (
                    <Card key={r.id} className={cn(!podeResgatar && 'opacity-70')}>
                      <CardContent className="p-4 flex gap-3 items-center">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{r.titulo}</span>
                            {r.nivel_minimo !== 'bronze' && (
                              <Badge variant="outline" className={cn('text-[10px]', NIVEL_COR[r.nivel_minimo])}>
                                {NIVEL_LABEL[r.nivel_minimo]}+
                              </Badge>
                            )}
                          </div>
                          {r.descricao && <p className="text-xs text-muted-foreground mt-1">{r.descricao}</p>}
                          {r.estoque !== null && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {r.estoque > 0 ? `${r.estoque} disponíveis` : 'Esgotado'}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge className="bg-primary/10 text-primary border-0 gap-1">
                            <Sparkles className="w-3 h-3" />{r.xp_custo} XP
                          </Badge>
                          <Button size="sm" disabled={!podeResgatar || resgatando}
                            onClick={() => handleResgate(r.id, r.xp_custo, r.titulo)}>
                            {!nivelOk ? <><Lock className="w-3 h-3 mr-1" />Bloqueado</> : 'Resgatar'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Meus resgates */}
          {meusResgates.length > 0 && (
            <section>
              <h2 className="h-section mb-3">Meus resgates</h2>
              <div className="grid gap-2">
                {meusResgates.map(r => (
                  <Card key={r.id}><CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{r.recompensa?.titulo}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(r.resgatado_em).toLocaleDateString('pt-BR')} · {r.xp_gasto} XP
                      </div>
                    </div>
                    <Badge variant="outline" className={cn(
                      'text-[10px]',
                      r.status === 'entregue' && 'bg-green-100 text-green-700',
                      r.status === 'solicitado' && 'bg-amber-100 text-amber-700',
                      r.status === 'aprovado' && 'bg-blue-100 text-blue-700',
                      r.status === 'cancelado' && 'bg-red-100 text-red-700',
                    )}>
                      {r.status === 'entregue' ? <Check className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                      {r.status}
                    </Badge>
                  </CardContent></Card>
                ))}
              </div>
            </section>
          )}
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
