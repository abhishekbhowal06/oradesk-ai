import fs from 'fs';
import path from 'path';
import { logger } from './logger';

export interface LocalAppointment {
  id: string;
  patient_name: string;
  phone: string;
  start_time: string;
  procedure: string;
  status: string;
  last_updated: string;
}

export class DentrixMock {
  private dbPath: string;
  private data: { appointments: LocalAppointment[] };

  constructor() {
    this.dbPath = path.resolve(__dirname, '../data/dentrix_mock.json');
    this.data = { appointments: [] };
    this.init();
  }

  private init() {
    if (!fs.existsSync(path.dirname(this.dbPath))) {
      fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    }

    if (fs.existsSync(this.dbPath)) {
      try {
        const content = fs.readFileSync(this.dbPath, 'utf-8');
        this.data = JSON.parse(content);
      } catch (e) {
        logger.error('Failed to read mock DB', e);
      }
    } else {
      this.seed();
    }
  }

  private seed() {
    logger.info('Seeding Mock Dentrix DB (JSON)...');

    // Add some dummy appointments for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setHours(14, 0, 0, 0);

    // Add recall candidate (Overdue)
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);

    this.data.appointments = [
      {
        id: 'APT-001',
        patient_name: 'John Doe',
        phone: '+15550101',
        start_time: tomorrow.toISOString(),
        procedure: 'Cleaning',
        status: 'Scheduled',
        last_updated: new Date().toISOString(),
      },
      {
        id: 'APT-002',
        patient_name: 'Jane Smith',
        phone: '+15550102',
        start_time: dayAfter.toISOString(),
        procedure: 'Root Canal',
        status: 'Broken',
        last_updated: new Date().toISOString(),
      },
      {
        id: 'APT-OLD-1',
        patient_name: 'Recall Candidate',
        phone: '+15550199',
        start_time: lastYear.toISOString(), // Last visit
        procedure: 'Cleaning',
        status: 'Completed',
        last_updated: lastYear.toISOString(),
      },
    ];

    this.save();
  }

  private save() {
    fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
  }

  public getChangesSince(timestamp: string): LocalAppointment[] {
    return this.data.appointments.filter((a) => a.last_updated > timestamp);
  }

  public getAllFuture(): LocalAppointment[] {
    const now = new Date().toISOString();
    return this.data.appointments.filter((a) => a.start_time > now);
  }
}
