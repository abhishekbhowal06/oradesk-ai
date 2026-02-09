import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot, Loader2, Sparkles } from 'lucide-react';
import { AISettings } from '@/contexts/ClinicContext';

interface StepAISetupProps {
  aiSettings: AISettings;
  onSave: (settings: AISettings) => Promise<void>;
  isLoading: boolean;
}

export function StepAISetup({ aiSettings, onSave, isLoading }: StepAISetupProps) {
  const [confirmAutomatically, setConfirmAutomatically] = useState(
    aiSettings.confirmation_calls_enabled ?? true
  );
  const [autoReschedule, setAutoReschedule] = useState(
    aiSettings.auto_reschedule_enabled ?? true
  );
  const [followUpEnabled, setFollowUpEnabled] = useState(
    aiSettings.follow_up_enabled ?? true
  );
  const [escalateWhenUnsure, setEscalateWhenUnsure] = useState(
    aiSettings.escalate_when_unsure ?? true
  );
  const [maxAttempts, setMaxAttempts] = useState(
    String(aiSettings.max_follow_up_attempts || 2)
  );
  const [delayHours, setDelayHours] = useState(
    String(aiSettings.follow_up_delay_hours || 6)
  );

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
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            How should we handle patient calls?
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          You stay in control. You can change this anytime.
        </p>
      </div>

      {/* Toggle Options */}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-xl bg-background/30 border border-white/5">
          <div className="space-y-0.5">
            <Label className="text-foreground font-medium">
              Confirm appointments automatically
            </Label>
            <p className="text-xs text-muted-foreground">
              We'll call patients to confirm their upcoming appointments
            </p>
          </div>
          <Switch
            checked={confirmAutomatically}
            onCheckedChange={setConfirmAutomatically}
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-background/30 border border-white/5">
          <div className="space-y-0.5">
            <Label className="text-foreground font-medium">
              Reschedule if patient is unavailable
            </Label>
            <p className="text-xs text-muted-foreground">
              We'll offer alternative times when patients can't make it
            </p>
          </div>
          <Switch
            checked={autoReschedule}
            onCheckedChange={setAutoReschedule}
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-background/30 border border-white/5">
          <div className="space-y-0.5">
            <Label className="text-foreground font-medium">
              Follow up if patient doesn't respond
            </Label>
            <p className="text-xs text-muted-foreground">
              We'll try again later if we can't reach them
            </p>
          </div>
          <Switch
            checked={followUpEnabled}
            onCheckedChange={setFollowUpEnabled}
          />
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl bg-background/30 border border-white/5">
          <div className="space-y-0.5">
            <Label className="text-foreground font-medium">
              Escalate to staff if unsure
            </Label>
            <p className="text-xs text-muted-foreground">
              Complex requests will be flagged for your team to handle
            </p>
          </div>
          <Switch
            checked={escalateWhenUnsure}
            onCheckedChange={setEscalateWhenUnsure}
          />
        </div>
      </div>

      {/* Follow-up Configuration */}
      {followUpEnabled && (
        <div className="p-4 rounded-xl bg-background/20 border border-white/5 space-y-4">
          <Label className="text-foreground font-medium">Follow-up rules</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Attempts</Label>
              <Select value={maxAttempts} onValueChange={setMaxAttempts}>
                <SelectTrigger className="bg-background/50 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 attempt</SelectItem>
                  <SelectItem value="2">2 attempts</SelectItem>
                  <SelectItem value="3">3 attempts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Time between attempts</Label>
              <Select value={delayHours} onValueChange={setDelayHours}>
                <SelectTrigger className="bg-background/50 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 hours</SelectItem>
                  <SelectItem value="6">6 hours</SelectItem>
                  <SelectItem value="12">12 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Helper Text */}
      <p className="text-sm text-muted-foreground text-center">
        Nothing is final. You can pause anytime from settings.
      </p>

      {/* CTA */}
      <Button
        onClick={handleActivate}
        disabled={isLoading}
        className="btn-gold w-full py-6 text-base"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Activating...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-5 w-5" />
            Activate AI Receptionist
          </>
        )}
      </Button>
    </div>
  );
}
