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
import { usePacientePortal } from '@/hooks/usePacientePortal';

export default function PacienteRecompensas() {
  const { toast } = useToast();
  const { paciente } = usePacientePortal();
  const pacienteId = paciente?.id;

  const { data: xpData } = usePacienteXP(pacienteId);
  const { catalogo, meusResgates, isLoading, resgatar, resgatando } = useRecompensasPaciente(pacienteId);

  const xp = xpData?.xp_total ?? 0;
  const nivel = xpData?.nivel_atual ?? 'bronze';
  const { proximo, faltam } = proximoNivel(xp);
  const nivelIdx = NIVEIS_ORDEM.indexOf(nivel);
  const pct = proximo
    ? Math.min(100, Math.max(0, ((xp - NIVEL_LIMITES[nivel]) / (NIVEL_LIMITES[proximo] - NIVEL_LIMITES[nivel])) * 100))
    : 100;
  const RING = 2 * Math.PI * 44; // circunferência do anel de progresso

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
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6 pb-4">
          <div>
            <h1 className="h-page">Recompensas</h1>
            <p className="text-caption mt-1">Troque seu XP por benefícios reais</p>
          </div>

          {/* Hero de nível — anel de progresso dourado */}
          <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-primary to-primary-dark text-white shadow-md">
            <span className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-[hsl(42,80%,60%)]/25 blur-2xl" aria-hidden />
            <div className="relative flex items-center gap-4">
              <div className="relative h-[76px] w-[76px] shrink-0">
                <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="8" />
                  <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(42 85% 65%)" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={RING} strokeDashoffset={RING * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset .6s ease' }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Trophy className="h-8 w-8 text-[hsl(42,85%,70%)]" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium uppercase tracking-wider text-white/70">Seu nível</div>
                <div className="font-display text-2xl leading-tight text-white">{NIVEL_LABEL[nivel]}</div>
                <div className="text-sm font-semibold text-[hsl(42,85%,72%)] mt-0.5">{xp} XP</div>
                {proximo && (
                  <div className="text-[11px] text-white/70 mt-0.5">Faltam <strong className="text-white">{faltam} XP</strong> para {NIVEL_LABEL[proximo]}</div>
                )}
              </div>
            </div>

            {/* Trilha de níveis */}
            <div className="relative mt-4 flex justify-between">
              {NIVEIS_ORDEM.map((n, i) => (
                <div key={n} className="flex flex-col items-center gap-1">
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-colors',
                    i <= nivelIdx ? 'border-[hsl(42,85%,65%)] bg-[hsl(42,85%,65%)] text-primary' : 'border-white/30 text-white/50',
                  )}>
                    {i <= nivelIdx ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
                  </div>
                  <span className={cn('text-[10px]', i <= nivelIdx ? 'text-white/90' : 'text-white/50')}>{NIVEL_LABEL[n]}</span>
                </div>
              ))}
            </div>
          </div>

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
