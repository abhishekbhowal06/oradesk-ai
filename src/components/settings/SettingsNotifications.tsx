import React from 'react';
import { Bell, Smartphone, Mail, AlertTriangle, MessageSquare, CreditCard, Activity } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export function SettingsNotifications({ markDirty }: { markDirty: () => void }) {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-1 border-b border-border/50 pb-5">
                <h2 className="text-2xl font-bold tracking-tight text-slate-800">Notification & Automation Rules</h2>
                <p className="text-sm text-slate-500 font-medium">Control who receives critical alerts, routing rules, and engagement channels.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* Left Toggles */}
                <div className="xl:col-span-2 space-y-6">

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-4">
                            <Activity className="w-4 h-4 text-[#0d5e5e]" /> Event Driven Alerts
                        </h3>

                        <div className="space-y-4">

                            {/* Event Block */}
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50 transition-colors">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Escalation Alerts</span>
                                    <span className="text-xs text-slate-500 mt-1 max-w-md leading-relaxed">Immediately notify staff when patient requests a human supervisor or mentions a medical emergency during an AI call.</span>
                                    <div className="flex gap-2 mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        <span className="bg-white px-2 py-1 rounded-md border border-slate-200 flex items-center gap-1.5"><Smartphone className="w-3 h-3 text-[#0d5e5e]" /> SMS: Owner</span>
                                        <span className="bg-white px-2 py-1 rounded-md border border-slate-200 flex items-center gap-1.5"><Mail className="w-3 h-3 text-[#0d5e5e]" /> Email: Front Desk</span>
                                    </div>
                                </div>
                                <Switch defaultChecked onCheckedChange={markDirty} />
                            </div>

                            {/* Event Block */}
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50 transition-colors">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><Activity className="w-4 h-4 text-orange-500" /> Low AI Confidence Alert</span>
                                    <span className="text-xs text-slate-500 mt-1 max-w-md leading-relaxed">Notify when the AI engine confidence score drops below 40% during complex schedule parsing.</span>
                                    <div className="flex gap-2 mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        <span className="bg-white px-2 py-1 rounded-md border border-slate-200 flex items-center gap-1.5"><MessageSquare className="w-3 h-3 text-[#0d5e5e]" /> WhatsApp: Admin</span>
                                    </div>
                                </div>
                                <Switch defaultChecked onCheckedChange={markDirty} />
                            </div>

                            {/* Event Block */}
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50 transition-colors">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-700 flex items-center gap-2"><CreditCard className="w-4 h-4 text-rose-500" /> Payment Failure Alert</span>
                                    <span className="text-xs text-slate-500 mt-1 max-w-md leading-relaxed">Alert billing department when an automated deposit collection strategy fails or card is declined mid-call.</span>
                                    <div className="flex gap-2 mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        <span className="bg-white px-2 py-1 rounded-md border border-slate-200 flex items-center gap-1.5"><Mail className="w-3 h-3 text-[#0d5e5e]" /> Email: Admin</span>
                                    </div>
                                </div>
                                <Switch defaultChecked onCheckedChange={markDirty} />
                            </div>

                        </div>
                    </div>

                </div>

                {/* Right Preview */}
                <div className="xl:col-span-1">
                    <div className="sticky top-8 bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm overflow-hidden relative">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[#0d5e5e] mb-4 flex items-center gap-2">
                            <Bell className="w-4 h-4" /> Notification Preview
                        </h3>

                        {/* Mock SMS */}
                        <div className="bg-white rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200 overflow-hidden relative">
                            <div className="bg-slate-100 p-3 text-center border-b border-slate-200">
                                <span className="text-xs font-bold text-slate-600">SMS Format Demo</span>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="bg-emerald-50 text-emerald-900 text-sm font-medium p-3 rounded-2xl rounded-tl-sm shadow-sm inline-block max-w-[85%] border border-emerald-100">
                                    <strong className="block text-xs font-bold uppercase tracking-widest mb-1 text-emerald-700">OraDesk System [URGENT]</strong>
                                    Escalation triggered by AI Agent: Patient requested human supervisor during consultation call regarding post-op pain.
                                    <br /><br />
                                    Call ID: 94A-21X
                                    <br />
                                    <a href="#" className="font-bold underline">Reply to assist</a>
                                </div>
                            </div>
                        </div>

                        <p className="text-[10px] text-slate-400 font-bold text-center mt-6 uppercase tracking-wider">
                            Sample escalation format
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}
