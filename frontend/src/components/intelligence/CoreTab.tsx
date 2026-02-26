import React from 'react';
import { Activity, Brain, ShieldCheck, AlertTriangle, Globe, MessageSquare, Mic, ShieldAlert, PhoneCall } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import AIBrainOrb from '@/components/dashboard/AIBrainOrb';

interface CoreTabProps {
    orbState: 'IDLE' | 'ACTIVE' | 'EMERGENCY';
    setOrbState: (state: 'IDLE' | 'ACTIVE' | 'EMERGENCY') => void;
    isPlayingTest: boolean;
    activeVoice: string;
    setActiveVoice: (voice: string) => void;
    activeTone: string;
    setActiveTone: (tone: string) => void;
    performAudioTest: () => void;
    handleSaveConfig: () => void;
    toast: any;
}

const elevenLabsVoices = [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Dr. Sarah', desc: 'Clinical Professional', gender: 'F' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'James', desc: 'Empathetic Guide', gender: 'M' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Elena', desc: 'Warm & Assuring', gender: 'F' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Marcus', desc: 'Direct & Clear', gender: 'M' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Aisha', desc: 'Soft & Patient', gender: 'F' },
];

const voiceTones = ['Professional', 'Calm', 'Soft Tone', 'Happy Tone'];

