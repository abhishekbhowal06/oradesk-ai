import { useState, useCallback, Suspense } from 'react';
import {
  Bot,
  Phone,
  Calendar,
  AlertCircle,
  Check,
  Info,
  Clock,
  RefreshCw,
  UserX,
  Loader2,
  Cpu,
  Zap,
  ShieldCheck,
  Activity,
  Target,
  ShieldAlert,
  EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';
import { SystemTooltip } from '@/components/ui/SystemTooltip';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { AIAvatarOrb } from './AIAvatarOrb';
import { AIVoiceTest } from './AIVoiceTest';
import { SystemPromptEditor } from './SystemPromptEditor';
import { AIPersonalitySettings } from './AIPersonalitySettings';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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
  pii_redaction_enabled?: boolean;
  // New personality settings
  system_prompt: string;
  ai_voice_id: string;
  ai_language: string;
  ai_tone: string;
  ai_speed: number;
  first_message: string;
}

const FOLLOW_UP_DELAY_OPTIONS = [
  { value: 2, label: '02_HOURS' },
  { value: 6, label: '06_HOURS' },
  { value: 12, label: '12_HOURS' },
  { value: 24, label: '24_HOURS' },
];

const MAX_ATTEMPTS_OPTIONS = [
  { value: 1, label: '01_CYCLE' },
  { value: 2, label: '02_CYCLES' },
  { value: 3, label: '03_CYCLES' },
];

const REMINDER_TIMING_OPTIONS = [
  { value: 12, label: 'T-12h' },
  { value: 24, label: 'T-24h' },
  { value: 48, label: 'T-48h' },
];

const FAILURE_LIMIT_OPTIONS = [
  { value: 2, label: '02_FAULTS' },
  { value: 3, label: '03_FAULTS' },
  { value: 5, label: '05_FAULTS' },
];

