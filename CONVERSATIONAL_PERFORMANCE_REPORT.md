# REAL-TIME CONVERSATIONAL PERFORMANCE REPORT

## Executive Summary

Dentacore OS has been architected for **human-like conversational responsiveness** with a target of **<300ms perceived latency**. This document describes the complete streaming architecture, behavioral techniques, and testing framework.

---

## Problem Analysis

### Current Architecture Latency: 8-12 seconds ❌

```
Patient speaks → Twilio Gather (5s timeout) → Full transcription (1-2s) →
Gemini API (3-5s) → Safety checks (50ms) → TTS (1-2s) → Playback
```

### Target: <300ms perceived latency ✅

**Key Insight:** We don't need to complete processing in 300ms. We need to START responding in 300ms.

---

## Architectural Solution

### New Pipeline: Duplex Streaming

```
┌──────────────────────────────────────────────────┐
│ Twilio Media Streams (WebSocket bidirectional)  │
└──────────────────────────────────────────────────┘
         ↓ audio chunks                  ↑ audio chunks
         ↓                                ↑
┌────────▼────────────┐          ┌───────┴─────────┐
│ Deepgram Live STT   │          │ Streaming TTS   │
│ • Partial results   │          │ • <200ms start  │
│ • <100ms first word │          │ • Chunked       │
└────────┬────────────┘          └───────▲─────────┘
         │                                │
         ▼                                │
┌─────────────────────────────────────────┴────────┐
│     3-TIER INTENT PREDICTION ENGINE              │
│                                                   │
│  [Tier 1: Pattern Match]  [Tier 2: Lightweight]  │
│       0-50ms                   100-300ms          │
│  "yes" → respond         Partial buffering        │
│                                                   │
│  [Tier 3: Full AI]                               │
│  Background Gemini (async)                       │
└──────────────────────────────────────────────────┘
```

---

## Behavioral Techniques (Masking Latency)

### 1. Backchannel Sounds

Play acknowledgement sounds while processing:

| Situation | Backchannel | Timing |
|-----------|-------------|--------|
| Patient speaking (partial) | "mm-hmm", "okay" | <200ms |
| Thinking/processing | "let me check", "one moment" | <300ms |
| Clarification needed | "sorry?", "could you repeat?" | <200ms |

### 2. Turn-Taking Delays

Don't respond TOO fast - feels robotic:

- Quick confirmation: 100ms gap
- Normal response: 300ms gap
- Complex thinking: 800ms gap
- Emergency: 0ms gap

### 3. Interrupt Handling

```typescript
// Patient starts speaking → Immediately stop our audio
onPatientInterrupt() {
  stopAudio();
  resetPipeline();
  logger.info('Patient interrupted - listening');
}
```

---

## Files Created

### Backend (`services/ai-calling/src/lib/`)

| File | Purpose |
|------|---------|
| `realtime-conversation.ts` | Early exit patterns, backchannel engine, turn-taking logic |
| `stream-handler.ts` | Deepgram Live STT integration, bidirectional audio streaming |

### Testing

| File | Purpose |
|------|---------|
| `__tests__/realtime-conversation.test.ts` | Latency validation, conversation flow testing |

---

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Early exit patterns | ✅ Complete | 0-50ms pattern matching |
| Backchannel engine | ✅ Complete | Behavioral masking |
| Turn-taking timing | ✅ Complete | Perceptual naturalness |
| Streaming state machine | ✅ Complete | Interrupt handling |
| Deepgram integration | 🟡 Scaffolded | Needs API key + testing |
| Streaming TTS | ⚠️ Pending | ElevenLabs or Azure |
| Webhook update | ⚠️ Pending | Switch from Gather to Media Streams |

---

## Performance Targets

| Metric | Target | How Measured |
|--------|--------|--------------|
| Time to first audio | <300ms | 95th percentile |
| Turn gap (natural) | 200-400ms | Median |
| Interrupt reaction | <200ms | 99th percentile |
| Early exit accuracy | >90% | Pattern match precision |
| Conversation drop rate | <1% | Per 1000 calls |

---

## Latency Budget Breakdown

### Simple Confirmation ("yes")

```
Patient stops speaking: T+0ms
├─ Voice Activity Detect: T+50ms
├─ Partial transcript: T+100ms
├─ Early exit match: T+150ms
├─ Natural turn gap: T+250ms
└─ TTS first chunk: T+300ms ✅
```

### Complex Question

```
Patient stops speaking: T+0ms
├─ Backchannel ("mm-hmm"): T+200ms ✅
├─ Final transcript: T+800ms
├─ Gemini analysis: T+3000ms
├─ Response ready: T+3500ms
└─ TTS streaming: T+4000ms
```
**Human perception:** System acknowledged in 200ms, so feels responsive even though full answer took 4s.

---

## Next Steps for Full Implementation

1. **Add Deepgram API key** to env
2. **Update `/twilio/voice` endpoint** to use Media Streams instead of Gather
3. **Integrate streaming TTS** (ElevenLabs Turbo v2)
4. **A/B test early exit thresholds** (currently 95% confidence)
5. **Load test** with 50 concurrent calls
6. **Monitor latency metrics** in production

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Streaming STT increases costs | Medium | Use VAD, only stream during speech |
| Wrong early exits | High | Log all; A/B test confidence |
| Network instability | Medium | Adaptive bitrate, fallback to Gather |
| Complexity | Medium | Monitoring + auto-fallback |

---

## Success Criteria

The system is successful when:

✅ 95% of simple confirmations respond in <300ms  
✅ System never silent >2 seconds without acknowledgement  
✅ Patients can interrupt naturally  
✅ Conversations feel "immediate" in user surveys (>8/10)  
✅ No increase in escalation rate vs. current system  

---

## Architectural Principles

1. **Start fast, finish accurately** - Backchannel immediately, think in background
2. **Safe inactivity over incorrect action** - If unsure, ask human
3. **Human conversation patterns** - Pauses, backchannels, interrupts
4. **Graceful degradation** - Fall back to synchronous if streaming fails
5. **Measure perceived latency** - Not just technical latency

---

**Status:** Architecture complete, ready for integration testing
