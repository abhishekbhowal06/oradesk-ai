import React from 'react';
import { CreditCard, Zap, Download, Activity, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SettingsBilling() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-1 border-b border-border/50 pb-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-800">Subscription & Billing</h2>
                        <p className="text-sm text-slate-500 font-medium">Manage your subscription, view real-time API usage, and handle invoices.</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* Left Usage & Plan */}
                <div className="xl:col-span-2 space-y-6">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Current Plan */}
                        <div className="bg-[#0d5e5e] border border-emerald-800 rounded-2xl p-6 shadow-md text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-12 blur-2xl"></div>
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-100">Current Plan</h3>
                                <span className="text-xs font-bold bg-white/20 px-2 py-1 rounded-md">ACTIVE</span>
                            </div>
                            <div>
                                <h2 className="text-3xl font-black mb-1">Clinical Premium</h2>
                                <p className="text-sm font-medium text-emerald-100/90">$299.00 / month</p>
                            </div>
                            <Button className="w-full mt-8 bg-white text-[#0d5e5e] hover:bg-emerald-50 font-bold">
                                Manage Subscription
                            </Button>
                        </div>

                        {/* Usage Metrics */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Monthly Usage</h3>
                                <TrendingUp className="w-4 h-4 text-[#0d5e5e]" />
                            </div>

                            <div className="space-y-5">
                                {/* Calls */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm font-bold text-slate-700">
                                        <span>AI Voice Minutes</span>
                                        <span>412 / 500</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-[#0d5e5e]" style={{ width: '82%' }}></div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium text-right">88 minutes remaining</p>
                                </div>

                                {/* Texts */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm font-bold text-slate-700">
                                        <span>SMS & WhatsApp</span>
                                        <span className="text-amber-600">6,102 / 5,000</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-amber-500" style={{ width: '100%' }}></div>
                                    </div>
                                    <p className="text-[10px] text-amber-600 font-bold text-right flex items-center justify-end gap-1">
                                        <AlertTriangle className="w-3 h-3" /> Over limits ($11.02 calculated overage)
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
                            <Activity className="w-4 h-4 text-emerald-600" /> Payment Methods
                        </h3>
                        <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-8 bg-white border border-slate-200 rounded flex items-center justify-center">
                                    <CreditCard className="w-5 h-5 text-slate-600" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-800">Visa ending in 4242</span>
                                    <span className="text-xs font-medium text-slate-500">Expiry 12/26 • Default</span>
                                </div>
                            </div>
                            <Button variant="outline" className="text-xs font-bold border-slate-200 shadow-sm text-slate-700 hover:text-[#0d5e5e] hover:border-[#0d5e5e]/30">
                                Update
                            </Button>
                        </div>
                    </div>

                </div>

                {/* Right Invoices */}
                <div className="xl:col-span-1 border border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-slate-100 bg-slate-50">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[#0d5e5e] flex items-center gap-2">
                            <FileText className="w-4 h-4" /> Billing History
                        </h3>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {[
                            { id: 'INV-2024-0012', date: 'Dec 01, 2024', amount: '$299.00' },
                            { id: 'INV-2024-0011', date: 'Nov 01, 2024', amount: '$310.20' },
                            { id: 'INV-2024-0010', date: 'Oct 01, 2024', amount: '$299.00' },
                        ].map((inv, idx) => (
                            <div key={idx} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-700">{inv.amount}</span>
                                    <span className="text-xs font-medium text-slate-500">{inv.date}</span>
                                </div>
                                <button className="p-2 text-slate-400 hover:text-[#0d5e5e] transition-colors rounded-lg hover:bg-emerald-50">
                                    <Download className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <Button variant="ghost" className="w-full text-xs font-bold text-[#0d5e5e] hover:bg-transparent hover:text-emerald-700 p-4 border-t border-slate-100">
                        View All Documents →
                    </Button>
                </div>

            </div>
        </div>
    );
}
