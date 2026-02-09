import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Phone, CheckCircle2, ArrowRight, Loader2, PhoneCall, FileText, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepTestProps {
  clinicName: string;
  hasPhoneNumber: boolean;
  onTestCall: () => Promise<void>;
  onComplete: () => void;
  isLoading: boolean;
}

export function StepTest({ 
  clinicName, 
  hasPhoneNumber, 
  onTestCall, 
  onComplete,
  isLoading 
}: StepTestProps) {
  const [testCompleted, setTestCompleted] = useState(false);
  const [isCalling, setIsCalling] = useState(false);

  const handleTestCall = async () => {
    if (!hasPhoneNumber) return;
    setIsCalling(true);
    try {
      await onTestCall();
      setTestCompleted(true);
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold text-foreground">
          {testCompleted ? 'AI Receptionist is Ready' : 'Test Your AI Receptionist'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {testCompleted 
            ? `${clinicName} is now set up to handle patient calls`
            : 'See how we handle calls before going live'
          }
        </p>
      </div>

      {!testCompleted ? (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Side - Test Call */}
          <div className="p-6 rounded-xl bg-background/30 border border-white/5 space-y-4">
            <h3 className="font-medium text-foreground flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              Test a real call
            </h3>
            
            {hasPhoneNumber ? (
              <Button
                onClick={handleTestCall}
                disabled={isCalling}
                variant="outline"
                className="w-full py-8 text-base border-primary/30 hover:bg-primary/10 hover:border-primary/50"
              >
                {isCalling ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Calling...
                  </>
                ) : (
                  <>
                    <PhoneCall className="mr-2 h-5 w-5" />
                    Call My Clinic Number
                  </>
                )}
              </Button>
            ) : (
              <div className="p-4 rounded-lg bg-muted/20 text-center">
                <p className="text-sm text-muted-foreground">
                  Phone number not configured yet.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  You can set this up later in Settings.
                </p>
              </div>
            )}
          </div>

          {/* Right Side - What Happens */}
          <div className="p-6 rounded-xl bg-background/30 border border-white/5 space-y-4">
            <h3 className="font-medium text-foreground">
              What happens during the test
            </h3>
            
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="mt-0.5 p-1.5 rounded-full bg-primary/10">
                  <PhoneCall className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm text-foreground/80">
                  AI answers the call with your clinic greeting
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-0.5 p-1.5 rounded-full bg-primary/10">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm text-foreground/80">
                  Confirms availability and intent
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-0.5 p-1.5 rounded-full bg-primary/10">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm text-foreground/80">
                  Logs the entire conversation
                </span>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-0.5 p-1.5 rounded-full bg-primary/10">
                  <BarChart3 className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="text-sm text-foreground/80">
                  Shows result in your Call Logs
                </span>
              </li>
            </ul>
          </div>
        </div>
      ) : (
        /* Success State */
        <div className="flex flex-col items-center py-8 space-y-6">
          <div className="relative">
            <div className="p-4 rounded-full bg-green-500/10">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-background border-2 border-green-500">
              <Phone className="h-4 w-4 text-green-500" />
            </div>
          </div>
          
          <div className="text-center space-y-1">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 text-green-500 font-medium">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              AI is Active
            </div>
            <p className="text-sm text-muted-foreground">
              You can view the test call in your Call Logs
            </p>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="space-y-3">
        <Button
          onClick={onComplete}
          disabled={isLoading}
          className={cn(
            "w-full py-6 text-base",
            testCompleted ? "btn-gold" : "bg-muted/30 hover:bg-muted/50"
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Finishing setup...
            </>
          ) : (
            <>
              Go to Dashboard
              <ArrowRight className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
        
        {!testCompleted && !hasPhoneNumber && (
          <p className="text-xs text-muted-foreground text-center">
            You can test calls later after configuring your phone number
          </p>
        )}
      </div>
    </div>
  );
}
