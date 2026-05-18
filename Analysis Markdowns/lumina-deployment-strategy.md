# Lumina Planner: Product Strategy & Deployment Roadmap

This document outlines the comprehensive strategy for transitioning Lumina Planner from a local React/Electron project into a commercial, cross-platform product with a cloud-sync SaaS component.

---

## 1. Executive Summary

The productivity software market is highly lucrative but competitive, dominated by giants like Notion and Todoist, and niche premium apps like Things 3. Lumina Planner distinguishes itself by combining **AI-driven task parsing** with a **visually stunning, premium UI**. 

The goal is to deploy Lumina across Desktop (Windows/Mac/Linux) and Mobile (iOS/Android) using a single, unified codebase, introducing a one-time purchase model for offline use, and an optional SaaS subscription for cloud synchronization and advanced AI features.

---

## 2. Technical Architecture: The "Write Once, Run Anywhere" Strategy

To achieve native-feeling applications across all platforms without maintaining multiple codebases, we will adopt a hybrid-native approach.

### 2.1 Framework Selection
Your current stack is React + Vite + Tailwind. This is an excellent foundation. We will wrap this core using industry-standard native bridges:
*   **Desktop (Windows, macOS, Linux):** Keep the current **Electron** implementation for Phase 1 to ensure rapid deployment. For long-term optimization (reducing RAM usage and app size from 100MB+ to ~10MB), migrating to **Tauri (Rust-based)** is recommended.
*   **Mobile (iOS, Android):** Use **Capacitor.js**. Capacitor drops your React web app into a native mobile shell, giving you full access to device APIs (camera, haptics, notifications) while reusing 95% of your desktop UI code.

### 2.2 Data Sync & SaaS Infrastructure
Currently, Lumina uses a local SQLite database (`better-sqlite3`). To introduce the SaaS component (cross-device sync), we must implement a **Local-First Sync Architecture**.
*   **Backend Provider:** **Supabase** (Postgres). It offers an open-source Firebase alternative with excellent React support, built-in Authentication, and Realtime database capabilities.
*   **Sync Logic:** Replace direct `better-sqlite3` calls with a local-first database like **RxDB** or **WatermelonDB**. These databases store data locally (so the app works offline instantly) and automatically sync with Supabase in the background whenever the user has internet access.

### 2.3 Ensuring Consistent UX Across Platforms
*   **Responsive Design:** Tailwind classes must be rigorously tested using CSS grid/flexbox to ensure the Kanban board and schedule views elegantly collapse into single columns on mobile.
*   **Interaction Paradigms:** Ensure drag-and-drop libraries (like Framer Motion) support mobile touch events just as well as desktop mouse events.
*   **Platform-Specific Tweaks:** Use Capacitor's device detection to render iOS-style bottom navigation bars on iPhones, while keeping the sidebar/topbar for Desktop.

---

## 3. Staggered Development Timeline

Based on the goal of launching Phase 1 by the end of May and Phase 2 by the end of June, here is the realistic feature-timeline matrix.

### Phase 1: The Premium Desktop Launch (Target: End of May)
**Objective:** Launch a standalone, offline-first Desktop app generating immediate revenue.
*   **Technical:** Finalize Electron build, fix any remaining UI bugs, polish the "wow factor" animations. No cloud sync yet.
*   **Monetization:** Integrate **Lemon Squeezy** for license key generation.
*   **Distribution:** Gumroad / Lemon Squeezy storefront, personal marketing, Product Hunt launch.
*   **Price:** Static one-time purchase.

### Phase 2: Mobile & Cloud SaaS Launch (Target: End of June)
**Objective:** Release iOS and Android apps, introduce user accounts, and launch the recurring revenue subscription model.
*   **Technical (Weeks 1-2):** Integrate Supabase Auth. Migrate local SQLite to a local-first sync engine (RxDB/Supabase Realtime). 
*   **Technical (Weeks 3-4):** Wrap React app in Capacitor. Compile via Xcode (macOS required) and Android Studio. Submit to App Stores (Review process takes 2-7 days).
*   **Monetization:** Introduce paywalls for syncing.
*   **Distribution:** Apple App Store, Google Play Store.

