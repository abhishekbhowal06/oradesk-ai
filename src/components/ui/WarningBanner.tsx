import { cn } from '@/lib/utils';
import { AlertTriangle, X, Info } from 'lucide-react';

interface WarningBannerProps {
  type?: 'warning' | 'info' | 'critical';
  title: string;
  description?: string;
  onDismiss?: () => void;
  className?: string;
}

export function WarningBanner({
  type = 'warning',
  title,
  description,
  onDismiss,
  className,
}: WarningBannerProps) {
  const styles = {
    warning: {
      bg: 'bg-warning/10 border-warning/30',
      icon: <AlertTriangle className="h-5 w-5 text-warning" />,
      text: 'text-warning',
    },
    info: {
      bg: 'bg-info/10 border-info/30',
      icon: <Info className="h-5 w-5 text-info" />,
      text: 'text-info',
    },
    critical: {
      bg: 'bg-destructive/10 border-destructive/30',
      icon: <AlertTriangle className="h-5 w-5 text-destructive" />,
      text: 'text-destructive',
    },
  };

  const style = styles[type];

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl border',
        style.bg,
        className
      )}
    >
      <div className="flex-shrink-0 mt-0.5">{style.icon}</div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', style.text)}>{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-white/5 transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
