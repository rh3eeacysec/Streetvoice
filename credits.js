/* ==========================================================================
   STREETVOICE — credits.js
   Shared StreetCredits engine. Include AFTER firebase-config.js on any page
   that needs to award/read credits (report.html, feed.html verify buttons,
   studio.html poster shares, etc).

   Matches the EXACT data shape already in use by profile.html / leaderboard.html:
     users/{userId} = {
       name, city, avatar, streetCredits,
       stats: { reported, verified },
       streak: { count, lastActiveDate }
     }

   Does NOT replace what report.html already does — it gives you one shared
   function so every future "award credits" action (verify, upload evidence,
   poster share, streak) goes through the same real Credit Allocator agent
   instead of hardcoded numbers scattered across pages.
   ========================================================================== */

const CREDITS_API_URL = (window.API_BASE_URL || 'http://localhost:3000') + '/api/run-agent'; // Credit Allocator = agentId '5'

/* Fallback flat awards used ONLY if the Credit Allocator agent can't be reached
   (server.js not running, network hiccup, etc) — keeps the app usable offline. */
const FALLBACK_CREDIT_VALUES = {
  report: 25,
  verify: 10,
  evidence: 15,
  resolution_confirm: 20,
  poster_share: 8,
  streak_bonus: 5
};

const ACTION_LABELS = {
  report: 'Filing a civic report',
  verify: 'Verifying a community report',
  evidence: 'Uploading supporting evidence',
  resolution_confirm: 'Confirming an issue resolution',
  poster_share: 'Sharing an awareness poster',
  streak_bonus: 'Maintaining a daily streak'
};

/* ==========================================================================
   CORE: askCreditAllocator
   Calls the REAL Gemini Credit Allocator agent (persona 5 in server.js) to
   get a fair, context-aware credit value instead of a flat hardcoded number.
   Falls back gracefully if the server isn't reachable.
   ========================================================================== */
async function askCreditAllocator(actionType, contextText) {
  const label = ACTION_LABELS[actionType] || actionType;
  const fallback = FALLBACK_CREDIT_VALUES[actionType] || 10;

  try {
    const res = await fetch(CREDITS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: '5',
        inputText: contextText || label,
        extraContext: `Action type: ${label}.`
      })
    });

    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const data = await res.json();

    // Agent returns free text like: "Award: 35 StreetCredits — detailed report with photo evidence."
    const match = (data.output || '').match(/Award:\s*(\d+)/i);
    const amount = match ? parseInt(match[1], 10) : fallback;
    const reason = data.output || `${label} — standard award.`;

    return { amount: Number.isFinite(amount) ? amount : fallback, reason, isLive: true };

  } catch (err) {
    console.warn(`Credit Allocator unreachable for "${actionType}", using fallback value:`, err.message);
    return { amount: fallback, reason: `${label} — flat award (offline fallback).`, isLive: false };
  }
}

/* ==========================================================================
   STREAK LOGIC
   Reads/updates users/{userId}/streak = { count, lastActiveDate }.
   Call checkAndUpdateStreak() once per session (e.g. on page load) for the
   logged-in user. Awards a small bonus on consecutive-day activity.
   ========================================================================== */
function getTodayDateString() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

async function checkAndUpdateStreak(displayUserId) {
  if (!window.db || !displayUserId) return { count: 0, bonusAwarded: false };

  const realUid = (typeof getAuthUid === 'function') ? await getAuthUid() : null;
  const firebaseKey = realUid || displayUserId;

  const today = getTodayDateString();
  const snap = await db.ref(`users/${firebaseKey}/streak`).once('value');
  const existing = snap.val() || { count: 0, lastActiveDate: null };

  if (existing.lastActiveDate === today) {
    // Already counted today — no change, no double bonus
    return { count: existing.count, bonusAwarded: false };
  }

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const isConsecutive = existing.lastActiveDate === yesterday;
  const newCount = isConsecutive ? existing.count + 1 : 1;

  await db.ref(`users/${firebaseKey}/streak`).set({ count: newCount, lastActiveDate: today });

  let bonusAwarded = false;
  if (newCount > 1) {
    // Only bonus on actual continued streaks (day 2+), not the very first day
    await awardCredits(displayUserId, 'streak_bonus', `Day ${newCount} streak`);
    bonusAwarded = true;
  }

  return { count: newCount, bonusAwarded };
}

