/* ==========================================================================
   STREETVOICE — FIREBASE INIT (shared across all pages)
   Loaded via <script> AFTER firebase-app-compat.js + firebase-database-compat.js
   For pages that upload images/videos (dashboard.html, report.html), ALSO load
   firebase-storage-compat.js. For pages using auth-gated identity, ALSO load
   firebase-auth-compat.js. Full recommended order:

     <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
     <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js"></script>
     <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-storage-compat.js"></script>
     <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
     <script src="firebase-config.js"></script>

   PASTE YOUR REAL CONFIG BELOW (from Firebase Console > Project Settings > Web App)
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyBngICuFVM4TBH-H53UBsOu8oKjJLIg5Ow",
  authDomain: "streetvoice-ee217.firebaseapp.com",
  databaseURL: "https://streetvoice-ee217-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "streetvoice-ee217",
  storageBucket: "streetvoice-ee217.firebasestorage.app",
  messagingSenderId: "116985470713",
  appId: "1:116985470713:web:9f69c6319f7efb54048c28"
};

firebase.initializeApp(firebaseConfig);

// Exposed globally so every page's existing classic <script> can use it directly
window.db = firebase.database();

// Firebase Storage — for uploaded report photos/videos (evidence images).
// Requires firebase-storage-compat.js to be loaded on the page BEFORE this
// script (see comment at top of this file for the exact script tag order).
try {
  window.storage = firebase.storage();
} catch (err) {
  console.warn("Firebase Storage not initialized — did you include firebase-storage-compat.js? Storage uploads will be skipped on this page.", err.message);
}

// Firebase Authentication — anonymous sign-in. Every visitor gets a real,
// stable auth.uid with no login form. This is what our Database Rules check
// against (auth != null) — NOT this config file, which is meant to be public.
// Requires firebase-auth-compat.js loaded BEFORE this script.
window.authReady = new Promise((resolve) => {
  try {
    const auth = firebase.auth();
    window.auth = auth;

    auth.onAuthStateChanged((user) => {
      if (user) {
        window.currentAuthUid = user.uid;
        console.log("✅ Firebase Auth ready — anonymous uid:", user.uid);
        resolve(user.uid);
      } else {
        // Not signed in yet — sign in anonymously now.
        auth.signInAnonymously().catch((err) => {
          console.error("Anonymous sign-in failed:", err.message);
          resolve(null);
        });
      }
    });
  } catch (err) {
    console.warn("Firebase Auth not initialized — did you include firebase-auth-compat.js? Pages will fall back to localStorage-only identity.", err.message);
    resolve(null);
  }
});

console.log("✅ StreetVoice Firebase connected:", firebaseConfig.projectId);