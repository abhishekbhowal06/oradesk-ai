import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logoIcon from '@/assets/dentacor-logo-icon.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useClinic, WorkingHours, AISettings } from '@/contexts/ClinicContext';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Building2, ArrowRight, Sparkles } from 'lucide-react';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { StepHours } from '@/components/onboarding/StepHours';
import { StepAISetup } from '@/components/onboarding/StepAISetup';
import { StepTest } from '@/components/onboarding/StepTest';
import { supabase } from '@/integrations/supabase/client';

type OnboardingStepType = 'clinic' | 'hours' | 'ai' | 'test';

export default function Onboarding() {
  const navigate = useNavigate();
  const { createClinic, currentClinic, updateClinicSettings, isLoading } = useClinic();
  const { user } = useAuth();
  const [clinicName, setClinicName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState<OnboardingStepType>('clinic');

  // Track analytics event
  const trackEvent = async (eventType: 'staff_action', eventData?: object) => {
    if (!currentClinic?.id) return;
    try {
      await supabase.from('analytics_events').insert([{
        clinic_id: currentClinic.id,
        event_type: eventType,
        event_data: eventData as any,
      }]);
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
      
      // Trigger actual test call via Twilio edge function
      // This calls the clinic's configured Twilio number
      const { data, error } = await supabase.functions.invoke('twilio-call', {
        body: {
          action: 'initiate',
          clinicId: currentClinic.id,
          patientId: user?.id, // Use current user as test patient
          phoneNumber: currentClinic.phone || '',
          callType: 'confirmation',
        },
      });
      
      if (error) {
        console.error('Test call failed:', error);
        // Still mark as completed for demo - Twilio might not be configured yet
      }
    } catch (e) {
      console.error('Test call failed:', e);
    }
  };

  const handleComplete = async () => {
    setIsSaving(true);
    try {
      // Mark onboarding as completed
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

  // Step 0: Create Clinic (original flow)
  if (currentStep === 'clinic') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-lg space-y-8">
          {/* Logo and Brand */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <img 
                src={logoIcon} 
                alt="DENTACOR" 
                className="h-20 w-20 object-contain"
              />
              <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
            <h1 className="text-2xl font-semibold tracking-wide text-foreground">
              Welcome to DENTACOR
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Let's set up your clinic to start automating patient communications with AI
            </p>
          </div>

          {/* Welcome Card */}
          <div className="glass-card p-8 space-y-6">
            <div className="space-y-2">
              <h2 className="text-lg font-medium text-foreground">
                Hello, {user?.user_metadata?.full_name || user?.email?.split('@')[0]}!
              </h2>
              <p className="text-sm text-muted-foreground">
                You don't have any clinics yet. Create your first clinic to get started.
              </p>
            </div>

            <form onSubmit={handleCreateClinic} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="clinic-name" className="text-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Clinic Name
                </Label>
                <Input 
                  id="clinic-name" 
                  type="text" 
                  placeholder="Dr. Williams Dental Care"
                  className="bg-background/50 border-white/10 text-lg py-6"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  disabled={isCreating}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  This will be your clinic's display name across the platform
                </p>
              </div>

              <Button 
                type="submit" 
                className="btn-gold w-full py-6 text-base" 
                disabled={isCreating || !clinicName.trim()}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Creating clinic...
                  </>
                ) : (
                  <>
                    Create Clinic
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
            </form>

            {/* Features Preview */}
            <div className="pt-4 border-t border-white/5">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">
                What you'll get:
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-foreground/80">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  AI appointment calls
                </div>
                <div className="flex items-center gap-2 text-foreground/80">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Patient management
                </div>
                <div className="flex items-center gap-2 text-foreground/80">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Smart scheduling
                </div>
                <div className="flex items-center gap-2 text-foreground/80">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  Revenue analytics
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Steps 1-3: Wizard flow
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img 
            src={logoIcon} 
            alt="DENTACOR" 
            className="h-12 w-12 object-contain opacity-80"
          />
        </div>

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
              aiSettings={currentClinic?.ai_settings || {
                confirmation_calls_enabled: true,
                reminder_hours_before: 24,
                max_follow_up_attempts: 3,
                follow_up_delay_hours: 4,
              }}
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
    </div>
  );
}
