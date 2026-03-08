import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useFunilPublico, ServicoFunil } from '@/hooks/useFunilConfig';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MessageCircle, Send, CheckCircle2, Calendar, CreditCard, Star, ArrowRight, Phone, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import logoMyHealthId from '@/assets/logo-my-health-id.jpg';

type Etapa = 'boas_vindas' | 'coleta_dados' | 'diferenciais' | 'servicos' | 'agendamento' | 'pagamento' | 'confirmacao';

interface ChatMessage {
  id: string;
  tipo: 'bot' | 'user' | 'options' | 'input';
  texto?: string;
  opcoes?: { label: string; value: string; icon?: React.ReactNode }[];
  inputType?: 'nome' | 'telefone' | 'email';
}

export default function FunilPublico() {
  const { slug } = useParams<{ slug: string }>();
  const { data: config, isLoading, isError } = useFunilPublico(slug);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [etapa, setEtapa] = useState<Etapa>('boas_vindas');
  const [leadData, setLeadData] = useState({ nome: '', telefone: '', email: '' });
  const [servicoEscolhido, setServicoEscolhido] = useState<ServicoFunil | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [inputStep, setInputStep] = useState<'nome' | 'telefone' | 'email'>('nome');
  const [showInput, setShowInput] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Initialize chat when config loads
  useEffect(() => {
    if (config && messages.length === 0) {
      addBotMessage(config.mensagem_boas_vindas);
      setTimeout(() => {
        addOptions([
          { label: '✨ Conhecer os diferenciais', value: 'diferenciais' },
          { label: '💼 Ver serviços e valores', value: 'servicos' },
          { label: '📅 Agendar uma sessão', value: 'agendar' },
        ]);
      }, 800);
    }
  }, [config]);

  const addBotMessage = (texto: string) => {
    setMessages(prev => [...prev, { id: crypto.randomUUID(), tipo: 'bot', texto }]);
  };

  const addUserMessage = (texto: string) => {
    setMessages(prev => [...prev, { id: crypto.randomUUID(), tipo: 'user', texto }]);
  };

  const addOptions = (opcoes: { label: string; value: string }[]) => {
    setMessages(prev => [...prev, { id: crypto.randomUUID(), tipo: 'options', opcoes }]);
  };

  const handleOption = async (value: string) => {
    // Remove the options message
    setMessages(prev => prev.filter(m => m.tipo !== 'options'));

    if (value === 'diferenciais') {
      addUserMessage('Quero conhecer os diferenciais');
      await delay(500);
      addBotMessage(config?.mensagem_diferenciais || 'Nossos diferenciais:');
      await delay(600);
      config?.diferenciais.forEach((d, i) => {
        setTimeout(() => addBotMessage(`⭐ ${d}`), (i + 1) * 400);
      });
      setTimeout(() => {
        addOptions([
          { label: '💼 Ver serviços e valores', value: 'servicos' },
          { label: '📅 Quero agendar!', value: 'agendar' },
        ]);
      }, (config?.diferenciais.length || 0) * 400 + 800);

    } else if (value === 'servicos') {
      addUserMessage('Quero ver serviços e valores');
      await delay(500);
      addBotMessage(config?.mensagem_servicos || 'Nossos serviços:');
      await delay(600);
      config?.servicos.forEach((s, i) => {
        setTimeout(() => {
          addBotMessage(`💼 **${s.nome}**\n${s.descricao}\n💰 R$ ${s.valor.toFixed(2)}${s.parcelas_max > 1 ? ` (até ${s.parcelas_max}x)` : ''}`);
        }, (i + 1) * 500);
      });
      setTimeout(() => {
        const serviceOptions = config?.servicos.map(s => ({
          label: `${s.nome} - R$ ${s.valor.toFixed(2)}`,
          value: `servico_${s.nome}`,
        })) || [];
        addOptions([...serviceOptions, { label: '✨ Ver diferenciais', value: 'diferenciais' }]);
      }, (config?.servicos.length || 0) * 500 + 800);

    } else if (value.startsWith('servico_')) {
      const nomeServico = value.replace('servico_', '');
      const servico = config?.servicos.find(s => s.nome === nomeServico);
      if (servico) {
        setServicoEscolhido(servico);
        addUserMessage(`Quero: ${servico.nome}`);
        await delay(500);
        addBotMessage(config?.mensagem_agendamento || 'Ótima escolha! Vamos precisar de seus dados.');
        await delay(600);
        addBotMessage('Qual é o seu nome completo?');
        setShowInput(true);
        setInputStep('nome');
      }

    } else if (value === 'agendar') {
      addUserMessage('Quero agendar uma sessão');
      await delay(500);
      addBotMessage('Primeiro, me conta qual serviço te interessa:');
      await delay(400);
      const serviceOptions = config?.servicos.map(s => ({
        label: `${s.nome} - R$ ${s.valor.toFixed(2)}`,
        value: `servico_${s.nome}`,
      })) || [];
      addOptions(serviceOptions);

    } else if (value === 'pix') {
      addUserMessage('Pagar via PIX');
      await delay(500);
      if (config?.pix_chave) {
        addBotMessage(`📱 **Chave PIX (${config.pix_tipo?.toUpperCase()}):**\n\`${config.pix_chave}\`\n${config.pix_nome ? `Nome: ${config.pix_nome}` : ''}`);
        addBotMessage('Após o pagamento, envie o comprovante pelo WhatsApp para confirmarmos seu agendamento! 🙌');
      } else {
        addBotMessage('Entre em contato conosco para detalhes de pagamento via PIX.');
      }
      await delay(800);
      addBotMessage(config?.mensagem_confirmacao || 'Obrigado! Seu interesse foi registrado. Entraremos em contato em breve! ✅');
      setEtapa('confirmacao');

    } else if (value === 'cartao') {
      addUserMessage('Pagar via Cartão');
      await delay(500);
      if (config?.link_cartao) {
        addBotMessage('🔗 Clique no link abaixo para realizar o pagamento com cartão:');
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            tipo: 'bot',
            texto: `💳 [Pagar com Cartão](${config.link_cartao})`,
          }]);
        }, 400);
      } else {
        addBotMessage('Entre em contato conosco para detalhes de pagamento com cartão.');
      }
      await delay(800);
      addBotMessage(config?.mensagem_confirmacao || 'Obrigado! Seu interesse foi registrado. Entraremos em contato em breve! ✅');
      setEtapa('confirmacao');
    }
  };

  const handleInputSubmit = async () => {
    if (!inputValue.trim()) return;
    const val = inputValue.trim();
    setInputValue('');

    if (inputStep === 'nome') {
      setLeadData(prev => ({ ...prev, nome: val }));
      addUserMessage(val);
      await delay(400);
      addBotMessage('📱 Qual seu telefone (WhatsApp)?');
      setInputStep('telefone');
    } else if (inputStep === 'telefone') {
      setLeadData(prev => ({ ...prev, telefone: val }));
      addUserMessage(val);
      await delay(400);
      addBotMessage('📧 E seu email? (opcional, pode digitar "pular")');
      setInputStep('email');
    } else if (inputStep === 'email') {
      const email = val.toLowerCase() === 'pular' ? '' : val;
      setLeadData(prev => ({ ...prev, email }));
      addUserMessage(val);
      setShowInput(false);

      // Save lead
      await delay(500);
      addBotMessage('Perfeito! Registrando seus dados... ⏳');

      try {
        const { data: lead, error } = await supabase.from('funil_leads').insert({
          terapeuta_id: config!.terapeuta_id!,
          funil_config_id: config!.id!,
          nome: leadData.nome || val,
          telefone: leadData.telefone,
          email,
          servico_escolhido: servicoEscolhido?.nome || null,
          valor_servico: servicoEscolhido?.valor || null,
          etapa_atual: 'pagamento',
          status: 'em_andamento',
        } as any).select().single();

        if (error) throw error;
        setLeadId(lead?.id);
      } catch (e) {
        console.error('Error saving lead:', e);
      }

      await delay(600);
      addBotMessage(config?.mensagem_pagamento || 'Como deseja pagar?');
      await delay(400);
      const payOpts: { label: string; value: string }[] = [];
      if (config?.pix_chave) payOpts.push({ label: '📱 PIX', value: 'pix' });
      if (config?.link_cartao) payOpts.push({ label: '💳 Cartão de Crédito', value: 'cartao' });
      if (payOpts.length === 0) {
        addBotMessage('Entre em contato para combinar a forma de pagamento.');
        addBotMessage(config?.mensagem_confirmacao || 'Registramos seu interesse! Entraremos em contato. ✅');
      } else {
        addOptions(payOpts);
      }
    }
  };

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-3">
          <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold text-foreground">Funil não encontrado</h2>
          <p className="text-muted-foreground">Este link pode estar inativo ou incorreto.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex flex-col">
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4 shadow-lg">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <img src={logoMyHealthId} alt="Logo" className="h-10 w-10 rounded-full object-cover" />
          <div>
            <h1 className="font-bold text-lg">Atendimento</h1>
            <p className="text-xs opacity-80">Online • Resposta automática</p>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full space-y-3">
        {messages.map(msg => (
          <div key={msg.id}>
            {msg.tipo === 'bot' && (
              <div className="flex gap-2 items-start">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <MessageCircle className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%] shadow-sm">
                  <p className="text-sm text-foreground whitespace-pre-line">
                    {msg.texto?.split(/(\*\*.*?\*\*)/g).map((part, i) =>
                      part.startsWith('**') && part.endsWith('**')
                        ? <strong key={i}>{part.slice(2, -2)}</strong>
                        : part.startsWith('`') && part.endsWith('`')
                          ? <code key={i} className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono select-all">{part.slice(1, -1)}</code>
                          : part.match(/\[.*?\]\(.*?\)/)
                            ? <a key={i} href={part.match(/\((.*?)\)/)?.[1]} target="_blank" rel="noopener noreferrer" className="text-primary underline font-medium">{part.match(/\[(.*?)\]/)?.[1]}</a>
                            : part
                    )}
                  </p>
                </div>
              </div>
            )}

            {msg.tipo === 'user' && (
              <div className="flex justify-end">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%] shadow-sm">
                  <p className="text-sm">{msg.texto}</p>
                </div>
              </div>
            )}

            {msg.tipo === 'options' && (
              <div className="flex flex-col gap-2 ml-10">
                {msg.opcoes?.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleOption(opt.value)}
                    className="text-left bg-card hover:bg-accent/10 border border-border hover:border-accent rounded-xl px-4 py-3 text-sm font-medium text-foreground transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input area */}
      {showInput && (
        <div className="border-t border-border bg-card p-4 max-w-lg mx-auto w-full">
          <form
            onSubmit={e => { e.preventDefault(); handleInputSubmit(); }}
            className="flex gap-2"
          >
            <Input
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder={
                inputStep === 'nome' ? 'Seu nome completo...' :
                inputStep === 'telefone' ? '(11) 99999-9999' :
                'email@exemplo.com'
              }
              className="flex-1"
              autoFocus
            />
            <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}

      {/* Footer */}
      {etapa === 'confirmacao' && (
        <div className="border-t border-border bg-success/10 p-4 max-w-lg mx-auto w-full text-center">
          <CheckCircle2 className="h-6 w-6 text-success mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Atendimento finalizado</p>
          <p className="text-xs text-muted-foreground mt-1">Entraremos em contato em breve!</p>
        </div>
      )}
    </div>
  );
}
