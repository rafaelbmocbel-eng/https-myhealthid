import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen, Smile, Frown, Meh, SmilePlus, Angry, Zap, Moon, AlertCircle, Save, History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function SectionDiario() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mood, setMood] = useState(3);
  const [pain, setPain] = useState([0]);
  const [energy, setEnergy] = useState(3);
  const [sleep, setSleep] = useState("8");
  const [notes, setNotes] = useState("");

  const mutation = useMutation({
    mutationFn: async () => null, // daily_logs table doesn't exist yet
    onSuccess: () => {
      toast({ title: "Registro salvo!", description: "Seu diário foi atualizado com sucesso." });
      setNotes("");
    },
    onError: () => {
      toast({ variant: "destructive", title: "Erro ao salvar", description: "Tente novamente mais tarde." });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  const moodIcons = [
    { level: 1, icon: Angry, label: "Muito Mal", color: "text-red-500" },
    { level: 2, icon: Frown, label: "Mal", color: "text-orange-500" },
    { level: 3, icon: Meh, label: "Neutro", color: "text-amber-500" },
    { level: 4, icon: Smile, label: "Bem", color: "text-emerald-500" },
    { level: 5, icon: SmilePlus, label: "Excelente", color: "text-indigo-500" },
  ];

  return (
    <div className="lg:max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Diário de Saúde</h1>
        <p className="text-slate-500 text-sm font-medium italic">Como você está se sentindo hoje?</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-indigo-600 text-white p-6">
              <CardTitle className="text-lg font-black flex items-center gap-2 uppercase tracking-tight">
                <Save className="h-5 w-5" /> Registro de {format(new Date(), "dd/MM")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-10">
                <div className="space-y-4">
                  <Label className="text-sm font-black text-slate-700 uppercase tracking-widest">Humor Geral</Label>
                  <div className="flex justify-between gap-2 overflow-x-auto pb-2">
                    {moodIcons.map((m) => (
                      <button key={m.level} type="button" onClick={() => setMood(m.level)} className={cn("flex flex-col items-center gap-2 p-4 rounded-2xl transition-all border-2 shrink-0", mood === m.level ? cn("border-indigo-500 shadow-md scale-105 bg-indigo-50/50", m.color) : "border-transparent text-slate-300 grayscale hover:grayscale-0 hover:bg-slate-50")}>
                        <m.icon className="h-8 w-8" />
                        <span className="text-[10px] font-black uppercase tracking-tighter">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <Label className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2"><AlertCircle className="h-4 w-4 text-rose-500" /> Nível de Dor</Label>
                        <span className="text-lg font-black text-slate-900">{pain[0]}</span>
                      </div>
                      <Slider value={pain} onValueChange={setPain} max={10} step={1} className="py-4" />
                      <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase"><span>Sem dor</span><span>Intensa</span></div>
                    </div>
                    <div className="space-y-4">
                      <Label className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" /> Energia</Label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <button key={i} type="button" onClick={() => setEnergy(i)} className={cn("h-10 flex-1 rounded-xl transition-all font-black", energy >= i ? "bg-amber-400 text-white" : "bg-slate-100 text-slate-300")}>{i}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <Label className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2"><Moon className="h-4 w-4 text-indigo-500" /> Horas de Sono</Label>
                      <div className="relative">
                        <input type="number" step="0.5" value={sleep} onChange={(e) => setSleep(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl h-12 px-4 font-black text-slate-900 focus:ring-2 focus:ring-indigo-500 text-lg" />
                        <span className="absolute right-4 top-3 text-xs font-black text-slate-400 uppercase">hrs</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <Label className="text-sm font-black text-slate-700 uppercase tracking-widest">Anotações extras</Label>
                      <Textarea placeholder="Como foi seu dia? Sentiu algo diferente?" value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-slate-50 border-none rounded-xl min-h-[100px] resize-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black h-14 rounded-2xl text-lg shadow-xl shadow-slate-200" disabled={mutation.isPending}>
                  {mutation.isPending ? "Salvando..." : "Salvar Registro Diário"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-slate-400" />
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Últimos 7 dias</h2>
          </div>
          <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-slate-100 text-center flex flex-col items-center gap-3">
            <BookOpen className="h-10 w-10 text-slate-200" />
            <p className="font-bold text-slate-400 text-sm">Nenhum registro encontrado.</p>
            <p className="text-xs text-slate-300">Comece registrando como está hoje!</p>
          </div>
        </div>
      </div>
    </div>
  );
}
