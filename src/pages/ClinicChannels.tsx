import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageSquare, QrCode, Plus, CheckCircle2, ShieldCheck, Info } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';

export default function ClinicChannels() {
    const [waConnected, setWaConnected] = useState(false);
    const [isQRModalOpen, setIsQRModalOpen] = useState(false);

    // Simulation of QR Scan process
    const simulateQRScan = () => {
        setTimeout(() => {
            setWaConnected(true);
            setIsQRModalOpen(false);
        }, 2000);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-12 w-full max-w-6xl mx-auto">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground tracking-tight">Phone & WhatsApp</h1>
                <p className="text-muted-foreground mt-2 text-lg">
                    Connect your clinic's communication lines to enable AI-powered patient outreach.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Phone Section */}
                <div className="bg-white border rounded-3xl p-6 md:p-8 shadow-sm flex flex-col h-full">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-14 w-14 rounded-2xl bg-[#0d5e5e]/10 flex items-center justify-center text-[#0d5e5e]">
                            <Phone className="h-7 w-7" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-foreground">AI Voice Line</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-none px-2.5 py-0.5">
                                    Automated Calling
                                </Badge>
                            </div>
                        </div>
                    </div>

                    <p className="text-slate-600 mb-8 flex-1">
                        Assign a dedicated phone number for your AI receptionist to handle missed calls and
                        automated patient reminders seamlessly.
                    </p>

                    <div className="space-y-4 mb-8">
                        <div className="flex items-center justify-between p-4 rounded-2xl border bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                </div>
                                <div>
                                    <div className="font-bold text-foreground">+1 (555) 019-2834</div>
                                    <div className="text-xs font-semibold text-emerald-600 mt-0.5">
                                        Primary Outreach Line
                                    </div>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="text-slate-500">
                                Manage
                            </Button>
                        </div>
                    </div>

                    <Button className="w-full bg-white text-[#0d5e5e] border-2 border-[#0d5e5e]/20 hover:bg-[#0d5e5e]/5 font-bold rounded-xl h-12">
                        <Plus className="mr-2 h-5 w-5" /> Add New Clinic Line
                    </Button>
                </div>

                {/* WhatsApp QR Section */}
                <div className="bg-white border text-foreground rounded-3xl shadow-sm flex flex-col h-full overflow-hidden relative">
                    {/* Subtle medical gradient background accent */}
                    <div className="absolute top-0 right-0 p-32 bg-emerald-50 blur-3xl rounded-full opacity-60 pointer-events-none -mr-16 -mt-16" />

                    <div className="p-6 md:p-8 flex-1 flex flex-col relative z-10">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="h-14 w-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                                <MessageSquare className="h-7 w-7 fill-emerald-600/20" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">Clinic WhatsApp</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge className="bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-none px-2.5 py-0.5">
                                        Secure Messaging
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        <p className="text-slate-600 mb-8 flex-1 text-[15px] leading-relaxed">
                            Connect your clinic's existing WhatsApp simply by scanning a QR code. Your AI will
                            instantly be able to chat with patients on your behalf.
                        </p>

                        {waConnected ? (
                            <div className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-emerald-100 bg-emerald-50 text-center animate-in zoom-in-95 duration-500">
                                <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                                </div>
                                <h3 className="text-xl font-bold text-emerald-900 mb-2">WhatsApp Connected!</h3>
                                <p className="text-emerald-700 text-sm font-medium mb-6">
                                    Your AI assistant is now synced with your clinic's WhatsApp account.
                                </p>
                                <Button
                                    variant="outline"
                                    className="border-emerald-200 text-emerald-700 font-bold hover:bg-emerald-100 rounded-xl"
                                    onClick={() => setWaConnected(false)}
                                >
                                    Disconnect
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in duration-500">
                                <div className="bg-slate-50 border rounded-2xl p-5 flex items-start gap-4">
                                    <ShieldCheck className="h-6 w-6 text-[#0d5e5e] shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-bold text-sm text-foreground mb-1">How it works</h4>
                                        <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside marker:text-[#0d5e5e] marker:font-bold">
                                            <li>Open WhatsApp on your clinic phone</li>
                                            <li>
                                                Go to <strong>Settings</strong> {'>'} <strong>Linked Devices</strong>
                                            </li>
                                            <li>
                                                Tap <strong>Link a Device</strong> and scan the QR
                                            </li>
                                        </ol>
                                    </div>
                                </div>

                                <Dialog open={isQRModalOpen} onOpenChange={setIsQRModalOpen}>
                                    <DialogTrigger asChild>
                                        <Button className="w-full bg-[#0d5e5e] hover:bg-[#0d5e5e]/90 text-white font-bold rounded-xl h-14 text-lg shadow-md hover:shadow-lg transition-all">
                                            <QrCode className="mr-2 h-6 w-6" /> Scan QR to Connect
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md">
                                        <DialogHeader>
                                            <DialogTitle className="text-2xl font-bold text-center pt-4">
                                                Link Clinic WhatsApp
                                            </DialogTitle>
                                            <DialogDescription className="text-center text-base pt-2">
                                                Scan this QR code from your clinic's phone to activate AI messaging.
                                            </DialogDescription>
                                        </DialogHeader>

                                        <div className="flex flex-col items-center justify-center py-8">
                                            {/* Fake QR Code block */}
                                            <div
                                                className="bg-white p-4 rounded-xl shadow-sm border mb-6 relative cursor-pointer"
                                                onClick={simulateQRScan}
                                            >
                                                <div className="absolute inset-0 bg-[#0d5e5e]/5 rounded-xl opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                                                    <span className="bg-[#0d5e5e] text-white text-xs font-bold px-3 py-1.5 rounded-full">
                                                        Click to Simulate Scan
                                                    </span>
                                                </div>
                                                <img
                                                    src="https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg"
                                                    alt="QR Code"
                                                    className="w-48 h-48 opacity-90"
                                                />
                                            </div>

                                            <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium bg-slate-50 px-4 py-2 rounded-full">
                                                <Info className="h-4 w-4" /> Keep the app open while scanning
                                            </div>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
