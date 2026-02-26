import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';

interface SystemTooltipProps {
  children: ReactNode;
  content: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function SystemTooltip({ children, content, side = 'top', className }: SystemTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          className={cn(
            'absolute z-50 px-3 py-2 rounded-xl',
            'bg-popover border border-white/10 shadow-xl',
            'text-sm text-foreground whitespace-nowrap',
            'animate-fade-up',
            positionClasses[side],
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}
