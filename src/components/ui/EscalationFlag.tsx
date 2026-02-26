import { cn } from '@/lib/utils';
import { AlertTriangle, UserPlus } from 'lucide-react';
import { SystemTooltip } from './SystemTooltip';

interface EscalationFlagProps {
  reason: string;
  onConvertToTask?: () => void;
  isConverted?: boolean;
  assignedTo?: string;
  className?: string;
}

export function EscalationFlag({
  reason,
  onConvertToTask,
  isConverted,
  assignedTo,
  className,
}: EscalationFlagProps) {
  if (isConverted) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-xl',
          'bg-info/10 border border-info/20',
          className,
        )}
      >
        <UserPlus className="h-4 w-4 text-info" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-info">Assigned to Staff</p>
          <p className="text-xs text-muted-foreground truncate">{assignedTo || 'Front Desk'}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-destructive/20 bg-destructive/5 overflow-hidden',
        className,
      )}
    >
      <div className="flex items-start gap-3 p-3">
        <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-destructive">Escalation Required</p>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{reason}</p>
        </div>
      </div>
      {onConvertToTask && (
        <button
          onClick={onConvertToTask}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-2.5 px-3',
            'text-xs font-medium text-foreground',
            'bg-white/[0.03] hover:bg-white/[0.06] transition-colors',
            'border-t border-white/5',
          )}
        >
          <UserPlus className="h-3.5 w-3.5" />
          Convert to Staff Task
        </button>
      )}
    </div>
  );
}
