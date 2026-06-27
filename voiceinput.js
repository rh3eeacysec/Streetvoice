/* ==========================================================================
   STREETVOICE — voice-input.js
   Speech-to-text civic complaint capture. Citizen taps an EN/HI toggle to
   match what they're about to speak, then taps the mic and talks naturally.
   The real Gemini Linguistic Parser (server.js /api/parse-voice-complaint)
   extracts category/location/description to auto-fill the report form.

   NOTE ON LANGUAGE: the browser's Web Speech API cannot truly auto-detect
   spoken language — it needs to know which acoustic model to use before
   listening starts. 'en-IN' handles English + Hinglish well; pure Hindi
   needs 'hi-IN' for an accurate transcript. Hence the small EN/HI toggle
   instead of a fake "auto-detect" promise. Gemini still does the real
   language cleanup/translation/field-extraction after transcription.

   Requires: a button with id="btn-voice-input" and a status element with
   id="voice-status" somewhere on the page. Optional: id="btn-voice-lang-en"
   and id="btn-voice-lang-hi" toggle buttons (see HTML snippet below).

   Browser support: Chrome/Edge (webkitSpeechRecognition). Firefox/Safari do
   not support the Web Speech API as of this writing — voice-input.js detects
   this and disables the button with a clear message rather than failing silently.
   ========================================================================== */

