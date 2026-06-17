import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, LayoutDashboard, Moon, Droplets, Scale, UtensilsCrossed, Activity, Watch, Mic } from 'lucide-react';
import { motion } from 'framer-motion';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import HealthDashboardCards from '@/components/saude/HealthDashboardCards';
import SleepLogForm from '@/components/saude/SleepLogForm';
import WaterTracker from '@/components/saude/WaterTracker';
import BodyCompositionForm from '@/components/saude/BodyCompositionForm';
import MealLogForm from '@/components/saude/MealLogForm';
import MetricsManualForm from '@/components/saude/MetricsManualForm';
import HealthSyncCard from '@/components/paciente/HealthSyncCard';
import PacienteRelatoVoz from '@/components/paciente/PacienteRelatoVoz';
import { useHealthData } from '@/hooks/useHealthData';
import type { HealthSyncResult } from '@/hooks/useHealthSync';

export default function PacienteSaude() {
  const { user } = useAuth();
  const [paciente, setPaciente] = useState<{ id: string; terapeuta_id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('dashboard');

  useEffect(() => {
    if (!user) return;
    supabase.from('pacientes').select('id, terapeuta_id').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { setPaciente(data); setLoading(false); });
  }, [user]);

  const health = useHealthData(paciente?.id || null, paciente?.terapeuta_id);

  const handleSyncComplete = async (data: HealthSyncResult) => {
    if (!paciente) return;
    await health.upsertMetrics({
      steps: data.steps,
      calories_burned: data.calories,
      heart_rate_avg: data.heartRate,
    });
    // Sprint 4: log estruturado para o monitor pro
    await supabase.from('wearable_sync_log').insert({
      paciente_id: paciente.id,
      terapeuta_id: paciente.terapeuta_id,
      fonte: 'capacitor-health',
      steps: data.steps ?? null,
      heart_rate: data.heartRate ?? null,
      calories: data.calories ?? null,
      sleep_hours: data.sleepHours ?? null,
      raw_data: data as unknown as import('@/integrations/supabase/types').Json,
    });
  };

  if (loading) {
    return (
      <ProtectedPatientRoute>
        <PacienteLayout>
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        </PacienteLayout>
      </ProtectedPatientRoute>
    );
  }

  const tabs = [
    { value: 'dashboard', label: 'Painel', icon: LayoutDashboard },
    { value: 'sintomas', label: 'Sintomas', icon: Mic },
    { value: 'sleep', label: 'Sono', icon: Moon },
    { value: 'water', label: 'Água', icon: Droplets },
    { value: 'food', label: 'Alimentação', icon: UtensilsCrossed },
    { value: 'body', label: 'Corpo', icon: Scale },
    { value: 'manual', label: 'Manual', icon: Activity },
  ];

  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 mb-1">
              <Watch className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-black text-foreground">Saúde</h1>
            </div>
            <p className="text-[11px] text-muted-foreground">Monitore passos, sono, água, alimentação e composição corporal</p>
          </motion.div>

          {/* Smartwatch sync */}
          <HealthSyncCard onSyncComplete={handleSyncComplete} />

          <Tabs value={tab} onValueChange={setTab}>
           <TabsList className="w-full overflow-x-auto flex-nowrap justify-start gap-0 h-9 bg-muted/50 p-0.5 scrollbar-none">
              {tabs.map(t => (
                <TabsTrigger key={t.value} value={t.value} className="text-[10px] gap-1 px-2 min-w-0 flex-shrink-0 data-[state=active]:shadow-sm whitespace-nowrap">
                  <t.icon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{t.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="dashboard" className="mt-3">
              {health.loading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : (
                <HealthDashboardCards
                  metrics={health.todayMetrics}
                  sleep={health.todaySleep}
                  water={health.todayWater}
                  body={health.latestBody}
                  onAddWater={(ml) => health.addWater(ml)}
                  onNavigate={(section) => setTab(section === 'heart' || section === 'spo2' ? 'manual' : section)}
                />
              )}
            </TabsContent>

            <TabsContent value="sintomas" className="mt-3">
              {paciente && <PacienteRelatoVoz pacienteId={paciente.id} />}
            </TabsContent>

            <TabsContent value="sleep" className="mt-3">
              <SleepLogForm current={health.todaySleep} onSave={health.upsertSleep} />
            </TabsContent>

            <TabsContent value="water" className="mt-3">
              <WaterTracker water={health.todayWater} onAdd={(ml) => health.addWater(ml)} />
            </TabsContent>

            <TabsContent value="food" className="mt-3">
              {paciente && (
                <MealLogForm
                  pacienteId={paciente.id}
                  terapeutaId={paciente.terapeuta_id}
                  onSaved={health.refresh}
                />
              )}
            </TabsContent>

            <TabsContent value="body" className="mt-3">
              <BodyCompositionForm current={health.latestBody} onSave={health.upsertBody} />
            </TabsContent>

            <TabsContent value="manual" className="mt-3">
              <MetricsManualForm current={health.todayMetrics} onSave={health.upsertMetrics} />
            </TabsContent>
          </Tabs>
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
