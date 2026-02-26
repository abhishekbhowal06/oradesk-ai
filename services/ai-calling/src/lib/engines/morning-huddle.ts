/**
 * MORNING HUDDLE REPORTER (The "Risk Sheet")
 *
 * Purpose: Prepares the doctor/staff for the day's hidden risks.
 * Goal: "No Surprises."
 *
 * Generates a briefing on:
 * 1. Financial Risk (Overdue balances)
 * 2. Behavioral Risk (Recent complaints, anxiety)
 * 3. Clinical Risk (Pre-meds, complex history)
 */

import { supabase } from '../supabase';
import { logger } from '../logging/structured-logger';

export interface HuddleReportItem {
  time: string;
  patientName: string;
  procedure: string;
  risks: string[];
  notes: string;
}

export class MorningHuddleReporter {
  /**
   * Generate the daily "Risk Sheet" for a clinic
   * Now timezone-aware: uses clinic's configured timezone
   */
  async generateDailyReport(clinicId: string, date: Date = new Date()): Promise<string> {
    // ARCHITECTURAL CORRECTION: Get clinic timezone
    const { data: clinic } = await supabase
      .from('clinics')
      .select('timezone')
      .eq('id', clinicId)
      .single();

    const timezone = clinic?.timezone || 'America/New_York';

    // Calculate start/end of day in clinic's timezone
    // Using native Intl API for timezone conversion (no external dependency)
    const startOfDay = this.getStartOfDayInTimezone(date, timezone);
    const endOfDay = this.getEndOfDayInTimezone(date, timezone);

    logger.debug('Morning Huddle query bounds', {
      clinicId,
      timezone,
      startOfDay: startOfDay.toISOString(),
      endOfDay: endOfDay.toISOString(),
    });

    const { data: appointments } = await supabase
      .from('appointments')
      .select(
        `
                scheduled_at,
                procedure_name,
                patients (
                    full_name,
                    phone,
                    medical_history,
                    pre_med_required
                )
            `,
      )
      .eq('clinic_id', clinicId)
      .gte('scheduled_at', startOfDay.toISOString())
      .lte('scheduled_at', endOfDay.toISOString())
      .order('scheduled_at', { ascending: true });

    if (!appointments || appointments.length === 0) {
      return '☕ Morning Huddle: No appointments scheduled for today.';
    }

    const reportItems: HuddleReportItem[] = [];

    // 2. Analyze each patient for "Red Flags"
    for (const apt of appointments) {
      // Supabase returns joined data as a single object or array depending on relationship.
      // Casting to any to bypass strict type inference for joined tables in this context.
      const patient: any = Array.isArray(apt.patients) ? apt.patients[0] : apt.patients;

      if (!patient) continue;

      const risks: string[] = [];
      const notes = '';

      // Check Clinical Risks
      if (patient.pre_med_required) {
        risks.push('💊 PRE-MED REQUIRED');
      }
      if (patient?.medical_history?.includes('anxiety')) {
        risks.push('😰 High Anxiety');
      }

      // Check Behavioral Risks (Mock logic - would query 'patient_behavioral_profiles')
      // const reliability = await this.getReliabilityScore(patient.id);
      // if (reliability < 50) risks.push("⚠️ Chronic No-Show");

      // Check Financial Risks (Mock logic - would query 'billing')
      // if (await this.hasOverdueBalance(patient.id)) risks.push("💰 Overdue Balance > $500");

      if (risks.length > 0) {
        reportItems.push({
          time: new Date(apt.scheduled_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
          patientName: patient.full_name,
          procedure: apt.procedure_name,
          risks,
          notes: notes,
        });
      }
    }

    // 3. Format the Output
    return this.formatReport(reportItems, date);
  }

  private formatReport(items: HuddleReportItem[], date: Date): string {
    if (items.length === 0) {
      return `✅ Morning Huddle (${date.toLocaleDateString()}): Smooth sailing. No major patient risks detected today.`;
    }

    let report = `📋 MORNING HUDDLE REPORT - ${date.toLocaleDateString()}\n`;
    report += `⚠️ ${items.length} Patients require special attention today.\n\n`;

    items.forEach((item) => {
      report += `⏰ ${item.time} - ${item.patientName} (${item.procedure})\n`;
      item.risks.forEach((risk) => {
        report += `   🔴 ${risk}\n`;
      });
      if (item.notes) report += `   📝 ${item.notes}\n`;
      report += `\n`;
    });

    report += `\n💡 Tip: Review medical alerts before entering the room.`;
    return report;
  }

  /**
   * Get start of day in a specific timezone
   * Uses Intl.DateTimeFormat to handle timezone correctly
   */
  private getStartOfDayInTimezone(date: Date, timezone: string): Date {
    // Format date in target timezone to get the local date components
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    const parts = formatter.formatToParts(date);
    const year = parseInt(parts.find((p) => p.type === 'year')?.value || '2026');
    const month = parseInt(parts.find((p) => p.type === 'month')?.value || '1') - 1;
    const day = parseInt(parts.find((p) => p.type === 'day')?.value || '1');

    // Create a date string for midnight in the target timezone
    const midnightStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`;

    // Parse it as if it's in the target timezone
    // This is a simplification; for production, use Luxon or date-fns-tz
    const localDate = new Date(midnightStr);

    // Get timezone offset for the target timezone
    const tzOffset = this.getTimezoneOffset(timezone, localDate);

    return new Date(localDate.getTime() + tzOffset);
  }

  /**
   * Get end of day in a specific timezone
   */
  private getEndOfDayInTimezone(date: Date, timezone: string): Date {
    const startOfDay = this.getStartOfDayInTimezone(date, timezone);
    // Add 23:59:59.999
    return new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);
  }

  /**
   * Get timezone offset in milliseconds
   */
  private getTimezoneOffset(timezone: string, date: Date): number {
    // Get UTC string and local string for comparison
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    return utcDate.getTime() - tzDate.getTime();
  }
}

export const morningHuddleReporter = new MorningHuddleReporter();
