import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export interface HealthMetrics {
  steps: number;
  calories_burned: number | null;
  heart_rate_avg: number | null;
  heart_rate_min: number | null;
  heart_rate_max: number | null;
  heart_rate_resting: number | null;
  spo2_avg: number | null;
  stress_level: number | null;
  active_minutes: number | null;
  distance_km: number | null;
}

export interface SleepLog {
  id: string;
  date: string;
  total_hours: number;
  deep_sleep_hours: number | null;
  light_sleep_hours: number | null;
  rem_sleep_hours: number | null;
  awake_minutes: number | null;
  sleep_quality: number | null;
  bedtime: string | null;
  wake_time: string | null;
}

export interface WaterLog {
  id: string;
  date: string;
  amount_ml: number;
  goal_ml: number;
  entries: { time: string; ml: number }[];
}

export interface BodyComposition {
  id: string;
  date: string;
  weight_kg: number | null;
  height_cm: number | null;
  bmi: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
}

export function useHealthData(pacienteId: string | null, terapeutaId?: string) {
  const [todayMetrics, setTodayMetrics] = useState<HealthMetrics | null>(null);
  const [todaySleep, setTodaySleep] = useState<SleepLog | null>(null);
  const [todayWater, setTodayWater] = useState<WaterLog | null>(null);
  const [latestBody, setLatestBody] = useState<BodyComposition | null>(null);
  const [weekMetrics, setWeekMetrics] = useState<HealthMetrics[]>([]);
  const [weekSleep, setWeekSleep] = useState<SleepLog[]>([]);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchAll = useCallback(async () => {
    if (!pacienteId) return;
    setLoading(true);

    const sevenDaysAgo = format(new Date(Date.now() - 7 * 86400000), 'yyyy-MM-dd');

    const [metricsRes, sleepRes, waterRes, bodyRes, weekMetricsRes, weekSleepRes] = await Promise.all([
      supabase.from('health_metrics').select('*').eq('paciente_id', pacienteId).eq('date', today).maybeSingle(),
      supabase.from('sleep_logs').select('*').eq('paciente_id', pacienteId).eq('date', today).maybeSingle(),
      supabase.from('water_logs').select('*').eq('paciente_id', pacienteId).eq('date', today).maybeSingle(),
      supabase.from('body_composition').select('*').eq('paciente_id', pacienteId).order('date', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('health_metrics').select('*').eq('paciente_id', pacienteId).gte('date', sevenDaysAgo).order('date'),
      supabase.from('sleep_logs').select('*').eq('paciente_id', pacienteId).gte('date', sevenDaysAgo).order('date'),
    ]);

    if (metricsRes.data) setTodayMetrics(metricsRes.data as HealthMetrics);
    if (sleepRes.data) setTodaySleep(sleepRes.data as SleepLog);
    if (waterRes.data) {
      const d = waterRes.data as Record<string, unknown>;
      setTodayWater({ ...d, entries: Array.isArray(d.entries) ? d.entries : [] } as WaterLog);
    }
    if (bodyRes.data) setLatestBody(bodyRes.data as BodyComposition);
    setWeekMetrics((weekMetricsRes.data || []) as HealthMetrics[]);
    setWeekSleep((weekSleepRes.data || []) as SleepLog[]);
    setLoading(false);
  }, [pacienteId, today]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const upsertMetrics = async (data: Partial<HealthMetrics>) => {
    if (!pacienteId || !terapeutaId) return;
    const { error } = await supabase.from('health_metrics').upsert({
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      date: today,
      source: 'manual',
      ...data,
    }, { onConflict: 'paciente_id,date,source' });
    if (!error) fetchAll();
    return error;
  };

  const upsertSleep = async (data: Partial<SleepLog>) => {
    if (!pacienteId || !terapeutaId) return;
    const { id: _id, ...rest } = data;
    const payload = {
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      date: today,
      source: 'manual' as const,
      ...rest,
    };
    const { error } = await supabase.from('sleep_logs').upsert(payload, { onConflict: 'paciente_id,date' });
    if (!error) fetchAll();
    return error;
  };

  const addWater = async (ml: number) => {
    if (!pacienteId || !terapeutaId) return;
    const now = format(new Date(), 'HH:mm');
    const currentEntries = todayWater?.entries || [];
    const newEntries = [...currentEntries, { time: now, ml }];
    const newTotal = (todayWater?.amount_ml || 0) + ml;

    const { error } = await supabase.from('water_logs').upsert({
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      date: today,
      amount_ml: newTotal,
      goal_ml: todayWater?.goal_ml || 2000,
      entries: newEntries,
    }, { onConflict: 'paciente_id,date' });
    if (!error) fetchAll();
    return error;
  };

  const upsertBody = async (data: Partial<BodyComposition>) => {
    if (!pacienteId || !terapeutaId) return;
    const weight = data.weight_kg;
    const height = data.height_cm || latestBody?.height_cm;
    let bmi = data.bmi;
    if (weight && height) {
      bmi = Math.round((weight / ((height / 100) ** 2)) * 10) / 10;
    }
    const { id: _id2, ...bodyRest } = data;
    const payload = {
      paciente_id: pacienteId,
      terapeuta_id: terapeutaId,
      date: today,
      source: 'manual' as const,
      ...bodyRest,
      bmi,
    };
    const { error } = await supabase.from('body_composition').upsert(payload as typeof payload & { paciente_id: string }, { onConflict: 'paciente_id,date' } as Record<string, string>);
    if (!error) fetchAll();
    return error;
  };

  return {
    todayMetrics, todaySleep, todayWater, latestBody,
    weekMetrics, weekSleep,
    loading, refresh: fetchAll,
    upsertMetrics, upsertSleep, addWater, upsertBody,
  };
}
