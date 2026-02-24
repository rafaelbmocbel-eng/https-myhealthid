import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { SecretaryAI } from '@/components/SecretaryAI';
import { Button } from '@/components/ui/button';
import { CalendarDays, ArrowRight, User } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';

export default function AgendaPremium() {
    const { user, profile, loading } = useAuth();

    if (!loading && !user) return <Navigate to="/auth" replace />;

    return (
        <AppLayout>
            <div className="container py-4 sm:py-8 max-w-6xl px-1 sm:px-6">
                {/* Welcome header */}
                <div className="mb-6 sm:mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-xl sm:text-3xl font-black text-foreground mb-1 flex items-center gap-2 text-gradient-primary">
                            <CalendarDays className="h-8 w-8" />
                            Agenda Premium + Secretária IA
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            Gerencie seus agendamentos com ajuda da Inteligência Artificial.
                        </p>
                    </div>
                    <Button asChild variant="outline" size="sm" className="hidden sm:flex gap-2">
                        <Link to="/agenda">Ver Agenda Clássica <ArrowRight className="h-4 w-4" /></Link>
                    </Button>
                </div>

                <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">

                    {/* COLUNA 1: SECRETÁRIA IA (Esquerda) */}
                    <div className="col-span-1 border rounded-2xl p-1 bg-card/50">
                        <SecretaryAI therapistId={user?.id} />
                    </div>

                    {/* COLUNA 2-3: AGENDA PREMIUM (Direita) */}
                    <div className="lg:col-span-2 space-y-6">

                        <div className="clinical-card h-full flex flex-col pt-8 items-center justify-center border-dashed border-2 bg-gradient-to-br from-card to-accent/5">
                            <CalendarDays className="h-16 w-16 text-primary mb-4 opacity-50" />
                            <h2 className="text-xl font-bold mb-2">Painel de Agenda Premium Integrada</h2>
                            <p className="text-muted-foreground text-center max-w-sm mb-6">
                                Aqui você visualiza seus slots, aprova agendamentos recebidos pela IA e gerencia sua disponibilidade.
                            </p>

                            <div className="flex gap-3">
                                <Button asChild className="bg-gradient-primary text-white shadow-primary rounded-full px-6">
                                    <Link to="/agenda">Abrir Calendário Detalhado</Link>
                                </Button>
                                <Button variant="outline" className="rounded-full px-6">
                                    Configurar Preços
                                </Button>
                            </div>
                        </div>

                    </div>
                </div>

                {/* SEÇÃO: PRÓXIMAS CONSULTAS */}
                <div className="mt-8 clinical-card">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        📋 Suas Próximas Consultas
                    </h2>

                    {/* Placeholder items */}
                    <div className="space-y-3">
                        {[1, 2, 3].map((_, i) => (
                            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-muted/30 rounded-xl border border-border gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0 border border-primary/20">
                                        <span className="text-xs font-bold text-primary/70">Ter, 26</span>
                                        <span className="text-lg font-black text-primary">10:00</span>
                                    </div>
                                    <div>
                                        <div className="font-bold flex items-center gap-2">
                                            Novo Paciente {(i + 1) * 31}
                                            {i === 0 && <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">Marcado via IA</span>}
                                        </div>
                                        <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5"><User className="h-3.5 w-3.5" /> Primeira Avaliação</div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" className="h-8">Detalhes</Button>
                                    <Button size="sm" className="h-8">Check-in</Button>
                                </div>
                            </div>
                        ))}
                    </div>

                </div>

            </div>
        </AppLayout>
    );
}
