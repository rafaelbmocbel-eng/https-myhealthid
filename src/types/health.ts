export interface HealthSyncResult {
  steps: number;
  heartRate: number | null;
  sleepHours: number | null;
  calories: number | null;
  syncedAt: string;
}
