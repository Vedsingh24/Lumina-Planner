# Lumina Planner: API Cost & Security Analysis

When deploying an LLM-powered application like Lumina Planner, understanding the economic unit economics and security posture is critical. Here is a breakdown of your projected costs and vulnerabilities using **Gemini 2.5 Flash**.

## 1. Projected Cost for Maximum Daily Usage (Per User)

Assuming a "power user" utilizing the app to its maximum intended extent:

### Chat Interface (`processAgenda`)
- **Usage Profile**: 50 chat interactions per day.
- **Input Tokens**: ~250 tokens per request (System Prompt + JSON Schema + User Input).
- **Output Tokens**: ~150 tokens per request (Conversational reply + parsed Task JSON).
- **Daily Tokens**: 12,500 Input | 7,500 Output

### AI Insights (`generateInsights`)
- **Usage Profile**: 2 generations per day (Hard limited in UI).
- **Input Tokens**: ~800 tokens per request (System Prompt + User Stats + Previous Insights History).
- **Output Tokens**: ~250 tokens per request (4 highly detailed JSON insights).
- **Daily Tokens**: 1,600 Input | 500 Output

### Total Cost Per User (Gemini 2.5 Flash Pricing)
*Current approximate pricing: $0.075 per 1M Input Tokens / $0.30 per 1M Output Tokens.*

- **Daily Tokens**: ~14,100 Input | ~8,000 Output
- **Monthly Tokens**: ~423,000 Input | ~240,000 Output
- **Cost Per User / Month**: **~$0.10**

> [!TIP]
> **Conclusion**: Normal usage is incredibly cheap. 1,000 highly active users would cost you roughly **$100 per month**.

---

## 2. Are the Current Guardrails Enough?

> [!CAUTION]
> **NO. The current architecture is highly vulnerable to malicious abuse and cost ballooning.**

Currently, Lumina Planner is a client-side Vite/Electron application. Your API key (`process.env.API_KEY`) is being bundled and shipped directly in the client code.

**The Threat (API Key Extraction):**
A malicious user does not need to use your UI. They can inspect the compiled application (or network requests), extract your Google Gemini API key, and use it in their own Python scripts to run massive LLM jobs entirely at your expense. 

Even without extracting the key, a user could write an automated script to spam the Chat interface 10 times a second. A single malicious script could generate 100+ million tokens a day, costing you **$50+ per day per attacker**.

The current `localStorage` limit of 2 insights per day only stops *polite* UI usage; it can be bypassed instantly by clearing browser data or sending custom HTTP requests.

---

## 3. Stratagems to Employ Before Deployment

To safely deploy Lumina Planner commercially, you must implement the following strategies:

### A. The Backend Proxy (Crucial)
**Do not ship the API key.** You must create a lightweight backend (e.g., Node.js/Express, Vercel Serverless Function, or Cloudflare Worker). 
- Lumina Planner sends the user's text to your backend.
- Your backend securely attaches the API key and forwards the request to Google.
- The backend returns the response to Lumina Planner.

### B. Server-Side Rate Limiting
Once traffic flows through your backend, you can tie requests to a User Account (via authentication) or IP address.
- **Enforce strict server quotas**: Limit chat messages to 100/day per user.
- **Enforce insight limits**: Reject insight requests if the user has already requested 2 that day.

### C. Bring Your Own Key (BYOK) Model
If you do not want to pay for server infrastructure or API costs, you can add a settings menu where users paste their *own* Google Studio API key. 
- The app stores it securely in Electron `localStorage`.
- All requests use the user's key.
- **Result**: You pay $0. Zero DDOS risk to your wallet.

### D. Billing Alarms (Last Line of Defense)
In your Google Cloud Console, set a strict **Billing Budget Alarm**. If your API costs hit $20 in a month, Google Cloud can automatically disable the API. This ensures that even if you miss a vulnerability, you will never wake up to a $5,000 bill.

---

## 4. Token Optimization Effectiveness (Before vs. After)

We just applied three strict token-limiting optimizations inside the client code. Here is how they protect your baseline unit economics, modeling a user who has used the app for **1 year (365 days)**:

### 🔴 BEFORE (Unoptimized)
- **Infinite Payload Ballooning**: The `completionTrend` statistics grew every single day. After a year, the app would send 365 days of data on *every single request*.
- **Verbose Context**: Passing back the previous insights included Tailwind CSS strings, SVG icon mappings, and verbose reasoning.
- **Uncapped Output**: The LLM could theoretically generate 8,000+ output tokens if it hallucinated.
- **Estimated Input Tokens (At 1 Year)**: ~10,000+ tokens *per request*.
- **Cost**: Your daily insight cost for an old user would be **12x higher** than a new user.

### 🟢 AFTER (Optimized)
- **Aggressive Truncation**: `completionTrend` is strictly sliced to the last 14 days. This keeps the token payload completely flat, whether the user has been using the app for 2 weeks or 5 years.
- **Minified Context**: Previous insights are stripped down to a barebones `{ "title": "..." }` array. This cuts the historical token weight by **~80%**.
- **Hard Output Caps**: `maxOutputTokens` is locked at 500-600. The LLM is physically blocked from generating more than that, preventing runaway generation costs.
- **Estimated Input Tokens (At 1 Year)**: Capped at **~800 tokens** per request indefinitely.

> [!TIP]
> **The Result**: These client-side optimizations ensure that your API payload **scales flatly at O(1)** rather than growing linearly over time. You have effectively reduced long-term user insight costs by **over 90%**!
