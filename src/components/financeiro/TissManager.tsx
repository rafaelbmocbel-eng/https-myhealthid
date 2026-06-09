import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, FileCode, Download, Settings, Package, Trash2, FileText } from 'lucide-react';
import { useConvenios } from '@/hooks/useConvenios';
import { buildTissLoteXml, downloadXml } from '@/utils/tissXml';
import { format } from 'date-fns';

const TABLE = (n: string) => supabase.from(n as any);

export default function TissManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { convenios } = useConvenios();

  const { data: config } = useQuery({
    queryKey: ['tiss-config', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await TABLE('tiss_config').select('*').eq('terapeuta_id', user!.id).maybeSingle();
      return data as any;
    },
  });

  const { data: guias = [] } = useQuery({
    queryKey: ['tiss-guias', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await TABLE('tiss_guias')
        .select('*, pacientes(nome,sobrenome), convenios(nome), tiss_guia_procedimentos(*)')
        .eq('terapeuta_id', user!.id)
        .order('data_atendimento', { ascending: false });
      return (data || []) as any[];
    },
  });

  const { data: lotes = [] } = useQuery({
    queryKey: ['tiss-lotes', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await TABLE('tiss_lotes').select('*, convenios(nome)').eq('terapeuta_id', user!.id).order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  return (
    <Card className="rounded-xl border-border/40 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileCode className="icon-sm text-primary" /> Faturamento TISS (ANS)
          <Badge variant="secondary" className="ml-2 text-[10px]">v{config?.versao_tiss || '4.01.00'}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Gere guias de Consulta e SP/SADT, agrupe em lote e exporte XML TISS para envio às operadoras. Não interfere com seu fluxo financeiro atual.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="guias">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="guias">Guias</TabsTrigger>
            <TabsTrigger value="lotes">Lotes</TabsTrigger>
            <TabsTrigger value="tuss">TUSS</TabsTrigger>
            <TabsTrigger value="config"><Settings className="icon-xs" /></TabsTrigger>
          </TabsList>

          <TabsContent value="guias" className="mt-4 space-y-3">
            <NovaGuiaDialog convenios={convenios} onCreated={() => qc.invalidateQueries({ queryKey: ['tiss-guias'] })} />
            {guias.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Nenhuma guia criada.</p>
            ) : (
              <div className="space-y-2">
                {guias.map((g) => (
                  <div key={g.id} className="border rounded-lg p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[9px]">{g.tipo_guia.toUpperCase()}</Badge>
                        <Badge variant={g.status === 'paga' ? 'default' : g.status === 'glosada' ? 'destructive' : 'secondary'} className="text-[9px]">
                          {g.status}
                        </Badge>
                        <span className="text-xs font-semibold truncate">
                          {g.nome_beneficiario || `${g.pacientes?.nome || ''} ${g.pacientes?.sobrenome || ''}`.trim() || 'Beneficiário'}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {g.convenios?.nome || '—'} · {format(new Date(g.data_atendimento), 'dd/MM/yyyy')} · R$ {Number(g.valor_total).toFixed(2)}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={async () => {
                      if (!confirm('Excluir guia?')) return;
                      await TABLE('tiss_guias').delete().eq('id', g.id);
                      qc.invalidateQueries({ queryKey: ['tiss-guias'] });
                    }}><Trash2 className="icon-xs" /></Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="lotes" className="mt-4 space-y-3">
            <NovoLoteDialog
              convenios={convenios}
              guias={guias.filter((g) => g.status === 'rascunho' || g.status === 'gerada')}
              config={config}
              onCreated={() => {
                qc.invalidateQueries({ queryKey: ['tiss-lotes'] });
                qc.invalidateQueries({ queryKey: ['tiss-guias'] });
              }}
            />
            {lotes.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Nenhum lote gerado.</p>
            ) : (
              <div className="space-y-2">
                {lotes.map((l) => (
                  <div key={l.id} className="border rounded-lg p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[9px]">#{l.numero_lote}</Badge>
                        <Badge variant="secondary" className="text-[9px]">{l.status}</Badge>
                        <span className="text-xs font-semibold">{l.convenios?.nome || '—'}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Comp. {l.competencia} · {l.qtd_guias} guias · R$ {Number(l.valor_total).toFixed(2)}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => {
                      if (l.xml_gerado) downloadXml(`tiss-lote-${l.numero_lote}.xml`, l.xml_gerado);
                      else toast({ title: 'XML não disponível', variant: 'destructive' });
                    }}><Download className="icon-xs mr-1" /> XML</Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tuss" className="mt-4">
            <TussCodigosManager convenios={convenios} />
          </TabsContent>

          <TabsContent value="config" className="mt-4">
            <TissConfigForm config={config} onSaved={() => qc.invalidateQueries({ queryKey: ['tiss-config'] })} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ---------- Config ----------
function TissConfigForm({ config, onSaved }: any) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<any>(config || { versao_tiss: '4.01.00' });

  const save = async () => {
    const payload = { ...form, terapeuta_id: user!.id };
    const { error } = await TABLE('tiss_config').upsert(payload, { onConflict: 'terapeuta_id' });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Configuração salva' });
    onSaved();
  };

  const F = (label: string, key: string, ph?: string) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input className="h-8 text-xs" value={form[key] || ''} placeholder={ph} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {F('Versão TISS', 'versao_tiss', '4.01.00')}
        {F('Registro ANS Operadora padrão', 'registro_ans')}
        {F('CNES', 'cnes')}
        {F('Código Prestador na Operadora', 'codigo_prestador_operadora')}
        {F('CNPJ Prestador', 'cnpj_prestador')}
        {F('CPF Prestador', 'cpf_prestador')}
        {F('Nome Prestador', 'nome_prestador')}
      </div>
      <Button onClick={save} size="sm">Salvar configuração</Button>
    </div>
  );
}

// ---------- Nova guia ----------
function NovaGuiaDialog({ convenios, onCreated }: any) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pacienteId, setPacienteId] = useState('');
  const [pacienteOpts, setPacienteOpts] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    tipo_guia: 'consulta',
    data_atendimento: format(new Date(), 'yyyy-MM-dd'),
    tipo_consulta: '1',
  });
  const [proc, setProc] = useState({ codigo_procedimento: '', descricao: '', valor: 0, quantidade: 1 });

  const loadPacientes = async () => {
    const { data } = await TABLE('pacientes').select('id,nome,sobrenome').eq('terapeuta_id', user!.id).eq('ativo', true).order('nome');
    setPacienteOpts((data as any[]) || []);
  };

  const save = async () => {
    if (!proc.codigo_procedimento || !proc.descricao) {
      return toast({ title: 'Informe o procedimento', variant: 'destructive' });
    }
    const valor_total = Number(proc.valor) * Number(proc.quantidade || 1);
    const paciente = pacienteOpts.find((p) => p.id === pacienteId);
    const { data: guia, error } = await TABLE('tiss_guias').insert({
      terapeuta_id: user!.id,
      paciente_id: pacienteId || null,
      convenio_id: form.convenio_id || null,
      tipo_guia: form.tipo_guia,
      numero_guia_prestador: form.numero_guia_prestador || null,
      numero_guia_operadora: form.numero_guia_operadora || null,
      senha_autorizacao: form.senha_autorizacao || null,
      data_autorizacao: form.data_autorizacao || null,
      data_validade_senha: form.data_validade_senha || null,
      numero_carteira: form.numero_carteira || null,
      nome_beneficiario: form.nome_beneficiario || (paciente ? `${paciente.nome} ${paciente.sobrenome || ''}`.trim() : null),
      data_atendimento: form.data_atendimento,
      tipo_consulta: form.tipo_consulta,
      observacoes: form.observacoes || null,
      valor_total,
      status: 'gerada',
    }).select().single();
    if (error || !guia) return toast({ title: 'Erro', description: error?.message, variant: 'destructive' });

    await TABLE('tiss_guia_procedimentos').insert({
      guia_id: (guia as any).id,
      sequencia: 1,
      data_execucao: form.data_atendimento,
      codigo_tabela: '22',
      codigo_procedimento: proc.codigo_procedimento,
      descricao: proc.descricao,
      quantidade: proc.quantidade,
      valor_unitario: proc.valor,
      valor_total,
    });
    toast({ title: 'Guia criada' });
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) loadPacientes(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="icon-xs mr-1" /> Nova guia</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova guia TISS</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={form.tipo_guia} onValueChange={(v) => setForm({ ...form, tipo_guia: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="consulta">Consulta</SelectItem>
                <SelectItem value="sp_sadt">SP/SADT</SelectItem>
                <SelectItem value="honorario">Honorário</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Convênio</Label>
            <Select value={form.convenio_id || ''} onValueChange={(v) => setForm({ ...form, convenio_id: v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {convenios.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Paciente</Label>
            <Select value={pacienteId} onValueChange={setPacienteId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {pacienteOpts.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome} {p.sobrenome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Nº Carteira</Label>
            <Input className="h-9 text-xs" value={form.numero_carteira || ''} onChange={(e) => setForm({ ...form, numero_carteira: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Data atendimento</Label>
            <Input type="date" className="h-9 text-xs" value={form.data_atendimento} onChange={(e) => setForm({ ...form, data_atendimento: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Senha autorização</Label>
            <Input className="h-9 text-xs" value={form.senha_autorizacao || ''} onChange={(e) => setForm({ ...form, senha_autorizacao: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Nº guia operadora</Label>
            <Input className="h-9 text-xs" value={form.numero_guia_operadora || ''} onChange={(e) => setForm({ ...form, numero_guia_operadora: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Nº guia prestador</Label>
            <Input className="h-9 text-xs" value={form.numero_guia_prestador || ''} onChange={(e) => setForm({ ...form, numero_guia_prestador: e.target.value })} />
          </div>
        </div>

        <div className="border-t pt-3 mt-2 space-y-2">
          <p className="text-xs font-semibold">Procedimento principal (TUSS)</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">Código</Label>
              <Input className="h-9 text-xs" value={proc.codigo_procedimento} onChange={(e) => setProc({ ...proc, codigo_procedimento: e.target.value })} placeholder="ex: 10101012" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Descrição</Label>
              <Input className="h-9 text-xs" value={proc.descricao} onChange={(e) => setProc({ ...proc, descricao: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Valor (R$)</Label>
              <Input type="number" step="0.01" className="h-9 text-xs" value={proc.valor} onChange={(e) => setProc({ ...proc, valor: Number(e.target.value) })} />
            </div>
          </div>
        </div>

        <div>
          <Label className="text-xs">Observações / indicação clínica</Label>
          <Textarea className="text-xs" rows={2} value={form.observacoes || ''} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
        </div>

        <DialogFooter>
          <Button onClick={save}>Criar guia</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Novo lote ----------
function NovoLoteDialog({ convenios, guias, config, onCreated }: any) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [convenioId, setConvenioId] = useState('');
  const [competencia, setCompetencia] = useState(format(new Date(), 'yyyy-MM'));

  const guiasDoConvenio = useMemo(
    () => guias.filter((g: any) => g.convenio_id === convenioId),
    [guias, convenioId]
  );

  const gerar = async () => {
    if (!convenioId || guiasDoConvenio.length === 0) {
      return toast({ title: 'Selecione convênio com guias disponíveis', variant: 'destructive' });
    }
    const numero_lote = `${Date.now()}`.slice(-8);
    const valor_total = guiasDoConvenio.reduce((s: number, g: any) => s + Number(g.valor_total), 0);

    const xml = buildTissLoteXml({
      numero_lote,
      competencia,
      data_envio: format(new Date(), 'yyyy-MM-dd'),
      registro_ans_operadora: convenios.find((c: any) => c.id === convenioId)?.codigo_tuss || config?.registro_ans || '',
      versao: config?.versao_tiss || '4.01.00',
      prestador: config || {},
      guias: guiasDoConvenio.map((g: any) => ({
        tipo_guia: g.tipo_guia,
        numero_guia_prestador: g.numero_guia_prestador,
        numero_guia_operadora: g.numero_guia_operadora,
        senha_autorizacao: g.senha_autorizacao,
        data_autorizacao: g.data_autorizacao,
        data_validade_senha: g.data_validade_senha,
        numero_carteira: g.numero_carteira,
        nome_beneficiario: g.nome_beneficiario,
        data_atendimento: g.data_atendimento,
        tipo_consulta: g.tipo_consulta,
        indicacao_acidente: g.indicacao_acidente,
        carater_atendimento: g.carater_atendimento,
        observacoes: g.observacoes,
        valor_total: Number(g.valor_total),
        procedimentos: (g.tiss_guia_procedimentos || []).map((p: any) => ({
          sequencia: p.sequencia,
          data_execucao: p.data_execucao,
          hora_inicial: p.hora_inicial,
          hora_final: p.hora_final,
          codigo_tabela: p.codigo_tabela,
          codigo_procedimento: p.codigo_procedimento,
          descricao: p.descricao,
          quantidade: Number(p.quantidade),
          via_acesso: p.via_acesso,
          tecnica_utilizada: p.tecnica_utilizada,
          reducao_acrescimo: Number(p.reducao_acrescimo || 1),
          valor_unitario: Number(p.valor_unitario),
          valor_total: Number(p.valor_total),
        })),
      })),
    });

    const { data: lote, error } = await TABLE('tiss_lotes').insert({
      terapeuta_id: user!.id,
      convenio_id: convenioId,
      numero_lote,
      competencia,
      qtd_guias: guiasDoConvenio.length,
      valor_total,
      status: 'fechado',
      xml_gerado: xml,
    }).select().single();
    if (error || !lote) return toast({ title: 'Erro', description: error?.message, variant: 'destructive' });

    await TABLE('tiss_guias').update({ status: 'em_lote', lote_id: (lote as any).id }).in('id', guiasDoConvenio.map((g: any) => g.id));
    downloadXml(`tiss-lote-${numero_lote}.xml`, xml);
    toast({ title: 'Lote gerado e XML baixado' });
    setOpen(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Package className="icon-xs mr-1" /> Novo lote</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Gerar lote TISS</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Convênio</Label>
            <Select value={convenioId} onValueChange={setConvenioId}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {convenios.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Competência (YYYY-MM)</Label>
            <Input className="h-9 text-xs" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            <FileText className="icon-xs inline mr-1" />
            {guiasDoConvenio.length} guia(s) disponível(is) — Total R$ {guiasDoConvenio.reduce((s: number, g: any) => s + Number(g.valor_total), 0).toFixed(2)}
          </p>
        </div>
        <DialogFooter>
          <Button onClick={gerar}><Download className="icon-xs mr-1" /> Gerar + baixar XML</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- TUSS catálogo ----------
function TussCodigosManager({ convenios }: any) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<any>({ codigo: '', descricao: '', valor: 0, convenio_id: '' });

  const { data: codigos = [] } = useQuery({
    queryKey: ['tiss-tuss', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await TABLE('tiss_tuss_codigos').select('*, convenios(nome)').eq('terapeuta_id', user!.id).order('codigo');
      return (data || []) as any[];
    },
  });

  const add = async () => {
    if (!form.codigo || !form.descricao) return;
    const { error } = await TABLE('tiss_tuss_codigos').insert({ ...form, terapeuta_id: user!.id, valor: Number(form.valor) || 0 });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setForm({ codigo: '', descricao: '', valor: 0, convenio_id: '' });
    qc.invalidateQueries({ queryKey: ['tiss-tuss'] });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        <Input className="h-9 text-xs" placeholder="Código TUSS" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
        <Input className="h-9 text-xs sm:col-span-2" placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
        <Input type="number" step="0.01" className="h-9 text-xs" placeholder="Valor" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
        <Select value={form.convenio_id} onValueChange={(v) => setForm({ ...form, convenio_id: v })}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Convênio" /></SelectTrigger>
          <SelectContent>
            {convenios.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={add} size="sm"><Plus className="icon-xs mr-1" /> Adicionar código</Button>

      <div className="space-y-1">
        {codigos.map((c) => (
          <div key={c.id} className="flex items-center justify-between border rounded p-2 text-xs">
            <span><b>{c.codigo}</b> — {c.descricao}</span>
            <span className="text-muted-foreground">{c.convenios?.nome || '—'} · R$ {Number(c.valor).toFixed(2)}</span>
          </div>
        ))}
        {codigos.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum código cadastrado.</p>}
      </div>
    </div>
  );
}
