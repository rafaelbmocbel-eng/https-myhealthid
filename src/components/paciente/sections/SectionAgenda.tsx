import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon, Clock, MapPin, User, ExternalLink, CheckCircle2, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

export default function SectionAgenda() {
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: appointments, isLoading, refetch } = useQuery({
    queryKey: ["patient-all-appointments", user?.id],
    queryFn: async () => {
      const { data: pacienteData } = await supabase
        .from("pacientes").select("id").eq("email", user?.email).maybeSingle();
      if (!pacienteData) return [];
      const { data } = await supabase
        .from("agendamentos")
        .select("*")
        .eq("paciente_id", pacienteData.id)
        .neq("status", "cancelado")
        .order("data_inicio", { ascending: false });
      return data || [];
    },
    enabled: !!user?.email,
  });

  const handleCancel = async (id: string) => {
    if (!confirm("Tem certeza que deseja cancelar esta consulta?")) return;
    try {
      const { error } = await supabase.from("agendamentos").update({ status: "cancelado" }).eq("id", id);
      if (error) throw error;
      toast({ title: "Consulta cancelada", description: "Sua sessão foi cancelada com sucesso." });
      refetch();
    } catch {
      toast({ variant: "destructive", title: "Erro ao cancelar", description: "Não foi possível cancelar agora." });
    }
  };

  const futureAppointments = appointments?.filter((a) => isAfter(new Date(a.data_inicio), new Date())) || [];
  const pastAppointments = appointments?.filter((a) => !isAfter(new Date(a.data_inicio), new Date())) || [];

  return (
    <div className="lg:max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Minha Agenda</h1>
        <p className="text-slate-500 text-sm font-medium">Controle suas consultas e histórico de sessões.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse shadow-sm" />)}</div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-indigo-600" />
              <h2 className="text-lg font-black text-slate-900">Próximas Consultas</h2>
            </div>
            {futureAppointments.length > 0 ? (
              <div className="grid gap-4">
                {futureAppointments.slice().reverse().map((appt) => (
                  <Card key={appt.id} className="border-none shadow-sm hover:shadow-md transition-shadow group">
                    <CardContent className="p-0 overflow-hidden rounded-2xl">
                      <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-50">
                        <div className="p-6 sm:w-32 bg-indigo-50/50 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">{format(new Date(appt.data_inicio), "MMM", { locale: ptBR })}</span>
                          <span className="text-3xl font-black text-indigo-700 leading-none">{format(new Date(appt.data_inicio), "dd")}</span>
                          <span className="text-[10px] font-bold text-indigo-400 mt-1 uppercase tracking-tighter">{format(new Date(appt.data_inicio), "EEEE", { locale: ptBR })}</span>
                        </div>
                        <div className="p-6 flex-1 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">Sessão Confirmada</Badge>
                            <span className="text-xs font-bold text-slate-400">{format(new Date(appt.data_inicio), "HH:mm")} às {format(new Date(appt.data_fim), "HH:mm")}</span>
                          </div>
                          <h3 className="font-black text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">Consulta Presencial</h3>
                          <div className="flex items-center gap-4 mt-2">
                            <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium"><MapPin className="h-4 w-4" /> Studio MyHealth</div>
                          </div>
                        </div>
                        <div className="p-6 flex sm:flex-col items-center justify-center gap-2 bg-slate-50/30">
                          <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-sm">Detalhes</Button>
                          <Button variant="ghost" className="w-full text-red-500 hover:bg-red-50 font-bold rounded-xl h-9 text-xs" onClick={() => handleCancel(appt.id)}>Cancelar</Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-slate-200 text-center flex flex-col items-center gap-4">
                <CalendarIcon className="h-10 w-10 text-slate-200" />
                <p className="font-bold text-slate-900">Nenhuma consulta agendada.</p>
                <p className="text-sm text-slate-500">Agende sua próxima sessão para continuar sua jornada.</p>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-slate-400" />
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Histórico de Sessões</h2>
            </div>
            {pastAppointments.length > 0 ? (
              <div className="bg-white rounded-2xl shadow-sm divide-y divide-slate-50 overflow-hidden">
                {pastAppointments.map((appt) => (
                  <div key={appt.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">
                        {format(new Date(appt.data_inicio), "dd/MM")}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900">Sessão</p>
                        <p className="text-[10px] text-slate-500 font-medium tracking-tight">{format(new Date(appt.data_inicio), "HH:mm")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-black uppercase tracking-tight">
                      <CheckCircle2 className="h-3 w-3" /> Realizada
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-slate-400 text-sm font-medium italic">Seu histórico está vazio.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
