import { DollarSign, Phone, ShieldAlert, TrendingUp, AlertCircle, Activity } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { WeeklyChart } from '@/components/dashboard/WeeklyChart';
import { RecentCalls } from '@/components/dashboard/RecentCalls';
import { UpcomingAppointments } from '@/components/dashboard/UpcomingAppointments';
import { ClinicHealthCard } from '@/components/dashboard/ClinicHealthCard';
import { useDashboardStats } from '@/hooks/useAnalytics';
import { useAnalyticsEvents } from '@/hooks/useAnalytics';
import { useClinic } from '@/contexts/ClinicContext';
import { LoadingState } from '@/components/states/LoadingState';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { EmptyState } from '@/components/states/EmptyState';
import { cn } from '@/lib/utils';
import { useState, useMemo } from 'react';
import { useAICalls } from '@/hooks/useAICalls';

export default function Dashboard() {
  const { currentClinic } = useClinic();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: events, isLoading: eventsLoading } = useAnalyticsEvents({ limit: 4, days: 1 });
  const { calls } = useAICalls();
  const [showActionBanner, setShowActionBanner] = useState(true);

  // Calculate real mean duration from actual call data
  const meanDuration = useMemo(() => {
    const callsWithDuration = calls.filter(c => c.duration_seconds && c.duration_seconds > 0);
    if (callsWithDuration.length === 0) return null;
    const total = callsWithDuration.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
    return Math.round(total / callsWithDuration.length);
  }, [calls]);

  const isLoading = statsLoading || !currentClinic;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
            Command Center
          </h1>
          <p className="text-muted-foreground mt-1">
            Initializing practice overview...
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <LoadingState variant="card" />
          <LoadingState variant="card" />
          <LoadingState variant="card" />
          <LoadingState variant="card" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <LoadingState variant="chart" />
          </div>
          <LoadingState variant="card" />
        </div>
      </div>
    );
  }

  const dashboardStats = stats || {
    revenueSaved: 0,
    callsHandled: 0,
    missedPrevented: 0,
    confirmationRate: 0,
    upcomingToday: 0,
    actionRequired: 0,
  };

  return (
    <div className="space-y-6 stagger-children">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
          Practice Overview
        </h1>
        <p className="text-muted-foreground mt-1">
          Today's performance for {currentClinic?.name}
        </p>
      </div>

      {/* Action Required Banner */}
      {showActionBanner && dashboardStats.actionRequired > 0 && (
        <WarningBanner
          type="warning"
          title={`${dashboardStats.actionRequired} Patient${dashboardStats.actionRequired > 1 ? 's' : ''} Need Attention`}
          description="Some conversations require staff follow-up. Review in Call History."
          onDismiss={() => setShowActionBanner(false)}
        />
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Revenue Preserved"
          value={`$${dashboardStats.revenueSaved.toLocaleString()}`}
          subtext="From rescheduled appointments"
          icon={<DollarSign className="h-6 w-6 text-primary" />}
          tooltip="Value of appointments saved through automated rescheduling"
        />
        <StatCard
          title="Calls Handled"
          value={dashboardStats.callsHandled}
          subtext="Past 30 days"
          icon={<Phone className="h-6 w-6 text-primary" />}
          tooltip="Patient calls managed automatically"
        />
        <StatCard
          title="Appointments Recovered"
          value={dashboardStats.missedPrevented}
          subtext="Would have been missed"
          icon={<ShieldAlert className="h-6 w-6 text-primary" />}
          tooltip="Appointments that would have been missed without intervention"
        />
        <StatCard
          title="Handled Without Staff"
          value={`${dashboardStats.confirmationRate}%`}
          subtext="No manual follow-up needed"
          icon={<TrendingUp className="h-6 w-6 text-primary" />}
          tooltip="Percentage of calls resolved without staff involvement"
        />
      </div>

      {/* Charts and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <WeeklyChart />
        </div>
        <div>
          <UpcomingAppointments />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentCalls />
        <div className="space-y-6">
          {/* Clinic Health Card */}
          <ClinicHealthCard />

          {/* Practice Efficiency */}
          <div className="glass-card hover-glow p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground">Practice Efficiency</h3>
              <p className="text-sm text-muted-foreground mt-1">How your practice is performing</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/[0.02]">
                <p className="text-2xl font-semibold text-foreground">
                  {meanDuration !== null ? `${meanDuration}s` : '--'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Avg Call Duration</p>
                {meanDuration === null && (
                  <p className="text-[10px] text-muted-foreground/60 mt-1">No calls yet</p>
                )}
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02]">
                <p className="text-2xl font-semibold text-foreground">{dashboardStats.upcomingToday}</p>
                <p className="text-xs text-muted-foreground mt-1">Appointments Today</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02]">
                <p className="text-2xl font-semibold text-foreground">
                  {dashboardStats.confirmationRate > 0 ? `${dashboardStats.confirmationRate}%` : '--'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Auto-Resolved</p>
                {dashboardStats.confirmationRate === 0 && (
                  <p className="text-[10px] text-muted-foreground/60 mt-1">No completed calls</p>
                )}
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02]">
                <p className="text-2xl font-semibold text-foreground">{dashboardStats.actionRequired}</p>
                <p className="text-xs text-muted-foreground mt-1">Need Attention</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent System Events */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
          </div>
          <span className="text-xs text-muted-foreground">Last 24 hours</span>
        </div>

        {eventsLoading ? (
          <LoadingState variant="list" rows={3} />
        ) : events && events.length > 0 ? (
          <div className="space-y-2">
            {events.map((event: any) => (
              <div
                key={event.id}
                className="flex items-center justify-between py-3 border-b border-white/5 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'h-8 w-8 rounded-lg flex items-center justify-center',
                    event.event_type === 'revenue_saved' && 'bg-primary/10',
                    event.event_type === 'escalation_created' && 'bg-destructive/10',
                    event.event_type === 'call_completed' && 'bg-success/10',
                    (event.event_type === 'appointment_rescheduled' || event.event_type === 'appointment_confirmed') && 'bg-info/10',
                  )}>
                    {event.event_type === 'revenue_saved' && <DollarSign className="h-4 w-4 text-primary" />}
                    {event.event_type === 'escalation_created' && <AlertCircle className="h-4 w-4 text-destructive" />}
                    {event.event_type === 'call_completed' && <Phone className="h-4 w-4 text-success" />}
                    {(event.event_type === 'appointment_rescheduled' || event.event_type === 'appointment_confirmed') &&
                      <TrendingUp className="h-4 w-4 text-info" />}
                  </div>
                  <div>
                    <p className="text-sm text-foreground">
                      {event.event_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      {event.patient && ` - ${event.patient.first_name} ${event.patient.last_name}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                {event.revenue_impact && (
                  <span className="text-sm font-medium text-primary">
                    +${Number(event.revenue_impact).toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            type="analytics"
            title="No Recent Events"
            description="Events will appear here as the AI manages calls and appointments."
          />
        )}
      </div>
    </div>
  );
}
