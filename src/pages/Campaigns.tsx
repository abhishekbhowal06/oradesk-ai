import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Phone,
  MessageSquare,
  Pause,
  Play,
  Activity,
  Calendar,
  CreditCard,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useClinic } from '@/contexts/ClinicContext';

// Interfaces mapping to Supabase structure or derived types
interface PatientQueueItem {
  id: string;
  patient_name: string;
  treatment: string;
  reason: string;
  days_since_visit: number;
  channel: 'WhatsApp' | 'SMS' | 'Call';
  status: 'Pending' | 'Sent' | 'Replied';
  auto_mode: boolean;
  selected?: boolean;
}

export default function Campaigns() {
  const { currentClinic } = useClinic();
  const [patients, setPatients] = useState<PatientQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Automation Rules State
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [rules, setRules] = useState({
    missedAppt: true,
    highValue: false,
    sixMonth: true,
    paymentReminder: false,
  });

  // Engine State
  const [engineActive, setEngineActive] = useState(true);
  const [communicationMode, setCommunicationMode] = useState<'local_ai' | 'existing'>('local_ai');
  const [isNumberModalOpen, setIsNumberModalOpen] = useState(false);

  // Regional Logic
  const isIndia = currentClinic?.timezone?.includes('Asia/Kolkata') || false;
  const recommendedPrimary = isIndia ? 'WhatsApp' : 'SMS';
  const recommendedBackup = 'Call';

  useEffect(() => {
    fetchFollowUpQueue();
  }, [isIndia]);

  const fetchFollowUpQueue = async () => {
    try {
      setLoading(true);
      // Mock data representing the follow-up queue
      const mockData: PatientQueueItem[] = [
        {
          id: '1',
          patient_name: 'Sarah Jenkins',
          treatment: 'Root Canal',
          reason: 'Post-op check',
          days_since_visit: 2,
          channel: isIndia ? 'WhatsApp' : 'SMS',
          status: 'Pending',
          auto_mode: true,
        },
        {
          id: '2',
          patient_name: 'David Chen',
          treatment: 'Crown Prep',
          reason: 'Treatment plan follow-up',
          days_since_visit: 4,
          channel: 'Call',
          status: 'Sent',
          auto_mode: true,
        },
        {
          id: '3',
          patient_name: 'Maria Garcia',
          treatment: 'Cleaning',
          reason: '6 Month Recall',
          days_since_visit: 180,
          channel: recommendedPrimary,
          status: 'Replied',
          auto_mode: false,
        },
        {
          id: '4',
          patient_name: 'James Wilson',
          treatment: 'Extraction',
          reason: 'Missed Appointment',
          days_since_visit: 1,
          channel: recommendedPrimary,
          status: 'Pending',
          auto_mode: true,
        },
        {
          id: '5',
          patient_name: 'Linda Martinez',
          treatment: 'Implant Consult',
          reason: 'High Value Quote',
          days_since_visit: 7,
          channel: 'Call',
          status: 'Pending',
          auto_mode: false,
        },
      ];
      setPatients(mockData);
    } catch (error) {
      toast.error('Failed to load queue');
    } finally {
      setLoading(false);
    }
  };

  const toggleAutoMode = (id: string, current: boolean) => {
    setPatients(patients.map((p) => (p.id === id ? { ...p, auto_mode: !current } : p)));
    toast.success(`Auto Mode ${!current ? 'Enabled' : 'Disabled'} for patient`);
  };

  const toggleSelection = (id: string) => {
    setPatients(patients.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)));
  };

  const toggleAllSelection = () => {
    const allSelected = patients.length > 0 && patients.every((p) => p.selected);
    setPatients(patients.map((p) => ({ ...p, selected: !allSelected })));
  };

  const handleSendNow = (name: string) => {
    toast.success(`Follow-up sent to ${name}`);
  };

  const selectedCount = patients.filter((p) => p.selected).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 w-full">
      {/* 1. Top Section: AI Outreach Engine Bar */}
      <div className="bg-white border text-foreground rounded-2xl p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div
            className={cn(
              'flex shrink-0 items-center justify-center h-12 w-12 rounded-xl',
              engineActive ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500',
            )}
          >
            <Activity className={cn('h-6 w-6', engineActive && 'animate-pulse')} />
          </div>
          <div>
            <h2 className="text-xl font-bold">AI Outreach Engine</h2>
            <div className="flex items-center gap-2 mt-1 text-sm font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5 font-semibold">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    engineActive ? 'bg-emerald-500' : 'bg-slate-300',
                  )}
                />
                <span className={engineActive ? 'text-emerald-600' : 'text-slate-500'}>
                  {engineActive ? 'Active' : 'Paused'}
                </span>
              </span>
              <span className="text-slate-300 hidden sm:inline">•</span>
              <span className="hidden sm:inline">Calling From: +1 (555) 019-2834</span>
            </div>
            <div className="sm:hidden text-xs text-muted-foreground mt-0.5">
              Number: +1 (555) 019-2834
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto justify-end">
          <Badge
            variant="outline"
            className="bg-slate-50 text-slate-600 border-slate-200 px-3 py-1 font-semibold rounded-lg hidden md:flex"
          >
            Priority: {recommendedPrimary} → {recommendedBackup}
          </Badge>

          <Dialog open={isNumberModalOpen} onOpenChange={setIsNumberModalOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-[#0d5e5e] border-[#0d5e5e]/20 hover:bg-[#0d5e5e]/5 font-semibold rounded-xl sm:h-10"
              >
                Change Number
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold text-[#0d5e5e]">
                  How should AI contact patients?
                </DialogTitle>
                <DialogDescription className="text-sm">
                  Choose the primary phone number your AI assistant will use.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <button
                  onClick={() => setCommunicationMode('local_ai')}
                  className={cn(
                    'w-full flex items-start flex-col sm:flex-row gap-3 sm:gap-4 p-4 rounded-xl border-2 text-left transition-all',
                    communicationMode === 'local_ai'
                      ? 'border-[#0d5e5e] bg-[#0d5e5e]/5'
                      : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50',
                  )}
                >
                  <div
                    className={cn(
                      'mt-1 shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center',
                      communicationMode === 'local_ai' ? 'border-[#0d5e5e]' : 'border-slate-300',
                    )}
                  >
                    {communicationMode === 'local_ai' && (
                      <div className="h-2.5 w-2.5 rounded-full bg-[#0d5e5e]" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground flex flex-wrap items-center gap-2">
                      Local Clinic AI Number
                      <Badge className="bg-[#0d5e5e]/10 text-[#0d5e5e] hover:bg-[#0d5e5e]/20 border-none px-2 py-0 text-xs">
                        Recommended
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      We provide a dedicated local number for your AI.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setCommunicationMode('existing')}
                  className={cn(
                    'w-full flex items-start flex-col sm:flex-row gap-3 sm:gap-4 p-4 rounded-xl border-2 text-left transition-all',
                    communicationMode === 'existing'
                      ? 'border-[#0d5e5e] bg-[#0d5e5e]/5'
                      : 'border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50',
                  )}
                >
                  <div
                    className={cn(
                      'mt-1 shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center',
                      communicationMode === 'existing' ? 'border-[#0d5e5e]' : 'border-slate-300',
                    )}
                  >
                    {communicationMode === 'existing' && (
                      <div className="h-2.5 w-2.5 rounded-full bg-[#0d5e5e]" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">
                      Use My Existing Clinic Number
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      AI will route calls using your current office number.
                    </p>
                  </div>
                </button>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  className="bg-[#0d5e5e] hover:bg-[#0d5e5e]/90 text-white rounded-xl px-6 font-semibold"
                  onClick={() => setIsNumberModalOpen(false)}
                >
                  Save Preference
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex text-slate-600 border-slate-200 hover:bg-slate-50 font-semibold rounded-xl h-10"
          >
            Test Call
          </Button>
          <Button
            size="sm"
            className={cn(
              'text-white font-semibold rounded-xl px-4 sm:px-6 h-9 sm:h-10',
              engineActive
                ? 'bg-rose-500 hover:bg-rose-600'
                : 'bg-emerald-500 hover:bg-emerald-600',
            )}
            onClick={() => setEngineActive(!engineActive)}
          >
            {engineActive ? (
              <>
                <Pause className="mr-2 h-4 w-4" />{' '}
                <span className="hidden sm:inline">Pause Engine</span>
                <span className="sm:hidden">Pause</span>
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4 fill-white" />{' '}
                <span className="hidden sm:inline">Start Engine</span>
                <span className="sm:hidden">Start</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column (Main Queue & Stats) - 3/4 width on desktop */}
        <div className="lg:col-span-3 space-y-6">
          {/* 4. Activity & Revenue Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border rounded-2xl p-4 shadow-sm">
              <p className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Calls Today
              </p>
              <div className="text-2xl sm:text-3xl font-bold text-foreground mt-1 font-serif-numbers">
                42
              </div>
            </div>
            <div className="bg-white border rounded-2xl p-4 shadow-sm">
              <p className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Messages Sent
              </p>
              <div className="text-2xl sm:text-3xl font-bold text-foreground mt-1 font-serif-numbers">
                156
              </div>
            </div>
            <div className="bg-white border rounded-2xl p-4 shadow-sm">
              <p className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Appts Booked
              </p>
              <div className="text-2xl sm:text-3xl font-bold text-[#0d5e5e] mt-1 font-serif-numbers">
                8
              </div>
            </div>
            <div className="bg-[#0d5e5e]/5 border border-[#0d5e5e]/20 rounded-2xl p-4 shadow-sm">
              <p className="text-xs sm:text-sm font-bold text-[#0d5e5e] uppercase tracking-wider">
                Revenue Recovered
              </p>
              <div className="text-2xl sm:text-3xl font-extrabold text-[#0d5e5e] mt-1 font-serif-numbers">
                $4,820
              </div>
            </div>
          </div>

          {/* 2. Follow-Up Queue (Main Section) */}
          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            <div className="p-4 sm:p-5 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50/50">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground">
                  Patients Requiring Follow-Up
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  Review and manage patients AI has identified for contact.
                </p>
              </div>
              {selectedCount > 0 && (
                <div className="flex flex-wrap items-center gap-3 animate-in fade-in zoom-in-95 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-200">
                  <span className="text-sm font-semibold text-[#0d5e5e] bg-[#0d5e5e]/5 px-3 py-1.5 rounded-lg">
                    {selectedCount} selected
                  </span>
                  <Button
                    size="sm"
                    className="bg-[#0d5e5e] hover:bg-[#0d5e5e]/90 text-white rounded-lg flex-1 sm:flex-none"
                  >
                    Send Batch via AI
                  </Button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-5 py-4 w-12 text-center">
                      <Checkbox
                        checked={patients.length > 0 && patients.every((p) => p.selected)}
                        onCheckedChange={toggleAllSelection}
                        className="rounded border-slate-300 data-[state=checked]:bg-[#0d5e5e] data-[state=checked]:border-[#0d5e5e]"
                      />
                    </th>
                    <th className="px-5 py-4">Patient Name</th>
                    <th className="px-5 py-4">Treatment / Reason</th>
                    <th className="px-5 py-4">Days</th>
                    <th className="px-5 py-4">Channel</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-center">Auto Mode</th>
                    <th className="px-5 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                        Loading queue...
                      </td>
                    </tr>
                  ) : patients.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                        Queue is empty.
                      </td>
                    </tr>
                  ) : (
                    patients.map((p) => (
                      <tr
                        key={p.id}
                        className={cn(
                          'hover:bg-slate-50 transition-colors group',
                          p.selected && 'bg-[#0d5e5e]/[0.02]',
                        )}
                      >
                        <td className="px-5 py-4 text-center">
                          <Checkbox
                            checked={p.selected || false}
                            onCheckedChange={() => toggleSelection(p.id)}
                            className="rounded border-slate-300 data-[state=checked]:bg-[#0d5e5e] data-[state=checked]:border-[#0d5e5e]"
                          />
                        </td>
                        <td className="px-5 py-4 font-bold text-foreground text-base">
                          {p.patient_name}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-700">{p.treatment}</div>
                          <div className="text-xs font-medium text-slate-500 mt-0.5">
                            {p.reason}
                          </div>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-600">
                          {p.days_since_visit}d
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 opacity-90">
                            {p.channel === 'WhatsApp' ? (
                              <MessageSquare className="h-4 w-4 text-emerald-500" />
                            ) : p.channel === 'SMS' ? (
                              <MessageSquare className="h-4 w-4 text-blue-500 fill-blue-500/20" />
                            ) : (
                              <Phone className="h-4 w-4 text-[#0d5e5e] fill-[#0d5e5e]/20" />
                            )}
                            <span className="font-semibold text-sm text-slate-600">
                              {p.channel}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <Badge
                            variant="outline"
                            className={cn(
                              'font-bold uppercase tracking-wider text-[10px] px-2.5 py-0.5 border-transparent',
                              p.status === 'Pending'
                                ? 'bg-slate-100 text-slate-600'
                                : p.status === 'Sent'
                                  ? 'bg-blue-50 text-blue-600'
                                  : 'bg-emerald-50 text-emerald-700',
                            )}
                          >
                            {p.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-center items-center">
                            <Switch
                              checked={p.auto_mode}
                              onCheckedChange={() => toggleAutoMode(p.id, p.auto_mode)}
                              className={cn(
                                'scale-90',
                                p.auto_mode && 'data-[state=checked]:bg-emerald-500',
                              )}
                            />
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#0d5e5e] hover:text-[#0d5e5e] hover:bg-[#0d5e5e]/10 font-bold rounded-lg h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleSendNow(p.patient_name)}
                          >
                            Send Now
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (Automation Rules) - 1/4 width on desktop */}
        <div className="space-y-6">
          {/* 3. Automation Rules Section */}
          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden sticky top-6">
            <div className="p-5 border-b bg-slate-50/50">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Settings className="h-4 w-4 text-[#0d5e5e]" /> Automation Rules
              </h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Select when AI should automatically add patients to queue.
              </p>
            </div>

            <div className="p-5 space-y-6">
              <div className="flex items-start justify-between group">
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-500" /> Missed Appointment
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed pr-4">
                    Add no-shows and cancellations to queue
                  </div>
                </div>
                <Switch
                  checked={rules.missedAppt}
                  onCheckedChange={(c) => setRules({ ...rules, missedAppt: c })}
                  className="data-[state=checked]:bg-[#0d5e5e] shrink-0 mt-0.5"
                />
              </div>

              <div className="flex items-start justify-between group">
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4 text-amber-500" /> High Value Tx
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed pr-4">
                    Follow up on pending 1k+ treatment plans
                  </div>
                </div>
                <Switch
                  checked={rules.highValue}
                  onCheckedChange={(c) => setRules({ ...rules, highValue: c })}
                  className="data-[state=checked]:bg-[#0d5e5e] shrink-0 mt-0.5"
                />
              </div>

              <div className="flex items-start justify-between group">
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-500" /> 6 Month Recall
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed pr-4">
                    Routine hygiene due follow-ups
                  </div>
                </div>
                <Switch
                  checked={rules.sixMonth}
                  onCheckedChange={(c) => setRules({ ...rules, sixMonth: c })}
                  className="data-[state=checked]:bg-[#0d5e5e] shrink-0 mt-0.5"
                />
              </div>

              <div className="flex items-start justify-between group">
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-slate-400" /> Payment Reminder
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed pr-4">
                    Overdue balance notifications
                  </div>
                </div>
                <Switch
                  checked={rules.paymentReminder}
                  onCheckedChange={(c) => setRules({ ...rules, paymentReminder: c })}
                  className="data-[state=checked]:bg-[#0d5e5e] shrink-0 mt-0.5"
                />
              </div>
            </div>

            <div className="border-t bg-slate-50/50">
              <button
                className="w-full flex items-center justify-center gap-2 p-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-[#0d5e5e] hover:bg-slate-100 transition-colors"
                onClick={() => setRulesExpanded(!rulesExpanded)}
              >
                {rulesExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" /> Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" /> Advanced Settings
                  </>
                )}
              </button>

              {rulesExpanded && (
                <div className="p-5 pt-2 border-t bg-slate-50 space-y-5 animate-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Delay Before First Follow-Up
                    </label>
                    <select className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-semibold bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-[#0d5e5e]/20">
                      <option>Next Day Morning</option>
                      <option>Same Day Evening</option>
                      <option>2 Days Later</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Max Attempts
                    </label>
                    <select className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm font-semibold bg-white text-foreground focus:outline-none focus:ring-2 focus:ring-[#0d5e5e]/20">
                      <option>3 attempts (Recommended)</option>
                      <option>2 attempts</option>
                      <option>1 attempt</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
