import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, ChevronDown, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { EXAMES_PRESENCIAIS, tipoExame, resumoExame } from '@/lib/examesPresenciais';

// Exames presenciais (bioimpedância, teste de pisada, …) registrados pelo
// profissional. Genérico: os campos vêm de src/lib/examesPresenciais.ts. O
// resultado alimenta os motores de IA (treino/nutrição/saúde).
export default function ExamesPresenciaisCard({ pacienteId }: { pacienteId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [tipoSel, setTipoSel] = useState<string>('');
  const [dados, setDados] = useState<Record<string, string>>({});
  const [dataExame, setDataExame] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const { data: exames = [], isLoading } = useQuery({
    queryKey: ['exames-presenciais', pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any).from('exames_presenciais')
        .select('id, tipo, data_exame, dados, resumo, created_at')
        .eq('paciente_id', pacienteId)
        .order('data_exame', { ascending: false });
      return (data || []) as any[];
    },
  });

  const tipoAtual = tipoSel ? tipoExame(tipoSel) : undefined;

  const salvar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sem sessão');
      if (!tipoAtual) throw new Error('Escolha o tipo de exame');
      // Converte números; guarda strings dos selects/textos como estão.
      const dadosLimpos: Record<string, unknown> = {};
      for (const c of tipoAtual.campos) {
        const raw = (dados[c.key] ?? '').trim();
        if (raw === '') continue;
        dadosLimpos[c.key] = c.tipo === 'number' ? Number(raw.replace(',', '.')) : raw;
      }
      if (Object.keys(dadosLimpos).length === 0) throw new Error('Preencha ao menos um campo');
      const { error } = await (supabase as any).from('exames_presenciais').insert({
        paciente_id: pacienteId,
        terapeuta_id: user.id,
        tipo: tipoAtual.id,
        data_exame: dataExame,
        dados: dadosLimpos,
        resumo: resumoExame(tipoAtual.id, dadosLimpos),
        visivel_paciente: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Exame registrado — já entra na IA dos planos');
      setTipoSel(''); setDados({});
      setDataExame(new Date().toISOString().slice(0, 10));
      qc.invalidateQueries({ queryKey: ['exames-presenciais', pacienteId] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao registrar'),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('exames_presenciais').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Exame removido'); qc.invalidateQueries({ queryKey: ['exames-presenciais', pacienteId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  // Agrupa por tipo para leitura clara.
  const porTipo = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const e of exames as any[]) { const arr = m.get(e.tipo) || []; arr.push(e); m.set(e.tipo, arr); }
    return [...m.entries()];
  }, [exames]);

  return (
    <Card className="border-border/40 shadow-xs">
      <CardHeader className="pb-3">
        <button
          type="button"
          onClick={() => setAberto(a => !a)}
          className="flex items-center gap-2 w-full text-left"
          title={aberto ? 'Fechar' : 'Abrir exames presenciais'}
        >
          <Activity className="icon-sm text-teal-600 shrink-0" />
          <span className="text-base font-semibold truncate">Exames presenciais</span>
          {exames.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-teal-100 text-teal-700 text-[11px] font-bold shrink-0">
              {exames.length}
            </span>
          )}
          <ChevronDown className={cn('icon-sm text-muted-foreground shrink-0 ml-auto transition-transform', aberto && 'rotate-180')} />
        </button>
        {!aberto && (
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Bioimpedância, teste de pisada e outros exames feitos na clínica — entram nos planos de IA.
            {exames.length > 0 ? ` Toque para ver ${exames.length}.` : ' Toque para registrar.'}
          </p>
        )}
      </CardHeader>

      {aberto && (
        <CardContent className="space-y-4 pt-0">
          {/* Registro de novo exame */}
          <div className="rounded-lg border border-border/50 p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de exame</Label>
                <Select value={tipoSel} onValueChange={(v) => { setTipoSel(v); setDados({}); }}>
                  <SelectTrigger><SelectValue placeholder="Escolha o exame" /></SelectTrigger>
                  <SelectContent>
                    {EXAMES_PRESENCIAIS.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data</Label>
                <Input type="date" value={dataExame} onChange={e => setDataExame(e.target.value)} />
              </div>
            </div>

            {tipoAtual && (
              <>
                <p className="text-[11px] text-muted-foreground -mt-1">{tipoAtual.descricao}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {tipoAtual.campos.map(c => (
                    <div key={c.key} className="space-y-1">
                      <Label className="text-xs">{c.label}{c.unidade ? ` (${c.unidade})` : ''}</Label>
                      {c.tipo === 'select' ? (
                        <Select value={dados[c.key] || ''} onValueChange={(v) => setDados(d => ({ ...d, [c.key]: v }))}>
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {(c.opcoes || []).map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          inputMode={c.tipo === 'number' ? 'decimal' : 'text'}
                          placeholder={c.placeholder}
                          value={dados[c.key] || ''}
                          onChange={e => setDados(d => ({ ...d, [c.key]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <Button className="w-full gap-1" disabled={salvar.isPending} onClick={() => salvar.mutate()}>
                  {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="icon-sm" /> Registrar exame</>}
                </Button>
              </>
            )}
          </div>

          {/* Histórico */}
          {isLoading ? (
            <div className="flex justify-center py-3"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : exames.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhum exame presencial registrado.</p>
          ) : (
            <div className="space-y-3">
              {porTipo.map(([tipo, lista]) => (
                <div key={tipo} className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-teal-700">
                    {tipoExame(tipo)?.nome || tipo}
                  </span>
                  <ul className="pl-1">
                    {lista.map((e: any) => (
                      <li key={e.id} className="group flex items-start gap-2 py-1 border-b border-border/30 last:border-0">
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] text-foreground">{e.resumo || resumoExame(e.tipo, e.dados || {})}</p>
                          <p className="text-[10px] text-muted-foreground">{format(parseISO(e.data_exame), 'dd/MM/yyyy')}</p>
                        </div>
                        <button
                          onClick={() => remover.mutate(e.id)}
                          className="h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                          title="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
