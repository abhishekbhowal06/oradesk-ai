import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { PhoneCall, MessageCircle, Laptop, Network, LayoutTemplate, Copy, Palette } from 'lucide-react';

export function Zone4Deployment() {
    return (
        <Card className="h-full border-slate-200 shadow-sm bg-white">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-6 flex flex-row items-baseline justify-between">
                <div>
                    <CardTitle className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <Network className="w-5 h-5 text-emerald-600" />
                        Deployment & Channels
                    </CardTitle>
                    <CardDescription className="text-slate-500 mt-2">
                        Manage where and how your AI interacts with patients.
                    </CardDescription>
                </div>
            </CardHeader>

            <CardContent className="p-6">
                <div className="grid grid-cols-12 gap-8">

                    {/* Connections */}
                    <div className="col-span-5 space-y-4 pr-6 border-r border-slate-100">
                        <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">Active Channels</h4>

                        {/* Voice Line */}
                        <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors cursor-pointer">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                    <PhoneCall className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-800 text-sm">Voice Line</p>
                                    <p className="text-xs text-slate-500">+1 (555) 019-9234</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Connected
                            </div>
                        </div>

                        {/* WhatsApp */}
                        <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors cursor-pointer">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                                    <MessageCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-800 text-sm">WhatsApp Business</p>
                                    <p className="text-xs text-slate-400">Not configured</p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" className="h-7 text-xs border-slate-200">Connect</Button>
                        </div>

                        {/* Integrations */}
                        <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mt-6 mb-2">System Sync</h4>
                        <div className="p-4 rounded-xl border border-slate-200 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors cursor-pointer">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                                    <LayoutTemplate className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-800 text-sm">PMS Sync (Dentrix)</p>
                                    <p className="text-xs text-slate-500">Last sync: 2 mins ago</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Active
                            </div>
                        </div>
                    </div>

                    {/* Widget Manager */}
                    <div className="col-span-7 pl-2 h-full flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center justify-between w-full">
                                <div className="flex items-center gap-2">
                                    <Laptop className="w-4 h-4" /> Website Widget
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">v2.1 Active</span>
                                </div>
                            </h4>
                        </div>

                        <div className="flex-1 border rounded-xl border-slate-200 bg-slate-50/50 p-6 flex gap-8">
                            {/* Controls */}
                            <div className="flex-1 space-y-6">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-slate-500 font-medium uppercase">Initialization Greeting</Label>
                                    <textarea
                                        className="w-full h-20 p-3 text-sm rounded-md border border-slate-200 focus:ring-emerald-500 focus:border-emerald-500"
                                        defaultValue="Hi! I'm OraDesk AI for Smith Dental. How can I assist you with scheduling or questions today?"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs text-slate-500 font-medium uppercase flex items-center gap-2"><Palette className="w-3 h-3" /> Brand Theme</Label>
                                        <div className="flex gap-2">
                                            <div className="w-8 h-8 rounded-full bg-emerald-600 ring-2 ring-emerald-200 cursor-pointer" />
                                            <div className="w-8 h-8 rounded-full bg-blue-600 border border-slate-200 cursor-pointer" />
                                            <div className="w-8 h-8 rounded-full bg-indigo-600 border border-slate-200 cursor-pointer" />
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between pt-2">
                                            <Label className="text-sm text-slate-700 font-medium">Enable Voice Calling</Label>
                                            <Switch defaultChecked className="data-[state=checked]:bg-emerald-600" />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-slate-200 flex justify-between">
                                    <Button variant="outline" className="text-slate-600 border-slate-200 hover:bg-slate-50 flex items-center gap-2">
                                        <Copy className="w-4 h-4" /> Copy Embed Code
                                    </Button>
                                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-medium">
                                        Save Widget
                                    </Button>
                                </div>
                            </div>

                            {/* Preview (Mock) */}
                            <div className="w-64 flex flex-col items-end justify-end">
                                <div className="w-full bg-white rounded-t-xl rounded-bl-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 overflow-hidden flex flex-col translate-y-4 scale-90 origin-bottom-right">
                                    {/* Widget Header */}
                                    <div className="bg-emerald-600 p-4 text-white flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-xs">AI</div>
                                        <div>
                                            <p className="text-sm font-semibold">Smith Dental AI</p>
                                            <p className="text-[10px] text-emerald-100">Typically replies instantly</p>
                                        </div>
                                    </div>
                                    {/* Content area */}
                                    <div className="p-4 flex flex-col gap-3 h-48 bg-slate-50">
                                        <div className="self-start max-w-[85%] bg-white rounded-xl rounded-tl-none p-3 shadow-sm border border-slate-100 text-xs text-slate-700">
                                            Hi! I'm OraDesk AI for Smith Dental. How can I assist you with scheduling or questions today?
                                        </div>
                                    </div>
                                    {/* Input area */}
                                    <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
                                        <div className="flex-1 h-8 rounded-full bg-slate-100 px-3 flex items-center text-xs text-slate-400">Type a message...</div>
                                        <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white shrink-0"><PhoneCall className="w-3.5 h-3.5 fill-current" /></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </CardContent>
        </Card>
    );
}
