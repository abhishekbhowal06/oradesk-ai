import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { X, Phone, Pause, Play } from 'lucide-react';
import { useClinic } from '@/contexts/ClinicContext';
import { cn } from '@/lib/utils';

const BANNER_DISMISSED_KEY = 'dentacor_ai_banner_dismissed';

export function AIStatusBanner() {
  const { currentClinic, updateClinicSettings, isUpdating } = useClinic();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(BANNER_DISMISSED_KEY);
    if (dismissed === currentClinic?.id) {
      setIsDismissed(true);
    }
  }, [currentClinic?.id]);

  // Don't show if no clinic, not onboarded, or dismissed
  if (!currentClinic || !(currentClinic as any).onboarding_completed || isDismissed) {
    return null;
  }

  const isAIActive = currentClinic.ai_settings.confirmation_calls_enabled;

  const handleDismiss = () => {
    setIsDismissed(true);
    if (currentClinic?.id) {
      localStorage.setItem(BANNER_DISMISSED_KEY, currentClinic.id);
    }
  };

  const handleToggleAI = async () => {
    await updateClinicSettings({
      ai_settings: {
        ...currentClinic.ai_settings,
        confirmation_calls_enabled: !isAIActive,
      },
    });
  };

  return (
    <div className={cn(
      "relative px-4 py-3 border-b transition-colors",
      isAIActive 
        ? "bg-success/10 border-success/20" 
        : "bg-muted/30 border-border"
    )}>
      <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
        {/* Status */}
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-2 w-2 rounded-full",
            isAIActive ? "bg-success animate-pulse" : "bg-muted-foreground"
          )} />
          <div>
            <span className={cn(
              "font-medium text-sm",
              isAIActive ? "text-success" : "text-muted-foreground"
            )}>
              AI Receptionist is {isAIActive ? 'active' : 'paused'}
            </span>
            <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
              {isAIActive ? 'Handling calls & follow-ups' : 'Not handling calls'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleAI}
            disabled={isUpdating}
            className={cn(
              "text-xs h-8",
              isAIActive 
                ? "text-muted-foreground hover:text-foreground" 
                : "text-success hover:text-success/80"
            )}
          >
            {isAIActive ? (
              <>
                <Pause className="h-3.5 w-3.5 mr-1.5" />
                Pause AI
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Resume AI
              </>
            )}
          </Button>

          <Link to="/call-logs">
            <Button variant="ghost" size="sm" className="text-xs h-8">
              <Phone className="h-3.5 w-3.5 mr-1.5" />
              View Call Logs
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
