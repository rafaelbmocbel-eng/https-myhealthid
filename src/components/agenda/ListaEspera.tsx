import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, MessageCircle, Check, X, Loader2, Clock } from 'lucide-react';
import { useListaEspera, ItemListaEspera } from '@/hooks/useListaEspera';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const TIPOS = [
  { value: 'retorno', label: 'Retorno' },
  { value: 'primeira_consulta', label: 'Primeira consulta' },
  { value: 'reavaliacao', label: 'Reavaliação' },
  { value: 'outro', label: 'Outro' },
];

interface NovoItem {
  nome_contato: string;
  telefone: string;
  tipo_atendimento: string;
  data_preferida: string;
  horario_preferido_inicio: string;
  observacoes: string;
}

const NOVO_DEFAULT: NovoItem = {
  nome_contato: '', telefone: '', tipo_atendimento: 'retorno',
  data_preferida: '', horario_preferido_inicio: '', observacoes: '',
};

export default function ListaEspera() {
  const { data, isLoading, adicionar, notificar, remover } = useListaEspera();
  const [addOpen, setAddOpen] = useState(false);
  const [novo, setNovo] = useState<NovoItem>(NOVO_DEFAULT);

  async function handleAdicionar() {
    if (!novo.nome_contato.trim() || !novo.telefone.trim()) return;
    await adicionar.mutateAsync({
      nome_contato: novo.nome_contato.trim(),
      telefone: novo.telefone.replace(/\D/g, ''),
      tipo_atendimento: novo.tipo_atendimento,
      data_preferida: novo.data_preferida || null,
      horario_preferido_inicio: novo.horario_preferido_inicio || null,
      horario_preferido_fim: null,
      observacoes: novo.observacoes || null,
      paciente_id: null,
    });
    setNovo(NOVO_DEFAULT);
    setAddOpen(false);
  }

  return (
    <>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs relative">
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Lista de espera</span>
            {data.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 min-w-[16px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                {data.length}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-4 pt-4 pb-2 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-500" />
              Lista de espera
              {data.length > 0 && <Badge variant="secondary">{data.length}</Badge>}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <Button size="sm" className="w-full gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Adicionar à lista
            </Button>

            {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}

            {!isLoading && data.length === 0 && (
              <div className="text-center py-12">
                <Users className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum paciente na lista de espera</p>
              </div>
            )}

            {data.map((item, i) => (
              <ItemCard key={item.id} item={item} posicao={i + 1} onNotificar={notificar.mutate} onRemover={remover.mutate} />
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adicionar à lista de espera</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input value={novo.nome_contato} onChange={e => setNovo(n => ({ ...n, nome_contato: e.target.value }))} placeholder="Nome do paciente" />
            </div>
            <div>
              <Label className="text-xs">WhatsApp *</Label>
              <Input value={novo.telefone} onChange={e => setNovo(n => ({ ...n, telefone: e.target.value }))} placeholder="(91) 98449-0898" type="tel" />
            </div>
            <div>
              <Label className="text-xs">Tipo de atendimento</Label>
              <Select value={novo.tipo_atendimento} onValueChange={v => setNovo(n => ({ ...n, tipo_atendimento: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Data preferida</Label>
                <Input type="date" value={novo.data_preferida} onChange={e => setNovo(n => ({ ...n, data_preferida: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Horário preferido</Label>
                <Input type="time" value={novo.horario_preferido_inicio} onChange={e => setNovo(n => ({ ...n, horario_preferido_inicio: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={novo.observacoes} onChange={e => setNovo(n => ({ ...n, observacoes: e.target.value }))} rows={2} placeholder="Urgência, preferências..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdicionar} disabled={adicionar.isPending || !novo.nome_contato || !novo.telefone}>
              {adicionar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ItemCard({ item, posicao, onNotificar, onRemover }: {
  item: ItemListaEspera;
  posicao: number;
  onNotificar: (p: { id: string; telefone: string; nome: string }) => void;
  onRemover: (p: { id: string; status: 'agendou' | 'desistiu' }) => void;
}) {
  const nome = item.pacientes ? `${item.pacientes.nome} ${item.pacientes.sobrenome}` : item.nome_contato;

  return (
    <div className="rounded-xl border border-border/60 p-3 space-y-2 bg-card">
      <div className="flex items-start gap-2.5">
        <span className="h-6 w-6 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center shrink-0">
          {posicao}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm leading-tight truncate">{nome}</div>
          <div className="text-[11px] text-muted-foreground">{item.telefone}</div>
        </div>
        <Badge variant={item.status === 'notificado' ? 'default' : 'secondary'} className="text-[10px] shrink-0">
          {item.status === 'notificado' ? 'Notificado' : 'Aguardando'}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground pl-8">
        {item.tipo_atendimento && (
          <span className="px-1.5 py-0.5 rounded-full bg-muted">{TIPOS.find(t => t.value === item.tipo_atendimento)?.label ?? item.tipo_atendimento}</span>
        )}
        {item.data_preferida && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(item.data_preferida + 'T12:00:00'), "d 'de' MMM", { locale: ptBR })}
            {item.horario_preferido_inicio && ` às ${item.horario_preferido_inicio.slice(0, 5)}`}
          </span>
        )}
        {item.notificado_em && (
          <span className="text-[#008069]">
            Notificado {format(new Date(item.notificado_em), "dd/MM HH:mm")}
          </span>
        )}
      </div>

      {item.observacoes && (
        <div className="text-[11px] text-muted-foreground pl-8 italic truncate">{item.observacoes}</div>
      )}

      <div className="flex gap-2 pl-8">
        <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-[11px] text-[#008069] border-[#008069]/30 hover:bg-[#008069]/10 flex-1"
          onClick={() => onNotificar({ id: item.id, telefone: item.telefone, nome: nome })}>
          <MessageCircle className="h-3 w-3" /> Notificar no WhatsApp
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-emerald-600"
          onClick={() => onRemover({ id: item.id, status: 'agendou' })}>
          <Check className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive"
          onClick={() => onRemover({ id: item.id, status: 'desistiu' })}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
