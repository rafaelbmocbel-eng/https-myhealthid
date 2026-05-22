import { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useFunilPublico, ServicoFunil, fetchFunilPagamento } from '@/hooks/useFunilConfig';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MessageCircle, Send, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { format, addDays, isBefore, startOfDay, parseISO, setHours, setMinutes, addMinutes, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { gerarPixQrCodeDataUrl, gerarPixPayload } from '@/utils/pixQrCode';
import logoMyHealthId from '@/assets/logo-my-health-id.jpg';
import { useUtmCapture, getCapturedUtm } from '@/hooks/useUtmCapture';
import { PublicTrackingPixels } from '@/components/tracking/PublicTrackingPixels';

type Etapa = 'boas_vindas' | 'coleta_dados' | 'diferenciais' | 'servicos' | 'agendamento' | 'pagamento' | 'confirmacao';

interface ChatMessage {
  id: string;
  tipo: 'bot' | 'user' | 'options' | 'input' | 'calendar' | 'timeslots' | 'qrcode';
  texto?: string;
  opcoes?: { label: string; value: string }[];
  dates?: Date[];
  slots?: { label: string; inicio: string; fim: string }[];
  qrCodeUrl?: string;
  pixPayload?: string;
}

const DAY_MAP: Record<number, string> = { 0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab' };

export default function FunilPublico() {
  useUtmCapture();
  const { slug } = useParams<{ slug: string }>();
  const { data: config, isLoading, isError } = useFunilPublico(slug);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [etapa, setEtapa] = useState<Etapa>('boas_vindas');
  const [leadData, setLeadData] = useState({ nome: '', telefone: '', email: '' });
  const [servicoEscolhido, setServicoEscolhido] = useState<ServicoFunil | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leadToken, setLeadToken] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [inputStep, setInputStep] = useState<'nome' | 'telefone' | 'email'>('nome');
  const [showInput, setShowInput] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const chatRef = useRef<HTMLDivElement>(null);
  const [paymentInfo, setPaymentInfo] = useState<{ pix_chave: string; pix_tipo: string; pix_nome: string; link_cartao: string } | null>(null);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

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

  const addCalendar = () => {
    setMessages(prev => [...prev, { id: crypto.randomUUID(), tipo: 'calendar' }]);
  };

  const addTimeSlots = (slots: { label: string; inicio: string; fim: string }[]) => {
    setMessages(prev => [...prev, { id: crypto.randomUUID(), tipo: 'timeslots', slots }]);
  };

  const addQrCode = (qrCodeUrl: string, pixPayload: string) => {
    setMessages(prev => [...prev, { id: crypto.randomUUID(), tipo: 'qrcode', qrCodeUrl, pixPayload }]);
  };

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  // Fetch agenda config and available slots for a date
  const fetchAvailableSlots = async (date: Date) => {
    if (!config?.terapeuta_id) return [];

    // Get agenda config via secure RPC (slug-validated)
    const { data: agendaConfig } = await supabase
      .rpc('get_config_agenda_by_funil_slug', { p_slug: slug! })
      .maybeSingle();

    if (!agendaConfig) return [];

    const diasSemana = agendaConfig.dias_semana as Record<string, boolean>;
    const dayKey = DAY_MAP[date.getDay()];
    if (!diasSemana[dayKey]) return [];

    const duracao = agendaConfig.duracao_padrao || 60;
    const intervalo = agendaConfig.intervalo_entre_sessoes || 0;
    const vagas = agendaConfig.vagas_por_horario || 1;

    // Parse start/end hours
    const [hInicio, mInicio] = (agendaConfig.horario_inicio as string).split(':').map(Number);
    const [hFim, mFim] = (agendaConfig.horario_fim as string).split(':').map(Number);

    // Get existing agendamentos for this date
    const startOfDate = format(date, 'yyyy-MM-dd') + 'T00:00:00';
    const endOfDate = format(date, 'yyyy-MM-dd') + 'T23:59:59';

    const { data: existingAg } = await supabase
      .rpc('get_agenda_disponibilidade', {
        p_terapeuta_id: config.terapeuta_id,
        p_data_inicio: startOfDate,
        p_data_fim: endOfDate,
      });

    // Generate all possible slots
    const slots: { label: string; inicio: string; fim: string }[] = [];
    let current = setMinutes(setHours(date, hInicio), mInicio);
    const endTime = setMinutes(setHours(date, hFim), mFim);
    const now = new Date();

    while (isBefore(current, endTime)) {
      const slotEnd = addMinutes(current, duracao);
      if (isAfter(slotEnd, endTime)) break;
      if (isBefore(current, now)) {
        current = addMinutes(current, duracao + intervalo);
        continue;
      }

      // Count how many agendamentos overlap this slot
      const overlaps = (existingAg || []).filter(ag => {
        if (ag.status !== 'confirmado' && ag.status !== 'pendente') return false;
        const agStart = new Date(ag.data_inicio);
        const agEnd = new Date(ag.data_fim);
        return isBefore(current, agEnd) && isAfter(slotEnd, agStart);
      }).length;

      if (overlaps < vagas) {
        slots.push({
          label: format(current, 'HH:mm') + ' - ' + format(slotEnd, 'HH:mm'),
          inicio: current.toISOString(),
          fim: slotEnd.toISOString(),
        });
      }

      current = addMinutes(current, duracao + intervalo);
    }

    return slots;
  };

  const getAvailableDays = (agendaConfig: any): boolean[] => {
    if (!agendaConfig) return Array(7).fill(false);
    const dias = agendaConfig.dias_semana as Record<string, boolean>;
    return [dias.dom, dias.seg, dias.ter, dias.qua, dias.qui, dias.sex, dias.sab];
  };

  const handleDateSelect = async (date: Date) => {
    setSelectedDate(date);
    // Remove calendar and old timeslots
    setMessages(prev => prev.filter(m => m.tipo !== 'calendar' && m.tipo !== 'timeslots'));
    addUserMessage(format(date, "dd 'de' MMMM (EEEE)", { locale: ptBR }));
    await delay(500);
    addBotMessage('Buscando horários disponíveis... ⏳');

    const slots = await fetchAvailableSlots(date);

    // Remove loading message
    setMessages(prev => prev.slice(0, -1));

    if (slots.length === 0) {
      addBotMessage('😕 Não há horários disponíveis nesta data. Escolha outra:');
      addCalendar();
    } else {
      addBotMessage(`📅 Horários disponíveis para ${format(date, 'dd/MM')}:`);
      await delay(300);
      addTimeSlots(slots);
    }
  };

  const handleSlotSelect = async (slot: { label: string; inicio: string; fim: string }) => {
    setMessages(prev => prev.filter(m => m.tipo !== 'timeslots'));
    addUserMessage(`🕐 ${slot.label}`);
    await delay(500);

    // Create agendamento
    try {
      const { error } = await supabase.from('agendamentos').insert({
        terapeuta_id: config!.terapeuta_id!,
        data_inicio: slot.inicio,
        data_fim: slot.fim,
        status: 'pendente',
        titulo: `Funil: ${leadData.nome}`,
        observacoes: `Lead via funil - Serviço: ${servicoEscolhido?.nome || 'N/A'} - Tel: ${leadData.telefone}`,
        tipo_atendimento: 'avaliacao',
      } as any);

      if (error) throw error;

      // Update lead with agendamento info (requer header com session_token)
      if (leadId && leadToken) {
        const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL;
        const SUPABASE_KEY = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY;
        await fetch(`${SUPABASE_URL}/rest/v1/funil_leads?id=eq.${leadId}`, {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'x-lead-token': leadToken,
          },
          body: JSON.stringify({ etapa_atual: 'pagamento' }),
        }).catch(err => console.error('Erro ao atualizar lead:', err));
      }

      addBotMessage('✅ Horário reservado com sucesso!');
    } catch (e) {
      console.error('Erro ao agendar:', e);
      addBotMessage('⚠️ Houve um erro ao reservar. Mas não se preocupe, registramos seus dados.');
    }

    await delay(600);
    // Move to payment - fetch payment details securely
    addBotMessage(config?.mensagem_pagamento || 'Como deseja pagar?');
    await delay(400);
    
    let paymentData: { pix_chave: string; pix_tipo: string; pix_nome: string; link_cartao: string } | null = null;
    if (leadId && config?.id) {
      try {
        paymentData = await fetchFunilPagamento(config.id, leadId);
      } catch (e) {
        console.error('Error fetching payment data:', e);
      }
    }
    
    const payOpts: { label: string; value: string }[] = [];
    if (paymentData?.pix_chave) payOpts.push({ label: '📱 PIX (QR Code)', value: 'pix' });
    payOpts.push({ label: '💳 Cartão de Crédito', value: 'cartao' });
    if (payOpts.length === 0) {
      addBotMessage('Entre em contato para combinar a forma de pagamento.');
      addBotMessage(config?.mensagem_confirmacao || 'Registramos seu interesse! ✅');
      setEtapa('confirmacao');
    } else {
      // Store payment data for later use
      setPaymentInfo(paymentData);
      addOptions(payOpts);
    }
  };

  const handleOption = async (value: string) => {
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
      if (paymentInfo?.pix_chave && paymentInfo?.pix_nome) {
        addBotMessage('📱 Escaneie o QR Code abaixo para pagar:');
        try {
          const qrUrl = await gerarPixQrCodeDataUrl({
            chave: paymentInfo.pix_chave,
            nome: paymentInfo.pix_nome,
            valor: servicoEscolhido?.valor,
            descricao: servicoEscolhido?.nome?.substring(0, 25),
          });
          const payload = gerarPixPayload({
            chave: paymentInfo.pix_chave,
            nome: paymentInfo.pix_nome,
            valor: servicoEscolhido?.valor,
            descricao: servicoEscolhido?.nome?.substring(0, 25),
          });
          addQrCode(qrUrl, payload);
        } catch {
          addBotMessage(`**Chave PIX (${paymentInfo.pix_tipo?.toUpperCase()}):**\n\`${paymentInfo.pix_chave}\`\n${paymentInfo.pix_nome ? `Nome: ${paymentInfo.pix_nome}` : ''}`);
        }
        await delay(500);
        if (servicoEscolhido?.valor) {
          addBotMessage(`💰 Valor: **R$ ${servicoEscolhido.valor.toFixed(2)}**`);
        }
        addBotMessage('Após o pagamento, envie o comprovante pelo WhatsApp para confirmarmos! 🙌');
      } else if (paymentInfo?.pix_chave) {
        addBotMessage(`📱 **Chave PIX (${paymentInfo.pix_tipo?.toUpperCase()}):**\n\`${paymentInfo.pix_chave}\`\n${paymentInfo.pix_nome ? `Nome: ${paymentInfo.pix_nome}` : ''}`);
      } else {
        addBotMessage('Entre em contato para detalhes de pagamento via PIX.');
      }
      await delay(800);
      addBotMessage(config?.mensagem_confirmacao || 'Obrigado! Seu interesse foi registrado. ✅');
      setEtapa('confirmacao');

    } else if (value === 'cartao') {
      addUserMessage('Pagar via Cartão');
      await delay(500);
      addBotMessage('⏳ Gerando seu link de pagamento...');
      try {
        const { createSumUpCheckout } = await import('@/utils/sumupCheckout');
        const result = await createSumUpCheckout({
          amount: servicoEscolhido?.valor || 0,
          description: servicoEscolhido?.nome || 'Pagamento',
          customer_name: leadData.nome,
          customer_email: leadData.email || undefined,
          reference: leadId ? `lead_${leadId}` : undefined,
          redirect_url: window.location.href,
        });
        // Remove the loading message
        setMessages(prev => prev.filter(m => m.texto !== '⏳ Gerando seu link de pagamento...'));
        addBotMessage('🔗 Clique no link abaixo para realizar o pagamento:');
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            tipo: 'bot',
            texto: `💳 [Pagar com Cartão](${result.checkout_url})`,
          }]);
        }, 400);
      } catch (err) {
        console.error('SumUp checkout error:', err);
        setMessages(prev => prev.filter(m => m.texto !== '⏳ Gerando seu link de pagamento...'));
        if (paymentInfo?.link_cartao) {
          addBotMessage('🔗 Clique no link abaixo para realizar o pagamento:');
          setTimeout(() => {
            setMessages(prev => [...prev, {
              id: crypto.randomUUID(),
              tipo: 'bot',
              texto: `💳 [Pagar com Cartão](${paymentInfo.link_cartao})`,
            }]);
          }, 400);
        } else {
          addBotMessage('Não foi possível gerar o link de pagamento. Entre em contato para combinar.');
        }
      }
      await delay(800);
      addBotMessage(config?.mensagem_confirmacao || 'Obrigado! Seu interesse foi registrado. ✅');
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
          etapa_atual: 'agendamento',
          status: 'em_andamento',
          origem_utm: getCapturedUtm() as never,
        } as any).select('id, session_token').single();

        if (error) throw error;
        setLeadId(lead?.id);
        setLeadToken((lead as any)?.session_token ?? null);
      } catch (e) {
        console.error('Error saving lead:', e);
      }

      await delay(600);
      addBotMessage('Agora vamos escolher o melhor horário para você! 📅');
      await delay(400);
      addBotMessage('Selecione uma data:');
      await delay(300);
      addCalendar();
    }
  };

  // Mini calendar component rendered inside chat
  const renderCalendar = () => {
    const today = startOfDay(new Date());
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days: (Date | null)[] = [];

    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));

    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    return (
      <div className="ml-10 bg-card border border-border rounded-xl p-3 shadow-sm max-w-[300px]">
        <div className="flex items-center justify-between mb-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium capitalize">
            {format(calendarMonth, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekDays.map((w, i) => (
            <span key={i} className="text-xs text-muted-foreground font-medium py-1">{w}</span>
          ))}
          {days.map((day, i) => {
            if (!day) return <span key={`empty-${i}`} />;
            const isPast = isBefore(day, today);
            return (
              <button
                key={day.toISOString()}
                disabled={isPast}
                onClick={() => handleDateSelect(day)}
                className={cn(
                  'h-8 w-8 rounded-lg text-xs font-medium transition-colors',
                  isPast
                    ? 'text-muted-foreground/40 cursor-not-allowed'
                    : 'hover:bg-primary/10 text-foreground cursor-pointer',
                  selectedDate && format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
                    ? 'bg-primary text-primary-foreground'
                    : ''
                )}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTimeSlots = (slots: { label: string; inicio: string; fim: string }[]) => (
    <div className="ml-10 flex flex-wrap gap-2 max-w-[320px]">
      {slots.map(slot => (
        <button
          key={slot.inicio}
          onClick={() => handleSlotSelect(slot)}
          className="bg-card hover:bg-primary/10 border border-border hover:border-primary rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-all shadow-sm"
        >
          🕐 {slot.label}
        </button>
      ))}
    </div>
  );

  const renderQrCode = (msg: ChatMessage) => (
    <div className="flex gap-2 items-start">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
        <MessageCircle className="h-4 w-4 text-primary" />
      </div>
      <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm text-center">
        <img src={msg.qrCodeUrl} alt="QR Code PIX" className="mx-auto rounded-lg" style={{ width: 220, height: 220 }} />
        <p className="text-xs text-muted-foreground mt-2">Escaneie com o app do seu banco</p>
        <button
          onClick={() => {
            navigator.clipboard.writeText(msg.pixPayload || '');
          }}
          className="mt-2 text-xs text-primary hover:underline font-medium"
        >
          📋 Copiar código PIX
        </button>
      </div>
    </div>
  );

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

            {msg.tipo === 'calendar' && renderCalendar()}
            {msg.tipo === 'timeslots' && msg.slots && renderTimeSlots(msg.slots)}
            {msg.tipo === 'qrcode' && renderQrCode(msg)}
          </div>
        ))}
      </div>

      {/* Input area */}
      {showInput && (
        <div className="border-t border-border bg-card p-4 max-w-lg mx-auto w-full">
          <form onSubmit={e => { e.preventDefault(); handleInputSubmit(); }} className="flex gap-2">
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
            <Button type="submit" size="icon">
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
