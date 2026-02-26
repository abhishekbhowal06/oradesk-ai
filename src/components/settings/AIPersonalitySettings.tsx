import { useState } from 'react';
import { Briefcase, Smile, Heart, Volume2, Play, Globe, Gauge, Zap, Activity, Cpu } from 'lucide-react';
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
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'SARAH_v4', description: 'Professional Female' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'GEORGE_v2', description: 'Warm Male' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'LILY_v3', description: 'Friendly Female' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'BRIAN_v1', description: 'Calm Male' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'JESSICA_v5', description: 'Energetic Female' },
];

const TONE_OPTIONS = [
  {
    id: 'professional',
    label: 'CLINICAL',
    description: 'Formal, efficient, business-like',
    icon: Briefcase,
  },
  {
    id: 'friendly',
    label: 'ADAPTIVE',
    description: 'Warm, conversational, approachable',
    icon: Smile,
  },
  {
    id: 'caring',
    label: 'EMPATHIC',
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
    setIsPlayingVoice(true);
    setTimeout(() => setIsPlayingVoice(false), 2000);
  };

  const speedLabel = speed <= 0.85 ? 'DECEL' : speed >= 1.15 ? 'ACCEL' : 'NOMINAL';

  return (
    <div className="bg-[#051a1e] border border-white/10 p-8 shadow-[0_0_50px_rgba(0,0,0,0.3)] animate-fade-up">
      {/* Module Header */}
      <div className="flex items-center gap-4 mb-10">
        <div className="h-10 w-10 border border-primary/20 bg-primary/5 flex items-center justify-center text-primary">
          <Volume2 className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-xs font-mono font-bold text-white uppercase tracking-[0.2em]">Neural Personality Matrix</h3>
          <p className="text-[9px] font-mono text-muted-foreground uppercase opacity-60 tracking-wider">Configure vocal synthesis and behavioral tone.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">

        {/* Left Column: Voice & Speed */}
        <div className="space-y-8">
          {/* Voice Selection */}
          <div className="space-y-4">
            <label className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              Uplink_Voice_Core
            </label>
            <div className="flex gap-4">
              <Select value={voiceId} onValueChange={onVoiceChange} disabled={disabled}>
                <SelectTrigger className="flex-1 bg-black/40 border-white/10 rounded-none h-12 font-mono text-xs uppercase tracking-tight">
                  <SelectValue placeholder="SELECT_CORE" />
                </SelectTrigger>
                <SelectContent className="bg-[#051a1e] border-white/10 rounded-none">
                  {VOICE_OPTIONS.map((voice) => (
                    <SelectItem key={voice.id} value={voice.id} className="font-mono text-xs uppercase focus:bg-primary/20">
                      <div className="flex flex-col">
                        <span className="font-bold">{voice.name}</span>
                        <span className="text-[9px] opacity-60">{voice.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={handlePlayVoicePreview}
                disabled={disabled || isPlayingVoice}
                className={cn(
                  'flex items-center justify-center h-12 w-12 border transition-all duration-300',
                  'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20',
                  'disabled:opacity-20'
                )}
              >
                <Play className={cn('h-5 w-5', isPlayingVoice && 'animate-pulse')} />
              </button>
            </div>
          </div>

          {/* Speed Control */}
          <div className="space-y-4 p-5 bg-black/20 border border-white/5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">Synthesis_Velocity</label>
              <span className={cn(
                'text-[10px] font-mono font-bold px-2 py-0.5 border',
                speed === 1 ? 'border-primary/20 text-primary' : 'border-white/10 text-muted-foreground'
              )}>{speedLabel}</span>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-[9px] font-mono text-muted-foreground opacity-40">0.8X</span>
              <Slider
                value={[speed]}
                onValueChange={([v]) => onSpeedChange(v)}
                min={0.8}
                max={1.2}
                step={0.05}
                disabled={disabled}
                className="flex-1"
              />
              <span className="text-[9px] font-mono text-muted-foreground opacity-40">1.2X</span>
            </div>
          </div>
        </div>

        {/* Right Column: Tone & First Message */}
        <div className="space-y-8">
          {/* Language Selection */}
          <div className="space-y-4">
            <label className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">Lexicon_Interface</label>
            <Select value={language} onValueChange={onLanguageChange} disabled={disabled}>
              <SelectTrigger className="bg-black/40 border-white/10 rounded-none h-12 font-mono text-xs uppercase tracking-tight">
                <SelectValue placeholder="SELECT_LEXICON" />
              </SelectTrigger>
              <SelectContent className="bg-[#051a1e] border-white/10 rounded-none">
                {LANGUAGE_OPTIONS.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code} className="font-mono text-xs focus:bg-primary/20">
                    <div className="flex items-center gap-3">
                      <span>{lang.flag}</span>
                      <span className="uppercase tracking-widest">{lang.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tone Selection */}
          <div className="space-y-4">
            <label className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">Behavioral_Profile</label>
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
                      'flex flex-col items-center gap-3 p-4 border transition-all duration-300 relative group overflow-hidden',
                      isSelected
                        ? 'bg-primary/10 border-primary/50 text-white'
                        : 'bg-black/20 border-white/5 text-muted-foreground hover:bg-white/5 hover:border-white/10'
                    )}
                  >
                    <Icon className={cn('h-5 w-5', isSelected ? 'text-primary' : 'opacity-40')} />
                    <span className="text-[9px] font-mono font-bold uppercase tracking-widest">{option.label}</span>
                    {isSelected && <div className="absolute bottom-0 left-0 h-[2px] w-full bg-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Full width First Message */}
        <div className="md:col-span-2 space-y-4 p-6 bg-primary/5 border border-primary/10 relative">
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-primary/40" />
          <label className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest block mb-2">System_Greeting_Initialization</label>
          <input
            type="text"
            value={firstMessage}
            onChange={(e) => onFirstMessageChange(e.target.value)}
            disabled={disabled}
            placeholder="INITIALIZING_TRANSMISSION..."
            className={cn(
              'w-full bg-black/40 border border-white/10 rounded-none px-4 py-4',
              'text-xs font-mono text-white placeholder:opacity-20 uppercase tracking-tight',
              'focus:outline-none focus:border-primary/50 transition-colors'
            )}
          />
          <div className="flex items-center gap-2 mt-2 opacity-40">
            <Zap className="h-3 w-3 text-primary" />
            <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest">
              Primary trigger message executed on terminal connection.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
