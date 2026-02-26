import { ReactNode, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { SystemTooltip } from '@/components/ui/SystemTooltip';
import { Info, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react';

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
  className,
}: StatCardProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const showLoading = isLoading || loading;

  if (showLoading) {
    return (
      <div className={cn('bg-card border border-border rounded-2xl p-6 min-h-[160px] shadow-sm', className)}>
        <div className="flex items-start justify-between">
          <div className="space-y-4 flex-1">
            <Skeleton className="h-4 w-24 bg-muted" />
            <Skeleton className="h-10 w-32 bg-muted" />
            <Skeleton className="h-3 w-48 bg-muted" />
          </div>
          <Skeleton className="h-12 w-12 rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'relative group p-6 transition-all duration-300',
      'bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 shadow-sm hover:shadow-md',
      className
    )}>
      <div className="flex flex-col justify-between h-full relative z-10">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground transition-colors group-hover:text-foreground">
                {title}
              </span>
              {tooltip && (
                <SystemTooltip content={tooltip}>
                  <div className="p-1 cursor-help hover:bg-secondary rounded-md transition-colors">
                    <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-primary transition-colors" />
                  </div>
                </SystemTooltip>
              )}
            </div>

            <div className="flex items-center gap-3">
              {trend && (
                <div className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
                  trend.positive ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                )}>
                  {trend.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  <span>{trend.value}%</span>
                </div>
              )}
              {icon && (
                <div className="h-10 w-10 rounded-xl border border-primary/10 bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary/10 group-hover:border-primary/20 transition-all duration-300">
                  {icon}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline gap-2 group-hover:translate-x-1 transition-transform duration-300">
              <h4 className="text-4xl font-bold tracking-tight text-foreground">
                {value}
              </h4>
            </div>
            <p className="text-xs font-medium text-muted-foreground mt-1">
              {subtext}
            </p>
          </div>
        </div>

        {/* Subtle decorative accent */}
        <div className="absolute bottom-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>
    </div>
  );
}