(function () {
  const VOICE_PARSE_API_URL = (window.API_BASE_URL || 'http://localhost:3000') + '/api/parse-voice-complaint';

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  let recognition = null;
  let isListening = false;

  /* Category text → the <option value="cat-N"> values already used in report.html */
  const CATEGORY_TO_OPTION_VALUE = {
    "Pothole": "cat-1",
    "Road Damage": "cat-2",
    "Broken Streetlight": "cat-3",
    "Garbage Overflow": "cat-4",
    "Water Leakage": "cat-5",
    "Blocked Drain": "cat-6",
    "Damaged Footpath": "cat-7",
    "Open Manhole": "cat-8",
    "Traffic Signal Issue": "cat-9",
    "Public Safety Hazard": "cat-10",
    "Illegal Dumping": "cat-11",
    "Public Toilet Issue": "cat-12",
    "Park Maintenance Issue": "cat-13"
  };

  function setStatus(message, isError) {
    const el = document.getElementById('voice-status');
    if (el) {
      el.textContent = message;
      el.style.color = isError ? '#ef4444' : '';
    }
  }

  function setButtonListeningState(listening) {
    const btn = document.getElementById('btn-voice-input');
    if (!btn) return;
    isListening = listening;
    btn.classList.toggle('sv-voice-listening', listening);
    btn.textContent = listening ? '🔴 Listening... (tap to stop)' : '🎙️ Speak Your Complaint';
  }

  let recognitionLang = 'en-IN'; // toggled by the EN/HI buttons next to the mic

  /* ==========================================================================
     STEP 1: Capture raw speech → text using the browser's built-in recognizer.

     IMPORTANT REAL LIMITATION: the Web Speech API cannot truly auto-detect
     spoken language — you must tell it which acoustic model to use before
     listening starts. 'en-IN' handles Hinglish/code-switched speech reasonably
     well, but produces poor, garbled transcripts for PURE Hindi sentences.
     So instead of a fake "auto-detect" promise, we expose a simple EN/HI toggle
     next to the mic button — citizen picks whichever they're about to speak in,
     and Gemini still does the real cleanup/translation/extraction afterward.
     ========================================================================== */
  function startListening() {
    if (!SpeechRecognition) {
      setStatus('⚠️ Voice input is not supported in this browser. Try Chrome or Edge.', true);
      return;
    }

    if (isListening) {
      recognition.stop();
      return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = recognitionLang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let finalTranscript = '';

    recognition.onstart = () => {
      setButtonListeningState(true);
      const langLabel = recognitionLang === 'hi-IN' ? 'Hindi' : 'English/Hinglish';
      setStatus(`🎙️ Listening (${langLabel} mode) — speak your complaint naturally...`);
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPiece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcriptPiece + ' ';
        } else {
          interim += transcriptPiece;
        }
      }
      setStatus(`🎙️ Hearing: "${finalTranscript}${interim}"`);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setButtonListeningState(false);
      if (event.error === 'no-speech') {
        setStatus('⚠️ No speech detected — try again and speak clearly.', true);
      } else if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setStatus('⚠️ Microphone access denied. Check browser permissions.', true);
      } else {
        setStatus(`⚠️ Voice recognition error: ${event.error}`, true);
      }
    };

    recognition.onend = () => {
      setButtonListeningState(false);
      if (finalTranscript.trim()) {
        setStatus(`✅ Captured: "${finalTranscript.trim()}" — sending to AI for parsing...`);
        sendToLinguisticParser(finalTranscript.trim());
      } else {
        setStatus('⚠️ No clear speech captured — please try again.', true);
      }
    };

    recognition.start();
  }

  /* ==========================================================================
     STEP 2: Send the raw transcript to the REAL Gemini Linguistic Parser
     (server.js /api/parse-voice-complaint) and auto-fill the report form
     with the structured result.
     ========================================================================== */
  async function sendToLinguisticParser(transcript) {
    try {
      const res = await fetch(VOICE_PARSE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
      });

      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const parsed = await res.json();

      fillReportForm(parsed);

      const confidenceNote = parsed.confidence === 'LOW'
        ? ' — please double-check the fields, confidence was low.'
        : '';
      setStatus(`✅ Form auto-filled from your voice (detected: ${parsed.detectedLanguage})${confidenceNote}`);

      if (typeof showToast === 'function') {
        showToast(`Voice complaint parsed — detected ${parsed.detectedLanguage}`, 'success');
      }

    } catch (err) {
      console.error('Voice complaint parsing failed:', err);
      setStatus('⚠️ Could not reach the AI parser (is server.js running?). Filling description with raw transcript instead.', true);

      // Graceful degradation: at minimum, dump the raw transcript into the
      // description box so the citizen's spoken words aren't lost entirely.
      const descField = document.getElementById('report-desc');
      if (descField && !descField.value.trim()) {
        descField.value = transcript;
      }

      if (typeof showToast === 'function') {
        showToast('Voice parsing failed — raw transcript added to description.', 'warning');
      }
    }
  }

  /* ==========================================================================
     STEP 3: Auto-fill report.html's existing form fields with the parsed result.
     Matches the exact field IDs already in report.html:
       #report-title, #report-category, #report-location, #report-desc
     ========================================================================== */
  function fillReportForm(parsed) {
    const titleField = document.getElementById('report-title');
    const categoryField = document.getElementById('report-category');
    const locationField = document.getElementById('report-location');
    const descField = document.getElementById('report-desc');

    if (titleField && parsed.title) titleField.value = parsed.title;

    if (categoryField && parsed.category) {
      const optionValue = CATEGORY_TO_OPTION_VALUE[parsed.category];
      if (optionValue) {
        categoryField.value = optionValue;
        // Fire the existing onchange handler (handleCategoryChange) so any
        // category-dependent logic already in report.html still runs.
        categoryField.dispatchEvent(new Event('change'));
      }
    }

    if (locationField && parsed.location && !locationField.value.trim()) {
      locationField.value = parsed.location;
    }

    if (descField && parsed.description) descField.value = parsed.description;
  }

  /* ==========================================================================
     Inject minimal styles for the listening-state pulse animation.
     ========================================================================== */
  function injectVoiceStyles() {
    if (document.getElementById('sv-voice-styles')) return;
    const style = document.createElement('style');
    style.id = 'sv-voice-styles';
    style.textContent = `
      #btn-voice-input.sv-voice-listening {
        animation: sv-voice-pulse 1.2s ease-in-out infinite;
      }
      @keyframes sv-voice-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
      .sv-voice-lang-active {
        background: var(--accent, #38bdf8) !important;
        color: var(--btn-text, #0f172a) !important;
        font-weight: 800;
      }
    `;
    document.head.appendChild(style);
  }

  function setRecognitionLanguage(lang) {
    recognitionLang = lang;
    const btnEn = document.getElementById('btn-voice-lang-en');
    const btnHi = document.getElementById('btn-voice-lang-hi');
    if (btnEn && btnHi) {
      btnEn.classList.toggle('sv-voice-lang-active', lang === 'en-IN');
      btnHi.classList.toggle('sv-voice-lang-active', lang === 'hi-IN');
    }
  }

  function init() {
    injectVoiceStyles();
    const btn = document.getElementById('btn-voice-input');
    if (!btn) return; // page doesn't have the voice button — nothing to wire up

    if (!SpeechRecognition) {
      btn.disabled = true;
      btn.textContent = '🎙️ Voice input unavailable (use Chrome/Edge)';
      setStatus('⚠️ This browser does not support voice input. Try Chrome or Edge.', true);
      return;
    }

    btn.addEventListener('click', startListening);

    const btnEn = document.getElementById('btn-voice-lang-en');
    const btnHi = document.getElementById('btn-voice-lang-hi');
    if (btnEn) btnEn.addEventListener('click', () => setRecognitionLanguage('en-IN'));
    if (btnHi) btnHi.addEventListener('click', () => setRecognitionLanguage('hi-IN'));
    setRecognitionLanguage(recognitionLang); // set initial active state
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();