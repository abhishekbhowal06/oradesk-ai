import { cn } from '@/lib/utils';
import { Activity } from 'lucide-react';

interface LiveIndicatorProps {
    status: 'active' | 'idle' | 'offline' | 'error';
    label?: string;
    className?: string;
}

export function LiveIndicator({ status, label = 'SYSTEM ONLINE', className }: LiveIndicatorProps) {
    const colors = {
        active: 'bg-emerald-500 shadow-[0_0_10px_2px_rgba(16,185,129,0.5)]',
        idle: 'bg-amber-500 shadow-[0_0_10px_2px_rgba(245,158,11,0.5)]',
        offline: 'bg-slate-500',
        error: 'bg-rose-500 shadow-[0_0_10px_2px_rgba(244,63,94,0.5)]',
    };

    const textColors = {
        active: 'text-emerald-400',
        idle: 'text-amber-400',
        offline: 'text-slate-400',
        error: 'text-rose-400',
    };

    return (
        <div
            className={cn(
                'flex items-center gap-3 px-3 py-1.5 rounded-full bg-black/40 border border-white/5 backdrop-blur-md',
                className
            )}
        >
            <div className="relative flex h-3 w-3">
                {status === 'active' && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                    className={cn(
                        'relative inline-flex rounded-full h-3 w-3 transition-colors duration-500',
                        colors[status]
                    )}
                ></span>
            </div>
            <span className={cn('text-[10px] font-bold tracking-widest uppercase', textColors[status])}>
                {label}
            </span>
            {status === 'active' && <Activity className="h-3 w-3 text-emerald-500 animate-pulse ml-auto" />}
        </div>
    );
}
