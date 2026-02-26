import React, { useState, useEffect } from 'react';
import {
  Building2,
  Users,
  ShieldCheck,
  Bell,
  CreditCard,
  Bot,
  LogOut,
  Upload,
  Download,
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useClinic } from '@/contexts/ClinicContext';
import { LoadingState } from '@/components/states/LoadingState';

// New Moduar Components
import { SettingsProfile } from '@/components/settings/SettingsProfile';
import { SettingsUsers } from '@/components/settings/SettingsUsers';
import { SettingsSecurity } from '@/components/settings/SettingsSecurity';
import { SettingsNotifications } from '@/components/settings/SettingsNotifications';
import { SettingsBilling } from '@/components/settings/SettingsBilling';
import { AIPracticeSettings } from '@/components/settings/AIPracticeSettings';
import { GlobalSaveBar } from '@/components/ui/GlobalSaveBar';

import { toast } from 'sonner';

type SettingsTab = 'profile' | 'users' | 'security' | 'notifications' | 'billing' | 'ai';

const NAV_ITEMS = [
  { id: 'profile', label: 'Clinic Profile & Identity', icon: Building2 },
  { id: 'users', label: 'User & Role Management', icon: Users },
  { id: 'security', label: 'Security & Compliance', icon: ShieldCheck },
  { id: 'notifications', label: 'Notification Rules', icon: Bell },
  { id: 'billing', label: 'Subscription & Billing', icon: CreditCard },
  { id: 'ai', label: 'AI Agent Configuration', icon: Bot },
];

export default function Settings() {
  const { user, profile, signOut } = useAuth();
  const { currentClinic, updateClinicSettings, isUpdating } = useClinic();

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Triggered by child components when an input changes
  const markDirty = () => setIsDirty(true);

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate API save
    await new Promise(resolve => setTimeout(resolve, 800));
    toast.success('Configuration saved successfully.', { description: 'All changes have been applied to your clinic environment.' });
    setIsDirty(false);
    setIsSaving(false);
  };

  const handleRevert = () => {
    // In a real app, reset form states to currentClinic values.
    toast.info('Changes reverted.', { description: 'Your configuration has been restored to the last saved state.' });
    setIsDirty(false);
  };

  if (!currentClinic) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <ShieldCheck className="h-10 w-10 text-[#0d5e5e]/40 animate-pulse" />
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Loading Governance Data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-32">

      {/* Global Save Footer */}
      <GlobalSaveBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={handleSave}
        onRevert={handleRevert}
      />

      {/* Header */}
      <div className="relative border-b border-slate-200 pb-8 flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
        <div className="space-y-3">
          <h1 className="text-3xl font-black tracking-tight text-slate-800">
            Administration & Governance
          </h1>
          <p className="text-sm font-medium text-slate-500 max-w-xl">
            Manage your practice identity, roles, security compliance, and system workflows.
          </p>
          <div className="flex items-center gap-4 mt-4 text-[10px] font-bold uppercase tracking-widest text-[#0d5e5e]">
            <button className="flex items-center gap-1.5 hover:text-emerald-600 transition-colors">
              <Download className="w-3 h-3" /> Export JSON
            </button>
            <button className="flex items-center gap-1.5 hover:text-emerald-600 transition-colors">
              <Upload className="w-3 h-3" /> Import Config
            </button>
            <span className="flex items-center gap-1.5 text-slate-400">
              <History className="w-3 h-3" /> Last updated by Admin (2 hours ago)
            </span>
          </div>
        </div>

        {/* User Profile Summary */}
        <div className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold border border-emerald-200">
            {profile?.full_name?.charAt(0) || 'A'}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-700">{profile?.full_name || 'Admin User'}</span>
            <span className="text-xs font-medium text-slate-500">{user?.email || 'admin@clinic.com'}</span>
          </div>
          <div className="h-8 w-px bg-slate-100 mx-2"></div>
          <button
            onClick={() => signOut()}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 2-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-8">

        {/* Left Vertical Mini-Nav */}
        <div className="w-full lg:w-64 shrink-0 flex flex-col gap-2">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as SettingsTab)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-bold text-left",
                activeTab === item.id
                  ? "bg-[#0d5e5e] text-white shadow-md relative"
                  : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
              )}
            >
              <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-emerald-300" : "text-slate-400")} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Right Content Area */}
        <div className="flex-1 min-w-0">
          {activeTab === 'profile' && <SettingsProfile markDirty={markDirty} />}
          {activeTab === 'users' && <SettingsUsers markDirty={markDirty} />}
          {activeTab === 'security' && <SettingsSecurity markDirty={markDirty} />}
          {activeTab === 'notifications' && <SettingsNotifications markDirty={markDirty} />}
          {activeTab === 'billing' && <SettingsBilling />}

          {activeTab === 'ai' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex flex-col gap-1 border-b border-border/50 pb-5">
                <h2 className="text-2xl font-bold tracking-tight text-slate-800">AI Agent Configuration</h2>
                <p className="text-sm text-slate-500 font-medium">Configure advanced voice properties, conversational strictness, and scheduling boundaries.</p>
              </div>
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
                <AIPracticeSettings />
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
