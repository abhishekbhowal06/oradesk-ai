import { useState } from 'react';
import { Briefcase, Smile, Heart, Volume2, Play, Globe, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AIPersonalitySettingsProps {
  voiceId: string;
  tone: string;
  language: string;
  speed: number;
  firstMessage: string;
  onVoiceChange: (value: string) => void;
  onToneChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onSpeedChange: (value: number) => void;
  onFirstMessageChange: (value: string) => void;
  disabled?: boolean;
}

const VOICE_OPTIONS = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Professional Female' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'Warm Male' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', description: 'Friendly Female' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', description: 'Calm Male' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', description: 'Energetic Female' },
];

const TONE_OPTIONS = [
  { 
    id: 'professional', 
    label: 'Professional', 
    description: 'Formal, efficient, business-like',
    icon: Briefcase,
  },
  { 
    id: 'friendly', 
    label: 'Friendly', 
    description: 'Warm, conversational, approachable',
    icon: Smile,
  },
  { 
    id: 'caring', 
    label: 'Caring', 
    description: 'Empathetic, patient, understanding',
    icon: Heart,
  },
];

const LANGUAGE_OPTIONS = [
  { code: 'en', name: 'English (US)', flag: '🇺🇸' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'pt', name: 'Portuguese', flag: '🇧🇷' },
];

export function AIPersonalitySettings({
  voiceId,
  tone,
  language,
  speed,
  firstMessage,
  onVoiceChange,
  onToneChange,
  onLanguageChange,
  onSpeedChange,
  onFirstMessageChange,
  disabled = false,
}: AIPersonalitySettingsProps) {
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  
  const handlePlayVoicePreview = async () => {
    // Voice preview would be implemented with ElevenLabs TTS API
    setIsPlayingVoice(true);
    setTimeout(() => setIsPlayingVoice(false), 2000);
  };
  
  const speedLabel = speed <= 0.85 ? 'Slower' : speed >= 1.15 ? 'Faster' : 'Normal';
  
  return (
    <div className="glass-card p-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Volume2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            AI Personality & Voice
          </h3>
          <p className="text-xs text-muted-foreground">
            Customize how your AI sounds and behaves
          </p>
        </div>
      </div>
      
      <div className="space-y-6">
        {/* Voice Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Volume2 className="h-3.5 w-3.5" />
            Voice
          </label>
          <div className="flex gap-3">
            <Select value={voiceId} onValueChange={onVoiceChange} disabled={disabled}>
              <SelectTrigger className="flex-1 bg-white/5 border-white/10">
                <SelectValue placeholder="Select a voice" />
              </SelectTrigger>
              <SelectContent>
                {VOICE_OPTIONS.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    <div className="flex flex-col">
                      <span>{voice.name}</span>
                      <span className="text-xs text-muted-foreground">{voice.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              onClick={handlePlayVoicePreview}
              disabled={disabled || isPlayingVoice}
              className={cn(
                'flex items-center justify-center h-10 w-10 rounded-xl',
                'bg-primary/10 border border-primary/30',
                'text-primary transition-all duration-200',
                'hover:bg-primary/20 hover:scale-105',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <Play className={cn('h-4 w-4', isPlayingVoice && 'animate-pulse')} />
            </button>
          </div>
        </div>
        
        {/* Tone Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Tone
          </label>
          <div className="grid grid-cols-3 gap-3">
            {TONE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = tone === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => onToneChange(option.id)}
                  disabled={disabled}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-xl',
                    'border transition-all duration-200',
                    isSelected 
                      ? 'bg-primary/10 border-primary/50 shadow-[0_0_20px_hsl(43_67%_52%_/_0.15)]' 
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <Icon className={cn(
                    'h-5 w-5 transition-colors',
                    isSelected ? 'text-primary' : 'text-muted-foreground'
                  )} />
                  <span className={cn(
                    'text-sm font-medium transition-colors',
                    isSelected ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Language Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Globe className="h-3.5 w-3.5" />
            Language
          </label>
          <Select value={language} onValueChange={onLanguageChange} disabled={disabled}>
            <SelectTrigger className="bg-white/5 border-white/10">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGE_OPTIONS.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  <div className="flex items-center gap-2">
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Speed Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Gauge className="h-3.5 w-3.5" />
              Speech Speed
            </label>
            <span className={cn(
              'text-xs font-medium px-2 py-1 rounded-full',
              speed === 1 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            )}>
              {speedLabel}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">0.8x</span>
            <Slider
              value={[speed]}
              onValueChange={([v]) => onSpeedChange(v)}
              min={0.8}
              max={1.2}
              step={0.05}
              disabled={disabled}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground">1.2x</span>
          </div>
        </div>
        
        {/* First Message / Greeting */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Greeting Message
          </label>
          <input
            type="text"
            value={firstMessage}
            onChange={(e) => onFirstMessageChange(e.target.value)}
            disabled={disabled}
            placeholder="Hello! Thank you for calling. How can I help you today?"
            className={cn(
              'w-full px-4 py-3 rounded-xl',
              'bg-white/5 border border-white/10',
              'text-foreground placeholder:text-muted-foreground/50',
              'focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
          <p className="text-xs text-muted-foreground/70">
            This is the first thing your AI says when answering a call.
          </p>
        </div>
      </div>
    </div>
  );
}
