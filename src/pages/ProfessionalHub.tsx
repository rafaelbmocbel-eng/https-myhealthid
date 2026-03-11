import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth, Profile } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Award, Activity, Watch, BookOpen, Users,
    Search, Filter, TrendingUp, AlertCircle, ChevronRight
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { sharePortalInvite } from '@/utils/whatsapp';
import { useToast } from '@/hooks/use-toast';
import { Share2, Send } from 'lucide-react';

export default function ProfessionalHub() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');

    const handleInvite = async (paciente?: Profile) => {
        const registerUrl = `${window.location.origin}/paciente/cadastro`;

        if (paciente) {
            await sharePortalInvite(paciente.nome, paciente.telefone || '', registerUrl);
            toast({ title: "Convite enviado!", description: `O link foi preparado para ${paciente.nome}.` });
        } else {
            // General invite
            const message = `Olá! 👋 Conheça o novo Portal do Paciente MyID: ${registerUrl}`;
            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        }
    };

    const copyInviteLink = () => {
        const registerUrl = `${window.location.origin}/paciente/cadastro`;
        navigator.clipboard.writeText(registerUrl);
        toast({ title: "Link copiado!", description: "O link de cadastro foi copiado para sua área de transferência." });
    };

    const { data: engajamentoData = [], isLoading } = useQuery({
        queryKey: ['professional-hub-engagement', user?.id],
        queryFn: async () => {
            // Fetch patients 
            const { data: patients, error } = await supabase
                .from('profiles')
                .select('*') as any;

            if (error) throw error;
            return (patients as any as Profile[]) || [];
        },
        enabled: !!user
    });

    const filteredPatients = engajamentoData.filter(p =>
        `${p.nome} ${p.sobrenome}`.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AppLayout>
            <div className="container py-8 max-w-6xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                            <Award className="h-7 w-7 text-indigo-600" /> Central de Engajamento MyID
                        </h1>
                        <p className="text-muted-foreground text-sm">Monitore o progresso, pontos e hábitos de todos os seus pacientes em tempo real.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar paciente..."
                                className="pl-9 bg-white border-slate-200"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                className="bg-white border-slate-200 hidden sm:flex text-[10px] font-black uppercase tracking-widest h-10 px-4"
                                onClick={copyInviteLink}
                            >
                                <Share2 className="h-3.5 w-3.5 mr-2" /> Copiar Link
                            </Button>
                            <Button
                                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest h-10 px-4"
                                onClick={() => handleInvite()}
                            >
                                <Send className="h-3.5 w-3.5 mr-2" /> Convidar Portal
                            </Button>
                            <Button variant="outline" size="icon" className="shrink-0 bg-white h-10 w-10">
                                <Filter className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Global Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <Card className="border-none shadow-sm bg-indigo-50 border-indigo-100">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
                                <Users className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-indigo-400">Total de Pacientes</p>
                                <p className="text-xl font-black text-indigo-900">{engajamentoData.length}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-emerald-50 border-emerald-100">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
                                <Activity className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-emerald-400">Atividade Diária (24h)</p>
                                <p className="text-xl font-black text-emerald-900">85%</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-cyan-50 border-cyan-100">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-cyan-600 flex items-center justify-center shrink-0">
                                <Watch className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-cyan-400">Dispositivos Conectados</p>
                                <p className="text-xl font-black text-cyan-900">12</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-none shadow-sm bg-amber-50 border-amber-100">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="h-10 w-10 rounded-xl bg-amber-600 flex items-center justify-center shrink-0">
                                <TrendingUp className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-amber-400">Pontos Gerados (30d)</p>
                                <p className="text-xl font-black text-amber-900">4.5k</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Patients Engagement List */}
                <div className="space-y-4">
                    <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest text-[11px] mb-4">
                        <TrendingUp className="h-4 w-4 text-indigo-600" /> Ranking e Status de Engajamento
                    </h3>

                    {isLoading ? (
                        <div className="flex justify-center p-12">
                            <Activity className="h-8 w-8 animate-spin text-indigo-600" />
                        </div>
                    ) : filteredPatients.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-2xl">
                            <p className="text-muted-foreground">Nenhum paciente encontrado com esses critérios.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {filteredPatients.map(paciente => (
                                <div
                                    key={paciente.id}
                                    className="clinical-card group hover:border-indigo-400 transition-all cursor-pointer !p-4 flex flex-col md:flex-row md:items-center gap-6"
                                    onClick={() => navigate(`/pacientes/${paciente.id}`)}
                                >
                                    {/* Name & Basic Info */}
                                    <div className="flex items-center gap-4 min-w-[200px]">
                                        <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-lg">
                                            {paciente.nome?.[0]}{paciente.sobrenome?.[0]}
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-900 leading-none">{paciente.nome} {paciente.sobrenome}</h4>
                                            <p className="text-[10px] font-bold text-indigo-500 uppercase mt-1 tracking-tighter">
                                                Nível {paciente.current_level || '1'} • {paciente.plan || 'Básico'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Points Bar */}
                                    <div className="flex-1 space-y-2">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[10px] font-black text-slate-400 uppercase">Pontos Totais MyID</span>
                                            <span className="text-sm font-black italic text-indigo-700 tracking-tighter">{paciente.total_points || 0} pts</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-600 transition-all duration-1000"
                                                style={{ width: `${Math.min(((paciente.total_points || 0) % 1000) / 10, 100)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Status Icons */}
                                    <div className="flex items-center gap-4 md:w-48 justify-around">
                                        <div className="flex flex-col items-center">
                                            <BookOpen className={cn("h-4 w-4 mb-1", true ? "text-emerald-500" : "text-slate-300")} />
                                            <span className="text-[8px] font-bold uppercase text-slate-400">Diário</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <Watch className={cn("h-4 w-4 mb-1", paciente.wearable_device ? "text-cyan-500" : "text-slate-300")} />
                                            <span className="text-[8px] font-bold uppercase text-slate-400">Device</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <AlertCircle className={cn("h-4 w-4 mb-1", false ? "text-red-500" : "text-slate-300")} />
                                            <span className="text-[8px] font-bold uppercase text-slate-400">Alerta</span>
                                        </div>
                                    </div>

                                    {/* Action */}
                                    <div className="shrink-0 flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-all"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleInvite(paciente);
                                            }}
                                            title="Enviar convite por WhatsApp"
                                        >
                                            <Send className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="group-hover:bg-indigo-50 text-indigo-600 transition-all">
                                            <ChevronRight className="h-5 w-5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
