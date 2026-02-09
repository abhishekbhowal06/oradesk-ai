import { useState, useCallback, Suspense } from 'react';
import { Bot, Phone, Calendar, AlertCircle, Check, Info, Clock, RefreshCw, UserX, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';
import { SystemTooltip } from '@/components/ui/SystemTooltip';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { AIAvatarOrb } from './AIAvatarOrb';
import { AIVoiceTest } from './AIVoiceTest';
import { SystemPromptEditor } from './SystemPromptEditor';
import { AIPersonalitySettings } from './AIPersonalitySettings';

interface AISettings {
  confirmation_calls_enabled: boolean;
  auto_reschedule_enabled: boolean;
  escalate_when_unsure: boolean;
  follow_up_enabled: boolean;
  max_follow_up_attempts: number;
  follow_up_delay_hours: number;
  reminder_hours_before: number;
  call_during_hours_only: boolean;
  stop_after_failures: number;
  auto_escalate_on_failure: boolean;
  // New personality settings
  system_prompt: string;
  ai_voice_id: string;
  ai_language: string;
  ai_tone: string;
  ai_speed: number;
  first_message: string;
}

const FOLLOW_UP_DELAY_OPTIONS = [
  { value: 2, label: '2 hours' },
  { value: 6, label: '6 hours' },
  { value: 12, label: '12 hours' },
  { value: 24, label: '24 hours' },
];

const MAX_ATTEMPTS_OPTIONS = [
  { value: 1, label: '1 attempt' },
  { value: 2, label: '2 attempts' },
  { value: 3, label: '3 attempts' },
];

const REMINDER_TIMING_OPTIONS = [
  { value: 12, label: '12 hours before' },
  { value: 24, label: '24 hours before' },
  { value: 48, label: '48 hours before' },
];

const FAILURE_LIMIT_OPTIONS = [
  { value: 2, label: '2 failed calls' },
  { value: 3, label: '3 failed calls' },
  { value: 5, label: '5 failed calls' },
];

export function AIPracticeSettings() {
  const { currentClinic, updateClinicSettings } = useClinic();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  
  // Voice test state for orb animation
  const [voiceState, setVoiceState] = useState({
    isListening: false,
    isSpeaking: false,
    isConnecting: false,
    audioLevel: 0,
  });

  // Parse AI settings from clinic (with defaults for optional fields)
  const clinicAiSettings = (currentClinic?.ai_settings ?? {}) as Record<string, unknown>;
  const aiSettings: AISettings = {
    confirmation_calls_enabled: (clinicAiSettings.confirmation_calls_enabled as boolean) ?? true,
    auto_reschedule_enabled: (clinicAiSettings?.auto_reschedule_enabled as boolean) ?? true,
    escalate_when_unsure: (clinicAiSettings?.escalate_when_unsure as boolean) ?? true,
    follow_up_enabled: (clinicAiSettings?.follow_up_enabled as boolean) ?? true,
    max_follow_up_attempts: (clinicAiSettings?.max_follow_up_attempts as number) ?? 3,
    follow_up_delay_hours: (clinicAiSettings?.follow_up_delay_hours as number) ?? 4,
    reminder_hours_before: (clinicAiSettings?.reminder_hours_before as number) ?? 24,
    call_during_hours_only: (clinicAiSettings?.call_during_hours_only as boolean) ?? true,
    stop_after_failures: (clinicAiSettings?.stop_after_failures as number) ?? 3,
    auto_escalate_on_failure: (clinicAiSettings?.auto_escalate_on_failure as boolean) ?? true,
    // Personality settings
    system_prompt: (clinicAiSettings?.system_prompt as string) ?? '',
    ai_voice_id: (clinicAiSettings?.ai_voice_id as string) ?? 'EXAVITQu4vr4xnSDxMaL',
    ai_language: (clinicAiSettings?.ai_language as string) ?? 'en',
    ai_tone: (clinicAiSettings?.ai_tone as string) ?? 'professional',
    ai_speed: (clinicAiSettings?.ai_speed as number) ?? 1,
    first_message: (clinicAiSettings?.first_message as string) ?? '',
  };

  const handleSettingChange = useCallback(async (key: keyof AISettings, value: boolean | number | string) => {
    if (!currentClinic) return;

    setIsSaving(true);
    try {
      const updatedSettings = {
        ...(clinicAiSettings || {}),
        [key]: value,
      };

      await updateClinicSettings({ ai_settings: updatedSettings as any });

      toast({
        title: 'Settings Updated',
        description: 'Your AI practice settings have been saved.',
      });
    } catch (error) {
      console.error('Error updating AI settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [currentClinic, clinicAiSettings, updateClinicSettings, toast]);

  const Toggle = ({ 
    enabled, 
    onChange, 
    disabled = false 
  }: { 
    enabled: boolean; 
    onChange: (value: boolean) => void;
    disabled?: boolean;
  }) => (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      className={cn(
        'relative h-6 w-11 rounded-full transition-colors',
        enabled ? 'bg-primary' : 'bg-muted',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      disabled={disabled || isSaving}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
          enabled ? 'left-5' : 'left-0.5'
        )}
      />
    </button>
  );

  const Select = ({
    value,
    options,
    onChange,
    disabled = false,
  }: {
    value: number;
    options: { value: number; label: string }[];
    onChange: (value: number) => void;
    disabled?: boolean;
  }) => (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={cn(
        'bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-foreground',
        'focus:ring-1 focus:ring-primary focus:border-primary',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      disabled={disabled || isSaving}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );

  if (!currentClinic) {
    return null;
  }

  return (
    <div className="space-y-6 stagger-children">
      {/* Hero Section - 3D Orb + Voice Test */}
      <div className="glass-card p-8 overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-8 items-center">
          {/* 3D AI Avatar Orb */}
          <div className="w-full lg:w-1/2 flex justify-center">
            <Suspense fallback={
              <div className="w-64 h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            }>
              <AIAvatarOrb
                isListening={voiceState.isListening}
                isSpeaking={voiceState.isSpeaking}
                isConnecting={voiceState.isConnecting}
                audioLevel={voiceState.audioLevel}
                className="w-64 h-64"
              />
            </Suspense>
          </div>
          
          {/* Voice Test Interface */}
          <div className="w-full lg:w-1/2">
            <div className="text-center lg:text-left mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Meet Your AI Receptionist
              </h2>
              <p className="text-muted-foreground">
                Test how your AI sounds and responds to patients. Click to start a conversation.
              </p>
            </div>
            
            <AIVoiceTest
              clinicId={currentClinic.id}
              onStateChange={setVoiceState}
            />
          </div>
        </div>
      </div>

      {/* AI Personality Settings */}
      <AIPersonalitySettings
        voiceId={aiSettings.ai_voice_id}
        tone={aiSettings.ai_tone}
        language={aiSettings.ai_language}
        speed={aiSettings.ai_speed}
        firstMessage={aiSettings.first_message}
        onVoiceChange={(v) => handleSettingChange('ai_voice_id', v)}
        onToneChange={(v) => handleSettingChange('ai_tone', v)}
        onLanguageChange={(v) => handleSettingChange('ai_language', v)}
        onSpeedChange={(v) => handleSettingChange('ai_speed', v)}
        onFirstMessageChange={(v) => handleSettingChange('first_message', v)}
        disabled={isSaving}
      />

      {/* System Prompt Editor */}
      <SystemPromptEditor
        value={aiSettings.system_prompt}
        onChange={(v) => handleSettingChange('system_prompt', v)}
        disabled={isSaving}
      />

      {/* Existing Settings Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appointment Handling */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Appointment Handling</h3>
              <p className="text-xs text-muted-foreground">How the AI manages appointments</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Confirm appointments automatically</span>
                <SystemTooltip content="AI will call patients to confirm their upcoming appointments">
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </SystemTooltip>
              </div>
              <Toggle
                enabled={aiSettings.confirmation_calls_enabled}
                onChange={(v) => handleSettingChange('confirmation_calls_enabled', v)}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Reschedule if patient unavailable</span>
                <SystemTooltip content="AI will offer alternative times if patient cannot make their appointment">
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </SystemTooltip>
              </div>
              <Toggle
                enabled={aiSettings.auto_reschedule_enabled}
                onChange={(v) => handleSettingChange('auto_reschedule_enabled', v)}
              />
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Escalate to staff if unsure</span>
                <SystemTooltip content="AI will create a task for staff when it cannot resolve the situation">
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </SystemTooltip>
              </div>
              <Toggle
                enabled={aiSettings.escalate_when_unsure}
                onChange={(v) => handleSettingChange('escalate_when_unsure', v)}
              />
            </div>
          </div>

          {!aiSettings.escalate_when_unsure && (
            <WarningBanner
              type="warning"
              title="Escalation Disabled"
              description="The AI will not alert staff when it encounters situations it cannot handle."
              className="mt-4"
            />
          )}
        </div>

        {/* Follow-Up Rules */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Follow-Up Rules</h3>
              <p className="text-xs text-muted-foreground">How the AI handles unanswered calls</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <span className="text-sm text-muted-foreground">Follow up if no response</span>
              <Toggle
                enabled={aiSettings.follow_up_enabled}
                onChange={(v) => handleSettingChange('follow_up_enabled', v)}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <span className="text-sm text-muted-foreground">Maximum follow-up attempts</span>
              <Select
                value={aiSettings.max_follow_up_attempts}
                options={MAX_ATTEMPTS_OPTIONS}
                onChange={(v) => handleSettingChange('max_follow_up_attempts', v)}
                disabled={!aiSettings.follow_up_enabled}
              />
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-muted-foreground">Delay between attempts</span>
              <Select
                value={aiSettings.follow_up_delay_hours}
                options={FOLLOW_UP_DELAY_OPTIONS}
                onChange={(v) => handleSettingChange('follow_up_delay_hours', v)}
                disabled={!aiSettings.follow_up_enabled}
              />
            </div>
          </div>

          {aiSettings.follow_up_enabled && (
            <div className="mt-4 p-3 rounded-xl bg-info/5 border border-info/20">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-info" />
                <span className="text-sm text-info font-medium">Follow-ups Active</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                AI will try up to {aiSettings.max_follow_up_attempts} times, waiting{' '}
                {aiSettings.follow_up_delay_hours} hours between each attempt.
              </p>
            </div>
          )}
        </div>

        {/* Call Behavior */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Call Behavior</h3>
              <p className="text-xs text-muted-foreground">When and how calls are made</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <span className="text-sm text-muted-foreground">Reminder timing</span>
              <Select
                value={aiSettings.reminder_hours_before}
                options={REMINDER_TIMING_OPTIONS}
                onChange={(v) => handleSettingChange('reminder_hours_before', v)}
                disabled={!aiSettings.confirmation_calls_enabled}
              />
            </div>

            <div className="flex items-center justify-between py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Call during working hours only</span>
                <SystemTooltip content="Calls will only be made during your clinic's operating hours">
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </SystemTooltip>
              </div>
              <Toggle
                enabled={aiSettings.call_during_hours_only}
                onChange={(v) => handleSettingChange('call_during_hours_only', v)}
              />
            </div>

            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-muted-foreground">Stop calling after</span>
              <Select
                value={aiSettings.stop_after_failures}
                options={FAILURE_LIMIT_OPTIONS}
                onChange={(v) => handleSettingChange('stop_after_failures', v)}
              />
            </div>
          </div>
        </div>

        {/* Escalation Rules */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <UserX className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Escalation Rules</h3>
              <p className="text-xs text-muted-foreground">When to involve staff</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Auto-escalate on repeated failures</span>
                <SystemTooltip content="Automatically create a staff task when call attempts are exhausted">
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </SystemTooltip>
              </div>
              <Toggle
                enabled={aiSettings.auto_escalate_on_failure}
                onChange={(v) => handleSettingChange('auto_escalate_on_failure', v)}
              />
            </div>
          </div>

          {aiSettings.auto_escalate_on_failure && (
            <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-primary" />
                <span className="text-sm text-primary font-medium">Staff Escalation Active</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                After {aiSettings.stop_after_failures} failed calls, a task will be created for manual follow-up.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* System Status */}
      {!aiSettings.confirmation_calls_enabled && (
        <WarningBanner
          type="critical"
          title="AI Calling Disabled"
          description="No automated calls are being made. Patients will not receive appointment confirmations or reminders."
          className="mt-2"
        />
      )}
    </div>
  );
}
