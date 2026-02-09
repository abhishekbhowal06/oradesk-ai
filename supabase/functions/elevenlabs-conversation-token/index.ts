import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { verifyAuthToken, verifyClinicMembership } from '../_shared/auth.ts';
import { ElevenLabsTokenRequestSchema, validateInput } from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Require JWT authentication
    const { userId } = await verifyAuthToken(req);

    // Parse and validate request body
    const rawBody = await req.json();
    const { clinicId } = validateInput(ElevenLabsTokenRequestSchema, rawBody);

    // Verify user has access to this clinic
    await verifyClinicMembership(userId, clinicId, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch clinic settings to customize the agent
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('name, ai_settings')
      .eq('id', clinicId)
      .single();

    if (clinicError) {
      console.error('[elevenlabs-token] Clinic fetch error:', clinicError);
    }

    // Extract AI settings
    const aiSettings = (clinic?.ai_settings || {}) as Record<string, unknown>;
    const systemPrompt = (aiSettings.system_prompt as string) || `You are a friendly and professional dental clinic receptionist for ${clinic?.name || 'our clinic'}. Help patients with appointment scheduling, confirmations, and general inquiries. Be polite, patient, and helpful.`;
    const voiceId = (aiSettings.ai_voice_id as string) || 'EXAVITQu4vr4xnSDxMaL'; // Sarah default
    const language = (aiSettings.ai_language as string) || 'en';
    const firstMessage = (aiSettings.first_message as string) || `Hello! Thank you for calling ${clinic?.name || 'our clinic'}. How can I help you today?`;

    // Create a signed URL for WebSocket connection
    const tokenResponse = await fetch(
      'https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=default',
      {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[elevenlabs-token] Token fetch failed:', tokenResponse.status, errorText);
      
      // Fallback: Return agent config that can be used with public agent
      return new Response(
        JSON.stringify({
          useAgentId: true,
          agentConfig: {
            voiceId,
            language,
            firstMessage,
            systemPrompt,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { signed_url } = await tokenResponse.json();

    return new Response(
      JSON.stringify({
        token: signed_url,
        agentConfig: {
          voiceId,
          language,
          firstMessage,
          systemPrompt,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    console.error('[elevenlabs-token] Error:', error);
    
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Unauthorized') || message.includes('Not authorized') ? 401 : 500;
    
    return new Response(
      JSON.stringify({ error: message }),
      {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
