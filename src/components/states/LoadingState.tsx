import { cn } from '@/lib/utils';

interface LoadingStateProps {
  variant?: 'card' | 'list' | 'chart' | 'table' | 'inline' | 'kpi' | 'conversations-3-pane';
  rows?: number;
  className?: string;
}

export function LoadingState({ variant = 'card', rows = 4, className }: LoadingStateProps) {
  const shimmerClass =
    'animate-pulse bg-gradient-to-r from-muted/30 via-muted/50 to-muted/30 bg-[length:200%_100%]';

  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className={cn('h-4 w-4 rounded-full', shimmerClass)} />
        <div className={cn('h-4 w-24 rounded', shimmerClass)} />
      </div>
    );
  }

  if (variant === 'chart') {
    return (
      <div className={cn('glass-card p-6', className)}>
        <div className="space-y-4">
          <div className={cn('h-5 w-40 rounded', shimmerClass)} />
          <div className={cn('h-3 w-56 rounded', shimmerClass)} />
        </div>
        <div className="h-[280px] mt-6 flex items-end gap-2 pt-8">
          {[65, 45, 80, 55, 70, 30, 10].map((height, i) => (
            <div
              key={i}
              className={cn('flex-1 rounded-t', shimmerClass)}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'kpi') {
    return (
      <div className={cn('grid grid-cols-1 lg:grid-cols-4 gap-6', className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card p-6 flex flex-col justify-between h-36">
            <div className="flex items-start justify-between">
              <div className="space-y-4 w-full">
                <div className={cn('h-4 w-3/4 rounded', shimmerClass)} />
                <div className={cn('h-8 w-1/2 rounded mt-2', shimmerClass)} />
              </div>
              <div className={cn('h-10 w-10 rounded-lg flex-shrink-0', shimmerClass)} />
            </div>
            <div className={cn('h-3 w-1/2 rounded mt-4', shimmerClass)} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'conversations-3-pane') {
    return (
      <div className={cn('flex h-full w-full gap-4', className)}>
        {/* Left Pane: Thread List */}
        <div className="w-80 flex-shrink-0 border-r border-border pr-4 space-y-4">
          <div className={cn('h-10 w-full rounded-xl', shimmerClass)} />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 p-3 rounded-xl border border-border/50">
              <div className={cn('h-10 w-10 rounded-full flex-shrink-0', shimmerClass)} />
              <div className="space-y-2 w-full">
                <div className={cn('h-4 w-24 rounded', shimmerClass)} />
                <div className={cn('h-3 w-full rounded', shimmerClass)} />
              </div>
            </div>
          ))}
        </div>
        {/* Center Pane: Active Transcript */}
        <div className="flex-1 flex flex-col pt-4 px-6 space-y-6">
          <div className={cn('h-16 w-3/4 rounded-2xl self-start', shimmerClass)} />
          <div className={cn('h-16 w-1/2 rounded-2xl self-end', shimmerClass)} />
          <div className={cn('h-24 w-2/3 rounded-2xl self-start', shimmerClass)} />
        </div>
        {/* Right Pane: Context */}
        <div className="w-72 flex-shrink-0 border-l border-border pl-6 space-y-6 pt-4">
          <div className={cn('h-32 w-full rounded-2xl', shimmerClass)} />
          <div className={cn('h-48 w-full rounded-2xl', shimmerClass)} />
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02]">
            <div className={cn('h-10 w-10 rounded-xl flex-shrink-0', shimmerClass)} />
            <div className="flex-1 space-y-2">
              <div className={cn('h-4 w-32 rounded', shimmerClass)} />
              <div className={cn('h-3 w-20 rounded', shimmerClass)} />
            </div>
            <div className={cn('h-6 w-20 rounded-full', shimmerClass)} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="grid grid-cols-5 gap-4 p-4 border-b border-white/5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={cn('h-4 rounded', shimmerClass)} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="grid grid-cols-5 gap-4 p-4">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className={cn('h-4 rounded', shimmerClass)} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Default card variant
  return (
    <div className={cn('glass-card p-6', className)}>
      <div className="space-y-4">
        <div className={cn('h-4 w-28 rounded', shimmerClass)} />
        <div className={cn('h-10 w-36 rounded', shimmerClass)} />
        <div className={cn('h-3 w-44 rounded', shimmerClass)} />
      </div>
    </div>
  );
}
