import React from 'react';
import { Building2, Globe, Phone, MapPin, Upload } from 'lucide-react';
import { useClinic } from '@/contexts/ClinicContext';

export function SettingsProfile({ markDirty }: { markDirty: () => void }) {
    const { currentClinic } = useClinic();

    if (!currentClinic) return null;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-1 border-b border-border/50 pb-5">
                <h2 className="text-2xl font-bold tracking-tight text-slate-800">Clinic Profile & Identity</h2>
                <p className="text-sm text-slate-500 font-medium">Manage how your clinic appears to patients and integrations.</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* Left Form Form */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="bg-white border text-sm font-medium border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">

                        {/* Logo Upload */}
                        <div className="flex items-center gap-6 pb-6 border-b border-slate-100">
                            <div className="w-20 h-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center relative overflow-hidden group hover:border-[#0d5e5e]/40 transition-colors">
                                <Upload className="w-6 h-6 text-slate-400 group-hover:text-[#0d5e5e] transition-colors" />
                                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={markDirty} />
                            </div>
                            <div className="flex flex-col">
                                <h4 className="text-sm font-bold text-slate-700">Clinic Logo / Icon</h4>
                                <p className="text-xs text-slate-500 mt-1 max-w-sm">Upload a square logo (1:1 ratio) in PNG or SVG format. Recommended size is 512x512px.</p>
                            </div>
                        </div>

                        {/* Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <Building2 className="w-3 h-3" /> Clinic Name
                                </label>
                                <input
                                    type="text"
                                    defaultValue={currentClinic.name}
                                    onChange={markDirty}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d5e5e]/20"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <Phone className="w-3 h-3" /> Primary Contact
                                </label>
                                <input
                                    type="text"
                                    defaultValue={currentClinic.phone || ''}
                                    placeholder="+1 (555) 000-0000"
                                    onChange={markDirty}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d5e5e]/20"
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <MapPin className="w-3 h-3" /> Physical Address
                                </label>
                                <input
                                    type="text"
                                    defaultValue={currentClinic.address || ''}
                                    placeholder="123 Medical Plaza, Suite 400..."
                                    onChange={markDirty}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d5e5e]/20"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <Globe className="w-3 h-3" /> Website URL
                                </label>
                                <input
                                    type="url"
                                    placeholder="https://yourclinic.com"
                                    onChange={markDirty}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d5e5e]/20"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Time Zone</label>
                                <select onChange={markDirty} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0d5e5e]/20">
                                    <option>America/New_York (EST)</option>
                                    <option>America/Chicago (CST)</option>
                                    <option>America/Denver (MST)</option>
                                    <option>America/Los_Angeles (PST)</option>
                                </select>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Right Preview Card */}
                <div className="xl:col-span-1">
                    <div className="sticky top-8 bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-[#0d5e5e]"></div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[#0d5e5e] mb-4">Patient View Preview</h3>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="h-24 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
                                <div className="w-12 h-12 bg-white rounded-full shadow-sm border border-slate-200 flex items-center justify-center">
                                    <Building2 className="w-5 h-5 text-slate-400" />
                                </div>
                            </div>
                            <div className="p-4 text-center">
                                <h4 className="font-bold text-slate-800">{currentClinic.name}</h4>
                                <p className="text-xs text-slate-500 mt-1">{currentClinic.address || 'Address not set'}</p>
                                <div className="mt-4 flex gap-2">
                                    <div className="flex-1 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-100 flex items-center justify-center gap-1.5">
                                        <Phone className="w-3 h-3" /> Call
                                    </div>
                                    <div className="flex-1 py-1.5 bg-slate-50 text-slate-600 text-xs font-bold rounded-lg border border-slate-200 flex items-center justify-center gap-1.5">
                                        <Globe className="w-3 h-3" /> Web
                                    </div>
                                </div>
                            </div>
                        </div>

                        <p className="text-[10px] text-slate-400 font-medium text-center mt-4">
                            This is how your clinic's identity appears in SMS, Email layouts, and patient portals.
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}
