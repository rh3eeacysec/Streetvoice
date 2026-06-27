# StreetVoice — Product Requirements Document

**Built for:** Vibe2Ship Hackathon 2026
**Author:** Solo build
**Status:** Functional prototype, pre-deployment
**Last updated:** June 27, 2026

---

## 1. Problem Statement

Civic infrastructure issues — potholes, broken streetlights, garbage overflow, water leakage, open manholes — are common across Indian cities, but the systems for reporting them are slow, fragmented, and offer no visibility into what happens after a complaint is filed. Citizens have no easy way to verify whether an issue is already known, no transparent tracking of resolution status, and no incentive structure that rewards sustained civic participation.

StreetVoice addresses this by combining AI-assisted multilingual reporting, automated triage and routing, and a public, map-based accountability layer — built specifically around a hackathon problem statement on civic issue reporting.

## 2. Target Users

- **Citizens** reporting infrastructure issues in their neighborhood, in English, Hindi, or mixed Hinglish, via text, photo, or voice.
- **Community verifiers** — other citizens who confirm, comment on, or upload supporting evidence for existing reports, building public accountability without requiring a municipal officer to act first.
- **Civic-minded sharers** — citizens who use generated awareness posters to push visibility on unresolved issues through their own social/personal networks.

*(Note: this prototype does not yet have a municipal-officer-facing dashboard or department-side workflow — see Section 8, Out of Scope.)*

## 3. Goals

| Goal | Why it matters |
|---|---|
| Lower the friction of filing a civic complaint | Voice input + AI-assisted category/location extraction means a citizen doesn't need to fill out a structured form correctly by hand |
| Make civic participation visible and rewarding | StreetCredits + leaderboard turn one-off reporting into repeat engagement |
| Give reports a public, geographic presence | A live map makes clusters of unresolved issues visible to anyone, not just the person who filed the report |
| Make reports actionable beyond the app | AI-generated awareness posters let citizens apply social pressure outside the platform itself |

## 4. Success Metrics (Hackathon Context)

Since this is a hackathon prototype rather than a production deployment, success is measured by functional completeness and demo reliability, not live user adoption:

- A citizen can file a complete report end-to-end (text or voice) and see it appear on the live map within seconds
- At least one full AI agent pipeline (triage → routing → email draft) runs on real Gemini calls, not mocked output
- The app survives a live demo without requiring a page refresh to recover from a failed network call
- Core security (Firebase Auth + locked database rules) is in place, not left in open/test mode

## 5. Core Features (Implemented & Verified)

### 5.1 Multi-Agent AI Pipeline (Gemini API)
Seven distinct agent personas, each with its own prompt and responsibility, running on real `gemini-2.5-flash` calls via a Node/Express backend:
1. **Linguistic Parser** — cleans mixed Hindi/English/Hinglish complaints, classifies category + urgency
2. **Vision Validator** — analyzes uploaded photos, returns category/severity/department/summary as structured JSON
3. **Area Scanner** — queries existing reports to identify nearby duplicates/hotspots
4. **Department Linker** — identifies the responsible municipal department for a given report
5. **Credit Allocator** — assigns context-aware StreetCredit values instead of flat rewards
6. **SLA Sentinel** — estimates expected resolution timelines
7. **Studio Agent** — generates poster headline, color palette (via real color-psychology rules), icon, and hashtag for a given issue

### 5.2 Bilinguial Reporting
- Manual text reporting in English or Hindi (UI toggle)
- Voice reporting: browser Web Speech API captures audio in an EN or HI mode (the underlying API cannot truly auto-detect language, so a manual toggle is used), then the Linguistic Parser extracts structured fields (title, category, location, description) from the raw transcript

### 5.3 Real-Time Map (Google Maps Platform)
- Live Google Maps integration in `riskmap.html`, bound to Firebase Realtime Database via a live listener
- Colour-coded markers by severity (blue/yellow/red)
- Click-to-view info windows showing category, location, description, and uploaded evidence photo (if any)

### 5.4 StreetCredits Gamification
- Credits awarded via the real Credit Allocator agent (not a flat hardcoded number) for: filing a report, verifying a report, uploading evidence, maintaining a daily streak
- Duplicate-action protection (a citizen cannot farm credits by repeatedly verifying the same report)
- Public leaderboard with podium + ranked table, reading from real Firebase data merged with seed/demo entries

