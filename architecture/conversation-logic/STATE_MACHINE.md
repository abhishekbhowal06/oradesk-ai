# PHASE 7: CONVERSATION STATE MACHINE

## 1. State Decision Tree

### START: `DETECT_INTENT`

- **User:** "Who is this?" -> `EXPLAIN_IDENTITY`
- **User:** "I want to book" -> `CHECK_AVAILABILITY`
- **User:** "Not interested" -> `END_CALL`

---

### STATE: `CHECK_AVAILABILITY`

**Action:** Call `get_available_slots(clinic_id)`

- **Success:** Returns list of slots.
- **Fail:** "I'm having trouble seeing the calendar right now. Can I have reception call you back?" -> `ESCALATE`

**AI Speech:**
"I'm looking at our schedule now. I have openings on [Day 1] at [Time 1] or [Day 2] at [Time 2]. Which works better?"

---

### STATE: `NEGOTIATE_SLOT`

- **User:** "Tuesday works."
  **Action:** Call `lock_slot(slot_id_A, call_id)`

- **User:** "I can't do mornings."
  **Action:** Filter list -> "How about afternoon, say [Time 3]?"

---

### STATE: `LOCK_CONFIRMATION`

**Trigger:** `lock_slot` returns `success: true`
**AI Speech:**
"Okay, I've temporarily held that [Time] slot for you. Just to confirm, you'd like to book a cleaning for Tuesday at 2pm?"

- **User:** "Yes." -> `FINALIZE_BOOKING`
- **User:** "Wait, actually..." -> `RELEASE_LOCK` -> `NEGOTIATE_SLOT`

---

### STATE: `FINALIZE_BOOKING`

**Action:** Call `confirm_booking(slot_id, patient_id)`
**AI Speech:**
"Great! You are all set for Tuesday at 2pm. You'll receive a text confirmation shortly. Have a great day!"

---

## 2. Failover Logic

| Scenario                        | System Reaction                  | AI Speech                                                                                          |
| :------------------------------ | :------------------------------- | :------------------------------------------------------------------------------------------------- |
| **Slot Taken** (Race Condition) | `lock_slot` returns `SLOT_TAKEN` | "Ah, apologies, that specific time was just disconnected. I still have [Time B] available?"        |
| **API Timeout**                 | `get_slots` times out            | "My system is moving a bit slow. Let me have a human coordinator call you back to find a time."    |
| **Unknown Intent**              | User says nonsense               | "I want to make sure I get you booked correctly. Would Tuesday or Thursday be better?" (re-anchor) |

## 3. Sample Transcript (Happy Path)

**AI:** "Hi, this is Sarah from Dr. Smith's office. You're due for a cleaning. Would you like to get that scheduled?"
**User:** "Yeah sure, what do you have?"
**AI:** _[TOOL: get_available_slots]_ -> _[Returns: Tue 2pm, Thu 10am]_
**AI:** "I have a Tuesday at 2:00 PM or a Thursday at 10:00 AM. Do either of those work?"
**User:** "Tuesday works."
**AI:** _[TOOL: lock_slot(id=Tue2pm)]_ -> _[Returns: success]_
**AI:** "Perfect. I've held Tuesday at 2:00 PM for you. Shall I lock that in?"
**User:** "Yes please."
**AI:** _[TOOL: confirm_booking(id=Tue2pm)]_ -> _[Returns: success]_
**AI:** "All done! You're booked. See you then!"

## 4. Webhook Payload Structure (Vapi -> Supabase)

When Vapi calls our `booking-engine`, it sends:

```json
{
  "message": {
    "toolCalls": [
      {
        "function": {
          "name": "confirm_booking",
          "arguments": "{ \"slot_id\": \"...\", \"patient_id\": \"...\" }"
        },
        "id": "call_12345"
      }
    ]
  }
}
```

The Edge Function must parse this, execute logic, and return:

```json
{
  "results": [
    {
      "toolCallId": "call_12345",
      "result": "{ \"success\": true, \"appointment_id\": \"OD-999\" }"
    }
  ]
}
```
