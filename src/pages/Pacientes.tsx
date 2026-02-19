import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Users, Plus, Search, Phone, Mail, Calendar, Edit2, Trash2,
  Loader2, User, Activity, AlignCenter, CalendarDays,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Paciente {
  id: string;
  nome: string;
  sobrenome: string;
  email?: string;
  telefone?: string;
  data_nascimento?: string;
  genero?: string;
  cpf?: string;
  endereco?: string;
  observacoes?: string;
  ativo: boolean;
  created_at: string;
  terapeuta_id: string;
}

interface PacienteServico {
  id: string;
  paciente_id: string;
  servico: string;
  ativo: boolean;
}

const SERVICOS = [
  { key: 'metodo_identidade', label: 'Método Identidade', icon: Activity, color: 'bg-primary/10 text-primary border-primary/20' },
  { key: 'cob_zero', label: 'COB° ZERO', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'agenda_premium', label: 'Agenda Premium', color: 'bg-amber-100 text-amber-700 border-amber-200' },
];

interface FormData {
  nome: string; sobrenome: string; email: string; telefone: string;
  data_nascimento: string; genero: string; cpf: string; endereco: string; observacoes: string;
  servicos: string[];
}

const emptyForm: FormData = {
  nome: '', sobrenome: '', email: '', telefone: '',
  data_nascimento: '', genero: '', cpf: '', endereco: '', observacoes: '',
  servicos: [],
};