/* ==========================================================================
   MAIN ENTRY POINT: awardCredits
   Call this from ANY page after a credit-worthy action.
   Updates Firebase users/{userId} in the exact shape profile.html/leaderboard.html
   already expect, and mirrors to localStorage so it works even if Firebase
   hasn't loaded yet.

   Usage:
     await awardCredits('CITIZEN-MUM-4821', 'verify', 'Verified pothole report at Linking Road');
   ========================================================================== */
async function awardCredits(displayUserId, actionType, contextText) {
  if (!displayUserId) {
    console.warn("awardCredits called with no userId — skipping.");
    return null;
  }

  const { amount, reason, isLive } = await askCreditAllocator(actionType, contextText);

  // ---- Update localStorage mirror (matches report.html's currentUser shape) ----
  // Keyed by the DISPLAY id (e.g. "CITIZEN-MUM-4821") since that's what every
  // page's localStorage already uses — this part is unchanged.
  const localKey = `streetvoice_user_${displayUserId}`;
  const localData = JSON.parse(localStorage.getItem(localKey) || 'null') || {
    id: displayUserId, name: displayUserId, city: "Mumbai", streetCredits: 0,
    reports: [], stats: { reported: 0, verified: 0 }
  };

  localData.streetCredits = (localData.streetCredits || 0) + amount;
  if (actionType === 'verify') localData.stats.verified = (localData.stats.verified || 0) + 1;
  if (actionType === 'report') localData.stats.reported = (localData.stats.reported || 0) + 1;
  localStorage.setItem(localKey, JSON.stringify(localData));

  // ---- Update Firebase, keyed by the REAL auth.uid (what DB rules check) ----
  // Falls back to the display id as the key ONLY if real auth never resolves
  // (e.g. firebase-auth-compat.js not loaded on this page) — in that case
  // the write will simply be rejected by auth-gated rules, same as before
  // this change, so nothing gets silently worse.
  if (window.db) {
    try {
      const realUid = (typeof getAuthUid === 'function') ? await getAuthUid() : null;
      const firebaseKey = realUid || displayUserId;

      await db.ref(`users/${firebaseKey}`).transaction((current) => {
        const u = current || { name: displayUserId, city: "Mumbai", streetCredits: 0, stats: { reported: 0, verified: 0 } };
        u.streetCredits = (u.streetCredits || 0) + amount;
        u.stats = u.stats || { reported: 0, verified: 0 };
        if (actionType === 'verify') u.stats.verified = (u.stats.verified || 0) + 1;
        if (actionType === 'report') u.stats.reported = (u.stats.reported || 0) + 1;
        return u;
      });
    } catch (err) {
      console.error("Firebase credit write failed:", err);
    }
  } else {
    console.warn("Firebase not initialized — credits saved to localStorage only.");
  }

  // ---- Fire a toast so the user actually sees what just happened ----
  if (typeof showToast === 'function') {
    showToast(`+${amount} StreetCredits — ${ACTION_LABELS[actionType] || actionType}`, 'success');
  } else {
    console.log(`[StreetCredits] +${amount} — ${reason} ${isLive ? '(live AI)' : '(fallback)'}`);
  }

  return { amount, reason, newTotal: localData.streetCredits, isLive };
}

/* ==========================================================================
   Convenience helper for verify/upload/resolution buttons on feed.html.
   Prevents a user from farming credits by spamming the same report repeatedly.
   ========================================================================== */
async function awardCreditsOncePerReport(displayUserId, actionType, reportId, contextText) {
  if (!window.db) return awardCredits(displayUserId, actionType, contextText);

  const realUid = (typeof getAuthUid === 'function') ? await getAuthUid() : null;
  const firebaseKey = realUid || displayUserId;

  const logRef = db.ref(`creditLog/${reportId}/${firebaseKey}/${actionType}`);
  const snap = await logRef.once('value');
  if (snap.exists()) {
    console.log(`User ${displayUserId} already got "${actionType}" credit for report ${reportId} — skipping duplicate.`);
    return null;
  }

  const result = await awardCredits(displayUserId, actionType, contextText);
  await logRef.set(Date.now());
  return result;
}