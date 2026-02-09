import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';
import { DentrixMock, LocalAppointment } from './dentrix-mock';

dotenv.config();

const STATE_FILE = path.resolve(__dirname, '../data/sync_state.json');

export class SyncAgent {
    private supabase: SupabaseClient | null = null;
    private dentrix: DentrixMock;
    private clinicId: string;
    private isOfflineMode: boolean = false;

    constructor(clinicId: string) {
        this.clinicId = clinicId;
        this.dentrix = new DentrixMock();

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!SUPABASE_URL || !SUPABASE_KEY) {
            logger.warn("Missing Supabase Credentials - Running in OFFLINE SIMULATION MODE");
            this.isOfflineMode = true;
        } else {
            this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
                auth: { persistSession: false }
            });
        }
    }

    private getLastSyncTime(): string {
        try {
            if (fs.existsSync(STATE_FILE)) {
                const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
                return data.last_sync || '1970-01-01T00:00:00Z';
            }
        } catch (e) {
            logger.warn("Could not read state file, defaulting to epoch");
        }
        return '1970-01-01T00:00:00Z';
    }

    private saveLastSyncTime(timestamp: string) {
        if (!fs.existsSync(path.dirname(STATE_FILE))) {
            fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
        }
        fs.writeFileSync(STATE_FILE, JSON.stringify({ last_sync: timestamp }));
    }

    private async pingCloud(): Promise<boolean> {
        if (!this.supabase) return false;
        try {
            // Simple health check - query the clinics table (small fetch)
            const { error } = await this.supabase.from('clinics').select('id').limit(1);
            return !error;
        } catch (e) {
            logger.error("Cloud ping failed", e);
            return false;
        }
    }

    public async runSync() {
        if (this.isOfflineMode) {
            logger.info("[OFFLINE MODE] Simulating Sync...");
            const changes = this.dentrix.getChangesSince(this.getLastSyncTime());
            logger.info(`[OFFLINE MODE] Would sync ${changes.length} records to Cloud.`);
            if (changes.length > 0) {
                const maxTime = changes.reduce((max, r) => r.last_updated > max ? r.last_updated : max, '1970-01-01');
                this.saveLastSyncTime(maxTime);
            }
            return;
        }

        // --- HEARTBEAT CHECK ---
        const isCloudReachable = await this.pingCloud();
        if (!isCloudReachable) {
            logger.warn("Cloud unreachable. Skipping sync (would queue locally in production).");
            return;
        }
        // --- END HEARTBEAT ---

        const lastSync = this.getLastSyncTime();
        logger.info(`Checking for changes since ${lastSync}`);

        const changes = this.dentrix.getChangesSince(lastSync);

        if (changes.length === 0) {
            logger.info("No changes found.");
            return;
        }

        logger.info(`Found ${changes.length} changes. Syncing...`);
        let processed = 0;
        let errors = 0;

        for (const record of changes) {
            try {
                await this.syncRecord(record);
                processed++;
            } catch (error) {
                logger.error(`Failed to sync appointment ${record.id}`, error);
                errors++;
            }
        }

        // Log to Supabase
        if (this.supabase) {
            await this.supabase.from('pms_sync_logs').insert({
                clinic_id: this.clinicId,
                sync_status: errors === 0 ? 'success' : 'partial_failure',
                records_processed: processed,
                errors: errors > 0 ? { count: errors } : null,
                completed_at: new Date().toISOString()
            });
        }

        // Update local state (safe assumption for now: take max updated_at)
        const maxTime = changes.reduce((max, r) => r.last_updated > max ? r.last_updated : max, lastSync);
        this.saveLastSyncTime(maxTime);

        logger.info(`Sync complete. Processed: ${processed}, Errors: ${errors}`);
    }

    private async syncRecord(record: LocalAppointment) {
        if (!this.supabase) return;

        // 1. Sync Patient
        let patientId: string | null = null;

        // Check strict match by phone
        const { data: existingPatient } = await this.supabase
            .from('patients')
            .select('id')
            .eq('clinic_id', this.clinicId)
            .eq('phone', record.phone)
            .single();

        if (existingPatient) {
            patientId = existingPatient.id;
        } else {
            // Create Patient
            const nameParts = record.patient_name.split(' ');
            const first = nameParts[0];
            const last = nameParts.slice(1).join(' ') || 'Unknown';

            const { data: newPatient, error: pError } = await this.supabase
                .from('patients')
                .insert({
                    clinic_id: this.clinicId,
                    first_name: first,
                    last_name: last,
                    phone: record.phone,
                    external_id: `PAT-${record.id}`, // Synthetic external ID for prototype
                    last_synced_at: new Date().toISOString()
                })
                .select('id')
                .single();

            if (pError) throw pError;
            patientId = newPatient.id;
        }

        // 2. Sync Appointment
        // Map Status
        const statusMap: Record<string, string> = {
            'Scheduled': 'scheduled',
            'Broken': 'cancelled',
            'Completed': 'completed'
        };

        const mappedStatus = statusMap[record.status] || 'scheduled';

        const { data: existingApp } = await this.supabase
            .from('appointments')
            .select('id')
            .eq('clinic_id', this.clinicId)
            .eq('external_id', record.id)
            .single();

        if (existingApp) {
            await this.supabase.from('appointments').update({
                scheduled_at: record.start_time,
                status: mappedStatus,
                procedure_name: record.procedure,
                last_synced_at: new Date().toISOString()
            }).eq('id', existingApp.id);
        } else {
            await this.supabase.from('appointments').insert({
                clinic_id: this.clinicId,
                patient_id: patientId,
                external_id: record.id,
                scheduled_at: record.start_time,
                status: mappedStatus,
                procedure_name: record.procedure,
                ai_managed: true,
                last_synced_at: new Date().toISOString()
            });
        }
    }
}
