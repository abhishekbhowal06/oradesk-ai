import React, { useState, useEffect, useRef } from 'react';
import {
  Brain,
  Building2,
  BookOpen,
  Rocket,
  LineChart,
  Activity,
  Mic,
  Globe,
  Zap,
  Users,
  Clock,
  CalendarDays,
  Stethoscope,
  ShieldCheck,
  Upload,
  Database,
  RefreshCcw,
  Smartphone,
  MessageCircle,
  LayoutTemplate,
  Target,
  Play,
  Pause,
  Settings,
  AlertTriangle,
  FileText,
  ShieldAlert,
  Bot,
  Wifi,
  Server,
  CheckCircle2,
  ChevronRight,
  BarChart3,
  MessageSquare,
  Lock,
  Eye,
  PlayCircle,
  Plus,
  Send,
  PhoneCall,
  DollarSign,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AIBrainOrb from '@/components/dashboard/AIBrainOrb';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

type Tab = 'core' | 'config' | 'knowledge' | 'deploy' | 'analytics';

export default function ClinicalAIOperations() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('core');
  const [orbState, setOrbState] = useState<'IDLE' | 'ACTIVE' | 'EMERGENCY'>('IDLE');
  const [isTestKnowledgeLoading, setIsTestKnowledgeLoading] = useState(false);
  const [knowledgeTestResult, setKnowledgeTestResult] = useState('');
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);

  // Voice Settings State
  const [activeVoice, setActiveVoice] = useState('21m00Tcm4TlvDq8ikWAM');
  const [activeTone, setActiveTone] = useState('Calm');
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const elevenLabsVoices = [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Dr. Sarah', desc: 'Clinical Professional', gender: 'F' },
    { id: 'ErXwobaYiN019PkySvjV', name: 'James', desc: 'Empathetic Guide', gender: 'M' },
    { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Elena', desc: 'Warm & Assuring', gender: 'F' },
    { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Marcus', desc: 'Direct & Clear', gender: 'M' },
    { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Aisha', desc: 'Soft & Patient', gender: 'F' },
  ];

  const voiceTones = ['Professional', 'Calm', 'Soft Tone', 'Happy Tone'];

  const performAudioTest = async () => {
    if (isPlayingTest) {
      audioRef.current?.pause();
      setIsPlayingTest(false);
      setOrbState('IDLE');
      return;
    }

    try {
      setIsPlayingTest(true);
      setOrbState('ACTIVE');
      toast({ title: 'CONNECTING...', description: 'Contacting ElevenLabs API for preview...' });

      const textToSpeak = `Hi, this is a voice test. I am set to sound ${activeTone}. I am ready to handle patient calls.`;
      const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY;

      if (!apiKey) {
        toast({ title: 'API KEY MISSING', description: 'Simulating voice test...', variant: 'default' });
        setTimeout(() => {
          setIsPlayingTest(false);
          setOrbState('IDLE');
        }, 3000);
        return;
      }

      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${activeVoice}/stream?optimize_streaming_latency=0`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text: textToSpeak,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: activeTone === 'Calm' || activeTone === 'Soft Tone' ? 0.7 : 0.4,
            similarity_boost: 0.8,
          }
        })
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlayingTest(false);
        setOrbState('IDLE');
        URL.revokeObjectURL(url);
      };

      audio.play();

    } catch (err) {
      setIsPlayingTest(false);
      setOrbState('IDLE');
      toast({ title: 'API ERROR', description: 'Could not fetch audio from ElevenLabs. Check your API key.', variant: 'destructive' });
    }
  };

  const handleSaveConfig = () => {
    toast({
      title: 'AI_BLUEPRINT_SYNCED',
      description: 'System Config and Persona deployed to nodes.',
      variant: 'default'
    });
  };

  // Phase 1: Global Authority Layer (System Status Bar)
  const renderSystemStatusBar = () => (
    <div className="sticky top-0 z-50 mb-8 backdrop-blur-xl bg-white/70 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 transition-all duration-300">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">
              AI CORE STATUS
            </div>
            <div className="text-sm font-extrabold text-[#0d5e5e] leading-none">SYSTEM.LIVE</div>
          </div>
        </div>

        <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              <PhoneCall className="inline h-3 w-3 mr-1" /> ACTIVE
            </span>
            <span className="text-sm font-bold text-slate-700">3 Calls</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              <ShieldAlert className="inline h-3 w-3 mr-1 text-amber-500" /> ESCALATED
            </span>
            <span className="text-sm font-bold text-amber-600">2 Today</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              <Activity className="inline h-3 w-3 mr-1 text-emerald-500" /> LATENCY
            </span>
            <span className="text-sm font-bold text-emerald-600 font-mono">412ms</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-slate-50/50 p-1.5 rounded-xl border border-slate-100">
        <Badge variant="outline" className="bg-white text-slate-600 border-slate-200 shadow-sm">
          <Server className="h-3 w-3 mr-1 text-[#0d5e5e]" /> Region: US-East
        </Badge>
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm"
        >
          <Lock className="h-3 w-3 mr-1" /> HIPAA Compliant
        </Badge>
      </div>
    </div>
  );

  const renderTabNavigation = () => (
    <div className="flex flex-wrap gap-2 mb-8 bg-slate-50/80 p-1.5 rounded-2xl border border-slate-200/60 shadow-inner">
      {[
        { id: 'core', label: 'AI Brain Core', icon: Brain },
        { id: 'config', label: 'Clinic Config', icon: Building2 },
        { id: 'knowledge', label: 'Knowledge Base', icon: Database },
        { id: 'deploy', label: 'Channel Control', icon: Rocket },
        { id: 'analytics', label: 'Intelligence', icon: BarChart3 },
      ].map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex flex - 1 min - w - [140px] items - center justify - center gap - 2 px - 4 py - 3 rounded - xl text - sm font - bold transition - all duration - 200 ${isActive
              ? 'bg-white text-[#0d5e5e] shadow-[0_2px_10px_rgb(0,0,0,0.06)] ring-1 ring-slate-200 scale-[1.02]'
              : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-700'
              } `}
          >
            <Icon className={`h - 4 w - 4 ${isActive ? 'text-[#0d5e5e]' : ''} `} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  // Phase 2: AI Brain Core V3
  const renderCore = () => (
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
              onClick={() => setIsChatModalOpen(true)}
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
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${activeVoice === v.id ? 'bg-[#0d5e5e]/5 border-[#0d5e5e] shadow-[0_0_0_1px_rgba(13,94,94,1)] scale-[1.02]' : 'bg-white border-slate-200 hover:border-[#0d5e5e]/50 hover:bg-[#0d5e5e]/5'}`}
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
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${activeTone === tone ? 'bg-[#0d5e5e] text-white shadow-md shadow-[#0d5e5e]/20' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                        >
                          {tone}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

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
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                        Empathy vs Efficiency Core
                      </label>
                      <span className="text-xs font-bold text-[#0d5e5e] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 shadow-sm">85% Empathetic</span>
                    </div>
                    <input
                      type="range"
                      className="w-full h-2 mt-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0d5e5e]"
                      min="1"
                      max="100"
                      defaultValue="85"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex justify-between items-center">
                      <span>Linguistic Restrictions</span>
                      <Badge variant="outline" className="text-[8px] border-slate-200">Enforced</Badge>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-none font-bold shadow-sm">Medical Terminology: High</Badge>
                      <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border-none font-bold shadow-sm">Profanity: Blocked</Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border border-slate-100 bg-slate-50/50 p-4 rounded-2xl relative shadow-sm">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex justify-between items-center">
                  <span className="flex items-center gap-2"><Settings className="h-3 w-3" /> System Prompt (Core Brain Context)</span>
                  <span className="text-[#0d5e5e] font-mono bg-white px-2 py-0.5 rounded shadow-sm border border-slate-200">Tokens: 421/2000</span>
                </label>
                <Textarea
                  className="bg-white border border-slate-200/60 min-h-[140px] font-mono text-xs leading-[1.6] resize-y shadow-sm text-slate-700 focus-visible:ring-[#0d5e5e]/20"
                  defaultValue={`You are a highly capable dental AI receptionist named Dr. Sarah.
Your primary objective is to evaluate dental emergencies and schedule appointments.
Rules:
1. Always be empathetic and clear.
2. If patient mentions severe pain (>7/10), bleeding, or swelling, escalate using FORCE_ESCALATION tool immediately.
3. Keep responses under 2 sentences to minimize conversational latency.
4. If insurance is mentioned, reassure them we process most PPO plans and offer local financing.`}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-slate-200 shadow-[0_4px_20px_rgb(0,0,0,0.03)] bg-white/60 backdrop-blur-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#0d5e5e]" /> Environment Mode
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
                  className={`flex items - center justify - between p - 3 rounded - xl border transition - all cursor - pointer hover: shadow - sm ${mode.active ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white hover:border-slate-300'} `}
                >
                  <div>
                    <div
                      className={`text - sm font - bold ${mode.active ? 'text-[#0d5e5e]' : 'text-slate-700'} `}
                    >
                      {mode.name}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
                      {mode.desc}
                    </div>
                  </div>
                  <div
                    className={`h - 4 w - 4 rounded - full border - 2 ${mode.active ? 'border-[#0d5e5e] flex items-center justify-center' : 'border-slate-300'} `}
                  >
                    {mode.active && <div className="h-2 w-2 bg-[#0d5e5e] rounded-full" />}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

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
                <span className="text-xs uppercase tracking-widest font-bold">
                  Awaiting Connection...
                </span>
              </div>
            ) : orbState === 'ACTIVE' ? (
              <>
                <div className="flex gap-4 opacity-70">
                  <span className="text-slate-400 w-12 text-xs pt-1">11:42</span>
                  <div className="flex-1">
                    <span className="text-blue-600 font-bold">[PATIENT]</span> Hello, I need to book
                    a cleaning.
                  </div>
                </div>
                <div className="flex gap-4">
                  <span className="text-slate-400 w-12 text-xs pt-1">11:42</span>
                  <div className="flex-1">
                    <span className="text-[#0d5e5e] font-bold">[SYSTEM_AI]</span>{' '}
                    <span className="text-emerald-600">
                      {'{'}Intent: BOOK_CLEANING, Conf: 98%{'}'}
                    </span>{' '}
                    I'd be happy to help with that. Are you a new or returning patient?
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex gap-4">
                  <span className="text-slate-400 w-12 text-xs pt-1">11:43</span>
                  <div className="flex-1">
                    <span className="text-red-500 font-bold">[ESCALATION]</span>{' '}
                    <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded text-xs font-bold">
                      EMERGENCY_KEYWORD_DETECTED: "pain"
                    </span>{' '}
                    Routing to human staff immediately.
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div >
  );

  // Phase 3: Clinic Config Engine V3
  const renderConfig = () => (
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

  // Phase 4: Knowledge Lab V3
  const renderKnowledge = () => (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Knowledge Base Overview */}
      <div className="xl:col-span-8 space-y-6">
        <div className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm flex flex-col md:flex-row items-center gap-6">
          <div className="relative h-24 w-24 rounded-full border-4 border-emerald-100 flex items-center justify-center shrink-0">
            <div className="absolute inset-0 rounded-full border-4 border-[#0d5e5e] border-l-transparent border-b-transparent rotate-45"></div>
            <div className="text-center">
              <div className="text-xl font-black text-[#0d5e5e]">92%</div>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-foreground">Knowledge Coverage</h3>
            <p className="text-sm text-slate-500 mt-1 mb-4">
              The AI has high confidence in understanding clinic pricing, insurance, and scheduling
              based on provided data.
            </p>
            <div className="flex gap-4">
              <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">
                <Database className="h-3 w-3 mr-1" /> 24 Indexed Docs
              </Badge>
              <Badge
                variant="outline"
                className="bg-emerald-50 text-emerald-700 border-emerald-200"
              >
                <RefreshCcw className="h-3 w-3 mr-1" /> Trained 2h ago
              </Badge>
            </div>
          </div>
          <Button className="bg-[#0d5e5e] hover:bg-[#093e3e] shadow-md rounded-xl font-bold shrink-0" onClick={() => toast({ title: 'KB_RETRAINING_STARTED', description: 'Triggering background embedding job.' })}>
            <RefreshCcw className="h-4 w-4 mr-2" /> Retrain AI Model
          </Button>
        </div>

        <Card className="rounded-[2rem] border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b pb-4">
            <CardTitle className="text-lg font-bold">Document Vectors</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-white border-b text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <tr>
                  <th className="p-4">Source Name</th>
                  <th className="p-4">Type & Size</th>
                  <th className="p-4">Confidence Score</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-bold text-slate-800 flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-500" /> oradesk.com/pricing
                  </td>
                  <td className="p-4 text-slate-500">Web Scrape • 45 pages</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Progress value={95} className="w-16 h-1.5" />{' '}
                      <span className="text-xs font-bold text-emerald-600">95%</span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4 text-slate-400" />
                    </Button>
                  </td>
                </tr>
                <tr className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="h-4 w-4 text-orange-500" /> FAQ_Manual_2026.pdf
                  </td>
                  <td className="p-4 text-slate-500">PDF • 2.4 MB</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Progress value={88} className="w-16 h-1.5" />{' '}
                      <span className="text-xs font-bold text-emerald-600">88%</span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4 text-slate-400" />
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Simulator & Uploder */}
      <div className="xl:col-span-4 space-y-6">
        <Card className="rounded-[2rem] border-slate-200 shadow-sm bg-slate-900 border-none overflow-hidden relative">
          <div className="absolute top-0 inset-x-0 h-1bg-gradient-to-r from-emerald-400 to-blue-500" />
          <CardHeader>
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Bot className="h-5 w-5 text-emerald-400" /> Test AI Knowledge
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-slate-800 p-4 rounded-xl min-h-[120px] text-sm text-slate-300 font-mono relative">
              {isTestKnowledgeLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <RefreshCcw className="h-5 w-5 animate-spin text-emerald-400" />
                </div>
              ) : knowledgeTestResult ? (
                <span>
                  <span className="text-emerald-400 font-bold">[AI]:</span> {knowledgeTestResult}
                </span>
              ) : (
                <span className="opacity-50">
                  Ask a question to see how the AI responds based on its training data...
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Do you accept Delta Dental?"
                className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2 text-sm outline-none focus:border-emerald-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setIsTestKnowledgeLoading(true);
                    setTimeout(() => {
                      setKnowledgeTestResult(
                        'Yes, we are in-network with Delta Dental Premier. Would you like me to verify your specific benefits?',
                      );
                      setIsTestKnowledgeLoading(false);
                    }, 1000);
                  }
                }}
              />
              <Button size="icon" className="bg-emerald-500 hover:bg-emerald-600 rounded-xl">
                <Send className="h-4 w-4 text-slate-900" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <div
          className="bg-slate-50 border border-dashed border-slate-300 rounded-[2rem] p-8 flex flex-col items-center justify-center text-center hover:bg-slate-100 hover:border-slate-400 transition-colors cursor-pointer group"
          onClick={() => toast({ title: 'UPLOAD_INITIALIZED', description: 'Opening secure file upload portal.' })}
        >
          <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
            <Upload className="h-8 w-8 text-[#0d5e5e]" />
          </div>
          <h3 className="font-bold text-foreground">Ingest New Data</h3>
          <p className="text-xs text-slate-500 mt-2">
            Drag & drop PDFs or click to browse. Max 50MB per file.
          </p>
        </div>
      </div>
    </div>
  );

  // Phase 5: Channel Control V3
  const renderDeploy = () => (
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

  // Phase 6: Intelligence V3
  const renderAnalytics = () => (
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
                  className={`p - 2.5 rounded - xl ${i === 2 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'} group - hover: scale - 110 transition - transform`}
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
                      className={`h - full ${item.color} rounded - full`}
                      style={{ width: `${item.pct}% ` }}
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

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-24">
      <div className="w-full max-w-[1400px] mx-auto p-4 md:p-8">
        {renderSystemStatusBar()}

        {/* Main Content Area */}
        <div className="bg-white border border-slate-200/60 rounded-[2.5rem] p-6 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.02)] min-h-[700px]">
          <div className="mb-8">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">
              AI Operating Infrastructure
            </h1>
            <p className="text-slate-500 font-medium">
              Configure, train, and deploy your intelligent clinical workforce.
            </p>
          </div>

          {renderTabNavigation()}

          <div className="mt-8">
            {activeTab === 'core' && renderCore()}
            {activeTab === 'config' && renderConfig()}
            {activeTab === 'knowledge' && renderKnowledge()}
            {activeTab === 'deploy' && renderDeploy()}
            {activeTab === 'analytics' && renderAnalytics()}
          </div>
        </div>
      </div>
      <Dialog open={isChatModalOpen} onOpenChange={setIsChatModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="bg-[#0d5e5e] p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2 text-white">
                <MessageSquare className="h-5 w-5" /> Test AI Chat
              </DialogTitle>
              <DialogDescription className="text-emerald-100/70 font-medium">
                Simulate a patient conversation with Dr. Sarah.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-4 bg-slate-50 min-h-[400px] max-h-[600px] overflow-y-auto flex flex-col">
            <div className="flex justify-start">
              <div className="bg-white border shadow-sm p-3 rounded-2xl rounded-bl-none max-w-[85%]">
                <p className="text-sm font-semibold text-[#0d5e5e] mb-1">Dr. Sarah</p>
                <p className="text-sm text-slate-700">Hi, I'm Dr. Sarah. How can I help you with your dental needs today?</p>
              </div>
            </div>
            <div className="flex-1" />
            <div className="flex gap-2 bg-white p-2 rounded-2xl border shadow-inner">
              <Input
                placeholder="Type your message..."
                className="border-none bg-transparent focus-visible:ring-0 text-sm font-medium"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    toast({ title: 'MESSAGE_SENT', description: 'Simulating AI response...' });
                    e.currentTarget.value = '';
                  }
                }}
              />
              <Button size="icon" className="bg-[#0d5e5e] hover:bg-[#093e3e] rounded-xl shrink-0 h-10 w-10">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
