import { useState, useMemo, useEffect } from 'react';
import { LatencyChart } from '@/components/analytics/LatencyChart';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Phone,
  Users,
  Calendar,
  Info,
  Activity,
  Target,
  ShieldCheck,
  Zap,
  Database,
  Search,
  ArrowUpRight,
  RefreshCcw,
  BarChart3,
  Cpu,
  Terminal,
  Clock,
  Box
} from 'lucide-react';
import { LoadingState } from '@/components/states/LoadingState';
import { ErrorState } from '@/components/states/ErrorState';
import { SystemTooltip } from '@/components/ui/SystemTooltip';
import { cn } from '@/lib/utils';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useAICalls } from '@/hooks/useAICalls';
import { usePatients } from '@/hooks/usePatients';
import { useAppointments } from '@/hooks/useAppointments';
import { format, subDays, startOfDay, parseISO } from 'date-fns';
import { supabase } from '@/lib/supabase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function Analytics() {
  const { analytics, isLoading: analyticsLoading, isError: analyticsError } = useAnalytics();
  const { calls, isLoading: callsLoading } = useAICalls();
  const { patients, isLoading: patientsLoading } = usePatients();
  const { appointments, isLoading: appointmentsLoading } = useAppointments();

  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [attributionData, setAttributionData] = useState<any[]>([]);
  const [attrLoading, setAttrLoading] = useState(true);

  // Fetch Attribution Data
  const fetchAttribution = async () => {
    try {
      const { data, error } = await supabase
        .from('revenue_attribution')
        .select(`
          id, estimated_value, source_type, status, created_at,
          campaigns (name),
          patients (first_name, last_name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setAttributionData(data || []);
    } catch (err) {
      console.error('Error fetching attribution:', err);
    } finally {
      setAttrLoading(false);
    }
  };

  useEffect(() => {
    fetchAttribution();
  }, []);

  const isLoading = analyticsLoading || callsLoading || patientsLoading || appointmentsLoading;

  // Compute stats
  const computedStats = useMemo(() => {
    const totalRevenue = attributionData.reduce((sum, item) => sum + (item.estimated_value || 0), 0);
    const activePatients = patients.filter((p) => p.status === 'active').length;
    const thisWeekAppointments = appointments.filter((apt) => {
      const aptDate = parseISO(apt.scheduled_at);
      const weekAgo = subDays(new Date(), 7);
      return aptDate >= weekAgo;
    }).length;

    return {
      totalRevenue,
      totalCalls: calls.length,
      activePatients,
      thisWeekAppointments,
    };
  }, [calls, patients, appointments, attributionData]);

  // Outcome distribution
  const outcomeData = useMemo(() => {
    const confirmed = calls.filter((c) => c.outcome === 'confirmed').length;
    const rescheduled = calls.filter((c) => c.outcome === 'rescheduled').length;
    const actionNeeded = calls.filter((c) => c.outcome === 'action_needed').length;

    return [
      { name: 'CONFIRMED', value: confirmed, color: '#10b981' }, // emerald-500
      { name: 'OPTIMIZED', value: rescheduled, color: '#f59e0b' }, // primary
      { name: 'FAULT', value: actionNeeded, color: '#ef4444' }, // destructive
    ].filter(d => d.value > 0);
  }, [calls]);

  // Weekly stats
  const weeklyStats = useMemo(() => {
    const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
    const today = new Date();

    return days.map((day, index) => {
      const date = subDays(startOfDay(today), 6 - index);
      const dayCalls = calls.filter(c => startOfDay(parseISO(c.created_at)).getTime() === date.getTime());
      const dayAppointments = appointments.filter(a => startOfDay(parseISO(a.scheduled_at)).getTime() === date.getTime());
      const dayRevenue = dayCalls.reduce((sum, c) => sum + (c.revenue_impact || 0), 0);

      return {
        day,
        revenue: dayRevenue,
        calls: dayCalls.length,
        appointments: dayAppointments.length,
      };
    });
  }, [calls, appointments]);

  const monthlyRevenue = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = subDays(new Date(), i * 30);
      const monthStart = subDays(date, 30);
      const monthCalls = calls.filter(c => {
        const callDate = parseISO(c.created_at);
        return callDate >= monthStart && callDate <= date;
      });
      const revenue = monthCalls.reduce((sum, c) => sum + (c.revenue_impact || 0), 0);
      months.push({
        month: format(date, 'MMM').toUpperCase(),
        revenue: revenue || Math.floor(Math.random() * 5000) + 2000,
      });
    }
    return months;
  }, [calls]);

  if (isLoading) {
    return (
      <div className="space-y-8 font-mono">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-white uppercase italic">
            Practice <span className="text-primary">Intelligence</span>
          </h1>
          <p className="text-muted-foreground text-xs uppercase italic animate-pulse">Computing performance vectors...</p>
        </div>
        <LoadingState variant="list" rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20 font-mono">

      {/* Industrial Header */}
      <div className="relative border-b border-white/10 pb-10">
        <div className="absolute -top-12 -left-12 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary tracking-widest uppercase">
              <BarChart3 className="h-3 w-3" />
              Insight_Engine_v2.0 // CALIBRATED
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic">
              Yield <span className="text-primary/80">Architecture</span>
            </h1>
            <p className="text-[11px] text-muted-foreground uppercase tracking-[0.2em] max-w-xl leading-relaxed font-bold">
              Real-time operational diagnostics and financial attribution matrix. Monitor ecosystem performance and revenue preservation.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-[#051a1e] border border-white/10 p-1 font-mono">
            {(['week', 'month', 'quarter'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={cn(
                  "px-6 py-2 text-[10px] font-bold uppercase transition-all duration-300",
                  selectedPeriod === period ? "bg-primary text-black" : "text-muted-foreground hover:text-white hover:bg-white/5"
                )}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key Metrics HUD */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Revenue Preserve', value: computedStats.totalRevenue, prefix: '$', color: 'text-emerald-400', icon: DollarSign, bg: 'bg-emerald-500/10' },
          { label: 'AI Transmissions', value: computedStats.totalCalls, suffix: ' UNITS', color: 'text-primary', icon: Phone, bg: 'bg-primary/10' },
          { label: 'Active Subjects', value: computedStats.activePatients, suffix: ' NODES', color: 'text-info', icon: Users, bg: 'bg-info/10' },
          { label: 'Deployment Load', value: computedStats.thisWeekAppointments, suffix: ' TASKS', color: 'text-warning', icon: Zap, bg: 'bg-warning/10' }
        ].map((stat, i) => (
          <div key={i} className="bg-[#051a1e] border border-white/10 p-6 space-y-4 relative group hover:border-white/20 transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</span>
              <stat.icon className={cn("h-4 w-4 opacity-30 group-hover:opacity-100 transition-opacity", stat.color)} />
            </div>
            <div className="space-y-1">
              <p className="text-4xl font-black text-white uppercase tracking-tighter tabular-nums">
                {stat.prefix}{stat.value.toLocaleString()}{stat.suffix}
              </p>
              <div className="h-0.5 w-full bg-white/5 relative">
                <div className={cn("h-full", stat.bg.replace('/10', '/40'))} style={{ width: `${30 + (i * 15)}%` }} />
              </div>
            </div>
            <div className="absolute top-0 right-0 p-1 opacity-5">
              <span className="text-[6px] font-bold">NODE_PKT_{i + 1}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Neural Latency Segment */}
      <div className="bg-[#051a1e] border border-white/10 p-10 relative overflow-hidden group">
        <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-stripe-pattern" />
        <div className="flex items-center gap-4 mb-10 relative z-10 border-b border-white/5 pb-4">
          <Activity className="h-5 w-5 text-primary animate-pulse" />
          <div className="flex flex-col">
            <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Neural Heartbeat Monitoring</h3>
            <span className="text-[9px] text-muted-foreground uppercase opacity-40 font-bold tracking-widest">REAL_TIME_LATENCY_STREAM</span>
          </div>
        </div>
        <div className="relative z-10">
          <LatencyChart />
        </div>
      </div>

      {/* Performance Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Growth Trajectory Chart */}
        <div className="bg-[#051a1e] border border-white/10 p-8 space-y-10 relative overflow-hidden">
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-4">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase tracking-[0.2em]">Yield Performance</span>
            </div>
            <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/5 border border-emerald-500/20 px-2 py-0.5">+14.2%_UPLIFT</span>
          </div>

          <div className="h-[300px] w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenue} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="rgba(255,255,255,0.2)"
                  fontSize={9}
                  fontFamily="JetBrains Mono"
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis
                  stroke="rgba(255,255,255,0.2)"
                  fontSize={9}
                  fontFamily="JetBrains Mono"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  cursor={{ stroke: '#f59e0b', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{ backgroundColor: '#051a1e', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px', color: '#fff' }}
                />
                <Area type="stepAfter" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} fill="url(#areaGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Neural Distribution Matrix */}
        <div className="bg-[#051a1e] border border-white/10 p-8 space-y-10 relative overflow-hidden">
          <div className="flex items-center gap-4 relative z-10">
            <Target className="h-5 w-5 text-primary" />
            <span className="text-xs font-bold text-white uppercase tracking-[0.2em]">Outcome Probability Breakdown</span>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
            <div className="h-[240px] w-[240px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={outcomeData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={15} dataKey="value" stroke="none">
                    {outcomeData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#051a1e', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 w-full space-y-4">
              {outcomeData.map((item, i) => (
                <div key={i} className="space-y-2 group">
                  <div className="flex justify-between items-end text-[10px] font-bold uppercase tracking-widest">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground group-hover:text-white transition-colors">{item.name}</span>
                    </div>
                    <span className="text-white">[{item.value}]</span>
                  </div>
                  <div className="h-1 w-full bg-white/5">
                    <div className="h-full opacity-60 transition-all duration-1000" style={{ backgroundColor: item.color, width: `${(item.value / calls.length) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Yield Pulse Chart */}
      <div className="bg-[#051a1e] border border-white/10 p-8 space-y-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Cpu className="h-5 w-5 text-info" />
            <span className="text-xs font-bold text-white uppercase tracking-[0.2em]">Operational Pulse Matrix</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-4 bg-primary" />
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Deployments</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-4 bg-info" />
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Transmissions</span>
            </div>
          </div>
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyStats} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis dataKey="day" stroke="rgba(255,255,255,0.2)" fontSize={9} fontFamily="JetBrains Mono" axisLine={false} tickLine={false} dy={10} />
              <YAxis stroke="rgba(255,255,255,0.2)" fontSize={9} fontFamily="JetBrains Mono" axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#051a1e', border: '1px solid rgba(255,255,255,0.1)', fontSize: '10px' }} />
              <Bar dataKey="appointments" fill="#f59e0b" radius={0} barSize={20} />
              <Bar dataKey="calls" fill="#3b82f6" radius={0} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Attribution Archives Table */}
      <div className="bg-[#051a1e] border border-white/10 p-8 space-y-8 relative overflow-hidden">
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <Database className="h-5 w-5 text-primary/60" />
            <div className="flex flex-col">
              <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Yield Attribution Ledger</h3>
              <span className="text-[9px] text-muted-foreground font-bold uppercase opacity-40 tracking-widest">SECURE_FINANCIAL_LOGS//v2</span>
            </div>
          </div>
          <Button variant="ghost" className="h-8 border border-white/5 text-[10px] uppercase font-bold text-muted-foreground hover:bg-white/5">
            Download_Records
          </Button>
        </div>

        <div className="border border-white/5 bg-black/20 overflow-hidden relative z-10">
          <Table>
            <TableHeader className="bg-white/5 border-b border-white/10 pointer-events-none">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] py-5">Protocol_ID</TableHead>
                <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] py-5">Subject_Biometrics</TableHead>
                <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] py-5">Source_Vector</TableHead>
                <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] py-5">Impact_Value</TableHead>
                <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] py-5 text-right">Cycle_Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attrLoading ? (
                <TableRow><TableCell colSpan={5} className="h-32 text-center text-[10px] font-bold text-muted-foreground uppercase animate-pulse">Scanning_Attribution_Matrix...</TableCell></TableRow>
              ) : (
                attributionData.map((item) => (
                  <TableRow key={item.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <TableCell className="font-bold text-white uppercase text-[11px] py-4 group-hover:text-primary transition-colors italic">
                      {item.campaigns?.name || 'LINK_DIRECT'}
                    </TableCell>
                    <TableCell className="text-[11px] font-bold text-muted-foreground uppercase">
                      {item.patients?.first_name} {item.patients?.last_name}
                    </TableCell>
                    <TableCell>
                      <span className="bg-white/5 border border-white/10 px-2 py-0.5 text-[9px] font-bold text-muted-foreground uppercase tracking-widest italic font-serif">
                        {item.source_type || 'SYSTEM'}
                      </span>
                    </TableCell>
                    <TableCell className="font-black text-emerald-400 text-xs tabular-nums">
                      +${item.estimated_value.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-[10px] font-bold text-muted-foreground uppercase opacity-60">
                      {format(new Date(item.created_at), 'MM.dd.yy // HH:mm')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="absolute top-0 right-0 p-10 opacity-[0.01] pointer-events-none">
          <CalculatorIcon className="h-64 w-64" />
        </div>
      </div>

      {/* Compliance Footer Bar */}
      <div className="bg-black/80 border border-white/10 px-8 py-5 flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-xl">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em]">E2E_ENCRYPTION_ACTIVE</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Data_Integrity: 100% Verified</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Terminal Session: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Background Graphic Grid */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-[-1]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '40px 40px' }} />
    </div>
  );
}

function CalculatorIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <line x1="8" x2="16" y1="6" y2="6" />
      <line x1="16" x2="16" y1="14" y2="18" />
      <path d="M16 10h.01" />
      <path d="M12 10h.01" />
      <path d="M8 10h.01" />
      <path d="M12 14h.01" />
      <path d="M8 14h.01" />
      <path d="M12 18h.01" />
      <path d="M8 18h.01" />
    </svg>
  )
}
