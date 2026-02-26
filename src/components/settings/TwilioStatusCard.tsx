import { Phone, Check, AlertCircle } from 'lucide-react';

interface TwilioStatusCardProps {
  clinicPhone: string | null | undefined;
}

export function TwilioStatusCard({ clinicPhone }: TwilioStatusCardProps) {
  const isConfigured = !!clinicPhone && clinicPhone.trim().length > 0;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl bg-info/10 flex items-center justify-center">
          <Phone className="h-5 w-5 text-info" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Telephony Integration</h3>
          <p className="text-sm text-muted-foreground">Twilio connection for AI calls</p>
        </div>
      </div>

      {isConfigured ? (
        <div className="p-4 rounded-xl bg-success/5 border border-success/20">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-success" />
            <span className="text-sm text-success font-medium">Twilio Connected</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            AI calling system is configured with {clinicPhone}
          </p>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-warning/5 border border-warning/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-warning" />
            <span className="text-sm text-warning font-medium">Twilio Not Configured</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            No Twilio phone number assigned to this clinic. AI calls will not work until configured.
          </p>
        </div>
      )}
    </div>
  );
}
