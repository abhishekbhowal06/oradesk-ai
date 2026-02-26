# AI Clinical Command Interface: Production Blueprint

## 1. Updated Layout Structure
**Architecture**: CSS Grid format with strict visual hierarchy. Designed for deep-focus monitoring and configuration.

```html
<DashboardLayout>
  <!-- Global Intelligence Panels (Sticky Top) -->
  <Topbar>
      <VersionBadge />
      <SystemHealthPing latency={120} sync="healthy" />
      <CostUsagePanel tokens={124000} estCost={2.45} />
      <DailySummary />
  </Topbar>

  <MainGrid className="grid grid-cols-12 gap-8 p-8 bg-slate-50/50">
    
    <!-- LEFT COLUMN: The "Living" AI Core (Sticky) -->
    <Column className="col-span-4 space-y-6 sticky top-20 h-[calc(100vh-80px)] overflow-y-auto hidden-scrollbar">
      <Zone1BrainCore />
    </Column>

    <!-- RIGHT COLUMN: Configuration & Integration (Scrollable) -->
    <Column className="col-span-8 space-y-8 pb-12">
      <!-- Top Row -->
      <Row className="grid grid-cols-2 gap-8">
        <Zone2ClinicConfig />
        <Zone3KnowledgeCenter />
      </Row>
      
      <!-- Bottom Row -->
      <Row>
        <Zone4Deployment />
      </Row>
    </Column>

  </MainGrid>
</DashboardLayout>
```

---

## 2. Component Breakdown

*   **`AICommandCenter` (Page Wrapper)**
    *   **`IntelligenceTopbar`**: Sticky header containing connection health, latency, daily token spend, and AI version.
    *   **`Zone1BrainCore`**:
        *   `HologramOrb`: Canvas-driven CSS/Framer component listening to WebAudio API for real-time reactivity.
        *   `VoiceMatrixControls`: Toggles passing context (Hope, Professional, Calm).
        *   `PersonalitySlider`: Translates 1-10 slider into system prompt temperature/tone logic.
        *   `LiveTranscriptFeed`: Real-time auto-scrolling log with `MessageBubble` entries.
    *   **`Zone2ClinicConfig`**:
        *   `SetupProgressBar`: Calculates completion threshold based on JSONB depth in `clinic_settings`.
        *   `AccordionCard`: 5 individual configuration panels (Identity, Hours, Services, Compliance, Routing).
    *   **`Zone3KnowledgeCenter`**:
        *   `DropzoneArea`: Drag-and-drop for PDF/DOCX.
        *   `KnowledgeHealthBadge`: Evaluates RAG staleness based on `last_trained`.
        *   `RetrainTrigger`: Button that fires a background worker to embed new contexts.
    *   **`Zone4Deployment`**:
        *   `IntegrationGrid`: Grid of `ConnectionStatusCard` (Phone, WhatsApp, PMS).
        *   `WidgetCustomizer`: Splits into `WidgetControls` (Color, Greeting) and `WidgetPreview` (Live DOM iframe/mockup).

---

## 3. Supabase Schema SQL

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Core Clinic Entity
CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    timezone TEXT DEFAULT 'UTC'
);

-- 2. Granular Settings (JSONB for maximum flexibility of rules)
CREATE TABLE clinic_settings (
    clinic_id UUID PRIMARY KEY REFERENCES clinics(id) ON DELETE CASCADE,
    identity_config JSONB DEFAULT '{}'::jsonb,
    working_hours JSONB DEFAULT '{}'::jsonb,
    services_pricing JSONB DEFAULT '{}'::jsonb,
    safety_compliance JSONB DEFAULT '{}'::jsonb,
    escalation_routing JSONB DEFAULT '{}'::jsonb,
    setup_progress INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RBAC Roles
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('owner', 'admin', 'staff')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, clinic_id)
);

