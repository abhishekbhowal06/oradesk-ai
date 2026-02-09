import { useState, useEffect } from 'react';
import { AlertTriangle, Phone, CheckCircle, Clock, X, ChevronRight } from 'lucide-react';
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
            // Get clinic ID from context/auth
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
                    resolution: 'Handled by staff'
                })
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
        <div className={cn(
            'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
            hasUrgent ? 'bg-red-600' : 'bg-amber-500'
        )}>
            {/* Collapsed Banner */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-3 flex items-center justify-between text-white"
            >
                <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">
                        {hasUrgent
                            ? `${alerts.urgent} urgent patient${alerts.urgent > 1 ? 's' : ''} need attention`
                            : `${alerts.totalPending} item${alerts.totalPending > 1 ? 's' : ''} need your attention`
                        }
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm opacity-80">
                        {expanded ? 'Hide' : 'View'}
                    </span>
                    <ChevronRight className={cn(
                        'h-4 w-4 transition-transform',
                        expanded && 'rotate-90'
                    )} />
                </div>
            </button>

            {/* Expanded Alert List */}
            {expanded && (
                <div className="bg-white border-t shadow-lg max-h-96 overflow-y-auto">
                    {/* Urgent Alerts */}
                    {alerts.alerts.urgent.map(alert => (
                        <AlertItem
                            key={alert.id}
                            alert={alert}
                            urgent
                            onHandle={() => handleMarkHandled(alert.id)}
                        />
                    ))}

                    {/* Callback Alerts */}
                    {alerts.alerts.callbacks.map(alert => (
                        <AlertItem
                            key={alert.id}
                            alert={alert}
                            onHandle={() => handleMarkHandled(alert.id)}
                        />
                    ))}

                    {/* Review Alerts */}
                    {alerts.alerts.reviews.slice(0, 5).map(alert => (
                        <AlertItem
                            key={alert.id}
                            alert={alert}
                            onHandle={() => handleMarkHandled(alert.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function AlertItem({
    alert,
    urgent = false,
    onHandle
}: {
    alert: StaffAlert;
    urgent?: boolean;
    onHandle: () => void;
}) {
    const timeAgo = getTimeAgo(new Date(alert.createdAt));

    return (
        <div className={cn(
            'flex items-center gap-4 p-4 border-b hover:bg-gray-50 transition-colors',
            urgent && 'bg-red-50'
        )}>
            <div className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0',
                urgent ? 'bg-red-100' : 'bg-amber-100'
            )}>
                {urgent ? (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                ) : (
                    <Phone className="h-5 w-5 text-amber-600" />
                )}
            </div>

            <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                    {alert.title}
                </p>
                {alert.patientName && (
                    <p className="text-sm text-gray-600">
                        Patient: {alert.patientName}
                        {alert.patientPhone && ` • ${alert.patientPhone}`}
                    </p>
                )}
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeAgo}
                </p>
            </div>

            <div className="flex gap-2 flex-shrink-0">
                {alert.patientPhone && (
                    <a
                        href={`tel:${alert.patientPhone}`}
                        className="px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary/90"
                    >
                        Call
                    </a>
                )}
                <button
                    onClick={onHandle}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 flex items-center gap-1"
                >
                    <CheckCircle className="h-4 w-4" />
                    Done
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

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
}
