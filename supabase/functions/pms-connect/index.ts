// ============================================================================
// DENTACORE OS - PHASE 6: PMS CONNECTOR STUB
// Function: pms-connect
// Purpose: Simulate connection to OpenDental/Dentrix for verification
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { clinic_id, pms_software, api_key } = await req.json();

    if (!clinic_id || !pms_software) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    console.log(`Connecting clinic ${clinic_id} to ${pms_software}...`);

    // Simulate latency
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Simulate connection logic (always succeeds for stub)
    let syncStatus = 'ok';
    let lastError = null;

    if (api_key === 'fail') {
      syncStatus = 'error';
      lastError = 'Invalid API Credentials';
    }

    // Upsert PMS Sync State
    const { data, error } = await supabase
      .from('pms_sync_state')
      .upsert(
        {
          clinic_id,
          pms_software,
          connection_type: 'cloud_bridge',
          sync_status: syncStatus,
          last_sync_at: new Date().toISOString(),
          last_error: lastError,
          patients_synced: syncStatus === 'ok' ? 1250 : 0,
        },
        { onConflict: 'clinic_id' },
      )
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({
        message: syncStatus === 'ok' ? 'Connected successfully' : 'Connection failed',
        sync_state: data,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in pms-connect:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
