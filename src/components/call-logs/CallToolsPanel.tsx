import { useState } from 'react';
import {
  PhoneForwarded,
  PhoneOff,
  CalendarPlus,
  CheckCircle,
  ClipboardList,
  Loader2,
  AlertTriangle,
  Zap,
  Target,
  ShieldCheck,
  Activity,
  Cpu
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
  className?: string;
}

type ActionType = 'transfer' | 'end' | 'followup' | 'resolve' | 'task' | 'redeploy';

export function CallToolsPanel({ call, patientName, onActionComplete, className }: CallToolsPanelProps) {
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
          await supabase.from('staff_tasks').insert({
            clinic_id: currentClinic.id,
            patient_id: call.patient_id,
            appointment_id: call.appointment_id,
            ai_call_id: call.id,
            title: `Protocol Override: ${patientName}`,
            description: 'AI manual transfer. Subject requires human interface.',
            priority: 'urgent',
            ai_generated: true,
          });

          await supabase.from('ai_calls').update({
            outcome: 'action_needed',
            escalation_required: true,
            escalation_reason: 'PROTOCOL_OVERRIDE_BY_STAFF',
          }).eq('id', call.id);

          toast({ title: 'Uplink Transferred', description: 'Manual intervention task created.' });
          break;
        }

        case 'resolve': {
          await supabase.from('ai_calls').update({
            outcome: 'confirmed',
            escalation_required: false,
            escalation_reason: null,
          }).eq('id', call.id);

          if (call.appointment_id) {
            await supabase.from('appointments').update({
              status: 'confirmed',
              confirmed_at: new Date().toISOString(),
            }).eq('id', call.appointment_id);
          }

          toast({ title: 'Core Resolved', description: 'Appointment state: CONFIRMED' });
          break;
        }

        // Additional actions as needed
      }

      queryClient.invalidateQueries({ queryKey: ['ai_calls'] });
      queryClient.invalidateQueries({ queryKey: ['staff_tasks'] });
      onActionComplete?.();
    } catch (error) {
      console.error(error);
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

    return (
      <button
        onClick={() => handleAction(action)}
        disabled={isDisabled}
        className={cn(
          'flex flex-col items-center justify-center p-4 border transition-all duration-300 group relative overflow-hidden',
          variant === 'primary' ? 'bg-primary/5 border-primary/20 text-primary hover:bg-primary/10' :
            variant === 'warning' ? 'bg-warning/5 border-warning/20 text-warning hover:bg-warning/10' :
              variant === 'destructive' ? 'bg-destructive/5 border-destructive/20 text-destructive hover:bg-destructive/10' :
                'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-white',
          isDisabled && 'opacity-30 grayscale cursor-not-allowed',
        )}
      >
        <div className="relative z-10 flex flex-col items-center gap-2">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5 transition-transform group-hover:scale-110" />}
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em]">{label}</span>
        </div>

        {/* Corner Accents */}
        <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-current opacity-20" />
        <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-current opacity-20" />

        {/* Hover Bar */}
        <div className="absolute bottom-0 left-0 h-[2px] w-full bg-current scale-x-0 group-hover:scale-x-100 transition-transform origin-left opacity-30" />
      </button>
    );
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-mono font-bold text-white uppercase tracking-widest">Override Matrix</span>
        </div>
        <div className="h-px flex-1 bg-white/5 mx-4" />
        <span className="text-[9px] font-mono text-muted-foreground uppercase opacity-40">System_Override v1.2</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <ActionButton
          action="resolve"
          icon={ShieldCheck}
          label="Resolve_Core"
          variant="primary"
          disabled={call.outcome === 'confirmed'}
        />
        <ActionButton
          action="transfer"
          icon={PhoneForwarded}
          label="Manual_Link"
          variant="warning"
          disabled={call.outcome === 'confirmed'}
        />
        <ActionButton
          action="followup"
          icon={CalendarPlus}
          label="Queue_Retry"
          disabled={!call.appointment_id || call.outcome === 'confirmed'}
        />
        <ActionButton
          action="task"
          icon={ClipboardList}
          label="Log_Staff_Task"
        />
        <ActionButton
          action="end"
          icon={PhoneOff}
          label="Kill_Signal"
          variant="destructive"
          disabled={!(call.status === 'calling' || call.status === 'answered')}
        />
      </div>

      {call.outcome === 'confirmed' && (
        <div className="flex items-center gap-3 px-4 py-2 bg-emerald-500/5 border border-emerald-500/20">
          <ShieldCheck className="h-3 w-3 text-emerald-500" />
          <span className="text-[9px] font-mono font-bold text-emerald-500 uppercase tracking-widest">State Permanence: CONFIRMED_AND_LOCKED</span>
        </div>
      )}
    </div>
  );
}
