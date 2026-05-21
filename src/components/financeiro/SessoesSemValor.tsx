import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useConvenios } from '@/hooks/useConvenios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Props { mesOffset: number }

interface SessaoRaw {
  id: string;
  data_sessao: string;
  valor_cobrado: number | null;
  convenio_id: string | null;
  pacientes: { nome: string; sobrenome: string; tipo_pagamento: string | null } | null;
}

export default function SessoesSemValor({ mesOffset }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { convenios } = useConvenios();
  const [edits, setEdits] = useState<Record<string, { valor?: string; convenio_id?: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const { inicio, fim, label } = useMemo(() => {
    const ref = subMonths(new Date(), mesOffset);
    return {
      inicio: startOfMonth(ref).toISOString(),
      fim: endOfMonth(ref).toISOString(),
      label: format(ref, "MMMM 'de' yyyy", { locale: ptBR }),
    };
  }, [mesOffset]);

  const { data: sessoes = [], isLoading } = useQuery({
    queryKey: ['sessoes-sem-valor', user?.id, inicio, fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('controle_sessoes')
        .select('id, data_sessao, valor_cobrado, convenio_id, pacientes(nome, sobrenome, tipo_pagamento)')
        .eq('terapeuta_id', user!.id)
        .eq('status', 'realizada')
        .gte('data_sessao', inicio)
        .lte('data_sessao', fim)
        .or('valor_cobrado.is.null,valor_cobrado.eq.0')
        .order('data_sessao', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as SessaoRaw[];
    },
    enabled: !!user,
  });

  const setField = (id: string, patch: Partial<{ valor: string; convenio_id: string }>) => {
    setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));
  };

  const pickConvenio = (id: string, convenioId: string) => {
    const conv = convenios.find((c) => c.id === convenioId);
    const valorAtual = edits[id]?.valor;
    setField(id, {
      convenio_id: convenioId,
      // auto-preenche valor padrão se ainda não digitou
      valor: valorAtual || (conv?.valor_padrao != null ? String(conv.valor_padrao) : ''),
    });
  };

  const handleSave = async (id: string) => {
    const edit = edits[id] || {};
    const raw = edit.valor?.replace(',', '.');
    const valor = parseFloat(raw || '');
    if (isNaN(valor) || valor <= 0) {
      toast.error('Digite um valor válido');
      return;
    }
    setSaving(id);
    const payload: any = { valor_cobrado: valor };
    if (edit.convenio_id !== undefined) {
      payload.convenio_id = edit.convenio_id || null;
      payload.tipo_cliente = edit.convenio_id ? 'plano' : 'particular';
    }
    const { error } = await supabase.from('controle_sessoes').update(payload).eq('id', id);
    setSaving(null);
    if (error) {
      toast.error('Erro ao salvar', { description: error.message });
      return;
    }
    toast.success('Valor salvo');
    setEdits((e) => { const n = { ...e }; delete n[id]; return n; });
    qc.invalidateQueries({ queryKey: ['sessoes-sem-valor'] });
    qc.invalidateQueries({ queryKey: ['controle-mensal'] });
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/40 shadow-xs p-4 flex justify-center">
        <Loader2 className="icon-md animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!sessoes.length) return null;

  return (
    <div className="rounded-xl border border-amber-300/50 bg-amber-50/40 dark:bg-amber-950/10 shadow-xs p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <AlertCircle className="icon-sm text-amber-600 dark:text-amber-400 shrink-0" />
        <h3 className="h-card text-amber-900 dark:text-amber-200">
          {sessoes.length} sessão(ões) sem valor em {label}
        </h3>
      </div>
      <p className="text-caption text-amber-800/80 dark:text-amber-300/80 mb-3">
        Escolha o convênio (ou Particular) para preencher o valor automaticamente, ou digite manualmente.
      </p>
      <div className="space-y-2 max-h-[60dvh] overflow-y-auto pr-1">
        {sessoes.map((s) => {
          const nome = `${s.pacientes?.nome || ''} ${s.pacientes?.sobrenome || ''}`.trim() || 'Sem nome';
          const tipo = s.pacientes?.tipo_pagamento || 'particular';
          const edit = edits[s.id] || {};
          const convSel = edit.convenio_id ?? s.convenio_id ?? '';
          return (
            <div key={s.id} className="rounded-lg border border-border/40 bg-card p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{nome}</p>
                  <p className="text-micro text-muted-foreground truncate">
                    {format(new Date(s.data_sessao), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    tipo === 'plano'
                      ? 'text-[10px] h-5 border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                      : 'text-[10px] h-5 border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300'
                  }
                >
                  {tipo === 'plano' ? 'Plano' : 'Particular'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={convSel || 'particular'}
                  onValueChange={(v) => pickConvenio(s.id, v === 'particular' ? '' : v)}
                >
                  <SelectTrigger className="h-9 flex-1 text-xs">
                    <SelectValue placeholder="Convênio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="particular">Particular</SelectItem>
                    {convenios.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}{c.valor_padrao != null ? ` — R$ ${Number(c.valor_padrao).toFixed(2)}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0,00"
                    value={edit.valor ?? ''}
                    onChange={(e) => setField(s.id, { valor: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave(s.id)}
                    className="h-9 w-24 text-sm"
                  />
                  <Button
                    size="sm"
                    className="h-9 w-9 p-0"
                    disabled={!edit.valor || saving === s.id}
                    onClick={() => handleSave(s.id)}
                  >
                    {saving === s.id ? <Loader2 className="icon-xs animate-spin" /> : <Check className="icon-xs" />}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
