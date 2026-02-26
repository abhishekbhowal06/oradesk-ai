import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface OnboardingStepProps {
  currentStep: number;
  totalSteps: number;
  children: ReactNode;
  className?: string;
}

export function OnboardingStep({
  currentStep,
  totalSteps,
  children,
  className,
}: OnboardingStepProps) {
  return (
    <div className={cn('w-full space-y-8 animate-fade-up', className)}>
      <div className="bg-[#051a1e] border border-white/10 p-0 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Terminal Header */}
        <div className="bg-white/5 border-b border-white/10 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-primary rounded-none rotate-45" />
            <span className="text-[10px] font-mono font-bold text-white uppercase tracking-widest">WIZARD_PROTOCOL::{currentStep}/{totalSteps}</span>
          </div>
          <div className="flex gap-1">
            <div className="h-1 w-4 bg-primary/20" />
            <div className="h-1 w-4 bg-primary/20" />
            <div className="h-1 w-4 bg-primary" />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-10">
          {children}
        </div>

        {/* Bottom Accent */}
        <div className="h-1 w-full bg-stripe-pattern opacity-10" />
      </div>
    </div>
  );
}
