import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, RefreshCw, WifiOff, ServerCrash, ShieldAlert } from 'lucide-react';

type ErrorType = 'network' | 'server' | 'permission' | 'validation' | 'generic';

interface ErrorStateProps {
  type?: ErrorType;
  title?: string;
  description?: string;
  icon?: ReactNode;
  onRetry?: () => void;
  className?: string;
}

const errorContent: Record<ErrorType, { icon: ReactNode; title: string; description: string }> = {
  network: {
    icon: <WifiOff className="h-6 w-6" />,
    title: 'Connection Unavailable',
    description: 'Unable to reach the server. Please verify your network connection and try again.',
  },
  server: {
    icon: <ServerCrash className="h-6 w-6" />,
    title: 'Service Temporarily Unavailable',
    description: 'Our systems are experiencing high demand. This is typically resolved within minutes.',
  },
  permission: {
    icon: <ShieldAlert className="h-6 w-6" />,
    title: 'Access Restricted',
    description: 'You do not have permission to view this resource. Contact your administrator if needed.',
  },
  validation: {
    icon: <AlertCircle className="h-6 w-6" />,
    title: 'Invalid Request',
    description: 'The submitted data could not be processed. Please review your input and try again.',
  },
  generic: {
    icon: <AlertCircle className="h-6 w-6" />,
    title: 'Something Went Wrong',
    description: 'An unexpected error occurred. Our team has been notified. Please try again.',
  },
};

export function ErrorState({
  type = 'generic',
  title,
  description,
  icon,
  onRetry,
  className,
}: ErrorStateProps) {
  const content = errorContent[type];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-10 px-6 text-center',
        'rounded-2xl border border-destructive/20 bg-destructive/5',
        className
      )}
    >
      <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4 text-destructive">
        {icon || content.icon}
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">
        {title || content.title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        {description || content.description}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className={cn(
            'mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl',
            'text-sm font-medium text-foreground',
            'bg-white/5 hover:bg-white/10 transition-colors',
            'border border-white/10'
          )}
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      )}
    </div>
  );
}
