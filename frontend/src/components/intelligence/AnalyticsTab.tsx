import React from 'react';
import { PhoneCall, Target, DollarSign, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function AnalyticsTab() {
    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Top Level Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    {
                        label: 'Total Handled',
                        val: '1,492',
                        sub: '+12% vs last wk',
                        icon: PhoneCall,
                        trend: 'up',
                    },
                    {
                        label: 'Conversion Rate',
                        val: '43.2%',
                        sub: 'Appointments Booked',
                        icon: Target,
                        trend: 'up',
                    },
                    {
                        label: 'Revenue Assisted',
                        val: '$14.2K',
                        sub: 'Est. Lifetime Value',
                        icon: DollarSign,
                        trend: 'up',
                    },
                    {
                        label: 'Escalation Rate',
                        val: '4.1%',
                        sub: 'Requires Human Intervention',
                        icon: ShieldAlert,
                        trend: 'down',
                    },
                ].map((stat, i) => (
                    <Card key={i} className="rounded-2xl border-slate-200 shadow-sm overflow-hidden group">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start mb-4">
                                <div
                                    className={`p-2.5 rounded-xl ${i === 2 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'} transition-transform group-hover:scale-110`}
                                >
                                    <stat.icon className="h-5 w-5" />
                                </div>
                                {stat.trend === 'up' && i !== 3 ? (
                                    <TrendingUpIcon />
                                ) : stat.trend === 'down' ? (
                                    <TrendingDownIcon />
                                ) : (
                                    <TrendingUpIcon />
                                )}
                            </div>
                            <div className="text-3xl font-black font-serif-numbers mb-1 tracking-tight text-slate-800">
                                {stat.val}
                            </div>
                            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500">
                                {stat.label}
                            </div>
                            <div className="text-xs font-semibold text-emerald-600 mt-2">{stat.sub}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Treatment Revenue Heatmap (Simulated via Bars) */}
                <Card className="xl:col-span-2 rounded-[2rem] border-slate-200 shadow-sm">
                    <CardHeader className="bg-slate-50/50 border-b pb-4">
                        <CardTitle className="text-base font-bold">Treatment-wise AI Conversions</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="space-y-5">
                            {[
                                { name: 'Initial Consult & X-Ray', pct: 85, color: 'bg-[#0d5e5e]' },
                                { name: 'Teeth Whitening', pct: 60, color: 'bg-emerald-500' },
                                { name: 'Invisalign Consultation', pct: 40, color: 'bg-blue-500' },
                                { name: 'Root Canal / Emergency', pct: 15, color: 'bg-amber-500' },
                            ].map((item, i) => (
                                <div key={i}>
                                    <div className="flex justify-between text-sm font-bold mb-1.5">
                                        <span>{item.name}</span>
                                        <span className="text-slate-500">{item.pct}% Configured Volume</span>
                                    </div>
                                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${item.color} rounded-full`}
                                            style={{ width: `${item.pct}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Escalation Reasons */}
                <Card className="rounded-[2rem] border-slate-200 shadow-sm bg-[#051a1e] text-white">
                    <CardHeader className="pb-4 border-b border-white/10">
                        <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" /> Escalation Distribution
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 pt-6">
                        <div className="space-y-4">
                            {[
                                { reason: 'Emergency Keyword', count: 42, pct: '50%' },
                                { reason: 'Low Confidence (<85%)', count: 24, pct: '30%' },
                                { reason: 'Insurance Complexity', count: 12, pct: '15%' },
                                { reason: 'Angry Tone Detected', count: 4, pct: '5%' },
                            ].map((item, i) => (
                                <div key={i} className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                                        <span className="font-semibold text-slate-300 relative truncate pr-4">
                                            {item.reason}
                                        </span>
                                    </div>
                                    <div className="font-mono text-emerald-400 font-bold">
                                        {item.pct} <span className="text-slate-500 ml-1 text-xs">({item.count})</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Button className="w-full mt-8 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl border border-white/20">
                            View Audit Logs
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// Helper Icons for Analytics
function TrendingUpIcon() {
    return (
        <div className="bg-emerald-50 text-emerald-600 rounded-full p-1 opacity-80">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
                <polyline points="16 7 22 7 22 13"></polyline>
            </svg>
        </div>
    );
}

function TrendingDownIcon() {
    return (
        <div className="bg-red-50 text-red-600 rounded-full p-1 opacity-80">
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline>
                <polyline points="16 17 22 17 22 11"></polyline>
            </svg>
        </div>
    );
}
