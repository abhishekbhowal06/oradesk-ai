import { ReactNode, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { SystemTooltip } from '@/components/ui/SystemTooltip';
import { Info } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtext: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    positive: boolean;
  };
  tooltip?: string;
  isLoading?: boolean;
  className?: string;
}

export function StatCard({ 
  title, 
  value, 
  subtext, 
  icon, 
  trend, 
  tooltip,
  isLoading = false,
  className 
}: StatCardProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const showLoading = isLoading || loading;

  if (showLoading) {
    return (
      <div className={cn('glass-card p-6', className)}>
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <Skeleton className="h-4 w-28 bg-muted/30" />
            <Skeleton className="h-10 w-32 bg-muted/30" />
            <Skeleton className="h-3 w-44 bg-muted/30" />
          </div>
          <Skeleton className="h-12 w-12 rounded-2xl bg-muted/30" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('glass-card hover-glow p-6 transition-all duration-300', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {title}
            </p>
            {tooltip && (
              <SystemTooltip content={tooltip}>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </SystemTooltip>
            )}
          </div>
          <p className="stat-value">{value}</p>
          <p className="text-sm text-secondary-foreground">{subtext}</p>
        </div>
        {icon && (
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <span
            className={cn(
              'text-sm font-medium',
              trend.positive ? 'text-success' : 'text-destructive'
            )}
          >
            {trend.positive ? '+' : ''}{trend.value}%
          </span>
          <span className="text-sm text-muted-foreground ml-2">vs previous period</span>
        </div>
      )}
    </div>
  );
}
