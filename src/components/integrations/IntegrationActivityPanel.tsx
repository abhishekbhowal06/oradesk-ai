import React from 'react';
import { Activity, AlertCircle, HardDrive, CheckCircle2, Clock } from 'lucide-react';

export const IntegrationActivityPanel = () => {
    return (
        <div className="w-full xl:w-80 shrink-0 space-y-6">

            {/* Activity Overview */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[#0d5e5e]" />
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Live Activity</h3>
                </div>

                <div className="p-5 space-y-5">
                    <div>
                        <div className="flex justify-between items-end mb-1">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Data Volume Today</span>
                            <span className="text-sm font-black text-[#0d5e5e]">1,248</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#0d5e5e] rounded-full" style={{ width: '65%' }}></div>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 block">Records processed across all uplinks</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex flex-col items-center justify-center">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500 mb-1" />
                            <span className="text-lg font-black text-emerald-700">1.2k</span>
                            <span className="text-[9px] font-bold text-emerald-600/70 uppercase">Success</span>
                        </div>
                        <div className="bg-red-50/50 border border-red-100 rounded-xl p-3 flex flex-col items-center justify-center">
                            <AlertCircle className="h-5 w-5 text-red-500 mb-1" />
                            <span className="text-lg font-black text-red-700">3</span>
                            <span className="text-[9px] font-bold text-red-600/70 uppercase">Errors</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sync Log */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Event Log</h3>
                    <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded">Last 1h</span>
                </div>

                <div className="p-0">
                    {[
                        { action: 'Patient Sync', source: 'OpenDental', status: 'success', time: '2m ago' },
                        { action: 'Call Logged', source: 'Twilio', status: 'success', time: '14m ago' },
                        { action: 'Webhook Fired', source: 'HubSpot', status: 'error', time: '32m ago' },
                        { action: 'Calendar Updated', source: 'Google', status: 'success', time: '45m ago' },
                        { action: 'Invoice Sent', source: 'Stripe', status: 'success', time: '55m ago' },
                    ].map((log, i) => (
                        <div key={i} className="flex items-start gap-3 p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                            <div className={`mt-0.5 shrink-0 h-2 w-2 rounded-full ${log.status === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                            <div className="flex-1 space-y-0.5">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-700">{log.action}</span>
                                    <span className="text-[10px] text-slate-400 flex items-center"><Clock className="h-2.5 w-2.5 mr-1" />{log.time}</span>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{log.source}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

        </div>
    );
};
