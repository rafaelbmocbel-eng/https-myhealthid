import { useState, useEffect, useRef, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Search, Send, MessageCircle, Phone, User, Loader2, Zap, StickyNote, Trash2, Plus, Sparkles, Bot, Kanban, Settings, Paperclip, Image as ImageIcon, FileText, X, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import WhatsappAutomacoes from '@/pages/WhatsappAutomacoes';
import { Switch } from '@/components/ui/switch';
import { useWhatsappConversas, useWhatsappMensagens, type WAConversa } from '@/hooks/useWhatsappInbox';
import { useWhatsappTemplates, useWhatsappNotas, useGlobalMessageSearch, useWhatsappFiltrosSalvos, useAtribuirConversa, getSLAStatus } from '@/hooks/useWhatsappExtras';
import { buildTemplateContext, aplicarVariaveis, TEMPLATE_VARIAVEIS } from '@/utils/whatsappTemplateVars';
import { formatPhoneNumber } from '@/utils/whatsapp';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type FilaTab = 'todas' | 'minhas' | 'nao_atribuidas' | 'atrasadas';
type ColunaWS = 'pendentes' | 'andamento' | 'conversas' | 'fechadas';

const DOT_BY_STAGE: Record<string, string> = {
  novo: 'bg-sky-400',
  qualificado: 'bg-amber-400',
  agendado: 'bg-violet-400',
  fechado: 'bg-emerald-500',
  perdido: 'bg-rose-400',
};

function colunaDe(c: any): ColunaWS {
  const stage = c.pipeline_stage || 'novo';
  if (stage === 'fechado' || stage === 'perdido') return 'fechadas';
  if ((c.nao_lidas || 0) > 0) return 'pendentes';
  if (stage === 'qualificado' || stage === 'agendado') return 'andamento';
  return 'conversas';
}

export default function CrmInbox({ embedded = false }: { embedded?: boolean } = {}) {
  const [busca, setBusca] = useState('');
  const [filaTab, setFilaTab] = useState<FilaTab>('todas');
  const [stageTab, setStageTab] = useState<StageTab>('todos');
  const [userId, setUserId] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<WAConversa | null>(null);
  const { data: conversas = [], isLoading } = useWhatsappConversas();
  const { data: idsGlobais = [] } = useGlobalMessageSearch(busca);
  const { data: filtrosSalvos = [], salvar: salvarFiltro, remover: removerFiltro } = useWhatsappFiltrosSalvos();
  const [salvarFiltroAberto, setSalvarFiltroAberto] = useState(false);
  const [novoFiltroNome, setNovoFiltroNome] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const filtradas = conversas.filter(c => {
    const q = busca.toLowerCase().trim();
    if (q) {
      const matchMeta = (c.nome_contato || '').toLowerCase().includes(q) || c.telefone.includes(q);
      const matchMsg = q.length >= 3 && idsGlobais.includes(c.id);
      if (!matchMeta && !matchMsg) return false;
    }
    if (stageTab !== 'todos' && (c.pipeline_stage || 'novo') !== stageTab) return false;
    if (filaTab === 'minhas') return c.atribuido_a === userId;
    if (filaTab === 'nao_atribuidas') return !c.atribuido_a;
    if (filaTab === 'atrasadas') {
      const s = getSLAStatus(c);
      return s.status === 'atrasado' || s.status === 'em_breve';
    }
    return true;
  });

  const contagens = {
    todas: conversas.length,
    minhas: conversas.filter(c => c.atribuido_a === userId).length,
    nao_atribuidas: conversas.filter(c => !c.atribuido_a).length,
    atrasadas: conversas.filter(c => {
      const s = getSLAStatus(c);
      return s.status === 'atrasado' || s.status === 'em_breve';
    }).length,
  };

  const contagensStage: Record<StageTab, number> = {
    todos: conversas.length,
    novo: conversas.filter(c => (c.pipeline_stage || 'novo') === 'novo').length,
    qualificado: conversas.filter(c => c.pipeline_stage === 'qualificado').length,
    agendado: conversas.filter(c => c.pipeline_stage === 'agendado').length,
    fechado: conversas.filter(c => c.pipeline_stage === 'fechado').length,
    perdido: conversas.filter(c => c.pipeline_stage === 'perdido').length,
  };

  return (
    <Shell embedded={embedded}>
      <div className={embedded ? '' : 'p-4 sm:p-6'}>
        {!embedded && (
          <PageHeader
            icon={<MessageCircle className="icon-lg" />}
            title="WhatsApp"
            subtitle="Conversas em tempo real com pacientes e leads"
            actions={
              <div className="flex gap-2">
                <Link to="/crm?tab=pipeline">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Kanban className="icon-xs" /> Pipeline
                  </Button>
                </Link>
                <Link to="/crm?tab=automacoes">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Bot className="icon-xs" /> Automações
                  </Button>
                </Link>
              </div>
            }
          />
        )}

        <div className={cn('grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4 min-h-[500px]', embedded ? 'mt-0 h-[calc(100dvh-160px)]' : 'mt-4 h-[calc(100dvh-220px)]')}>

          {/* Lista */}
          <div className={cn(
            "rounded-xl border border-border/40 bg-card shadow-xs flex flex-col overflow-hidden",
            selecionada && "hidden md:flex"
          )}>
            <div className="p-3 border-b border-border/40 space-y-2">
              <div className="relative">
                <Search className="icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar nome, telefone ou texto…"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <div className="flex gap-1 overflow-x-auto -mx-1 px-1 scrollbar-none">
                {([
                  ['todas', 'Todas'],
                  ['minhas', 'Minhas'],
                  ['nao_atribuidas', 'Sem dono'],
                  ['atrasadas', 'SLA ⏰'],
                ] as [FilaTab, string][]).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setFilaTab(k)}
                    className={cn(
                      "shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1",
                      filaTab === k
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border/60 text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {label}
                    <span className="opacity-70">{contagens[k]}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-1 overflow-x-auto -mx-1 px-1 scrollbar-none">
                {([
                  ['todos', 'Todos', 'bg-muted'],
                  ['novo', '🆕 Novo', 'bg-blue-500/10 text-blue-600 border-blue-500/30'],
                  ['qualificado', '⭐ Qualificado', 'bg-purple-500/10 text-purple-600 border-purple-500/30'],
                  ['agendado', '📅 Agendado', 'bg-amber-500/10 text-amber-600 border-amber-500/30'],
                  ['fechado', '✅ Paciente', 'bg-green-500/10 text-green-600 border-green-500/30'],
                  ['perdido', '❌ Perdido', 'bg-destructive/10 text-destructive border-destructive/30'],
                ] as [StageTab, string, string][]).map(([k, label, color]) => (
                  <button
                    key={k}
                    onClick={() => setStageTab(k)}
                    className={cn(
                      "shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1",
                      stageTab === k
                        ? "bg-primary text-primary-foreground border-primary"
                        : cn("border-border/60 hover:opacity-80", color)
                    )}
                  >
                    {label}
                    <span className="opacity-70">{contagensStage[k]}</span>
                  </button>
                ))}
              </div>
              {filtrosSalvos.length > 0 && (
                <div className="flex gap-1 overflow-x-auto -mx-1 px-1 scrollbar-none">
                  {filtrosSalvos.map(f => (
                    <button
                      key={f.id}
                      onClick={() => {
                        if (f.filtros.filaTab) setFilaTab(f.filtros.filaTab);
                        if (f.filtros.busca !== undefined) setBusca(f.filtros.busca);
                      }}
                      className="shrink-0 text-[10px] px-2 py-0.5 rounded border border-dashed border-border/60 text-muted-foreground hover:bg-muted/40 flex items-center gap-1"
                    >
                      {f.nome}
                      <X
                        className="icon-xs hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); removerFiltro.mutate(f.id); }}
                      />
                    </button>
                  ))}
                </div>
              )}
              {(filaTab !== 'todas' || busca) && (
                <Popover open={salvarFiltroAberto} onOpenChange={setSalvarFiltroAberto}>
                  <PopoverTrigger asChild>
                    <button className="text-[10px] text-primary hover:underline">+ salvar filtro atual</button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3 space-y-2">
                    <Label className="text-xs">Nome do filtro</Label>
                    <Input
                      value={novoFiltroNome}
                      onChange={e => setNovoFiltroNome(e.target.value)}
                      placeholder="Ex.: Leads quentes"
                      className="h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={async () => {
                        if (!novoFiltroNome.trim()) return;
                        await salvarFiltro.mutateAsync({ nome: novoFiltroNome.trim(), filtros: { filaTab, busca } });
                        setNovoFiltroNome(''); setSalvarFiltroAberto(false);
                        toast.success('Filtro salvo');
                      }}
                    >Salvar</Button>
                  </PopoverContent>
                </Popover>
              )}
            </div>
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="icon-sm animate-spin" /> Carregando...
                </div>
              ) : filtradas.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhuma conversa nesse filtro.
                </div>
              ) : filtradas.map(c => {
                const sla = getSLAStatus(c);
                const slaColor = sla.status === 'atrasado' ? 'bg-destructive/15 text-destructive border-destructive/30'
                  : sla.status === 'em_breve' ? 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                  : '';
                return (
                <button
                  key={c.id}
                  onClick={() => setSelecionada(c)}
                  className={cn(
                    "w-full text-left p-3 border-b border-border/30 hover:bg-muted/40 transition-colors flex gap-3 items-start",
                    selecionada?.id === c.id && "bg-muted/60"
                  )}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="text-xs">
                      {(c.nome_contato || c.telefone).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        {c.nome_contato || formatPhoneNumber(c.telefone)}
                      </span>
                      {c.ultima_mensagem_em && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatDistanceToNow(new Date(c.ultima_mensagem_em), { locale: ptBR, addSuffix: false })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground truncate">
                        {c.ultima_direcao === 'saida' && '✓ '}
                        {c.ultima_mensagem || '—'}
                      </span>
                      {c.nao_lidas > 0 && (
                        <Badge className="h-5 min-w-5 px-1.5 text-[10px] shrink-0">
                          {c.nao_lidas}
                        </Badge>
                      )}
                    </div>
                    {(sla.status === 'atrasado' || sla.status === 'em_breve') && (
                      <div className={cn("inline-flex items-center gap-1 mt-1 text-[10px] px-1.5 py-0.5 rounded border", slaColor)}>
                        {sla.status === 'atrasado' ? `Atrasado ${sla.minutos}min` : `SLA em ${sla.minutos}min`}
                      </div>
                    )}
                    {c.atribuido_a === userId && (
                      <span className="ml-1 mt-1 inline-block text-[10px] text-primary">• minha</span>
                    )}
                  </div>
                </button>
              );})}
            </ScrollArea>
          </div>

          {/* Chat */}
          <div className={cn(
            "rounded-xl border border-border/40 bg-card shadow-xs flex flex-col overflow-hidden",
            !selecionada && "hidden md:flex"
          )}>
            {selecionada ? (
              <ChatPanel conversa={selecionada} onBack={() => setSelecionada(null)} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2 p-6 text-center">
                <MessageCircle className="icon-xl opacity-40" />
                <p className="text-sm">Selecione uma conversa para começar</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ embedded, children }: { embedded: boolean; children: React.ReactNode }) {
  if (embedded) return <>{children}</>;
  return <AppLayout>{children}</AppLayout>;
}


function ChatPanel({ conversa, onBack }: { conversa: WAConversa; onBack: () => void }) {
  const [texto, setTexto] = useState('');
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [buscaMsg, setBuscaMsg] = useState('');
  const [showBusca, setShowBusca] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const { data: mensagens = [], enviar, marcarLida } = useWhatsappMensagens(conversa.id);
  const { data: templates = [], incrementarUso } = useWhatsappTemplates();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Templates filtrados por atalho digitado
  const sugestoes = useMemo(() => {
    const m = texto.match(/^\/(\S*)$/);
    if (!m) return [];
    const q = m[1].toLowerCase();
    return templates.filter(t => t.atalho.slice(1).toLowerCase().startsWith(q)).slice(0, 6);
  }, [texto, templates]);

  // Filtro de mensagens dentro da conversa
  const mensagensFiltradas = useMemo(() => {
    const q = buscaMsg.toLowerCase().trim();
    if (!q) return mensagens;
    return mensagens.filter(m =>
      (m.conteudo || '').toLowerCase().includes(q) ||
      (m.transcricao || '').toLowerCase().includes(q)
    );
  }, [mensagens, buscaMsg]);

  useEffect(() => { marcarLida.mutate(); /* eslint-disable-next-line */ }, [conversa.id]);
  useEffect(() => {
    if (!buscaMsg) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [mensagens.length, buscaMsg]);

  async function handleSend(content?: string) {
    const t = (content ?? texto).trim();
    if (!t) return;
    setTexto('');
    try { await enviar.mutateAsync({ conversa, texto: t }); } catch { setTexto(t); }
  }

  async function handleMediaUpload(file: File, mediaType: 'image' | 'document') {
    const max = mediaType === 'image' ? 5 * 1024 * 1024 : 16 * 1024 * 1024;
    if (file.size > max) {
      toast.error(`Arquivo maior que ${max / 1024 / 1024}MB`);
      return;
    }
    setUploadingMedia(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const ext = file.name.split('.').pop() || (mediaType === 'image' ? 'jpg' : 'pdf');
      const path = `${user.id}/${conversa.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('whatsapp-media').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('whatsapp-media').getPublicUrl(path);
      const caption = texto.trim() || undefined;
      setTexto('');
      await enviar.mutateAsync({ conversa, texto: caption, mediaUrl: publicUrl, mediaType, fileName: file.name });
      toast.success(mediaType === 'image' ? 'Imagem enviada' : 'Documento enviado');
    } catch (e: any) {
      toast.error('Erro ao enviar: ' + e.message);
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (docInputRef.current) docInputRef.current.value = '';
    }
  }

  async function aplicarTemplate(tpl: typeof templates[number]) {
    try {
      const ctx = await buildTemplateContext(conversa);
      setTexto(aplicarVariaveis(tpl.conteudo, ctx));
      incrementarUso(tpl.id);
    } catch {
      // fallback minimalista
      const nome = (conversa.nome_contato || '').split(' ')[0] || 'olá';
      setTexto(tpl.conteudo.replace(/\{nome\}/g, nome));
      incrementarUso(tpl.id);
    }
  }

  async function transcrever(msgId: string) {
    setTranscribingId(msgId);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-transcribe', {
        body: { mensagem_id: msgId },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || 'falha');
      toast.success('Áudio transcrito');
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally { setTranscribingId(null); }
  }

  return (
    <>
      <div className="p-3 border-b border-border/40 flex items-center gap-3">
        <Button variant="ghost" size="sm" className="md:hidden" onClick={onBack}>←</Button>
        <Avatar className="h-9 w-9"><AvatarFallback className="text-xs">
          {(conversa.nome_contato || conversa.telefone).slice(0, 2).toUpperCase()}
        </AvatarFallback></Avatar>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate flex items-center gap-2">
            {conversa.nome_contato || formatPhoneNumber(conversa.telefone)}
            {conversa.intencao_atual && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {conversa.intencao_atual}
              </span>
            )}
            {typeof conversa.lead_score === 'number' && conversa.lead_score > 0 && (
              <span className="text-[10px] text-muted-foreground">⭐ {conversa.lead_score}</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="icon-xs" /> {formatPhoneNumber(conversa.telefone)}
          </div>
        </div>
        <Button
          variant="ghost" size="sm"
          onClick={() => setShowBusca(v => !v)}
          title="Buscar nesta conversa"
          className="px-2"
        >
          <Search className="icon-xs" />
        </Button>
        <AtribuirButton conversa={conversa} />
        <BotToggle conversa={conversa} />
        <BotConfigPanel />
        <NotasButton conversaId={conversa.id} />
        {conversa.paciente_id && (
          <Link to={`/pacientes/${conversa.paciente_id}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <User className="icon-xs" /> Perfil
            </Button>
          </Link>
        )}
      </div>

      {showBusca && (
        <div className="px-3 py-2 border-b border-border/40 bg-muted/20 flex items-center gap-2">
          <Search className="icon-xs text-muted-foreground" />
          <Input
            placeholder="Buscar nesta conversa..."
            value={buscaMsg}
            onChange={e => setBuscaMsg(e.target.value)}
            className="h-8 text-xs"
            autoFocus
          />
          {buscaMsg && (
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {mensagensFiltradas.length} resultado{mensagensFiltradas.length !== 1 ? 's' : ''}
            </span>
          )}
          <Button variant="ghost" size="sm" className="px-1.5" onClick={() => { setShowBusca(false); setBuscaMsg(''); }}>
            <X className="icon-xs" />
          </Button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
        {mensagensFiltradas.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">
            {buscaMsg ? 'Nenhuma mensagem encontrada' : 'Sem mensagens ainda'}
          </div>
        )}
        {mensagensFiltradas.map(m => (
          <div key={m.id} className={cn("flex", m.direcao === 'saida' ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-xs",
              m.direcao === 'saida' ? "bg-primary text-primary-foreground" : "bg-card border border-border/40"
            )}>
              {m.tipo === 'audio' && m.midia_url && (
                <div className="space-y-1.5">
                  <audio controls src={m.midia_url} className="max-w-full" />
                  {m.transcricao ? (
                    <div className="text-xs italic opacity-80 border-l-2 border-current/30 pl-2">
                      "{m.transcricao}"
                    </div>
                  ) : m.direcao === 'entrada' && (
                    <Button
                      variant="ghost" size="sm"
                      className="h-6 text-[11px] gap-1 px-1.5"
                      disabled={transcribingId === m.id}
                      onClick={() => transcrever(m.id)}
                    >
                      {transcribingId === m.id
                        ? <Loader2 className="icon-xs animate-spin" />
                        : <Sparkles className="icon-xs" />}
                      Transcrever
                    </Button>
                  )}
                </div>
              )}
              {m.tipo === 'imagem' && m.midia_url && (
                <a href={m.midia_url} target="_blank" rel="noreferrer">
                  <img src={m.midia_url} alt="" className="rounded-lg max-w-full mb-1" />
                </a>
              )}
              {m.tipo === 'documento' && m.midia_url && (
                <a
                  href={m.midia_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 mb-1 underline underline-offset-2"
                >
                  <FileText className="icon-sm shrink-0" />
                  <span className="text-xs truncate">Abrir documento</span>
                </a>
              )}
              {m.conteudo && (
                <div className="whitespace-pre-wrap break-words">{m.conteudo}</div>
              )}
              <div className="text-[10px] mt-1 opacity-70 text-right">
                {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                {m.direcao === 'saida' && (
                  <span className="ml-1">
                    {m.status === 'enviando' ? '⏳' : m.status === 'erro' ? '⚠️' : m.status === 'lida' ? '✓✓' : '✓'}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sugestões de templates ao digitar / */}
      {sugestoes.length > 0 && (
        <div className="border-t border-border/40 bg-muted/30 p-2 max-h-40 overflow-y-auto">
          {sugestoes.map(t => (
            <button
              key={t.id}
              onClick={() => aplicarTemplate(t)}
              className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-background flex items-start gap-2"
            >
              <Badge variant="outline" className="text-[10px] font-mono shrink-0">{t.atalho}</Badge>
              <div className="min-w-0">
                <div className="text-xs font-medium">{t.titulo}</div>
                <div className="text-[11px] text-muted-foreground truncate">{t.conteudo}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleMediaUpload(f, 'image'); }}
      />
      <input
        ref={docInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleMediaUpload(f, 'document'); }}
      />

      <div className="p-3 border-t border-border/40 flex gap-2 items-end">
        <TemplatesPopover templates={templates} onPick={aplicarTemplate} />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" title="Anexar" disabled={uploadingMedia || enviar.isPending}>
              {uploadingMedia ? <Loader2 className="icon-sm animate-spin" /> : <Paperclip className="icon-sm" />}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-44 p-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-sm flex items-center gap-2"
            >
              <ImageIcon className="icon-sm" /> Imagem
            </button>
            <button
              onClick={() => docInputRef.current?.click()}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-sm flex items-center gap-2"
            >
              <FileText className="icon-sm" /> PDF
            </button>
          </PopoverContent>
        </Popover>
        <Input
          placeholder='Mensagem… use / pra templates ou {nome} {próxima_sessão}'
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          disabled={enviar.isPending}
        />
        <Button onClick={() => handleSend()} disabled={!texto.trim() || enviar.isPending}>
          {enviar.isPending ? <Loader2 className="icon-sm animate-spin" /> : <Send className="icon-sm" />}
        </Button>
      </div>
    </>
  );
}

function BotConfigPanel() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" title="Configurar bot e automações">
          <Settings className="icon-xs" /> <span className="hidden sm:inline">Bot</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border/40 sticky top-0 bg-background z-10">
          <SheetTitle className="flex items-center gap-2">
            <Bot className="icon-sm text-primary" /> Configuração do Bot &amp; Automações
          </SheetTitle>
        </SheetHeader>
        <WhatsappAutomacoes embedded />
      </SheetContent>
    </Sheet>
  );
}

function TemplatesPopover({ templates, onPick }: {
  templates: ReturnType<typeof useWhatsappTemplates>['data'];
  onPick: (t: any) => void;
}) {
  const [openManager, setOpenManager] = useState(false);
  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" title="Respostas rápidas">
            <Zap className="icon-sm" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between">
            <span className="text-xs font-medium">Respostas rápidas</span>
            <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs" onClick={() => setOpenManager(true)}>
              <Pencil className="icon-xs" /> Gerenciar
            </Button>
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {(templates ?? []).length === 0 && (
              <div className="text-xs text-muted-foreground p-3 text-center">
                Nenhum template ainda.
                <Button variant="link" className="h-auto p-0 ml-1 text-xs" onClick={() => setOpenManager(true)}>
                  Criar agora
                </Button>
              </div>
            )}
            {(templates ?? []).map(t => (
              <button
                key={t.id}
                onClick={() => onPick(t)}
                className="w-full text-left p-2 rounded-md hover:bg-muted flex items-start gap-2"
              >
                <Badge variant="outline" className="text-[10px] font-mono shrink-0">{t.atalho}</Badge>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium">{t.titulo}</div>
                  <div className="text-[11px] text-muted-foreground line-clamp-2">{t.conteudo}</div>
                </div>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <TemplatesManager open={openManager} onOpenChange={setOpenManager} />
    </>
  );
}

function TemplatesManager({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: templates = [], salvar, remover } = useWhatsappTemplates();
  const [edit, setEdit] = useState<{ id?: string; atalho: string; titulo: string; conteudo: string } | null>(null);

  function novo() {
    setEdit({ atalho: '/', titulo: '', conteudo: '' });
  }

  async function handleSalvar() {
    if (!edit) return;
    const atalho = edit.atalho.startsWith('/') ? edit.atalho : `/${edit.atalho}`;
    if (atalho.length < 2 || !edit.titulo.trim() || !edit.conteudo.trim()) {
      toast.error('Preencha atalho, título e conteúdo.');
      return;
    }
    try {
      await salvar.mutateAsync({ id: edit.id, atalho, titulo: edit.titulo.trim(), conteudo: edit.conteudo });
      toast.success('Template salvo');
      setEdit(null);
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Zap className="icon-sm" /> Respostas rápidas</DialogTitle>
        </DialogHeader>

        {!edit ? (
          <div className="space-y-3">
            <Button size="sm" onClick={novo} className="w-full gap-1.5">
              <Plus className="icon-xs" /> Novo template
            </Button>
            <div className="space-y-1.5 max-h-[50dvh] overflow-y-auto pr-1">
              {templates.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-6">
                  Crie atalhos como <code className="font-mono">/oi</code> ou <code className="font-mono">/confirma</code> e digite no chat para inserir.
                </div>
              )}
              {templates.map(t => (
                <div key={t.id} className="rounded-lg border border-border/40 p-2.5 flex items-start gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono shrink-0">{t.atalho}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium">{t.titulo}</div>
                    <div className="text-[11px] text-muted-foreground line-clamp-2">{t.conteudo}</div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={() => setEdit({ id: t.id, atalho: t.atalho, titulo: t.titulo, conteudo: t.conteudo })}>
                    <Pencil className="icon-xs" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-1.5" onClick={async () => { await remover.mutateAsync(t.id); toast.success('Removido'); }}>
                    <Trash2 className="icon-xs" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-muted/40 p-2.5">
              <div className="text-[11px] font-medium mb-1.5">Variáveis disponíveis</div>
              <div className="flex flex-wrap gap-1">
                {TEMPLATE_VARIAVEIS.map(v => (
                  <Badge key={v.chave} variant="secondary" className="text-[10px] font-mono cursor-default" title={v.descricao}>
                    {'{' + v.chave + '}'}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <div>
                <Label className="text-xs">Atalho</Label>
                <Input value={edit.atalho} onChange={e => setEdit({ ...edit, atalho: e.target.value })} placeholder="/oi" className="font-mono" />
              </div>
              <div>
                <Label className="text-xs">Título</Label>
                <Input value={edit.titulo} onChange={e => setEdit({ ...edit, titulo: e.target.value })} placeholder="Saudação inicial" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Conteúdo</Label>
              <Textarea
                value={edit.conteudo}
                onChange={e => setEdit({ ...edit, conteudo: e.target.value })}
                placeholder="Olá {nome}! Confirmando sua sessão {próxima_sessão}. Responda SIM ou REAGENDAR."
                rows={5}
              />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {TEMPLATE_VARIAVEIS.map(v => (
                  <button
                    key={v.chave}
                    type="button"
                    onClick={() => setEdit(s => s ? { ...s, conteudo: s.conteudo + '{' + v.chave + '}' } : s)}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border/60 hover:bg-muted"
                    title={v.descricao}
                  >
                    {'{' + v.chave + '}'}
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
              <Button onClick={handleSalvar} disabled={salvar.isPending}>
                {salvar.isPending ? <Loader2 className="icon-sm animate-spin" /> : 'Salvar'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NotasButton({ conversaId }: { conversaId: string }) {
  const [nova, setNova] = useState('');
  const { data: notas = [], adicionar, remover } = useWhatsappNotas(conversaId);
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <StickyNote className="icon-xs" />
          {notas.length > 0 && <span className="text-[10px]">{notas.length}</span>}
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader><SheetTitle>Notas internas</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Textarea
              placeholder="Nota privada sobre este contato..."
              value={nova}
              onChange={e => setNova(e.target.value)}
              rows={2}
            />
            <Button
              size="sm"
              onClick={async () => { if (nova.trim()) { await adicionar.mutateAsync(nova.trim()); setNova(''); } }}
            >
              <Plus className="icon-sm" />
            </Button>
          </div>
          <div className="space-y-2">
            {notas.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-6">Nenhuma nota ainda</div>
            )}
            {notas.map(n => (
              <div key={n.id} className="rounded-lg border border-border/40 bg-muted/30 p-3">
                <div className="text-xs whitespace-pre-wrap">{n.conteudo}</div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString('pt-BR')}
                  </span>
                  <Button variant="ghost" size="sm" className="h-6" onClick={() => remover.mutate(n.id)}>
                    <Trash2 className="icon-xs" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BotToggle({ conversa }: { conversa: WAConversa }) {
  const [ativo, setAtivo] = useState(conversa.bot_ativo ?? true);
  useEffect(() => { setAtivo(conversa.bot_ativo ?? true); }, [conversa.id, conversa.bot_ativo]);
  const toggle = async (v: boolean) => {
    setAtivo(v);
    const { error } = await supabase
      .from('whatsapp_conversas')
      .update({ bot_ativo: v })
      .eq('id', conversa.id);
    if (error) { toast.error('Erro: ' + error.message); setAtivo(!v); }
    else toast.success(v ? 'Bot ativado nessa conversa' : 'Bot pausado nessa conversa');
  };
  return (
    <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/40">
      <Bot className="icon-xs text-muted-foreground" />
      <Switch checked={ativo} onCheckedChange={toggle} />
    </div>
  );
}

function AtribuirButton({ conversa }: { conversa: WAConversa }) {
  const [userId, setUserId] = useState<string | null>(null);
  const atribuir = useAtribuirConversa();
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);
  const minha = conversa.atribuido_a && conversa.atribuido_a === userId;
  const semDono = !conversa.atribuido_a;
  return (
    <Button
      variant={minha ? 'default' : semDono ? 'outline' : 'ghost'}
      size="sm"
      className="gap-1.5"
      title={minha ? 'Conversa sua — clique para liberar' : semDono ? 'Assumir conversa' : 'Atribuída a outro — assumir'}
      onClick={() => {
        if (!userId) return;
        atribuir.mutate({ conversa_id: conversa.id, atribuido_a: minha ? null : userId });
      }}
    >
      <User className="icon-xs" />
      {minha ? 'Minha' : semDono ? 'Assumir' : 'Atribuída'}
    </Button>
  );
}
