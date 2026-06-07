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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Pill, FileText, Plus, Trash2, ChevronsUpDown, Check, Loader2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Props {
  pacienteId: string;
}

interface Medicamento {
  id: string;
  nome: string;
  apresentacao: string | null;
  posologia_sugerida: string | null;
  classe: string | null;
}

interface ReceitaItem {
  nome: string;
  apresentacao?: string;
  posologia: string;
  quantidade?: string;
}

export default function PrescricaoMedicaCard({ pacienteId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // ===== Receita =====
  const [itens, setItens] = useState<ReceitaItem[]>([]);
  const [orientacoes, setOrientacoes] = useState('');
  const [tipoReceita, setTipoReceita] = useState<'simples' | 'especial'>('simples');
  const [searchMed, setSearchMed] = useState('');
  const [medOpen, setMedOpen] = useState(false);

  // ===== Atestado =====
  const [dias, setDias] = useState(1);
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [cidAtestado, setCidAtestado] = useState('');
  const [motivo, setMotivo] = useState('');

  // ===== Histórico =====
  const { data: historicoReceitas = [] } = useQuery({
    queryKey: ['receitas', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('prescricoes_paciente')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('data_emissao', { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  const { data: historicoAtestados = [] } = useQuery({
    queryKey: ['atestados', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('atestados_medicos')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('data_inicio', { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  // ===== Autocomplete Medicamentos =====
  const { data: medResults = [], isFetching: medFetching } = useQuery({
    queryKey: ['med-search', searchMed],
    enabled: medOpen,
    queryFn: async () => {
      const term = searchMed.trim();
      let q = (supabase as any).from('medicamentos_catalogo').select('*').limit(30);
      if (term.length >= 2) q = q.ilike('nome', `%${term}%`);
      else q = q.order('nome');
      const { data } = await q;
      return (data || []) as Medicamento[];
    },
  });

  const addMedicamento = (m: Medicamento) => {
    setItens((prev) => [
      ...prev,
      { nome: m.nome, apresentacao: m.apresentacao || '', posologia: m.posologia_sugerida || '', quantidade: '' },
    ]);
    setMedOpen(false);
    setSearchMed('');
  };

  const updateItem = (i: number, patch: Partial<ReceitaItem>) =>
    setItens((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const removeItem = (i: number) => setItens((prev) => prev.filter((_, idx) => idx !== i));

  // ===== Buscar contexto comum para PDF =====
  const fetchContext = async () => {
    const [clin, prof, pac] = await Promise.all([
      (supabase as any).from('config_clinica').select('*').eq('terapeuta_id', user!.id).maybeSingle(),
      supabase.from('profiles').select('nome, sobrenome, especialidade, crefito').eq('user_id', user!.id).maybeSingle(),
      supabase.from('pacientes').select('nome, sobrenome, cpf, rg').eq('id', pacienteId).maybeSingle(),
    ]);
    const p = prof.data as any;
    const pc = pac.data as any;
    return {
      clinica: clin.data || null,
      terapeuta: {
        nome: p?.nome || 'Médico(a)',
        sobrenome: p?.sobrenome,
        registro: p?.crefito,
        especialidade: p?.especialidade,
      },
      paciente: { nome: pc?.nome || '', sobrenome: pc?.sobrenome, cpf: pc?.cpf, rg: pc?.rg },
    };
  };

  // ===== Gerar Receita =====
  const gerarReceitaMut = useMutation({
    mutationFn: async () => {
      if (itens.length === 0) throw new Error('Adicione ao menos um medicamento');
      if (itens.some((i) => !i.posologia.trim())) throw new Error('Posologia obrigatória em todos os itens');
      const ctx = await fetchContext();
      const { gerarReceita } = await import('@/utils/pdfDocumentos');
      const doc = await gerarReceita({ ...ctx, dados: { itens, orientacoes, tipo: tipoReceita } });
      doc.save(`receita-${ctx.paciente.nome}-${new Date().toISOString().slice(0, 10)}.pdf`);

      await (supabase as any).from('prescricoes_paciente').insert({
        paciente_id: pacienteId,
        terapeuta_id: user!.id,
        itens,
        orientacoes: orientacoes || null,
        tipo: tipoReceita,
      });
    },
    onSuccess: () => {
      toast.success('Receita gerada');
      qc.invalidateQueries({ queryKey: ['receitas', pacienteId] });
      setItens([]);
      setOrientacoes('');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar receita'),
  });

  // ===== Gerar Atestado =====
  const gerarAtestadoMut = useMutation({
    mutationFn: async () => {
      if (!dias || dias < 1) throw new Error('Informe os dias de afastamento');
      const ctx = await fetchContext();
      const { gerarAtestadoMedico } = await import('@/utils/pdfDocumentos');
      const doc = await gerarAtestadoMedico({
        ...ctx,
        dados: { diasAfastamento: dias, dataInicio, cid: cidAtestado || undefined, motivo: motivo || undefined },
      });
      doc.save(`atestado-${ctx.paciente.nome}-${dataInicio}.pdf`);

      await (supabase as any).from('atestados_medicos').insert({
        paciente_id: pacienteId,
        terapeuta_id: user!.id,
        dias_afastamento: dias,
        data_inicio: dataInicio,
        cid_codigo: cidAtestado || null,
        motivo: motivo || null,
      });
    },
    onSuccess: () => {
      toast.success('Atestado gerado');
      qc.invalidateQueries({ queryKey: ['atestados', pacienteId] });
      setMotivo('');
      setCidAtestado('');
      setDias(1);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar atestado'),
  });

  // ===== Reimprimir histórico =====
  const reimprimirReceita = async (r: any) => {
    const ctx = await fetchContext();
    const { gerarReceita } = await import('@/utils/pdfDocumentos');
    const doc = await gerarReceita({
      ...ctx,
      dados: { itens: r.itens || [], orientacoes: r.orientacoes || '', tipo: r.tipo || 'simples' },
    });
    doc.save(`receita-${ctx.paciente.nome}-${r.data_emissao}.pdf`);
  };

  const reimprimirAtestado = async (a: any) => {
    const ctx = await fetchContext();
    const { gerarAtestadoMedico } = await import('@/utils/pdfDocumentos');
    const doc = await gerarAtestadoMedico({
      ...ctx,
      dados: {
        diasAfastamento: a.dias_afastamento,
        dataInicio: a.data_inicio,
        cid: a.cid_codigo || undefined,
        motivo: a.motivo || undefined,
      },
    });
    doc.save(`atestado-${ctx.paciente.nome}-${a.data_inicio}.pdf`);
  };

  return (
    <Card className="rounded-xl border-border/40 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Pill className="icon-sm text-primary" />
          Prescrição & Atestado
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="receita" className="w-full">
          <TabsList className="grid grid-cols-2 w-full mb-3">
            <TabsTrigger value="receita">Receita</TabsTrigger>
            <TabsTrigger value="atestado">Atestado</TabsTrigger>
          </TabsList>

          {/* ===== RECEITA ===== */}
          <TabsContent value="receita" className="space-y-3">
            <div className="flex items-center gap-2">
              <Select value={tipoReceita} onValueChange={(v: any) => setTipoReceita(v)}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="simples">Simples</SelectItem>
                  <SelectItem value="especial">Especial (B)</SelectItem>
                </SelectContent>
              </Select>
              <Popover open={medOpen} onOpenChange={setMedOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 justify-between font-normal">
                    <span className="text-muted-foreground"><Plus className="icon-xs inline mr-1" />Adicionar medicamento</span>
                    <ChevronsUpDown className="icon-xs opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput placeholder="Nome do medicamento..." value={searchMed} onValueChange={setSearchMed} />
                    <CommandList>
                      {medFetching && <div className="p-3 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="icon-xs animate-spin" /> Buscando...</div>}
                      <CommandEmpty>Nenhum medicamento encontrado.</CommandEmpty>
                      <CommandGroup>
                        {medResults.map((m) => (
                          <CommandItem key={m.id} value={m.id} onSelect={() => addMedicamento(m)}>
                            <Check className="icon-xs mr-2 opacity-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">{m.nome}</div>
                              {m.classe && <div className="text-[10px] text-muted-foreground">{m.classe}</div>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {itens.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Adicione medicamentos à receita.</p>
            )}

            {itens.map((it, i) => (
              <div key={i} className="p-3 rounded-lg border border-border/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-sm truncate">{i + 1}. {it.nome}</div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => removeItem(i)}>
                    <Trash2 className="icon-xs text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Apresentação"
                    value={it.apresentacao || ''}
                    onChange={(e) => updateItem(i, { apresentacao: e.target.value })}
                  />
                  <Input
                    placeholder="Quantidade (ex: 1 caixa)"
                    value={it.quantidade || ''}
                    onChange={(e) => updateItem(i, { quantidade: e.target.value })}
                  />
                </div>
                <Textarea
                  placeholder="Posologia (ex: 1 cp VO 8/8h por 5 dias)"
                  rows={2}
                  value={it.posologia}
                  onChange={(e) => updateItem(i, { posologia: e.target.value })}
                />
              </div>
            ))}

            <Textarea
              placeholder="Orientações gerais (opcional)"
              rows={2}
              value={orientacoes}
              onChange={(e) => setOrientacoes(e.target.value)}
            />

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => gerarReceitaMut.mutate()}
                disabled={itens.length === 0 || gerarReceitaMut.isPending}
              >
                {gerarReceitaMut.isPending ? <Loader2 className="icon-xs animate-spin mr-1" /> : <Download className="icon-xs mr-1" />}
                Gerar Receita PDF
              </Button>
            </div>

            {historicoReceitas.length > 0 && (
              <div className="pt-3 border-t border-border/40 space-y-1.5">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Histórico</p>
                {historicoReceitas.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      {new Date(r.data_emissao).toLocaleDateString('pt-BR')} · {(r.itens || []).length} item(ns)
                      {r.tipo === 'especial' && <Badge variant="outline" className="ml-2 text-[10px]">Especial</Badge>}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => reimprimirReceita(r)}>
                      <Download className="icon-xs" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ===== ATESTADO ===== */}
          <TabsContent value="atestado" className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Dias</label>
                <Input
                  type="number"
                  min={1}
                  value={dias}
                  onChange={(e) => setDias(parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Início</label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
            </div>
            <Input
              placeholder="CID-10 (opcional, ex: M54.5)"
              value={cidAtestado}
              onChange={(e) => setCidAtestado(e.target.value.toUpperCase())}
            />
            <Textarea
              placeholder="Observações clínicas (opcional)"
              rows={2}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />

            <div className="flex justify-end">
              <Button size="sm" onClick={() => gerarAtestadoMut.mutate()} disabled={gerarAtestadoMut.isPending}>
                {gerarAtestadoMut.isPending ? <Loader2 className="icon-xs animate-spin mr-1" /> : <FileText className="icon-xs mr-1" />}
                Gerar Atestado PDF
              </Button>
            </div>

            {historicoAtestados.length > 0 && (
              <div className="pt-3 border-t border-border/40 space-y-1.5">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Histórico</p>
                {historicoAtestados.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      {new Date(a.data_inicio).toLocaleDateString('pt-BR')} · {a.dias_afastamento} dia(s)
                      {a.cid_codigo && <span className="ml-2 text-xs text-muted-foreground">{a.cid_codigo}</span>}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => reimprimirAtestado(a)}>
                      <Download className="icon-xs" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
