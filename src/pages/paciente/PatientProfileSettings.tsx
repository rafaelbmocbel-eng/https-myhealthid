import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";
import {
    User,
    Mail,
    Phone,
    MapPin,
    Save,
    Camera,
    ShieldCheck,
    Bell,
    Settings,
    LogOut,
    Trash2,
    Lock,
    Key,
    UserCheck
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import PatientLayout from "@/components/paciente/PatientLayout";

const PatientProfileSettings = () => {
    const { user, profile, signOut, fetchProfile } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [formData, setFormData] = useState({
        nome: "",
        sobrenome: "",
        telefone: "",
    });

    useEffect(() => {
        if (profile) {
            setFormData({
                nome: profile.nome || "",
                sobrenome: profile.sobrenome || "",
                telefone: profile.telefone || "",
            });
        }
    }, [profile]);

    const updateMutation = useMutation({
        mutationFn: async (updatedData: any) => {
            if (!user?.id) throw new Error("Usuário não autenticado.");

            const payload = {
                user_id: user.id,
                email: profile?.email || user.email || "",
                nome: updatedData.nome,
                sobrenome: updatedData.sobrenome,
                telefone: updatedData.telefone || null,
            };

            const { error } = await supabase
                .from("profiles")
                .upsert(payload, { onConflict: "user_id" });

            if (error) throw error;
        },
        onSuccess: () => {
            toast({
                title: "Perfil Atualizado",
                description: "Suas informações foram sincronizadas com sucesso.",
                className: "bg-emerald-600 text-white border-none rounded-2xl font-bold"
            });
            if (user?.id) fetchProfile(user.id);
        },
        onError: () => {
            toast({ variant: "destructive", title: "Erro ao atualizar", description: "Ocorreu um problema ao salvar seus dados." });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateMutation.mutate(formData);
    };

    return (
        <PatientLayout>
            <div className="max-w-5xl mx-auto space-y-10">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-black text-slate-900 italic uppercase leading-none tracking-tight">Configurações de Identidade</h1>
                    <p className="text-slate-500 font-medium">Gerencie sua presença no ecossistema MyHealthID e sua segurança de dados.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* General Settings */}
                    <div className="lg:col-span-2 space-y-8">
                        <Card className="border-none shadow-2xl bg-white overflow-hidden rounded-[2.5rem] border border-slate-100">
                            <div className="bg-slate-900 p-8 flex items-center justify-between">
                                <h3 className="text-white font-black text-lg uppercase italic tracking-widest flex items-center gap-3">
                                    <UserCheck className="h-6 w-6 text-indigo-400" /> Dados Fundamentais
                                </h3>
                                <div className="h-2 w-2 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.8)]" />
                            </div>
                            <CardContent className="p-10">
                                <form onSubmit={handleSubmit} className="space-y-10">
                                    <div className="flex flex-col md:flex-row gap-10 items-center md:items-start">
                                        <div className="relative group cursor-pointer">
                                            <div className="h-32 w-32 rounded-[2rem] bg-indigo-50 p-1 border-2 border-indigo-100 shadow-xl overflow-hidden group-hover:scale-105 transition-transform duration-500">
                                                <Avatar className="h-full w-full rounded-[1.8rem]">
                                                    <AvatarImage src={profile?.avatar_url || ""} />
                                                    <AvatarFallback className="bg-indigo-600 text-white font-black text-3xl italic">
                                                        {profile?.nome?.[0]}{profile?.sobrenome?.[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                            </div>
                                            <div className="absolute -bottom-2 -right-2 h-10 w-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg group-hover:bg-indigo-600 transition-colors">
                                                <Camera className="h-5 w-5" />
                                            </div>
                                        </div>

                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Primeiro Nome</Label>
                                                <Input
                                                    value={formData.nome}
                                                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                                    className="bg-slate-50 border-2 border-slate-50 rounded-2xl font-black h-12 focus:bg-white focus:border-indigo-600 focus:ring-0 transition-all px-5"
                                                />
                                            </div>
                                            <div className="space-y-3">
                                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sobrenome</Label>
                                                <Input
                                                    value={formData.sobrenome}
                                                    onChange={e => setFormData({ ...formData, sobrenome: e.target.value })}
                                                    className="bg-slate-50 border-2 border-slate-50 rounded-2xl font-black h-12 focus:bg-white focus:border-indigo-600 focus:ring-0 transition-all px-5"
                                                />
                                            </div>
                                            <div className="space-y-3 md:col-span-2">
                                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identificador de Acesso (E-mail)</Label>
                                                <div className="relative group/disabled">
                                                    <Input
                                                        value={profile?.email || ""}
                                                        disabled
                                                        className="bg-slate-50 border-2 border-slate-50 rounded-2xl font-black h-12 text-slate-400 opacity-60 px-5 cursor-not-allowed group-hover/disabled:opacity-100 transition-opacity"
                                                    />
                                                    <Lock className="absolute right-4 top-3.5 h-5 w-5 text-slate-200" />
                                                </div>
                                            </div>
                                            <div className="space-y-3 md:col-span-2">
                                                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefone de Contato</Label>
                                                <Input
                                                    placeholder="(00) 00000-0000"
                                                    value={formData.telefone}
                                                    onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                                                    className="bg-slate-50 border-2 border-slate-50 rounded-2xl font-black h-12 focus:bg-white focus:border-indigo-600 focus:ring-0 transition-all px-5"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-8 border-t border-slate-50">
                                        <Button
                                            type="submit"
                                            className="bg-slate-900 hover:bg-black text-white font-black px-12 h-14 rounded-2xl shadow-xl active:scale-95 transition-all text-xs uppercase italic tracking-widest flex gap-3"
                                            disabled={updateMutation.isPending}
                                        >
                                            {updateMutation.isPending ? "Processando..." : (
                                                <>Salvar Alterações <Save className="h-5 w-5" /></>
                                            )}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        <Card className="border-none shadow-2xl bg-white overflow-hidden rounded-[2.5rem] border border-slate-100">
                            <div className="p-10 space-y-8">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                                        <ShieldCheck className="h-6 w-6" />
                                    </div>
                                    <h2 className="text-xl font-black text-slate-900 uppercase italic">Segurança & Autenticação</h2>
                                </div>
                                <div className="grid gap-4">
                                    <div className="flex items-center justify-between p-6 bg-slate-50/50 rounded-[2rem] border border-slate-50 group hover:bg-white hover:border-indigo-100 transition-all">
                                        <div className="flex items-center gap-5">
                                            <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-400 group-hover:text-indigo-600 transition-colors">
                                                <Key className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900 leading-none mb-1 uppercase text-sm">Atualizar Senha</p>
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Proteja seu hub com uma credencial forte</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" className="rounded-xl font-black text-[10px] uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 px-6">Editar</Button>
                                    </div>
                                    <div className="flex items-center justify-between p-6 bg-slate-50/50 rounded-[2rem] border border-slate-50 group hover:bg-white hover:border-indigo-100 transition-all">
                                        <div className="flex items-center gap-5">
                                            <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-400 group-hover:text-indigo-600 transition-colors">
                                                <Bell className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900 leading-none mb-1 uppercase text-sm">Privacidade de Dados</p>
                                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">Gerencie visibilidade e consentimentos</p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" className="rounded-xl font-black text-[10px] uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 px-6">Gerenciar</Button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Sidebar Area */}
                    <div className="space-y-10">
                        <Card className="border-none shadow-2xl bg-slate-900 text-white overflow-hidden rounded-[2.5rem] p-10 text-center space-y-6 relative group">
                            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform duration-700">
                                <Settings size={120} />
                            </div>
                            <div className="space-y-2 relative z-10">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">Status da Conta</p>
                                <h3 className="text-3xl font-black italic tracking-tighter uppercase leading-none">
                                    {profile?.plan === 'diamond' ? 'Diamond' : profile?.plan === 'pro' ? 'Pro' : 'Básico'}
                                </h3>
                                <div className="flex justify-center pt-2">
                                    <Badge className="bg-indigo-600 text-white border-none font-black text-[10px] uppercase px-4 py-1 rounded-full shadow-lg shadow-indigo-600/30">
                                        {profile?.plan === 'basic' || !profile?.plan ? 'Ecossistema Free' : 'Membro Premium'}
                                    </Badge>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full rounded-2xl border-white/20 bg-white/5 hover:bg-white hover:text-slate-900 font-black text-[10px] uppercase tracking-[0.2em] py-8 h-auto transition-all active:scale-95 relative z-10"
                                onClick={() => navigate("/paciente/planos")}
                            >
                                Evoluir Plano de Acesso
                            </Button>
                        </Card>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3 ml-2">
                                <Bell className="h-4 w-4 text-slate-400" />
                                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Preferência de Push</h2>
                            </div>
                            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center justify-between group hover:border-indigo-100 transition-all">
                                <span className="text-xs font-black text-slate-600 uppercase tracking-tight">Alertas MyID</span>
                                <div className="h-6 w-11 bg-indigo-600 rounded-full relative p-1 transition-colors cursor-pointer">
                                    <div className="h-4 w-4 bg-white rounded-full absolute right-1 shadow-sm" />
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-50 flex items-center justify-between group hover:border-indigo-100 transition-all">
                                <span className="text-xs font-black text-slate-600 uppercase tracking-tight">Agenda Clínica</span>
                                <div className="h-6 w-11 bg-indigo-600 rounded-full relative p-1 transition-colors cursor-pointer">
                                    <div className="h-4 w-4 bg-white rounded-full absolute right-1 shadow-sm" />
                                </div>
                            </div>
                        </div>

                        <Card className="border-none shadow-xl bg-rose-50/50 p-10 flex flex-col items-center gap-6 rounded-[2.5rem] border border-rose-100/50 group">
                            <div className="h-16 w-16 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                <Trash2 className="h-8 w-8 text-rose-500" />
                            </div>
                            <div className="space-y-2 text-center">
                                <h4 className="font-black text-rose-900 text-lg uppercase italic leading-none">Encerrar Ciclo</h4>
                                <p className="text-[10px] text-rose-700/60 font-black uppercase tracking-tighter leading-relaxed">
                                    A exclusão é irreversível e remove todo seu histórico clínico do ecossistema.
                                </p>
                            </div>
                            <Button variant="ghost" className="w-full text-rose-600 hover:bg-rose-100 font-black text-[10px] uppercase tracking-widest h-14 rounded-2xl border border-rose-200/50">
                                Desativar Minha Identidade
                            </Button>
                        </Card>
                    </div>
                </div>
            </div>
        </PatientLayout>
    );
};

export default PatientProfileSettings;
