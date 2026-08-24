---
name: Botify SaaS Web Design System
version: "1.0.0"
colors:
  primary: "#2E5BFF"
  primary_foreground: "#FFFFFF"
  secondary: "#1A1B4B"
  secondary_foreground: "#FFFFFF"
  accent: "#F0EFFD"
  accent_foreground: "#1A1B4B"
  background_light: "#F8FAFC"
  background_dark: "#0B0E14"
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

# Design System: Botify AI SaaS Web

## 1. Visual Theme & Atmosphere
Botify AI is a modern, high-precision SaaS platform designed for merchants and enterprise store managers managing autonomous AI Agents. The interface strikes a balance between **Cockpit Precision (Density 7/10)** for data tables, logs, and analytics, and **Airy Modernity (Variance 6/10)** with ambient depth layers and subtle blur backdrops.

The visual mood avoids generic corporate flatness through calibrated gradient orbs, frosted glass headers (`backdrop-blur-xl`), and crisp structural hairline borders (`border-outline-variant/30`).

---

## 2. Color Palette & Roles
- **Electric Blue (`#2E5BFF`)**: Primary accent and brand identity. Used for primary CTAs, active tab indicators, and focus rings.
- **Deep Indigo (`#1A1B4B`)**: Editorial heading contrast and secondary containers.
- **Merchant Canvas (`#F8FAFC`)**: Ultra-clean light background reducing eye strain.
- **Admin Dark Surface (`#0B0E14` / `#0F172A`)**: High-contrast dark theme container.
- **Success Emerald (`#10B981`)**: Real-time status indicators, positive growth metrics, verified badges.
- **Warning Amber (`#F59E0B`)**: Alert thresholds, low inventory, pending approval states.
- **Error Crimson (`#EF4444`)**: Destructive actions, system exceptions, disconnected status.
- **Whisper Border (`#E2E1EF` / `rgba(226, 225, 239, 0.4)`)**: Structural 1px separation lines without harsh contrast.

---

## 3. Typography Rules
- **Display & Headlines**: `IBM Plex Sans Thai` — SemiBold/Bold (600/700), tight letter tracking (`-0.01em` to `-0.02em`), compact leading.
- **Body Text**: `IBM Plex Sans Thai` — Regular/Medium (400/500), relaxed line-height (`1.5` to `1.6`), max line-length 65 characters.
- **Monospace / Numerical Data**: `Geist Mono` — Used for transaction IDs, order numbers, tokens, response times, and financial totals.
- **Anti-Patterns**: Never use uncalibrated serif fonts in dashboards. Maintain strict font size hierarchy across mobile and desktop.

---

## 4. Component Stylings
- **Buttons**: Rounded-xl (0.75rem), subtle shadow elevation (`shadow-sm hover:shadow-md`), tactile push feedback (`active:translate-y-[1px]`), smooth transition timing (`transition-all duration-200`).
- **Cards & Bento Grid**: Rounded-2xl (1rem), diffused whisper shadow (`shadow-[0_2px_12px_rgba(0,0,0,0.03)]`), hairline border (`border-outline-variant/30`), frosted glass overlay on ambient surfaces.
- **Drawers & Modals**: Slide-over drawer with backdrop blur (`backdrop-blur-md bg-slate-900/40`), sticky header and footer action bars, rounded top/side corners (1.5rem).
- **Forms & Inputs**: Label above input, clean focus ring in Electric Blue (`focus:ring-2 focus:ring-electric-blue/20`), inline validation messages with color-coded status.
- **Loaders & Skeletons**: Exact dimensional skeleton shimmers matching layout blocks (`animate-pulse bg-surface-container`), zero generic center spinners.

---

## 5. Layout Principles
- **Responsive Architecture**:
  - Desktop (>1024px): Fixed 288px (w-72) sidebar with fixed top bar blur.
  - Mobile (<1024px): Collapsible slide drawer with bottom navigation or hamburger trigger, minimum 44px touch targets.
- **Grid Layout**: 4-column Bento Grid on desktop, collapsing cleanly to 2 columns on tablet and 1 column on small mobile screens.
- **Container Sizing**: Max width `1440px` centered with dynamic edge gutters (`px-4 sm:px-6 md:px-8`).

---

## 6. Motion & Micro-Interactions
- **Spring Physics**: Smooth damping curves (`transition-all duration-200 ease-out`).
- **Status Indicators**: Real-time pulsating emerald dots (`animate-pulse`) for active AI agents and live websocket connections.
- **Interactive Feedback**: Hover zoom and icon translate micro-animations on interactive action buttons.

---

## 7. Anti-Patterns & Banned AI Clichés
- ❌ No fake hardcoded statistics (e.g. static "+12% this month" without real database calculation).
- ❌ No oversaturated neon purple glows or generic AI sparkle clichés without actual functionality.
- ❌ No mixed icon packs — standardize between Material Symbols and Lucide React.
- ❌ No generic "No data" empty states — always provide actionable illustrations and quick start buttons.
