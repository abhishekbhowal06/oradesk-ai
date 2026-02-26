import { CareLoopEngine } from '../../src/lib/engines/care-loop';
import { supabase } from '../../src/lib/supabase';

// Mock Supabase
jest.mock('../../src/lib/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    lte: jest.fn(() => ({
                        limit: jest.fn().mockResolvedValue({
                            data: [
                                {
                                    id: 'test-loop-1',
                                    campaign_type: 'confirmation',
                                    attempt_number: 0,
                                    max_attempts: 3,
                                    patients: { phone: '+1234567890', first_name: 'John' },
                                    clinics: { name: 'Test Clinic' }
                                }
                            ],
                            error: null
                        })
                    }))
                }))
            })),
            update: jest.fn().mockReturnThis(),
            insert: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { id: 'test-call-id' } })
        }))
    }
}));

// Mock Logger
jest.mock('../../src/lib/logging/structured-logger', () => ({
    logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

// Mock Twilio
jest.mock('../../src/lib/twilio', () => ({
    twilioClient: {
        calls: {
            create: jest.fn().mockResolvedValue({ sid: 'test-sid' })
        }
    },
    TWILIO_PHONE_NUMBER: '+15551234567'
}));

// Mock SMS
jest.mock('../../src/lib/twilio-sms', () => ({
    sendSMS: jest.fn().mockResolvedValue(undefined)
}));

describe('CareLoopEngine', () => {
    let engine: CareLoopEngine;

    beforeEach(() => {
        engine = new CareLoopEngine();
        jest.clearAllMocks();
    });

    test('should process due loops and execute confirmation strategy', async () => {
        const { sendSMS } = require('../../src/lib/twilio-sms');

        await engine.processDueLoops();

        // 1. Should fetch pending items
        expect(supabase.from).toHaveBeenCalledWith('follow_up_schedules');

        // 2. Initial state (attempt 0) for confirmation -> Should send SMS
        expect(sendSMS).toHaveBeenCalled();
        expect(sendSMS).toHaveBeenCalledWith(expect.objectContaining({
            to: '+1234567890',
            body: expect.stringContaining('prompt confirmation')
        }));

        // 3. Should update schedule
        // verifying indirectly via logger or ensuring no error thrown
    });
});
