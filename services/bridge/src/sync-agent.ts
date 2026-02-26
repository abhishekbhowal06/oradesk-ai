/**
 * ORADESK AI — PMS BRIDGE SYNC AGENT
 * ═══════════════════════════════════════════════════════════
 *
 * Desktop agent that runs as a Windows service.
 * Handles bidirectional sync between OpenDental and OraDesk Cloud.
 *
 * READ:  PMS → Cloud (poll every 30 sec, or change-based)
 * WRITE: Cloud → PMS (poll write queue, execute, report back)
 *
 * Features:
 *   - Offline retry queue
 *   - Encrypted local cache (AES-256)
 *   - Multi-clinic isolation (one device per clinic)
 *   - Checksum-based change detection
 *   - Heartbeat monitoring
 *   - Full audit trail
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { logger } from './logger';
import {
  OpenDentalConnector,
  OpenDentalConfig,
  PmsPatient,
  PmsAppointment,
  PmsTreatmentPlan,
  PmsBalance,
} from './opendental-connector';

dotenv.config();

// ─── Configuration ──────────────────────────────────────────

interface BridgeConfig {
  clinicId: string;
  deviceToken: string;
  supabaseUrl: string;
  supabaseKey: string;
  syncIntervalMs: number;
  writeQueuePollMs: number;
  heartbeatIntervalMs: number;
  pmsConfig: OpenDentalConfig;
  cacheDir: string;
  cacheEncryptionKey: string;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'sync_state.enc');
const OFFLINE_QUEUE_FILE = path.join(DATA_DIR, 'offline_queue.enc');

// ─── State Types ────────────────────────────────────────────

interface SyncState {
  lastPatientSync: string;
  lastAppointmentSync: string;
  lastTreatmentSync: string;
  lastWriteQueuePoll: string;
  totalSynced: number;
  totalWrites: number;
}

interface OfflineQueueEntry {
  type: 'patient' | 'appointment' | 'treatment_plan';
  data: any;
  timestamp: string;
  retryCount: number;
}

// ═══════════════════════════════════════════════════════════
// SYNC AGENT
// ═══════════════════════════════════════════════════════════

export class PmsBridgeSyncAgent {
  private supabase: SupabaseClient;
  private pms: OpenDentalConnector;
  private config: BridgeConfig;
  private state: SyncState;
  private offlineQueue: OfflineQueueEntry[] = [];
  private isRunning: boolean = false;
  private deviceId: string | null = null;

  private syncTimer: NodeJS.Timeout | null = null;
  private writeTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(config: BridgeConfig) {
    this.config = config;

    this.supabase = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    this.pms = new OpenDentalConnector(config.pmsConfig);

    this.state = this.loadState();
    this.offlineQueue = this.loadOfflineQueue();

    // Ensure data dir
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  // ── LIFECYCLE ─────────────────────────────────────────

  async start(): Promise<boolean> {
    logger.info('╔══════════════════════════════════════════╗');
    logger.info('║  OraDesk Bridge Agent — Starting         ║');
    logger.info(`║  Clinic: ${this.config.clinicId.substring(0, 8)}...          ║`);
    logger.info('╚══════════════════════════════════════════╝');

    // Step 1: Connect to PMS
    const pmsConnected = await this.pms.connect();
    if (!pmsConnected) {
      logger.error('FATAL: Cannot connect to OpenDental MySQL. Aborting.');
      return false;
    }

    // Step 2: Test PMS
    const testResult = await this.pms.testConnection();
    if (!testResult.success) {
      logger.error('FATAL: OpenDental test failed', { error: testResult.error });
      return false;
    }
    logger.info(`OpenDental connected. Version: ${testResult.version}, Patients: ${testResult.patientCount}`);

    // Step 3: Register/verify device
    const registered = await this.registerDevice(testResult.version || 'Unknown');
    if (!registered) {
      logger.error('FATAL: Device registration failed');
      return false;
    }

    // Step 4: Flush offline queue
    if (this.offlineQueue.length > 0) {
      logger.info(`Flushing ${this.offlineQueue.length} offline queue entries...`);
      await this.flushOfflineQueue();
    }

    // Step 5: Start sync loops
    this.isRunning = true;

    // READ sync: PMS → Cloud (every 30 sec)
    this.syncTimer = setInterval(() => this.runReadSync(), this.config.syncIntervalMs);

    // WRITE sync: Cloud → PMS (every 5 sec)
    this.writeTimer = setInterval(() => this.processWriteQueue(), this.config.writeQueuePollMs);

    // Heartbeat (every 60 sec)
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.config.heartbeatIntervalMs);

    // Initial sync
    await this.runReadSync();
    await this.processWriteQueue();
    await this.sendHeartbeat();

    logger.info('Bridge Agent fully operational');
    return true;
  }

  async stop(): Promise<void> {
    logger.info('Bridge Agent shutting down gracefully...');
    this.isRunning = false;

    if (this.syncTimer) clearInterval(this.syncTimer);
    if (this.writeTimer) clearInterval(this.writeTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    this.saveState();
    this.saveOfflineQueue();

    await this.pms.disconnect();
    logger.info('Bridge Agent stopped.');
  }

  // ── DEVICE REGISTRATION ───────────────────────────────

  private async registerDevice(pmsVersion: string): Promise<boolean> {
    try {
      const fingerprint = this.getDeviceFingerprint();
      const tokenHash = crypto.createHash('sha256').update(this.config.deviceToken).digest('hex');

      const { data, error } = await this.supabase
        .from('bridge_devices')
        .upsert({
          clinic_id: this.config.clinicId,
          device_name: `OraDesk Bridge — ${require('os').hostname()}`,
          device_fingerprint: fingerprint,
          agent_version: '1.0.0',
          pms_provider: 'opendental',
          pms_version: pmsVersion,
          pms_db_host: this.config.pmsConfig.host,
          pms_db_port: this.config.pmsConfig.port,
          device_token_hash: tokenHash,
          status: 'active',
          last_heartbeat_at: new Date().toISOString(),
        }, {
          onConflict: 'clinic_id',
        })
        .select('id')
        .single();

      if (error) {
        logger.error('Device registration failed', { error: error.message });
        return false;
      }

      this.deviceId = data.id;
      logger.info('Device registered', { deviceId: this.deviceId });
      return true;
    } catch (error) {
      logger.error('Device registration error', { error: (error as Error).message });
      return false;
    }
  }

  private getDeviceFingerprint(): string {
    const os = require('os');
    const raw = `${os.hostname()}:${os.platform()}:${os.arch()}:${os.cpus()[0]?.model || ''}`;
    return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 32);
  }

  // ── HEARTBEAT ─────────────────────────────────────────

  private async sendHeartbeat(): Promise<void> {
    if (!this.deviceId) return;

    try {
      await this.supabase
        .from('bridge_devices')
        .update({
          last_heartbeat_at: new Date().toISOString(),
          status: 'active',
          total_records_synced: this.state.totalSynced,
          total_writes_executed: this.state.totalWrites,
        })
        .eq('id', this.deviceId);
    } catch (error) {
      logger.warn('Heartbeat failed (non-critical)', { error: (error as Error).message });
    }
  }

  // ═══════════════════════════════════════════════════════
  // READ SYNC: PMS → Cloud
  // ═══════════════════════════════════════════════════════

  private async runReadSync(): Promise<void> {
    if (!this.isRunning) return;

    const startedAt = Date.now();
    let patientsProcessed = 0;
    let appointmentsProcessed = 0;
    let treatmentPlansProcessed = 0;
    let errors = 0;

    try {
      // ── 1. Sync Patients ──
      const patients = await this.pms.getPatientsSince(this.state.lastPatientSync);
      for (const patient of patients) {
        const ok = await this.syncPatientToCloud(patient);
        if (ok) patientsProcessed++;
        else errors++;
      }
      if (patients.length > 0) {
        this.state.lastPatientSync = new Date().toISOString();
      }

      // ── 2. Sync Appointments ──
      const appointments = await this.pms.getAppointmentsSince(this.state.lastAppointmentSync);
      for (const appt of appointments) {
        const ok = await this.syncAppointmentToCloud(appt);
        if (ok) appointmentsProcessed++;
        else errors++;
      }
      if (appointments.length > 0) {
        this.state.lastAppointmentSync = new Date().toISOString();
      }

      // ── 3. Sync Treatment Plans ──
      const plans = await this.pms.getTreatmentPlansSince(this.state.lastTreatmentSync);
      for (const plan of plans) {
        const ok = await this.syncTreatmentPlanToCloud(plan);
        if (ok) treatmentPlansProcessed++;
        else errors++;
      }
      if (plans.length > 0) {
        this.state.lastTreatmentSync = new Date().toISOString();
      }

      const total = patientsProcessed + appointmentsProcessed + treatmentPlansProcessed;
      this.state.totalSynced += total;

      if (total > 0) {
        logger.info(`Read sync complete`, {
          patients: patientsProcessed,
          appointments: appointmentsProcessed,
          treatmentPlans: treatmentPlansProcessed,
          errors,
          durationMs: Date.now() - startedAt,
        });
      }

      // Audit log
      if (total > 0 || errors > 0) {
        await this.writeAuditLog({
          direction: 'pms_to_cloud',
          entity_type: 'appointment',
          operation: 'read_batch',
          record_count: total,
          status: errors === 0 ? 'success' : 'partial',
          error_message: errors > 0 ? `${errors} records failed` : undefined,
          duration_ms: Date.now() - startedAt,
          payload_summary: { patients: patientsProcessed, appointments: appointmentsProcessed, treatmentPlans: treatmentPlansProcessed },
        });
      }

      this.saveState();
    } catch (error) {
      logger.error('Read sync failed', { error: (error as Error).message });

      await this.writeAuditLog({
        direction: 'pms_to_cloud',
        entity_type: 'appointment',
        operation: 'read_batch',
        record_count: 0,
        status: 'failed',
        error_message: (error as Error).message,
        duration_ms: Date.now() - startedAt,
      });
    }
  }

  // ── Individual Record Sync ────────────────────────────

  private async syncPatientToCloud(patient: PmsPatient): Promise<boolean> {
    try {
      // Check if mapping exists
      const { data: mapping } = await this.supabase
        .from('pms_entity_map')
        .select('oradesk_id, pms_checksum')
        .eq('clinic_id', this.config.clinicId)
        .eq('entity_type', 'patient')
        .eq('pms_id', patient.pms_id)
        .single();

      if (mapping) {
        // Check if changed (checksum comparison)
        if (mapping.pms_checksum === patient.checksum) {
          return true; // No change, skip
        }

        // Update existing patient
        await this.supabase
          .from('patients')
          .update({
            first_name: patient.first_name,
            last_name: patient.last_name,
            phone: patient.phone,
            email: patient.email,
          })
          .eq('id', mapping.oradesk_id);

        // Update checksum
        await this.supabase
          .from('pms_entity_map')
          .update({
            pms_checksum: patient.checksum,
            last_synced_at: new Date().toISOString(),
            sync_version: (mapping as any).sync_version + 1,
          })
          .eq('clinic_id', this.config.clinicId)
          .eq('entity_type', 'patient')
          .eq('pms_id', patient.pms_id);
      } else {
        // Check by phone match first
        const { data: existingByPhone } = await this.supabase
          .from('patients')
          .select('id')
          .eq('clinic_id', this.config.clinicId)
          .eq('phone', patient.phone)
          .single();

        let oradeskId: string;

        if (existingByPhone) {
          oradeskId = existingByPhone.id;
          await this.supabase
            .from('patients')
            .update({
              first_name: patient.first_name,
              last_name: patient.last_name,
              email: patient.email,
            })
            .eq('id', oradeskId);
        } else {
          // Create new patient
          const { data: newPatient, error } = await this.supabase
            .from('patients')
            .insert({
              clinic_id: this.config.clinicId,
              first_name: patient.first_name,
              last_name: patient.last_name,
              phone: patient.phone,
              email: patient.email,
            })
            .select('id')
            .single();

          if (error) throw error;
          oradeskId = newPatient.id;
        }

        // Create mapping
        await this.supabase
          .from('pms_entity_map')
          .insert({
            clinic_id: this.config.clinicId,
            device_id: this.deviceId,
            entity_type: 'patient',
            pms_id: patient.pms_id,
            oradesk_id: oradeskId,
            pms_checksum: patient.checksum,
          });
      }

      return true;
    } catch (error) {
      logger.error('Patient sync failed', { pms_id_hash: hashId(patient.pms_id) });
      this.addToOfflineQueue('patient', patient);
      return false;
    }
  }

  private async syncAppointmentToCloud(appt: PmsAppointment): Promise<boolean> {
    try {
      // Resolve patient mapping first
      const { data: patientMap } = await this.supabase
        .from('pms_entity_map')
        .select('oradesk_id')
        .eq('clinic_id', this.config.clinicId)
        .eq('entity_type', 'patient')
        .eq('pms_id', appt.patient_pms_id)
        .single();

      if (!patientMap) {
        // Patient not yet synced — skip this appointment, will catch next cycle
        return true;
      }

      const { data: mapping } = await this.supabase
        .from('pms_entity_map')
        .select('oradesk_id, pms_checksum')
        .eq('clinic_id', this.config.clinicId)
        .eq('entity_type', 'appointment')
        .eq('pms_id', appt.pms_id)
        .single();

      const appointmentData = {
        clinic_id: this.config.clinicId,
        patient_id: patientMap.oradesk_id,
        scheduled_at: appt.scheduled_at,
        duration_minutes: appt.duration_minutes,
        procedure_name: appt.procedure_name,
        status: appt.status,
        notes: appt.note,
        ai_managed: false,
      };

      if (mapping) {
        if (mapping.pms_checksum === appt.checksum) return true;

        await this.supabase
          .from('appointments')
          .update(appointmentData)
          .eq('id', mapping.oradesk_id);

        await this.supabase
          .from('pms_entity_map')
          .update({
            pms_checksum: appt.checksum,
            last_synced_at: new Date().toISOString(),
          })
          .eq('clinic_id', this.config.clinicId)
          .eq('entity_type', 'appointment')
          .eq('pms_id', appt.pms_id);
      } else {
        const { data: newAppt, error } = await this.supabase
          .from('appointments')
          .insert(appointmentData)
          .select('id')
          .single();

        if (error) throw error;

        await this.supabase
          .from('pms_entity_map')
          .insert({
            clinic_id: this.config.clinicId,
            device_id: this.deviceId,
            entity_type: 'appointment',
            pms_id: appt.pms_id,
            oradesk_id: newAppt.id,
            pms_checksum: appt.checksum,
          });
      }

      return true;
    } catch (error) {
      logger.error('Appointment sync failed', { pms_id_hash: hashId(appt.pms_id) });
      this.addToOfflineQueue('appointment', appt);
      return false;
    }
  }

  private async syncTreatmentPlanToCloud(plan: PmsTreatmentPlan): Promise<boolean> {
    // Treatment plans are stored as metadata on the patient in the cloud
    // For now, log and skip — full implementation in Phase 2
    try {
      const { data: patientMap } = await this.supabase
        .from('pms_entity_map')
        .select('oradesk_id')
        .eq('clinic_id', this.config.clinicId)
        .eq('entity_type', 'patient')
        .eq('pms_id', plan.patient_pms_id)
        .single();

      if (!patientMap) return true;

      // Store mapping for future use
      await this.supabase
        .from('pms_entity_map')
        .upsert({
          clinic_id: this.config.clinicId,
          device_id: this.deviceId,
          entity_type: 'treatment_plan',
          pms_id: plan.pms_id,
          oradesk_id: patientMap.oradesk_id, // linked to patient
          pms_checksum: plan.checksum,
          last_synced_at: new Date().toISOString(),
        }, {
          onConflict: 'clinic_id,entity_type,pms_id',
        });

      return true;
    } catch (error) {
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════
  // WRITE SYNC: Cloud → PMS
  // ═══════════════════════════════════════════════════════

  private async processWriteQueue(): Promise<void> {
    if (!this.isRunning || !this.deviceId) return;

    try {
      // Poll for pending writes
      const { data: writes, error } = await this.supabase
        .from('pms_write_queue')
        .select('*')
        .eq('clinic_id', this.config.clinicId)
        .in('status', ['pending', 'claimed'])
        .order('created_at', { ascending: true })
        .limit(5);

      if (error || !writes || writes.length === 0) return;

      for (const write of writes) {
        await this.executeWrite(write);
      }
    } catch (error) {
      logger.error('Write queue processing failed', { error: (error as Error).message });
    }
  }

  private async executeWrite(write: any): Promise<void> {
    const startedAt = Date.now();

    // Claim the write
    await this.supabase
      .from('pms_write_queue')
      .update({ status: 'executing', claimed_at: new Date().toISOString() })
      .eq('id', write.id);

    try {
      let result: { success: boolean; pms_id?: string; error?: string };

      switch (write.operation) {
        case 'create_appointment':
          // Resolve patient PMS ID from mapping
          const { data: patientMap } = await this.supabase
            .from('pms_entity_map')
            .select('pms_id')
            .eq('oradesk_id', write.payload.patient_id)
            .eq('entity_type', 'patient')
            .single();

          if (!patientMap) {
            result = { success: false, error: 'Patient not found in PMS mapping' };
          } else {
            result = await this.pms.createAppointment({
              patientPmsId: patientMap.pms_id,
              scheduledAt: new Date(write.payload.scheduled_at),
              durationMinutes: write.payload.duration_minutes || 30,
              procedureName: write.payload.procedure_name || 'General',
              note: write.payload.notes || 'Created by OraDesk AI',
            });

            // If successful, create entity mapping
            if (result.success && result.pms_id && write.oradesk_id) {
              await this.supabase
                .from('pms_entity_map')
                .upsert({
                  clinic_id: this.config.clinicId,
                  device_id: this.deviceId,
                  entity_type: 'appointment',
                  pms_id: result.pms_id,
                  oradesk_id: write.oradesk_id,
                  pms_checksum: '',
                  last_synced_at: new Date().toISOString(),
                }, {
                  onConflict: 'clinic_id,entity_type,pms_id',
                });
            }
          }
          break;

        case 'update_appointment_status':
          if (!write.pms_id) {
            // Lookup PMS ID from mapping
            const { data: aptMap } = await this.supabase
              .from('pms_entity_map')
              .select('pms_id')
              .eq('oradesk_id', write.oradesk_id)
              .eq('entity_type', 'appointment')
              .single();

            if (!aptMap) {
              result = { success: false, error: 'Appointment not found in PMS mapping' };
              break;
            }
            write.pms_id = aptMap.pms_id;
          }

          result = await this.pms.updateAppointmentStatus(
            write.pms_id,
            write.payload.status,
          );
          break;

        case 'cancel_appointment':
          if (!write.pms_id) {
            const { data: cancelMap } = await this.supabase
              .from('pms_entity_map')
              .select('pms_id')
              .eq('oradesk_id', write.oradesk_id)
              .eq('entity_type', 'appointment')
              .single();

            write.pms_id = cancelMap?.pms_id;
          }

          result = write.pms_id
            ? await this.pms.updateAppointmentStatus(write.pms_id, 'cancelled')
            : { success: false, error: 'No PMS mapping' };
          break;

        default:
          result = { success: false, error: `Unknown operation: ${write.operation}` };
      }

      // Update write queue entry
      await this.supabase
        .from('pms_write_queue')
        .update({
          status: result.success ? 'completed' : 'failed',
          executed_at: new Date().toISOString(),
          error_message: result.error || null,
          result: result.success ? { pms_id: result.pms_id || write.pms_id } : null,
          retry_count: result.success ? write.retry_count : write.retry_count + 1,
          conflict_detected: result.error?.includes('conflict') || false,
        })
        .eq('id', write.id);

      // Re-queue failed writes that haven't exceeded max retries
      if (!result.success && write.retry_count < write.max_retries) {
        await this.supabase
          .from('pms_write_queue')
          .update({ status: 'pending' })
          .eq('id', write.id);
      }

      if (result.success) this.state.totalWrites++;

      // Audit log
      await this.writeAuditLog({
        direction: 'cloud_to_pms',
        entity_type: write.entity_type,
        operation: write.operation,
        record_count: 1,
        status: result.success ? 'success' : 'failed',
        error_message: result.error,
        duration_ms: Date.now() - startedAt,
        pms_id_hash: write.pms_id ? hashId(write.pms_id) : undefined,
        oradesk_id: write.oradesk_id,
      });

    } catch (error) {
      await this.supabase
        .from('pms_write_queue')
        .update({
          status: 'failed',
          error_message: (error as Error).message,
          retry_count: write.retry_count + 1,
        })
        .eq('id', write.id);
    }
  }

  // ── OFFLINE QUEUE ─────────────────────────────────────

  private addToOfflineQueue(type: string, data: any): void {
    this.offlineQueue.push({
      type: type as any,
      data,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    });
    this.saveOfflineQueue();
  }

  private async flushOfflineQueue(): Promise<void> {
    const failed: OfflineQueueEntry[] = [];

    for (const entry of this.offlineQueue) {
      try {
        let ok = false;
        switch (entry.type) {
          case 'patient':
            ok = await this.syncPatientToCloud(entry.data);
            break;
          case 'appointment':
            ok = await this.syncAppointmentToCloud(entry.data);
            break;
          case 'treatment_plan':
            ok = await this.syncTreatmentPlanToCloud(entry.data);
            break;
        }
        if (!ok) {
          entry.retryCount++;
          if (entry.retryCount < 5) failed.push(entry);
        }
      } catch {
        entry.retryCount++;
        if (entry.retryCount < 5) failed.push(entry);
      }
    }

    this.offlineQueue = failed;
    this.saveOfflineQueue();
    logger.info(`Offline queue flush: ${this.offlineQueue.length} remaining`);
  }

  // ── AUDIT ─────────────────────────────────────────────

  private async writeAuditLog(entry: {
    direction: string;
    entity_type: string;
    operation: string;
    record_count: number;
    status: string;
    error_message?: string;
    duration_ms: number;
    pms_id_hash?: string;
    oradesk_id?: string;
    payload_summary?: any;
  }): Promise<void> {
    try {
      await this.supabase
        .from('pms_bridge_audit_log')
        .insert({
          clinic_id: this.config.clinicId,
          device_id: this.deviceId,
          ...entry,
          agent_version: '1.0.0',
          completed_at: new Date().toISOString(),
        });
    } catch {
      // Non-critical — don't crash on audit log failures
    }
  }

  // ── ENCRYPTED STATE PERSISTENCE ───────────────────────

  private loadState(): SyncState {
    const defaults: SyncState = {
      lastPatientSync: '1970-01-01T00:00:00Z',
      lastAppointmentSync: '1970-01-01T00:00:00Z',
      lastTreatmentSync: '1970-01-01T00:00:00Z',
      lastWriteQueuePoll: '1970-01-01T00:00:00Z',
      totalSynced: 0,
      totalWrites: 0,
    };

    try {
      if (fs.existsSync(STATE_FILE)) {
        const encrypted = fs.readFileSync(STATE_FILE, 'utf-8');
        const decrypted = this.decrypt(encrypted);
        return { ...defaults, ...JSON.parse(decrypted) };
      }
    } catch (e) {
      logger.warn('Could not load state, starting fresh');
    }
    return defaults;
  }

  private saveState(): void {
    try {
      const json = JSON.stringify(this.state);
      const encrypted = this.encrypt(json);
      fs.writeFileSync(STATE_FILE, encrypted);
    } catch (e) {
      logger.warn('Could not save state');
    }
  }

  private loadOfflineQueue(): OfflineQueueEntry[] {
    try {
      if (fs.existsSync(OFFLINE_QUEUE_FILE)) {
        const encrypted = fs.readFileSync(OFFLINE_QUEUE_FILE, 'utf-8');
        const decrypted = this.decrypt(encrypted);
        return JSON.parse(decrypted);
      }
    } catch {
      // Ignore
    }
    return [];
  }

  private saveOfflineQueue(): void {
    try {
      const json = JSON.stringify(this.offlineQueue);
      const encrypted = this.encrypt(json);
      fs.writeFileSync(OFFLINE_QUEUE_FILE, encrypted);
    } catch {
      // Ignore
    }
  }

  // ── AES-256 Encryption ────────────────────────────────

  private encrypt(text: string): string {
    const key = crypto.scryptSync(this.config.cacheEncryptionKey, 'oradesk-bridge', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const key = crypto.scryptSync(this.config.cacheEncryptionKey, 'oradesk-bridge', 32);
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}

// ── Helper ──────────────────────────────────────────────

function hashId(id: string): string {
  return crypto.createHash('sha256').update(id).digest('hex').substring(0, 8);
}
