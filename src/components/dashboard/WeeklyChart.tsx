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
import { Info } from 'lucide-react';
import { SystemTooltip } from '@/components/ui/SystemTooltip';

export function WeeklyChart() {
  const { data: weeklyStats, isLoading } = useWeeklyStats();

  if (isLoading) {
    return <LoadingState variant="chart" />;
  }

  if (!weeklyStats || weeklyStats.length === 0) {
    return (
      <div className="glass-card p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground">Weekly Performance</h3>
          <p className="text-sm text-muted-foreground mt-1">Revenue and activity trends</p>
        </div>
        <EmptyState 
          type="analytics" 
          title="Insufficient Data"
          description="Weekly analytics require at least 7 days of recorded activity."
        />
      </div>
    );
  }

  // Check if there's any data
  const hasData = weeklyStats.some(d => d.revenue > 0 || d.calls > 0 || d.appointments > 0);

  if (!hasData) {
    return (
      <div className="glass-card p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground">Weekly Performance</h3>
          <p className="text-sm text-muted-foreground mt-1">Revenue and activity trends</p>
        </div>
        <EmptyState 
          type="analytics" 
          title="No Activity Yet"
          description="Charts will populate as AI handles calls and appointments are scheduled."
        />
      </div>
    );
  }

  return (
    <div className="glass-card hover-glow p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Weekly Performance</h3>
          <p className="text-sm text-muted-foreground mt-1">Revenue and AI conversation trends</p>
        </div>
        <SystemTooltip content="Shows revenue from appointments and total AI-managed conversations per day">
          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
        </SystemTooltip>
      </div>
      
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={weeklyStats}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(43, 67%, 52%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(43, 67%, 52%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(200, 50%, 50%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(200, 50%, 50%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="day"
              stroke="hsl(200, 15%, 60%)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(200, 15%, 60%)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(195, 100%, 11%)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
              }}
              labelStyle={{ color: 'hsl(40, 7%, 89%)', fontWeight: 500 }}
              itemStyle={{ color: 'hsl(200, 15%, 73%)' }}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="hsl(43, 67%, 52%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorRevenue)"
              name="Revenue"
            />
            <Area
              type="monotone"
              dataKey="calls"
              stroke="hsl(200, 50%, 50%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCalls)"
              name="AI Conversations"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-primary" />
          <span className="text-sm text-muted-foreground">Revenue</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-info" />
          <span className="text-sm text-muted-foreground">AI Conversations</span>
        </div>
      </div>
    </div>
  );
}
