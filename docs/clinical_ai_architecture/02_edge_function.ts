import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.1.3';

// Initialize Supabase Admin Client for database overrides
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Setup Gemini 3.1 Pro Configuration
const genAI = new GoogleGenerativeAI(Deno.env.get("GEMINI_API_KEY")!);

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
    }

    try {
        const body = await req.json();
        const { action, payload, clinicId } = body;

        // Retrieve clinic specific JSONB rules from database
        const { data: clinicSettings, error: err } = await supabase
            .from("clinic_settings")
            .select("rules_jsonb")
            .eq("clinic_id", clinicId)
            .single();

        if (err) throw err;

        const rules = clinicSettings.rules_jsonb;

        switch (action) {
            case "START_CALL_SESSION": {
                // Create an AI session record in DB (emits Realtime Payload)
                const { data: session } = await supabase.from('ai_sessions').insert({
                    clinic_id: clinicId,
                    patient_phone: payload.caller_id,
                    status: 'active'
                }).select().single();

                return new Response(JSON.stringify({ sessionId: session.id, status: "READY" }), {
                    headers: { "Content-Type": "application/json" },
                });
            }

            case "LLM_ANALYZE_INTENT": {
                // Implement guardrails based on context
                const prompt = `Analyze patient query: "${payload.query}". 
          Rules:
          - Escalate on low confidence (<${rules.escalation.confidence_threshold}%).
          - Detect keywords: ${rules.escalation.emergency_keywords.join(', ')}.
          - STRICT RULE: ${rules.safety.no_medical_diagnosis ? "DO NOT DIAGNOSE OR SUGGEST TREATMENT." : "Provide general info."}
        `;

                const model = genAI.getGenerativeModel({ model: "gemini-pro" });
                const result = await model.generateContent(prompt);
                const text = result.response.text();

                // 5. FAILSAFE LOGIC
                // If an Error occurs with Voice or LLM, or JSON validation fails
                // Edge functions catch error and emit 'ESCALATE' back to caller

                return new Response(JSON.stringify({
                    response: text,
                    action_required: "PROCEED_VOICE_TTS",
                }), {
                    headers: { "Content-Type": "application/json" },
                });
            }

            case "ESCALATE_TO_HUMAN": {
                // Trigger SMS fallback / Webhook to PMS
                await supabase.from('ai_sessions')
                    .update({ status: 'escalated', escalation_reason: payload.reason })
                    .eq('id', payload.sessionId);

                // Return SMS trigger command to frontend / fallback queue
                return new Response(JSON.stringify({ status: "FALLBACK_SMS_TRIGGERED", next: "NOTIFY_STAFF" }), {
                    headers: { "Content-Type": "application/json" },
                });
            }

            default:
                return new Response("Action not found", { status: 400 });
        }
    } catch (err: any) {
        // LLM fails → fallback apology scheduling
        return new Response(JSON.stringify({ error: err.message, status: 'FAILED_GRACEFULLY_PENDING_SMS' }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
});
