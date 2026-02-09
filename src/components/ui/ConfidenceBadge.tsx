import { cn } from '@/lib/utils';
import { SystemTooltip } from './SystemTooltip';

interface ConfidenceBadgeProps {
  score: number;
  reasoning?: string;
  className?: string;
}

export function ConfidenceBadge({ score, reasoning, className }: ConfidenceBadgeProps) {
  const getLevel = () => {
    if (score >= 90) return { label: 'High', color: 'text-success bg-success/10 border-success/30' };
    if (score >= 70) return { label: 'Medium', color: 'text-primary bg-primary/10 border-primary/30' };
    return { label: 'Low', color: 'text-destructive bg-destructive/10 border-destructive/30' };
  };

  const level = getLevel();

  const badge = (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
        level.color,
        className
      )}
    >
      <span className="tabular-nums">{score}%</span>
      <span className="opacity-70">confidence</span>
    </div>
  );

  if (reasoning) {
    return (
      <SystemTooltip content={reasoning}>
        {badge}
      </SystemTooltip>
    );
  }

  return badge;
}
