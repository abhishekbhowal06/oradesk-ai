import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';

interface DisabledOverlayProps {
  children: ReactNode;
  disabled: boolean;
  reason?: string;
  className?: string;
}

export function DisabledOverlay({ children, disabled, reason, className }: DisabledOverlayProps) {
  if (!disabled) {
    return <>{children}</>;
  }

  return (
    <div className={cn('relative', className)}>
      <div className="opacity-40 pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        {reason && (
          <div
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl',
              'bg-background/90 backdrop-blur-sm',
              'border border-white/10 shadow-lg',
              'text-sm text-muted-foreground',
            )}
          >
            <Info className="h-4 w-4 text-primary" />
            <span>{reason}</span>
          </div>
        )}
      </div>
    </div>
  );
}
