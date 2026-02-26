import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.1.3';

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);
const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY")!);

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
    }

    try {
        const { action, payload, clinicId } = await req.json();

        switch (action) {
            case "ANALYZE_INTENT_AND_ROUTE": {
                // Fetch specific rules for this clinic
                const { data: clinicSettings } = await supabase
                    .from("clinic_settings")
                    .select("safety_jsonb, deployment_jsonb")
                    .eq("clinic_id", clinicId)
                    .single();

                const safety = clinicSettings.safety_jsonb;

                // Perform LLM Verification via Gemini 3.1 Pro
                const prompt = `Analyze patient query: "${payload.transcript}".
          Safety constraints:
          1. Detect emergency keywords: ${safety.emergency_keywords.join(', ')}. If found, output {"escalate": true, "reason": "emergency"}.
          2. Rule: ${safety.no_diagnosis ? "You must NEVER provide medical diagnosis." : ""}. 
          3. Evaluate probability this requires a human. Output confidence 0-100.
          
          Respond strictly in JSON: { "escalate": boolean, "confidence": number, "reason": string, "response_text": string }
        `;

                const model = genAI.getGenerativeModel({ model: "gemini-pro" });
                const result = await model.generateContent(prompt);
                const analysis = JSON.parse(result.response.text());

                // Confidence-Based Routing Failsafe
                if (analysis.escalate || analysis.confidence < safety.escalation_threshold) {
                    // Escalate to human
                    await supabase.from('ai_sessions').update({
                        status: 'escalated', escalation_reason: analysis.reason
                    }).eq('id', payload.sessionId);

                    // Log interaction into audit
                    await supabase.from('audit_logs').insert({
                        clinic_id: clinicId, action: 'escalation_triggered', metadata: analysis
                    });

                    return new Response(JSON.stringify({
                        status: "ESCALATING",
                        voice_output: "Let me transfer you to our front desk for immediate assistance.",
                        trigger_sms_fallback: clinicSettings.deployment_jsonb.whatsapp_enabled
                    }), { headers: { "Content-Type": "application/json" } });
                }

                // Return Generated Text for ElevenLabs TTS
                return new Response(JSON.stringify({
                    status: "PROCEED_TO_TTS",
                    voice_output: analysis.response_text
                }), { headers: { "Content-Type": "application/json" } });
            }

            case "CRON_AGGREGATE_DAILY_METRICS": {
                // Nightly aggregation function for 5. Intelligence & Analytics tab
                // Executes counts across ai_sessions where status = 'completed', sums LLM tokens
                // Not implemented here for brevity, but runs via pg_cron natively in Supabase SQL.
                return new Response("OK");
            }

            default:
                return new Response("Action not supported", { status: 400 });
        }
    } catch (err: any) {
        // Top-Level Failsafe Fallback Logic
        return new Response(JSON.stringify({
            error: err.message,
            status: 'CRITICAL_FAILOVER',
            voice_fallback: "We are experiencing a temporary network issue. We will SMS you right away to complete your booking."
        }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
});
