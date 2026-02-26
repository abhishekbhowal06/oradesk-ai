import React from 'react';
import { Database, Phone, Calendar as CalendarIcon, CreditCard, Megaphone, Smartphone, PieChart } from 'lucide-react';
import { IntegrationCardProps } from './IntegrationCard';

export const INTEGRATION_DATA: IntegrationCardProps[] = [
    // Clinic Systems
    {
        id: 'od',
        name: 'Open Dental',
        description: 'Primary clinical record linkage. Direct integration via secure cloud bridge.',
        status: 'connected',
        category: 'clinic',
        icon: <Database className="w-5 h-5 text-[#0d5e5e]" />,
        dataFlow: {
            inbound: ['Patient Records', 'Appointment Status', 'Provider IDs'],
            outbound: ['New Appointments', 'Demographic Updates', 'Notes']
        }
    },
    {
        id: 'practo',
        name: 'Practo Matrix',
        description: 'Link your Practo web portal to funnel online bookings directly to OraDesk.',
        status: 'error',
        category: 'clinic',
        icon: <Database className="w-5 h-5 text-slate-400" />,
        dataFlow: {
            inbound: ['Online Bookings', 'Patient Intake Forms'],
            outbound: ['Schedule Availability']
        }
    },
    {
        id: 'generic-emr',
        name: 'Generic EMR (HL7/FHIR)',
        description: 'Custom API endpoints for legacy on-premise clinical systems.',
        status: 'disconnected',
        category: 'clinic',
        icon: <Database className="w-5 h-5 text-slate-400" />,
        dataFlow: {
            inbound: ['Custom Patient Schema', 'Appointments'],
            outbound: ['Webhook Events', 'Raw Export Data']
        }
    },

    // Calls & WhatsApp
    {
        id: 'twilio',
        name: 'Twilio Voice',
        description: 'Enterprise SIP trunking and VoIP communication routing.',
        status: 'connected',
        category: 'calls',
        icon: <Phone className="w-5 h-5 text-[#0d5e5e]" />,
        dataFlow: {
            inbound: ['Inbound Call Audio', 'Caller ID', 'Call Metadata'],
            outbound: ['Outbound Audio Streaming', 'Routing Commands']
        }
    },
    {
        id: 'vapi',
        name: 'Vapi Voice AI',
        description: 'Ultra-low latency conversational AI voice pipeline.',
        status: 'connected',
        category: 'calls',
        icon: <Phone className="w-5 h-5 text-[#0d5e5e]" />,
        dataFlow: {
            inbound: ['Speech-to-Text Transcripts', 'Sentiment Analysis'],
            outbound: ['Text-to-Speech Triggers', 'Call Transfers']
        }
    },
    {
        id: 'whatsapp',
        name: 'WhatsApp Business',
        description: 'Direct Meta cloud API integration for secure messaging.',
        status: 'disconnected',
        category: 'calls',
        icon: <Smartphone className="w-5 h-5 text-slate-400" />,
        dataFlow: {
            inbound: ['Patient Messages', 'Media Attachments'],
            outbound: ['Appointment Reminders', 'Automated Replies']
        }
    },

    // Calendars
    {
        id: 'gcal',
        name: 'Google Calendar',
        description: 'Sync personal provider schedules to block out OraDesk availability.',
        status: 'disconnected',
        category: 'calendars',
        icon: <CalendarIcon className="w-5 h-5 text-slate-400" />,
        dataFlow: {
            inbound: ['Busy/Free Blocks', 'Personal Events'],
            outbound: ['Confirmed Clinical Bookings']
        }
    },

    // Billing
    {
        id: 'stripe',
        name: 'Stripe Payments',
        description: 'Process consultation fees and patient deposits securely.',
        status: 'disconnected',
        category: 'billing',
        icon: <CreditCard className="w-5 h-5 text-slate-400" />,
        dataFlow: {
            inbound: ['Payment Status', 'Refund Confirmations'],
            outbound: ['Charge Requests', 'Invoice Generation']
        }
    },

    // Marketing
    {
        id: 'hubspot',
        name: 'HubSpot CRM',
        description: 'Sync patient leads and track marketing acquisition cost.',
        status: 'disconnected',
        category: 'marketing',
        icon: <Megaphone className="w-5 h-5 text-slate-400" />,
        dataFlow: {
            inbound: ['Marketing Lead Data', 'Campaign Status'],
            outbound: ['Converted Appointments', 'Call Transcripts']
        }
    },
    {
        id: 'analytics',
        name: 'Google Analytics',
        description: 'Track widget conversions and landing page performance.',
        status: 'disconnected',
        category: 'marketing',
        icon: <PieChart className="w-5 h-5 text-slate-400" />,
        dataFlow: {
            inbound: ['Traffic Sources', 'User Sessions'],
            outbound: ['Booking Conversion Events']
        }
    }
];
