/* ==========================================================================
   STREETVOICE — auth.js
   Bridges your EXISTING localStorage-based identity (display IDs like
   "CITIZEN-MUM-4821", used everywhere in profile.html/report.html/leaderboard.html)
   with REAL Firebase Anonymous Auth (auth.uid) — which is what your Database
   Rules now check against for security.

   The displayed/readable ID system doesn't change. What changes is WHICH
   key your data actually lives under in Firebase: previously "users/{displayId}",
   now "users/{auth.uid}" — a real, unforgeable key tied to that browser's
   anonymous session, not a string anyone could type in by hand.

   Include AFTER firebase-config.js (needs window.authReady).
   ========================================================================== */

/**
 * Call this once per page load, BEFORE any Firebase reads/writes that need
 * the real auth.uid. Returns the uid once anonymous sign-in completes.
 *
 * Usage:
 *   const uid = await getAuthUid();
 *   db.ref('users/' + uid).update(...);
 */
async function getAuthUid() {
  if (window.currentAuthUid) return window.currentAuthUid; // already resolved
  if (!window.authReady) {
    console.warn("authReady promise not found — is firebase-config.js (with Auth SDK) loaded before auth.js?");
    return null;
  }
  return await window.authReady;
}

/**
 * Links your existing localStorage "currentUser" object to the real auth.uid.
 * Call this once per page, right after you load/create currentUser from
 * localStorage. It does two things:
 *   1. Ensures users/{auth.uid} in Firebase has your display fields
 *      (name, city, avatar) — creating the record on first visit.
 *   2. Returns the uid so the rest of your page can use it for all
 *      subsequent db.ref('users/' + uid) reads/writes, instead of the old
 *      display-ID-as-key pattern.
 *
 * Safe to call multiple times — won't overwrite streetCredits/stats if the
 * record already exists (uses update(), not set()).
 *
 * @param {object} localUser - your existing currentUser shape: {id, name, city, ...}
 * @returns {Promise<string|null>} the real auth.uid to use as the Firebase key
 */
async function linkLocalUserToAuth(localUser) {
  const uid = await getAuthUid();
  if (!uid) {
    console.warn("Could not get auth.uid — falling back to localStorage-only identity for this session.");
    return null;
  }

  if (window.db) {
    try {
      const snap = await db.ref(`users/${uid}`).once('value');
      if (!snap.exists()) {
        // First time this anonymous session has written a user record —
        // initialize it with display info, matching the exact shape
        // profile.html/leaderboard.html already expect.
        await db.ref(`users/${uid}`).set({
          displayId: localUser.id || uid,
          name: localUser.name || localUser.id || 'Anonymous Citizen',
          city: localUser.city || 'Mumbai',
          avatar: localUser.avatar || 'pfp1.png',
          streetCredits: localUser.streetCredits || 0,
          stats: localUser.stats || { reported: 0, verified: 0 }
        });
      } else {
        // Record exists — just keep display fields fresh, don't touch
        // streetCredits/stats here (awardCredits() in credits.js owns those).
        await db.ref(`users/${uid}`).update({
          displayId: localUser.id || uid,
          name: localUser.name || localUser.id || 'Anonymous Citizen',
          city: localUser.city || 'Mumbai'
        });
      }
    } catch (err) {
      console.error("Could not link local user to auth.uid in Firebase:", err);
    }
  }

  return uid;
}