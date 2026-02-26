import React, { useState } from 'react';
import { HologramOrb } from './HologramOrb';
import { TranscriptFeed } from './TranscriptFeed';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export function Zone1BrainCore() {
    const [isLive, setIsLive] = useState(false);
    const [currentLevel, setCurrentLevel] = useState(0);
    const [personality, setPersonality] = useState([5]);

    const toggleTestCall = () => {
        setIsLive(!isLive);
        if (!isLive) {
            // Simulate audio amplitude for visual effect
            const interval = setInterval(() => {
                setCurrentLevel(Math.floor(Math.random() * 150) + 50);
            }, 200);
            setTimeout(() => clearInterval(interval), 5000);
        } else {
            setCurrentLevel(0);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden clinical-panel">
            {/* Visual Core */}
            <div className="p-8 flex flex-col items-center justify-center bg-slate-50 border-b border-slate-200">
                <div className="mb-4">
                    <HologramOrb amplitude={currentLevel} idle={!isLive} />
                </div>

                <div className="w-full space-y-4 mt-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-500 font-medium uppercase">Voice Profile</Label>
                            <Select defaultValue="hope">
                                <SelectTrigger className="w-full bg-white h-9 border-slate-200">
                                    <SelectValue placeholder="Select voice" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="hope">Hope (Friendly)</SelectItem>
                                    <SelectItem value="professional">Professional</SelectItem>
                                    <SelectItem value="calm">Calm & Reassuring</SelectItem>
                                    <SelectItem value="premium">Premium Concierge</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs text-slate-500 font-medium uppercase">Language</Label>
                            <Select defaultValue="en-US">
                                <SelectTrigger className="w-full bg-white h-9 border-slate-200">
                                    <SelectValue placeholder="Select language" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="en-US">English (US)</SelectItem>
                                    <SelectItem value="es-ES">Spanish</SelectItem>
                                    <SelectItem value="fr-FR">French</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <div className="flex justify-between items-center">
                            <Label className="text-xs text-slate-500 font-medium uppercase">Personality Tuning</Label>
                            <span className="text-xs font-semibold text-slate-700">
                                {personality[0] < 4 ? 'Formal' : personality[0] > 7 ? 'Friendly' : 'Balanced'}
                            </span>
                        </div>
                        <Slider
                            defaultValue={[5]}
                            max={10}
                            step={1}
                            className="[&_[role=slider]]:bg-emerald-500 [&_[role=slider]]:border-emerald-600"
                            onValueChange={setPersonality}
                        />
                    </div>
                </div>
            </div>

            {/* Transcript */}
            <div className="flex-1 p-6 relative bg-white">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                        Live Analysis
                    </h3>
                </div>

                <TranscriptFeed />

                <div className="absolute bottom-6 left-6 right-6 flex gap-3 pt-4 border-t border-slate-100 bg-white shadow-[-0_-10px_20px_rgba(255,255,255,0.9)]">
                    <Button
                        variant={isLive ? "destructive" : "default"}
                        className={`flex-1 ${!isLive ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`}
                        onClick={toggleTestCall}
                    >
                        {isLive ? 'End Simulation' : 'Test Call (Simulation)'}
                    </Button>
                    <Button variant="outline" className="flex-1 border-slate-200 text-slate-700 font-medium hover:bg-slate-50">
                        Test Chat
                    </Button>
                    <Button variant="outline" className="flex-1 border-red-200 text-red-600 font-medium hover:bg-red-50">
                        Human Takeover
                    </Button>
                </div>
            </div>
        </div>
    );
}
