import React from 'react';
import { ShieldCheck, Lock, Activity, FileText, Download, Fingerprint } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

export function SettingsSecurity({ markDirty }: { markDirty: () => void }) {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-1 border-b border-border/50 pb-5">
                <h2 className="text-2xl font-bold tracking-tight text-slate-800">Security & Compliance</h2>
                <p className="text-sm text-slate-500 font-medium">Healthcare-grade security controls and HIPAA compliance matrices.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* Left Configuration */}
                <div className="xl:col-span-2 space-y-6">

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-4">
                            <Lock className="w-4 h-4 text-[#0d5e5e]" /> Data Privacy Controls
                        </h3>

                        <div className="space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50 hover:border-slate-200 transition-colors">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-700">Conversation Recording</span>
                                    <span className="text-xs text-slate-500 mt-1 max-w-sm">Capture raw audio for AI calls. Required for precise linguistic transcription logic.</span>
                                </div>
                                <Switch defaultChecked onCheckedChange={markDirty} />
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50 hover:border-slate-200 transition-colors">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-700">Automated PII Redaction</span>
                                    <span className="text-xs text-slate-500 mt-1 max-w-sm">Use neural obfuscation to mask SSN and Credit Cards before logs hit the database.</span>
                                </div>
                                <Switch defaultChecked onCheckedChange={markDirty} />
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50 hover:border-slate-200 transition-colors">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-700">Session Timeout</span>
                                    <span className="text-xs text-slate-500 mt-1 max-w-sm">Automatically logout inactive users on shared clinical terminals.</span>
                                </div>
                                <select onChange={markDirty} className="bg-white border text-sm font-bold text-[#0d5e5e] border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#0d5e5e]/20">
                                    <option value="15m">15 Minutes (Strict)</option>
                                    <option value="30m">30 Minutes</option>
                                    <option value="1h">1 Hour</option>
                                    <option value="never">Never (Not Recommended)</option>
                                </select>
                            </div>

                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50 hover:border-slate-200 transition-colors">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-700">Data Retention Period</span>
                                    <span className="text-xs text-slate-500 mt-1 max-w-sm">Determine how long to persist conversation logs before hard deletion.</span>
                                </div>
                                <select onChange={markDirty} defaultValue="7y" className="bg-white border text-sm font-bold text-[#0d5e5e] border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-[#0d5e5e]/20">
                                    <option value="30d">30 Days</option>
                                    <option value="1y">1 Year</option>
                                    <option value="7y">7 Years (Medical Default)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-4 mb-4">
                            <Activity className="w-4 h-4 text-emerald-600" /> Audit Logging
                        </h3>
                        <p className="text-xs text-slate-500 font-medium mb-4">
                            OraDesk continuously records all system accesses, configuration modifications, and data exports.
                        </p>
                        <div className="flex items-center gap-4">
                            <Button variant="outline" className="text-xs font-bold text-slate-700 border-slate-200 hover:bg-slate-50">
                                <FileText className="w-4 h-4 mr-2 text-slate-400" /> View Audit Logs
                            </Button>
                            <Button variant="outline" className="text-xs font-bold text-slate-700 border-slate-200 hover:bg-slate-50">
                                <Download className="w-4 h-4 mr-2 text-slate-400" /> Export CSV
                            </Button>
                        </div>
                    </div>

                </div>

                {/* Right Badge */}
                <div className="xl:col-span-1 space-y-6">
                    <div className="bg-gradient-to-br from-emerald-500 to-[#0d5e5e] rounded-2xl p-6 shadow-md text-white relative overflow-hidden">
                        {/* Background Pattern */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-12 blur-2xl"></div>

                        <ShieldCheck className="w-10 h-10 text-emerald-100 mb-4" />
                        <h3 className="text-lg font-black tracking-tight mb-2">HIPAA Compliant</h3>
                        <p className="text-xs text-emerald-100/90 font-medium leading-relaxed mb-6">
                            Your OraDesk environment utilizes AES-256 encryption at rest, TLS 1.3 in transit, and complies with HITECH regulations.
                        </p>

                        <button className="w-full py-2.5 bg-white/10 hover:bg-white/20 transition-colors rounded-xl text-xs font-bold text-white border border-white/20 flex items-center justify-center gap-2">
                            <Download className="w-4 h-4" /> Download BAA Agreement
                        </button>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                            <Fingerprint className="w-4 h-4" /> Access Restrictions
                        </h3>
                        <div className="space-y-4">
                            <p className="text-xs text-slate-500 font-medium pb-2 border-b border-slate-200">
                                Restrict dashboard login access to specific physical clinic IP addresses.
                            </p>
                            <div className="space-y-2">
                                <div className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-lg flex items-center justify-between">
                                    <span>192.168.1.1/24</span>
                                    <span className="text-[10px] uppercase text-emerald-600 font-black">Active</span>
                                </div>
                            </div>
                            <Button variant="outline" className="w-full text-xs font-bold border-slate-200 shadow-sm opacity-50 cursor-not-allowed">
                                + Add IP Range
                            </Button>
                            <p className="text-[10px] text-center text-slate-400 font-bold">Requires Enterprise tier.</p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
