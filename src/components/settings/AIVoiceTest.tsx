import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square, Mic } from 'lucide-react';

interface AIVoiceTestProps {
  clinicId: string;
  onStateChange: (state: {
    isListening: boolean;
    isSpeaking: boolean;
    isConnecting: boolean;
    audioLevel: number;
  }) => void;
}

export function AIVoiceTest({ clinicId, onStateChange }: AIVoiceTestProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const toggleTest = () => {
    if (isPlaying) {
      setIsPlaying(false);
      onStateChange({ isListening: false, isSpeaking: false, isConnecting: false, audioLevel: 0 });
    } else {
      setIsPlaying(true);
      // Simulate connection sequence
      onStateChange({ isListening: false, isSpeaking: false, isConnecting: true, audioLevel: 0 });

      setTimeout(() => {
        onStateChange({
          isListening: false,
          isSpeaking: true,
          isConnecting: false,
          audioLevel: 0.8,
        });
        // Simulate speech
        setTimeout(() => {
          onStateChange({
            isListening: true,
            isSpeaking: false,
            isConnecting: false,
            audioLevel: 0,
          });
        }, 3000);
      }, 1500);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 p-4 rounded-lg text-sm text-center min-h-[100px] flex items-center justify-center">
        {isPlaying ? (
          <span className="text-primary animate-pulse">AI is speaking...</span>
        ) : (
          <span className="text-muted-foreground">Click play to hear the AI voice.</span>
        )}
      </div>

      <div className="flex justify-center gap-2">
        <Button
          onClick={toggleTest}
          variant={isPlaying ? 'destructive' : 'default'}
          className={isPlaying ? '' : 'btn-gold'}
        >
          {isPlaying ? (
            <>
              <Square className="mr-2 h-4 w-4" /> Stop Demo
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" /> Test Voice
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
