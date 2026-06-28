# StreetVoice — Product Requirements Document

**Built for:** Vibe2Ship Hackathon 2026
**Author:** Solo build
**Status:** Functional prototype, pre-deployment
**Last updated:** June 28, 2026

---

## 1. The Problem, Before Any Technology

A citizen notices a pothole, a broken streetlight, an overflowing bin, a live wire hanging over a flooded footpath. They've seen it for weeks. They probably won't report it — not because they don't care, but because every available channel for reporting it has already taught them it doesn't work. A phone call that goes nowhere. A form with no tracking number. A complaint that vanishes into a system with no visible owner and no visible outcome.

That's the actual problem StreetVoice is built against: **not a lack of infrastructure problems, but a broken feedback loop around reporting them.** Citizens stop reporting not from apathy, but from a justified belief that reporting changes nothing. Civic issue reporting in most Indian cities is slow, fragmented, and — critically — *invisible*. A citizen who reports an issue has no way to see whether anyone else reported the same thing, whether the right department even knows about it, or whether "resolved" means anything more than a status someone typed once and forgot.

This matters beyond any one pothole. A community that has learned reporting doesn't work disengages from civic participation broadly — and a municipal system with no visibility into where problems cluster can't allocate resources intelligently even when it wants to. The cost of a broken feedback loop compounds quietly over years.

**Only after sitting with that problem does AI become relevant** — not as the headline feature, but as the thing that removes friction at exactly the points where citizens currently give up: translating a messy voice complaint into something actionable, checking for duplicates before a citizen wastes effort, identifying who should actually own an issue, and making the whole thing visible enough that "resolved" has to mean something to a watching community.

This prototype was built solo against an assigned problem statement for Vibe2Ship Hackathon 2026 — a deliberate, focused attempt to close that loop end to end, not just demonstrate a single clever AI trick.

## 2. Target Users

- **Citizens** reporting infrastructure issues in their neighborhood, in English, Hindi, or mixed Hinglish, via text, photo, or voice — the primary loop StreetVoice is built around.
- **Community verifiers** — other citizens who confirm reports, comment, upload supporting evidence, or mark an issue's real-world status, building public accountability without waiting for a municipal officer to act first.
- **Civic-minded sharers** — citizens who use generated awareness posters to push visibility on unresolved issues through their own social networks, applying pressure outside the platform itself.

*(This prototype does not yet have a municipal-officer-facing dashboard — see Section 8, Out of Scope. Community-driven status tracking is the current substitute for that missing loop.)*

## 3. Why AI Agents, Not One Generic Prompt

It would have been faster to build a single prompt: *"Here's a citizen complaint, categorize it and write a sympathetic response."* That approach was deliberately rejected, for a concrete reason: **a single generic prompt optimizes for sounding helpful, not for doing several genuinely different jobs correctly.**

Cleaning messy multilingual speech, scoring photo evidence for severity, checking for duplicate reports against existing data, identifying a specific responsible department, and calculating a fair (not flat) reward each require different context, different output shapes, and different failure modes. A single prompt handling all of this either does each job shallowly, or becomes so long and overloaded that it's unreliable and hard to debug. Splitting these into seven focused agents — each with one job, a tight prompt, and a specific point in the product where it's actually called — means each agent can be tested, reasoned about, and improved independently. That's the practical argument for agentic depth over a chatbot loop: **specialization is not aesthetic, it's reliability.**

## 4. Goals

| Goal | Why it matters |
|---|---|
| Lower the friction of filing a civic complaint | Voice input + AI-assisted extraction means a citizen speaks naturally instead of correctly filling out a structured form |
| Make civic participation visible and rewarding | StreetCredits + leaderboard turn one-off reporting into repeat engagement, with AI-calculated rewards reflecting actual effort |
| Give reports a public, geographic presence | A live map makes clusters of unresolved issues visible to anyone, not just the original reporter |
| Close the resolution loop, not just the reporting loop | Community-driven status tracking means "resolved" is a real, visible claim someone can verify — not a status that disappears into a backend no one sees |
| Make reports actionable beyond the app | AI-generated awareness posters let citizens apply social pressure outside the platform itself |

