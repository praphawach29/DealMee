# DealMee 24/7 AI Live Studio & Auto CF Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate DealMee's AI Live Studio into a commercial-grade, multi-platform livestream sales automation suite featuring an AI Thai CF extraction engine with automated Supabase order creation, instant PromptPay QR checkout generation, 60fps dynamic OBS overlay with viral CF purchase alerts, and a 1-click AI Host Teleprompter powered by Gemini.

**Architecture:**
1. **AI Thai CF Parser & Real-Time Order Engine (`liveStudioEngine.ts`):**
   - Parses complex Thai live comments (basket number, product keyword, quantity, e.g. "CF 1", "CF เสื้อยืด 2 ตัว", "รับ 2 ชิ้น พร้อมโอน").
   - Automatically inserts a live order into the `orders` table (`status: 'pending'`, `platform: 'live_stream'`, `total_amount: price * qty`, `payment_method: 'promptpay'`).
   - Generates a real PromptPay QR code (`generatePromptPayQRImage`) and direct checkout DM response.
   - Calculates and tracks live streaming metrics (`total_cf_revenue`, `total_cf_orders`, `total_comments`).
2. **AI Live Host Teleprompter & Sales Pitch Generator (`/api/live/pitch`):**
   - Uses Gemini with intelligent fallback to generate 15-second high-energy hooks, value props, objection deflections, and urgency FOMO closings for any pinned basket.
3. **OBS Dynamic Overlay (`/live/overlay/[shop_id]`):**
   - Ultra-responsive transparent widget with animated product switching and glowing viral CF purchase notifications ("🎉 คุณ [ชื่อ] เพิ่ง CF ตะกร้า #[X]! เหลือ [Y] ชิ้น").
4. **Live Studio Controller UI (`/dashboard/live-studio`):**
   - Real-time live revenue ticker, AI host teleprompter card, simulated customer DM checkout preview with PromptPay QR, and quick-switch basket lineup.
5. **Superpowers Evidence-Based Verification (`scratch/verify_live_studio.ts`):**
   - Multi-scenario integration tests, TypeScript type checks, ESLint, and browser subagent visual walkthrough.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Supabase PostgreSQL, `promptpay-qr`, `qrcode`, Gemini API.

**Spec:** Commercial AI Live Selling & Auto-CF Automation Suite for DealMee SaaS.

## Global Constraints
- OBS Overlay polling response: Sub-50ms using in-memory state cache with Supabase background persistence.
- Zero TypeScript (`tsc --noEmit`) and ESLint compilation errors.
- Graceful offline fallback: Functions without crashes even if Gemini API key or external service is unreachable.
- Responsive design: Dashboard controller works smoothly on desktop, tablet, and mobile.

## Review Focus
- CF Quantity & Basket matching: "CF 2 3 ตัว" extracts basket #2 and quantity 3, correctly multiplying live price.
- Live Order creation in database: Order record created with valid `order_no`, `shop_id`, customer info, and total amount.
- PromptPay QR accuracy: Generated QR payload includes the shop's PromptPay ID and the exact order total.
- OBS Overlay celebration alert: New CF event triggers an attention-grabbing toast without disrupting active product card display.
- Teleprompter pitch freshness: AI host script provides persuasive, natural Thai phrasing tailored to the active basket product.

---

### Task 1: AI Thai CF Engine & Automated Database Order Creation

**Files:**
- Modify: `src/lib/live/liveStudioEngine.ts`
- Test: `scratch/test_live_cf_orders.ts`

**Interfaces:**
- Updates `LiveSessionState` with `total_cf_revenue: number` and `latest_cf_order?: LiveOrderSummary`.
- Updates `processLiveComment` to:
  - Extract product basket and quantity (`qty >= 1`).
  - Calculate `total_amount = basket.live_price * qty`.
  - Fetch shop's `promptpay_number` / `promptpay_id`.
  - Insert order record into Supabase `orders` table.
  - Generate PromptPay QR data URL via `generatePromptPayQRImage`.
  - Update `total_cf_revenue` and `total_cf_orders`.

