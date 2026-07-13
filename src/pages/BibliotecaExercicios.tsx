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
import { Dumbbell, Plus, Pencil, Trash2, Loader2, Search, Upload, ImageOff, X, FolderUp, FileArchive, Languages } from 'lucide-react';

interface Exercicio {
  id: string;
  nome: string;
  grupo_muscular: string | null;
  orientacoes: string | null;
  gif_url: string | null;
  gif_url_fem: string | null;
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
  const [pack, setPack] = useState<{ done: number; total: number } | null>(null);

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

  // ── Envio em massa inteligente ─────────────────────────────────────────────
  // Aceita GIFs avulsos, PASTA inteira ou arquivo ZIP. Detecta as variantes
  // masculino/feminino pelo nome/caminho (male/female, _m/_f, man/woman) e
  // junta as duas no MESMO exercício. Traduz o nome do inglês e sugere o
  // grupo muscular pelas palavras do arquivo.
  const DICIONARIO: [RegExp, string][] = [
    [/\bsquats?\b/gi, 'Agachamento'], [/\blunges?\b/gi, 'Afundo'],
    [/\bpush[ -]?ups?\b/gi, 'Flexão de braço'], [/\bpull[ -]?ups?\b/gi, 'Barra fixa'],
    [/\bchin[ -]?ups?\b/gi, 'Barra supinada'], [/\bplanks?\b/gi, 'Prancha'],
    [/\bcrunch(es)?\b/gi, 'Abdominal'], [/\bsit[ -]?ups?\b/gi, 'Abdominal completo'],
    [/\bdeadlifts?\b/gi, 'Levantamento terra'], [/\bbench press\b/gi, 'Supino'],
    [/\bshoulder press\b/gi, 'Desenvolvimento de ombro'], [/\boverhead press\b/gi, 'Desenvolvimento'],
    [/\bpress\b/gi, 'Pressão'], [/\bcurls?\b/gi, 'Rosca'], [/\bbiceps?\b/gi, 'Bíceps'],
    [/\btriceps?\b/gi, 'Tríceps'], [/\brows?\b/gi, 'Remada'], [/\bdips?\b/gi, 'Mergulho'],
    [/\bbridges?\b/gi, 'Ponte'], [/\bglute\b/gi, 'Glúteo'], [/\bhip thrusts?\b/gi, 'Elevação de quadril'],
    [/\bcalf raises?\b/gi, 'Elevação de panturrilha'], [/\braises?\b/gi, 'Elevação'],
    [/\bstretch(ing|es)?\b/gi, 'Alongamento'], [/\bjumping jacks?\b/gi, 'Polichinelo'],
    [/\bjumps?\b/gi, 'Salto'], [/\bburpees?\b/gi, 'Burpee'], [/\bmountain climbers?\b/gi, 'Escalador'],
    [/\bhigh knees\b/gi, 'Corrida com joelho alto'], [/\bkicks?\b/gi, 'Chute'],
    [/\bkickbacks?\b/gi, 'Extensão para trás'], [/\btwists?\b/gi, 'Rotação'],
    [/\brussian\b/gi, 'russa'], [/\bside\b/gi, 'lateral'], [/\bfront\b/gi, 'frontal'],
    [/\bback\b/gi, 'costas'], [/\breverse\b/gi, 'invertido'], [/\bsingle leg\b/gi, 'unilateral'],
    [/\bleg\b/gi, 'perna'], [/\blegs\b/gi, 'pernas'], [/\barms?\b/gi, 'braço'],
    [/\bknee(s)?\b/gi, 'joelho'], [/\bchest\b/gi, 'peito'], [/\bshoulders?\b/gi, 'ombro'],
    [/\bdumbbells?\b/gi, 'com halteres'], [/\bbarbells?\b/gi, 'com barra'],
    [/\bkettlebells?\b/gi, 'com kettlebell'], [/\bresistance band\b/gi, 'com faixa elástica'],
    [/\bbands?\b/gi, 'com faixa'], [/\bwall\b/gi, 'na parede'], [/\bchair\b/gi, 'na cadeira'],
    [/\bstanding\b/gi, 'em pé'], [/\bseated\b/gi, 'sentado'], [/\blying\b/gi, 'deitado'],
    [/\bwalking\b/gi, 'caminhando'], [/\brunning\b/gi, 'corrida'], [/\brotations?\b/gi, 'rotação'],
    [/\bextensions?\b/gi, 'extensão'], [/\bflexions?\b/gi, 'flexão'], [/\bholds?\b/gi, 'isometria'],
  ];
  const GRUPOS: [RegExp, string][] = [
    [/squat|lunge|leg|calf|glute|hip|deadlift/i, 'Pernas e glúteos'],
    [/push[ -]?up|bench|chest|dip/i, 'Peito'],
    [/pull[ -]?up|chin[ -]?up|row|back|lat/i, 'Costas'],
    [/shoulder|overhead|lateral raise|front raise/i, 'Ombros'],
    [/curl|bicep/i, 'Bíceps'], [/tricep|kickback/i, 'Tríceps'],
    [/plank|crunch|sit[ -]?up|ab|core|twist|mountain/i, 'Core / abdômen'],
    [/stretch|mobility/i, 'Alongamento / mobilidade'],
    [/jump|burpee|jack|cardio|high knee|running/i, 'Cardio'],
  ];
  const traduzir = (base: string) => {
    let t = ` ${base.replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
    for (const [re, pt] of DICIONARIO) t = t.replace(re, pt);
    t = t.replace(/\s+/g, ' ').trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const grupoDe = (base: string) => GRUPOS.find(([re]) => re.test(base))?.[1] || null;

  const [packInfo, setPackInfo] = useState<string | null>(null);

  const uploadPack = async (files: { name: string; path: string; blob: Blob }[]) => {
    if (!user || files.length === 0) return;
    const imgs = files.filter(f => /\.(gif|png|jpe?g|webp)$/i.test(f.name));
    if (imgs.length === 0) { toast.error('Nenhuma imagem/GIF encontrada.'); return; }

    // Agrupa por exercício: remove o marcador de sexo do nome → mesma chave
    type Par = { base: string; masc?: typeof imgs[number]; fem?: typeof imgs[number] };
    const pares = new Map<string, Par>();
    for (const f of imgs) {
      const semExt = f.name.replace(/\.[^.]+$/, '');
      const caminho = `${f.path} ${semExt}`;
      // "female" contém "male" — por isso o feminino é testado primeiro e com tokens completos
      const ehFem = /female|woman|women|girl/i.test(caminho) ||
        (/(^|[^a-z])(fem|f)([^a-z]|$)/i.test(semExt) && !/(^|[^a-z])(male|man|men|m)([^a-z]|$)/i.test(semExt));
      const base = semExt
        .replace(/(^|[^a-z])(female|females|male|males|woman|women|man|men|girl|boy|fem)([^a-z]|$)/gi, '$1$3')
        .replace(/(^|[_\- ])(f|m)([_\- ]|$)/gi, '$1$3')
        .replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase() || semExt.toLowerCase();
      const par = pares.get(base) || { base };
      if (ehFem) par.fem = par.fem || f; else par.masc = par.masc || f;
      pares.set(base, par);
    }

    // Evita duplicar em re-envios: pula o que já existe pelo nome original
    const { data: existentes } = await supabase.from('biblioteca_exercicios')
      .select('nome_original').eq('terapeuta_id', user.id).eq('ativo', true);
    const jaTem = new Set((existentes || []).map((e: any) => (e.nome_original || '').toLowerCase()).filter(Boolean));

    const lista = [...pares.values()];
    setPack({ done: 0, total: lista.length });
    let ok = 0, duplicados = 0, falhas = 0, comPar = 0;

    const subir = async (f: { name: string; blob: Blob }, i: number, sufixo: string) => {
      const ext = f.name.split('.').pop() || 'gif';
      const path = `${user.id}/${Date.now()}-${i}${sufixo}.${ext}`;
      const { error } = await supabase.storage.from('exercise-gifs')
        .upload(path, f.blob, { upsert: true, contentType: 'image/gif' });
      if (error) throw error;
      return supabase.storage.from('exercise-gifs').getPublicUrl(path).data.publicUrl;
    };

    for (let i = 0; i < lista.length; i++) {
      const par = lista[i];
      try {
        if (jaTem.has(par.base)) { duplicados++; setPack({ done: i + 1, total: lista.length }); continue; }
        const principal = par.masc || par.fem!;
        if (principal.blob.size > 15 * 1024 * 1024) throw new Error('maior que 15MB');
        const urlMasc = par.masc ? await subir(par.masc, i, '') : null;
        const urlFem = par.fem ? await subir(par.fem, i, '-f') : null;
        if (par.masc && par.fem) comPar++;
        const { error: insErr } = await supabase.from('biblioteca_exercicios').insert({
          terapeuta_id: user.id,
          nome: traduzir(par.base),
          nome_original: par.base,
          grupo_muscular: grupoDe(par.base),
          gif_url: urlMasc || urlFem,
          gif_url_fem: urlFem,
          series_padrao: 3, repeticoes_padrao: 12, descanso_padrao_segundos: 45,
        } as any);
        if (insErr) throw insErr;
        ok++;
      } catch {
        falhas++;
      }
      setPack({ done: i + 1, total: lista.length });
    }
    setPack(null);
    setPackInfo(`✅ ${ok} exercícios criados${comPar ? ` (${comPar} com avatar M+F)` : ''}${duplicados ? ` · ${duplicados} já existiam` : ''}${falhas ? ` · ${falhas} falharam` : ''}`);
    toast.success(`${ok} exercício(s) adicionado(s)`);
    carregar();
  };

  const filesDeFileList = (fl: FileList) =>
    Array.from(fl).map(f => ({ name: f.name, path: (f as any).webkitRelativePath || f.name, blob: f as Blob }));

  const uploadZip = async (file: File) => {
    try {
      if (!file.size) {
        toast.error('O arquivo chegou vazio (0 bytes). Se ele está no OneDrive/Drive, baixe primeiro para o computador e tente de novo.');
        return;
      }
      toast.info('Abrindo o ZIP…');
      const JSZip = (await import('jszip')).default;
      let dados: ArrayBuffer;
      try {
        dados = await file.arrayBuffer();
      } catch {
        // NotReadableError: o navegador perdeu o acesso ao arquivo depois da seleção
        // (OneDrive "sob demanda", pasta de rede, download/sincronização em andamento,
        // arquivo aberto em outro programa). Não é falha do app — orienta o caminho.
        toast.error(
          'O navegador perdeu o acesso ao arquivo. Copie o ZIP para uma pasta local do computador (ex.: Downloads ou Área de Trabalho), feche programas que estejam usando ele e tente de novo. Alternativa: descompacte e use "Enviar pasta inteira".',
          { duration: 12000 },
        );
        return;
      }
      const zip = await JSZip.loadAsync(dados);
      const out: { name: string; path: string; blob: Blob }[] = [];
      for (const [path, entry] of Object.entries(zip.files)) {
        if ((entry as any).dir) continue;
        if (!/\.(gif|png|jpe?g|webp)$/i.test(path)) continue;
        const blob = await (entry as any).async('blob');
        out.push({ name: path.split('/').pop() || path, path, blob });
      }
      if (out.length === 0) { toast.error('O ZIP não contém imagens/GIFs.'); return; }
      await uploadPack(out);
    } catch (e: any) {
      toast.error('Erro ao ler o ZIP: ' + (e.message || e));
    }
  };

  const [traduzindo, setTraduzindo] = useState(false);

  // Tradução COMPLETA dos nomes via IA — pega o nome original do arquivo (em
  // inglês) e devolve o nome de academia em português, para toda a biblioteca.
  const traduzirTudo = async () => {
    setTraduzindo(true);
    try {
      const { data, error } = await supabase.functions.invoke('traduzir-biblioteca', { body: {} });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = data as any;
      setPackInfo(`🌐 ${d.traduzidos} de ${d.total} nomes traduzidos${d.falhas ? ` · ${d.falhas} falharam (tente de novo)` : ''}`);
      toast.success(`${d.traduzidos} nome(s) traduzido(s)`);
      carregar();
    } catch (e: any) {
      toast.error('Erro ao traduzir: ' + (e.message || e));
    } finally {
      setTraduzindo(false);
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

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background text-xs font-medium cursor-pointer hover:bg-muted shrink-0 whitespace-nowrap">
            {pack ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {pack ? `${pack.done}/${pack.total}` : 'Enviar GIFs'}
            <input type="file" accept="image/gif,image/*" multiple className="hidden" disabled={!!pack}
              onChange={e => { if (e.target.files) uploadPack(filesDeFileList(e.target.files)); e.currentTarget.value = ''; }} />
          </label>
          <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background text-xs font-medium cursor-pointer hover:bg-muted shrink-0 whitespace-nowrap">
            <FolderUp className="h-4 w-4" /> Enviar pasta inteira
            <input type="file" multiple className="hidden" disabled={!!pack}
              {...({ webkitdirectory: '', directory: '' } as any)}
              onChange={e => { if (e.target.files) uploadPack(filesDeFileList(e.target.files)); e.currentTarget.value = ''; }} />
          </label>
          <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-background text-xs font-medium cursor-pointer hover:bg-muted shrink-0 whitespace-nowrap">
            <FileArchive className="h-4 w-4" /> Enviar ZIP
            <input type="file" accept=".zip,application/zip,application/x-zip-compressed" className="hidden" disabled={!!pack}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadZip(f); e.currentTarget.value = ''; }} />
          </label>
          <button type="button" onClick={traduzirTudo} disabled={traduzindo || !!pack}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-primary/30 bg-primary/5 text-primary text-xs font-medium hover:bg-primary/10 shrink-0 whitespace-nowrap disabled:opacity-50">
            {traduzindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
            {traduzindo ? 'Traduzindo…' : 'Traduzir nomes (IA)'}
          </button>
        </div>
        {packInfo && (
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-3 py-2">
            {packInfo}
          </p>
        )}
        <p className="text-[11px] text-muted-foreground -mt-1">
          Envie GIFs avulsos, a pasta inteira ou o arquivo ZIP. As versões masculina e feminina do mesmo exercício
          (male/female no nome) são juntadas automaticamente em um só e o grupo muscular é sugerido. Depois toque em
          "Traduzir nomes (IA)" para converter TODOS os nomes do inglês para o português de academia.
        </p>

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
                <div className="relative aspect-square bg-muted/40 flex items-center justify-center overflow-hidden">
                  {ex.gif_url
                    ? <img src={ex.gif_url} alt={ex.nome} className="w-full h-full object-cover" loading="lazy" />
                    : <ImageOff className="h-8 w-8 text-muted-foreground/30" />}
                  {ex.gif_url_fem && (
                    <span className="absolute top-1.5 right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-background/85 border border-border/60 text-foreground/80">
                      M+F
                    </span>
                  )}
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
