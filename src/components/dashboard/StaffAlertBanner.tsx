import { useState, useEffect } from 'react';
import { AlertTriangle, Phone, CheckCircle, Clock, X, ChevronRight, ShieldAlert, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StaffAlert {
  id: string;
  type: 'patient_callback' | 'review_ai_decision' | 'update_settings' | 'urgent_followup';
  title: string;
  description: string;
  patientName?: string;
  patientPhone?: string;
  createdAt: string;
}

interface AlertsResponse {
  totalPending: number;
  urgent: number;
  alerts: {
    urgent: StaffAlert[];
    callbacks: StaffAlert[];
    reviews: StaffAlert[];
  };
}

export function StaffAlertBanner() {
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
    // Poll every 30 seconds
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
    try {
      const clinicId = localStorage.getItem('clinic_id');
      if (!clinicId) return;

      const response = await fetch(`/api/v1/ops/alerts/${clinicId}`);
      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkHandled = async (alertId: string) => {
    try {
      const staffId = localStorage.getItem('user_id');
      await fetch(`/api/v1/ops/alerts/${alertId}/handle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId,
          resolution: 'Handled by staff',
        }),
      });
      fetchAlerts();
    } catch (error) {
      console.error('Failed to handle alert:', error);
    }
  };

  if (loading || !alerts || alerts.totalPending === 0) {
    return null;
  }

  const hasUrgent = alerts.urgent > 0;

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-[60] transition-all duration-300 border-b',
        hasUrgent ? 'bg-red-950 border-red-500/50' : 'bg-amber-950 border-amber-500/50',
      )}
    >
      {/* Collapsed Banner */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-2.5 flex items-center justify-between text-white group"
      >
        <div className="flex items-center gap-4">
          <div className={cn(
            "h-2 w-2 rotate-45 animate-pulse",
            hasUrgent ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
          )} />
          <div className="flex flex-col items-start leading-none gap-1">
            <span className="text-[10px] font-mono font-bold tracking-widest uppercase opacity-80">
              Inbound Operational Exceptions
            </span>
            <span className={cn(
              "text-sm font-bold uppercase italic tracking-tight",
              hasUrgent ? "text-red-400" : "text-amber-400"
            )}>
              {hasUrgent
                ? `DETECTED::{${alerts.urgent}} URGENT SUBJECTS REQUIRE PROTOCOL`
                : `DETECTED::{${alerts.totalPending}} ITEMS REQUIRE SYSTEM ATTENTION`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest opacity-50 group-hover:opacity-100 transition-opacity">
            {expanded ? 'Collapse Log' : 'Expand Vector'}
          </span>
          <ChevronRight className={cn('h-4 w-4 transition-transform text-white/50 group-hover:text-white', expanded && 'rotate-90')} />
        </div>
      </button>

      {/* Expanded Alert List */}
      {expanded && (
        <div className="bg-[#051a1e] border-t border-white/10 shadow-2xl max-h-[70vh] overflow-y-auto scrollbar-thin">
          <div className="p-2 bg-black/40 border-b border-white/5 flex items-center gap-2">
            <Cpu className="h-3 w-3 text-primary/40" />
            <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-widest">Exception Buffer Matrix</span>
          </div>

          {/* Urgent Alerts */}
          {alerts.alerts.urgent.map((alert) => (
            <AlertItem
              key={alert.id}
              alert={alert}
              urgent
              onHandle={() => handleMarkHandled(alert.id)}
            />
          ))}

          {/* Callback Alerts */}
          {alerts.alerts.callbacks.map((alert) => (
            <AlertItem key={alert.id} alert={alert} onHandle={() => handleMarkHandled(alert.id)} />
          ))}

          {/* Review Alerts */}
          {alerts.alerts.reviews.slice(0, 5).map((alert) => (
            <AlertItem key={alert.id} alert={alert} onHandle={() => handleMarkHandled(alert.id)} />
          ))}

          <div className="p-3 text-center border-t border-white/5">
            <p className="text-[9px] font-mono text-muted-foreground uppercase opacity-30">End of Exception buffer</p>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertItem({
  alert,
  urgent = false,
  onHandle,
}: {
  alert: StaffAlert;
  urgent?: boolean;
  onHandle: () => void;
}) {
  const timeAgo = getTimeAgo(new Date(alert.createdAt));

  return (
    <div
      className={cn(
        'flex items-center gap-6 p-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors group',
        urgent && 'bg-red-500/5',
      )}
    >
      <div
        className={cn(
          'h-12 w-12 border flex items-center justify-center flex-shrink-0 relative',
          urgent ? 'bg-red-500/10 border-red-500/30' : 'bg-primary/5 border-primary/20',
        )}
      >
        {urgent ? (
          <ShieldAlert className="h-6 w-6 text-red-500 animate-pulse" />
        ) : (
          <Phone className="h-5 w-5 text-primary" />
        )}
        <div className="absolute -top-1 -left-1 w-1.5 h-1.5 bg-white/10 border-t border-l border-white/20" />
        <div className="absolute -bottom-1 -right-1 w-1.5 h-1.5 bg-white/10 border-b border-r border-white/20" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <p className="text-xs font-mono font-bold text-white uppercase tracking-tight truncate group-hover:text-primary transition-colors">{alert.title}</p>
          {urgent && <span className="text-[8px] font-mono font-bold text-red-500 border border-red-500/30 px-1 bg-red-500/10">CRITICAL</span>}
        </div>

        {alert.patientName && (
          <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-wide">
            <span className="opacity-40">SUBJECT:</span> {alert.patientName}
            {alert.patientPhone && <span className="opacity-40 ml-2">// VER: {alert.patientPhone}</span>}
          </p>
        )}
        <p className="text-[9px] font-mono text-muted-foreground opacity-40 mt-1 flex items-center gap-1 uppercase">
          <Clock className="h-3 w-3" />
          Latency: {timeAgo}
        </p>
      </div>

      <div className="flex gap-2 flex-shrink-0">
        {alert.patientPhone && (
          <a
            href={`tel:${alert.patientPhone}`}
            className="px-4 py-1.5 bg-primary text-black text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors"
          >
            Bridge
          </a>
        )}
        <button
          onClick={onHandle}
          className="px-4 py-1.5 bg-white/5 text-muted-foreground text-[10px] font-mono font-bold uppercase tracking-widest border border-white/10 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2"
        >
          <CheckCircle className="h-3 w-3" />
          Resolve
        </button>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'NEAR_REALTIME';
  if (diffMins < 60) return `${diffMins}M_AGO`;
  if (diffHours < 24) return `${diffHours}H_AGO`;
  return `${Math.floor(diffHours / 24)}D_AGO`;
}
