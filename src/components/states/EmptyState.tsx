import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Inbox, Calendar, Phone, Users, BarChart3, Settings, ClipboardList } from 'lucide-react';

type EmptyStateType =
  | 'calls'
  | 'appointments'
  | 'patients'
  | 'analytics'
  | 'settings'
  | 'tasks'
  | 'generic';

interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const defaultContent: Record<
  EmptyStateType,
  { icon: ReactNode; title: string; description: string }
> = {
  calls: {
    icon: <Phone className="h-8 w-8 text-muted-foreground" />,
    title: 'No Calls Yet',
    description: 'Patient call activity will appear here as your practice handles appointments.',
  },
  appointments: {
    icon: <Calendar className="h-8 w-8 text-muted-foreground" />,
    title: "You're All Clear",
    description: 'No appointments scheduled for this time. Available slots are ready for booking.',
  },
  patients: {
    icon: <Users className="h-8 w-8 text-muted-foreground" />,
    title: 'No Patients Found',
    description: 'Try adjusting your search or filters to find patient records.',
  },
  analytics: {
    icon: <BarChart3 className="h-8 w-8 text-muted-foreground" />,
    title: 'Building Your Insights',
    description: 'Analytics will appear after a few days of practice activity.',
  },
  settings: {
    icon: <Settings className="h-8 w-8 text-muted-foreground" />,
    title: 'Setup Needed',
    description: 'Complete your practice settings to unlock all features.',
  },
  tasks: {
    icon: <ClipboardList className="h-8 w-8 text-muted-foreground" />,
    title: "You're All Caught Up",
    description: 'Nice work! No pending tasks right now.',
  },
  generic: {
    icon: <Inbox className="h-8 w-8 text-muted-foreground" />,
    title: 'Nothing Here Yet',
    description: 'Data will appear as your practice activity grows.',
  },
};

export function EmptyState({
  type = 'generic',
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  const defaults = defaultContent[type];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-6 text-center',
        'rounded-2xl border border-dashed border-border bg-black/[0.02]',
        className,
      )}
    >
      <div className="h-16 w-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4 text-primary">
        {icon || defaults.icon}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title || defaults.title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        {description || defaults.description}
      </p>
      {action && (
        <button onClick={action.onClick} className="mt-6 btn-gold text-sm">
          {action.label}
        </button>
      )}
    </div>
  );
}
