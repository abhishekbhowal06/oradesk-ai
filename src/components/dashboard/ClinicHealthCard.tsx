import { useState, useEffect } from 'react';
import { Activity, AlertCircle, CheckCircle, TrendingUp, Users, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HealthSignal {
    name: string;
    status: 'healthy' | 'warning' | 'critical';
    action: string | null;
}

interface ClinicHealth {
    status: 'healthy' | 'needs_attention' | 'critical';
    summary: string;
    signals: HealthSignal[];
}

export function ClinicHealthCard() {
    const [health, setHealth] = useState<ClinicHealth | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHealth();
        // Refresh every 2 minutes
        const interval = setInterval(fetchHealth, 120000);
        return () => clearInterval(interval);
    }, []);

    const fetchHealth = async () => {
        try {
            const clinicId = localStorage.getItem('clinic_id');
            if (!clinicId) return;

            const response = await fetch(`/api/v1/ops/health/${clinicId}`);
            if (response.ok) {
                const data = await response.json();
                setHealth(data);
            }
        } catch (error) {
            console.error('Failed to fetch health:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="glass-card p-6 animate-pulse">
                <div className="h-6 bg-muted/30 rounded w-1/3 mb-4" />
                <div className="space-y-3">
                    <div className="h-4 bg-muted/30 rounded w-full" />
                    <div className="h-4 bg-muted/30 rounded w-2/3" />
                </div>
            </div>
        );
    }

    if (!health) return null;

    const statusConfig = {
        healthy: {
            bg: 'bg-success/10',
            border: 'border-success/30',
            icon: CheckCircle,
            iconColor: 'text-success',
            title: 'System Healthy'
        },
        needs_attention: {
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/30',
            icon: AlertCircle,
            iconColor: 'text-amber-500',
            title: 'Needs Attention'
        },
        critical: {
            bg: 'bg-red-500/10',
            border: 'border-red-500/30',
            icon: AlertCircle,
            iconColor: 'text-red-500',
            title: 'Action Required'
        }
    };

    const config = statusConfig[health.status];
    const StatusIcon = config.icon;

    return (
        <div className={cn(
            'glass-card p-6 border',
            config.bg,
            config.border
        )}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        'h-10 w-10 rounded-xl flex items-center justify-center',
                        config.bg
                    )}>
                        <StatusIcon className={cn('h-5 w-5', config.iconColor)} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground">{config.title}</h3>
                        <p className="text-sm text-muted-foreground">{health.summary}</p>
                    </div>
                </div>
                <Activity className={cn('h-5 w-5', config.iconColor)} />
            </div>

            {health.signals.length > 0 && (
                <div className="space-y-2 mt-4">
                    {health.signals.map((signal, idx) => (
                        <SignalRow key={idx} signal={signal} />
                    ))}
                </div>
            )}
        </div>
    );
}

function SignalRow({ signal }: { signal: HealthSignal }) {
    const statusColors = {
        healthy: 'bg-success',
        warning: 'bg-amber-500',
        critical: 'bg-red-500'
    };

    return (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02]">
            <div className={cn(
                'h-2 w-2 rounded-full flex-shrink-0',
                statusColors[signal.status]
            )} />
            <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{signal.name}</p>
                {signal.action && (
                    <p className="text-xs text-muted-foreground mt-0.5">{signal.action}</p>
                )}
            </div>
        </div>
    );
}
