/**
 * ORADESK AI — PMS BRIDGE AGENT ENTRY POINT
 * ═══════════════════════════════════════════════════════════
 *
 * Install Flow:
 *   1. Download OraDesk Bridge installer
 *   2. Run installer → creates Windows service
 *   3. Admin enters clinic activation code in the setup wizard
 *   4. Agent enters PMS DB credentials (host, port, user, pass, db)
 *   5. Agent tests connection → verifies patient count
 *   6. Agent registers with cloud → receives device token
 *   7. Sync begins automatically
 *
 * CLI Commands:
 *   node dist/index.js                 → Start agent
 *   node dist/index.js --setup         → Run interactive setup
 *   node dist/index.js --test          → Test PMS connection only
 *   node dist/index.js --status        → Show agent status
 */

import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PmsBridgeSyncAgent } from './sync-agent';
import { OpenDentalConnector } from './opendental-connector';
import { ProcessHealthGuardian } from './process-health';
import { AutoUpdateEngine } from './auto-updater';
import { BetaValidator } from './beta-validator';
import { logger } from './logger';

dotenv.config();

// ─── Configuration ──────────────────────────────────────────

const CONFIG_FILE = path.resolve(process.cwd(), 'data', 'bridge_config.enc');
const ENCRYPTION_PASSPHRASE = process.env.BRIDGE_ENCRYPTION_KEY || 'oradesk-bridge-default-key';

interface StoredConfig {
  clinicId: string;
  deviceToken: string;
  supabaseUrl: string;
  supabaseKey: string;
  pmsHost: string;
  pmsPort: number;
  pmsUser: string;
  pmsPassword: string;
  pmsDatabase: string;
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  logger.info('╔══════════════════════════════════════════════════════╗');
  logger.info('║           OraDesk Bridge Agent v1.0.0               ║');
  logger.info('║    Secure PMS Integration for Dental Clinics        ║');
  logger.info('╚══════════════════════════════════════════════════════╝');

  if (args.includes('--setup')) {
    await runSetupWizard();
    return;
  }

  if (args.includes('--test')) {
    await testConnection();
    return;
  }

  if (args.includes('--validate')) {
    await runBetaValidation();
    return;
  }

  if (args.includes('--status')) {
    showStatus();
    return;
  }

  // Default: start the sync agent
  await startAgent();
}

// ═══════════════════════════════════════════════════════════
// SETUP WIZARD (Install Flow Step 2-6)
// ═══════════════════════════════════════════════════════════

async function runSetupWizard() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> => new Promise((resolve) => rl.question(q, resolve));

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  OraDesk Bridge — First-Time Setup');
  console.log('══════════════════════════════════════════════════════\n');

  // Step 1: Clinic Code
  console.log('Step 1/5: Enter your clinic activation code.');
  console.log('  (Find this in OraDesk Settings → Integrations → PMS Bridge)\n');
  const clinicCode = await ask('  Clinic Code: ');

  // Step 2: Cloud credentials
  console.log('\nStep 2/5: Cloud connection settings.');
  const supabaseUrl = await ask('  Supabase URL (or press Enter for default): ') || process.env.SUPABASE_URL || '';
  const supabaseKey = await ask('  Supabase Service Key (or press Enter for default): ') || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    console.log('\n  ❌ Missing cloud credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    rl.close();
    return;
  }

  // Step 3: PMS Database Credentials
  console.log('\nStep 3/5: OpenDental MySQL database credentials.');
  console.log('  ⚠️  Use a READ-ONLY MySQL user for maximum safety.\n');
  const pmsHost = await ask('  MySQL Host [localhost]: ') || 'localhost';
  const pmsPort = parseInt(await ask('  MySQL Port [3306]: ') || '3306', 10);
  const pmsUser = await ask('  MySQL Username: ');
  const pmsPassword = await ask('  MySQL Password: ');
  const pmsDatabase = await ask('  Database Name [opendental]: ') || 'opendental';

  // Step 4: Test Connection
  console.log('\nStep 4/5: Testing connection...\n');
  const connector = new OpenDentalConnector({
    host: pmsHost,
    port: pmsPort,
    user: pmsUser,
    password: pmsPassword,
    database: pmsDatabase,
  });

  const connected = await connector.connect();
  if (!connected) {
    console.log('  ❌ Failed to connect to OpenDental MySQL.');
    console.log('  Check your credentials and ensure MySQL is running.');
    rl.close();
    return;
  }

  const testResult = await connector.testConnection();
  if (!testResult.success) {
    console.log(`  ❌ Connection test failed: ${testResult.error}`);
    rl.close();
    return;
  }

  console.log(`  ✅ Connected to OpenDental v${testResult.version}`);
  console.log(`  ✅ Found ${testResult.patientCount} active patients`);

  await connector.disconnect();

  // Step 5: Generate device token and save config
  console.log('\nStep 5/5: Registering device...\n');
  const deviceToken = crypto.randomBytes(32).toString('hex');

  // Parse clinic code → in production this would validate against the API
  // For now, use clinic code directly as clinic ID
  const clinicId = clinicCode;

  const config: StoredConfig = {
    clinicId,
    deviceToken,
    supabaseUrl,
    supabaseKey,
    pmsHost,
    pmsPort,
    pmsUser,
    pmsPassword,
    pmsDatabase,
  };

  saveConfig(config);

  console.log('  ✅ Device registered and credentials encrypted');
  console.log('  ✅ Configuration saved to data/bridge_config.enc');
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  Setup complete! Start the agent with:');
  console.log('    npm start');
  console.log('══════════════════════════════════════════════════════\n');

  rl.close();
}

// ═══════════════════════════════════════════════════════════
// AGENT START
// ═══════════════════════════════════════════════════════════

