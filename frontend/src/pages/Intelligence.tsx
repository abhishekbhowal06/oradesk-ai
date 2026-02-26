import React, { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
    Building2, Server, Globe2, Network, Radio, Link as LinkIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Modular Tab Components
import CoreTab from '@/components/intelligence/CoreTab';
import ConfigTab from '@/components/intelligence/ConfigTab';
import KnowledgeTab from '@/components/intelligence/KnowledgeTab';
import DeployTab from '@/components/intelligence/DeployTab';
import AnalyticsTab from '@/components/intelligence/AnalyticsTab';

export default function Intelligence() {
    const { toast } = useToast();

    const [activeTab, setActiveTab] = useState('core');
    const [orbState, setOrbState] = useState<'IDLE' | 'ACTIVE' | 'EMERGENCY'>('IDLE');
    const [isPlayingTest, setIsPlayingTest] = useState(false);
    const [activeVoice, setActiveVoice] = useState('21m00Tcm4TlvDq8ikWAM');
    const [activeTone, setActiveTone] = useState('Professional');
    const [isTestKnowledgeLoading, setIsTestKnowledgeLoading] = useState(false);
    const [knowledgeTestResult, setKnowledgeTestResult] = useState<string | null>(null);

    const performAudioTest = () => {
        setIsPlayingTest(!isPlayingTest);
        if (!isPlayingTest) {
            setOrbState('ACTIVE');
            toast({
                title: 'ElevenLabs Stream Started',
                description: 'Generating Ultra-Low Latency audio chunk...',
            });
            setTimeout(() => {
                setIsPlayingTest(false);
                setOrbState('IDLE');
            }, 3000);
        } else {
            setOrbState('IDLE');
        }
    };

    const handleSaveConfig = () => {
        toast({
            title: 'Config Locked',
            description: 'AI blueprint synced across edge nodes.',
        });
    };

    // Phase 1: Header/Status (Keep inline as it's small)
    const renderSystemStatusBar = () => (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white border border-slate-200 p-4 rounded-2xl mb-8 shadow-sm">
            <div className="flex items-center gap-4 mb-4 md:mb-0">
                <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center border border-emerald-100 shrink-0">
                    <Server className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="font-bold text-slate-800">Edge Node: US-East-1</h2>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-none font-bold text-[10px] tracking-widest uppercase">
                            Operational
                        </Badge>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Latency: 42ms • Deepgram + 11Labs Active</p>
                </div>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                <Badge variant="outline" className="shrink-0 bg-slate-50 border-slate-200 text-slate-600">
                    <Globe2 className="h-3 w-3 mr-1" /> Public API Active
                </Badge>
                <Badge variant="outline" className="shrink-0 bg-slate-50 border-slate-200 text-slate-600">
                    <Network className="h-3 w-3 mr-1" /> Tools: 14 Connected
                </Badge>
                <Badge variant="outline" className="shrink-0 bg-emerald-50 border-emerald-200 text-emerald-700">
                    <Radio className="h-3 w-3 mr-1 animate-pulse" /> Live Listeners: 2
                </Badge>
            </div>
        </div>
    );

    // Phase 2: Navigation (Keep inline)
    const renderTabNavigation = () => (
        <div className="flex bg-slate-100/80 p-1.5 rounded-2xl overflow-x-auto border border-slate-200/60 shadow-inner">
            {[
                { id: 'core', label: 'Core Brain', icon: Network },
                { id: 'config', label: 'Route & Act', icon: Building2 },
                { id: 'knowledge', label: 'Knowledge Base', icon: LinkIcon },
                { id: 'deploy', label: 'Connections', icon: Radio },
                { id: 'analytics', label: 'Performance', icon: Server },
            ].map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id
                            ? 'bg-white text-[#0d5e5e] shadow-sm border border-slate-200/50 scale-[1.02]'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                        }`}
                >
                    <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? 'text-[#0d5e5e]' : 'opacity-50'}`} />
                    {tab.label}
                </button>
            ))}
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
                        {activeTab === 'core' && (
                            <CoreTab
                                orbState={orbState}
                                setOrbState={setOrbState}
                                isPlayingTest={isPlayingTest}
                                activeVoice={activeVoice}
                                setActiveVoice={setActiveVoice}
                                activeTone={activeTone}
                                setActiveTone={setActiveTone}
                                performAudioTest={performAudioTest}
                                handleSaveConfig={handleSaveConfig}
                                toast={toast}
                            />
                        )}
                        {activeTab === 'config' && <ConfigTab />}
                        {activeTab === 'knowledge' && (
                            <KnowledgeTab
                                isTestKnowledgeLoading={isTestKnowledgeLoading}
                                setIsTestKnowledgeLoading={setIsTestKnowledgeLoading}
                                knowledgeTestResult={knowledgeTestResult}
                                setKnowledgeTestResult={setKnowledgeTestResult}
                                toast={toast}
                            />
                        )}
                        {activeTab === 'deploy' && <DeployTab toast={toast} />}
                        {activeTab === 'analytics' && <AnalyticsTab />}
                    </div>
                </div>
            </div>
        </div>
    );
}
