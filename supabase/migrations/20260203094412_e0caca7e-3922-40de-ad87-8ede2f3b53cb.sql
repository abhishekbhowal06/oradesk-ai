-- Add Twilio phone number column to clinics table for inbound call routing
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS twilio_phone_number TEXT;

-- Add comment for documentation
COMMENT ON COLUMN clinics.twilio_phone_number IS 'Twilio phone number assigned to this clinic for inbound calls';