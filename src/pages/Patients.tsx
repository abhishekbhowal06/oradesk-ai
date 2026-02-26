/**
 * ORADESK AI — PATIENT INTELLIGENCE & FOLLOW-UP ENGINE
 * ═══════════════════════════════════════════════════════════
 *
 * Architecture:
 *   NOT a patient list. This is a:
 *   - Revenue Intelligence Engine
 *   - Treatment Pipeline Tracker
 *   - Recall Automation Dashboard
 *   - Financial Risk Radar
 *
 * Decision Hierarchy:
 *   L1: Revenue & Financial Risk (top KPI strip)
 *   L2: Smart filters (behavioral segmentation)
 *   L3: Patient data table (dense intelligence grid)
 *   L4: Patient detail panel (slide-out right panel)
 *
 * Psychology Rules:
 *   - Revenue and urgency visually prioritized
 *   - High-value patients visually dominant
 *   - Overdue follow-ups create subtle friction (amber/red)
 *   - Success states reward with completion feedback
 *   - Cognitive load controlled via progressive disclosure
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Users, UserCheck, AlertTriangle, Clock, CalendarCheck,
  DollarSign, CreditCard, Activity, ShieldAlert, Filter, Plus,
  ChevronLeft, ChevronRight, ArrowUpDown, Phone, X, Bot,
  RefreshCw, TrendingUp, Heart, Stethoscope,
  User as UserIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, isPast, parseISO, formatDistanceToNow } from 'date-fns';

// ─── Components ─────────────────────────────────────────────
import { LoadingState } from '@/components/states/LoadingState';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { PatientDetailPanel } from '@/components/patients/PatientDetailPanel';
import { AddFollowUpModal } from '@/components/patients/AddFollowUpModal';

// ─── Hooks & State ──────────────────────────────────────────
import {
  usePatientIntelligence,
  useDebouncedSearch,
  SMART_FILTERS,
  type SmartFilter,
  type PatientIntelligence as PatientIntType,
  type CreatePatientInput,
} from '@/hooks/usePatientIntelligence';
import {
  cardVariants,
  staggerContainerVariants,
  staggerChildVariants,
  TIMING,
  EASE_OUT_CUBIC,
} from '@/lib/animations';

// ═══════════════════════════════════════════════════════════
// SECTION 1: KPI INTELLIGENCE STRIP
// ═══════════════════════════════════════════════════════════

function IntelligenceStrip({ stats }: { stats: ReturnType<typeof usePatientIntelligence>['stats'] }) {
  const kpis = [
    {
      label: 'Total Patients',
      value: stats.totalPatients.toLocaleString(),
      icon: <Users className="h-4 w-4 text-primary" />,
      bg: 'bg-primary/10',
      valueColor: 'text-foreground',
    },
    {
      label: 'Active',
      value: stats.activePatients.toLocaleString(),
      icon: <UserCheck className="h-4 w-4 text-emerald-600" />,
      bg: 'bg-emerald-50',
      valueColor: 'text-emerald-600',
      dot: 'bg-emerald-500',
    },
    {
      label: 'Recall Due',
      value: stats.recallDue.toLocaleString(),
      icon: <RefreshCw className="h-4 w-4 text-amber-600" />,
      bg: 'bg-amber-50',
      valueColor: stats.recallDue > 0 ? 'text-amber-600' : 'text-muted-foreground',
    },
    {
      label: 'Treatment Pending',
      value: stats.treatmentPending.toLocaleString(),
      icon: <Stethoscope className="h-4 w-4 text-primary" />,
      bg: 'bg-primary/10',
      valueColor: stats.treatmentPending > 0 ? 'text-primary' : 'text-muted-foreground',
    },
    {
      label: 'Outstanding Balance',
      value: `$${stats.outstandingBalance.toLocaleString()}`,
      icon: <CreditCard className="h-4 w-4 text-amber-600" />,
      bg: 'bg-amber-50',
      valueColor: stats.outstandingBalance > 0 ? 'text-amber-600' : 'text-muted-foreground',
    },
    {
      label: 'At-Risk Revenue',
      value: `$${Math.round(stats.atRiskRevenue).toLocaleString()}`,
      icon: <ShieldAlert className="h-4 w-4 text-red-500" />,
      bg: 'bg-red-50',
      valueColor: stats.atRiskRevenue > 0 ? 'text-red-500' : 'text-muted-foreground',
    },
  ];

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3"
    >
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.label}
          variants={staggerChildVariants}
          className="bg-card border border-border/60 rounded-xl p-4 flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
              {kpi.label}
            </span>
            <div className={cn('p-1.5 rounded-lg', kpi.bg)}>{kpi.icon}</div>
          </div>
          <p className={cn('text-xl font-bold tracking-tight', kpi.valueColor)}>{kpi.value}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// SECTION 2: SMART FILTERS SIDEBAR
// ═══════════════════════════════════════════════════════════

function SmartFiltersSidebar({
  activeFilter,
  onFilterChange,
  filterCounts,
  searchValue,
  onSearchChange,
}: {
  activeFilter: SmartFilter;
  onFilterChange: (f: SmartFilter) => void;
  filterCounts: Record<SmartFilter, number>;
  searchValue: string;
  onSearchChange: (v: string) => void;
}) {
  return (
    <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-border/40 flex items-center gap-2.5">
        <div className="p-1.5 bg-primary/10 rounded-lg">
          <Filter className="h-3.5 w-3.5 text-primary" />
        </div>
        <h3 className="text-xs font-bold text-foreground">Intelligence Filters</h3>
      </div>

      {/* Search */}
      <div className="px-3 py-3 border-b border-border/30">
        <div className="relative">
          <Input
            placeholder="Search patients..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-background border-border h-9 text-xs pl-8 rounded-lg focus:ring-primary/20"
          />
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          {searchValue && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-secondary"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="p-2 space-y-0.5">
        {SMART_FILTERS.map((filter) => {
          const isActive = activeFilter === filter.id;
          const count = filterCounts[filter.id] ?? 0;
          return (
            <button
              key={filter.id}
              onClick={() => onFilterChange(filter.id)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-150 group',
                isActive
                  ? 'bg-primary/8 text-primary'
                  : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn('h-2 w-2 rounded-full flex-shrink-0', filter.dotColor)} />
                <span className={cn(
                  'text-xs font-semibold truncate',
                  isActive ? 'text-primary' : '',
                )}>
                  {filter.label}
                </span>
              </div>
              <span className={cn(
                'text-[10px] font-bold tabular-nums flex-shrink-0',
                isActive ? 'text-primary' : 'text-muted-foreground/60',
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SECTION 3: PATIENT TABLE
// ═══════════════════════════════════════════════════════════

function PatientTable({
  patients,
  selectedId,
  onSelect,
  sortField,
  sortDir,
  onSort,
}: {
  patients: PatientIntType[];
  selectedId: string | null;
  onSelect: (p: PatientIntType) => void;
  sortField: string;
  sortDir: 'asc' | 'desc';
  onSort: (field: string) => void;
}) {
  const riskBadge = (level: string) => {
    const config: Record<string, string> = {
      low: 'text-emerald-600 bg-emerald-50 border-emerald-200',
      medium: 'text-amber-600 bg-amber-50 border-amber-200',
      high: 'text-red-500 bg-red-50 border-red-200',
    };
    return config[level] || config.low;
  };

  const SortHeader = ({ field, children }: { field: string; children: React.ReactNode }) => (
    <th
      className="px-3 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors select-none"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <ArrowUpDown className="h-2.5 w-2.5" />
        )}
      </div>
    </th>
  );

  return (
    <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-border/40 bg-secondary/30">
              <SortHeader field="name">Patient</SortHeader>
              <SortHeader field="last_visit">Last Visit</SortHeader>
              <SortHeader field="next_appt">Next Appt</SortHeader>
              <SortHeader field="ltv">LTV</SortHeader>
              <SortHeader field="balance">Balance</SortHeader>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Follow-Up</th>
              <SortHeader field="ai_score">AI Score</SortHeader>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Risk</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((patient) => {
              const isSelected = selectedId === patient.id;
              const initials = `${patient.first_name.charAt(0)}${patient.last_name.charAt(0)}`.toUpperCase();
              const hasOverdueFollowup = patient.overdue_followups > 0;
              const hasPendingFollowup = patient.pending_followups > 0;

              return (
                <tr
                  key={patient.id}
                  onClick={() => onSelect(patient)}
                  className={cn(
                    'border-b border-border/20 cursor-pointer transition-colors group',
                    isSelected
                      ? 'bg-primary/5 border-l-2 border-l-primary'
                      : 'hover:bg-secondary/30',
                    hasOverdueFollowup && !isSelected && 'bg-red-50/20',
                  )}
                >
                  {/* Patient */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 border',
                        patient.lifetime_value >= 3000
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-secondary text-muted-foreground border-border',
                      )}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className={cn(
                          'text-xs font-semibold truncate',
                          patient.lifetime_value >= 3000 ? 'text-primary' : 'text-foreground',
                        )}>
                          {patient.first_name} {patient.last_name}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{patient.phone}</p>
                      </div>
                    </div>
                  </td>

                  {/* Last Visit */}
                  <td className="px-3 py-3">
                    <span className="text-xs text-muted-foreground">
                      {patient.last_visit
                        ? format(parseISO(patient.last_visit), 'MMM d, yyyy')
                        : '—'}
                    </span>
                  </td>

                  {/* Next Appointment */}
                  <td className="px-3 py-3">
                    {patient.next_appointment_date ? (
                      <div>
                        <span className="text-xs text-foreground font-medium">
                          {format(parseISO(patient.next_appointment_date), 'MMM d')}
                        </span>
                        <p className="text-[10px] text-muted-foreground">{patient.next_appointment_type}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </td>

                  {/* LTV */}
                  <td className="px-3 py-3">
                    <span className={cn(
                      'text-xs font-bold tabular-nums',
                      patient.lifetime_value >= 3000 ? 'text-emerald-600' : 'text-foreground',
                    )}>
                      ${patient.lifetime_value.toLocaleString()}
                    </span>
                  </td>

                  {/* Balance */}
                  <td className="px-3 py-3">
                    <span className={cn(
                      'text-xs font-semibold tabular-nums',
                      patient.outstanding_balance > 0 ? 'text-amber-600' : 'text-muted-foreground/50',
                    )}>
                      {patient.outstanding_balance > 0 ? `$${patient.outstanding_balance.toLocaleString()}` : '—'}
                    </span>
                  </td>

                  {/* Follow-Up Badge */}
                  <td className="px-3 py-3">
                    {hasOverdueFollowup ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        Overdue
                      </span>
                    ) : hasPendingFollowup ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        <Clock className="h-2.5 w-2.5" />
                        {patient.next_followup_date
                          ? format(parseISO(patient.next_followup_date), 'MMM d')
                          : 'Pending'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/40">—</span>
                    )}
                  </td>

                  {/* AI Score */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 w-16">
                      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            patient.ai_engagement_score >= 80 ? 'bg-emerald-500' :
                              patient.ai_engagement_score >= 50 ? 'bg-amber-500' : 'bg-red-400',
                          )}
                          style={{ width: `${patient.ai_engagement_score}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground tabular-nums w-7 text-right">
                        {patient.ai_engagement_score}
                      </span>
                    </div>
                  </td>

                  {/* Risk */}
                  <td className="px-3 py-3">
                    <span className={cn(
                      'text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border',
                      riskBadge(patient.risk_level),
                    )}>
                      {patient.risk_level}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SECTION 4: ADD PATIENT DIALOG
// ═══════════════════════════════════════════════════════════

function AddPatientDialog({
  open,
  onOpenChange,
  onCreate,
  isCreating,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (input: CreatePatientInput) => void;
  isCreating: boolean;
}) {
  const [form, setForm] = useState<Partial<CreatePatientInput>>({ status: 'active' });

  const handleSubmit = () => {
    if (!form.first_name || !form.last_name || !form.phone) return;
    onCreate({
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone,
      email: form.email || null,
      date_of_birth: form.date_of_birth || null,
      notes: form.notes || null,
      status: form.status || 'active',
    });
    setForm({ status: 'active' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border border-border rounded-2xl p-0 overflow-hidden sm:max-w-md shadow-lg">
        <DialogTitle className="sr-only">Add New Patient</DialogTitle>
        <div className="bg-secondary/50 border-b border-border/50 px-5 py-4 flex items-center gap-3">
          <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
            <UserIcon className="h-4 w-4" />
          </div>
          <span className="font-semibold text-foreground text-sm">Add New Patient</span>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">First Name</Label>
              <Input
                value={form.first_name || ''}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="h-10 text-sm rounded-lg"
                placeholder="Jane"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Last Name</Label>
              <Input
                value={form.last_name || ''}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="h-10 text-sm rounded-lg"
                placeholder="Doe"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Phone Number</Label>
            <Input
              value={form.phone || ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="h-10 text-sm rounded-lg"
              placeholder="(555) 000-0000"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Email</Label>
            <Input
              value={form.email || ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="h-10 text-sm rounded-lg"
              placeholder="patient@email.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</Label>
            <Select
              value={form.status}
              onValueChange={(value) => setForm({ ...form, status: value as PatientIntType['status'] })}
            >
              <SelectTrigger className="h-10 text-sm rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border rounded-xl">
                <SelectItem value="active" className="text-emerald-600 font-medium">Active</SelectItem>
                <SelectItem value="inactive" className="text-amber-600 font-medium">Inactive</SelectItem>
                <SelectItem value="unreachable" className="text-red-500 font-medium">Unreachable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-3 border-t border-border/50">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-xl h-10 text-sm font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.first_name || !form.last_name || !form.phone || isCreating}
              className="flex-1 bg-primary text-white hover:bg-primary/90 h-10 rounded-xl text-sm font-semibold"
            >
              {isCreating ? 'Saving...' : 'Save Record'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════

export default function Patients() {
  // ── State ─────────────────────────────────────────────────
  const { value: searchValue, setValue: setSearchValue, debouncedValue: debouncedSearch } = useDebouncedSearch();
  const [activeFilter, setActiveFilter] = useState<SmartFilter>('all');
  const [selectedPatient, setSelectedPatient] = useState<PatientIntType | null>(null);
  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // ── Data ──────────────────────────────────────────────────
  const {
    patients,
    total,
    stats,
    filterCounts,
    isLoading,
    isError,
    createPatient,
    isCreating,
  } = usePatientIntelligence({
    search: debouncedSearch,
    filter: activeFilter,
    page,
    pageSize: 50,
  });

  // ── Sort ──────────────────────────────────────────────────
  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }, [sortField]);

  const sortedPatients = useMemo(() => {
    const arr = [...patients];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortField) {
        case 'name':
          return dir * a.last_name.localeCompare(b.last_name);
        case 'ltv':
          return dir * (a.lifetime_value - b.lifetime_value);
        case 'balance':
          return dir * (a.outstanding_balance - b.outstanding_balance);
        case 'ai_score':
          return dir * (a.ai_engagement_score - b.ai_engagement_score);
        case 'last_visit':
          return dir * ((a.last_visit || '').localeCompare(b.last_visit || ''));
        default:
          return 0;
      }
    });
    return arr;
  }, [patients, sortField, sortDir]);

  const totalPages = Math.ceil(total / 50);

  // ── Loading / Error ───────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-56 bg-secondary rounded-lg animate-pulse" />
          <div className="h-4 w-80 bg-secondary/50 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-secondary/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <LoadingState variant="list" rows={8} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Patient Intelligence</h1>
        <ErrorState
          title="Connection Error"
          description="Could not load patient intelligence data. Please try again."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Patient Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Revenue pipeline • Follow-up engine • Risk radar
          </p>
        </div>
        <Button
          onClick={() => setAddPatientOpen(true)}
          className="h-10 px-5 bg-primary text-white hover:bg-primary/90 font-semibold rounded-xl shadow-sm gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Patient
        </Button>
      </div>

      {/* ── KPI Intelligence Strip ─────────────────────── */}
      <IntelligenceStrip stats={stats} />

      {/* ── Main Layout: Filters | Table | Detail Panel ── */}
      <div className="flex gap-5">
        {/* Left: Smart Filters */}
        <div className="w-56 flex-shrink-0 hidden lg:block">
          <SmartFiltersSidebar
            activeFilter={activeFilter}
            onFilterChange={(f) => {
              setActiveFilter(f);
              setPage(1);
              setSelectedPatient(null);
            }}
            filterCounts={filterCounts}
            searchValue={searchValue}
            onSearchChange={(v) => {
              setSearchValue(v);
              setPage(1);
            }}
          />
        </div>

        {/* Center: Table */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Mobile search (hidden on desktop) */}
          <div className="lg:hidden relative">
            <Input
              placeholder="Search patients..."
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                setPage(1);
              }}
              className="bg-background border-border h-10 text-sm pl-9 rounded-xl"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>

          {/* Table info bar */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              Showing <span className="font-bold text-foreground">{sortedPatients.length}</span> of{' '}
              <span className="font-bold text-foreground">{total}</span> patients
            </span>
            {activeFilter !== 'all' && (
              <button
                onClick={() => setActiveFilter('all')}
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <X className="h-3 w-3" />
                Clear filter
              </button>
            )}
          </div>

          {sortedPatients.length === 0 ? (
            <EmptyState
              title="No patients found"
              description={debouncedSearch
                ? `No records match "${debouncedSearch}".`
                : 'No patients match the selected filter.'}
            />
          ) : (
            <PatientTable
              patients={sortedPatients}
              selectedId={selectedPatient?.id ?? null}
              onSelect={setSelectedPatient}
              sortField={sortField}
              sortDir={sortDir}
              onSort={handleSort}
            />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 rounded-lg"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 rounded-lg"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Detail Panel (slide-over) ───────────── */}
      <AnimatePresence>
        {selectedPatient && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-foreground/5 backdrop-blur-[2px] z-30"
              onClick={() => setSelectedPatient(null)}
            />
            <PatientDetailPanel
              patient={selectedPatient}
              onClose={() => setSelectedPatient(null)}
            />
          </>
        )}
      </AnimatePresence>

      {/* ── Add Patient Dialog ─────────────────────────── */}
      <AddPatientDialog
        open={addPatientOpen}
        onOpenChange={setAddPatientOpen}
        onCreate={createPatient}
        isCreating={isCreating}
      />
    </div>
  );
}