-- 4. Active & Historic AI Sessions
CREATE TABLE ai_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id),
    channel TEXT CHECK (channel IN ('voice', 'whatsapp', 'widget')),
    status TEXT CHECK (status IN ('active', 'completed', 'escalated', 'failed')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- 5. Real-time Transcripts
CREATE TABLE ai_transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES ai_sessions(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('user', 'ai', 'system')),
    content TEXT NOT NULL,
    audio_url TEXT, -- Optional recording reference
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Knowledge Sources (Scraping/Text)
CREATE TABLE knowledge_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('url', 'faq_manual')),
    content TEXT NOT NULL,
    last_trained TIMESTAMPTZ
);

-- 7. Knowledge Documents (PDFs/Docx)
CREATE TABLE knowledge_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_type TEXT,
    size_bytes BIGINT,
    last_trained TIMESTAMPTZ
);

-- 8. Daily Telemetry Aggregation
CREATE TABLE ai_metrics_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE,
    metric_date DATE DEFAULT CURRENT_DATE,
    total_sessions INT DEFAULT 0,
    total_tokens INT DEFAULT 0,
    estimated_cost NUMERIC(10,4) DEFAULT 0.0000,
    avg_latency_ms INT DEFAULT 0,
    UNIQUE(clinic_id, metric_date)
);

-- Turn on Realtime for Transcripts
ALTER PUBLICATION supabase_realtime ADD TABLE ai_transcripts;
```

---

## 4. Realtime Data Flow Explanation

The **Live Transcript Panel** operates via WebSockets directly to the database to bypass edge-polling latency.

1.  **AI Engine**: ElevenLabs/Gemini emits text chunks via their streaming SDK to the Edge Function.
2.  **Edge Function**: Batches chunks into complete sentences/turns and performs a high-speed `INSERT` into the `ai_transcripts` table.
3.  **Supabase Realtime**: The PostgreSQL triggers broadcast an `INSERT` payload over the active socket connection.
4.  **React Client**: Listens to the specific `session_id`.
    ```typescript
    useEffect(() => {
      const channel = supabase.channel(`live-transcript-${sessionId}`)
        .on('postgres_changes', { 
           event: 'INSERT', 
           schema: 'public', 
           table: 'ai_transcripts', 
           filter: `session_id=eq.${sessionId}` 
        }, (payload) => {
           setTranscripts(prev => [...prev, payload.new]);
           scrollToBottom();
        })
        .subscribe();
      return () => { supabase.removeChannel(channel) };
    }, [sessionId]);
    ```

---

## 5. Edge Function Skeletons

**A. `session_start` (Initializes context & limits)**
```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { clinicId, channel } = await req.json();
  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  
  // 1. Fetch clinic configuration & routing rules
  const { data: config } = await supabase.from('clinic_settings').select('*').eq('clinic_id', clinicId).single();
  
  // 2. Hydrate RAG context
  // 3. Initiate tracking session
  const { data: session } = await supabase.from('ai_sessions').insert({
    clinic_id: clinicId, channel, status: 'active'
  }).select().single();

  return new Response(JSON.stringify({ sessionId: session.id, systemPrompt: buildPrompt(config) }), { 
    headers: { "Content-Type": "application/json" } 
  });
});
```

**B. `escalation_webhook` (Triggered mid-call when confidence drops)**
```typescript
serve(async (req) => {
  const { sessionId, confidenceScore, triggerReason } = await req.json();
  
  // 1. Mark session status
  await supabase.from('ai_sessions').update({ status: 'escalated' }).eq('id', sessionId);
  
  // 2. Fetch escalation routing logic (SMS, Webhook to PMS, Dial external human)
  const route = await getRoutingRules(sessionId);
  if (route.method === 'transfer_call') {
      await triggerTwilioTransfer(route.targetNumber);
  }
  
  return new Response("Escalation Handled", { status: 200 });
});
```

---

## 6. React Component Structure

```typescript
// components/command-center/Zone1BrainCore.tsx
import { HologramOrb } from './HologramOrb';
import { TranscriptFeed } from './TranscriptFeed';

