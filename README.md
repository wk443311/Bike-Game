# Moto Rush 20 — 3D Telegram Mini App Bike Riding Game with Adsgram

A high-performance, mobile-first **3D motorcycle arcade racing game** engineered specifically for **Telegram Mini Apps** using **Three.js** with 20 distinct playable levels, 3rd-person chase camera, realistic physics and banking angles, local progress persistence, and strict policy-compliant **Adsgram Rewarded Ads** integration.

---

## 1. 3D Game Concept & Architecture

In **Moto Rush 20 3D**, players pilot a high-speed motorcycle down endless multi-lane 3D highways dodging oncoming and overtaking traffic:
- **3D Kinematics & Banking**: 3rd-person elevated chase camera with dynamic lateral inertia, frame-rate independent roll damping (bike leans up to ±24° on turns), realistic acceleration up to 215 km/h, responsive braking, and nitro boost.
- **Composite 3D Models**: 10-part procedural motorcycle (chassis, aerodynamic fairing, spoked front wheel, wide racing slick tire, dual chrome exhausts, 3D rider with visor helmet, and working forward spotlight).
- **3D Traffic**: Multiple distinct 3D vehicle models (sedans, wedge sportscars, SUVs, vans, cargo box trucks, chrome liquid tankers, city buses, and police interceptors with flashing sirens).
- **Procedural 3D Environment**: Asphalt texture with road markings, 3D W-beam metal crash barriers with reflective cat's eyes, and atmospheric horizon fog tailored to each level theme.
- **Near-Miss Scoring ("Close Pass")**: Overtaking within tight lateral clearance at high speed triggers spark particle bursts, combo multipliers, Telegram haptics, and audio chimes.
- **Audio Synthesizer**: Procedural Web Audio API sound engine (speed-synchronized pitch, brake screech, nitro roar, crash explosion, fanfare).
- **Telegram Native**: WebApp SDK initialization, auto-expansion, dark theme integration, and Telegram Haptic Feedback (`impactOccurred`, `notificationOccurred`).

---

## 2. Exactly 20 Playable Levels

The game features 20 distinct stages with progressive road parameters:

| Level | Title | Distance | Lanes | Environment | Traffic Profile |
|:---|:---|:---|:---|:---|:---|
| 1 | Dawn Boulevard | 800m | 3 | Dawn | Commuter sedans, wide spacing |
| 2 | Suburban Arterial | 1,000m | 3 | Day | Sedans and family SUVs |
| 3 | City Bypass | 1,200m | 3 | Day | Delivery vans and cabs |
| 4 | Industrial Corridor | 1,400m | 4 | Sunset | Box cargo trucks |
| 5 | Rainy Expressway | 1,600m | 4 | Rain | Wet road, oil slicks |
| 6 | Neon Coastal Parkway | 1,800m | 4 | Sunset | Weaving sports cars |
| 7 | Downtown Gridlock | 2,000m | 4 | Night | Dense yellow cabs and buses |
| 8 | Freightway 99 | 2,200m | 4 | Night | Heavy fuel tankers |
| 9 | Golden Gate Mist | 2,500m | 4 | Fog | High-speed highway cruisers |
| 10 | Metropolis Underpass | 2,800m | 4 | Night | Subterranean neon tunnel |
| 11 | Thunderstorm Turnpike | 3,000m | 4 | Rain | Heavy rain, erratic braking |
| 12 | Metro Ringway Express | 3,200m | 5 | Day | Interceptor police cruisers |
| 13 | Harbor Logistics Run | 3,500m | 4 | Dawn | Multi-axle container carriers |
| 14 | Midnight Canyon Run | 3,800m | 4 | Night | Pitch-black mountain curves |
| 15 | Cyber Skyline Arterial | 4,000m | 5 | Cyber | Holographic speedway lanes |
| 16 | Alpine Blind Pass | 4,200m | 4 | Fog | Dense fog, short reaction time |
| 17 | Interstate Megastructure | 4,500m | 5 | Sunset | 5-lane chaotic traffic |
| 18 | Outrun Autobahn | 4,800m | 5 | Night | 140 km/h hypercars |
| 19 | Typhoon Causeway | 5,000m | 4 | Rain | Pounding squalls, road cones |
| 20 | Grand Prix Finale | 5,500m | 5 | Cyber | Ultimate championship endurance |

---

## 3. Strict Adsgram Rewarded Ad Compliance

The application strictly enforces all official Adsgram policies and developer guidelines:

1. **Single Voluntary Placement**: Adsgram is integrated **exclusively** on the Game Over modal as an optional "Watch Ad & Continue" button.
2. **Zero Forced Ads**: No advertisements are ever triggered automatically upon game launch, stage start, or button clicks.
3. **Instant Free Restart**: The "Restart Level" button is always free, instant, and never gated or delayed if an advertisement is declined.
4. **Verified Reward Fulfillment**: Gameplay is resumed **strictly** when the Adsgram SDK confirms successful video completion (`result.done === true`). Skips or premature closes yield zero reward with clear feedback.
5. **Anti-Exploit Single Continue**: A maximum of **one** continue is permitted per level attempt.
6. **Post-Revival Safety**: Continuing restores the bike to a safe center position, clears any traffic within 300px ahead, and equips a **3.5s golden invulnerability shield** to prevent repeat collision traps.

---

## 4. Setup & Deployment Instructions

### Prerequisites
- Node.js 18+
- npm or bun

### Local Development
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start development server
npm run dev
```

### Vercel Deployment
1. Import the repository into your Vercel Dashboard.
2. Framework Preset: **Vite**.
3. Build Command: `npm run build`.
4. Output Directory: `dist`.
5. In Project Settings -> Environment Variables:
   - `VITE_ADSGRAM_BLOCK_ID`: Your Adsgram Rewarded Ad block ID.
   - `VITE_TELEGRAM_BOT_USERNAME`: Your bot's handle (e.g. `MotoRush20Bot`).

---

## 5. Telegram Bot Integration

1. Open Telegram and message [@BotFather](https://t.me/BotFather).
2. Create your bot with `/newbot`.
3. Create a Mini App with `/newapp`:
   - Select your bot.
   - Provide Title and Description.
   - Enter your deployed HTTPS URL (e.g., `https://your-app.vercel.app`).
   - Choose a short name (e.g., `play`).
4. Users can now launch the game inside Telegram via `https://t.me/<your_bot_username>/<short_name>`.

---

## 6. Testing & Compliance Verification

- [x] All 20 levels unlock progressively (Level N unlocks upon Level N-1 completion).
- [x] LocalStorage saves coins, high scores, and unlocked bikes safely.
- [x] Adsgram SDK triggers only on explicit user click.
- [x] Free restart works with zero ad requirement.
- [x] Responsive on desktop (1440x900) and mobile (390x844).
- [x] Autostart parameter `?autostart=1` skips directly into gameplay.
