import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEquipe } from '@/hooks/useEquipe';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, DollarSign, Percent, Download, Loader2, FileText } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { exportToCsv } from '@/utils/exportCsv';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

const REPASSE_STORAGE_KEY = 'controle-mensal-repasse-pct';

type Filtro = 'todos' | 'particular' | 'plano';

export default function ControleMensal() {
  const { user } = useAuth();
  const { membros: equipe } = useEquipe();
  const [mesOffset, setMesOffset] = useState(0); // 0 = mês atual, 1 = mês passado...
  const [profissionalId, setProfissionalId] = useState<string>('todos');
  const [tipoFiltro, setTipoFiltro] = useState<Filtro>('todos');
  const [repassePctInput, setRepassePctInput] = useState<string>(() => {
    if (typeof window === 'undefined') return '40';
    return localStorage.getItem(REPASSE_STORAGE_KEY) || '40';
  });
  const REPASSE_PCT = useMemo(() => {
    const n = parseFloat(repassePctInput.replace(',', '.'));
    if (isNaN(n) || n < 0) return 0;
    if (n > 100) return 1;
    return n / 100;
  }, [repassePctInput]);
  const repasseLabel = `${(REPASSE_PCT * 100).toFixed(REPASSE_PCT * 100 % 1 === 0 ? 0 : 1)}%`;

  const handleRepasseChange = (v: string) => {
    setRepassePctInput(v);
    if (typeof window !== 'undefined') localStorage.setItem(REPASSE_STORAGE_KEY, v);
  };

  const { inicio, fim, label } = useMemo(() => {
    const ref = subMonths(new Date(), mesOffset);
    return {
      inicio: startOfMonth(ref).toISOString(),
      fim: endOfMonth(ref).toISOString(),
      label: format(ref, "MMMM 'de' yyyy", { locale: ptBR }),
    };
  }, [mesOffset]);

  const { data: sessoes = [], isLoading } = useQuery({
    queryKey: ['controle-mensal', user?.id, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('controle_sessoes')
        .select(`
          id, data_sessao, status, valor_cobrado, tipo_atendimento,
          paciente_id,
          agendamento_id,
          pacientes(id, nome, sobrenome, tipo_pagamento, plano_saude),
          agendamentos!agendamento_id(membro_equipe_id)
        `)
        .eq('terapeuta_id', user!.id)
        .gte('data_sessao', inicio)
        .lte('data_sessao', fim)
        .eq('status', 'realizada')
        .order('data_sessao', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Filtros aplicados
  const filtradas = useMemo(() => {
    return sessoes.filter((s: any) => {
      const tipo = s.pacientes?.tipo_pagamento || 'particular';
      const membroId = s.agendamentos?.membro_equipe_id || null;
      if (tipoFiltro !== 'todos' && tipo !== tipoFiltro) return false;
      if (profissionalId !== 'todos') {
        if (profissionalId === 'sem-membro' && membroId) return false;
        if (profissionalId !== 'sem-membro' && membroId !== profissionalId) return false;
      }
      return true;
    });
  }, [sessoes, tipoFiltro, profissionalId]);

  // Agregação por profissional
  const porProfissional = useMemo(() => {
    const map = new Map<string, {
      id: string | null;
      nome: string;
      cor: string;
      sessoes: number;
      totalParticular: number;
      totalPlano: number;
      total: number;
      detalhe: any[];
    }>();

    filtradas.forEach((s: any) => {
      const membroId = s.agendamentos?.membro_equipe_id || null;
      const membro = membroId ? equipe.find((m: any) => m.id === membroId) : null;
      const key = membroId || 'sem-membro';
      const nome = membro?.nome || 'Sem profissional atribuído';
      const cor = membro?.cor || '#94a3b8';
      const valor = Number(s.valor_cobrado) || 0;
      const tipo = s.pacientes?.tipo_pagamento || 'particular';

      if (!map.has(key)) {
        map.set(key, { id: membroId, nome, cor, sessoes: 0, totalParticular: 0, totalPlano: 0, total: 0, detalhe: [] });
      }
      const item = map.get(key)!;
      item.sessoes += 1;
      item.total += valor;
      if (tipo === 'plano') item.totalPlano += valor;
      else item.totalParticular += valor;
      item.detalhe.push(s);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtradas, equipe]);

  const totais = useMemo(() => {
    const total = filtradas.reduce((acc: number, s: any) => acc + (Number(s.valor_cobrado) || 0), 0);
    const totalPlano = filtradas
      .filter((s: any) => (s.pacientes?.tipo_pagamento || 'particular') === 'plano')
      .reduce((acc: number, s: any) => acc + (Number(s.valor_cobrado) || 0), 0);
    const totalParticular = total - totalPlano;
    return {
      sessoes: filtradas.length,
      total,
      totalPlano,
      totalParticular,
      repasse: total * REPASSE_PCT,
    };
  }, [filtradas]);

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  const handleExport = () => {
    const rows = filtradas.map((s: any) => {
      const membroId = s.agendamentos?.membro_equipe_id;
      const membro = membroId ? equipe.find((m: any) => m.id === membroId) : null;
      const tipo = s.pacientes?.tipo_pagamento || 'particular';
      const valor = Number(s.valor_cobrado) || 0;
      return {
        data: format(new Date(s.data_sessao), 'dd/MM/yyyy HH:mm'),
        paciente: `${s.pacientes?.nome || ''} ${s.pacientes?.sobrenome || ''}`.trim(),
        profissional: membro?.nome || 'Sem profissional',
        tipo: tipo === 'plano' ? 'Plano' : 'Particular',
        plano: s.pacientes?.plano_saude || '-',
        valor_total: valor.toFixed(2),
        repasse_40: (valor * REPASSE_PCT).toFixed(2),
      };
    });
    exportToCsv(`controle_mensal_${format(new Date(), 'yyyy-MM')}.csv`, rows, [
      { key: 'data', label: 'Data' },
      { key: 'paciente', label: 'Paciente' },
      { key: 'profissional', label: 'Profissional' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'plano', label: 'Plano' },
      { key: 'valor_total', label: 'Valor Total (R$)' },
      { key: 'repasse_40', label: 'Repasse 40% (R$)' },
    ]);
  };

  return (
    <div className="clinical-card mb-6">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="icon-sm text-primary shrink-0" />
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Controle Mensal</h2>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={!filtradas.length} className="h-8 gap-1.5">
          <Download className="icon-xs" /> CSV
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Atendimentos realizados por profissional, com cálculo de repasse de <strong>40%</strong> sobre o valor total.
      </p>

      {/* Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        <Select value={String(mesOffset)} onValueChange={(v) => setMesOffset(Number(v))}>
          <SelectTrigger className="h-9 text-xs">
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

        <Select value={profissionalId} onValueChange={setProfissionalId}>
          <SelectTrigger className="h-9 text-xs">
            <Users className="icon-xs mr-1.5 shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos profissionais</SelectItem>
            <SelectItem value="sem-membro">Sem profissional</SelectItem>
            {equipe.filter((m: any) => m.ativo).map((m: any) => (
              <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as Filtro)}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Particular + Plano</SelectItem>
            <SelectItem value="particular">Apenas Particular</SelectItem>
            <SelectItem value="plano">Apenas Plano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="icon-md animate-spin text-muted-foreground" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-xs">
          Nenhuma sessão realizada em <strong>{label}</strong> com os filtros selecionados.
        </div>
      ) : (
        <>
          {/* KPIs do mês filtrado */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Sessões</p>
              <p className="text-xl font-black mt-0.5">{totais.sessoes}</p>
            </div>
            <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/20 p-3">
              <p className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <DollarSign className="icon-xs" /> Total
              </p>
              <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-0.5">{fmt(totais.total)}</p>
            </div>
            <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/20 p-3">
              <p className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400">Particular</p>
              <p className="text-base font-black text-blue-700 dark:text-blue-400 mt-0.5">{fmt(totais.totalParticular)}</p>
              <p className="text-[10px] text-blue-700/60 dark:text-blue-400/60">Plano: {fmt(totais.totalPlano)}</p>
            </div>
            <div className="rounded-xl border-2 border-primary bg-primary/5 p-3">
              <p className="text-[10px] uppercase font-bold text-primary flex items-center gap-1">
                <Percent className="icon-xs" /> Repasse 40%
              </p>
              <p className="text-xl font-black text-primary mt-0.5">{fmt(totais.repasse)}</p>
            </div>
          </div>

          {/* Por profissional */}
          <div className="space-y-2">
            <p className="text-[11px] uppercase font-bold text-muted-foreground tracking-wide">
              Detalhamento por profissional
            </p>
            {porProfissional.map((prof) => (
              <div key={prof.id || 'sem'} className="rounded-xl border bg-card p-3">
                <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: prof.cor }}>
                      {prof.nome[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{prof.nome}</p>
                      <p className="text-[10px] text-muted-foreground">{prof.sessoes} {prof.sessoes === 1 ? 'atendimento' : 'atendimentos'}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black">{fmt(prof.total)}</p>
                    <p className="text-[10px] text-primary font-bold">↳ {fmt(prof.total * REPASSE_PCT)} (40%)</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {prof.totalParticular > 0 && (
                    <Badge variant="outline" className="text-[10px] h-5">Particular: {fmt(prof.totalParticular)}</Badge>
                  )}
                  {prof.totalPlano > 0 && (
                    <Badge variant="outline" className="text-[10px] h-5 border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
                      Plano: {fmt(prof.totalPlano)}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Lista detalhada */}
          <details className="mt-4 rounded-xl border bg-muted/20">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
              Ver lista completa de atendimentos ({filtradas.length})
            </summary>
            <div className="max-h-80 overflow-y-auto divide-y">
              {filtradas.map((s: any) => {
                const membroId = s.agendamentos?.membro_equipe_id;
                const membro = membroId ? equipe.find((m: any) => m.id === membroId) : null;
                const tipo = s.pacientes?.tipo_pagamento || 'particular';
                const valor = Number(s.valor_cobrado) || 0;
                return (
                  <div key={s.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{s.pacientes?.nome} {s.pacientes?.sobrenome}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {format(new Date(s.data_sessao), "dd/MM 'às' HH:mm", { locale: ptBR })} · {membro?.nome || 'Sem prof.'}
                        {tipo === 'plano' && s.pacientes?.plano_saude ? ` · ${s.pacientes.plano_saude}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[9px] h-5',
                          tipo === 'plano'
                            ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300'
                            : 'border-blue-300 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300'
                        )}
                      >
                        {tipo === 'plano' ? 'Plano' : 'Particular'}
                      </Badge>
                      <span className="font-bold tabular-nums">{fmt(valor)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        </>
      )}
    </div>
  );
}
