// ============================================================================
// DENTACORE OS - PHASE 5: LEAD CONVERSION & ATTRIBUTION
// Function: lead-conversion
// Purpose: Convert Lead to Appointment and Track Revenue Attribution
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversionRequest {
  lead_id: string;
  notes?: string;
  // In a real app, we'd pass appointment details here
  appointment_date?: string;
  procedure_name?: string;
  estimated_value?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { lead_id, notes, estimated_value } = (await req.json()) as ConversionRequest;

    if (!lead_id) {
      return new Response(JSON.stringify({ error: 'Missing lead_id' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 1. Fetch Lead Details
    const { data: lead, error: leadError } = await supabase
      .from('lead_queue')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) throw new Error('Lead not found');

    // 2. Create Appointment (Stub)
    // Normally this comes from a booking UI or PMS sync
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .insert({
        clinic_id: lead.clinic_id,
        patient_id: lead.patient_id,
        scheduled_at: new Date(Date.now() + 86400000 * 2).toISOString(), // +2 days
        procedure_name: 'Consultation (Recall)',
        status: 'scheduled',
        notes: `Booked via AI Lead Conversion. ${notes || ''}`,
      })
      .select()
      .single();

    if (apptError) throw apptError;

    // 3. Update Lead Status
    const { error: updateLeadError } = await supabase
      .from('lead_queue')
      .update({
        status: 'booked',
        resulting_appointment_id: appointment.id,
        actioned_at: new Date().toISOString(),
        outcome_notes: 'Converted to appointment',
      })
      .eq('id', lead_id);

    if (updateLeadError) throw updateLeadError;

    // 4. Create Revenue Attribution Record
    const { error: attrError } = await supabase.from('revenue_attribution').insert({
      clinic_id: lead.clinic_id,
      appointment_id: appointment.id,
      patient_id: lead.patient_id,
      source_type: 'ai_outreach',
      campaign_id: lead.source_campaign_id,
      lead_id: lead.id,
      status: 'pending',
      estimated_value: estimated_value || 150.0, // Default value
    }); // <-- Fixed missing chaining and potential syntax issue

    if (attrError) throw attrError;

    return new Response(
      JSON.stringify({
        message: 'Lead converted successfully',
        appointment_id: appointment.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in lead-conversion:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
