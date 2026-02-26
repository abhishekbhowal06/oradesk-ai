import { Terminal, Radio, Network } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * TODO: Wire to backend health-check endpoint.
 * Each subsystem should report its status independently.
 */
export type HealthLevel = 'healthy' | 'degraded' | 'down';

export interface SystemHealthStatus {
    overall: HealthLevel;
    telephony: HealthLevel;
    pmsSync: HealthLevel;
    aiEngine: HealthLevel;
}

/** Default placeholder status – replace with real data when backend endpoint is ready. */
const DEFAULT_STATUS: SystemHealthStatus = {
    overall: 'healthy',
    telephony: 'healthy',
    pmsSync: 'healthy',
    aiEngine: 'healthy',
};

interface SystemHealthProps {
    status?: SystemHealthStatus;
}

const statusColor: Record<HealthLevel, string> = {
    healthy: 'text-emerald-400',
    degraded: 'text-warning',
    down: 'text-destructive',
};

const statusBg: Record<HealthLevel, string> = {
    healthy: 'bg-emerald-500/60',
    degraded: 'bg-warning/60',
    down: 'bg-destructive/60',
};

const overallMessages: Record<HealthLevel, string> = {
    healthy: 'All systems healthy',
    degraded: 'Some systems need attention',
    down: 'System offline – contact support',
};

function getSubStatusMessage(label: string, level: HealthLevel): string {
    if (level === 'healthy') return 'Healthy';
    if (label === 'Telephony' && level === 'degraded') return 'Calls may be delayed';
    if (label === 'Telephony' && level === 'down') return 'Calls unavailable';
    if (label === 'Clinic Software Sync' && level === 'degraded') return 'Double-check bookings';
    if (label === 'Clinic Software Sync' && level === 'down') return 'Sync offline';
    if (label === 'AI Engine' && level === 'degraded') return 'Slower responses';
    if (label === 'AI Engine' && level === 'down') return 'AI offline';
    return level === 'degraded' ? 'Degraded' : 'Offline';
}

export function SystemHealth({ status = DEFAULT_STATUS }: SystemHealthProps) {
    const metrics = [
        { label: 'Telephony', level: status.telephony, width: status.telephony === 'healthy' ? '12%' : status.telephony === 'degraded' ? '55%' : '90%' },
        { label: 'AI Engine', level: status.aiEngine, width: status.aiEngine === 'healthy' ? '34%' : status.aiEngine === 'degraded' ? '65%' : '95%' },
        { label: 'Clinic Software Sync', level: status.pmsSync, width: status.pmsSync === 'healthy' ? '100%' : status.pmsSync === 'degraded' ? '60%' : '10%' },
    ];

    return (
        <div className="border border-white/10 bg-[#051a1e] p-8 space-y-8 relative overflow-hidden group font-mono shadow-2xl">
            {/* Background Texture */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-stripe-pattern" />

            <div className="flex items-center justify-between border-b border-white/5 pb-5 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="h-8 w-8 border border-primary/20 bg-primary/5 flex items-center justify-center text-primary group-hover:rotate-90 transition-transform duration-500">
                        <Terminal className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white">
                            System Status
                        </h3>
                        <p className={cn("text-[7px] font-black uppercase tracking-[0.2em]", statusColor[status.overall])}>
                            {overallMessages[status.overall]}
                        </p>
                    </div>
                </div>
                <div className={cn("flex items-center gap-3 px-3 py-1 border",
                    status.overall === 'healthy' ? 'bg-emerald-500/5 border-emerald-500/10' :
                        status.overall === 'degraded' ? 'bg-warning/5 border-warning/10' : 'bg-destructive/5 border-destructive/10'
                )}>
                    <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse shadow-[0_0_8px]",
                        status.overall === 'healthy' ? 'bg-emerald-500' : status.overall === 'degraded' ? 'bg-warning' : 'bg-destructive'
                    )} />
                    <span className={cn("text-[9px] uppercase font-black tracking-widest leading-none", statusColor[status.overall])}>
                        {status.overall === 'healthy' ? 'SECURE' : status.overall === 'degraded' ? 'WARNING' : 'CRITICAL'}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-y-6 relative z-10">
                {metrics.map((metric, idx) => (
                    <div key={idx} className="space-y-3 group/metric">
                        <div className="flex justify-between items-end">
                            <span className="text-[9px] font-black text-muted-foreground uppercase opacity-40 group-hover/metric:text-white transition-colors tracking-widest">
                                {metric.label}
                            </span>
                            <span className={cn("text-[11px] font-black italic", statusColor[metric.level])}>
                                {getSubStatusMessage(metric.label, metric.level)}
                            </span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 relative overflow-hidden">
                            <div className={cn("absolute top-0 left-0 h-full transition-all duration-1000", statusBg[metric.level])}
                                style={{ width: metric.width }} />
                        </div>
                    </div>
                ))}
            </div>

            <div className="pt-5 border-t border-white/5 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                    <Network className="h-3.5 w-3.5 text-primary/40" />
                    <span className="text-[9px] font-black text-muted-foreground uppercase group-hover:text-white transition-colors tracking-widest italic opacity-40 group-hover:opacity-100">
                        Connected
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-6 w-6 border border-white/5 flex items-center justify-center bg-black/40">
                        <Radio className="h-3 w-3 text-primary animate-pulse" />
                    </div>
                </div>
            </div>

            {/* Tactical Hud Edge Decor */}
            <div className="absolute bottom-0 right-0 w-8 h-8 opacity-5 group-hover:opacity-20 transition-opacity pointer-events-none">
                <div className="absolute bottom-0 right-0 w-full h-[1px] bg-primary" />
                <div className="absolute bottom-0 right-0 w-[1px] h-full bg-primary" />
            </div>
        </div>
    );
}