export default function Pacientes() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [filterServico, setFilterServico] = useState('todos');
  const [modal, setModal] = useState<{ open: boolean; paciente?: Paciente }>({ open: false });
  const [form, setForm] = useState<FormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  // Query pacientes
  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ['pacientes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data as Paciente[];
    },
    enabled: !!user,
  });

  // Query serviços
  const { data: servicos = [] } = useQuery({
    queryKey: ['paciente_servicos', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paciente_servicos')
        .select('*')
        .eq('ativo', true);
      if (error) throw error;
      return data as PacienteServico[];
    },
    enabled: !!user,
  });

  const getServicosForPaciente = (pid: string) =>
    servicos.filter(s => s.paciente_id === pid).map(s => s.servico);

  const openNew = () => {
    setForm(emptyForm);
    setModal({ open: true });
  };

  const openEdit = (p: Paciente) => {
    setForm({
      nome: p.nome, sobrenome: p.sobrenome, email: p.email || '',
      telefone: p.telefone || '', data_nascimento: p.data_nascimento || '',
      genero: p.genero || '', cpf: p.cpf || '', endereco: p.endereco || '',
      observacoes: p.observacoes || '', servicos: getServicosForPaciente(p.id),
    });
    setModal({ open: true, paciente: p });
  };

  const handleSave = async () => {
    if (!form.nome.trim()) return toast({ title: 'Nome obrigatório', variant: 'destructive' });
    setSubmitting(true);
    try {
      let pacienteId = modal.paciente?.id;
      const payload = {
        nome: form.nome.trim(),
        sobrenome: form.sobrenome.trim(),
        email: form.email || null,
        telefone: form.telefone || null,
        data_nascimento: form.data_nascimento || null,
        genero: form.genero || null,
        cpf: form.cpf || null,
        endereco: form.endereco || null,
        observacoes: form.observacoes || null,
        terapeuta_id: user!.id,
      };

      if (pacienteId) {
        await supabase.from('pacientes').update(payload).eq('id', pacienteId);
      } else {
        const { data, error } = await supabase.from('pacientes').insert(payload).select().single();
        if (error) throw error;
        pacienteId = data.id;
      }

      // Update services: delete old ones for this paciente and insert new
      await supabase.from('paciente_servicos').delete().eq('paciente_id', pacienteId!);
      if (form.servicos.length > 0) {
        await supabase.from('paciente_servicos').insert(
          form.servicos.map(s => ({ paciente_id: pacienteId!, servico: s, ativo: true, data_inicio: new Date().toISOString().split('T')[0] }))
        );
      }

      qc.invalidateQueries({ queryKey: ['pacientes'] });
      qc.invalidateQueries({ queryKey: ['paciente_servicos'] });
      toast({ title: modal.paciente ? 'Paciente atualizado!' : 'Paciente cadastrado!' });
      setModal({ open: false });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (p: Paciente) => {
    if (!confirm(`Desativar ${p.nome} ${p.sobrenome}?`)) return;
    await supabase.from('pacientes').update({ ativo: false }).eq('id', p.id);
    qc.invalidateQueries({ queryKey: ['pacientes'] });
    toast({ title: 'Paciente removido' });
  };

  const toggleServico = (s: string) => {
    setForm(f => ({
      ...f,
      servicos: f.servicos.includes(s) ? f.servicos.filter(x => x !== s) : [...f.servicos, s],
    }));
  };

  // Filter
  const filtered = pacientes.filter(p => {
    const matchSearch = `${p.nome} ${p.sobrenome} ${p.email || ''} ${p.telefone || ''}`.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filterServico === 'todos') return true;
    return getServicosForPaciente(p.id).includes(filterServico);
  });

  if (isLoading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="container py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Meus Pacientes</h1>
              <p className="text-sm text-muted-foreground">{pacientes.length} pacientes cadastrados</p>
            </div>
          </div>
          <Button onClick={openNew} className="bg-gradient-primary text-white gap-2">
            <Plus className="h-4 w-4" /> Novo Paciente
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente..."
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterServico} onValueChange={setFilterServico}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os serviços</SelectItem>
              {SERVICOS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Patient list */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum paciente encontrado</p>
            <p className="text-sm mt-1">Clique em "Novo Paciente" para começar</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(p => {
              const pServicos = getServicosForPaciente(p.id);
              return (
                <div key={p.id} className="clinical-card flex items-center gap-4 p-4 hover:shadow-md transition-all">
                  {/* Avatar */}
                  <div className="h-11 w-11 rounded-full bg-gradient-primary flex items-center justify-center shrink-0 text-white font-bold text-sm">
                    {p.nome[0]}{p.sobrenome?.[0] || ''}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{p.nome} {p.sobrenome}</span>
                      {pServicos.map(s => {
                        const cfg = SERVICOS.find(x => x.key === s);
                        return cfg ? (
                          <Badge key={s} variant="outline" className={cn('text-[10px] h-5', cfg.color)}>
                            {cfg.label}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      {p.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>}
                      {p.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.telefone}</span>}
                      {p.data_nascimento && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(parseISO(p.data_nascimento), 'dd/MM/yyyy', { locale: ptBR })}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        Cadastrado em {format(parseISO(p.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => handleDelete(p)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={modal.open} onOpenChange={o => setModal({ open: o })}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modal.paciente ? 'Editar Paciente' : 'Novo Paciente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input placeholder="Maria" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Sobrenome</Label>
                <Input placeholder="Silva" value={form.sobrenome} onChange={e => setForm(f => ({ ...f, sobrenome: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input type="email" placeholder="maria@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input placeholder="(11) 98765-4321" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Data de Nascimento</Label>
                <Input type="date" value={form.data_nascimento} onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Gênero</Label>
                <Select value={form.genero} onValueChange={v => setForm(f => ({ ...f, genero: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>CPF</Label>
                <Input placeholder="123.456.789-00" value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea placeholder="Histórico clínico, alergias..." rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>

            {/* Serviços */}
            <div className="space-y-2">
              <Label>Serviços</Label>
              <div className="space-y-2">
                {SERVICOS.map(s => (
                  <label key={s.key} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/20 transition-colors">
                    <Checkbox
                      checked={form.servicos.includes(s.key)}
                      onCheckedChange={() => toggleServico(s.key)}
                    />
                    <span className="text-sm font-medium">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setModal({ open: false })}>Cancelar</Button>
              <Button className="flex-1 bg-gradient-primary text-white" onClick={handleSave} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
