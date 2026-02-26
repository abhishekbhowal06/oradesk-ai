import { useState, useMemo } from 'react';
import { useAICalls } from '@/hooks/useAICalls';
import { usePatients } from '@/hooks/usePatients';
import { useRBAC, RBACGuard } from '@/hooks/useRBAC';
import { LoadingState } from '@/components/states/LoadingState';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import {
    Search, Bot, User, Phone, MessageSquare, Clock, AlertTriangle,
    ShieldAlert, Send, PhoneForwarded, Loader2, Play, Pause,
    RotateCcw, ArrowUpDown, Filter, X, ChevronDown, Zap,
    Brain, AudioWaveform, Globe, Star, Hash, Timer, DollarSign,
    Activity, Copy, ExternalLink, MoreHorizontal, Mic
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LiveStatusBadge } from '@/components/call-logs/LiveStatusBadge';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────

type SortKey = 'date' | 'duration' | 'messages' | 'status';
type SortDir = 'asc' | 'desc';
type ActiveTab = 'overview' | 'transcription' | 'client_data';
type StatusFilter = 'all' | 'completed' | 'failed' | 'in-progress' | 'queued';

// ─── Filter Chip Component ─────────────────────────────────

function FilterChip({ label, active, onClick, onRemove }: {
    label: string; active?: boolean; onClick?: () => void; onRemove?: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                active
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-card border-border/60 text-muted-foreground hover:border-primary/20 hover:text-foreground"
            )}
        >
            <span>+ {label}</span>
            {active && onRemove && (
                <X className="h-3 w-3 ml-0.5 hover:text-destructive" onClick={(e) => { e.stopPropagation(); onRemove(); }} />
            )}
        </button>
    );
}

// ─── Latency Badge ──────────────────────────────────────────

function LatencyBadge({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <span className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wide border",
            color
        )}>
            {label} {value} ms
        </span>
    );
}

// ─── Audio Waveform Player ──────────────────────────────────

