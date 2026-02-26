import React from 'react';
import { Activity, Zap, Cpu, History } from 'lucide-react';

export function IntelligenceTopbar() {
    return (
        <div className="w-full bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between shadow-sm sticky top-0 z-50">

            {/* Left: Branding & Version */}
            <div className="flex items-center gap-4">
                <h1 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                    Clinical Command<span className="text-emerald-600 text-2xl leading-none font-normal mb-1">.</span>
                </h1>
                <div className="h-4 w-[1px] bg-slate-200 mx-2" />
                <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded text-[10px] font-semibold text-slate-600 uppercase tracking-widest border border-slate-200">
                    <Cpu className="w-3 h-3" /> Core OS v4.2
                </div>
            </div>

            {/* Right: Telemetry Strip */}
            <div className="flex items-center gap-8">

                {/* Cost & Usage */}
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Today's Usage</p>
                        <p className="text-sm font-medium text-slate-800">124k Tokens</p>
                    </div>
                    <div className="h-6 w-[1px] bg-slate-200" />
                    <div className="text-left">
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Est. Cost</p>
                        <p className="text-sm font-bold text-emerald-600">$2.45</p>
                    </div>
                </div>

                {/* Sync Status */}
                <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                        <Activity className="w-3 h-3" /> EMR Syncing
                    </span>
                </div>

                {/* Latency Monitor */}
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-500" />
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Latency</span>
                        <span className="text-xs font-semibold text-slate-700 font-mono tracking-tighter">120ms</span>
                    </div>
                </div>

            </div>
        </div>
    );
}
