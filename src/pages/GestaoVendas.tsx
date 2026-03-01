import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Users, MessageSquare, DollarSign, Clock,
    ArrowRight, Send, CheckCircle2, AlertCircle,
    ClipboardList, TrendingUp
} from 'lucide-react';
import { sharePropostaComercial } from '@/utils/whatsapp';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function GestaoVendas() {
    const [selectedService, setSelectedService] = useState('Método Identidade');
    const [quoteValue, setQuoteValue] = useState('');
    const [selectedPatient, setSelectedPatient] = useState<any>(null);

    // Fetch patients for the quote generator
    const { data: patients = [] } = useQuery({
        queryKey: ['crm-patients'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pacientes')
                .select('*')
                .order('nome');
            if (error) throw error;
            return data || [];
        }
    });

    // Fetch pending MyID links (follow-up)
    const { data: pendingLinks = [] } = useQuery({
        queryKey: ['crm-pending-links'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('links_avaliacao')
                .select('*, pacientes(nome, sobrenome, telefone)')
                .eq('status', 'ativo')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        }
    });

    const handleSendQuote = () => {
        if (!selectedPatient || !quoteValue) return;
        sharePropostaComercial(
            `${selectedPatient.nome} ${selectedPatient.sobrenome}`,
            selectedPatient.telefone || '',
            selectedService,
            `R$ ${quoteValue}`
        );
    };

    return (
        <AppLayout title="Gestão & CRM">
            <div className="space-y-6">
                {/* Top Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <Users className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-xs font-medium opacity-80 uppercase">Total Pacientes</p>
                                <h3 className="text-2xl font-black">{patients.length}</h3>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-none">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <Clock className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-xs font-medium opacity-80 uppercase">Links Pendentes</p>
                                <h3 className="text-2xl font-black">{pendingLinks.length}</h3>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-100 border-none">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="p-2 bg-slate-200 rounded-lg text-slate-700">
                                <DollarSign className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-slate-500 uppercase">Conversão</p>
                                <h3 className="text-2xl font-black text-slate-800">82%</h3>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-slate-100 border-none">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="p-2 bg-slate-200 rounded-lg text-slate-700">
                                <TrendingUp className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-xs font-medium text-slate-500 uppercase">Metas Mensais</p>
                                <h3 className="text-2xl font-black text-slate-800">R$ 12k</h3>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Follow-up Section */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="border-border shadow-sm overflow-hidden">
                            <CardHeader className="bg-muted/30 pb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base font-black flex items-center gap-2">
                                            <AlertCircle className="h-4 w-4 text-orange-500" />
                                            Follow-up: MyID Pendentes
                                        </CardTitle>
                                        <CardDescription className="text-xs">
                                            Pacientes que ainda não responderam ao questionário clínico.
                                        </CardDescription>
                                    </div>
                                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                        Critério: {'>'} 48h
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-border">
                                    {pendingLinks.length > 0 ? pendingLinks.map((link: any) => {
                                        const daysPending = differenceInDays(new Date(), new Date(link.created_at));
                                        const isUrgent = daysPending >= 3;

                                        return (
                                            <div key={link.id} className="p-4 flex items-center justify-between hover:bg-muted/20 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${isUrgent ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        {link.pacientes?.nome?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-foreground">
                                                            {link.pacientes?.nome} {link.pacientes?.sobrenome}
                                                        </h4>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            Enviado em: {format(new Date(link.created_at), "dd/MM 'às' HH:mm")} ({daysPending} dias atrás)
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1 border-orange-200 text-orange-700 hover:bg-orange-50">
                                                        <MessageSquare className="h-3 w-3" />
                                                        Relembrar
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    }) : (
                                        <div className="p-8 text-center text-muted-foreground text-xs italic">
                                            Não há links pendentes com tempo excedido.
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Recent Conversions or Activities */}
                        <Card className="border-border shadow-sm">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-base font-black">Atividades de Vendas Recentes</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-bold text-emerald-900 dark:text-emerald-400">Pacote Fechado: Studio Personal ID</p>
                                        <p className="text-[10px] text-emerald-800/70 dark:text-emerald-500/70">Paciente: Rafael Mocbel - Conversão via Proposta WhatsApp</p>
                                    </div>
                                    <span className="ml-auto text-[10px] font-bold text-emerald-700">R$ 1.800</span>
                                </div>
                                <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                                    <Send className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-700">Proposta Enviada</p>
                                        <p className="text-[10px] text-slate-500">Paciente: Ana Silva - Método Identidade + Bio-Individulidade</p>
                                    </div>
                                    <span className="ml-auto text-[10px] font-bold text-slate-400">Há 2h</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Proposta Generator Section */}
                    <div className="space-y-6">
                        <Card className="border-primary/20 shadow-md bg-gradient-to-br from-white to-primary/5">
                            <CardHeader className="pb-4 border-b border-primary/10">
                                <CardTitle className="text-base font-black flex items-center gap-2 text-primary uppercase tracking-tight">
                                    <ClipboardList className="h-4 w-4" />
                                    Gerador de Propostas
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Envie com os diferenciais imbatíveis do MyHealthID
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-5 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Paciente</label>
                                    <select
                                        className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                        onChange={(e) => setSelectedPatient(patients.find(p => p.id === e.target.value))}
                                    >
                                        <option value="">Selecione um paciente...</option>
                                        {patients.map((p: any) => (
                                            <option key={p.id} value={p.id}>{p.nome} {p.sobrenome}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Serviço Recomendado</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {['Método Identidade', 'COB° ZERO', 'Studio Personal ID'].map(service => (
                                            <button
                                                key={service}
                                                onClick={() => setSelectedService(service)}
                                                className={`text-left px-3 py-2 rounded-lg text-xs font-bold border transition-all ${selectedService === service
                                                        ? 'bg-primary text-white border-primary shadow-sm'
                                                        : 'bg-white text-muted-foreground border-border hover:border-primary/40'
                                                    }`}
                                            >
                                                {service}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Valor do Pacote / Sessão</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">R$</span>
                                        <Input
                                            placeholder="0,00"
                                            className="pl-9 h-10 font-bold"
                                            value={quoteValue}
                                            onChange={(e) => setQuoteValue(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="p-3 bg-primary/5 rounded-xl border border-primary/10">
                                    <p className="text-[9px] uppercase font-black text-primary mb-2">Diferenciais que serão incluídos:</p>
                                    <ul className="space-y-1.5">
                                        {(selectedService === 'Método Identidade'
                                            ? ['Análise MyID (Digital)', 'Gatilhos Autonômicos', 'Bio-individualidade']
                                            : selectedService === 'COB° ZERO'
                                                ? ['Correção Postural Alvo', 'Redução Ângulo Cobb', 'Protocolo Estrutural']
                                                : ['Performance via MyID', 'Prevenção de Lesão', 'Treino Bio-individual']
                                        ).map(d => (
                                            <li key={d} className="flex items-center gap-1.5 text-[10px] font-bold text-foreground">
                                                <div className="h-1 w-1 rounded-full bg-primary" />
                                                {d}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <Button
                                    className="w-full h-11 bg-primary hover:bg-primary/90 font-black text-xs uppercase tracking-widest gap-2 shadow-lg hover:shadow-primary/20 transition-all mt-4"
                                    onClick={handleSendQuote}
                                    disabled={!selectedPatient || !quoteValue}
                                >
                                    Enviar via WhatsApp
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
