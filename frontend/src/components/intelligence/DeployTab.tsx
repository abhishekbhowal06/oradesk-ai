import React from 'react';
import { Smartphone, PhoneCall, LayoutTemplate } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface DeployTabProps {
    toast: any;
}

export default function DeployTab({ toast }: DeployTabProps) {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="rounded-[2rem] border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <Smartphone className="h-6 w-6 text-[#0d5e5e]" /> Communication Hub
                    </CardTitle>
                    <CardDescription className="text-sm">
                        Manage numbers and priority routing.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="border border-emerald-100 bg-emerald-50/30 p-5 rounded-2xl flex items-center justify-between shadow-[0_4px_15px_rgba(16,185,129,0.05)]">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 bg-white border border-emerald-100 shadow-sm rounded-full flex items-center justify-center">
                                <PhoneCall className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-lg">+1 (555) 019-2834</h4>
                                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-widest mt-1">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected Line
                                </div>
                            </div>
                        </div>
                        <Button variant="outline" className="rounded-xl font-bold" onClick={() => toast({ title: 'ROUTING_CONFIG', description: 'Opening advanced routing modal.' })}>
                            Configure
                        </Button>
                    </div>

                    <div>
                        <h4 className="font-bold mb-3 text-sm">Channel Priority Routing</h4>
                        <div className="space-y-2">
                            {[
                                { name: 'Voice (Twilio)', type: 'Primary Setup', active: true },
                                { name: 'WhatsApp Business', type: 'Secondary/Fallback', active: false },
                                { name: 'SMS (Automated)', type: 'Failsafe', active: true },
                            ].map((ch, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="font-bold text-sm text-slate-700">
                                            {i + 1}. {ch.name}
                                        </div>
                                        <Badge variant="secondary" className="text-[10px] font-bold uppercase">
                                            {ch.type}
                                        </Badge>
                                    </div>
                                    <Switch checked={ch.active} />
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="rounded-[2rem] border-slate-200 shadow-sm bg-[#051a1e] text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[80px] rounded-full pointer-events-none" />
                <CardHeader>
                    <CardTitle className="text-xl font-bold flex items-center gap-2">
                        <LayoutTemplate className="h-6 w-6 text-emerald-400" /> Website Widget Studio
                    </CardTitle>
                    <CardDescription className="text-emerald-100/60">
                        Customize your frontend web agent.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 relative z-10">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2 block">
                                Brand Color
                            </label>
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-[#0d5e5e] border-2 border-white ring-2 ring-emerald-400/30" />
                                <span className="font-mono text-xs">#0D5E5E</span>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2 block">
                                UI Theme
                            </label>
                            <div className="flex bg-white/10 p-1 rounded-lg">
                                <button className="flex-1 bg-white/20 text-white text-xs font-bold py-1.5 rounded-md shadow-sm">
                                    Light
                                </button>
                                <button className="flex-1 text-white/50 text-xs font-bold py-1.5 rounded-md">
                                    Dark
                                </button>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2 block">
                            Initial Greeting Message
                        </label>
                        <textarea
                            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-emerald-50 outline-none focus:border-emerald-500/50 min-h-[80px] resize-none"
                            defaultValue="Hi there! I'm your clinic's AI assistant. Do you want to book an appointment or ask about our services?"
                        />
                    </div>

                    <div className="bg-black/40 border border-white/10 rounded-xl p-4">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-bold">Embed Code (Head Tag)</span>
                            <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 text-xs font-bold bg-white text-black hover:bg-slate-200"
                                onClick={() => toast({ title: 'COPIED_TO_CLIPBOARD', description: 'Embed code copied to clipboard.' })}
                            >
                                Copy
                            </Button>
                        </div>
                        <code className="text-xs text-emerald-400 font-mono break-all leading-relaxed">
                            &lt;script src="https://cdn.oradesk.com/widget.js"
                            data-clinic="DENTACOR_PRIMARY_HQ"&gt;&lt;/script&gt;
                        </code>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
