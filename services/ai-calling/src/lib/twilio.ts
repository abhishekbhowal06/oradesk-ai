import { Twilio } from 'twilio';
import dotenv from 'dotenv';
dotenv.config();

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

if (!ACCOUNT_SID || !AUTH_TOKEN) {
    console.warn("Missing Twilio credentials in env (startup)");
}

export const twilioClient = new Twilio(ACCOUNT_SID, AUTH_TOKEN);

export const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
