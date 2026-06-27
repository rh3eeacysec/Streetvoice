/* ==========================================================================
   STREETVOICE — app-config.js
   Single source of truth for the backend API base URL. Every page/script
   that calls server.js endpoints (credits.js, voice-input.js, dashboard.html,
   report.html) reads window.API_BASE_URL instead of hardcoding the URL.

   Load this FIRST, before credits.js / voice-input.js / any inline <script>
   that calls the backend — see the script tag order comment in
   firebase-config.js for the full recommended order.

   ============================================================
   AFTER DEPLOYING TO CLOUD RUN: change the line below to your real
   deployed URL (no trailing slash), then redeploy.
   Example: 'https://streetvoice-xxxxxxxxxx-uc.a.run.app'
   ============================================================
   ========================================================================== */

window.API_BASE_URL = 'http://localhost:3000';