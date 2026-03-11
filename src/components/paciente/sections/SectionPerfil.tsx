import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { User, Camera, ShieldCheck, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import type { PatientSection } from "../PatientLayout";

interface Props {
  onNavigate: (section: PatientSection) => void;
}

export default function SectionPerfil({ onNavigate }: Props) {
  const { user, profile, fetchProfile } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({ nome: "", sobrenome: "", telefone: "" });

  useEffect(() => {
    if (profile) {
      setFormData({ nome: profile.nome || "", sobrenome: profile.sobrenome || "", telefone: profile.telefone || "" });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("profiles").update(data).eq("user_id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Perfil atualizado!", description: "Suas alterações foram salvas com sucesso." });
      if (user?.id) fetchProfile(user.id);
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erro ao atualizar", description: "Ocorreu um problema ao salvar." });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <div className="lg:max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-black text-slate-900">Configurações de Perfil</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-50 p-6">
              <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2"><User className="h-5 w-5 text-indigo-600" /> Dados Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                  <div className="relative group cursor-pointer">
                    <Avatar className="h-24 w-24 border-4 border-slate-50 shadow-sm transition-transform group-hover:scale-105">
                      <AvatarImage src={profile?.avatar_url || ""} />
                      <AvatarFallback className="bg-indigo-100 text-indigo-600 font-black text-xl">{profile?.nome?.[0]}{profile?.sobrenome?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 bg-slate-900/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Camera className="h-8 w-8 text-white" /></div>
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                    <div className="space-y-2">
                      <Label className="text-xs font-black text-slate-400 uppercase tracking-widest">Nome</Label>
                      <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} className="bg-slate-50 border-none rounded-xl font-bold" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black text-slate-400 uppercase tracking-widest">Sobrenome</Label>
                      <Input value={formData.sobrenome} onChange={(e) => setFormData({ ...formData, sobrenome: e.target.value })} className="bg-slate-50 border-none rounded-xl font-bold" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-xs font-black text-slate-400 uppercase tracking-widest">E-mail (Não editável)</Label>
                      <Input value={profile?.email || ""} disabled className="bg-slate-100 border-none rounded-xl font-bold text-slate-400 opacity-60" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-xs font-black text-slate-400 uppercase tracking-widest">Telefone</Label>
                      <Input placeholder="(00) 00000-0000" value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} className="bg-slate-50 border-none rounded-xl font-bold" />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-slate-50">
                  <Button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white font-black px-10 h-12 rounded-xl" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-50 p-6">
              <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-500" /> Segurança</CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div><p className="font-black text-slate-900 leading-none mb-1">Alterar Senha</p><p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Última alteração: Nunca</p></div>
                <Button variant="outline" className="rounded-xl border-slate-200 font-bold text-xs h-9">Editar</Button>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                <div><p className="font-black text-slate-900 leading-none mb-1">Verificação em Duas Etapas</p><p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Desativado</p></div>
                <Button variant="outline" className="rounded-xl border-slate-200 font-bold text-xs h-9">Ativar</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-white overflow-hidden p-6 text-center space-y-4">
            <div className="space-y-1">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Plano Atual</p>
              <h3 className="text-xl font-black text-slate-900 italic tracking-tighter uppercase mb-2">Smart Básico</h3>
              <Badge className="bg-indigo-50 text-indigo-600 hover:bg-indigo-50 border-none font-black text-[10px] uppercase">Gratuito</Badge>
            </div>
            <Button variant="outline" className="w-full rounded-xl border-slate-200 font-bold text-xs py-5 h-auto" onClick={() => onNavigate("planos")}>Upgrade de Plano</Button>
          </Card>

          <div className="space-y-3">
            <div className="flex items-center gap-2"><Bell className="h-4 w-4 text-slate-400" /><h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notificações</h2></div>
            <div className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Alerta de Questionários</span>
              <div className="h-5 w-9 bg-indigo-600 rounded-full relative p-0.5"><div className="h-4 w-4 bg-white rounded-full absolute right-0.5" /></div>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Lembrete de Agenda</span>
              <div className="h-5 w-9 bg-indigo-600 rounded-full relative p-0.5"><div className="h-4 w-4 bg-white rounded-full absolute right-0.5" /></div>
            </div>
          </div>

          <Card className="border-none shadow-sm bg-red-50 p-6 flex flex-col items-center gap-4">
            <div className="space-y-1 text-center">
              <h4 className="font-black text-red-900 text-sm">Zona de Risco</h4>
              <p className="text-[10px] text-red-700/60 font-medium">Seus dados de saúde serão excluídos permanentemente.</p>
            </div>
            <Button variant="ghost" className="w-full text-red-600 hover:bg-red-100 font-black text-xs h-10 rounded-xl">Excluir minha conta</Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
