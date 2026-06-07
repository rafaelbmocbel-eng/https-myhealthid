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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Stethoscope, Plus, Trash2, Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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
      const { error } = await (supabase as any).from('diagnosticos_paciente').insert({
        paciente_id: pacienteId,
        terapeuta_id: user.id,
        cid_codigo: selecionado.codigo,
        cid_descricao: selecionado.descricao,
        tipo,
        observacao: observacao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Diagnóstico adicionado');
      qc.invalidateQueries({ queryKey: ['diagnosticos', pacienteId] });
      setSelecionado(null);
      setObservacao('');
      setTipo('principal');
      setAdicionando(false);
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('diagnosticos_paciente')
        .update({ ativo: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diagnosticos', pacienteId] }),
  });

  return (
    <Card className="rounded-xl border-border/40 shadow-xs">
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

            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => { setAdicionando(false); setSelecionado(null); }}>
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
          return (
            <div key={d.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/40">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{d.cid_codigo}</span>
                  <Badge variant="outline" className={cn('text-[10px]', t.cls)}>{t.label}</Badge>
                </div>
                <p className="text-sm text-foreground/90 mt-0.5">{d.cid_descricao}</p>
                {d.observacao && <p className="text-xs text-muted-foreground mt-1">{d.observacao}</p>}
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
