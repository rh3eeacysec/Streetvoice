/**
 * StreetVoice Universal Hardware-Accelerated Interactive Cursor Matrix
 * Handles persistent cursor coordinates, element hover states, and memory-safe particle trail arrays.
 */
(function() {
  // Prevent duplicate instantiation if loaded multiple times
  if (document.getElementById('custom-cursor-matrix')) return;

  // Append core structural components to DOM layout
  const globalContainer = document.createElement('div');
  globalContainer.id = 'custom-cursor-matrix';
  globalContainer.innerHTML = `
    <div id="custom-cursor"></div>
    <div id="cursor-trail-container"></div>
    <style>
      #custom-cursor {
        position: fixed;
        width: 10px;
        height: 10px;
        background-color: var(--accent, #38bdf8);
        border-radius: 50%;
        pointer-events: none;
        z-index: 99999;
        transform: translate(-50%, -50%);
        transition: width 0.2s, height 0.2s, background-color 0.2s;
        mix-blend-mode: difference;
      }
      #custom-cursor.active {
        width: 24px;
        height: 24px;
        background-color: #ffffff;
      }
      .cursor-trail {
        position: fixed;
        width: 4px;
        height: 4px;
        background-color: var(--accent, #38bdf8);
        border-radius: 50%;
        pointer-events: none;
        z-index: 99998;
        transform: translate(-50%, -50%);
        opacity: 0.7;
        transition: opacity 0.4s ease, transform 0.4s ease;
      }
      #cursor-trail-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        pointer-events: none;
        z-index: 99998;
      }
    </style>
  `;
  document.body.appendChild(globalContainer);

  const cursor = document.getElementById('custom-cursor');
  const trailContainer = document.getElementById('cursor-trail-container');

  let lastX = 0;
  let lastY = 0;

  // Render sequence tracking movement updates
  document.addEventListener('mousemove', (e) => {
    // Apply hardware-accelerated transforms to bypass layout reflow penalties
    cursor.style.transform = `translate3d(${e.clientX - 5}px, ${e.clientY - 5}px, 0)`;

    // Calculate displacement vectors to suppress extra particles when mouse is stationary
    const distance = Math.hypot(e.clientX - lastX, e.clientY - lastY);
    
    if (distance > 12) {
      const dot = document.createElement('div');
      dot.className = 'cursor-trail';
      dot.style.left = e.clientX + 'px';
      dot.style.top = e.clientY + 'px';
      
      // Inherit the exact current custom properties from document environment nodes
      const activeAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      if (activeAccent) dot.style.backgroundColor = activeAccent;

      trailContainer.appendChild(dot);

      lastX = e.clientX;
      lastY = e.clientY;

      // Asynchronous garbage collection cleanup cycle to eliminate memory leakages
      setTimeout(() => {
        dot.style.opacity = '0';
        dot.style.transform = 'scale(0.1)';
        setTimeout(() => dot.remove(), 400);
      }, 80);
    }
  });

  // Dynamic Event Delegation for Interactive Controls
  const updateHoverListeners = () => {
    document.querySelectorAll('a, button, [role="button"], input, select').forEach(el => {
      if (el.dataset.cursorBound) return; // Prevent attached duplicate bindings
      el.dataset.cursorBound = "true";

      el.addEventListener('mouseenter', () => cursor.classList.add('active'));
      el.addEventListener('mouseleave', () => cursor.classList.remove('active'));
    });
  };

  // Run immediately and attach listener loops over dynamic AJAX nodes
  updateHoverListeners();
  const mutationObserver = new MutationObserver(updateHoverListeners);
  mutationObserver.observe(document.body, { childList: true, subtree: true });
})();