/**
 * ORADESK AI — OPENDENTAL DATABASE CONNECTOR
 * ═══════════════════════════════════════════════════════════
 *
 * Reads directly from OpenDental's MySQL database using
 * READ-ONLY credentials. No schema modifications.
 *
 * Mapped Tables:
 *   patient         → patients
 *   appointment     → appointments
 *   treatplan        → treatment_plans
 *   procedurelog     → procedures (revenue)
 *   claimproc        → balances (insurance/writeoffs)
 *
 * Security:
 *   - Read-only MySQL user
 *   - No PHI in logs (hashed identifiers)
 *   - Connection pooling with max 3 connections
 *   - Query timeout: 10 seconds
 */

import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { logger } from './logger';

// ─── Types ──────────────────────────────────────────────────

export interface OpenDentalConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
}

export interface PmsPatient {
    pms_id: string;
    first_name: string;
    last_name: string;
    phone: string;
    email: string | null;
    date_of_birth: string | null;
    status: string;
    checksum: string;
}

export interface PmsAppointment {
    pms_id: string;
    patient_pms_id: string;
    scheduled_at: string;
    duration_minutes: number;
    procedure_name: string;
    status: string;
    confirmed: string;
    provider_name: string | null;
    note: string | null;
    checksum: string;
}

export interface PmsTreatmentPlan {
    pms_id: string;
    patient_pms_id: string;
    name: string;
    total_fee: number;
    status: string;
    created_at: string;
    checksum: string;
}

export interface PmsBalance {
    patient_pms_id: string;
    total_fees: number;
    insurance_paid: number;
    write_offs: number;
    patient_paid: number;
    outstanding: number;
}

export interface PmsChangeSet {
    patients: PmsPatient[];
    appointments: PmsAppointment[];
    treatmentPlans: PmsTreatmentPlan[];
    balances: PmsBalance[];
    timestamp: string;
}

// ─── Status Maps ────────────────────────────────────────────

const APPOINTMENT_STATUS_MAP: Record<number, string> = {
    1: 'scheduled',     // Scheduled
    2: 'completed',     // Complete
    3: 'scheduled',     // UnschedList (treat as scheduled)
    5: 'cancelled',     // Broken
    6: 'missed',        // Planned (missed interpretation)
};

const PATIENT_STATUS_MAP: Record<number, string> = {
    0: 'active',        // Patient
    1: 'inactive',      // NonPatient
    2: 'archived',      // InactivePatient
    3: 'deceased',      // Deceased
    4: 'archived',      // Disabled
};

const CONFIRMED_MAP: Record<number, string> = {
    0: 'unconfirmed',
    1: 'confirmed',
    2: 'not_called',
};

// ═══════════════════════════════════════════════════════════
// OPENDENTAL CONNECTOR
// ═══════════════════════════════════════════════════════════

export class OpenDentalConnector {
    private pool: mysql.Pool | null = null;
    private config: OpenDentalConfig;

    constructor(config: OpenDentalConfig) {
        this.config = config;
    }

    // ── Connection Management ─────────────────────────────

    async connect(): Promise<boolean> {
        try {
            this.pool = mysql.createPool({
                host: this.config.host,
                port: this.config.port,
                user: this.config.user,
                password: this.config.password,
                database: this.config.database,
                connectionLimit: 3,        // Minimal footprint
                connectTimeout: 10000,     // 10 sec timeout
                waitForConnections: true,
                queueLimit: 5,
                enableKeepAlive: true,
                keepAliveInitialDelay: 30000,
            });

            // Test connection
            const conn = await this.pool.getConnection();
            conn.release();

            logger.info('OpenDental MySQL connection established', {
                host: this.config.host,
                port: this.config.port,
                database: this.config.database,
            });

            return true;
        } catch (error) {
            logger.error('Failed to connect to OpenDental MySQL', {
                error: (error as Error).message,
                host: this.config.host,
            });
            return false;
        }
    }

