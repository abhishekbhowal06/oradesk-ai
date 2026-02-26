import { useState, useCallback } from 'react';
import { MessageSquare, Plus, Sparkles, Terminal, Cpu, Zap } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface SystemPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  disabled?: boolean;
}

const TEMPLATE_PRESETS = [
  {
    label: 'POLITE_PROTOCOL',
    snippet: 'Always be polite and patient with callers.',
    icon: '🤝',
  },
  {
    label: 'DAWN_BIAS',
    snippet: 'Suggest morning appointments first when available.',
    icon: '🌅',
  },
  {
    label: 'IDENTITY_VERIFY',
    snippet: 'Always confirm patient name and phone before booking.',
    icon: '✓',
  },
  {
    label: 'STAFF_FAILOVER',
    snippet: 'If you cannot answer a question, offer to transfer to staff.',
    icon: '📞',
  },
];

export function SystemPromptEditor({
  value,
  onChange,
  maxLength = 1000,
  disabled = false,
}: SystemPromptEditorProps) {
  const [isFocused, setIsFocused] = useState(false);

  const characterCount = value.length;
  const characterPercentage = (characterCount / maxLength) * 100;
  const isNearLimit = characterPercentage > 80;
  const isAtLimit = characterPercentage >= 100;

  const handleAddTemplate = useCallback(
    (snippet: string) => {
      const newValue = value.trim() ? `${value.trim()}\n${snippet}` : snippet;
      if (newValue.length <= maxLength) {
        onChange(newValue);
      }
    },
    [value, onChange, maxLength],
  );

  return (
    <div className="bg-[#051a1e] border border-white/10 p-8 shadow-[0_0_50px_rgba(0,0,0,0.3)] animate-fade-up">
      {/* Module Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="h-10 w-10 border border-primary/20 bg-primary/5 flex items-center justify-center text-primary">
          <Terminal className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-xs font-mono font-bold text-white uppercase tracking-[0.2em]">Neural Directives</h3>
          <p className="text-[9px] font-mono text-muted-foreground uppercase opacity-60 tracking-wider">Inject primary logic constraints into the AI cognition core.</p>
        </div>
      </div>

      {/* Editor Surface */}
      <div className={cn(
        'relative bg-black/40 border transition-all duration-300',
        isFocused ? 'border-primary/50 ring-1 ring-primary/20' : 'border-white/10'
      )}>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          placeholder="ENTER_CORE_COMMANDS..."
          className={cn(
            'min-h-[180px] resize-none border-none rounded-none',
            'bg-transparent font-mono text-xs uppercase tracking-tight text-white leading-relaxed',
            'placeholder:opacity-20 focus:ring-0 placeholder:text-primary/40'
          )}
          rows={6}
        />

        {/* Diagnostic Bar */}
        <div className="absolute bottom-0 left-0 w-full h-[3px] bg-white/5">
          <div
            className={cn(
              'h-full transition-all duration-500',
              isAtLimit ? 'bg-destructive' : isNearLimit ? 'bg-warning' : 'bg-primary'
            )}
            style={{ width: `${Math.min(characterPercentage, 100)}%` }}
          />
        </div>

        {/* Resource Counter */}
        <div className="absolute bottom-4 right-4 flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-mono font-bold text-muted-foreground uppercase opacity-40">Cognitive_Load</span>
            <span className={cn(
              'text-[10px] font-mono font-bold',
              isAtLimit ? 'text-destructive' : isNearLimit ? 'text-warning' : 'text-primary'
            )}>
              {characterCount} / {maxLength}
            </span>
          </div>
          <Cpu className={cn("h-4 w-4", isAtLimit ? "text-destructive" : "text-primary/40")} />
        </div>
      </div>

      {/* Macro Presets */}
      <div className="mt-8 border-t border-white/5 pt-6">
        <div className="flex items-center gap-3 mb-5">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-60">
            Logic_Macros
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TEMPLATE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handleAddTemplate(preset.snippet)}
              disabled={disabled || isAtLimit}
              className={cn(
                'group flex items-center justify-between px-3 py-3 border transition-all duration-300',
                'bg-white/5 border-white/5 text-[9px] font-mono font-bold text-muted-foreground uppercase tracking-widest',
                'hover:bg-primary/5 hover:border-primary/20 hover:text-white',
                'disabled:opacity-20'
              )}
            >
              <div className="flex items-center gap-2">
                <span>{preset.icon}</span>
                <span>{preset.label}</span>
              </div>
              <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-start gap-3 opacity-40">
        <Sparkles className="h-3 w-3 text-primary mt-1" />
        <p className="text-[8px] font-mono text-muted-foreground uppercase leading-relaxed max-w-lg">
          Directives are parsed by the high-level reasoning engine. Use imperative commands for maximum behavioral alignment.
        </p>
      </div>
    </div>
  );
}