function WaveformPlayer({ duration }: { duration: number | null }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [speed, setSpeed] = useState(1);
    const totalSeconds = duration || 0;

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    // Generate fake waveform bars
    const bars = useMemo(() =>
        Array.from({ length: 120 }, () => Math.random() * 0.8 + 0.2), []
    );

    return (
        <div className="bg-card border border-border/60 rounded-xl p-4 space-y-3">
            {/* Waveform Visualization */}
            <div className="relative h-12 flex items-center gap-[1px] overflow-hidden rounded-lg bg-secondary/30 px-1">
                {bars.map((h, i) => (
                    <div
                        key={i}
                        className={cn(
                            "flex-1 min-w-[2px] rounded-full transition-colors",
                            i / bars.length <= progress
                                ? "bg-primary"
                                : "bg-border/80"
                        )}
                        style={{ height: `${h * 100}%` }}
                    />
                ))}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="h-9 w-9 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors shadow-sm"
                    >
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                    </button>

                    <button
                        onClick={() => setSpeed(speed === 2 ? 0.5 : speed + 0.5)}
                        className="px-2.5 py-1 rounded-lg bg-secondary text-xs font-bold text-foreground hover:bg-border/60 transition-colors border border-border/50"
                    >
                        {speed}x
                    </button>

                    <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                        <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
                    <span>{formatTime(progress * totalSeconds)}</span>
                    <span>/</span>
                    <span>{formatTime(totalSeconds)}</span>
                </div>

                <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                    <MoreHorizontal className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

// ─── Status Badge ───────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { label: string; cls: string }> = {
        completed: { label: 'Successful', cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
        confirmed: { label: 'Successful', cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
        failed: { label: 'Failed', cls: 'text-red-500 bg-red-50 border-red-200' },
        'in-progress': { label: 'In Progress', cls: 'text-amber-600 bg-amber-50 border-amber-200' },
        calling: { label: 'In Progress', cls: 'text-amber-600 bg-amber-50 border-amber-200' },
        queued: { label: 'Queued', cls: 'text-blue-500 bg-blue-50 border-blue-200' },
        answered: { label: 'Successful', cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    };
    const c = config[status] || { label: status, cls: 'text-muted-foreground bg-secondary border-border' };
    return (
        <span className={cn("inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border", c.cls)}>
            {c.label}
        </span>
    );
}

// ═══════════════════════════════════════════════════════════
// ─── MAIN COMPONENT ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export default function Conversations() {
    const { calls, isLoading, isError } = useAICalls();
    const { patients } = usePatients();
    const { canAccess } = useRBAC();
    const { toast } = useToast();

    const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('date');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [activeTab, setActiveTab] = useState<ActiveTab>('transcription');
    const [isHandoffPending, setIsHandoffPending] = useState(false);
    const [showHandoffConfirm, setShowHandoffConfirm] = useState(false);

    // ─── Helpers ────────────────────────────────────────────

    const getPatient = (id: string) => patients.find((p) => p.id === id);
    const getPatientName = (id: string) => {
        const p = getPatient(id);
        return p ? `${p.first_name} ${p.last_name}` : 'Unknown Patient';
    };

    const getMessageCount = (call: any) => {
        if (call.transcript && Array.isArray(call.transcript)) return call.transcript.length;
        return 0;
    };

    const formatDuration = (seconds: number | null) => {
        if (!seconds) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const getNormalizedStatus = (status: string) => {
        if (['completed', 'confirmed', 'answered'].includes(status)) return 'completed';
        if (['calling', 'ringing', 'in-progress'].includes(status)) return 'in-progress';
        if (['failed', 'no-answer', 'busy'].includes(status)) return 'failed';
        return status;
    };

    // ─── Filtering & Sorting ────────────────────────────────

    const filteredCalls = useMemo(() => {
        let result = [...calls];

        // Search
        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            result = result.filter((c) => {
                const name = getPatientName(c.patient_id).toLowerCase();
                const phone = getPatient(c.patient_id)?.phone || '';
                return name.includes(q) || phone.includes(q) || c.id.includes(q);
            });
        }

        // Status filter
        if (statusFilter !== 'all') {
            result = result.filter((c) => getNormalizedStatus(c.status) === statusFilter);
        }

        // Sort
        result.sort((a, b) => {
            let cmp = 0;
            switch (sortKey) {
                case 'date': cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
                case 'duration': cmp = (a.duration_seconds || 0) - (b.duration_seconds || 0); break;
                case 'messages': cmp = getMessageCount(a) - getMessageCount(b); break;
                case 'status': cmp = a.status.localeCompare(b.status); break;
            }
            return sortDir === 'desc' ? -cmp : cmp;
        });

        return result;
    }, [calls, searchTerm, statusFilter, sortKey, sortDir, patients]);

    const selectedCall = calls.find(c => c.id === selectedCallId);
    const selectedPatient = selectedCall ? getPatient(selectedCall.patient_id) : null;

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    // ─── Loading / Error ────────────────────────────────────

    if (isLoading) {
        return (
            <div className="h-[calc(100vh-8rem)] w-full">
                <LoadingState variant="conversations-3-pane" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="h-[calc(100vh-8rem)]">
                <ErrorState
                    title="Connection Error"
                    description="Unable to load conversation history."
                    onRetry={() => window.location.reload()}
                />
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════
    // ─── RENDER: History Table (No conversation selected) ──
    // ═══════════════════════════════════════════════════════

    if (!selectedCall) {
        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                {/* Header */}
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">Conversation history</h1>
                </div>

                {/* Search */}
                <div className="relative max-w-2xl">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search conversations..."
                        className="pl-10 bg-card border-border/60 h-11 text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Filter Chips */}
                <div className="flex items-center gap-2 flex-wrap">
                    <FilterChip label="Date After" />
                    <FilterChip label="Date Before" />
                    <FilterChip
                        label="Call status"
                        active={statusFilter !== 'all'}
                        onClick={() => setStatusFilter(statusFilter === 'all' ? 'completed' : 'all')}
                        onRemove={() => setStatusFilter('all')}
                    />
                    <FilterChip label="Duration" />
                    <FilterChip label="Rating" />
                    <FilterChip label="Agent" />
                    <FilterChip label="Tools" />
                    <FilterChip label="Language" />
                    <FilterChip label="Channel" />

                    <div className="ml-auto">
                        <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                            <ArrowUpDown className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Data Table */}
                <div className="bg-card border border-border/60 rounded-xl overflow-hidden shadow-sm">
                    {/* Table Header */}
                    <div className="grid grid-cols-[1fr_1fr_100px_100px_120px] gap-4 px-5 py-3 bg-secondary/30 border-b border-border/50">
                        <button onClick={() => toggleSort('date')} className="flex items-center gap-1 text-xs font-bold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors text-left">
                            Date {sortKey === 'date' && <ChevronDown className={cn("h-3 w-3 transition-transform", sortDir === 'asc' && "rotate-180")} />}
                        </button>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Agent</span>
                        <button onClick={() => toggleSort('duration')} className="flex items-center gap-1 text-xs font-bold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors">
                            Duration {sortKey === 'duration' && <ChevronDown className={cn("h-3 w-3 transition-transform", sortDir === 'asc' && "rotate-180")} />}
                        </button>
                        <button onClick={() => toggleSort('messages')} className="flex items-center gap-1 text-xs font-bold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors">
                            Messages {sortKey === 'messages' && <ChevronDown className={cn("h-3 w-3 transition-transform", sortDir === 'asc' && "rotate-180")} />}
                        </button>
                        <button onClick={() => toggleSort('status')} className="flex items-center gap-1 text-xs font-bold text-muted-foreground uppercase tracking-widest hover:text-foreground transition-colors">
                            Call status {sortKey === 'status' && <ChevronDown className={cn("h-3 w-3 transition-transform", sortDir === 'asc' && "rotate-180")} />}
                        </button>
                    </div>

                    {/* Table Body */}
                    {filteredCalls.length === 0 ? (
                        <div className="px-5 py-16 text-center">
                            <EmptyState title="No Conversations" description="No conversations match your filters." />
                        </div>
                    ) : (
                        <div className="divide-y divide-border/30">
                            {filteredCalls.map((call) => (
                                <button
                                    key={call.id}
                                    onClick={() => setSelectedCallId(call.id)}
                                    className="w-full grid grid-cols-[1fr_1fr_100px_100px_120px] gap-4 px-5 py-4 text-left hover:bg-secondary/20 transition-colors group"
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                                            {format(parseISO(call.created_at), 'MMM d, yyyy, h:mm a')}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5 font-mono">{getPatientName(call.patient_id)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                                            <Bot className="h-3.5 w-3.5 text-primary" />
                                        </div>
                                        <span className="text-sm font-medium text-foreground truncate">OraDesk Agent</span>
                                    </div>
                                    <span className="text-sm font-mono text-foreground tabular-nums">{formatDuration(call.duration_seconds)}</span>
                                    <span className="text-sm font-mono text-foreground tabular-nums">{getMessageCount(call)}</span>
                                    <StatusBadge status={call.status} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════════════════
    // ─── RENDER: Conversation Detail (Call selected) ────────
    // ═══════════════════════════════════════════════════════

    // Simulate latency metrics per message
    const getLatencyMetrics = (idx: number, role: string) => {
        if (role === 'ai') {
            return {
                llm: Math.floor(Math.random() * 400 + 300),
                tts: Math.floor(Math.random() * 150 + 80),
            };
        }
        return { asr: Math.floor(Math.random() * 200 + 150) };
    };

    return (
        <div className="flex h-[calc(100vh-6rem)] -m-6 overflow-hidden bg-background animate-in fade-in duration-300">

            {/* ═══ LEFT: Conversation List (narrowed) ═══ */}
            <div className="w-[340px] flex-shrink-0 border-r border-border flex flex-col bg-card">
                {/* Back + Search */}
                <div className="p-4 border-b border-border/50 space-y-3">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => setSelectedCallId(null)}
                            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
                        >
                            ← Conversation history
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search conversations..."
                            className="pl-9 bg-secondary/50 border-border/40 h-9 text-xs"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Filter chips mini */}
                <div className="px-4 py-2 border-b border-border/30 flex flex-wrap gap-1.5">
                    {['Date After', 'Date Before', 'Call status'].map((f) => (
                        <span key={f} className="text-[10px] font-semibold text-muted-foreground px-2 py-1 bg-secondary/50 rounded-md border border-border/30">+ {f}</span>
                    ))}
                </div>

                {/* Scrollable List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-border/20">
                    {filteredCalls.map((call) => {
                        const isActive = call.id === selectedCallId;
                        return (
                            <button
                                key={call.id}
                                onClick={() => setSelectedCallId(call.id)}
                                className={cn(
                                    "w-full text-left px-4 py-3.5 transition-all",
                                    isActive ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-secondary/30 border-l-2 border-l-transparent"
                                )}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-foreground">
                                        {format(parseISO(call.created_at), 'MMM d, yyyy, h:mm a')}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                        <Bot className="h-3 w-3 text-primary/60" />
                                        <span className="text-xs text-muted-foreground truncate">OraDesk Agent</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-mono text-muted-foreground">{formatDuration(call.duration_seconds)}</span>
                                        <span className="text-[10px] font-mono text-muted-foreground">{getMessageCount(call)}</span>
                                        <StatusBadge status={call.status} />
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ═══ CENTER: Transcript ═══ */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border/50 bg-card">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <h2 className="text-lg font-bold text-foreground">
                                Conversation with <span className="text-primary">OraDesk Agent</span>
                            </h2>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                {selectedCall.id.substring(0, 24)}...
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedCall.status === 'calling' && canAccess('conversations.takeover') && (
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    className="h-8 gap-1.5 text-xs"
                                    onClick={() => setShowHandoffConfirm(true)}
                                    disabled={isHandoffPending}
                                >
                                    {isHandoffPending ? (
                                        <><Loader2 className="h-3 w-3 animate-spin" /> Transferring...</>
                                    ) : (
                                        <><PhoneForwarded className="h-3 w-3" /> Take Over</>
                                    )}
                                </Button>
                            )}
                            <button className="p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
                                <ExternalLink className="h-4 w-4" />
                            </button>
                            <button className="p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
                                <X className="h-4 w-4" onClick={() => setSelectedCallId(null)} />
                            </button>
                        </div>
                    </div>

                    {/* Audio Waveform */}
                    <WaveformPlayer duration={selectedCall.duration_seconds} />
                </div>

                {/* Tab Bar */}
                <div className="px-6 border-b border-border/50 bg-card flex items-center gap-0">
                    {(['overview', 'transcription', 'client_data'] as ActiveTab[]).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                "px-4 py-3 text-sm font-semibold transition-all border-b-2 capitalize",
                                activeTab === tab
                                    ? "text-foreground border-primary"
                                    : "text-muted-foreground border-transparent hover:text-foreground"
                            )}
                        >
                            {tab === 'client_data' ? 'Client data' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {activeTab === 'transcription' && (
                        <div className="p-6 space-y-5">
                            {/* Info banner */}
                            <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                                <Activity className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <span>You can now ensure your agent returns high quality responses to conversations like this one. Try <strong>Tests</strong> in the Transcription tab.</span>
                            </div>

                            {/* Messages */}
                            {selectedCall.transcript && Array.isArray(selectedCall.transcript) ? (
                                (selectedCall.transcript as any[]).map((msg, idx) => {
                                    const isAI = msg.role === 'ai';
                                    const metrics = getLatencyMetrics(idx, msg.role);

                                    return (
                                        <div key={idx} className={cn("flex gap-3", isAI ? "justify-start" : "justify-end")}>
                                            {isAI && (
                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                                                    <Bot className="h-4 w-4 text-primary" />
                                                </div>
                                            )}
                                            <div className={cn("max-w-[75%] space-y-1.5", isAI ? "items-start" : "items-end")}>
                                                {isAI && (
                                                    <span className="text-xs font-semibold text-primary">OraDesk Agent</span>
                                                )}
                                                <div className={cn(
                                                    "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                                                    isAI
                                                        ? "bg-card border border-border/60 text-foreground rounded-tl-md"
                                                        : "bg-[#2a2a2a] text-white rounded-tr-md"
                                                )}>
                                                    {msg.message}
                                                    {!isAI && (
                                                        <div className="flex items-center justify-end gap-2 mt-1.5">
                                                            <Mic className="h-2.5 w-2.5 text-white/40" />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Latency metrics under each message */}
                                                <div className="flex items-center gap-2 px-1">
                                                    <span className="text-[10px] text-muted-foreground font-mono">
                                                        {formatDuration(Math.floor(idx * (selectedCall.duration_seconds || 60) / Math.max(getMessageCount(selectedCall), 1)))}
                                                    </span>

                                                    {isAI ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <LatencyBadge label="LLM" value={(metrics as any).llm} color="bg-purple-50 text-purple-600 border-purple-200" />
                                                            <LatencyBadge label="TTS" value={(metrics as any).tts} color="bg-teal-50 text-teal-600 border-teal-200" />
                                                        </div>
                                                    ) : (
                                                        <LatencyBadge label="ASR" value={(metrics as any).asr} color="bg-orange-50 text-orange-600 border-orange-200" />
                                                    )}
                                                </div>
                                            </div>

                                            {!isAI && (
                                                <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-1 border border-border/50">
                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <EmptyState title="No Transcript" description="Transcript data is not available for this conversation." />
                            )}
                        </div>
                    )}

                    {activeTab === 'overview' && (
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-card border border-border/60 rounded-xl p-5 space-y-2">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Patient</p>
                                    <p className="text-lg font-bold text-foreground">{getPatientName(selectedCall.patient_id)}</p>
                                    <p className="text-xs text-muted-foreground font-mono">{selectedPatient?.phone || 'N/A'}</p>
                                </div>
                                <div className="bg-card border border-border/60 rounded-xl p-5 space-y-2">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Call Type</p>
                                    <p className="text-lg font-bold text-foreground capitalize">{selectedCall.call_type || 'General'}</p>
                                    <p className="text-xs text-muted-foreground">{selectedCall.outcome || 'Pending'}</p>
                                </div>
                                <div className="bg-card border border-border/60 rounded-xl p-5 space-y-2">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Confidence Score</p>
                                    <p className="text-lg font-bold text-foreground">{selectedCall.confidence_score ? `${(selectedCall.confidence_score * 100).toFixed(0)}%` : 'N/A'}</p>
                                </div>
                                <div className="bg-card border border-border/60 rounded-xl p-5 space-y-2">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Escalation</p>
                                    <p className={cn("text-lg font-bold", selectedCall.escalation_required ? "text-destructive" : "text-success")}>
                                        {selectedCall.escalation_required ? 'Required' : 'None'}
                                    </p>
                                    {selectedCall.escalation_reason && (
                                        <p className="text-xs text-muted-foreground">{selectedCall.escalation_reason}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'client_data' && (
                        <div className="p-6 space-y-4">
                            {selectedPatient ? (
                                <div className="bg-card border border-border/60 rounded-xl p-6 space-y-4">
                                    <h3 className="text-sm font-bold text-foreground">Client Information</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        {[
                                            { label: 'Name', value: `${selectedPatient.first_name} ${selectedPatient.last_name}` },
                                            { label: 'Phone', value: selectedPatient.phone },
                                            { label: 'Date of Birth', value: selectedPatient.date_of_birth || 'N/A' },
                                            { label: 'Status', value: selectedPatient.status },
                                            { label: 'Email', value: selectedPatient.email || 'N/A' },
                                            { label: 'Insurance', value: selectedPatient.insurance_provider || 'N/A' },
                                        ].map((item) => (
                                            <div key={item.label}>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{item.label}</p>
                                                <p className="text-sm font-medium text-foreground mt-0.5">{item.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <EmptyState title="No Client Data" description="Patient information is unavailable." />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ RIGHT: Metadata Sidebar ═══ */}
            <div className="w-[260px] flex-shrink-0 border-l border-border bg-card overflow-y-auto custom-scrollbar">
                <div className="p-5 space-y-5">
                    <h3 className="text-sm font-bold text-foreground">Metadata</h3>

                    <div className="space-y-4">
                        {[
                            { label: 'Date', value: format(parseISO(selectedCall.created_at), 'MMM d, h:mm a'), icon: Clock },
                            { label: 'Text-only', value: 'No', icon: Mic },
                            { label: 'Connection duration', value: formatDuration(selectedCall.duration_seconds), icon: Timer },
                            { label: 'Call cost', value: `${Math.floor(Math.random() * 400 + 100)} credits`, icon: DollarSign },
                            { label: 'Credits (LLM)', value: `${Math.floor(Math.random() * 600 + 200)}`, icon: Brain },
                            { label: 'LLM cost', value: `$${(Math.random() * 0.05 + 0.01).toFixed(4)} / min`, icon: DollarSign },
                            { label: 'Messages', value: `${getMessageCount(selectedCall)}`, icon: MessageSquare },
                            { label: 'Model', value: 'Gemini 2.5 Pro', icon: Zap },
                            { label: 'Language', value: 'English', icon: Globe },
                        ].map((item) => (
                            <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                                <div className="flex items-center gap-2">
                                    <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">{item.label}</span>
                                </div>
                                <span className="text-xs font-semibold text-foreground text-right">{item.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Escalation */}
                    {selectedCall.escalation_required && (
                        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-2">
                            <div className="flex items-center gap-2 text-destructive">
                                <ShieldAlert className="h-4 w-4" />
                                <span className="text-xs font-bold">Escalation Flag</span>
                            </div>
                            <p className="text-[11px] text-destructive/80">{selectedCall.escalation_reason}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ Hand-off Confirm Modal ═══ */}
            {showHandoffConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/10 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowHandoffConfirm(false)}>
                    <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-destructive/10 rounded-xl flex items-center justify-center">
                                <PhoneForwarded className="h-5 w-5 text-destructive" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground">Take Over This Call?</h3>
                                <p className="text-xs text-muted-foreground">The AI will politely excuse itself and transfer to your desk phone.</p>
                            </div>
                        </div>
                        <div className="bg-secondary/50 border border-border/50 rounded-xl p-4 space-y-2">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">AI Context Whisper</p>
                            <p className="text-sm text-foreground leading-relaxed">
                                Patient <span className="font-bold">{getPatientName(selectedCall.patient_id)}</span> called regarding
                                {' '}<span className="font-semibold text-primary">{selectedCall.outcome === 'confirmed' ? 'appointment confirmation' : 'a scheduling inquiry'}</span>.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => setShowHandoffConfirm(false)}>Cancel</Button>
                            <Button
                                variant="destructive"
                                className="flex-1 gap-1.5"
                                onClick={async () => {
                                    setShowHandoffConfirm(false);
                                    setIsHandoffPending(true);
                                    await new Promise(r => setTimeout(r, 1500));
                                    setIsHandoffPending(false);
                                    toast({
                                        title: 'Call Transferred',
                                        description: `${getPatientName(selectedCall.patient_id)} has been transferred to your desk phone.`,
                                    });
                                }}
                            >
                                <PhoneForwarded className="h-4 w-4" /> Confirm Transfer
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
