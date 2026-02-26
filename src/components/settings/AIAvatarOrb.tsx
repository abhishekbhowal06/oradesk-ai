import React from 'react';
import { cn } from '@/lib/utils';
import { Mic } from 'lucide-react';

interface AIAvatarOrbProps {
  isListening: boolean;
  isSpeaking: boolean;
  isConnecting: boolean;
  audioLevel: number;
  className?: string;
}

export function AIAvatarOrb({
  isListening,
  isSpeaking,
  isConnecting,
  audioLevel,
  className,
}: AIAvatarOrbProps) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-full bg-black/20 border border-white/10',
        className,
      )}
    >
      {/* Orb Core */}
      <div
        className={cn(
          'relative h-32 w-32 rounded-full transition-all duration-300 flex items-center justify-center',
          isConnecting && 'animate-pulse bg-yellow-500/20',
          isSpeaking && 'bg-primary/30 shadow-[0_0_40px_rgba(234,179,8,0.4)]',
          isListening && 'bg-blue-500/30 shadow-[0_0_40px_rgba(59,130,246,0.4)]',
          !isConnecting && !isSpeaking && !isListening && 'bg-zinc-800',
        )}
      >
        <div className="absolute inset-0 rounded-full border border-white/10" />

        {/* Animated Rings based on audio level */}
        {isSpeaking && (
          <div
            className="absolute inset-0 rounded-full border-2 border-primary/50 animate-ping"
            style={{ animationDuration: `${Math.max(0.5, 2 - audioLevel)}s` }}
          />
        )}

        <Mic
          className={cn(
            'h-12 w-12 transition-colors',
            isListening ? 'text-blue-400' : isSpeaking ? 'text-primary' : 'text-zinc-500',
          )}
        />
      </div>

      {/* Connecting Status */}
      {isConnecting && (
        <div className="absolute bottom-4 text-xs font-medium text-yellow-500 animate-pulse">
          Connecting...
        </div>
      )}
    </div>
  );
}
