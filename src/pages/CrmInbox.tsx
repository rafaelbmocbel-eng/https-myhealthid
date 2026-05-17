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
import { Search, Send, MessageCircle, Phone, User, Loader2, Zap, StickyNote, Trash2, Plus, Sparkles, Bot, Kanban, Settings, Paperclip, Image as ImageIcon, FileText, X } from 'lucide-react';
import WhatsappAutomacoes from '@/pages/WhatsappAutomacoes';
import { Switch } from '@/components/ui/switch';
import { useWhatsappConversas, useWhatsappMensagens, type WAConversa } from '@/hooks/useWhatsappInbox';
import { useWhatsappTemplates, useWhatsappNotas } from '@/hooks/useWhatsappExtras';
import { formatPhoneNumber } from '@/utils/whatsapp';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function CrmInbox({ embedded = false }: { embedded?: boolean } = {}) {
  const [busca, setBusca] = useState('');
  const [selecionada, setSelecionada] = useState<WAConversa | null>(null);
  const { data: conversas = [], isLoading } = useWhatsappConversas();

  const filtradas = conversas.filter(c => {
    const q = busca.toLowerCase().trim();
    if (!q) return true;
    return (c.nome_contato || '').toLowerCase().includes(q) || c.telefone.includes(q);
  });

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
            <div className="p-3 border-b border-border/40">
              <div className="relative">
                <Search className="icon-sm absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar conversa..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="icon-sm animate-spin" /> Carregando...
                </div>
              ) : filtradas.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhuma conversa ainda. Configure o webhook Z-API para receber mensagens.
                </div>
              ) : filtradas.map(c => (
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
                  </div>
                </button>
              ))}
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

  function aplicarTemplate(tpl: typeof templates[number]) {
    let conteudo = tpl.conteudo;
    const nome = (conversa.nome_contato || '').split(' ')[0];
    conteudo = conteudo.replace(/\{nome\}/g, nome || 'olá');
    setTexto(conteudo);
    incrementarUso(tpl.id);
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
          placeholder='Mensagem ou legenda... (use / para templates)'
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
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" title="Respostas rápidas">
          <Zap className="icon-sm" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1 max-h-80 overflow-y-auto">
        {(templates ?? []).length === 0 && (
          <div className="text-xs text-muted-foreground p-3">Nenhum template ainda.</div>
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
      </PopoverContent>
    </Popover>
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
