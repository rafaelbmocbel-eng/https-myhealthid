import { Skeleton } from '@/components/ui/skeleton';

export function SkeletonStatCard() {
  return (
    <div className="clinical-card p-4 space-y-3">
      <Skeleton className="h-6 w-6 rounded-lg mx-auto" />
      <Skeleton className="h-8 w-16 mx-auto" />
      <Skeleton className="h-3 w-24 mx-auto" />
    </div>
  );
}

export function SkeletonModuleCard() {
  return (
    <div className="clinical-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1 rounded-md" />
        <Skeleton className="h-9 flex-1 rounded-md" />
      </div>
    </div>
  );
}

export function SkeletonScheduleRow() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border">
      <Skeleton className="h-5 w-12" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="container py-4 sm:py-8 max-w-6xl px-1 sm:px-6 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)}
      </div>
      {/* Modules */}
      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonModuleCard key={i} />)}
      </div>
      {/* Schedule */}
      <div className="clinical-card space-y-3">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 3 }).map((_, i) => <SkeletonScheduleRow key={i} />)}
      </div>
    </div>
  );
}
