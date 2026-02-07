/**
 * Mermaid Fullscreen Functionality
 * Adaugă butoane de fullscreen pe toate diagramele Mermaid
 * Data: 7 februarie 2026
 */

(function() {
  'use strict';

  console.log('[Mermaid Fullscreen] Script loaded!');

  function initMermaidFullscreen() {
    console.log('[Mermaid Fullscreen] Init function called at:', new Date().toISOString());

    // Selectează toate containerele Mermaid (poate avea clase adiționale)
    const mermaidDiagrams = document.querySelectorAll('[class*="docusaurus-mermaid-container"]');

    console.log('[Mermaid Fullscreen] Found diagrams:', mermaidDiagrams.length);

    if (mermaidDiagrams.length === 0) {
      console.warn('[Mermaid Fullscreen] No diagrams found! Will retry...');
      // Retry după 2 secunde
      setTimeout(initMermaidFullscreen, 2000);
      return;
    }

    mermaidDiagrams.forEach((container, index) => {
      // Verifică dacă butonul a fost deja adăugat
      if (container.querySelector('.mermaid-fullscreen-btn')) {
        console.log('[Mermaid Fullscreen] Button already exists on diagram', index);
        return;
      }

      console.log('[Mermaid Fullscreen] Adding button to diagram', index, 'with class:', container.className);

      // Creează butonul de fullscreen
      const button = document.createElement('button');
      button.className = 'mermaid-fullscreen-btn';
      button.setAttribute('aria-label', 'Fullscreen');
      button.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
        </svg>
        <span>Fullscreen</span>
      `;
      button.title = 'Deschide în fullscreen (Click)';

      // Event listener pentru buton
      button.addEventListener('click', (e) => {
        console.log('[Mermaid Fullscreen] Button clicked!');
        e.stopPropagation();
        openFullscreen(container);
      });

      // Asigură poziționare relativă
      if (!container.style.position || container.style.position === 'static') {
        container.style.position = 'relative';
      }

      container.appendChild(button);
      console.log('[Mermaid Fullscreen] Button successfully added to diagram', index);
    });
  }

  function openFullscreen(container) {
    console.log('[Mermaid Fullscreen] Opening fullscreen...');

    // Clonează conținutul diagramei
    const clone = container.cloneNode(true);

    // Șterge butonul de fullscreen din clonă
    const cloneButton = clone.querySelector('.mermaid-fullscreen-btn');
    if (cloneButton) {
      cloneButton.remove();
    }

    // Creează overlay-ul fullscreen
    const overlay = document.createElement('div');
    overlay.className = 'mermaid-fullscreen-overlay';

    // Creează container-ul de conținut
    const content = document.createElement('div');
    content.className = 'mermaid-fullscreen-content';
    content.appendChild(clone);

    // Creează butonul de închidere
    const closeButton = document.createElement('button');
    closeButton.className = 'mermaid-fullscreen-close';
    closeButton.setAttribute('aria-label', 'Închide fullscreen');
    closeButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    `;
    closeButton.title = 'Închide (ESC)';

    // Adaugă hint text
    const hint = document.createElement('div');
    hint.className = 'mermaid-fullscreen-hint';
    hint.textContent = 'Apasă ESC sau click pe fundal pentru a închide';

    content.appendChild(closeButton);
    content.appendChild(hint);
    overlay.appendChild(content);

    // Funcție de închidere
    const close = () => {
      console.log('[Mermaid Fullscreen] Closing fullscreen...');
      document.body.style.overflow = '';
      overlay.remove();
      document.removeEventListener('keydown', handleEscape);
    };

    // Handler pentru ESC
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        close();
      }
    };

    // Event listeners
    closeButton.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        close();
      }
    });
    document.addEventListener('keydown', handleEscape);

    // Previne scroll pe body
    document.body.style.overflow = 'hidden';

    // Adaugă overlay-ul în DOM
    document.body.appendChild(overlay);
    console.log('[Mermaid Fullscreen] Fullscreen overlay added to DOM');
  }

  // Auto-init când documentul este gata
  if (typeof window !== 'undefined') {
    console.log('[Mermaid Fullscreen] Setting up initialization...');
    console.log('[Mermaid Fullscreen] Document ready state:', document.readyState);

    // Init imediat dacă documentul e deja loaded
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      console.log('[Mermaid Fullscreen] Document already ready, calling init immediately');
      setTimeout(initMermaidFullscreen, 100);
    } else {
      console.log('[Mermaid Fullscreen] Waiting for DOMContentLoaded...');
      document.addEventListener('DOMContentLoaded', () => {
        console.log('[Mermaid Fullscreen] DOMContentLoaded fired!');
        setTimeout(initMermaidFullscreen, 100);
      });
    }

    // Init și la window load (backup)
    window.addEventListener('load', () => {
      console.log('[Mermaid Fullscreen] Window load event fired!');
      setTimeout(initMermaidFullscreen, 500);
    });

    // Re-init la navigare (pentru SPA routing în Docusaurus)
    let lastPathname = window.location.pathname;
    setInterval(() => {
      if (window.location.pathname !== lastPathname) {
        console.log('[Mermaid Fullscreen] Route changed, re-initializing...');
        lastPathname = window.location.pathname;
        setTimeout(initMermaidFullscreen, 500);
      }
    }, 500);

    // Observer pentru detectarea noilor diagrame (pentru dynamic content)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Verifică dacă nodul adăugat este sau conține un container Mermaid
            if (node.className && typeof node.className === 'string' &&
                node.className.includes('docusaurus-mermaid-container')) {
              console.log('[Mermaid Fullscreen] New Mermaid diagram detected via MutationObserver!');
              setTimeout(initMermaidFullscreen, 200);
            } else if (node.querySelector) {
              const mermaidContainers = node.querySelectorAll('[class*="docusaurus-mermaid-container"]');
              if (mermaidContainers.length > 0) {
                console.log('[Mermaid Fullscreen] New Mermaid diagrams detected in added node:', mermaidContainers.length);
                setTimeout(initMermaidFullscreen, 200);
              }
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('[Mermaid Fullscreen] MutationObserver started');
  }

  // Expune funcția global pentru debugging
  window.debugMermaidFullscreen = initMermaidFullscreen;
  console.log('[Mermaid Fullscreen] Debug function exposed: window.debugMermaidFullscreen()');

})();
