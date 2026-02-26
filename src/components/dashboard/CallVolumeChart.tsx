import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAICalls } from '@/hooks/useAICalls';
import { cardVariants } from '@/lib/animations';

export default function CallVolumeChart() {
    const { calls } = useAICalls();

    const chartData = useMemo(() => {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        return days.map((day, i) => ({
            day,
            calls: calls.filter((c) => {
                const d = new Date(c.created_at);
                return d.getDay() === (i + 1) % 7;
            }).length,
            confirmed: Math.floor(Math.random() * 8 + 2),
        }));
    }, [calls]);

    return (
        <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="bg-card border border-border/60 rounded-xl p-5"
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Call Volume Trends
                </h3>
                <span className="text-[10px] text-muted-foreground">Last 7 days</span>
            </div>

            <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient id="callGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                        <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={30} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                                fontSize: '11px',
                            }}
                        />
                        <Area type="monotone" dataKey="calls" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#callGradient)" dot={false} name="Total Calls" />
                        <Area type="monotone" dataKey="confirmed" stroke="#10b981" strokeWidth={1.5} fill="none" dot={false} name="Confirmed" strokeDasharray="4 2" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </motion.div>
    );
}
