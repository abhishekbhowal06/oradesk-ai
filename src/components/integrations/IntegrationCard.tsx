import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    ChevronDown,
    ChevronUp,
    Activity,
    AlertTriangle,
    CheckCircle2,
    Settings2,
    Lock,
    RefreshCcw,
    Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ConnectionWizardModal } from './ConnectionWizardModal';

export interface IntegrationCardProps {
    id: string;
    name: string;
    description: string;
    status: 'connected' | 'disconnected' | 'error';
    category: string;
    icon: React.ReactNode;
    dataFlow: {
        inbound: string[];
        outbound: string[];
    };
}

export const IntegrationCard = ({
    id,
    name,
    description,
    status,
    category,
    icon,
    dataFlow,
}: IntegrationCardProps) => {
    const [expanded, setExpanded] = useState(false);
    const [wizardOpen, setWizardOpen] = useState(false);

    const getStatusConfig = () => {
        switch (status) {
            case 'connected':
                return {
                    label: 'Connected',
                    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    icon: <CheckCircle2 className="w-3 h-3 mr-1" />,
                };
            case 'error':
                return {
                    label: 'Sync Error',
                    color: 'bg-red-50 text-red-700 border-red-200',
                    icon: <AlertTriangle className="w-3 h-3 mr-1" />,
                };
            default:
                return {
                    label: 'Not Connected',
                    color: 'bg-slate-50 text-slate-500 border-slate-200',
                    icon: null,
                };
        }
    };

    const statusConfig = getStatusConfig();

    return (
        <>
            <div
                className={cn(
                    "bg-white rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col group",
                    status === 'connected' ? "border-emerald-200/60 shadow-[0_4px_20px_rgb(16,185,129,0.05)]" : "border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                )}
            >
                <div className="p-6 flex-1 flex flex-col relative z-10">

                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 shadow-sm">
                            {icon}
                        </div>
                        <div className={cn("px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest flex items-center shadow-sm", statusConfig.color)}>
                            {statusConfig.icon}
                            {statusConfig.label}
                        </div>
                    </div>

                    <h3 className="text-lg font-black text-slate-800 mb-2">{name}</h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6 flex-1">
                        {description}
                    </p>

                    <div className="flex gap-2 w-full mt-auto pt-4 border-t border-slate-50">
                        {status === 'disconnected' ? (
                            <Button
                                onClick={() => setWizardOpen(true)}
                                className="w-full bg-[#0d5e5e] hover:bg-[#0a4a4a] text-white shadow-sm font-bold text-xs"
                            >
                                Connect System
                            </Button>
                        ) : (
                            <>
                                <Button
                                    variant="outline"
                                    className="flex-1 border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs shadow-sm"
                                    onClick={() => { }} // Stub manage action
                                >
                                    <Settings2 className="w-3 h-3 mr-2" />
                                    Manage
                                </Button>
                                {status === 'error' && (
                                    <Button
                                        variant="outline"
                                        className="border-red-200 text-red-700 hover:bg-red-50 font-bold text-xs shadow-sm"
                                        onClick={() => { }} // Stub retry action
                                    >
                                        <RefreshCcw className="w-3 h-3" />
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Expandable Details Section */}
                {status !== 'disconnected' && (
                    <div className="border-t border-slate-100 bg-slate-50/50">
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="w-full py-3 px-6 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-700 transition-colors"
                        >
                            {expanded ? 'Hide Details' : 'View Integration Details'}
                            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        <div
                            className={cn(
                                "overflow-hidden transition-all duration-300 ease-in-out px-6",
                                expanded ? "max-h-96 pb-6 opacity-100" : "max-h-0 opacity-0"
                            )}
                        >
                            <div className="space-y-4 pt-2">

                                {/* Data Flow */}
                                <div className="space-y-3">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center">
                                        <Activity className="w-3 h-3 mr-1.5" /> Data Flow Map
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                                            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Importing to OraDesk</span>
                                            <ul className="space-y-1">
                                                {dataFlow.inbound.map((item, i) => (
                                                    <li key={i} className="text-xs font-semibold text-slate-600 flex items-center">
                                                        <span className="w-1 h-1 rounded-full bg-[#0d5e5e] mr-2"></span>
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                                            <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Exporting to {name}</span>
                                            <ul className="space-y-1">
                                                {dataFlow.outbound.map((item, i) => (
                                                    <li key={i} className="text-xs font-semibold text-slate-600 flex items-center">
                                                        <span className="w-1 h-1 rounded-full bg-emerald-500 mr-2"></span>
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {/* Security Badge */}
                                <div className="mt-4 flex items-start gap-3 bg-blue-50/50 border border-blue-100 rounded-xl p-3">
                                    <Lock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="block text-[10px] font-bold text-blue-800 uppercase tracking-widest mb-0.5">Clinical Firewall Active</span>
                                        <span className="text-xs text-blue-600/80 font-medium">No clinical reports or sensitive medical records are imported.</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-[10px] font-medium text-slate-400">Syncs every 15 minutes</span>
                                    <button className="text-[10px] font-bold text-red-600 hover:text-red-700 uppercase tracking-widest transition-colors">
                                        Disconnect
                                    </button>
                                </div>

                            </div>
                        </div>
                    </div>
                )}

            </div>

            <ConnectionWizardModal
                isOpen={wizardOpen}
                onClose={() => setWizardOpen(false)}
                integrationName={name}
                icon={icon}
            />
        </>
    );
};