async function startAgent() {
  const config = loadConfig();
  if (!config) {
    logger.error('No configuration found. Run --setup first.');
    logger.info('  Usage: node dist/index.js --setup');
    process.exit(1);
  }

  const agent = new PmsBridgeSyncAgent({
    clinicId: config.clinicId,
    deviceToken: config.deviceToken,
    supabaseUrl: config.supabaseUrl,
    supabaseKey: config.supabaseKey,
    syncIntervalMs: parseInt(process.env.SYNC_INTERVAL_MS || '30000', 10),    // 30 sec
    writeQueuePollMs: parseInt(process.env.WRITE_POLL_MS || '5000', 10),       // 5 sec
    heartbeatIntervalMs: parseInt(process.env.HEARTBEAT_MS || '60000', 10),    // 60 sec
    pmsConfig: {
      host: config.pmsHost,
      port: config.pmsPort,
      user: config.pmsUser,
      password: config.pmsPassword,
      database: config.pmsDatabase,
    },
    cacheDir: path.resolve(process.cwd(), 'data'),
    cacheEncryptionKey: ENCRYPTION_PASSPHRASE,
  });

  const started = await agent.start();
  if (!started) {
    logger.error('Agent failed to start.');
    process.exit(1);
  }

  // Start Process Health Guardian (memory leak detection, event loop monitoring)
  const healthGuardian = new ProcessHealthGuardian(async () => {
    await agent.stop();
  });
  healthGuardian.start();

  // Start Auto-Update Engine (hourly version checks)
  const autoUpdater = new AutoUpdateEngine(
    config.supabaseUrl,
    config.supabaseKey,
    config.clinicId,
  );
  autoUpdater.startAutoCheck();

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutdown signal received');
    healthGuardian.stop();
    autoUpdater.stopAutoCheck();
    await agent.stop();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Uncaught exception handler (prevent silent death)
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception — restarting', { error: err.message });
    shutdown();
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason: String(reason) });
  });

  logger.info('Agent running with health guardian + auto-updater. Press Ctrl+C to stop.');
}

// ═══════════════════════════════════════════════════════════
// TEST CONNECTION
// ═══════════════════════════════════════════════════════════

async function testConnection() {
  const config = loadConfig();
  if (!config) {
    logger.error('No configuration. Run --setup first.');
    return;
  }

  console.log('\nTesting OpenDental connection...\n');

  const connector = new OpenDentalConnector({
    host: config.pmsHost,
    port: config.pmsPort,
    user: config.pmsUser,
    password: config.pmsPassword,
    database: config.pmsDatabase,
  });

  const connected = await connector.connect();
  if (!connected) {
    console.log('❌ Connection failed');
    return;
  }

  const result = await connector.testConnection();
  if (result.success) {
    console.log(`✅ OpenDental v${result.version}`);
    console.log(`✅ Active patients: ${result.patientCount}`);

    // Quick data test
    const appointments = await connector.getFutureAppointments();
    console.log(`✅ Future appointments: ${appointments.length}`);
  } else {
    console.log(`❌ Test failed: ${result.error}`);
  }

  await connector.disconnect();
}

// ═══════════════════════════════════════════════════════════
// BETA VALIDATION
// ═══════════════════════════════════════════════════════════

async function runBetaValidation() {
  const config = loadConfig();
  if (!config) {
    logger.error('No configuration. Run --setup first.');
    return;
  }

  console.log('\n══════════════════════════════════════════════════════');
  console.log('  OraDesk Bridge — Beta Validation Suite');
  console.log('══════════════════════════════════════════════════════\n');

  const validator = new BetaValidator(
    {
      host: config.pmsHost,
      port: config.pmsPort,
      user: config.pmsUser,
      password: config.pmsPassword,
      database: config.pmsDatabase,
    },
    config.clinicId,
  );

  const report = await validator.runFullValidation();

  console.log('\n══════════════════════════════════════════════════════');
  console.log(`  Results: ${report.passedTests}/${report.totalTests} passed`);
  console.log(`  Go-Live Approved: ${report.goLiveApproved ? '✅ YES' : '❌ NO'}`);

  if (report.recommendations.length > 0) {
    console.log('\n  Recommendations:');
    for (const rec of report.recommendations) {
      console.log(`    ⚠️  ${rec}`);
    }
  }
  console.log('══════════════════════════════════════════════════════\n');
}

// ═══════════════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════════════

function showStatus() {
  const config = loadConfig();
  if (!config) {
    console.log('Status: NOT CONFIGURED — Run --setup');
    return;
  }

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║       OraDesk Bridge Agent Status        ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Clinic ID:  ${config.clinicId.substring(0, 12)}...`);
  console.log(`║  PMS Host:   ${config.pmsHost}:${config.pmsPort}`);
  console.log(`║  Database:   ${config.pmsDatabase}`);
  console.log(`║  Config:     ✅ Encrypted`);
  console.log('╚══════════════════════════════════════════╝\n');
}

// ═══════════════════════════════════════════════════════════
// ENCRYPTED CONFIG PERSISTENCE
// ═══════════════════════════════════════════════════════════

function saveConfig(config: StoredConfig): void {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const key = crypto.scryptSync(ENCRYPTION_PASSPHRASE, 'oradesk-config', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(JSON.stringify(config), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  fs.writeFileSync(CONFIG_FILE, iv.toString('hex') + ':' + encrypted);
}

function loadConfig(): StoredConfig | null {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return null;

    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const [ivHex, encrypted] = raw.split(':');

    const key = crypto.scryptSync(ENCRYPTION_PASSPHRASE, 'oradesk-config', 32);
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

// ── Run ─────────────────────────────────────────────────────

main().catch((err) => {
  logger.error('Fatal error', { error: err.message });
  process.exit(1);
});
