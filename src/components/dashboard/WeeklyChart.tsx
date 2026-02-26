import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useWeeklyStats } from '@/hooks/useAnalytics';
import { LoadingState } from '@/components/states/LoadingState';
import { EmptyState } from '@/components/states/EmptyState';
import { cn } from '@/lib/utils';

export function WeeklyChart() {
  const { data: weeklyStats, isLoading } = useWeeklyStats();

  if (isLoading) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <LoadingState variant="chart" />
      </div>
    );
  }

  if (!weeklyStats || weeklyStats.length === 0) {
    return (
      <div className="h-[400px] flex flex-col justify-center">
        <EmptyState
          type="analytics"
          title="Insufficient Data"
          description="Weekly analytics require at least 7 days of recorded activity to display."
        />
      </div>
    );
  }

  const hasData = weeklyStats.some((d) => d.revenue > 0 || d.calls > 0 || d.appointments > 0);

  if (!hasData) {
    return (
      <div className="h-[400px] flex flex-col justify-center">
        <EmptyState
          type="analytics"
          title="No Recent Activity"
          description="Charts will automatically populate as AI handles calls and schedules appointments."
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="h-[300px] w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={weeklyStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1F8A8A" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#1F8A8A" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2FA4A4" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2FA4A4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
            <XAxis
              dataKey="day"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
              dy={10}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-background border border-border p-3 shadow-md rounded-xl space-y-2">
                      <p className="text-xs font-semibold text-foreground border-b border-border pb-1 mb-2 tracking-wide">{label}</p>
                      {payload.map((p, i) => (
                        <div key={i} className="flex items-center justify-between gap-6">
                          <span className="text-xs font-medium text-muted-foreground">{p.name}</span>
                          <span className={cn("text-xs font-bold", p.name === 'Revenue' ? "text-primary" : "text-primary/70")}>
                            {p.name === 'Revenue' ? `$${p.value.toLocaleString()}` : `${p.value} Calls`}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#1F8A8A"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorRevenue)"
              name="Revenue"
              animationDuration={1500}
            />
            <Area
              type="monotone"
              dataKey="calls"
              stroke="#2FA4A4"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCalls)"
              name="AI Calls"
              animationDuration={2000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-start gap-8 mt-auto border-t border-border pt-6">
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="h-2 w-6 rounded-full bg-primary/20 border-primary/30 group-hover:bg-primary transition-colors duration-200" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-foreground">Revenue Saved</span>
            <span className="text-[10px] font-medium text-muted-foreground">From successful bookings</span>
          </div>
        </div>
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="h-2 w-6 rounded-full bg-primary/20 border-primary/30 group-hover:bg-[#2FA4A4] transition-colors duration-200" />
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-foreground">Call Volume</span>
            <span className="text-[10px] font-medium text-muted-foreground">Total patient interactions</span>
          </div>
        </div>
      </div>
    </div>
  );
}
