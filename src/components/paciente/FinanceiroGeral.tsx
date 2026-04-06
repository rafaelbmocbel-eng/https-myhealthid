import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Clock, CheckCircle, AlertTriangle, Users, MessageCircle } from 'lucide-react';
import { format, startOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export default function FinanceiroGeral() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: sessoes = [] } = useQuery({
    queryKey: ['financeiro-sessoes', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('controle_sessoes')
        .select('*, pacientes(id, nome, sobrenome, telefone)')
        .eq('terapeuta_id', user!.id)
        .order('data_sessao', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: pagamentos = [] } = useQuery({
    queryKey: ['financeiro-pagamentos', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('pagamentos_paciente')
        .select('*, pacientes(id, nome, sobrenome)')
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const metrics = useMemo(() => {
    const now = new Date();
    const mesAtual = startOfMonth(now);

    const sessoesMes = sessoes.filter((s: any) => new Date(s.data_sessao) >= mesAtual && s.status === 'realizada');
    const receitaSessoesMes = sessoesMes.reduce((acc: number, s: any) => acc + (Number(s.valor_cobrado) || 0), 0);

    const pagConfirmados = pagamentos.filter((p: any) => p.status === 'confirmado');
    const pagPendentes = pagamentos.filter((p: any) => p.status === 'pendente');
    const pagConfirmadosMes = pagConfirmados.filter((p: any) => new Date(p.created_at) >= mesAtual);
    const pagPendentesMes = pagPendentes.filter((p: any) => new Date(p.created_at) >= mesAtual);

    const totalConfirmadoMes = pagConfirmadosMes.reduce((acc: number, p: any) => acc + (Number(p.valor) || 0), 0);
    const totalPendenteMes = pagPendentesMes.reduce((acc: number, p: any) => acc + (Number(p.valor) || 0), 0);

    const receitaTotalMes = receitaSessoesMes + totalConfirmadoMes;

    // Sessões sem pagamento
    const sessoesSemPagamento = sessoes.filter(
      (s: any) => s.status === 'realizada' && (!s.valor_cobrado || Number(s.valor_cobrado) === 0)
    );

    return {
      receitaTotalMes,
      receitaSessoesMes,
      totalConfirmadoMes,
      totalPendenteMes,
      sessoesMesCount: sessoesMes.length,
      pagPendentesCount: pagPendentes.length,
      sessoesSemPagamento,
    };
  }, [sessoes, pagamentos]);

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-none">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 opacity-80" />
              <span className="text-[10px] uppercase font-bold opacity-80">Receita do Mês</span>
            </div>
            <p className="text-2xl font-black">{fmt(metrics.receitaTotalMes)}</p>
            <p className="text-[10px] opacity-70">{metrics.sessoesMesCount} sessões realizadas</p>
          </CardContent>
        </Card>

        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Confirmado</span>
            </div>
            <p className="text-2xl font-black text-emerald-600">{fmt(metrics.totalConfirmadoMes)}</p>
            <p className="text-[10px] text-muted-foreground">Pagamentos confirmados no mês</p>
          </CardContent>
        </Card>

        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Pendente</span>
            </div>
            <p className="text-2xl font-black text-amber-600">{fmt(metrics.totalPendenteMes)}</p>
            <p className="text-[10px] text-muted-foreground">{metrics.pagPendentesCount} cobranças pendentes</p>
          </CardContent>
        </Card>

        <Card className="border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Sessões s/ Pgto</span>
            </div>
            <p className="text-2xl font-black text-red-500">{metrics.sessoesSemPagamento.length}</p>
            <p className="text-[10px] text-muted-foreground">Sessões realizadas sem valor</p>
          </CardContent>
        </Card>
      </div>

      {/* Sessões sem pagamento */}
      {metrics.sessoesSemPagamento.length > 0 && (
        <Card className="border border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Sessões sem Pagamento Registrado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {metrics.sessoesSemPagamento.slice(0, 20).map((s: any) => (
                <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg border bg-red-50/30 dark:bg-red-950/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {s.pacientes?.nome?.[0] || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{s.pacientes?.nome} {s.pacientes?.sobrenome}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(s.data_sessao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] shrink-0"
                    onClick={() => navigate(`/pacientes/${s.paciente_id}`)}
                  >
                    Ver perfil
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Últimos pagamentos */}
      <Card className="border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Últimos Pagamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pagamentos.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhum pagamento registrado ainda.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {pagamentos.slice(0, 30).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg border">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {p.pacientes?.nome?.[0] || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{p.pacientes?.nome} {p.pacientes?.sobrenome}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {p.descricao} · {format(new Date(p.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold">{fmt(Number(p.valor))}</span>
                    <Badge
                      variant={p.status === 'confirmado' ? 'default' : p.status === 'pendente' ? 'secondary' : 'destructive'}
                      className="text-[9px]"
                    >
                      {p.status === 'confirmado' ? '✓ Confirmado' : p.status === 'pendente' ? '⏳ Pendente' : '✕ Recusado'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
