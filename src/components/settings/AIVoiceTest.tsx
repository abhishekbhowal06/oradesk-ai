import { useState, useCallback, useEffect } from 'react';
import { useConversation } from '@elevenlabs/react';
import { Mic, MicOff, Phone, PhoneOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AIVoiceTestProps {
  clinicId: string;
  onStateChange?: (state: {
    isListening: boolean;
    isSpeaking: boolean;
    isConnecting: boolean;
    audioLevel: number;
  }) => void;
  className?: string;
}

interface TranscriptMessage {
  role: 'user' | 'agent';
  text: string;
  timestamp: Date;
}

export function AIVoiceTest({ clinicId, onStateChange, className }: AIVoiceTestProps) {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const conversation = useConversation({
    onConnect: () => {
      console.log('[voice-test] Connected to ElevenLabs');
      setIsConnecting(false);
    },
    onDisconnect: () => {
      console.log('[voice-test] Disconnected from ElevenLabs');
      setIsConnecting(false);
    },
    onMessage: (message) => {
      console.log('[voice-test] Message:', message);
      
      const msg = message as any;
      if (msg?.type === 'user_transcript') {
        const userTranscript = msg?.user_transcription_event?.user_transcript;
        if (userTranscript) {
          setTranscripts(prev => [...prev, {
            role: 'user',
            text: userTranscript,
            timestamp: new Date(),
          }]);
        }
      } else if (msg?.type === 'agent_response') {
        const agentResponse = msg?.agent_response_event?.agent_response;
        if (agentResponse) {
          setTranscripts(prev => [...prev, {
            role: 'agent',
            text: agentResponse,
            timestamp: new Date(),
          }]);
        }
      }
    },
    onError: (error) => {
      console.error('[voice-test] Error:', error);
      setIsConnecting(false);
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to voice service. Please try again.',
        variant: 'destructive',
      });
    },
  });
  
  // Update parent with state changes
  useEffect(() => {
    onStateChange?.({
      isListening: conversation.status === 'connected' && !conversation.isSpeaking,
      isSpeaking: conversation.isSpeaking,
      isConnecting,
      audioLevel,
    });
  }, [conversation.status, conversation.isSpeaking, isConnecting, audioLevel, onStateChange]);
  
  // Audio level monitoring
  useEffect(() => {
    if (conversation.status !== 'connected') return;
    
    const interval = setInterval(() => {
      try {
        const inputLevel = conversation.getInputVolume?.() || 0;
        const outputLevel = conversation.getOutputVolume?.() || 0;
        setAudioLevel(Math.max(inputLevel, outputLevel));
      } catch (e) {
        // Volume methods might not be available
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [conversation]);
  
  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    setTranscripts([]);
    
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Get conversation token from edge function
      const { data, error } = await supabase.functions.invoke('elevenlabs-conversation-token', {
        body: { clinicId },
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (!data?.token) {
        throw new Error('No conversation token received');
      }
      
      // Start the conversation with WebRTC
      await conversation.startSession({
        conversationToken: data.token,
        connectionType: 'webrtc',
      });
      
    } catch (error) {
      console.error('[voice-test] Failed to start conversation:', error);
      setIsConnecting(false);
      toast({
        title: 'Failed to Start',
        description: error instanceof Error ? error.message : 'Could not start voice test. Please check your microphone.',
        variant: 'destructive',
      });
    }
  }, [clinicId, conversation, toast]);
  
  const stopConversation = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (error) {
      console.error('[voice-test] Failed to end conversation:', error);
    }
  }, [conversation]);
  
  const isConnected = conversation.status === 'connected';
  
  return (
    <div className={cn('flex flex-col', className)}>
      {/* Control Buttons */}
      <div className="flex justify-center gap-4 mb-6">
        {!isConnected ? (
          <button
            onClick={startConversation}
            disabled={isConnecting}
            className={cn(
              'btn-gold flex items-center gap-3 px-8 py-4 text-lg',
              isConnecting && 'opacity-80'
            )}
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <Phone className="h-5 w-5" />
                Talk to AI
              </>
            )}
          </button>
        ) : (
          <button
            onClick={stopConversation}
            className={cn(
              'flex items-center gap-3 px-8 py-4 text-lg rounded-2xl',
              'bg-destructive/90 text-destructive-foreground',
              'hover:bg-destructive transition-colors',
              'shadow-lg'
            )}
          >
            <PhoneOff className="h-5 w-5" />
            End Call
          </button>
        )}
      </div>
      
      {/* Status Indicator */}
      {isConnected && (
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full',
            'bg-white/5 border border-white/10'
          )}>
            {conversation.isSpeaking ? (
              <>
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm text-primary font-medium">AI Speaking</span>
              </>
            ) : (
              <>
                <Mic className="h-4 w-4 text-info animate-pulse" />
                <span className="text-sm text-info font-medium">Listening...</span>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Transcript Display */}
      {transcripts.length > 0 && (
        <div className="glass-surface p-4 rounded-xl max-h-48 overflow-y-auto">
          <div className="space-y-3">
            {transcripts.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'flex',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[80%] px-4 py-2 rounded-2xl text-sm',
                    msg.role === 'user'
                      ? 'message-patient rounded-br-md'
                      : 'message-ai rounded-bl-md'
                  )}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Microphone Permission Notice */}
      {!isConnected && !isConnecting && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          Click "Talk to AI" to test your AI receptionist. Microphone access required.
        </p>
      )}
    </div>
  );
}
