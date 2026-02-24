import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Send, Calendar, X, DollarSign, Activity } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function SecretaryAI({ patientId, therapistId }: { patientId?: string; therapistId?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const { mutate: sendMessage } = useMutation({
    mutationFn: async (message: string) => {
      // Usando supabase.functions.invoke para a Edge Function
      const { data, error } = await supabase.functions.invoke('secretary-ai', {
        body: {
          patient_id: patientId || 'visitante',
          therapist_id: therapistId,
          message,
          conversation_id: conversationId,
        }
      });
      
      if (error) {
        throw error;
      }
      return data;
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.response || "Entendido, ocorreu um erro de processamento mas recebi sua mensagem.",
          timestamp: new Date(),
        },
      ]);
      if (data.conversation_id) {
        setConversationId(data.conversation_id);
      }
      setIsLoading(false);
    },
    onError: (error) => {
      toast({
        title: "Erro ao conectar com a IA",
        description: error.message,
        variant: "destructive"
      });
      setIsLoading(false);
    },
  });

  const handleSendMessage = () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      },
    ]);

    setIsLoading(true);
    // Timeout para não travar a UI caso não tenhamos a edge function rodando agora.
    // Simulando a resposta para dev se a function falhar.
    sendMessage(userMessage);
    setInput('');
  };

  return (
    <div className="flex flex-col h-[500px] bg-card rounded-2xl shadow-card border border-border overflow-hidden">
      
      {/* HEADER */}
      <div className="bg-gradient-primary text-white p-4">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-lg">
            🤖
          </div>
          <div>
            <h3 className="font-bold">Secretária IA Premium</h3>
            <p className="text-xs text-white/70">24/7 disponível para ajudar</p>
          </div>
        </div>
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground mt-8">
            <p className="text-4xl mb-3">👋</p>
            <p className="font-semibold text-foreground">Olá! Como posso ajudar?</p>
            <p className="text-sm mt-1">Experimente agendar uma consulta ou perguntar sobre disponibilidades.</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-4 py-2 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-sm shadow-sm'
                  : 'bg-card border border-border text-card-foreground rounded-bl-sm shadow-sm'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              <p className={`text-[10px] mt-1 text-right ${msg.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                {msg.timestamp.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1 shadow-sm">
              <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="p-3 bg-card border-t border-border">
        {/* QUICK ACTIONS */}
        <div className="mb-3 flex gap-2 flex-nowrap overflow-x-auto pb-1 scrollbar-hide">
          <Button variant="secondary" size="sm" className="h-7 text-xs rounded-full shrink-0 gap-1.5" onClick={() => setInput('Quero agendar uma consulta')}>
            <Calendar className="h-3 w-3" /> Agendar
          </Button>
          <Button variant="secondary" size="sm" className="h-7 text-xs rounded-full shrink-0 gap-1.5" onClick={() => setInput('Preciso cancelar meu agendamento')}>
            <X className="h-3 w-3" /> Cancelar
          </Button>
          <Button variant="secondary" size="sm" className="h-7 text-xs rounded-full shrink-0 gap-1.5" onClick={() => setInput('Qual é o valor da consulta?')}>
            <DollarSign className="h-3 w-3" /> Preços
          </Button>
          <Button variant="secondary" size="sm" className="h-7 text-xs rounded-full shrink-0 gap-1.5" onClick={() => setInput('Quando devo fazer a reavaliação?')}>
            <Activity className="h-3 w-3" /> Reavaliação
          </Button>
        </div>

        <div className="flex gap-2 relative">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Digite sua mensagem..."
            disabled={isLoading}
            className="flex-1 rounded-full pr-12 focus-visible:ring-1 border-muted"
          />
          <Button
            size="icon"
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            className="absolute right-1 top-1 h-8 w-8 rounded-full bg-primary"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Send className="h-3.5 w-3.5 text-white" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
