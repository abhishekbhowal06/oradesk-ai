import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { X, Phone, Pause, Play, Activity, Cpu, ShieldCheck, ShieldAlert, Zap, Radio } from 'lucide-react';
import { useClinic } from '@/contexts/ClinicContext';
import { cn } from '@/lib/utils';

const BANNER_DISMISSED_KEY = 'dentacor_ai_banner_dismissed';

export function AIStatusBanner() {
  const { currentClinic, updateClinicSettings, isUpdating } = useClinic();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
    if (dismissed === currentClinic?.id) {
      setIsDismissed(true);
    }
  }, [currentClinic?.id]);

  // Don't show if no clinic, not onboarded, or dismissed
  if (!currentClinic || !(currentClinic as any).onboarding_completed || isDismissed) {
    return null;
  }

  const isAIActive = currentClinic.ai_settings.confirmation_calls_enabled;

  const handleDismiss = () => {
    setIsDismissed(true);
    if (currentClinic?.id) {
      localStorage.setItem(BANNER_DISMISSED_KEY, currentClinic.id);
    }
  };

  const handleToggleAI = async () => {
    await updateClinicSettings({
      ai_settings: {
        ...currentClinic.ai_settings,
        confirmation_calls_enabled: !isAIActive,
      },
    });
  };

  return (
    <div
      className={cn(
        'relative h-14 border-b transition-all duration-700 overflow-hidden font-mono',
        isAIActive ? 'bg-black border-emerald-500/20' : 'bg-black border-destructive/20',
      )}
    >
      {/* Background static / active scanline effect */}
      {isAIActive && (
        <div className="absolute inset-0 bg-emerald-500/[0.02] pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-emerald-500/10 shadow-[0_0_10px_#10b981] animate-scanline-fast" />
        </div>
      )}
      {!isAIActive && (
        <div className="absolute inset-0 bg-destructive/[0.02] pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-destructive/10 animate-scanline-fast" />
        </div>
      )}

      <div className="h-full px-6 flex items-center justify-between gap-8 relative z-10">

        {/* Status Component */}
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 px-3 py-1 bg-white/5 border border-white/10 group">
            {isAIActive ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <ShieldAlert className="h-4 w-4 text-destructive" />}
            <span className="text-[10px] font-black text-white uppercase tracking-[0.3em]">AI Receptionist</span>
            <div className="h-2 w-[1px] bg-white/10 mx-1" />
            <span className={cn("text-[9px] font-bold uppercase", isAIActive ? "text-emerald-500" : "text-destructive")}>
              {isAIActive ? 'Active' : 'Paused'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'h-1.5 w-1.5 rotate-45 transition-all duration-1000',
                  isAIActive ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,1)]' : 'bg-destructive shadow-[0_0_10px_rgba(239,68,68,1)]',
                )} />
                <span className={cn(
                  'text-[11px] font-black uppercase italic tracking-tighter',
                  isAIActive ? 'text-white' : 'text-destructive',
                )}>
                  AI Receptionist is {isAIActive ? 'Active' : 'Paused'}
                </span>
              </div>
              <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-40 tracking-widest pl-5">
                {isAIActive ? 'All systems healthy – AI is handling calls' : 'AI is paused – calls won\'t be made automatically'}
              </span>
            </div>
          </div>
        </div>

        {/* Global Action Terminal */}
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-4 px-6 border-x border-white/5 h-14">
            <Radio className={cn("h-3.5 w-3.5", isAIActive ? "text-emerald-500 animate-pulse" : "text-muted-foreground opacity-20")} />
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-white/40 uppercase tracking-widest leading-none">Call System</span>
              <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest leading-none mt-1">Connected</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleAI}
              disabled={isUpdating}
              className={cn(
                'h-9 px-6 text-[10px] font-black uppercase border transition-all duration-300 flex items-center gap-3 overflow-hidden group relative',
                isAIActive
                  ? 'bg-transparent border-white/10 text-muted-foreground hover:text-white hover:border-white/30'
                  : 'bg-emerald-500 border-none text-black hover:bg-emerald-400',
              )}
            >
              <span className="relative z-10 flex items-center gap-3">
                {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isAIActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isAIActive ? 'Pause AI' : 'Start AI'}
              </span>
              {!isAIActive && <div className="absolute inset-x-0 bottom-0 h-[2px] bg-black/20" />}
            </button>

            <Link to="/calls">
              <button className="h-9 px-6 text-[10px] font-black uppercase border border-white/10 text-muted-foreground hover:text-white hover:border-white/30 bg-white/5 transition-all flex items-center gap-3">
                <Activity className="h-3.5 w-3.5" />
                View Calls
              </button>
            </Link>

            <button
              onClick={handleDismiss}
              className="h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scanline-fast {
          0% { top: 0; }
          100% { top: 100%; }
        }
        .animate-scanline-fast {
          animation: scanline-fast 4s linear infinite;
        }
      `}</style>
    </div>
  );
}

const Loader2 = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
