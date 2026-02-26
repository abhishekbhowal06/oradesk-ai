import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  PhoneCall,
  CheckCircle,
  Trash2,
  Box,
  Target,
  Zap,
  Activity,
  Cpu,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useClinic } from '@/contexts/ClinicContext';

interface Lead {
  id: string;
  patient_id: string;
  status: 'new' | 'contacted' | 'booked' | 'nurture' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  ai_summary: string | null;
  source: string | null;
  last_contacted_at: string | null;
  created_at: string;
  patients: {
    first_name: string;
    last_name: string;
    phone: string;
    last_visit: string | null;
  };
}

const Leads = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentClinic } = useClinic();

  useEffect(() => {
    if (currentClinic) {
      fetchLeads();
    }
  }, [currentClinic]);

  const fetchLeads = async () => {
    try {
      setLoading(true);

      // JOIN with patients table
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id, status, priority, ai_summary, created_at, source, last_contacted_at, patient_id,
          patients (first_name, last_name, phone, last_visit)
        `)
        .eq('clinic_id', currentClinic?.id)
        .in('status', ['new', 'contacted', 'nurture']) // Active leads
        .order('priority', { ascending: false }) // Critical first
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data as unknown as Lead[] || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const handleCallBack = async (lead: Lead) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      toast.promise(
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/v1/calls/outbound`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            patient_id: lead.patient_id,
            call_type: 'recall', // Treated as restart/recall
          }),
        }).then(async (res) => {
          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Call failed');
          }
          return res.json();
        }),
        {
          loading: 'Initiating call...',
          success: 'Call initiated! AI agent is dialing.',
          error: (err) => `Call failed: ${err.message}`
        }
      );

      // Optimistic update
      updateStatus(lead.id, 'contacted');

    } catch (error: any) {
      console.error('Call error:', error);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          status: newStatus,
          // If contacted, update timestamp
          ...(newStatus === 'contacted' ? { last_contacted_at: new Date().toISOString() } : {})
        })
        .eq('id', id);

      if (error) throw error;

      toast.success(`Status updated: ${newStatus}`);
      fetchLeads();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const getPriorityStyle = (p: string) => {
    switch (p) {
      case 'critical': return 'bg-destructive/10 text-destructive border-destructive/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]';
      case 'high': return 'bg-primary/10 text-primary border-primary/30';
      case 'medium': return 'bg-info/10 text-info border-info/30';
      default: return 'bg-white/5 text-muted-foreground border-white/10';
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20 font-mono">

      {/* Industrial Header */}
      <div className="relative border-b border-white/10 pb-10">
        <div className="absolute -top-12 -left-12 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary tracking-widest uppercase">
              <Target className="h-3 w-3" />
              Leads
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white uppercase italic">
              Lead <span className="text-primary/80">Queue</span>
            </h1>
            <p className="text-[11px] text-muted-foreground uppercase tracking-[0.2em] max-w-xl leading-relaxed font-bold">
              High-value conversion pipeline. AI-driven follow-ups.
            </p>
          </div>

          <div className="flex items-center gap-4 border border-white/10 bg-white/5 px-6 py-4">
            <Zap className="h-5 w-5 text-primary/40 animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-white uppercase tracking-widest">Active_Leads</span>
              <span className="text-[8px] text-muted-foreground font-bold uppercase">{leads.length} pending</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI HUD */}
      <div className="grid gap-6 md:grid-cols-3">
        {[
          { label: 'Critical Actions', count: leads.filter((l) => l.priority === 'critical').length, desc: 'Immediate revenue risk', color: 'text-destructive' },
          { label: 'New Inbound', count: leads.filter((l) => l.status === 'new').length, desc: 'Needs initial contact', color: 'text-white' },
          { label: 'Nurture List', count: leads.filter((l) => l.status === 'nurture').length, desc: 'Warm leads', color: 'text-emerald-400' }
        ].map((stat, i) => (
          <div key={i} className="bg-[#051a1e] border border-white/10 p-6 flex flex-col justify-between hover:border-white/30 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-6">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</span>
              <Activity className="h-4 w-4 text-white/10 group-hover:text-primary transition-colors" />
            </div>
            <div>
              <p className={cn("text-4xl font-black tracking-tighter tabular-nums", stat.color)}>{stat.count.toString().padStart(2, '0')}</p>
              <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-2 opacity-40">{stat.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Table Matrix */}
      <div className="bg-[#051a1e] border border-white/10 p-8 space-y-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
          <Box className="h-48 w-48" />
        </div>

        <div className="flex items-center justify-between border-b border-white/5 pb-6">
          <div className="flex items-center gap-4">
            <Cpu className="h-5 w-5 text-primary" />
            <div className="flex flex-col">
              <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Active Leads</h3>
              <p className="text-[9px] text-muted-foreground uppercase opacity-40 tracking-widest">Sorted by priority</p>
            </div>
          </div>
        </div>

        <div className="border border-white/5 bg-black/20 overflow-hidden relative z-10">
          <Table>
            <TableHeader className="bg-white/5 border-b border-white/10">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] py-5">Priority</TableHead>
                <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] py-5">Patient</TableHead>
                <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] py-5">AI Context</TableHead>
                <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] py-5">Source</TableHead>
                <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] py-5">Last Contact</TableHead>
                <TableHead className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] py-5 text-right">Protocol</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="h-32 text-center text-[10px] font-bold text-muted-foreground uppercase animate-pulse">Scanning leads database...</TableCell></TableRow>
              ) : leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center justify-center gap-4 opacity-30">
                      <CheckCircle className="h-10 w-10 text-emerald-400" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Grid Empty — Pipeline Clear</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => (
                  <TableRow key={lead.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <TableCell>
                      <div className={cn("px-2 py-0.5 border text-[9px] font-bold uppercase tracking-widest", getPriorityStyle(lead.priority))}>
                        {lead.priority}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-[11px] font-black text-white uppercase italic tracking-tighter group-hover:text-primary transition-colors">
                          {lead.patients.first_name} {lead.patients.last_name}
                        </span>
                        <div className="flex items-center gap-2 text-[9px] font-bold text-muted-foreground opacity-60">
                          {lead.patients.phone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed line-clamp-2 italic" title={lead.ai_summary || ''}>
                        "{lead.ai_summary || 'No summary available.'}"
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-40 border-l border-white/10 pl-3">
                        {lead.source || 'Direct'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">
                        {lead.last_contacted_at ? new Date(lead.last_contacted_at).toLocaleDateString() : 'NEVER'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-3">
                        <Button
                          size="sm"
                          className="h-9 px-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-[9px] uppercase tracking-widest rounded-none hover:bg-emerald-500/20 transition-all shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                          onClick={() => updateStatus(lead.id, 'booked')}
                        >
                          <CheckCircle className="h-3 w-3 mr-2" />
                          Booked
                        </Button>
                        <Button
                          size="sm"
                          className="h-9 px-4 bg-primary/10 border border-primary/20 text-primary font-bold text-[9px] uppercase tracking-widest rounded-none hover:bg-primary/20 transition-all"
                          onClick={() => handleCallBack(lead)}
                        >
                          <PhoneCall className="h-3 w-3 mr-2" />
                          Call Agent
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-destructive/40 hover:text-destructive hover:bg-destructive/10 rounded-none border border-white/5"
                          onClick={() => updateStatus(lead.id, 'dismissed')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-[-1]" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 0)', backgroundSize: '40px 40px' }} />
    </div>
  );
};

export default Leads;
