import { cn } from '@/lib/utils';

interface AudioWaveformProps {
  active: boolean;
  className?: string;
  /** Number of bars. Default 5. */
  bars?: number;
}

/**
 * Fake audio waveform — pure CSS animated bars that mimic voice activity.
 * Only animates when `active` is true (call in-progress).
 */
export function AudioWaveform({ active, className, bars = 8 }: AudioWaveformProps) {
  if (!active) return null;

  return (
    <div
      className={cn('inline-flex items-center gap-[1px] h-3 px-1.5 py-0.5 bg-black/20 border border-white/5', className)}
      aria-label="Voice activity"
      role="img"
    >
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="waveform-bar !rounded-none !w-[2px] !bg-primary shadow-[0_0_4px_rgba(234,179,8,0.3)]"
          style={{
            animationDelay: `${i * 0.12}s`,
            animationDuration: `${0.4 + Math.random() * 0.6}s`,
            height: `${20 + Math.random() * 60}%`,
          }}
        />
      ))}
    </div>
  );
}
