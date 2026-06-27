/* ==========================================================================
   STREETVOICE — toast.js
   Lightweight, theme-aware toast notifications. Respects whichever
   data-theme is active (90s / y2k / modern) by reusing the same CSS
   variables every other page already defines (--surface, --border,
   --radius, --accent, --text).

   Include this AFTER your page's <style> theme block (anywhere in <head>
   or before </body> works — it injects its own scoped styles).

   Usage:
     showToast("Report submitted successfully!", "success");
     showToast("Could not reach Gemini server.", "error");
     showToast("Drafting email...", "info");
     showToast("+25 StreetCredits — Filing a civic report", "credit");
   ========================================================================== */

(function () {
  const STYLE_ID = 'sv-toast-styles';
  const CONTAINER_ID = 'sv-toast-container';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${CONTAINER_ID} {
        position: fixed;
        top: 16px;
        right: 16px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: min(360px, calc(100vw - 32px));
        pointer-events: none;
      }

      .sv-toast {
        pointer-events: auto;
        background: var(--surface, #1e293b);
        color: var(--text, #f8fafc);
        border: 1px solid var(--border, #334155);
        border-radius: var(--radius, 16px);
        padding: 12px 14px;
        font-family: var(--font, var(--font-body, system-ui, sans-serif));
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 8px 24px rgba(0,0,0,0.25);
        display: flex;
        align-items: flex-start;
        gap: 10px;
        backdrop-filter: blur(12px);
        border-left: 4px solid var(--sv-toast-stripe, var(--accent, #38bdf8));
        animation: sv-toast-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both;
        opacity: 1;
        transform: translateX(0);
      }

      .sv-toast.sv-toast-leaving {
        animation: sv-toast-out 0.3s cubic-bezier(0.4, 0, 1, 1) both;
      }

      .sv-toast-icon {
        font-size: 16px;
        line-height: 1.2;
        flex-shrink: 0;
        margin-top: 1px;
      }

      .sv-toast-body {
        flex: 1;
        line-height: 1.4;
      }

      .sv-toast-close {
        background: none;
        border: none;
        color: inherit;
        opacity: 0.5;
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
        padding: 0;
        flex-shrink: 0;
        transition: opacity 0.15s ease;
      }
      .sv-toast-close:hover { opacity: 1; }

      .sv-toast-progress {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 2px;
        background: var(--sv-toast-stripe, var(--accent, #38bdf8));
        opacity: 0.5;
        border-radius: 0 0 var(--radius, 16px) var(--radius, 16px);
        animation: sv-toast-progress linear forwards;
      }

      .sv-toast { position: relative; overflow: hidden; }

      @keyframes sv-toast-in {
        from { opacity: 0; transform: translateX(40px) scale(0.95); }
        to   { opacity: 1; transform: translateX(0) scale(1); }
      }
      @keyframes sv-toast-out {
        from { opacity: 1; transform: translateX(0) scale(1); max-height: 100px; margin-top: 0; }
        to   { opacity: 0; transform: translateX(40px) scale(0.95); max-height: 0; margin-top: -10px; }
      }
      @keyframes sv-toast-progress {
        from { width: 100%; }
        to   { width: 0%; }
      }

      @media (max-width: 480px) {
        #${CONTAINER_ID} { top: auto; bottom: 16px; right: 16px; left: 16px; max-width: none; }
      }
    `;
    document.head.appendChild(style);
  }

  function getContainer() {
    let container = document.getElementById(CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = CONTAINER_ID;
      document.body.appendChild(container);
    }
    return container;
  }

  const TOAST_TYPES = {
    success: { icon: '✅', stripe: '#22c55e' },
    error:   { icon: '⚠️', stripe: '#ef4444' },
    info:    { icon: 'ℹ️', stripe: 'var(--accent, #38bdf8)' },
    credit:  { icon: '🪙', stripe: '#eab308' },
    warning: { icon: '🟠', stripe: '#f97316' }
  };

  /**
   * Show a toast notification.
   * @param {string} message - Text to display.
   * @param {string} type - one of 'success' | 'error' | 'info' | 'credit' | 'warning'
   * @param {number} duration - ms before auto-dismiss (default 4000)
   */
  window.showToast = function (message, type = 'info', duration = 4000) {
    injectStyles();
    const container = getContainer();
    const config = TOAST_TYPES[type] || TOAST_TYPES.info;

    const toast = document.createElement('div');
    toast.className = 'sv-toast';
    toast.style.setProperty('--sv-toast-stripe', config.stripe);
    toast.innerHTML = `
      <span class="sv-toast-icon">${config.icon}</span>
      <span class="sv-toast-body"></span>
      <button class="sv-toast-close" aria-label="Dismiss">✕</button>
      <div class="sv-toast-progress" style="animation-duration:${duration}ms;"></div>
    `;
    // Set text via textContent (not innerHTML) so messages can't inject markup
    toast.querySelector('.sv-toast-body').textContent = message;

    container.appendChild(toast);

    let dismissTimer = setTimeout(() => dismiss(), duration);
    let dismissed = false;

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      clearTimeout(dismissTimer);
      toast.classList.add('sv-toast-leaving');
      // Fixed-delay removal matching the leave animation's duration — more
      // reliable than animationend, which can misfire if reduced-motion
      // settings skip the animation entirely.
      setTimeout(() => toast.remove(), 320);
    }

    toast.querySelector('.sv-toast-close').addEventListener('click', dismiss);
    // Pause auto-dismiss on hover, resume on leave
    toast.addEventListener('mouseenter', () => clearTimeout(dismissTimer));
    toast.addEventListener('mouseleave', () => { dismissTimer = setTimeout(dismiss, 1200); });

    return toast;
  };

  /* Convenience shorthands */
  window.toastSuccess = (msg, duration) => window.showToast(msg, 'success', duration);
  window.toastError   = (msg, duration) => window.showToast(msg, 'error', duration);
  window.toastInfo    = (msg, duration) => window.showToast(msg, 'info', duration);
  window.toastCredit  = (msg, duration) => window.showToast(msg, 'credit', duration);
})();