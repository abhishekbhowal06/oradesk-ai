import React from 'react';
import { motion } from 'framer-motion';
import { Phone, Wifi, WifiOff, RefreshCw, Database } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useOraStore } from '@/stores/oraStore';
import { useClinic } from '@/contexts/ClinicContext';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import { cardVariants } from '@/lib/animations';

export function AIStatusStrip() {
    const { aiLiveStatus, activeCallsCount, lastPmsSyncTime } = useOraStore();
    const { currentClinic } = useClinic();
    const { data: health } = useSystemHealth();

    const statusConfig = {
        online: { label: 'AI Online', color: 'bg-emerald-500', ring: 'ring-emerald-500/30', text: 'text-emerald-700', bg: 'bg-emerald-50' },
        degraded: { label: 'Degraded', color: 'bg-amber-500', ring: 'ring-amber-500/30', text: 'text-amber-700', bg: 'bg-amber-50' },
        offline: { label: 'AI Offline', color: 'bg-red-500', ring: 'ring-red-500/30', text: 'text-red-700', bg: 'bg-red-50' },
    };

    const status = statusConfig[aiLiveStatus];
    const failoverStatus = health?.circuitBreakers?.allHealthy !== false;

    return (
        <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="flex items-center gap-6 px-5 py-2.5 bg-card border border-border/60 rounded-xl shadow-sm"
        >
            {/* AI Status Pulse */}
            <div className="flex items-center gap-2.5">
                <div className="relative flex items-center justify-center">
                    <motion.div
                        className={cn("h-2.5 w-2.5 rounded-full", status.color)}
                        animate={aiLiveStatus === 'online' ? { scale: [1, 1.3, 1], opacity: [1, 0.7, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                    />
                    <div className={cn("absolute h-5 w-5 rounded-full ring-2", status.ring, "opacity-40")} />
                </div>
                <span className={cn("text-xs font-bold", status.text)}>{status.label}</span>
            </div>

            <div className="h-4 w-px bg-border" />

            {/* Current Clinic */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Database className="h-3 w-3" />
                <span className="font-semibold text-foreground">{currentClinic?.name || '—'}</span>
            </div>

            <div className="h-4 w-px bg-border" />

            {/* Active Calls */}
            <div className="flex items-center gap-1.5 text-xs">
                <Phone className="h-3 w-3 text-primary" />
                <span className="font-bold text-foreground">{activeCallsCount}</span>
                <span className="text-muted-foreground">active now</span>
            </div>

            <div className="h-4 w-px bg-border" />

            {/* Failover */}
            <div className="flex items-center gap-1.5 text-xs">
                {failoverStatus ? (
                    <><Wifi className="h-3 w-3 text-emerald-500" /><span className="text-emerald-600 font-semibold">Failover OK</span></>
                ) : (
                    <><WifiOff className="h-3 w-3 text-red-500" /><span className="text-red-600 font-semibold">Failover Down</span></>
                )}
            </div>

            <div className="h-4 w-px bg-border" />

            {/* Last PMS Sync */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <RefreshCw className="h-3 w-3" />
                <span>PMS Synced {lastPmsSyncTime ? formatDistanceToNow(parseISO(lastPmsSyncTime), { addSuffix: true }) : 'Never'}</span>
            </div>
        </motion.div>
    );
}
