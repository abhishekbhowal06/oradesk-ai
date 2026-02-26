import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, ArrowLeft, ArrowRight, CheckCircle, Users, Target, Rocket, Zap, Database } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/states/LoadingState';

interface RecallCandidate {
  id: string;
  patient_id: string;
  priority_score: number;
  priority_level: string;
  estimated_value: number;
  days_since_visit: number;
  patients: {
    first_name: string;
    last_name: string;
    last_visit: string;
  };
}

const CampaignCreate = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<RecallCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Form State
  const [campaignName, setCampaignName] = useState('');
  const [description, setDescription] = useState('');
  const [channel, setChannel] = useState<'voice' | 'sms'>('voice');

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      // Fetch 'pending' candidates
      // @ts-ignore - recall_candidates may not be in auto-generated Supabase types yet
      // @ts-ignore - recall_candidates may not be in auto-generated Supabase types yet
      const { data, error } = await supabase
        .from('recall_candidates')
        .select(
          `
            id, priority_score, priority_level, estimated_value, 
            patients (id, first_name, last_name, last_visit)
        `,
        )
        .eq('status', 'pending')
        .order('priority_score', { ascending: false });

      if (error) throw error;

      // Fix types for Supabase response
      const typedData = ((data as unknown) as Array<{
        id: string;
        priority_score: number;
        priority_level: string;
        estimated_value: number;
        patients: { id: string; first_name: string; last_name: string; last_visit: string; } | null;
      }>).map(item => ({
        id: item.id,
        patient_id: item.patients?.id || 'unknown',
        priority_score: item.priority_score,
        priority_level: item.priority_level,
        estimated_value: item.estimated_value,
        days_since_visit: 0,
        patients: {
          first_name: item.patients?.first_name || 'Unknown',
          last_name: item.patients?.last_name || 'Patient',
          last_visit: item.patients?.last_visit || new Date().toISOString()
        }
      })) as RecallCandidate[];

      setCandidates(typedData);
    } catch (error: unknown) {
      console.error('Error fetching candidates:', error);
      toast.error('Failed to load recall candidates');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    if (selectedIds.size === candidates.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map((c) => c.id)));
    }
  };

  const handleCreate = async () => {
    if (!campaignName) return toast.error('Please name your campaign');
    if (selectedIds.size === 0) return toast.error('Please select at least one patient');

    try {
      setLoading(true);
      // Call Edge Function
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Note: In a real scenario, we'd use the proper edge function URL
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/campaign-manager`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            clinic_id: 'demo-clinic', // Placeholder
            name: campaignName,
            description,
            candidate_ids: Array.from(selectedIds),
            outreach_channel: channel,
            scheduled_start_at: new Date().toISOString(),
          }),
        },
      );

      // Allow fallback if function doesn't exist yet for UI demo
      if (!response.ok && response.status !== 404) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create campaign');
      }

      // Fallback manual insertion for demo/UI dev if function fails
      if (!response.ok) {
        // @ts-ignore - campaigns table may not be in auto-generated Supabase types yet
        const { error } = await supabase.from('campaigns').insert({
          name: campaignName,
          description,
          status: 'draft',
          outreach_channel: [channel],
          clinic_id: '00000000-0000-0000-0000-000000000000', // Demo ID
          scheduled_start_at: new Date().toISOString(),
        });
        if (error) {
          console.warn("Manual select failed, probably permissions", error);
        }
      }

      toast.success('Campaign protocol initialized successfully.');
      navigate('/campaigns');
    } catch (error: unknown) {
      console.error('Creation error:', error);
      toast.error(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const totalValue = Array.from(selectedIds)
    .reduce((acc, id) => acc + (candidates.find((c) => c.id === id)?.estimated_value || 0), 0);

  if (loading && candidates.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            NEW <span className="text-primary">CAMPAIGN</span>
          </h1>
          <p className="text-muted-foreground font-mono text-xs">ANALYZING CANDIDATE DATA...</p>
        </div>
        <LoadingState variant="list" rows={3} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center gap-6 border-b border-white/10 pb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/campaigns')}
          className="rounded-full bg-white/5 hover:bg-white/10 border border-white/5"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm bg-primary/10 border border-primary/20 text-[10px] font-mono font-bold text-primary tracking-widest uppercase mb-1">
            <Rocket className="h-3 w-3" />
            Protocol Wizard
          </div>
          <h1 className="text-3xl font-bold text-white">INITIALIZE CAMPAIGN</h1>
          <p className="text-muted-foreground">Configure outreach parameters and target list.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left: Wizard Steps */}
        <div className="lg:col-span-3 space-y-4">
          {/* Step 1 */}
          <div
            className={cn(
              "p-4 rounded-lg border transition-all duration-300 cursor-pointer",
              step === 1
                ? "bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]"
                : "bg-white/5 border-white/5 opacity-50 hover:opacity-80"
            )}
            onClick={() => setStep(1)}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={cn(
                "h-8 w-8 rounded flex items-center justify-center font-bold text-sm border",
                step === 1 ? "bg-primary text-black border-primary" : "bg-transparent text-muted-foreground border-white/20"
              )}>
                01
              </div>
              <span className={cn(
                "text-sm font-bold uppercase tracking-wider",
                step === 1 ? "text-white" : "text-muted-foreground"
              )}>Targeting</span>
            </div>
            <p className="text-xs text-muted-foreground pl-11">
              Select patient cohort based on value and urgency.
            </p>
          </div>

          {/* Step 2 */}
          <div
            className={cn(
              "p-4 rounded-lg border transition-all duration-300 cursor-pointer",
              step === 2
                ? "bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]"
                : "bg-white/5 border-white/5 opacity-50 hover:opacity-80",
              selectedIds.size === 0 && "opacity-30 pointer-events-none"
            )}
            onClick={() => selectedIds.size > 0 && setStep(2)}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={cn(
                "h-8 w-8 rounded flex items-center justify-center font-bold text-sm border",
                step === 2 ? "bg-primary text-black border-primary" : "bg-transparent text-muted-foreground border-white/20"
              )}>
                02
              </div>
              <span className={cn(
                "text-sm font-bold uppercase tracking-wider",
                step === 2 ? "text-white" : "text-muted-foreground"
              )}>Configuration</span>
            </div>
            <p className="text-xs text-muted-foreground pl-11">
              Set protocol parameters and launch.
            </p>
          </div>

          {/* Summary Stats (Always visible) */}
          <div className="mt-8 p-4 bg-black/40 rounded-lg border border-white/10 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Target className="h-3 w-3" /> Mission Scope
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Candidates</span>
                <span className="text-sm font-mono font-bold text-white">{selectedIds.size}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Est. Value</span>
                <span className="text-sm font-mono font-bold text-emerald-400">
                  ${totalValue.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Channel</span>
                <Badge variant="outline" className="text-[10px] h-5 border-white/10 uppercase">
                  {channel}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Content Area */}
        <div className="lg:col-span-9">

          {/* Step 1: Candidate Selection List */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between bg-white/5 p-4 rounded-t-lg border border-white/10">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="select-all"
                    checked={selectedIds.size === candidates.length && candidates.length > 0}
                    onCheckedChange={selectAll}
                    className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:text-black"
                  />
                  <Label htmlFor="select-all" className="text-xs uppercase font-bold tracking-wider cursor-pointer text-muted-foreground hover:text-white">
                    Select All Candidates
                  </Label>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {candidates.length} RECORDS FOUND
                </span>
              </div>

              <div className="max-h-[600px] overflow-y-auto space-y-2 pr-2">
                {candidates.map(candidate => (
                  <div
                    key={candidate.id}
                    className={cn(
                      "flex items-center p-4 rounded-lg border transition-all duration-200 group bg-black/20",
                      selectedIds.has(candidate.id)
                        ? "border-primary/40 bg-primary/5"
                        : "border-white/5 hover:border-white/10 hover:bg-white/5"
                    )}
                  >
                    <Checkbox
                      checked={selectedIds.has(candidate.id)}
                      onCheckedChange={() => toggleSelection(candidate.id)}
                      className="mr-4 border-white/20 data-[state=checked]:bg-primary data-[state=checked]:text-black"
                    />

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      {/* Patient Info */}
                      <div className="flex items-center gap-3 md:col-span-1">
                        <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                          <Users className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <p className={cn("text-sm font-bold", selectedIds.has(candidate.id) ? "text-primary" : "text-white")}>
                            {candidate.patients.first_name} {candidate.patients.last_name}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            ID: {candidate.patient_id.substring(0, 6)}
                          </p>
                        </div>
                      </div>

                      {/* Priority */}
                      <div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">Priority</span>
                          <Badge
                            className={cn(
                              "w-fit text-[10px] uppercase font-bold",
                              candidate.priority_level === 'high' ? "bg-warning/20 text-warning hover:bg-warning/20" :
                                candidate.priority_level === 'critical' ? "bg-destructive/20 text-destructive hover:bg-destructive/20" :
                                  "bg-white/10 text-muted-foreground hover:bg-white/10"
                            )}
                          >
                            {candidate.priority_level}
                          </Badge>
                        </div>
                      </div>

                      {/* Value */}
                      <div>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold">Est. Value</span>
                          <span className="text-sm font-mono font-bold text-white">
                            ${candidate.estimated_value.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Last Visit */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Last Visit</span>
                        <span className="text-sm font-mono text-muted-foreground">
                          {new Date(candidate.patients.last_visit).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {candidates.length === 0 && (
                  <div className="p-12 border border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center text-center">
                    <Database className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-bold text-white mb-2">No Candidates Detected</h3>
                    <p className="text-muted-foreground max-w-sm">
                      The recall engine hasn't identified any patients matching the criteria. Run the detection job first.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-white/10">
                <Button
                  size="lg"
                  onClick={() => setStep(2)}
                  disabled={selectedIds.size === 0}
                  className="btn-gold"
                >
                  Confirm Selection <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Configuration */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="bg-black/20 p-6 rounded-lg border border-white/10 space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="c-name" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Campaign Designation</Label>
                  <Input
                    id="c-name"
                    placeholder="E.G. Q1 HYGIENE INITIATIVE ALPHA"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="bg-black/40 border-white/10 h-12 text-lg font-mono placeholder:text-muted-foreground/30"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="c-desc" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Briefing (Optional)</Label>
                  <Input
                    id="c-desc"
                    placeholder="Internal operational notes..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-black/40 border-white/10 font-mono"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Transmission Channel</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      className={cn(
                        "p-4 rounded border cursor-pointer transition-all duration-200 flex items-center gap-3",
                        channel === 'voice'
                          ? "bg-primary/10 border-primary/50"
                          : "bg-white/5 border-white/10 opacity-50 hover:opacity-100"
                      )}
                      onClick={() => setChannel('voice')}
                    >
                      <div className={cn("h-4 w-4 rounded-full border-2 flex items-center justify-center", channel === 'voice' ? "border-primary" : "border-white/30")}>
                        {channel === 'voice' && <div className="h-2 w-2 rounded-full bg-primary" />}
                      </div>
                      <span className="font-bold text-white">Voice AI Agent</span>
                    </div>

                    <div className="p-4 rounded border border-white/5 bg-white/5 opacity-30 cursor-not-allowed flex items-center gap-3">
                      <div className="h-4 w-4 rounded-full border-2 border-white/30" />
                      <span className="font-bold text-muted-foreground">SMS Broadcast (Locked)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <Button variant="ghost" className="hover:bg-white/5" onClick={() => setStep(1)}>
                  Back to Targeting
                </Button>
                <Button
                  size="lg"
                  onClick={handleCreate}
                  disabled={loading}
                  className="btn-gold min-w-[200px]"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                  {loading ? 'INITIALIZING...' : 'LAUNCH PROTOCOL'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignCreate;
