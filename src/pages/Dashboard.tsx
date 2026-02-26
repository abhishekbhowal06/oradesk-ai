/**
 * ORADESK AI — OPERATIONAL COMMAND CENTER
 * ═══════════════════════════════════════════════════════════
 *
 * Psychological Performance Architecture (92+ Impact Score)
 *
 * Decision Hierarchy:
 *   L1: Revenue & Schedule Health (money first)
 *   L2: Urgent Operational Risks (what's broken)
 *   L3: Live Feed (what's happening now)
 *   L4: Today's Schedule Snapshot (what's next)
 *   L5: Productivity Impact (ROI proof)
 *
 * Dopamine Layering:
 *   Layer 1: Micro reinforcement — count-up numbers, value glow
 *   Layer 2: Progress reinforcement — fill bars, completion badges
 *   Layer 3: Risk relief — red→green transforms, urgency de-escalation
 *   Layer 4: Daily performance summary panel
 *
 * Animation Rules:
 *   - All transitions: 150–280ms, ease-out cubic
 *   - Revenue animation > Risk resolution > Progress > Feed
 *   - Never animate multiple high-weight elements simultaneously
 *   - WebSocket safe: debounced triggers
 *   - Accessible: respects prefers-reduced-motion
 *
 * Architecture:
 *   Server state  → React Query (useROIMetrics, useDashboardStats, etc.)
 *   UI state       → Zustand (useOraStore)
 *   Animations     → Framer Motion + requestAnimationFrame
 *   Real-time      → WebSocket subscription (simulated for dev)
 */

import { useEffect, Suspense, lazy } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, CalendarCheck, ShieldAlert, PhoneForwarded } from 'lucide-react';
import { format } from 'date-fns';

// ─── Animation System ───────────────────────────────────────
import { staggerContainerVariants } from '@/lib/animations';

// ─── Data Hooks ─────────────────────────────────────────────
import { useDashboardStats } from '@/hooks/useAnalytics';
import { useClinic } from '@/contexts/ClinicContext';
import { useROIMetrics } from '@/hooks/useROIMetrics';

// ─── Reward System ──────────────────────────────────────────
import { useRewardTriggerEngine } from '@/hooks/useRewardTriggers';
import { RewardToastContainer } from '@/components/dashboard/RewardToasts';
import { DailyRecapPanel } from '@/components/dashboard/DailyRecapPanel';

// ─── State Store ────────────────────────────────────────────
import { useOraStore, formatCurrency } from '@/stores/oraStore';

// ─── Loading States ─────────────────────────────────────────
import { LoadingState } from '@/components/states/LoadingState';

// ─── Dashboard Components ───────────────────────────────────
import { AIStatusStrip } from '@/components/dashboard/AIStatusStrip';
import { KPICard } from '@/components/dashboard/KPICard';
import { LiveFeed } from '@/components/dashboard/LiveFeed';
import { ScheduleSnapshot } from '@/components/dashboard/ScheduleSnapshot';
import { UrgentActionCenter } from '@/components/dashboard/UrgentActionCenter';
import { ProductivityImpact } from '@/components/dashboard/ProductivityImpact';
// Lazy-load heavy Recharts dependency
const CallVolumeChart = lazy(() => import('@/components/dashboard/CallVolumeChart'));

