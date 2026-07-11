import { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/page-header';
import { toast } from 'sonner';
import { Dumbbell, Plus, Pencil, Trash2, Loader2, Search, Upload, ImageOff, X } from 'lucide-react';

interface Exercicio {
  id: string;
  nome: string;
  grupo_muscular: string | null;
  orientacoes: string | null;
  gif_url: string | null;
  equipamento: string | null;
  series_padrao: number | null;
  repeticoes_padrao: number | null;
  descanso_padrao_segundos: number | null;
}

const VAZIO = {
  nome: '', grupo_muscular: '', orientacoes: '', gif_url: '', equipamento: '',
  series_padrao: 3, repeticoes_padrao: 12, descanso_padrao_segundos: 45,
};

export default function BibliotecaExercicios() {
  const { user } = useAuth();
  const [lista, setLista] = useState<Exercicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [edit, setEdit] = useState<(typeof VAZIO & { id?: string }) | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [subindo, setSubindo] = useState(false);

  const carregar = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('biblioteca_exercicios')
      .select('*')
      .eq('terapeuta_id', user.id)
      .eq('ativo', true)
      .order('nome', { ascending: true });
    setLista((data || []) as Exercicio[]);
    setLoading(false);
  };

  useEffect(() => { carregar(); }, [user]);

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return lista;
    return lista.filter(e =>
      e.nome.toLowerCase().includes(q) || (e.grupo_muscular || '').toLowerCase().includes(q));
  }, [lista, busca]);

  const uploadGif = async (file: File) => {
    if (!user) return;
    if (!/\.(gif|png|jpe?g|webp)$/i.test(file.name) && !file.type.startsWith('image/')) {
      toast.error('Envie um arquivo de imagem (GIF de preferência).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) { toast.error('Arquivo maior que 15MB.'); return; }
    setSubindo(true);
    try {
      const ext = file.name.split('.').pop() || 'gif';
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('exercise-gifs').upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('exercise-gifs').getPublicUrl(path);
      setEdit(s => s ? { ...s, gif_url: data.publicUrl } : s);
      toast.success('GIF enviado');
    } catch (e: any) {
      toast.error('Erro no upload: ' + e.message);
    } finally {
      setSubindo(false);
    }
  };

  const salvar = async () => {
    if (!edit || !user) return;
    if (!edit.nome.trim()) { toast.error('Dê um nome ao exercício.'); return; }
    setSalvando(true);
    const payload = {
      terapeuta_id: user.id,
      nome: edit.nome.trim(),
      grupo_muscular: edit.grupo_muscular.trim() || null,
      orientacoes: edit.orientacoes.trim() || null,
      gif_url: edit.gif_url || null,
      equipamento: edit.equipamento.trim() || null,
      series_padrao: Number(edit.series_padrao) || null,
      repeticoes_padrao: Number(edit.repeticoes_padrao) || null,
      descanso_padrao_segundos: Number(edit.descanso_padrao_segundos) || null,
    };
    const resp = edit.id
      ? await supabase.from('biblioteca_exercicios').update(payload).eq('id', edit.id)
      : await supabase.from('biblioteca_exercicios').insert(payload);
    setSalvando(false);
    if (resp.error) { toast.error('Erro ao salvar: ' + resp.error.message); return; }
    toast.success(edit.id ? 'Exercício atualizado' : 'Exercício adicionado');
    setEdit(null);
    carregar();
  };

  const remover = async (id: string) => {
    const { error } = await supabase.from('biblioteca_exercicios').update({ ativo: false }).eq('id', id);
    if (error) return toast.error('Erro: ' + error.message);
    setLista(l => l.filter(e => e.id !== id));
    toast.success('Removido');
  };

  return (
    <AppLayout>
      <div className="container max-w-4xl py-6 space-y-4">
        <PageHeader back title="Biblioteca de Exercícios" subtitle="Cadastre uma vez e reaproveite ao montar treinos." />

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou grupo…" value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
          </div>
          <Button onClick={() => setEdit({ ...VAZIO })} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtradas.length === 0 ? (
          <Card><CardContent className="p-10 text-center">
            <Dumbbell className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">{busca ? 'Nenhum exercício encontrado' : 'Sua biblioteca está vazia'}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Toque em "Novo" para adicionar seu primeiro exercício.</p>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtradas.map(ex => (
              <Card key={ex.id} className="overflow-hidden group">
                <div className="aspect-square bg-muted/40 flex items-center justify-center overflow-hidden">
                  {ex.gif_url
                    ? <img src={ex.gif_url} alt={ex.nome} className="w-full h-full object-cover" loading="lazy" />
                    : <ImageOff className="h-8 w-8 text-muted-foreground/30" />}
                </div>
                <CardContent className="p-2.5">
                  <p className="text-xs font-semibold truncate">{ex.nome}</p>
                  {ex.grupo_muscular && <p className="text-[10px] text-muted-foreground truncate">{ex.grupo_muscular}</p>}
                  <div className="flex items-center gap-1 mt-1.5">
                    <Button size="sm" variant="outline" className="h-7 flex-1 text-[11px] px-2"
                      onClick={() => setEdit({
                        id: ex.id, nome: ex.nome, grupo_muscular: ex.grupo_muscular || '', orientacoes: ex.orientacoes || '',
                        gif_url: ex.gif_url || '', equipamento: ex.equipamento || '',
                        series_padrao: ex.series_padrao ?? 3, repeticoes_padrao: ex.repeticoes_padrao ?? 12,
                        descanso_padrao_segundos: ex.descanso_padrao_segundos ?? 45,
                      })}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-destructive hover:text-destructive"
                      onClick={() => remover(ex.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Form add/edit */}
      <Dialog open={!!edit} onOpenChange={o => { if (!o) setEdit(null); }}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? 'Editar exercício' : 'Novo exercício'}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              {/* GIF */}
              <div>
                <Label className="text-xs">GIF animado do exercício</Label>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-24 w-24 rounded-xl bg-muted/40 border border-border/50 flex items-center justify-center overflow-hidden shrink-0">
                    {edit.gif_url
                      ? <img src={edit.gif_url} alt="" className="w-full h-full object-cover" />
                      : <ImageOff className="h-6 w-6 text-muted-foreground/30" />}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background text-xs font-medium cursor-pointer hover:bg-muted">
                      {subindo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {edit.gif_url ? 'Trocar GIF' : 'Enviar GIF'}
                      <input type="file" accept="image/gif,image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadGif(f); e.currentTarget.value = ''; }} />
                    </label>
                    {edit.gif_url && (
                      <button onClick={() => setEdit(s => s ? { ...s, gif_url: '' } : s)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive">
                        <X className="h-3 w-3" /> remover
                      </button>
                    )}
                    <p className="text-[10px] text-muted-foreground">GIF de preferência (até 15MB). Roda em loop no app do paciente.</p>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs">Nome do exercício *</Label>
                <Input value={edit.nome} onChange={e => setEdit({ ...edit, nome: e.target.value })} placeholder="Ex: Agachamento livre" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Grupo muscular</Label>
                  <Input value={edit.grupo_muscular} onChange={e => setEdit({ ...edit, grupo_muscular: e.target.value })} placeholder="Ex: Membros inferiores" />
                </div>
                <div>
                  <Label className="text-xs">Equipamento</Label>
                  <Input value={edit.equipamento} onChange={e => setEdit({ ...edit, equipamento: e.target.value })} placeholder="Ex: Halteres / livre" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Orientações</Label>
                <Textarea rows={3} value={edit.orientacoes} onChange={e => setEdit({ ...edit, orientacoes: e.target.value })}
                  placeholder="Como executar, cuidados, respiração…" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Séries</Label>
                  <Input type="number" inputMode="numeric" value={edit.series_padrao}
                    onChange={e => setEdit({ ...edit, series_padrao: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Repetições</Label>
                  <Input type="number" inputMode="numeric" value={edit.repeticoes_padrao}
                    onChange={e => setEdit({ ...edit, repeticoes_padrao: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Descanso (s)</Label>
                  <Input type="number" inputMode="numeric" value={edit.descanso_padrao_segundos}
                    onChange={e => setEdit({ ...edit, descanso_padrao_segundos: Number(e.target.value) })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando || subindo}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
