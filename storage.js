/* ==========================================================================
   STREETVOICE — storage.js
   Shared Firebase Storage upload helper. Include AFTER firebase-config.js
   on any page that uploads evidence photos/videos (dashboard.html's AI Quick
   Triage, report.html's evidence upload field).

   Requires firebase-storage-compat.js + firebase-config.js loaded first
   (see firebase-config.js header comment for the exact script tag order).

   Storage path convention: reports/{ticketId or "unfiled"}/{timestamp}_{filename}
   This keeps each report's evidence grouped together and browsable in the
   Firebase Console under Storage.
   ========================================================================== */

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10MB safety cap — keeps demo uploads fast and cheap

/**
 * Uploads a File/Blob to Firebase Storage and returns its public download URL.
 * Falls back gracefully (returns null) if Storage isn't initialized or the
 * upload fails — callers should treat a null return as "evidence wasn't
 * saved, but don't block the rest of the report submission over it."
 *
 * @param {File} file - the image/video file selected by the user
 * @param {string} ticketId - report ticket ID, used to group files in Storage; pass "unfiled" if not yet known
 * @returns {Promise<string|null>} the public download URL, or null on failure
 */
async function uploadEvidenceFile(file, ticketId = "unfiled") {
  if (!file) return null;

  if (!window.storage) {
    console.warn("Firebase Storage not initialized — is firebase-storage-compat.js loaded? Skipping evidence upload.");
    return null;
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    console.warn(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB) — max is 10MB. Skipping upload.`);
    if (typeof showToast === 'function') {
      showToast('File too large to upload (max 10MB) — skipping evidence upload.', 'warning');
    }
    return null;
  }

  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `reports/${ticketId}/${Date.now()}_${safeFileName}`;

  try {
    const ref = window.storage.ref(path);
    const snapshot = await ref.put(file);
    const downloadUrl = await snapshot.ref.getDownloadURL();
    console.log(`✅ Evidence uploaded to Storage: ${path}`);
    return downloadUrl;
  } catch (err) {
    console.error("Firebase Storage upload failed:", err);
    if (typeof showToast === 'function') {
      showToast('Evidence upload failed — report will still be submitted without it.', 'warning');
    }
    return null;
  }
}

/**
 * Convenience wrapper: shows upload progress via a percentage callback.
 * Use this instead of uploadEvidenceFile() when you have a progress bar UI.
 *
 * @param {File} file
 * @param {string} ticketId
 * @param {(percent: number) => void} onProgress
 * @returns {Promise<string|null>}
 */
function uploadEvidenceFileWithProgress(file, ticketId, onProgress) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);

    if (!window.storage) {
      console.warn("Firebase Storage not initialized — skipping evidence upload.");
      return resolve(null);
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      console.warn(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB) — max is 10MB.`);
      if (typeof showToast === 'function') {
        showToast('File too large to upload (max 10MB).', 'warning');
      }
      return resolve(null);
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `reports/${ticketId || 'unfiled'}/${Date.now()}_${safeFileName}`;
    const ref = window.storage.ref(path);
    const task = ref.put(file);

    task.on('state_changed',
      (snapshot) => {
        const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
        if (typeof onProgress === 'function') onProgress(percent);
      },
      (err) => {
        console.error("Firebase Storage upload failed:", err);
        if (typeof showToast === 'function') {
          showToast('Evidence upload failed — report will still be submitted without it.', 'warning');
        }
        resolve(null);
      },
      async () => {
        try {
          const url = await task.snapshot.ref.getDownloadURL();
          console.log(`✅ Evidence uploaded to Storage: ${path}`);
          resolve(url);
        } catch (err) {
          console.error("Could not get download URL after upload:", err);
          resolve(null);
        }
      }
    );
  });
}