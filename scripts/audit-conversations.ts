#!/usr/bin/env npx tsx
/**
 * ═══════════════════════════════════════════════════════════════
 * CONVERSATION AUDITOR — "Safe Mode"
 * ═══════════════════════════════════════════════════════════════
 *
 * Pulls the last N completed call transcripts from Supabase,
 * feeds them to Gemini with a Grader Prompt, and generates a
 * brutally honest Markdown QA report.
 *
 * CHANGES:
 * - Uses `axios` instead of `fetch` (avoids undici/libuv bugs)
 * - Strict sequential processing (one-by-one)
 * - Explicit garbage collection hints (if exposed)
 * - Robust error handling (continue on error)
 *
 * Usage:
 *   npx tsx scripts/audit-conversations.ts
 *   npx tsx scripts/audit-conversations.ts --count 5
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
 * ═══════════════════════════════════════════════════════════════
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios'; // STABILITY FIX: Use axios (http) instead of fetch (undici)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// MANUAL ENV LOADING (No dotenv dependency to avoid conflicts)
const potentialPaths = [
  path.resolve(__dirname, '../services/ai-calling/.env'), // From scripts/
  path.resolve(__dirname, '../../services/ai-calling/.env'), // From dist/scripts/
  path.resolve(__dirname, '../../../services/ai-calling/.env'), // Just in case
];

// Only load if not already set
if (!process.env.SUPABASE_URL) {
  let envPath = '';
  for (const p of potentialPaths) {
    if (fs.existsSync(p)) {
      envPath = p;
      break;
    }
  }

  if (envPath) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    console.log(`DEBUG: Loaded .env from ${envPath}`);
    envConfig.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*([^=]+?)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        const value = (match[2] || '').replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = value;
      }
    });
  } else {
    console.warn(`⚠️  .env file not found. Trying execution with current env vars.`);
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.PRIMARY_LLM_API_KEY || '';
const CALL_COUNT = parseInt(
  process.argv.find((a) => a.startsWith('--count='))?.split('=')[1] || '5',
  10,
);

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}
if (!GEMINI_API_KEY) {
  console.error('❌ Missing GEMINI_API_KEY in env');
  process.exit(1);
}

// ── Grader Prompt ────────────────────────────────────────────

const GRADER_PROMPT = `You are a Senior QA Auditor for "Sarah," a dental AI receptionist.
You will receive a full call transcript between Sarah (AI) and a Patient (human).
Evaluate the conversation across these 7 dimensions:

1. **Interruption Control** (1-10): Did the AI interrupt the patient mid-sentence?
   - 10 = Never interrupted. 1 = Constantly interrupted.

2. **Naturalness** (1-10): Did the AI sound natural and human-like, or robotic/formulaic?
   - 10 = Indistinguishable from human. 1 = Clearly a robot.

3. **Repetitiveness** (1-10): Did the AI repeat the same phrases or sentences?
   - 10 = Never repeated. 1 = Repeated itself constantly.

4. **Task Completion** (1-10): Did the AI successfully achieve the goal (confirm, reschedule, book)?
   - 10 = Fully completed the task. 1 = Failed entirely.

5. **Empathy & Tone** (1-10): Was the AI warm, professional, and empathetic?
   - 10 = Perfect bedside manner. 1 = Cold/dismissive.

6. **Error Recovery** (1-10): How well did the AI handle misunderstandings or confusion?
   - 10 = Gracefully recovered. 1 = Broke down.

7. **Human Parity Score** (1-10): Overall, how close is this to a real human receptionist call?
   - 10 = Indistinguishable. 1 = Clearly an AI.

Respond in this EXACT JSON format:
{
  "interruption_control": <number>,
  "naturalness": <number>,
  "repetitiveness": <number>,
  "task_completion": <number>,
  "empathy_tone": <number>,
  "error_recovery": <number>,
  "human_parity": <number>,
  "areas_for_improvement": ["<string>", "<string>"],
  "notable_strengths": ["<string>"],
  "verdict": "<one-sentence summary>"
}

IMPORTANT: Be BRUTALLY HONEST. If the AI was bad, say so. No compliments unless earned.`;

// ── Types ────────────────────────────────────────────────────

interface GradeResult {
  callId: string;
  patientName: string;
  callType: string;
  outcome: string | null;
  duration: number | null;
  grade: {
    interruption_control: number;
    naturalness: number;
    repetitiveness: number;
    task_completion: number;
    empathy_tone: number;
    error_recovery: number;
    human_parity: number;
    areas_for_improvement: string[];
    notable_strengths: string[];
    verdict: string;
  } | null;
  error?: string;
  transcriptPreview: string;
}

// ── Supabase REST Client (AXIOS) ─────────────────────────────

async function fetchCalls(limit: number) {
  const query = new URLSearchParams({
    select:
      'id, patient_id, call_type, outcome, duration_seconds, transcript, confidence_score, patients(first_name, last_name)',
    status: 'in.(completed,answered)',
    order: 'created_at.desc',
    limit: limit.toString(),
  });

  const url = `${SUPABASE_URL}/rest/v1/ai_calls?${query.toString()}`;
  console.log(
    `DEBUG: Fetching from ${url.replace(SUPABASE_KEY, '***').replace(SUPABASE_URL, 'SUPABASE_URL')}`,
  ); // Redact sensitive info

  if (SUPABASE_URL.endsWith('/')) {
    console.warn('⚠️  SUPABASE_URL has a trailing slash. This might cause double slash issues.');
  }

  try {
    const response = await axios.get(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000, // 10s timeout
    });
    return response.data;
  } catch (error: any) {
    if (error.response) {
      const errorData = error.response.data;
      if (errorData?.code === 'PGRST100') {
        console.error('\n🔴 CRITICAL: Supabase REST API cannot find "ai_calls" table.');
        console.error(
          '   👉 ACTION REQUIRED: Go to Supabase Dashboard -> Settings -> API -> Exposed schemas.',
        );
        console.error('   Ensure "public" schema is in the "Exposed schemas" list.');
        console.error(
          '   Also check Table Editor -> ai_calls -> "Enable RLS" (if disabled, API should work, but check policies).',
        );
      }
      throw new Error(
        `Supabase API error: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(errorData)}`,
      );
    }
    throw new Error(`Supabase API error: ${error.message}`);
  }
}

// ── Gemini Grader (AXIOS) ────────────────────────────────────

async function gradeWithGemini(transcript: string): Promise<GradeResult['grade']> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const response = await axios.post(
      url,
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${GRADER_PROMPT}\n\n--- TRANSCRIPT ---\n${transcript}\n--- END ---` }],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000, // 15s timeout
      },
    );

    const data = response.data;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) throw new Error('Empty Gemini response');

    // Clean up markdown block if present
    const jsonStr = text
      .replace(/^```json/, '')
      .replace(/```$/, '')
      .trim();
    return JSON.parse(jsonStr);
  } catch (error: any) {
    throw new Error(`Gemini API error: ${error.message}`);
  }
}

// ── Format transcript for grading ────────────────────────────

function formatTranscript(transcript: any): string {
  if (!transcript) return '[No transcript available]';

  // Handle array format (role/message objects)
  if (Array.isArray(transcript)) {
    return transcript
      .map((msg: any) => `${msg.role === 'ai' ? 'SARAH' : 'PATIENT'}: ${msg.message}`)
      .join('\n');
  }

  // Handle object format (user/ai keys)
  if (typeof transcript === 'object') {
    const parts: string[] = [];
    if (transcript.user) parts.push(`PATIENT: ${transcript.user}`);
    if (transcript.ai) parts.push(`SARAH: ${transcript.ai}`);
    return parts.join('\n') || JSON.stringify(transcript);
  }

  return String(transcript);
}

// ── Generate Markdown Report ─────────────────────────────────

function generateReport(results: GradeResult[]): string {
  const now = new Date().toISOString();
  const graded = results.filter((r) => r.grade);
  const total = graded.length;

  // Compute averages
  const avg = (key: keyof NonNullable<GradeResult['grade']>) => {
    const vals = graded.map((r) => r.grade?.[key] as number).filter((v) => typeof v === 'number');
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : 'N/A';
  };

  const avgHumanParity = avg('human_parity');
  const avgNaturalness = avg('naturalness');
  const avgTaskCompletion = avg('task_completion');
  const avgEmpathy = avg('empathy_tone');
  const avgInterruption = avg('interruption_control');
  const avgRepetitiveness = avg('repetitiveness');
  const avgErrorRecovery = avg('error_recovery');

  const parityNum = parseFloat(avgHumanParity as string);
  const overallVerdict =
    parityNum >= 8
      ? '✅ HUMAN PARITY ACHIEVED'
      : parityNum >= 6
        ? '⚠️ APPROACHING HUMAN PARITY'
        : '🔴 SIGNIFICANT GAPS — NEEDS WORK';

  let report = `# 🕵️ QA REPORT — AI Conversation Audit
> Generated: ${now}
> Calls Audited: ${total} / ${results.length} attempted
> Grading Model: Gemini 2.0 Flash

---

## 📊 Overall Scores

| Dimension | Average Score | Grade |
|-----------|:---:|:---:|
| 🔇 Interruption Control | ${avgInterruption} / 10 | ${scoreEmoji(avgInterruption)} |
| 🗣️ Naturalness | ${avgNaturalness} / 10 | ${scoreEmoji(avgNaturalness)} |
| 🔁 Repetitiveness | ${avgRepetitiveness} / 10 | ${scoreEmoji(avgRepetitiveness)} |
| ✅ Task Completion | ${avgTaskCompletion} / 10 | ${scoreEmoji(avgTaskCompletion)} |
| 💛 Empathy & Tone | ${avgEmpathy} / 10 | ${scoreEmoji(avgEmpathy)} |
| 🔧 Error Recovery | ${avgErrorRecovery} / 10 | ${scoreEmoji(avgErrorRecovery)} |
| **🧠 Human Parity** | **${avgHumanParity} / 10** | **${scoreEmoji(avgHumanParity)}** |

## 🏆 Verdict: ${overallVerdict}

---

## 📝 Individual Call Reports

`;

  for (const r of results) {
    report += `### Call: \`${r.callId.substring(0, 8)}...\` — ${r.patientName}\n`;
    report += `- **Type:** ${r.callType} | **Outcome:** ${r.outcome || 'N/A'} | **Duration:** ${r.duration || 0}s\n`;

    if (r.error) {
      report += `- **⚠️ Grading Failed:** ${r.error}\n\n`;
      continue;
    }

    if (!r.grade) {
      report += `- **⚠️ No transcript available for grading**\n\n`;
      continue;
    }

    const g = r.grade;
    report += `\n| Metric | Score |\n|--------|:---:|\n`;
    report += `| Interruption | ${g.interruption_control}/10 |\n`;
    report += `| Naturalness | ${g.naturalness}/10 |\n`;
    report += `| Repetitiveness | ${g.repetitiveness}/10 |\n`;
    report += `| Task Completion | ${g.task_completion}/10 |\n`;
    report += `| Empathy | ${g.empathy_tone}/10 |\n`;
    report += `| Error Recovery | ${g.error_recovery}/10 |\n`;
    report += `| **Human Parity** | **${g.human_parity}/10** |\n\n`;

    report += `**Verdict:** ${g.verdict}\n\n`;

    if (g.areas_for_improvement?.length) {
      report += `**Areas for Improvement:**\n`;
      g.areas_for_improvement.forEach((a) => {
        report += `- 🔴 ${a}\n`;
      });
      report += '\n';
    }

    if (g.notable_strengths?.length) {
      report += `**Strengths:**\n`;
      g.notable_strengths.forEach((s) => {
        report += `- ✅ ${s}\n`;
      });
      report += '\n';
    }

    report += `<details><summary>Transcript Preview</summary>\n\n\`\`\`\n${r.transcriptPreview}\n\`\`\`\n\n</details>\n\n---\n\n`;
  }

  return report;
}

function scoreEmoji(score: string | number): string {
  const n = typeof score === 'string' ? parseFloat(score) : score;
  if (isNaN(n)) return '❓';
  if (n >= 8) return '🟢';
  if (n >= 6) return '🟡';
  return '🔴';
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(60));
  console.log('🕵️  CONVERSATION AUDITOR — Safe Mode');
  console.log(`   Fetching last ${CALL_COUNT} completed calls...`);
  console.log('═'.repeat(60));

  let calls: any[] = [];
  try {
    calls = await fetchCalls(CALL_COUNT);
  } catch (error: any) {
    console.error('❌ Supabase query failed:', error.message);
    process.exit(1);
  }

  if (!calls || calls.length === 0) {
    console.log('⚠️  No completed calls found. Nothing to audit.');
    return;
  }

  console.log(`✅ Found ${calls.length} calls to audit\n`);

  const results: GradeResult[] = [];

  for (const call of calls) {
    const patientName = call.patients
      ? `${(call.patients as any).first_name} ${(call.patients as any).last_name}`
      : 'Unknown Patient';

    console.log(`📞 Auditing: ${call.id.substring(0, 8)}... (${patientName})`);

    const transcriptText = formatTranscript(call.transcript);
    const preview = transcriptText.substring(0, 300) + (transcriptText.length > 300 ? '...' : '');

    if (transcriptText === '[No transcript available]' || transcriptText.length < 10) {
      results.push({
        callId: call.id,
        patientName,
        callType: call.call_type,
        outcome: call.outcome,
        duration: call.duration_seconds,
        grade: null,
        error: 'No transcript data',
        transcriptPreview: preview,
      });
      console.log('   ⚠️  No transcript — skipping\n');
      continue;
    }

    // Retry Loop (3 attempts)
    let attempts = 0;
    let success = false;
    while (attempts < 3 && !success) {
      try {
        attempts++;
        const grade = await gradeWithGemini(transcriptText);
        results.push({
          callId: call.id,
          patientName,
          callType: call.call_type,
          outcome: call.outcome,
          duration: call.duration_seconds,
          grade,
          transcriptPreview: preview,
        });
        console.log(`   🧠 Human Parity: ${grade?.human_parity}/10 — ${grade?.verdict}\n`);
        success = true;
      } catch (err: any) {
        console.log(`   🔸 Attempt ${attempts}/3 failed: ${err.message}`);
        if (attempts < 3)
          await new Promise((r) => setTimeout(r, 2000)); // Backoff
        else {
          results.push({
            callId: call.id,
            patientName,
            callType: call.call_type,
            outcome: call.outcome,
            duration: call.duration_seconds,
            grade: null,
            error: err.message,
            transcriptPreview: preview,
          });
          console.log(`   ❌ Giving up on this call.\n`);
        }
      }
    }

    // Delay between calls to respect rate limits
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Generate and save report
  const reportPath = path.resolve(__dirname, '../QA_REPORT.md');
  try {
    const report = generateReport(results);
    fs.writeFileSync(reportPath, report);
    console.log('═'.repeat(60));
    console.log(`📄 QA Report written to: ${reportPath}`);
    console.log('═'.repeat(60));
  } catch (err: any) {
    console.error('❌ Failed to write report:', err.message);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
