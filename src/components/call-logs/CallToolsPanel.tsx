import { useState } from 'react';
import { 
  PhoneForwarded, 
  PhoneOff, 
  CalendarPlus, 
  CheckCircle, 
  ClipboardList,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStaffTasks } from '@/hooks/useStaffTasks';
import { useToast } from '@/hooks/use-toast';
import { AICall } from '@/hooks/useAICalls';
import { supabase } from '@/integrations/supabase/client';
import { useClinic } from '@/contexts/ClinicContext';
import { useQueryClient } from '@tanstack/react-query';

interface CallToolsPanelProps {
  call: AICall;
  patientName: string;
  onActionComplete?: () => void;
}

type ActionType = 'transfer' | 'end' | 'followup' | 'resolve' | 'task';

export function CallToolsPanel({ call, patientName, onActionComplete }: CallToolsPanelProps) {
  const { createTask } = useStaffTasks();
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loadingAction, setLoadingAction] = useState<ActionType | null>(null);

  const handleAction = async (action: ActionType) => {
    if (!currentClinic) return;
    
    setLoadingAction(action);
    
    try {
      switch (action) {
        case 'transfer': {
          // Create a task for staff to call back
          await supabase.from('staff_tasks').insert({
            clinic_id: currentClinic.id,
            patient_id: call.patient_id,
            appointment_id: call.appointment_id,
            ai_call_id: call.id,
            title: `Urgent: Take over call for ${patientName}`,
            description: 'AI has transferred this call. Patient requires immediate staff attention.',
            priority: 'urgent',
            ai_generated: true,
          });

          // Update call status
          await supabase
            .from('ai_calls')
            .update({ 
              outcome: 'action_needed',
              escalation_required: true,
              escalation_reason: 'Call transferred to staff by user request',
            })
            .eq('id', call.id);

          // Log analytics event
          await supabase.from('analytics_events').insert({
            clinic_id: currentClinic.id,
            event_type: 'staff_action',
            patient_id: call.patient_id,
            ai_call_id: call.id,
            event_data: { action: 'call_transferred', initiated_by: 'staff' },
          });

          toast({
            title: 'Call Transferred',
            description: 'A staff task has been created for immediate follow-up.',
          });
          break;
        }

        case 'end': {
          // Mark call as completed
          await supabase
            .from('ai_calls')
            .update({ 
              status: 'completed',
              call_ended_at: new Date().toISOString(),
            })
            .eq('id', call.id);

          await supabase.from('analytics_events').insert({
            clinic_id: currentClinic.id,
            event_type: 'call_completed',
            patient_id: call.patient_id,
            ai_call_id: call.id,
            event_data: { action: 'call_ended', initiated_by: 'staff' },
          });

          toast({
            title: 'Call Ended',
            description: 'The call has been marked as completed.',
          });
          break;
        }

        case 'followup': {
          // Schedule a follow-up - requires appointment_id
          if (!call.appointment_id) {
            toast({
              title: 'Cannot Schedule Follow-Up',
              description: 'No appointment is linked to this call.',
              variant: 'destructive',
            });
            return;
          }
          
          const followUpTime = new Date();
          followUpTime.setHours(followUpTime.getHours() + 4);

          await supabase.from('follow_up_schedules').insert({
            clinic_id: currentClinic.id,
            patient_id: call.patient_id,
            appointment_id: call.appointment_id,
            scheduled_for: followUpTime.toISOString(),
            related_call_id: call.id,
            status: 'pending',
          });

          await supabase.from('analytics_events').insert({
            clinic_id: currentClinic.id,
            event_type: 'task_created',
            patient_id: call.patient_id,
            ai_call_id: call.id,
            event_data: { action: 'follow_up_scheduled', scheduled_for: followUpTime.toISOString() },
          });

          toast({
            title: 'Follow-Up Scheduled',
            description: `AI will call back in 4 hours.`,
          });
          break;
        }

        case 'resolve': {
          // Mark as resolved/confirmed
          await supabase
            .from('ai_calls')
            .update({ 
              outcome: 'confirmed',
              escalation_required: false,
              escalation_reason: null,
            })
            .eq('id', call.id);

          // If there's an appointment, confirm it
          if (call.appointment_id) {
            await supabase
              .from('appointments')
              .update({ 
                status: 'confirmed',
                confirmed_at: new Date().toISOString(),
              })
              .eq('id', call.appointment_id);
          }

          await supabase.from('analytics_events').insert({
            clinic_id: currentClinic.id,
            event_type: 'appointment_confirmed',
            patient_id: call.patient_id,
            appointment_id: call.appointment_id,
            ai_call_id: call.id,
            event_data: { action: 'manually_resolved', initiated_by: 'staff' },
          });

          toast({
            title: 'Marked as Resolved',
            description: 'The appointment has been confirmed.',
          });
          break;
        }

        case 'task': {
          // Convert to manual task
          await supabase.from('staff_tasks').insert({
            clinic_id: currentClinic.id,
            patient_id: call.patient_id,
            appointment_id: call.appointment_id,
            ai_call_id: call.id,
            title: `Follow up: ${patientName}`,
            description: call.escalation_reason || 'Manual follow-up required from AI call.',
            priority: 'high',
            ai_generated: true,
          });

          await supabase.from('analytics_events').insert({
            clinic_id: currentClinic.id,
            event_type: 'task_created',
            patient_id: call.patient_id,
            ai_call_id: call.id,
            event_data: { action: 'converted_to_task', initiated_by: 'staff' },
          });

          toast({
            title: 'Task Created',
            description: 'A staff task has been added to your queue.',
          });
          break;
        }
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['ai_calls'] });
      queryClient.invalidateQueries({ queryKey: ['staff_tasks'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['follow_up_schedules'] });

      onActionComplete?.();
    } catch (error) {
      console.error('Error performing call action:', error);
      toast({
        title: 'Error',
        description: 'Failed to perform action. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const ActionButton = ({ 
    action, 
    icon: Icon, 
    label, 
    variant = 'default',
    disabled = false,
  }: { 
    action: ActionType; 
    icon: React.ElementType; 
    label: string;
    variant?: 'default' | 'primary' | 'warning' | 'destructive';
    disabled?: boolean;
  }) => {
    const isLoading = loadingAction === action;
    const isDisabled = disabled || loadingAction !== null;

    const variantStyles = {
      default: 'bg-white/5 hover:bg-white/10 text-foreground',
      primary: 'bg-primary/10 hover:bg-primary/20 text-primary',
      warning: 'bg-warning/10 hover:bg-warning/20 text-warning',
      destructive: 'bg-destructive/10 hover:bg-destructive/20 text-destructive',
    };

    return (
      <button
        onClick={() => handleAction(action)}
        disabled={isDisabled}
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors',
          variantStyles[variant],
          isDisabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Icon className="h-4 w-4" />
        )}
        {label}
      </button>
    );
  };

  const isCallActive = call.status === 'calling' || call.status === 'answered';
  const isEscalated = call.escalation_required;
  const isResolved = call.outcome === 'confirmed';

  return (
    <div className="p-5 border-t border-white/5 bg-white/[0.01]">
      <p className="text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wider">
        Call Actions
      </p>

      {isEscalated && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-warning/10 border border-warning/20">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span className="text-sm text-warning">This call requires attention</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <ActionButton
          action="transfer"
          icon={PhoneForwarded}
          label="Transfer to Staff"
          variant="warning"
          disabled={isResolved}
        />
        <ActionButton
          action="end"
          icon={PhoneOff}
          label="End Call"
          variant="destructive"
          disabled={!isCallActive}
        />
        <ActionButton
          action="followup"
          icon={CalendarPlus}
          label="Schedule Follow-Up"
          disabled={!call.appointment_id || isResolved}
        />
        <ActionButton
          action="resolve"
          icon={CheckCircle}
          label="Mark as Resolved"
          variant="primary"
          disabled={isResolved}
        />
        <ActionButton
          action="task"
          icon={ClipboardList}
          label="Create Staff Task"
        />
      </div>

      {isResolved && (
        <div className="mt-4 flex items-center gap-2 text-sm text-primary">
          <CheckCircle className="h-4 w-4" />
          <span>This call has been resolved</span>
        </div>
      )}
    </div>
  );
}
