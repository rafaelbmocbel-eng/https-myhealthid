import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { invalidarFontesClinicas } from '@/hooks/useFontesClinicas';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Stethoscope, Plus, Trash2, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hojeLocalISO } from '@/lib/dataLocal';
import { dataDoDiagnosticoPodeSerDoSistema, erroDaDataDigitada, formatarData } from '@/lib/resumoClinico/datas';
import { toast } from 'sonner';

interface Props {
  pacienteId: string;
}

interface CidItem {
  codigo: string;
  descricao: string;
  categoria: string | null;
}

interface Diagnostico {
  id: string;
  cid_codigo: string;
  cid_descricao: string;
  tipo: string;
  observacao: string | null;
  data_diagnostico: string | null;
  ativo: boolean;
  created_at?: string | null;
}

const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

// O valor que está no banco, sem julgar: se não for "AAAA-MM-DD", aparece como veio.
function diaParaMostrar(valor: string | null): string | null {
  if (!valor) return null;
  return SO_DATA.test(valor) ? formatarData({ iso: valor, precisao: 'dia' }) : valor;
}

const TIPO_LABEL: Record<string, { label: string; cls: string }> = {
  principal: { label: 'Principal', cls: 'bg-primary/10 text-primary border-primary/20' },
  secundario: { label: 'Secundário', cls: 'bg-muted text-muted-foreground' },
  suspeita: { label: 'Suspeita', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
};

export default function DiagnosticosCID10Card({ pacienteId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [adicionando, setAdicionando] = useState(false);
  const [search, setSearch] = useState('');
  const [selecionado, setSelecionado] = useState<CidItem | null>(null);
  const [tipo, setTipo] = useState('principal');
  const [observacao, setObservacao] = useState('');
  const [dataDiagnostico, setDataDiagnostico] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [dataEditada, setDataEditada] = useState('');
  const hoje = hojeLocalISO();
  const erroDaDataNova = dataDiagnostico ? erroDaDataDigitada(dataDiagnostico, hoje) : null;

  const { data: diagnosticos = [] } = useQuery({
    queryKey: ['diagnosticos', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('diagnosticos_paciente')
        .select('*')
        .eq('paciente_id', pacienteId)
        .eq('ativo', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Diagnostico[];
    },
  });

  const { data: cidResults = [], isFetching } = useQuery({
    queryKey: ['cid10-search', search],
    enabled: open,
    queryFn: async () => {
      const term = search.trim();
      let q = (supabase as any).from('cid10_catalogo').select('codigo, descricao, categoria').limit(40);
      if (term.length >= 2) {
        q = q.or(`codigo.ilike.${term}%,descricao.ilike.%${term}%`);
      } else {
        q = q.order('codigo');
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as CidItem[];
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (!selecionado || !user) throw new Error('Selecione um CID');
      const erroDaData = dataDiagnostico ? erroDaDataDigitada(dataDiagnostico, hojeLocalISO()) : null;
      if (erroDaData) throw new Error(erroDaData);
      const { error } = await (supabase as any).from('diagnosticos_paciente').insert({
        paciente_id: pacienteId,
        terapeuta_id: user.id,
        cid_codigo: selecionado.codigo,
        cid_descricao: selecionado.descricao,
        tipo,
        observacao: observacao || null,
        // Sempre enviada: sem isto o banco preenche com o dia do cadastro (DEFAULT CURRENT_DATE) e a data deixa de ser do profissional.
        data_diagnostico: dataDiagnostico || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Diagnóstico adicionado');
      qc.invalidateQueries({ queryKey: ['diagnosticos', pacienteId] });
      invalidarFontesClinicas(qc, pacienteId);
      setSelecionado(null);
      setObservacao('');
      setDataDiagnostico('');
      setTipo('principal');
      setAdicionando(false);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  const atualizarData = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: string | null }) => {
      const erroDaData = data ? erroDaDataDigitada(data, hojeLocalISO()) : null;
      if (erroDaData) throw new Error(erroDaData);
      const { error } = await supabase
        .from('diagnosticos_paciente')
        .update({ data_diagnostico: data })
        .eq('id', id)
        .eq('paciente_id', pacienteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Data do diagnóstico atualizada');
      qc.invalidateQueries({ queryKey: ['diagnosticos', pacienteId] });
      invalidarFontesClinicas(qc, pacienteId);
      setEditandoId(null);
    },
    onError: (e: Error) => toast.error(e.message || 'Erro ao salvar a data'),
  });

  const abrirEdicaoDaData = (d: Diagnostico) => {
    setEditandoId(d.id);
    setDataEditada(d.data_diagnostico && SO_DATA.test(d.data_diagnostico) ? d.data_diagnostico : '');
  };

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('diagnosticos_paciente')
        .update({ ativo: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarFontesClinicas(qc, pacienteId);
      return qc.invalidateQueries({ queryKey: ['diagnosticos', pacienteId] });
    },
  });

  return (
    <Card data-cartao-diagnosticos="true" className="scroll-mt-20 rounded-xl border-border/40 shadow-xs">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Stethoscope className="icon-sm text-primary" />
          Diagnósticos (CID-10)
        </CardTitle>
        {!adicionando && (
          <Button size="sm" variant="outline" onClick={() => setAdicionando(true)}>
            <Plus className="icon-xs mr-1" /> Adicionar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {adicionando && (
          <div className="space-y-3 p-3 rounded-lg border border-border/40 bg-muted/30">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selecionado ? (
                    <span className="truncate"><span className="font-semibold">{selecionado.codigo}</span> — {selecionado.descricao}</span>
                  ) : (
                    <span className="text-muted-foreground">Buscar CID-10 (código ou descrição)...</span>
                  )}
                  <ChevronsUpDown className="icon-xs opacity-50 shrink-0 ml-2" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Digite código ou parte do nome..." value={search} onValueChange={setSearch} />
                  <CommandList>
                    {isFetching && <div className="p-3 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="icon-xs animate-spin" /> Buscando...</div>}
                    <CommandEmpty>Nenhum CID encontrado.</CommandEmpty>
                    <CommandGroup>
                      {cidResults.map((c) => (
                        <CommandItem
                          key={c.codigo}
                          value={c.codigo}
                          onSelect={() => { setSelecionado(c); setOpen(false); }}
                        >
                          <Check className={cn('icon-xs mr-2', selecionado?.codigo === c.codigo ? 'opacity-100' : 'opacity-0')} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm"><span className="font-semibold">{c.codigo}</span> — {c.descricao}</div>
                            {c.categoria && <div className="text-xs text-muted-foreground">{c.categoria}</div>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <div className="grid grid-cols-2 gap-2">
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="principal">Principal</SelectItem>
                  <SelectItem value="secundario">Secundário</SelectItem>
                  <SelectItem value="suspeita">Suspeita</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Observação (opcional)"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="diagnostico-data-novo" className="text-xs">Data do diagnóstico</Label>
              <Input
                id="diagnostico-data-novo"
                type="date"
                className="h-11 min-h-11"
                value={dataDiagnostico}
                min="1900-01-01"
                max={hoje}
                onChange={(e) => setDataDiagnostico(e.target.value)}
                aria-invalid={erroDaDataNova ? true : undefined}
                aria-describedby={erroDaDataNova ? 'diagnostico-data-novo-ajuda diagnostico-data-novo-erro' : 'diagnostico-data-novo-ajuda'}
              />
              <p id="diagnostico-data-novo-ajuda" className="text-xs text-muted-foreground">
                Opcional. Sem data, o diagnóstico fica em Sem data na linha do tempo.
              </p>
              {erroDaDataNova && (
                <p id="diagnostico-data-novo-erro" role="alert" className="text-xs text-destructive">{erroDaDataNova}</p>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => { setAdicionando(false); setSelecionado(null); setDataDiagnostico(''); }}>
                Cancelar
              </Button>
              <Button size="sm" onClick={() => salvar.mutate()} disabled={!selecionado || salvar.isPending}>
                {salvar.isPending ? <Loader2 className="icon-xs animate-spin" /> : 'Salvar'}
              </Button>
            </div>
          </div>
        )}

        {diagnosticos.length === 0 && !adicionando && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum diagnóstico registrado.
          </p>
        )}

        {diagnosticos.map((d) => {
          const t = TIPO_LABEL[d.tipo] || TIPO_LABEL.principal;
          const dia = diaParaMostrar(d.data_diagnostico);
          const pegouDoSistema = dataDoDiagnosticoPodeSerDoSistema(d.data_diagnostico, d.created_at, hoje);
          const emEdicao = editandoId === d.id;
          return (
            <div
              key={d.id}
              data-diagnostico-id={d.id}
              className="flex scroll-mt-24 items-start gap-3 p-3 rounded-lg border border-border/40 motion-safe:transition-colors data-[destacado=true]:border-primary data-[destacado=true]:bg-primary/10 data-[destacado=true]:ring-2 data-[destacado=true]:ring-primary/40"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{d.cid_codigo}</span>
                  <Badge variant="outline" className={cn('text-[10px]', t.cls)}>{t.label}</Badge>
                </div>
                <p className="text-sm text-foreground/90 mt-0.5">{d.cid_descricao}</p>
                {d.observacao && <p className="text-xs text-muted-foreground mt-1">{d.observacao}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  Data do diagnóstico: {dia ?? 'sem data'}
                  {pegouDoSistema && <span> · Pode ter sido preenchida pelo sistema</span>}
                </p>
                {emEdicao ? (
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      type="date"
                      className="h-11 min-h-11 sm:w-48"
                      aria-label={`Data do diagnóstico ${d.cid_codigo}`}
                      value={dataEditada}
                      min="1900-01-01"
                      max={hoje}
                      onChange={(e) => setDataEditada(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="min-h-11"
                        disabled={!dataEditada || atualizarData.isPending}
                        onClick={() => atualizarData.mutate({ id: d.id, data: dataEditada })}
                      >
                        Salvar data
                      </Button>
                      {d.data_diagnostico && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-11"
                          disabled={atualizarData.isPending}
                          onClick={() => atualizarData.mutate({ id: d.id, data: null })}
                        >
                          Limpar data
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setEditandoId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 min-h-11"
                    aria-label={`${dia ? 'Corrigir' : 'Informar'} data do diagnóstico ${d.cid_codigo}`}
                    onClick={() => abrirEdicaoDaData(d)}
                  >
                    {dia ? 'Corrigir data' : 'Informar data'}
                  </Button>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => remover.mutate(d.id)}
              >
                <Trash2 className="icon-xs text-destructive" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
