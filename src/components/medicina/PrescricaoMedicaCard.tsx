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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pill, FileText, Plus, Trash2, ChevronsUpDown, Check, Loader2, Download, Eye, Pencil } from 'lucide-react';
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

  // ===== Form Receita =====
  const [itens, setItens] = useState<ReceitaItem[]>([]);
  const [orientacoes, setOrientacoes] = useState('');
  const [tipoReceita, setTipoReceita] = useState<'simples' | 'especial'>('simples');
  const [searchMed, setSearchMed] = useState('');
  const [medOpen, setMedOpen] = useState(false);

  // ===== Form Atestado =====
  const [dias, setDias] = useState(1);
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [cidAtestado, setCidAtestado] = useState('');
  const [motivo, setMotivo] = useState('');

  // ===== Preview / Edit Dialog =====
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [editReceita, setEditReceita] = useState<any | null>(null);
  const [editAtestado, setEditAtestado] = useState<any | null>(null);

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

  const addMedicamento = (m: Medicamento, target: 'new' | 'edit' = 'new') => {
    const novo = { nome: m.nome, apresentacao: m.apresentacao || '', posologia: m.posologia_sugerida || '', quantidade: '' };
    if (target === 'edit' && editReceita) {
      setEditReceita({ ...editReceita, itens: [...(editReceita.itens || []), novo] });
    } else {
      setItens((prev) => [...prev, novo]);
    }
    setMedOpen(false);
    setSearchMed('');
  };

  const updateItem = (i: number, patch: Partial<ReceitaItem>) =>
    setItens((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const removeItem = (i: number) => setItens((prev) => prev.filter((_, idx) => idx !== i));

  const updateEditItem = (i: number, patch: Partial<ReceitaItem>) =>
    setEditReceita((prev: any) => ({
      ...prev,
      itens: (prev.itens || []).map((it: any, idx: number) => (idx === i ? { ...it, ...patch } : it)),
    }));
  const removeEditItem = (i: number) =>
    setEditReceita((prev: any) => ({ ...prev, itens: (prev.itens || []).filter((_: any, idx: number) => idx !== i) }));

  // ===== Contexto comum =====
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
      terapeuta: { nome: p?.nome || 'Médico(a)', sobrenome: p?.sobrenome, registro: p?.crefito, especialidade: p?.especialidade },
      paciente: { nome: pc?.nome || '', sobrenome: pc?.sobrenome, cpf: pc?.cpf, rg: pc?.rg },
    };
  };

  const buildReceitaDoc = async (dados: { itens: ReceitaItem[]; orientacoes: string; tipo: 'simples' | 'especial' }) => {
    const ctx = await fetchContext();
    const { gerarReceita } = await import('@/utils/pdfDocumentos');
    return { ctx, doc: await gerarReceita({ ...ctx, dados }) };
  };
  const buildAtestadoDoc = async (dados: { diasAfastamento: number; dataInicio: string; cid?: string; motivo?: string }) => {
    const ctx = await fetchContext();
    const { gerarAtestadoMedico } = await import('@/utils/pdfDocumentos');
    return { ctx, doc: await gerarAtestadoMedico({ ...ctx, dados }) };
  };

  const openPreview = (doc: any, title: string) => {
    const url = URL.createObjectURL(doc.output('blob'));
    setPreviewUrl(url);
    setPreviewTitle(title);
  };

  // ===== Gerar Receita =====
  const gerarReceitaMut = useMutation({
    mutationFn: async (opts: { preview?: boolean }) => {
      if (itens.length === 0) throw new Error('Adicione ao menos um medicamento');
      if (itens.some((i) => !i.posologia.trim())) throw new Error('Posologia obrigatória em todos os itens');
      const { ctx, doc } = await buildReceitaDoc({ itens, orientacoes, tipo: tipoReceita });
      if (opts.preview) {
        openPreview(doc, `Receita — ${ctx.paciente.nome}`);
        return;
      }
      doc.save(`receita-${ctx.paciente.nome}-${new Date().toISOString().slice(0, 10)}.pdf`);
      await (supabase as any).from('prescricoes_paciente').insert({
        paciente_id: pacienteId, terapeuta_id: user!.id, itens, orientacoes: orientacoes || null, tipo: tipoReceita,
      });
    },
    onSuccess: (_d, vars) => {
      if (vars.preview) return;
      toast.success('Receita gerada');
      qc.invalidateQueries({ queryKey: ['receitas', pacienteId] });
      setItens([]); setOrientacoes('');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar receita'),
  });

  // ===== Gerar Atestado =====
  const gerarAtestadoMut = useMutation({
    mutationFn: async (opts: { preview?: boolean }) => {
      if (!dias || dias < 1) throw new Error('Informe os dias de afastamento');
      const { ctx, doc } = await buildAtestadoDoc({ diasAfastamento: dias, dataInicio, cid: cidAtestado || undefined, motivo: motivo || undefined });
      if (opts.preview) {
        openPreview(doc, `Atestado — ${ctx.paciente.nome}`);
        return;
      }
      doc.save(`atestado-${ctx.paciente.nome}-${dataInicio}.pdf`);
      await (supabase as any).from('atestados_medicos').insert({
        paciente_id: pacienteId, terapeuta_id: user!.id, dias_afastamento: dias, data_inicio: dataInicio,
        cid_codigo: cidAtestado || null, motivo: motivo || null,
      });
    },
    onSuccess: (_d, vars) => {
      if (vars.preview) return;
      toast.success('Atestado gerado');
      qc.invalidateQueries({ queryKey: ['atestados', pacienteId] });
      setMotivo(''); setCidAtestado(''); setDias(1);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao gerar atestado'),
  });

  // ===== Histórico actions =====
  const visualizarReceita = async (r: any) => {
    const { ctx, doc } = await buildReceitaDoc({ itens: r.itens || [], orientacoes: r.orientacoes || '', tipo: r.tipo || 'simples' });
    openPreview(doc, `Receita — ${ctx.paciente.nome} · ${new Date(r.data_emissao).toLocaleDateString('pt-BR')}`);
  };
  const baixarReceita = async (r: any) => {
    const { ctx, doc } = await buildReceitaDoc({ itens: r.itens || [], orientacoes: r.orientacoes || '', tipo: r.tipo || 'simples' });
    doc.save(`receita-${ctx.paciente.nome}-${r.data_emissao}.pdf`);
  };
  const visualizarAtestado = async (a: any) => {
    const { ctx, doc } = await buildAtestadoDoc({ diasAfastamento: a.dias_afastamento, dataInicio: a.data_inicio, cid: a.cid_codigo || undefined, motivo: a.motivo || undefined });
    openPreview(doc, `Atestado — ${ctx.paciente.nome} · ${new Date(a.data_inicio).toLocaleDateString('pt-BR')}`);
  };
  const baixarAtestado = async (a: any) => {
    const { ctx, doc } = await buildAtestadoDoc({ diasAfastamento: a.dias_afastamento, dataInicio: a.data_inicio, cid: a.cid_codigo || undefined, motivo: a.motivo || undefined });
    doc.save(`atestado-${ctx.paciente.nome}-${a.data_inicio}.pdf`);
  };
  const apagarReceita = async (r: any) => {
    if (!confirm('Apagar esta receita?')) return;
    await (supabase as any).from('prescricoes_paciente').delete().eq('id', r.id);
    qc.invalidateQueries({ queryKey: ['receitas', pacienteId] });
    toast.success('Receita apagada');
  };
  const apagarAtestado = async (a: any) => {
    if (!confirm('Apagar este atestado?')) return;
    await (supabase as any).from('atestados_medicos').delete().eq('id', a.id);
    qc.invalidateQueries({ queryKey: ['atestados', pacienteId] });
    toast.success('Atestado apagado');
  };

  // ===== Salvar edição =====
  const salvarEdicaoReceita = async (opts: { preview?: boolean } = {}) => {
    if (!editReceita) return;
    const itensEdit: ReceitaItem[] = editReceita.itens || [];
    if (itensEdit.length === 0) return toast.error('Adicione ao menos um medicamento');
    if (itensEdit.some((i) => !i.posologia?.trim())) return toast.error('Posologia obrigatória');
    if (opts.preview) {
      const { ctx, doc } = await buildReceitaDoc({ itens: itensEdit, orientacoes: editReceita.orientacoes || '', tipo: editReceita.tipo || 'simples' });
      openPreview(doc, `Receita (edição) — ${ctx.paciente.nome}`);
      return;
    }
    const { error } = await (supabase as any).from('prescricoes_paciente').update({
      itens: itensEdit, orientacoes: editReceita.orientacoes || null, tipo: editReceita.tipo || 'simples',
    }).eq('id', editReceita.id);
    if (error) return toast.error(error.message);
    toast.success('Receita atualizada');
    qc.invalidateQueries({ queryKey: ['receitas', pacienteId] });
    setEditReceita(null);
  };
  const salvarEdicaoAtestado = async (opts: { preview?: boolean } = {}) => {
    if (!editAtestado) return;
    if (!editAtestado.dias_afastamento || editAtestado.dias_afastamento < 1) return toast.error('Informe os dias');
    if (opts.preview) {
      const { ctx, doc } = await buildAtestadoDoc({
        diasAfastamento: editAtestado.dias_afastamento, dataInicio: editAtestado.data_inicio,
        cid: editAtestado.cid_codigo || undefined, motivo: editAtestado.motivo || undefined,
      });
      openPreview(doc, `Atestado (edição) — ${ctx.paciente.nome}`);
      return;
    }
    const { error } = await (supabase as any).from('atestados_medicos').update({
      dias_afastamento: editAtestado.dias_afastamento, data_inicio: editAtestado.data_inicio,
      cid_codigo: editAtestado.cid_codigo || null, motivo: editAtestado.motivo || null,
    }).eq('id', editAtestado.id);
    if (error) return toast.error(error.message);
    toast.success('Atestado atualizado');
    qc.invalidateQueries({ queryKey: ['atestados', pacienteId] });
    setEditAtestado(null);
  };

  return (
    <Card className="rounded-xl border-border/40 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Pill className="icon-sm text-primary" /> Prescrição & Atestado
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
                          <CommandItem key={m.id} value={m.id} onSelect={() => addMedicamento(m, editReceita ? 'edit' : 'new')}>
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
                  <Input placeholder="Apresentação" value={it.apresentacao || ''} onChange={(e) => updateItem(i, { apresentacao: e.target.value })} />
                  <Input placeholder="Quantidade (ex: 1 caixa)" value={it.quantidade || ''} onChange={(e) => updateItem(i, { quantidade: e.target.value })} />
                </div>
                <Textarea placeholder="Posologia (ex: 1 cp VO 8/8h por 5 dias)" rows={2} value={it.posologia} onChange={(e) => updateItem(i, { posologia: e.target.value })} />
              </div>
            ))}

            <Textarea placeholder="Orientações gerais (opcional)" rows={2} value={orientacoes} onChange={(e) => setOrientacoes(e.target.value)} />

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => gerarReceitaMut.mutate({ preview: true })} disabled={itens.length === 0 || gerarReceitaMut.isPending}>
                <Eye className="icon-xs mr-1" /> Visualizar
              </Button>
              <Button size="sm" onClick={() => gerarReceitaMut.mutate({})} disabled={itens.length === 0 || gerarReceitaMut.isPending}>
                {gerarReceitaMut.isPending ? <Loader2 className="icon-xs animate-spin mr-1" /> : <Download className="icon-xs mr-1" />}
                Gerar PDF
              </Button>
            </div>

            {historicoReceitas.length > 0 && (
              <div className="pt-3 border-t border-border/40 space-y-1.5">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Histórico</p>
                {historicoReceitas.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between gap-1 text-sm">
                    <span className="truncate flex-1">
                      {new Date(r.data_emissao).toLocaleDateString('pt-BR')} · {(r.itens || []).length} item(ns)
                      {r.tipo === 'especial' && <Badge variant="outline" className="ml-2 text-[10px]">Especial</Badge>}
                    </span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Visualizar" onClick={() => visualizarReceita(r)}><Eye className="icon-xs" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar" onClick={() => setEditReceita({ ...r, itens: r.itens || [] })}><Pencil className="icon-xs" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Baixar" onClick={() => baixarReceita(r)}><Download className="icon-xs" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Apagar" onClick={() => apagarReceita(r)}><Trash2 className="icon-xs text-destructive" /></Button>
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
                <Input type="number" min={1} value={dias} onChange={(e) => setDias(parseInt(e.target.value) || 1)} />
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Início</label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
            </div>
            <Input placeholder="CID-10 (opcional, ex: M54.5)" value={cidAtestado} onChange={(e) => setCidAtestado(e.target.value.toUpperCase())} />
            <Textarea placeholder="Observações clínicas (opcional)" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => gerarAtestadoMut.mutate({ preview: true })} disabled={gerarAtestadoMut.isPending}>
                <Eye className="icon-xs mr-1" /> Visualizar
              </Button>
              <Button size="sm" onClick={() => gerarAtestadoMut.mutate({})} disabled={gerarAtestadoMut.isPending}>
                {gerarAtestadoMut.isPending ? <Loader2 className="icon-xs animate-spin mr-1" /> : <FileText className="icon-xs mr-1" />}
                Gerar PDF
              </Button>
            </div>

            {historicoAtestados.length > 0 && (
              <div className="pt-3 border-t border-border/40 space-y-1.5">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Histórico</p>
                {historicoAtestados.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between gap-1 text-sm">
                    <span className="truncate flex-1">
                      {new Date(a.data_inicio).toLocaleDateString('pt-BR')} · {a.dias_afastamento} dia(s)
                      {a.cid_codigo && <span className="ml-2 text-xs text-muted-foreground">{a.cid_codigo}</span>}
                    </span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Visualizar" onClick={() => visualizarAtestado(a)}><Eye className="icon-xs" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar" onClick={() => setEditAtestado({ ...a })}><Pencil className="icon-xs" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Baixar" onClick={() => baixarAtestado(a)}><Download className="icon-xs" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Apagar" onClick={() => apagarAtestado(a)}><Trash2 className="icon-xs text-destructive" /></Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* ===== Dialog: Preview PDF ===== */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => { if (!open) { if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); } }}>
        <DialogContent className="max-w-3xl w-[95vw] h-[85vh] flex flex-col p-4">
          <DialogHeader><DialogTitle className="text-sm">{previewTitle}</DialogTitle></DialogHeader>
          {previewUrl && <iframe src={previewUrl} className="flex-1 w-full rounded-md border border-border/40" title="PDF preview" />}
        </DialogContent>
      </Dialog>

      {/* ===== Dialog: Editar Receita ===== */}
      <Dialog open={!!editReceita} onOpenChange={(open) => !open && setEditReceita(null)}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-base">Editar Receita</DialogTitle></DialogHeader>
          {editReceita && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Select value={editReceita.tipo || 'simples'} onValueChange={(v) => setEditReceita({ ...editReceita, tipo: v })}>
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
                        <CommandEmpty>Nenhum medicamento encontrado.</CommandEmpty>
                        <CommandGroup>
                          {medResults.map((m) => (
                            <CommandItem key={m.id} value={m.id} onSelect={() => addMedicamento(m, 'edit')}>
                              <div className="text-sm font-medium">{m.nome}</div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {(editReceita.itens || []).map((it: ReceitaItem, i: number) => (
                <div key={i} className="p-3 rounded-lg border border-border/40 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm truncate">{i + 1}. {it.nome}</div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeEditItem(i)}><Trash2 className="icon-xs text-destructive" /></Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Apresentação" value={it.apresentacao || ''} onChange={(e) => updateEditItem(i, { apresentacao: e.target.value })} />
                    <Input placeholder="Quantidade" value={it.quantidade || ''} onChange={(e) => updateEditItem(i, { quantidade: e.target.value })} />
                  </div>
                  <Textarea placeholder="Posologia" rows={2} value={it.posologia} onChange={(e) => updateEditItem(i, { posologia: e.target.value })} />
                </div>
              ))}

              <Textarea placeholder="Orientações gerais" rows={2} value={editReceita.orientacoes || ''} onChange={(e) => setEditReceita({ ...editReceita, orientacoes: e.target.value })} />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => salvarEdicaoReceita({ preview: true })}><Eye className="icon-xs mr-1" /> Visualizar</Button>
            <Button size="sm" onClick={() => salvarEdicaoReceita()}>Salvar alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Dialog: Editar Atestado ===== */}
      <Dialog open={!!editAtestado} onOpenChange={(open) => !open && setEditAtestado(null)}>
        <DialogContent className="max-w-md w-[95vw]">
          <DialogHeader><DialogTitle className="text-base">Editar Atestado</DialogTitle></DialogHeader>
          {editAtestado && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Dias</label>
                  <Input type="number" min={1} value={editAtestado.dias_afastamento || 1} onChange={(e) => setEditAtestado({ ...editAtestado, dias_afastamento: parseInt(e.target.value) || 1 })} />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Início</label>
                  <Input type="date" value={editAtestado.data_inicio?.slice(0, 10) || ''} onChange={(e) => setEditAtestado({ ...editAtestado, data_inicio: e.target.value })} />
                </div>
              </div>
              <Input placeholder="CID-10 (opcional)" value={editAtestado.cid_codigo || ''} onChange={(e) => setEditAtestado({ ...editAtestado, cid_codigo: e.target.value.toUpperCase() })} />
              <Textarea placeholder="Observações clínicas" rows={2} value={editAtestado.motivo || ''} onChange={(e) => setEditAtestado({ ...editAtestado, motivo: e.target.value })} />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => salvarEdicaoAtestado({ preview: true })}><Eye className="icon-xs mr-1" /> Visualizar</Button>
            <Button size="sm" onClick={() => salvarEdicaoAtestado()}>Salvar alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
