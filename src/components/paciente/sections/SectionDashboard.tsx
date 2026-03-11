import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar, ClipboardCheck, Trophy, CheckCircle2, TrendingUp, Bell, User, Activity,
  Footprints, Moon, Zap, Clock, ExternalLink, Heart, Watch
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { PatientSection } from "../PatientLayout";

interface Props {
  onNavigate: (section: PatientSection) => void;
}

export default function SectionDashboard({ onNavigate }: Props) {
  const { profile, user } = useAuth();

  const { data: nextAppointment, isLoading: loadingAppt } = useQuery({
    queryKey: ["patient-next-appointment", user?.id],
    queryFn: async () => {
      const { data: pacienteData } = await supabase
        .from("pacientes").select("id").eq("email", user?.email).maybeSingle();
      if (!pacienteData) return null;
      const { data } = await supabase
        .from("agendamentos")
        .select("*")
        .eq("paciente_id", pacienteData.id)
        .gte("data_inicio", new Date().toISOString())
        .order("data_inicio", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.email,
  });

  const { data: pendingQuestionnaires, isLoading: loadingQuests } = useQuery({
    queryKey: ["patient-pending-questionnaires", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("myid_avaliacoes").select("id, status, token_acesso").eq("status", "pendente") as any;
      return data || [];
    },
    enabled: !!user?.email,
  });

  return (
    <div className="lg:max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-lg shadow-md border-2 border-white">
            {profile?.nome?.[0] || "P"}
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 leading-none mb-1">Olá, {profile?.nome || "Paciente"}! 👋</h1>
            <Badge variant="secondary" className="bg-indigo-100/50 text-indigo-700 text-[9px] font-black uppercase tracking-wider h-4 px-1.5 border-none">
              ⭐ Iniciante
            </Badge>
          </div>
        </div>
        <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-slate-200">
          <Bell className="h-5 w-5 text-slate-600" />
        </Button>
      </header>

      {/* Check-in Banner */}
      {nextAppointment && (
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
              <ClipboardCheck className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-black text-amber-950">📋 Faça seu check-in pré-consulta!</p>
              <p className="text-xs text-amber-900/70 font-medium">Relate como você está se sentindo.</p>
            </div>
          </div>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md whitespace-nowrap px-6">
            Check-in Agora
          </Button>
        </div>
      )}

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm bg-white hover:translate-y-[-2px] transition-transform cursor-pointer" onClick={() => onNavigate("agenda")}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-8 w-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center"><Calendar className="h-5 w-5" /></div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Consulta</span>
            </div>
            {loadingAppt ? <div className="h-10 w-24 bg-slate-100 animate-pulse rounded" /> : nextAppointment ? (
              <>
                <p className="text-lg font-black text-slate-900 leading-tight">{format(new Date(nextAppointment.data_inicio), "dd MMM", { locale: ptBR })}</p>
                <p className="text-xs text-slate-500 font-medium truncate">às {format(new Date(nextAppointment.data_inicio), "HH:mm")}</p>
              </>
            ) : (
              <>
                <p className="text-lg font-black text-slate-300">Nenhuma</p>
                <p className="text-xs text-slate-400 font-medium">Agende sua sessão</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white hover:translate-y-[-2px] transition-transform cursor-pointer" onClick={() => onNavigate("questionarios")}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-8 w-8 bg-violet-50 text-violet-600 rounded-lg flex items-center justify-center"><ClipboardCheck className="h-5 w-5" /></div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Avaliações</span>
            </div>
            <p className="text-lg font-black text-slate-900 leading-tight">{pendingQuestionnaires?.length || 0} Pendentes</p>
            <p className={cn("text-xs font-bold", (pendingQuestionnaires?.length || 0) > 0 ? "text-orange-500" : "text-emerald-500")}>
              {(pendingQuestionnaires?.length || 0) > 0 ? "Ação necessária" : "Tudo em dia!"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white hover:translate-y-[-2px] transition-transform cursor-pointer" onClick={() => onNavigate("atividades")}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-8 w-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center"><Trophy className="h-5 w-5" /></div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pontuação</span>
            </div>
            <p className="text-lg font-black text-slate-900 leading-tight">0 pts</p>
            <p className="text-xs text-slate-500 font-medium">Bônus por diário: +5</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white hover:translate-y-[-2px] transition-transform cursor-pointer" onClick={() => onNavigate("atividades")}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="h-8 w-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center"><CheckCircle2 className="h-5 w-5" /></div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Atividades</span>
            </div>
            <p className="text-lg font-black text-slate-900 leading-tight">0 / 0</p>
            <p className="text-xs text-slate-500 font-medium">Nenhuma prescrita</p>
          </CardContent>
        </Card>
      </div>

      {/* Smartwatch Row */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Dados do Dia (Smartwatch)</h2>
          <Button variant="ghost" size="sm" className="text-indigo-600 font-bold hover:bg-indigo-50" onClick={() => onNavigate("dispositivo")}>
            Sincronizar <Watch className="ml-1.5 h-3 w-3" />
          </Button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Heart, label: "Freq. Cardíaca", value: "72", unit: "bpm", border: "border-rose-500", iconBg: "bg-rose-50", iconColor: "text-rose-600" },
            { icon: Footprints, label: "Passos", value: "4.520", unit: "", border: "border-blue-500", iconBg: "bg-blue-50", iconColor: "text-blue-600" },
            { icon: Moon, label: "Sono", value: "7.2", unit: "hrs", border: "border-indigo-500", iconBg: "bg-indigo-50", iconColor: "text-indigo-600" },
            { icon: Zap, label: "Calorias", value: "320", unit: "kcal", border: "border-orange-500", iconBg: "bg-orange-50", iconColor: "text-orange-600" },
          ].map((item, i) => (
            <div key={i} className={cn("bg-white p-4 rounded-2xl shadow-sm border-l-4 flex items-center gap-4", item.border)}>
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", item.iconBg, item.iconColor)}>
                <item.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">{item.label}</p>
                <p className="text-lg font-black text-slate-900">{item.value} {item.unit && <span className="text-[10px] text-slate-400 uppercase">{item.unit}</span>}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-8">
        <Card className="border-none shadow-sm overflow-hidden bg-white">
          <CardHeader className="border-b border-slate-50 bg-slate-50/30">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-indigo-600" /> Minha Semana
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-24 w-24 bg-indigo-50 rounded-full flex items-center justify-center">
              <Activity className="h-10 w-10 text-indigo-200" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">Acompanhe sua Evolução</h3>
              <p className="text-xs text-slate-500 max-w-[240px] mt-1">Preencha seu Diário de Saúde para habilitar o gráfico de humor e dor.</p>
            </div>
            <Button variant="outline" className="font-bold text-indigo-600 border-indigo-100 hover:bg-indigo-50 rounded-xl" onClick={() => onNavigate("diario")}>
              Ir para o Diário
            </Button>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-slate-50 bg-slate-50/30">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-600" /> Próximas Consultas
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-indigo-600 font-bold hover:bg-indigo-50 px-3" onClick={() => onNavigate("agenda")}>Ver agenda</Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-50">
              {nextAppointment ? (
                <div className="flex gap-4 p-5 hover:bg-slate-50 transition-colors">
                  <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex flex-col items-center justify-center text-indigo-700 shrink-0 border border-indigo-100 shadow-sm">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{format(new Date(nextAppointment.data_inicio), "MMM", { locale: ptBR })}</span>
                    <span className="text-xl font-black leading-none">{format(new Date(nextAppointment.data_inicio), "dd")}</span>
                  </div>
                  <div className="flex-1 min-w-0 py-1">
                    <h4 className="font-bold text-sm text-slate-900 truncate">Sessão Individual</h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <Clock className="h-3 w-3" /> {format(new Date(nextAppointment.data_inicio), "HH:mm")}
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px] font-bold self-center">Confirmado</Badge>
                </div>
              ) : (
                <div className="p-12 text-center flex flex-col items-center gap-3">
                  <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center">
                    <Calendar className="h-8 w-8 text-slate-200" />
                  </div>
                  <p className="text-sm font-medium text-slate-400">Nenhum agendamento futuro.</p>
                  <Button onClick={() => onNavigate("agenda")} variant="link" className="text-indigo-600 font-bold">Agendar Agora</Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
