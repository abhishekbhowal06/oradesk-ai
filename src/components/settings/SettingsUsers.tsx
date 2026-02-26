import React from 'react';
import { UserPlus, Shield, Clock, Smartphone, MoreVertical, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useClinic } from '@/contexts/ClinicContext';
import { useAuth } from '@/contexts/AuthContext';

export function SettingsUsers({ markDirty }: { markDirty: () => void }) {
    const { memberships } = useClinic();
    const { profile } = useAuth();

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-1 border-b border-border/50 pb-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-800">User & Role Management</h2>
                        <p className="text-sm text-slate-500 font-medium">Control who has access to your clinic's data and their permission levels.</p>
                    </div>
                    <Button className="bg-[#0d5e5e] hover:bg-[#0a4848] text-white">
                        <UserPlus className="w-4 h-4 mr-2" /> Invite Staff
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

                {/* Left main content */}
                <div className="xl:col-span-2 space-y-6">

                    {/* Active Users Table */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-700">Active Team Members</h3>
                            <span className="text-xs font-bold text-[#0d5e5e] px-2 py-1 bg-emerald-50 rounded-md border border-emerald-100">{memberships.length} Users</span>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {memberships.map((m, idx) => (
                                <div key={idx} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center border border-emerald-200 shrink-0">
                                            {m.profile?.full_name?.charAt(0) || 'U'}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-800">{m.profile?.full_name || 'Pending Invite'}</span>
                                            <span className="text-xs font-medium text-slate-500">{m.profile?.email || 'No email provided'}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="flex flex-col items-end sm:items-start">
                                            <select
                                                defaultValue={m.role}
                                                onChange={markDirty}
                                                disabled={profile?.id === m.user_id} // don't change own role
                                                className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 border-none rounded-md px-2 py-1 cursor-pointer outline-none focus:ring-2 focus:ring-[#0d5e5e]/20"
                                            >
                                                <option value="owner">Owner</option>
                                                <option value="admin">Admin</option>
                                                <option value="doctor">Doctor</option>
                                                <option value="staff">Front Desk</option>
                                                <option value="readonly">Read Only</option>
                                            </select>
                                            <span className="text-[10px] text-slate-400 font-medium mt-1 flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> Last login: Today
                                            </span>
                                        </div>

                                        <button className="text-slate-400 hover:text-slate-700 transition-colors p-2 rounded-lg hover:bg-slate-100">
                                            <MoreVertical className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Right Sidebar */}
                <div className="xl:col-span-1 space-y-6">

                    {/* Security Policy Card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[#0d5e5e] mb-4 flex items-center gap-2">
                            <Shield className="w-4 h-4" /> Login Security
                        </h3>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><Smartphone className="w-4 h-4 text-slate-500" /> Enforce 2FA</span>
                                    <span className="text-xs text-slate-500 mt-0.5">Require all staff to use 2FA</span>
                                </div>
                                <Switch onCheckedChange={markDirty} />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><Key className="w-4 h-4 text-slate-500" /> SSO Only</span>
                                    <span className="text-xs text-slate-500 mt-0.5">Disable email/password login</span>
                                </div>
                                <Switch onCheckedChange={markDirty} />
                            </div>
                        </div>
                    </div>

                    {/* Active Sessions */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Your Active Sessions</h3>
                        <div className="space-y-4">
                            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-emerald-900">Chrome on Windows</span>
                                    <span className="text-xs font-medium text-emerald-700/70">Current Session • IP: 192.168.1.1</span>
                                </div>
                            </div>
                            <Button variant="outline" className="w-full text-xs font-bold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                                Sign Out All Other Devices
                            </Button>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
}
