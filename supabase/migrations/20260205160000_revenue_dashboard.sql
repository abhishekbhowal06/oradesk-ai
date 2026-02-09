-- Revenue Dashboard View
-- Aggregates the value of AI-managed appointments

CREATE OR REPLACE VIEW public.revenue_dashboard AS
SELECT 
    c.id as clinic_id,
    c.name as clinic_name,
    -- Time Period: Last 30 Days
    count(ac.id) filter (where ac.created_at > now() - interval '30 days') as total_calls_30d,
    
    -- Revenue Secured (Confirmed + Recalled)
    -- We assume a default value of $150 per appointment if revenue_impact is null
    sum(coalesce(ac.revenue_impact, 150.00)) filter (
        where ac.created_at > now() - interval '30 days' 
        AND (ac.outcome = 'confirmed' OR ac.call_type = 'recall')
    ) as revenue_secured_30d,

    -- Recall specifics
    count(ac.id) filter (
        where ac.created_at > now() - interval '30 days' 
        AND ac.call_type = 'recall'
        AND ac.outcome = 'confirmed' -- Assuming 'confirmed' means booked for recall
    ) as recall_bookings_30d,

    -- Projected Annual Value (Simple * 12 extrapolation)
    (sum(coalesce(ac.revenue_impact, 150.00)) filter (
        where ac.created_at > now() - interval '30 days' 
        AND (ac.outcome = 'confirmed')
    ) * 12) as projected_annual_value

FROM public.clinics c
LEFT JOIN public.ai_calls ac ON c.id = ac.clinic_id
GROUP BY c.id, c.name;

-- Grant access
GRANT SELECT ON public.revenue_dashboard TO authenticated;
GRANT SELECT ON public.revenue_dashboard TO service_role;
