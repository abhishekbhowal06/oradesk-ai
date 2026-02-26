import { cn } from '@/lib/utils';
import { Play, Pause, Square, AlertCircle, Clock, CheckCircle } from 'lucide-react';

type CampaignStatus = 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';

export function CampaignStatusBadge({ status, className }: { status: CampaignStatus; className?: string }) {
    const configs = {
        running: {
            label: 'ACTIVE BROADCAST',
            icon: Play,
            color: 'text-emerald-400',
            bg: 'bg-emerald-500/10',
            border: 'border-emerald-500/20',
            pulse: true
        },
        paused: {
            label: 'HALTED',
            icon: Pause,
            color: 'text-amber-400',
            bg: 'bg-amber-500/10',
            border: 'border-amber-500/20',
            pulse: false
        },
        completed: {
            label: 'FINISHED',
            icon: CheckCircle,
            color: 'text-blue-400',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/20',
            pulse: false
        },
        scheduled: {
            label: 'COUNTDOWN',
            icon: Clock,
            color: 'text-purple-400',
            bg: 'bg-purple-500/10',
            border: 'border-purple-500/20',
            pulse: true
        },
        cancelled: {
            label: 'ABORTED',
            icon: Square,
            color: 'text-destructive',
            bg: 'bg-destructive/10',
            border: 'border-destructive/20',
            pulse: false
        },
        draft: {
            label: 'STAGING',
            icon: AlertCircle,
            color: 'text-muted-foreground',
            bg: 'bg-white/5',
            border: 'border-white/10',
            pulse: false
        }
    };

    const config = configs[status] || configs.draft;
    const Icon = config.icon;

    return (
        <div className={cn(
            "inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-[10px] uppercase font-mono font-bold tracking-widest",
            config.bg,
            config.border,
            config.color,
            className
        )}>
            <div className="relative flex items-center justify-center">
                {config.pulse && (
                    <span className={cn("absolute animate-ping inline-flex h-full w-full rounded-full opacity-75", config.color.replace('text-', 'bg-'))} />
                )}
                <Icon className="h-3 w-3 relative z-10" />
            </div>
            <span>{config.label}</span>
        </div>
    );
}