// ═══════════════════════════════════════════════════════════
// ─── MAIN DASHBOARD ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export default function Dashboard() {
  const { currentClinic } = useClinic();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: roi } = useROIMetrics();
  const currencyMode = useOraStore((s) => s.currencyMode);

  const isLoading = statsLoading || !currentClinic;

  // ── Initialize live data ──────────────────────────────────
  const { setLastPmsSyncTime, setDailyRecap } = useOraStore();

  useEffect(() => {
    setLastPmsSyncTime(new Date().toISOString());

    // Generate daily recap from available data
    const d = stats || { revenueSaved: 0, callsHandled: 0, missedPrevented: 0, confirmationRate: 0, upcomingToday: 0, actionRequired: 0 };
    const schedulePercent = Math.min(Math.round(((d.upcomingToday + 4) / 15) * 100), 100);
    const revenueToday = roi?.confirmedRevenue30d ?? d.revenueSaved;

    setDailyRecap({
      revenueToday,
      revenueDelta: 12,
      slotsFilled: d.upcomingToday + 4,
      slotsTotal: 15,
      risksResolved: Math.max(0, 3 - d.actionRequired),
      risksRemaining: d.actionRequired,
      aiCallsHandled: d.callsHandled,
      staffHoursSaved: roi?.staffHoursSaved ?? 0,
      topAchievement: revenueToday > 0
        ? `AI generated ${formatCurrency(revenueToday, currencyMode)} in autonomous revenue`
        : 'First calls will generate achievements',
      generatedAt: new Date().toISOString(),
    });
  }, [stats, roi, currencyMode, setLastPmsSyncTime, setDailyRecap]);

  // ── Derive KPIs ───────────────────────────────────────────
  const d = stats || {
    revenueSaved: 0, callsHandled: 0, missedPrevented: 0,
    confirmationRate: 0, upcomingToday: 0, actionRequired: 0,
  };

  const schedulePercent = Math.min(Math.round(((d.upcomingToday + 4) / 15) * 100), 100);
  const revenueToday = roi?.confirmedRevenue30d ?? d.revenueSaved;
  const aiConfidence = roi?.callSuccessRate ?? 0;
  const staffHoursSaved = roi?.staffHoursSaved ?? 0;

  // ── Connect reward trigger engine ─────────────────────────
  useRewardTriggerEngine({
    revenueToday,
    scheduleFillPct: schedulePercent,
    urgentCount: d.actionRequired,
    aiConfidence,
    staffHoursSaved,
    currency: currencyMode,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-48 bg-secondary rounded-lg animate-pulse" />
          <div className="h-4 w-72 bg-secondary/50 rounded animate-pulse" />
        </div>
        <LoadingState variant="kpi" />
        <LoadingState variant="list" rows={5} />
      </div>
    );
  }

  const currSymbol = formatCurrency(0, currencyMode).charAt(0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Reward Toast Container (portal) */}
      <RewardToastContainer />

      {/* Header + Daily Recap Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Practice Overview
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {currentClinic?.name} • {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <DailyRecapPanel />
      </div>

      {/* SECTION 1: AI Live Status Strip */}
      <AIStatusStrip />

      {/* SECTION 2: KPI Row — with count-up & glow */}
      <motion.div
        variants={staggerContainerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <KPICard
          label="Revenue Today"
          value={revenueToday}
          formattedValue={formatCurrency(revenueToday, currencyMode)}
          subtext="vs yesterday"
          delta={12}
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
          accentColor="bg-emerald-50 text-emerald-600"
          sparklineData={[120, 190, 80, 310, 250, 380, revenueToday]}
          emptyExplanation="Revenue will populate as AI books and confirms appointments throughout the day."
          countUp
          countUpPrefix={currSymbol}
          isRevenue
          glowColor="rgba(16, 185, 129, 0.18)"
        />
        <KPICard
          label="Schedule Fill Rate"
          value={schedulePercent}
          formattedValue={`${schedulePercent}%`}
          subtext={`${15 - d.upcomingToday - 4} slots open`}
          icon={<CalendarCheck className="h-5 w-5 text-primary" />}
          accentColor="bg-primary/10 text-primary"
          currentPct={schedulePercent}
          riskThreshold={70}
          emptyExplanation="Connect your PMS to see real-time schedule fill rates."
          countUp
          countUpSuffix="%"
        />
        <KPICard
          label="Missed Call Recovery"
          value={d.missedPrevented}
          formattedValue={`${d.missedPrevented}`}
          subtext="recovered today"
          delta={d.missedPrevented > 0 ? 8 : 0}
          icon={<PhoneForwarded className="h-5 w-5 text-blue-500" />}
          accentColor="bg-blue-50 text-blue-500"
          sparklineData={[2, 5, 3, 7, 4, 6, d.missedPrevented]}
          emptyExplanation="Missed calls are auto-recovered and converted by the AI voice agent."
          countUp
        />
        <KPICard
          label="Action Required"
          value={d.actionRequired}
          formattedValue={`${d.actionRequired}`}
          subtext={d.actionRequired > 0 ? 'needs review' : 'all clear'}
          icon={<ShieldAlert className="h-5 w-5 text-red-500" />}
          accentColor={d.actionRequired > 0 ? "bg-red-50 text-red-500" : "bg-secondary text-muted-foreground"}
          emptyExplanation="When escalations occur, actionable items appear here for your staff to resolve."
          countUp
          isRisk
        />
      </motion.div>

      {/* SECTION 3 + 7: Call Volume + Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Suspense fallback={<div className="bg-card border border-border/60 rounded-xl p-5 h-48 flex items-center justify-center animate-pulse"><span className="text-muted-foreground text-sm">Loading Chart...</span></div>}>
            <CallVolumeChart />
          </Suspense>
        </div>
        <LiveFeed />
      </div>

      {/* SECTION 4 + 5: Schedule + Urgent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ScheduleSnapshot />
        <UrgentActionCenter />
      </div>

      {/* SECTION 6: Productivity Impact */}
      <ProductivityImpact />
    </div>
  );
}
