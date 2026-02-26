// ============================================================================
// DENTACORE OS - PHASE 2: CAMPAIGN MANAGER
// Function: campaign-manager
// Purpose: Create outreach campaigns and generate execution jobs
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CampaignRequest {
  clinic_id: string;
  name: string;
  description?: string;
  candidate_ids: string[]; // List of recall_candidate IDs to include
  outreach_channel: 'voice' | 'sms' | 'email';
  scheduled_start_at?: string; // ISO string
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clinic_id, name, description, candidate_ids, outreach_channel, scheduled_start_at } =
      (await req.json()) as CampaignRequest;

    // Validation
    if (!clinic_id || !name || !candidate_ids || candidate_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(
      `Creating campaign '${name}' for clinic ${clinic_id} with ${candidate_ids.length} candidates...`,
    );

    // 1. Create Campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        clinic_id,
        name,
        description,
        outreach_channel: [outreach_channel], // Array column
        status: 'draft', // Created as draft initially
        scheduled_start_at: scheduled_start_at || new Date().toISOString(),
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    const campaignId = campaign.id;

    // 2. Fetch Candidate Details (need patient_id)
    const { data: candidates, error: candidatesError } = await supabase
      .from('recall_candidates')
      .select('id, patient_id')
      .in('id', candidate_ids);

    if (candidatesError) throw candidatesError;

    // Map candidates to job objects
    const jobsData = candidates.map((c) => ({
      clinic_id,
      campaign_id: campaignId,
      patient_id: c.patient_id,
      recall_candidate_id: c.id,
      status: 'pending',
      channel: outreach_channel,
      scheduled_for: scheduled_start_at || new Date().toISOString(),
      attempt_count: 0,
    }));

    // 3. Create Outreach Jobs
    if (jobsData.length > 0) {
      const { error: jobsError } = await supabase.from('outreach_jobs').insert(jobsData);

      if (jobsError) throw jobsError;
    }

    // 4. Update Candidate Status -> 'in_campaign'
    const { error: updateError } = await supabase
      .from('recall_candidates')
      .update({ status: 'in_campaign' })
      .in('id', candidate_ids);

    if (updateError) throw updateError;

    console.log(`Campaign ${campaignId} created successfully with ${jobsData.length} jobs.`);

    return new Response(
      JSON.stringify({
        message: 'Campaign created successfully',
        campaign_id: campaignId,
        jobs_created: jobsData.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in campaign-manager:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