## 5. Success Metrics (Hackathon Context)

Since this is a hackathon prototype rather than a production deployment, success is measured by functional completeness, demo reliability, and honest scope — not live user adoption:

- A citizen can file a complete report end-to-end (text, voice, or photo) and see it appear on the live map within seconds
- Every agent in the pipeline runs on real Gemini API calls, verifiable in server logs — not mocked or hardcoded output
- The full loop closes: a report can move from Open → In Progress → Resolved through real community action, not just exist as a permanently-open ticket
- The app survives a live demo without requiring a page refresh to recover from a failed network call
- Core security (Firebase Auth + locked, scoped database rules) is in place from the start, not left in open/test mode and "fixed later"

## 6. The Complete User Journey

1. Citizen opens the app — gets a real anonymous Firebase identity instantly, no signup screen
2. Reports an issue by voice (English/Hindi toggle) or text, optionally attaching a photo
3. **Linguistic Parser** (voice/text) or **Vision Validator** (photo) extracts structured fields — category, location, severity
4. **Area Scanner** checks for nearby duplicate reports; **Department Linker** identifies the responsible municipal authority
5. The report writes to Firebase immediately; any attached photo uploads to Storage in the background, never blocking the report or the AI pipeline behind a slow mobile upload
6. **Credit Allocator** calculates a context-aware StreetCredit reward; the citizen sees a confirmation toast
7. The report appears live on the public map, color-coded by severity, with a default **Open** status
8. Other citizens browse the map or leaderboard, verify the report, or — once the issue is actually fixed — mark it **In Progress** or **Resolved**, earning their own credits for doing so
9. The map's **Impact Dashboard** continuously re-analyzes all live report data for genuine trend patterns (rising/stable/falling), refusing to fabricate a trend when there isn't enough data yet
10. Optionally, the original citizen (or anyone) generates an **AI Poster Studio** notice and shares it externally to build public pressure beyond the app itself

## 7. Core Features (Implemented & Verified)

### 7.1 Seven-Agent Gemini Pipeline
Each agent has a focused prompt, a defined responsibility, and a real `gemini-2.5-flash` API call — prototyped and refined in **Google AI Studio** before being wired into the Node/Express backend, not written blind:
1. **Linguistic Parser** — cleans mixed Hindi/English/Hinglish complaints, classifies category + urgency
2. **Vision Validator** — analyzes uploaded photos, returns category/severity/department/summary as structured JSON
3. **Area Scanner** — queries existing reports to identify nearby duplicates/hotspots
4. **Department Linker** — identifies the responsible municipal department, explains the routing decision
5. **Credit Allocator** — assigns context-aware StreetCredit values instead of flat rewards
6. **SLA Sentinel** — estimates expected resolution timelines
7. **Studio Agent** — generates poster headline, color palette (via real color-psychology rules), icon, and hashtag

### 7.2 Multilingual Reporting
Manual text reporting in English or Hindi, plus voice reporting via the browser's Web Speech API with a manual EN/HI toggle (the API genuinely cannot auto-detect spoken language — this is stated honestly in-product rather than oversold).

### 7.3 Real-Time Map with Impact Dashboard
Live Google Maps integration bound to Firebase via a live listener, color-coded markers by severity, click-to-view info windows with evidence photos, plus an Impact Dashboard showing the top reported category/hotspot instantly and a real Gemini-generated predictive insight on trend direction.

### 7.4 Community-Driven Status Tracking
Reports carry a real `status` field (open / in_progress / resolved). Database rules deliberately grant **any signed-in citizen** — not just the original reporter — permission to update this one field, reflecting how community accountability actually works in practice.

