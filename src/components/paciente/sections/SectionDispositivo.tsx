import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import {
  Watch, RefreshCcw, AlertCircle, Activity, Bluetooth, Zap, Moon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function SectionDispositivo() {
  const { profile } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => { setIsSyncing(false); }, 2000);
  };

  const devices = [
    { id: "fitbit", name: "Fitbit", status: profile?.fitbit_access_token ? "connected" : "disconnected", icon: Watch, color: "text-cyan-500", bg: "bg-cyan-50" },
    { id: "bluetooth", name: "Dispositivo BT", status: "available", icon: Bluetooth, color: "text-blue-500", bg: "bg-blue-50" },
  ];

  return (
    <div className="lg:max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 leading-none">Meus Dispositivos</h1>
          <p className="text-slate-500 text-sm font-medium italic">Sincronize sua biologia em tempo real.</p>
        </div>
        {profile?.fitbit_access_token && (
          <Button variant="outline" className="rounded-xl font-black text-xs gap-2 border-slate-200" onClick={handleSync} disabled={isSyncing}>
            <RefreshCcw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
            {isSyncing ? "Sincronizando..." : "Sincronizar Agora"}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {devices.map((device) => (
          <Card key={device.id} className="border-none shadow-sm bg-white hover:shadow-md transition-all group overflow-hidden">
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className={cn("h-16 w-16 rounded-3xl flex items-center justify-center transition-transform group-hover:scale-110", device.bg)}>
                  <device.icon className={cn("h-8 w-8", device.color)} />
                </div>
                <Badge className={cn("font-black text-[10px] uppercase tracking-widest px-3 h-6 border-none", device.status === "connected" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400")}>
                  {device.status === "connected" ? "Conectado" : "Disponível"}
                </Badge>
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{device.name} Smartwatch</h3>
                <p className="text-sm text-slate-500 font-medium">Importe passos, sono e batimentos.</p>
              </div>
              <Button disabled={device.id === "bluetooth"} variant={device.id === "bluetooth" ? "outline" : "default"} className={cn("w-full rounded-xl h-12 font-bold", device.id === "bluetooth" ? "text-slate-300 border-dashed border-slate-200" : "bg-slate-900 hover:bg-slate-800 text-white shadow-lg")}>
                {device.id === "bluetooth" ? "Bluetooth em breve" : "Conectar agora"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {profile?.fitbit_access_token && (
        <section className="space-y-4">
          <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-indigo-600" /><h2 className="text-lg font-black text-slate-900">Últimos Dados Importados</h2></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Zap, label: "Passos", value: "8.432", bg: "bg-indigo-50/50", iconBg: "bg-indigo-100", iconColor: "text-indigo-600", labelColor: "text-indigo-400" },
              { icon: Activity, label: "FC Média", value: "72 bpm", bg: "bg-rose-50/50", iconBg: "bg-rose-100", iconColor: "text-rose-600", labelColor: "text-rose-400" },
              { icon: Moon, label: "Sono", value: "7h 20m", bg: "bg-blue-50/50", iconBg: "bg-blue-100", iconColor: "text-blue-600", labelColor: "text-blue-400" },
            ].map((item, i) => (
              <Card key={i} className={cn("border-none shadow-sm", item.bg)}>
                <CardContent className="p-6 flex items-center gap-4">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", item.iconBg, item.iconColor)}><item.icon className="h-5 w-5" /></div>
                  <div>
                    <p className={cn("text-[10px] font-black uppercase tracking-widest", item.labelColor)}>{item.label}</p>
                    <p className="text-xl font-black text-slate-900">{item.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className="bg-white p-6 rounded-2xl border border-slate-100 flex items-start gap-4">
        <div className="h-10 w-10 bg-amber-50 rounded-full flex items-center justify-center shrink-0"><AlertCircle className="h-6 w-6 text-amber-500" /></div>
        <div className="space-y-1">
          <h4 className="font-bold text-slate-900 text-sm italic">Como funciona a sincronização?</h4>
          <p className="text-xs text-slate-500 leading-relaxed font-medium">Seus dados são coletados do seu dispositivo e sincronizados com o MyHealthID. O MyID Index utiliza essas informações para ajustar sua pontuação de saúde em tempo real.</p>
        </div>
      </div>
    </div>
  );
}
