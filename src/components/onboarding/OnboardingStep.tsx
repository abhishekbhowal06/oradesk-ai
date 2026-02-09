import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface OnboardingStepProps {
  currentStep: number;
  totalSteps: number;
  children: ReactNode;
  className?: string;
}

export function OnboardingStep({ currentStep, totalSteps, children, className }: OnboardingStepProps) {
  return (
    <div className={cn("w-full max-w-2xl mx-auto space-y-8 animate-fade-up", className)}>
      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm text-muted-foreground">
          Step {currentStep} of {totalSteps}
        </span>
        <div className="flex items-center gap-1.5 ml-3">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <div
              key={index}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                index + 1 === currentStep
                  ? "w-8 bg-primary"
                  : index + 1 < currentStep
                  ? "w-2 bg-primary/60"
                  : "w-2 bg-white/20"
              )}
            />
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="glass-card p-8">
        {children}
      </div>
    </div>
  );
}
