import { useState, useCallback } from 'react';
import { MessageSquare, Plus, Sparkles } from 'lucide-react';
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
    label: 'Be Polite',
    snippet: 'Always be polite and patient with callers.',
    icon: '🤝',
  },
  {
    label: 'Morning First',
    snippet: 'Suggest morning appointments first when available.',
    icon: '🌅',
  },
  {
    label: 'Confirm Details',
    snippet: 'Always confirm patient name and phone before booking.',
    icon: '✓',
  },
  {
    label: 'Transfer if Unsure',
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
  
  const handleAddTemplate = useCallback((snippet: string) => {
    const newValue = value.trim() ? `${value.trim()}\n${snippet}` : snippet;
    if (newValue.length <= maxLength) {
      onChange(newValue);
    }
  }, [value, onChange, maxLength]);
  
  return (
    <div className="glass-card p-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Instructions for Your AI Receptionist
          </h3>
          <p className="text-xs text-muted-foreground">
            Tell your AI how to behave with patients. Use simple language.
          </p>
        </div>
      </div>
      
      {/* Textarea with premium styling */}
      <div 
        className={cn(
          'relative rounded-xl transition-all duration-300',
          isFocused && 'ring-2 ring-primary/50 shadow-[0_0_20px_hsl(43_67%_52%_/_0.15)]'
        )}
      >
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          placeholder="Example: Always greet patients warmly. If they sound frustrated, apologize and offer to help. Suggest the earliest available appointment..."
          className={cn(
            'min-h-[140px] resize-none',
            'bg-white/5 border-white/10 rounded-xl',
            'text-foreground placeholder:text-muted-foreground/50',
            'focus:border-primary/50 focus-visible:ring-0 focus-visible:ring-offset-0',
            'transition-all duration-300'
          )}
          rows={5}
        />
        
        {/* Character counter */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <div className="h-1 w-16 bg-white/10 rounded-full overflow-hidden">
            <div 
              className={cn(
                'h-full transition-all duration-300 rounded-full',
                isAtLimit ? 'bg-destructive' : isNearLimit ? 'bg-warning' : 'bg-primary'
              )}
              style={{ width: `${Math.min(characterPercentage, 100)}%` }}
            />
          </div>
          <span 
            className={cn(
              'text-xs font-medium transition-colors',
              isAtLimit ? 'text-destructive' : isNearLimit ? 'text-warning' : 'text-muted-foreground'
            )}
          >
            {characterCount}/{maxLength}
          </span>
        </div>
      </div>
      
      {/* Template presets */}
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Quick Add
          </span>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {TEMPLATE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handleAddTemplate(preset.snippet)}
              disabled={disabled || isAtLimit}
              className={cn(
                'group flex items-center gap-2 px-3 py-2 rounded-xl',
                'bg-white/5 border border-white/10',
                'text-sm text-muted-foreground',
                'transition-all duration-200',
                'hover:bg-primary/10 hover:border-primary/30 hover:text-foreground',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <span>{preset.icon}</span>
              <span>{preset.label}</span>
              <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>
      
      {/* Helper text */}
      <p className="mt-4 text-xs text-muted-foreground/70">
        These instructions guide how your AI speaks with patients. You can update them anytime.
      </p>
    </div>
  );
}
