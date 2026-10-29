# DealMee Development Plan — Back-in-Stock Smart Notification (Feature B)

## Overview
When a customer asks about an out-of-stock product and says "notify me when it's back",
the bot should:
1. Detect the intent (product unavailable + customer wants notification)
2. Schedule a follow-up check
3. When the follow-up fires, check product stock in the system
4. If in stock → send notification to customer
5. If still out of stock → reschedule (max 3 retries, then give up)

## Architecture

### Phase 1: Intent Detection (Bot Prompt)
- Add instruction to salesAgentEngine prompt: when customer asks about unavailable product and wants to be notified, call `schedule_followup` with reason "back_in_stock_check"
- The bot should NOT promise a specific time, just "when it's back, we'll let you know"

### Phase 2: Stock Check on Follow-up Fire
- Modify `processDueFollowUpTasks()` in `proactiveFollowUp.ts`
- For tasks with `task_type = 'scheduled_message'` and `payload.reason = 'back_in_stock_check'`:
  - Extract product name from payload
  - Query `products` table for stock > 0
  - If in stock → deliver notification message
  - If out of stock → reschedule (trigger_at += 3 days, retry_count++, max 3)
  - If max retries reached → send "still out of stock" message

### Phase 3: Payload Schema
```json
{
  "message": "เสื้อยืดมาแล้วค่ะ! สนใจสั่งได้เลยนะ 😊",
  "reason": "back_in_stock_check",
  "product_name": "เสื้อยืด",
  "product_id": "uuid (optional)",
  "retry_count": 0,
  "max_retries": 3,
  "reschedule_days": 3
}
```

### Phase 4: DB Schema (if needed)
- Add `retry_count` and `max_retries` to `follow_up_tasks.payload` (already JSONB, no migration needed)
- Add `product_id` to payload for stock lookup

### Files to Modify
1. `src/lib/ai/salesAgentEngine.ts` — add prompt instruction for back-in-stock detection
2. `src/lib/ai/proactiveFollowUp.ts` — add stock check logic in `processDueFollowUpTasks()`
3. `src/lib/ai/toolDispatcher.ts` — handle `schedule_followup` with back_in_stock reason
4. `src/lib/orders/` or `src/lib/inventory/` — product stock lookup function

### Dependencies
- Products table must have `stock_quantity` or `in_stock` column
- Follow-up cron must be running (`/api/cron/follow-up` every 5-10 min)

### Estimated Effort
- Phase 1 (prompt): 1 hour
- Phase 2 (stock check): 2-3 hours
- Phase 3 (payload): 30 min
- Phase 4 (DB): 0 (no migration needed)
- Total: ~4 hours

### Priority
- Medium — enhances customer experience but not critical for MVP
- Should be done after #1 (handoff auto-extract) and #2 (batch extract) are verified

## Status
- [ ] Phase 1: Prompt instruction
- [ ] Phase 2: Stock check logic
- [ ] Phase 3: Payload schema
- [ ] Phase 4: Testing
