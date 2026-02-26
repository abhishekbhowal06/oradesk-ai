import { cn } from '@/lib/utils';
import type { CallStatus } from '@/hooks/useAICalls';

interface LiveStatusBadgeProps {
  status: CallStatus;
  className?: string;
}

const STATUS_CONFIG: Record<CallStatus, { label: string; color: string; animate: boolean }> = {
  queued: { label: 'QUEUED', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20', animate: false },
  calling: { label: 'RINGING', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', animate: true },
  answered: { label: 'LIVE LINK', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', animate: false },
  voicemail: { label: 'V-MAIL', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', animate: false },
  no_answer: { label: 'NO SIGNAL', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20', animate: false },
  failed: { label: 'FAULT', color: 'text-destructive bg-destructive/10 border-destructive/20', animate: false },
  completed: { label: 'ARCHIVED', color: 'text-muted-foreground bg-white/5 border-white/10', animate: false },
};

export function LiveStatusBadge({ status, className }: LiveStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.queued;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-mono font-bold tracking-widest relative uppercase',
        config.color,
        className,
      )}
    >
      {/* Pulse ring for ringing/calling state */}
      {config.animate && (
        <span className="absolute inset-x-0 inset-y-0 border border-primary animate-ping opacity-25" />
      )}

      {/* Status dot */}
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-none rotate-45',
          status === 'calling' && 'bg-amber-400 animate-pulse',
          status === 'answered' && 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]',
          status === 'completed' && 'bg-muted-foreground',
          status === 'failed' && 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]',
          status === 'no_answer' && 'bg-rose-400',
          status === 'queued' && 'bg-slate-400',
          status === 'voicemail' && 'bg-orange-400',
        )}
      />

      {config.label}
    </span>
  );
}
