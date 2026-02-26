-- Lost Revenue Finder View
-- Identifies patients who haven't had a cleaning in >6 months and have historically paid

CREATE OR REPLACE VIEW public.recall_candidates AS
SELECT 
    p.id as patient_id,
    p.clinic_id,
    p.first_name,
    p.last_name,
    p.phone,
    p.email,
    MAX(a.scheduled_at) as last_visit_date,
    EXTRACT(DAYS FROM (now() - MAX(a.scheduled_at))) as days_since_last_visit,
    COUNT(a.id) as total_past_appointments,
    -- Estimated value (simple: $150 per cleaning, assume 2 cleanings/year)
    (150 * 2) as estimated_annual_value,
    -- Priority Score (higher = more valuable to recall)
    (EXTRACT(DAYS FROM (now() - MAX(a.scheduled_at))) * COUNT(a.id) * 0.01)::int as priority_score

FROM public.patients p
LEFT JOIN public.appointments a ON p.id = a.patient_id AND a.status = 'completed'
WHERE p.phone IS NOT NULL
GROUP BY p.id, p.clinic_id
HAVING MAX(a.scheduled_at) < (now() - interval '6 months')
ORDER BY priority_score DESC;

-- Grant access
GRANT SELECT ON public.recall_candidates TO authenticated;
GRANT SELECT ON public.recall_candidates TO service_role;
