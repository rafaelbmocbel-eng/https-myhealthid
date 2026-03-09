import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useFunilPublico, ServicoFunil } from '@/hooks/useFunil';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, CheckCircle2, User, Sparkles, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

type MessageType = {
    id: string;
    type: 'bot' | 'user' | 'options';
    text?: string;
    options?: { label: string; value: string }[];
};

const FunilChat = () => {
    const { slug } = useParams<{ slug: string }>();
    const { data: config, isLoading, isError } = useFunilPublico(slug);
    const [messages, setMessages] = useState<MessageType[]>([]);
    const [step, setStep] = useState<'intro' | 'collect_info' | 'payment' | 'done'>('intro');
    const [leadData, setLeadData] = useState({ nome: '', telefone: '', email: '' });
    const [currentInfoStep, setCurrentInfoStep] = useState<'nome' | 'telefone' | 'email'>('nome');
    const [inputValue, setInputValue] = useState('');
    const [selectedService, setSelectedService] = useState<ServicoFunil | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Start the conversation
    useEffect(() => {
        if (config && messages.length === 0) {
            startChat();
        }
    }, [config]);

    const startChat = async () => {
        addBotMessage(config!.mensagem_boas_vindas);
        await delay(1000);
        addBotOptions([
            { label: '✨ Conhecer Diferenciais', value: 'diferenciais' },
            { label: '💼 Ver Serviços', value: 'servicos' },
            { label: '📅 Quero Agendar', value: 'agendar' },
        ]);
    };

    const addBotMessage = (text: string) => {
        setMessages(prev => [...prev, { id: Date.now().toString() + Math.random(), type: 'bot', text }]);
    };

    const addUserMessage = (text: string) => {
        setMessages(prev => [...prev, { id: Date.now().toString() + Math.random(), type: 'user', text }]);
    };

    const addBotOptions = (options: { label: string; value: string }[]) => {
        setMessages(prev => [...prev, { id: Date.now().toString() + Math.random(), type: 'options', options }]);
    };

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    const handleOptionClick = async (value: string) => {
        // Hide previous options
        setMessages(prev => prev.filter(m => m.type !== 'options'));

        if (value === 'diferenciais') {
            addUserMessage('Quero conhecer seus diferenciais');
            await delay(800);
            addBotMessage(config!.mensagem_diferenciais);
            await delay(500);
            config!.diferenciais.forEach((dif, i) => {
                setTimeout(() => addBotMessage(`⭐ ${dif}`), (i + 1) * 600);
            });
            setTimeout(() => {
                addBotOptions([
                    { label: '💼 Ver Serviços', value: 'servicos' },
                    { label: '📅 Quero Agendar', value: 'agendar' },
                ]);
            }, (config!.diferenciais.length + 1) * 600);

        } else if (value === 'servicos') {
            addUserMessage('Quero ver os serviços e valores');
            await delay(800);
            addBotMessage(config!.mensagem_servicos);
            await delay(500);
            config!.servicos.forEach((srv, i) => {
                setTimeout(() => {
                    const desc = srv.descricao ? `${srv.descricao}\n` : '';
                    addBotMessage(`**${srv.nome}**\n${desc}💰 Valor: R$ ${srv.valor.toFixed(2)}${srv.parcelas_max > 1 ? ` (até ${srv.parcelas_max}x)` : ''}`);
                }, (i + 1) * 700);
            });
            setTimeout(() => {
                const servOptions = config!.servicos.map(s => ({
                    label: `${s.nome} - R$ ${s.valor}`,
                    value: `select_srv:${s.nome}`
                }));
                addBotOptions([...servOptions, { label: '✨ Ver Diferenciais', value: 'diferenciais' }]);
            }, (config!.servicos.length + 1) * 700);

        } else if (value.startsWith('select_srv:') || value === 'agendar') {
            if (value.startsWith('select_srv:')) {
                const srvName = value.split(':')[1];
                const srv = config!.servicos.find(s => s.nome === srvName);
                if (srv) {
                    setSelectedService(srv);
                    addUserMessage(`Tenho interesse no serviço: ${srv.nome}`);
                }
            } else {
                addUserMessage('Quero agendar uma consulta');
            }

            await delay(800);
            addBotMessage(config!.mensagem_agendamento);
            await delay(700);
            addBotMessage('Para começar, qual o seu nome completo?');
            setStep('collect_info');
            setCurrentInfoStep('nome');

        } else if (value === 'pay_pix') {
            addUserMessage('Pagar via PIX');
            await delay(800);
            addBotMessage(`Perfeito! Aqui estão os dados para o PIX:`);
            await delay(500);
            addBotMessage(`**Chave PIX (${config!.pix_tipo.toUpperCase()}):**\n${config!.pix_chave}\n\n**Favorecido:**\n${config!.pix_nome || 'Consultório'}`);
            await delay(800);
            finishLead();

        } else if (value === 'pay_card') {
            addUserMessage('Pagar via Cartão');
            await delay(800);
            addBotMessage(`Certo! Clique no botão abaixo para ir ao ambiente de pagamento seguro:`);
            await delay(500);
            setMessages(prev => [...prev, {
                id: 'card_link',
                type: 'bot',
                text: `🔗 [Clique aqui para pagar no cartão](${config!.link_cartao})`
            }]);
            await delay(1200);
            finishLead();
        }
    };

    const handleInputSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const val = inputValue.trim();
        setInputValue('');
        addUserMessage(val);
        await delay(600);

        if (currentInfoStep === 'nome') {
            setLeadData(prev => ({ ...prev, nome: val }));
            addBotMessage(`Prazer, ${val.split(' ')[0]}! Qual o seu WhatsApp (com DDD)?`);
            setCurrentInfoStep('telefone');
        } else if (currentInfoStep === 'telefone') {
            setLeadData(prev => ({ ...prev, telefone: val }));
            addBotMessage('E qual o seu melhor e-mail? (Pode digitar "não tenho" se preferir)');
            setCurrentInfoStep('email');
        } else if (currentInfoStep === 'email') {
            setLeadData(prev => ({ ...prev, email: val }));
            await saveLead({ ...leadData, email: val });
            addBotMessage(config!.mensagem_pagamento);
            await delay(400);

            const payOptions = [];
            if (config!.pix_chave) payOptions.push({ label: '📱 Pagar via PIX', value: 'pay_pix' });
            if (config!.link_cartao) payOptions.push({ label: '💳 Pagar via Cartão', value: 'pay_card' });

            if (payOptions.length === 0) {
                finishLead();
            } else {
                addBotOptions(payOptions);
                setStep('payment');
            }
        }
    };

    const saveLead = async (data: typeof leadData) => {
        try {
            await supabase.from('funil_leads').insert({
                terapeuta_id: config!.terapeuta_id,
                funil_config_id: config!.id,
                nome: data.nome,
                telefone: data.telefone,
                email: data.email,
                servico_escolhido: selectedService?.nome,
                valor_servico: selectedService?.valor,
                status: 'novo'
            });
        } catch (err) {
            console.error('Error saving lead:', err);
        }
    };

    const finishLead = async () => {
        await delay(1000);
        addBotMessage(config!.mensagem_confirmacao);
        setStep('done');
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    if (isError || !config) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full text-center p-8 border-dashed shadow-none">
                    <Avatar className="h-20 w-20 mx-auto mb-4 border-2 border-slate-200">
                        <AvatarFallback className="bg-slate-100 text-slate-400">?</AvatarFallback>
                    </Avatar>
                    <h2 className="text-lg font-bold">Funil não encontrado</h2>
                    <p className="text-sm text-muted-foreground mt-2">Este link pode estar inativo ou o endereço está incorreto.</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <div className="max-w-2xl mx-auto min-h-screen flex flex-col bg-white border-x shadow-sm">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b p-4 flex items-center gap-3">
                    <Avatar className="h-10 w-10 border shadow-sm">
                        <AvatarImage src="/placeholder-avatar.jpg" />
                        <AvatarFallback className="bg-primary text-white"><User className="h-5 w-5" /></AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-sm font-bold flex items-center gap-1.5">
                            Atendimento Digital <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        </h1>
                        <p className="text-[10px] text-muted-foreground">Assistente virtual • Resposta instantânea</p>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg) => (
                        <div key={msg.id} className={cn("flex w-full", msg.type === 'user' ? "justify-end" : "justify-start animate-in fade-in slide-in-from-bottom-2 duration-300")}>
                            {msg.type === 'bot' && (
                                <div className="flex items-start gap-2 max-w-[85%]">
                                    <Avatar className="h-8 w-8 mt-1 border shrink-0">
                                        <AvatarFallback className="bg-slate-100 text-slate-600 text-[10px] font-bold">AI</AvatarFallback>
                                    </Avatar>
                                    <div className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 p-3 rounded-2xl rounded-tl-none text-sm whitespace-pre-wrap leading-relaxed shadow-sm">
                                        {msg.text?.split('\n').map((line, i) => {
                                            // Simple bold handling
                                            const parts = line.split(/(\*\*.*?\*\*)/g);
                                            return (
                                                <div key={i}>
                                                    {parts.map((part, j) =>
                                                        part.startsWith('**') && part.endsWith('**')
                                                            ? <strong key={j}>{part.slice(2, -2)}</strong>
                                                            : part
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {msg.type === 'user' && (
                                <div className="max-w-[80%] bg-primary text-primary-foreground p-3 rounded-2xl rounded-tr-none text-sm shadow-md">
                                    {msg.text}
                                </div>
                            )}

                            {msg.type === 'options' && (
                                <div className="flex flex-col gap-2 w-full mt-2 pl-10 pr-4">
                                    {msg.options?.map((opt) => (
                                        <Button
                                            key={opt.value}
                                            variant="outline"
                                            onClick={() => handleOptionClick(opt.value)}
                                            className="justify-start text-left h-auto py-3 px-4 rounded-xl border-primary/20 hover:bg-primary/5 hover:border-primary transition-all group"
                                        >
                                            <span className="flex-1">{opt.label}</span>
                                            <Sparkles className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    <div ref={chatEndRef} className="h-10" />
                </div>

                {/* Footer / Input */}
                <div className="p-4 border-t bg-slate-50/50">
                    {step === 'collect_info' ? (
                        <form onSubmit={handleInputSubmit} className="flex gap-2">
                            <Input
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                placeholder={
                                    currentInfoStep === 'nome' ? "Seu nome completo..." :
                                        currentInfoStep === 'telefone' ? "(00) 00000-0000" :
                                            "Seu melhor e-mail..."
                                }
                                className="rounded-full px-5 py-6 shadow-sm border-primary/20 focus-visible:ring-primary"
                                autoFocus
                            />
                            <Button type="submit" size="icon" className="h-12 w-12 rounded-full shrink-0 shadow-lg">
                                <Send className="h-5 w-5" />
                            </Button>
                        </form>
                    ) : step === 'done' ? (
                        <div className="text-center py-4 text-emerald-600 font-medium flex items-center justify-center gap-2">
                            <CheckCircle2 className="h-5 w-5" /> Atendimento Concluído
                        </div>
                    ) : (
                        <div className="text-center py-3 text-[10px] text-muted-foreground uppercase tracking-widest font-bold flex items-center justify-center gap-2">
                            <MessageSquare className="h-3 w-3" /> Selecione uma opção acima para continuar
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FunilChat;
