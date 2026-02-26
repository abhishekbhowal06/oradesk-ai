import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bot, Loader2, Sparkles, Cpu, Zap, ShieldAlert, Target, ArrowRight } from 'lucide-react';
import { AISettings } from '@/contexts/ClinicContext';
import { cn } from '@/lib/utils';

interface StepAISetupProps {
  aiSettings: AISettings;
  onSave: (settings: AISettings) => Promise<void>;
  isLoading: boolean;
}

export function StepAISetup({ aiSettings, onSave, isLoading }: StepAISetupProps) {
  const [confirmAutomatically, setConfirmAutomatically] = useState(
    aiSettings.confirmation_calls_enabled ?? true,
  );
  const [autoReschedule, setAutoReschedule] = useState(aiSettings.auto_reschedule_enabled ?? true);
  const [followUpEnabled, setFollowUpEnabled] = useState(aiSettings.follow_up_enabled ?? true);
  const [escalateWhenUnsure, setEscalateWhenUnsure] = useState(
    aiSettings.escalate_when_unsure ?? true,
  );
  const [maxAttempts, setMaxAttempts] = useState(String(aiSettings.max_follow_up_attempts || 2));
  const [delayHours, setDelayHours] = useState(String(aiSettings.follow_up_delay_hours || 6));

  const handleActivate = async () => {
    const newSettings: AISettings = {
      ...aiSettings,
      confirmation_calls_enabled: confirmAutomatically,
      auto_reschedule_enabled: autoReschedule,
      follow_up_enabled: followUpEnabled,
      escalate_when_unsure: escalateWhenUnsure,
      max_follow_up_attempts: parseInt(maxAttempts, 10),
      follow_up_delay_hours: parseInt(delayHours, 10),
    };
    await onSave(newSettings);
  };

  return (
    <div className="space-y-10">
      {/* Module Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-1 px-2 border border-primary/30 bg-primary/10">
            <Cpu className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-white uppercase italic tracking-tight">Neural Core Calibration</h2>
        </div>
        <p className="text-[11px] font-mono text-muted-foreground uppercase leading-relaxed max-w-md">
          Configure autonomous decision matrices. These parameters define the logic gates for the AI Receptionist.
        </p>
      </div>

      {/* Logic Gates Suite */}
      <div className="grid grid-cols-1 gap-4">
        {[
          {
            label: 'CONFIRM_AUTO_DISPATCH',
            desc: 'Execute autonomous outbound confirmation sequences.',
            state: confirmAutomatically,
            setter: setConfirmAutomatically,
            icon: Zap
          },
          {
            label: 'AUTO_TIMELINE_RECOVERY',
            desc: 'Recalibrate appointments if subject is non-compliant.',
            state: autoReschedule,
            setter: setAutoReschedule,
            icon: Target
          },
          {
            label: 'PERSISTENT_RETRY_LOOP',
            desc: 'Re-engage if initial transmission fails to authenticate.',
            state: followUpEnabled,
            setter: setFollowUpEnabled,
            icon: Cpu
          },
          {
            label: 'HUMAN_OVERRRIDE_PROTOCOL',
            desc: 'Escalate complex neural outputs to manual staff review.',
            state: escalateWhenUnsure,
            setter: setEscalateWhenUnsure,
            icon: ShieldAlert
          }
        ].map((gate, i) => (
          <div key={i} className={cn(
            "group relative overflow-hidden bg-black/40 border p-5 transition-all",
            gate.state ? "border-primary/30" : "border-white/5"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "h-8 w-8 flex items-center justify-center border",
                  gate.state ? "border-primary/20 bg-primary/5 text-primary" : "border-white/5 bg-white/5 text-muted-foreground opacity-30"
                )}>
                  {typeof gate.icon === 'function' ? <gate.icon className="h-4 w-4" /> : <gate.icon className="h-4 w-4" />}
                </div>
                <div className="flex flex-col">
                  <Label className="text-[11px] font-mono font-bold text-white uppercase tracking-widest">{gate.label}</Label>
                  <p className="text-[9px] font-mono text-muted-foreground uppercase opacity-60 mt-0.5">{gate.desc}</p>
                </div>
              </div>
              <Switch checked={gate.state} onCheckedChange={gate.setter} className="data-[state=checked]:bg-primary" />
            </div>
            <div className={cn(
              "absolute bottom-0 left-0 h-[2px] w-full transition-transform origin-left",
              gate.state ? "bg-primary/40 scale-x-100" : "bg-white/5 scale-x-0"
            )} />
          </div>
        ))}
      </div>

      {/* Persistence Parameters */}
      {followUpEnabled && (
        <div className="bg-[#051a1e] border border-white/10 p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-1 w-4 bg-primary" />
            <Label className="text-[10px] font-mono font-bold text-white uppercase tracking-widest">Persistence Config</Label>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label className="text-[9px] font-mono font-bold text-muted-foreground uppercase opacity-50">RETRY_THRESHOLD</Label>
              <Select value={maxAttempts} onValueChange={setMaxAttempts}>
                <SelectTrigger className="rounded-none bg-black/40 border-white/10 font-mono text-xs uppercase h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none border-white/10 bg-[#051a1e]">
                  <SelectItem value="1" className="font-mono text-xs uppercase">01 CYCLE</SelectItem>
                  <SelectItem value="2" className="font-mono text-xs uppercase">02 CYCLES</SelectItem>
                  <SelectItem value="3" className="font-mono text-xs uppercase">03 CYCLES</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-[9px] font-mono font-bold text-muted-foreground uppercase opacity-50">COOL_DOWN_INDEX</Label>
              <Select value={delayHours} onValueChange={setDelayHours}>
                <SelectTrigger className="rounded-none bg-black/40 border-white/10 font-mono text-xs uppercase h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-none border-white/10 bg-[#051a1e]">
                  <SelectItem value="2" className="font-mono text-xs uppercase">02 HOURS</SelectItem>
                  <SelectItem value="6" className="font-mono text-xs uppercase">06 HOURS</SelectItem>
                  <SelectItem value="12" className="font-mono text-xs uppercase">12 HOURS</SelectItem>
                  <SelectItem value="24" className="font-mono text-xs uppercase">24 HOURS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Safety Net Disclaimer */}
      <div className="flex items-center gap-3 justify-center opacity-40">
        <ShieldAlert className="h-3 w-3 text-warning" />
        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
          OPERATIONAL_OVERRIDE_AVAILABLE_POST_DEPLOYMENT
        </p>
      </div>

      {/* Deployment Action */}
      <Button
        onClick={handleActivate}
        disabled={isLoading}
        className="btn-gold w-full h-16 group relative overflow-hidden"
      >
        {isLoading ? (
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-xs font-mono font-bold uppercase tracking-widest">Activating Neural Core...</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5" />
            <span className="text-xs font-mono font-bold uppercase tracking-widest">Ignite Autonomous Receptionist</span>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-2" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </Button>
    </div>
  );
}
