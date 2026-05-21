import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEquipe } from '@/hooks/useEquipe';
import { useRepasseConfig } from '@/hooks/useRepasseConfig';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, FileText, Loader2, Download, DollarSign, Percent } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { gerarReciboProfissional } from '@/utils/pdfReciboProfissional';

const FALLBACK_PCT = 0.4;

export default function FechamentoProfissional() {
  const { user } = useAuth();
  const { membros: equipe } = useEquipe();
  const { getRepasse } = useRepasseConfig();
  const [mesOffset, setMesOffset] = useState(0);
  const [profissionalId, setProfissionalId] = useState<string>('');

  const { inicio, fim, label } = useMemo(() => {
    const ref = subMonths(new Date(), mesOffset);
    return {
      inicio: startOfMonth(ref).toISOString(),
      fim: endOfMonth(ref).toISOString(),
      label: format(ref, "MMMM 'de' yyyy", { locale: ptBR }),
    };
  }, [mesOffset]);

  // Seleção automática do primeiro profissional ativo
  const ativos = equipe.filter((m: any) => m.ativo);
  const profSelecionado = profissionalId || ativos[0]?.id || '';

  const { data: sessoes = [], isLoading } = useQuery({
    queryKey: ['fechamento-prof', user?.id, profSelecionado, inicio, fim],
    enabled: !!user && !!profSelecionado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('controle_sessoes')
        .select(`
          id, data_sessao, status, valor_cobrado, convenio_id,
          pacientes(id, nome, sobrenome, tipo_pagamento, plano_saude),
          convenios:convenio_id(id, nome),
          agendamentos!agendamento_id(membro_equipe_id)
        `)
        .eq('terapeuta_id', user!.id)
        .eq('status', 'realizada')
        .gte('data_sessao', inicio)
        .lte('data_sessao', fim)
        .order('data_sessao', { ascending: true });
      if (error) throw error;
      return (data || []).filter(
        (s: any) => s.agendamentos?.membro_equipe_id === profSelecionado,
      );
    },
  });

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  const tipo = (s: any): 'particular' | 'plano' =>
    s.convenio_id ? 'plano' : s.pacientes?.tipo_pagamento === 'plano' ? 'plano' : 'particular';
  const convNome = (s: any) => s.convenios?.nome || s.pacientes?.plano_saude || '';

  const linhas = useMemo(() => {
    return sessoes.map((s: any) => {
      const valor = Number(s.valor_cobrado) || 0;
      const cfg = getRepasse(profSelecionado, s.convenio_id || null);
      let percentual = FALLBACK_PCT * 100;
      let repasse = valor * FALLBACK_PCT;
      if (cfg) {
        if (cfg.valor_fixo != null) {
          repasse = Number(cfg.valor_fixo);
          percentual = valor > 0 ? (repasse / valor) * 100 : 0;
        } else {
          percentual = Number(cfg.percentual);
          repasse = valor * (percentual / 100);
        }
      }
      return {
        id: s.id,
        data: new Date(s.data_sessao),
        paciente: `${s.pacientes?.nome || ''} ${s.pacientes?.sobrenome || ''}`.trim() || '—',
        tipo: tipo(s),
        convenio: convNome(s),
        valorBruto: valor,
        percentual,
        repasse,
        custom: !!cfg,
      };
    });
  }, [sessoes, profSelecionado, getRepasse]);

  const totais = useMemo(() => {
    const t = { bruto: 0, repasse: 0, particular: 0, plano: 0, repPart: 0, repPlano: 0 };
    linhas.forEach((l) => {
      t.bruto += l.valorBruto;
      t.repasse += l.repasse;
      if (l.tipo === 'plano') {
        t.plano += l.valorBruto;
        t.repPlano += l.repasse;
      } else {
        t.particular += l.valorBruto;
        t.repPart += l.repasse;
      }
    });
    return t;
  }, [linhas]);

  const profissionalNome =
    equipe.find((m: any) => m.id === profSelecionado)?.nome || 'Profissional';

  const handlePdf = () => {
    gerarReciboProfissional({
      profissional: profissionalNome,
      periodo: label,
      linhas: linhas.map((l) => ({
        data: format(l.data, 'dd/MM HH:mm'),
        paciente: l.paciente,
        tipo: l.tipo,
        convenio: l.convenio,
        valorBruto: l.valorBruto,
        percentual: l.percentual,
        repasse: l.repasse,
      })),
      totalBruto: totais.bruto,
      totalRepasse: totais.repasse,
      totalParticular: totais.particular,
      totalPlano: totais.plano,
      repasseParticular: totais.repPart,
      repassePlano: totais.repPlano,
    });
  };

  return (
    <div className="clinical-card">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="icon-sm text-primary shrink-0" />
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Fechamento por Profissional
          </h2>
        </div>
        <Button
          size="sm"
          onClick={handlePdf}
          disabled={!linhas.length}
          className="h-8 gap-1.5"
        >
          <Download className="icon-xs" /> Recibo PDF
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Selecione o profissional e o mês para gerar o recibo individual de repasse.
        Cada sessão usa o percentual configurado em <strong>Repasses</strong> (ou 40% como fallback).
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
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

        <Select value={profSelecionado} onValueChange={setProfissionalId}>
          <SelectTrigger className="h-9 text-xs">
            <Users className="icon-xs mr-1.5 shrink-0" />
            <SelectValue placeholder="Selecione um profissional" />
          </SelectTrigger>
          <SelectContent>
            {ativos.map((m: any) => (
              <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!profSelecionado ? (
        <div className="text-center py-10 text-muted-foreground text-xs">
          Nenhum profissional cadastrado. Vá em <strong>Equipe</strong> para adicionar membros.
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="icon-md animate-spin text-muted-foreground" />
        </div>
      ) : linhas.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-xs">
          Nenhum atendimento realizado por <strong>{profissionalNome}</strong> em <strong>{label}</strong>.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="text-[10px] uppercase font-bold text-muted-foreground">Sessões</p>
              <p className="text-xl font-black mt-0.5">{linhas.length}</p>
            </div>
            <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/20 p-3">
              <p className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                <DollarSign className="icon-xs" /> Bruto
              </p>
              <p className="text-base font-black text-blue-700 dark:text-blue-400 mt-0.5">{fmt(totais.bruto)}</p>
              <p className="text-[10px] text-blue-700/60 dark:text-blue-400/60">
                P {fmt(totais.particular)} · C {fmt(totais.plano)}
              </p>
            </div>
            <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 p-3">
              <p className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <Percent className="icon-xs" /> A receber
              </p>
              <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-0.5">{fmt(totais.repasse)}</p>
              <p className="text-[10px] text-emerald-700/60 dark:text-emerald-400/60">
                {totais.bruto > 0 ? ((totais.repasse / totais.bruto) * 100).toFixed(1) : 0}% médio
              </p>
            </div>
            <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 p-3">
              <p className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-400">Líquido clínica</p>
              <p className="text-base font-black text-amber-800 dark:text-amber-400 mt-0.5">
                {fmt(totais.bruto - totais.repasse)}
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="grid grid-cols-12 text-[10px] uppercase font-bold text-muted-foreground bg-muted/40 px-3 py-2">
              <div className="col-span-2">Data</div>
              <div className="col-span-4">Paciente</div>
              <div className="col-span-3">Origem</div>
              <div className="col-span-1 text-right">%</div>
              <div className="col-span-2 text-right">Repasse</div>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y">
              {linhas.map((l) => (
                <div key={l.id} className="grid grid-cols-12 px-3 py-2 text-xs items-center">
                  <div className="col-span-2 text-muted-foreground">{format(l.data, 'dd/MM')}</div>
                  <div className="col-span-4 truncate font-medium">{l.paciente}</div>
                  <div className="col-span-3 flex items-center gap-1 min-w-0">
                    {l.tipo === 'plano' ? (
                      <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300">
                        {l.convenio || 'Plano'}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] h-4 px-1 border-blue-300 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
                        Particular
                      </Badge>
                    )}
                    {!l.custom && (
                      <span className="text-[9px] text-muted-foreground" title="Usando fallback 40%">·fb</span>
                    )}
                  </div>
                  <div className="col-span-1 text-right text-muted-foreground">{l.percentual.toFixed(0)}%</div>
                  <div className="col-span-2 text-right font-bold text-emerald-700 dark:text-emerald-400">
                    {fmt(l.repasse)}
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-12 px-3 py-2 text-xs bg-emerald-50 dark:bg-emerald-950/20 border-t font-bold">
              <div className="col-span-9">Total a pagar para {profissionalNome}</div>
              <div className="col-span-3 text-right text-emerald-700 dark:text-emerald-400">{fmt(totais.repasse)}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