- [x] **Step 1: Write unit test for Thai CF parser and order creation**
- [x] **Step 2: Run test to verify initial failure / gaps**
- [x] **Step 3: Enhance `liveStudioEngine.ts` with quantity regex, DB order insertion, and PromptPay QR generation**
- [x] **Step 4: Run test to verify it passes with 100% assertions**

---

### Task 2: AI Live Host Teleprompter & Sales Pitch Generator

**Files:**
- Modify: `src/lib/live/liveStudioEngine.ts` (add `generateHostPitch`)
- Create: `src/app/api/live/pitch/route.ts`
- Test: `scratch/test_live_pitch.ts`

**Interfaces:**
- Interface `LiveHostPitch`:
  ```typescript
  export interface LiveHostPitch {
    hook15s: string
    sellingPoints: string[]
    urgencyClosing: string
    faqAnswers: { question: string; answer: string }[]
  }
  ```
- Function `generateHostPitch(product: LiveBasketItem, shopName?: string): Promise<LiveHostPitch>`
- API endpoint `POST /api/live/pitch`: `{ shop_id: string, basket_no: number }` -> returns `{ success: true, pitch: LiveHostPitch }`

- [x] **Step 1: Write test for `generateHostPitch`**
- [x] **Step 2: Run test and observe failures**
- [x] **Step 3: Implement `generateHostPitch` using Gemini API with deterministic Thai sales psychology fallback**
- [x] **Step 4: Implement `/api/live/pitch/route.ts`**
- [x] **Step 5: Run test to verify pitch generation passes**

---

### Task 3: OBS Dynamic Overlay Enhancements (Celebration Alert & FOMO FX)

**Files:**
- Modify: `src/app/live/overlay/[shop_id]/LiveOverlayClient.tsx`

**Features:**
- Add animated floating purchase banner when `state.latest_cf_order` updates:
  "🎉 คุณ [ชื่อ] เพิ่ง CF ตะกร้า #[X]! เหลืออีกเพียง [Y] ชิ้น!"
- Add dynamic badge for live discount savings.
- Ensure 60fps hardware-accelerated animations for OBS browser capture.

- [x] **Step 1: Update `LiveOverlayClient.tsx` to display CF celebration banners and live saving badges**
- [x] **Step 2: Test in browser or component render**

---

### Task 4: Live Studio Controller UI Overhaul

**Files:**
- Modify: `src/app/dashboard/live-studio/LiveStudioClient.tsx`

**Features:**
- Add **Live Sales & Revenue Ticker** (Total Live Revenue ฿, Total CF Orders, Viewer Engagement).
- Add **AI Host Teleprompter Card** with 1-click "สร้างสคริปต์พูดสดด้วย AI", displaying the 15-second hook, bullet points, and copy button.
- Add **Customer DM Checkout Preview Modal** showing the simulated direct message with PromptPay QR and checkout link sent to the buyer.
- Add quick basket price editing and 1-click pin toggles.

- [x] **Step 1: Enhance `LiveStudioClient.tsx` with revenue metrics, teleprompter, and DM preview**
- [x] **Step 2: Connect Teleprompter to `/api/live/pitch`**

---

### Task 5: Comprehensive Superpowers Verification Suite

**Files:**
- Create: `scratch/verify_live_studio.ts`

- [x] **Step 1: Write automated end-to-end integration script testing:**
  - Basket switching by number ("ขอดูตะกร้า 2")
  - Basket switching by keyword ("ขอดูเสื้อยืด")
  - Multi-quantity CF extraction ("CF 1 2ตัว") and real database order insertion
  - PromptPay QR generation and payload accuracy
  - AI Host Pitch generation endpoint
- [x] **Step 2: Run `scratch/verify_live_studio.ts` and inspect full execution output**
- [x] **Step 3: Run `npx tsc --noEmit` and confirm 0 TypeScript errors**
- [x] **Step 4: Run `npx eslint src` and confirm 0 lint errors**
- [x] **Step 5: Run visual browser verification using `browser_subagent` to test the Live Studio controller and OBS overlay**
