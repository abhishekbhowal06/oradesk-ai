import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';
import { TranscriptMessage } from '@/hooks/useAICalls';
import { format } from 'date-fns';

interface TranscriptViewerProps {
    transcript: TranscriptMessage[] | null;
    className?: string;
}

export function TranscriptViewer({ transcript, className }: TranscriptViewerProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [transcript]);

    if (!transcript || transcript.length === 0) {
        return (
            <div className={cn("flex flex-col items-center justify-center p-8 text-muted-foreground bg-black/20 rounded-lg border border-dashed border-white/10", className)}>
                <Bot className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm font-mono">NO TRANSCRIPT DATA AVAILABLE</p>
            </div>
        );
    }

    return (
        <div
            ref={scrollRef}
            className={cn("space-y-4 overflow-y-auto max-h-[400px] p-4 bg-black/20 rounded-lg border border-white/10", className)}
        >
            {transcript.map((msg, idx) => {
                const isAI = msg.role === 'ai';
                return (
                    <div
                        key={idx}
                        className={cn(
                            "flex gap-3 max-w-[85%]",
                            isAI ? "self-start" : "self-end ml-auto flex-row-reverse"
                        )}
                    >
                        <div className={cn(
                            "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 border",
                            isAI
                                ? "bg-primary/10 border-primary/20 text-primary"
                                : "bg-white/10 border-white/10 text-white"
                        )}>
                            {isAI ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        </div>

                        <div className={cn(
                            "space-y-1 p-3 rounded-lg text-sm border",
                            isAI
                                ? "bg-primary/5 border-primary/10 rounded-tl-sm"
                                : "bg-white/5 border-white/5 rounded-tr-sm"
                        )}>
                            <div className="flex justify-between items-center gap-4 text-[10px] uppercase font-mono tracking-wider opacity-50">
                                <span>{isAI ? 'AI_AGENT_V2' : 'PATIENT_VOICE'}</span>
                                <span>{msg.timestamp ? format(new Date(msg.timestamp), 'HH:mm:ss') : '--:--'}</span>
                            </div>
                            <p className="leading-relaxed text-platinum/90 whitespace-pre-wrap">
                                {msg.message}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