export function AIPracticeSettings() {
  const { currentClinic, updateClinicSettings } = useClinic();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [voiceState, setVoiceState] = useState({
    isListening: false,
    isSpeaking: false,
    isConnecting: false,
    audioLevel: 0,
  });

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
    pii_redaction_enabled: (clinicAiSettings?.pii_redaction_enabled as boolean) ?? true,
    system_prompt: (clinicAiSettings?.system_prompt as string) ?? '',
    ai_voice_id: (clinicAiSettings?.ai_voice_id as string) ?? 'EXAVITQu4vr4xnSDxMaL',
    ai_language: (clinicAiSettings?.ai_language as string) ?? 'en',
    ai_tone: (clinicAiSettings?.ai_tone as string) ?? 'professional',
    ai_speed: (clinicAiSettings?.ai_speed as number) ?? 1,
    first_message: (clinicAiSettings?.first_message as string) ?? '',
  };

  const handleSettingChange = useCallback(
    async (key: keyof AISettings, value: boolean | number | string) => {
      if (!currentClinic) return;
      setIsSaving(true);
      try {
        const updatedSettings = {
          ...(clinicAiSettings || {}),
          [key]: value,
        };
        await updateClinicSettings({ ai_settings: updatedSettings as any });
        toast({ title: 'Logic Gate Sync', description: `${key.toUpperCase().replace(/_/g, ' ')} updated.` });
      } catch (error) {
        toast({ title: 'Sync Error', variant: 'destructive' });
      } finally { setIsSaving(false); }
    },
    [currentClinic, clinicAiSettings, updateClinicSettings, toast],
  );

  const SectionHeader = ({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) => (
    <div className="flex items-center gap-4 mb-8">
      <div className="h-10 w-10 border border-primary/20 bg-primary/5 flex items-center justify-center text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex flex-col">
        <h3 className="text-xs font-mono font-bold text-white uppercase tracking-[0.2em]">{title}</h3>
        <p className="text-[9px] font-mono text-muted-foreground uppercase opacity-60 tracking-wider">{desc}</p>
      </div>
    </div>
  );

  if (!currentClinic) return null;

  return (
    <div className="space-y-10">

      {/* Neural Interface Hero */}
      <div className="bg-black/40 border border-white/10 p-10 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-4 opacity-10 flex gap-1">
          <div className="h-1 w-8 bg-primary" />
          <div className="h-1 w-4 bg-primary" />
          <div className="h-1 w-12 bg-primary" />
        </div>

        <div className="flex flex-col lg:flex-row gap-12 items-center">
          <div className="relative">
            <Suspense fallback={<div className="w-48 h-48 border border-white/5 animate-pulse" />}>
              <AIAvatarOrb
                isListening={voiceState.isListening}
                isSpeaking={voiceState.isSpeaking}
                isConnecting={voiceState.isConnecting}
                audioLevel={voiceState.audioLevel}
                className="w-64 h-64"
              />
            </Suspense>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20">
              <div className="w-80 h-80 border border-primary/10 rounded-full animate-ping duration-[3000ms]" />
            </div>
          </div>

          <div className="flex-1 space-y-6 text-center lg:text-left">
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Core_Handshake_v4.2</h2>
              <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest leading-relaxed max-w-md">
                Direct downlink with the Neural Engine. Initialize voice calibration and response diagnostics below.
              </p>
            </div>
            <AIVoiceTest clinicId={currentClinic.id} onStateChange={setVoiceState} />
          </div>
        </div>
      </div>

      {/* Logic Gate Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Appointment Handling */}
        <div className="bg-[#051a1e] border border-white/10 p-8 hover:border-primary/20 transition-colors">
          <SectionHeader icon={Calendar} title="Temporal Management" desc="Primary Appointment Logic" />

          <div className="space-y-6">
            {[
              { key: 'confirmation_calls_enabled', label: 'AUTO_RECAP_DISPATCH', value: aiSettings.confirmation_calls_enabled },
              { key: 'auto_reschedule_enabled', label: 'TIMELINE_AUTO_FIX', value: aiSettings.auto_reschedule_enabled },
              { key: 'escalate_when_unsure', label: 'STAFF_UPLINK_ON_FAULT', value: aiSettings.escalate_when_unsure }
            ].map((gate) => (
              <div key={gate.key} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 group">
                <span className="text-[10px] font-mono font-bold text-white uppercase tracking-widest">{gate.label}</span>
                <Switch
                  checked={gate.value}
                  onCheckedChange={(v) => handleSettingChange(gate.key as any, v)}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Follow-Up Rules */}
        <div className="bg-[#051a1e] border border-white/10 p-8 hover:border-primary/20 transition-colors">
          <SectionHeader icon={RefreshCw} title="Persistence Loop" desc="Outbound Retry Parameters" />

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5">
              <span className="text-[10px] font-mono font-bold text-white uppercase tracking-widest">ENABLED</span>
              <Switch
                checked={aiSettings.follow_up_enabled}
                onCheckedChange={(v) => handleSettingChange('follow_up_enabled', v)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-black/20 border border-white/5 space-y-3">
                <Label className="text-[9px] font-mono font-bold text-muted-foreground uppercase opacity-40">RETRY_INDEX</Label>
                <select
                  value={aiSettings.max_follow_up_attempts}
                  disabled={!aiSettings.follow_up_enabled}
                  onChange={(e) => handleSettingChange('max_follow_up_attempts', Number(e.target.value))}
                  className="w-full bg-transparent border-none text-[11px] font-mono text-white outline-none"
                >
                  {MAX_ATTEMPTS_OPTIONS.map(opt => <option key={opt.value} value={opt.value} className="bg-[#051a1e]">{opt.label}</option>)}
                </select>
              </div>
              <div className="p-4 bg-black/20 border border-white/5 space-y-3">
                <Label className="text-[9px] font-mono font-bold text-muted-foreground uppercase opacity-40">COOLDOWN</Label>
                <select
                  value={aiSettings.follow_up_delay_hours}
                  disabled={!aiSettings.follow_up_enabled}
                  onChange={(e) => handleSettingChange('follow_up_delay_hours', Number(e.target.value))}
                  className="w-full bg-transparent border-none text-[11px] font-mono text-white outline-none"
                >
                  {FOLLOW_UP_DELAY_OPTIONS.map(opt => <option key={opt.value} value={opt.value} className="bg-[#051a1e]">{opt.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Personality Matrix */}
        <div className="md:col-span-2">
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
        </div>

        {/* Privacy & Compliance (Phase 15) */}
        <div className="bg-[#051a1e] border border-white/10 p-8 hover:border-emerald-500/20 transition-colors">
          <SectionHeader icon={EyeOff} title="Data Sequestration" desc="Compliance & PII Reduction" />

          <div className="space-y-6">
            <div className="flex items-center justify-between p-5 bg-black/20 border border-emerald-500/10">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono font-bold text-white uppercase tracking-widest">PII_REDACTION_CORE</span>
                <span className="text-[8px] font-mono text-muted-foreground uppercase opacity-60">Scrub PHI from transcripts before persistence.</span>
              </div>
              <Switch
                checked={aiSettings.pii_redaction_enabled}
                onCheckedChange={(v) => handleSettingChange('pii_redaction_enabled', v)}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>

            <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 flex items-start gap-4">
              <ShieldCheck className="h-4 w-4 text-emerald-500 mt-1" />
              <p className="text-[10px] font-mono text-emerald-400/80 uppercase leading-relaxed">
                HIPAA_MODE: ACTIVE. Patient Biometrics and Protected Health Information are filtered through the Neural Scrubber.
              </p>
            </div>
          </div>
        </div>

        {/* Escalation Matrix */}
        <div className="bg-[#051a1e] border border-white/10 p-8 hover:border-destructive/20 transition-colors">
          <SectionHeader icon={UserX} title="Failover Protocols" desc="Staff Intervention Rules" />

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-white/5 border border-white/5">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono font-bold text-white uppercase tracking-widest">AUTO_TASK_ON_FAILURE</span>
                <span className="text-[8px] font-mono text-muted-foreground uppercase opacity-60">Notify staff after max retry faults.</span>
              </div>
              <Switch
                checked={aiSettings.auto_escalate_on_failure}
                onCheckedChange={(v) => handleSettingChange('auto_escalate_on_failure', v)}
              />
            </div>

            <div className="p-4 bg-destructive/5 border border-destructive/10 flex items-center justify-between">
              <span className="text-[9px] font-mono font-bold text-destructive uppercase tracking-widest">FAULT_THRESHOLD</span>
              <select
                value={aiSettings.stop_after_failures}
                onChange={(e) => handleSettingChange('stop_after_failures', Number(e.target.value))}
                className="bg-transparent border-none text-[10px] font-mono text-destructive font-bold outline-none"
              >
                {FAILURE_LIMIT_OPTIONS.map(opt => <option key={opt.value} value={opt.value} className="bg-[#051a1e]">{opt.label}</option>)}
              </select>
            </div>
          </div>
        </div>

      </div>

      <SystemPromptEditor
        value={aiSettings.system_prompt}
        onChange={(v) => handleSettingChange('system_prompt', v)}
        disabled={isSaving}
      />
    </div>
  );
}