### 5.5 AI Poster Studio
- Generates a civic awareness notice (headline, severity badge, color palette, hashtag) from a real Gemini call
- Styled poster template (not AI-generated imagery — see Section 8) with a location-pointer callout
- Download as PNG (via html2canvas) and native share (Web Share API with clipboard fallback)
- QR code linking back to the report submission page

### 5.6 Identity & Security
- Firebase Anonymous Authentication — every visitor gets a real `auth.uid`, no login form required
- Firebase Realtime Database rules require `auth != null` for all reads, and `auth.uid` ownership checks for writes — not left in default open/test mode
- Civic-registry-style IDs (`CITIZEN-{CITY}-{XXXX}`) and ticket numbers (`{CITY}-{CATEGORY}-{XXXX}`) instead of generic tech placeholder strings

### 5.7 Evidence Storage
- Firebase Storage integration for photo/video evidence uploaded during reporting (both AI Quick Triage and manual report submission)
- Graceful degradation: if Storage upload fails, the report still submits successfully without evidence attached

## 6. Tech Stack (Verified Accurate)

| Layer | Technology |
|---|---|
| Frontend | HTML5, Tailwind CSS, Vanilla JavaScript, Vite |
| Backend | Node.js, Express |
| AI | Gemini API (`gemini-2.5-flash`), tested/refined via Google AI Studio |
| Database | Firebase Realtime Database |
| Auth | Firebase Authentication (Anonymous) |
| Storage | Firebase Storage |
| Maps | Google Maps Platform (Maps JavaScript API) |
| Deployment | Google Cloud Run *(pending at time of writing)* |
| Frontend design exploration | Google Stitch |

## 7. User Flow (Primary Path)

1. Citizen opens the app, is assigned a real anonymous Firebase identity and a readable `CITIZEN-{CITY}-{XXXX}` display ID
2. Citizen reports an issue — by typing or by voice (EN/HI toggle) — optionally attaching a photo
3. Linguistic Parser / Vision Validator extracts structured fields; Department Linker identifies the responsible authority
4. Report is written to Firebase with a civic-style ticket ID, then appears live on the map with a colour-coded pin
5. Citizen receives StreetCredits (real AI-calculated amount) and sees a toast confirmation
6. Other citizens can view the report on the map or leaderboard; future verification/evidence actions also earn credits
7. Optionally, a citizen generates an awareness poster in the Studio and shares it externally

## 8. Out of Scope (For This Prototype)

Being explicit about what is *not* built avoids overclaiming on submission materials:

- **Email/password or social login** — only Anonymous Authentication is implemented. A full login UI was considered but deprioritized given the build timeline.
- **Municipal/department-side dashboard** — there is no officer-facing interface for managing assigned tickets; routing is identified by AI but not yet connected to a real department workflow or API.
- **Real AI-generated poster artwork** — an attempt was made to integrate Imagen-based image generation; it did not work reliably within the build window and was removed. Posters currently use a styled template, not generative imagery.
- **`feed.html`** — referenced conceptually in early planning (and in one now-fixed dead QR-code link) but never built.
- **Production-grade DB rules beyond ownership checks** — current rules require authentication and uid-ownership for writes; they do not yet implement rate-limiting, content moderation, or admin roles.

## 9. Future Roadmap (Post-Hackathon)

| Priority | Item |
|---|---|
| High | Real email/password (or Google) login, layered on top of the existing Anonymous Auth foundation |
| High | Municipal department-facing dashboard for ticket management |
| Medium | Real generative imagery for posters, using a correctly integrated image model |
| Medium | `feed.html` — a dedicated public feed view distinct from the map |
| Medium | Rate-limiting and abuse protection in database rules |
| Low | Multilingial support (currently EN/HI only, despite being mentioned in early concept materials) |

## 10. Known Risks / Honest Caveats

- Voice input depends on the Web Speech API, which is **not supported in Firefox or Safari** — degrades gracefully (button disables with a clear message) but is a real platform limitation, not a bug.
- This prototype has not undergone load testing; Firebase Realtime Database listeners and Gemini API calls are tested for individual-user demo conditions, not concurrent multi-user scale.
