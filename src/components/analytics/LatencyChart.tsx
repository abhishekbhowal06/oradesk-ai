import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useLatencyMetrics } from '@/hooks/useAnalytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Zap } from 'lucide-react';

interface TurnLatencyMetrics {
  action: string;
  callId: string;
  turn: number;
  stt_latency: number;
  gemini_latency: number;
  db_latency: number;
  tts_latency: number;
  total_turnaround: number;
  timestamp: string;
}

export function LatencyChart() {
  const { data: rawEvents, isLoading, error } = useLatencyMetrics(50);

  const data = useMemo(() => {
    if (!rawEvents) return [];
    // Sort by time ascending for chart
    return rawEvents
      .map((e) => e.event_data as unknown as TurnLatencyMetrics)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((m) => ({
        name: `Turn ${m.turn}`,
        STT: m.stt_latency > 0 ? m.stt_latency : 0,
        Gemini: m.gemini_latency > 0 ? m.gemini_latency : 0,
        DB: m.db_latency > 0 ? m.db_latency : 0,
        TTS: m.tts_latency > 0 ? m.tts_latency : 0,
        Overhead: Math.max(
          0,
          m.total_turnaround -
            ((m.stt_latency > 0 ? m.stt_latency : 0) +
              (m.gemini_latency > 0 ? m.gemini_latency : 0) +
              (m.db_latency > 0 ? m.db_latency : 0) +
              (m.tts_latency > 0 ? m.tts_latency : 0)),
        ),
        Total: m.total_turnaround,
        timestamp: m.timestamp,
        callId: m.callId,
      }));
  }, [rawEvents]);

  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const sums = { STT: 0, Gemini: 0, DB: 0, TTS: 0, Overhead: 0 };
    data.forEach((d) => {
      sums.STT += d.STT;
      sums.Gemini += d.Gemini;
      sums.DB += d.DB;
      sums.TTS += d.TTS;
      sums.Overhead += d.Overhead;
    });
    const count = data.length;
    const avgs = {
      STT: Math.round(sums.STT / count),
      Gemini: Math.round(sums.Gemini / count),
      DB: Math.round(sums.DB / count),
      TTS: Math.round(sums.TTS / count),
    };
    const max = Math.max(avgs.STT, avgs.Gemini, avgs.DB, avgs.TTS);
    const slowest = Object.keys(avgs).find((k) => avgs[k as keyof typeof avgs] === max);

    return { avgs, slowest, max };
  }, [data]);

  if (isLoading) return <Skeleton className="h-[400px] w-full" />;
  if (error) return <div className="text-red-500">Failed to load latency metrics</div>;

  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          Real-time Latency Breakdown (Last 50 Turns)
        </CardTitle>
        <CardDescription>
          Milliseconds per stage: STT → Brain (Gemini) → Tool (DB) → TTS
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No latency data recorded yet.
          </div>
        ) : (
          <>
            {stats && (
              <div className="mb-6 flex gap-4 text-sm">
                <div className="rounded-md bg-muted px-3 py-1">
                  AVG Total:{' '}
                  <span className="font-bold text-foreground">
                    {stats.avgs.STT + stats.avgs.Gemini + stats.avgs.DB + stats.avgs.TTS}ms
                  </span>
                </div>
                <div className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-1 text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  Slowest Component:
                  <span className="font-bold">
                    {stats.slowest} ({stats.max}ms)
                  </span>
                </div>
              </div>
            )}

            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}ms`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                    }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  />
                  <Legend />
                  <Bar dataKey="STT" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="Gemini" stackId="a" fill="#8b5cf6" />
                  <Bar dataKey="DB" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="TTS" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
