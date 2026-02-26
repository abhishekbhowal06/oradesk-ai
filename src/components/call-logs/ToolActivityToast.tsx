import { Bot, Loader2, Cpu, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToolActivityToastProps {
  /** The AI reasoning text (may contain tool info) */
  aiReasoning: string | null;
  /** The call status — only show for active calls */
  isActive: boolean;
  className?: string;
}

const TOOL_LABELS: Record<string, string> = {
  checkAvailability: 'GET_AVAILABILITY',
  bookAppointment: 'POST_BOOKING',
  escalateToHuman: 'PUSH_ESCALATION',
  check_availability: 'GET_AVAILABILITY',
  book_appointment: 'POST_BOOKING',
  escalate: 'PUSH_ESCALATION',
};

/**
 * Inline tool activity indicator shown in expanded call cards.
 * Displays terminal style tool execution logs.
 */
export function ToolActivityToast({ aiReasoning, isActive, className }: ToolActivityToastProps) {
  if (!aiReasoning && !isActive) return null;

  // Extract tool name from AI reasoning text
  const detectedTool = aiReasoning
    ? Object.keys(TOOL_LABELS).find((tool) =>
      aiReasoning.toLowerCase().includes(tool.toLowerCase()),
    )
    : null;

  if (!detectedTool && !isActive) return null;

  const toolLabel = detectedTool ? TOOL_LABELS[detectedTool] : null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 border',
        'bg-primary/5 border-primary/20',
        'text-[10px] font-mono font-bold text-primary animate-fade-up uppercase tracking-widest',
        className,
      )}
    >
      {isActive ? (
        <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
      ) : (
        <Wrench className="h-3 w-3 flex-shrink-0" />
      )}

      <span>
        {isActive && toolLabel ? (
          <>
            EXECUTING::{toolLabel}...
          </>
        ) : toolLabel ? (
          <>
            STATUS::SUCCESS::{toolLabel}
          </>
        ) : (
          <>NEURAL_CORE::PROCESSING</>
        )}
      </span>

      {isActive && (
        <div className="ml-auto flex gap-1">
          <span className="h-1 w-1 bg-primary animate-pulse" />
          <span className="h-1 w-1 bg-primary animate-pulse delay-75" />
          <span className="h-1 w-1 bg-primary animate-pulse delay-150" />
        </div>
      )}
    </div>
  );
}
