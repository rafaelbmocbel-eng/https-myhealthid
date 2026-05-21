import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEquipe } from '@/hooks/useEquipe';
import { useRepasseConfig } from '@/hooks/useRepasseConfig';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, BarChart3, Loader2, PieChart as PieIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];
const FALLBACK_PCT = 0.4;

export default function BreakdownVisual() {
  const { user } = useAuth();
  const { membros: equipe } = useEquipe();
  const { getRepasse } = useRepasseConfig();
  const [mesOffset, setMesOffset] = useState(0);

  const { inicio, fim, label } = useMemo(() => {
    const ref = subMonths(new Date(), mesOffset);
    return {
      inicio: startOfMonth(ref).toISOString(),
      fim: endOfMonth(ref).toISOString(),
      label: format(ref, "MMMM 'de' yyyy", { locale: ptBR }),
    };
  }, [mesOffset]);

  const { data: sessoes = [], isLoading } = useQuery({
    queryKey: ['breakdown-financeiro', user?.id, inicio, fim],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('controle_sessoes')
        .select(`
          id, data_sessao, valor_cobrado, convenio_id,
          pacientes(tipo_pagamento, plano_saude),
          convenios:convenio_id(id, nome),
          agendamentos!agendamento_id(membro_equipe_id)
        `)
        .eq('terapeuta_id', user!.id)
        .eq('status', 'realizada')
        .gte('data_sessao', inicio)
        .lte('data_sessao', fim);
      if (error) throw error;
      return data || [];
    },
  });

  const fmt = (v: number) => `R$ ${v.toFixed(0)}`;

  const repasseOf = (s: any) => {
    const valor = Number(s.valor_cobrado) || 0;
    const membroId = s.agendamentos?.membro_equipe_id;
    if (!membroId) return valor * FALLBACK_PCT;
    const cfg = getRepasse(membroId, s.convenio_id || null);
    if (!cfg) return valor * FALLBACK_PCT;
    if (cfg.valor_fixo != null) return Number(cfg.valor_fixo);
    return valor * (Number(cfg.percentual) / 100);
  };

  // Por convênio (inclui Particular)
  const porConvenio = useMemo(() => {
    const map = new Map<string, { nome: string; valor: number; sessoes: number }>();
    sessoes.forEach((s: any) => {
      const isPlano = !!s.convenio_id || s.pacientes?.tipo_pagamento === 'plano';
      const nome = isPlano
        ? (s.convenios?.nome || s.pacientes?.plano_saude || 'Plano (sem nome)')
        : 'Particular';
      const valor = Number(s.valor_cobrado) || 0;
      if (!map.has(nome)) map.set(nome, { nome, valor: 0, sessoes: 0 });
      const it = map.get(nome)!;
      it.valor += valor;
      it.sessoes += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
  }, [sessoes]);

  // Por profissional: bruto vs repasse vs líquido
  const porProfissional = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; bruto: number; repasse: number; liquido: number; sessoes: number }>();
    sessoes.forEach((s: any) => {
      const membroId = s.agendamentos?.membro_equipe_id || 'sem';
      const m = equipe.find((e: any) => e.id === membroId);
      const nome = m?.nome || 'Sem profissional';
      const valor = Number(s.valor_cobrado) || 0;
      const rep = repasseOf(s);
      if (!map.has(membroId)) map.set(membroId, { id: membroId, nome, bruto: 0, repasse: 0, liquido: 0, sessoes: 0 });
      const it = map.get(membroId)!;
      it.bruto += valor;
      it.repasse += rep;
      it.liquido += valor - rep;
      it.sessoes += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.bruto - a.bruto);
  }, [sessoes, equipe, getRepasse]);

  const totalGeral = porConvenio.reduce((a, c) => a + c.valor, 0);

  return (
    <div className="clinical-card">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <BarChart3 className="icon-sm text-primary shrink-0" />
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Análise Visual
          </h2>
        </div>
        <Select value={String(mesOffset)} onValueChange={(v) => setMesOffset(Number(v))}>
          <SelectTrigger className="h-8 text-xs w-44">
            <Calendar className="icon-xs mr-1.5 shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[0, 1, 2, 3, 4, 5].map((m) => {
              const ref = subMonths(new Date(), m);
              return (
                <SelectItem key={m} value={String(m)}>
                  {format(ref, "MMMM 'de' yyyy", { locale: ptBR })}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="icon-md animate-spin text-muted-foreground" />
        </div>
      ) : sessoes.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-xs">
          Nenhum atendimento realizado em <strong>{label}</strong>.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pizza por convênio */}
          <div className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2 mb-2">
              <PieIcon className="icon-xs text-primary" />
              <p className="text-[11px] uppercase font-bold tracking-wide">Receita por origem</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={porConvenio}
                    dataKey="valor"
                    nameKey="nome"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {porConvenio.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => fmt(v)}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-[10px] text-muted-foreground text-center mt-1">
              Total bruto: <strong className="text-foreground">{fmt(totalGeral)}</strong>
            </div>
          </div>

          {/* Barras por profissional */}
          <div className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="icon-xs text-primary" />
              <p className="text-[11px] uppercase font-bold tracking-wide">Bruto · Repasse · Líquido</p>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porProfissional} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `R$${Math.round(v)}`} />
                  <Tooltip
                    formatter={(v: number, k: string) => [fmt(v), k]}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="bruto" name="Bruto" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="repasse" name="Repasse" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="liquido" name="Líquido clínica" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabela resumo por convênio */}
          <div className="rounded-xl border bg-card overflow-hidden lg:col-span-2">
            <div className="grid grid-cols-12 text-[10px] uppercase font-bold text-muted-foreground bg-muted/40 px-3 py-2">
              <div className="col-span-5">Origem</div>
              <div className="col-span-2 text-right">Sessões</div>
              <div className="col-span-2 text-right">Ticket médio</div>
              <div className="col-span-2 text-right">Receita</div>
              <div className="col-span-1 text-right">%</div>
            </div>
            <div className="divide-y">
              {porConvenio.map((c, i) => (
                <div key={c.nome} className="grid grid-cols-12 px-3 py-2 text-xs items-center">
                  <div className="col-span-5 flex items-center gap-2 min-w-0">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="truncate font-medium">{c.nome}</span>
                  </div>
                  <div className="col-span-2 text-right text-muted-foreground">{c.sessoes}</div>
                  <div className="col-span-2 text-right text-muted-foreground">{fmt(c.valor / c.sessoes)}</div>
                  <div className="col-span-2 text-right font-bold">{fmt(c.valor)}</div>
                  <div className="col-span-1 text-right text-muted-foreground">
                    {totalGeral > 0 ? ((c.valor / totalGeral) * 100).toFixed(0) : 0}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
