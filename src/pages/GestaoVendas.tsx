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
    ArrowRight, AlertCircle, ClipboardList, TrendingUp
} from 'lucide-react';
import { sharePropostaComercial } from '@/utils/whatsapp';
import { format, differenceInDays } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';

export default function GestaoVendas() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [selectedService, setSelectedService] = useState('Método Identidade');
    const [quoteValue, setQuoteValue] = useState('');
    const [selectedPatient, setSelectedPatient] = useState<any>(null);

    const { data: patients = [] } = useQuery({
        queryKey: ['crm-patients'],
        queryFn: async () => {
            const { data } = await supabase.from('pacientes').select('*').eq('terapeuta_id', user!.id).order('nome');
            return data || [];
        },
        enabled: !!user,
    });

    const { data: pendingLinks = [] } = useQuery({
        queryKey: ['crm-pending-links'],
        queryFn: async () => {
            const { data } = await supabase
                .from('links_avaliacao')
                .select('*, pacientes(nome, sobrenome, telefone)')
                .eq('status', 'ativo')
                .eq('terapeuta_id', user!.id)
                .order('created_at', { ascending: false });
            return data || [];
        },
        enabled: !!user,
    });

    const { data: sessoesMes = 0 } = useQuery({
        queryKey: ['crm-sessoes-mes'],
        queryFn: async () => {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            const { count } = await supabase
                .from('agendamentos')
                .select('id', { count: 'exact', head: true })
                .eq('terapeuta_id', user!.id)
                .eq('status', 'confirmado')
                .gte('data_inicio', startOfMonth.toISOString());
            return count || 0;
        },
        enabled: !!user,
    });

    const { data: avaliacoesMes = 0 } = useQuery({
        queryKey: ['crm-avaliacoes-mes'],
        queryFn: async () => {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            const { count } = await supabase
                .from('avaliacoes_identidade')
                .select('id', { count: 'exact', head: true })
                .eq('terapeuta_id', user!.id)
                .gte('created_at', startOfMonth.toISOString());
            return count || 0;
        },
        enabled: !!user,
    });

    if (!authLoading && !user) return <Navigate to="/auth" replace />;

    const handleSendQuote = () => {
        if (!selectedPatient || !quoteValue) {
            toast({ title: 'Selecione um paciente e defina o valor', variant: 'destructive' });
            return;
        }
        if (!selectedPatient.telefone) {
            toast({ title: 'Paciente sem telefone cadastrado', variant: 'destructive' });
            return;
        }
        sharePropostaComercial(
            `${selectedPatient.nome} ${selectedPatient.sobrenome}`,
            selectedPatient.telefone,
            selectedService,
            `R$ ${quoteValue}`
        );
        toast({ title: '✅ Proposta enviada via WhatsApp!' });
    };

    const handleRelembrar = (link: any) => {
        const pac = link.pacientes;
        if (!pac?.telefone) {
            toast({ title: 'Paciente sem telefone', variant: 'destructive' });
            return;
        }
        const tel = pac.telefone.replace(/\D/g, '');
        const msg = encodeURIComponent(
            `Olá ${pac.nome}! 👋\n\nNotei que ainda não preencheu o questionário MyID que enviei. ` +
            `É bem rápido (10-12 min) e super importante para o seu tratamento personalizado.\n\n` +
            `Pode preencher quando tiver um tempinho? O link ainda está ativo! 😊\n\nAbraço!`
        );
        window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank');
        toast({ title: '📩 Lembrete enviado via WhatsApp!' });
    };

    return (
        <AppLayout title="Gestão & CRM">
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-none">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="p-2 bg-white/20 rounded-lg"><Users className="h-6 w-6" /></div>
                            <div>
                                <p className="text-xs font-medium opacity-80 uppercase">Total Pacientes</p>
                                <h3 className="text-2xl font-black">{patients.length}</h3>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-none">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="p-2 bg-white/20 rounded-lg"><Clock className="h-6 w-6" /></div>
                            <div>
                                <p className="text-xs font-medium opacity-80 uppercase">Links Pendentes</p>
                                <h3 className="text-2xl font-black">{pendingLinks.length}</h3>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="p-2 bg-muted rounded-lg text-muted-foreground"><TrendingUp className="h-6 w-6" /></div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase">Sessões Mês</p>
                                <h3 className="text-2xl font-black text-foreground">{sessoesMes}</h3>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="p-2 bg-muted rounded-lg text-muted-foreground"><DollarSign className="h-6 w-6" /></div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase">Avaliações Mês</p>
                                <h3 className="text-2xl font-black text-foreground">{avaliacoesMes}</h3>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                        <Card className="border shadow-sm overflow-hidden">
                            <CardHeader className="bg-muted/30 pb-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle className="text-base font-black flex items-center gap-2">
                                            <AlertCircle className="h-4 w-4 text-amber-500" />
                                            Follow-up: MyID Pendentes
                                        </CardTitle>
                                        <CardDescription className="text-xs">Pacientes que ainda não responderam.</CardDescription>
                                    </div>
                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                        {pendingLinks.length} pendente{pendingLinks.length !== 1 ? 's' : ''}
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
                                                    <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${isUrgent ? 'bg-destructive/10 text-destructive' : 'bg-amber-100 text-amber-700'}`}>
                                                        {link.pacientes?.nome?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-foreground">{link.pacientes?.nome} {link.pacientes?.sobrenome}</h4>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            Enviado: {format(new Date(link.created_at), "dd/MM 'às' HH:mm")} ({daysPending}d atrás)
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button size="sm" variant="outline" className="h-8 text-xs gap-1 border-amber-200 text-amber-700 hover:bg-amber-50"
                                                    onClick={() => handleRelembrar(link)}>
                                                    <MessageSquare className="h-3 w-3" /> Relembrar
                                                </Button>
                                            </div>
                                        );
                                    }) : (
                                        <div className="p-8 text-center text-muted-foreground text-xs italic">Não há links pendentes. 🎉</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div>
                        <Card className="border-primary/20 shadow-md bg-gradient-to-br from-card to-primary/5">
                            <CardHeader className="pb-4 border-b border-primary/10">
                                <CardTitle className="text-base font-black flex items-center gap-2 text-primary uppercase tracking-tight">
                                    <ClipboardList className="h-4 w-4" /> Gerador de Propostas
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-5 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Paciente</label>
                                    <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                                        onChange={(e) => setSelectedPatient(patients.find(p => p.id === e.target.value))}>
                                        <option value="">Selecione...</option>
                                        {patients.map((p: any) => (
                                            <option key={p.id} value={p.id}>{p.nome} {p.sobrenome}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Serviço</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        {['Método Identidade', 'COB° ZERO', 'Studio Personal ID'].map(service => (
                                            <button key={service} onClick={() => setSelectedService(service)}
                                                className={`text-left px-3 py-2 rounded-lg text-xs font-bold border transition-all ${selectedService === service
                                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                                    : 'bg-card text-muted-foreground border-border hover:border-primary/40'}`}>
                                                {service}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Valor</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-bold">R$</span>
                                        <Input placeholder="0,00" className="pl-9 h-10 font-bold" value={quoteValue} onChange={(e) => setQuoteValue(e.target.value)} />
                                    </div>
                                </div>
                                <Button className="w-full h-11 bg-primary hover:bg-primary/90 font-black text-xs uppercase tracking-widest gap-2"
                                    onClick={handleSendQuote} disabled={!selectedPatient || !quoteValue}>
                                    Enviar via WhatsApp <ArrowRight className="h-4 w-4" />
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