export default function CoreTab({
    orbState,
    setOrbState,
    isPlayingTest,
    activeVoice,
    setActiveVoice,
    activeTone,
    setActiveTone,
    performAudioTest,
    handleSaveConfig,
    toast,
}: CoreTabProps) {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Interactive Hologram Module */}
            <div className="xl:col-span-5 space-y-6">
                <div className="bg-gradient-to-b from-white to-slate-50 border border-slate-200 rounded-[2rem] p-8 shadow-[0_8px_40px_rgb(0,0,0,0.04)] flex flex-col items-center justify-center relative overflow-hidden min-h-[500px] transition-all duration-500">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-50/40 via-transparent to-transparent pointer-events-none" />

                    <div className="absolute top-6 left-6 flex items-center gap-2 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full border shadow-sm">
                        <Activity className="h-4 w-4 text-[#0d5e5e]" />
                        <span className="text-xs font-bold text-slate-700">Live Pulse</span>
                    </div>

                    <div className="absolute top-6 right-6">
                        <Badge
                            variant="outline"
                            className="bg-white/80 backdrop-blur-md text-[#0d5e5e] border-[#0d5e5e]/20 font-mono"
                        >
                            v4.2.1-stable
                        </Badge>
                    </div>

                    {/* Central Orb Container */}
                    <div className="relative z-10 w-80 h-80 flex items-center justify-center -mt-8">
                        {/* Ambient Background Glow */}
                        <div
                            className={`absolute inset-10 rounded-full blur-3xl opacity-30 transition-all duration-1000 ${orbState === 'ACTIVE'
                                    ? 'bg-emerald-400 scale-150'
                                    : orbState === 'EMERGENCY'
                                        ? 'bg-red-500 scale-125 animate-pulse'
                                        : 'bg-[#0d5e5e]/50 hover:scale-110'
                                }`}
                        />

                        {/* 3D High Fidelity Hologram */}
                        <div className="absolute inset-0 z-20">
                            <React.Suspense fallback={<div className="w-full h-full flex flex-col items-center justify-center"><Brain className="h-10 w-10 text-emerald-500 opacity-50 animate-pulse" /><span className="text-[10px] mt-4 uppercase tracking-[0.2em] text-[#0d5e5e] font-bold">BOOTING HOLOGRAM...</span></div>}>
                                <AIBrainOrb state={orbState} />
                            </React.Suspense>
                        </div>
                    </div>

                    {/* Radial Confidence Meter beneath orb */}
                    <div className="relative z-10 mt-8 w-full max-w-[240px]">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                Semantic Confidence
                            </span>
                            <span className="text-sm font-black text-[#0d5e5e]">98.7%</span>
                        </div>
                        <div className="h-2 w-full bg-slate-200/50 rounded-full overflow-hidden backdrop-blur-sm">
                            <div className="h-full bg-gradient-to-r from-emerald-400 to-[#0d5e5e] w-[98.7%] rounded-full shadow-[0_0_10px_rgba(13,94,94,0.4)]" />
                        </div>
                    </div>

                    <div className="flex justify-center flex-wrap gap-3 mt-8 relative z-10">
                        <Button
                            variant="outline"
                            className="bg-white hover:bg-slate-50 border-slate-200 shadow-sm rounded-xl font-bold transition-all hover:-translate-y-0.5"
                            onClick={performAudioTest}
                        >
                            <Mic
                                className={`h-4 w-4 mr-2 ${isPlayingTest ? 'text-emerald-500 animate-pulse' : 'text-slate-400'}`}
                            />{' '}
                            {isPlayingTest ? 'Stop Voice' : 'Test Voice'}
                        </Button>
                        <Button
                            variant="outline"
                            className="bg-white hover:bg-slate-50 border-slate-200 shadow-sm rounded-xl font-bold transition-all hover:-translate-y-0.5"
                            onClick={() => toast({ title: 'CHAT_UI_LAUNCHED', description: 'Opening chat interface modal...' })}
                        >
                            <MessageSquare className="h-4 w-4 mr-2 text-slate-400" /> Test Chat
                        </Button>
                        <Button
                            variant="outline"
                            className="bg-red-50 hover:bg-red-100 border-red-200 text-red-700 shadow-sm rounded-xl font-bold transition-all hover:-translate-y-0.5"
                            onClick={() => {
                                setOrbState('EMERGENCY');
                                toast({ title: 'System Escalation', description: 'Simulating emergency escalation to human.', variant: 'destructive' });
                            }}
                        >
                            <AlertTriangle className="h-4 w-4 mr-2" /> Force Escalate
                        </Button>
                    </div>
                </div>
            </div>

            {/* AI Settings & Live Transcript */}
            <div className="xl:col-span-7 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="rounded-[2rem] border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)] bg-white/60 backdrop-blur-lg md:col-span-2">
                        <CardHeader className="pb-2 flex flex-col md:flex-row items-center justify-between">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Globe className="h-4 w-4 text-[#0d5e5e]" /> Deep Intelligence Config
                            </CardTitle>
                            <Button size="sm" className="bg-[#0d5e5e] hover:bg-[#094242] text-white shadow-sm mt-4 md:mt-0 font-bold tracking-wider" onClick={handleSaveConfig}>Save AI Blueprint</Button>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                            <Mic className="h-4 w-4 text-[#0d5e5e]" /> ElevenLabs Voice Matrix
                                        </label>
                                        <Badge variant="outline" className="text-[9px] bg-emerald-50 border-emerald-200 text-emerald-600 flex items-center gap-1.5 shadow-sm"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />API CONNECTED</Badge>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                        {elevenLabsVoices.map(v => (
                                            <div
                                                key={v.id}
                                                onClick={() => setActiveVoice(v.id)}
                                                className={`p-3 rounded-xl border cursor-pointer transition-all ${activeVoice === v.id
                                                        ? 'bg-[#0d5e5e]/5 border-[#0d5e5e] shadow-[0_0_0_1px_rgba(13,94,94,1)] scale-[1.02]'
                                                        : 'bg-white border-slate-200 hover:border-[#0d5e5e]/50 hover:bg-[#0d5e5e]/5'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className={`font-bold text-sm ${activeVoice === v.id ? 'text-[#0d5e5e]' : 'text-slate-700'}`}>{v.name}</div>
                                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1 rounded uppercase tracking-wider">{v.gender}</span>
                                                </div>
                                                <div className={`text-[10px] font-semibold leading-tight ${activeVoice === v.id ? 'text-[#0d5e5e]/80' : 'text-slate-500'}`}>{v.desc}</div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-5 flex flex-col md:flex-row md:items-center gap-3 bg-slate-50 border border-slate-100 p-3 rounded-xl border-dashed">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex shrink-0 items-center gap-2">
                                            <Brain className="h-3 w-3 text-slate-400" /> Interaction Tone:
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {voiceTones.map(tone => (
                                                <button
                                                    key={tone}
                                                    onClick={() => setActiveTone(tone)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${activeTone === tone
                                                            ? 'bg-[#0d5e5e] text-white shadow-md shadow-[#0d5e5e]/20'
                                                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                                                        }`}
                                                >
                                                    {tone}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Additional Settings */}
                                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 pt-6 mt-2">
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">
                                            First Engagement Message
                                        </label>
                                        <Input className="bg-white border-slate-200 h-11 text-sm font-semibold shadow-sm focus-visible:ring-[#0d5e5e]/20" defaultValue="Hi, this is Dr. Sarah from OraDesk Dental. How can I help you today?" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">
                                            Linguistic Parser
                                        </label>
                                        <select className="w-full border border-slate-200 rounded-xl p-3 text-sm font-semibold bg-white outline-none focus:ring-2 focus:ring-[#0d5e5e]/20 transition-all shadow-sm">
                                            <option>English (US) - Primary</option>
                                            <option>Spanish (LatAm)</option>
                                            <option>French (CA)</option>
                                            <option>Hindi (IN)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="border border-slate-100 bg-slate-50/50 p-4 rounded-2xl relative shadow-sm">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex justify-between items-center">
                                    <span className="flex items-center gap-2"> System Prompt (Core Brain Context)</span>
                                    <span className="text-[#0d5e5e] font-mono bg-white px-2 py-0.5 rounded shadow-sm border border-slate-200">Tokens: 421/2000</span>
                                </label>
                                <Textarea
                                    className="bg-white border border-slate-200/60 min-h-[140px] font-mono text-xs leading-[1.6] resize-y shadow-sm text-slate-700 focus-visible:ring-[#0d5e5e]/20"
                                    defaultValue={`You are a highly capable dental AI receptionist named Dr. Sarah.
Your primary objective is to evaluate dental emergencies and schedule appointments.
Rules:
1. Always be empathetic and clear.
2. If patient mentions severe pain (>7/10), bleeding, or swelling, escalate using FORCE_ESCALATION tool immediately.
3. Keep responses under 2 sentences to minimize conversational latency.`}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Environment Mode */}
                    <Card className="rounded-[2rem] border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)] bg-white/60 backdrop-blur-lg">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Brain className="h-4 w-4 text-[#0d5e5e]" /> Environment Mode
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {[
                                { name: 'Business Hours', desc: 'Full booking capability', active: true },
                                { name: 'After Hours', desc: 'Triage & message taking', active: false },
                                { name: 'Emergency', desc: 'Immediate routing to doctor', active: false },
                            ].map((mode, i) => (
                                <div
                                    key={i}
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer hover:shadow-sm ${mode.active ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white hover:border-slate-300'
                                        }`}
                                >
                                    <div>
                                        <div className={`text-sm font-bold ${mode.active ? 'text-[#0d5e5e]' : 'text-slate-700'}`}>{mode.name}</div>
                                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{mode.desc}</div>
                                    </div>
                                    <div className={`h-4 w-4 rounded-full border-2 ${mode.active ? 'border-[#0d5e5e] flex items-center justify-center' : 'border-slate-300'}`}>
                                        {mode.active && <div className="h-2 w-2 bg-[#0d5e5e] rounded-full" />}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* Live Audit Stream */}
                <Card className="rounded-[2rem] border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)] overflow-hidden">
                    <div className="bg-slate-50/80 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                        <h3 className="font-bold text-sm flex items-center gap-2">
                            <Activity className="h-4 w-4 text-[#0d5e5e] animate-pulse" /> Live Audit Stream
                        </h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500">Auto-Scroll</span>
                            <Switch checked={true} />
                        </div>
                    </div>
                    <div className="p-6 h-[220px] overflow-y-auto bg-white font-mono text-sm space-y-4">
                        {orbState === 'IDLE' ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <ShieldCheck className="h-8 w-8 mb-2 opacity-20" />
                                <span className="text-xs uppercase tracking-widest font-bold">Awaiting Connection...</span>
                            </div>
                        ) : orbState === 'ACTIVE' ? (
                            <>
                                <div className="flex gap-4 opacity-70">
                                    <span className="text-slate-400 w-12 text-xs pt-1">11:42</span>
                                    <div className="flex-1"><span className="text-blue-600 font-bold">[PATIENT]</span> Hello, I need to book a cleaning.</div>
                                </div>
                                <div className="flex gap-4">
                                    <span className="text-slate-400 w-12 text-xs pt-1">11:42</span>
                                    <div className="flex-1">
                                        <span className="text-[#0d5e5e] font-bold">[SYSTEM_AI]</span>{' '}
                                        <span className="text-emerald-600">{'{'}Intent: BOOK_CLEANING, Conf: 98%{'}'}</span>{' '}
                                        I'd be happy to help with that. Are you a new or returning patient?
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex gap-4">
                                <span className="text-slate-400 w-12 text-xs pt-1">11:43</span>
                                <div className="flex-1">
                                    <span className="text-red-500 font-bold">[ESCALATION]</span>{' '}
                                    <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-xs font-bold">EMERGENCY_KEYWORD_DETECTED: "pain"</span>{' '}
                                    Routing to human staff immediately.
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