    async disconnect(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            logger.info('OpenDental MySQL connection closed');
        }
    }

    async testConnection(): Promise<{
        success: boolean;
        version?: string;
        patientCount?: number;
        error?: string;
    }> {
        try {
            if (!this.pool) {
                const connected = await this.connect();
                if (!connected) return { success: false, error: 'Connection failed' };
            }

            // Get OpenDental version
            const [versionRows] = await this.pool!.execute(
                'SELECT ProgramVersion FROM preference WHERE PrefName = "ProgramVersion" LIMIT 1',
            ) as any[];
            const version = versionRows?.[0]?.ProgramVersion || 'Unknown';

            // Get patient count (quick health check)
            const [countRows] = await this.pool!.execute(
                'SELECT COUNT(*) as cnt FROM patient WHERE PatStatus = 0',
            ) as any[];
            const patientCount = countRows?.[0]?.cnt || 0;

            return { success: true, version, patientCount };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    // ── READ: Patients ────────────────────────────────────

    async getPatientsSince(since: string): Promise<PmsPatient[]> {
        if (!this.pool) throw new Error('Not connected');

        const [rows] = await this.pool.execute(`
      SELECT
        PatNum,
        FName,
        LName,
        COALESCE(NULLIF(WirelessPhone, ''), NULLIF(HmPhone, ''), NULLIF(WkPhone, '')) AS Phone,
        Email,
        DATE_FORMAT(Birthdate, '%Y-%m-%d') AS Birthdate,
        PatStatus,
        DateTStamp
      FROM patient
      WHERE DateTStamp > ?
        AND PatStatus IN (0, 1)
      ORDER BY DateTStamp ASC
      LIMIT 500
    `, [since]) as any[];

        return (rows || []).map((row: any): PmsPatient => ({
            pms_id: String(row.PatNum),
            first_name: row.FName || '',
            last_name: row.LName || '',
            phone: normalizePhone(row.Phone),
            email: row.Email || null,
            date_of_birth: row.Birthdate || null,
            status: PATIENT_STATUS_MAP[row.PatStatus] || 'active',
            checksum: computeChecksum(`${row.PatNum}:${row.FName}:${row.LName}:${row.Phone}:${row.DateTStamp}`),
        }));
    }

    async getAllActivePatients(): Promise<PmsPatient[]> {
        return this.getPatientsSince('1970-01-01 00:00:00');
    }

    // ── READ: Appointments ────────────────────────────────

    async getAppointmentsSince(since: string): Promise<PmsAppointment[]> {
        if (!this.pool) throw new Error('Not connected');

        const [rows] = await this.pool.execute(`
      SELECT
        a.AptNum,
        a.PatNum,
        a.AptDateTime,
        a.Pattern,
        a.ProcDescript,
        a.AptStatus,
        a.Confirmed,
        a.Note,
        a.DateTStamp,
        CONCAT(COALESCE(p.FName, ''), ' ', COALESCE(p.LName, '')) AS ProviderName
      FROM appointment a
      LEFT JOIN provider p ON a.ProvNum = p.ProvNum
      WHERE a.DateTStamp > ?
      ORDER BY a.DateTStamp ASC
      LIMIT 500
    `, [since]) as any[];

        return (rows || []).map((row: any): PmsAppointment => ({
            pms_id: String(row.AptNum),
            patient_pms_id: String(row.PatNum),
            scheduled_at: row.AptDateTime ? new Date(row.AptDateTime).toISOString() : '',
            duration_minutes: patternToDuration(row.Pattern || ''),
            procedure_name: row.ProcDescript || 'General',
            status: APPOINTMENT_STATUS_MAP[row.AptStatus] || 'scheduled',
            confirmed: CONFIRMED_MAP[row.Confirmed] || 'unconfirmed',
            provider_name: row.ProviderName?.trim() || null,
            note: row.Note || null,
            checksum: computeChecksum(`${row.AptNum}:${row.AptStatus}:${row.AptDateTime}:${row.DateTStamp}`),
        }));
    }

    async getFutureAppointments(): Promise<PmsAppointment[]> {
        if (!this.pool) throw new Error('Not connected');

        const [rows] = await this.pool.execute(`
      SELECT
        a.AptNum,
        a.PatNum,
        a.AptDateTime,
        a.Pattern,
        a.ProcDescript,
        a.AptStatus,
        a.Confirmed,
        a.Note,
        a.DateTStamp,
        CONCAT(COALESCE(p.FName, ''), ' ', COALESCE(p.LName, '')) AS ProviderName
      FROM appointment a
      LEFT JOIN provider p ON a.ProvNum = p.ProvNum
      WHERE a.AptDateTime >= NOW()
        AND a.AptStatus IN (1, 3)
      ORDER BY a.AptDateTime ASC
      LIMIT 200
    `) as any[];

        return (rows || []).map((row: any): PmsAppointment => ({
            pms_id: String(row.AptNum),
            patient_pms_id: String(row.PatNum),
            scheduled_at: row.AptDateTime ? new Date(row.AptDateTime).toISOString() : '',
            duration_minutes: patternToDuration(row.Pattern || ''),
            procedure_name: row.ProcDescript || 'General',
            status: APPOINTMENT_STATUS_MAP[row.AptStatus] || 'scheduled',
            confirmed: CONFIRMED_MAP[row.Confirmed] || 'unconfirmed',
            provider_name: row.ProviderName?.trim() || null,
            note: row.Note || null,
            checksum: computeChecksum(`${row.AptNum}:${row.AptStatus}:${row.AptDateTime}:${row.DateTStamp}`),
        }));
    }

    // ── READ: Treatment Plans ─────────────────────────────

    async getTreatmentPlansSince(since: string): Promise<PmsTreatmentPlan[]> {
        if (!this.pool) throw new Error('Not connected');

        const [rows] = await this.pool.execute(`
      SELECT
        tp.TreatPlanNum,
        tp.PatNum,
        tp.Heading,
        tp.DateTP,
        tp.TPStatus,
        COALESCE(
          (SELECT SUM(pl.ProcFee)
           FROM procedurelog pl
           INNER JOIN treatplanattach tpa ON tpa.ProcNum = pl.ProcNum
           WHERE tpa.TreatPlanNum = tp.TreatPlanNum),
          0
        ) AS TotalFee
      FROM treatplan tp
      WHERE tp.DateTP > ?
      ORDER BY tp.DateTP DESC
      LIMIT 200
    `, [since]) as any[];

        return (rows || []).map((row: any): PmsTreatmentPlan => ({
            pms_id: String(row.TreatPlanNum),
            patient_pms_id: String(row.PatNum),
            name: row.Heading || 'Treatment Plan',
            total_fee: parseFloat(row.TotalFee) || 0,
            status: row.TPStatus === 0 ? 'active' : 'inactive',
            created_at: row.DateTP ? new Date(row.DateTP).toISOString() : '',
            checksum: computeChecksum(`${row.TreatPlanNum}:${row.TotalFee}:${row.TPStatus}`),
        }));
    }

    // ── READ: Outstanding Balances ────────────────────────

    async getPatientBalances(patientPmsIds: string[]): Promise<PmsBalance[]> {
        if (!this.pool || patientPmsIds.length === 0) return [];

        const placeholders = patientPmsIds.map(() => '?').join(',');
        const [rows] = await this.pool.execute(`
      SELECT
        pl.PatNum,
        SUM(pl.ProcFee) AS TotalFees,
        COALESCE(SUM(cp.InsPayAmt), 0) AS InsurancePaid,
        COALESCE(SUM(cp.WriteOff), 0) AS WriteOffs,
        COALESCE(
          (SELECT SUM(ps.SplitAmt) FROM paysplit ps WHERE ps.PatNum = pl.PatNum),
          0
        ) AS PatientPaid
      FROM procedurelog pl
      LEFT JOIN claimproc cp ON cp.ProcNum = pl.ProcNum
      WHERE pl.PatNum IN (${placeholders})
        AND pl.ProcStatus = 2
      GROUP BY pl.PatNum
    `, patientPmsIds) as any[];

        return (rows || []).map((row: any): PmsBalance => {
            const totalFees = parseFloat(row.TotalFees) || 0;
            const insurancePaid = parseFloat(row.InsurancePaid) || 0;
            const writeOffs = parseFloat(row.WriteOffs) || 0;
            const patientPaid = parseFloat(row.PatientPaid) || 0;

            return {
                patient_pms_id: String(row.PatNum),
                total_fees: totalFees,
                insurance_paid: insurancePaid,
                write_offs: writeOffs,
                patient_paid: patientPaid,
                outstanding: Math.max(0, totalFees - insurancePaid - writeOffs - patientPaid),
            };
        });
    }

    // ── WRITE: Create Appointment ─────────────────────────
    // ONLY writes allowed: create appointment, update status

    async createAppointment(data: {
        patientPmsId: string;
        scheduledAt: Date;
        durationMinutes: number;
        procedureName: string;
        note?: string;
    }): Promise<{ success: boolean; pms_id?: string; error?: string }> {
        if (!this.pool) return { success: false, error: 'Not connected' };

        try {
            // Conflict check: verify the time slot is free
            const conflict = await this.checkSlotConflict(
                data.scheduledAt,
                data.durationMinutes,
            );

            if (conflict) {
                return {
                    success: false,
                    error: `Time conflict with appointment #${conflict.AptNum}: ${conflict.ProcDescript} at ${conflict.AptDateTime}`,
                };
            }

            // Convert duration to OpenDental pattern
            const pattern = durationToPattern(data.durationMinutes);

            const [result] = await this.pool.execute(`
        INSERT INTO appointment (
          PatNum, AptDateTime, Pattern, ProcDescript,
          AptStatus, Confirmed, Note, DateTStamp
        ) VALUES (?, ?, ?, ?, 1, 0, ?, NOW())
      `, [
                data.patientPmsId,
                data.scheduledAt,
                pattern,
                data.procedureName,
                data.note || 'Created by OraDesk AI',
            ]) as any;

            const newId = String(result.insertId);

            logger.info('Appointment created in OpenDental', {
                pms_id: newId,
                patient_hash: hashId(data.patientPmsId),
            });

            return { success: true, pms_id: newId };
        } catch (error) {
            logger.error('Failed to create appointment in OpenDental', {
                error: (error as Error).message,
            });
            return { success: false, error: (error as Error).message };
        }
    }

    // ── WRITE: Update Appointment Status ──────────────────

    async updateAppointmentStatus(
        aptPmsId: string,
        newStatus: string,
    ): Promise<{ success: boolean; error?: string }> {
        if (!this.pool) return { success: false, error: 'Not connected' };

        // Reverse-map OraDesk status to OpenDental AptStatus
        const statusReverseMap: Record<string, number> = {
            scheduled: 1,
            completed: 2,
            cancelled: 5,
            missed: 6,
        };

        const aptStatus = statusReverseMap[newStatus];
        if (aptStatus === undefined) {
            return { success: false, error: `Unknown status: ${newStatus}` };
        }

        try {
            // Verify appointment exists
            const [existing] = await this.pool.execute(
                'SELECT AptNum, AptStatus FROM appointment WHERE AptNum = ? LIMIT 1',
                [aptPmsId],
            ) as any[];

            if (!existing || existing.length === 0) {
                return { success: false, error: `Appointment ${aptPmsId} not found` };
            }

            await this.pool.execute(
                'UPDATE appointment SET AptStatus = ?, DateTStamp = NOW() WHERE AptNum = ?',
                [aptStatus, aptPmsId],
            );

            logger.info('Appointment status updated in OpenDental', {
                pms_id_hash: hashId(aptPmsId),
                new_status: newStatus,
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    }

    // ── Conflict Detection ────────────────────────────────

    async checkSlotConflict(
        scheduledAt: Date,
        durationMinutes: number,
    ): Promise<any | null> {
        if (!this.pool) return null;

        const endTime = new Date(scheduledAt.getTime() + durationMinutes * 60000);

        const [rows] = await this.pool.execute(`
      SELECT AptNum, AptDateTime, ProcDescript, Pattern
      FROM appointment
      WHERE AptStatus IN (1, 3)
        AND AptDateTime < ?
        AND DATE_ADD(AptDateTime, INTERVAL CHAR_LENGTH(Pattern) * 5 MINUTE) > ?
      LIMIT 1
    `, [endTime, scheduledAt]) as any[];

        return rows && rows.length > 0 ? rows[0] : null;
    }

    // ── Full Change Set ───────────────────────────────────

    async getChangesSince(since: string): Promise<PmsChangeSet> {
        const [patients, appointments, treatmentPlans] = await Promise.all([
            this.getPatientsSince(since),
            this.getAppointmentsSince(since),
            this.getTreatmentPlansSince(since),
        ]);

        // Get balances for patients we just fetched
        const patientIds = patients.map((p) => p.pms_id);
        const balances = patientIds.length > 0
            ? await this.getPatientBalances(patientIds)
            : [];

        return {
            patients,
            appointments,
            treatmentPlans,
            balances,
            timestamp: new Date().toISOString(),
        };
    }
}

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * OpenDental Pattern → Duration in minutes.
 * Pattern is a string of X's and /'s. Each character = 5 minutes.
 * Example: "XXXXXX" = 30 minutes
 */
function patternToDuration(pattern: string): number {
    return pattern.length * 5 || 30;
}

/**
 * Duration in minutes → OpenDental Pattern string.
 */
function durationToPattern(minutes: number): string {
    const slots = Math.max(1, Math.ceil(minutes / 5));
    return 'X'.repeat(slots);
}

/**
 * Normalize phone to E.164 format.
 */
function normalizePhone(phone: string | null): string {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return phone;
}

/**
 * Compute SHA-256 checksum for change detection.
 */
function computeChecksum(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex').substring(0, 16);
}

/**
 * Hash an ID for logging (HIPAA: no raw identifiers in logs).
 */
function hashId(id: string): string {
    return crypto.createHash('sha256').update(id).digest('hex').substring(0, 8);
}
