import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    CreditCard,
    Phone,
    CalendarDays,
    Megaphone,
    Stethoscope,
    Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface IntegrationSidebarProps {
    activeCategory: string;
    setActiveCategory: (cat: string) => void;
    devMode: boolean;
    setDevMode: (val: boolean) => void;
}

const CATEGORIES = [
    { id: 'all', label: 'All Integrations', icon: Globe },
    { id: 'connected', label: 'Connected', icon: null }, // special visual handling
    { id: 'clinic', label: 'Clinic Systems', icon: Stethoscope },
    { id: 'calls', label: 'Calls & WhatsApp', icon: Phone },
    { id: 'calendars', label: 'Calendars', icon: CalendarDays },
    { id: 'billing', label: 'Billing & Payments', icon: CreditCard },
    { id: 'marketing', label: 'Marketing & CRM', icon: Megaphone },
];

export const IntegrationSidebar = ({ activeCategory, setActiveCategory, devMode, setDevMode }: IntegrationSidebarProps) => {
    return (
        <div className="w-full xl:w-64 shrink-0 space-y-6">

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Categories</h3>
                </div>
                <div className="p-2 space-y-1">
                    {CATEGORIES.map(cat => {
                        const Icon = cat.icon;
                        const isActive = activeCategory === cat.id;

                        return (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className={cn(
                                    "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
                                    isActive
                                        ? "bg-[#0d5e5e]/5 text-[#0d5e5e]"
                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                )}
                            >
                                <div className="flex items-center gap-2.5">
                                    {Icon && <Icon className={cn("h-4 w-4", isActive ? "text-[#0d5e5e]" : "text-slate-400")} />}
                                    {!Icon && cat.id === 'connected' && (
                                        <div className="h-2 w-2 rounded-full bg-emerald-500 ml-1 mr-1.5" />
                                    )}
                                    {cat.label}
                                </div>
                                {isActive && <div className="h-1.5 w-1.5 rounded-full bg-[#0d5e5e]" />}
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label htmlFor="advanced-view" className="text-sm font-bold text-slate-700">Advanced View</Label>
                        <p className="text-[10px] text-slate-500 font-medium">Developer Mode enabled</p>
                    </div>
                    <Switch
                        id="advanced-view"
                        checked={devMode}
                        onCheckedChange={setDevMode}
                        className="data-[state=checked]:bg-[#0d5e5e]"
                    />
                </div>
            </div>

        </div>
    );
};
