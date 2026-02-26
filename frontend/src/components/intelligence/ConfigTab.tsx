import React from 'react';
import { Users, Plus, Activity, ChevronRight, Settings, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

export default function ConfigTab() {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="xl:col-span-8 space-y-6">
                {/* Doctor Routing Matrix */}
                <Card className="rounded-[2rem] border-slate-200 shadow-sm overflow-hidden">
                    <CardHeader className="bg-slate-50/50 border-b pb-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <Users className="h-5 w-5 text-[#0d5e5e]" /> Doctor Routing Matrix
                                </CardTitle>
                                <CardDescription>
                                    Assign services to specific providers automatically.
                                </CardDescription>
                            </div>
                            <Button size="sm" className="bg-[#0d5e5e] hover:bg-[#093e3e] shadow-md rounded-xl">
                                <Plus className="h-4 w-4 mr-1" /> Add Provider
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-white border-b text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <tr>
                                    <th className="p-4">Provider</th>
                                    <th className="p-4">Specialties Assigned</th>
                                    <th className="p-4">Priority Level</th>
                                    <th className="p-4 text-right">Online Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                <tr className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-800">Dr. Sarah Jenkins</div>
                                        <div className="text-xs text-slate-500">DDS - Lead Dentist</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-wrap gap-1">
                                            <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none font-semibold">
                                                General
                                            </Badge>
                                            <Badge className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-none font-semibold">
                                                Cosmetic
                                            </Badge>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <Badge variant="outline" className="font-bold border-slate-300">
                                            High (1)
                                        </Badge>
                                    </td>
                                    <td className="p-4 text-right">
                                        <Switch checked={true} />
                                    </td>
                                </tr>
                                <tr className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-slate-800">Dr. Michael Chen</div>
                                        <div className="text-xs text-slate-500">Orthodontist</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex flex-wrap gap-1">
                                            <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-none font-semibold">
                                                Invisalign
                                            </Badge>
                                            <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-none font-semibold">
                                                Braces
                                            </Badge>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <Badge variant="outline" className="font-bold border-slate-300">
                                            Normal (2)
                                        </Badge>
                                    </td>
                                    <td className="p-4 text-right">
                                        <Switch checked={true} />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </CardContent>
                </Card>

                {/* Conditional Rule Builder */}
                <Card className="rounded-[2rem] border-slate-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Activity className="h-5 w-5 text-[#0d5e5e]" /> Conditional Rule Builder
                        </CardTitle>
                        <CardDescription>If-Then logic governing AI behavior.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[
                            {
                                if: 'Confidence drops below 85%',
                                then: 'Escalate to human immediately',
                                type: 'System',
                            },
                            {
                                if: 'Caller mentions "bleeding" or "pain"',
                                then: 'Route to Emergency Line (Dr. Sarah)',
                                type: 'Clinical',
                            },
                            {
                                if: 'Call received after 5:00 PM',
                                then: 'Switch to After-Hours Triage context',
                                type: 'Time',
                            },
                        ].map((rule, i) => (
                            <div
                                key={i}
                                className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 border rounded-2xl bg-slate-50 hover:bg-slate-100/50 transition-colors group"
                            >
                                <Badge
                                    variant="secondary"
                                    className="bg-white border text-[10px] uppercase font-bold tracking-widest"
                                >
                                    {rule.type}
                                </Badge>
                                <div className="flex-1 flex flex-col md:flex-row md:items-center gap-3">
                                    <span className="text-sm font-semibold text-slate-600">
                                        <span className="text-[#0d5e5e] font-bold">IF</span> {rule.if}
                                    </span>
                                    <ChevronRight className="h-4 w-4 text-slate-300 hidden md:block" />
                                    <span className="text-sm font-semibold text-slate-800">
                                        <span className="text-amber-600 font-bold">THEN</span> {rule.then}
                                    </span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Settings className="h-4 w-4 text-slate-400" />
                                </Button>
                            </div>
                        ))}
                        <Button
                            variant="outline"
                            className="w-full border-dashed rounded-xl font-bold text-slate-500 hover:text-[#0d5e5e] hover:border-[#0d5e5e]/50 hover:bg-[#0d5e5e]/5 h-12"
                        >
                            <Plus className="h-4 w-4 mr-2" /> Add New Rule
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Operational Summary Panel */}
            <div className="xl:col-span-4 space-y-6">
                <Card className="rounded-[2rem] border-slate-200 shadow-sm bg-gradient-to-b from-[#0d5e5e] to-[#094242] text-white overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-12 bg-white/5 blur-3xl rounded-full pointer-events-none" />
                    <CardHeader>
                        <CardTitle className="text-lg font-bold flex items-center justify-between">
                            Operational Status
                            <div className="flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between bg-black/20 p-4 rounded-xl backdrop-blur-sm border border-white/10">
                            <div>
                                <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-200/70 mb-1">
                                    Active Profiles
                                </div>
                                <div className="text-2xl font-black font-serif-numbers">2 Doctors</div>
                            </div>
                            <Users className="h-8 w-8 text-white/20" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/10 p-4 rounded-xl border border-white/10">
                                <div className="text-[10px] uppercase font-bold text-emerald-200/70 tracking-widest mb-1">
                                    Appt Buffer
                                </div>
                                <div className="text-lg font-bold">10 mins</div>
                            </div>
                            <div className="bg-white/10 p-4 rounded-xl border border-white/10">
                                <div className="text-[10px] uppercase font-bold text-emerald-200/70 tracking-widest mb-1">
                                    Override Rules
                                </div>
                                <div className="text-lg font-bold">14 Active</div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                            <span className="text-sm font-semibold">Strict Lunch Break</span>
                            <Switch checked={true} className="data-[state=checked]:bg-emerald-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-slate-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                            <Clock className="h-4 w-4 text-[#0d5e5e]" /> Global Clinic Hours
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => (
                                <div key={day} className="flex justify-between items-center text-sm">
                                    <span className="font-bold text-slate-600">{day}</span>
                                    <span className="font-mono text-slate-800 font-semibold bg-slate-100 px-3 py-1 rounded-lg">
                                        09:00 AM - 05:00 PM
                                    </span>
                                </div>
                            ))}
                            <div className="flex justify-between items-center text-sm opacity-50">
                                <span className="font-bold text-slate-600">Sat-Sun</span>
                                <Badge variant="outline">Closed</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
