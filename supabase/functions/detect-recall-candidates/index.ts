// ============================================================================
// DENTACORE OS - PHASE 2: RECALL DETECTION ENGINE
// Function: detect-recall-candidates
// Purpose: Daily job to analyze patient base and identify reactivation targets
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Types
interface Patient {
  id: string;
  clinic_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  last_visit: string;
  status: string;
}

interface RecallCandidate {
  clinic_id: string;
  patient_id: string;
  last_visit_date: string;
  estimated_value: number;
  priority_score: number;
  priority_level: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending';
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Initialize Supabase Client (Service Role for admin access)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Define Recall Parameters (Hardcoded for now, could be per-clinic config later)
    const RECALL_THRESHOLD_MONTHS = 6;
    const RECALL_CUTOFF_DATE = new Date();
    RECALL_CUTOFF_DATE.setMonth(RECALL_CUTOFF_DATE.getMonth() - RECALL_THRESHOLD_MONTHS);
    const CUTOFF_ISO = RECALL_CUTOFF_DATE.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`🔍 Scanning for patients with last visit before ${CUTOFF_ISO}...`);

    // 3. Query Eligible Patients
    // - Active status
    // - Last visit older than threshold
    // - NOT already in recall_candidates (handled by left join or filtering)

    // Using a simpler approach: Get all overdue patients, then filter in memory or via exclusion query
    // To scale, we process per clinic or batch. For now, we'll process *all* clinics (MVP).

    // Let's get "active" overdue patients
    const { data: overduePatients, error: fetchError } = await supabase
      .from('patients')
      .select('id, clinic_id, first_name, last_name, phone, last_visit, status')
      .eq('status', 'active')
      .lt('last_visit', CUTOFF_ISO)
      .limit(1000); // Batch limit

    if (fetchError) throw fetchError;
    if (!overduePatients || overduePatients.length === 0) {
      return new Response(JSON.stringify({ message: 'No overdue patients found', count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(
      `Found ${overduePatients.length} overdue patients. checking for existing candidates...`,
    );

    // 4. Filter out existing candidates
    // We can't do a "NOT IN" easily with thousands of IDs via REST.
    // Instead, we fetch existing candidate patient_ids and filter locally (ok for MVP batch size)
    const patientIds = overduePatients.map((p) => p.id);
    const { data: existingCandidates, error: existingError } = await supabase
      .from('recall_candidates')
      .select('patient_id')
      .in('patient_id', patientIds);

    if (existingError) throw existingError;

    const existingSet = new Set(existingCandidates?.map((c) => c.patient_id) || []);

    const newCandidatesData: RecallCandidate[] = [];

    // 5. Calculate Priority & Value for each new candidate
    for (const patient of overduePatients) {
      if (existingSet.has(patient.id)) continue; // Skip if already exists

      // Logic:
      // Value: Default $250 (hygiene)
      // Score: Base 50 + 5 per month overdue (capped at 100)

      const lastVisitDate = new Date(patient.last_visit);
      const monthsOverdue = Math.floor(
        (new Date().getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24 * 30),
      );

      // Priority Calculation
      let priority_score = 50 + (monthsOverdue - 6) * 5;
      if (priority_score > 100) priority_score = 100;
      if (priority_score < 0) priority_score = 0;

      let priority_level: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (priority_score >= 90) priority_level = 'critical';
      else if (priority_score >= 75) priority_level = 'high';
      else if (priority_score >= 60) priority_level = 'medium';

      newCandidatesData.push({
        clinic_id: patient.clinic_id,
        patient_id: patient.id,
        last_visit_date: patient.last_visit,
        estimated_value: 250.0, // Default value
        priority_score,
        priority_level,
        status: 'pending',
      });
    }

    console.log(`Identified ${newCandidatesData.length} new candidates to insert.`);

    // 6. Bulk Insert
    if (newCandidatesData.length > 0) {
      const { error: insertError } = await supabase
        .from('recall_candidates')
        .insert(newCandidatesData);

      if (insertError) throw insertError;
    }

    // 7. Success Response
    return new Response(
      JSON.stringify({
        message: 'Recall detection complete',
        scanned: overduePatients.length,
        new_candidates: newCandidatesData.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in detect-recall-candidates:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