---

## 4. Business & Monetization Model

### 4.1 Competitive Market Analysis
*   **Todoist:** Freemium -> $5/month (Subscription only).
*   **Things 3:** One-time purchase ($50 Mac, $10 iPhone, $20 iPad) = ~$80 total. No subscription. Minimalist, Apple-only.
*   **TickTick:** Freemium -> $36/year. High feature density.

### 4.2 Proposed Hybrid Pricing Strategy
To maximize conversion and build a sustainable business, we will use a **Hybrid SaaS Model**:

*   **Tier 1: Lumina Solo (One-Time Purchase - Phase 1)**
    *   **Price:** **$29 one-time**
    *   **Features:** Full desktop app, local SQLite storage, basic AI task parsing (using user's own API key or a strict rate limit). No cloud sync.
    *   **Target:** Users fatigued by subscriptions (the "Things 3" demographic).

*   **Tier 2: Lumina Cloud/Pro (SaaS Subscription - Phase 2)**
    *   **Price:** **$4.99/month** or **$49/year**
    *   **Features:** Everything in Solo + Cross-device sync via Supabase, Mobile app access, Unlimited premium AI chat/parsing, encrypted cloud backups.
    *   **Target:** Power users who need their planner on their phone and PC.

### 4.3 Payment & Distribution Platforms
*   **Desktop Sales (Lemon Squeezy):** We will use Lemon Squeezy as the Merchant of Record. They charge **5% + $0.50 per transaction**, handle global VAT taxes automatically, and provide an API for license key generation to prevent piracy.
*   **Mobile Sales:** Apple App Store and Google Play Store mandate using their payment systems for in-app subscriptions, taking a **15% cut** (for developers earning under $1M/yr). 

---

## 5. Financial Projections & Costs

### 5.1 Infrastructure Costs (First 6 Months)
*   **Supabase:** Free tier (up to 50k users, 500MB DB). Upgrade to Pro is **$25/month** when scaling.
*   **Apple Developer Account:** $99/year.
*   **Google Play Account:** $25 one-time.
*   **Domain & Hosting (Landing Page):** ~$20/year.
*   **Total Fixed Costs:** Highly economical, < $150 to launch.

### 5.2 Earnings Projections (First 12 Months)
These estimates assume active marketing on Twitter/X, Reddit (r/productivity), TikTok, and a successful Product Hunt launch.

#### 📉 Conservative Scenario
*   **Assumptions:** Minimal marketing reach, slow mobile adoption.
*   **Sales:** 50 Desktop licenses/month + 20 new SaaS subscribers/month.
*   **Revenue (Month 6):** $1,450 (Desktop) + $499 (MRR) = **~$1,950 / month**
*   **Annual Run Rate:** ~$20,000

#### 📊 Realistic Scenario
*   **Assumptions:** Solid Product Hunt launch, consistent organic traffic, 5% conversion rate to paid.
*   **Sales:** 150 Desktop licenses/month + 75 new SaaS subscribers/month.
*   **Revenue (Month 6):** $4,350 (Desktop) + $1,870 (MRR) = **~$6,220 / month**
*   **Annual Run Rate:** ~$65,000 - $80,000

#### 🚀 Optimistic Scenario
*   **Assumptions:** Viral marketing video, featured on App Store, influencer shoutouts.
*   **Sales:** 500 Desktop licenses/month + 300 new SaaS subscribers/month.
*   **Revenue (Month 6):** $14,500 (Desktop) + $7,485 (MRR) = **~$21,985 / month**
*   **Annual Run Rate:** ~$250,000+

---

## 6. Next Steps & Action Items

1.  **Lock Desktop Codebase:** Finalize UI/UX. Ensure no glaring bugs exist in the Kanban and Schedule views.
2.  **Integrate Lemon Squeezy:** Add an activation screen on app boot that requires a valid license key.
3.  **Deploy Landing Page:** Build a high-converting website showcasing the UI.
4.  **May 31 Launch:** Release Desktop version on Product Hunt.
5.  **Begin Supabase Integration:** Start wiring the data models to Supabase schemas immediately after Desktop launch.
