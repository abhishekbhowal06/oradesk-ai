import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Phone,
  CheckCircle2,
  ArrowRight,
  Loader2,
  PhoneCall,
  FileText,
  BarChart3,
  Activity,
  ShieldCheck,
  Cpu
} from 'lucide-react';
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
  isLoading,
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
    <div className="space-y-10">
      {/* Module Header */}
      <div className="space-y-3 text-center">
        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">
          {testCompleted ? 'PROTOCOL_VERIFIED' : 'CORE_VALIDATION'}
        </h2>
        <div className="flex items-center justify-center gap-4">
          <div className="h-px w-12 bg-white/10" />
          <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-[0.3em]">
            {testCompleted
              ? `${clinicName} // NEURAL_STACK_READY`
              : 'Execute diagnostic outbound sequence'}
          </p>
          <div className="h-px w-12 bg-white/10" />
        </div>
      </div>

      {!testCompleted ? (
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left Side: Test Call Module */}
          <div className="p-6 bg-black/40 border border-white/10 space-y-6 relative group overflow-hidden">
            <div className="flex items-center gap-3">
              <Cpu className="h-4 w-4 text-primary" />
              <h3 className="text-[11px] font-mono font-bold text-white uppercase tracking-widest">DIAGNOSTIC_TRIGGER</h3>
            </div>

            {hasPhoneNumber ? (
              <Button
                onClick={handleTestCall}
                disabled={isCalling}
                className="w-full h-24 bg-primary/10 border-primary/30 hover:bg-primary/20 hover:border-primary/50 text-primary border rounded-none group"
              >
                {isCalling ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest">TRANSMITTING...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <PhoneCall className="h-6 w-6 transition-transform group-hover:scale-110" />
                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-center px-4">Initialize Test Transmission</span>
                  </div>
                )}
              </Button>
            ) : (
              <div className="p-4 bg-red-500/10 border border-red-500/20 text-center space-y-2">
                <p className="text-[10px] font-mono font-bold text-red-400 uppercase">HARDWARE_MISMATCH</p>
                <p className="text-[8px] font-mono text-muted-foreground uppercase">
                  No registered uplink detected. Configure station number in settings post-init.
                </p>
              </div>
            )}

            <div className="absolute bottom-0 left-0 h-[2px] w-full bg-primary/20 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
          </div>

          {/* Right Side: What Happens Matrix */}
          <div className="p-6 bg-[#051a1e] border border-white/10 space-y-6">
            <h3 className="text-[11px] font-mono font-bold text-white uppercase tracking-widest">SEQUENCE_PREVIEW</h3>

            <div className="space-y-4">
              {[
                { label: 'AUTONOMOUS_INTERCEPT', desc: 'AI handles terminal handshake.', icon: PhoneCall },
                { label: 'INTENT_PARSING', desc: 'Neural logic validates subject state.', icon: CheckCircle2 },
                { label: 'AUDIT_LOG_EXPORT', desc: 'Full transcript sync to core database.', icon: FileText },
                { label: 'TELEMETRY_SYNC', desc: 'Real-time update to tactical HUD.', icon: BarChart3 }
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="mt-0.5 p-1 border border-primary/20 bg-primary/5">
                    <item.icon className="h-3 w-3 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-mono font-bold text-white uppercase tracking-tight">{item.label}</p>
                    <p className="text-[8px] font-mono text-muted-foreground uppercase opacity-60">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Success Matrix */
        <div className="flex flex-col items-center py-10 space-y-8 animate-in zoom-in-95 duration-500">
          <div className="relative">
            <div className="p-8 border-2 border-emerald-500/30 bg-emerald-500/5">
              <ShieldCheck className="h-16 w-16 text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]" />
            </div>
            <div className="absolute -top-2 -right-2 h-6 w-6 bg-black border border-emerald-500 flex items-center justify-center">
              <Activity className="h-3 w-3 text-emerald-500 animate-pulse" />
            </div>
          </div>

          <div className="text-center space-y-3">
            <div className="px-6 py-2 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-mono font-bold text-xs uppercase tracking-[0.2em] inline-flex items-center gap-3">
              <span className="h-2 w-2 bg-emerald-500 animate-pulse" />
              SYSTEM_STABLE // CORE_ONLINE
            </div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest opacity-60">
              Diagnostic archived in central repository.
            </p>
          </div>
        </div>
      )}

      {/* Deployment Action */}
      <div className="space-y-4">
        <Button
          onClick={onComplete}
          disabled={isLoading}
          className={cn(
            'w-full h-16 rounded-none font-mono font-bold uppercase tracking-widest relative overflow-hidden group',
            testCompleted ? 'btn-gold' : 'bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10 hover:text-white',
          )}
        >
          {isLoading ? (
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs">UPLINKING_DATA...</span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span>{testCompleted ? 'ENTER_COMMAND_CENTER' : 'SKIP_DIAGNOSTICS'}</span>
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-2" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
        </Button>

        {!testCompleted && !hasPhoneNumber && (
          <div className="flex items-center justify-center gap-2 opacity-30">
            <ShieldCheck className="h-3 w-3" />
            <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
              Diag_bypass_ready // Manual_config_required
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
