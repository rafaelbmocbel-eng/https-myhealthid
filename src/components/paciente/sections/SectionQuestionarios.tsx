import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardCheck, CheckCircle2, Clock, ArrowRight, Sparkles, FileText
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function SectionQuestionarios() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: assessments, isLoading } = useQuery({
    queryKey: ["patient-assessments", user?.email],
    queryFn: async () => {
      const { data: pacienteData } = await supabase
        .from("pacientes").select("id").eq("email", user?.email).maybeSingle();
      if (!pacienteData) return [];
      const { data } = await supabase
        .from("myid_avaliacoes").select("*").eq("paciente_id", pacienteData.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.email,
  });

  const pending = assessments?.filter((a) => a.status === "pendente") || [];
  const completed = assessments?.filter((a) => a.status === "concluido") || [];

  return (
    <div className="lg:max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Questionários</h1>
        <p className="text-slate-500 text-sm font-medium">Avalie seu estado atual e receba insights personalizados.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4">{[1, 2].map((i) => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse shadow-sm" />)}</div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                <h2 className="text-lg font-black text-slate-900">Pendentes ({pending.length})</h2>
              </div>
              {pending.length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-700 rounded-full border border-orange-100 animate-bounce">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-black uppercase tracking-tight">Ganhe +50 pts</span>
                </div>
              )}
            </div>
            {pending.length > 0 ? (
              <div className="grid gap-4">
                {pending.map((a) => (
                  <Card key={a.id} className="border-none shadow-sm hover:shadow-md transition-all group bg-white overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex flex-col sm:flex-row">
                        <div className="p-6 flex-1 space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <h3 className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight italic">Avaliação MyID</h3>
                              <p className="text-xs text-slate-500 font-medium">Enviada em {format(new Date(a.created_at), "dd 'de' MMMM", { locale: ptBR })}</p>
                            </div>
                            <Badge className="bg-orange-100 text-orange-700 border-none px-3 h-6 text-[10px] font-black uppercase tracking-widest">Pendente</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-[11px] font-bold text-slate-400">
                            <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> 5-10 min</div>
                            <div className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Múltipla Escolha</div>
                          </div>
                        </div>
                        <div className="bg-slate-50 p-6 flex items-center justify-center shrink-0">
                          <Button onClick={() => navigate(`/myid/responder/${a.token_acesso}`)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl px-8 shadow-md transform group-hover:scale-105 transition-transform">
                            Começar Agora <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="bg-white p-12 rounded-2xl border-2 border-dashed border-slate-100 text-center flex flex-col items-center gap-3">
                <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center"><CheckCircle2 className="h-8 w-8 text-emerald-500" /></div>
                <p className="font-bold text-slate-900">Parabéns! Você está em dia.</p>
                <p className="text-xs text-slate-500">Não há questionários pendentes para você no momento.</p>
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-slate-400" />
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Concluídos</h2>
            </div>
            {completed.length > 0 ? (
              <div className="bg-white rounded-2xl shadow-sm divide-y divide-slate-50 overflow-hidden">
                {completed.map((a) => (
                  <div key={a.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0"><FileText className="h-5 w-5" /></div>
                      <div>
                        <p className="font-bold text-sm text-slate-900">Avaliação MyID</p>
                        <p className="text-[10px] text-slate-500 font-medium tracking-tight">Finalizada em {format(new Date(a.updated_at || a.created_at), "dd/MM/yyyy")}</p>
                      </div>
                    </div>
                    <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 border-none text-[9px] font-black uppercase">Pontuado</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-8 text-slate-300 text-xs font-medium italic opacity-60">Nenhum questionário concluído ainda.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
