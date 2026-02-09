import { useState } from 'react';
import { Bell, Shield, User, Building, Phone, Clock, AlertTriangle, Check, Info, LogOut, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useClinic, WorkingHours, NotificationSettings } from '@/contexts/ClinicContext';
import { LoadingState } from '@/components/states/LoadingState';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { SystemTooltip } from '@/components/ui/SystemTooltip';
import { AIPracticeSettings } from '@/components/settings/AIPracticeSettings';
import { TwilioStatusCard } from '@/components/settings/TwilioStatusCard';

type SettingsTab = 'general' | 'ai';

const defaultWorkingHours: WorkingHours = {
  monday: { start: '08:00', end: '17:00', closed: false },
  tuesday: { start: '08:00', end: '17:00', closed: false },
  wednesday: { start: '08:00', end: '17:00', closed: false },
  thursday: { start: '08:00', end: '17:00', closed: false },
  friday: { start: '08:00', end: '17:00', closed: false },
  saturday: { start: '09:00', end: '13:00', closed: false },
  sunday: { start: '00:00', end: '00:00', closed: true },
};

const defaultNotificationSettings: NotificationSettings = {
  email_enabled: true,
  sms_enabled: true,
  action_required_timing: 'immediate',
};

export default function Settings() {
  const { user, profile, signOut } = useAuth();
  const { currentClinic, updateClinicSettings, isUpdating } = useClinic();
  
  const [showNotificationWarning, setShowNotificationWarning] = useState(false);
  const [pendingNotificationChange, setPendingNotificationChange] = useState<'email' | 'sms' | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  // Get settings from clinic with defaults
  const workingHours: WorkingHours = (currentClinic?.working_hours as WorkingHours) ?? defaultWorkingHours;
  const notificationSettings: NotificationSettings = (currentClinic?.notification_settings as NotificationSettings) ?? defaultNotificationSettings;

  const handleToggleNotification = (type: 'email' | 'sms') => {
    const currentValue = type === 'email' ? notificationSettings.email_enabled : notificationSettings.sms_enabled;
    
    if (currentValue) {
      setPendingNotificationChange(type);
      setShowNotificationWarning(true);
    } else {
      updateClinicSettings({ 
        notification_settings: {
          ...notificationSettings,
          [type === 'email' ? 'email_enabled' : 'sms_enabled']: true 
        }
      });
    }
  };

  const confirmNotificationDisable = () => {
    if (pendingNotificationChange === 'email') {
      updateClinicSettings({ 
        notification_settings: { ...notificationSettings, email_enabled: false }
      });
    } else if (pendingNotificationChange === 'sms') {
      updateClinicSettings({ 
        notification_settings: { ...notificationSettings, sms_enabled: false }
      });
    }
    setShowNotificationWarning(false);
    setPendingNotificationChange(null);
  };

  const cancelNotificationDisable = () => {
    setShowNotificationWarning(false);
    setPendingNotificationChange(null);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (!currentClinic) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
            System Configuration
          </h1>
          <p className="text-muted-foreground mt-1">
            Loading practice settings...
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LoadingState variant="card" />
          <LoadingState variant="card" />
          <LoadingState variant="card" />
          <LoadingState variant="card" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 stagger-children">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
          System Configuration
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure practice operations and AI behavior parameters.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/10 pb-0.5">
        <button
          onClick={() => setActiveTab('general')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors',
            activeTab === 'general'
              ? 'bg-white/5 text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            General Settings
          </div>
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium rounded-t-xl transition-colors',
            activeTab === 'ai'
              ? 'bg-white/5 text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI Practice Settings
          </div>
        </button>
      </div>

      {/* Notification Warning Modal */}
      {showNotificationWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-md p-6 animate-scale-in">
            <div className="flex items-start gap-4 mb-6">
              <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Disable {pendingNotificationChange === 'email' ? 'Email' : 'SMS'} Notifications?
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  You may miss critical action items and patient escalations
                </p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 mb-6">
              <p className="text-sm text-muted-foreground">
                <strong className="text-destructive">Warning:</strong> Disabling notifications means you will not receive alerts for:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 ml-4 list-disc space-y-1">
                <li>Appointments requiring manual intervention</li>
                <li>Patients marked unreachable</li>
                <li>AI escalation requests</li>
              </ul>
            </div>
            <div className="flex gap-3">
              <button
                onClick={cancelNotificationDisable}
                className="flex-1 py-2.5 text-sm font-medium text-foreground rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                Keep Enabled
              </button>
              <button
                onClick={confirmNotificationDisable}
                className="flex-1 py-2.5 text-sm font-medium text-destructive-foreground bg-destructive hover:bg-destructive/90 rounded-xl transition-colors"
              >
                Disable Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Practice Settings Tab */}
      {activeTab === 'ai' && (
        <AIPracticeSettings />
      )}

      {/* General Settings Tab */}
      {activeTab === 'general' && (
        <>
          {/* User Profile */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">
                  {profile?.full_name || user?.email || 'User'}
                </h3>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
              <button 
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>

          {/* Settings Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Practice Information */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Practice Information</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-sm text-muted-foreground">Practice Name</span>
                  <span className="text-sm text-foreground">{currentClinic.name}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-sm text-muted-foreground">Address</span>
                  <span className="text-sm text-foreground">{currentClinic.address || 'Not set'}</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-sm text-muted-foreground">Phone</span>
                  <span className="text-sm text-foreground">{currentClinic.phone || 'Not set'}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="text-sm text-foreground">{currentClinic.email || 'Not set'}</span>
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Alert Preferences</h3>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-sm text-muted-foreground">Email Notifications</span>
                  <button
                    onClick={() => handleToggleNotification('email')}
                    className={cn(
                      'relative h-6 w-11 rounded-full transition-colors',
                      notificationSettings.email_enabled ? 'bg-primary' : 'bg-muted'
                    )}
                    disabled={isUpdating}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                        notificationSettings.email_enabled ? 'left-5' : 'left-0.5'
                      )}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <span className="text-sm text-muted-foreground">SMS Alerts</span>
                  <button
                    onClick={() => handleToggleNotification('sms')}
                    className={cn(
                      'relative h-6 w-11 rounded-full transition-colors',
                      notificationSettings.sms_enabled ? 'bg-primary' : 'bg-muted'
                    )}
                    disabled={isUpdating}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
                        notificationSettings.sms_enabled ? 'left-5' : 'left-0.5'
                      )}
                    />
                  </button>
                </div>
                <div className="flex items-center justify-between py-3">
                  <span className="text-sm text-muted-foreground">Critical Action Alerts</span>
                  <select
                    value={notificationSettings.action_required_timing}
                    onChange={(e) => updateClinicSettings({ 
                      notification_settings: {
                        ...notificationSettings,
                        action_required_timing: e.target.value as 'immediate' | 'hourly' | 'daily' 
                      }
                    })}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-foreground focus:ring-1 focus:ring-primary focus:border-primary"
                    disabled={isUpdating}
                  >
                    <option value="immediate">Immediate</option>
                    <option value="hourly">Hourly Digest</option>
                    <option value="daily">Daily Summary</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Working Hours */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Operating Hours</h3>
                  <p className="text-xs text-muted-foreground">AI will not schedule outside these hours</p>
                </div>
              </div>
              <div className="space-y-3">
                {Object.entries(workingHours).map(([day, hours]) => {
                  const h = hours as { start: string; end: string; closed: boolean };
                  return (
                    <div
                      key={day}
                      className={cn(
                        'flex items-center justify-between py-3',
                        day !== 'sunday' && 'border-b border-white/5'
                      )}
                    >
                      <span className="text-sm text-muted-foreground capitalize">{day}</span>
                      <span className={cn(
                        'text-sm',
                        h.closed ? 'text-muted-foreground' : 'text-foreground'
                      )}>
                        {h.closed ? 'Closed' : `${h.start} – ${h.end}`}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 p-3 rounded-xl bg-info/5 border border-info/20">
                <p className="text-xs text-muted-foreground">
                  <span className="text-info font-medium">Note:</span> Calendar will visually block unavailable hours. 
                  AI will decline booking requests outside operating hours with explanation.
                </p>
              </div>
            </div>

            {/* Twilio Integration Status */}
            <TwilioStatusCard clinicPhone={currentClinic?.twilio_phone_number} />
          </div>

          {/* Security */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Security & Access</h3>
                <p className="text-sm text-muted-foreground">Manage credentials and authentication</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button className="p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left">
                <p className="text-sm font-medium text-foreground">Change Password</p>
                <p className="text-xs text-muted-foreground mt-1">Update login credentials</p>
              </button>
              <button className="p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left">
                <p className="text-sm font-medium text-foreground">Two-Factor Auth</p>
                <p className="text-xs text-muted-foreground mt-1">Add extra security layer</p>
              </button>
              <button className="p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left">
                <p className="text-sm font-medium text-foreground">Session History</p>
                <p className="text-xs text-muted-foreground mt-1">View login activity</p>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
