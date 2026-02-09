import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Phone, Users, Calendar, Info } from 'lucide-react';
import { LoadingState } from '@/components/states/LoadingState';
import { ErrorState } from '@/components/states/ErrorState';
import { SystemTooltip } from '@/components/ui/SystemTooltip';
import { cn } from '@/lib/utils';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAICalls } from '@/hooks/useAICalls';
import { usePatients } from '@/hooks/usePatients';
import { useAppointments } from '@/hooks/useAppointments';
import { format, subDays, startOfDay, parseISO } from 'date-fns';

export default function Analytics() {
  const { analytics, isLoading: analyticsLoading, isError: analyticsError } = useAnalytics();
  const { calls, isLoading: callsLoading } = useAICalls();
  const { patients, isLoading: patientsLoading } = usePatients();
  const { appointments, isLoading: appointmentsLoading } = useAppointments();
  
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  const isLoading = analyticsLoading || callsLoading || patientsLoading || appointmentsLoading;

  // Compute real analytics from data
  const computedStats = useMemo(() => {
    const totalRevenue = calls.reduce((sum, call) => sum + (call.revenue_impact || 0), 0);
    const activePatients = patients.filter(p => p.status === 'active').length;
    const thisWeekAppointments = appointments.filter(apt => {
      const aptDate = parseISO(apt.scheduled_at);
      const weekAgo = subDays(new Date(), 7);
      return aptDate >= weekAgo;
    }).length;

    return {
      totalRevenue,
      totalCalls: calls.length,
      activePatients,
      thisWeekAppointments,
    };
  }, [calls, patients, appointments]);

  // Compute outcome distribution
  const outcomeData = useMemo(() => {
    const confirmed = calls.filter(c => c.outcome === 'confirmed').length;
    const rescheduled = calls.filter(c => c.outcome === 'rescheduled').length;
    const actionNeeded = calls.filter(c => c.outcome === 'action_needed').length;
    
    return [
      { name: 'Confirmed', value: confirmed, color: 'hsl(43, 67%, 52%)' },
      { name: 'Rescheduled', value: rescheduled, color: 'hsl(200, 50%, 50%)' },
      { name: 'Action Needed', value: actionNeeded, color: 'hsl(0, 60%, 45%)' },
    ];
  }, [calls]);

  // Compute weekly stats from real data
  const weeklyStats = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();
    
    return days.map((day, index) => {
      const date = subDays(startOfDay(today), 6 - index);
      
      const dayCalls = calls.filter(call => {
        const callDate = startOfDay(parseISO(call.created_at));
        return callDate.getTime() === date.getTime();
      });
      
      const dayAppointments = appointments.filter(apt => {
        const aptDate = startOfDay(parseISO(apt.scheduled_at));
        return aptDate.getTime() === date.getTime();
      });

      const dayRevenue = dayCalls.reduce((sum, call) => sum + (call.revenue_impact || 0), 0);

      return {
        day,
        revenue: dayRevenue,
        calls: dayCalls.length,
        appointments: dayAppointments.length,
      };
    });
  }, [calls, appointments]);

  // Monthly revenue trend - real data only
  const monthlyRevenue = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = subDays(new Date(), i * 30);
      const monthStart = subDays(date, 30);
      
      const monthCalls = calls.filter(call => {
        const callDate = parseISO(call.created_at);
        return callDate >= monthStart && callDate <= date;
      });
      
      const revenue = monthCalls.reduce((sum, call) => sum + (call.revenue_impact || 0), 0);
      
      months.push({
        month: format(date, 'MMM'),
        revenue: revenue, // No fake fallback
      });
    }
    return months;
  }, [calls]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
            Practice Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Compiling performance data...
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <LoadingState variant="card" />
          <LoadingState variant="card" />
          <LoadingState variant="card" />
          <LoadingState variant="card" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LoadingState variant="chart" />
          <LoadingState variant="chart" />
        </div>
      </div>
    );
  }

  if (analyticsError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
            Practice Analytics
          </h1>
        </div>
        <ErrorState 
          title="Failed to Load Analytics"
          description="Unable to retrieve analytics data. Please check your connection and try again."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 stagger-children">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
            Practice Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Performance insights and operational metrics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(['week', 'month', 'quarter'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={cn(
                'px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize',
                selectedPeriod === period
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white/5 text-muted-foreground hover:text-foreground'
              )}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics - Real data only, no fake trends */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <p className="text-2xl font-semibold text-foreground">
            ${computedStats.totalRevenue.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Revenue Preserved</p>
          {computedStats.totalRevenue === 0 && (
            <p className="text-[10px] text-muted-foreground/60 mt-1">Will populate from call data</p>
          )}
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <Phone className="h-5 w-5 text-primary" />
          </div>
          <p className="text-2xl font-semibold text-foreground">{computedStats.totalCalls}</p>
          <p className="text-xs text-muted-foreground mt-1">AI Conversations</p>
          {computedStats.totalCalls === 0 && (
            <p className="text-[10px] text-muted-foreground/60 mt-1">No calls yet</p>
          )}
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <p className="text-2xl font-semibold text-foreground">{computedStats.activePatients}</p>
          <p className="text-xs text-muted-foreground mt-1">Active Patients</p>
          {computedStats.activePatients === 0 && (
            <p className="text-[10px] text-muted-foreground/60 mt-1">Add patients to track</p>
          )}
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <p className="text-2xl font-semibold text-foreground">{computedStats.thisWeekAppointments}</p>
          <p className="text-xs text-muted-foreground mt-1">This Week's Appointments</p>
          {computedStats.thisWeekAppointments === 0 && (
            <p className="text-[10px] text-muted-foreground/60 mt-1">None scheduled</p>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Revenue Trend</h3>
              <p className="text-sm text-muted-foreground mt-1">6-month performance trajectory</p>
            </div>
            <SystemTooltip content="Revenue preserved from AI-managed appointments">
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </SystemTooltip>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(43, 67%, 52%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(43, 67%, 52%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="month"
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
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(195, 100%, 11%)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Revenue']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(43, 67%, 52%)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Call Outcomes */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground">AI Outcome Distribution</h3>
              <p className="text-sm text-muted-foreground mt-1">Conversation resolution breakdown</p>
            </div>
            <SystemTooltip content="How AI-managed conversations were resolved">
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </SystemTooltip>
          </div>
          <div className="h-[280px] flex items-center justify-center">
            {outcomeData.some(d => d.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={outcomeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {outcomeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(195, 100%, 11%)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm">No call data available yet</p>
            )}
          </div>
          <div className="flex justify-center gap-6 mt-4">
            {outcomeData.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm text-muted-foreground">{item.name}</span>
                <span className="text-sm font-medium text-foreground">({item.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Weekly Performance */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Weekly Operations Overview</h3>
            <p className="text-sm text-muted-foreground mt-1">Appointments and AI conversations by day</p>
          </div>
          <SystemTooltip content="Daily breakdown of practice activity">
            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
          </SystemTooltip>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(195, 100%, 11%)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                }}
              />
              <Bar dataKey="appointments" fill="hsl(43, 67%, 52%)" radius={[4, 4, 0, 0]} name="Appointments" />
              <Bar dataKey="calls" fill="hsl(200, 50%, 50%)" radius={[4, 4, 0, 0]} name="AI Conversations" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-6 mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">Appointments</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-info" />
            <span className="text-sm text-muted-foreground">AI Conversations</span>
          </div>
        </div>
      </div>

      {/* Data Freshness Indicator */}
      <p className="text-xs text-muted-foreground text-center">
        Data last refreshed: {new Date().toLocaleString()} • Analytics update in real-time
      </p>
    </div>
  );
}
