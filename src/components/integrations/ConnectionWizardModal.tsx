import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldCheck, CheckCircle2, Loader2, Key, Link2, Zap } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface ConnectionWizardModalProps {
    isOpen: boolean;
    onClose: () => void;
    integrationName: string;
    icon: React.ReactNode;
}

export const ConnectionWizardModal = ({
    isOpen,
    onClose,
    integrationName,
    icon,
}: ConnectionWizardModalProps) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [autoActions, setAutoActions] = useState(true);

    const handleNext = () => {
        if (step === 2) {
            setLoading(true);
            // Simulate API call
            setTimeout(() => {
                setLoading(false);
                setStep(3);
            }, 1500);
        } else {
            setStep(s => s + 1);
        }
    };

    const handleClose = () => {
        setTimeout(() => setStep(1), 300); // Reset after animation
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-white border-slate-200 rounded-3xl shadow-xl">
                <div className="flex flex-col h-full">

                    {/* Header area with subtle background */}
                    <div className="bg-slate-50/50 border-b border-slate-100 p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">

                        {/* Progress indicator */}
                        <div className="absolute top-4 w-full px-6 flex justify-between items-center z-10">
                            <div className="flex gap-1.5 w-full">
                                <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-[#0d5e5e]' : 'bg-slate-200'}`} />
                                <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-[#0d5e5e]' : 'bg-slate-200'}`} />
                                <div className={`h-1 flex-1 rounded-full ${step >= 3 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                            </div>
                        </div>

                        <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mt-6 z-10 relative">
                            {icon}
                            {step === 3 && (
                                <div className="absolute -bottom-2 -right-2 bg-emerald-500 rounded-full p-1 border-2 border-white shadow-sm animate-in zoom-in duration-300">
                                    <CheckCircle2 className="w-4 h-4 text-white" />
                                </div>
                            )}
                        </div>

                        <DialogHeader className="mt-4 z-10 w-full space-y-1">
                            <DialogTitle className="text-xl font-black text-slate-800 text-center">
                                {step === 3 ? 'Connection Successful!' : `Connect ${integrationName}`}
                            </DialogTitle>
                            <DialogDescription className="text-center text-slate-500 text-sm font-medium px-4">
                                {step === 1 && `Link your ${integrationName} account to OraDesk AI.`}
                                {step === 2 && 'Authenticate to establish a secure data bridge.'}
                                {step === 3 && `${integrationName} is now actively communicating with your clinical AI.`}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white pointer-events-none" />
                    </div>

                    {/* Content Area */}
                    <div className="p-6">

                        {step === 1 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex gap-3">
                                    <ShieldCheck className="w-5 h-5 text-blue-500 shrink-0" />
                                    <div>
                                        <h4 className="text-sm font-bold text-blue-800 mb-1">Secure Bridge Activation</h4>
                                        <p className="text-xs text-blue-600/80 font-medium leading-relaxed">
                                            By proceeding, you authorize OraDesk to read availability and write appointments. Medical records remain untouched.
                                        </p>
                                    </div>
                                </div>

                                <ul className="space-y-4 px-2">
                                    <li className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                                        <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        </div>
                                        Real-time Schedule Sync
                                    </li>
                                    <li className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                                        <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        </div>
                                        Automated Status Updates
                                    </li>
                                </ul>

                                <Button
                                    onClick={handleNext}
                                    className="w-full h-12 bg-[#0d5e5e] hover:bg-[#0a4a4a] text-white font-bold rounded-xl shadow-sm text-sm"
                                >
                                    Continue <ChevronRightIcon className="w-4 h-4 ml-1" />
                                </Button>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">

                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold text-slate-700 uppercase tracking-widest">API / Access Token</Label>
                                        <div className="relative">
                                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                type="password"
                                                placeholder="sk_live_..."
                                                className="pl-10 h-11 border-slate-200 rounded-xl bg-slate-50 focus-visible:ring-[#0d5e5e]/20"
                                            />
                                        </div>
                                    </div>

                                    <p className="text-[10px] text-slate-500 font-medium">
                                        Need help finding your token?
                                        <a href="#" className="font-bold text-[#0d5e5e] hover:underline ml-1">Read the documentation</a>
                                    </p>
                                </div>

                                <div className="pt-2 flex gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={() => setStep(1)}
                                        className="h-12 border-slate-200 text-slate-600 font-bold rounded-xl flex-1 shadow-sm"
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        onClick={handleNext}
                                        disabled={loading}
                                        className="h-12 bg-[#0d5e5e] hover:bg-[#0a4a4a] text-white font-bold rounded-xl flex-[2] shadow-sm transform transition-all active:scale-[0.98]"
                                    >
                                        {loading ? (
                                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</>
                                        ) : (
                                            <><Link2 className="w-4 h-4 mr-2" /> Connect Account</>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-center flex flex-col items-center">

                                <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-xs font-bold w-full uppercase tracking-widest">
                                    Telemetry: Excellent (42ms)
                                </div>

                                <div className="w-full bg-white border border-slate-200 p-4 pl-5 rounded-2xl shadow-sm flex items-center justify-between text-left">
                                    <div className="space-y-0.5">
                                        <Label htmlFor="auto-actions" className="text-sm font-bold text-slate-800 flex items-center">
                                            Enable AI Auto Actions <Zap className="w-3.5 h-3.5 ml-1.5 text-amber-500 fill-amber-500" />
                                        </Label>
                                        <p className="text-[10px] text-slate-500 font-medium">Allow OraDesk to create events automatically.</p>
                                    </div>
                                    <Switch
                                        id="auto-actions"
                                        checked={autoActions}
                                        onCheckedChange={setAutoActions}
                                        className="data-[state=checked]:bg-[#0d5e5e]"
                                    />
                                </div>

                                <Button
                                    onClick={handleClose}
                                    className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-sm text-sm"
                                >
                                    Finish Setup
                                </Button>
                            </div>
                        )}

                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

const ChevronRightIcon = (props: any) => (
    <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <polyline points="9 18 15 12 9 6" />
    </svg>
);