### 7.5 StreetCredits Gamification
Credits awarded via the real Credit Allocator agent for filing a report, verifying a report, uploading evidence, confirming a resolution, and maintaining a daily streak — with duplicate-action protection so credits can't be farmed by repeating the same action.

### 7.6 AI Poster Studio
Generates a civic awareness notice (headline, severity badge, color palette, hashtag) from a real Gemini call, rendered into a downloadable, shareable PNG with native share-sheet support.

### 7.7 Identity & Security
Firebase Anonymous Authentication gives every visitor a real `auth.uid` with no login form. Realtime Database rules require `auth != null` for all reads and `auth.uid` ownership checks for writes — with one deliberately scoped exception for the community-writable status field.

### 7.8 Evidence Storage (Non-Blocking)
Firebase Storage integration for photo/video evidence, uploaded in the background so the report submission and AI pipeline are never stalled behind a slow mobile upload.

## 8. Every Google Technology, and What It Actually Does Here

Not a list of names — what each one is actually doing in this build:

| Technology | What it actually does in StreetVoice |
|---|---|
| **Gemini API** (`gemini-2.5-flash`) | Powers all seven agents: real structured reasoning over citizen text/voice/images, not simulated or templated responses |
| **Google AI Studio** | Used to prototype and evaluate every agent's prompt — testing how the Linguistic Parser handled real Hinglish input, how Vision Validator scored sample photos — before any prompt was copied into `server.js` |
| **Firebase Realtime Database** | Live store for every report and user record; powers the live map listener and leaderboard with real-time sync, not polling |
| **Firebase Authentication (Anonymous)** | Gives every citizen a real, secure identity with zero login friction — the actual security boundary enforced in database rules |
| **Firebase Storage** | Stores uploaded evidence photos/videos, decoupled from the report submission itself so uploads never block the user |
| **Google Maps Platform** | Renders the live, color-coded risk map with real geocoordinates per report |
| **Google Cloud Run** | Hosts the production Node/Express backend serving all AI agent endpoints |
| **Google Stitch** | Used during early UI/design direction exploration |
| **Google Fonts** | Space Grotesk and Syne typefaces, used across the leaderboard and profile views |

## 9. Out of Scope (For This Prototype)

Being explicit about what is *not* built avoids overclaiming on submission materials:

- **Email/password or social login** — only Anonymous Authentication is implemented.
- **Municipal/department-side dashboard** — there is no officer-facing interface for managing assigned tickets; routing is AI-identified but not connected to a real department workflow. Community-driven status tracking is the current substitute.
- **Real AI-generated poster artwork** — an Imagen-based image-generation attempt did not integrate reliably within the build window and was removed; the poster's text content is real Gemini output, its visual layout is a designed template.
- **Production-grade DB rules beyond ownership + scoped community-write checks** — current rules do not yet implement rate-limiting or content moderation.

## 10. Future Roadmap (Post-Hackathon)

| Priority | Item |
|---|---|
| High | Real email/password (or Google) login, layered on top of the existing Anonymous Auth foundation |
| High | Municipal department-facing dashboard for ticket management, closing the loop the community-status workaround currently fills |
| Medium | Real generative imagery for posters, using a correctly integrated image model |
| Medium | Rate-limiting and abuse protection in database rules |
| Low |Multilinguial language support (mentioned in early concept materials, not yet built) |

## 11. Known Risks / Honest Caveats

- Voice input depends on the Web Speech API, **not supported in Firefox or Safari** — degrades gracefully (button disables with a clear message) but is a real platform limitation.
- The Studio poster is a styled HTML template rendered to PNG, not AI-generated artwork — described as such here and in any verbal pitch, not oversold.
- Predictive Insights will honestly report "insufficient data" on a small dataset rather than fabricate a trend — by design, but worth knowing before a demo with very few seeded reports.
- This prototype has not undergone load testing; Firebase listeners and Gemini calls are tested for individual-user demo conditions, not concurrent multi-user scale.
