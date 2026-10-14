# DealMee Next-Gen AI Commerce Implementation Plan
**Omnichannel AI Agent Autonomous Testing, Competitor Intelligence & AI Live Studio**

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform DealMee from a conversational chatbot into a complete 24/7 Digital Sales Workforce by autonomously testing and polishing Omnichannel AI Agent (LINE, Facebook, Instagram), building Competitor Intelligence (Social Media Scraping), and launching DealMee AI Live Studio (OBS Overlay & 24/7 Live Stream Assistant).

**Architecture:** 
1. Omnichannel Layer: Multi-platform webhook ingestion (LINE, FB, IG Direct) feeding into the centralized `processSalesAgentChat` engine with dual-mode (Auto-reply & Copilot draft), PromptPay QR generator, and Human Takeover guard.
2. Competitor Intelligence: URL scraper & social media insights parser (TikTok, Instagram, Facebook) computing engagement benchmarks, viral hooks, and price monitoring.
3. AI Live Studio: Dynamic 60fps OBS Browser Source overlay (`/live/overlay/[shop_id]`) synchronized via Supabase Realtime to switch product cards and basket numbers automatically upon real-time live comments.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase (PostgreSQL + Realtime), Tailwind CSS v4, Lucide Icons, PromptPay QR, Meta Graph API v22.0.

---

### Task 1: Autonomous E2E Test Suite for Omnichannel AI Agent (Pillar 1)

**Files:**
- Create: `scratch/test_omnichannel_scenarios.ts`
- Target Database: Supabase `shops` (`JackShop`), `products`, `conversations`, `chat_messages`

**Step 1: Write the autonomous multi-turn scenario test script**
- Scenario 1: Customer Greeting & Bot Persona ("สวัสดีครับ" -> returns bot greeting with shop context).
- Scenario 2: Product Catalog & Carousel ("ขอดูเสื้อยืดหน่อย" -> returns `เสื้อยืดลายการ์ตูน` price 259 THB with stock 30).
- Scenario 3: Real-time Stock Check ("กางเกงยีนส์ขาม้า มีของไหม" -> checks real stock 15 pcs).
- Scenario 4: Ordering & PromptPay Flow ("สั่งซื้อเสื้อยืดลายการ์ตูน 1 ตัวครับ" -> creates order draft / returns payment QR prompt).
- Scenario 5: Human Takeover ("ขอคุยกับแอดมินครับ" -> updates `status: 'human'`, `paused_until: 1 hour`).
- Scenario 6: Takeover Protection (Customer sends "ยังอยู่ไหม" while paused -> AI engine does NOT reply, remains silent).
- Scenario 7: Auto-Resume / Explicit Reset ("/ai สวัสดีครับ" -> conversation status restored to `'ai'`, AI resumes answering).

**Step 2: Run autonomous test suite via tsx**
Run: `npx tsx --env-file=.env.local scratch/test_omnichannel_scenarios.ts`
Expected: 7/7 scenarios PASS with detailed output logs.

**Step 3: Commit verified test runner and test logs**
```bash
git add scratch/test_omnichannel_scenarios.ts
git commit -m "test: autonomous e2e test suite for omnichannel ai agent scenarios"
```

---

### Task 2: Instagram Direct Message Support (Pillar 1 Polish)

**Files:**
- Modify: `src/app/api/webhook/facebook/[shop_id]/route.ts`
- Modify: `src/app/api/test/facebook-webhook/route.ts`
- Test: `scratch/test_instagram_webhook.ts`

**Step 1: Enhance Facebook Webhook to support Instagram Direct**
- Update `body.object === 'page' || body.object === 'instagram'`.
- Detect platform from payload (`body.object === 'instagram' ? 'instagram' : 'facebook'`).
- In `conversations` and `chat_messages`, record `platform: 'instagram'`.
- Ensure `sendFacebookMessage` and typing indicator work seamlessly with Instagram IGSID (Instagram Scoped User ID).

**Step 2: Write test script for Instagram payload simulation**
- Send simulated Instagram webhook event with `object: "instagram"` and customer inquiry.
- Verify conversation is created with `platform: 'instagram'`.
- Verify AI reply is generated and logged correctly.

**Step 3: Run Instagram simulation test**
Run: `npx tsx --env-file=.env.local scratch/test_instagram_webhook.ts`
Expected: PASS with 200 OK and valid AI response.

**Step 4: Commit**
```bash
git add src/app/api/webhook/facebook/[shop_id]/route.ts scratch/test_instagram_webhook.ts
git commit -m "feat(omnichannel): add instagram direct message support to meta webhook"
```

---

### Task 3: Competitor Intelligence & Market Insights Module (Pillar 2)

**Files:**
- Create: `supabase/migrations/20261014000000_competitor_intelligence.sql`
- Create: `src/app/api/competitors/analyze/route.ts`
- Create: `src/app/dashboard/competitors/page.tsx`
- Create: `src/app/dashboard/competitors/CompetitorDashboardClient.tsx`
- Modify: `src/components/dashboard/Sidebar.tsx` (Add "ส่องร้านคู่แข่ง" menu item with icon)

