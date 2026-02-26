import React from 'react';
import { Activity, RefreshCcw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const SystemConnectivityHeader = () => {
    return (
        <div className="relative mb-8 bg-white/70 backdrop-blur-xl border border-slate-200 shadow-sm rounded-2xl px-6 py-5 flex flex-col md:flex-row justify-between items-center gap-4 transition-all duration-300">

            {/* Left side: Stats */}
            <div className="flex items-center gap-8">
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Connected</span>
                    <span className="text-2xl font-black text-[#0d5e5e] leading-none">3 <span className="text-sm text-slate-400 font-bold">/ 12</span></span>
                </div>

                <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Data Sync Status</span>
                    <div className="flex items-center gap-2">
                        <div className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </div>
                        <span className="text-sm font-bold text-emerald-600">Live</span>
                    </div>
                </div>

                <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

                <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Last Sync Time</span>
                    <span className="text-sm font-bold text-slate-700">Just now</span>
                </div>
            </div>

            {/* Right side: Actions & Health */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-emerald-50/50 px-3 py-1.5 rounded-lg border border-emerald-100">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-700">All Systems Healthy</span>
                </div>
                <Button variant="outline" className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700 font-bold shadow-sm rounded-xl">
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Manual Sync
                </Button>
            </div>

        </div>
    );
};
