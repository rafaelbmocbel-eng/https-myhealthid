import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Package, Plus, Edit, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';

const PACOTES_PREDEFINIDOS = [
  { label: '5 sessões', total: 5 },
  { label: '10 sessões', total: 10 },
  { label: '15 sessões', total: 15 },
  { label: '20 sessões', total: 20 },
  { label: '30 sessões', total: 30 },
];

interface PacoteSessoesManagerProps {
  pacienteId: string;
  compact?: boolean; // for KPI card mode
}

export default function PacoteSessoesManager({ pacienteId, compact = false }: PacoteSessoesManagerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingPacote, setEditingPacote] = useState<any>(null);
  const [form, setForm] = useState({ nome: '', total_sessoes: 10, valor_total: '', observacoes: '' });

  const { data: pacotes = [], isLoading } = useQuery({
    queryKey: ['pacotes-sessoes', pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('pacotes_sessoes')
        .select('*')
        .eq('paciente_id', pacienteId)
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!pacienteId,
  });

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      if (editingPacote) {
        const { error } = await (supabase as any)
          .from('pacotes_sessoes')
          .update(values)
          .eq('id', editingPacote.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('pacotes_sessoes')
          .insert({ ...values, paciente_id: pacienteId, terapeuta_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pacotes-sessoes', pacienteId] });
      toast({ title: editingPacote ? 'Pacote atualizado!' : 'Pacote criado!' });
      setShowDialog(false);
      setEditingPacote(null);
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const finalizarMutation = useMutation({
    mutationFn: async (pacoteId: string) => {
      const { error } = await (supabase as any)
        .from('pacotes_sessoes')
        .update({ status: 'finalizado', data_fim: new Date().toISOString().split('T')[0] })
        .eq('id', pacoteId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pacotes-sessoes', pacienteId] });
      toast({ title: 'Pacote finalizado!' });
    },
  });

  const openNew = () => {
    setEditingPacote(null);
    setForm({ nome: 'Pacote', total_sessoes: 10, valor_total: '', observacoes: '' });
    setShowDialog(true);
  };

  const openEdit = (p: any) => {
    setEditingPacote(p);
    setForm({
      nome: p.nome,
      total_sessoes: p.total_sessoes,
      valor_total: p.valor_total?.toString() || '',
      observacoes: p.observacoes || '',
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    saveMutation.mutate({
      nome: form.nome || 'Pacote',
      total_sessoes: form.total_sessoes,
      valor_total: form.valor_total ? parseFloat(form.valor_total) : null,
      observacoes: form.observacoes || null,
    });
  };

  const pacoteAtivo = pacotes.find((p: any) => p.status === 'ativo');

  // Compact mode: just show active package info as a KPI-style card
  if (compact) {
    if (isLoading) return null;
    return (
      <div
        className="clinical-card !p-2.5 text-center cursor-pointer hover:shadow-sm transition-shadow"
        onClick={pacoteAtivo ? () => openEdit(pacoteAtivo) : openNew}
        title={pacoteAtivo ? 'Editar pacote' : 'Criar pacote'}
      >
        <Package className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
        {pacoteAtivo ? (
          <>
            <div className="text-base font-bold leading-tight">
              {pacoteAtivo.sessoes_utilizadas}/{pacoteAtivo.total_sessoes}
            </div>
            <div className="text-[9px] text-muted-foreground">
              {pacoteAtivo.total_sessoes - pacoteAtivo.sessoes_utilizadas > 0
                ? `${pacoteAtivo.total_sessoes - pacoteAtivo.sessoes_utilizadas} restantes`
                : 'Completo ✓'}
            </div>
            <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min(100, (pacoteAtivo.sessoes_utilizadas / pacoteAtivo.total_sessoes) * 100)}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <div className="text-base font-bold leading-tight text-muted-foreground">—</div>
            <div className="text-[9px] text-muted-foreground">Pacote</div>
          </>
        )}
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <PacoteDialog
            form={form}
            setForm={setForm}
            onSave={handleSave}
            saving={saveMutation.isPending}
            isEditing={!!editingPacote}
          />
        </Dialog>
      </div>
    );
  }

  // Full mode: list all packages with management
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" /> Pacotes de Sessões
        </h3>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={openNew}>
          <Plus className="h-3 w-3" /> Novo Pacote
        </Button>
      </div>

      {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary mx-auto" />}

      {!isLoading && pacotes.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            Nenhum pacote criado. Crie um para controlar sessões.
          </CardContent>
        </Card>
      )}

      {pacotes.map((p: any) => {
        const pct = Math.min(100, (p.sessoes_utilizadas / p.total_sessoes) * 100);
        const isAtivo = p.status === 'ativo';
        return (
          <Card key={p.id} className={!isAtivo ? 'opacity-60' : ''}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{p.nome}</span>
                  <Badge variant={isAtivo ? 'default' : 'secondary'} className="text-[10px] h-5">
                    {p.status === 'ativo' ? 'Ativo' : p.status === 'finalizado' ? 'Finalizado' : 'Cancelado'}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  {isAtivo && (
                    <>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(p)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-emerald-600" onClick={() => finalizarMutation.mutate(p.id)} title="Finalizar">
                        <CheckCircle2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1.5">
                <span className="font-bold text-foreground text-sm">{p.sessoes_utilizadas}/{p.total_sessoes} sessões</span>
                {p.valor_total && <span>R$ {Number(p.valor_total).toFixed(2)}</span>}
                {p.data_inicio && <span>Início: {format(parseISO(p.data_inicio), 'dd/MM/yy')}</span>}
              </div>
              <Progress value={pct} className="h-2" />
              {p.observacoes && <p className="text-[10px] text-muted-foreground mt-1.5">{p.observacoes}</p>}
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <PacoteDialog
          form={form}
          setForm={setForm}
          onSave={handleSave}
          saving={saveMutation.isPending}
          isEditing={!!editingPacote}
        />
      </Dialog>
    </div>
  );
}

function PacoteDialog({ form, setForm, onSave, saving, isEditing }: {
  form: { nome: string; total_sessoes: number; valor_total: string; observacoes: string };
  setForm: (f: any) => void;
  onSave: () => void;
  saving: boolean;
  isEditing: boolean;
}) {
  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Editar Pacote' : 'Novo Pacote'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Nome do pacote</Label>
          <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Pacote Mensal" />
        </div>
        <div>
          <Label className="text-xs">Quantidade de sessões</Label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {PACOTES_PREDEFINIDOS.map((p) => (
              <Button
                key={p.total}
                size="sm"
                variant={form.total_sessoes === p.total ? 'default' : 'outline'}
                className="h-7 text-xs"
                onClick={() => setForm({ ...form, total_sessoes: p.total, nome: form.nome || p.label })}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <Input
            type="number"
            min={1}
            value={form.total_sessoes}
            onChange={(e) => setForm({ ...form, total_sessoes: parseInt(e.target.value) || 1 })}
            placeholder="Ou digite um valor personalizado"
          />
        </div>
        <div>
          <Label className="text-xs">Valor total (R$)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.valor_total}
            onChange={(e) => setForm({ ...form, valor_total: e.target.value })}
            placeholder="Opcional"
          />
        </div>
        <div>
          <Label className="text-xs">Observações</Label>
          <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} placeholder="Opcional" />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={onSave} disabled={saving} className="w-full gap-2">
          {saving && <Loader2 className="h-3 w-3 animate-spin" />}
          {isEditing ? 'Salvar' : 'Criar Pacote'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
