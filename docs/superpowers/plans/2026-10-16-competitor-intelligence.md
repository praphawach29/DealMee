# Competitor Intelligence & AI Spy Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Competitor Intelligence page into an all-in-one commercial-ready spy & execution system that goes beyond passive analytics by generating actionable viral video scripts, AI objection-handling combat playbooks, smart product bundling, and strict plan-based quota tracking.

**Architecture:** 
1. Database & Billing: Add `competitor_scans_used` tracking to `shops` or billing usage, with plan-based quotas (Free: 3, Starter: 10, Pro: 50, Agency: 200).
2. AI Intelligence Engine: Enhance `scraperEngine.ts` and create `competitorAgent.ts` utilizing Gemini 3.8 Flash to generate 5-part TikTok/Reels video production scripts with timing and Thai voiceovers based on competitor viral videos + merchant catalog.
3. Chatbot Integration: Direct 1-click sync of objection-handling battlecards into `knowledge_base` so the bot can defend prices against competitors.
4. UI/UX: Rich, dark-mode responsive dashboard in `CompetitorDashboardClient.tsx` featuring quota badges, script generator modal, copy-to-teleprompter buttons, and product bundling matrix.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Supabase PostgreSQL, Gemini 3.8 Flash API.

**Spec:** Commercial Competitor Intelligence & Actionable AI Suite for DealMee SaaS.

## Global Constraints
- Target platform response: Under 2s for cached analysis, under 5s for live AI script generation.
- Strict gross margin protection: Every scan is tracked; 24-hour cache prevents duplicate API calls.
- Full mobile and tablet responsiveness (touch targets >= 44px).
- Zero TypeScript (`tsc`) and ESLint compilation errors.

## Review Focus
- Quota depletion: User at quota limit sees clear upgrade CTA and cannot spam external scraper APIs.
- Missing products: Shop with 0 products still receives generic competitor insights and script suggestions without crashing.
- RapidAPI error/timeout: System gracefully degrades to deterministic simulation without throwing 500 errors.
- Thai language nuance: Scripts and objection-handling copy must sound natural, professional, and convincing for Thai e-commerce.
- Knowledge base collision: Syncing competitor playbook multiple times updates or appends cleanly without corrupting existing bot knowledge.

---

### Task 1: Competitor Quota System & Database Tracking

**Files:**
- Modify: `src/lib/billing/competitorQuota.ts` (create new helper)
- Modify: `src/app/api/competitors/analyze/route.ts:25-85`
- Test: `scratch/test_competitor_quota.ts`

**Interfaces:**
- Produces: `getCompetitorQuota(shopId: string): Promise<{ total: number, used: number, remaining: number, planName: string }>`
- Produces: `incrementCompetitorQuota(shopId: string): Promise<boolean>`

- [x] **Step 1: Write test for competitor quota helper**
- [x] **Step 2: Run test and verify it fails**
- [x] **Step 3: Implement `competitorQuota.ts` with plan limits (Free: 3, Starter: 10, Pro: 50, Agency: 200)**
- [x] **Step 4: Integrate quota check & increment into `api/competitors/analyze/route.ts`**
- [x] **Step 5: Run test to verify it passes**

---

### Task 2: AI Viral Video Script & Hook Generator

**Files:**
- Create: `src/lib/ai/competitorVideoScript.ts`
- Modify: `src/app/api/competitors/generate-script/route.ts` (create new API route)
- Test: `scratch/test_script_generator.ts`

**Interfaces:**
- Produces: `generateViralScriptFromCompetitor(params: { competitorVideoTitle: string, competitorName: string, myProduct: { name: string, price: number, features?: string }, shopName: string }): Promise<ViralVideoScript>`
- Schema of `ViralVideoScript`:
  - `hook`: { duration: '00:00 - 00:03', spokenText: string, visualDirection: string }
  - `problem`: { duration: '00:03 - 00:08', spokenText: string, visualDirection: string }
  - `solution`: { duration: '00:08 - 00:16', spokenText: string, visualDirection: string }
  - `offer`: { duration: '00:16 - 00:23', spokenText: string, visualDirection: string }
  - `cta`: { duration: '00:23 - 00:30', spokenText: string, visualDirection: string }
  - `caption`: string
  - `hashtags`: string[]

- [x] **Step 1: Write failing test for `competitorVideoScript.ts`**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement `generateViralScriptFromCompetitor` using Gemini 3.8 Flash**
- [x] **Step 4: Create API endpoint `POST /api/competitors/generate-script`**
- [x] **Step 5: Run test and verify generated script meets 5-part structure**

---

### Task 3: Counter-Strategy Objection Handling & Auto Knowledge Base Sync

**Files:**
- Modify: `src/app/api/competitors/route.ts:70-95`
- Test: `scratch/test_kb_sync.ts`

**Interfaces:**
- Produces: Enhanced `sync_knowledge` that creates structured objection-handling Q&A:
  - Trigger: "ทำไมแพงกว่า [ร้านคู่แข่ง] / ร้านอื่นขายถูกกว่า"
  - Answer: Points of superiority (authentic quality, 24h dispatch, warranty, bundle gifts)
  - Closes the loop directly into DealMee chatbot's memory

- [x] **Step 1: Write failing test verifying knowledge base sync structure**
- [x] **Step 2: Implement enhanced objection-handling synthesis in `api/competitors/route.ts`**
- [x] **Step 3: Verify chatbot retrieves and applies objection-handling answer in chat**

---

### Task 4: UI/UX Overhaul in CompetitorDashboardClient

**Files:**
- Modify: `src/app/dashboard/competitors/CompetitorDashboardClient.tsx`
- Modify: `src/app/dashboard/competitors/page.tsx`
- Test: Browser subagent visual verification

**Interfaces:**
- Consumes: Quota info, script generator API, enhanced playbook
- Produces:
  1. Quota Progress Bar Banner at the top of the Competitor Dashboard
  2. "🎬 แปลงเป็นสคริปต์คลิปไวรัลของร้านเรา" button on every competitor viral post card
  3. Interactive Script Modal with copy-to-clipboard, timing badges, and visual shooting cues
  4. Winning Product Bundling section recommending price combos

- [x] **Step 1: Add Quota Banner component with percentage bar and Upgrade CTA**
- [x] **Step 2: Add Viral Script Generator Modal with tabbed preview & 1-click copy**
- [x] **Step 3: Add Product Bundling Strategy Cards in the Copilot Strategy Tab**
- [x] **Step 4: Test in browser using `browser_subagent` to verify all interactions and responsiveness**

---

### Task 5: End-to-End Verification & Health Check

**Files:**
- Test: Full build, type check, and lint

- [x] **Step 1: Run `npx tsc --noEmit` and confirm 0 errors**
- [x] **Step 2: Run `npx eslint src` and confirm 0 errors**
- [x] **Step 3: Run `npm run build` and confirm production build passes**
- [x] **Step 4: Run end-to-end browser walkthrough**