export function Zone1BrainCore() {
  const { isLive, currentLevel, toggleHumanTakeover } = useAiEngine();

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden clinical-panel">
      {/* Visual Core */}
      <div className="p-8 flex flex-col items-center justify-center bg-slate-50 border-b border-slate-100">
         <HologramOrb amplitude={currentLevel} idle={!isLive} />
         <VoiceControls className="mt-6 w-full" />
      </div>

      {/* Transcript */}
      <div className="flex-1 p-6 relative">
         <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Live Analysis</h3>
         <TranscriptFeed />
         
         <div className="absolute bottom-6 left-6 right-6 flex gap-3">
            <Button variant="outline" onClick={initTestCall}>Test Call</Button>
            <Button variant="destructive" onClick={toggleHumanTakeover}>
               Human Takeover
            </Button>
         </div>
      </div>
    </div>
  );
}
```

---

## 7. Animation Behavior Pseudo-code

For that enterprise, clean, non-neon visual. Use Framer Motion and standard CSS radial gradients.

```javascript
// HologramOrb.tsx
import { motion } from 'framer-motion';

export function HologramOrb({ amplitude, idle }) {
  // Map raw audio amplitude (0 to 255) to scale factor (1.0 to 1.3)
  const scaleTarget = idle ? 1 : 1 + (amplitude / 255) * 0.3;
  // Map to opacity or glow size
  const opacityTarget = idle ? 0.6 : 0.6 + (amplitude / 255) * 0.4;

  return (
    <div className="relative w-48 h-48 flex items-center justify-center">
      {/* Base clinical blue/emerald soft gradient */}
      <motion.div 
        animate={{ 
           scale: idle ? [1, 1.05, 1] : scaleTarget,
           opacity: opacityTarget
        }}
        transition={{ 
           duration: idle ? 4 : 0.1, 
           ease: idle ? "easeInOut" : "linear", 
           repeat: idle ? Infinity : 0 
        }}
        className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-100 to-blue-200"
        style={{
           boxShadow: idle ? '0 0 30px rgba(16, 185, 129, 0.1)' : `0 0 ${40 + amplitude * 0.5}px rgba(16, 185, 129, 0.2)`
        }}
      />
      {/* Inner core */}
      <div className="w-32 h-32 rounded-full bg-white/40 backdrop-blur-md border border-white/60 shadow-inner" />
    </div>
  )
}
```

---

## 8. Deployment Checklist

### A. Database Preparedness
- [ ] Execute Supabase SQL migrations (8 tables).
- [ ] Configure Row Level Security (RLS) on `clinic_id`.
- [ ] Enable `ai_transcripts` replication in Supabase Realtime Portal.
- [ ] Seed initial `user_roles` linking Auth user to a `clinic_id`.

### B. Functional Setup
- [ ] Deploy Edge Functions: `supabase functions deploy session_start --no-verify-jwt`.
- [ ] Deploy Edge Functions: `supabase functions deploy escalation_webhook`.
- [ ] Setup `pg_cron` or Supabase Edge Scheduled Function for the `ai_metrics_daily` aggregation.

### C. App Environment (Vite/Next.js)
- [ ] Insert keys into `.env.production`: ELEVENLABS_API_KEY, GEMINI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY.
- [ ] Audit generic components (Buttons, Sliders, Dropdowns) ensuring they use standard Tailwind without flashy ring/neon utilities. 
- [ ] Validate Framer Motion presence (`npm i framer-motion`) for Orb animations.

### D. Final UX Review (Age 35-60 Dentist Persona)
- [ ] Typography passes accessibility contrast ratios (Text should be Slate-800 or Slate-900, not pure black).
- [ ] All success states use soft "emerald" (#10B981) instead of bright "lime" or neon green.
- [ ] "Human Takeover" and "HIPAA logic" warnings use standard "amber" or "red" muted shades. No flashing banners.
