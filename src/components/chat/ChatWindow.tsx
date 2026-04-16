import { useState, useRef, useEffect } from 'react';
import { useChatMensagens, ChatMensagem } from '@/hooks/useChatMensagens';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Bot, User, Loader2, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import ChatSlotPicker from './ChatSlotPicker';

interface Props {
  pacienteId: string;
  terapeutaId: string;
  remetente: 'terapeuta' | 'paciente';
  className?: string;
}

const tipoLabels: Record<string, string> = {
  lembrete_sessao: '📅 Lembrete de sessão',
  pos_atendimento: '✅ Pós-atendimento',
  reengajamento: '🔄 Reengajamento',
  aniversario: '🎂 Aniversário',
  boas_vindas: '👋 Boas-vindas',
  agendamento_chat: '📅 Agendamento via Chat',
};

const SCHEDULING_KEYWORDS = [
  'agendar', 'marcar', 'horário', 'horario', 'sessão', 'sessao',
  'consulta', 'remarcar', 'reagendar', 'disponível', 'disponivel',
  'quero agendar', 'posso marcar', 'tem horário', 'tem horario',
];

function detectSchedulingIntent(text: string): boolean {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return SCHEDULING_KEYWORDS.some(kw =>
    lower.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  );
}

export default function ChatWindow({ pacienteId, terapeutaId, remetente, className }: Props) {
  const { mensagens, enviarMensagem, marcarComoLida, isLoading } = useChatMensagens(pacienteId);
  const [texto, setTexto] = useState('');
  const [showSlotPicker, setShowSlotPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens, showSlotPicker]);

  // Mark unread messages as read
  useEffect(() => {
    const unread = mensagens.filter(m => !m.lida && m.remetente !== remetente);
    if (unread.length > 0) {
      marcarComoLida.mutate(unread.map(m => m.id));
    }
  }, [mensagens, remetente]);

  const handleSend = () => {
    const msg = texto.trim();
    if (!msg) return;

    // Detect scheduling intent from patient
    if (remetente === 'paciente' && detectSchedulingIntent(msg)) {
      enviarMensagem.mutate({
        paciente_id: pacienteId,
        terapeuta_id: terapeutaId,
        mensagem: msg,
        remetente,
      });
      setTexto('');
      // Show slot picker after a brief delay
      setTimeout(() => setShowSlotPicker(true), 300);
      return;
    }

    enviarMensagem.mutate({
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      mensagem: msg,
      remetente,
    }, {
      onError: () => toast({ title: 'Erro ao enviar mensagem', variant: 'destructive' }),
    });
    setTexto('');
  };

  const handleAgendado = (data: Date) => {
    // Send confirmation message
    enviarMensagem.mutate({
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      mensagem: `📅 Sessão agendada para ${format(data, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}. Aguardando confirmação do profissional. ✅`,
      remetente: 'paciente',
      tipo: 'agendamento_chat',
    });
    setShowSlotPicker(false);
  };

  const groupByDate = (msgs: ChatMensagem[]) => {
    const groups: Record<string, ChatMensagem[]> = {};
    msgs.forEach(m => {
      const day = format(parseISO(m.created_at), 'dd/MM/yyyy');
      if (!groups[day]) groups[day] = [];
      groups[day].push(m);
    });
    return groups;
  };

  // Check if any system message has scheduling suggestion (metadata.show_slots)
  const hasSchedulingSuggestion = mensagens.some(
    m => m.remetente === 'sistema' && m.metadata && (m.metadata as any).show_slots === true && !m.lida
  );

  const groups = groupByDate(mensagens);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {mensagens.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            Nenhuma mensagem ainda. Inicie a conversa! 💬
          </div>
        )}

        {Object.entries(groups).map(([date, msgs]) => (
          <div key={date}>
            <div className="flex justify-center mb-3">
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {date}
              </span>
            </div>
            <div className="space-y-2">
              {msgs.map(msg => {
                const isMine = msg.remetente === remetente;
                const isSystem = msg.remetente === 'sistema';
                const showSlotsBtn = isSystem && msg.metadata && (msg.metadata as any).show_slots === true;

                if (isSystem) {
                  return (
                    <div key={msg.id} className="space-y-1.5">
                      <div className="flex justify-center">
                        <div className="bg-accent/50 text-accent-foreground text-xs px-3 py-1.5 rounded-lg max-w-[85%] text-center">
                          {tipoLabels[msg.tipo] && (
                            <span className="font-medium block mb-0.5">{tipoLabels[msg.tipo]}</span>
                          )}
                          {msg.mensagem}
                        </div>
                      </div>
                      {showSlotsBtn && remetente === 'paciente' && !showSlotPicker && (
                        <div className="flex justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs gap-1.5"
                            onClick={() => setShowSlotPicker(true)}
                          >
                            <CalendarDays className="h-3 w-3" />
                            Ver horários disponíveis
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={cn('flex gap-1.5', isMine ? 'justify-end' : 'justify-start')}>
                    {!isMine && (
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                        {msg.remetente === 'terapeuta' ? (
                          <Bot className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <User className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    <div className={cn(
                      'max-w-[75%] px-3 py-2 rounded-2xl text-sm',
                      isMine
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted text-foreground rounded-bl-md'
                    )}>
                      {msg.tipo !== 'manual' && tipoLabels[msg.tipo] && (
                        <span className="text-[10px] font-medium opacity-70 block mb-0.5">
                          {tipoLabels[msg.tipo]}
                        </span>
                      )}
                      <p className="whitespace-pre-wrap break-words">{msg.mensagem}</p>
                      <span className={cn(
                        'text-[9px] mt-1 block',
                        isMine ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground'
                      )}>
                        {format(parseISO(msg.created_at), 'HH:mm')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Slot Picker inline */}
        {showSlotPicker && (
          <ChatSlotPicker
            terapeutaId={terapeutaId}
            pacienteId={pacienteId}
            onAgendado={handleAgendado}
            onCancel={() => setShowSlotPicker(false)}
          />
        )}

        {/* Auto-show scheduling suggestion */}
        {hasSchedulingSuggestion && !showSlotPicker && remetente === 'paciente' && (
          <div className="flex justify-center">
            <Button
              variant="default"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setShowSlotPicker(true)}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Agendar sessão agora
            </Button>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border p-3 flex gap-2">
        {remetente === 'paciente' && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => setShowSlotPicker(!showSlotPicker)}
            title="Agendar sessão"
          >
            <CalendarDays className="h-4 w-4 text-primary" />
          </Button>
        )}
        <Input
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="Digite uma mensagem..."
          className="flex-1"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!texto.trim() || enviarMensagem.isPending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
