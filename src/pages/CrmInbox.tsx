import { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Send, MessageCircle, Phone, User, Loader2 } from 'lucide-react';
import { useWhatsappConversas, useWhatsappMensagens, type WAConversa } from '@/hooks/useWhatsappInbox';
import { formatPhoneNumber } from '@/utils/whatsapp';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export default function CrmInbox() {
  const [busca, setBusca] = useState('');
  const [selecionada, setSelecionada] = useState<WAConversa | null>(null);
  const { data: conversas = [], isLoading } = useWhatsappConversas();

  const filtradas = conversas.filter(c => {
    const q = busca.toLowerCase().trim();
    if (!q) return true;
    return (c.nome_contato || '').toLowerCase().includes(q) || c.telefone.includes(q);
  });

  return (
    <AppLayout>
      <div className="p-4 sm:p-6">
        <PageHeader
          icon={MessageCircle}
          title="Inbox WhatsApp"
          subtitle="Conversas em tempo real com pacientes e leads"
        />

        <div className="mt-4 grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4 h-[calc(100dvh-220px)] min-h-[500px]">
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
    </AppLayout>
  );
}

function ChatPanel({ conversa, onBack }: { conversa: WAConversa; onBack: () => void }) {
  const [texto, setTexto] = useState('');
  const { data: mensagens = [], enviar, marcarLida } = useWhatsappMensagens(conversa.id);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { marcarLida.mutate(); /* eslint-disable-next-line */ }, [conversa.id]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [mensagens.length]);

  async function handleSend() {
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    try { await enviar.mutateAsync({ conversa, texto: t }); } catch (e) { setTexto(t); }
  }

  return (
    <>
      <div className="p-3 border-b border-border/40 flex items-center gap-3">
        <Button variant="ghost" size="sm" className="md:hidden" onClick={onBack}>←</Button>
        <Avatar className="h-9 w-9"><AvatarFallback className="text-xs">
          {(conversa.nome_contato || conversa.telefone).slice(0, 2).toUpperCase()}
        </AvatarFallback></Avatar>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {conversa.nome_contato || formatPhoneNumber(conversa.telefone)}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Phone className="icon-xs" /> {formatPhoneNumber(conversa.telefone)}
          </div>
        </div>
        {conversa.paciente_id && (
          <Link to={`/pacientes/${conversa.paciente_id}`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <User className="icon-xs" /> Perfil
            </Button>
          </Link>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
        {mensagens.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">Sem mensagens ainda</div>
        )}
        {mensagens.map(m => (
          <div key={m.id} className={cn("flex", m.direcao === 'saida' ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-xs",
              m.direcao === 'saida' ? "bg-primary text-primary-foreground" : "bg-card border border-border/40"
            )}>
              {m.tipo === 'audio' && m.midia_url && (
                <audio controls src={m.midia_url} className="max-w-full" />
              )}
              {m.tipo === 'imagem' && m.midia_url && (
                <img src={m.midia_url} alt="" className="rounded-lg max-w-full mb-1" />
              )}
              {(m.conteudo || m.transcricao) && (
                <div className="whitespace-pre-wrap break-words">{m.conteudo || m.transcricao}</div>
              )}
              <div className={cn(
                "text-[10px] mt-1 opacity-70 text-right",
              )}>
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

      <div className="p-3 border-t border-border/40 flex gap-2">
        <Input
          placeholder="Digite uma mensagem..."
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          disabled={enviar.isPending}
        />
        <Button onClick={handleSend} disabled={!texto.trim() || enviar.isPending}>
          {enviar.isPending ? <Loader2 className="icon-sm animate-spin" /> : <Send className="icon-sm" />}
        </Button>
      </div>
    </>
  );
}
