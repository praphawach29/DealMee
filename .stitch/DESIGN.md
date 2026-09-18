---
name: DealMee AI Design System
brand: DealMee AI (DealMee.app)
version: "2.0.0"
updated: "2026-09-18"
colors:
  primary: "#2E5BFF"
  primary_foreground: "#FFFFFF"
  secondary: "#00CFEC"
  secondary_dark: "#1A1B4B"
  accent: "#F0EFFD"
  accent_foreground: "#1A1B4B"
  background_light: "#F8FAFC"
  background_dark: "#060C1B"
  surface_light: "#FFFFFF"
  surface_dark: "#0F172A"
  border_light: "#E2E1EF"
  border_dark: "#1E293B"
  success: "#10B981"
  warning: "#F59E0B"
  error: "#EF4444"
typography:
  font_family_display: "IBM Plex Sans Thai, sans-serif"
  font_family_body: "IBM Plex Sans Thai, sans-serif"
  font_family_mono: "Geist Mono, monospace"
---

# Design System: DealMee AI SaaS Web (DealMee.app)

## 1. Visual Theme & Atmosphere
DealMee AI is a modern, high-precision Conversational Commerce & AI Sales Agent platform designed for Thai merchants, enterprise store managers, and B2B sellers. The interface strikes an intentional balance between **Cockpit Precision (Density 7/10)** for data tables, order management, stock, and logs, and **Airy Modernity (Variance 6/10)** with ambient depth layers, frosted glass headers, and subtle blur backdrops.

The visual mood avoids generic corporate flatness through calibrated gradient accents (**Electric Blue + Cyber Cyan**), frosted glass overlays (`backdrop-blur-xl`), and crisp structural hairline borders (`border-outline-variant/30`).

---

## 2. Color Palette & Roles
- **Electric Blue (`#2E5BFF`)**: Primary accent and brand identity. Used for primary CTAs, active tab indicators, and focus rings.
- **Cyber Cyan (`#00CFEC`)**: Secondary AI accent. Highlights AI badges, glow effects, and modern tech accents.
- **Deep Indigo / Cosmic Navy (`#060C1B` / `#1A1B4B`)**: Hero background on landing, editorial heading contrast, and secondary containers.
- **Merchant Canvas (`#F8FAFC`)**: Ultra-clean light background reducing eye strain for hours of daily dashboard use.
- **Admin Dark Surface (`#0B0E14` / `#0F172A`)**: High-contrast dark theme container.
- **Success Emerald (`#10B981`)**: Real-time status indicators, paid orders, positive sales growth metrics, verified bank slips.
- **Warning Amber (`#F59E0B`)**: Alert thresholds, low inventory, pending orders awaiting payment.
- **Error Crimson (`#EF4444`)**: Destructive actions, system exceptions, rejected/fake slips, disconnected status.
- **Whisper Border (`#E2E1EF` / `rgba(226, 225, 239, 0.4)`)**: Structural 1px separation lines without harsh contrast.

---

## 3. Typography Rules
- **Display & Headlines**: `IBM Plex Sans Thai` — SemiBold/Bold (600/700), tight letter tracking (`-0.01em` to `-0.02em`), compact leading.
- **Body Text**: `IBM Plex Sans Thai` — Regular/Medium (400/500), relaxed line-height (`1.6` to `1.65`) to prevent vertical Thai tone mark collision.
- **Monospace / Numerical Data**: `Geist Mono` — Used for transaction IDs, order numbers (`ORD-509098`), bank slip reference codes, pricing figures (`฿3,260.00`), and timestamps.
- **Anti-Patterns**: Never use uncalibrated serif fonts in dashboards. Maintain strict font size hierarchy across mobile and desktop.

---

## 4. Component Stylings
- **Buttons**: Rounded-xl (0.75rem), subtle shadow elevation (`shadow-md shadow-electric-blue/20`), tactile push feedback (`active:scale-[0.98]`), smooth transition timing (`transition-all duration-150`).
- **Cards & Bento Grid**: Rounded-2xl (1rem), diffused whisper shadow (`shadow-[0_2px_12px_rgba(0,0,0,0.03)]`), hairline border (`border-outline-variant/30`), frosted glass overlay on ambient surfaces.
- **Drawers & Modals**: Slide-over drawer with backdrop blur (`backdrop-blur-md bg-slate-900/40`), sticky header and footer action bars, rounded top/side corners (1.5rem).
- **Forms & Inputs**: Label above input, clean focus ring in Electric Blue (`focus:ring-2 focus:ring-electric-blue/20`), inline validation messages with color-coded status.
- **Order Badges**: Rounded-lg, font-bold, text-xs, with colored background, text, and border (e.g. `bg-emerald-50 text-emerald-700 border-emerald-200` for paid).

---

## 5. Layout Principles
- **Responsive Architecture**:
  - Desktop (>1024px): Fixed 288px (w-72) sidebar with fixed top bar blur.
  - Mobile (<1024px): Collapsible slide drawer with bottom navigation or hamburger trigger, minimum 44px touch targets.
- **Grid Layout**: 4-column Bento Grid on desktop, collapsing cleanly to 2 columns on tablet and 1 column on small mobile screens.
- **Container Sizing**: Max width `1440px` centered with dynamic edge gutters (`px-4 sm:px-6 md:px-8`).

---

## 6. Anti-Patterns & Banned AI Clichés
- ❌ No fake hardcoded statistics (e.g. static "+12% this month" without real database calculation).
- ❌ No oversaturated neon purple glows or generic AI sparkle clichés without actual functionality.
- ❌ No mixed icon packs — standardize with Lucide React.
- ❌ No generic "No data" empty states — always provide actionable illustrations and quick start buttons.
