import { useState, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

// Types for the capacitor-health plugin
interface HealthDataPoint {
  startDate: string;
  endDate: string;
  value: number;
  unit: string;
  source?: string;
}

interface HealthSyncResult {
  steps: number;
  heartRate: number | null;
  sleepHours: number | null;
  calories: number | null;
  syncedAt: string;
}

/**
 * Hook to sync health data from Apple HealthKit / Google Health Connect
 * Only works when running as a native Capacitor app
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
      const { CapacitorHealth } = await import('capacitor-health');
      const result = await CapacitorHealth.isHealthAvailable();
      setIsAvailable(result.available);
    } catch (err) {
      console.warn('Health plugin not available:', err);
      setIsAvailable(false);
    }
  };

  const requestPermission = useCallback(async () => {
    if (!isAvailable) return false;

    try {
      const { CapacitorHealth } = await import('capacitor-health');
      const result = await CapacitorHealth.checkHealthPermissions({
        permissions: ['READ_STEPS', 'READ_HEART_RATE', 'READ_CALORIES'],
      });

      // If not all granted, request them
      if (!result.granted) {
        await CapacitorHealth.requestHealthPermissions({
          permissions: ['READ_STEPS', 'READ_HEART_RATE', 'READ_CALORIES'],
        });
      }

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
    if (!isAvailable || !hasPermission) return null;
    setSyncing(true);
    setError(null);

    try {
      const { CapacitorHealth } = await import('capacitor-health');

      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Read steps
      let steps = 0;
      try {
        const stepsData = await CapacitorHealth.queryAggregated({
          startDate: startOfDay.toISOString(),
          endDate: now.toISOString(),
          dataType: 'STEPS',
        });
        steps = stepsData?.value ?? 0;
      } catch { steps = 0; }

      // Read heart rate (latest)
      let heartRate: number | null = null;
      try {
        const hrData = await CapacitorHealth.queryAggregated({
          startDate: startOfDay.toISOString(),
          endDate: now.toISOString(),
          dataType: 'HEART_RATE',
        });
        heartRate = hrData?.value ?? null;
      } catch { heartRate = null; }

      // Read calories
      let calories: number | null = null;
      try {
        const calData = await CapacitorHealth.queryAggregated({
          startDate: startOfDay.toISOString(),
          endDate: now.toISOString(),
          dataType: 'CALORIES',
        });
        calories = calData?.value ?? null;
      } catch { calories = null; }

      const result: HealthSyncResult = {
        steps,
        heartRate,
        sleepHours: null, // Sleep requires special handling per platform
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
  }, [isAvailable, hasPermission]);

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

export type { HealthSyncResult };
