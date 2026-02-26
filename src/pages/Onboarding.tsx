import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logoIcon from '@/assets/dentacor-logo-icon.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useClinic, WorkingHours, AISettings } from '@/contexts/ClinicContext';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Building2, ArrowRight, Sparkles, Database, ShieldCheck, Zap, Bot, Activity } from 'lucide-react';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { StepHours } from '@/components/onboarding/StepHours';
import { StepAISetup } from '@/components/onboarding/StepAISetup';
import { StepTest } from '@/components/onboarding/StepTest';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type OnboardingStepType = 'clinic' | 'hours' | 'ai' | 'test';

export default function Onboarding() {
  const navigate = useNavigate();
  const { createClinic, currentClinic, updateClinicSettings, isLoading } = useClinic();
  const { user } = useAuth();
  const [clinicName, setClinicName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<OnboardingStepType>('clinic');

  const trackEvent = async (eventType: 'staff_action', eventData?: object) => {
    if (!currentClinic?.id) return;
    try {
      await supabase.from('analytics_events').insert([
        {
          clinic_id: currentClinic.id,
          event_type: eventType,
          event_data: eventData as any,
        },
      ]);
    } catch (e) {
      console.warn('Failed to track event:', e);
    }
  };

  const handleCreateClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicName.trim()) return;

    setIsCreating(true);
    const clinic = await createClinic(clinicName.trim());
    setIsCreating(false);

    if (clinic) {
      setCurrentStep('hours');
    }
  };

  const handleSaveHours = async (hours: WorkingHours, callDuringHoursOnly: boolean) => {
    setIsSaving(true);
    try {
      await updateClinicSettings({
        working_hours: hours,
        ai_settings: {
          ...currentClinic!.ai_settings,
          call_during_hours_only: callDuringHoursOnly,
        },
      });
      await trackEvent('staff_action', { step: 'hours_configured' });
      setCurrentStep('ai');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAISettings = async (settings: AISettings) => {
    setIsSaving(true);
    try {
      await updateClinicSettings({ ai_settings: settings });
      await trackEvent('staff_action', { step: 'ai_activated' });
      setCurrentStep('test');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestCall = async () => {
    if (!currentClinic) return;
    try {
      await trackEvent('staff_action', { step: 'test_call_initiated' });
      await supabase.functions.invoke('twilio-call', {
        body: {
          action: 'initiate',
          clinicId: currentClinic.id,
          patientId: user?.id,
          phoneNumber: currentClinic.phone || '',
          callType: 'confirmation',
        },
      });
    } catch (e) {
      console.error('Test call failed:', e);
    }
  };

  const handleComplete = async () => {
    setIsSaving(true);
    try {
      await supabase
        .from('clinics')
        .update({ onboarding_completed: true })
        .eq('id', currentClinic!.id);

      await trackEvent('staff_action', { step: 'onboarding_completed' });
      navigate('/', { replace: true });
    } finally {
      setIsSaving(false);
    }
  };

  const getStepNumber = () => {
    switch (currentStep) {
      case 'hours': return 1;
      case 'ai': return 2;
      case 'test': return 3;
      default: return 0;
    }
  };

  // Industrial Step Indicator Helper
  const renderStepIndicator = () => (
    <div className="flex justify-center mb-12">
      <div className="flex items-center gap-4">
        {['CLINIC', 'HOURS', 'AI_CONFIG', 'VERIFY'].map((label, idx) => {
          const isActive = getStepNumber() === idx || (currentStep === 'clinic' && idx === 0);
          const isPast = getStepNumber() > idx;
          return (
            <div key={label} className="flex items-center">
              <div className={cn(
                "flex flex-col items-center gap-2",
                isActive ? "opacity-100" : "opacity-30"
              )}>
                <div className={cn(
                  "h-2 w-8",
                  isActive ? "bg-primary shadow-[0_0_10px_rgba(234,179,8,0.5)]" :
                    isPast ? "bg-emerald-500" : "bg-white/10"
                )} />
                <span className="text-[8px] font-mono font-bold tracking-widest text-white">{label}</span>
              </div>
              {idx < 3 && <div className="w-8 h-px bg-white/5 mx-2" />}
            </div>
          )
        })}
      </div>
    </div>
  );

  if (currentStep === 'clinic') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#051a1e] p-6 relative overflow-hidden">
        {/* Abstract Background Grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        <div className="absolute top-0 left-0 w-full h-[2px] bg-primary/20" />

        <div className="w-full max-w-xl space-y-12 relative z-10">
          {/* Diagnostic Header */}
          <div className="flex flex-col items-center space-y-4 animate-fade-in">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/20 blur-xl group-hover:bg-primary/30 transition-all rounded-full" />
              <div className="relative h-24 w-24 bg-black/40 border border-white/10 flex items-center justify-center">
                <img src={logoIcon} alt="DENTACOR" className="h-16 w-16 object-contain" />
                <div className="absolute -top-1 -left-1 w-2 h-2 border-t border-l border-primary" />
                <div className="absolute -bottom-1 -right-1 w-2 h-2 border-b border-r border-primary" />
              </div>
            </div>

            <div className="text-center">
              <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">
                Initialize <span className="text-primary">Protocol</span>
              </h1>
              <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-[0.3em] mt-2">
                System Deployment // Version 4.0.B
              </p>
            </div>
          </div>

          {/* Configuration Module */}
          <div className="bg-black/40 border border-white/10 p-10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="space-y-2 mb-10 border-l-2 border-primary/40 pl-6">
              <h2 className="text-lg font-bold text-white uppercase italic tracking-tight">
                Welcome, Operator::{user?.user_metadata?.full_name || 'ANONYMOUS'}
              </h2>
              <p className="text-[11px] font-mono text-muted-foreground uppercase leading-relaxed">
                NO REGISTERED CLINICS DETECTED IN LOCAL CLUSTER. INITIALIZE PRIMARY OPERATIONAL ENVIRONMENT.
              </p>
            </div>

            <form onSubmit={handleCreateClinic} className="space-y-8">
              <div className="space-y-3">
                <Label htmlFor="clinic-name" className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest flex items-center gap-2">
                  <Database className="h-3 w-3" />
                  ENVIRONMENT_LABEL
                </Label>
                <div className="relative">
                  <Input
                    id="clinic-name"
                    type="text"
                    placeholder="DENTACOR_PRIMARY_HQ"
                    className="rounded-none bg-white/5 border-white/10 text-lg py-7 font-mono uppercase tracking-widest focus:border-primary/50 focus:ring-0 transition-all"
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    disabled={isCreating}
                    autoFocus
                  />
                </div>
                <div className="flex items-center justify-between opacity-50">
                  <span className="text-[9px] font-mono text-muted-foreground uppercase">Define clinical identifier...</span>
                  {isCreating && <span className="text-[9px] font-mono text-primary animate-pulse uppercase">Syncing to cloud...</span>}
                </div>
              </div>

              <Button
                type="submit"
                className="btn-gold w-full py-7 h-auto group relative overflow-hidden"
                disabled={isCreating || !clinicName.trim()}
              >
                {isCreating ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-[12px] font-mono font-bold uppercase tracking-widest">Compiling Env...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] font-mono font-bold uppercase tracking-widest">Provision Cluster</span>
                    <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-2" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </Button>
            </form>

            {/* Neural Capabilities Grid */}
            <div className="mt-12 pt-8 border-t border-white/5 grid grid-cols-2 gap-4">
              {[
                { label: 'NEURAL_RECEPTION', icon: Bot },
                { label: 'SECURE_RECORDS', icon: ShieldCheck },
                { label: 'PREDICTIVE_SYNC', icon: Zap },
                { label: 'DYNAMIC_LOGISTICS', icon: Activity }
              ].map((cap, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 bg-white/5 border border-white/5 group hover:border-primary/20 transition-all">
                  <cap.icon className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase group-hover:text-white transition-colors">{cap.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-center opacity-30">
            <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest">Encrypted Session // AES-256</p>
          </div>
        </div>
      </div>
    );
  }

  // Wizard flow
  return (
    <div className="min-h-screen bg-[#051a1e] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      <div className="absolute top-0 left-0 w-full h-[2px] bg-primary/20" />

      <div className="w-full max-w-4xl relative z-10">
        {/* Animated Progress Bar */}
        {renderStepIndicator()}

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
          <OnboardingStep currentStep={getStepNumber()} totalSteps={3}>
            {currentStep === 'hours' && (
              <StepHours
                workingHours={currentClinic?.working_hours || {}}
                onSave={handleSaveHours}
                isLoading={isSaving}
              />
            )}

            {currentStep === 'ai' && (
              <StepAISetup
                aiSettings={
                  currentClinic?.ai_settings || {
                    confirmation_calls_enabled: true,
                    reminder_hours_before: 24,
                    max_follow_up_attempts: 3,
                    follow_up_delay_hours: 4,
                  }
                }
                onSave={handleSaveAISettings}
                isLoading={isSaving}
              />
            )}

            {currentStep === 'test' && (
              <StepTest
                clinicName={currentClinic?.name || 'Your Clinic'}
                hasPhoneNumber={!!currentClinic?.twilio_phone_number}
                onTestCall={handleTestCall}
                onComplete={handleComplete}
                isLoading={isSaving}
              />
            )}
          </OnboardingStep>
        </div>

        <div className="mt-12 flex items-center justify-center gap-4 opacity-30 font-mono text-[8px] uppercase tracking-widest text-muted-foreground">
          <span>Sys_status: ACTIVE</span>
          <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
          <span>Secure_auth: OK</span>
          <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
          <span>Database_sync: REALTIME</span>
        </div>
      </div>
    </div>
  );
}
