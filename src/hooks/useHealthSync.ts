import { useState, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import type { HealthSyncResult } from '@/types/health';

export type { HealthSyncResult };

/**
 * Hook to sync health data from Apple HealthKit / Google Health Connect.
 * Only works when running as a native Capacitor app.
 */
export function useHealthSync() {
  const [isNative, setIsNative] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<HealthSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const platform = Capacitor.getPlatform();
    const native = platform === 'ios' || platform === 'android';
    setIsNative(native);

    if (native) {
      checkAvailability();
    }
  }, []);

  const checkAvailability = async () => {
    try {
      const { Health } = await import('capacitor-health');
      const result = await Health.isHealthAvailable();
      setIsAvailable(result.available);
    } catch (err) {
      console.warn('Health plugin not available:', err);
      setIsAvailable(false);
    }
  };

  const requestPermission = useCallback(async () => {
    if (!isAvailable) return false;

    try {
      const { Health } = await import('capacitor-health');

      await Health.requestHealthPermissions({
        permissions: ['READ_STEPS', 'READ_HEART_RATE', 'READ_ACTIVE_CALORIES'],
      });

      setHasPermission(true);
      return true;
    } catch (err) {
      console.error('Health permission error:', err);
      setError('Não foi possível obter permissão de saúde');
      setHasPermission(false);
      return false;
    }
  }, [isAvailable]);

  const syncHealthData = useCallback(async (): Promise<HealthSyncResult | null> => {
    if (!isAvailable) return null;
    setSyncing(true);
    setError(null);

    try {
      const { Health } = await import('capacitor-health');

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Read steps
      let steps = 0;
      try {
        const stepsData = await Health.queryAggregated({
          startDate: startOfDay.toISOString(),
          endDate: now.toISOString(),
          dataType: 'steps',
          bucket: 'day',
        });
        steps = stepsData.aggregatedData?.[0]?.value ?? 0;
      } catch { steps = 0; }

      // Read calories
      let calories: number | null = null;
      try {
        const calData = await Health.queryAggregated({
          startDate: startOfDay.toISOString(),
          endDate: now.toISOString(),
          dataType: 'active-calories',
          bucket: 'day',
        });
        calories = calData.aggregatedData?.[0]?.value ?? null;
      } catch { calories = null; }

      // Heart rate via workouts (last workout of the day)
      let heartRate: number | null = null;
      try {
        const workouts = await Health.queryWorkouts({
          startDate: startOfDay.toISOString(),
          endDate: now.toISOString(),
          includeHeartRate: true,
          includeRoute: false,
          includeSteps: false,
        });
        const lastWorkout = workouts.workouts?.[workouts.workouts.length - 1];
        if (lastWorkout?.heartRate?.length) {
          const avgBpm = lastWorkout.heartRate.reduce((s, h) => s + h.bpm, 0) / lastWorkout.heartRate.length;
          heartRate = Math.round(avgBpm);
        }
      } catch { heartRate = null; }

      const result: HealthSyncResult = {
        steps,
        heartRate,
        sleepHours: null,
        calories,
        syncedAt: now.toISOString(),
      };

      setLastSync(result);
      setSyncing(false);
      return result;
    } catch (err) {
      console.error('Health sync error:', err);
      setError('Erro ao sincronizar dados de saúde');
      setSyncing(false);
      return null;
    }
  }, [isAvailable]);

  // Estimate energy level from steps (heuristic)
  const estimateEnergyFromSteps = (steps: number): number => {
    if (steps >= 10000) return 5;
    if (steps >= 7000) return 4;
    if (steps >= 4000) return 3;
    if (steps >= 2000) return 2;
    return 1;
  };

  return {
    isNative,
    isAvailable,
    hasPermission,
    syncing,
    lastSync,
    error,
    requestPermission,
    syncHealthData,
    estimateEnergyFromSteps,
  };
}