**Step 1: Create Database Migration for Competitor Tracking**
- Table `competitors`: `id`, `shop_id`, `name`, `platform` (tiktok/facebook/instagram), `url`, `follower_count`, `avg_engagement_rate`, `price_range_min`, `price_range_max`, `tracked_at`.
- Table `competitor_posts`: `id`, `competitor_id`, `title`, `url`, `views`, `likes`, `comments`, `shares`, `estimated_sales`, `hashtags`, `published_at`.

**Step 2: Build Competitor Analysis API Route (`/api/competitors/analyze`)**
- Accepts `shop_id` and `target_url` (TikTok, IG, or FB).
- Implements platform URL parser and metadata extraction (inspired by `social-media-scraping-apis`).
- Computes Engagement Rate, Top Viral Content, Price Benchmarks, and AI Marketing Recommendation.

**Step 3: Build Premium UI for Competitor Dashboard (`/dashboard/competitors`)**
- Input card with instant URL preview and scan button.
- Comparison cards: DealMee Shop vs Tracked Competitors (Price positioning, Engagement, Posting frequency).
- Viral Posts Showcase: Top 5 viral posts with view counts, hooks, and engagement tags.
- AI Copilot Strategic Action: "แนะนำกลยุทธ์ตั้งราคาและแคปชั่นขายที่เหนือกว่าคู่แข่ง".

**Step 4: Write autonomous test script for Competitor Module**
Run: `npx tsx --env-file=.env.local scratch/test_competitor_analysis.ts`
Expected: Scrapes/analyzes target sample competitor and returns structured analytics.

**Step 5: Commit**
```bash
git add src/app/api/competitors src/app/dashboard/competitors src/components/dashboard/Sidebar.tsx
git commit -m "feat(competitors): add competitor intelligence and market scraping dashboard"
```

---

### Task 4: DealMee AI Live Studio & OBS Overlay (Pillar 3)

**Files:**
- Create: `supabase/migrations/20261014010000_live_studio_sessions.sql`
- Create: `src/app/live/overlay/[shop_id]/page.tsx`
- Create: `src/app/live/overlay/[shop_id]/LiveOverlayClient.tsx`
- Create: `src/app/api/live/comment/route.ts`
- Create: `src/app/dashboard/live-studio/page.tsx`
- Create: `src/app/dashboard/live-studio/LiveStudioClient.tsx`
- Modify: `src/components/dashboard/Sidebar.tsx` (Add "AI Live Studio" menu item)

**Step 1: Create Live Studio Sessions & Active Products Table**
- Table `live_sessions`: `id`, `shop_id`, `title`, `platform` (tiktok/facebook/shopee), `status` (active/ended), `current_basket_no`, `current_product_id`, `total_comments`, `total_cf_orders`.
- Table `live_basket_items`: `id`, `live_session_id`, `basket_no`, `product_id`, `custom_live_price`, `pin_status`.

**Step 2: Create OBS Browser Source Route (`/live/overlay/[shop_id]`)**
- Clean transparent background designed for OBS Studio Browser Source (1920x1080 or 1080x1920 9:16 mobile live format).
- Animated 60fps dynamic product card (basket number badge, product photo, title, slash regular price, highlight live price, stock counter).
- Realtime listening to Supabase channel `live_overlay_[shop_id]` for instant card transitions without page refresh.

**Step 3: Create Live Comment Processor API (`/api/live/comment`)**
- Accepts incoming live comment payload `{ shop_id, username, comment_text, platform }`.
- Regex/LLM parser for:
  - "ขอดูตะกร้า X" / "ตะกร้า X" -> switches active basket in overlay.
  - "CF [รหัส]" -> triggers automated Messenger/Direct checkout link.
- Broadcasts updated product state to OBS overlay channel in < 50ms.

**Step 4: Build Live Studio Controller in Dashboard (`/dashboard/live-studio`)**
- Studio control center: OBS Browser Source copy URL button, Basket lineup organizer, Real-time simulated comment feed tester, and active viewer engagement metrics.

**Step 5: Autonomous End-to-End Test for AI Live Studio**
- Simulate incoming comment: "ขอดูตะกร้า 2 หน่อยค่ะ" -> verify overlay state transitions to basket #2 product.
- Simulate incoming comment: "CF เสื้อยืดลายการ์ตูน" -> verify CF order event is generated.
Run: `npx tsx --env-file=.env.local scratch/test_live_studio_overlay.ts`
Expected: Realtime switch executed successfully in < 100ms.

**Step 6: Commit**
```bash
git add src/app/live src/app/dashboard/live-studio src/app/api/live
git commit -m "feat(live-studio): add dealmee 24/7 ai live studio and obs dynamic overlay"
```

---

### Task 5: Production Build Verification & Final Documentation Update

**Step 1: Run Next.js Type Check and Production Build**
Run: `npm run build`
Expected: Build successfully completes with 0 errors.

**Step 2: Update Master Documentation**
- Update `ROADMAP.md` and `PROJECT_STATUS.md` with tested results.
- Update `docs/AI_LIVE_AND_COMPETITIVE_INTELLIGENCE_PLAN.md` with implementation logs and verification proofs.

**Step 3: Final Commit & Push**
```bash
git add .
git commit -m "chore: complete omnichannel testing, competitor spy engine, and ai live studio foundation"
git push origin main
```
